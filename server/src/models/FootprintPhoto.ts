import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

const footprintPhotoSchema = new Schema(
  {
    /** Client/App-generated idempotency ID so offline mobile uploads never duplicate on retry. */
    clientPhotoId: { type: String, trim: true, maxlength: 120 },
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    anonymousSessionId: { type: String, trim: true, maxlength: 120, index: true },

    imageUrl: { type: String, required: true, trim: true, maxlength: 600 },
    thumbnailUrl: { type: String, trim: true, maxlength: 600 },

    coordinates: {
      lat: { type: Number, required: true, min: -90, max: 90 },
      lng: { type: Number, required: true, min: -180, max: 180 },
    },
    /** GeoJSON Point ([lng, lat]) for fast geospatial viewport / nearby queries across web & mobile app. */
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        required: true,
      },
    },
    accuracyMeters: { type: Number, min: 0 },
    altitudeMeters: { type: Number },
    headingDegrees: { type: Number, min: 0, max: 360 },

    /** Exact timestamp when the photograph was captured (from EXIF or device camera clock). */
    takenAt: { type: Date, required: true, index: true },

    placeName: { type: String, trim: true, maxlength: 160, default: '' },
    area: { type: String, trim: true, maxlength: 80, default: '' },
    destinationId: { type: Schema.Types.ObjectId, ref: 'Destination', index: true },
    destinationSlug: { type: String, trim: true, maxlength: 160 },
    trackClientId: { type: String, trim: true, maxlength: 100 },

    caption: { type: String, trim: true, maxlength: 500, default: '' },
    moodEmoji: { type: String, trim: true, maxlength: 16 },

    /** Origin platform sharing the same data store (Web SPA + Companion Mobile App). */
    sourceApp: {
      type: String,
      enum: ['web', 'ios', 'android', 'flutter', 'import'],
      default: 'web',
    },
    deviceModel: { type: String, trim: true, maxlength: 120 },
    exifSource: {
      type: String,
      enum: ['exif', 'gps', 'manual'],
      default: 'gps',
    },

    width: { type: Number, min: 1 },
    height: { type: Number, min: 1 },
    fileSize: { type: Number, min: 0 },
    mimeType: { type: String, trim: true, maxlength: 64 },

    visibility: {
      type: String,
      enum: ['private', 'public'],
      default: 'private',
    },
  },
  { timestamps: true },
);

footprintPhotoSchema.index({ userId: 1, takenAt: -1 });
footprintPhotoSchema.index({ anonymousSessionId: 1, takenAt: -1 });
footprintPhotoSchema.index({ userId: 1, clientPhotoId: 1 }, { sparse: true });
footprintPhotoSchema.index({ anonymousSessionId: 1, clientPhotoId: 1 }, { sparse: true });
footprintPhotoSchema.index({ location: '2dsphere' });
footprintPhotoSchema.index({ destinationId: 1, takenAt: -1 });

export type FootprintPhoto = InferSchemaType<typeof footprintPhotoSchema>;
export type FootprintPhotoDocument = HydratedDocument<FootprintPhoto>;
export const FootprintPhotoModel = model('FootprintPhoto', footprintPhotoSchema, 'footprint_photos');
