import { isValidObjectId } from 'mongoose';
import { z } from 'zod';

export const objectIdSchema = z
  .string()
  .refine((value) => isValidObjectId(value) && /^[a-f0-9]{24}$/i.test(value), 'Mã định danh không hợp lệ.');

export const idParamsSchema = z.object({ id: objectIdSchema });

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

export const httpUrlSchema = z
  .string()
  .trim()
  .max(500)
  .url('URL không hợp lệ.')
  .refine((value) => /^https?:\/\//i.test(value), 'Chỉ chấp nhận URL bắt đầu bằng http:// hoặc https://');

/** Accepts "a,b" or repeated query params and returns a deduplicated list. */
export function csvList<T extends z.ZodTypeAny>(item: T) {
  return z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((value) => {
      if (value === undefined) return [];
      const parts = (Array.isArray(value) ? value : value.split(',')).map((part) => part.trim()).filter(Boolean);
      return [...new Set(parts)];
    })
    .pipe(z.array(item).max(20));
}

/** Optional text where "" or null means "no data" (stored as absent, never as a fake default). */
export function nullableText(max: number) {
  return z
    .union([z.string().trim().max(max), z.null()])
    .optional()
    .transform((value) => (value === '' ? null : value));
}

export function paginate<T>(items: T[], total: number, page: number, limit: number) {
  return { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}
