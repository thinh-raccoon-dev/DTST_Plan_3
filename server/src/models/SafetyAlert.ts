import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

export const SAFETY_ALERT_TYPES = ['accident', 'landslide', 'flood', 'storm', 'road_closed'] as const;
export type SafetyAlertType = (typeof SAFETY_ALERT_TYPES)[number];

export const SAFETY_SEVERITIES = ['advisory', 'warning', 'critical'] as const;
export type SafetySeverity = (typeof SAFETY_SEVERITIES)[number];

export const TERRAIN_IMPACTS = ['mountain', 'coastal_river', 'road_corridor', 'outdoor', 'all'] as const;
export type TerrainImpact = (typeof TERRAIN_IMPACTS)[number];

const safetyAlertSchema = new Schema(
  {
    type: { type: String, enum: SAFETY_ALERT_TYPES, required: true },
    severity: { type: String, enum: SAFETY_SEVERITIES, default: 'warning', required: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, required: true, trim: true, maxlength: 800 },
    areaLabel: { type: String, trim: true, maxlength: 120, default: 'Đồng Tháp & ĐBSCL' },
    coordinates: {
      type: new Schema(
        {
          lat: { type: Number, min: -90, max: 90, required: true },
          lng: { type: Number, min: -180, max: 180, required: true },
        },
        { _id: false },
      ),
      required: true,
    },
    radiusKm: { type: Number, min: 0.5, max: 150, default: 8 },
    terrainImpact: { type: String, enum: TERRAIN_IMPACTS, default: 'outdoor' },
    source: {
      type: String,
      enum: ['admin', 'partner', 'weather_engine', 'demo_simulation'],
      default: 'admin',
    },
    destinationId: { type: Schema.Types.ObjectId, ref: 'Destination', index: true },
    isActive: { type: Boolean, default: true },
    expiresAt: { type: Date, default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

safetyAlertSchema.index({ isActive: 1, expiresAt: 1 });

export type SafetyAlert = InferSchemaType<typeof safetyAlertSchema>;
export type SafetyAlertDocument = HydratedDocument<SafetyAlert>;
export const SafetyAlertModel = model('SafetyAlert', safetyAlertSchema, 'safety_alerts');
