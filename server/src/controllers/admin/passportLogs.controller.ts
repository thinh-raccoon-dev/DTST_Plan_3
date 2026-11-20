import type { Request, Response } from 'express';
import { DestinationModel } from '../../models/Destination.js';
import { PassportEntryModel } from '../../models/PassportEntry.js';
import { UserModel } from '../../models/User.js';
import { logAuditEvent } from '../../services/audit.service.js';
import { toUtf8BomCsv } from '../../utils/csv.js';

const TIMEZONE = 'Asia/Ho_Chi_Minh';
const TZ_OFFSET = '+07:00';

function startOfVietnamToday(): Date {
  const vnToday = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return new Date(`${vnToday}T00:00:00${TZ_OFFSET}`);
}

function escapeRegex(text: string): string {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

export async function listPassportLogs(req: Request, res: Response) {
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20));
  const search = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const entryType = typeof req.query.entryType === 'string' ? req.query.entryType.trim() : '';

  const filter: Record<string, unknown> = {};

  if (entryType && entryType !== 'all') {
    filter.entryType = entryType;
  }

  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    const [matchedUsers, matchedDestinations] = await Promise.all([
      UserModel.find({ $or: [{ email: rx }, { displayName: rx }] }).select('_id').lean(),
      DestinationModel.find({ name: rx }).select('_id').lean(),
    ]);

    const userIds = matchedUsers.map((u) => u._id);
    const destIds = matchedDestinations.map((d) => d._id);

    filter.$or = [{ userId: { $in: userIds } }, { destinationId: { $in: destIds } }, { badgeKey: rx }];
  }

  const startOfToday = startOfVietnamToday();

  const [
    total,
    logs,
    totalCheckIns,
    totalChallenges,
    totalBadges,
    pointsAgg,
    todayActivities,
  ] = await Promise.all([
    PassportEntryModel.countDocuments(filter),
    PassportEntryModel.find(filter)
      .sort({ completedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('userId', 'email displayName role')
      .populate('destinationId', 'name slug category area image')
      .populate('challengeId', 'title rewardPoints')
      .populate('qrCodeId', 'code label')
      .lean(),
    PassportEntryModel.countDocuments({ entryType: 'check_in' }),
    PassportEntryModel.countDocuments({ entryType: 'challenge_completed' }),
    PassportEntryModel.countDocuments({ entryType: 'badge_awarded' }),
    PassportEntryModel.aggregate<{ _id: null; total: number }>([
      { $group: { _id: null, total: { $sum: '$scoreAwarded' } } },
    ]),
    PassportEntryModel.countDocuments({ completedAt: { $gte: startOfToday } }),
  ]);

  const totalPoints = pointsAgg[0]?.total ?? 0;

  const items = logs.map((log) => {
    const user = log.userId as { _id?: unknown; email?: string; displayName?: string; role?: string } | null;
    const dest = log.destinationId as { _id?: unknown; name?: string; slug?: string; category?: string; area?: string; image?: { url: string } } | null;
    const chal = log.challengeId as { _id?: unknown; title?: string; rewardPoints?: number } | null;
    const qr = log.qrCodeId as { _id?: unknown; code?: string; label?: string } | null;

    return {
      id: String(log._id),
      entryType: log.entryType,
      scoreAwarded: log.scoreAwarded,
      completedAt: log.completedAt,
      source: log.source,
      badgeKey: log.badgeKey,
      metadata: log.metadata,
      user: user
        ? {
            id: String(user._id ?? ''),
            email: user.email ?? 'Khách vãng lai',
            displayName: user.displayName ?? 'Khách vãng lai',
            role: user.role ?? 'tourist',
          }
        : {
            id: 'anonymous',
            email: 'Khách ẩn danh',
            displayName: 'Khách tham quan',
            role: 'tourist',
          },
      destination: dest
        ? {
            id: String(dest._id ?? ''),
            name: dest.name,
            slug: dest.slug,
            category: dest.category,
            area: dest.area,
            imageUrl: dest.image?.url,
          }
        : null,
      challenge: chal
        ? {
            id: String(chal._id ?? ''),
            title: chal.title,
            rewardPoints: chal.rewardPoints,
          }
        : null,
      qrCode: qr
        ? {
            id: String(qr._id ?? ''),
            code: qr.code,
            label: qr.label,
          }
        : null,
    };
  });

  res.json({
    items,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    stats: {
      totalCheckIns,
      totalChallenges,
      totalBadges,
      totalPoints,
      todayActivities,
    },
  });
}

/** Export anonymized Passport / Check-in logs CSV (NĐ 13/2023 + OWASP formula-safe). */
export async function exportPassportLogsCsv(req: Request, res: Response) {
  const entryType = typeof req.query.entryType === 'string' ? req.query.entryType.trim() : '';
  const filter: Record<string, unknown> = {};
  if (entryType && entryType !== 'all') filter.entryType = entryType;

  const logs = await PassportEntryModel.find(filter)
    .sort({ completedAt: -1 })
    .limit(3000)
    .populate('userId', 'displayName')
    .populate('destinationId', 'name area')
    .populate('challengeId', 'title')
    .populate('qrCodeId', 'code label')
    .lean();

  const rows: unknown[][] = [
    ['NHAT KY HO CHIEU SO & CHECK-IN (AN DANH NĐ 13/2023/ND-CP) - SO VHTTDL'],
    ['Thoi diem xuat', new Date().toLocaleString('vi-VN', { timeZone: TIMEZONE })],
    ['Tong so dong', logs.length],
    [''],
    ['Thoi gian (VN)', 'Loai hoat dong', 'Phuong thuc', 'Du khach (an danh email)', 'Dia diem', 'Thu thach / Huy hieu', 'Ma QR', 'Diem EXP'],
    ...logs.map((log) => {
      const u = log.userId as { displayName?: string } | null;
      const d = log.destinationId as { name?: string } | null;
      const ch = log.challengeId as { title?: string } | null;
      const qr = log.qrCodeId as { code?: string } | null;
      return [
        new Date(log.completedAt).toLocaleString('vi-VN', { timeZone: TIMEZONE }),
        log.entryType,
        log.source === 'gps' ? 'GPS Thuc dia' : log.source === 'qr' ? 'Quet QR' : log.source,
        u?.displayName || `Khach #${String(log._id).slice(-4).toUpperCase()}`,
        d?.name || '',
        ch?.title || log.badgeKey || '',
        qr?.code || '',
        log.scoreAwarded ?? 0,
      ];
    }),
  ];

  await logAuditEvent({
    req,
    action: 'admin.passport_logs.export',
    targetType: 'report',
    targetId: 'passport-logs',
    targetName: `Xuất ${logs.length} dòng Nhật ký Hộ chiếu`,
    details: { rows: logs.length, entryType: entryType || 'all' },
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="nhat-ky-checkin-ho-chieu-dtst.csv"');
  res.setHeader('Cache-Control', 'no-store');
  res.send(toUtf8BomCsv(rows));
}
