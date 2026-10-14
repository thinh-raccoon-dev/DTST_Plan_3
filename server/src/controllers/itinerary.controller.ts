import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { DestinationModel } from '../models/Destination.js';
import { ItineraryModel, type ItineraryDocument } from '../models/Itinerary.js';
import { UserModel } from '../models/User.js';
import { idParamsSchema } from '../schemas/common.js';
import { preferencesSchema, saveItinerarySchema, type SaveItineraryInput } from '../schemas/itinerary.schemas.js';
import { recordEvent } from '../services/analytics.service.js';
import { PUBLIC_DESTINATION_FILTER, type LeanDestination } from '../services/destination.service.js';
import { identityFromRequest } from '../services/identity.js';
import {
  DEFAULT_VISIT_MINUTES,
  TRANSITION_BUFFER_MINUTES,
  planItineraryWithAlternatives,
  type PlannerDestination,
} from '../services/itineraryPlanner.js';
import { badRequest, notFound } from '../utils/errors.js';

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
  const current = await DestinationModel.find({ _id: { $in: ids } })
    .select('slug name category area publicationStatus operationalStatus images estimatedVisitDuration')
    .lean<LeanDestination[]>();
  const byId = new Map(current.map((d) => [String(d._id), d]));

  return {
    id: String(itinerary._id),
    title: itinerary.title,
    preferences: itinerary.preferences,
    numberOfDays: itinerary.numberOfDays,
    estimatedDurationMinutes: itinerary.estimatedDurationMinutes,
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
  const input = saveItinerarySchema.parse(req.body);
  const { days, estimatedDurationMinutes } = await buildDays(input);
  const itinerary = await ItineraryModel.create({
    userId: req.user!.id,
    title: input.title,
    preferences: input.preferences,
    numberOfDays: days.length,
    days,
    estimatedDurationMinutes,
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
    items: itineraries.map((it) => ({
      id: String(it._id),
      title: it.title,
      numberOfDays: it.numberOfDays,
      destinationCount: it.days.reduce((n, d) => n + d.items.length, 0),
      estimatedDurationMinutes: it.estimatedDurationMinutes,
      updatedAt: it.updatedAt,
    })),
  });
}

export async function getItinerary(req: Request, res: Response) {
  const itinerary = await findOwnedItinerary(req);
  res.json({ itinerary: await serializeItinerary(itinerary) });
}

export async function updateItinerary(req: Request, res: Response) {
  const itinerary = await findOwnedItinerary(req);
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

export async function deleteItinerary(req: Request, res: Response) {
  const itinerary = await findOwnedItinerary(req);
  await itinerary.deleteOne();
  res.status(204).end();
}
