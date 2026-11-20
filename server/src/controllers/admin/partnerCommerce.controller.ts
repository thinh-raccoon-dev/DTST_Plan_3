import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { BANNER_THEMES, BannerModel } from '../../models/Banner.js';
import { DestinationModel, SERVICE_CATEGORIES } from '../../models/Destination.js';
import { GroupInquiryModel, INQUIRY_STATUSES } from '../../models/GroupInquiry.js';
import { PartnerVoucherModel, VOUCHER_STATUSES } from '../../models/PartnerVoucher.js';
import { VoucherClaimModel } from '../../models/VoucherClaim.js';
import { logAuditEvent } from '../../services/audit.service.js';
import { badRequest, conflict, forbidden, notFound } from '../../utils/errors.js';
import {
  assertPartnerOwnsDestinationId,
  maskVisitorDisplayName,
  resolveScopedDestination,
} from './partner.controller.js';

/* ════════════════════════════════════════════════════════════════════════════
   1. PARTNER VOUCHERS & COUNTER REDEMPTION VERIFIER
   ════════════════════════════════════════════════════════════════════════════ */

const createVoucherSchema = z.object({
  destinationId: z.string().optional(),
  title: z.string().trim().min(4, 'Tên ưu đãi tối thiểu 4 ký tự').max(140),
  description: z.string().trim().max(500).optional(),
  discountLabel: z.string().trim().min(2, 'Mức ưu đãi tối thiểu 2 ký tự').max(80),
  terms: z
    .string()
    .trim()
    .min(10, 'Cần ghi rõ điều kiện áp dụng tối thiểu 10 ký tự theo Luật Bảo vệ quyền lợi người tiêu dùng')
    .max(800),
  pointsCost: z.coerce.number().int().min(0).max(5000).default(50),
  totalQuantity: z.coerce.number().int().min(1).max(50000).default(100),
  maxPerUser: z.coerce.number().int().min(1).max(5).default(1),
  validFrom: z.coerce.date().optional(),
  validUntil: z.coerce.date(),
});

const updateVoucherSchema = z.object({
  title: z.string().trim().min(4).max(140).optional(),
  description: z.string().trim().max(500).optional(),
  discountLabel: z.string().trim().min(2).max(80).optional(),
  terms: z.string().trim().min(10).max(800).optional(),
  pointsCost: z.coerce.number().int().min(0).max(5000).optional(),
  totalQuantity: z.coerce.number().int().min(1).max(50000).optional(),
  maxPerUser: z.coerce.number().int().min(1).max(5).optional(),
  validUntil: z.coerce.date().optional(),
  status: z.enum(VOUCHER_STATUSES).optional(),
});

export async function listPartnerVouchers(req: Request, res: Response) {
  const { destination } = await resolveScopedDestination(req);
  if (!destination) return res.json({ success: true, items: [], recentClaims: [] });

  const [vouchers, recentClaims] = await Promise.all([
    PartnerVoucherModel.find({ destinationId: destination._id })
      .sort({ status: 1, createdAt: -1 })
      .limit(40)
      .lean(),
    VoucherClaimModel.find({ destinationId: destination._id })
      .sort({ redeemedAt: -1, createdAt: -1 })
      .limit(20)
      .populate('userId', 'displayName') // NĐ 13/2023: never expose email/phone
      .lean(),
  ]);

  res.set('Cache-Control', 'no-store');
  res.json({
    success: true,
    items: vouchers.map((v) => ({
      id: String(v._id),
      title: v.title,
      description: v.description || '',
      discountLabel: v.discountLabel,
      terms: v.terms,
      pointsCost: v.pointsCost,
      totalQuantity: v.totalQuantity,
      claimedCount: v.claimedCount,
      redeemedCount: v.redeemedCount,
      remaining: Math.max(0, v.totalQuantity - v.claimedCount),
      maxPerUser: v.maxPerUser,
      validFrom: v.validFrom,
      validUntil: v.validUntil,
      status: v.status,
      isExpired: new Date(v.validUntil) < new Date(),
      createdAt: v.createdAt,
    })),
    recentClaims: recentClaims.map((c) => {
      const u = c.userId as unknown as { displayName?: string } | null;
      return {
        id: String(c._id),
        claimCode: c.claimCode,
        voucherTitle: c.voucherTitle,
        discountLabel: c.discountLabel,
        visitorName: maskVisitorDisplayName(u?.displayName, String(c._id)),
        pointsSpent: c.pointsSpent,
        status: c.status,
        expiresAt: c.expiresAt,
        redeemedAt: c.redeemedAt ?? null,
        redeemNote: c.redeemNote ?? '',
        createdAt: c.createdAt,
      };
    }),
  });
}

export async function createPartnerVoucher(req: Request, res: Response) {
  const body = createVoucherSchema.parse(req.body);
  const { destination } = await resolveScopedDestination(req, body.destinationId);
  if (!destination) throw notFound('Không tìm thấy địa điểm du lịch để phát hành ưu đãi.');

  const validFrom = body.validFrom ?? new Date();
  if (body.validUntil.getTime() <= validFrom.getTime()) {
    throw badRequest('Ngày hết hạn ưu đãi phải sau ngày bắt đầu hiệu lực.', 'VALIDATION_ERROR');
  }
  if (body.validUntil.getTime() <= Date.now()) {
    throw badRequest('Ngày hết hạn ưu đãi phải nằm trong tương lai.', 'VALIDATION_ERROR');
  }

  const activeCount = await PartnerVoucherModel.countDocuments({
    destinationId: destination._id,
    status: 'active',
    validUntil: { $gt: new Date() },
  });
  if (activeCount >= 15) {
    throw badRequest('Mỗi điểm đến tối đa 15 chương trình ưu đãi đang hoạt động cùng lúc.');
  }

  const voucher = await PartnerVoucherModel.create({
    destinationId: destination._id,
    title: body.title,
    description: body.description || '',
    discountLabel: body.discountLabel,
    terms: body.terms,
    pointsCost: body.pointsCost,
    totalQuantity: body.totalQuantity,
    maxPerUser: body.maxPerUser,
    validFrom,
    validUntil: body.validUntil,
    status: 'active',
    createdBy: new Types.ObjectId(req.user!.id),
  });

  await logAuditEvent({
    req,
    action: 'voucher.create',
    targetType: 'voucher',
    targetId: voucher._id,
    targetName: voucher.title,
    destinationId: destination._id,
    details: {
      discountLabel: voucher.discountLabel,
      pointsCost: voucher.pointsCost,
      totalQuantity: voucher.totalQuantity,
      validUntil: voucher.validUntil,
    },
  });

  res.status(201).json({
    success: true,
    voucher: { id: String(voucher._id), title: voucher.title, status: voucher.status },
    message: 'Đã phát hành Voucher ưu đãi Hộ chiếu thành công!',
  });
}

export async function updatePartnerVoucher(req: Request, res: Response) {
  const id = String(req.params.id || '');
  if (!Types.ObjectId.isValid(id)) throw badRequest('Mã ưu đãi không hợp lệ.');

  const body = updateVoucherSchema.parse(req.body);
  const voucher = await PartnerVoucherModel.findById(id);
  if (!voucher) throw notFound('Không tìm thấy chương trình ưu đãi.');

  await assertPartnerOwnsDestinationId(req, voucher.destinationId);

  if (body.totalQuantity !== undefined && body.totalQuantity < voucher.claimedCount) {
    throw badRequest(
      `Không thể giảm tổng số lượng xuống dưới số lượt du khách đã đổi (${voucher.claimedCount}).`,
    );
  }
  if (body.validUntil !== undefined && body.validUntil.getTime() <= voucher.validFrom.getTime()) {
    throw badRequest('Ngày hết hạn phải sau ngày bắt đầu hiệu lực.');
  }

  if (body.title !== undefined) voucher.title = body.title;
  if (body.description !== undefined) voucher.description = body.description;
  if (body.discountLabel !== undefined) voucher.discountLabel = body.discountLabel;
  if (body.terms !== undefined) voucher.terms = body.terms;
  if (body.pointsCost !== undefined) voucher.pointsCost = body.pointsCost;
  if (body.totalQuantity !== undefined) voucher.totalQuantity = body.totalQuantity;
  if (body.maxPerUser !== undefined) voucher.maxPerUser = body.maxPerUser;
  if (body.validUntil !== undefined) voucher.validUntil = body.validUntil;
  if (body.status !== undefined) voucher.status = body.status;

  await voucher.save();

  await logAuditEvent({
    req,
    action: 'voucher.update',
    targetType: 'voucher',
    targetId: voucher._id,
    targetName: voucher.title,
    destinationId: voucher.destinationId,
    details: { status: voucher.status, totalQuantity: voucher.totalQuantity },
  });

  res.json({
    success: true,
    voucher: { id: String(voucher._id), title: voucher.title, status: voucher.status },
    message: 'Đã cập nhật chương trình ưu đãi!',
  });
}

export async function deletePartnerVoucher(req: Request, res: Response) {
  const id = String(req.params.id || '');
  if (!Types.ObjectId.isValid(id)) throw badRequest('Mã ưu đãi không hợp lệ.');

  const voucher = await PartnerVoucherModel.findById(id);
  if (!voucher) throw notFound('Không tìm thấy chương trình ưu đãi.');

  await assertPartnerOwnsDestinationId(req, voucher.destinationId);

  // Consumer protection: if tourists already claimed this voucher, pause issuance instead of deleting!
  if (voucher.claimedCount > 0) {
    voucher.status = 'paused';
    await voucher.save();
    await logAuditEvent({
      req,
      action: 'voucher.pause',
      targetType: 'voucher',
      targetId: voucher._id,
      targetName: voucher.title,
      destinationId: voucher.destinationId,
      details: { reason: 'has_claimed_vouchers', claimedCount: voucher.claimedCount },
    });
    return res.json({
      success: true,
      archived: true,
      message:
        'Ưu đãi đã có du khách đổi nên đã chuyển sang Tạm ngừng phát hành mới để bảo toàn quyền lợi các mã đã cấp.',
    });
  }

  await voucher.deleteOne();
  await logAuditEvent({
    req,
    action: 'voucher.delete',
    targetType: 'voucher',
    targetId: voucher._id,
    targetName: voucher.title,
    destinationId: voucher.destinationId,
    details: {},
  });

  res.json({
    success: true,
    archived: false,
    message: 'Đã xóa chương trình ưu đãi thành công!',
  });
}

export async function lookupPartnerVoucherClaim(req: Request, res: Response) {
  const rawCode = String(req.query.code || '').trim().toUpperCase();
  if (!/^VCH-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(rawCode)) {
    throw badRequest('Định dạng mã ưu đãi không hợp lệ (ví dụ chuẩn: VCH-AB12-CD34).');
  }

  const claim = await VoucherClaimModel.findOne({ claimCode: rawCode })
    .populate('userId', 'displayName')
    .lean();
  if (!claim) {
    throw notFound('Không tìm thấy mã ưu đãi này trong hệ thống.');
  }

  // Zero-IDOR: Partner A cannot inspect or verify vouchers belonging to Partner B!
  await assertPartnerOwnsDestinationId(req, claim.destinationId);

  const isExpired = new Date(claim.expiresAt).getTime() < Date.now();
  const effectiveStatus = claim.status === 'issued' && isExpired ? 'expired' : claim.status;
  const u = claim.userId as unknown as { displayName?: string } | null;

  res.set('Cache-Control', 'no-store');
  res.json({
    success: true,
    claim: {
      id: String(claim._id),
      claimCode: claim.claimCode,
      voucherTitle: claim.voucherTitle,
      discountLabel: claim.discountLabel,
      terms: claim.terms,
      visitorName: maskVisitorDisplayName(u?.displayName, String(claim._id)),
      pointsSpent: claim.pointsSpent,
      status: effectiveStatus,
      canRedeem: effectiveStatus === 'issued',
      expiresAt: claim.expiresAt,
      redeemedAt: claim.redeemedAt ?? null,
      redeemNote: claim.redeemNote ?? '',
    },
  });
}

const redeemClaimSchema = z.object({
  claimCode: z.string().trim().min(6).max(32),
  redeemNote: z.string().trim().max(240).optional(),
});

export async function redeemPartnerVoucherClaim(req: Request, res: Response) {
  const body = redeemClaimSchema.parse(req.body);
  const code = body.claimCode.toUpperCase();
  if (!/^VCH-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) {
    throw badRequest('Định dạng mã ưu đãi không hợp lệ (ví dụ: VCH-AB12-CD34).');
  }

  const existing = await VoucherClaimModel.findOne({ claimCode: code }).lean();
  if (!existing) {
    throw notFound('Không tìm thấy mã ưu đãi này.');
  }

  // Zero-IDOR check BEFORE any state mutation
  await assertPartnerOwnsDestinationId(req, existing.destinationId);

  if (existing.status === 'redeemed') {
    throw conflict('Mã ưu đãi này đã được đối soát sử dụng trước đó!', 'ALREADY_REDEEMED');
  }
  if (new Date(existing.expiresAt).getTime() < Date.now()) {
    await VoucherClaimModel.updateOne(
      { _id: existing._id, status: 'issued' },
      { $set: { status: 'expired' } },
    );
    throw badRequest('Mã ưu đãi này đã hết hạn sử dụng.', 'VOUCHER_EXPIRED');
  }

  // Atomic CAS (Compare-And-Swap): prevents double redemption even under concurrent requests!
  const updated = await VoucherClaimModel.findOneAndUpdate(
    { _id: existing._id, status: 'issued' },
    {
      $set: {
        status: 'redeemed',
        redeemedAt: new Date(),
        redeemedBy: new Types.ObjectId(req.user!.id),
        redeemNote: body.redeemNote || '',
      },
    },
    { new: true },
  )
    .populate('userId', 'displayName')
    .lean();

  if (!updated) {
    throw conflict('Mã ưu đãi vừa được đối soát bởi thiết bị khác!', 'ALREADY_REDEEMED');
  }

  await PartnerVoucherModel.updateOne(
    { _id: updated.voucherId },
    { $inc: { redeemedCount: 1 } },
  );

  await logAuditEvent({
    req,
    action: 'voucher.redeem',
    targetType: 'voucher',
    targetId: updated._id,
    targetName: `${updated.claimCode} — ${updated.voucherTitle}`,
    destinationId: updated.destinationId,
    details: {
      claimCode: updated.claimCode,
      discountLabel: updated.discountLabel,
      redeemNote: updated.redeemNote || '',
    },
  });

  const u = updated.userId as unknown as { displayName?: string } | null;
  res.json({
    success: true,
    claim: {
      id: String(updated._id),
      claimCode: updated.claimCode,
      voucherTitle: updated.voucherTitle,
      discountLabel: updated.discountLabel,
      visitorName: maskVisitorDisplayName(u?.displayName, String(updated._id)),
      status: updated.status,
      redeemedAt: updated.redeemedAt,
    },
    message: `Đã đối soát thành công mã ${updated.claimCode} (${updated.discountLabel})!`,
  });
}

/* ════════════════════════════════════════════════════════════════════════════
   2. STRUCTURED SERVICE / COMBO PRICE CATALOG (Luật Giá 2023 & Luật Du lịch)
   ════════════════════════════════════════════════════════════════════════════ */

const createServiceSchema = z.object({
  destinationId: z.string().optional(),
  name: z.string().trim().min(2, 'Tên dịch vụ tối thiểu 2 ký tự').max(120),
  category: z.enum(SERVICE_CATEGORIES).default('ticket'),
  priceVnd: z.coerce.number().int().min(0).max(50_000_000),
  unit: z.string().trim().min(1).max(40).default('người'),
  durationMinutes: z.coerce.number().int().min(5).max(1440).optional(),
  description: z.string().trim().max(300).optional(),
  includesVat: z.boolean().default(true),
  isAvailable: z.boolean().default(true),
});

const updateServiceSchema = z.object({
  destinationId: z.string().optional(),
  name: z.string().trim().min(2).max(120).optional(),
  category: z.enum(SERVICE_CATEGORIES).optional(),
  priceVnd: z.coerce.number().int().min(0).max(50_000_000).optional(),
  unit: z.string().trim().min(1).max(40).optional(),
  durationMinutes: z.coerce.number().int().min(5).max(1440).nullable().optional(),
  description: z.string().trim().max(300).optional(),
  includesVat: z.boolean().optional(),
  isAvailable: z.boolean().optional(),
});

export async function listPartnerServices(req: Request, res: Response) {
  const { destination } = await resolveScopedDestination(req);
  if (!destination) return res.json({ success: true, items: [] });

  const items = (destination.services ?? []).map((s) => ({
    id: String(s._id),
    name: s.name,
    category: s.category,
    priceVnd: s.priceVnd,
    unit: s.unit ?? 'người',
    durationMinutes: s.durationMinutes ?? null,
    description: s.description ?? '',
    includesVat: s.includesVat !== false,
    isAvailable: s.isAvailable !== false,
  }));

  res.set('Cache-Control', 'no-store');
  res.json({ success: true, items });
}

export async function createPartnerService(req: Request, res: Response) {
  const body = createServiceSchema.parse(req.body);
  const { destination } = await resolveScopedDestination(req, body.destinationId);
  if (!destination) throw notFound('Không tìm thấy địa điểm để thêm dịch vụ.');

  const doc = await DestinationModel.findById(destination._id);
  if (!doc) throw notFound('Không tìm thấy địa điểm.');

  if ((doc.services?.length ?? 0) >= 30) {
    throw badRequest('Mỗi địa điểm hỗ trợ tối đa 30 hạng mục giá/dịch vụ niêm yết.');
  }

  doc.services.push({
    name: body.name,
    category: body.category,
    priceVnd: body.priceVnd,
    unit: body.unit,
    durationMinutes: body.durationMinutes,
    description: body.description || '',
    includesVat: body.includesVat,
    isAvailable: body.isAvailable,
  });
  await doc.save();

  const created = doc.services[doc.services.length - 1]!;
  await logAuditEvent({
    req,
    action: 'service.create',
    targetType: 'service',
    targetId: created._id,
    targetName: created.name,
    destinationId: doc._id,
    details: { priceVnd: created.priceVnd, unit: created.unit, category: created.category },
  });

  res.status(201).json({
    success: true,
    service: {
      id: String(created._id),
      name: created.name,
      category: created.category,
      priceVnd: created.priceVnd,
      unit: created.unit,
      durationMinutes: created.durationMinutes ?? null,
      description: created.description ?? '',
      includesVat: created.includesVat !== false,
      isAvailable: created.isAvailable !== false,
    },
    message: 'Đã niêm yết dịch vụ/combo mới thành công!',
  });
}

export async function updatePartnerService(req: Request, res: Response) {
  const serviceId = String(req.params.serviceId || '');
  if (!Types.ObjectId.isValid(serviceId)) throw badRequest('Mã dịch vụ không hợp lệ.');

  const body = updateServiceSchema.parse(req.body);
  const doc = await DestinationModel.findOne({ 'services._id': new Types.ObjectId(serviceId) });
  if (!doc) throw notFound('Không tìm thấy hạng mục dịch vụ.');

  await assertPartnerOwnsDestinationId(req, doc._id);

  const item = doc.services.id(serviceId);
  if (!item) throw notFound('Không tìm thấy hạng mục dịch vụ.');

  if (body.name !== undefined) item.name = body.name;
  if (body.category !== undefined) item.category = body.category;
  if (body.priceVnd !== undefined) item.priceVnd = body.priceVnd;
  if (body.unit !== undefined) item.unit = body.unit;
  if (body.durationMinutes !== undefined) {
    item.durationMinutes = body.durationMinutes === null ? undefined : body.durationMinutes;
  }
  if (body.description !== undefined) item.description = body.description;
  if (body.includesVat !== undefined) item.includesVat = body.includesVat;
  if (body.isAvailable !== undefined) item.isAvailable = body.isAvailable;

  await doc.save();

  await logAuditEvent({
    req,
    action: 'service.update',
    targetType: 'service',
    targetId: item._id,
    targetName: item.name,
    destinationId: doc._id,
    details: { priceVnd: item.priceVnd, isAvailable: item.isAvailable },
  });

  res.json({
    success: true,
    service: {
      id: String(item._id),
      name: item.name,
      priceVnd: item.priceVnd,
      isAvailable: item.isAvailable,
    },
    message: 'Đã cập nhật giá dịch vụ niêm yết!',
  });
}

export async function deletePartnerService(req: Request, res: Response) {
  const serviceId = String(req.params.serviceId || '');
  if (!Types.ObjectId.isValid(serviceId)) throw badRequest('Mã dịch vụ không hợp lệ.');

  const doc = await DestinationModel.findOne({ 'services._id': new Types.ObjectId(serviceId) });
  if (!doc) throw notFound('Không tìm thấy hạng mục dịch vụ.');

  await assertPartnerOwnsDestinationId(req, doc._id);

  const item = doc.services.id(serviceId);
  if (!item) throw notFound('Không tìm thấy hạng mục dịch vụ.');

  const itemName = item.name;
  item.deleteOne();
  await doc.save();

  await logAuditEvent({
    req,
    action: 'service.delete',
    targetType: 'service',
    targetId: serviceId,
    targetName: itemName,
    destinationId: doc._id,
    details: {},
  });

  res.json({ success: true, message: 'Đã gỡ hạng mục dịch vụ khỏi bảng giá.' });
}

/* ════════════════════════════════════════════════════════════════════════════
   3. GROUP BOOKING / INQUIRY INBOX (NĐ 13/2023 Consent Tracked)
   ════════════════════════════════════════════════════════════════════════════ */

const updateInquirySchema = z.object({
  status: z.enum(INQUIRY_STATUSES),
  partnerReplyNote: z.string().trim().max(800).optional(),
});

export async function listPartnerInquiries(req: Request, res: Response) {
  const { destination } = await resolveScopedDestination(req);
  if (!destination) {
    return res.json({
      success: true,
      items: [],
      counts: { new: 0, contacted: 0, confirmed: 0, cancelled: 0 },
    });
  }

  const statusFilter = String(req.query.status || '').trim();
  const filter: Record<string, unknown> = { destinationId: destination._id };
  if (statusFilter && (INQUIRY_STATUSES as readonly string[]).includes(statusFilter)) {
    filter.status = statusFilter;
  }

  const [items, countAgg] = await Promise.all([
    GroupInquiryModel.find(filter).sort({ createdAt: -1 }).limit(60).lean(),
    GroupInquiryModel.aggregate<{ _id: string; count: number }>([
      { $match: { destinationId: destination._id } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
  ]);

  const counts = { new: 0, contacted: 0, confirmed: 0, cancelled: 0 };
  for (const row of countAgg) {
    if (row._id in counts) counts[row._id as keyof typeof counts] = row.count;
  }

  res.set('Cache-Control', 'no-store');
  res.json({
    success: true,
    counts,
    items: items.map((i) => ({
      id: String(i._id),
      contactName: i.contactName,
      contactPhone: i.contactPhone,
      contactEmail: i.contactEmail || null,
      visitDate: i.visitDate,
      groupSize: i.groupSize,
      serviceInterest: i.serviceInterest || '',
      notes: i.notes || '',
      consentGiven: i.consentGiven,
      consentAcceptedAt: i.consentAcceptedAt,
      status: i.status,
      partnerReplyNote: i.partnerReplyNote || '',
      handledAt: i.handledAt ?? null,
      createdAt: i.createdAt,
    })),
  });
}

export async function updatePartnerInquiry(req: Request, res: Response) {
  const id = String(req.params.id || '');
  if (!Types.ObjectId.isValid(id)) throw badRequest('Mã yêu cầu đặt đoàn không hợp lệ.');

  const body = updateInquirySchema.parse(req.body);
  const inquiry = await GroupInquiryModel.findById(id);
  if (!inquiry) throw notFound('Không tìm thấy yêu cầu đặt đoàn.');

  await assertPartnerOwnsDestinationId(req, inquiry.destinationId);

  inquiry.status = body.status;
  if (body.partnerReplyNote !== undefined) {
    inquiry.partnerReplyNote = body.partnerReplyNote;
  }
  inquiry.handledBy = new Types.ObjectId(req.user!.id);
  inquiry.handledAt = new Date();
  await inquiry.save();

  await logAuditEvent({
    req,
    action: 'inquiry.update',
    targetType: 'inquiry',
    targetId: inquiry._id,
    targetName: `Đoàn ${inquiry.groupSize} khách — ${inquiry.contactName}`,
    destinationId: inquiry.destinationId,
    details: { status: inquiry.status },
  });

  res.json({
    success: true,
    inquiry: {
      id: String(inquiry._id),
      status: inquiry.status,
      partnerReplyNote: inquiry.partnerReplyNote,
      handledAt: inquiry.handledAt,
    },
    message: 'Đã cập nhật trạng thái xử lý yêu cầu đặt đoàn!',
  });
}

/* ════════════════════════════════════════════════════════════════════════════
   4. SEASONAL PROMO BANNER SUBMISSION WORKFLOW (Partner Submit -> Admin Approve)
   ════════════════════════════════════════════════════════════════════════════ */

const safeImageUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine((val) => !val || /^(\/uploads\/|https?:\/\/)/i.test(val), {
    message: 'Ảnh banner phải dùng liên kết http(s):// hoặc ảnh tải lên hệ thống.',
  })
  .optional();

const submitPartnerBannerSchema = z.object({
  destinationId: z.string().optional(),
  kind: z.enum(['event', 'promo']).default('promo'),
  theme: z.enum(BANNER_THEMES).default('forest'),
  eyebrow: z.string().trim().max(60).optional(),
  title: z.string().trim().min(5, 'Tiêu đề banner tối thiểu 5 ký tự').max(120),
  subtitle: z.string().trim().min(10, 'Mô tả ngắn tối thiểu 10 ký tự').max(300),
  imageUrl: safeImageUrlSchema,
  linkLabel: z.string().trim().max(40).optional(),
  startAt: z.coerce.date().optional(),
  endAt: z.coerce.date().optional(),
});

export async function listPartnerBanners(req: Request, res: Response) {
  const { destination } = await resolveScopedDestination(req);
  if (!destination) return res.json({ success: true, items: [] });

  const banners = await BannerModel.find({ destinationId: destination._id })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  res.set('Cache-Control', 'no-store');
  res.json({
    success: true,
    items: banners.map((b) => ({
      id: String(b._id),
      kind: b.kind,
      theme: b.theme,
      eyebrow: b.eyebrow || '',
      title: b.title,
      subtitle: b.subtitle || '',
      imageUrl: b.imageUrl || null,
      linkUrl: b.linkUrl || null,
      linkLabel: b.linkLabel || 'Xem điểm đến',
      sponsorName: b.sponsorName || destination.name,
      approvalStatus: b.approvalStatus ?? 'approved',
      reviewFeedback: b.reviewFeedback || '',
      status: b.status,
      startAt: b.startAt ?? null,
      endAt: b.endAt ?? null,
      impressions: b.impressions ?? 0,
      clicks: b.clicks ?? 0,
      createdAt: b.createdAt,
    })),
  });
}

export async function submitPartnerBanner(req: Request, res: Response) {
  const body = submitPartnerBannerSchema.parse(req.body);
  const { destination } = await resolveScopedDestination(req, body.destinationId);
  if (!destination) throw notFound('Không tìm thấy địa điểm để gửi duyệt banner.');

  if (body.startAt && body.endAt && body.endAt.getTime() <= body.startAt.getTime()) {
    throw badRequest('Ngày kết thúc chiến dịch phải sau ngày bắt đầu.');
  }

  const pendingCount = await BannerModel.countDocuments({
    destinationId: destination._id,
    approvalStatus: 'pending_review',
  });
  if (pendingCount >= 3) {
    throw badRequest(
      'Địa điểm đang có 3 banner chờ Sở VHTTDL duyệt. Vui lòng đợi phản hồi hoặc rút bớt trước khi gửi mới.',
    );
  }

  const fallbackImage = destination.images?.[0]?.url || undefined;

  // Security & Luật Quảng cáo 2012: Partner NEVER self-activates; link ALWAYS targets internal destination page!
  const banner = await BannerModel.create({
    placement: 'home_top',
    kind: body.kind,
    theme: body.theme,
    eyebrow: body.eyebrow || 'Sự kiện KDL Đồng Tháp',
    title: body.title,
    subtitle: body.subtitle,
    imageUrl: body.imageUrl || fallbackImage,
    imageAlt: body.title,
    linkUrl: `/destinations/${destination.slug}`,
    linkLabel: body.linkLabel || 'Khám phá ngay',
    sponsorName: destination.name,
    destinationId: destination._id,
    submittedBy: new Types.ObjectId(req.user!.id),
    approvalStatus: 'pending_review',
    status: 'inactive',
    startAt: body.startAt,
    endAt: body.endAt,
    sortOrder: 50,
  });

  await logAuditEvent({
    req,
    action: 'banner.submit',
    targetType: 'banner',
    targetId: banner._id,
    targetName: banner.title,
    destinationId: destination._id,
    details: { kind: banner.kind, approvalStatus: banner.approvalStatus },
  });

  res.status(201).json({
    success: true,
    banner: {
      id: String(banner._id),
      title: banner.title,
      approvalStatus: banner.approvalStatus,
      status: banner.status,
    },
    message: 'Đã gửi Banner mùa vụ tới Sở VHTTDL kiểm duyệt! Banner sẽ hiển thị sau khi được phê duyệt.',
  });
}

export async function withdrawPartnerBanner(req: Request, res: Response) {
  const id = String(req.params.id || '');
  if (!Types.ObjectId.isValid(id)) throw badRequest('Mã banner không hợp lệ.');

  const banner = await BannerModel.findById(id);
  if (!banner) throw notFound('Không tìm thấy banner.');
  if (!banner.destinationId) {
    throw forbidden('Không thể thao tác trên banner hệ thống chung.');
  }

  await assertPartnerOwnsDestinationId(req, banner.destinationId);

  if (banner.approvalStatus === 'approved' && banner.status === 'active') {
    // Partner can pause an already-live banner, or ask admin — safest is deactivating it cleanly
    banner.status = 'inactive';
    await banner.save();
    await logAuditEvent({
      req,
      action: 'banner.pause',
      targetType: 'banner',
      targetId: banner._id,
      targetName: banner.title,
      destinationId: banner.destinationId,
      details: {},
    });
    return res.json({
      success: true,
      archived: true,
      message: 'Đã tạm ngừng hiển thị banner trên Trang chủ.',
    });
  }

  const destId = banner.destinationId;
  const title = banner.title;
  await banner.deleteOne();

  await logAuditEvent({
    req,
    action: 'banner.withdraw',
    targetType: 'banner',
    targetId: id,
    targetName: title,
    destinationId: destId,
    details: {},
  });

  res.json({ success: true, archived: false, message: 'Đã rút hồ sơ banner thành công.' });
}
