import { z } from 'zod';
import { QR_TARGET_TYPES } from '../models/QrCode.js';
import { objectIdSchema, paginationSchema } from './common.js';

export const qrCodeParamSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{4,32}$/, 'Mã QR không hợp lệ.'),
});

export const qrInputSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9-]{4,32}$/, 'Mã chỉ gồm chữ in hoa, số và dấu gạch ngang (4–32 ký tự).')
      .optional()
      .or(z.literal('')),
    label: z.string().trim().min(2, 'Nhãn cần ít nhất 2 ký tự.').max(120),
    targetType: z.enum(QR_TARGET_TYPES),
    targetId: objectIdSchema,
    status: z.enum(['active', 'inactive']).default('active'),
    notes: z.string().trim().max(500).optional(),
  })
  .strict();

// The code itself is immutable once printed; everything else can change.
export const qrPatchSchema = qrInputSchema
  .omit({ code: true })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Không có dữ liệu cần cập nhật.')
  .refine((value) => (value.targetType === undefined) === (value.targetId === undefined), {
    message: 'Cần gửi cả loại đích và mã đích khi đổi nội dung đích.',
    path: ['targetId'],
  });

export const adminQrQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(60).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const qrImageQuerySchema = z.object({
  format: z.enum(['png', 'svg']).default('png'),
  download: z.enum(['0', '1']).default('0'),
});

export const checkInBodySchema = z
  .object({
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
  })
  .strict()
  .refine((value) => (value.lat === undefined) === (value.lng === undefined), {
    message: 'Cần gửi cả vĩ độ và kinh độ.',
    path: ['lat'],
  });
