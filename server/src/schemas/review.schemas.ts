import { z } from 'zod';

export const createReviewSchema = z
  .object({
    rating: z.number().int().min(1, 'Vui lòng chọn đánh giá từ 1 đến 5 sao.').max(5),
    content: z
      .string()
      .trim()
      .min(5, 'Nội dung nhận xét cần ít nhất 5 ký tự.')
      .max(1500, 'Nội dung nhận xét không được vượt quá 1500 ký tự.'),
    tags: z.array(z.string().trim().max(40)).max(6).default([]),
    authorName: z.string().trim().min(2).max(100).optional(),
  })
  .strict();

export const reviewQuerySchema = z.object({
  rating: z.coerce.number().int().min(1).max(5).optional(),
  sort: z.enum(['recent', 'highest', 'helpful']).default('recent'),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const likeReviewParamSchema = z.object({
  reviewId: z.string().trim().min(1),
});

export const reportReviewSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(3, 'Lý do tố cáo cần ít nhất 3 ký tự.')
      .max(500, 'Lý do tố cáo không được vượt quá 500 ký tự.'),
  })
  .strict();

export const respondReviewSchema = z
  .object({
    content: z
      .string()
      .trim()
      .min(3, 'Nội dung phản hồi cần ít nhất 3 ký tự.')
      .max(1500, 'Nội dung phản hồi không được vượt quá 1500 ký tự.'),
    responderName: z.string().trim().max(100).optional(),
  })
  .strict();

export const updateReviewStatusSchema = z
  .object({
    status: z.enum(['published', 'hidden', 'flagged']),
    isFlagged: z.boolean().optional(),
  })
  .strict();

export const adminReviewQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  destinationId: z.string().optional(),
  status: z.enum(['all', 'published', 'hidden', 'flagged']).default('all'),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  q: z.string().trim().optional(),
});

