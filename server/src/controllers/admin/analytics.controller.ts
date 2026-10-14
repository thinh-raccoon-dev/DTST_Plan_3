import type { Request, Response } from 'express';
import type { Types } from 'mongoose';
import { z } from 'zod';
import { AnalyticsEventModel, type EventType } from '../../models/AnalyticsEvent.js';
import { ChallengeModel } from '../../models/Challenge.js';
import { DestinationModel } from '../../models/Destination.js';
import { QrCodeModel } from '../../models/QrCode.js';
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
  const match = { timestamp: { $gte: range.start, $lt: range.endExclusive } };

  const [byType, daily, uniqueRows, topDest, topQr, topChallenges, publishedDestinations, activeQrCodes] = await Promise.all([
    AnalyticsEventModel.aggregate<{ _id: EventType; count: number }>([
      { $match: match },
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
    DestinationModel.countDocuments({ publicationStatus: 'published' }),
    QrCodeModel.countDocuments({ status: 'active' }),
  ]);

  const count = (type: EventType) => byType.find((row) => row._id === type)?.count ?? 0;

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
  res.set('Cache-Control', 'no-store');
  res.json({
    range: { from: range.from, to: range.to, timezone: TIMEZONE, days: range.days },
    current: { publishedDestinations, activeQrCodes },
    totals,
    daily: [...dayMap.entries()].map(([date, values]) => ({ date, ...values })),
    topDestinations: topDest.map((r) => {
      const d = nameOf(destNames, r._id);
      return { id: String(r._id), name: d?.name ?? '(đã xóa)', slug: d?.slug ?? null, count: r.count };
    }),
    topQrCodes: topQr.map((r) => {
      const q = nameOf(qrNames, r._id);
      return { id: String(r._id), code: q?.code ?? '(đã xóa)', label: q?.label ?? '', count: r.count };
    }),
    topChallenges: topChallenges.map((r) => ({ id: String(r._id), title: nameOf(challengeNames, r._id)?.title ?? '(đã xóa)', count: r.count })),
    funnel: {
      steps: [
        { key: 'destinationPageViews', label: 'Xem trang địa điểm', count: totals.destinationPageViews },
        { key: 'qrLandingViews', label: 'Mở từ QR', count: totals.qrLandingViews },
        { key: 'checkIns', label: 'Check-in', count: totals.checkIns },
        { key: 'challengeAttempts', label: 'Gửi đáp án thử thách', count: totals.challengeAttempts },
        { key: 'challengeCompletions', label: 'Hoàn thành thử thách', count: totals.challengeCompletions },
        { key: 'itinerariesGenerated', label: 'Tạo lịch trình', count: totals.itinerariesGenerated },
        { key: 'itinerariesSaved', label: 'Lưu lịch trình', count: totals.itinerariesSaved },
      ],
      rates: {
        pageViewToQr: rate(totals.qrLandingViews, totals.destinationPageViews),
        qrToCheckIn: rate(totals.checkIns, totals.qrLandingViews),
        checkInToChallengeAttempt: rate(totals.challengeAttempts, totals.checkIns),
        attemptToCompletion: rate(totals.challengeCompletions, totals.challengeAttempts),
        generateToSave: rate(totals.itinerariesSaved, totals.itinerariesGenerated),
      },
    },
    definitions: {
      destinationPageViews: 'Số lần mở trang chi tiết địa điểm trực tiếp (gộp lần mở lặp lại của cùng trình duyệt trong 30 phút).',
      qrLandingViews: 'Số lần mở trang đích từ mã QR (gộp lần mở lặp lại trong 10 phút). Không phải số khách du lịch thực tế.',
      interactions: 'Số lần gửi đáp án thử thách cộng số lần check-in.',
      challengeCompletions: 'Số lần hoàn thành thử thách lần đầu và được cấp điểm (mỗi tài khoản/trình duyệt tối đa 1 lần mỗi thử thách).',
      uniqueVisitors:
        'Số định danh khác nhau (tài khoản đã đăng nhập hoặc cookie ẩn danh của trình duyệt). Một người dùng nhiều thiết bị hoặc xóa cookie sẽ bị đếm nhiều lần; đây chỉ là ước lượng.',
      funnel:
        'Tỷ lệ chuyển đổi giữa các bước (phần trăm). Mẫu số bằng 0 thì không tính. Các bước không phải cùng một người dùng đi tuần tự nên đây là ước lượng phễu, không phải hành trình cá nhân.',
    },
  });
}
