import type { Request, Response } from 'express';
import { z } from 'zod';
import { ChallengeModel } from '../models/Challenge.js';
import { DestinationModel } from '../models/Destination.js';
import { FavoriteModel } from '../models/Favorite.js';
import { PassportEntryModel } from '../models/PassportEntry.js';
import { UserModel } from '../models/User.js';
import { paginate } from '../schemas/common.js';
import { publicDestinationQuerySchema } from '../schemas/destination.schemas.js';
import { PAGE_VIEW_DEDUPE_MS, recordEvent } from '../services/analytics.service.js';
import { toChallengeSummary, type LeanChallenge } from '../services/challenge.service.js';
import {
  PUBLIC_DESTINATION_FILTER,
  findPublishedDestinationBySlug,
  getActiveQrDestinationIds,
  getDestinationIdsWithActiveChallenges,
  toDestinationDetail,
  toDestinationSummary,
  type LeanDestination,
} from '../services/destination.service.js';
import { identityFromRequest } from '../services/identity.js';
import {
  mergeProfiles,
  profileFromDestination,
  rankByContent,
  type Recommendable,
  type RecommendProfile,
} from '../services/recommend.service.js';
import { escapeRegex, normalizeText } from '../utils/text.js';
import { notFound } from '../utils/errors.js';
import type { Area, Category } from '../config/catalog.js';

const slugParamsSchema = z.object({ slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{1,80}$/) });

export async function listDestinations(req: Request, res: Response) {
  const query = publicDestinationQuerySchema.parse(req.query);
  const filter: Record<string, unknown> = { ...PUBLIC_DESTINATION_FILTER };
  if (query.category.length) filter.category = { $in: query.category };
  if (query.area.length) filter.area = { $in: query.area };
  if (query.q) {
    const terms = normalizeText(query.q).split(' ').filter(Boolean).slice(0, 6);
    if (terms.length) filter.$and = terms.map((term) => ({ searchText: { $regex: escapeRegex(term) } }));
  }

  const challengeDestinationIds = await getDestinationIdsWithActiveChallenges();
  if (query.hasActivity === 'true') {
    const qrIds = await getActiveQrDestinationIds();
    filter._id = { $in: [...new Set([...qrIds, ...challengeDestinationIds])] };
  }

  const sort: Record<string, 1 | -1> = query.sort === 'recent' ? { updatedAt: -1, _id: 1 } : { name: 1, _id: 1 };
  const [docs, total] = await Promise.all([
    DestinationModel.find(filter)
      .sort(sort)
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean<LeanDestination[]>(),
    DestinationModel.countDocuments(filter),
  ]);

  res.set('Cache-Control', 'no-store');
  res.json(
    paginate(
      docs.map((d) => toDestinationSummary(d, { hasChallenge: challengeDestinationIds.has(String(d._id)) })),
      total,
      query.page,
      query.limit,
    ),
  );
}

export async function getDestination(req: Request, res: Response) {
  const { slug } = slugParamsSchema.parse(req.params);
  const destination = await findPublishedDestinationBySlug(slug);
  if (!destination) throw notFound('Không tìm thấy địa điểm hoặc địa điểm chưa được xuất bản.', 'DESTINATION_NOT_FOUND');

  const [challenges, qrDestinationIds] = await Promise.all([
    ChallengeModel.find({ destinationId: destination._id, status: 'active' }).sort({ createdAt: 1 }).lean<LeanChallenge[]>(),
    getActiveQrDestinationIds(),
  ]);

  res.set('Cache-Control', 'no-store');
  res.json({
    destination: toDestinationDetail(destination),
    challenges: challenges.map(toChallengeSummary),
    hasActiveQr: qrDestinationIds.has(String(destination._id)),
  });
}

function toRecommendable(d: LeanDestination): Recommendable & { doc: LeanDestination } {
  return {
    id: String(d._id),
    category: d.category,
    area: d.area,
    tags: d.tags ?? [],
    doc: d,
  };
}

async function profileForUser(req: Request): Promise<RecommendProfile | null> {
  if (!req.user) return null;
  const [user, favorites, checkIns] = await Promise.all([
    UserModel.findById(req.user.id).select('preferences').lean(),
    FavoriteModel.find({ userId: req.user.id }).select('destinationId').limit(30).lean(),
    PassportEntryModel.find({ userId: req.user.id, entryType: 'check_in' }).select('destinationId').limit(30).lean(),
  ]);
  const destIds = [...favorites, ...checkIns].map((row) => row.destinationId).filter(Boolean);
  const visited = destIds.length
    ? await DestinationModel.find({ _id: { $in: destIds } }).select('category area tags').lean<LeanDestination[]>()
    : [];
  const parts: RecommendProfile[] = [];
  const prefs = user?.preferences;
  if (prefs?.interests?.length) {
    const categories: Partial<Record<Category, number>> = {};
    for (const interest of prefs.interests) categories[interest] = 4;
    parts.push({ categories, areas: {}, tags: [] });
  }
  if (prefs?.areas?.length) {
    const areas: Partial<Record<Area, number>> = {};
    for (const area of prefs.areas) areas[area] = 3;
    parts.push({ categories: {}, areas, tags: [] });
  }
  for (const d of visited) parts.push(profileFromDestination(toRecommendable(d)));
  return parts.length ? mergeProfiles(parts) : null;
}

export async function listRecommendedDestinations(req: Request, res: Response) {
  const [docs, challengeIds, profile] = await Promise.all([
    DestinationModel.find(PUBLIC_DESTINATION_FILTER).sort({ updatedAt: -1, _id: 1 }).lean<LeanDestination[]>(),
    getDestinationIdsWithActiveChallenges(),
    profileForUser(req),
  ]);
  const summarize = (d: LeanDestination) => toDestinationSummary(d, { hasChallenge: challengeIds.has(String(d._id)) });
  if (!profile) {
    res.set('Cache-Control', 'no-store');
    return res.json({ personalized: false, items: docs.slice(0, 6).map(summarize) });
  }
  const ranked = rankByContent(docs.map(toRecommendable), profile, 6);
  const picked = ranked.length ? ranked.map((r) => r.doc) : docs.slice(0, 6);
  res.set('Cache-Control', 'no-store');
  res.json({ personalized: ranked.length > 0, items: picked.map(summarize) });
}

export async function getRelatedDestinations(req: Request, res: Response) {
  const { slug } = slugParamsSchema.parse(req.params);
  const destination = await findPublishedDestinationBySlug(slug);
  if (!destination) throw notFound('Không tìm thấy địa điểm.', 'DESTINATION_NOT_FOUND');

  const candidates = await DestinationModel.find({
    ...PUBLIC_DESTINATION_FILTER,
    _id: { $ne: destination._id },
  }).lean<LeanDestination[]>();
  const ranked = rankByContent(candidates.map(toRecommendable), profileFromDestination(toRecommendable(destination)), 8);
  const picked = ranked.map((r) => r.doc);
  if (picked.length < 4) {
    const used = new Set(picked.map((d) => String(d._id)));
    const extra = candidates
      .filter((d) => !used.has(String(d._id)) && (d.category === destination.category || d.area === destination.area))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
      .slice(0, 4 - picked.length);
    picked.push(...extra);
  }
  const challengeIds = await getDestinationIdsWithActiveChallenges();
  res.json({ items: picked.slice(0, 4).map((d) => toDestinationSummary(d, { hasChallenge: challengeIds.has(String(d._id)) })) });
}

const pageViewSchema = z.object({ slug: slugParamsSchema.shape.slug }).strict();

/** destination_page_view: the detail page was opened directly (not via QR). Deduped per 30 min. */
export async function recordDestinationView(req: Request, res: Response) {
  const { slug } = pageViewSchema.parse(req.body);
  const destination = await findPublishedDestinationBySlug(slug);
  if (!destination) throw notFound('Không tìm thấy địa điểm.', 'DESTINATION_NOT_FOUND');
  const recorded = await recordEvent(
    { eventType: 'destination_page_view', destinationId: destination._id },
    identityFromRequest(req),
    { dedupeWindowMs: PAGE_VIEW_DEDUPE_MS },
  );
  res.status(202).json({ recorded });
}
