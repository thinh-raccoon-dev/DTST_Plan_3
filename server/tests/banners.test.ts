import { describe, expect, it } from 'vitest';
import { BannerModel } from '../src/models/Banner.js';
import { loggedInClient, newClient, useTestDatabase } from './helpers.js';

useTestDatabase();

const validBanner = {
  title: 'Mùa sen Đồng Tháp 2026',
  subtitle: 'Ưu đãi combo tham quan + ẩm thực.',
  kind: 'promo',
  sponsorName: 'Công ty Du lịch ABC',
  linkUrl: 'https://example.com/uu-dai',
  linkLabel: 'Xem ưu đãi',
  status: 'active',
};

describe('public banners', () => {
  it('returns only active banners inside their schedule, ordered by sortOrder', async () => {
    const day = 24 * 3600 * 1000;
    const now = Date.now();
    await BannerModel.create([
      { title: 'Thứ hai', status: 'active', sortOrder: 2 },
      { title: 'Thứ nhất', status: 'active', sortOrder: 1 },
      { title: 'Ẩn', status: 'inactive', sortOrder: 0 },
      { title: 'Chưa tới ngày', status: 'active', sortOrder: 0, startAt: new Date(now + day) },
      { title: 'Đã hết hạn', status: 'active', sortOrder: 0, endAt: new Date(now - day) },
      { title: 'Đang diễn ra', status: 'active', sortOrder: 0, startAt: new Date(now - day), endAt: new Date(now + day) },
    ]);

    const res = await (await newClient()).get('/api/v1/banners');
    expect(res.status).toBe(200);
    expect(res.body.items.map((b: { title: string }) => b.title)).toEqual(['Đang diễn ra', 'Thứ nhất', 'Thứ hai']);
    // Public payload never exposes counters or scheduling internals.
    expect(res.body.items[0]).not.toHaveProperty('impressions');
    expect(res.body.items[0]).not.toHaveProperty('status');
  });

  it('counts impressions and clicks without requiring a login', async () => {
    const banner = await BannerModel.create({ title: 'Cover', status: 'active' });
    const client = await newClient();
    await client.get('/api/v1/banners');
    expect((await client.post(`/api/v1/banners/${banner.id}/click`)).status).toBe(204);
    expect((await client.post(`/api/v1/banners/${banner.id}/click`)).status).toBe(204);

    // Impression increment is fire-and-forget; give it a moment.
    await new Promise((r) => setTimeout(r, 50));
    const fresh = await BannerModel.findById(banner.id).lean();
    expect(fresh?.clicks).toBe(2);
    expect(fresh?.impressions).toBe(1);

    expect((await client.post('/api/v1/banners/not-an-id/click')).status).toBe(400);
  });
});

describe('admin banner management', () => {
  it('requires an admin session', async () => {
    const anonymous = await newClient();
    expect((await anonymous.get('/api/v1/admin/banners')).status).toBe(401);
    const { client: tourist } = await loggedInClient('tourist');
    expect((await tourist.post('/api/v1/admin/banners', validBanner)).status).toBe(403);
  });

  it('creates, updates, lists and deletes banners', async () => {
    const { client } = await loggedInClient('admin');
    const created = await client.post('/api/v1/admin/banners', validBanner);
    expect(created.status).toBe(201);
    expect(created.body.banner).toMatchObject({ title: validBanner.title, kind: 'promo', isLive: true, impressions: 0, clicks: 0 });
    const id = created.body.banner.id as string;

    const visitor = await newClient();
    expect((await visitor.get('/api/v1/banners')).body.items).toHaveLength(1);

    const patched = await client.patch(`/api/v1/admin/banners/${id}`, { status: 'inactive', subtitle: '' });
    expect(patched.status).toBe(200);
    expect(patched.body.banner.status).toBe('inactive');
    expect(patched.body.banner.subtitle).toBeNull();
    expect((await visitor.get('/api/v1/banners')).body.items).toHaveLength(0);

    const list = await client.get('/api/v1/admin/banners?status=inactive');
    expect(list.status).toBe(200);
    expect(list.body.total).toBe(1);

    expect((await client.delete(`/api/v1/admin/banners/${id}`)).status).toBe(204);
    expect((await client.get(`/api/v1/admin/banners/${id}`)).status).toBe(404);
  });

  it('validates links, schedule, sponsor and unknown fields', async () => {
    const { client } = await loggedInClient('admin');
    expect((await client.post('/api/v1/admin/banners', { ...validBanner, linkUrl: 'javascript:alert(1)' })).status).toBe(400);
    expect((await client.post('/api/v1/admin/banners', { ...validBanner, linkUrl: '//evil.example' })).status).toBe(400);
    expect((await client.post('/api/v1/admin/banners', { ...validBanner, imageUrl: 'data:image/png;base64,AAAA' })).status).toBe(400);
    expect((await client.post('/api/v1/admin/banners', { ...validBanner, extra: true })).status).toBe(400);
    expect((await client.post('/api/v1/admin/banners', { ...validBanner, sponsorName: '' })).status).toBe(400);
    const bad = await client.post('/api/v1/admin/banners', {
      ...validBanner,
      startAt: '2026-12-01T00:00:00.000Z',
      endAt: '2026-11-01T00:00:00.000Z',
    });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('VALIDATION_ERROR');

    const ok = await client.post('/api/v1/admin/banners', {
      ...validBanner,
      kind: 'cover',
      sponsorName: '',
      linkUrl: '/destinations',
      startAt: null,
      endAt: '',
    });
    expect(ok.status).toBe(201);
    expect(ok.body.banner.linkUrl).toBe('/destinations');
    expect(ok.body.banner.sponsorName).toBeNull();
    // null / '' mean "no schedule" – they must not become the Unix epoch.
    expect(ok.body.banner.startAt).toBeNull();
    expect(ok.body.banner.endAt).toBeNull();
    expect(ok.body.banner.isLive).toBe(true);

    // Clearing a schedule via PATCH works the same way.
    const id = ok.body.banner.id as string;
    await client.patch(`/api/v1/admin/banners/${id}`, { endAt: '2030-01-01T00:00:00.000Z' });
    expect((await client.get(`/api/v1/admin/banners/${id}`)).body.banner.endAt).toBe('2030-01-01T00:00:00.000Z');
    await client.patch(`/api/v1/admin/banners/${id}`, { endAt: null });
    expect((await client.get(`/api/v1/admin/banners/${id}`)).body.banner.endAt).toBeNull();
  });
});
