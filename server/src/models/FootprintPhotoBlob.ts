import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

/**
 * Dedicated binary storage for uploaded Footprint Photos in MongoDB.
 * Kept separate from FootprintPhoto metadata so map/list queries stay lightweight (~500B/doc),
 * while guaranteeing photos NEVER break on ephemeral cloud containers (Render/Railway/Docker redeploys)
 * or cross-domain Vercel deployments.
 */
const footprintPhotoBlobSchema = new Schema(
  {
    /** Cryptographically random 32-hex + extension key (e.g. "9edffd5d...624.jpg") for unguessable media URLs. */
    mediaKey: { type: String, required: true, unique: true, trim: true, maxlength: 80 },
    photoId: { type: Schema.Types.ObjectId, ref: 'FootprintPhoto', required: true, index: true },
    contentType: { type: String, required: true, trim: true, maxlength: 64 },
    size: { type: Number, required: true, min: 1 },
    data: { type: Buffer, required: true },
  },
  { timestamps: true },
);

export type FootprintPhotoBlob = InferSchemaType<typeof footprintPhotoBlobSchema>;
export type FootprintPhotoBlobDocument = HydratedDocument<FootprintPhotoBlob>;
export const FootprintPhotoBlobModel = model(
  'FootprintPhotoBlob',
  footprintPhotoBlobSchema,
  'footprint_photo_blobs',
);
