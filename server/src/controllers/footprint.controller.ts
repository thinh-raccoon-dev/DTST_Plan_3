import type { Request, Response } from 'express';
import { z } from 'zod';
import { DestinationModel } from '../models/Destination.js';
import { FootprintPhotoModel } from '../models/FootprintPhoto.js';
import { PassportEntryModel } from '../models/PassportEntry.js';
import { TravelFootprintModel } from '../models/TravelFootprint.js';
import { identityFromRequest, ownerFields, ownerFilter } from '../services/identity.js';
import { checkIn } from '../services/passport.service.js';
import { haversineKm, haversineMeters, MAX_CHECKIN_METERS } from '../utils/geo.js';
import { logger } from '../utils/logger.js';
import { buildPhotoPlaceCollections, serializeFootprintPhoto } from './footprintPhotos.controller.js';

const pointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  timestamp: z.union([z.number(), z.string()]).transform((v) => (typeof v === 'number' ? v : new Date(v).getTime() || Date.now())),
  speedKmh: z.number().optional(),
});

const memorySchema = z.object({
  clientId: z.string().trim().min(1).max(100),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  emoji: z.string().trim().min(1).max(16).default('🦊'),
  moodLabel: z.string().trim().min(1).max(60).default('Kỷ niệm đáng nhớ'),
  note: z.string().trim().max(400).optional().default(''),
  placeName: z.string().trim().max(160).optional(),
  imageUrl: z.string().trim().max(400).optional(),
  createdAt: z.union([z.number(), z.string()]).transform((v) => (typeof v === 'number' ? v : new Date(v).getTime() || Date.now())),
});

const trackInputSchema = z.object({
  clientId: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(160),
  color: z.string().trim().max(30).optional().default('#10b981'),
  distanceKm: z.number().min(0).optional(),
  durationSeconds: z.number().min(0).optional(),
  startedAt: z.union([z.number(), z.string()]),
  endedAt: z.union([z.number(), z.string()]),
  points: z.array(pointSchema).max(2000).default([]),
  memories: z.array(memorySchema).max(200).default([]),
  isDemoRoute: z.boolean().optional().default(false),
});

const syncFootprintsSchema = z.object({
  tracks: z.array(trackInputSchema).max(50).default([]),
  autoCheckIn: z.boolean().optional().default(true),
});

function computeTrackDistanceKm(points: Array<{ lat: number; lng: number }>): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineKm(points[i - 1]!, points[i]!);
  }
  return Math.round(total * 100) / 100;
}

export async function listFootprintsHandler(req: Request, res: Response): Promise<void> {
  try {
    const identity = identityFromRequest(req);
    const filter = ownerFilter(identity);

    // If user is authenticated and also has an anonymousSessionId cookie, merge any unclaimed device tracks & photos automatically
    if (identity.userId && identity.anonymousSessionId) {
      await Promise.all([
        TravelFootprintModel.updateMany(
          { anonymousSessionId: identity.anonymousSessionId, userId: { $exists: false } },
          { $set: { userId: identity.userId }, $unset: { anonymousSessionId: 1 } },
        ),
        FootprintPhotoModel.updateMany(
          { anonymousSessionId: identity.anonymousSessionId, userId: { $exists: false } },
          { $set: { userId: identity.userId }, $unset: { anonymousSessionId: 1 } },
        ),
      ]);
    }

    const [tracks, checkInEntries, allDestinations, photoDocs] = await Promise.all([
      TravelFootprintModel.find(filter).sort({ startedAt: -1 }).limit(100).lean(),
      PassportEntryModel.find({ ...filter, entryType: 'check_in' })
        .sort({ createdAt: -1 })
        .limit(200)
        .lean(),
      DestinationModel.find({
        publicationStatus: 'published',
        'coordinates.lat': { $exists: true, $ne: null },
        'coordinates.lng': { $exists: true, $ne: null },
      })
        .select('_id name slug area category coordinates images summary')
        .lean(),
      FootprintPhotoModel.find(filter).sort({ takenAt: -1, createdAt: -1 }).limit(300).lean(),
    ]);

    const photos = photoDocs.map(serializeFootprintPhoto);
    const photoPlaces = buildPhotoPlaceCollections(photos);

    const totalDestinations = Math.max(1, allDestinations.length);
    const destById = new Map(allDestinations.map((d) => [String(d._id), d]));
    const checkedInDestIds = new Set(
      checkInEntries.map((e) => (e.destinationId ? String(e.destinationId) : '')).filter(Boolean),
    );

    const geofenceTargets = allDestinations
      .filter((d) => typeof d.coordinates?.lat === 'number' && typeof d.coordinates?.lng === 'number')
      .map((d) => ({
        id: String(d._id),
        name: d.name,
        slug: d.slug,
        area: d.area,
        category: d.category,
        summary: d.summary || '',
        imageUrl: d.images?.[0]?.url,
        coordinates: { lat: d.coordinates!.lat, lng: d.coordinates!.lng },
        isCheckedIn: checkedInDestIds.has(String(d._id)),
      }));

    const checkInPins = checkInEntries
      .map((entry) => {
        const d = entry.destinationId ? destById.get(String(entry.destinationId)) : undefined;
        if (!d || typeof d.coordinates?.lat !== 'number' || typeof d.coordinates?.lng !== 'number') {
          return null;
        }
        return {
          id: String(entry._id),
          destinationId: String(d._id),
          name: d.name,
          slug: d.slug,
          area: d.area,
          category: d.category,
          summary: d.summary || '',
          imageUrl: d.images?.[0]?.url,
          coordinates: { lat: d.coordinates.lat, lng: d.coordinates.lng },
          pointsAwarded: entry.scoreAwarded ?? 10,
          checkedInAt: entry.completedAt,
        };
      })
      .filter(Boolean);

    const totalDistanceKm =
      Math.round(tracks.reduce((acc, t) => acc + (t.distanceKm || 0), 0) * 100) / 100;
    const totalMemories = tracks.reduce((acc, t) => acc + (t.memories?.length || 0), 0);

    // Calculate Fog-of-War exploration percentage based on unique grid cells (~1.5km cells) + check-ins
    const unlockedCells = new Set<string>();
    for (const t of tracks) {
      for (const pt of t.points || []) {
        unlockedCells.add(`${(pt.lat * 50).toFixed(0)}:${(pt.lng * 50).toFixed(0)}`);
      }
      for (const mem of t.memories || []) {
        unlockedCells.add(`${(mem.lat * 50).toFixed(0)}:${(mem.lng * 50).toFixed(0)}`);
      }
    }
    for (const pin of checkInPins) {
      if (pin) {
        unlockedCells.add(
          `${(pin.coordinates.lat * 50).toFixed(0)}:${(pin.coordinates.lng * 50).toFixed(0)}`,
        );
      }
    }
    for (const ph of photos) {
      unlockedCells.add(
        `${(ph.coordinates.lat * 50).toFixed(0)}:${(ph.coordinates.lng * 50).toFixed(0)}`,
      );
    }

    const baseTargetCells = Math.max(60, totalDestinations * 2);
    const rawPercent = ((unlockedCells.size + checkInPins.length * 2) / baseTargetCells) * 100;
    const exploredPercent = Math.min(100, Math.round(rawPercent * 10) / 10);

    res.set('Cache-Control', 'no-store');
    res.json({
      success: true,
      stats: {
        totalDistanceKm,
        totalTracks: tracks.length,
        totalMemories,
        totalPhotos: photos.length,
        totalPhotoPlaces: photoPlaces.length,
        totalCheckIns: checkInPins.length,
        unlockedZonesCount: unlockedCells.size,
        exploredPercent,
      },
      tracks: tracks.map((t) => ({
        id: String(t._id),
        clientId: t.clientId,
        title: t.title,
        color: t.color,
        distanceKm: t.distanceKm,
        durationSeconds: t.durationSeconds,
        startedAt: t.startedAt,
        endedAt: t.endedAt,
        points: t.points,
        memories: t.memories,
        isDemoRoute: t.isDemoRoute,
      })),
      photos,
      photoPlaces,
      checkInPins,
      geofenceTargets,
      maxCheckInMeters: MAX_CHECKIN_METERS,
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to list travel footprints');
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Không thể tải dữ liệu Bản đồ Dấu chân lúc này.' },
    });
  }
}

export async function syncFootprintsHandler(req: Request, res: Response): Promise<void> {
  const parsed = syncFootprintsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Dữ liệu đồng bộ hành trình không hợp lệ.',
        details: parsed.error.issues,
      },
    });
    return;
  }

  try {
    const identity = identityFromRequest(req);
    const filter = ownerFilter(identity);
    const owner = ownerFields(identity);

    let syncedCount = 0;

    for (const track of parsed.data.tracks) {
      const existing = await TravelFootprintModel.findOne({
        ...filter,
        clientId: track.clientId,
      });

      const computedDist =
        typeof track.distanceKm === 'number' && track.distanceKm > 0
          ? track.distanceKm
          : computeTrackDistanceKm(track.points);

      const startedDate = new Date(track.startedAt);
      const endedDate = new Date(track.endedAt);
      const durationSec =
        typeof track.durationSeconds === 'number' && track.durationSeconds > 0
          ? track.durationSeconds
          : Math.max(0, Math.round((endedDate.getTime() - startedDate.getTime()) / 1000));

      if (existing) {
        // Merge points & memories idempotently
        const existingTimestamps = new Set(existing.points.map((p) => p.timestamp));
        for (const pt of track.points) {
          if (!existingTimestamps.has(pt.timestamp) && existing.points.length < 2000) {
            existing.points.push(pt);
            existingTimestamps.add(pt.timestamp);
          }
        }
        existing.points.sort((a, b) => a.timestamp - b.timestamp);

        const existingMemIds = new Set(existing.memories.map((m) => m.clientId));
        for (const mem of track.memories) {
          if (!existingMemIds.has(mem.clientId)) {
            existing.memories.push(mem);
            existingMemIds.add(mem.clientId);
          }
        }

        existing.title = track.title || existing.title;
        existing.color = track.color || existing.color;
        existing.distanceKm = Math.max(existing.distanceKm, computeTrackDistanceKm(existing.points), computedDist);
        existing.durationSeconds = Math.max(existing.durationSeconds, durationSec);
        if (endedDate > existing.endedAt) existing.endedAt = endedDate;

        await existing.save();
      } else {
        await TravelFootprintModel.create({
          ...owner,
          clientId: track.clientId,
          title: track.title,
          color: track.color,
          distanceKm: computedDist,
          durationSeconds: durationSec,
          startedAt: startedDate,
          endedAt: endedDate,
          points: track.points,
          memories: track.memories,
          isDemoRoute: track.isDemoRoute,
        });
      }
      syncedCount++;
    }

    // Automatic Hands-Free GPS Check-in for any published destination within MAX_CHECKIN_METERS (1,000m) of the synced trajectory
    const autoCheckIns: Array<{
      id: string;
      name: string;
      slug: string;
      area: string;
      category: string;
      pointsAwarded: number;
      distanceMeters: number;
    }> = [];
    const newBadges: unknown[] = [];

    if (parsed.data.autoCheckIn !== false && parsed.data.tracks.length > 0) {
      const allPts = parsed.data.tracks.flatMap((t) => t.points);
      if (allPts.length > 0) {
        const [publishedDestinations, existingCheckIns] = await Promise.all([
          DestinationModel.find({
            publicationStatus: 'published',
            'coordinates.lat': { $exists: true, $ne: null },
            'coordinates.lng': { $exists: true, $ne: null },
          })
            .select('_id name slug area category coordinates')
            .lean(),
          PassportEntryModel.find({ ...filter, entryType: 'check_in' })
            .select('destinationId')
            .lean(),
        ]);

        const alreadyCheckedIn = new Set(
          existingCheckIns.map((e) => (e.destinationId ? String(e.destinationId) : '')).filter(Boolean),
        );

        for (const dest of publishedDestinations) {
          const destIdStr = String(dest._id);
          if (alreadyCheckedIn.has(destIdStr)) continue;
          if (typeof dest.coordinates?.lat !== 'number' || typeof dest.coordinates?.lng !== 'number') {
            continue;
          }

          let minDistance = Infinity;
          for (const pt of allPts) {
            const dist = haversineMeters(
              { lat: pt.lat, lng: pt.lng },
              { lat: dest.coordinates.lat, lng: dest.coordinates.lng },
            );
            if (dist < minDistance) {
              minDistance = dist;
              if (minDistance <= MAX_CHECKIN_METERS) break;
            }
          }

          if (minDistance <= MAX_CHECKIN_METERS) {
            try {
              const result = await checkIn(identity, dest._id, undefined, 'gps');
              alreadyCheckedIn.add(destIdStr);
              if (result.created) {
                autoCheckIns.push({
                  id: destIdStr,
                  name: dest.name,
                  slug: dest.slug,
                  area: dest.area,
                  category: dest.category,
                  pointsAwarded: result.pointsAwarded,
                  distanceMeters: Math.round(minDistance),
                });
                if (result.newBadges?.length) {
                  newBadges.push(...result.newBadges);
                }
              }
            } catch {
              // ignore individual checkIn errors so sync always succeeds
            }
          }
        }
      }
    }

    res.json({
      success: true,
      syncedCount,
      autoCheckIns,
      newBadges,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to sync offline travel footprints');
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Không thể đồng bộ hành trình lên máy chủ lúc này.' },
    });
  }
}

export async function deleteFootprintHandler(req: Request, res: Response): Promise<void> {
  try {
    const identity = identityFromRequest(req);
    const filter = ownerFilter(identity);
    const { clientId } = req.params;

    await TravelFootprintModel.deleteOne({ ...filter, clientId });
    res.json({ success: true, deletedClientId: clientId });
  } catch (error) {
    logger.error({ err: error }, 'Failed to delete footprint track');
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Không thể xóa hành trình này.' },
    });
  }
}
