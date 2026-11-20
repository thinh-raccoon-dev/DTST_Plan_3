import type { Request, Response } from 'express';
import { AuditLogModel } from '../../models/AuditLog.js';
import { logAuditEvent } from '../../services/audit.service.js';
import { toUtf8BomCsv } from '../../utils/csv.js';

const TIMEZONE = 'Asia/Ho_Chi_Minh';
const TZ_OFFSET = '+07:00';
const DATE_RX = /^\d{4}-\d{2}-\d{2}$/;

function escapeRegex(text: string): string {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

function startOfVietnamToday(): Date {
  const vnToday = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return new Date(`${vnToday}T00:00:00${TZ_OFFSET}`);
}

function buildAuditFilter(query: Request['query']): Record<string, unknown> {
  const search = typeof query.q === 'string' ? query.q.trim() : '';
  const actorRole = typeof query.role === 'string' ? query.role.trim() : '';
  const targetType = typeof query.targetType === 'string' ? query.targetType.trim() : '';
  const action = typeof query.action === 'string' ? query.action.trim() : '';
  const from = typeof query.from === 'string' ? query.from.trim() : '';
  const to = typeof query.to === 'string' ? query.to.trim() : '';

  const filter: Record<string, unknown> = {};

  if (actorRole && actorRole !== 'all') filter.actorRole = actorRole;
  if (targetType && targetType !== 'all') filter.targetType = targetType;
  if (action && action !== 'all') filter.action = action;

  if (DATE_RX.test(from) || DATE_RX.test(to)) {
    const createdAt: Record<string, Date> = {};
    if (DATE_RX.test(from)) createdAt.$gte = new Date(`${from}T00:00:00${TZ_OFFSET}`);
    if (DATE_RX.test(to)) createdAt.$lte = new Date(`${to}T23:59:59.999${TZ_OFFSET}`);
    filter.createdAt = createdAt;
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
  return filter;
}

export async function listAuditLogs(req: Request, res: Response) {
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20));
  const filter = buildAuditFilter(req.query);

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
  const startOfToday = startOfVietnamToday();

  const [totalLogs, todayLogs, partnerToday, adminToday, actionDistribution] = await Promise.all([
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

/** Export filtered immutable audit logs as OWASP formula-safe UTF-8 BOM CSV. */
export async function exportAuditLogsCsv(req: Request, res: Response) {
  const filter = buildAuditFilter(req.query);
  const logs = await AuditLogModel.find(filter).sort({ createdAt: -1 }).limit(3000).lean();

  const rows: unknown[][] = [
    ['NHAT KY KIEM TOAN HE THONG (AUDIT LOGS) - SO VHTTDL DONG THAP'],
    ['Thoi diem xuat', new Date().toLocaleString('vi-VN', { timeZone: TIMEZONE })],
    ['Tong so dong xuat', logs.length],
    [''],
    ['Thoi gian (VN)', 'Vai tro', 'Nguoi thuc hien', 'Email', 'Hanh dong', 'Loai doi tuong', 'Doi tuong', 'IP', 'Trang thai'],
    ...logs.map((l) => [
      new Date(l.createdAt).toLocaleString('vi-VN', { timeZone: TIMEZONE }),
      l.actorRole,
      l.actorName,
      l.actorEmail,
      l.action,
      l.targetType,
      l.targetName,
      l.ipAddress || '',
      l.status,
    ]),
  ];

  await logAuditEvent({
    req,
    action: 'admin.audit_logs.export',
    targetType: 'report',
    targetId: 'audit-logs',
    targetName: `Xuất ${logs.length} dòng Audit Logs`,
    details: { rows: logs.length },
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="nhat-ky-kiem-toan-dtst.csv"');
  res.setHeader('Cache-Control', 'no-store');
  res.send(toUtf8BomCsv(rows));
}
