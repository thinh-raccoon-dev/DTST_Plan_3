import { describe, expect, it } from 'vitest';
import { createDestination, createQr, createUser, loggedInClient, newClient, useTestDatabase } from './helpers.js';

useTestDatabase();

const validDestination = {
  name: 'Vườn quốc gia Tràm Chim',
  description: 'Vùng đất ngập nước tiêu biểu của Đồng Tháp Mười với nhiều loài chim.',
  category: 'nature',
  area: 'tam-nong',
  tags: ['sinh thái'],
  coordinates: { lat: 10.7, lng: 105.5 },
};

describe('admin access control', () => {
  it('returns 401 without a session and 403 for tourists', async () => {
    const anonymous = await newClient();
    expect((await anonymous.get('/api/v1/admin/destinations')).status).toBe(401);
    expect((await anonymous.post('/api/v1/admin/destinations', validDestination)).status).toBe(401);

    const { client: tourist } = await loggedInClient('tourist');
    expect((await tourist.get('/api/v1/admin/destinations')).status).toBe(403);
    expect((await tourist.get('/api/v1/admin/analytics')).status).toBe(403);
    expect((await tourist.post('/api/v1/admin/qr', {})).status).toBe(403);
  });
});

describe('admin destination management', () => {
  it('creates a draft, derives the slug, and publishes it', async () => {
    const { client } = await loggedInClient('admin');
    const created = await client.post('/api/v1/admin/destinations', validDestination);
    expect(created.status).toBe(201);
    expect(created.body.destination).toMatchObject({
      slug: 'vuon-quoc-gia-tram-chim',
      publicationStatus: 'draft',
      verificationStatus: 'unverified',
      openingHours: null,
      referencePrice: null,
    });

    const visitor = await newClient();
    expect((await visitor.get('/api/v1/destinations/vuon-quoc-gia-tram-chim')).status).toBe(404);

    const id = created.body.destination.id as string;
    expect((await client.patch(`/api/v1/admin/destinations/${id}`, { publicationStatus: 'published' })).status).toBe(200);
    const pub = await visitor.get('/api/v1/destinations/vuon-quoc-gia-tram-chim');
    expect(pub.status).toBe(200);
    expect(pub.body.destination.name).toBe('Vườn quốc gia Tràm Chim');

    // Edits are visible immediately without restarting anything.
    await client.patch(`/api/v1/admin/destinations/${id}`, { summary: 'Tóm tắt mới' });
    expect((await visitor.get('/api/v1/destinations/vuon-quoc-gia-tram-chim')).body.destination.summary).toBe('Tóm tắt mới');

    // Hiding removes it from the public API.
    await client.patch(`/api/v1/admin/destinations/${id}`, { publicationStatus: 'hidden' });
    expect((await visitor.get('/api/v1/destinations/vuon-quoc-gia-tram-chim')).status).toBe(404);
    expect((await visitor.get('/api/v1/destinations')).body.total).toBe(0);
  });

  it('validates input: coordinates, URLs, unknown fields and duplicate slugs', async () => {
    const { client } = await loggedInClient('admin');
    const badCoords = await client.post('/api/v1/admin/destinations', { ...validDestination, coordinates: { lat: 105.5, lng: 10.7 } });
    expect(badCoords.status).toBe(400);
    expect(badCoords.body.error.code).toBe('VALIDATION_ERROR');

    const badUrl = await client.post('/api/v1/admin/destinations', { ...validDestination, sourceUrls: ['javascript:alert(1)'] });
    expect(badUrl.status).toBe(400);

    const massAssignment = await client.post('/api/v1/admin/destinations', { ...validDestination, searchText: 'x', _id: 'abc' });
    expect(massAssignment.status).toBe(400);

    expect((await client.post('/api/v1/admin/destinations', validDestination)).status).toBe(201);
    const duplicate = await client.post('/api/v1/admin/destinations', validDestination);
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('SLUG_TAKEN');
  });

  it('refuses "verified" claims without data, source and date, and derives the overall status', async () => {
    const { client } = await loggedInClient('admin');
    const noData = await client.post('/api/v1/admin/destinations', {
      ...validDestination,
      verification: { location: 'unknown', openingHours: 'verified', referencePrice: 'unknown', contactInfo: 'unknown' },
    });
    expect(noData.status).toBe(400);

    const verified = await client.post('/api/v1/admin/destinations', {
      ...validDestination,
      openingHours: '7:00 – 17:00',
      sourceUrls: ['https://example.org/source'],
      lastVerifiedAt: '2026-10-01',
      verification: { location: 'unverified', openingHours: 'verified', referencePrice: 'unknown', contactInfo: 'unknown' },
    });
    expect(verified.status).toBe(201);
    expect(verified.body.destination.verificationStatus).toBe('partially_verified');
  });

  it('blocks deleting a destination that a QR code points to', async () => {
    const { client } = await loggedInClient('admin');
    const destination = await createDestination();
    await createQr(destination._id);
    const res = await client.delete(`/api/v1/admin/destinations/${destination.id}`);
    expect(res.status).toBe(409);

    const unused = await createDestination();
    expect((await client.delete(`/api/v1/admin/destinations/${unused.id}`)).status).toBe(204);
  });
});

describe('public destination listing', () => {
  it('only lists published places and supports accent-insensitive search and filters', async () => {
    await createDestination({ name: 'Nhà cổ Huỳnh Thủy Lê', slug: 'nha-co', category: 'culture', area: 'sa-dec' });
    await createDestination({ name: 'Làng hoa Sa Đéc', slug: 'lang-hoa', category: 'local_experience', area: 'sa-dec' });
    await createDestination({ name: 'Bản nháp', slug: 'ban-nhap', publicationStatus: 'draft' });
    const visitor = await newClient();

    const all = await visitor.get('/api/v1/destinations');
    expect(all.body.total).toBe(2);
    expect(all.body.items.map((d: { slug: string }) => d.slug)).not.toContain('ban-nhap');

    const search = await visitor.get('/api/v1/destinations?q=huynh thuy');
    expect(search.body.items.map((d: { slug: string }) => d.slug)).toEqual(['nha-co']);

    const filtered = await visitor.get('/api/v1/destinations?category=local_experience&area=sa-dec');
    expect(filtered.body.items.map((d: { slug: string }) => d.slug)).toEqual(['lang-hoa']);

    expect((await visitor.get('/api/v1/destinations?category=space')).status).toBe(400);
    expect((await visitor.get('/api/v1/destinations?limit=1&page=2')).body).toMatchObject({ page: 2, totalPages: 2 });
  });
});

describe('partner destination CMS', () => {
  it('lets a partner edit owned drafts but not publish, delete, or see other places', async () => {
    const { client: partner } = await loggedInClient('partner');
    const created = await partner.post('/api/v1/admin/destinations', validDestination);
    expect(created.status).toBe(201);
    expect(created.body.destination.publicationStatus).toBe('draft');
    const id = created.body.destination.id as string;

    const publish = await partner.patch(`/api/v1/admin/destinations/${id}`, { publicationStatus: 'published' });
    expect(publish.status).toBe(403);

    const renamed = await partner.patch(`/api/v1/admin/destinations/${id}`, { summary: 'Nội dung đối tác' });
    expect(renamed.status).toBe(200);
    expect(renamed.body.destination.summary).toBe('Nội dung đối tác');

    expect((await partner.delete(`/api/v1/admin/destinations/${id}`)).status).toBe(403);
    expect((await partner.get('/api/v1/admin/analytics')).status).toBe(403);

    const other = await createDestination({ slug: 'diem-khac', name: 'Điểm của admin' });
    expect((await partner.get(`/api/v1/admin/destinations/${other.id}`)).status).toBe(404);
    const listed = await partner.get('/api/v1/admin/destinations');
    expect(listed.body.items.map((d: { id: string }) => d.id)).toEqual([id]);
  });

  it('lets an admin assign a partner by email', async () => {
    const { email } = await createUser('partner', 'partner-assign@test.local');
    const { client: admin } = await loggedInClient('admin');
    const created = await admin.post('/api/v1/admin/destinations', { ...validDestination, managedByEmail: email });
    expect(created.status).toBe(201);
    expect(created.body.destination.managedByEmail).toBe(email);
  });
});

describe('content recommendations', () => {
  it('ranks related places by content overlap and personalizes the recommended list', async () => {
    const culture = await createDestination({ slug: 'nha-co-rel', name: 'Nhà cổ', category: 'culture', area: 'sa-dec', tags: ['hoa'] });
    await createDestination({ slug: 'chua-rel', name: 'Chùa', category: 'culture', area: 'cao-lanh', tags: ['hoa'] });
    await createDestination({ slug: 'vuon-rel', name: 'Vườn', category: 'nature', area: 'tam-nong', tags: [] });

    const visitor = await newClient();
    const related = await visitor.get('/api/v1/destinations/nha-co-rel/related');
    expect(related.status).toBe(200);
    expect(related.body.items[0].slug).toBe('chua-rel');

    const { client } = await loggedInClient('tourist');
    await client.patch('/api/v1/auth/profile', {
      preferences: { areas: ['sa-dec'], interests: ['culture'], numberOfDays: 2, hoursPerDay: 8 },
    });
    const rec = await client.get('/api/v1/destinations/recommended');
    expect(rec.status).toBe(200);
    expect(rec.body.personalized).toBe(true);
    expect(rec.body.items[0].id).toBe(culture.id);
  });
});
