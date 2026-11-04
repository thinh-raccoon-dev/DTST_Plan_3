import { Schema, model, type InferSchemaType } from 'mongoose';

export const BADGE_CRITERIA_TYPES = [
  'checkin_count',
  'challenge_count',
  'heritage_challenge_count',
  'points_threshold',
  'itinerary_created',
] as const;
export type BadgeCriteriaType = (typeof BADGE_CRITERIA_TYPES)[number];

export const BADGE_ICONS = [
  'footprints',
  'compass',
  'lightbulb',
  'trophy',
  'landmark',
  'star',
  'medal',
  'award',
  'heart',
  'sparkles',
] as const;
export type BadgeIcon = (typeof BADGE_ICONS)[number];

const badgeSchema = new Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: /^[a-z0-9-]{3,60}$/,
    },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, required: true, trim: true, maxlength: 300 },
    icon: {
      type: String,
      enum: BADGE_ICONS,
      default: 'trophy',
      required: true,
    },
    criteriaType: {
      type: String,
      enum: BADGE_CRITERIA_TYPES,
      required: true,
      default: 'checkin_count',
    },
    targetCount: { type: Number, required: true, min: 1, default: 1 },
    rewardPoints: { type: Number, required: true, min: 0, default: 0 },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      required: true,
    },
  },
  { timestamps: true },
);

badgeSchema.index({ status: 1 });

export type Badge = InferSchemaType<typeof badgeSchema>;
export const BadgeModel = model('Badge', badgeSchema, 'badges');
