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
