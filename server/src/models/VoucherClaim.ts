import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

export const VOUCHER_CLAIM_STATUSES = ['issued', 'redeemed', 'expired'] as const;
export type VoucherClaimStatus = (typeof VOUCHER_CLAIM_STATUSES)[number];

const voucherClaimSchema = new Schema(
  {
    voucherId: { type: Schema.Types.ObjectId, ref: 'PartnerVoucher', required: true, index: true },
    destinationId: { type: Schema.Types.ObjectId, ref: 'Destination', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    claimCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      match: /^VCH-[A-Z0-9]{4}-[A-Z0-9]{4}$/,
    },
    // Legal snapshot of the offer promised to the tourist at claim time
    voucherTitle: { type: String, required: true, trim: true, maxlength: 140 },
    discountLabel: { type: String, required: true, trim: true, maxlength: 80 },
    terms: { type: String, required: true, trim: true, maxlength: 800 },
    pointsSpent: { type: Number, required: true, min: 0 },
    status: { type: String, enum: VOUCHER_CLAIM_STATUSES, default: 'issued', required: true },
    expiresAt: { type: Date, required: true },
    redeemedAt: { type: Date },
    redeemedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    redeemNote: { type: String, trim: true, maxlength: 240 },
  },
  { timestamps: true },
);

voucherClaimSchema.index({ userId: 1, createdAt: -1 });
voucherClaimSchema.index({ voucherId: 1, userId: 1 });
voucherClaimSchema.index({ destinationId: 1, status: 1, createdAt: -1 });

export type VoucherClaim = InferSchemaType<typeof voucherClaimSchema>;
export type VoucherClaimDocument = HydratedDocument<VoucherClaim>;
export const VoucherClaimModel = model('VoucherClaim', voucherClaimSchema, 'voucherClaims');
