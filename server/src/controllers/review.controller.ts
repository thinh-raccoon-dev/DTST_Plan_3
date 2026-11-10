import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { DestinationModel } from '../models/Destination.js';
import { PassportEntryModel } from '../models/PassportEntry.js';
import { ReviewModel } from '../models/Review.js';
import { createReviewSchema, reportReviewSchema, reviewQuerySchema } from '../schemas/review.schemas.js';
import { PUBLIC_DESTINATION_FILTER } from '../services/destination.service.js';
import { notFound } from '../utils/errors.js';

const destinationParamSchema = z.object({
  idOrSlug: z.string().trim().min(1),
});

const reviewIdParamSchema = z.object({
  reviewId: z.string().trim().min(1),
});

async function resolveDestination(idOrSlug: string) {
  const destination = await DestinationModel.findOne({
    ...(Types.ObjectId.isValid(idOrSlug) ? { _id: new Types.ObjectId(idOrSlug) } : { slug: idOrSlug }),
    ...PUBLIC_DESTINATION_FILTER,
  }).select('_id name slug').lean();

  if (!destination) {
    throw notFound('Không tìm thấy địa điểm hoặc địa điểm chưa được xuất bản.', 'DESTINATION_NOT_FOUND');
  }
  return destination;
}

export async function listReviews(req: Request, res: Response) {
  const { idOrSlug } = destinationParamSchema.parse(req.params);
  const query = reviewQuerySchema.parse(req.query);
  const destination = await resolveDestination(idOrSlug);

  // 1. Calculate overall stats for all published reviews of this destination
  const allReviews = await ReviewModel.find({
    destinationId: destination._id,
    status: 'published',
  })
    .select('rating tags')
    .lean();

  const totalReviews = allReviews.length;
  const distribution: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  const tagCounts: Record<string, number> = {};
  let totalRatingSum = 0;

  for (const r of allReviews) {
    totalRatingSum += r.rating;
    if (r.rating >= 1 && r.rating <= 5) {
      distribution[r.rating] = (distribution[r.rating] || 0) + 1;
    }
    if (r.tags?.length) {
      for (const t of r.tags) {
        tagCounts[t] = (tagCounts[t] || 0) + 1;
      }
    }
  }

  const averageRating = totalReviews > 0 ? Number((totalRatingSum / totalReviews).toFixed(1)) : 5.0;

  const popularTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([tag]) => tag);

  // 2. Query filtered and sorted reviews
  const filter: Record<string, unknown> = {
    destinationId: destination._id,
    status: 'published',
  };

  if (query.rating) {
    filter.rating = query.rating;
  }

  const sort: Record<string, 1 | -1> =
    query.sort === 'highest'
      ? { rating: -1, createdAt: -1 }
      : query.sort === 'helpful'
        ? { likesCount: -1, createdAt: -1 }
        : { createdAt: -1 };

  const items = await ReviewModel.find(filter)
    .sort(sort)
    .limit(query.limit)
    .lean();

  res.set('Cache-Control', 'no-store');
  res.json({
    stats: {
      averageRating,
      totalReviews,
      distribution,
      popularTags,
    },
    items: items.map((r) => ({
      id: String(r._id),
      authorName: r.authorName,
      authorAvatar: r.authorAvatar,
      authorTier: r.authorTier,
      rating: r.rating,
      content: r.content,
      tags: r.tags ?? [],
      isVerifiedVisitor: r.isVerifiedVisitor,
      likesCount: r.likesCount,
      response: r.response,
      createdAt: r.createdAt,
    })),
  });
}

export async function createReview(req: Request, res: Response) {
  const { idOrSlug } = destinationParamSchema.parse(req.params);
  const body = createReviewSchema.parse(req.body);
  const destination = await resolveDestination(idOrSlug);

  const user = req.user;

  // Check if user has verified visit (already checked in at this destination)
  let isVerifiedVisitor = false;
  let authorTier = 'Du khách Khám phá';

  if (user) {
    const hasCheckIn = await PassportEntryModel.exists({
      userId: user.id,
      destinationId: destination._id,
      entryType: 'check_in',
    });
    isVerifiedVisitor = Boolean(hasCheckIn);

    // Compute user tier from passport
    const pointRows = await PassportEntryModel.aggregate([
      { $match: { userId: new Types.ObjectId(user.id) } },
      { $group: { _id: null, total: { $sum: '$scoreAwarded' } } },
    ]);
    const points = pointRows[0]?.total || 0;
    if (points >= 300) authorTier = '👑 Huyền Thoại Sen Hồng';
    else if (points >= 150) authorTier = '⭐ Đại Sứ Đất Sen';
    else if (points >= 50) authorTier = '🌿 Nhà Du Hành';
    else authorTier = '🧭 Du Khách Tập Sự';
  }

  const authorName = user?.displayName || body.authorName || 'Du khách Đất Sen Hồng';

  const doc = await ReviewModel.create({
    destinationId: destination._id,
    userId: user?.id,
    authorName,
    authorAvatar: undefined,
    authorTier,
    rating: body.rating,
    content: body.content,
    tags: body.tags,
    isVerifiedVisitor,
    likesCount: 0,
    status: 'published',
  });

  res.status(201).json({
    created: true,
    review: {
      id: String(doc._id),
      authorName: doc.authorName,
      authorAvatar: doc.authorAvatar,
      authorTier: doc.authorTier,
      rating: doc.rating,
      content: doc.content,
      tags: doc.tags ?? [],
      isVerifiedVisitor: doc.isVerifiedVisitor,
      likesCount: doc.likesCount,
      createdAt: doc.createdAt,
    },
  });
}

export async function likeReview(req: Request, res: Response) {
  const { reviewId } = reviewIdParamSchema.parse(req.params);

  if (!Types.ObjectId.isValid(reviewId)) {
    throw notFound('Đánh giá không tồn tại.', 'REVIEW_NOT_FOUND');
  }

  const updated = await ReviewModel.findOneAndUpdate(
    { _id: reviewId, status: 'published' },
    { $inc: { likesCount: 1 } },
    { new: true },
  ).select('likesCount');

  if (!updated) {
    throw notFound('Đánh giá không tồn tại.', 'REVIEW_NOT_FOUND');
  }

  res.json({ success: true, likesCount: updated.likesCount });
}

export async function reportReview(req: Request, res: Response) {
  const { reviewId } = reviewIdParamSchema.parse(req.params);
  const body = reportReviewSchema.parse(req.body);

  if (!Types.ObjectId.isValid(reviewId)) {
    throw notFound('Đánh giá không tồn tại.', 'REVIEW_NOT_FOUND');
  }

  const review = await ReviewModel.findById(reviewId);
  if (!review) {
    throw notFound('Đánh giá không tồn tại.', 'REVIEW_NOT_FOUND');
  }

  review.isFlagged = true;
  review.reportCount = (review.reportCount || 0) + 1;
  review.reportReason = body.reason;
  review.reportedAt = new Date();
  await review.save();

  res.json({
    success: true,
    message: 'Cảm ơn bạn đã gửi báo cáo. Ban quản trị hệ thống sẽ sớm duyệt lại đánh giá này.',
  });
}

