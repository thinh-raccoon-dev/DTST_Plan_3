import { describe, expect, it } from 'vitest';
import { AnalyticsEventModel } from '../src/models/AnalyticsEvent.js';
import { PassportEntryModel } from '../src/models/PassportEntry.js';
import {
  correctAnswers,
  createChallenge,
  createDestination,
  createQr,
  loggedInClient,
  newClient,
  useTestDatabase,
} from './helpers.js';

useTestDatabase();

async function scenario() {
  const destination = await createDestination({ name: 'Tràm Chim', category: 'history' });
  const challenge = await createChallenge(destination._id);
  const qr = await createQr(destination._id, { code: 'TRAM-01' });
  return { destination, challenge, qr };
}

describe('QR landing', () => {
  it('handles unknown, inactive and unpublished targets', async () => {
    const visitor = await newClient();
    expect((await visitor.get('/api/v1/qr/NOPE-404')).body.error.code).toBe('QR_NOT_FOUND');

    const destination = await createDestination();
    await createQr(destination._id, { code: 'OFF-01', status: 'inactive' });
    const inactive = await visitor.get('/api/v1/qr/OFF-01');
    expect(inactive.status).toBe(410);
    expect(inactive.body.error.code).toBe('QR_INACTIVE');

    const hidden = await createDestination({ publicationStatus: 'hidden' });
    await createQr(hidden._id, { code: 'HID-01' });
    expect((await visitor.get('/api/v1/qr/HID-01')).body.error.code).toBe('QR_TARGET_UNAVAILABLE');
  });

  it('never sends correct answers and does not record a scan on GET', async () => {
    const { qr } = await scenario();
    const visitor = await newClient();
    const res = await visitor.get(`/api/v1/qr/${qr.code.toLowerCase()}`);
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain('correctOptionIndex');
    expect(JSON.stringify(res.body)).not.toContain('explanation');
    expect(res.body.progress).toEqual({ checkedIn: false, completedChallengeIds: [] });
    expect(await AnalyticsEventModel.countDocuments()).toBe(0);
  });

  it('records qr_landing_view once per dedupe window and does not mark tasks complete', async () => {
    const { qr } = await scenario();
    const visitor = await newClient();
    expect((await visitor.post(`/api/v1/qr/${qr.code}/scan`)).body.recorded).toBe(true);
    expect((await visitor.post(`/api/v1/qr/${qr.code}/scan`)).body.recorded).toBe(false);
    expect(await AnalyticsEventModel.countDocuments({ eventType: 'qr_landing_view' })).toBe(1);
    expect(await PassportEntryModel.countDocuments()).toBe(0);
  });

  it('follows a retargeted QR without changing its code, and stops when disabled', async () => {
    const { qr } = await scenario();
    const other = await createDestination({ name: 'Điểm mới', slug: 'diem-moi' });
    const { client: admin } = await loggedInClient('admin');

    const updated = await admin.patch(`/api/v1/admin/qr/${qr.id}`, { targetType: 'destination', targetId: other.id });
    expect(updated.status).toBe(200);
    expect(updated.body.qr.url).toMatch(/\/qr\/TRAM-01$/);

    const visitor = await newClient();
    expect((await visitor.get('/api/v1/qr/TRAM-01')).body.destination.slug).toBe('diem-moi');

    await admin.patch(`/api/v1/admin/qr/${qr.id}`, { status: 'inactive' });
    expect((await visitor.get('/api/v1/qr/TRAM-01')).status).toBe(410);

    const image = await admin.get(`/api/v1/admin/qr/${qr.id}/image?format=svg`);
    expect(image.status).toBe(200);
    expect(image.headers['content-type']).toContain('image/svg+xml');
  });

  it('lets admins create QR codes only for supported internal targets', async () => {
    const { client: admin } = await loggedInClient('admin');
    const destination = await createDestination();
    const created = await admin.post('/api/v1/admin/qr', { label: 'Cổng chính', targetType: 'destination', targetId: destination.id });
    expect(created.status).toBe(201);
    expect(created.body.qr.code).toMatch(/^DT-[A-Z0-9]{6}$/);

    const external = await admin.post('/api/v1/admin/qr', { label: 'Lừa đảo', targetType: 'url', targetId: 'https://evil.example' });
    expect(external.status).toBe(400);
    const missingTarget = await admin.post('/api/v1/admin/qr', { label: 'Mất', targetType: 'destination', targetId: '0123456789abcdef01234567' });
    expect(missingTarget.status).toBe(400);
  });
});

describe('challenge completion', () => {
  it('grades on the server and hides answers after a failed attempt', async () => {
    const { challenge, qr } = await scenario();
    const visitor = await newClient();
    const wrong = await visitor.post(`/api/v1/challenges/${challenge.id}/complete`, {
      qrCode: qr.code,
      answers: challenge.questions.map((q) => ({ questionId: String(q._id), optionIndex: (q.correctOptionIndex + 1) % q.options.length })),
    });
    expect(wrong.status).toBe(200);
    expect(wrong.body).toMatchObject({ passed: false, correctCount: 0, pointsAwarded: 0 });
    expect(JSON.stringify(wrong.body.results)).not.toContain('correctOptionIndex');
    expect(await PassportEntryModel.countDocuments({ entryType: 'challenge_completed' })).toBe(0);
    expect(await AnalyticsEventModel.countDocuments({ eventType: 'challenge_started' })).toBe(1);
  });

  it('ignores client-sent points and rejects incomplete or mismatched submissions', async () => {
    const { challenge, qr } = await scenario();
    const visitor = await newClient();
    const tampered = await visitor.post(`/api/v1/challenges/${challenge.id}/complete`, {
      qrCode: qr.code,
      answers: correctAnswers(challenge),
      points: 9999,
    });
    expect(tampered.status).toBe(400);

    const incomplete = await visitor.post(`/api/v1/challenges/${challenge.id}/complete`, {
      qrCode: qr.code,
      answers: correctAnswers(challenge).slice(0, 1),
    });
    expect(incomplete.body.error.code).toBe('INCOMPLETE_ANSWERS');

    const elsewhere = await createDestination();
    const otherQr = await createQr(elsewhere._id, { code: 'OTHER-01' });
    const mismatch = await visitor.post(`/api/v1/challenges/${challenge.id}/complete`, {
      qrCode: otherQr.code,
      answers: correctAnswers(challenge),
    });
    expect(mismatch.body.error.code).toBe('QR_CHALLENGE_MISMATCH');
  });

  it('awards points exactly once, even for concurrent submissions', async () => {
    const { challenge, qr } = await scenario();
    const { client, user } = await loggedInClient('tourist');
    const body = { qrCode: qr.code, answers: correctAnswers(challenge) };

    const results = await Promise.all(Array.from({ length: 6 }, () => client.post(`/api/v1/challenges/${challenge.id}/complete`, body)));
    expect(results.every((r) => r.status === 200 && r.body.passed)).toBe(true);
    expect(results.filter((r) => r.body.pointsAwarded === 50)).toHaveLength(1);
    expect(results.filter((r) => r.body.alreadyCompleted)).toHaveLength(5);
    expect(await PassportEntryModel.countDocuments({ userId: user._id, entryType: 'challenge_completed' })).toBe(1);
    expect(await AnalyticsEventModel.countDocuments({ eventType: 'challenge_completed' })).toBe(1);

    const passport = await client.get('/api/v1/passport/me');
    expect(passport.body.mode).toBe('account');
    expect(passport.body.totals).toMatchObject({ points: 50, completedChallenges: 1, exploredDestinations: 1, checkIns: 0 });
    expect(passport.body.badges.find((b: { key: string }) => b.key === 'local-insight').earned).toBe(true);
  });

  it('rejects inactive challenges', async () => {
    const { challenge, qr } = await scenario();
    challenge.status = 'inactive';
    await challenge.save();
    const visitor = await newClient();
    const res = await visitor.post(`/api/v1/challenges/${challenge.id}/complete`, { qrCode: qr.code, answers: correctAnswers(challenge) });
    expect(res.status).toBe(404);
  });
});

describe('passport', () => {
  it('keeps check-in, QR open and completion distinct', async () => {
    const { qr } = await scenario();
    const visitor = await newClient();
    await visitor.post(`/api/v1/qr/${qr.code}/scan`);
    let passport = await visitor.get('/api/v1/passport/me');
    expect(passport.body.mode).toBe('device');
    expect(passport.body.totals).toMatchObject({ qrContentsOpened: 1, checkIns: 0, completedChallenges: 0, points: 0 });

    const first = await visitor.post(`/api/v1/qr/${qr.code}/check-in`);
    expect(first.status).toBe(201);
    expect(first.body.pointsAwarded).toBe(10);
    expect((await visitor.post(`/api/v1/qr/${qr.code}/check-in`)).body).toMatchObject({ created: false, pointsAwarded: 0 });

    passport = await visitor.get('/api/v1/passport/me');
    expect(passport.body.totals).toMatchObject({ checkIns: 1, points: 10, completedChallenges: 0 });
  });

  it('claims guest entries into an account without double counting', async () => {
    const { challenge, qr } = await scenario();
    const { client, user } = await loggedInClient('tourist');
    // Account already completed the challenge.
    await client.post(`/api/v1/challenges/${challenge.id}/complete`, { qrCode: qr.code, answers: correctAnswers(challenge) });

    // Same browser logs out, plays as a guest, then logs back in.
    await client.post('/api/v1/auth/logout');
    await client.post(`/api/v1/challenges/${challenge.id}/complete`, { qrCode: qr.code, answers: correctAnswers(challenge) });
    await client.post(`/api/v1/qr/${qr.code}/check-in`);
    expect((await client.get('/api/v1/passport/me')).body.totals.points).toBe(60);

    const { UserModel } = await import('../src/models/User.js');
    const account = await UserModel.findById(user._id).lean();
    await client.post('/api/v1/auth/login', { email: account!.email, password: 'Secret-password-1' });
    expect((await client.get('/api/v1/passport/me')).body.pendingDeviceEntries).toBe(2);

    const claim = await client.post('/api/v1/passport/claim');
    expect(claim.body).toMatchObject({ claimed: 1, skipped: 1 });
    const passport = await client.get('/api/v1/passport/me');
    expect(passport.body.totals).toMatchObject({ points: 60, completedChallenges: 1, checkIns: 1 });
    expect(passport.body.pendingDeviceEntries).toBe(0);
    expect((await client.post('/api/v1/passport/claim')).body).toMatchObject({ claimed: 0, skipped: 0 });
  });

  it('only exposes the caller\'s own passport', async () => {
    const { challenge, qr } = await scenario();
    const { client: alice } = await loggedInClient('tourist');
    await alice.post(`/api/v1/challenges/${challenge.id}/complete`, { qrCode: qr.code, answers: correctAnswers(challenge) });
    const { client: bob, user: bobUser } = await loggedInClient('tourist');
    const bobPassport = await bob.get(`/api/v1/passport/me?userId=${bobUser.id}`);
    expect(bobPassport.body.totals.points).toBe(0);
  });
});

describe('GPS check-in', () => {
  it('requires nearby coordinates when the destination has a location, and never stores GPS', async () => {
    const destination = await createDestination({
      slug: 'tram-chim-gps',
      coordinates: { lat: 10.7, lng: 105.5 },
    });
    const qr = await createQr(destination._id, { code: 'GPS-01' });
    const visitor = await newClient();

    const missing = await visitor.post(`/api/v1/qr/${qr.code}/check-in`);
    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe('LOCATION_REQUIRED');

    const far = await visitor.post(`/api/v1/qr/${qr.code}/check-in`, { lat: 10.36, lng: 106.38 });
    expect(far.status).toBe(403);
    expect(far.body.error.code).toBe('LOCATION_TOO_FAR');

    const ok = await visitor.post(`/api/v1/qr/${qr.code}/check-in`, { lat: 10.701, lng: 105.501 });
    expect(ok.status).toBe(201);
    expect(ok.body.locationVerified).toBe(true);
    expect(JSON.stringify(ok.body)).not.toMatch(/10\.701/);
  });
});
