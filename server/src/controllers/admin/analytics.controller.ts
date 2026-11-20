import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { getAreaLabel } from '../../config/catalog.js';
import { AnalyticsEventModel, type EventType } from '../../models/AnalyticsEvent.js';
import { ChallengeModel } from '../../models/Challenge.js';
import { DestinationModel } from '../../models/Destination.js';
import { QrCodeModel } from '../../models/QrCode.js';
import { logAuditEvent } from '../../services/audit.service.js';
import { toUtf8BomCsv } from '../../utils/csv.js';
import { badRequest } from '../../utils/errors.js';

const TIMEZONE = 'Asia/Ho_Chi_Minh';
const TZ_OFFSET = '+07:00';
const DAY_MS = 24 * 60 * 60_000;
const MAX_RANGE_DAYS = 366;

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải có dạng YYYY-MM-DD.');
const querySchema = z.object({ from: dateString.optional(), to: dateString.optional() });

function vnDateString(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

/** Inclusive calendar range in Vietnam time, converted to a half-open UTC interval. */
export function resolveRange(from?: string, to?: string) {
  const toDay = to ?? vnDateString(new Date());
  const end = new Date(`${toDay}T00:00:00${TZ_OFFSET}`);
  const fromDay = from ?? vnDateString(new Date(end.getTime() - 29 * DAY_MS));
  const start = new Date(`${fromDay}T00:00:00${TZ_OFFSET}`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw badRequest('Khoảng thời gian không hợp lệ.');
  if (start > end) throw badRequest('Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.');
  const endExclusive = new Date(end.getTime() + DAY_MS);
  const days = Math.round((endExclusive.getTime() - start.getTime()) / DAY_MS);
  if (days > MAX_RANGE_DAYS) throw badRequest(`Khoảng thời gian tối đa ${MAX_RANGE_DAYS} ngày.`);
  return { from: fromDay, to: toDay, start, endExclusive, days };
}

const INTERACTION_TYPES: EventType[] = ['challenge_started', 'destination_check_in'];

async function topBy(
  field: 'destinationId' | 'qrCodeId' | 'challengeId',
  eventType: EventType,
  match: Record<string, unknown>,
) {
  return AnalyticsEventModel.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { ...match, eventType, [field]: { $exists: true } } },
    { $group: { _id: `$${field}`, count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
    { $limit: 5 },
  ]);
}

export async function getAnalytics(req: Request, res: Response) {
  const query = querySchema.parse(req.query);
  const range = resolveRange(query.from, query.to);

  const isPartner = req.user?.role === 'partner';
  let partnerDestIds: Types.ObjectId[] | null = null;
  if (isPartner && req.user?.id) {
    partnerDestIds = (await DestinationModel.find({
      managedBy: { $in: [req.user.id, new Types.ObjectId(req.user.id)] },
    }).distinct('_id')) as Types.ObjectId[];
  }

  const match: Record<string, unknown> = { timestamp: { $gte: range.start, $lt: range.endExclusive } };
  if (partnerDestIds !== null) {
    match.destinationId = { $in: partnerDestIds };
  }

  const prevStart = new Date(range.start.getTime() - range.days * DAY_MS);
  const prevMatch: Record<string, unknown> = {
    timestamp: { $gte: prevStart, $lt: range.start },
    ...(partnerDestIds !== null ? { destinationId: { $in: partnerDestIds } } : {}),
  };

  const [
    byType,
    prevByType,
    daily,
    uniqueRows,
    topDest,
    topQr,
    topChallenges,
    publishedDestinations,
    activeQrCodes,
    allDestsMeta,
    areaEventsAgg,
  ] = await Promise.all([
    AnalyticsEventModel.aggregate<{ _id: EventType; count: number }>([
      { $match: match },
      { $group: { _id: '$eventType', count: { $sum: 1 } } },
    ]),
    AnalyticsEventModel.aggregate<{ _id: EventType; count: number }>([
      { $match: prevMatch },
      { $group: { _id: '$eventType', count: { $sum: 1 } } },
    ]),
    AnalyticsEventModel.aggregate<{ _id: { day: string; type: EventType }; count: number }>([
      { $match: match },
      {
        $group: {
          _id: { day: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp', timezone: TIMEZONE } }, type: '$eventType' },
          count: { $sum: 1 },
        },
      },
    ]),
    AnalyticsEventModel.aggregate<{ total: number; accounts: number }>([
      { $match: match },
      {
        $group: {
          _id: { $ifNull: [{ $toString: '$userId' }, '$anonymousSessionId'] },
          hasAccount: { $max: { $cond: [{ $ifNull: ['$userId', false] }, 1, 0] } },
        },
      },
      { $match: { _id: { $ne: null } } },
      { $group: { _id: null, total: { $sum: 1 }, accounts: { $sum: '$hasAccount' } } },
    ]),
    topBy('destinationId', 'destination_page_view', match),
    topBy('qrCodeId', 'qr_landing_view', match),
    topBy('challengeId', 'challenge_completed', match),
    DestinationModel.countDocuments({
      publicationStatus: 'published',
      ...(partnerDestIds !== null ? { _id: { $in: partnerDestIds } } : {}),
    }),
    QrCodeModel.countDocuments({
      status: 'active',
      ...(partnerDestIds !== null ? { targetId: { $in: partnerDestIds } } : {}),
    }),
    DestinationModel.find(partnerDestIds !== null ? { _id: { $in: partnerDestIds } } : {})
      .select('_id area verificationStatus managedBy publicationStatus')
      .lean(),
    AnalyticsEventModel.aggregate<{
      _id: { destinationId: Types.ObjectId; eventType: EventType };
      count: number;
    }>([
      {
        $match: {
          ...match,
          destinationId: { $exists: true },
          eventType: { $in: ['destination_page_view', 'qr_landing_view', 'destination_check_in'] },
        },
      },
      { $group: { _id: { destinationId: '$destinationId', eventType: '$eventType' }, count: { $sum: 1 } } },
    ]),
  ]);

  const count = (type: EventType) => byType.find((row) => row._id === type)?.count ?? 0;
  const prevCount = (type: EventType) => prevByType.find((row) => row._id === type)?.count ?? 0;
  const pctDelta = (curr: number, prev: number): number | null => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return Math.round(((curr - prev) / prev) * 1000) / 10;
  };

  // Area breakdown & verification coverage
  const destAreaById = new Map<string, string>();
  const areaBuckets = new Map<
    string,
    { area: string; label: string; destinations: number; views: number; checkIns: number }
  >();
  let verifiedCount = 0;
  let partialCount = 0;
  let unverifiedCount = 0;
  let assignedToPartnerCount = 0;

  for (const d of allDestsMeta) {
    destAreaById.set(String(d._id), d.area);
    const bucket = areaBuckets.get(d.area) ?? {
      area: d.area,
      label: getAreaLabel(d.area),
      destinations: 0,
      views: 0,
      checkIns: 0,
    };
    bucket.destinations += 1;
    areaBuckets.set(d.area, bucket);

    if (d.verificationStatus === 'verified') verifiedCount += 1;
    else if (d.verificationStatus === 'partially_verified') partialCount += 1;
    else unverifiedCount += 1;
    if (d.managedBy) assignedToPartnerCount += 1;
  }

  for (const row of areaEventsAgg) {
    const area = destAreaById.get(String(row._id.destinationId));
    if (!area) continue;
    const bucket = areaBuckets.get(area);
    if (!bucket) continue;
    if (row._id.eventType === 'destination_check_in') bucket.checkIns += row.count;
    else bucket.views += row.count;
  }

  const areaBreakdown = Array.from(areaBuckets.values())
    .sort((a, b) => b.views + b.checkIns * 3 - (a.views + a.checkIns * 3) || b.destinations - a.destinations)
    .slice(0, 12);

  const verificationCoverage = {
    total: allDestsMeta.length,
    verified: verifiedCount,
    partiallyVerified: partialCount,
    unverified: unverifiedCount,
    assignedToPartner: assignedToPartnerCount,
    unassigned: Math.max(0, allDestsMeta.length - assignedToPartnerCount),
  };

  const dayMap = new Map<string, Record<string, number>>();
  for (let i = 0; i < range.days; i += 1) {
    dayMap.set(vnDateString(new Date(range.start.getTime() + i * DAY_MS)), {
      pageViews: 0,
      qrLandings: 0,
      interactions: 0,
      completions: 0,
    });
  }
  for (const row of daily) {
    const bucket = dayMap.get(row._id.day);
    if (!bucket) continue;
    if (row._id.type === 'destination_page_view') bucket.pageViews! += row.count;
    if (row._id.type === 'qr_landing_view') bucket.qrLandings! += row.count;
    if (INTERACTION_TYPES.includes(row._id.type)) bucket.interactions! += row.count;
    if (row._id.type === 'challenge_completed') bucket.completions! += row.count;
  }

  const [destNames, qrNames, challengeNames] = await Promise.all([
    DestinationModel.find({ _id: { $in: topDest.map((r) => r._id) } }).select('name slug').lean(),
    QrCodeModel.find({ _id: { $in: topQr.map((r) => r._id) } }).select('code label').lean(),
    ChallengeModel.find({ _id: { $in: topChallenges.map((r) => r._id) } }).select('title').lean(),
  ]);
  const nameOf = <T extends { _id: Types.ObjectId }>(list: T[], id: Types.ObjectId) => list.find((x) => String(x._id) === String(id));

  const unique = uniqueRows[0] ?? { total: 0, accounts: 0 };
  const rate = (numerator: number, denominator: number) =>
    denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : null;
  const totals = {
    destinationPageViews: count('destination_page_view'),
    qrLandingViews: count('qr_landing_view'),
    interactions: INTERACTION_TYPES.reduce((sum, type) => sum + count(type), 0),
    challengeAttempts: count('challenge_started'),
    checkIns: count('destination_check_in'),
    challengeCompletions: count('challenge_completed'),
    itinerariesGenerated: count('itinerary_generated'),
    itinerariesSaved: count('itinerary_saved'),
    badgesAwarded: count('passport_badge_awarded'),
    uniqueVisitors: unique.total,
    uniqueAccounts: unique.accounts,
  };

  const growth = {
    destinationPageViewsPct: pctDelta(totals.destinationPageViews, prevCount('destination_page_view')),
    qrLandingViewsPct: pctDelta(totals.qrLandingViews, prevCount('qr_landing_view')),
    checkInsPct: pctDelta(totals.checkIns, prevCount('destination_check_in')),
    challengeCompletionsPct: pctDelta(totals.challengeCompletions, prevCount('challenge_completed')),
  };

  res.set('Cache-Control', 'no-store');
  res.json({
    range: { from: range.from, to: range.to, days: range.days },
    current: { publishedDestinations, activeQrCodes },
    totals,
    growth,
    areaBreakdown,
    verificationCoverage,
    funnel: {
      steps: [
        { key: 'pageView', label: 'Xem trang địa điểm', count: totals.destinationPageViews },
        { key: 'qrLanding', label: 'Mở trang từ QR', count: totals.qrLandingViews },
        { key: 'checkIn', label: 'Check-in tại điểm', count: totals.checkIns },
        { key: 'challengeAttempt', label: 'Gửi đáp án thử thách', count: totals.challengeAttempts },
        { key: 'challengeCompletions', label: 'Hoàn thành thử thách', count: totals.challengeCompletions },
      ],
      rates: {
        pageViewToQr: rate(totals.qrLandingViews, totals.destinationPageViews),
        qrToCheckIn: rate(totals.checkIns, totals.qrLandingViews),
        checkInToChallengeAttempt: rate(totals.challengeAttempts, totals.checkIns),
        attemptToCompletion: rate(totals.challengeCompletions, totals.challengeAttempts),
        generateToSave: rate(totals.itinerariesSaved, totals.itinerariesGenerated),
      },
    },
    daily: Array.from(dayMap.entries()).map(([date, counts]) => ({ date, ...counts })),
    topDestinations: topDest.map((r) => {
      const dest = nameOf(destNames, r._id);
      return { id: String(r._id), name: dest?.name ?? 'Địa điểm', slug: dest?.slug, count: r.count };
    }),
    topQrCodes: topQr.map((r) => ({ id: String(r._id), code: nameOf(qrNames, r._id)?.code ?? 'QR', count: r.count })),
    topChallenges: topChallenges.map((r) => ({ id: String(r._id), title: nameOf(challengeNames, r._id)?.title ?? 'Thử thách', count: r.count })),
    definitions: {
      destinationPageViews: 'Lượt mở trang chi tiết địa điểm trực tiếp (loại trùng lặp cùng trình duyệt trong 30 phút).',
      qrLandingViews: 'Lượt mở trang đích từ mã QR (loại trùng lặp trong 10 phút, không tính lượt xem trước của quản trị). Không phải số khách truy cập duy nhất.',
      interactions: 'Tổng số lượt gửi đáp án thử thách và check-in thành công.',
      challengeCompletions: 'Số lượt trả lời đúng và được hệ thống công nhận hoàn thành.',
      uniqueVisitors: 'Ước lượng du khách duy nhất dựa trên tài khoản đăng nhập hoặc mã phiên ẩn danh.',
      funnel: 'Tỷ lệ chuyển đổi qua các bước; mỗi bước tính trên tổng số lượt ghi nhận trong khoảng thời gian đã chọn.',
    },
  });
}

/** Provincial analytics CSV export (UTF-8 BOM + OWASP CSV Formula Injection Defense). */
export async function exportAdminAnalyticsCsv(req: Request, res: Response) {
  const query = querySchema.parse(req.query);
  const range = resolveRange(query.from, query.to);
  const match = { timestamp: { $gte: range.start, $lt: range.endExclusive } };

  const [daily, allDests, areaEvents] = await Promise.all([
    AnalyticsEventModel.aggregate<{ _id: { day: string; type: EventType }; count: number }>([
      { $match: match },
      {
        $group: {
          _id: { day: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp', timezone: TIMEZONE } }, type: '$eventType' },
          count: { $sum: 1 },
        },
      },
    ]),
    DestinationModel.find().select('_id area verificationStatus managedBy publicationStatus').lean(),
    AnalyticsEventModel.aggregate<{ _id: { destinationId: Types.ObjectId; eventType: EventType }; count: number }>([
      {
        $match: {
          ...match,
          destinationId: { $exists: true },
          eventType: { $in: ['destination_page_view', 'qr_landing_view', 'destination_check_in'] },
        },
      },
      { $group: { _id: { destinationId: '$destinationId', eventType: '$eventType' }, count: { $sum: 1 } } },
    ]),
  ]);

  const dayMap = new Map<string, { pageViews: number; qrLandings: number; checkIns: number; completions: number }>();
  for (let i = 0; i < range.days; i += 1) {
    dayMap.set(vnDateString(new Date(range.start.getTime() + i * DAY_MS)), {
      pageViews: 0,
      qrLandings: 0,
      checkIns: 0,
      completions: 0,
    });
  }
  for (const row of daily) {
    const b = dayMap.get(row._id.day);
    if (!b) continue;
    if (row._id.type === 'destination_page_view') b.pageViews += row.count;
    if (row._id.type === 'qr_landing_view') b.qrLandings += row.count;
    if (row._id.type === 'destination_check_in') b.checkIns += row.count;
    if (row._id.type === 'challenge_completed') b.completions += row.count;
  }

  const destArea = new Map(allDests.map((d) => [String(d._id), d.area]));
  const areaStats = new Map<string, { dests: number; views: number; checkIns: number }>();
  for (const d of allDests) {
    const entry = areaStats.get(d.area) ?? { dests: 0, views: 0, checkIns: 0 };
    entry.dests += 1;
    areaStats.set(d.area, entry);
  }
  for (const ev of areaEvents) {
    const area = destArea.get(String(ev._id.destinationId));
    if (!area) continue;
    const entry = areaStats.get(area);
    if (!entry) continue;
    if (ev._id.eventType === 'destination_check_in') entry.checkIns += ev.count;
    else entry.views += ev.count;
  }

  const rows: unknown[][] = [
    ['BAO CAO THONG KE DU LICH CAP TINH - SO VHTTDL DONG THAP'],
    ['Khoang thoi gian', `${range.from} den ${range.to} (${range.days} ngay)`],
    ['Thoi diem xuat', new Date().toLocaleString('vi-VN', { timeZone: TIMEZONE })],
    ['Tong so diem den', allDests.length],
    [''],
    ['--- PHAN BO THEO DIA BAN ---'],
    ['Dia ban', 'So diem den', 'Luot xem / QR', 'Luot Check-in thuc dia'],
    ...Array.from(areaStats.entries()).map(([area, s]) => [getAreaLabel(area), s.dests, s.views, s.checkIns]),
    [''],
    ['--- CHI TIET THEO NGAY ---'],
    ['Ngay', 'Xem trang KDL', 'Mo tu QR', 'Check-in thuc dia', 'Hoan thanh thu thach'],
    ...Array.from(dayMap.entries()).map(([date, d]) => [date, d.pageViews, d.qrLandings, d.checkIns, d.completions]),
  ];

  await logAuditEvent({
    req,
    action: 'admin.analytics.export',
    targetType: 'report',
    targetId: `${range.from}_${range.to}`,
    targetName: `Báo cáo cấp tỉnh ${range.from} -> ${range.to}`,
    details: { days: range.days },
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="bao-cao-so-vhttdl-${range.from}-den-${range.to}.csv"`);
  res.setHeader('Cache-Control', 'no-store');
  res.send(toUtf8BomCsv(rows));
}
