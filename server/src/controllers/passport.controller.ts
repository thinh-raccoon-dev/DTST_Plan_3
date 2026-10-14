import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { DestinationModel } from '../models/Destination.js';
import { FavoriteModel } from '../models/Favorite.js';
import { objectIdSchema } from '../schemas/common.js';
import {
  PUBLIC_DESTINATION_FILTER,
  getDestinationIdsWithActiveChallenges,
  toDestinationSummary,
  type LeanDestination,
} from '../services/destination.service.js';
import { identityFromRequest } from '../services/identity.js';
import { claimDeviceEntries, countDeviceEntries, getPassport } from '../services/passport.service.js';
import { notFound } from '../utils/errors.js';

export async function getMyPassport(req: Request, res: Response) {
  const passport = await getPassport(identityFromRequest(req));
  const pendingDeviceEntries = req.user ? await countDeviceEntries(req.anonymousSessionId) : 0;
  res.set('Cache-Control', 'no-store');
  res.json({ ...passport, pendingDeviceEntries });
}

export async function claimDevicePassport(req: Request, res: Response) {
  if (!req.anonymousSessionId) {
    res.json({ claimed: 0, skipped: 0, newBadges: [] });
    return;
  }
  const result = await claimDeviceEntries(new Types.ObjectId(req.user!.id), req.anonymousSessionId);
  res.json(result);
}

const favoriteParamsSchema = z.object({ destinationId: objectIdSchema });

export async function listFavorites(req: Request, res: Response) {
  const favorites = await FavoriteModel.find({ userId: req.user!.id }).sort({ createdAt: -1 }).limit(200).lean();
  const destinations = await DestinationModel.find({
    _id: { $in: favorites.map((f) => f.destinationId) },
    ...PUBLIC_DESTINATION_FILTER,
  }).lean<LeanDestination[]>();
  const byId = new Map(destinations.map((d) => [String(d._id), d]));
  const challengeIds = await getDestinationIdsWithActiveChallenges();
  res.json({
    items: favorites
      .map((f) => byId.get(String(f.destinationId)))
      .filter((d): d is LeanDestination => Boolean(d))
      .map((d) => toDestinationSummary(d, { hasChallenge: challengeIds.has(String(d._id)) })),
    // Favorites pointing at hidden places are kept but not shown, so they reappear if republished.
    hiddenCount: favorites.length - byId.size,
  });
}

export async function addFavorite(req: Request, res: Response) {
  const { destinationId } = favoriteParamsSchema.parse(req.params);
  const exists = await DestinationModel.exists({ _id: destinationId, ...PUBLIC_DESTINATION_FILTER });
  if (!exists) throw notFound('Không tìm thấy địa điểm.', 'DESTINATION_NOT_FOUND');
  await FavoriteModel.updateOne(
    { userId: req.user!.id, destinationId },
    { $setOnInsert: { userId: req.user!.id, destinationId } },
    { upsert: true },
  );
  res.status(201).json({ destinationId, favorited: true });
}

export async function removeFavorite(req: Request, res: Response) {
  const { destinationId } = favoriteParamsSchema.parse(req.params);
  await FavoriteModel.deleteOne({ userId: req.user!.id, destinationId });
  res.json({ destinationId, favorited: false });
}
