import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

export const VOUCHER_STATUSES = ['active', 'paused'] as const;
export type VoucherStatus = (typeof VOUCHER_STATUSES)[number];

const partnerVoucherSchema = new Schema(
  {
    destinationId: { type: Schema.Types.ObjectId, ref: 'Destination', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    discountLabel: { type: String, required: true, trim: true, maxlength: 80 }, // e.g. "Giảm 20% vé xuồng"
    // Mandatory consumer-protection terms (Luật BVQLNTD 2023 & NĐ 81/2018/NĐ-CP)
    terms: { type: String, required: true, trim: true, maxlength: 800 },
    pointsCost: { type: Number, required: true, min: 0, max: 5000, default: 50 },
    totalQuantity: { type: Number, required: true, min: 1, max: 50000, default: 100 },
    claimedCount: { type: Number, required: true, min: 0, default: 0 },
    redeemedCount: { type: Number, required: true, min: 0, default: 0 },
    maxPerUser: { type: Number, required: true, min: 1, max: 5, default: 1 },
    validFrom: { type: Date, required: true, default: () => new Date() },
    validUntil: { type: Date, required: true },
    status: { type: String, enum: VOUCHER_STATUSES, default: 'active', required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

partnerVoucherSchema.index({ destinationId: 1, status: 1, validUntil: 1 });

export type PartnerVoucher = InferSchemaType<typeof partnerVoucherSchema>;
export type PartnerVoucherDocument = HydratedDocument<PartnerVoucher>;
export const PartnerVoucherModel = model('PartnerVoucher', partnerVoucherSchema, 'partnerVouchers');
