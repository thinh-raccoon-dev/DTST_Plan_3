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

// ---- Trip Planner V9 Schemas ----

export const v9PlanRequestSchema = z
  .object({
    mode: z.enum(['ai', 'manual']).default('ai'),
    goal: z.enum(['sightseeing', 'food', 'relaxation', 'nightlife', 'stay']).default('sightseeing'),
    start_id: z.string().trim().min(1).max(32).optional(),
    end_id: z.string().trim().min(1).max(32).optional(),
    selected_ids: z.array(z.string().trim().min(1).max(32)).max(17).optional(),
    excluded_ids: z.array(z.string().trim().min(1).max(32)).max(17).optional(),
    hotel_id: z.string().trim().min(1).max(32).optional(),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày bắt đầu phải có định dạng YYYY-MM-DD.'),
    days: z.number().int().min(1, 'Tối thiểu 1 ngày.').max(7, 'Tối đa 7 ngày.').default(2),
    people: z.number().int().min(1, 'Tối thiểu 1 khách.').max(100, 'Tối đa 100 khách.').default(2),
    budget_vnd: z.number().int().min(1, 'Ngân sách phải lớn hơn 0.').max(1_000_000_000_000).default(2_000_000),
    interests: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
    mode_of_transport: z.enum(['car', 'motorcycle']).default('car'),
    nearby_max_minutes: z.number().min(1).max(240).default(30),
    primary_limit: z.number().int().min(1).max(10).optional(),
    use_model: z.boolean().default(true),
    daily_start: z.string().regex(/^\d{2}:\d{2}$/, 'Giờ bắt đầu phải có định dạng HH:MM.').default('08:00'),
    daily_end: z.string().regex(/^\d{2}:\d{2}$/, 'Giờ kết thúc phải có định dạng HH:MM.').default('20:00'),
    pace: z.enum(['relaxed', 'balanced', 'busy']).default('balanced'),
    travel_buffer_minutes: z.number().int().min(0).max(60).default(5),
    sleep_minutes: z.number().int().min(480).max(600).default(540),
    include_breakfast: z.boolean().default(true),
    meal_duration_minutes: z.number().int().min(15).max(180).default(60),
    allow_unknown_hours: z.boolean().default(true),
    assemble_itinerary: z.boolean().optional(),
    visit_duration_overrides: z.record(z.string(), z.number().int().min(1).max(1440)).optional(),
    transport_cost: z
      .object({
        vnd_per_km: z.number().min(0).optional(),
        fixed_trip_vnd: z.number().min(0).optional(),
      })
      .strict()
      .optional(),
    budget_shares: z
      .object({
        food: z.number().min(0).max(1),
        stay: z.number().min(0).max(1),
        transport: z.number().min(0).max(1),
        activities: z.number().min(0).max(1),
        reserve: z.number().min(0).max(1),
      })
      .strict()
      .optional(),
  })
  .strict();
export type V9PlanRequestInput = z.infer<typeof v9PlanRequestSchema>;

export const saveV9ItinerarySchema = z
  .object({
    title: z.string().trim().min(2, 'Tên lịch trình cần ít nhất 2 ký tự.').max(120),
    v9Itinerary: z.record(z.string(), z.unknown()),
    v9Meta: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
export type SaveV9ItineraryInput = z.infer<typeof saveV9ItinerarySchema>;

export const replanItinerarySchema = z
  .object({
    itinerary_version: z.number().int().min(1, 'Phiên bản lịch trình không hợp lệ.'),
    event_id: z.string().trim().min(1, 'Thiếu mã sự kiện event_id.').max(120),
    stop_id: z.string().trim().min(1, 'Thiếu mã lượt ghé stop_id.').max(120),
    event: z.enum(['arrived', 'departed']),
    occurred_at: z.string().trim().min(10, 'Thiếu thời gian sự kiện occurred_at.').max(64),
  })
  .strict();
export type ReplanItineraryInput = z.infer<typeof replanItinerarySchema>;
