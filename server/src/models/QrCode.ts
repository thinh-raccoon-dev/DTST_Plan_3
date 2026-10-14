import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

export const QR_TARGET_TYPES = ['destination', 'challenge'] as const;
export type QrTargetType = (typeof QR_TARGET_TYPES)[number];

const qrCodeSchema = new Schema(
  {
    // Public, stable identifier printed in the QR URL. Never derived from internal ids.
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, match: /^[A-Z0-9-]{4,32}$/ },
    label: { type: String, required: true, trim: true, maxlength: 120 },
    targetType: { type: String, enum: QR_TARGET_TYPES, required: true },
    targetId: { type: Schema.Types.ObjectId, required: true, index: true },
    status: { type: String, enum: ['active', 'inactive'], default: 'active', required: true },
    notes: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true },
);

export type QrCode = InferSchemaType<typeof qrCodeSchema>;
export type QrCodeDocument = HydratedDocument<QrCode>;
export const QrCodeModel = model('QrCode', qrCodeSchema, 'qrCodes');
