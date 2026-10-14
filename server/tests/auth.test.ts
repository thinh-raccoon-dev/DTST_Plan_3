import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { UserModel } from '../src/models/User.js';
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
});
