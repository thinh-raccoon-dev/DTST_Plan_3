import type { Request, Response } from 'express';
import { BadgeModel } from '../../models/Badge.js';
import { PassportEntryModel } from '../../models/PassportEntry.js';
import { UserModel } from '../../models/User.js';
import { idParamsSchema } from '../../schemas/common.js';
import { createBadgeSchema, updateBadgeSchema } from '../../schemas/badge.schemas.js';
import { ensureDefaultBadges } from '../../services/passport.service.js';
import { badRequest, conflict, notFound } from '../../utils/errors.js';

export async function listBadges(_req: Request, res: Response) {
  await ensureDefaultBadges();
  const badges = await BadgeModel.find().sort({ createdAt: 1 }).lean();

  const awardCounts = await PassportEntryModel.aggregate<{ _id: string; totalAwards: number; uniqueUsers: number }>([
    { $match: { entryType: 'badge_awarded', badgeKey: { $exists: true } } },
    {
      $group: {
        _id: '$badgeKey',
        totalAwards: { $sum: 1 },
        users: { $addToSet: '$userId' },
      },
    },
    {
      $project: {
        totalAwards: 1,
        uniqueUsers: { $size: '$users' },
      },
    },
  ]);

  const countMap = new Map(awardCounts.map((a) => [a._id, a]));

  const items = badges.map((badge) => {
    const stats = countMap.get(badge.key);
    return {
      ...badge,
      awardedCount: stats?.totalAwards ?? 0,
      uniqueUsersCount: stats?.uniqueUsers ?? 0,
    };
  });

  res.json({ items });
}

export async function getBadgeAnalytics(_req: Request, res: Response) {
  await ensureDefaultBadges();
  const [totalBadges, activeBadges, totalAwards, totalUsers] = await Promise.all([
    BadgeModel.countDocuments(),
    BadgeModel.countDocuments({ status: 'active' }),
    PassportEntryModel.countDocuments({ entryType: 'badge_awarded' }),
    UserModel.countDocuments({ role: 'tourist' }),
  ]);

  // Recent awards
  const recentAwards = await PassportEntryModel.find({ entryType: 'badge_awarded' })
    .sort({ completedAt: -1 })
    .limit(10)
    .populate('userId', 'displayName email')
    .lean();

  const allBadges = await BadgeModel.find().lean();
  const badgeMap = new Map(allBadges.map((b) => [b.key, b]));

  const formattedRecent = recentAwards.map((entry) => {
    const badge = badgeMap.get(entry.badgeKey ?? '');
    const user = entry.userId as { displayName?: string; email?: string } | null;
    return {
      id: String(entry._id),
      badgeKey: entry.badgeKey,
      badgeName: badge?.name ?? entry.badgeKey,
      badgeIcon: badge?.icon ?? 'trophy',
      userDisplayName: user?.displayName ?? 'Khách vãng lai (Thiết bị)',
      userEmail: user?.email ?? null,
      scoreAwarded: entry.scoreAwarded ?? 0,
      completedAt: entry.completedAt,
    };
  });

  // Unlock rates per badge
  const awardCounts = await PassportEntryModel.aggregate<{ _id: string; count: number }>([
    { $match: { entryType: 'badge_awarded', badgeKey: { $exists: true } } },
    { $group: { _id: '$badgeKey', count: { $sum: 1 } } },
  ]);
  const countMap = new Map(awardCounts.map((a) => [a._id, a.count]));

  const badgeStats = allBadges.map((b) => {
    const count = countMap.get(b.key) ?? 0;
    const unlockRate = totalUsers > 0 ? Math.round((count / totalUsers) * 100) : 0;
    return {
      key: b.key,
      name: b.name,
      icon: b.icon,
      status: b.status,
      awardedCount: count,
      unlockRate: Math.min(100, unlockRate),
    };
  });

  res.json({
    summary: {
      totalBadges,
      activeBadges,
      totalAwards,
      totalUsers,
    },
    badgeStats,
    recentAwards: formattedRecent,
  });
}

export async function createBadge(req: Request, res: Response) {
  const input = createBadgeSchema.parse(req.body);
  const exists = await BadgeModel.findOne({ key: input.key });
  if (exists) throw conflict('Mã huy hiệu (key) đã tồn tại trong hệ thống.', 'BADGE_KEY_TAKEN');

  const badge = await BadgeModel.create(input);
  res.status(201).json({ badge });
}

export async function getBadge(req: Request, res: Response) {
  const { id } = idParamsSchema.parse(req.params);
  const badge = await BadgeModel.findById(id).lean();
  if (!badge) throw notFound('Không tìm thấy huy hiệu.');
  res.json({ badge });
}

export async function updateBadge(req: Request, res: Response) {
  const { id } = idParamsSchema.parse(req.params);
  const patch = updateBadgeSchema.parse(req.body);

  const badge = await BadgeModel.findById(id);
  if (!badge) throw notFound('Không tìm thấy huy hiệu.');

  for (const [key, val] of Object.entries(patch)) {
    if (val !== undefined) badge.set(key, val);
  }

  await badge.save();
  res.json({ badge });
}

export async function deleteBadge(req: Request, res: Response) {
  const { id } = idParamsSchema.parse(req.params);
  const badge = await BadgeModel.findById(id);
  if (!badge) throw notFound('Không tìm thấy huy hiệu.');

  const awardCount = await PassportEntryModel.countDocuments({ entryType: 'badge_awarded', badgeKey: badge.key });
  if (awardCount > 0) {
    // If already awarded to visitors, deactivate rather than deleting to preserve passport history
    badge.status = 'inactive';
    await badge.save();
    res.json({ message: 'Huy hiệu đã được trao cho du khách nên được chuyển sang trạng thái Tạm dừng hoạt động.', badge });
    return;
  }

  await badge.deleteOne();
  res.status(204).end();
}
