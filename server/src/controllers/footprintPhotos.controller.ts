import crypto from 'node:crypto';
import { existsSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import type { NextFunction, Request, Response } from 'express';
import { isValidObjectId, Types } from 'mongoose';
import multer from 'multer';
import { z } from 'zod';
import { DestinationModel } from '../models/Destination.js';
import { FootprintPhotoModel } from '../models/FootprintPhoto.js';
import { FootprintPhotoBlobModel } from '../models/FootprintPhotoBlob.js';
import { identityFromRequest, ownerFields, ownerFilter } from '../services/identity.js';
import { checkIn } from '../services/passport.service.js';
import { haversineMeters, MAX_CHECKIN_METERS } from '../utils/geo.js';
import { logger } from '../utils/logger.js';

const legacyFootprintUploadsDir = path.resolve(process.cwd(), 'uploads', 'footprints');

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif',
};

const ALLOWED_MIME_TYPES = new Set(Object.keys(MIME_TO_EXT));
const MAX_AUTO_PLACE_MATCH_METERS = 500;
const MEDIA_KEY_REGEX = /^[a-f0-9]{32}\.(?:jpg|png|webp|gif|avif)$/i;

/** OWASP binary magic-byte verification directly on in-memory upload Buffer. */
function hasValidImageMagicBytesBuffer(buf: Buffer): boolean {
  if (!buf || buf.length < 8) return false;
  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  // PNG
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return true;
  }
  // GIF
  const header6 = buf.subarray(0, 6).toString('ascii');
  if (header6 === 'GIF87a' || header6 === 'GIF89a') return true;
  // WebP
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return true;
  }
  // AVIF
  if (buf.length >= 12 && buf.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = buf.subarray(8, 12).toString('ascii');
    if (brand === 'avif' || brand === 'avis' || brand === 'mif1') return true;
  }
  return false;
}

function safeUnlink(filePath: string) {
  try {
    if (existsSync(filePath)) unlinkSync(filePath);
  } catch {
    // ignore cleanup failure
  }
}

const rawPhotoUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB (safely below MongoDB 16 MB BSON limit)
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Định dạng ảnh không được hỗ trợ. Vui lòng dùng JPG, PNG, WebP, GIF hoặc AVIF.'));
    }
  },
}).single('photo');

/** Runs multer only for multipart/form-data requests; lets JSON metadata payloads through cleanly. */
export function optionalPhotoUploadMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!req.is('multipart/form-data')) {
    next();
    return;
  }
  rawPhotoUpload(req, res, (err: unknown) => {
    if (err) {
      const message =
        err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE'
          ? 'Ảnh vượt quá giới hạn 10 MB. Vui lòng chọn ảnh nhẹ hơn.'
          : err instanceof Error
            ? err.message
            : 'Không thể tải ảnh lên.';
      res.status(400).json({ error: { code: 'UPLOAD_ERROR', message } });
      return;
    }
    next();
  });
}

function coerceOptionalNumber(val: unknown): number | undefined {
  if (val === undefined || val === null || val === '') return undefined;
  const n = Number(val);
  return Number.isFinite(n) ? n : undefined;
}

function coerceBoolean(val: unknown, fallback: boolean): boolean {
  if (val === undefined || val === null || val === '') return fallback;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') {
    const lower = val.trim().toLowerCase();
    if (lower === 'false' || lower === '0' || lower === 'no') return false;
    if (lower === 'true' || lower === '1' || lower === 'yes') return true;
  }
  return fallback;
}

function coerceDate(val: unknown): Date {
  if (val instanceof Date && !Number.isNaN(val.getTime())) return val;
  if (typeof val === 'number' && Number.isFinite(val)) {
    const d = new Date(val);
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (typeof val === 'string' && val.trim().length > 0) {
    const asNum = Number(val);
    const d =
      Number.isFinite(asNum) && val.trim().length >= 10 && /^\d+$/.test(val.trim())
        ? new Date(asNum)
        : new Date(val.trim());
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

const sourceAppEnum = z.enum(['web', 'ios', 'android', 'flutter', 'import']);
const exifSourceEnum = z.enum(['exif', 'gps', 'manual']);
const visibilityEnum = z.enum(['private', 'public']);

const safeImageUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(600)
  .refine(
    (u) =>
      u.startsWith('/api/v1/footprints/media/') ||
      u.startsWith('/uploads/') ||
      u.startsWith('/images/') ||
      /^https?:\/\//i.test(u),
    'URL ảnh không hợp lệ.',
  );

const createPhotoSchema = z.object({
  clientPhotoId: z.string().trim().min(1).max(120).optional(),
  imageUrl: safeImageUrlSchema.optional(),
  thumbnailUrl: safeImageUrlSchema.optional(),
  lat: z.preprocess(coerceOptionalNumber, z.number().min(-90).max(90)),
  lng: z.preprocess(coerceOptionalNumber, z.number().min(-180).max(180)),
  accuracyMeters: z.preprocess(coerceOptionalNumber, z.number().min(0).max(50_000).optional()),
  altitudeMeters: z.preprocess(coerceOptionalNumber, z.number().min(-500).max(15_000).optional()),
  headingDegrees: z.preprocess(coerceOptionalNumber, z.number().min(0).max(360).optional()),
  takenAt: z.unknown().transform(coerceDate),
  placeName: z.string().trim().max(160).optional(),
  area: z.string().trim().max(80).optional(),
  destinationId: z.string().trim().max(64).optional(),
  trackClientId: z.string().trim().max(100).optional(),
  caption: z.string().trim().max(500).optional().default(''),
  moodEmoji: z.string().trim().max(16).optional(),
  sourceApp: sourceAppEnum.optional().default('web'),
  deviceModel: z.string().trim().max(120).optional(),
  exifSource: exifSourceEnum.optional().default('gps'),
  width: z.preprocess(coerceOptionalNumber, z.number().int().min(1).max(20_000).optional()),
  height: z.preprocess(coerceOptionalNumber, z.number().int().min(1).max(20_000).optional()),
  fileSize: z.preprocess(coerceOptionalNumber, z.number().int().min(0).optional()),
  mimeType: z.string().trim().max(64).optional(),
  visibility: visibilityEnum.optional().default('private'),
  autoCheckIn: z.preprocess((v) => coerceBoolean(v, true), z.boolean()).optional().default(true),
});

const syncPhotoItemSchema = createPhotoSchema.extend({
  clientPhotoId: z.string().trim().min(1).max(120),
  imageUrl: safeImageUrlSchema,
});

const syncPhotosSchema = z.object({
  photos: z.array(syncPhotoItemSchema).max(100).default([]),
  autoCheckIn: z.boolean().optional().default(true),
});

const updatePhotoSchema = z.object({
  caption: z.string().trim().max(500).optional(),
  placeName: z.string().trim().max(160).optional(),
  area: z.string().trim().max(80).optional(),
  moodEmoji: z.string().trim().max(16).optional(),
  takenAt: z
    .unknown()
    .optional()
    .transform((v) => (v === undefined ? undefined : coerceDate(v))),
  lat: z.preprocess(coerceOptionalNumber, z.number().min(-90).max(90).optional()),
  lng: z.preprocess(coerceOptionalNumber, z.number().min(-180).max(180).optional()),
  visibility: visibilityEnum.optional(),
});

interface LeanPublishedDest {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  area: string;
  category: string;
  coordinates?: { lat?: number | null; lng?: number | null };
}

function findNearestDestination(
  lat: number,
  lng: number,
  destinations: LeanPublishedDest[],
  maxMeters: number,
): { dest: LeanPublishedDest; distanceMeters: number } | null {
  let best: { dest: LeanPublishedDest; distanceMeters: number } | null = null;
  for (const dest of destinations) {
    if (typeof dest.coordinates?.lat !== 'number' || typeof dest.coordinates?.lng !== 'number') continue;
    const dist = haversineMeters({ lat, lng }, { lat: dest.coordinates.lat, lng: dest.coordinates.lng });
    if (dist <= maxMeters && (!best || dist < best.distanceMeters)) {
      best = { dest, distanceMeters: dist };
    }
  }
  return best;
}

export function serializeFootprintPhoto(p: any) {
  return {
    id: String(p._id),
    clientPhotoId: p.clientPhotoId || String(p._id),
    imageUrl: p.imageUrl,
    thumbnailUrl: p.thumbnailUrl || p.imageUrl,
    coordinates: {
      lat: p.coordinates?.lat ?? p.location?.coordinates?.[1] ?? 0,
      lng: p.coordinates?.lng ?? p.location?.coordinates?.[0] ?? 0,
    },
    accuracyMeters: p.accuracyMeters,
    altitudeMeters: p.altitudeMeters,
    headingDegrees: p.headingDegrees,
    takenAt: p.takenAt instanceof Date ? p.takenAt.toISOString() : new Date(p.takenAt).toISOString(),
    placeName: p.placeName || '',
    area: p.area || '',
    destinationId: p.destinationId ? String(p.destinationId) : undefined,
    destinationSlug: p.destinationSlug || undefined,
    trackClientId: p.trackClientId || undefined,
    caption: p.caption || '',
    moodEmoji: p.moodEmoji || undefined,
    sourceApp: p.sourceApp || 'web',
    deviceModel: p.deviceModel || undefined,
    exifSource: p.exifSource || 'gps',
    width: p.width,
    height: p.height,
    fileSize: p.fileSize,
    mimeType: p.mimeType,
    visibility: p.visibility || 'private',
    createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
  };
}

export function buildPhotoPlaceCollections(photos: ReturnType<typeof serializeFootprintPhoto>[]) {
  const groups = new Map<
    string,
    {
      key: string;
      placeName: string;
      area: string;
      destinationId?: string;
      destinationSlug?: string;
      coordinates: { lat: number; lng: number };
      coverImageUrl: string;
      photoCount: number;
      latestTakenAt: string;
      earliestTakenAt: string;
      photoIds: string[];
    }
  >();

  for (const photo of photos) {
    const placeKey = photo.destinationId
      ? `dest:${photo.destinationId}`
      : photo.placeName
        ? `place:${photo.placeName.toLowerCase()}`
        : `grid:${photo.coordinates.lat.toFixed(2)},${photo.coordinates.lng.toFixed(2)}`;

    const existing = groups.get(placeKey);
    if (!existing) {
      groups.set(placeKey, {
        key: placeKey,
        placeName:
          photo.placeName ||
          `Vị trí ${photo.coordinates.lat.toFixed(3)}, ${photo.coordinates.lng.toFixed(3)}`,
        area: photo.area || '',
        destinationId: photo.destinationId,
        destinationSlug: photo.destinationSlug,
        coordinates: photo.coordinates,
        coverImageUrl: photo.thumbnailUrl || photo.imageUrl,
        photoCount: 1,
        latestTakenAt: photo.takenAt,
        earliestTakenAt: photo.takenAt,
        photoIds: [photo.id],
      });
    } else {
      existing.photoCount += 1;
      existing.photoIds.push(photo.id);
      if (photo.takenAt > existing.latestTakenAt) {
        existing.latestTakenAt = photo.takenAt;
        existing.coverImageUrl = photo.thumbnailUrl || photo.imageUrl;
      }
      if (photo.takenAt < existing.earliestTakenAt) {
        existing.earliestTakenAt = photo.takenAt;
      }
    }
  }

  return Array.from(groups.values()).sort((a, b) => b.latestTakenAt.localeCompare(a.latestTakenAt));
}

export async function claimAnonymousPhotosIfLoggedIn(req: Request): Promise<void> {
  const identity = identityFromRequest(req);
  if (identity.userId && identity.anonymousSessionId) {
    await FootprintPhotoModel.updateMany(
      { anonymousSessionId: identity.anonymousSessionId, userId: { $exists: false } },
      { $set: { userId: identity.userId }, $unset: { anonymousSessionId: 1 } },
    );
  }
}

/**
 * Serves persisted Footprint Photo binaries directly from MongoDB via `/api/v1/footprints/media/:mediaKey`.
 * Immutable 1-year browser/CDN cache, cross-origin enabled (works on Vercel, Render, Docker & Mobile Apps).
 */
export async function serveFootprintMediaHandler(req: Request, res: Response): Promise<void> {
  try {
    const mediaKey = String(req.params.mediaKey || '').trim();
    if (!MEDIA_KEY_REGEX.test(mediaKey)) {
      res.status(404).end();
      return;
    }

    const blob = await FootprintPhotoBlobModel.findOne({ mediaKey })
      .select('contentType data size')
      .lean();

    if (!blob || !blob.data) {
      res.status(404).end();
      return;
    }

    // Handle Mongoose Binary vs Node Buffer cleanly
    const rawBuffer = Buffer.isBuffer(blob.data)
      ? blob.data
      : Buffer.from((blob.data as unknown as { buffer: Uint8Array }).buffer ?? (blob.data as unknown as Uint8Array));

    res.set({
      'Content-Type': blob.contentType || 'image/jpeg',
      'Content-Length': String(rawBuffer.length),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'X-Content-Type-Options': 'nosniff',
    });
    res.send(rawBuffer);
  } catch (error) {
    logger.error({ err: error }, 'Failed to serve footprint photo media');
    res.status(500).end();
  }
}

export async function listFootprintPhotosHandler(req: Request, res: Response): Promise<void> {
  try {
    await claimAnonymousPhotosIfLoggedIn(req);
    const identity = identityFromRequest(req);
    const filter: Record<string, unknown> = { ...ownerFilter(identity) };

    const { from, to, destinationId, area, sourceApp, q, bbox, limit } = req.query;

    if (typeof from === 'string' || typeof to === 'string') {
      const range: Record<string, Date> = {};
      if (typeof from === 'string' && from.trim()) {
        const d = new Date(from);
        if (!Number.isNaN(d.getTime())) range.$gte = d;
      }
      if (typeof to === 'string' && to.trim()) {
        const d = new Date(to);
        if (!Number.isNaN(d.getTime())) range.$lte = d;
      }
      if (Object.keys(range).length > 0) filter.takenAt = range;
    }

    if (typeof destinationId === 'string' && isValidObjectId(destinationId)) {
      filter.destinationId = new Types.ObjectId(destinationId);
    }

    if (typeof area === 'string' && area.trim()) {
      filter.area = area.trim();
    }

    if (typeof sourceApp === 'string' && sourceAppEnum.safeParse(sourceApp).success) {
      filter.sourceApp = sourceApp;
    }

    if (typeof q === 'string' && q.trim()) {
      const escaped = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      filter.$or = [{ placeName: regex }, { caption: regex }, { area: regex }];
    }

    if (typeof bbox === 'string' && bbox.trim()) {
      const parts = bbox.split(',').map((s) => Number(s.trim()));
      if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
        const [minLng, minLat, maxLng, maxLat] = parts as [number, number, number, number];
        filter['coordinates.lng'] = { $gte: minLng, $lte: maxLng };
        filter['coordinates.lat'] = { $gte: minLat, $lte: maxLat };
      }
    }

    const safeLimit = Math.min(500, Math.max(1, Number(limit) || 250));
    const docs = await FootprintPhotoModel.find(filter)
      .sort({ takenAt: -1, createdAt: -1 })
      .limit(safeLimit)
      .lean();

    const photos = docs.map(serializeFootprintPhoto);
    const places = buildPhotoPlaceCollections(photos);

    res.set('Cache-Control', 'no-store');
    res.json({
      success: true,
      photos,
      places,
      stats: {
        totalPhotos: photos.length,
        totalPlaces: places.length,
        latestTakenAt: photos[0]?.takenAt ?? null,
        earliestTakenAt: photos[photos.length - 1]?.takenAt ?? null,
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to list footprint photos');
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Không thể tải thư viện ảnh dấu chân lúc này.' },
    });
  }
}

export async function createFootprintPhotoHandler(req: Request, res: Response): Promise<void> {
  const uploadedFile = req.file;

  try {
    if (uploadedFile && !hasValidImageMagicBytesBuffer(uploadedFile.buffer)) {
      res.status(400).json({
        error: {
          code: 'INVALID_IMAGE_SIGNATURE',
          message: 'Nội dung tệp không phải hình ảnh hợp lệ (JPG/PNG/WebP/GIF/AVIF).',
        },
      });
      return;
    }

    const parsed = createPhotoSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Thông tin vị trí hoặc thời gian ảnh không hợp lệ.',
          details: parsed.error.issues,
        },
      });
      return;
    }

    const data = parsed.data;
    if (!uploadedFile && !data.imageUrl) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Vui lòng đính kèm tệp ảnh (field "photo") hoặc cung cấp imageUrl.',
        },
      });
      return;
    }

    const identity = identityFromRequest(req);
    const filter = ownerFilter(identity);
    const owner = ownerFields(identity);

    // Idempotent check by clientPhotoId
    if (data.clientPhotoId) {
      const existing = await FootprintPhotoModel.findOne({
        ...filter,
        clientPhotoId: data.clientPhotoId,
      }).lean();
      if (existing) {
        res.status(200).json({
          success: true,
          deduplicated: true,
          photo: serializeFootprintPhoto(existing),
        });
        return;
      }
    }

    const publishedDestinations = await DestinationModel.find({
      publicationStatus: 'published',
      'coordinates.lat': { $exists: true, $ne: null },
      'coordinates.lng': { $exists: true, $ne: null },
    })
      .select('_id name slug area category coordinates')
      .lean<LeanPublishedDest[]>();

    let resolvedDest: LeanPublishedDest | undefined;
    if (data.destinationId && isValidObjectId(data.destinationId)) {
      resolvedDest = publishedDestinations.find((d) => String(d._id) === data.destinationId);
    }

    const nearestWithinPlace = findNearestDestination(
      data.lat,
      data.lng,
      publishedDestinations,
      MAX_AUTO_PLACE_MATCH_METERS,
    );
    if (!resolvedDest && nearestWithinPlace) {
      resolvedDest = nearestWithinPlace.dest;
    }

    const finalPlaceName = data.placeName || resolvedDest?.name || '';
    const finalArea = data.area || resolvedDest?.area || '';

    const platformHeader = (req.get('x-client-platform') || '').toLowerCase();
    const finalSourceApp =
      req.body?.sourceApp !== undefined
        ? data.sourceApp
        : platformHeader === 'ios'
          ? 'ios'
          : platformHeader === 'android'
            ? 'android'
            : platformHeader === 'flutter' || platformHeader === 'mobile'
              ? 'flutter'
              : 'web';

    // Persist binary into MongoDB FootprintPhotoBlobModel when multipart file is uploaded
    let mediaKey: string | null = null;
    let finalImageUrl = data.imageUrl || '';
    if (uploadedFile) {
      const ext = MIME_TO_EXT[uploadedFile.mimetype.toLowerCase()] || '.jpg';
      mediaKey = `${crypto.randomBytes(16).toString('hex')}${ext}`;
      finalImageUrl = `/api/v1/footprints/media/${mediaKey}`;
    }

    const photoObjectId = new Types.ObjectId();

    if (uploadedFile && mediaKey) {
      await FootprintPhotoBlobModel.create({
        mediaKey,
        photoId: photoObjectId,
        contentType: uploadedFile.mimetype.toLowerCase() === 'image/jpg' ? 'image/jpeg' : uploadedFile.mimetype.toLowerCase(),
        size: uploadedFile.buffer.length,
        data: uploadedFile.buffer,
      });
    }

    let created;
    try {
      created = await FootprintPhotoModel.create({
        _id: photoObjectId,
        ...owner,
        clientPhotoId: data.clientPhotoId || `fp-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
        imageUrl: finalImageUrl,
        thumbnailUrl: data.thumbnailUrl || finalImageUrl,
        coordinates: { lat: data.lat, lng: data.lng },
        location: { type: 'Point', coordinates: [data.lng, data.lat] },
        accuracyMeters: data.accuracyMeters,
        altitudeMeters: data.altitudeMeters,
        headingDegrees: data.headingDegrees,
        takenAt: data.takenAt,
        placeName: finalPlaceName,
        area: finalArea,
        destinationId: resolvedDest?._id,
        destinationSlug: resolvedDest?.slug,
        trackClientId: data.trackClientId,
        caption: data.caption,
        moodEmoji: data.moodEmoji,
        sourceApp: finalSourceApp,
        deviceModel: data.deviceModel,
        exifSource: data.exifSource,
        width: data.width,
        height: data.height,
        fileSize: uploadedFile?.size ?? data.fileSize,
        mimeType: uploadedFile?.mimetype ?? data.mimeType,
        visibility: data.visibility,
      });
    } catch (createErr) {
      // Roll back orphan blob if metadata insert fails
      if (mediaKey) {
        await FootprintPhotoBlobModel.deleteOne({ mediaKey }).catch(() => {});
      }
      throw createErr;
    }

    // Optional hands-free GPS check-in when shooting a photo within 1,000m of a destination
    let autoCheckInResult: {
      destinationId: string;
      name: string;
      slug: string;
      pointsAwarded: number;
      distanceMeters: number;
    } | null = null;
    let newBadges: unknown[] = [];

    if (data.autoCheckIn !== false) {
      const checkInCandidate = findNearestDestination(
        data.lat,
        data.lng,
        publishedDestinations,
        MAX_CHECKIN_METERS,
      );
      if (checkInCandidate) {
        try {
          const chk = await checkIn(identity, checkInCandidate.dest._id, undefined, 'gps');
          if (chk.created) {
            autoCheckInResult = {
              destinationId: String(checkInCandidate.dest._id),
              name: checkInCandidate.dest.name,
              slug: checkInCandidate.dest.slug,
              pointsAwarded: chk.pointsAwarded,
              distanceMeters: Math.round(checkInCandidate.distanceMeters),
            };
            newBadges = chk.newBadges || [];
          }
        } catch {
          // Never fail photo save if check-in fails
        }
      }
    }

    res.status(201).json({
      success: true,
      photo: serializeFootprintPhoto(created.toObject()),
      autoCheckIn: autoCheckInResult,
      newBadges,
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to save footprint photo');
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Không thể lưu ảnh kỷ niệm lúc này.' },
    });
  }
}

export async function syncFootprintPhotosHandler(req: Request, res: Response): Promise<void> {
  const parsed = syncPhotosSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Dữ liệu đồng bộ ảnh không hợp lệ.',
        details: parsed.error.issues,
      },
    });
    return;
  }

  try {
    await claimAnonymousPhotosIfLoggedIn(req);
    const identity = identityFromRequest(req);
    const filter = ownerFilter(identity);
    const owner = ownerFields(identity);

    const publishedDestinations = await DestinationModel.find({
      publicationStatus: 'published',
      'coordinates.lat': { $exists: true, $ne: null },
      'coordinates.lng': { $exists: true, $ne: null },
    })
      .select('_id name slug area category coordinates')
      .lean<LeanPublishedDest[]>();

    let createdCount = 0;
    let updatedCount = 0;
    const syncedPhotos: ReturnType<typeof serializeFootprintPhoto>[] = [];
    const autoCheckIns: Array<{
      destinationId: string;
      name: string;
      slug: string;
      pointsAwarded: number;
      distanceMeters: number;
    }> = [];
    const newBadges: unknown[] = [];
    const checkedDestIds = new Set<string>();

    for (const item of parsed.data.photos) {
      const existing = await FootprintPhotoModel.findOne({
        ...filter,
        clientPhotoId: item.clientPhotoId,
      });

      const nearest = findNearestDestination(
        item.lat,
        item.lng,
        publishedDestinations,
        MAX_AUTO_PLACE_MATCH_METERS,
      );
      const explicitDest =
        item.destinationId && isValidObjectId(item.destinationId)
          ? publishedDestinations.find((d) => String(d._id) === item.destinationId)
          : undefined;
      const resolvedDest = explicitDest || nearest?.dest;

      if (existing) {
        if (item.caption) existing.caption = item.caption;
        if (item.placeName) existing.placeName = item.placeName;
        if (item.moodEmoji) existing.moodEmoji = item.moodEmoji;
        await existing.save();
        updatedCount++;
        syncedPhotos.push(serializeFootprintPhoto(existing.toObject()));
      } else {
        const created = await FootprintPhotoModel.create({
          ...owner,
          clientPhotoId: item.clientPhotoId,
          imageUrl: item.imageUrl,
          thumbnailUrl: item.thumbnailUrl || item.imageUrl,
          coordinates: { lat: item.lat, lng: item.lng },
          location: { type: 'Point', coordinates: [item.lng, item.lat] },
          accuracyMeters: item.accuracyMeters,
          altitudeMeters: item.altitudeMeters,
          headingDegrees: item.headingDegrees,
          takenAt: item.takenAt,
          placeName: item.placeName || resolvedDest?.name || '',
          area: item.area || resolvedDest?.area || '',
          destinationId: resolvedDest?._id,
          destinationSlug: resolvedDest?.slug,
          trackClientId: item.trackClientId,
          caption: item.caption,
          moodEmoji: item.moodEmoji,
          sourceApp: item.sourceApp,
          deviceModel: item.deviceModel,
          exifSource: item.exifSource,
          width: item.width,
          height: item.height,
          fileSize: item.fileSize,
          mimeType: item.mimeType,
          visibility: item.visibility,
        });
        createdCount++;
        syncedPhotos.push(serializeFootprintPhoto(created.toObject()));
      }

      if (parsed.data.autoCheckIn !== false) {
        const chkCandidate = findNearestDestination(
          item.lat,
          item.lng,
          publishedDestinations,
          MAX_CHECKIN_METERS,
        );
        if (chkCandidate && !checkedDestIds.has(String(chkCandidate.dest._id))) {
          checkedDestIds.add(String(chkCandidate.dest._id));
          try {
            const chk = await checkIn(identity, chkCandidate.dest._id, undefined, 'gps');
            if (chk.created) {
              autoCheckIns.push({
                destinationId: String(chkCandidate.dest._id),
                name: chkCandidate.dest.name,
                slug: chkCandidate.dest.slug,
                pointsAwarded: chk.pointsAwarded,
                distanceMeters: Math.round(chkCandidate.distanceMeters),
              });
              if (chk.newBadges?.length) newBadges.push(...chk.newBadges);
            }
          } catch {
            // ignore
          }
        }
      }
    }

    res.json({
      success: true,
      createdCount,
      updatedCount,
      syncedCount: createdCount + updatedCount,
      photos: syncedPhotos,
      autoCheckIns,
      newBadges,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to batch sync footprint photos');
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Không thể đồng bộ lô ảnh kỷ niệm.' },
    });
  }
}

export async function updateFootprintPhotoHandler(req: Request, res: Response): Promise<void> {
  const parsed = updatePhotoSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Dữ liệu cập nhật ảnh không hợp lệ.',
        details: parsed.error.issues,
      },
    });
    return;
  }

  try {
    const identity = identityFromRequest(req);
    const filter = ownerFilter(identity);
    const idParam = String(req.params.id || '').trim();
    const idQuery = isValidObjectId(idParam)
      ? { $or: [{ _id: new Types.ObjectId(idParam) }, { clientPhotoId: idParam }] }
      : { clientPhotoId: idParam };

    const doc = await FootprintPhotoModel.findOne({ ...filter, ...idQuery });
    if (!doc) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Không tìm thấy ảnh kỷ niệm này.' },
      });
      return;
    }

    const data = parsed.data;
    if (data.caption !== undefined) doc.caption = data.caption;
    if (data.placeName !== undefined) doc.placeName = data.placeName;
    if (data.area !== undefined) doc.area = data.area;
    if (data.moodEmoji !== undefined) doc.moodEmoji = data.moodEmoji;
    if (data.takenAt !== undefined) doc.takenAt = data.takenAt;
    if (data.visibility !== undefined) doc.visibility = data.visibility;
    if (data.lat !== undefined && data.lng !== undefined) {
      doc.coordinates = { lat: data.lat, lng: data.lng };
      doc.location = { type: 'Point', coordinates: [data.lng, data.lat] };
    }

    await doc.save();
    res.json({ success: true, photo: serializeFootprintPhoto(doc.toObject()) });
  } catch (error) {
    logger.error({ err: error }, 'Failed to update footprint photo');
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Không thể cập nhật thông tin ảnh.' },
    });
  }
}

export async function deleteFootprintPhotoHandler(req: Request, res: Response): Promise<void> {
  try {
    const identity = identityFromRequest(req);
    const filter = ownerFilter(identity);
    const idParam = String(req.params.id || '').trim();
    const idQuery = isValidObjectId(idParam)
      ? { $or: [{ _id: new Types.ObjectId(idParam) }, { clientPhotoId: idParam }] }
      : { clientPhotoId: idParam };

    const doc = await FootprintPhotoModel.findOneAndDelete({ ...filter, ...idQuery }).lean();
    if (!doc) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Không tìm thấy ảnh kỷ niệm để xóa.' },
      });
      return;
    }

    // Delete persisted MongoDB binary blob if present
    await FootprintPhotoBlobModel.deleteMany({ photoId: doc._id }).catch(() => {});

    // Also clean up any legacy local disk upload if unreferenced
    if (doc.imageUrl?.startsWith('/uploads/footprints/')) {
      const stillReferenced = await FootprintPhotoModel.exists({ imageUrl: doc.imageUrl });
      if (!stillReferenced) {
        const fileName = path.basename(doc.imageUrl);
        safeUnlink(path.join(legacyFootprintUploadsDir, fileName));
      }
    }

    res.json({ success: true, deletedId: String(doc._id) });
  } catch (error) {
    logger.error({ err: error }, 'Failed to delete footprint photo');
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Không thể xóa ảnh kỷ niệm này.' },
    });
  }
}
