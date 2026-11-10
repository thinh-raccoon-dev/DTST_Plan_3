import type { Request } from 'express';
import { Types } from 'mongoose';
import { AuditLogModel, type AuditRole, type AuditTargetType } from '../models/AuditLog.js';
import { logger } from '../utils/logger.js';

export interface AuditEventParams {
  req?: Request;
  actorId?: string | Types.ObjectId;
  actorEmail?: string;
  actorName?: string;
  actorRole?: AuditRole;
  action: string;
  targetType: AuditTargetType;
  targetId?: string | Types.ObjectId;
  targetName?: string;
  destinationId?: string | Types.ObjectId;
  details?: Record<string, unknown>;
  status?: 'success' | 'failed';
}

/**
 * Records an immutable audit log entry.
 * Non-blocking: will never crash or interrupt the parent operation if logging fails.
 */
export async function logAuditEvent(params: AuditEventParams): Promise<void> {
  try {
    const { req } = params;

    const actorId =
      params.actorId ?? (req?.user?.id ? new Types.ObjectId(req.user.id) : undefined);
    const actorEmail = params.actorEmail ?? req?.user?.email ?? '';
    const actorRole =
      params.actorRole ?? (req?.user?.role as AuditRole) ?? 'system';
    const actorName = params.actorName ?? req?.user?.displayName ?? actorEmail.split('@')[0] ?? 'Hệ thống';

    const ipAddress =
      req?.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
      req?.socket?.remoteAddress ||
      '';
    const userAgent = req?.get('user-agent') || '';

    await AuditLogModel.create({
      actorId,
      actorEmail,
      actorName,
      actorRole,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId ? String(params.targetId) : '',
      targetName: params.targetName || '',
      destinationId: params.destinationId
        ? new Types.ObjectId(String(params.destinationId))
        : undefined,
      details: params.details || {},
      ipAddress,
      userAgent,
      status: params.status || 'success',
    });
  } catch (error) {
    logger.error({ err: error, action: params.action }, 'Failed to record audit log');
  }
}
