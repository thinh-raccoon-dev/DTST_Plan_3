import { randomInt } from 'node:crypto';
import type { Request, Response } from 'express';
import type { Types } from 'mongoose';
import QRCode from 'qrcode';
import { AnalyticsEventModel } from '../../models/AnalyticsEvent.js';
import { ChallengeModel } from '../../models/Challenge.js';
import { DestinationModel } from '../../models/Destination.js';
import { PassportEntryModel } from '../../models/PassportEntry.js';
import { QrCodeModel, type QrTargetType } from '../../models/QrCode.js';
import { idParamsSchema, paginate } from '../../schemas/common.js';
import { adminQrQuerySchema, qrImageQuerySchema, qrInputSchema, qrPatchSchema } from '../../schemas/qr.schemas.js';
import { qrPublicUrl, type LeanQrCode } from '../../services/qr.service.js';
import { badRequest, conflict, notFound } from '../../utils/errors.js';
import { escapeRegex } from '../../utils/text.js';

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomCode(): string {
  let suffix = '';
  for (let i = 0; i < 6; i += 1) suffix += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return `DT-${suffix}`;
}

async function describeTarget(targetType: QrTargetType, targetId: Types.ObjectId) {
  if (targetType === 'destination') {
    const d = await DestinationModel.findById(targetId).select('name slug publicationStatus').lean();
    return d
      ? { exists: true, label: d.name, destinationSlug: d.slug, destinationName: d.name, publicationStatus: d.publicationStatus, challengeStatus: null }
      : { exists: false, label: 'Địa điểm đã bị xóa', destinationSlug: null, destinationName: null, publicationStatus: null, challengeStatus: null };
  }
  const c = await ChallengeModel.findById(targetId).select('title status destinationId').lean();
  if (!c) return { exists: false, label: 'Thử thách đã bị xóa', destinationSlug: null, destinationName: null, publicationStatus: null, challengeStatus: null };
  const d = await DestinationModel.findById(c.destinationId).select('name slug publicationStatus').lean();
  return {
    exists: true,
    label: c.title,
    destinationSlug: d?.slug ?? null,
    destinationName: d?.name ?? null,
    publicationStatus: d?.publicationStatus ?? null,
    challengeStatus: c.status,
  };
}

async function ensureTargetExists(targetType: QrTargetType, targetId: string) {
  const exists =
    targetType === 'destination' ? await DestinationModel.exists({ _id: targetId }) : await ChallengeModel.exists({ _id: targetId });
  if (!exists) {
    throw badRequest('Nội dung đích không tồn tại.', 'VALIDATION_ERROR', [{ path: 'targetId', message: 'Không tìm thấy nội dung đích.' }]);
  }
}

async function landingStats(ids: Types.ObjectId[]) {
  const rows = await AnalyticsEventModel.aggregate<{ _id: Types.ObjectId; views: number; lastAt: Date }>([
    { $match: { eventType: 'qr_landing_view', qrCodeId: { $in: ids } } },
    { $group: { _id: '$qrCodeId', views: { $sum: 1 }, lastAt: { $max: '$timestamp' } } },
  ]);
  return new Map(rows.map((row) => [String(row._id), row]));
}

async function serialize(qr: LeanQrCode, stats?: { views: number; lastAt: Date }) {
  return {
    id: String(qr._id),
    code: qr.code,
    label: qr.label,
    targetType: qr.targetType,
    targetId: String(qr.targetId),
    target: await describeTarget(qr.targetType, qr.targetId),
    status: qr.status,
    notes: qr.notes ?? null,
    url: qrPublicUrl(qr.code),
    landingViews: stats?.views ?? 0,
    lastLandingAt: stats?.lastAt ?? null,
    createdAt: qr.createdAt ?? null,
    updatedAt: qr.updatedAt ?? null,
  };
}

export async function listQrCodes(req: Request, res: Response) {
  const query = adminQrQuerySchema.parse(req.query);
  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;
  if (query.q) {
    const pattern = escapeRegex(query.q);
    filter.$or = [{ code: { $regex: pattern, $options: 'i' } }, { label: { $regex: pattern, $options: 'i' } }];
  }
  const [docs, total] = await Promise.all([
    QrCodeModel.find(filter)
      .sort({ createdAt: -1, _id: 1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean<LeanQrCode[]>(),
    QrCodeModel.countDocuments(filter),
  ]);
  const stats = await landingStats(docs.map((d) => d._id));
  const items = await Promise.all(docs.map((d) => serialize(d, stats.get(String(d._id)))));
  res.json(paginate(items, total, query.page, query.limit));
}

export async function getQrCode(req: Request, res: Response) {
  const { id } = idParamsSchema.parse(req.params);
  const qr = await QrCodeModel.findById(id).lean<LeanQrCode>();
  if (!qr) throw notFound('Không tìm thấy mã QR.');
  const since = new Date(Date.now() - 30 * 24 * 60 * 60_000);
  const [stats, last30Days, checkIns, completions] = await Promise.all([
    landingStats([qr._id]),
    AnalyticsEventModel.countDocuments({ eventType: 'qr_landing_view', qrCodeId: qr._id, timestamp: { $gte: since } }),
    PassportEntryModel.countDocuments({ qrCodeId: qr._id, entryType: 'check_in' }),
    PassportEntryModel.countDocuments({ qrCodeId: qr._id, entryType: 'challenge_completed' }),
  ]);
  res.json({
    qr: await serialize(qr, stats.get(String(qr._id))),
    stats: { landingViewsLast30Days: last30Days, checkIns, challengeCompletions: completions },
  });
}

export async function createQrCode(req: Request, res: Response) {
  const input = qrInputSchema.parse(req.body);
  await ensureTargetExists(input.targetType, input.targetId);

  let code = input.code || randomCode();
  if (input.code) {
    if (await QrCodeModel.exists({ code })) throw conflict('Mã QR này đã tồn tại.', 'QR_CODE_TAKEN');
  } else {
    for (let attempt = 0; attempt < 5 && (await QrCodeModel.exists({ code })); attempt += 1) code = randomCode();
  }
  const qr = await QrCodeModel.create({ ...input, code });
  res.status(201).json({ qr: await serialize(qr.toObject() as LeanQrCode) });
}

export async function updateQrCode(req: Request, res: Response) {
  const { id } = idParamsSchema.parse(req.params);
  const patch = qrPatchSchema.parse(req.body);
  const qr = await QrCodeModel.findById(id);
  if (!qr) throw notFound('Không tìm thấy mã QR.');
  if (patch.targetType && patch.targetId) await ensureTargetExists(patch.targetType, patch.targetId);
  qr.set(patch);
  await qr.save();
  const stats = await landingStats([qr._id]);
  res.json({ qr: await serialize(qr.toObject() as LeanQrCode, stats.get(String(qr._id))) });
}

export async function getQrImage(req: Request, res: Response) {
  const { id } = idParamsSchema.parse(req.params);
  const { format, download } = qrImageQuerySchema.parse(req.query);
  const qr = await QrCodeModel.findById(id).select('code').lean();
  if (!qr) throw notFound('Không tìm thấy mã QR.');

  const url = qrPublicUrl(qr.code);
  const options = { errorCorrectionLevel: 'M' as const, margin: 2 };
  if (download === '1') res.attachment(`qr-${qr.code}.${format}`);
  res.set('Cache-Control', 'no-store');
  if (format === 'svg') {
    res.type('image/svg+xml').send(await QRCode.toString(url, { ...options, type: 'svg' }));
  } else {
    res.type('image/png').send(await QRCode.toBuffer(url, { ...options, type: 'png', width: 1024 }));
  }
}
