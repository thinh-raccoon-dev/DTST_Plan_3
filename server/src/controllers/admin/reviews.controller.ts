import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { DestinationModel } from '../../models/Destination.js';
import { ReviewModel } from '../../models/Review.js';
import {
  adminReviewQuerySchema,
  respondReviewSchema,
  updateReviewStatusSchema,
} from '../../schemas/review.schemas.js';
import { badRequest, forbidden, notFound } from '../../utils/errors.js';
import { escapeRegex } from '../../utils/text.js';

function isPartner(req: Request) {
  return req.user?.role === 'partner';
}

export async function listAdminReviews(req: Request, res: Response) {
  const query = adminReviewQuerySchema.parse(req.query);
  const user = req.user!;
  const partnerUser = isPartner(req);

  // 1. Resolve destination scope
  let destinationFilter: Record<string, unknown> = {};
  let managedDestinations: Array<{ id: string; name: string; slug: string }> = [];

  if (partnerUser) {
    const managed = await DestinationModel.find({
      $or: [{ managedBy: new Types.ObjectId(user.id) }, { managedBy: user.id }],
    })
      .select('_id name slug')
      .lean();
    managedDestinations = managed.map((d) => ({
      id: String(d._id),
      name: d.name,
      slug: d.slug,
    }));

    if (managedDestinations.length === 0) {
      return res.json({
        stats: { total: 0, pendingReports: 0, hidden: 0, responded: 0, averageRating: 0 },
        items: [],
        total: 0,
        page: 1,
        limit: query.limit,
        totalPages: 0,
        managedDestinations: [],
      });
    }

    if (query.destinationId) {
      if (!managedDestinations.some((d) => d.id === query.destinationId)) {
        throw forbidden('Bạn không có quyền quản lý điểm đến này.');
      }
      destinationFilter = { destinationId: new Types.ObjectId(query.destinationId) };
    } else {
      destinationFilter = {
        destinationId: { $in: managedDestinations.map((d) => new Types.ObjectId(d.id)) },
      };
    }
  } else {
    // Admin user: can see all or filter by destination
    if (query.destinationId) {
      destinationFilter = { destinationId: new Types.ObjectId(query.destinationId) };
    }
    const allDests = await DestinationModel.find().select('_id name slug').lean();
    managedDestinations = allDests.map((d) => ({
      id: String(d._id),
      name: d.name,
      slug: d.slug,
    }));
  }

  // 2. Build full filter
  const filter: Record<string, unknown> = { ...destinationFilter };

  if (query.status === 'flagged') {
    filter.isFlagged = true;
  } else if (query.status === 'hidden') {
    filter.status = 'hidden';
  } else if (query.status === 'published') {
    filter.status = 'published';
    filter.isFlagged = { $ne: true };
  }

  if (query.rating) {
    filter.rating = query.rating;
  }

  if (query.q) {
    const rx = new RegExp(escapeRegex(query.q), 'i');
    filter.$or = [{ authorName: rx }, { content: rx }, { reportReason: rx }];
  }

  // 3. Stats for current scope
  const [total, pendingReports, hidden, responded, ratingStats] = await Promise.all([
    ReviewModel.countDocuments(destinationFilter),
    ReviewModel.countDocuments({ ...destinationFilter, isFlagged: true }),
    ReviewModel.countDocuments({ ...destinationFilter, status: 'hidden' }),
    ReviewModel.countDocuments({ ...destinationFilter, 'response.content': { $exists: true, $ne: '' } }),
    ReviewModel.aggregate([
      { $match: destinationFilter },
      { $group: { _id: null, avgRating: { $sum: '$rating' }, count: { $sum: 1 } } },
    ]),
  ]);

  const avgRating =
    ratingStats.length > 0 && ratingStats[0].count > 0
      ? Number((ratingStats[0].avgRating / ratingStats[0].count).toFixed(1))
      : 5.0;

  // 4. Query paginated list
  const skip = (query.page - 1) * query.limit;
  const [items, count] = await Promise.all([
    ReviewModel.find(filter)
      .sort({ isFlagged: -1, createdAt: -1 })
      .skip(skip)
      .limit(query.limit)
      .populate('destinationId', 'name slug area image')
      .lean(),
    ReviewModel.countDocuments(filter),
  ]);

  res.json({
    stats: {
      total,
      pendingReports,
      hidden,
      responded,
      averageRating: avgRating,
    },
    items: items.map((r) => {
      const dest = r.destinationId as unknown as { _id: Types.ObjectId; name: string; slug: string; area?: string };
      return {
        id: String(r._id),
        destination: dest
          ? { id: String(dest._id), name: dest.name, slug: dest.slug, area: dest.area }
          : null,
        authorName: r.authorName,
        authorAvatar: r.authorAvatar,
        authorTier: r.authorTier,
        rating: r.rating,
        content: r.content,
        tags: r.tags ?? [],
        isVerifiedVisitor: r.isVerifiedVisitor,
        likesCount: r.likesCount,
        status: r.status,
        isFlagged: Boolean(r.isFlagged),
        reportReason: r.reportReason,
        reportCount: r.reportCount || 0,
        reportedAt: r.reportedAt,
        response: r.response,
        createdAt: r.createdAt,
      };
    }),
    total: count,
    page: query.page,
    limit: query.limit,
    totalPages: Math.ceil(count / query.limit) || 1,
    managedDestinations,
  });
}

export async function respondReview(req: Request, res: Response) {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  const body = respondReviewSchema.parse(req.body);
  const user = req.user!;

  if (!Types.ObjectId.isValid(id)) {
    throw notFound('Đánh giá không tồn tại.', 'REVIEW_NOT_FOUND');
  }

  const review = await ReviewModel.findById(id);
  if (!review) {
    throw notFound('Đánh giá không tồn tại.', 'REVIEW_NOT_FOUND');
  }

  // If partner, verify they manage this destination
  if (isPartner(req)) {
    const isOwner = await DestinationModel.exists({
      _id: review.destinationId,
      $or: [{ managedBy: new Types.ObjectId(user.id) }, { managedBy: user.id }],
    });
    if (!isOwner) {
      throw forbidden('Bạn không có quyền quản lý phản hồi cho điểm đến này.');
    }
  }

  const destination = await DestinationModel.findById(review.destinationId).select('name').lean();
  const responderName =
    body.responderName?.trim() ||
    (isPartner(req)
      ? `Ban Quản lý ${destination?.name || 'Điểm đến'}`
      : 'Ban Quản trị Đồng Tháp Smart Travel');

  review.response = {
    content: body.content.trim(),
    respondedAt: new Date(),
    responderName,
    responderId: new Types.ObjectId(user.id),
  };

  await review.save();

  res.json({
    success: true,
    response: review.response,
    message: 'Đã gửi phản hồi chính thức thành công!',
  });
}

export async function deleteReviewResponse(req: Request, res: Response) {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  const user = req.user!;

  if (!Types.ObjectId.isValid(id)) {
    throw notFound('Đánh giá không tồn tại.', 'REVIEW_NOT_FOUND');
  }

  const review = await ReviewModel.findById(id);
  if (!review) {
    throw notFound('Đánh giá không tồn tại.', 'REVIEW_NOT_FOUND');
  }

  if (isPartner(req)) {
    const isOwner = await DestinationModel.exists({
      _id: review.destinationId,
      $or: [{ managedBy: new Types.ObjectId(user.id) }, { managedBy: user.id }],
    });
    if (!isOwner) {
      throw forbidden('Bạn không có quyền quản lý điểm đến này.');
    }
  }

  review.response = undefined;
  await review.save();

  res.json({ success: true, message: 'Đã xóa phản hồi của ban quản lý.' });
}

export async function updateReviewStatus(req: Request, res: Response) {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  const body = updateReviewStatusSchema.parse(req.body);
  const user = req.user!;

  if (!Types.ObjectId.isValid(id)) {
    throw notFound('Đánh giá không tồn tại.', 'REVIEW_NOT_FOUND');
  }

  const review = await ReviewModel.findById(id);
  if (!review) {
    throw notFound('Đánh giá không tồn tại.', 'REVIEW_NOT_FOUND');
  }

  // Only admin can approve/hide globally; partner can report/flag to admin
  if (isPartner(req)) {
    const isOwner = await DestinationModel.exists({
      _id: review.destinationId,
      $or: [{ managedBy: new Types.ObjectId(user.id) }, { managedBy: user.id }],
    });
    if (!isOwner) {
      throw forbidden('Bạn không có quyền quản lý điểm đến này.');
    }
    // Partner can request to flag or hide if they manage it
    if (body.status === 'flagged') {
      review.isFlagged = true;
      review.status = 'flagged';
    } else {
      throw forbidden('Chỉ Quản trị viên hệ thống (Admin) mới có quyền duyệt gỡ cờ hoặc khôi phục đánh giá.');
    }
  } else {
    // Admin has full control
    review.status = body.status;
    if (body.isFlagged !== undefined) {
      review.isFlagged = body.isFlagged;
    } else if (body.status === 'published') {
      review.isFlagged = false;
    }
  }

  await review.save();

  res.json({
    success: true,
    status: review.status,
    isFlagged: review.isFlagged,
    message: 'Đã cập nhật trạng thái đánh giá thành công.',
  });
}

export async function deleteReview(req: Request, res: Response) {
  const id = typeof req.params.id === 'string' ? req.params.id : '';

  if (isPartner(req)) {
    throw forbidden('Chỉ Quản trị viên hệ thống (Admin) mới có quyền xóa vĩnh viễn đánh giá.');
  }

  if (!Types.ObjectId.isValid(id)) {
    throw notFound('Đánh giá không tồn tại.', 'REVIEW_NOT_FOUND');
  }

  const deleted = await ReviewModel.findByIdAndDelete(id);
  if (!deleted) {
    throw notFound('Đánh giá không tồn tại.', 'REVIEW_NOT_FOUND');
  }

  res.json({ success: true, message: 'Đã xóa đánh giá vĩnh viễn.' });
}
