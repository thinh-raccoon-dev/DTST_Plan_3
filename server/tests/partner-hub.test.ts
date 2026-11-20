import { describe, expect, it } from 'vitest';
import { AnalyticsEventModel } from '../src/models/AnalyticsEvent.js';
import { AuditLogModel } from '../src/models/AuditLog.js';
import { BadgeModel } from '../src/models/Badge.js';
import { ChallengeModel } from '../src/models/Challenge.js';
import { DestinationModel } from '../src/models/Destination.js';
import { PassportEntryModel } from '../src/models/PassportEntry.js';
import { QrCodeModel } from '../src/models/QrCode.js';
import { SafetyAlertModel } from '../src/models/SafetyAlert.js';
import {
  createDestination,
  createUser,
  loggedInClient,
  useTestDatabase,
} from './helpers.js';

useTestDatabase();

describe('Partner Hub Đợt 1 — Security, Business Logic & Legal Compliance', () => {
  it('enforces strict multi-tenant RBAC & zero-IDOR across two partners and tourists', async () => {
    const { client: tourist } = await loggedInClient('tourist');
    expect((await tourist.get('/api/v1/admin/partner/overview')).status).toBe(403);
    expect((await tourist.get('/api/v1/admin/partner/export')).status).toBe(403);
    expect((await tourist.get('/api/v1/admin/partner/alerts')).status).toBe(403);
    expect((await tourist.get('/api/v1/admin/partner/audit-logs')).status).toBe(403);

    const { client: partnerA, user: userA } = await loggedInClient('partner');
    const { client: partnerB, user: userB } = await loggedInClient('partner');

    const destA1 = await createDestination({
      name: 'KDL Sen Hồng A1',
      slug: 'kdl-sen-hong-a1',
      managedBy: userA._id,
      coordinates: { lat: 10.456, lng: 105.632 },
    });
    const destA2 = await createDestination({
      name: 'Vườn Quýt A2',
      slug: 'vuon-quyt-a2',
      managedBy: userA._id,
      coordinates: { lat: 10.289, lng: 105.654 },
    });
    const destB1 = await createDestination({
      name: 'KDL Đối Thủ B1',
      slug: 'kdl-doi-thu-b1',
      managedBy: userB._id,
      coordinates: { lat: 10.712, lng: 105.512 },
    });

    // Partner A sees ONLY A1 & A2 and can switch cleanly between them
    const overviewA = await partnerA.get('/api/v1/admin/partner/overview?days=30');
    expect(overviewA.status).toBe(200);
    expect(overviewA.body.hasDestination).toBe(true);
    expect(overviewA.body.daysWindow).toBe(30);
    const managedIds = (overviewA.body.managedDestinations as Array<{ id: string }>).map((d) => d.id);
    expect(managedIds).toHaveLength(2);
    expect(managedIds).toContain(String(destA1._id));
    expect(managedIds).toContain(String(destA2._id));
    expect(managedIds).not.toContain(String(destB1._id));

    const switchA2 = await partnerA.get(`/api/v1/admin/partner/overview?destinationId=${destA2.id}`);
    expect(switchA2.status).toBe(200);
    expect(switchA2.body.destination.id).toBe(String(destA2._id));

    // IDOR attempts by Partner A against Partner B's destination MUST fail with 403
    expect((await partnerA.get(`/api/v1/admin/partner/overview?destinationId=${destB1.id}`)).status).toBe(403);
    expect((await partnerA.get(`/api/v1/admin/partner/export?destinationId=${destB1.id}`)).status).toBe(403);
    expect((await partnerA.get(`/api/v1/admin/partner/alerts?destinationId=${destB1.id}`)).status).toBe(403);
    expect((await partnerA.get(`/api/v1/admin/partner/audit-logs?destinationId=${destB1.id}`)).status).toBe(403);
    expect(
      (
        await partnerA.patch('/api/v1/admin/partner/destination/status', {
          destinationId: destB1.id,
          operationalStatus: 'temporarily_closed',
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await partnerA.post('/api/v1/admin/partner/qr', {
          destinationId: destB1.id,
          label: 'Cổng giả mạo',
          targetType: 'destination',
        })
      ).status,
    ).toBe(403);

    // Partner B creates resources; Partner A cannot edit/delete/read QR image of Partner B
    const qrB = await partnerB.post('/api/v1/admin/partner/qr', {
      destinationId: destB1.id,
      label: 'Quầy vé B1',
      targetType: 'destination',
    });
    expect(qrB.status).toBe(201);
    const qrBId = qrB.body.qr.id as string;
    expect((await partnerA.patch(`/api/v1/admin/partner/qr/${qrBId}`, { label: 'Hacked' })).status).toBe(403);
    expect((await partnerA.delete(`/api/v1/admin/partner/qr/${qrBId}`)).status).toBe(403);
    expect((await partnerA.get(`/api/v1/admin/partner/qr/${qrBId}/image`)).status).toBe(403);

    const chB = await partnerB.post('/api/v1/admin/partner/challenges', {
      destinationId: destB1.id,
      title: 'Câu đố B1',
      rewardPoints: 50,
      questions: [{ prompt: 'B1 nằm ở đâu tại Đồng Tháp?', options: ['A', 'B'], correctOptionIndex: 0 }],
    });
    expect(chB.status).toBe(201);
    const chBId = chB.body.challenge.id as string;
    expect((await partnerA.patch(`/api/v1/admin/partner/challenges/${chBId}`, { title: 'Hacked' })).status).toBe(403);
    expect((await partnerA.delete(`/api/v1/admin/partner/challenges/${chBId}`)).status).toBe(403);

    const badgeB = await partnerB.post('/api/v1/admin/partner/badges', {
      destinationId: destB1.id,
      name: 'Huy hiệu B1',
      description: 'Mô tả huy hiệu của cơ sở B1',
      icon: 'trophy',
      criteriaType: 'checkin_count',
      targetCount: 1,
      rewardPoints: 50,
    });
    expect(badgeB.status).toBe(201);
    const badgeBId = badgeB.body.badge.id as string;
    expect((await partnerA.patch(`/api/v1/admin/partner/badges/${badgeBId}`, { name: 'Hacked' })).status).toBe(403);
    expect((await partnerA.delete(`/api/v1/admin/partner/badges/${badgeBId}`)).status).toBe(403);
  });

  it('keeps public partnerNotice separate from internal admin reviewNote and exposes it publicly', async () => {
    const { client: partner, user } = await loggedInClient('partner');
    const dest = await createDestination({
      name: 'Làng Hoa Sa Đéc',
      slug: 'lang-hoa-sa-dec-test',
      managedBy: user._id,
      reviewNote: 'Ghi chú nội bộ của Sở: đã xác minh hồ sơ gốc',
    });

    const res = await partner.patch('/api/v1/admin/partner/destination/status', {
      destinationId: dest.id,
      operationalStatus: 'active',
      specialNotice: 'Mùa cúc mâm xôi đang nở rộ từ 06h00 đến 18h00 mỗi ngày!',
    });
    expect(res.status).toBe(200);
    expect(res.body.partnerNotice).toContain('cúc mâm xôi');

    const freshDb = await DestinationModel.findById(dest._id).lean();
    expect(freshDb?.reviewNote).toBe('Ghi chú nội bộ của Sở: đã xác minh hồ sơ gốc');
    expect(freshDb?.partnerNotice).toBe('Mùa cúc mâm xôi đang nở rộ từ 06h00 đến 18h00 mỗi ngày!');
    expect(freshDb?.partnerNoticeUpdatedAt).toBeTruthy();

    // Public tourist API exposes partnerNotice, never internal reviewNote
    const pub = await partner.get(`/api/v1/destinations/${dest.slug}`);
    expect(pub.status).toBe(200);
    expect(pub.body.destination.partnerNotice).toBe(
      'Mùa cúc mâm xôi đang nở rộ từ 06h00 đến 18h00 mỗi ngày!',
    );
    expect(pub.body.destination.partnerNoticeUpdatedAt).toBeTruthy();
  });

  it('supports full Challenge CRUD and protects tourist passport history with soft-archive on delete', async () => {
    const { client: partner, user } = await loggedInClient('partner');
    const { user: touristUser } = await createUser('tourist');
    const dest = await createDestination({ managedBy: user._id });

    // Create multi-question challenge with cultural story
    const created = await partner.post('/api/v1/admin/partner/challenges', {
      destinationId: dest.id,
      title: 'Hành trình Sen Hồng',
      description: 'Bộ câu đố 2 câu về sen',
      story: 'Sen Đồng Tháp là biểu tượng thuần khiết của vùng đất chín rồng.',
      rewardPoints: 80,
      questions: [
        { prompt: 'Hoa sen biểu tượng cho tỉnh nào?', options: ['Đồng Tháp', 'Hà Nội'], correctOptionIndex: 0 },
        { prompt: 'Mùa nước nổi rơi vào khoảng tháng mấy âm lịch?', options: ['Tháng 7-10', 'Tháng 1-2'], correctOptionIndex: 0 },
      ],
    });
    expect(created.status).toBe(201);
    const chId = created.body.challenge.id as string;

    // Update challenge
    const updated = await partner.patch(`/api/v1/admin/partner/challenges/${chId}`, {
      title: 'Hành trình Sen Hồng (Bản mới)',
      status: 'inactive',
      rewardPoints: 100,
    });
    expect(updated.status).toBe(200);
    expect(updated.body.challenge.status).toBe('inactive');

    // Hard-delete when 0 completions
    const delUnused = await partner.delete(`/api/v1/admin/partner/challenges/${chId}`);
    expect(delUnused.status).toBe(200);
    expect(delUnused.body.archived).toBe(false);
    expect(await ChallengeModel.findById(chId)).toBeNull();

    // Create a second challenge, link a QR & tourist completion -> must SOFT-ARCHIVE on delete
    const created2 = await partner.post('/api/v1/admin/partner/challenges', {
      destinationId: dest.id,
      title: 'Câu đố đã có khách hoàn thành',
      rewardPoints: 60,
      questions: [{ prompt: 'Sếu đầu đỏ sinh sống ở đâu?', options: ['Tràm Chim', 'Côn Đảo'], correctOptionIndex: 0 }],
    });
    const ch2Id = created2.body.challenge.id as string;

    const qrRes = await partner.post('/api/v1/admin/partner/qr', {
      destinationId: dest.id,
      label: 'Trạm câu đố Sếu',
      targetType: 'challenge',
      challengeId: ch2Id,
    });
    expect(qrRes.status).toBe(201);
    const chQrId = qrRes.body.qr.id as string;

    await PassportEntryModel.create({
      userId: touristUser._id,
      destinationId: dest._id,
      challengeId: ch2Id,
      entryType: 'challenge_completed',
      source: 'qr',
      scoreAwarded: 60,
    });

    const delUsed = await partner.delete(`/api/v1/admin/partner/challenges/${ch2Id}`);
    expect(delUsed.status).toBe(200);
    expect(delUsed.body.archived).toBe(true);

    const persistedCh = await ChallengeModel.findById(ch2Id).lean();
    expect(persistedCh?.status).toBe('inactive');
    const persistedQr = await QrCodeModel.findById(chQrId).lean();
    expect(persistedQr?.status).toBe('inactive');
  });

  it('generates local PNG QR images, protects QR scan history, and enforces Badge CRUD + system badge protection', async () => {
    const { client: partner, user } = await loggedInClient('partner');
    const dest = await createDestination({ managedBy: user._id });

    // Create QR and fetch local PNG data URL
    const qrRes = await partner.post('/api/v1/admin/partner/qr', {
      destinationId: dest.id,
      label: 'Cổng chính',
      targetType: 'destination',
    });
    expect(qrRes.status).toBe(201);
    expect(qrRes.body.qr.code).toMatch(/^DT-[A-Z0-9]{6}$/);
    const qrId = qrRes.body.qr.id as string;

    const imgRes = await partner.get(`/api/v1/admin/partner/qr/${qrId}/image`);
    expect(imgRes.status).toBe(200);
    expect(imgRes.body.dataUrl).toMatch(/^data:image\/png;base64,/);

    // Edit QR label & toggle status
    const patchQr = await partner.patch(`/api/v1/admin/partner/qr/${qrId}`, {
      label: 'Cổng chính Quầy vé #1',
      status: 'inactive',
    });
    expect(patchQr.status).toBe(200);
    expect(patchQr.body.qr.status).toBe('inactive');

    // Add scan analytics -> delete must soft-disable instead of wiping analytics link
    await AnalyticsEventModel.create({
      eventType: 'qr_landing_view',
      destinationId: dest._id,
      qrCodeId: qrId,
    });
    const delUsedQr = await partner.delete(`/api/v1/admin/partner/qr/${qrId}`);
    expect(delUsedQr.status).toBe(200);
    expect(delUsedQr.body.archived).toBe(true);

    // System badge (destinationId: null) MUST NOT be editable/deletable by partners
    const systemBadge = await BadgeModel.create({
      key: 'system-master-badge',
      name: 'Huy hiệu Toàn tỉnh',
      description: 'Huy hiệu cấp Sở VHTTDL',
      icon: 'trophy',
      criteriaType: 'checkin_count',
      targetCount: 5,
      rewardPoints: 100,
      status: 'active',
    });
    expect((await partner.patch(`/api/v1/admin/partner/badges/${systemBadge.id}`, { name: 'Hack' })).status).toBe(403);
    expect((await partner.delete(`/api/v1/admin/partner/badges/${systemBadge.id}`)).status).toBe(403);

    // Own badge CRUD
    const badgeRes = await partner.post('/api/v1/admin/partner/badges', {
      destinationId: dest.id,
      name: 'Bạn thân Đất Sen',
      description: 'Dành cho khách check-in tại cơ sở',
      icon: 'star',
      criteriaType: 'checkin_count',
      targetCount: 1,
      rewardPoints: 50,
    });
    expect(badgeRes.status).toBe(201);
    const badgeId = badgeRes.body.badge.id as string;
    expect((await partner.patch(`/api/v1/admin/partner/badges/${badgeId}`, { status: 'inactive' })).status).toBe(200);
    expect((await partner.delete(`/api/v1/admin/partner/badges/${badgeId}`)).status).toBe(200);
  });

  it('scopes field safety alerts to managed destinations, caps radius <= 15km, and blocks cross-partner deactivation', async () => {
    const { client: partnerA, user: userA } = await loggedInClient('partner');
    const { client: partnerB } = await loggedInClient('partner');

    const destA = await createDestination({
      name: 'Vườn Quốc Gia Tràm Chim',
      slug: 'tram-chim-alert-test',
      managedBy: userA._id,
      coordinates: { lat: 10.725, lng: 105.518 },
    });

    // Reject radius > 15km
    const badRadius = await partnerA.post('/api/v1/admin/partner/alerts', {
      destinationId: destA.id,
      type: 'flood',
      severity: 'warning',
      title: 'Triều cường bất thường',
      description: 'Nước dâng nhẹ lối vào bến xuồng, du khách chú ý mang dép phù hợp.',
      radiusKm: 50,
    });
    expect(badRadius.status).toBe(400);

    // Valid alert creation
    const created = await partnerA.post('/api/v1/admin/partner/alerts', {
      destinationId: destA.id,
      type: 'flood',
      severity: 'warning',
      title: 'Triều cường lối vào bến xuồng',
      description: 'Nước dâng nhẹ lối vào bến xuồng từ 15h00 - 17h30, KDL có xuồng đưa đón.',
      radiusKm: 3,
      terrainImpact: 'coastal_river',
      hoursValid: 24,
    });
    expect(created.status).toBe(201);
    const alertId = created.body.alert.id as string;

    // Live on public safety alerts feed
    const publicAlerts = await partnerB.get('/api/v1/safety/alerts');
    expect(publicAlerts.status).toBe(200);
    expect((publicAlerts.body.items as Array<{ _id: string }>).some((a) => String(a._id) === alertId)).toBe(true);

    // Partner B MUST NOT deactivate Partner A's alert on either route (anti-IDOR fix)
    expect((await partnerB.delete(`/api/v1/safety/alerts/${alertId}`)).status).toBe(403);
    expect((await partnerB.delete(`/api/v1/admin/partner/alerts/${alertId}`)).status).toBe(403);

    // Partner A deactivates own alert cleanly
    const deactivated = await partnerA.delete(`/api/v1/admin/partner/alerts/${alertId}`);
    expect(deactivated.status).toBe(200);
    const dbAlert = await SafetyAlertModel.findById(alertId).lean();
    expect(dbAlert?.isActive).toBe(false);
  });

  it('complies with Nghị định 13/2023 PII minimization, neutralizes CSV formula injection, and records scoped AuditLogs', async () => {
    const { client: partner, user } = await loggedInClient('partner');
    const { user: touristUser } = await createUser('tourist', 'secret-pii-visitor@private.vn');
    // Inject formula payload into destination name to prove OWASP CSV neutralization
    const dest = await createDestination({
      name: '=CMD|calc!A0 Khu Du Lịch Sen',
      slug: 'kdl-csv-safety',
      managedBy: user._id,
    });

    await PassportEntryModel.create({
      userId: touristUser._id,
      destinationId: dest._id,
      entryType: 'check_in',
      source: 'gps',
      scoreAwarded: 20,
    });

    // Overview MUST NEVER leak visitor email
    const overview = await partner.get('/api/v1/admin/partner/overview');
    expect(overview.status).toBe(200);
    expect(JSON.stringify(overview.body)).not.toContain('secret-pii-visitor@private.vn');
    expect(overview.body.recentCheckIns).toHaveLength(1);
    expect(overview.body.recentCheckIns[0].visitorEmail).toBeUndefined();

    // CSV export MUST be UTF-8 BOM, hide email, and prefix leading '=' with single quote
    const csvRes = await partner.get(`/api/v1/admin/partner/export?destinationId=${dest.id}&days=30`);
    expect(csvRes.status).toBe(200);
    expect(csvRes.headers['content-type']).toContain('text/csv');
    const text = csvRes.text;
    expect(text.startsWith('\uFEFF')).toBe(true);
    expect(text).not.toContain('secret-pii-visitor@private.vn');
    expect(text).toContain("'=CMD|calc!A0 Khu Du Lịch Sen");

    // Audit log recorded the export and is visible via scoped partner audit-logs endpoint
    const logsRes = await partner.get(`/api/v1/admin/partner/audit-logs?destinationId=${dest.id}`);
    expect(logsRes.status).toBe(200);
    expect((logsRes.body.items as Array<{ action: string }>).some((l) => l.action === 'partner.report.export')).toBe(true);
    expect(await AuditLogModel.countDocuments({ destinationId: dest._id, action: 'partner.report.export' })).toBe(1);
  });
});
