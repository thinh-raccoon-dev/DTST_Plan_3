import { randomInt } from 'node:crypto';
import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { GroupInquiryModel } from '../models/GroupInquiry.js';
import { PartnerVoucherModel } from '../models/PartnerVoucher.js';
import { PassportEntryModel } from '../models/PassportEntry.js';
import { VoucherClaimModel } from '../models/VoucherClaim.js';
import { findPublishedDestinationBySlug } from '../services/destination.service.js';
import { badRequest, conflict, notFound } from '../utils/errors.js';

const CLAIM_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

async function generateUniqueClaimCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    let p1 = '';
    let p2 = '';
    for (let i = 0; i < 4; i += 1) {
      p1 += CLAIM_ALPHABET[randomInt(CLAIM_ALPHABET.length)];
      p2 += CLAIM_ALPHABET[randomInt(CLAIM_ALPHABET.length)];
    }
    const candidate = `VCH-${p1}-${p2}`;
    const exists = await VoucherClaimModel.exists({ claimCode: candidate });
    if (!exists) return candidate;
  }
  const ts = Date.now().toString(36).toUpperCase().slice(-8).padStart(8, 'X');
  return `VCH-${ts.slice(0, 4)}-${ts.slice(4, 8)}`;
}

async function computeUserExpBalance(userId: Types.ObjectId) {
  const [earnedAgg, spentAgg] = await Promise.all([
    PassportEntryModel.aggregate<{ total: number }>([
      { $match: { userId } },
      { $group: { _id: null, total: { $sum: '$scoreAwarded' } } },
    ]),
    VoucherClaimModel.aggregate<{ total: number }>([
      { $match: { userId } },
      { $group: { _id: null, total: { $sum: '$pointsSpent' } } },
    ]),
  ]);

  const totalEarnedExp = earnedAgg[0]?.total ?? 0;
  const totalSpentExp = spentAgg[0]?.total ?? 0;
  const spendableExp = Math.max(0, totalEarnedExp - totalSpentExp);
  return { totalEarnedExp, totalSpentExp, spendableExp };
}

/* ── 1. Public active vouchers for a Destination ── */
export async function listDestinationVouchers(req: Request, res: Response) {
  const slug = String(req.params.slug || '').trim().toLowerCase();
  const destination = await findPublishedDestinationBySlug(slug);
  if (!destination) throw notFound('Không tìm thấy địa điểm du lịch.');

  const now = new Date();
  const vouchers = await PartnerVoucherModel.find({
    destinationId: destination._id,
    status: 'active',
    validFrom: { $lte: now },
    validUntil: { $gt: now },
  })
    .sort({ pointsCost: 1, createdAt: -1 })
    .limit(20)
    .lean();

  const myClaimsMap = new Map<string, number>();
  let balance: { totalEarnedExp: number; totalSpentExp: number; spendableExp: number } | null = null;

  if (req.user) {
    const uid = new Types.ObjectId(req.user.id);
    const [bal, myClaimsAgg] = await Promise.all([
      computeUserExpBalance(uid),
      vouchers.length > 0
        ? VoucherClaimModel.aggregate<{ _id: Types.ObjectId; count: number }>([
            {
              $match: {
                userId: uid,
                voucherId: { $in: vouchers.map((v) => v._id) },
              },
            },
            { $group: { _id: '$voucherId', count: { $sum: 1 } } },
          ])
        : Promise.resolve([]),
    ]);
    balance = bal;
    for (const row of myClaimsAgg) {
      myClaimsMap.set(String(row._id), row.count);
    }
  }

  res.set('Cache-Control', 'no-store');
  res.json({
    success: true,
    balance,
    items: vouchers.map((v) => {
      const remaining = Math.max(0, v.totalQuantity - v.claimedCount);
      const myClaimCount = myClaimsMap.get(String(v._id)) ?? 0;
      return {
        id: String(v._id),
        title: v.title,
        description: v.description || '',
        discountLabel: v.discountLabel,
        terms: v.terms,
        pointsCost: v.pointsCost,
        totalQuantity: v.totalQuantity,
        remaining,
        maxPerUser: v.maxPerUser,
        myClaimCount,
        canClaimMore: remaining > 0 && myClaimCount < v.maxPerUser,
        validFrom: v.validFrom,
        validUntil: v.validUntil,
      };
    }),
  });
}

/* ── 2. Tourist Claims a Voucher using Spendable Passport EXP (Atomic Anti-Oversell) ── */
export async function claimDestinationVoucher(req: Request, res: Response) {
  const id = String(req.params.id || '');
  if (!Types.ObjectId.isValid(id)) throw badRequest('Mã ưu đãi không hợp lệ.');

  const userId = new Types.ObjectId(req.user!.id);
  const now = new Date();
  const voucher = await PartnerVoucherModel.findById(id).lean();
  if (!voucher) throw notFound('Không tìm thấy chương trình ưu đãi.');

  if (voucher.status !== 'active') {
    throw badRequest('Chương trình ưu đãi này hiện đang tạm ngừng phát hành.');
  }
  if (new Date(voucher.validFrom) > now) {
    throw badRequest('Chương trình ưu đãi chưa đến thời gian mở đổi.');
  }
  if (new Date(voucher.validUntil) <= now) {
    throw badRequest('Chương trình ưu đãi đã hết hạn.');
  }

  const [myClaimCount, balance] = await Promise.all([
    VoucherClaimModel.countDocuments({ voucherId: voucher._id, userId }),
    computeUserExpBalance(userId),
  ]);

  if (myClaimCount >= voucher.maxPerUser) {
    throw conflict(
      `Bạn đã đạt giới hạn đổi tối đa ${voucher.maxPerUser} lượt cho ưu đãi này.`,
      'CLAIM_LIMIT_REACHED',
    );
  }
  if (balance.spendableExp < voucher.pointsCost) {
    throw badRequest(
      `Điểm EXP khả dụng chưa đủ (bạn có ${balance.spendableExp} EXP, cần ${voucher.pointsCost} EXP). Hãy check-in hoặc giải đố thêm để tích lũy nhé!`,
      'INSUFFICIENT_EXP',
    );
  }

  // Atomic conditional increment — prevents overselling under concurrent tourist requests!
  const reserved = await PartnerVoucherModel.findOneAndUpdate(
    {
      _id: voucher._id,
      status: 'active',
      validUntil: { $gt: now },
      $expr: { $lt: ['$claimedCount', '$totalQuantity'] },
    },
    { $inc: { claimedCount: 1 } },
    { new: true },
  );

  if (!reserved) {
    throw conflict('Ưu đãi này đã hết lượt phát hành.', 'VOUCHER_SOLD_OUT');
  }

  try {
    const claimCode = await generateUniqueClaimCode();
    const claim = await VoucherClaimModel.create({
      voucherId: voucher._id,
      destinationId: voucher.destinationId,
      userId,
      claimCode,
      voucherTitle: voucher.title,
      discountLabel: voucher.discountLabel,
      terms: voucher.terms,
      pointsSpent: voucher.pointsCost,
      status: 'issued',
      expiresAt: voucher.validUntil,
    });

    const newBalance = await computeUserExpBalance(userId);
    res.status(201).json({
      success: true,
      claim: {
        id: String(claim._id),
        claimCode: claim.claimCode,
        voucherTitle: claim.voucherTitle,
        discountLabel: claim.discountLabel,
        terms: claim.terms,
        pointsSpent: claim.pointsSpent,
        status: claim.status,
        expiresAt: claim.expiresAt,
      },
      balance: newBalance,
      message: `Đổi ưu đãi thành công! Xuất trình mã ${claim.claimCode} tại quầy vé để áp dụng.`,
    });
  } catch (err) {
    // Roll back reservation if claim creation fails unexpectedly
    await PartnerVoucherModel.updateOne({ _id: voucher._id }, { $inc: { claimedCount: -1 } });
    throw err;
  }
}

/* ── 3. Tourist Wallet of Claimed Vouchers (for PassportPage) ── */
export async function listMyVoucherClaims(req: Request, res: Response) {
  const userId = new Types.ObjectId(req.user!.id);
  const [balance, claims] = await Promise.all([
    computeUserExpBalance(userId),
    VoucherClaimModel.find({ userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('destinationId', 'name slug area')
      .lean(),
  ]);

  const now = Date.now();
  res.set('Cache-Control', 'no-store');
  res.json({
    success: true,
    balance,
    items: claims.map((c) => {
      const dest = c.destinationId as unknown as {
        _id: Types.ObjectId;
        name: string;
        slug: string;
        area: string;
      } | null;
      const effectiveStatus =
        c.status === 'issued' && new Date(c.expiresAt).getTime() < now ? 'expired' : c.status;

      return {
        id: String(c._id),
        claimCode: c.claimCode,
        voucherTitle: c.voucherTitle,
        discountLabel: c.discountLabel,
        terms: c.terms,
        pointsSpent: c.pointsSpent,
        status: effectiveStatus,
        expiresAt: c.expiresAt,
        redeemedAt: c.redeemedAt ?? null,
        createdAt: c.createdAt,
        destination: dest
          ? { id: String(dest._id), name: dest.name, slug: dest.slug, area: dest.area }
          : null,
      };
    }),
  });
}

/* ── 4. Public / Tourist Group Booking Inquiry (Strict NĐ 13/2023 Consent) ── */
const createInquirySchema = z.object({
  contactName: z.string().trim().min(2, 'Vui lòng nhập họ tên người liên hệ').max(100),
  contactPhone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s().]{9,20}$/, 'Số điện thoại liên hệ không hợp lệ (9–20 ký tự số)'),
  contactEmail: z.string().trim().email('Email không hợp lệ').max(160).optional().or(z.literal('')),
  visitDate: z.coerce.date(),
  groupSize: z.coerce.number().int().min(1, 'Số lượng khách tối thiểu 1 người').max(500),
  serviceInterest: z.string().trim().max(160).optional(),
  notes: z.string().trim().max(1000).optional(),
  consentGiven: z.literal(true, {
    errorMap: () => ({
      message:
        'Bạn cần xác nhận đồng ý chia sẻ thông tin liên hệ với Ban Quản lý KDL theo Nghị định 13/2023/NĐ-CP.',
    }),
  }),
});

export async function createGroupInquiry(req: Request, res: Response) {
  const slug = String(req.params.slug || '').trim().toLowerCase();
  const destination = await findPublishedDestinationBySlug(slug);
  if (!destination) throw notFound('Không tìm thấy địa điểm du lịch.');

  const body = createInquirySchema.parse(req.body);
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  if (body.visitDate.getTime() < yesterday.getTime()) {
    throw badRequest('Ngày dự kiến tham quan không thể nằm trong quá khứ.', 'VALIDATION_ERROR');
  }

  const inquiry = await GroupInquiryModel.create({
    destinationId: destination._id,
    userId: req.user ? new Types.ObjectId(req.user.id) : undefined,
    contactName: body.contactName,
    contactPhone: body.contactPhone,
    contactEmail: body.contactEmail || undefined,
    visitDate: body.visitDate,
    groupSize: body.groupSize,
    serviceInterest: body.serviceInterest || '',
    notes: body.notes || '',
    consentGiven: true,
    consentAcceptedAt: new Date(),
    status: 'new',
  });

  res.status(201).json({
    success: true,
    inquiry: {
      id: String(inquiry._id),
      destinationName: destination.name,
      visitDate: inquiry.visitDate,
      groupSize: inquiry.groupSize,
      status: inquiry.status,
    },
    message: `Đã gửi yêu cầu tư vấn đoàn tới Ban Quản lý ${destination.name}! Nhân viên KDL sẽ liên hệ với bạn sớm nhất.`,
  });
}
