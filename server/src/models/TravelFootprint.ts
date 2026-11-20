import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

const trackPointSchema = new Schema(
  {
    lat: { type: Number, required: true, min: -90, max: 90 },
    lng: { type: Number, required: true, min: -180, max: 180 },
    timestamp: { type: Number, required: true },
    speedKmh: { type: Number },
  },
  { _id: false },
);

const memoryPinSchema = new Schema(
  {
    clientId: { type: String, required: true, trim: true, maxlength: 100 },
    lat: { type: Number, required: true, min: -90, max: 90 },
    lng: { type: Number, required: true, min: -180, max: 180 },
    emoji: { type: String, required: true, trim: true, maxlength: 16, default: '🦊' },
    moodLabel: { type: String, required: true, trim: true, maxlength: 60, default: 'Kỷ niệm đáng nhớ' },
    note: { type: String, trim: true, maxlength: 400, default: '' },
    placeName: { type: String, trim: true, maxlength: 160 },
    createdAt: { type: Number, required: true },
  },
  { _id: false },
);

const travelFootprintSchema = new Schema(
  {
    clientId: { type: String, required: true, trim: true, maxlength: 100 },
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    anonymousSessionId: { type: String, trim: true, maxlength: 120, index: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    color: { type: String, trim: true, maxlength: 30, default: '#10b981' },
    distanceKm: { type: Number, min: 0, default: 0 },
    durationSeconds: { type: Number, min: 0, default: 0 },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date, required: true },
    points: { type: [trackPointSchema], default: [] },
    memories: { type: [memoryPinSchema], default: [] },
    isDemoRoute: { type: Boolean, default: false },
  },
  { timestamps: true },
);

travelFootprintSchema.index({ clientId: 1, userId: 1 });
travelFootprintSchema.index({ clientId: 1, anonymousSessionId: 1 });

export type TravelFootprint = InferSchemaType<typeof travelFootprintSchema>;
export type TravelFootprintDocument = HydratedDocument<TravelFootprint>;
export const TravelFootprintModel = model('TravelFootprint', travelFootprintSchema, 'travel_footprints');
