import type { Request, Response } from 'express';
import { BannerModel, type Banner } from '../models/Banner.js';
import { idParamsSchema } from '../schemas/common.js';
import { publicBannerQuerySchema } from '../schemas/banner.schemas.js';
import { logger } from '../utils/logger.js';

type LeanBanner = Banner & { _id: unknown };

export function toPublicBanner(b: LeanBanner) {
  return {
    id: String(b._id),
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
  };
}

export function activeBannerFilter(placement: string, now = new Date()) {
  return {
    placement,
    status: 'active',
    $and: [
      { $or: [{ startAt: { $exists: false } }, { startAt: null }, { startAt: { $lte: now } }] },
      { $or: [{ endAt: { $exists: false } }, { endAt: null }, { endAt: { $gte: now } }] },
    ],
  };
}

export async function listPublicBanners(req: Request, res: Response) {
  const { placement } = publicBannerQuerySchema.parse(req.query);
  const docs = await BannerModel.find(activeBannerFilter(placement)).sort({ sortOrder: 1, createdAt: -1 }).limit(6).lean<LeanBanner[]>();
  res.set('Cache-Control', 'no-store');
  res.json({ items: docs.map(toPublicBanner) });
  if (docs.length) {
    // Rough impression count; never blocks the response.
    BannerModel.updateMany({ _id: { $in: docs.map((d) => d._id) } }, { $inc: { impressions: 1 } }).catch((err: unknown) =>
      logger.warn({ err }, 'banner impression update failed'),
    );
  }
}

export async function recordBannerClick(req: Request, res: Response) {
  const { id } = idParamsSchema.parse(req.params);
  await BannerModel.updateOne({ _id: id, status: 'active' }, { $inc: { clicks: 1 } });
  res.status(204).end();
}
