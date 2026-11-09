import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { DestinationModel } from '../models/Destination.js';
import { FavoriteModel } from '../models/Favorite.js';
import { ItineraryModel, type ItineraryDocument } from '../models/Itinerary.js';
import { PassportEntryModel } from '../models/PassportEntry.js';
import { UserModel } from '../models/User.js';
import { idParamsSchema } from '../schemas/common.js';
import {
  preferencesSchema,
  replanItinerarySchema,
  saveItinerarySchema,
  saveV9ItinerarySchema,
  v9PlanRequestSchema,
  type SaveItineraryInput,
} from '../schemas/itinerary.schemas.js';
import { recordEvent } from '../services/analytics.service.js';
import { PUBLIC_DESTINATION_FILTER, type LeanDestination } from '../services/destination.service.js';
import { identityFromRequest } from '../services/identity.js';
import {
  DEFAULT_VISIT_MINUTES,
  TRANSITION_BUFFER_MINUTES,
  planItineraryWithAlternatives,
  type PlannerDestination,
} from '../services/itineraryPlanner.js';
import {
  getPlannerHealth,
  getPlannerPlaces,
  mergeReplanIntoItinerary,
  requestPlannerItinerary,
  requestPlannerRecommend,
  requestPlannerReplan,
  type V9Day,
  type V9ItineraryObject,
  type V9Place,
} from '../services/tripPlannerV9.service.js';
import { badRequest, conflict, notFound } from '../utils/errors.js';
import { normalizeText, slugify } from '../utils/text.js';

const PLANNABLE_FILTER = { ...PUBLIC_DESTINATION_FILTER, operationalStatus: 'active' } as const;

function toPlannerDestination(d: LeanDestination): PlannerDestination {
  return {
    id: String(d._id),
    slug: d.slug,
    name: d.name,
    category: d.category,
    tags: d.tags ?? [],
    area: d.area,
    coordinates: d.coordinates ? { lat: d.coordinates.lat, lng: d.coordinates.lng } : null,
    estimatedVisitMinutes: d.estimatedVisitDuration?.minutes ?? null,
  };
}

export async function generateItinerary(req: Request, res: Response) {
  const input = preferencesSchema.parse(req.body);

  if (req.user && (input.areas.length === 0 || input.interests.length === 0)) {
    const stored = await UserModel.findById(req.user.id).select('preferences').lean();
    if (stored?.preferences) {
      if (input.areas.length === 0) input.areas = stored.preferences.areas ?? [];
      if (input.interests.length === 0) input.interests = stored.preferences.interests ?? [];
    }
  }

  const destinations = await DestinationModel.find(PLANNABLE_FILTER).lean<LeanDestination[]>();
  const knownIds = new Set(destinations.map((d) => String(d._id)));
  const ignoredPriority = input.priorityDestinationIds.filter((id) => !knownIds.has(id));

  const { plan, alternatives } = planItineraryWithAlternatives(destinations.map(toPlannerDestination), {
    ...input,
    priorityDestinationIds: input.priorityDestinationIds.filter((id) => knownIds.has(id)),
    excludeDestinationIds: input.excludeDestinationIds.filter((id) => knownIds.has(id)),
  });
  if (ignoredPriority.length) plan.warnings.unshift('Một số điểm ưu tiên không còn được xuất bản nên đã bị bỏ qua.');

  await recordEvent(
    {
      eventType: 'itinerary_generated',
      metadata: { numberOfDays: input.numberOfDays, itemCount: plan.days.reduce((n, d) => n + d.items.length, 0) },
    },
    identityFromRequest(req),
  );
  res.json({ preferences: input, plan, alternatives });
}

// ---- Trip Planner V9 Endpoints ----

async function enrichV9Places(places: V9Place[], userId?: string): Promise<{
  places: V9Place[];
  personalization?: {
    applied: boolean;
    userInterests: string[];
    userAreas: string[];
    favoriteCount: number;
    checkinCount: number;
    insights: string[];
  };
}> {
  const destinations = await DestinationModel.find(PLANNABLE_FILTER).lean<LeanDestination[]>();
  const destBySlug = new Map<string, LeanDestination>();
  const destByNormName = new Map<string, LeanDestination>();
  for (const d of destinations) {
    destBySlug.set(d.slug, d);
    destByNormName.set(normalizeText(d.name), d);
  }

  let userInterests: string[] = [];
  let userAreas: string[] = [];
  const favoriteDestIds = new Set<string>();
  const checkinDestIds = new Set<string>();

  if (userId) {
    const [userDoc, favDocs, checkinEntries] = await Promise.all([
      UserModel.findById(userId).select('preferences').lean(),
      FavoriteModel.find({ userId }).select('destinationId').lean(),
      PassportEntryModel.find({ userId, entryType: 'check_in', destinationId: { $exists: true } }).select('destinationId').lean(),
    ]);

    if (userDoc?.preferences) {
      userInterests = userDoc.preferences.interests ?? [];
      userAreas = userDoc.preferences.areas ?? [];
    }
    for (const f of favDocs) favoriteDestIds.add(String(f.destinationId));
    for (const s of checkinEntries) {
      if (s.destinationId) checkinDestIds.add(String(s.destinationId));
    }
  }

  const V9_ID_TO_DEST_SLUG: Record<string, string> = {
    new_008: 'chua-vinh-trang-my-tho',
    new_010: 'hu-tieu-sa-dec-ba-sam',
    new_011: 'hu-tieu-my-tho-trung-luong',
    new_013: 'nha-hang-mekong-taste-thoi-son',
    new_014: 'trai-ran-dong-tam',
    new_015: 'trai-ong-mat-hoa-nhan-thoi-son',
    new_016: 'khu-du-lich-sinh-thai-thoi-son',
  };

  const enriched = places.map((place) => {
    const norm = normalizeText(place.name);
    const slug = slugify(place.name);
    const mappedSlug = V9_ID_TO_DEST_SLUG[place.id];
    const dest = (mappedSlug ? destBySlug.get(mappedSlug) : undefined) ?? destByNormName.get(norm) ?? destBySlug.get(slug);

    let isPersonalizedMatch = false;
    let personalizationReason: string | undefined;

    if (dest) {
      const destIdStr = String(dest._id);
      if (favoriteDestIds.has(destIdStr)) {
        isPersonalizedMatch = true;
        personalizationReason = '❤️ Nằm trong danh sách Yêu thích của bạn';
      } else if (checkinDestIds.has(destIdStr)) {
        isPersonalizedMatch = true;
        personalizationReason = '🚩 Điểm đến bạn từng check-in trong Hộ chiếu số';
      } else if (userAreas.includes(dest.area)) {
        isPersonalizedMatch = true;
        personalizationReason = `📍 Nằm tại khu vực [${dest.area}] bạn quan tâm`;
      } else if (userInterests.some((i) => (dest.tags ?? []).includes(i) || dest.category === i)) {
        isPersonalizedMatch = true;
        personalizationReason = '✨ Phù hợp sở thích đã lưu trong hồ sơ của bạn';
      }
    }

    return {
      ...place,
      mongoId: dest ? String(dest._id) : undefined,
      slug: dest?.slug,
      summary: dest?.summary,
      images: dest?.images?.map((img) => ({ url: img.url, alt: img.alt })),
      area: dest?.area,
      category: dest?.category,
      isPersonalizedMatch,
      personalizationReason,
    };
  });

  const insights: string[] = [];
  if (userInterests.length > 0) {
    insights.push(`Ưu tiên theo sở thích của bạn: ${userInterests.join(', ')}.`);
  }
  if (favoriteDestIds.size > 0) {
    insights.push(`Đã đồng bộ ${favoriteDestIds.size} địa điểm yêu thích của bạn vào bộ lọc.`);
  }
  if (checkinDestIds.size > 0) {
    insights.push(`Tối ưu nối tiếp lộ trình theo ${checkinDestIds.size} điểm đã check-in.`);
  }

  return {
    places: enriched,
    personalization: userId
      ? {
          applied: true,
          userInterests,
          userAreas,
          favoriteCount: favoriteDestIds.size,
          checkinCount: checkinDestIds.size,
          insights,
        }
      : undefined,
  };
}

export async function getTripPlannerHealth(_req: Request, res: Response) {
  const health = await getPlannerHealth();
  res.json(health);
}

export async function listTripPlannerPlaces(req: Request, res: Response) {
  const data = await getPlannerPlaces();
  const userId = req.user?.id;
  const enrichedResult = await enrichV9Places(data.places, userId);
  res.json({
    places: enrichedResult.places,
    serviceOnline: data.serviceOnline,
    personalization: enrichedResult.personalization,
  });
}

export async function recommendTripPlanner(req: Request, res: Response) {
  const input = v9PlanRequestSchema.parse(req.body);
  const userId = req.user?.id;

  // Personalization pre-processing: boost favorites into priority if empty
  if (userId && (!input.selected_ids || input.selected_ids.length === 0)) {
    const favDocs = await FavoriteModel.find({ userId }).select('destinationId').limit(4).lean();
    if (favDocs.length > 0) {
      const favDestIds = favDocs.map((f) => f.destinationId);
      const favDests = await DestinationModel.find({ _id: { $in: favDestIds } }).select('name slug').lean<LeanDestination[]>();
      const favNames = new Set(favDests.map((d) => normalizeText(d.name)));

      const placesData = await getPlannerPlaces();
      const matchedPlaceIds = placesData.places
        .filter((p) => favNames.has(normalizeText(p.name)))
        .map((p) => p.id);

      if (matchedPlaceIds.length > 0) {
        input.selected_ids = matchedPlaceIds;
      }
    }
  }

  const result = await requestPlannerRecommend(input);

  // Enrich primary_places with images & personalized flags from MongoDB
  if (Array.isArray(result.primary_places)) {
    const enriched = await enrichV9Places(result.primary_places as V9Place[], userId);
    result.primary_places = enriched.places;
    if (enriched.personalization) {
      result.personalization = enriched.personalization;
    }
  }

  res.json(result);
}

export async function planTripV9(req: Request, res: Response) {
  const input = v9PlanRequestSchema.parse(req.body);
  const userId = req.user?.id;

  // Personalization pre-processing: auto-include user's favorite places
  if (userId && (!input.selected_ids || input.selected_ids.length === 0)) {
    const favDocs = await FavoriteModel.find({ userId }).select('destinationId').limit(4).lean();
    if (favDocs.length > 0) {
      const favDestIds = favDocs.map((f) => f.destinationId);
      const favDests = await DestinationModel.find({ _id: { $in: favDestIds } }).select('name slug').lean<LeanDestination[]>();
      const favNames = new Set(favDests.map((d) => normalizeText(d.name)));

      const placesData = await getPlannerPlaces();
      const matchedPlaceIds = placesData.places
        .filter((p) => favNames.has(normalizeText(p.name)))
        .map((p) => p.id);

      if (matchedPlaceIds.length > 0) {
        input.selected_ids = matchedPlaceIds;
      }
    }
  }

  const result = await requestPlannerItinerary(input);
  const itinerary = result.itinerary as V9ItineraryObject | undefined;
  const dayCount = Array.isArray(itinerary?.days) ? itinerary.days.length : input.days;
  const scheduledCount = Array.isArray(itinerary?.scheduled_primary_ids) ? itinerary.scheduled_primary_ids.length : 0;

  // Enrich primary places
  if (Array.isArray(result.primary_places)) {
    const enriched = await enrichV9Places(result.primary_places as V9Place[], userId);
    result.primary_places = enriched.places;
    if (enriched.personalization) {
      result.personalization = enriched.personalization;
    }
  }

  await recordEvent(
    {
      eventType: 'itinerary_generated',
      metadata: { planner: 'v9', mode: input.mode, goal: input.goal, numberOfDays: dayCount, itemCount: scheduledCount },
    },
    identityFromRequest(req),
  );
  res.json(result);
}

function computeV9Stats(v9Itinerary: Record<string, unknown>) {
  const rawDays = Array.isArray(v9Itinerary.days) ? (v9Itinerary.days as V9Day[]) : [];
  const numberOfDays = Math.min(7, Math.max(1, rawDays.length || Number((v9Itinerary.input as Record<string, unknown> | undefined)?.days) || 1));
  let estimatedDurationMinutes = 0;
  let stopCount = 0;
  for (const day of rawDays) {
    for (const step of day.activities ?? []) {
      if (typeof step.duration_minutes === 'number' && step.duration_minutes > 0) {
        estimatedDurationMinutes += step.duration_minutes;
      } else if (typeof step.route_duration_minutes === 'number' && step.route_duration_minutes > 0) {
        estimatedDurationMinutes += Math.ceil(step.route_duration_minutes) + (typeof step.buffer_minutes === 'number' ? step.buffer_minutes : 0);
      }
      if (step.type === 'visit' || step.type === 'meal') {
        stopCount += 1;
      }
    }
  }
  return { numberOfDays, estimatedDurationMinutes, stopCount };
}

/**
 * Builds stored days. New destinations must be published and operating; destinations that were
 * already in this itinerary may stay (shown as unavailable) so editing never breaks old plans.
 */
async function buildDays(input: SaveItineraryInput, existing?: ItineraryDocument) {
  const ids = input.days.flatMap((day) => day.items.map((item) => item.destinationId));
  if (new Set(ids).size !== ids.length) throw badRequest('Mỗi địa điểm chỉ xuất hiện một lần trong lịch trình.', 'DUPLICATE_DESTINATION');

  const previous = new Map<string, { nameSnapshot: string; slugSnapshot: string; durationMinutes: number; durationIsEstimate: boolean }>();
  for (const day of existing?.days ?? []) {
    for (const item of day.items) previous.set(String(item.destinationId), item);
  }

  const docs = await DestinationModel.find({ _id: { $in: ids } }).lean<LeanDestination[]>();
  const byId = new Map(docs.map((d) => [String(d._id), d]));
  const unavailable = ids.filter((id) => {
    const d = byId.get(id);
    const available = d && d.publicationStatus === 'published' && d.operationalStatus === 'active';
    return !available && !previous.has(id);
  });
  if (unavailable.length) {
    throw badRequest('Một số địa điểm không còn khả dụng để thêm vào lịch trình.', 'DESTINATION_UNAVAILABLE', { destinationIds: unavailable });
  }

  let estimatedDurationMinutes = 0;
  const days = input.days.map((day, index) => {
    const items = day.items.map((item) => {
      const d = byId.get(item.destinationId);
      const prior = previous.get(item.destinationId);
      return {
        destinationId: new Types.ObjectId(item.destinationId),
        nameSnapshot: d?.name ?? prior!.nameSnapshot,
        slugSnapshot: d?.slug ?? prior!.slugSnapshot,
        durationMinutes: d?.estimatedVisitDuration?.minutes ?? prior?.durationMinutes ?? DEFAULT_VISIT_MINUTES,
        durationIsEstimate: true,
        note: item.note,
      };
    });
    estimatedDurationMinutes +=
      items.reduce((sum, item) => sum + item.durationMinutes, 0) + Math.max(0, items.length - 1) * TRANSITION_BUFFER_MINUTES;
    return { dayNumber: index + 1, items };
  });
  return { days, estimatedDurationMinutes };
}

async function serializeItinerary(itinerary: ItineraryDocument) {
  const ids = itinerary.days.flatMap((day) => day.items.map((item) => item.destinationId));
  const current = ids.length
    ? await DestinationModel.find({ _id: { $in: ids } })
        .select('slug name category area publicationStatus operationalStatus images estimatedVisitDuration')
        .lean<LeanDestination[]>()
    : [];
  const byId = new Map(current.map((d) => [String(d._id), d]));

  return {
    id: String(itinerary._id),
    title: itinerary.title,
    preferences: itinerary.preferences,
    numberOfDays: itinerary.numberOfDays,
    estimatedDurationMinutes: itinerary.estimatedDurationMinutes,
    plannerVersion: (itinerary.plannerVersion ?? (itinerary.v9Itinerary ? 'v9' : 'legacy')) as 'legacy' | 'v9',
    itineraryVersion: itinerary.itineraryVersion ?? 1,
    v9Itinerary: (itinerary.v9Itinerary as V9ItineraryObject | null) ?? null,
    v9Meta: (itinerary.v9Meta as Record<string, unknown> | null) ?? null,
    replanHistory: (itinerary.replanHistory ?? []).map((evt) => ({
      eventId: evt.eventId,
      stopId: evt.stopId,
      event: evt.event,
      occurredAt: evt.occurredAt,
      itineraryVersion: evt.itineraryVersion,
      createdAt: evt.createdAt,
    })),
    createdAt: itinerary.get('createdAt') as Date,
    updatedAt: itinerary.get('updatedAt') as Date,
    days: itinerary.days.map((day) => ({
      dayNumber: day.dayNumber,
      items: day.items.map((item) => {
        const d = byId.get(String(item.destinationId));
        let unavailableReason: string | null = null;
        if (!d) unavailableReason = 'Địa điểm đã bị xóa khỏi hệ thống';
        else if (d.publicationStatus !== 'published') unavailableReason = 'Địa điểm hiện đã bị ẩn';
        else if (d.operationalStatus !== 'active') unavailableReason = 'Địa điểm tạm ngưng hoặc ngừng hoạt động';
        return {
          destinationId: String(item.destinationId),
          name: d?.name ?? item.nameSnapshot,
          slug: d?.slug ?? item.slugSnapshot,
          category: d?.category ?? null,
          area: d?.area ?? null,
          durationMinutes: item.durationMinutes,
          durationIsEstimate: item.durationIsEstimate,
          note: item.note ?? null,
          available: unavailableReason === null,
          unavailableReason,
        };
      }),
    })),
  };
}

async function findOwnedItinerary(req: Request) {
  const { id } = idParamsSchema.parse(req.params);
  // Filtering by owner means other users' itineraries are indistinguishable from missing ones.
  const itinerary = await ItineraryModel.findOne({ _id: id, userId: req.user!.id });
  if (!itinerary) throw notFound('Không tìm thấy lịch trình.', 'ITINERARY_NOT_FOUND');
  return itinerary;
}

export async function createItinerary(req: Request, res: Response) {
  if (req.body && typeof req.body === 'object' && 'v9Itinerary' in req.body) {
    const input = saveV9ItinerarySchema.parse(req.body);
    if (!Array.isArray(input.v9Itinerary.days) || input.v9Itinerary.days.length === 0) {
      throw badRequest('Object v9Itinerary phải chứa danh sách days hợp lệ.', 'INVALID_V9_ITINERARY');
    }
    const { numberOfDays, estimatedDurationMinutes } = computeV9Stats(input.v9Itinerary);
    const itinerary = await ItineraryModel.create({
      userId: req.user!.id,
      title: input.title,
      preferences: {},
      numberOfDays,
      days: [],
      estimatedDurationMinutes,
      plannerVersion: 'v9',
      itineraryVersion: 1,
      v9Itinerary: input.v9Itinerary,
      v9Meta: input.v9Meta ?? null,
      replanHistory: [],
    });
    await recordEvent(
      { eventType: 'itinerary_saved', itineraryId: itinerary._id, metadata: { planner: 'v9', numberOfDays } },
      identityFromRequest(req),
    );
    res.status(201).json({ itinerary: await serializeItinerary(itinerary) });
    return;
  }

  const input = saveItinerarySchema.parse(req.body);
  const { days, estimatedDurationMinutes } = await buildDays(input);
  const itinerary = await ItineraryModel.create({
    userId: req.user!.id,
    title: input.title,
    preferences: input.preferences,
    numberOfDays: days.length,
    days,
    estimatedDurationMinutes,
    plannerVersion: 'legacy',
    itineraryVersion: 1,
  });
  await recordEvent(
    { eventType: 'itinerary_saved', itineraryId: itinerary._id, metadata: { numberOfDays: days.length } },
    identityFromRequest(req),
  );
  res.status(201).json({ itinerary: await serializeItinerary(itinerary) });
}

export async function listMyItineraries(req: Request, res: Response) {
  const itineraries = await ItineraryModel.find({ userId: req.user!.id }).sort({ updatedAt: -1 }).limit(100).lean();
  res.json({
    items: itineraries.map((it) => {
      const isV9 = it.plannerVersion === 'v9' || Boolean(it.v9Itinerary);
      const v9 = (it.v9Itinerary as Record<string, unknown> | null) ?? null;
      const v9Stats = v9 ? computeV9Stats(v9) : null;
      const v9Input = (v9?.input as Record<string, unknown> | undefined) ?? undefined;
      return {
        id: String(it._id),
        title: it.title,
        numberOfDays: it.numberOfDays,
        destinationCount: isV9 && v9Stats ? v9Stats.stopCount : it.days.reduce((n, d) => n + d.items.length, 0),
        estimatedDurationMinutes: it.estimatedDurationMinutes,
        plannerVersion: (isV9 ? 'v9' : 'legacy') as 'legacy' | 'v9',
        itineraryVersion: it.itineraryVersion ?? 1,
        status: typeof v9?.status === 'string' ? v9.status : null,
        startDate: typeof v9Input?.start_date === 'string' ? v9Input.start_date : null,
        mode: typeof v9Input?.mode === 'string' ? v9Input.mode : null,
        budgetVnd: typeof v9Input?.budget_vnd === 'number' ? v9Input.budget_vnd : null,
        updatedAt: it.updatedAt,
      };
    }),
  });
}

export async function getItinerary(req: Request, res: Response) {
  const itinerary = await findOwnedItinerary(req);
  res.json({ itinerary: await serializeItinerary(itinerary) });
}

export async function updateItinerary(req: Request, res: Response) {
  const itinerary = await findOwnedItinerary(req);

  if (req.body && typeof req.body === 'object' && 'v9Itinerary' in req.body) {
    const input = saveV9ItinerarySchema.parse(req.body);
    const { numberOfDays, estimatedDurationMinutes } = computeV9Stats(input.v9Itinerary);
    itinerary.set({
      title: input.title,
      numberOfDays,
      estimatedDurationMinutes,
      plannerVersion: 'v9',
      itineraryVersion: (itinerary.itineraryVersion ?? 1) + 1,
      v9Itinerary: input.v9Itinerary,
      ...(input.v9Meta !== undefined ? { v9Meta: input.v9Meta } : {}),
    });
    await itinerary.save();
    res.json({ itinerary: await serializeItinerary(itinerary) });
    return;
  }

  // Allow title-only update on V9 itineraries
  if (itinerary.plannerVersion === 'v9' && req.body && typeof req.body === 'object' && !('days' in req.body)) {
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
    if (title.length < 2 || title.length > 120) {
      throw badRequest('Tên lịch trình cần từ 2 đến 120 ký tự.', 'VALIDATION_ERROR');
    }
    itinerary.title = title;
    await itinerary.save();
    res.json({ itinerary: await serializeItinerary(itinerary) });
    return;
  }

  const input = saveItinerarySchema.parse(req.body);
  const { days, estimatedDurationMinutes } = await buildDays(input, itinerary);
  itinerary.set({
    title: input.title,
    preferences: { ...itinerary.toObject().preferences, ...input.preferences },
    numberOfDays: days.length,
    days,
    estimatedDurationMinutes,
  });
  await itinerary.save();
  res.json({ itinerary: await serializeItinerary(itinerary) });
}

export async function replanItinerary(req: Request, res: Response) {
  const itinerary = await findOwnedItinerary(req);
  const input = replanItinerarySchema.parse(req.body);

  if (!itinerary.v9Itinerary || typeof itinerary.v9Itinerary !== 'object') {
    throw badRequest('Lịch trình này không phải lịch trình AI Trip Planner V9 nên không thể cập nhật tiến độ.', 'NOT_V9_ITINERARY');
  }

  // 1. Idempotency check by event_id: return cached response if already processed.
  const existingEvent = (itinerary.replanHistory ?? []).find((e) => e.eventId === input.event_id);
  if (existingEvent) {
    res.json({
      replan: existingEvent.response,
      itinerary: await serializeItinerary(itinerary),
      idempotentReplay: true,
    });
    return;
  }

  // 2. Optimistic version check before calling Python.
  const currentVersion = itinerary.itineraryVersion ?? 1;
  if (input.itinerary_version !== currentVersion) {
    throw conflict(
      `Phiên bản lịch trình không khớp (gửi v${input.itinerary_version}, hiện tại v${currentVersion}). Vui lòng tải lại lịch trình.`,
      'ITINERARY_VERSION_MISMATCH',
    );
  }

  // 3. Call Python `/itineraries/replan`.
  const replanResult = await requestPlannerReplan({
    trip_id: String(itinerary._id),
    itinerary_version: currentVersion,
    event_id: input.event_id,
    stop_id: input.stop_id,
    event: input.event,
    occurred_at: input.occurred_at,
    itinerary: itinerary.v9Itinerary as V9ItineraryObject,
  });

  // 4. Merge current_stop and remaining_stops by stop_id, keeping history and unresolved stops.
  const nextVersion = currentVersion + 1;
  const updatedV9Itinerary = mergeReplanIntoItinerary(itinerary.v9Itinerary as V9ItineraryObject, replanResult);
  const responsePayload = {
    ...replanResult,
    itinerary_version: nextVersion,
  };

  // 5. Atomic update checking itineraryVersion to prevent concurrent overwrite.
  const updatedDoc = await ItineraryModel.findOneAndUpdate(
    { _id: itinerary._id, userId: req.user!.id, itineraryVersion: currentVersion },
    {
      $set: {
        v9Itinerary: updatedV9Itinerary,
        itineraryVersion: nextVersion,
      },
      $push: {
        replanHistory: {
          eventId: input.event_id,
          stopId: input.stop_id,
          event: input.event,
          occurredAt: input.occurred_at,
          itineraryVersion: nextVersion,
          response: responsePayload,
          createdAt: new Date(),
        },
      },
    },
    { new: true },
  );

  if (!updatedDoc) {
    throw conflict('Lịch trình vừa được cập nhật bởi thao tác khác. Vui lòng tải lại.', 'ITINERARY_VERSION_MISMATCH');
  }

  res.json({
    replan: responsePayload,
    itinerary: await serializeItinerary(updatedDoc),
    idempotentReplay: false,
  });
}

export async function deleteItinerary(req: Request, res: Response) {
  const itinerary = await findOwnedItinerary(req);
  await itinerary.deleteOne();
  res.status(204).end();
}
