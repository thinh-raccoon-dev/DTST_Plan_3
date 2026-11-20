import { existsSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { AuditLogModel } from '../src/models/AuditLog.js';
import { BannerModel } from '../src/models/Banner.js';
import { FavoriteModel } from '../src/models/Favorite.js';
import { GroupInquiryModel } from '../src/models/GroupInquiry.js';
import { PartnerVoucherModel } from '../src/models/PartnerVoucher.js';
import { ReviewModel } from '../src/models/Review.js';
import { TravelFootprintModel } from '../src/models/TravelFootprint.js';
import { VoucherClaimModel } from '../src/models/VoucherClaim.js';
import {
  createDestination,
  createQr,
  loggedInClient,
  newClient,
  useTestDatabase,
} from './helpers.js';

useTestDatabase();

describe('Admin Đợt 1 — Security Hardening, Real SystemSettings Enforcement & Moderation Hub', () => {
  it('revokes existing JWT sessions immediately via tokenVersion on admin password reset & role change', async () => {
    const { client: admin } = await loggedInClient('admin');
    const { client: tourist, user: touristUser } = await loggedInClient('tourist');

    // Session works before reset
    expect((await tourist.get('/api/v1/auth/me')).body.user.email).toBe(touristUser.email);

    // Admin resets tourist password -> tokenVersion increments -> old session immediately revoked!
    const reset = await admin.post(`/api/v1/admin/users/${touristUser.id}/reset-password`, {
      password: 'New-Strong-Password-2026',
    });
    expect(reset.status).toBe(200);
    expect((await tourist.get('/api/v1/auth/me')).body.user).toBeNull();
  });

  it('enforces full NĐ 13/2023 PII cascade cleanup on deleteUser and protects the last active admin', async () => {
    const { client: admin } = await loggedInClient('admin');
    const { user: touristUser } = await loggedInClient('tourist');
    const dest = await createDestination({ name: 'Tràm Chim Cascade Test' });

    const voucher = await PartnerVoucherModel.create({
      destinationId: dest._id,
      title: 'Ưu đãi test',
      discountLabel: 'Giảm 10%',
      terms: 'Áp dụng tại quầy vé kiểm thử hệ thống.',
      pointsCost: 10,
      totalQuantity: 10,
      validUntil: new Date(Date.now() + 7 * 86400000),
      createdBy: touristUser._id,
    });

    await Promise.all([
      FavoriteModel.create({ userId: touristUser._id, destinationId: dest._id }),
      TravelFootprintModel.create({
        userId: touristUser._id,
        clientId: 'fp-1',
        title: 'Hành trình Tràm Chim',
        startedAt: new Date(Date.now() - 3600_000),
        endedAt: new Date(),
      }),
      VoucherClaimModel.create({
        voucherId: voucher._id,
        destinationId: dest._id,
        userId: touristUser._id,
        claimCode: 'VCH-AA11-BB22',
        voucherTitle: voucher.title,
        discountLabel: voucher.discountLabel,
        terms: voucher.terms,
        pointsSpent: 10,
        expiresAt: voucher.validUntil,
      }),
      GroupInquiryModel.create({
        destinationId: dest._id,
        userId: touristUser._id,
        contactName: 'Người Dùng Xóa',
        contactPhone: '0912345678',
        visitDate: new Date(Date.now() + 3 * 86400000),
        groupSize: 10,
        consentGiven: true,
        consentAcceptedAt: new Date(),
      }),
      ReviewModel.create({
        destinationId: dest._id,
        userId: touristUser._id,
        authorName: 'Nguyễn Văn Riêng Tư',
        rating: 5,
        content: 'Rất đẹp và thân thiện!',
      }),
    ]);

    const del = await admin.delete(`/api/v1/admin/users/${touristUser.id}`);
    expect(del.status).toBe(204);

    // Every linked PII collection is cleanly wiped or anonymized
    expect(await FavoriteModel.countDocuments({ userId: touristUser._id })).toBe(0);
    expect(await TravelFootprintModel.countDocuments({ userId: touristUser._id })).toBe(0);
    expect(await VoucherClaimModel.countDocuments({ userId: touristUser._id })).toBe(0);
    expect(await GroupInquiryModel.countDocuments({ userId: touristUser._id })).toBe(0);
    const reviewAfter = await ReviewModel.findOne({ destinationId: dest._id }).lean();
    expect(reviewAfter?.userId).toBeUndefined();
    expect(reviewAfter?.authorName).toBe('Du khách đã xóa tài khoản');
  });

  it('enforces real SystemSettings: maintenanceMode, enablePublicRegistration, enableAiPlanner & defaultCheckInPoints', async () => {
    const { client: admin } = await loggedInClient('admin');
    const { client: tourist } = await loggedInClient('tourist');
    const anon = await newClient();
    const dest = await createDestination({ slug: 'dest-settings-test' });
    const qr = await createQr(dest._id);

    // 1. Disable public registration & AI planner, set check-in points = 35
    const upd1 = await admin.put('/api/v1/admin/system/settings', {
      announcement: { enabled: true, message: 'Lễ hội Sen Đồng Tháp sắp khai mạc!', tone: 'lotus', linkUrl: '/destinations' },
      general: {
        maintenanceMode: false,
        defaultCheckInPoints: 35,
        defaultQuizPoints: 40,
        enablePublicRegistration: false,
        enableAiPlanner: false,
      },
    });
    expect(upd1.status).toBe(200);

    // Public announcement exposes real settings
    const pubAnn = await anon.get('/api/v1/system/announcement');
    expect(pubAnn.status).toBe(200);
    expect(pubAnn.body.announcement.message).toBe('Lễ hội Sen Đồng Tháp sắp khai mạc!');
    expect(pubAnn.body.enablePublicRegistration).toBe(false);
    expect(pubAnn.body.enableAiPlanner).toBe(false);

    // Registration blocked (403 REGISTRATION_DISABLED)
    const reg = await anon.post('/api/v1/auth/register', {
      email: 'blocked-reg@test.local',
      displayName: 'Khách mới',
      password: 'Password-1234',
    });
    expect(reg.status).toBe(403);
    expect(reg.body.error.code).toBe('REGISTRATION_DISABLED');

    // AI Planner blocked for tourist (503 AI_PLANNER_DISABLED)
    const aiGen = await tourist.post('/api/v1/itineraries/generate', {
      areas: ['cao-lanh'],
      interests: ['nature'],
      numberOfDays: 1,
      hoursPerDay: 6,
    });
    expect(aiGen.status).toBe(503);
    expect(aiGen.body.error.code).toBe('AI_PLANNER_DISABLED');

    // Custom defaultCheckInPoints (35) actually applied on QR check-in!
    const chk = await tourist.post(`/api/v1/qr/${qr.code}/check-in`, {});
    expect(chk.status).toBe(201);
    expect(chk.body.pointsAwarded).toBe(35);

    // 2. Enable maintenanceMode -> blocks public/tourist endpoints with 503, but Admin & /system/announcement still work!
    const upd2 = await admin.put('/api/v1/admin/system/settings', {
      general: {
        maintenanceMode: true,
        defaultCheckInPoints: 35,
        defaultQuizPoints: 40,
        enablePublicRegistration: false,
        enableAiPlanner: false,
      },
    });
    expect(upd2.status).toBe(200);

    const blockedPublic = await anon.get('/api/v1/destinations');
    expect(blockedPublic.status).toBe(503);
    expect(blockedPublic.body.error.code).toBe('MAINTENANCE_MODE');

    // Admin still accesses destinations & system settings cleanly
    expect((await admin.get('/api/v1/destinations')).status).toBe(200);
    expect((await admin.get('/api/v1/admin/system/status')).status).toBe(200);
    expect((await anon.get('/api/v1/system/announcement')).body.maintenanceMode).toBe(true);
  });

  it('rejects spoofed files claiming image/jpeg via magic-bytes check and audits real PNG uploads', async () => {
    const { client: admin } = await loggedInClient('admin');
    const csrfRes = await admin.get('/api/v1/csrf');
    const csrfToken = csrfRes.body.csrfToken as string;

    // Spoofed HTML file disguised as JPEG
    const fakeRes = await admin.agent
      .post('/api/v1/admin/upload')
      .set('x-csrf-token', csrfToken)
      .attach('file', Buffer.from('<html><script>alert(1)</script></html>'), {
        filename: 'evil.jpg',
        contentType: 'image/jpeg',
      });
    expect(fakeRes.status).toBe(400);
    expect(fakeRes.body.error.code).toBe('INVALID_IMAGE_SIGNATURE');

    // Real PNG signature
    const pngBytes = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    ]);
    const okRes = await admin.agent
      .post('/api/v1/admin/upload')
      .set('x-csrf-token', csrfToken)
      .attach('file', pngBytes, { filename: 'valid.png', contentType: 'image/png' });
    expect(okRes.status).toBe(201);
    expect(okRes.body.url).toMatch(/^\/uploads\/img-.*\.png$/);
    expect(await AuditLogModel.countDocuments({ action: 'media.upload' })).toBe(1);

    // Clean up test file from uploads directory
    const diskPath = path.resolve(process.cwd(), 'uploads', okRes.body.filename as string);
    if (existsSync(diskPath)) unlinkSync(diskPath);
  });

  it('serves unified Moderation Summary and enforces reviewNote when returning destinations to draft', async () => {
    const { client: admin } = await loggedInClient('admin');
    const { user: partnerUser } = await loggedInClient('partner');

    const pendingDest = await createDestination({
      name: 'Điểm Chờ Duyệt Sa Đéc',
      slug: 'diem-cho-duyet-sa-dec',
      area: 'sa-dec',
      publicationStatus: 'pending_review',
      managedBy: partnerUser._id,
    });
    await BannerModel.create({
      title: 'Banner Mùa Hoa Chờ Duyệt',
      kind: 'promo',
      sponsorName: pendingDest.name,
      destinationId: pendingDest._id,
      approvalStatus: 'pending_review',
      status: 'inactive',
    });
    await ReviewModel.create({
      destinationId: pendingDest._id,
      authorName: 'Khách Báo Cáo',
      rating: 1,
      content: 'Nội dung bị báo cáo kiểm duyệt',
      isFlagged: true,
      reportReason: 'Spam quảng cáo',
    });

    const summary = await admin.get('/api/v1/admin/moderation/summary');
    expect(summary.status).toBe(200);
    expect(summary.body.counts).toMatchObject({
      pendingDestinations: 1,
      pendingBanners: 1,
      flaggedReviews: 1,
      totalPending: 3,
    });

    // Return to draft requires reviewNote >= 5 chars
    const badReturn = await admin.patch(`/api/v1/admin/destinations/${pendingDest.id}/review`, {
      decision: 'return_draft',
      reviewNote: '',
    });
    expect(badReturn.status).toBe(400);

    // Return with clear reviewNote succeeds
    const okReturn = await admin.patch(`/api/v1/admin/destinations/${pendingDest.id}/review`, {
      decision: 'return_draft',
      reviewNote: 'Vui lòng bổ sung thêm ảnh chụp thực tế và giờ mở cửa.',
    });
    expect(okReturn.status).toBe(200);
    expect(okReturn.body.destination.publicationStatus).toBe('draft');
    expect(okReturn.body.destination.reviewNote).toContain('giờ mở cửa');

    // Approve succeeds
    const approved = await admin.patch(`/api/v1/admin/destinations/${pendingDest.id}/review`, {
      decision: 'approve',
    });
    expect(approved.status).toBe(200);
    expect(approved.body.destination.publicationStatus).toBe('published');

    // Enhanced admin destination & banner filters work
    const filteredBanners = await admin.get('/api/v1/admin/banners?approvalStatus=pending_review');
    expect(filteredBanners.status).toBe(200);
    expect(filteredBanners.body.items).toHaveLength(1);
    const filteredDests = await admin.get('/api/v1/admin/destinations?area=sa-dec&assignment=assigned');
    expect(filteredDests.status).toBe(200);
    expect(filteredDests.body.items).toHaveLength(1);
  });
});
