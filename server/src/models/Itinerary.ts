import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { AREAS, INTERESTS } from '../config/catalog.js';

const itemSchema = new Schema(
  {
    destinationId: { type: Schema.Types.ObjectId, ref: 'Destination', required: true },
    // Snapshots keep an old itinerary readable when a destination is later hidden or deleted.
    nameSnapshot: { type: String, required: true },
    slugSnapshot: { type: String, required: true },
    durationMinutes: { type: Number, required: true, min: 0 },
    durationIsEstimate: { type: Boolean, required: true },
    note: { type: String, trim: true, maxlength: 300 },
  },
  { _id: false },
);

const daySchema = new Schema(
  {
    dayNumber: { type: Number, required: true, min: 1 },
    items: { type: [itemSchema], default: [] },
  },
  { _id: false },
);

const replanEventSchema = new Schema(
  {
    eventId: { type: String, required: true, trim: true, maxlength: 120 },
    stopId: { type: String, required: true, trim: true, maxlength: 120 },
    event: { type: String, enum: ['arrived', 'departed'], required: true },
    occurredAt: { type: String, required: true },
    itineraryVersion: { type: Number, required: true, min: 1 },
    response: { type: Schema.Types.Mixed, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const itinerarySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    preferences: {
      areas: { type: [{ type: String, enum: AREAS }], default: [] },
      interests: { type: [{ type: String, enum: INTERESTS }], default: [] },
      hoursPerDay: { type: Number, min: 1, max: 14 },
    },
    numberOfDays: { type: Number, required: true, min: 1, max: 7 },
    days: { type: [daySchema], default: [] },
    estimatedDurationMinutes: { type: Number, required: true, min: 0 },
    // Trip Planner V9 fields
    plannerVersion: { type: String, enum: ['legacy', 'v9'], default: 'legacy' },
    itineraryVersion: { type: Number, default: 1, min: 1 },
    v9Itinerary: { type: Schema.Types.Mixed, default: null },
    v9Meta: { type: Schema.Types.Mixed, default: null },
    replanHistory: { type: [replanEventSchema], default: [] },
  },
  { timestamps: true },
);

itinerarySchema.index({ userId: 1, updatedAt: -1 });

export type Itinerary = InferSchemaType<typeof itinerarySchema>;
export type ItineraryDocument = HydratedDocument<Itinerary>;
export const ItineraryModel = model('Itinerary', itinerarySchema, 'itineraries');
