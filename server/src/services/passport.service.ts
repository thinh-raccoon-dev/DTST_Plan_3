import { Types } from 'mongoose';
import { BADGES, type BadgeDefinition, type PassportStats } from '../config/badges.js';
import { CHECKIN_POINTS } from '../config/catalog.js';
import { AnalyticsEventModel } from '../models/AnalyticsEvent.js';
import { ChallengeModel } from '../models/Challenge.js';
import { DestinationModel } from '../models/Destination.js';
import { PassportEntryModel } from '../models/PassportEntry.js';
import { recordEvent } from './analytics.service.js';
import { getActiveQrDestinationIds, type LeanDestination } from './destination.service.js';
import { ownerFields, ownerFilter, type Identity } from './identity.js';

function isDuplicateKey(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 11000;
}

async function computeStats(identity: Identity): Promise<PassportStats> {
  const owner = ownerFilter(identity);
  const [checkIns, completions] = await Promise.all([
    PassportEntryModel.countDocuments({ ...owner, entryType: 'check_in' }),
    PassportEntryModel.find({ ...owner, entryType: 'challenge_completed' }).select('destinationId').lean(),
  ]);
  const destinationIds = [...new Set(completions.map((c) => String(c.destinationId)))];
  const heritage = destinationIds.length
    ? await DestinationModel.countDocuments({ _id: { $in: destinationIds }, category: { $in: ['culture', 'history'] } })
    : 0;
  return { checkInDestinations: checkIns, completedChallenges: completions.length, heritageChallengeDestinations: heritage };
}

/** Awards any newly earned badges. The unique index makes concurrent evaluation safe. */
export async function evaluateBadges(identity: Identity): Promise<BadgeDefinition[]> {
  const stats = await computeStats(identity);
  const owner = ownerFilter(identity);
  const existing = new Set(
    (await PassportEntryModel.find({ ...owner, entryType: 'badge_awarded' }).select('badgeKey').lean()).map((e) => e.badgeKey),
  );
  const awarded: BadgeDefinition[] = [];
  for (const badge of BADGES) {
    if (existing.has(badge.key) || !badge.isEarned(stats)) continue;
    try {
      await PassportEntryModel.create({
        ...ownerFields(identity),
        entryType: 'badge_awarded',
        badgeKey: badge.key,
        scoreAwarded: 0,
        source: 'system',
      });
      awarded.push(badge);
      await recordEvent({ eventType: 'passport_badge_awarded', metadata: { badgeKey: badge.key } }, identity);
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
    }
  }
  return awarded;
}

export function toBadgeDto(badge: BadgeDefinition) {
  return { key: badge.key, name: badge.name, description: badge.description, icon: badge.icon };
}

export async function checkIn(identity: Identity, destinationId: Types.ObjectId, qrCodeId: Types.ObjectId) {
  try {
    await PassportEntryModel.create({
      ...ownerFields(identity),
      entryType: 'check_in',
      destinationId,
      qrCodeId,
      scoreAwarded: CHECKIN_POINTS,
      source: 'qr',
    });
  } catch (error) {
    if (isDuplicateKey(error)) return { created: false, pointsAwarded: 0, newBadges: [] };
    throw error;
  }
  await recordEvent({ eventType: 'destination_check_in', destinationId, qrCodeId }, identity);
  const newBadges = await evaluateBadges(identity);
  return { created: true, pointsAwarded: CHECKIN_POINTS, newBadges: newBadges.map(toBadgeDto) };
}

export async function recordChallengeCompletion(
  identity: Identity,
  params: {
    challengeId: Types.ObjectId;
    destinationId: Types.ObjectId;
    qrCodeId: Types.ObjectId;
    rewardPoints: number;
    correctCount: number;
    totalQuestions: number;
  },
) {
  try {
    await PassportEntryModel.create({
      ...ownerFields(identity),
      entryType: 'challenge_completed',
      challengeId: params.challengeId,
      destinationId: params.destinationId,
      qrCodeId: params.qrCodeId,
      scoreAwarded: params.rewardPoints,
      source: 'qr',
      metadata: { correctCount: params.correctCount, totalQuestions: params.totalQuestions },
    });
  } catch (error) {
    if (isDuplicateKey(error)) return { alreadyCompleted: true, pointsAwarded: 0, newBadges: [] };
    throw error;
  }
  await recordEvent(
    {
      eventType: 'challenge_completed',
      challengeId: params.challengeId,
      destinationId: params.destinationId,
      qrCodeId: params.qrCodeId,
    },
    identity,
  );
  const newBadges = await evaluateBadges(identity);
  return { alreadyCompleted: false, pointsAwarded: params.rewardPoints, newBadges: newBadges.map(toBadgeDto) };
}

/** Status of a single destination for the current identity, used by the QR landing page. */
export async function getDestinationProgress(identity: Identity, destinationId: Types.ObjectId) {
  // When logged in, also surface guest progress from this browser until the user claims it.
  const owners: Array<ReturnType<typeof ownerFilter> | { anonymousSessionId: string }> = [ownerFilter(identity)];
  if (identity.userId && identity.anonymousSessionId) {
    owners.push({ anonymousSessionId: identity.anonymousSessionId });
  }
  const entries = await PassportEntryModel.find({ destinationId, $or: owners }).select('entryType challengeId').lean();
  return {
    checkedIn: entries.some((e) => e.entryType === 'check_in'),
    completedChallengeIds: [
      ...new Set(
        entries
          .filter((e) => e.entryType === 'challenge_completed' && e.challengeId)
          .map((e) => String(e.challengeId)),
      ),
    ],
  };
}

function miniDestination(d: Pick<LeanDestination, '_id' | 'slug' | 'name' | 'category' | 'area'> | undefined) {
  return d ? { id: String(d._id), slug: d.slug, name: d.name, category: d.category, area: d.area } : null;
}

export async function getPassport(identity: Identity) {
  const owner = ownerFilter(identity);
  const entries = await PassportEntryModel.find(owner).sort({ completedAt: -1 }).lean();

  const viewEvents = await AnalyticsEventModel.aggregate<{ _id: string; destinations: Types.ObjectId[] }>([
    {
      $match: {
        ...owner,
        eventType: { $in: ['destination_page_view', 'qr_landing_view'] },
        destinationId: { $exists: true },
      },
    },
    { $group: { _id: '$eventType', destinations: { $addToSet: '$destinationId' } } },
  ]);
  const viewedIds = viewEvents.find((v) => v._id === 'destination_page_view')?.destinations ?? [];
  const qrOpenedIds = viewEvents.find((v) => v._id === 'qr_landing_view')?.destinations ?? [];

  const destinationIds = new Set<string>([...qrOpenedIds.map(String)]);
  const challengeIds = new Set<string>();
  for (const entry of entries) {
    if (entry.destinationId) destinationIds.add(String(entry.destinationId));
    if (entry.challengeId) challengeIds.add(String(entry.challengeId));
  }

  const [destinations, challenges, pilotIds] = await Promise.all([
    DestinationModel.find({ _id: { $in: [...destinationIds] } }).select('slug name category area').lean(),
    ChallengeModel.find({ _id: { $in: [...challengeIds] } }).select('title').lean(),
    getActiveQrDestinationIds(),
  ]);
  const destinationMap = new Map(destinations.map((d) => [String(d._id), d]));
  const challengeMap = new Map(challenges.map((c) => [String(c._id), c]));

  const checkIns = entries
    .filter((e) => e.entryType === 'check_in')
    .map((e) => ({
      destination: miniDestination(destinationMap.get(String(e.destinationId))),
      scoreAwarded: e.scoreAwarded,
      completedAt: e.completedAt,
    }));
  const completions = entries
    .filter((e) => e.entryType === 'challenge_completed')
    .map((e) => {
      const challenge = challengeMap.get(String(e.challengeId));
      return {
        challenge: challenge ? { id: String(challenge._id), title: challenge.title } : null,
        destination: miniDestination(destinationMap.get(String(e.destinationId))),
        scoreAwarded: e.scoreAwarded,
        correctCount: e.metadata?.correctCount ?? null,
        totalQuestions: e.metadata?.totalQuestions ?? null,
        completedAt: e.completedAt,
      };
    });
  const badgeEntries = new Map(
    entries.filter((e) => e.entryType === 'badge_awarded').map((e) => [e.badgeKey ?? '', e.completedAt]),
  );

  const explored = new Set(
    entries
      .filter((e) => (e.entryType === 'check_in' || e.entryType === 'challenge_completed') && e.destinationId)
      .map((e) => String(e.destinationId)),
  );

  const publishedPilot = pilotIds.size
    ? await DestinationModel.countDocuments({ _id: { $in: [...pilotIds] }, publicationStatus: 'published' })
    : 0;

  return {
    mode: identity.userId ? ('account' as const) : ('device' as const),
    totals: {
      points: entries.reduce((sum, e) => sum + (e.scoreAwarded ?? 0), 0),
      exploredDestinations: explored.size,
      checkIns: checkIns.length,
      completedChallenges: completions.length,
      badges: badgeEntries.size,
      destinationsViewed: viewedIds.length,
      qrContentsOpened: qrOpenedIds.length,
    },
    progress: { explored: explored.size, total: Math.max(publishedPilot, explored.size) },
    checkIns,
    completions,
    qrOpened: qrOpenedIds.map((id) => miniDestination(destinationMap.get(String(id)))).filter(Boolean),
    badges: BADGES.map((badge) => ({
      ...toBadgeDto(badge),
      earned: badgeEntries.has(badge.key),
      awardedAt: badgeEntries.get(badge.key) ?? null,
    })),
  };
}

export async function countDeviceEntries(anonymousSessionId: string | undefined): Promise<number> {
  if (!anonymousSessionId) return 0;
  return PassportEntryModel.countDocuments({
    anonymousSessionId,
    entryType: { $in: ['check_in', 'challenge_completed'] },
  });
}

/**
 * Moves server-graded guest entries from this browser into the account. Entries the account
 * already has are dropped instead of being counted twice. Badges are re-evaluated afterwards.
 */
export async function claimDeviceEntries(userId: Types.ObjectId, anonymousSessionId: string) {
  const entries = await PassportEntryModel.find({
    anonymousSessionId,
    entryType: { $in: ['check_in', 'challenge_completed'] },
  }).lean();

  let claimed = 0;
  let skipped = 0;
  for (const entry of entries) {
    try {
      await PassportEntryModel.updateOne(
        { _id: entry._id, anonymousSessionId },
        { $set: { userId }, $unset: { anonymousSessionId: 1 } },
      );
      claimed += 1;
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
      await PassportEntryModel.deleteOne({ _id: entry._id, anonymousSessionId });
      skipped += 1;
    }
  }
  await PassportEntryModel.deleteMany({ anonymousSessionId, entryType: 'badge_awarded' });
  const newBadges = await evaluateBadges({ userId });
  return { claimed, skipped, newBadges: newBadges.map(toBadgeDto) };
}
