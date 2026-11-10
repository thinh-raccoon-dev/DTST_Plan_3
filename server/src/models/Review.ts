import { Schema, model, type InferSchemaType, Types } from 'mongoose';

const reviewSchema = new Schema(
  {
    destinationId: { type: Schema.Types.ObjectId, ref: 'Destination', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    authorName: { type: String, required: true, trim: true, maxlength: 100 },
    authorAvatar: { type: String, trim: true },
    authorTier: { type: String, default: 'Du khách Khám phá', trim: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    content: { type: String, required: true, trim: true, minlength: 5, maxlength: 1500 },
    tags: [{ type: String, trim: true, maxlength: 40 }],
    isVerifiedVisitor: { type: Boolean, default: false },
    likesCount: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ['published', 'hidden', 'flagged'], default: 'published', index: true },
    isFlagged: { type: Boolean, default: false, index: true },
    reportReason: { type: String, trim: true, maxlength: 500 },
    reportCount: { type: Number, default: 0, min: 0 },
    reportedAt: { type: Date },
    response: {
      content: { type: String, trim: true },
      respondedAt: { type: Date },
      responderName: { type: String, trim: true },
      responderId: { type: Schema.Types.ObjectId, ref: 'User' },
    },
  },
  { timestamps: true },
);

// Index for fast sorting by recent / rating
reviewSchema.index({ destinationId: 1, status: 1, createdAt: -1 });
reviewSchema.index({ destinationId: 1, status: 1, rating: -1 });
reviewSchema.index({ destinationId: 1, status: 1, likesCount: -1 });

export type ReviewDoc = InferSchemaType<typeof reviewSchema> & { _id: Types.ObjectId };
export const ReviewModel = model('Review', reviewSchema);
