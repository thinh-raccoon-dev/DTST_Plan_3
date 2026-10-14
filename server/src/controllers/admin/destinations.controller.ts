import type { Request, Response } from 'express';
import { ChallengeModel } from '../../models/Challenge.js';
import { DestinationModel, type DestinationDocument } from '../../models/Destination.js';
import { FavoriteModel } from '../../models/Favorite.js';
import { QrCodeModel } from '../../models/QrCode.js';
import { UserModel } from '../../models/User.js';
import { idParamsSchema, paginate } from '../../schemas/common.js';
import {
  adminDestinationQuerySchema,
  destinationInputSchema,
  destinationPatchSchema,
  type DestinationPatch,
} from '../../schemas/destination.schemas.js';
import {
  computeVerificationStatus,
  toAdminDestination,
  verificationIssues,
  type LeanDestination,
} from '../../services/destination.service.js';
import { badRequest, conflict, forbidden, notFound } from '../../utils/errors.js';
import { escapeRegex, normalizeText, slugify } from '../../utils/text.js';

function cleanContact(contact: DestinationPatch['contactInfo']) {
  if (!contact) return null;
  const entries = Object.entries(contact).filter(([, value]) => typeof value === 'string' && value.trim() !== '');
  return entries.length ? Object.fromEntries(entries) : null;
}

function isPartner(req: Request) {
  return req.user?.role === 'partner';
}

function partnerScope(req: Request): Record<string, unknown> {
  return isPartner(req) ? { managedBy: req.user!.id } : {};
}

async function resolveManagedBy(email: string | undefined) {
  if (email === undefined) return undefined;
  if (!email) return null;
  const partner = await UserModel.findOne({ email, role: 'partner', status: 'active' }).select('_id').lean();
  if (!partner) throw badRequest('Không tìm thấy tài khoản đối tác với email này.', 'PARTNER_NOT_FOUND');
  return partner._id;
}

/** Converts validated input into stored values: null/empty means "absent", never a fake default. */
function normalizePatch(patch: DestinationPatch): Record<string, unknown> {
  const out: Record<string, unknown> = { ...patch };
  delete out.managedByEmail;
  if ('contactInfo' in patch) out.contactInfo = cleanContact(patch.contactInfo);
  if (patch.images) {
    out.images = patch.images.map((image) => ({ ...image, sourceUrl: image.sourceUrl || undefined }));
  }
  if (patch.slug === '') delete out.slug;
  return out;
}

function assertPartnerCanWrite(req: Request, patch: DestinationPatch) {
  if (!isPartner(req)) return;
  if (patch.publicationStatus === 'published') {
    throw forbidden('Đối tác không thể tự xuất bản địa điểm. Quản trị viên sẽ duyệt nội dung.');
  }
  if (patch.managedByEmail) {
    throw forbidden('Đối tác không thể chuyển quyền quản lý địa điểm.');
  }
}

async function applyAndSave(doc: DestinationDocument, values: Record<string, unknown>) {
  for (const [key, value] of Object.entries(values)) {
    doc.set(key, value === null ? undefined : value);
  }
  const snapshot = doc.toObject();
  const fields = {
    address: snapshot.address,
    coordinates: snapshot.coordinates,
    openingHours: snapshot.openingHours,
    referencePrice: snapshot.referencePrice,
    contactInfo: snapshot.contactInfo as Record<string, unknown> | null | undefined,
    verification: {
      location: snapshot.verification?.location ?? 'unknown',
      openingHours: snapshot.verification?.openingHours ?? 'unknown',
      referencePrice: snapshot.verification?.referencePrice ?? 'unknown',
      contactInfo: snapshot.verification?.contactInfo ?? 'unknown',
    },
  };
  const issues = verificationIssues({ ...fields, sourceUrls: snapshot.sourceUrls ?? [], lastVerifiedAt: snapshot.lastVerifiedAt });
  if (issues.length) throw badRequest('Thông tin xác minh không hợp lệ.', 'VALIDATION_ERROR', issues);
  doc.verificationStatus = computeVerificationStatus(fields);

  const slugOwner = await DestinationModel.findOne({ slug: doc.slug, _id: { $ne: doc._id } }).select('_id').lean();
  if (slugOwner) throw conflict('Slug đã được dùng cho địa điểm khác.', 'SLUG_TAKEN');
  await doc.save();
  return doc;
}

const MANAGER_POPULATE = { path: 'managedBy', select: 'email displayName' } as const;

export async function listAdminDestinations(req: Request, res: Response) {
  const query = adminDestinationQuerySchema.parse(req.query);
  const filter: Record<string, unknown> = { ...partnerScope(req) };
  if (query.category) filter.category = query.category;
  if (query.publicationStatus) filter.publicationStatus = query.publicationStatus;
  if (query.q) filter.searchText = { $regex: escapeRegex(normalizeText(query.q)) };

  const [docs, total] = await Promise.all([
    DestinationModel.find(filter)
      .populate(MANAGER_POPULATE)
      .sort({ updatedAt: -1, _id: 1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean<LeanDestination[]>(),
    DestinationModel.countDocuments(filter),
  ]);
  res.json(paginate(docs.map(toAdminDestination), total, query.page, query.limit));
}

export async function getAdminDestination(req: Request, res: Response) {
  const { id } = idParamsSchema.parse(req.params);
  const doc = await DestinationModel.findOne({ _id: id, ...partnerScope(req) })
    .populate(MANAGER_POPULATE)
    .lean<LeanDestination>();
  if (!doc) throw notFound('Không tìm thấy địa điểm.');
  res.json({ destination: toAdminDestination(doc) });
}

export async function createDestination(req: Request, res: Response) {
  const input = destinationInputSchema.parse(req.body);
  assertPartnerCanWrite(req, input);
  const slug = input.slug || slugify(input.name);
  if (!slug) throw badRequest('Không tạo được slug từ tên địa điểm.', 'VALIDATION_ERROR', [{ path: 'slug', message: 'Vui lòng nhập slug.' }]);
  const managedBy = isPartner(req) ? req.user!.id : await resolveManagedBy(input.managedByEmail);
  const doc = new DestinationModel({
    slug,
    ...(isPartner(req) ? { publicationStatus: 'draft', managedBy: req.user!.id } : {}),
  });
  const values = normalizePatch({ ...input, slug, ...(isPartner(req) ? { publicationStatus: 'draft' } : {}) });
  if (managedBy !== undefined) values.managedBy = managedBy;
  await applyAndSave(doc, values);
  await doc.populate(MANAGER_POPULATE);
  res.status(201).json({ destination: toAdminDestination(doc.toObject() as LeanDestination) });
}

export async function updateDestination(req: Request, res: Response) {
  const { id } = idParamsSchema.parse(req.params);
  const patch = destinationPatchSchema.parse(req.body);
  assertPartnerCanWrite(req, patch);
  const doc = await DestinationModel.findOne({ _id: id, ...partnerScope(req) });
  if (!doc) throw notFound('Không tìm thấy địa điểm.');
  const values = normalizePatch(patch);
  if (!isPartner(req) && 'managedByEmail' in patch) {
    values.managedBy = await resolveManagedBy(patch.managedByEmail);
  }
  if (values.managedBy === null) {
    doc.set('managedBy', null);
    delete values.managedBy;
  }
  await applyAndSave(doc, values);
  await doc.populate(MANAGER_POPULATE);
  res.json({ destination: toAdminDestination(doc.toObject() as LeanDestination) });
}

export async function deleteDestination(req: Request, res: Response) {
  if (isPartner(req)) throw forbidden('Đối tác không thể xóa địa điểm. Hãy ẩn hoặc gửi yêu cầu cho quản trị viên.');
  const { id } = idParamsSchema.parse(req.params);
  const doc = await DestinationModel.findById(id);
  if (!doc) throw notFound('Không tìm thấy địa điểm.');

  const challengeIds = await ChallengeModel.find({ destinationId: doc._id }).distinct('_id');
  const [qrCount, challengeCount] = await Promise.all([
    QrCodeModel.countDocuments({ targetId: { $in: [doc._id, ...challengeIds] } }),
    Promise.resolve(challengeIds.length),
  ]);
  if (qrCount > 0 || challengeCount > 0) {
    throw conflict(
      'Địa điểm đang gắn với mã QR hoặc thử thách. Hãy ẩn địa điểm thay vì xóa để không làm hỏng QR đã in.',
      'DESTINATION_IN_USE',
    );
  }
  await doc.deleteOne();
  await FavoriteModel.deleteMany({ destinationId: doc._id });
  res.status(204).end();
}
