import type { Request, Response } from 'express';
import { DestinationModel } from '../../models/Destination.js';
import { PassportEntryModel } from '../../models/PassportEntry.js';
import { UserModel } from '../../models/User.js';

function escapeRegex(text: string): string {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

export async function listPassportLogs(req: Request, res: Response) {
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20));
  const search = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const entryType = typeof req.query.entryType === 'string' ? req.query.entryType.trim() : '';

  const filter: Record<string, unknown> = {};

  if (entryType && entryType !== 'all') {
    filter.entryType = entryType;
  }

  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    const [matchedUsers, matchedDestinations] = await Promise.all([
      UserModel.find({ $or: [{ email: rx }, { displayName: rx }] }).select('_id').lean(),
      DestinationModel.find({ name: rx }).select('_id').lean(),
    ]);

    const userIds = matchedUsers.map((u) => u._id);
    const destIds = matchedDestinations.map((d) => d._id);

    filter.$or = [{ userId: { $in: userIds } }, { destinationId: { $in: destIds } }, { badgeKey: rx }];
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [
    total,
    logs,
    totalCheckIns,
    totalChallenges,
    totalBadges,
    pointsAgg,
    todayActivities,
  ] = await Promise.all([
    PassportEntryModel.countDocuments(filter),
    PassportEntryModel.find(filter)
      .sort({ completedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('userId', 'email displayName role')
      .populate('destinationId', 'name slug category area image')
      .populate('challengeId', 'title rewardPoints')
      .populate('qrCodeId', 'code label')
      .lean(),
    PassportEntryModel.countDocuments({ entryType: 'check_in' }),
    PassportEntryModel.countDocuments({ entryType: 'challenge_completed' }),
    PassportEntryModel.countDocuments({ entryType: 'badge_awarded' }),
    PassportEntryModel.aggregate<{ _id: null; total: number }>([
      { $group: { _id: null, total: { $sum: '$scoreAwarded' } } },
    ]),
    PassportEntryModel.countDocuments({ completedAt: { $gte: startOfToday } }),
  ]);

  const totalPoints = pointsAgg[0]?.total ?? 0;

  const items = logs.map((log) => {
    const user = log.userId as { _id?: unknown; email?: string; displayName?: string; role?: string } | null;
    const dest = log.destinationId as { _id?: unknown; name?: string; slug?: string; category?: string; area?: string; image?: { url: string } } | null;
    const chal = log.challengeId as { _id?: unknown; title?: string; rewardPoints?: number } | null;
    const qr = log.qrCodeId as { _id?: unknown; code?: string; label?: string } | null;

    return {
      id: String(log._id),
      entryType: log.entryType,
      scoreAwarded: log.scoreAwarded,
      completedAt: log.completedAt,
      source: log.source,
      badgeKey: log.badgeKey,
      metadata: log.metadata,
      user: user
        ? {
            id: String(user._id ?? ''),
            email: user.email ?? 'Khách vãng lai',
            displayName: user.displayName ?? 'Khách vãng lai',
            role: user.role ?? 'tourist',
          }
        : {
            id: 'anonymous',
            email: 'Khách ẩn danh',
            displayName: 'Khách tham quan',
            role: 'tourist',
          },
      destination: dest
        ? {
            id: String(dest._id ?? ''),
            name: dest.name,
            slug: dest.slug,
            category: dest.category,
            area: dest.area,
            imageUrl: dest.image?.url,
          }
        : null,
      challenge: chal
        ? {
            id: String(chal._id ?? ''),
            title: chal.title,
            rewardPoints: chal.rewardPoints,
          }
        : null,
      qrCode: qr
        ? {
            id: String(qr._id ?? ''),
            code: qr.code,
            label: qr.label,
          }
        : null,
    };
  });

  res.json({
    items,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    stats: {
      totalCheckIns,
      totalChallenges,
      totalBadges,
      totalPoints,
      todayActivities,
    },
  });
}
