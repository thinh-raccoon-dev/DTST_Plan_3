import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { AuditLogModel } from '../../models/AuditLog.js';

function escapeRegex(text: string): string {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

export async function listAuditLogs(req: Request, res: Response) {
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20));
  const search = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const actorRole = typeof req.query.role === 'string' ? req.query.role.trim() : '';
  const targetType = typeof req.query.targetType === 'string' ? req.query.targetType.trim() : '';
  const action = typeof req.query.action === 'string' ? req.query.action.trim() : '';

  const filter: Record<string, unknown> = {};

  if (actorRole && actorRole !== 'all') {
    filter.actorRole = actorRole;
  }

  if (targetType && targetType !== 'all') {
    filter.targetType = targetType;
  }

  if (action && action !== 'all') {
    filter.action = action;
  }

  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    filter.$or = [
      { actorEmail: rx },
      { actorName: rx },
      { targetName: rx },
      { action: rx },
      { targetId: rx },
    ];
  }

  const [total, logs] = await Promise.all([
    AuditLogModel.countDocuments(filter),
    AuditLogModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ]);

  const items = logs.map((log) => ({
    id: String(log._id),
    actorId: log.actorId ? String(log.actorId) : null,
    actorEmail: log.actorEmail,
    actorName: log.actorName,
    actorRole: log.actorRole,
    action: log.action,
    targetType: log.targetType,
    targetId: log.targetId,
    targetName: log.targetName,
    destinationId: log.destinationId ? String(log.destinationId) : null,
    details: log.details,
    ipAddress: log.ipAddress,
    status: log.status,
    createdAt: log.createdAt,
  }));

  res.json({
    items,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
}

export async function getAuditLogStats(_req: Request, res: Response) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [
    totalLogs,
    todayLogs,
    partnerToday,
    adminToday,
    actionDistribution,
  ] = await Promise.all([
    AuditLogModel.countDocuments(),
    AuditLogModel.countDocuments({ createdAt: { $gte: startOfToday } }),
    AuditLogModel.countDocuments({ actorRole: 'partner', createdAt: { $gte: startOfToday } }),
    AuditLogModel.countDocuments({ actorRole: 'admin', createdAt: { $gte: startOfToday } }),
    AuditLogModel.aggregate<{ _id: string; count: number }>([
      { $match: { createdAt: { $gte: new Date(Date.now() - 7 * 86400000) } } },
      { $group: { _id: '$action', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]),
  ]);

  res.json({
    totalLogs,
    todayLogs,
    partnerToday,
    adminToday,
    topActions: actionDistribution.map((a) => ({ action: a._id, count: a.count })),
  });
}
