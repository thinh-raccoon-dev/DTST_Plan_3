import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

export const BANNER_KINDS = ['cover', 'event', 'promo'] as const;
export type BannerKind = (typeof BANNER_KINDS)[number];

export const BANNER_THEMES = ['forest', 'lotus', 'cream'] as const;
export type BannerTheme = (typeof BANNER_THEMES)[number];

export const BANNER_PLACEMENTS = ['home_top'] as const;
export type BannerPlacement = (typeof BANNER_PLACEMENTS)[number];

const bannerSchema = new Schema(
  {
    placement: { type: String, enum: BANNER_PLACEMENTS, default: 'home_top', required: true },
    kind: { type: String, enum: BANNER_KINDS, default: 'cover', required: true },
    theme: { type: String, enum: BANNER_THEMES, default: 'forest', required: true },
    eyebrow: { type: String, trim: true, maxlength: 60 },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    subtitle: { type: String, trim: true, maxlength: 300 },
    imageUrl: { type: String, trim: true, maxlength: 500 },
    imageAlt: { type: String, trim: true, maxlength: 200 },
    linkUrl: { type: String, trim: true, maxlength: 500 },
    linkLabel: { type: String, trim: true, maxlength: 40 },
    // Advertising transparency: promo banners always show "Quảng cáo" plus the sponsor when provided.
    sponsorName: { type: String, trim: true, maxlength: 120 },
    status: { type: String, enum: ['active', 'inactive'], default: 'inactive', required: true },
    startAt: { type: Date },
    endAt: { type: Date },
    sortOrder: { type: Number, default: 0 },
    impressions: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
  },
  { timestamps: true },
);

bannerSchema.index({ placement: 1, status: 1, sortOrder: 1 });

export type Banner = InferSchemaType<typeof bannerSchema>;
export type BannerDocument = HydratedDocument<Banner>;
export const BannerModel = model('Banner', bannerSchema, 'banners');
