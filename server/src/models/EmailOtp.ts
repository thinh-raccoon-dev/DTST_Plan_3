import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

export const OTP_PURPOSES = ['register'] as const;
export type OtpPurpose = (typeof OTP_PURPOSES)[number];

const emailOtpSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    purpose: {
      type: String,
      enum: OTP_PURPOSES,
      default: 'register',
      required: true,
    },
    /** HMAC-SHA256 digest of `${purpose}:${email}:${otp}` — plaintext OTP is never stored in DB. */
    codeHash: {
      type: String,
      required: true,
    },
    displayName: {
      type: String,
      trim: true,
      maxlength: 80,
      default: '',
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxAttempts: {
      type: Number,
      default: 5,
      min: 1,
    },
    lastSentAt: {
      type: Date,
      required: true,
      default: () => new Date(),
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    consumedAt: {
      type: Date,
      default: null,
    },
    requestedIp: {
      type: String,
      trim: true,
      maxlength: 80,
      default: '',
    },
  },
  { timestamps: true },
);

emailOtpSchema.index({ email: 1, purpose: 1 }, { unique: true });
// Automatically purge expired OTP documents in MongoDB
emailOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type EmailOtp = InferSchemaType<typeof emailOtpSchema>;
export type EmailOtpDocument = HydratedDocument<EmailOtp>;
export const EmailOtpModel = model('EmailOtp', emailOtpSchema, 'email_otps');
