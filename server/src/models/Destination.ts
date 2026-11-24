import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import {
  CATEGORIES,
  OPERATIONAL_STATUSES,
  PUBLICATION_STATUSES,
  VERIFICATION_LEVELS,
} from '../config/catalog.js';
import { normalizeText } from '../utils/text.js';

const imageSchema = new Schema(
  {
    url: { type: String, required: true, trim: true },
    alt: { type: String, trim: true, maxlength: 200, default: '' },
    credit: { type: String, trim: true, maxlength: 200 },
    license: { type: String, trim: true, maxlength: 120 },
    sourceUrl: { type: String, trim: true },
  },
  { _id: false },
);

export const SERVICE_CATEGORIES = ['ticket', 'combo', 'activity', 'food', 'guide', 'other'] as const;
export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

const serviceItemSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    category: { type: String, enum: SERVICE_CATEGORIES, default: 'ticket', required: true },
    priceVnd: { type: Number, required: true, min: 0, max: 50_000_000 },
    unit: { type: String, trim: true, maxlength: 40, default: 'người' },
    durationMinutes: { type: Number, min: 5, max: 1440 },
    description: { type: String, trim: true, maxlength: 300, default: '' },
    includesVat: { type: Boolean, default: true },
    isAvailable: { type: Boolean, default: true },
  },
  { _id: true },
);

const verificationLevel = { type: String, enum: VERIFICATION_LEVELS, default: 'unknown' };

const destinationSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    },
    summary: { type: String, trim: true, maxlength: 300, default: '' },
    description: { type: String, required: true, trim: true, maxlength: 8000 },
    category: { type: String, enum: CATEGORIES, required: true },
    tags: { type: [String], default: [] },
    area: { type: String, required: true, trim: true, maxlength: 100 },
    address: { type: String, trim: true, maxlength: 300 },
    coordinates: {
      type: new Schema(
        {
          lat: { type: Number, min: -90, max: 90, required: true },
          lng: { type: Number, min: -180, max: 180, required: true },
        },
        { _id: false },
      ),
      default: undefined,
    },
    images: { type: [imageSchema], default: [] },
    // Free text on purpose: "unknown" must never be stored as 0 or a guessed schedule.
    openingHours: { type: String, trim: true, maxlength: 300 },
    referencePrice: { type: String, trim: true, maxlength: 300 },
    // Structured public price list & combo catalog (Luật Giá 2023 & Luật Du lịch 2017)
    services: { type: [serviceItemSchema], default: [] },
    contactInfo: {
      type: new Schema(
        {
          phone: { type: String, trim: true, maxlength: 40 },
          website: { type: String, trim: true, maxlength: 300 },
          email: { type: String, trim: true, maxlength: 254 },
        },
        { _id: false },
      ),
      default: undefined,
    },
    estimatedVisitDuration: {
      type: new Schema(
        {
          minutes: { type: Number, min: 15, max: 720, required: true },
          isEstimate: { type: Boolean, default: true },
          note: { type: String, trim: true, maxlength: 200 },
        },
        { _id: false },
      ),
      default: undefined,
    },
    sourceUrls: { type: [String], default: [] },
    verification: {
      location: verificationLevel,
      openingHours: verificationLevel,
      referencePrice: verificationLevel,
      contactInfo: verificationLevel,
    },
    verificationStatus: {
      type: String,
      enum: ['verified', 'partially_verified', 'unverified'],
      default: 'unverified',
    },
    isIllustrative: { type: Boolean, default: false },
    lastVerifiedAt: { type: Date },
    publicationStatus: { type: String, enum: PUBLICATION_STATUSES, default: 'draft', required: true },
    reviewNote: { type: String, trim: true, maxlength: 500 },
    partnerNotice: { type: String, trim: true, maxlength: 500 },
    partnerNoticeUpdatedAt: { type: Date },
    operationalStatus: { type: String, enum: OPERATIONAL_STATUSES, default: 'active', required: true },
    managedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    searchText: { type: String, select: false },
  },
  { timestamps: true },
);

destinationSchema.index({ publicationStatus: 1, category: 1, area: 1 });
destinationSchema.index({ updatedAt: -1 });
destinationSchema.index({ managedBy: 1 });

destinationSchema.pre('save', function updateSearchText(next) {
  this.searchText = normalizeText([this.name, this.summary, this.address, ...(this.tags ?? [])].join(' '));
  next();
});

export type Destination = InferSchemaType<typeof destinationSchema>;
export type DestinationDocument = HydratedDocument<Destination>;
export const DestinationModel = model('Destination', destinationSchema, 'destinations');
