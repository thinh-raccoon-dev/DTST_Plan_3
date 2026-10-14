import { z } from 'zod';
import {
  AREAS,
  CATEGORIES,
  OPERATIONAL_STATUSES,
  PUBLICATION_STATUSES,
  VERIFICATION_LEVELS,
} from '../config/catalog.js';
import { csvList, httpUrlSchema, nullableText, paginationSchema } from './common.js';

export const publicDestinationQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(100).optional(),
  category: csvList(z.enum(CATEGORIES)),
  area: csvList(z.enum(AREAS)),
  hasActivity: z.enum(['true', 'false']).optional(),
  sort: z.enum(['name', 'recent']).default('name'),
});

export const adminDestinationQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(100).optional(),
  category: z.enum(CATEGORIES).optional(),
  publicationStatus: z.enum(PUBLICATION_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const imagePathSchema = z
  .string()
  .trim()
  .max(500)
  .refine(
    (value) => /^https?:\/\//i.test(value) || /^\/[a-zA-Z0-9/_.-]+$/.test(value),
    'URL ảnh phải là http(s) hoặc đường dẫn tĩnh bắt đầu bằng /.',
  );

const imageSchema = z
  .object({
    url: imagePathSchema,
    alt: z.string().trim().max(200).default(''),
    credit: z.string().trim().max(200).optional(),
    license: z.string().trim().max(120).optional(),
    sourceUrl: z.union([httpUrlSchema, z.literal('')]).optional(),
  })
  .strict();

// Vietnam bounding box: rejects swapped lat/lng and obviously wrong points.
const coordinatesSchema = z
  .object({
    lat: z.number().min(8, 'Vĩ độ nằm ngoài phạm vi Việt Nam.').max(24, 'Vĩ độ nằm ngoài phạm vi Việt Nam.'),
    lng: z.number().min(102, 'Kinh độ nằm ngoài phạm vi Việt Nam.').max(110, 'Kinh độ nằm ngoài phạm vi Việt Nam.'),
  })
  .strict();

const contactSchema = z
  .object({
    phone: z
      .string()
      .trim()
      .regex(/^[0-9+ ().-]{6,20}$/, 'Số điện thoại không hợp lệ.')
      .optional()
      .or(z.literal('')),
    website: z.union([httpUrlSchema, z.literal('')]).optional(),
    email: z.union([z.string().trim().email('Email không hợp lệ.'), z.literal('')]).optional(),
  })
  .strict();

const verificationSchema = z
  .object({
    location: z.enum(VERIFICATION_LEVELS),
    openingHours: z.enum(VERIFICATION_LEVELS),
    referencePrice: z.enum(VERIFICATION_LEVELS),
    contactInfo: z.enum(VERIFICATION_LEVELS),
  })
  .strict();

const destinationFields = {
  name: z.string().trim().min(2, 'Tên cần ít nhất 2 ký tự.').max(160),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug chỉ gồm chữ thường không dấu, số và dấu gạch ngang.')
    .max(80)
    .optional()
    .or(z.literal('')),
  summary: z.string().trim().max(300).default(''),
  description: z.string().trim().min(20, 'Mô tả cần ít nhất 20 ký tự.').max(8000),
  category: z.enum(CATEGORIES),
  tags: z.array(z.string().trim().min(1).max(40)).max(15).default([]),
  area: z.enum(AREAS),
  address: nullableText(300),
  coordinates: coordinatesSchema.nullable().optional(),
  images: z.array(imageSchema).max(10).default([]),
  openingHours: nullableText(300),
  referencePrice: nullableText(300),
  contactInfo: contactSchema.nullable().optional(),
  estimatedVisitDuration: z
    .object({
      minutes: z.number().int().min(15).max(720),
      isEstimate: z.boolean(),
      note: z.string().trim().max(200).optional(),
    })
    .strict()
    .nullable()
    .optional(),
  sourceUrls: z.array(httpUrlSchema).max(10).default([]),
  verification: verificationSchema.default({
    location: 'unknown',
    openingHours: 'unknown',
    referencePrice: 'unknown',
    contactInfo: 'unknown',
  }),
  isIllustrative: z.boolean().default(false),
  lastVerifiedAt: z.union([z.coerce.date(), z.null()]).optional(),
  publicationStatus: z.enum(PUBLICATION_STATUSES).default('draft'),
  operationalStatus: z.enum(OPERATIONAL_STATUSES).default('active'),
  managedByEmail: z.union([z.string().trim().toLowerCase().email('Email đối tác không hợp lệ.'), z.literal('')]).optional(),
};

export const destinationInputSchema = z.object(destinationFields).strict();
export type DestinationInput = z.infer<typeof destinationInputSchema>;

export const destinationPatchSchema = z
  .object(destinationFields)
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Không có dữ liệu cần cập nhật.');
export type DestinationPatch = z.infer<typeof destinationPatchSchema>;
