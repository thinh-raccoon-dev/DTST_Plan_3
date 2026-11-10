import { Schema, model, type InferSchemaType, type Types } from 'mongoose';

export const AUDIT_TARGET_TYPES = [
  'destination',
  'qr',
  'challenge',
  'badge',
  'review',
  'user',
  'banner',
  'system',
  'itinerary',
] as const;
export type AuditTargetType = (typeof AUDIT_TARGET_TYPES)[number];

export const AUDIT_ROLES = ['admin', 'partner', 'tourist', 'system'] as const;
export type AuditRole = (typeof AUDIT_ROLES)[number];

const auditLogSchema = new Schema(
  {
    actorId: { type: Schema.Types.ObjectId, ref: 'User' },
    actorEmail: { type: String, trim: true, lowercase: true, default: '' },
    actorName: { type: String, trim: true, default: '' },
    actorRole: { type: String, enum: AUDIT_ROLES, required: true },
    action: { type: String, required: true, trim: true }, // e.g., 'destination.update', 'qr.create', 'challenge.create', 'badge.create', 'review.respond'
    targetType: { type: String, enum: AUDIT_TARGET_TYPES, required: true },
    targetId: { type: String, trim: true, default: '' },
    targetName: { type: String, trim: true, default: '' },
    destinationId: { type: Schema.Types.ObjectId, ref: 'Destination' },
    details: { type: Schema.Types.Mixed, default: {} },
    ipAddress: { type: String, trim: true },
    userAgent: { type: String, trim: true },
    status: { type: String, enum: ['success', 'failed'], default: 'success', required: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Logs are immutable, only createdAt
  },
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ actorRole: 1, createdAt: -1 });
auditLogSchema.index({ targetType: 1, createdAt: -1 });
auditLogSchema.index({ destinationId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

export type AuditLog = InferSchemaType<typeof auditLogSchema>;
export const AuditLogModel = model('AuditLog', auditLogSchema, 'auditLogs');
