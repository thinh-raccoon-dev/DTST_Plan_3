import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

export const INQUIRY_STATUSES = ['new', 'contacted', 'confirmed', 'cancelled'] as const;
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];

const groupInquirySchema = new Schema(
  {
    destinationId: { type: Schema.Types.ObjectId, ref: 'Destination', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    contactName: { type: String, required: true, trim: true, maxlength: 100 },
    contactPhone: { type: String, required: true, trim: true, maxlength: 24 },
    contactEmail: { type: String, trim: true, lowercase: true, maxlength: 160 },
    visitDate: { type: Date, required: true },
    groupSize: { type: Number, required: true, min: 1, max: 500 },
    serviceInterest: { type: String, trim: true, maxlength: 160 },
    notes: { type: String, trim: true, maxlength: 1000, default: '' },
    // Explicit personal-data sharing consent (Nghị định 13/2023/NĐ-CP)
    consentGiven: { type: Boolean, required: true },
    consentAcceptedAt: { type: Date, required: true },
    status: { type: String, enum: INQUIRY_STATUSES, default: 'new', required: true },
    partnerReplyNote: { type: String, trim: true, maxlength: 800, default: '' },
    handledBy: { type: Schema.Types.ObjectId, ref: 'User' },
    handledAt: { type: Date },
  },
  { timestamps: true },
);

groupInquirySchema.index({ destinationId: 1, status: 1, createdAt: -1 });

export type GroupInquiry = InferSchemaType<typeof groupInquirySchema>;
export type GroupInquiryDocument = HydratedDocument<GroupInquiry>;
export const GroupInquiryModel = model('GroupInquiry', groupInquirySchema, 'groupInquiries');
