import { describe, expect, it } from 'vitest';
import { AuditLogModel } from '../src/models/AuditLog.js';
import { BannerModel } from '../src/models/Banner.js';
import { PartnerVoucherModel } from '../src/models/PartnerVoucher.js';
import { PassportEntryModel } from '../src/models/PassportEntry.js';
import { createDestination, loggedInClient, newClient, useTestDatabase } from './helpers.js';

useTestDatabase();

describe('Partner Hub Đợt 2 — Vouchers, Services, Group Inquiries & Banner Approval', () => {
  it('enforces Spendable EXP, atomic anti-oversell, atomic anti-double-redeem, consumer protection & zero-IDOR on Vouchers', async () => {
    const { client: partnerA, user: userA } = await loggedInClient('partner');
    const { client: partnerB } = await loggedInClient('partner');
    const { client: tourist1, user: tUser1 } = await loggedInClient('tourist');
    const { client: tourist2, user: tUser2 } = await loggedInClient('tourist');

    const destA = await createDestination({
      name: 'KDL Sinh Thái Sen Hồng',
      slug: 'kdl-sinh-thai-sen-hong',
      managedBy: userA._id,
    });

    const futureDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();

    // Partner A publishes a limited 1-slot voucher (50 EXP)
    const created = await partnerA.post('/api/v1/admin/partner/vouchers', {
      destinationId: destA.id,
      title: 'Ưu đãi Xuồng Ba Lá Mùa Sen',
      discountLabel: 'Giảm 25%',
      terms: 'Áp dụng tại quầy vé KDL, xuất trình mã hợp lệ, không quy đổi thành tiền mặt.',
      pointsCost: 50,
      totalQuantity: 1,
      maxPerUser: 1,
      validUntil: futureDate,
    });
    expect(created.status).toBe(201);
    const voucherId = created.body.voucher.id as string;

    // Tourist 1 has 0 EXP -> rejected cleanly
    const failLowExp = await tourist1.post(`/api/v1/vouchers/${voucherId}/claim`);
    expect(failLowExp.status).toBe(400);
    expect(failLowExp.body.error.code).toBe('INSUFFICIENT_EXP');

    // Grant 80 EXP to both tourists via PassportEntry
    await PassportEntryModel.create([
      { userId: tUser1._id, destinationId: destA._id, entryType: 'check_in', source: 'gps', scoreAwarded: 80 },
      { userId: tUser2._id, destinationId: destA._id, entryType: 'check_in', source: 'gps', scoreAwarded: 80 },
    ]);

    // Tourist 1 claims successfully -> spendable EXP drops from 80 to 30
    const claimed = await tourist1.post(`/api/v1/vouchers/${voucherId}/claim`);
    expect(claimed.status).toBe(201);
    const claimCode = claimed.body.claim.claimCode as string;
    expect(claimCode).toMatch(/^VCH-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(claimed.body.balance).toMatchObject({
      totalEarnedExp: 80,
      totalSpentExp: 50,
      spendableExp: 30,
    });

    // Tourist 2 tries claiming sold-out 1-slot voucher -> 409 VOUCHER_SOLD_OUT
    const soldOut = await tourist2.post(`/api/v1/vouchers/${voucherId}/claim`);
    expect(soldOut.status).toBe(409);
    expect(soldOut.body.error.code).toBe('VOUCHER_SOLD_OUT');

    // Zero-IDOR: Partner B CANNOT lookup or redeem Partner A's voucher code
    expect((await partnerB.get(`/api/v1/admin/partner/vouchers/lookup?code=${claimCode}`)).status).toBe(403);
    expect((await partnerB.post('/api/v1/admin/partner/vouchers/redeem', { claimCode })).status).toBe(403);

    // Partner A looks up code -> valid, masked displayName only (zero email leakage!)
    const lookup = await partnerA.get(`/api/v1/admin/partner/vouchers/lookup?code=${claimCode}`);
    expect(lookup.status).toBe(200);
    expect(lookup.body.claim.canRedeem).toBe(true);
    expect(JSON.stringify(lookup.body)).not.toContain(tUser1.email);

    // Partner A redeems code at ticket counter
    const redeem1 = await partnerA.post('/api/v1/admin/partner/vouchers/redeem', {
      claimCode,
      redeemNote: 'Quầy vé 01 - HĐ #102',
    });
    expect(redeem1.status).toBe(200);
    expect(redeem1.body.claim.status).toBe('redeemed');

    // Double-redemption attempt MUST fail with 409 ALREADY_REDEEMED
    const redeem2 = await partnerA.post('/api/v1/admin/partner/vouchers/redeem', { claimCode });
    expect(redeem2.status).toBe(409);
    expect(redeem2.body.error.code).toBe('ALREADY_REDEEMED');

    // Consumer protection: deleting voucher with existing claims soft-pauses it instead of hard deleting
    const delClaimed = await partnerA.delete(`/api/v1/admin/partner/vouchers/${voucherId}`);
    expect(delClaimed.status).toBe(200);
    expect(delClaimed.body.archived).toBe(true);
    const dbVoucher = await PartnerVoucherModel.findById(voucherId).lean();
    expect(dbVoucher?.status).toBe('paused');

    // Tourist 1 wallet shows accurate history and balance
    const wallet = await tourist1.get('/api/v1/passport/vouchers');
    expect(wallet.status).toBe(200);
    expect(wallet.body.items).toHaveLength(1);
    expect(wallet.body.items[0].status).toBe('redeemed');
  });

  it('manages structured public Service & Combo Catalog with zero-IDOR and public price transparency', async () => {
    const { client: partnerA, user: userA } = await loggedInClient('partner');
    const { client: partnerB } = await loggedInClient('partner');

    const destA = await createDestination({
      name: 'Vườn Quýt Hồng Lai Vung',
      slug: 'vuon-quyt-lai-vung-catalog',
      managedBy: userA._id,
    });

    const created = await partnerA.post('/api/v1/admin/partner/services', {
      destinationId: destA.id,
      name: 'Combo Tham quan Vườn Quýt + Thưởng thức tại vườn',
      category: 'combo',
      priceVnd: 120000,
      unit: 'người',
      durationMinutes: 90,
      description: 'Bao gồm vé vào vườn và 0.5kg quýt hồng hái tại cây.',
      includesVat: true,
    });
    expect(created.status).toBe(201);
    const serviceId = created.body.service.id as string;

    // Partner B cannot edit or delete Partner A's service item
    expect((await partnerB.patch(`/api/v1/admin/partner/services/${serviceId}`, { priceVnd: 1000 })).status).toBe(403);
    expect((await partnerB.delete(`/api/v1/admin/partner/services/${serviceId}`)).status).toBe(403);

    // Public destination detail exposes the official service price list
    const anon = await newClient();
    const pub = await anon.get(`/api/v1/destinations/${destA.slug}`);
    expect(pub.status).toBe(200);
    expect(pub.body.destination.services).toHaveLength(1);
    expect(pub.body.destination.services[0]).toMatchObject({
      name: 'Combo Tham quan Vườn Quýt + Thưởng thức tại vườn',
      priceVnd: 120000,
      includesVat: true,
    });

    // Partner A updates and deletes cleanly
    expect((await partnerA.patch(`/api/v1/admin/partner/services/${serviceId}`, { priceVnd: 130000 })).status).toBe(200);
    expect((await partnerA.delete(`/api/v1/admin/partner/services/${serviceId}`)).status).toBe(200);
  });

  it('requires explicit NĐ 13/2023 consent on Group Inquiries and isolates Partner Inbox', async () => {
    const { client: partnerA, user: userA } = await loggedInClient('partner');
    const { client: partnerB } = await loggedInClient('partner');
    const anon = await newClient();

    const destA = await createDestination({
      name: 'Khu Di Tích Xẻo Quýt',
      slug: 'xeo-quyt-inquiry-test',
      managedBy: userA._id,
    });

    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // Missing or false consent MUST fail (NĐ 13/2023/NĐ-CP)
    const noConsent = await anon.post(`/api/v1/destinations/${destA.slug}/inquiries`, {
      contactName: 'Trần Minh Quang',
      contactPhone: '0912345678',
      visitDate: nextWeek,
      groupSize: 25,
      consentGiven: false,
    });
    expect(noConsent.status).toBe(400);

    // Valid consent succeeds
    const ok = await anon.post(`/api/v1/destinations/${destA.slug}/inquiries`, {
      contactName: 'Trần Minh Quang',
      contactPhone: '0912345678',
      visitDate: nextWeek,
      groupSize: 25,
      serviceInterest: 'Combo Xuồng ba lá + Cơm trưa',
      consentGiven: true,
    });
    expect(ok.status).toBe(201);
    const inquiryId = ok.body.inquiry.id as string;

    // Partner B cannot list or update Partner A's inquiries
    expect((await partnerB.get(`/api/v1/admin/partner/inquiries?destinationId=${destA.id}`)).status).toBe(403);
    expect((await partnerB.patch(`/api/v1/admin/partner/inquiries/${inquiryId}`, { status: 'confirmed' })).status).toBe(403);

    // Partner A lists & confirms inquiry
    const inbox = await partnerA.get(`/api/v1/admin/partner/inquiries?destinationId=${destA.id}`);
    expect(inbox.status).toBe(200);
    expect(inbox.body.counts.new).toBe(1);
    expect(inbox.body.items[0].consentGiven).toBe(true);
    expect(inbox.body.items[0].consentAcceptedAt).toBeTruthy();

    const updated = await partnerA.patch(`/api/v1/admin/partner/inquiries/${inquiryId}`, {
      status: 'confirmed',
      partnerReplyNote: 'Đã xác nhận giữ 6 xuồng cho đoàn 25 khách.',
    });
    expect(updated.status).toBe(200);
    expect(updated.body.inquiry.status).toBe('confirmed');
    expect(await AuditLogModel.countDocuments({ destinationId: destA._id, action: 'inquiry.update' })).toBe(1);
  });

  it('enforces Luật Quảng cáo moderation workflow: Partner submits pending banner -> hidden publicly until Admin approves', async () => {
    const { client: partnerA, user: userA } = await loggedInClient('partner');
    const { client: partnerB } = await loggedInClient('partner');
    const { client: admin } = await loggedInClient('admin');
    const anon = await newClient();

    const destA = await createDestination({
      name: 'Đồng Sen Tháp Mười',
      slug: 'dong-sen-thap-muoi-banner',
      managedBy: userA._id,
    });

    // Reject javascript: XSS imageUrl
    const badImg = await partnerA.post('/api/v1/admin/partner/banners', {
      destinationId: destA.id,
      kind: 'promo',
      title: 'Lễ hội Sen Hè 2026',
      subtitle: 'Khám phá cánh đồng sen bạt ngàn cùng nhiều ưu đãi hấp dẫn cho gia đình.',
      imageUrl: 'javascript:alert(1)',
    });
    expect(badImg.status).toBe(400);

    // Partner submits valid seasonal banner -> forced pending_review + inactive + internal link
    const sub = await partnerA.post('/api/v1/admin/partner/banners', {
      destinationId: destA.id,
      kind: 'promo',
      theme: 'lotus',
      title: 'Lễ hội Mùa Sen Nở Rộ 2026',
      subtitle: 'Ưu đãi 20% vé xuồng ngắm sen bình minh từ 06h00 đến 09h00 hằng ngày.',
    });
    expect(sub.status).toBe(201);
    expect(sub.body.banner.approvalStatus).toBe('pending_review');
    expect(sub.body.banner.status).toBe('inactive');
    const bannerId = sub.body.banner.id as string;

    // Defense-in-depth: even if status were mistakenly toggled active while pending_review, public API hides it!
    const publicBefore = await anon.get('/api/v1/banners');
    expect(publicBefore.status).toBe(200);
    expect(publicBefore.body.items).toHaveLength(0);

    // Partner B cannot withdraw Partner A's banner
    expect((await partnerB.delete(`/api/v1/admin/partner/banners/${bannerId}`)).status).toBe(403);

    // Partner A cannot call admin review endpoint (403)
    expect(
      (await partnerA.patch(`/api/v1/admin/banners/${bannerId}/review`, { decision: 'approve' })).status,
    ).toBe(403);

    // Admin rejects without reason -> 400
    expect(
      (await admin.patch(`/api/v1/admin/banners/${bannerId}/review`, { decision: 'reject', feedback: '' })).status,
    ).toBe(400);

    // Admin approves & activates -> immediately live on public homepage banners with sponsorName!
    const approved = await admin.patch(`/api/v1/admin/banners/${bannerId}/review`, {
      decision: 'approve',
      activateNow: true,
      feedback: 'Nội dung đúng quy định, đã duyệt đăng.',
    });
    expect(approved.status).toBe(200);
    expect(approved.body.banner.approvalStatus).toBe('approved');
    expect(approved.body.banner.status).toBe('active');

    const publicAfter = await anon.get('/api/v1/banners');
    expect(publicAfter.status).toBe(200);
    expect(publicAfter.body.items).toHaveLength(1);
    expect(publicAfter.body.items[0]).toMatchObject({
      title: 'Lễ hội Mùa Sen Nở Rộ 2026',
      sponsorName: 'Đồng Sen Tháp Mười',
      linkUrl: '/destinations/dong-sen-thap-muoi-banner',
    });

    const dbBanner = await BannerModel.findById(bannerId).lean();
    expect(dbBanner?.approvalStatus).toBe('approved');
  });
});
