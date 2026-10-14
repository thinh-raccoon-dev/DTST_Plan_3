import { Schema, model, type InferSchemaType } from 'mongoose';

export const PASSPORT_ENTRY_TYPES = ['check_in', 'challenge_completed', 'badge_awarded'] as const;
export type PassportEntryType = (typeof PASSPORT_ENTRY_TYPES)[number];

/**
 * Rewarded passport facts. Exactly one of userId / anonymousSessionId identifies the owner.
 * Guest entries are graded by the server too and can later be claimed into an account.
 */
const passportEntrySchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  anonymousSessionId: { type: String },
  entryType: { type: String, enum: PASSPORT_ENTRY_TYPES, required: true },
  destinationId: { type: Schema.Types.ObjectId, ref: 'Destination' },
  challengeId: { type: Schema.Types.ObjectId, ref: 'Challenge' },
  qrCodeId: { type: Schema.Types.ObjectId, ref: 'QrCode' },
  badgeKey: { type: String },
  scoreAwarded: { type: Number, required: true, min: 0, default: 0 },
  completedAt: { type: Date, required: true, default: () => new Date() },
  source: { type: String, enum: ['qr', 'system'], required: true },
  metadata: {
    correctCount: Number,
    totalQuestions: Number,
  },
});

const ownerFilters = [
  { field: 'userId', type: 'objectId', prefix: 'user' },
  { field: 'anonymousSessionId', type: 'string', prefix: 'anon' },
] as const;

const uniqueTargets = [
  { entryType: 'challenge_completed', field: 'challengeId' },
  { entryType: 'check_in', field: 'destinationId' },
  { entryType: 'badge_awarded', field: 'badgeKey' },
] as const;

// One reward per owner per challenge / destination / badge, enforced by the database so that
// concurrent requests cannot double-award.
for (const owner of ownerFilters) {
  for (const target of uniqueTargets) {
    passportEntrySchema.index(
      { [owner.field]: 1, [target.field]: 1, entryType: 1 },
      {
        unique: true,
        name: `uniq_${owner.prefix}_${target.entryType}`,
        partialFilterExpression: { entryType: target.entryType, [owner.field]: { $type: owner.type } },
      },
    );
  }
}
passportEntrySchema.index({ userId: 1, completedAt: -1 });
passportEntrySchema.index({ anonymousSessionId: 1, completedAt: -1 });
passportEntrySchema.index({ challengeId: 1, entryType: 1 });

export type PassportEntry = InferSchemaType<typeof passportEntrySchema>;
export const PassportEntryModel = model('PassportEntry', passportEntrySchema, 'passportEntries');
