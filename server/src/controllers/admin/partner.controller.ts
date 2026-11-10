import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { AnalyticsEventModel } from '../../models/AnalyticsEvent.js';
import { ChallengeModel } from '../../models/Challenge.js';
import { DestinationModel } from '../../models/Destination.js';
import { PassportEntryModel } from '../../models/PassportEntry.js';
import { QrCodeModel } from '../../models/QrCode.js';
import { ReviewModel } from '../../models/Review.js';
import { UserModel } from '../../models/User.js';
import { badRequest, forbidden, notFound } from '../../utils/errors.js';

function partnerUserId(req: Request): Types.ObjectId {
  return new Types.ObjectId(req.user!.id);
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

  // 2. Fetch metrics
  const [
    totalViews,
    totalCheckIns,
    reviewStats,
    challenges,
    qrCodes,
    recentCheckIns,
    recentReviews,
  ] = await Promise.all([
    // Page views
    AnalyticsEventModel.countDocuments({
      destinationId: destId,
      eventType: 'destination_view',
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

    // Challenges list
    ChallengeModel.find({ destinationId: destId }).sort({ createdAt: -1 }).lean(),

    // Qr codes list
    QrCodeModel.find({
      $or: [
        { targetType: 'destination', targetId: destId },
        { targetType: 'challenge' }, // will filter by destination's challenges
      ],
    }).lean(),

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
  const challengeIds = challenges.map((c) => c._id);
  const challengeCompletions = await PassportEntryModel.aggregate([
    { $match: { challengeId: { $in: challengeIds }, entryType: 'challenge_completed' } },
    { $group: { _id: '$challengeId', count: { $sum: 1 } } },
  ]);
  const completionMap = new Map(challengeCompletions.map((r) => [String(r._id), r.count]));

  // Filter QRs specifically for this destination or its challenges
  const validChallengeIdStrs = new Set(challengeIds.map((id) => String(id)));
  const relevantQrs = qrCodes.filter(
    (q) =>
      (q.targetType === 'destination' && String(q.targetId) === String(destId)) ||
      (q.targetType === 'challenge' && validChallengeIdStrs.has(String(q.targetId))),
  );

  const reviewsSummary = reviewStats[0] || { avgRating: 5.0, total: 0, responded: 0 };

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
  });
}

const toggleOperationalSchema = z.object({
  operationalStatus: z.enum(['active', 'temporarily_closed', 'closed']),
  specialNotice: z.string().trim().max(300).optional(),
});

export async function toggleOperationalStatus(req: Request, res: Response) {
  const user = req.user!;
  const body = toggleOperationalSchema.parse(req.body);
  const isPartner = user.role === 'partner';

  let destinationFilter: Record<string, unknown> = {};
  if (isPartner) {
    destinationFilter = { managedBy: { $in: [user.id, new Types.ObjectId(user.id)] } };
  } else {
    const destId = req.body.destinationId;
    if (destId && Types.ObjectId.isValid(destId)) {
      destinationFilter = { _id: new Types.ObjectId(destId) };
    }
  }

  const destination = await DestinationModel.findOne(destinationFilter);
  if (!destination) {
    throw notFound('Không tìm thấy địa điểm du lịch của bạn.');
  }

  destination.operationalStatus = body.operationalStatus;
  if (body.specialNotice !== undefined) {
    destination.reviewNote = body.specialNotice;
  }
  await destination.save();

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
  rewardPoints: z.number().int().min(10).max(200).default(50),
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
  const user = req.user!;
  const body = createPartnerChallengeSchema.parse(req.body);
  const isPartner = user.role === 'partner';

  let destinationFilter: Record<string, unknown> = {};
  if (isPartner) {
    destinationFilter = { managedBy: { $in: [user.id, new Types.ObjectId(user.id)] } };
  } else {
    const destId = req.query.destinationId as string;
    if (destId && Types.ObjectId.isValid(destId)) {
      destinationFilter = { _id: new Types.ObjectId(destId) };
    }
  }

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
  const user = req.user!;
  const body = createPartnerQrSchema.parse(req.body);
  const isPartner = user.role === 'partner';

  let destinationFilter: Record<string, unknown> = {};
  if (isPartner) {
    destinationFilter = { managedBy: { $in: [user.id, new Types.ObjectId(user.id)] } };
  } else {
    const destId = req.query.destinationId as string;
    if (destId && Types.ObjectId.isValid(destId)) {
      destinationFilter = { _id: new Types.ObjectId(destId) };
    }
  }

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
