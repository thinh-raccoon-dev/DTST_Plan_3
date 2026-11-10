import { describe, expect, it } from 'vitest';
import { loggedInClient, newClient, useTestDatabase } from './helpers.js';

useTestDatabase();

describe('Admin system & users management', () => {
  it('protects new admin endpoints from anonymous users and tourists', async () => {
    const anonymous = await newClient();
    expect((await anonymous.get('/api/v1/admin/users')).status).toBe(401);
    expect((await anonymous.get('/api/v1/admin/itineraries')).status).toBe(401);
    expect((await anonymous.get('/api/v1/admin/passport-logs')).status).toBe(401);
    expect((await anonymous.get('/api/v1/admin/system/status')).status).toBe(401);

    const { client: tourist } = await loggedInClient('tourist');
    expect((await tourist.get('/api/v1/admin/users')).status).toBe(403);
    expect((await tourist.get('/api/v1/admin/itineraries')).status).toBe(403);
    expect((await tourist.get('/api/v1/admin/passport-logs')).status).toBe(403);
    expect((await tourist.get('/api/v1/admin/system/status')).status).toBe(403);
  });

  it('allows admin to list, create, change role, and toggle status of users', async () => {
    const { client: admin } = await loggedInClient('admin');

    // 1. List users
    const listRes = await admin.get('/api/v1/admin/users');
    expect(listRes.status).toBe(200);
    expect(listRes.body.items).toBeDefined();
    expect(listRes.body.stats).toBeDefined();

    // 2. Create user
    const createRes = await admin.post('/api/v1/admin/users', {
      email: 'canbo.huongdan@dongthap.gov.vn',
      displayName: 'Cán bộ Hướng dẫn',
      password: 'StrongPassword123',
      role: 'partner',
    });
    expect(createRes.status).toBe(201);
    expect(createRes.body.user.email).toBe('canbo.huongdan@dongthap.gov.vn');
    expect(createRes.body.user.role).toBe('partner');

    const newUserId = createRes.body.user.id as string;

    // 3. Update role
    const updateRoleRes = await admin.patch(`/api/v1/admin/users/${newUserId}/role`, {
      role: 'tourist',
    });
    expect(updateRoleRes.status).toBe(200);
    expect(updateRoleRes.body.user.role).toBe('tourist');

    // 4. Toggle status to disabled
    const disableRes = await admin.patch(`/api/v1/admin/users/${newUserId}/status`, {
      status: 'disabled',
    });
    expect(disableRes.status).toBe(200);
    expect(disableRes.body.user.status).toBe('disabled');

    // 5. Reset password
    const resetRes = await admin.post(`/api/v1/admin/users/${newUserId}/reset-password`, {
      password: 'NewStrongPassword456',
    });
    expect(resetRes.status).toBe(200);
  });

  it('provides comprehensive system status & settings to admin', async () => {
    const { client: admin } = await loggedInClient('admin');

    // Status check
    const statusRes = await admin.get('/api/v1/admin/system/status');
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.services.backend.status).toBe('online');
    expect(statusRes.body.services.database.status).toBe('connected');

    // Settings get and update
    const settingsRes = await admin.get('/api/v1/admin/system/settings');
    expect(settingsRes.status).toBe(200);
    expect(settingsRes.body.settings).toBeDefined();

    const updateSettingsRes = await admin.put('/api/v1/admin/system/settings', {
      announcement: {
        enabled: true,
        message: 'Tuần lễ Du lịch Đồng Tháp 2026',
        tone: 'lotus',
        linkUrl: 'https://dongthap.gov.vn',
      },
    });
    expect(updateSettingsRes.status).toBe(200);
    expect(updateSettingsRes.body.settings.announcement.enabled).toBe(true);

    // Public announcement endpoint
    const pub = await (await newClient()).get('/api/v1/system/announcement');
    expect(pub.status).toBe(200);
    expect(pub.body.announcement.message).toBe('Tuần lễ Du lịch Đồng Tháp 2026');
  });

  it('allows admin to query itineraries and passport logs', async () => {
    const { client: admin } = await loggedInClient('admin');

    const itinRes = await admin.get('/api/v1/admin/itineraries');
    expect(itinRes.status).toBe(200);
    expect(Array.isArray(itinRes.body.items)).toBe(true);
    expect(itinRes.body.stats).toBeDefined();

    const logsRes = await admin.get('/api/v1/admin/passport-logs');
    expect(logsRes.status).toBe(200);
    expect(Array.isArray(logsRes.body.items)).toBe(true);
    expect(logsRes.body.stats).toBeDefined();
  });
});
