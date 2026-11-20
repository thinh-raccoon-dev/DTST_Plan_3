import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { GroupInquiryModel } from '../../models/GroupInquiry.js';
import { PartnerVoucherModel, VOUCHER_STATUSES } from '../../models/PartnerVoucher.js';
import { VoucherClaimModel } from '../../models/VoucherClaim.js';
import { logAuditEvent } from '../../services/audit.service.js';
import { badRequest, notFound } from '../../utils/errors.js';

const SLA_OVERDUE_MS = 48 * 60 * 60 * 1000;

/**
 * Province-wide Partner Commerce & Consumer-Protection Oversight (Admin only):
 * - All Partner Vouchers with claim/redemption conversion rates & emergency suspension controls.
 * - All Group Inquiries with 48h SLA overdue detection & NĐ 13/2023 consent audit.
 */
export async function getAdminCommerceOverview(_req: Request, res: Response) {
  const now = new Date();
  const overdueCutoff = new Date(now.getTime() - SLA_OVERDUE_MS);

  const [vouchers, totalClaims, totalRedeemed, inquiries, inquiryAgg, overdueCount] =
    await Promise.all([
      PartnerVoucherModel.find()
        .populate('destinationId', 'name slug area')
        .sort({ status: 1, createdAt: -1 })
        .limit(80)
        .lean(),
      VoucherClaimModel.countDocuments(),
      VoucherClaimModel.countDocuments({ status: 'redeemed' }),
      GroupInquiryModel.find()
        .populate('destinationId', 'name slug area')
        .sort({ createdAt: -1 })
        .limit(80)
        .lean(),
      GroupInquiryModel.aggregate<{ _id: string; count: number; totalGuests: number }>([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalGuests: { $sum: '$groupSize' },
          },
        },
      ]),
      GroupInquiryModel.countDocuments({
        status: 'new',
        createdAt: { $lt: overdueCutoff },
      }),
    ]);

  const activeVouchers = vouchers.filter(
    (v) => v.status === 'active' && new Date(v.validUntil) > now,
  ).length;

  const inquiryCounts = { new: 0, contacted: 0, confirmed: 0, cancelled: 0, totalGuests: 0 };
  for (const row of inquiryAgg) {
    inquiryCounts.totalGuests += row.totalGuests;
    if (row._id in inquiryCounts) {
      inquiryCounts[row._id as 'new' | 'contacted' | 'confirmed' | 'cancelled'] = row.count;
    }
  }

  res.set('Cache-Control', 'no-store');
  res.json({
    summary: {
      totalVouchers: vouchers.length,
      activeVouchers,
      totalClaims,
      totalRedeemed,
      redemptionRate: totalClaims > 0 ? Math.round((totalRedeemed / totalClaims) * 100) : 0,
      totalInquiries:
        inquiryCounts.new +
        inquiryCounts.contacted +
        inquiryCounts.confirmed +
        inquiryCounts.cancelled,
      newInquiries: inquiryCounts.new,
      confirmedInquiries: inquiryCounts.confirmed,
      overdue48hInquiries: overdueCount,
      totalGroupGuests: inquiryCounts.totalGuests,
    },
    vouchers: vouchers.map((v) => {
      const dest = v.destinationId as unknown as {
        _id?: unknown;
        name?: string;
        slug?: string;
        area?: string;
      } | null;
      return {
        id: String(v._id),
        title: v.title,
        discountLabel: v.discountLabel,
        terms: v.terms,
        pointsCost: v.pointsCost,
        totalQuantity: v.totalQuantity,
        claimedCount: v.claimedCount,
        redeemedCount: v.redeemedCount,
        validUntil: v.validUntil,
        status: v.status,
        isExpired: new Date(v.validUntil) <= now,
        destination: dest?.name
          ? { id: String(dest._id), name: dest.name, slug: dest.slug ?? '', area: dest.area ?? '' }
          : null,
        createdAt: v.createdAt,
      };
    }),
    inquiries: inquiries.map((inq) => {
      const dest = inq.destinationId as unknown as {
        _id?: unknown;
        name?: string;
        slug?: string;
        area?: string;
      } | null;
      const isOverdue48h =
        inq.status === 'new' && new Date(inq.createdAt).getTime() < overdueCutoff.getTime();
      return {
        id: String(inq._id),
        contactName: inq.contactName,
        // Mask middle digits for provincial overview privacy unless needed
        contactPhoneMasked: inq.contactPhone.replace(/^(.{3}).*(.{3})$/, '$1****$2'),
        visitDate: inq.visitDate,
        groupSize: inq.groupSize,
        serviceInterest: inq.serviceInterest || '',
        status: inq.status,
        isOverdue48h,
        consentGiven: inq.consentGiven,
        consentAcceptedAt: inq.consentAcceptedAt,
        partnerReplyNote: inq.partnerReplyNote || '',
        handledAt: inq.handledAt ?? null,
        destination: dest?.name
          ? { id: String(dest._id), name: dest.name, slug: dest.slug ?? '', area: dest.area ?? '' }
          : null,
        createdAt: inq.createdAt,
      };
    }),
  });
}

const suspendVoucherSchema = z.object({
  status: z.enum(VOUCHER_STATUSES),
  reason: z.string().trim().min(5, 'Vui lòng ghi rõ lý do điều chỉnh (tối thiểu 5 ký tự)').max(500),
});

/** Sở VHTTDL emergency suspend/resume for partner vouchers (Luật BVQLNTD 2023 / NĐ 81/2018). */
export async function adminTogglePartnerVoucher(req: Request, res: Response) {
  const id = String(req.params.id || '');
  if (!Types.ObjectId.isValid(id)) throw badRequest('Mã voucher không hợp lệ.');

  const body = suspendVoucherSchema.parse(req.body);
  const voucher = await PartnerVoucherModel.findById(id);
  if (!voucher) throw notFound('Không tìm thấy voucher.');

  voucher.status = body.status;
  await voucher.save();

  await logAuditEvent({
    req,
    action: body.status === 'paused' ? 'voucher.admin_suspend' : 'voucher.admin_resume',
    targetType: 'voucher',
    targetId: voucher._id,
    targetName: voucher.title,
    destinationId: voucher.destinationId,
    details: { status: body.status, reason: body.reason },
  });

  res.json({
    success: true,
    voucher: { id: String(voucher._id), status: voucher.status },
    message:
      body.status === 'paused'
        ? 'Đã tạm đình chỉ phát hành mới voucher này (mã du khách đã đổi vẫn được bảo toàn).'
        : 'Đã mở lại phát hành voucher.',
  });
}
