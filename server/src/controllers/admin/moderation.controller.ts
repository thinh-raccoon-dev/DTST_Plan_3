import type { Request, Response } from 'express';
import { z } from 'zod';
import { BannerModel } from '../../models/Banner.js';
import { DestinationModel } from '../../models/Destination.js';
import { ReviewModel } from '../../models/Review.js';
import { SafetyAlertModel } from '../../models/SafetyAlert.js';
import { idParamsSchema } from '../../schemas/common.js';
import { logAuditEvent } from '../../services/audit.service.js';
import { toAdminDestination, type LeanDestination } from '../../services/destination.service.js';
import { badRequest, notFound } from '../../utils/errors.js';

/**
 * Centralized Sở VHTTDL Moderation Hub Summary:
 * Returns live pending counts + top items across Destinations, Partner Banners, Flagged Reviews,
 * and active Partner Safety Alerts in a single request.
 */
export async function getModerationSummary(_req: Request, res: Response) {
  const now = new Date();
  const [
    pendingDestinationsCount,
    pendingBannersCount,
    flaggedReviewsCount,
    activePartnerAlertsCount,
    pendingDestinations,
    pendingBanners,
    flaggedReviews,
  ] = await Promise.all([
    DestinationModel.countDocuments({ publicationStatus: 'pending_review' }),
    BannerModel.countDocuments({ approvalStatus: 'pending_review' }),
    ReviewModel.countDocuments({ isFlagged: true }),
    SafetyAlertModel.countDocuments({
      source: 'partner',
      isActive: true,
      $or: [{ expiresAt: { $gt: now } }, { expiresAt: null }],
    }),
    DestinationModel.find({ publicationStatus: 'pending_review' })
      .populate('managedBy', 'displayName email')
      .sort({ updatedAt: -1 })
      .limit(20)
      .lean<LeanDestination[]>(),
    BannerModel.find({ approvalStatus: 'pending_review' })
      .populate('destinationId', 'name slug area')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean(),
    ReviewModel.find({ isFlagged: true })
      .populate('destinationId', 'name slug area')
      .sort({ reportedAt: -1, createdAt: -1 })
      .limit(20)
      .lean(),
  ]);

  const totalPending = pendingDestinationsCount + pendingBannersCount + flaggedReviewsCount;

  res.set('Cache-Control', 'no-store');
  res.json({
    counts: {
      pendingDestinations: pendingDestinationsCount,
      pendingBanners: pendingBannersCount,
      flaggedReviews: flaggedReviewsCount,
      activePartnerAlerts: activePartnerAlertsCount,
      totalPending,
    },
    queues: {
      destinations: pendingDestinations.map(toAdminDestination),
      banners: pendingBanners.map((b) => {
        const dest = b.destinationId as unknown as {
          _id?: unknown;
          name?: string;
          slug?: string;
          area?: string;
        } | null;
        return {
          id: String(b._id),
          kind: b.kind,
          theme: b.theme,
          eyebrow: b.eyebrow ?? null,
          title: b.title,
          subtitle: b.subtitle ?? null,
          imageUrl: b.imageUrl ?? null,
          linkUrl: b.linkUrl ?? null,
          linkLabel: b.linkLabel ?? null,
          sponsorName: b.sponsorName ?? null,
          approvalStatus: b.approvalStatus ?? 'pending_review',
          status: b.status,
          startAt: b.startAt ?? null,
          endAt: b.endAt ?? null,
          createdAt: b.createdAt ?? null,
          destination: dest?.name
            ? { id: String(dest._id), name: dest.name, slug: dest.slug ?? '', area: dest.area ?? '' }
            : null,
        };
      }),
      reviews: flaggedReviews.map((r) => {
        const dest = r.destinationId as unknown as {
          _id?: unknown;
          name?: string;
          slug?: string;
          area?: string;
        } | null;
        return {
          id: String(r._id),
          authorName: r.authorName,
          rating: r.rating,
          content: r.content,
          status: r.status,
          isFlagged: Boolean(r.isFlagged),
          reportReason: r.reportReason ?? '',
          reportCount: r.reportCount ?? 1,
          reportedAt: r.reportedAt ?? null,
          createdAt: r.createdAt ?? null,
          destination: dest?.name
            ? { id: String(dest._id), name: dest.name, slug: dest.slug ?? '' }
            : null,
        };
      }),
    },
  });
}

const reviewDestinationSchema = z.object({
  decision: z.enum(['approve', 'return_draft', 'hide']),
  reviewNote: z.string().trim().max(500).optional(),
});

/** Admin 1-click destination moderation with mandatory reviewNote when returning/hiding. */
export async function reviewDestination(req: Request, res: Response) {
  const { id } = idParamsSchema.parse(req.params);
  const body = reviewDestinationSchema.parse(req.body);
  const doc = await DestinationModel.findById(id);
  if (!doc) throw notFound('Không tìm thấy địa điểm.');

  if ((body.decision === 'return_draft' || body.decision === 'hide') && (!body.reviewNote || body.reviewNote.length < 5)) {
    throw badRequest(
      'Vui lòng nhập lý do trả về hoặc ẩn địa điểm (tối thiểu 5 ký tự) để đối tác nắm rõ và chỉnh sửa.',
      'VALIDATION_ERROR',
    );
  }

  if (body.decision === 'approve') {
    doc.publicationStatus = 'published';
    doc.reviewNote = body.reviewNote || 'Đã được Sở VHTTDL duyệt và xuất bản.';
  } else if (body.decision === 'return_draft') {
    doc.publicationStatus = 'draft';
    doc.reviewNote = body.reviewNote;
  } else {
    doc.publicationStatus = 'hidden';
    doc.reviewNote = body.reviewNote;
  }

  await doc.save();
  await doc.populate('managedBy', 'email displayName');

  await logAuditEvent({
    req,
    action:
      body.decision === 'approve'
        ? 'destination.approve'
        : body.decision === 'return_draft'
          ? 'destination.return_draft'
          : 'destination.hide',
    targetType: 'destination',
    targetId: doc._id,
    targetName: doc.name,
    destinationId: doc._id,
    details: {
      decision: body.decision,
      publicationStatus: doc.publicationStatus,
      reviewNote: doc.reviewNote,
    },
  });

  res.json({
    success: true,
    destination: toAdminDestination(doc.toObject() as LeanDestination),
    message:
      body.decision === 'approve'
        ? `Đã phê duyệt và xuất bản “${doc.name}”!`
        : body.decision === 'return_draft'
          ? `Đã trả hồ sơ “${doc.name}” về bản nháp kèm ghi chú.`
          : `Đã ẩn địa điểm “${doc.name}” khỏi trang công khai.`,
  });
}
