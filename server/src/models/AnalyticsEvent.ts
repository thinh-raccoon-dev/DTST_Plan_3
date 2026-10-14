import { Schema, model, type InferSchemaType } from 'mongoose';

export const EVENT_TYPES = [
  'destination_page_view',
  'qr_landing_view',
  'destination_check_in',
  'challenge_started',
  'challenge_completed',
  'itinerary_generated',
  'itinerary_saved',
  'passport_badge_awarded',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

/** Written only by the server. No IP address or user agent is stored. */
const analyticsEventSchema = new Schema({
  eventType: { type: String, enum: EVENT_TYPES, required: true },
  destinationId: { type: Schema.Types.ObjectId, ref: 'Destination' },
  qrCodeId: { type: Schema.Types.ObjectId, ref: 'QrCode' },
  qrCode: { type: String },
  challengeId: { type: Schema.Types.ObjectId, ref: 'Challenge' },
  itineraryId: { type: Schema.Types.ObjectId, ref: 'Itinerary' },
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  anonymousSessionId: { type: String },
  timestamp: { type: Date, required: true, default: () => new Date() },
  metadata: {
    correctCount: Number,
    totalQuestions: Number,
    passed: Boolean,
    badgeKey: String,
    numberOfDays: Number,
    itemCount: Number,
  },
});

analyticsEventSchema.index({ timestamp: -1 });
analyticsEventSchema.index({ eventType: 1, timestamp: -1 });
analyticsEventSchema.index({ destinationId: 1, eventType: 1, timestamp: -1 });
analyticsEventSchema.index({ qrCodeId: 1, eventType: 1, timestamp: -1 });
analyticsEventSchema.index({ challengeId: 1, eventType: 1, timestamp: -1 });
analyticsEventSchema.index({ anonymousSessionId: 1, eventType: 1, timestamp: -1 });
analyticsEventSchema.index({ userId: 1, eventType: 1, timestamp: -1 });

export type AnalyticsEvent = InferSchemaType<typeof analyticsEventSchema>;
export const AnalyticsEventModel = model('AnalyticsEvent', analyticsEventSchema, 'analyticsEvents');
