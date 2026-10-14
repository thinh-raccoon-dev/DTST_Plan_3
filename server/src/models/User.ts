import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { AREAS, INTERESTS } from '../config/catalog.js';

export const USER_ROLES = ['tourist', 'admin', 'partner'] as const;
export type UserRole = (typeof USER_ROLES)[number];

const preferencesSchema = new Schema(
  {
    areas: { type: [{ type: String, enum: AREAS }], default: [] },
    interests: { type: [{ type: String, enum: INTERESTS }], default: [] },
    numberOfDays: { type: Number, min: 1, max: 7, default: 2 },
    hoursPerDay: { type: Number, min: 2, max: 12, default: 8 },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    passwordHash: { type: String, required: true, select: false },
    displayName: { type: String, required: true, trim: true, maxlength: 80 },
    role: { type: String, enum: USER_ROLES, default: 'tourist', required: true },
    status: { type: String, enum: ['active', 'disabled'], default: 'active', required: true },
    preferences: {
      type: preferencesSchema,
      default: () => ({ areas: [], interests: [], numberOfDays: 2, hoursPerDay: 8 }),
    },
  },
  { timestamps: true },
);

export type User = InferSchemaType<typeof userSchema>;
export type UserDocument = HydratedDocument<User>;
export const UserModel = model('User', userSchema, 'users');
