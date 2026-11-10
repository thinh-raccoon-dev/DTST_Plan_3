import { z } from 'zod';
import { BADGE_CRITERIA_TYPES, BADGE_ICONS } from '../models/Badge.js';
import { objectIdSchema } from './common.js';

export const createBadgeSchema = z.object({
  key: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{3,60}$/, 'Mã huy hiệu chỉ gồm chữ thường không dấu, số và dấu gạch nối (-), từ 3-60 ký tự'),
  name: z.string().trim().min(2, 'Tên huy hiệu cần ít nhất 2 ký tự').max(100),
  description: z.string().trim().min(5, 'Mô tả cần ít nhất 5 ký tự').max(300),
  icon: z.enum(BADGE_ICONS, { errorMap: () => ({ message: 'Biểu tượng không hợp lệ' }) }),
  criteriaType: z.enum(BADGE_CRITERIA_TYPES, { errorMap: () => ({ message: 'Loại điều kiện không hợp lệ' }) }),
  targetCount: z.coerce.number().int().min(1, 'Chỉ tiêu cần ít nhất là 1'),
  rewardPoints: z.coerce.number().int().min(0, 'Điểm thưởng không được âm').max(200, 'Điểm thưởng tối đa là 200').default(0),
  status: z.enum(['active', 'inactive']).default('active'),
  destinationId: objectIdSchema.optional(),
});

export const updateBadgeSchema = createBadgeSchema
  .partial()
  .omit({ key: true });

export type CreateBadgeInput = z.infer<typeof createBadgeSchema>;
export type UpdateBadgeInput = z.infer<typeof updateBadgeSchema>;
