import type { Request, Response } from 'express';
import { BannerModel, type Banner, type BannerDocument } from '../../models/Banner.js';
import { adminBannerQuerySchema, bannerInputSchema, bannerPatchSchema } from '../../schemas/banner.schemas.js';
import { idParamsSchema, paginate } from '../../schemas/common.js';
import { badRequest, notFound } from '../../utils/errors.js';

type LeanBanner = Banner & { _id: unknown; createdAt?: Date; updatedAt?: Date };

function toAdminBanner(b: LeanBanner) {
  const now = Date.now();
  const scheduledOut = (b.startAt && b.startAt.getTime() > now) || (b.endAt && b.endAt.getTime() < now);
  return {
    id: String(b._id),
    placement: b.placement,
    kind: b.kind,
    theme: b.theme,
    eyebrow: b.eyebrow ?? null,
    title: b.title,
    subtitle: b.subtitle ?? null,
    imageUrl: b.imageUrl ?? null,
    imageAlt: b.imageAlt ?? null,
    linkUrl: b.linkUrl ?? null,
    linkLabel: b.linkLabel ?? null,
    sponsorName: b.sponsorName ?? null,
    status: b.status,
    isLive: b.status === 'active' && !scheduledOut,
    startAt: b.startAt ?? null,
    endAt: b.endAt ?? null,
    sortOrder: b.sortOrder ?? 0,
    impressions: b.impressions ?? 0,
    clicks: b.clicks ?? 0,
    createdAt: b.createdAt ?? null,
    updatedAt: b.updatedAt ?? null,
  };
}

/** Empty strings mean "clear this field"; store as absent rather than ''. */
function normalize(values: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) out[key] = value === '' ? undefined : value;
  return out;
}

async function applyAndSave(doc: BannerDocument, values: Record<string, unknown>) {
  for (const [key, value] of Object.entries(values)) {
    // Mongoose ignores `set(path, undefined)` for existing paths — use null to clear optional fields.
    if (value === null || value === undefined) doc.set(key, null);
    else doc.set(key, value);
  }
  await doc.save();
  return doc;
}

export async function listBanners(req: Request, res: Response) {
  const query = adminBannerQuerySchema.parse(req.query);
  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;
  const [docs, total] = await Promise.all([
    BannerModel.find(filter)
      .sort({ sortOrder: 1, createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean<LeanBanner[]>(),
    BannerModel.countDocuments(filter),
  ]);
  res.json(paginate(docs.map(toAdminBanner), total, query.page, query.limit));
}

export async function getBanner(req: Request, res: Response) {
  const { id } = idParamsSchema.parse(req.params);
  const doc = await BannerModel.findById(id).lean<LeanBanner>();
  if (!doc) throw notFound('Không tìm thấy banner.');
  res.json({ banner: toAdminBanner(doc) });
}

export async function createBanner(req: Request, res: Response) {
  const input = bannerInputSchema.parse(req.body);
  const doc = await applyAndSave(new BannerModel(), normalize(input));
  res.status(201).json({ banner: toAdminBanner(doc.toObject() as LeanBanner) });
}

export async function updateBanner(req: Request, res: Response) {
  const { id } = idParamsSchema.parse(req.params);
  const patch = bannerPatchSchema.parse(req.body);
  const doc = await BannerModel.findById(id);
  if (!doc) throw notFound('Không tìm thấy banner.');
  const values = normalize(patch);
  const nextKind = (values.kind as string | undefined) ?? doc.kind;
  const nextSponsor =
    values.sponsorName !== undefined ? (values.sponsorName as string | null | undefined) : doc.sponsorName;
  if (nextKind === 'promo' && !String(nextSponsor ?? '').trim()) {
    throw badRequest('Banner quảng cáo cần ghi rõ đơn vị tài trợ.', 'VALIDATION_ERROR');
  }
  await applyAndSave(doc, values);
  res.json({ banner: toAdminBanner(doc.toObject() as LeanBanner) });
}

export async function deleteBanner(req: Request, res: Response) {
  const { id } = idParamsSchema.parse(req.params);
  const result = await BannerModel.deleteOne({ _id: id });
  if (result.deletedCount === 0) throw notFound('Không tìm thấy banner.');
  res.status(204).end();
}
