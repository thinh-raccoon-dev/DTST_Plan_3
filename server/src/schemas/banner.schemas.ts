import { z } from 'zod';
import { BANNER_KINDS, BANNER_PLACEMENTS, BANNER_THEMES } from '../models/Banner.js';
import { httpUrlSchema, paginationSchema } from './common.js';

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(''));

const imagePathSchema = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === '' || /^https?:\/\//i.test(v) || /^\/[a-zA-Z0-9/_.-]+$/.test(v), 'URL ảnh phải là http(s) hoặc đường dẫn tĩnh bắt đầu bằng /.')
  .optional();

// Link may be an external http(s) URL or an internal app path (never javascript:/data: etc.).
const linkSchema = z
  .union([httpUrlSchema, z.string().trim().regex(/^\/(?!\/)[a-zA-Z0-9/_?=&%.-]*$/, 'Đường dẫn nội bộ phải bắt đầu bằng /.'), z.literal('')])
  .optional();

// null / '' must be matched before coerce.date(): `new Date(null)` is the (valid) epoch.
const dateOrNull = z
  .union([z.null(), z.literal(''), z.coerce.date()])
  .optional()
  .transform((v) => (v === '' ? null : v));

const bannerFields = {
  placement: z.enum(BANNER_PLACEMENTS).default('home_top'),
  kind: z.enum(BANNER_KINDS).default('cover'),
  theme: z.enum(BANNER_THEMES).default('forest'),
  eyebrow: optionalText(60),
  title: z.string().trim().min(3, 'Tiêu đề cần ít nhất 3 ký tự.').max(120),
  subtitle: optionalText(300),
  imageUrl: imagePathSchema,
  imageAlt: optionalText(200),
  linkUrl: linkSchema,
  linkLabel: optionalText(40),
  sponsorName: optionalText(120),
  status: z.enum(['active', 'inactive']).default('inactive'),
  startAt: dateOrNull,
  endAt: dateOrNull,
  sortOrder: z.coerce.number().int().min(-1000).max(1000).default(0),
};

const refineDates = <T extends { startAt?: Date | null; endAt?: Date | null }>(v: T) =>
  !v.startAt || !v.endAt || v.startAt <= v.endAt;

const refineSponsor = <T extends { kind?: string; sponsorName?: string }>(v: T) => v.kind !== 'promo' || Boolean(v.sponsorName?.trim());

export const bannerInputSchema = z
  .object(bannerFields)
  .strict()
  .refine(refineDates, { message: 'Ngày kết thúc phải sau ngày bắt đầu.', path: ['endAt'] })
  .refine(refineSponsor, { message: 'Banner quảng cáo cần ghi rõ đơn vị tài trợ.', path: ['sponsorName'] });

export const bannerPatchSchema = z
  .object(bannerFields)
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Không có dữ liệu cần cập nhật.')
  .refine(refineDates, { message: 'Ngày kết thúc phải sau ngày bắt đầu.', path: ['endAt'] });

export const adminBannerQuerySchema = paginationSchema.extend({
  status: z.enum(['active', 'inactive']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const publicBannerQuerySchema = z.object({ placement: z.enum(BANNER_PLACEMENTS).default('home_top') });
