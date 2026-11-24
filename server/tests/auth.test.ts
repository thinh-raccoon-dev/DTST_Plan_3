import crypto from 'node:crypto';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { env } from '../src/config/env.js';
import { EmailOtpModel } from '../src/models/EmailOtp.js';
import { FootprintPhotoModel } from '../src/models/FootprintPhoto.js';
import { FootprintPhotoBlobModel } from '../src/models/FootprintPhotoBlob.js';
import { UserModel } from '../src/models/User.js';
import { processCopilotMessage } from '../src/services/aiCopilot.service.js';
import { renderRegisterOtpEmail } from '../src/services/emailTemplates.js';
import { app, createUser, loggedInClient, newClient, useTestDatabase } from './helpers.js';

useTestDatabase();

describe('authentication', () => {
  it('registers a tourist and never accepts a role from the client', async () => {
    const client = await newClient();
    const rejected = await client.post('/api/v1/auth/register', {
      email: 'hacker@test.local',
      password: 'password-123',
      displayName: 'Hacker',
      role: 'admin',
    });
    expect(rejected.status).toBe(400);
    expect(await UserModel.countDocuments()).toBe(0);

    const ok = await client.post('/api/v1/auth/register', {
      email: 'Visitor@Test.local',
      password: 'password-123',
      displayName: 'Visitor',
    });
    expect(ok.status).toBe(201);
    expect(ok.body.user).toMatchObject({ email: 'visitor@test.local', role: 'tourist' });
    expect(ok.body.user.passwordHash).toBeUndefined();

    const stored = await UserModel.findOne({ email: 'visitor@test.local' }).select('+passwordHash').lean();
    expect(stored?.passwordHash).toMatch(/^\$2[aby]\$/);

    const duplicate = await client.post('/api/v1/auth/register', {
      email: 'visitor@test.local',
      password: 'password-123',
      displayName: 'Again',
    });
    expect(duplicate.status).toBe(409);
  });

  it('rejects wrong credentials with a generic message', async () => {
    const { email } = await createUser();
    const client = await newClient();
    const wrongPassword = await client.post('/api/v1/auth/login', { email, password: 'nope-nope' });
    const unknownEmail = await client.post('/api/v1/auth/login', { email: 'ghost@test.local', password: 'nope-nope' });
    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.error.message).toBe(unknownEmail.body.error.message);
  });

  it('logs in with an HttpOnly cookie, reports the session and logs out', async () => {
    const { email, password } = await createUser();
    const client = await newClient();
    const login = await client.post('/api/v1/auth/login', { email, password });
    expect(login.status).toBe(200);
    const cookies = ([] as string[]).concat(login.headers['set-cookie'] ?? []);
    const session = cookies.find((c) => c.startsWith('dtst_access='));
    expect(session).toMatch(/HttpOnly/i);
    expect(login.body.token).toBeUndefined();

    expect((await client.get('/api/v1/auth/me')).body.user.email).toBe(email);
    expect((await client.post('/api/v1/auth/logout')).status).toBe(204);
    expect((await client.get('/api/v1/auth/me')).body.user).toBeNull();
  });

  it('rejects disabled accounts', async () => {
    const { user, email, password } = await createUser();
    await UserModel.updateOne({ _id: user._id }, { status: 'disabled' });
    const client = await newClient();
    expect((await client.post('/api/v1/auth/login', { email, password })).status).toBe(403);
  });

  it('requires a CSRF token for state-changing requests', async () => {
    const { email, password } = await createUser();
    const res = await request(app).post('/api/v1/auth/login').send({ email, password });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_INVALID');
  });

  it('updates display name, preferences and password from the profile endpoint', async () => {
    const { client } = await loggedInClient('tourist');
    const updated = await client.patch('/api/v1/auth/profile', {
      displayName: 'Minh Huyền',
      preferences: { areas: ['sa-dec'], interests: ['culture'], numberOfDays: 3, hoursPerDay: 6 },
    });
    expect(updated.status).toBe(200);
    expect(updated.body.user).toMatchObject({
      displayName: 'Minh Huyền',
      role: 'tourist',
      preferences: { areas: ['sa-dec'], interests: ['culture'], numberOfDays: 3, hoursPerDay: 6 },
    });
    expect((await client.get('/api/v1/auth/me')).body.user.displayName).toBe('Minh Huyền');

    const wrongPassword = await client.patch('/api/v1/auth/profile', {
      currentPassword: 'not-the-password',
      newPassword: 'New-secret-99',
    });
    expect(wrongPassword.status).toBe(400);
    expect(wrongPassword.body.error.code).toBe('INVALID_PASSWORD');

    const { email, password } = await (async () => {
      const me = await client.get('/api/v1/auth/me');
      return { email: me.body.user.email as string, password: 'Secret-password-1' };
    })();
    expect((await client.patch('/api/v1/auth/profile', { currentPassword: password, newPassword: 'New-secret-99' })).status).toBe(200);

    const other = await newClient();
    expect((await other.post('/api/v1/auth/login', { email, password: 'New-secret-99' })).status).toBe(200);
  });

  it('does not let a signed-in user change their role through the profile API', async () => {
    const { client } = await loggedInClient('tourist');
    const res = await client.patch('/api/v1/auth/profile', { displayName: 'Hacker', role: 'admin' });
    expect(res.status).toBe(400);
    expect((await client.get('/api/v1/auth/me')).body.user.role).toBe('tourist');
  });

  it('returns a uniform error for unknown API routes', async () => {
    const res = await request(app).get('/api/v1/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
  });

  it('blocks x-client-platform: mobile CSRF spoofing and cross-session CSRF token reuse on cookie sessions', async () => {
    const { client: victim } = await loggedInClient('tourist');
    const attackerClient = await newClient();
    const attackerCsrfRes = await attackerClient.get('/api/v1/csrf');
    const attackerCsrfToken = attackerCsrfRes.body.csrfToken as string;
    const forgedHex = 'a'.repeat(64);

    // 1. Spoofing x-client-platform: mobile with random 64-hex token while carrying victim's auth cookie must fail
    const mobileSpoof = await victim.agent
      .patch('/api/v1/auth/profile')
      .set('x-client-platform', 'mobile')
      .set('x-csrf-token', forgedHex)
      .send({ displayName: 'CSRF Spoofed' });
    expect(mobileSpoof.status).toBe(403);
    expect(mobileSpoof.body.error.code).toBe('CSRF_INVALID');

    // 2. Reusing another session's valid GET /csrf token against victim's auth cookie must also fail
    const crossSessionReuse = await victim.agent
      .patch('/api/v1/auth/profile')
      .set('x-csrf-token', attackerCsrfToken)
      .send({ displayName: 'Cross Session CSRF' });
    expect(crossSessionReuse.status).toBe(403);
    expect(crossSessionReuse.body.error.code).toBe('CSRF_INVALID');
  });

  it('enforces >= 8 character password policy on registration', async () => {
    const client = await newClient();
    const shortPwd = await client.post('/api/v1/auth/register', {
      email: 'shortpwd@test.local',
      password: '123456',
      displayName: 'Short Pwd',
    });
    expect(shortPwd.status).toBe(400);
  });

  it('never leaks plaintext passwords into AI Copilot action URL paths', async () => {
    const loginResult = await processCopilotMessage(
      'đăng nhập email tourist@example.com mật khẩu SuperSecretPassword99',
      [],
    );
    expect(loginResult.action?.type).toBe('LOGIN_ACCOUNT');
    expect(loginResult.action?.payload.path).toBe('/login');
    expect(loginResult.action?.payload.path).not.toContain('SuperSecretPassword99');
    expect(loginResult.action?.payload.path).not.toContain('autoSubmit');
  });

  it('rejects disguised non-image payloads on /api/v1/ai/visual-search via magic-byte check', async () => {
    const client = await newClient();
    const csrfRes = await client.get('/api/v1/csrf');
    const fakeImg = Buffer.from('<?php echo "not an image"; ?>', 'utf8');
    const res = await client.agent
      .post('/api/v1/ai/visual-search')
      .set('x-csrf-token', csrfRes.body.csrfToken)
      .attach('image', fakeImg, { filename: 'exploit.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('cascade-deletes FootprintPhoto and FootprintPhotoBlob records when admin deletes a user', async () => {
    const { client: tourist, user: touristUser } = await loggedInClient('tourist');
    const { client: admin } = await loggedInClient('admin');
    const csrfRes = await tourist.get('/api/v1/csrf');

    // Minimal valid 1x1 PNG binary
    const tinyPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );
    const uploadRes = await tourist.agent
      .post('/api/v1/footprints/photos')
      .set('x-csrf-token', csrfRes.body.csrfToken)
      .field('lat', '10.456')
      .field('lng', '105.632')
      .field('takenAt', '2026-11-24T10:00:00.000Z')
      .attach('photo', tinyPng, { filename: 'memory.png', contentType: 'image/png' });
    expect(uploadRes.status).toBe(201);

    expect(await FootprintPhotoModel.countDocuments({ userId: touristUser._id })).toBe(1);
    expect(await FootprintPhotoBlobModel.countDocuments()).toBe(1);

    const delRes = await admin.delete(`/api/v1/admin/users/${String(touristUser._id)}`);
    expect(delRes.status).toBe(204);

    expect(await FootprintPhotoModel.countDocuments({ userId: touristUser._id })).toBe(0);
    expect(await FootprintPhotoBlobModel.countDocuments()).toBe(0);
  });

  it('enforces full 6-digit Email OTP registration flow: cooldown, max-attempts lockout, verification, and anti-replay', async () => {
    const client = await newClient();
    const payload = {
      email: 'otp-user@test.local',
      displayName: 'Thịnh Đồng Tháp',
      password: 'StrongPassword@2026',
    };

    // 1. Request OTP -> creates hashed OTP record in DB (never plaintext)
    const req1 = await client.post('/api/v1/auth/register/request-otp', payload);
    expect(req1.status).toBe(200);
    expect(req1.body.sent).toBe(true);
    expect(req1.body.expiresInSeconds).toBe(300);
    expect(req1.body.resendCooldownSeconds).toBe(60);

    const otpDoc = await EmailOtpModel.findOne({ email: payload.email, purpose: 'register' }).lean();
    expect(otpDoc).toBeTruthy();
    expect(otpDoc?.codeHash).toMatch(/^[a-f0-9]{64}$/);

    // 2. Immediate resend within 60s must be blocked by cooldown
    const reqTooFast = await client.post('/api/v1/auth/register/request-otp', payload);
    expect(reqTooFast.status).toBe(429);
    expect(reqTooFast.body.error.code).toBe('OTP_COOLDOWN');

    // 3. Inject known deterministic HMAC hash for verification & attempt-lockout checks
    const knownCode = '482916';
    const knownHash = crypto
      .createHmac('sha256', env.JWT_SECRET)
      .update(`register:${payload.email}:${knownCode}`)
      .digest('hex');
    await EmailOtpModel.updateOne({ _id: otpDoc!._id }, { $set: { codeHash: knownHash, attempts: 0 } });

    // 4 wrong attempts return 400 OTP_INVALID, 5th returns 429 OTP_LOCKED
    for (let i = 0; i < 4; i += 1) {
      const wrong = await client.post('/api/v1/auth/register/verify-otp', { ...payload, otp: '000000' });
      expect(wrong.status).toBe(400);
      expect(wrong.body.error.code).toBe('OTP_INVALID');
    }
    const fifthWrong = await client.post('/api/v1/auth/register/verify-otp', { ...payload, otp: '000000' });
    expect(fifthWrong.status).toBe(429);
    expect(fifthWrong.body.error.code).toBe('OTP_LOCKED');

    // Even valid code fails while locked
    const lockedTry = await client.post('/api/v1/auth/register/verify-otp', { ...payload, otp: knownCode });
    expect(lockedTry.status).toBe(429);
    expect(lockedTry.body.error.code).toBe('OTP_LOCKED');

    // Reset attempts & verify with correct 6-digit OTP -> 201 + emailVerified + HttpOnly cookie
    await EmailOtpModel.updateOne({ _id: otpDoc!._id }, { $set: { attempts: 0 } });
    const verified = await client.post('/api/v1/auth/register/verify-otp', { ...payload, otp: knownCode });
    expect(verified.status).toBe(201);
    expect(verified.body.user).toMatchObject({ email: payload.email, role: 'tourist' });
    const storedUser = await UserModel.findOne({ email: payload.email }).lean();
    expect(storedUser?.emailVerified).toBe(true);

    // Replay same OTP fails (already consumed / email taken)
    const replay = await client.post('/api/v1/auth/register/verify-otp', { ...payload, otp: knownCode });
    expect(replay.status).toBe(409);
  });

  it('renders branded HTML OTP email safely with HTML-escaped displayName', () => {
    const rendered = renderRegisterOtpEmail({
      displayName: '<script>alert(1)</script> Thịnh',
      email: 'thinh.raccoon@gmail.com',
      otpCode: '739204',
      expiresMinutes: 5,
    });
    expect(rendered.subject).toContain('739204');
    expect(rendered.html).not.toContain('<script>');
    expect(rendered.html).toContain('&lt;script&gt;');
    expect(rendered.html).toContain('dongthapgo.com');
    expect(rendered.html).toContain('support@dongthapgo.com');
    expect(rendered.text).toContain('739204');
  });

  it('supports persistent mobile/PWA token login, restores session when cookies are evicted, and re-issues sliding cookie on /auth/me', async () => {
    const { email, password } = await createUser('tourist', 'mobile-persist@test.local');
    const csrfRes = await request(app).get('/api/v1/csrf');
    const csrfToken = csrfRes.body.csrfToken as string;

    // 1. Mobile/PWA client opting into token persistence receives a signed Bearer token + 30-day HttpOnly cookie
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .set('x-auth-persistence', 'token')
      .set('x-csrf-token', csrfToken)
      .send({ email, password });

    expect(loginRes.status).toBe(200);
    expect(typeof loginRes.body.token).toBe('string');
    expect(loginRes.body.token.length).toBeGreaterThan(20);
    const setCookies = ([] as string[]).concat(loginRes.headers['set-cookie'] ?? []);
    expect(setCookies.some((c) => c.startsWith('dtst_access=') && /Max-Age=2592000/i.test(c))).toBe(true);

    // 2. Simulate iOS Safari ITP / PWA restart wiping ALL cookies: Bearer token alone restores session cleanly
    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${loginRes.body.token}`)
      .set('x-auth-persistence', 'token');
    expect(meRes.status).toBe(200);
    expect(meRes.headers['cache-control']).toContain('no-store');
    expect(meRes.body.user.email).toBe(email);
    expect(typeof meRes.body.token).toBe('string');

    // 3. Pure Bearer mutation works without ambient cookie CSRF error
    const patchRes = await request(app)
      .patch('/api/v1/auth/profile')
      .set('Authorization', `Bearer ${meRes.body.token}`)
      .set('x-auth-persistence', 'token')
      .send({ displayName: 'Mobile Tourist' });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.user.displayName).toBe('Mobile Tourist');

    // 4. Stale/corrupted cookie alongside a valid Bearer token still authenticates via Bearer
    const staleCookieRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', 'dtst_access=corrupted.expired.token')
      .set('Authorization', `Bearer ${meRes.body.token}`);
    expect(staleCookieRes.status).toBe(200);
    expect(staleCookieRes.body.user.displayName).toBe('Mobile Tourist');
  });
});
