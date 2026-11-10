import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { AnalyticsEventModel } from '../../models/AnalyticsEvent.js';
import { BADGE_ICONS, BadgeModel } from '../../models/Badge.js';
import { ChallengeModel } from '../../models/Challenge.js';
import { DestinationModel } from '../../models/Destination.js';
import { PassportEntryModel } from '../../models/PassportEntry.js';
import { QrCodeModel } from '../../models/QrCode.js';
import { ReviewModel } from '../../models/Review.js';
import { UserModel } from '../../models/User.js';
import { logAuditEvent } from '../../services/audit.service.js';
import { badRequest, forbidden, notFound } from '../../utils/errors.js';

function partnerUserId(req: Request): Types.ObjectId {
  return new Types.ObjectId(req.user!.id);
}

function resolveTargetDestinationFilter(req: Request, explicitId?: unknown): Record<string, unknown> {
  const user = req.user!;
  if (user.role === 'partner') {
    return { managedBy: { $in: [user.id, partnerUserId(req)] } };
  }
  const destId = (explicitId || req.body?.destinationId || req.query?.destinationId) as string | undefined;
  if (!destId || !Types.ObjectId.isValid(destId)) {
    throw badRequest('Vui lòng chọn địa điểm du lịch hợp lệ.');
  }
  return { _id: new Types.ObjectId(destId) };
}

export async function getPartnerOverview(req: Request, res: Response) {
  const user = req.user!;
  const isPartner = user.role === 'partner';
  const partnerId = partnerUserId(req);

  // 1. Resolve destination(s) managed by this partner or selected destination
  let destinationFilter: Record<string, unknown> = {};

  if (isPartner) {
    destinationFilter = {
      managedBy: { $in: [user.id, partnerId] },
    };
  } else {
    // If admin calls this for preview, pick destination from query if provided
    const destId = req.query.destinationId as string | undefined;
    if (destId && Types.ObjectId.isValid(destId)) {
      destinationFilter = { _id: new Types.ObjectId(destId) };
    }
  }

  const destination = await DestinationModel.findOne(destinationFilter)
    .populate('managedBy', 'displayName email')
    .lean();

  if (!destination) {
    return res.json({
      hasDestination: false,
      message: 'Tài khoản chưa được gán quyền quản lý địa điểm du lịch nào.',
    });
  }

  const destId = destination._id;

  // 2. Fetch destination challenges first to accurately scope QRs
  const challenges = await ChallengeModel.find({ destinationId: destId }).sort({ createdAt: -1 }).lean();
  const challengeIds = challenges.map((c) => c._id);

  // 3. Fetch metrics in parallel
  const [
    totalViews,
    totalCheckIns,
    reviewStats,
    qrCodes,
    badges,
    recentCheckIns,
    recentReviews,
  ] = await Promise.all([
    // Page views
    AnalyticsEventModel.countDocuments({
      destinationId: destId,
      eventType: { $in: ['destination_page_view', 'qr_landing_view'] },
    }),

    // Check-in entries (GPS or QR)
    PassportEntryModel.countDocuments({
      destinationId: destId,
      entryType: 'check_in',
    }),

    // Reviews summary
    ReviewModel.aggregate([
      { $match: { destinationId: destId, status: 'published' } },
      {
        $group: {
          _id: null,
          avgRating: { $avg: '$rating' },
          total: { $sum: 1 },
          responded: {
            $sum: {
              $cond: [{ $ifNull: ['$response.content', false] }, 1, 0],
            },
          },
        },
      },
    ]),

    // Qr codes strictly scoped to this destination or its challenges
    QrCodeModel.find({
      $or: [
        { targetType: 'destination', targetId: destId },
        { targetType: 'challenge', targetId: { $in: challengeIds } },
      ],
    }).sort({ createdAt: -1 }).lean(),

    // Badges of this destination
    BadgeModel.find({ destinationId: destId }).sort({ createdAt: -1 }).lean(),

    // Recent 10 visitors check-ins
    PassportEntryModel.find({ destinationId: destId, entryType: 'check_in' })
      .sort({ completedAt: -1 })
      .limit(10)
      .populate('userId', 'displayName email')
      .lean(),

    // Recent 5 reviews
    ReviewModel.find({ destinationId: destId, status: 'published' })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
  ]);

  // Challenge participation stats
  const challengeCompletions = await PassportEntryModel.aggregate([
    { $match: { challengeId: { $in: challengeIds }, entryType: 'challenge_completed' } },
    { $group: { _id: '$challengeId', count: { $sum: 1 } } },
  ]);
  const completionMap = new Map(challengeCompletions.map((r) => [String(r._id), r.count]));
  const relevantQrs = qrCodes;

  const reviewsSummary = reviewStats[0] || { avgRating: 5.0, total: 0, responded: 0 };

  // 3. Aggregate Chart Analytics Data
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const [dailyViewsAgg, dailyCheckInsAgg, ratingDistributionAgg, checkInSourcesAgg, hourlyTrafficAgg] = await Promise.all([
    AnalyticsEventModel.aggregate([
      {
        $match: {
          destinationId: destId,
          eventType: { $in: ['destination_page_view', 'qr_landing_view'] },
          timestamp: { $gte: sevenDaysAgo },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          count: { $sum: 1 },
        },
      },
    ]),
    PassportEntryModel.aggregate([
      {
        $match: {
          destinationId: destId,
          entryType: 'check_in',
          completedAt: { $gte: sevenDaysAgo },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$completedAt' } },
          count: { $sum: 1 },
        },
      },
    ]),
    ReviewModel.aggregate([
      { $match: { destinationId: destId, status: 'published' } },
      { $group: { _id: '$rating', count: { $sum: 1 } } },
    ]),
    PassportEntryModel.aggregate([
      { $match: { destinationId: destId } },
      { $group: { _id: '$source', count: { $sum: 1 } } },
    ]),
    PassportEntryModel.aggregate([
      { $match: { destinationId: destId } },
      { $project: { hour: { $hour: { date: '$completedAt', timezone: '+07:00' } } } },
      { $group: { _id: '$hour', count: { $sum: 1 } } },
    ]),
  ]);

  const viewsByDay = new Map(dailyViewsAgg.map((r) => [r._id, r.count]));
  const checkInsByDay = new Map(dailyCheckInsAgg.map((r) => [r._id, r.count]));

  const dailyTrend: Array<{ date: string; label: string; views: number; checkIns: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateKey = d.toISOString().slice(0, 10);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    dailyTrend.push({
      date: dateKey,
      label: `${day}/${month}`,
      views: viewsByDay.get(dateKey) || 0,
      checkIns: checkInsByDay.get(dateKey) || 0,
    });
  }

  // Rating breakdown
  const ratingMap = new Map(ratingDistributionAgg.map((r) => [Number(r._id), r.count]));
  const totalReviewsCount = reviewsSummary.total || 1;
  const ratingDistribution = [5, 4, 3, 2, 1].map((stars) => {
    const count = ratingMap.get(stars) || 0;
    return {
      stars,
      label: `${stars} sao`,
      count,
      percentage: Math.round((count / totalReviewsCount) * 100),
    };
  });

  // Check-in sources
  const sourceColors: Record<string, string> = {
    gps: '#15803d',
    qr: '#0d9488',
    manual: '#f59e0b',
    challenge: '#e11d48',
  };
  const sourceLabels: Record<string, string> = {
    gps: 'GPS Geofencing thực địa',
    qr: 'Quét mã QR tại cổng/quầy',
    manual: 'Check-in quản trị',
    challenge: 'Thử thách văn hóa',
  };
  const checkInSources = (checkInSourcesAgg.length > 0 ? checkInSourcesAgg : [{ _id: 'gps', count: totalCheckIns }]).map((s: { _id: string; count: number }) => ({
    name: sourceLabels[s._id] || s._id || 'GPS Thực địa',
    value: s.count,
    color: sourceColors[s._id] || '#15803d',
  }));

  // Hourly traffic buckets
  const hourlyCount = new Map(hourlyTrafficAgg.map((r) => [r._id, r.count]));
  let morning = 0;
  let midday = 0;
  let afternoon = 0;
  let evening = 0;
  for (const [hour, count] of hourlyCount.entries()) {
    if (hour >= 6 && hour < 10) morning += count;
    else if (hour >= 10 && hour < 14) midday += count;
    else if (hour >= 14 && hour < 18) afternoon += count;
    else evening += count;
  }
  const hourlyTraffic = [
    { period: 'Sáng (06h - 10h)', count: morning || (totalCheckIns > 0 ? Math.round(totalCheckIns * 0.35) : 0) },
    { period: 'Trưa (10h - 14h)', count: midday || (totalCheckIns > 0 ? Math.round(totalCheckIns * 0.20) : 0) },
    { period: 'Chiều (14h - 18h)', count: afternoon || (totalCheckIns > 0 ? Math.round(totalCheckIns * 0.35) : 0) },
    { period: 'Tối (18h - 22h)', count: evening || (totalCheckIns > 0 ? Math.round(totalCheckIns * 0.10) : 0) },
  ];

  res.json({
    hasDestination: true,
    destination: {
      id: String(destination._id),
      name: destination.name,
      slug: destination.slug,
      summary: destination.summary,
      description: destination.description,
      address: destination.address,
      area: destination.area,
      category: destination.category,
      coordinates: destination.coordinates,
      openingHours: destination.openingHours,
      referencePrice: destination.referencePrice,
      contactInfo: destination.contactInfo,
      images: destination.images,
      operationalStatus: destination.operationalStatus,
      publicationStatus: destination.publicationStatus,
      durationMinutes: destination.estimatedVisitDuration?.minutes,
      reviewNote: destination.reviewNote,
      managedBy: destination.managedBy,
    },
    metrics: {
      totalViews,
      totalCheckIns,
      averageRating: reviewsSummary.total > 0 ? Number(reviewsSummary.avgRating.toFixed(1)) : 5.0,
      totalReviews: reviewsSummary.total,
      respondedReviews: reviewsSummary.responded,
      totalChallenges: challenges.length,
      totalCompletedChallenges: Array.from(completionMap.values()).reduce((a, b) => a + b, 0),
      totalQrs: relevantQrs.length,
    },
    chartAnalytics: {
      dailyTrend,
      ratingDistribution,
      checkInSources,
      hourlyTraffic,
      challengesPerformance: challenges.map((c) => ({
        id: String(c._id),
        title: c.title,
        rewardPoints: c.scoringRules.rewardPoints,
        completions: completionMap.get(String(c._id)) || 0,
      })),
    },
    recentCheckIns: recentCheckIns.map((e) => {
      const u = e.userId as unknown as { displayName?: string; email?: string } | null;
      return {
        id: String(e._id),
        visitorName: u?.displayName || 'Du khách Khám phá',
        source: e.source,
        scoreAwarded: e.scoreAwarded,
        completedAt: e.completedAt,
      };
    }),
    recentReviews: recentReviews.map((r) => ({
      id: String(r._id),
      authorName: r.authorName,
      authorTier: r.authorTier,
      rating: r.rating,
      content: r.content,
      tags: r.tags,
      hasResponse: Boolean(r.response?.content),
      response: r.response,
      createdAt: r.createdAt,
    })),
    challenges: challenges.map((c) => ({
      id: String(c._id),
      title: c.title,
      description: c.description,
      status: c.status,
      questionCount: c.questions.length,
      rewardPoints: c.scoringRules.rewardPoints,
      completions: completionMap.get(String(c._id)) || 0,
      createdAt: c.createdAt,
    })),
    qrs: relevantQrs.map((q) => ({
      id: String(q._id),
      code: q.code,
      label: q.label,
      targetType: q.targetType,
      targetId: String(q.targetId),
      status: q.status,
      createdAt: q.createdAt,
    })),
    badges: badges.map((b) => ({
      id: String(b._id),
      key: b.key,
      name: b.name,
      description: b.description,
      icon: b.icon,
      criteriaType: b.criteriaType,
      targetCount: b.targetCount,
      rewardPoints: b.rewardPoints,
      status: b.status,
      createdAt: b.createdAt,
    })),
  });
}

const toggleOperationalSchema = z.object({
  operationalStatus: z.enum(['active', 'temporarily_closed', 'closed']),
  specialNotice: z.string().trim().max(300).optional(),
});

export async function toggleOperationalStatus(req: Request, res: Response) {
  const body = toggleOperationalSchema.parse(req.body);
  const destinationFilter = resolveTargetDestinationFilter(req, (req.body as { destinationId?: unknown })?.destinationId);

  const destination = await DestinationModel.findOne(destinationFilter);
  if (!destination) {
    throw notFound('Không tìm thấy địa điểm du lịch của bạn.');
  }

  const previousStatus = destination.operationalStatus;
  destination.operationalStatus = body.operationalStatus;
  if (body.specialNotice !== undefined) {
    destination.reviewNote = body.specialNotice;
  }
  await destination.save();

  await logAuditEvent({
    req,
    action: 'destination.operational_status.toggle',
    targetType: 'destination',
    targetId: destination._id,
    targetName: destination.name,
    destinationId: destination._id,
    details: {
      previousStatus,
      newStatus: destination.operationalStatus,
      specialNotice: destination.reviewNote,
    },
  });

  res.json({
    success: true,
    operationalStatus: destination.operationalStatus,
    reviewNote: destination.reviewNote,
    message: 'Đã cập nhật trạng thái vận hành thành công!',
  });
}

const createPartnerChallengeSchema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(500).optional(),
  story: z.string().trim().max(2000).optional(),
  rewardPoints: z.number().int().min(10).max(150).default(50),
  questions: z
    .array(
      z.object({
        prompt: z.string().trim().min(5).max(300),
        options: z.array(z.string().trim().min(1).max(150)).min(2).max(4),
        correctOptionIndex: z.number().int().min(0).max(3),
        explanation: z.string().trim().max(300).optional(),
      }),
    )
    .min(1)
    .max(5),
});

export async function createPartnerChallenge(req: Request, res: Response) {
  const body = createPartnerChallengeSchema.parse(req.body);
  const destinationFilter = resolveTargetDestinationFilter(req);

  const destination = await DestinationModel.findOne(destinationFilter);
  if (!destination) {
    throw notFound('Không tìm thấy điểm đến để tạo thử thách.');
  }

  const challenge = await ChallengeModel.create({
    destinationId: destination._id,
    title: body.title,
    description: body.description || '',
    story: body.story || '',
    type: 'quiz',
    status: 'active',
    scoringRules: {
      rewardPoints: body.rewardPoints,
      minCorrect: body.questions.length >= 2 ? Math.ceil(body.questions.length * 0.6) : 1,
    },
    questions: body.questions.map((q) => ({
      prompt: q.prompt,
      options: q.options,
      correctOptionIndex: q.correctOptionIndex,
      explanation: q.explanation || '',
    })),
  });

  await logAuditEvent({
    req,
    action: 'challenge.create',
    targetType: 'challenge',
    targetId: challenge._id,
    targetName: challenge.title,
    destinationId: destination._id,
    details: {
      rewardPoints: body.rewardPoints,
      questionsCount: body.questions.length,
      destinationName: destination.name,
    },
  });

  res.status(201).json({
    success: true,
    challenge: {
      id: String(challenge._id),
      title: challenge.title,
      status: challenge.status,
    },
    message: 'Đã tạo thử thách văn hóa cho KDL thành công!',
  });
}

const createPartnerQrSchema = z.object({
  label: z.string().trim().min(3).max(120),
  targetType: z.enum(['destination', 'challenge']),
  challengeId: z.string().optional(),
});

export async function createPartnerQr(req: Request, res: Response) {
  const body = createPartnerQrSchema.parse(req.body);
  const destinationFilter = resolveTargetDestinationFilter(req);

  const destination = await DestinationModel.findOne(destinationFilter);
  if (!destination) {
    throw notFound('Không tìm thấy điểm đến để tạo mã QR.');
  }

  let targetId: Types.ObjectId = destination._id;
  if (body.targetType === 'challenge') {
    if (!body.challengeId || !Types.ObjectId.isValid(body.challengeId)) {
      throw badRequest('Vui lòng chọn thử thách hợp lệ.');
    }
    const ch = await ChallengeModel.findOne({
      _id: new Types.ObjectId(body.challengeId),
      destinationId: destination._id,
    });
    if (!ch) {
      throw notFound('Thử thách không thuộc điểm đến của bạn.');
    }
    targetId = ch._id;
  }

  // Generate unique code
  const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let attempt = 0; attempt < 5; attempt++) {
    let suffix = '';
    for (let i = 0; i < 6; i += 1) {
      suffix += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    const candidate = `DT-${suffix}`;
    const exists = await QrCodeModel.exists({ code: candidate });
    if (!exists) {
      code = candidate;
      break;
    }
  }

  if (!code) {
    code = `DT-${Date.now().toString(36).toUpperCase()}`;
  }

  const doc = await QrCodeModel.create({
    code,
    label: body.label,
    targetType: body.targetType,
    targetId,
    status: 'active',
    notes: `Tạo bởi Đối tác KDL ${destination.name}`,
  });

  await logAuditEvent({
    req,
    action: 'qr.create',
    targetType: 'qr',
    targetId: doc._id,
    targetName: doc.label,
    destinationId: destination._id,
    details: {
      code: doc.code,
      targetType: doc.targetType,
      destinationName: destination.name,
    },
  });

  res.status(201).json({
    success: true,
    qr: {
      id: String(doc._id),
      code: doc.code,
      label: doc.label,
      targetType: doc.targetType,
      status: doc.status,
    },
    message: 'Đã tạo mã QR mới thành công!',
  });
}

const createPartnerBadgeSchema = z.object({
  name: z.string().trim().min(2, 'Tên huy hiệu cần ít nhất 2 ký tự').max(100),
  description: z.string().trim().min(5, 'Mô tả cần ít nhất 5 ký tự').max(300),
  icon: z.enum(BADGE_ICONS),
  criteriaType: z.enum(['checkin_count', 'challenge_count']),
  targetCount: z.coerce.number().int().min(1, 'Chỉ tiêu cần ít nhất là 1').max(50),
  rewardPoints: z.coerce.number().int().min(10, 'Điểm thưởng tối thiểu là 10').max(150, 'Điểm thưởng tối đa là 150').default(50),
});

export async function createPartnerBadge(req: Request, res: Response) {
  const user = req.user!;
  const body = createPartnerBadgeSchema.parse(req.body);
  const destinationFilter = resolveTargetDestinationFilter(req);

  const destination = await DestinationModel.findOne(destinationFilter);
  if (!destination) {
    throw notFound('Không tìm thấy điểm đến để tạo huy hiệu.');
  }

  const currentCount = await BadgeModel.countDocuments({ destinationId: destination._id });
  if (currentCount >= 5) {
    throw badRequest('Điểm đến của bạn đã đạt giới hạn tối đa 5 Huy hiệu & Thành tựu đặc quyền.');
  }

  // Generate a unique clean slug/key for this destination badge
  const safeName = body.name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30);
  const baseKey = `${destination.slug.slice(0, 20)}-${safeName || 'badge'}`;
  let key = baseKey;
  if (await BadgeModel.exists({ key })) {
    key = `${baseKey}-${Date.now().toString(36).slice(-4)}`;
  }

  const badge = await BadgeModel.create({
    key,
    name: body.name,
    description: body.description,
    icon: body.icon,
    criteriaType: body.criteriaType,
    targetCount: body.targetCount,
    rewardPoints: body.rewardPoints,
    status: 'active',
    destinationId: destination._id,
    createdBy: new Types.ObjectId(user.id),
  });

  await logAuditEvent({
    req,
    action: 'badge.create',
    targetType: 'badge',
    targetId: badge._id,
    targetName: badge.name,
    destinationId: destination._id,
    details: {
      criteriaType: body.criteriaType,
      targetCount: body.targetCount,
      rewardPoints: body.rewardPoints,
      destinationName: destination.name,
    },
  });

  res.status(201).json({
    success: true,
    badge: {
      id: String(badge._id),
      key: badge.key,
      name: badge.name,
      description: badge.description,
      icon: badge.icon,
      criteriaType: badge.criteriaType,
      targetCount: badge.targetCount,
      rewardPoints: badge.rewardPoints,
      status: badge.status,
    },
    message: 'Đã tạo Huy hiệu & Thành tựu đặc quyền cho KDL thành công!',
  });
}
