import { z } from 'zod';
import { AREAS, INTERESTS } from '../config/catalog.js';
import { objectIdSchema } from './common.js';

export const preferencesSchema = z
  .object({
    numberOfDays: z.number().int().min(1, 'Tối thiểu 1 ngày.').max(7, 'Tối đa 7 ngày.'),
    hoursPerDay: z.number().min(2, 'Tối thiểu 2 giờ mỗi ngày.').max(12, 'Tối đa 12 giờ mỗi ngày.'),
    areas: z.array(z.enum(AREAS)).max(AREAS.length).default([]),
    interests: z.array(z.enum(INTERESTS)).max(INTERESTS.length).default([]),
    priorityDestinationIds: z.array(objectIdSchema).max(10).default([]),
    excludeDestinationIds: z.array(objectIdSchema).max(30).default([]),
    scenario: z.enum(['balanced', 'indoor', 'compact']).optional(),
  })
  .strict();
export type PreferencesInput = z.infer<typeof preferencesSchema>;

const itemSchema = z
  .object({
    destinationId: objectIdSchema,
    note: z.string().trim().max(300).optional(),
  })
  .strict();

export const saveItinerarySchema = z
  .object({
    title: z.string().trim().min(2, 'Tên lịch trình cần ít nhất 2 ký tự.').max(120),
    preferences: preferencesSchema
      .omit({ priorityDestinationIds: true, numberOfDays: true, excludeDestinationIds: true, scenario: true })
      .partial()
      .default({}),
    days: z
      .array(z.object({ items: z.array(itemSchema).max(15) }).strict())
      .min(1)
      .max(7),
  })
  .strict()
  .refine((value) => value.days.some((day) => day.items.length > 0), {
    message: 'Lịch trình cần ít nhất một địa điểm.',
    path: ['days'],
  });
export type SaveItineraryInput = z.infer<typeof saveItinerarySchema>;
