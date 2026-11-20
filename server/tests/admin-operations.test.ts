import { describe, expect, it } from 'vitest';
import { AuditLogModel } from '../src/models/AuditLog.js';
import { GroupInquiryModel } from '../src/models/GroupInquiry.js';
import { PartnerVoucherModel } from '../src/models/PartnerVoucher.js';
import { PassportEntryModel } from '../src/models/PassportEntry.js';
import { SafetyAlertModel } from '../src/models/SafetyAlert.js';
import { VoucherClaimModel } from '../src/models/VoucherClaim.js';
import {
  createDestination,
  loggedInClient,
  useTestDatabase,
} from './helpers.js';

useTestDatabase();

describe('Admin Đợt 2 — Safety Command, Commerce Oversight, Provincial Analytics, Exports & Partner Assignment', () => {
  it('lists all safety alerts (admin + partner) and lets Admin deactivate partner alerts', async () => {
    const { client: admin } = await loggedInClient('admin');
    const { client: partner, user: partnerUser } = await loggedInClient('partner');
    const dest = await createDestination({
      name: 'KDL Sinh Thái Gáo Giồng',
      slug: 'gao-giong-safety',
      managedBy: partnerUser._id,
      coordinates: { lat: 10.584, lng: 105.661 },
    });

    // Partner creates a field alert via Partner Hub
    const partnerAlertRes = await partner.post('/api/v1/admin/partner/alerts', {
      destinationId: dest.id,
      type: 'flood',
      severity: 'warning',
      title: 'Mực nước kênh nội đồng tăng nhẹ',
      description: 'Tạm chuyển sang xuồng máy lớn có áo phao bắt buộc tại bến 2.',
      radiusKm: 5,
      terrainImpact: 'coastal_river',
      hoursValid: 24,
    });
    expect(partnerAlertRes.status).toBe(201);

    // Admin creates a province-wide storm alert
    const adminAlertRes = await admin.post('/api/v1/safety/alerts', {
      type: 'storm',
      severity: 'critical',
      title: 'Cảnh báo dông lốc diện rộng Đồng Tháp',
      description: 'Dự báo mưa lớn kèm gió giật mạnh chiều nay trên toàn khu vực Cao Lãnh - Tam Nông.',
      coordinates: { lat: 10.4602, lng: 105.6329 },
      radiusKm: 45,
      areaLabel: 'Toàn tỉnh Đồng Tháp',
      terrainImpact: 'all',
      hoursValid: 24,
    });
    expect(adminAlertRes.status).toBe(201);

    // Admin lists all alerts across sources
    const listAll = await admin.get('/api/v1/admin/safety-alerts');
    expect(listAll.status).toBe(200);
    expect(listAll.body.stats.activeCount).toBe(2);
    expect(listAll.body.stats.partnerActiveCount).toBe(1);
    expect(listAll.body.items).toHaveLength(2);

    // Admin filters partner alerts & deactivates the partner alert
    const partnerOnly = await admin.get('/api/v1/admin/safety-alerts?source=partner');
    expect(partnerOnly.status).toBe(200);
    expect(partnerOnly.body.items).toHaveLength(1);
    const partnerAlertId = partnerOnly.body.items[0].id as string;

    const deactivate = await admin.delete(`/api/v1/safety/alerts/${partnerAlertId}`);
    expect(deactivate.status).toBe(200);
    const afterDoc = await SafetyAlertModel.findById(partnerAlertId).lean();
    expect(afterDoc?.isActive).toBe(false);
  });

  it('monitors partner commerce (vouchers + 48h overdue inquiries) and supports emergency voucher suspension with reason', async () => {
    const { client: admin } = await loggedInClient('admin');
    const { user: partnerUser } = await loggedInClient('partner');
    const { user: touristUser } = await loggedInClient('tourist');
    const dest = await createDestination({
      name: 'Làng Hoa Sa Đéc Commerce',
      slug: 'lang-hoa-sa-dec-commerce',
      managedBy: partnerUser._id,
    });

    const voucher = await PartnerVoucherModel.create({
      destinationId: dest._id,
      title: 'Giảm 20% vé tham quan vườn hoa',
      discountLabel: 'Giảm 20%',
      terms: 'Áp dụng cho du khách đổi bằng 50 EXP tại cổng chính.',
      pointsCost: 50,
      totalQuantity: 100,
      claimedCount: 2,
      redeemedCount: 1,
      validUntil: new Date(Date.now() + 14 * 86400000),
      status: 'active',
      createdBy: partnerUser._id,
    });

    await VoucherClaimModel.create([
      {
        voucherId: voucher._id,
        destinationId: dest._id,
        userId: touristUser._id,
        claimCode: 'VCH-1111-AAAA',
        voucherTitle: voucher.title,
        discountLabel: voucher.discountLabel,
        terms: voucher.terms,
        pointsSpent: 50,
        status: 'redeemed',
        expiresAt: voucher.validUntil,
      },
      {
        voucherId: voucher._id,
        destinationId: dest._id,
        userId: partnerUser._id,
        claimCode: 'VCH-2222-BBBB',
        voucherTitle: voucher.title,
        discountLabel: voucher.discountLabel,
        terms: voucher.terms,
        pointsSpent: 50,
        expiresAt: voucher.validUntil,
      },
    ]);

    // Create an overdue inquiry (> 48h ago, still status='new')
    const overdueCreatedAt = new Date(Date.now() - 72 * 3600 * 1000);
    const inq = await GroupInquiryModel.create({
      destinationId: dest._id,
      userId: touristUser._id,
      contactName: 'Trần Minh Đoàn',
      contactPhone: '0912345678',
      visitDate: new Date(Date.now() + 5 * 86400000),
      groupSize: 25,
      serviceInterest: 'Tour trải nghiệm xuồng chèo',
      status: 'new',
      consentGiven: true,
      consentAcceptedAt: overdueCreatedAt,
    });
    await GroupInquiryModel.collection.updateOne(
      { _id: inq._id },
      { $set: { createdAt: overdueCreatedAt } },
    );

    const overview = await admin.get('/api/v1/admin/commerce/overview');
    expect(overview.status).toBe(200);
    expect(overview.body.summary).toMatchObject({
      totalVouchers: 1,
      activeVouchers: 1,
      totalClaims: 2,
      totalRedeemed: 1,
      redemptionRate: 50,
      totalInquiries: 1,
      newInquiries: 1,
      overdue48hInquiries: 1,
      totalGroupGuests: 25,
    });
    // Contact phone is masked for privacy in provincial overview
    expect(overview.body.inquiries[0].contactPhoneMasked).toBe('091****678');
    expect(overview.body.inquiries[0].isOverdue48h).toBe(true);

    // Suspending requires a reason >= 5 chars
    const badSuspend = await admin.patch(`/api/v1/admin/commerce/vouchers/${voucher.id}/status`, {
      status: 'paused',
      reason: 'abc',
    });
    expect(badSuspend.status).toBe(400);

    // Valid emergency suspension pauses voucher and writes AuditLog
    const okSuspend = await admin.patch(`/api/v1/admin/commerce/vouchers/${voucher.id}/status`, {
      status: 'paused',
      reason: 'Tạm dừng xác minh điều kiện khuyến mãi theo phản ánh du khách.',
    });
    expect(okSuspend.status).toBe(200);
    expect(okSuspend.body.voucher.status).toBe('paused');
    expect(await AuditLogModel.countDocuments({ action: 'voucher.admin_suspend' })).toBe(1);
  });

  it('returns provincial analytics (growth, areaBreakdown, verificationCoverage) and OWASP-safe CSV exports', async () => {
    const { client: admin } = await loggedInClient('admin');
    const { user: partnerUser } = await loggedInClient('partner');
    const { user: touristUser } = await loggedInClient('tourist');

    const dest = await createDestination({
      name: '=cmd|"/C calc"!A0 Điểm Kiểm Thử CSV',
      slug: 'csv-formula-safety-dest',
      area: 'tam-nong',
      verificationStatus: 'verified',
      managedBy: partnerUser._id,
    });

    await PassportEntryModel.create({
      userId: touristUser._id,
      destinationId: dest._id,
      entryType: 'check_in',
      scoreAwarded: 20,
      source: 'gps',
      completedAt: new Date(),
    });

    // 1. Analytics JSON with new provincial fields
    const analytics = await admin.get('/api/v1/admin/analytics');
    expect(analytics.status).toBe(200);
    expect(analytics.body.growth).toBeDefined();
    expect(analytics.body.verificationCoverage).toMatchObject({
      total: 1,
      verified: 1,
      assignedToPartner: 1,
      unassigned: 0,
    });
    expect(Array.isArray(analytics.body.areaBreakdown)).toBe(true);
    expect(analytics.body.areaBreakdown[0].area).toBe('tam-nong');

    // 2. Analytics CSV Export (UTF-8 BOM + OWASP formula escaping)
    const analyticsCsv = await admin.get('/api/v1/admin/analytics/export');
    expect(analyticsCsv.status).toBe(200);
    expect(analyticsCsv.headers['content-type']).toContain('text/csv');
    expect(analyticsCsv.text.startsWith('\uFEFF')).toBe(true);
    expect(analyticsCsv.text).toContain('BAO CAO THONG KE DU LICH CAP TINH');

    // 3. Passport Logs CSV Export (must anonymize tourist email per NĐ 13/2023 & escape formula destination names!)
    const passportCsv = await admin.get('/api/v1/admin/passport-logs/export');
    expect(passportCsv.status).toBe(200);
    expect(passportCsv.headers['content-type']).toContain('text/csv');
    expect(passportCsv.text.startsWith('\uFEFF')).toBe(true);
    expect(passportCsv.text).not.toContain(touristUser.email);
    expect(passportCsv.text).toContain("'=cmd");
    expect(passportCsv.text).toContain('GPS Thuc dia');

    // 4. Audit Logs date-range filter (Asia/Ho_Chi_Minh UTC+7) & CSV Export
    const todayVn = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
    const auditLogs = await admin.get(`/api/v1/admin/audit-logs?from=${todayVn}&to=${todayVn}`);
    expect(auditLogs.status).toBe(200);
    expect(auditLogs.body.items.length).toBeGreaterThanOrEqual(2);

    const auditCsv = await admin.get(`/api/v1/admin/audit-logs/export?from=${todayVn}&to=${todayVn}`);
    expect(auditCsv.status).toBe(200);
    expect(auditCsv.headers['content-type']).toContain('text/csv');
    expect(auditCsv.text.startsWith('\uFEFF')).toBe(true);
    expect(auditCsv.text).toContain('admin.analytics.export');
  });

  it('assigns and unassigns destinations directly to a partner and exposes managedDestinations in GET /admin/users', async () => {
    const { client: admin } = await loggedInClient('admin');
    const { user: partnerUser } = await loggedInClient('partner');
    const { user: touristUser } = await loggedInClient('tourist');

    const d1 = await createDestination({ name: 'Xẻo Quýt Assign', slug: 'xeo-quyt-assign' });
    const d2 = await createDestination({ name: 'Tràm Chim Assign', slug: 'tram-chim-assign' });

    // Rejects assigning destinations to a non-partner user
    const rejectTourist = await admin.put(`/api/v1/admin/users/${touristUser.id}/destinations`, {
      destinationIds: [d1.id],
    });
    expect(rejectTourist.status).toBe(400);

    // Assigns both d1 and d2 to partner
    const assignBoth = await admin.put(`/api/v1/admin/users/${partnerUser.id}/destinations`, {
      destinationIds: [d1.id, d2.id],
    });
    expect(assignBoth.status).toBe(200);
    expect(assignBoth.body.managedDestinations).toHaveLength(2);

    // GET /admin/users reflects managedDestinations on partner item
    const usersList = await admin.get('/api/v1/admin/users?role=partner');
    expect(usersList.status).toBe(200);
    const listedPartner = usersList.body.items.find(
      (u: { id: string }) => u.id === partnerUser.id,
    );
    expect(listedPartner.managedDestinations).toHaveLength(2);

    // Reassign to only d1 -> unassigns d2 cleanly
    const assignOne = await admin.put(`/api/v1/admin/users/${partnerUser.id}/destinations`, {
      destinationIds: [d1.id],
    });
    expect(assignOne.status).toBe(200);
    expect(assignOne.body.managedDestinations).toHaveLength(1);
    expect(assignOne.body.managedDestinations[0].id).toBe(d1.id);

    expect(await AuditLogModel.countDocuments({ action: 'user.destinations.assign' })).toBe(2);
  });
});
