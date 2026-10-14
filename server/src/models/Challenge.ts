import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

const questionSchema = new Schema({
  prompt: { type: String, required: true, trim: true, maxlength: 500 },
  options: {
    type: [{ type: String, trim: true, maxlength: 200 }],
    validate: {
      validator: (options: string[]) => options.length >= 2 && options.length <= 6,
      message: 'Mỗi câu hỏi cần 2–6 lựa chọn.',
    },
  },
  // Never serialized to public clients.
  correctOptionIndex: { type: Number, required: true, min: 0 },
  explanation: { type: String, trim: true, maxlength: 600 },
});

const challengeSchema = new Schema(
  {
    destinationId: { type: Schema.Types.ObjectId, ref: 'Destination', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, trim: true, maxlength: 1000, default: '' },
    story: { type: String, trim: true, maxlength: 4000, default: '' },
    type: { type: String, enum: ['quiz'], default: 'quiz', required: true },
    questions: { type: [questionSchema], default: [] },
    scoringRules: {
      type: new Schema(
        {
          rewardPoints: { type: Number, required: true, min: 0, max: 1000 },
          minCorrect: { type: Number, required: true, min: 1 },
        },
        { _id: false },
      ),
      required: true,
    },
    status: { type: String, enum: ['active', 'inactive'], default: 'inactive', required: true },
  },
  { timestamps: true },
);

challengeSchema.index({ destinationId: 1, status: 1 });

export type Challenge = InferSchemaType<typeof challengeSchema>;
export type ChallengeDocument = HydratedDocument<Challenge>;
export const ChallengeModel = model('Challenge', challengeSchema, 'challenges');
