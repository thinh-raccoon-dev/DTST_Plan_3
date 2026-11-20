import { randomInt } from 'node:crypto';
import { GoogleGenAI } from '@google/genai';
import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import QRCode from 'qrcode';
import { z } from 'zod';
import { AnalyticsEventModel } from '../../models/AnalyticsEvent.js';
import { AuditLogModel } from '../../models/AuditLog.js';
import { BADGE_ICONS, BadgeModel } from '../../models/Badge.js';
import { BannerModel } from '../../models/Banner.js';
import { ChallengeModel } from '../../models/Challenge.js';
import { DestinationModel } from '../../models/Destination.js';
import { GroupInquiryModel } from '../../models/GroupInquiry.js';
import { PartnerVoucherModel } from '../../models/PartnerVoucher.js';
import { PassportEntryModel } from '../../models/PassportEntry.js';
import { QrCodeModel } from '../../models/QrCode.js';
import { ReviewModel } from '../../models/Review.js';
import {
  SAFETY_ALERT_TYPES,
  SAFETY_SEVERITIES,
  SafetyAlertModel,
  TERRAIN_IMPACTS,
} from '../../models/SafetyAlert.js';
import { logAuditEvent } from '../../services/audit.service.js';
import { qrPublicUrl } from '../../services/qr.service.js';
import { badRequest, forbidden, notFound } from '../../utils/errors.js';
import { resolveGeminiApiKey } from '../../utils/geminiKey.js';
import { logger } from '../../utils/logger.js';

function partnerUserId(req: Request): Types.ObjectId {
  return new Types.ObjectId(req.user!.id);
}

function partnerOwnerQuery(req: Request): Record<string, unknown> {
  return { managedBy: { $in: [req.user!.id, partnerUserId(req)] } };
}

/**
 * Strictly resolve all destinations owned by the current partner (or selectable by admin),
 * plus the active target destination. Prevents IDOR: a partner can NEVER access another
 * partner's destination by guessing or forging `destinationId`.
 */
export async function resolveScopedDestination(req: Request, explicitDestId?: unknown) {
  const user = req.user!;
  const isPartner = user.role === 'partner';
  const rawDestId = String(
    explicitDestId || req.body?.destinationId || req.query?.destinationId || '',
  ).trim();

  if (rawDestId && !Types.ObjectId.isValid(rawDestId)) {
    throw badRequest('Mã địa điểm du lịch không hợp lệ.');
  }

  if (isPartner) {
    const managedList = await DestinationModel.find(partnerOwnerQuery(req))
      .select('_id name slug area operationalStatus publicationStatus')
      .sort({ updatedAt: -1 })
      .lean();

    if (managedList.length === 0) {
      if (rawDestId) {
        throw forbidden('Bạn không có quyền truy cập hoặc thao tác trên địa điểm du lịch này.');
      }
      return { managedList: [], destination: null };
    }

    let targetId = managedList[0]!._id;
    if (rawDestId) {
      const ownsTarget = managedList.some((d) => String(d._id) === rawDestId);
      if (!ownsTarget) {
        throw forbidden('Bạn không có quyền truy cập hoặc thao tác trên địa điểm du lịch này.');
      }
      targetId = new Types.ObjectId(rawDestId);
    }

    const destination = await DestinationModel.findById(targetId)
      .populate('managedBy', 'displayName email')
      .lean();
    return { managedList, destination };
  }

  // Admin preview mode
  const managedRaw = await DestinationModel.find()
    .select('_id name slug area operationalStatus publicationStatus')
    .sort({ updatedAt: -1 })
    .limit(60)
    .lean();

  const managedList = managedRaw.map((d) => ({
    _id: d._id,
    name: d.name,
    slug: d.slug,
    area: d.area,
    operationalStatus: d.operationalStatus,
    publicationStatus: d.publicationStatus,
  }));

  const targetId = rawDestId ? new Types.ObjectId(rawDestId) : managedList[0]?._id;
  const destination = targetId
    ? await DestinationModel.findById(targetId).populate('managedBy', 'displayName email').lean()
    : null;

  if (destination && !managedList.some((d) => String(d._id) === String(destination._id))) {
    managedList.unshift({
      _id: destination._id,
      name: destination.name,
      slug: destination.slug,
      area: destination.area,
      operationalStatus: destination.operationalStatus,
      publicationStatus: destination.publicationStatus,
    });
  }

  return { managedList, destination };
}

export async function assertPartnerOwnsDestinationId(req: Request, destinationId: Types.ObjectId) {
  if (req.user!.role === 'admin') return;
  const owns = await DestinationModel.exists({
    _id: destinationId,
    ...partnerOwnerQuery(req),
  });
  if (!owns) {
    throw forbidden('Bạn không có quyền thao tác trên dữ liệu của địa điểm khác.');
  }
}

/**
 * Privacy compliance (Nghị định 13/2023/NĐ-CP):
 * Never expose visitor email, phone, or internal userId to destination partners.
 */
export function maskVisitorDisplayName(displayName?: string | null, fallbackId?: string): string {
  const clean = (displayName || '').trim();
  if (clean) return clean;
  const suffix = fallbackId ? fallbackId.slice(-4).toUpperCase() : '0000';
  return `Du khách #${suffix}`;
}

function anonymizeForCsv(displayName?: string | null, fallbackId?: string): string {
  const clean = (displayName || '').trim();
  const suffix = fallbackId ? fallbackId.slice(-4).toUpperCase() : '0000';
  if (!clean) return `Du khach #${suffix}`;
  const parts = clean.split(/\s+/);
  const last = parts[parts.length - 1] || clean;
  return `${last.slice(0, 1).toUpperCase()}*** #${suffix}`;
}

/** Neutralize CSV Formula Injection (OWASP) and quote RFC 4180 cells safely. */
function csvSafeCell(value: unknown): string {
  let str = value === null || value === undefined ? '' : String(value);
  str = str.replace(/\r?\n/g, ' ').trim();
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function parseDaysWindow(raw: unknown): 7 | 30 | 90 {
  const n = Number(raw);
  if (n === 30) return 30;
  if (n === 90) return 90;
  return 7;
}

function computeProfileHealth(params: {
  destination: {
    images?: Array<unknown>;
    openingHours?: string | null;
    referencePrice?: string | null;
    contactInfo?: { phone?: string | null } | null;
    coordinates?: { lat?: number; lng?: number } | null;
    address?: string | null;
    partnerNotice?: string | null;
  };
  activeQrCount: number;
  activeChallengeCount: number;
  totalReviews: number;
  respondedReviews: number;
}) {
  const { destination, activeQrCount, activeChallengeCount, totalReviews, respondedReviews } = params;
  const checks = [
    {
      key: 'images',
      label: 'Tối thiểu 3 ảnh thực tế chất lượng cao',
      passed: (destination.images?.length || 0) >= 3,
      weight: 20,
      hint: 'Giúp du khách tin tưởng và tăng tỷ lệ xem trang KDL.',
    },
    {
      key: 'coordinates',
      label: 'Đã chấm tọa độ GPS chuẩn xác',
      passed: Boolean(destination.coordinates?.lat && destination.coordinates?.lng),
      weight: 15,
      hint: 'Bắt buộc để mở khóa Tự động Điểm danh GPS và Bản đồ 3D.',
    },
    {
      key: 'hours_price',
      label: 'Công khai giờ mở cửa & giá vé tham khảo',
      passed: Boolean(destination.openingHours && destination.referencePrice),
      weight: 15,
      hint: 'Minh bạch theo Luật Du lịch và giúp AI Trip Planner V9 tính lịch chuẩn.',
    },
    {
      key: 'contact',
      label: 'Có địa chỉ & Hotline hỗ trợ du khách',
      passed: Boolean(destination.address && destination.contactInfo?.phone),
      weight: 15,
      hint: 'Giúp đoàn khách liên hệ đặt dịch vụ nhanh chóng.',
    },
    {
      key: 'qr',
      label: 'Có ít nhất 1 mã QR Check-in đang hoạt động',
      passed: activeQrCount > 0,
      weight: 15,
      hint: 'In Standee đặt tại quầy vé để tăng tương tác tại điểm.',
    },
    {
      key: 'challenge',
      label: 'Có thử thách văn hóa tương tác (Gamification)',
      passed: activeChallengeCount > 0,
      weight: 10,
      hint: 'Tăng thời gian lưu trú và giữ chân du khách Gen Z.',
    },
    {
      key: 'reviews',
      label: 'Tỷ lệ phản hồi đánh giá đạt từ 80% trở lên',
      passed: totalReviews === 0 || respondedReviews / totalReviews >= 0.8,
      weight: 10,
      hint: 'Phản hồi nhanh nâng uy tín thương hiệu cơ sở.',
    },
  ];

  const score = checks.reduce((sum, c) => sum + (c.passed ? c.weight : 0), 0);
  const tier =
    score >= 90 ? 'Xuất sắc' : score >= 70 ? 'Tốt' : score >= 50 ? 'Cần bổ sung' : 'Chưa đầy đủ';

  return { score, tier, checks };
}

/* ── 1. Partner Overview (Multi-Destination + Selectable Days Window + Profile Health) ── */
export async function getPartnerOverview(req: Request, res: Response) {
  const days = parseDaysWindow(req.query.days);
  const { managedList, destination } = await resolveScopedDestination(req);

  if (!destination) {
    return res.json({
      hasDestination: false,
      managedDestinations: [],
      message: 'Tài khoản chưa được gán quyền quản lý địa điểm du lịch nào.',
    });
  }

  const destId = destination._id;
  const challenges = await ChallengeModel.find({ destinationId: destId }).sort({ createdAt: -1 }).lean();
  const challengeIds = challenges.map((c) => c._id);

  const now = new Date();
  const [
    totalViews,
    totalCheckIns,
    reviewStats,
    qrCodes,
    badges,
    recentCheckIns,
    recentReviews,
    activeAlerts,
    activeVouchersCount,
    newInquiriesCount,
    pendingBannersCount,
  ] = await Promise.all([
    AnalyticsEventModel.countDocuments({
      destinationId: destId,
      eventType: { $in: ['destination_page_view', 'qr_landing_view'] },
    }),
    PassportEntryModel.countDocuments({
      destinationId: destId,
      entryType: 'check_in',
    }),
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
    QrCodeModel.find({
      $or: [
        { targetType: 'destination', targetId: destId },
        { targetType: 'challenge', targetId: { $in: challengeIds } },
      ],
    })
      .sort({ createdAt: -1 })
      .lean(),
    BadgeModel.find({ destinationId: destId }).sort({ createdAt: -1 }).lean(),
    PassportEntryModel.find({ destinationId: destId, entryType: 'check_in' })
      .sort({ completedAt: -1 })
      .limit(12)
      .populate('userId', 'displayName') // NĐ 13/2023: never query or expose visitor email!
      .lean(),
    ReviewModel.find({ destinationId: destId, status: 'published' })
      .sort({ createdAt: -1 })
      .limit(8)
      .lean(),
    SafetyAlertModel.find({
      destinationId: destId,
      isActive: true,
      $or: [{ expiresAt: { $gt: now } }, { expiresAt: null }],
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean(),
    PartnerVoucherModel.countDocuments({
      destinationId: destId,
      status: 'active',
      validUntil: { $gt: now },
    }),
    GroupInquiryModel.countDocuments({
      destinationId: destId,
      status: 'new',
    }),
    BannerModel.countDocuments({
      destinationId: destId,
      approvalStatus: 'pending_review',
    }),
  ]);

  const [challengeCompletions, qrScanRows] = await Promise.all([
    PassportEntryModel.aggregate([
      { $match: { challengeId: { $in: challengeIds }, entryType: 'challenge_completed' } },
      { $group: { _id: '$challengeId', count: { $sum: 1 } } },
    ]),
    qrCodes.length > 0
      ? AnalyticsEventModel.aggregate<{ _id: Types.ObjectId; views: number }>([
          {
            $match: {
              eventType: 'qr_landing_view',
              qrCodeId: { $in: qrCodes.map((q) => q._id) },
            },
          },
          { $group: { _id: '$qrCodeId', views: { $sum: 1 } } },
        ])
      : Promise.resolve([]),
  ]);

  const completionMap = new Map(challengeCompletions.map((r) => [String(r._id), r.count]));
  const qrViewsMap = new Map(qrScanRows.map((r) => [String(r._id), r.views]));
  const reviewsSummary = reviewStats[0] || { avgRating: 5.0, total: 0, responded: 0 };

  // Dynamic Chart Analytics Window (7 / 30 / 90 days)
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (days - 1));
  startDate.setHours(0, 0, 0, 0);

  const [dailyViewsAgg, dailyCheckInsAgg, ratingDistributionAgg, checkInSourcesAgg, hourlyTrafficAgg] =
    await Promise.all([
      AnalyticsEventModel.aggregate([
        {
          $match: {
            destinationId: destId,
            eventType: { $in: ['destination_page_view', 'qr_landing_view'] },
            timestamp: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp', timezone: '+07:00' } },
            count: { $sum: 1 },
          },
        },
      ]),
      PassportEntryModel.aggregate([
        {
          $match: {
            destinationId: destId,
            entryType: 'check_in',
            completedAt: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$completedAt', timezone: '+07:00' } },
            count: { $sum: 1 },
          },
        },
      ]),
      ReviewModel.aggregate([
        { $match: { destinationId: destId, status: 'published' } },
        { $group: { _id: '$rating', count: { $sum: 1 } } },
      ]),
      PassportEntryModel.aggregate([
        { $match: { destinationId: destId, completedAt: { $gte: startDate } } },
        { $group: { _id: '$source', count: { $sum: 1 } } },
      ]),
      PassportEntryModel.aggregate([
        { $match: { destinationId: destId, completedAt: { $gte: startDate } } },
        { $project: { hour: { $hour: { date: '$completedAt', timezone: '+07:00' } } } },
        { $group: { _id: '$hour', count: { $sum: 1 } } },
      ]),
    ]);

  const viewsByDay = new Map(dailyViewsAgg.map((r) => [r._id, r.count]));
  const checkInsByDay = new Map(dailyCheckInsAgg.map((r) => [r._id, r.count]));

  const dailyTrend: Array<{ date: string; label: string; views: number; checkIns: number }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(d);
    const [, m, day] = dateKey.split('-');
    dailyTrend.push({
      date: dateKey,
      label: `${day}/${m}`,
      views: viewsByDay.get(dateKey) || 0,
      checkIns: checkInsByDay.get(dateKey) || 0,
    });
  }

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
  const checkInSources = (
    checkInSourcesAgg.length > 0 ? checkInSourcesAgg : [{ _id: 'gps', count: 0 }]
  ).map((s: { _id: string; count: number }) => ({
    name: sourceLabels[s._id] || s._id || 'GPS Thực địa',
    value: s.count,
    color: sourceColors[s._id] || '#15803d',
  }));

  // Honest real hourly traffic counts (never fabricated percentages!)
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
    { period: 'Sáng (06h - 10h)', count: morning },
    { period: 'Trưa (10h - 14h)', count: midday },
    { period: 'Chiều (14h - 18h)', count: afternoon },
    { period: 'Tối (18h - 22h)', count: evening },
  ];

  const activeQrCount = qrCodes.filter((q) => q.status === 'active').length;
  const activeChallengeCount = challenges.filter((c) => c.status === 'active').length;

  const profileHealth = computeProfileHealth({
    destination,
    activeQrCount,
    activeChallengeCount,
    totalReviews: reviewsSummary.total,
    respondedReviews: reviewsSummary.responded,
  });

  res.set('Cache-Control', 'no-store');
  res.json({
    hasDestination: true,
    daysWindow: days,
    managedDestinations: managedList.map((d) => ({
      id: String(d._id),
      name: d.name,
      slug: d.slug,
      area: d.area,
      operationalStatus: d.operationalStatus,
      publicationStatus: d.publicationStatus,
    })),
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
      partnerNotice: destination.partnerNotice || '',
      partnerNoticeUpdatedAt: destination.partnerNoticeUpdatedAt || null,
      managedBy: destination.managedBy,
    },
    profileHealth,
    metrics: {
      totalViews,
      totalCheckIns,
      averageRating: reviewsSummary.total > 0 ? Number(reviewsSummary.avgRating.toFixed(1)) : 5.0,
      totalReviews: reviewsSummary.total,
      respondedReviews: reviewsSummary.responded,
      totalChallenges: challenges.length,
      totalCompletedChallenges: Array.from(completionMap.values()).reduce((a, b) => a + b, 0),
      totalQrs: qrCodes.length,
      activeAlertsCount: activeAlerts.length,
      activeVouchersCount,
      servicesCount: destination.services?.length ?? 0,
      newInquiriesCount,
      pendingBannersCount,
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
      const u = e.userId as unknown as { displayName?: string } | null;
      return {
        id: String(e._id),
        visitorName: maskVisitorDisplayName(u?.displayName, String(e._id)),
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
      story: c.story || '',
      status: c.status,
      questionCount: c.questions.length,
      questions: c.questions.map((q) => ({
        prompt: q.prompt,
        options: q.options,
        correctOptionIndex: q.correctOptionIndex,
        explanation: q.explanation || '',
      })),
      rewardPoints: c.scoringRules.rewardPoints,
      completions: completionMap.get(String(c._id)) || 0,
      createdAt: c.createdAt,
    })),
    qrs: qrCodes.map((q) => ({
      id: String(q._id),
      code: q.code,
      label: q.label,
      targetType: q.targetType,
      targetId: String(q.targetId),
      status: q.status,
      url: qrPublicUrl(q.code),
      landingViews: qrViewsMap.get(String(q._id)) || 0,
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
    activeAlerts: activeAlerts.map((a) => ({
      id: String(a._id),
      type: a.type,
      severity: a.severity,
      title: a.title,
      description: a.description,
      radiusKm: a.radiusKm,
      terrainImpact: a.terrainImpact,
      expiresAt: a.expiresAt,
      createdAt: a.createdAt,
    })),
  });
}

/* ── 2. Operational Status & Separate Public Partner Notice ── */
const toggleOperationalSchema = z.object({
  destinationId: z.string().optional(),
  operationalStatus: z.enum(['active', 'temporarily_closed', 'closed']),
  specialNotice: z.string().trim().max(500).optional(),
});

export async function toggleOperationalStatus(req: Request, res: Response) {
  const body = toggleOperationalSchema.parse(req.body);
  const { destination } = await resolveScopedDestination(req, body.destinationId);

  if (!destination) {
    throw notFound('Không tìm thấy địa điểm du lịch thuộc quyền quản lý của bạn.');
  }

  const doc = await DestinationModel.findById(destination._id);
  if (!doc) throw notFound('Không tìm thấy địa điểm du lịch.');

  const previousStatus = doc.operationalStatus;
  doc.operationalStatus = body.operationalStatus;
  if (body.specialNotice !== undefined) {
    doc.partnerNotice = body.specialNotice || undefined;
    doc.partnerNoticeUpdatedAt = body.specialNotice ? new Date() : undefined;
  }
  await doc.save();

  await logAuditEvent({
    req,
    action: 'destination.operational_status.toggle',
    targetType: 'destination',
    targetId: doc._id,
    targetName: doc.name,
    destinationId: doc._id,
    details: {
      previousStatus,
      newStatus: doc.operationalStatus,
      partnerNotice: doc.partnerNotice || '',
    },
  });

  res.json({
    success: true,
    operationalStatus: doc.operationalStatus,
    partnerNotice: doc.partnerNotice || '',
    partnerNoticeUpdatedAt: doc.partnerNoticeUpdatedAt || null,
    message: 'Đã cập nhật trạng thái vận hành và thông báo công khai thành công!',
  });
}

/* ── 3. Full Scoped Challenge CRUD (Create / Update / Toggle / Safe Delete) ── */
const questionInputSchema = z
  .object({
    prompt: z.string().trim().min(5, 'Câu hỏi tối thiểu 5 ký tự').max(300),
    options: z.array(z.string().trim().min(1).max(150)).min(2).max(4),
    correctOptionIndex: z.number().int().min(0).max(3),
    explanation: z.string().trim().max(300).optional(),
  })
  .refine((q) => q.correctOptionIndex < q.options.length, {
    message: 'Đáp án đúng phải nằm trong danh sách các phương án.',
    path: ['correctOptionIndex'],
  });

const createPartnerChallengeSchema = z.object({
  destinationId: z.string().optional(),
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(500).optional(),
  story: z.string().trim().max(2500).optional(),
  rewardPoints: z.coerce.number().int().min(10).max(150).default(50),
  questions: z.array(questionInputSchema).min(1).max(5),
});

const updatePartnerChallengeSchema = z.object({
  title: z.string().trim().min(3).max(160).optional(),
  description: z.string().trim().max(500).optional(),
  story: z.string().trim().max(2500).optional(),
  rewardPoints: z.coerce.number().int().min(10).max(150).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  questions: z.array(questionInputSchema).min(1).max(5).optional(),
});

export async function createPartnerChallenge(req: Request, res: Response) {
  const body = createPartnerChallengeSchema.parse(req.body);
  const { destination } = await resolveScopedDestination(req, body.destinationId);

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

export async function updatePartnerChallenge(req: Request, res: Response) {
  const id = String(req.params.id || '');
  if (!Types.ObjectId.isValid(id)) throw badRequest('Mã thử thách không hợp lệ.');

  const body = updatePartnerChallengeSchema.parse(req.body);
  const challenge = await ChallengeModel.findById(id);
  if (!challenge) throw notFound('Không tìm thấy thử thách.');

  await assertPartnerOwnsDestinationId(req, challenge.destinationId);

  if (body.title !== undefined) challenge.title = body.title;
  if (body.description !== undefined) challenge.description = body.description;
  if (body.story !== undefined) challenge.story = body.story;
  if (body.status !== undefined) challenge.status = body.status;
  if (body.rewardPoints !== undefined) {
    challenge.scoringRules.rewardPoints = body.rewardPoints;
  }
  if (body.questions !== undefined) {
    challenge.set(
      'questions',
      body.questions.map((q) => ({
        prompt: q.prompt,
        options: q.options,
        correctOptionIndex: q.correctOptionIndex,
        explanation: q.explanation || '',
      })),
    );
    challenge.scoringRules.minCorrect =
      body.questions.length >= 2 ? Math.ceil(body.questions.length * 0.6) : 1;
  }

  await challenge.save();

  await logAuditEvent({
    req,
    action: 'challenge.update',
    targetType: 'challenge',
    targetId: challenge._id,
    targetName: challenge.title,
    destinationId: challenge.destinationId,
    details: {
      status: challenge.status,
      rewardPoints: challenge.scoringRules.rewardPoints,
      questionsCount: challenge.questions.length,
    },
  });

  res.json({
    success: true,
    challenge: {
      id: String(challenge._id),
      title: challenge.title,
      status: challenge.status,
    },
    message: 'Đã cập nhật thử thách văn hóa thành công!',
  });
}

export async function deletePartnerChallenge(req: Request, res: Response) {
  const id = String(req.params.id || '');
  if (!Types.ObjectId.isValid(id)) throw badRequest('Mã thử thách không hợp lệ.');

  const challenge = await ChallengeModel.findById(id);
  if (!challenge) throw notFound('Không tìm thấy thử thách.');

  await assertPartnerOwnsDestinationId(req, challenge.destinationId);

  const hasCompletions = await PassportEntryModel.exists({ challengeId: challenge._id });
  if (hasCompletions) {
    challenge.status = 'inactive';
    await challenge.save();
    await QrCodeModel.updateMany(
      { targetType: 'challenge', targetId: challenge._id },
      { $set: { status: 'inactive' } },
    );

    await logAuditEvent({
      req,
      action: 'challenge.archive',
      targetType: 'challenge',
      targetId: challenge._id,
      targetName: challenge.title,
      destinationId: challenge.destinationId,
      details: { reason: 'has_existing_passport_completions' },
    });

    return res.json({
      success: true,
      archived: true,
      message:
        'Thử thách đã có du khách hoàn thành nên đã được chuyển sang Tạm dừng để bảo toàn điểm Hộ chiếu của du khách.',
    });
  }

  await QrCodeModel.deleteMany({ targetType: 'challenge', targetId: challenge._id });
  await challenge.deleteOne();

  await logAuditEvent({
    req,
    action: 'challenge.delete',
    targetType: 'challenge',
    targetId: challenge._id,
    targetName: challenge.title,
    destinationId: challenge.destinationId,
    details: {},
  });

  res.json({
    success: true,
    archived: false,
    message: 'Đã xóa thử thách thành công!',
  });
}

/* ── 4. Full Scoped QR Code CRUD + Local Server-Side QR Image ── */
const createPartnerQrSchema = z.object({
  destinationId: z.string().optional(),
  label: z.string().trim().min(3).max(120),
  targetType: z.enum(['destination', 'challenge']),
  challengeId: z.string().optional(),
});

const updatePartnerQrSchema = z.object({
  label: z.string().trim().min(3).max(120).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  notes: z.string().trim().max(300).optional(),
});

async function resolveQrDestinationId(qr: {
  targetType: string;
  targetId: Types.ObjectId;
}): Promise<Types.ObjectId | null> {
  if (qr.targetType === 'destination') return qr.targetId;
  const ch = await ChallengeModel.findById(qr.targetId).select('destinationId').lean();
  return ch ? ch.destinationId : null;
}

export async function createPartnerQr(req: Request, res: Response) {
  const body = createPartnerQrSchema.parse(req.body);
  const { destination } = await resolveScopedDestination(req, body.destinationId);

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

  // Cryptographically secure QR code generator (CSPRNG)
  const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let attempt = 0; attempt < 8; attempt++) {
    let suffix = '';
    for (let i = 0; i < 6; i += 1) {
      suffix += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
    }
    const candidate = `DT-${suffix}`;
    const exists = await QrCodeModel.exists({ code: candidate });
    if (!exists) {
      code = candidate;
      break;
    }
  }
  if (!code) {
    code = `DT-${Date.now().toString(36).toUpperCase().slice(-6)}`;
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
      url: qrPublicUrl(doc.code),
    },
    message: 'Đã tạo mã QR mới thành công!',
  });
}

export async function updatePartnerQr(req: Request, res: Response) {
  const id = String(req.params.id || '');
  if (!Types.ObjectId.isValid(id)) throw badRequest('Mã QR không hợp lệ.');

  const body = updatePartnerQrSchema.parse(req.body);
  const qr = await QrCodeModel.findById(id);
  if (!qr) throw notFound('Không tìm thấy mã QR.');

  const destId = await resolveQrDestinationId(qr);
  if (!destId) throw notFound('Không tìm thấy điểm đến liên kết với mã QR.');
  await assertPartnerOwnsDestinationId(req, destId);

  if (body.label !== undefined) qr.label = body.label;
  if (body.status !== undefined) qr.status = body.status;
  if (body.notes !== undefined) qr.notes = body.notes;
  await qr.save();

  await logAuditEvent({
    req,
    action: 'qr.update',
    targetType: 'qr',
    targetId: qr._id,
    targetName: qr.label,
    destinationId: destId,
    details: { code: qr.code, status: qr.status },
  });

  res.json({
    success: true,
    qr: {
      id: String(qr._id),
      code: qr.code,
      label: qr.label,
      status: qr.status,
    },
    message: 'Đã cập nhật mã QR thành công!',
  });
}

export async function deletePartnerQr(req: Request, res: Response) {
  const id = String(req.params.id || '');
  if (!Types.ObjectId.isValid(id)) throw badRequest('Mã QR không hợp lệ.');

  const qr = await QrCodeModel.findById(id);
  if (!qr) throw notFound('Không tìm thấy mã QR.');

  const destId = await resolveQrDestinationId(qr);
  if (!destId) throw notFound('Không tìm thấy điểm đến liên kết với mã QR.');
  await assertPartnerOwnsDestinationId(req, destId);

  const [hasEntries, hasAnalytics] = await Promise.all([
    PassportEntryModel.exists({ qrCodeId: qr._id }),
    AnalyticsEventModel.exists({ qrCodeId: qr._id }),
  ]);

  if (hasEntries || hasAnalytics) {
    qr.status = 'inactive';
    await qr.save();
    await logAuditEvent({
      req,
      action: 'qr.disable',
      targetType: 'qr',
      targetId: qr._id,
      targetName: qr.label,
      destinationId: destId,
      details: { code: qr.code, reason: 'has_scan_history' },
    });
    return res.json({
      success: true,
      archived: true,
      message: 'Mã QR đã có lịch sử quét nên đã được vô hiệu hóa để bảo toàn dữ liệu thống kê.',
    });
  }

  await qr.deleteOne();
  await logAuditEvent({
    req,
    action: 'qr.delete',
    targetType: 'qr',
    targetId: qr._id,
    targetName: qr.label,
    destinationId: destId,
    details: { code: qr.code },
  });

  res.json({
    success: true,
    archived: false,
    message: 'Đã xóa mã QR thành công!',
  });
}

/** Local high-res PNG Data URL QR generator — zero dependency on third-party QR APIs! */
export async function getPartnerQrImage(req: Request, res: Response) {
  const id = String(req.params.id || '');
  if (!Types.ObjectId.isValid(id)) throw badRequest('Mã QR không hợp lệ.');

  const qr = await QrCodeModel.findById(id).lean();
  if (!qr) throw notFound('Không tìm thấy mã QR.');

  const destId = await resolveQrDestinationId(qr);
  if (!destId) throw notFound('Không tìm thấy điểm đến liên kết.');
  await assertPartnerOwnsDestinationId(req, destId);

  const url = qrPublicUrl(qr.code);
  const dataUrl = await QRCode.toDataURL(url, {
    width: 600,
    margin: 2,
    errorCorrectionLevel: 'H',
    color: { dark: '#0f2f25', light: '#ffffff' },
  });

  res.json({
    success: true,
    code: qr.code,
    url,
    dataUrl,
  });
}

/* ── 5. Full Scoped Badge CRUD ── */
const createPartnerBadgeSchema = z.object({
  destinationId: z.string().optional(),
  name: z.string().trim().min(2, 'Tên huy hiệu cần ít nhất 2 ký tự').max(100),
  description: z.string().trim().min(5, 'Mô tả cần ít nhất 5 ký tự').max(300),
  icon: z.enum(BADGE_ICONS),
  criteriaType: z.enum(['checkin_count', 'challenge_count']),
  targetCount: z.coerce.number().int().min(1, 'Chỉ tiêu cần ít nhất là 1').max(50),
  rewardPoints: z.coerce
    .number()
    .int()
    .min(10, 'Điểm thưởng tối thiểu là 10')
    .max(150, 'Điểm thưởng tối đa là 150')
    .default(50),
});

const updatePartnerBadgeSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  description: z.string().trim().min(5).max(300).optional(),
  icon: z.enum(BADGE_ICONS).optional(),
  criteriaType: z.enum(['checkin_count', 'challenge_count']).optional(),
  targetCount: z.coerce.number().int().min(1).max(50).optional(),
  rewardPoints: z.coerce.number().int().min(10).max(150).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

export async function createPartnerBadge(req: Request, res: Response) {
  const user = req.user!;
  const body = createPartnerBadgeSchema.parse(req.body);
  const { destination } = await resolveScopedDestination(req, body.destinationId);

  if (!destination) {
    throw notFound('Không tìm thấy điểm đến để tạo huy hiệu.');
  }

  const activeCount = await BadgeModel.countDocuments({
    destinationId: destination._id,
    status: 'active',
  });
  if (activeCount >= 5) {
    throw badRequest('Điểm đến đã đạt giới hạn tối đa 5 Huy hiệu đang hoạt động. Hãy tạm dừng hoặc xóa bớt trước khi tạo mới.');
  }

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

export async function updatePartnerBadge(req: Request, res: Response) {
  const id = String(req.params.id || '');
  if (!Types.ObjectId.isValid(id)) throw badRequest('Mã huy hiệu không hợp lệ.');

  const body = updatePartnerBadgeSchema.parse(req.body);
  const badge = await BadgeModel.findById(id);
  if (!badge) throw notFound('Không tìm thấy huy hiệu.');

  if (!badge.destinationId) {
    throw forbidden('Không thể chỉnh sửa huy hiệu hệ thống chung.');
  }
  await assertPartnerOwnsDestinationId(req, badge.destinationId);

  if (body.status === 'active' && badge.status !== 'active') {
    const activeCount = await BadgeModel.countDocuments({
      destinationId: badge.destinationId,
      status: 'active',
    });
    if (activeCount >= 5) {
      throw badRequest('Điểm đến đã đủ 5 Huy hiệu đang hoạt động.');
    }
  }

  if (body.name !== undefined) badge.name = body.name;
  if (body.description !== undefined) badge.description = body.description;
  if (body.icon !== undefined) badge.icon = body.icon;
  if (body.criteriaType !== undefined) badge.criteriaType = body.criteriaType;
  if (body.targetCount !== undefined) badge.targetCount = body.targetCount;
  if (body.rewardPoints !== undefined) badge.rewardPoints = body.rewardPoints;
  if (body.status !== undefined) badge.status = body.status;

  await badge.save();

  await logAuditEvent({
    req,
    action: 'badge.update',
    targetType: 'badge',
    targetId: badge._id,
    targetName: badge.name,
    destinationId: badge.destinationId,
    details: { status: badge.status, rewardPoints: badge.rewardPoints },
  });

  res.json({
    success: true,
    badge: {
      id: String(badge._id),
      name: badge.name,
      status: badge.status,
    },
    message: 'Đã cập nhật huy hiệu thành công!',
  });
}

export async function deletePartnerBadge(req: Request, res: Response) {
  const id = String(req.params.id || '');
  if (!Types.ObjectId.isValid(id)) throw badRequest('Mã huy hiệu không hợp lệ.');

  const badge = await BadgeModel.findById(id);
  if (!badge) throw notFound('Không tìm thấy huy hiệu.');

  if (!badge.destinationId) {
    throw forbidden('Không thể xóa huy hiệu hệ thống chung.');
  }
  await assertPartnerOwnsDestinationId(req, badge.destinationId);

  await badge.deleteOne();

  await logAuditEvent({
    req,
    action: 'badge.delete',
    targetType: 'badge',
    targetId: badge._id,
    targetName: badge.name,
    destinationId: badge.destinationId,
    details: { key: badge.key },
  });

  res.json({
    success: true,
    message: 'Đã xóa huy hiệu thành công!',
  });
}

/* ── 6. Destination-Scoped Field Safety Alerts (Linked to Safety Guardian & 3D Map) ── */
const createPartnerAlertSchema = z.object({
  destinationId: z.string().optional(),
  type: z.enum(SAFETY_ALERT_TYPES),
  severity: z.enum(SAFETY_SEVERITIES).default('warning'),
  title: z.string().trim().min(5, 'Tiêu đề tối thiểu 5 ký tự').max(160),
  description: z.string().trim().min(10, 'Mô tả chi tiết tối thiểu 10 ký tự').max(800),
  radiusKm: z.coerce.number().min(0.5).max(15).default(3),
  terrainImpact: z.enum(TERRAIN_IMPACTS).default('outdoor'),
  hoursValid: z.coerce.number().int().min(1).max(168).default(24),
});

export async function listPartnerAlerts(req: Request, res: Response) {
  const { destination } = await resolveScopedDestination(req);
  if (!destination) return res.json({ success: true, items: [] });

  const items = await SafetyAlertModel.find({ destinationId: destination._id })
    .sort({ isActive: -1, createdAt: -1 })
    .limit(30)
    .lean();

  res.json({
    success: true,
    items: items.map((a) => ({
      id: String(a._id),
      type: a.type,
      severity: a.severity,
      title: a.title,
      description: a.description,
      radiusKm: a.radiusKm,
      terrainImpact: a.terrainImpact,
      isActive: a.isActive,
      expiresAt: a.expiresAt,
      createdAt: a.createdAt,
    })),
  });
}

export async function createPartnerAlert(req: Request, res: Response) {
  const body = createPartnerAlertSchema.parse(req.body);
  const { destination } = await resolveScopedDestination(req, body.destinationId);

  if (!destination) {
    throw notFound('Không tìm thấy địa điểm để phát cảnh báo.');
  }
  if (!destination.coordinates?.lat || !destination.coordinates?.lng) {
    throw badRequest('Vui lòng cập nhật tọa độ GPS cho địa điểm trước khi phát cảnh báo thực địa.');
  }

  const doc = await SafetyAlertModel.create({
    type: body.type,
    severity: body.severity,
    title: body.title,
    description: body.description,
    areaLabel: `${destination.name} (${destination.area})`,
    coordinates: {
      lat: destination.coordinates.lat,
      lng: destination.coordinates.lng,
    },
    radiusKm: Math.min(body.radiusKm, 15),
    terrainImpact: body.terrainImpact,
    source: req.user!.role === 'partner' ? 'partner' : 'admin',
    destinationId: destination._id,
    isActive: true,
    expiresAt: new Date(Date.now() + body.hoursValid * 60 * 60 * 1000),
    createdBy: new Types.ObjectId(req.user!.id),
  });

  await logAuditEvent({
    req,
    action: 'safety_alert.create',
    targetType: 'safety_alert',
    targetId: doc._id,
    targetName: doc.title,
    destinationId: destination._id,
    details: {
      type: doc.type,
      severity: doc.severity,
      radiusKm: doc.radiusKm,
      hoursValid: body.hoursValid,
    },
  });

  res.status(201).json({
    success: true,
    alert: {
      id: String(doc._id),
      type: doc.type,
      severity: doc.severity,
      title: doc.title,
      description: doc.description,
      radiusKm: doc.radiusKm,
      expiresAt: doc.expiresAt,
    },
    message: 'Đã phát cảnh báo thực địa lên Bản đồ 3D & Trợ lý An toàn thành công!',
  });
}

export async function deactivatePartnerAlert(req: Request, res: Response) {
  const id = String(req.params.id || '');
  if (!Types.ObjectId.isValid(id)) throw badRequest('Mã cảnh báo không hợp lệ.');

  const alert = await SafetyAlertModel.findById(id);
  if (!alert) throw notFound('Không tìm thấy cảnh báo.');

  if (req.user!.role === 'partner') {
    const createdBySelf = alert.createdBy && String(alert.createdBy) === req.user!.id;
    let ownsDest = false;
    if (alert.destinationId) {
      ownsDest = Boolean(
        await DestinationModel.exists({ _id: alert.destinationId, ...partnerOwnerQuery(req) }),
      );
    }
    if (!createdBySelf && !ownsDest) {
      throw forbidden('Bạn không có quyền gỡ cảnh báo của cơ sở khác.');
    }
  }

  alert.isActive = false;
  await alert.save();

  await logAuditEvent({
    req,
    action: 'safety_alert.deactivate',
    targetType: 'safety_alert',
    targetId: alert._id,
    targetName: alert.title,
    destinationId: alert.destinationId ?? undefined,
    details: {},
  });

  res.json({
    success: true,
    message: 'Đã gỡ cảnh báo thực địa!',
  });
}

/* ── 7. Privacy-Compliant, Formula-Safe CSV Report Export (NĐ 13/2023/NĐ-CP) ── */
export async function exportPartnerReportCsv(req: Request, res: Response) {
  const days = parseDaysWindow(req.query.days);
  const { destination } = await resolveScopedDestination(req);
  if (!destination) throw notFound('Không tìm thấy địa điểm để xuất báo cáo.');

  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  const [viewsCount, checkIns, reviewAgg] = await Promise.all([
    AnalyticsEventModel.countDocuments({
      destinationId: destination._id,
      eventType: { $in: ['destination_page_view', 'qr_landing_view'] },
      timestamp: { $gte: since },
    }),
    PassportEntryModel.find({
      destinationId: destination._id,
      entryType: 'check_in',
      completedAt: { $gte: since },
    })
      .sort({ completedAt: -1 })
      .limit(2000)
      .populate('userId', 'displayName')
      .lean(),
    ReviewModel.aggregate([
      { $match: { destinationId: destination._id, status: 'published', createdAt: { $gte: since } } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]),
  ]);

  const lines: string[] = [];
  lines.push(['BAO CAO HOAT DONG KHU DU LICH (AN DANH THEO NGHI DINH 13/2023/ND-CP)'].map(csvSafeCell).join(','));
  lines.push(['Ten co so', destination.name].map(csvSafeCell).join(','));
  lines.push(['Ky bao cao', `${days} ngay gan nhat`].map(csvSafeCell).join(','));
  lines.push(['Thoi diem xuat', new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })].map(csvSafeCell).join(','));
  lines.push(['Tong luot xem trang', viewsCount].map(csvSafeCell).join(','));
  lines.push(['Tong luot Check-in thuc dia', checkIns.length].map(csvSafeCell).join(','));
  lines.push([
    'Diem danh gia trung binh',
    reviewAgg[0]?.count ? `${Number(reviewAgg[0].avg).toFixed(1)}/5 (${reviewAgg[0].count} danh gia)` : 'Chua co',
  ].map(csvSafeCell).join(','));
  lines.push('');
  lines.push(['STT', 'Ma luot check-in', 'Du khach (da an danh)', 'Nguon', 'Diem EXP', 'Thoi gian'].map(csvSafeCell).join(','));

  checkIns.forEach((entry, idx) => {
    const u = entry.userId as unknown as { displayName?: string } | null;
    lines.push(
      [
        idx + 1,
        String(entry._id).slice(-8).toUpperCase(),
        anonymizeForCsv(u?.displayName, String(entry._id)),
        entry.source === 'gps' ? 'GPS Thuc dia' : entry.source === 'qr' ? 'Quet QR' : entry.source,
        entry.scoreAwarded ?? 10,
        new Date(entry.completedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
      ]
        .map(csvSafeCell)
        .join(','),
    );
  });

  await logAuditEvent({
    req,
    action: 'partner.report.export',
    targetType: 'report',
    targetId: destination._id,
    targetName: `CSV Report ${days}d - ${destination.name}`,
    destinationId: destination._id,
    details: { days, rows: checkIns.length },
  });

  const safeFileSlug = destination.slug.replace(/[^a-z0-9-]/gi, '').slice(0, 40) || 'kdl';
  const filename = `bao-cao-${safeFileSlug}-${days}ngay.csv`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.send(`\uFEFF${lines.join('\r\n')}`);
}

/* ── 8. Scoped Partner Activity / Audit Log ── */
export async function listPartnerAuditLogs(req: Request, res: Response) {
  const { destination } = await resolveScopedDestination(req);
  if (!destination) return res.json({ success: true, items: [] });

  const logs = await AuditLogModel.find({ destinationId: destination._id })
    .sort({ createdAt: -1 })
    .limit(40)
    .lean();

  res.json({
    success: true,
    items: logs.map((l) => ({
      id: String(l._id),
      actorName: l.actorName || (l.actorRole === 'admin' ? 'Quản trị viên Sở VHTTDL' : 'Đối tác KDL'),
      actorRole: l.actorRole,
      action: l.action,
      targetType: l.targetType,
      targetName: l.targetName,
      details: l.details,
      createdAt: l.createdAt,
    })),
  });
}

/* ── 9. Partner AI Assistant (Human-in-the-loop Challenge Draft & Review Reply) ── */
const aiChallengeDraftSchema = z.object({
  destinationId: z.string().optional(),
  topic: z.string().trim().max(200).optional(),
  questionCount: z.coerce.number().int().min(1).max(5).default(3),
});

export async function generatePartnerChallengeDraft(req: Request, res: Response) {
  const body = aiChallengeDraftSchema.parse(req.body);
  const { destination } = await resolveScopedDestination(req, body.destinationId);
  if (!destination) throw notFound('Không tìm thấy địa điểm để tạo gợi ý thử thách.');

  const topicHint = body.topic || 'nét độc đáo văn hóa, lịch sử và trải nghiệm thực địa';
  const fallbackDraft = {
    title: `Khám phá bí mật ${destination.name}`,
    description: `Trả lời đúng bộ câu hỏi trải nghiệm về ${destination.name} để nhận điểm Hộ chiếu Sen Hồng.`,
    story:
      destination.summary ||
      `${destination.name} là một trong những điểm đến đặc sắc tại Đồng Tháp, mang đậm bản sắc văn hóa sông nước miệt vườn và tinh thần hiếu khách của người dân Đất Sen Hồng.`,
    rewardPoints: 50,
    questions: [
      {
        prompt: `${destination.name} nổi bật với trải nghiệm đặc trưng nào dành cho du khách?`,
        options: [
          destination.summary ? destination.summary.slice(0, 95) : 'Khám phá cảnh quan, văn hóa và ẩm thực đặc sản địa phương',
          'Trượt tuyết trên đỉnh núi băng quanh năm',
          'Lặn ngắm rạn san hô đại dương sâu',
          'Đua xe công thức trên sa mạc cát',
        ],
        correctOptionIndex: 0,
        explanation: `${destination.name} mang đến trải nghiệm đặc trưng của vùng đất Đồng Tháp thuần khiết như hồn sen.`,
      },
      {
        prompt: `Khi tham quan ${destination.name}, du khách có thể lưu dấu kỷ niệm Hộ chiếu số bằng cách nào?`,
        options: [
          'Quét mã QR tại điểm hoặc bật Điểm danh GPS trong bán kính 1.000m',
          'Gửi thư tay qua bưu điện quốc tế',
          'Chỉ ghi nhớ mà không cần thao tác gì',
          'Chờ đợi đến năm sau mới được cộng điểm',
        ],
        correctOptionIndex: 0,
        explanation: 'Hệ thống Đồng Tháp Smart Travel hỗ trợ cả quét mã QR tại chỗ lẫn tự động điểm danh GPS.',
      },
      {
        prompt: 'Du khách nên ứng xử thế nào để giữ gìn cảnh quan xanh – sạch – đẹp tại điểm đến?',
        options: [
          'Bỏ rác đúng nơi quy định, bảo vệ cây xanh và tôn trọng không gian di sản',
          'Hái hoa bẻ cành làm kỷ niệm mang về',
          'Xả rác tự do xuống kênh rạch',
          'Mở loa công suất lớn làm ồn khu vực tham quan',
        ],
        correctOptionIndex: 0,
        explanation: 'Du lịch xanh và có trách nhiệm giúp gìn giữ vẻ đẹp bền vững cho Đất Sen Hồng.',
      },
    ].slice(0, body.questionCount),
  };

  const apiKey = resolveGeminiApiKey();
  if (!apiKey) {
    return res.json({ success: true, source: 'template', draft: fallbackDraft });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Bạn là chuyên gia nội dung du lịch Đồng Tháp. Hãy soạn bản nháp 1 thử thách trắc nghiệm văn hóa chính xác, trung thực (không bịa số liệu lịch sử nếu không chắc) cho địa điểm sau:
- Tên địa điểm: ${destination.name}
- Khu vực: ${destination.area}
- Mô tả chính thức: ${destination.summary || ''} ${String(destination.description || '').slice(0, 900)}
- Chủ đề mong muốn: ${topicHint}
- Số lượng câu hỏi: ${body.questionCount}

CHỈ trả về JSON hợp lệ đúng cấu trúc:
{
  "title": "Tiêu đề hấp dẫn <= 90 ký tự",
  "description": "Mô tả ngắn <= 180 ký tự",
  "story": "Đoạn giới thiệu văn hóa truyền cảm hứng 2-4 câu",
  "rewardPoints": 50,
  "questions": [
    {
      "prompt": "Câu hỏi rõ ràng dễ hiểu",
      "options": ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"],
      "correctOptionIndex": 0,
      "explanation": "Giải thích thú vị sau khi trả lời"
    }
  ]
}`;

    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json', temperature: 0.5 },
    });

    const rawText = (result.text || '').trim();
    const parsed = JSON.parse(rawText);
    const validated = createPartnerChallengeSchema.omit({ destinationId: true }).safeParse(parsed);
    if (validated.success) {
      return res.json({ success: true, source: 'gemini', draft: validated.data });
    }
  } catch (err) {
    logger.warn({ err }, 'Partner AI challenge draft fallback to template');
  }

  res.json({ success: true, source: 'template', draft: fallbackDraft });
}

const aiReviewReplySchema = z.object({
  reviewId: z.string().trim().min(1),
});

export async function suggestPartnerReviewReply(req: Request, res: Response) {
  const { reviewId } = aiReviewReplySchema.parse(req.body);
  if (!Types.ObjectId.isValid(reviewId)) throw badRequest('Mã đánh giá không hợp lệ.');

  const review = await ReviewModel.findById(reviewId).lean();
  if (!review) throw notFound('Không tìm thấy đánh giá.');

  await assertPartnerOwnsDestinationId(req, review.destinationId);
  const destination = await DestinationModel.findById(review.destinationId).select('name').lean();
  const destName = destination?.name || 'Khu du lịch';

  const isPositive = review.rating >= 4;
  const fallbackSuggestions = isPositive
    ? [
        {
          tone: 'Thân thiện miền Tây',
          content: `Dạ ${destName} xin chân thành cảm ơn ${review.authorName} đã ghé thăm và để lại đánh giá ${review.rating} sao thật ấm áp! Rất mong sớm được đón bạn và gia đình quay lại Đất Sen Hồng trong chuyến đi tới nhé! 🌸`,
        },
        {
          tone: 'Chuyên nghiệp',
          content: `Ban Quản lý ${destName} trân trọng cảm ơn lời khen và sự tin yêu của Quý khách ${review.authorName}. Đây là động lực lớn để đội ngũ chúng tôi không ngừng nâng cao chất lượng phục vụ. Kính chúc Quý khách nhiều sức khỏe và hẹn gặp lại!`,
        },
      ]
    : [
        {
          tone: 'Cầu thị & Khắc phục',
          content: `Ban Quản lý ${destName} xin gửi lời xin lỗi chân thành tới Quý khách ${review.authorName} vì trải nghiệm chưa thật sự trọn vẹn. Chúng tôi đã ghi nhận góp ý quý báu này để rà soát và cải thiện ngay dịch vụ. Rất mong có cơ hội đón tiếp lại Quý khách chu đáo hơn!`,
        },
        {
          tone: 'Thân thiện & Lắng nghe',
          content: `Dạ ${destName} cảm ơn ${review.authorName} đã góp ý thẳng thắn ạ! Đội ngũ xin tiếp thu để điều chỉnh ngay những điểm chưa hài lòng. Nếu có thể, bạn nhắn thêm cho Hotline cơ sở để chúng tôi hỗ trợ chu đáo hơn nhé!`,
        },
      ];

  const apiKey = resolveGeminiApiKey();
  if (!apiKey) {
    return res.json({ success: true, source: 'template', suggestions: fallbackSuggestions });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Bạn là nhân viên chăm sóc khách hàng chuyên nghiệp của điểm du lịch "${destName}" tại Đồng Tháp.
Khách hàng "${review.authorName}" vừa đánh giá ${review.rating}/5 sao với nội dung: "${review.content}".
Hãy viết 2 gợi ý phản hồi tiếng Việt ngắn gọn (2-3 câu), lịch sự, chân thành, tôn trọng người tiêu dùng, không tranh cãi, không hứa hẹn sai sự thật.
CHỈ trả về JSON:
{
  "suggestions": [
    { "tone": "Thân thiện miền Tây", "content": "..." },
    { "tone": "Chuyên nghiệp", "content": "..." }
  ]
}`;
    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json', temperature: 0.4 },
    });
    const parsed = JSON.parse((result.text || '').trim()) as {
      suggestions?: Array<{ tone: string; content: string }>;
    };
    if (Array.isArray(parsed.suggestions) && parsed.suggestions.length >= 1) {
      return res.json({
        success: true,
        source: 'gemini',
        suggestions: parsed.suggestions.slice(0, 2),
      });
    }
  } catch (err) {
    logger.warn({ err }, 'Partner AI review reply fallback to template');
  }

  res.json({ success: true, source: 'template', suggestions: fallbackSuggestions });
}
