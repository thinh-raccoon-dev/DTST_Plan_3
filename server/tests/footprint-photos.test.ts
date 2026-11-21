import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { signAccessToken } from '../src/middleware/auth.js';
import { app, createDestination, createUser, loggedInClient, newClient, useTestDatabase } from './helpers.js';

useTestDatabase();

// Minimal valid 1x1 PNG binary (passes OWASP magic-byte verification)
const TINY_VALID_PNG = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082',
  'hex',
);

describe('Footprint Photo Memories & Shared Mobile App Sync API', () => {
  it('uploads a real multipart geotagged photo, auto-matches nearest destination, auto-checks in, and cleans up on delete', async () => {
    const dest = await createDestination({
      name: 'Làng hoa Sa Đéc (Tân Quy Đông)',
      slug: 'lang-hoa-sa-dec',
      area: 'sa-dec',
      category: 'local_experience',
      coordinates: { lat: 10.3125, lng: 105.7468 },
    });

    const { client } = await loggedInClient('tourist');
    const csrfRes = await client.get('/api/v1/csrf');
    const csrfToken = csrfRes.body.csrfToken as string;

    const takenAt = '2026-11-21T12:56:00.000Z';
    const uploadRes = await client.agent
      .post('/api/v1/footprints/photos')
      .set('x-csrf-token', csrfToken)
      .field('clientPhotoId', 'web-test-photo-1')
      .field('lat', '10.3127')
      .field('lng', '105.7469')
      .field('takenAt', takenAt)
      .field('caption', 'Chụp hoa cúc mâm xôi buổi chiều')
      .field('exifSource', 'exif')
      .field('deviceModel', 'Apple iPhone 16 Pro')
      .attach('photo', TINY_VALID_PNG, { filename: 'hoa-sa-dec.png', contentType: 'image/png' });

    expect(uploadRes.status).toBe(201);
    expect(uploadRes.body.success).toBe(true);
    expect(uploadRes.body.photo.imageUrl).toMatch(/^\/uploads\/footprints\/fp-.*\.png$/);
    expect(uploadRes.body.photo.takenAt).toBe(takenAt);
    expect(uploadRes.body.photo.placeName).toBe(dest.name);
    expect(uploadRes.body.photo.destinationId).toBe(String(dest._id));
    expect(uploadRes.body.photo.deviceModel).toBe('Apple iPhone 16 Pro');
    expect(uploadRes.body.autoCheckIn?.slug).toBe('lang-hoa-sa-dec');

    // Also surfaced inside GET /api/v1/footprints combined payload
    const fpRes = await client.get('/api/v1/footprints');
    expect(fpRes.status).toBe(200);
    expect(fpRes.body.photos.length).toBe(1);
    expect(fpRes.body.stats.totalPhotos).toBe(1);

    // Clean up uploaded test file via DELETE endpoint
    const delRes = await client.delete(`/api/v1/footprints/photos/${uploadRes.body.photo.id}`);
    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);
  });

  it('rejects spoofed non-image binary uploads with 400 INVALID_IMAGE_SIGNATURE', async () => {
    const { client } = await loggedInClient('tourist');
    const csrfRes = await client.get('/api/v1/csrf');
    const csrfToken = csrfRes.body.csrfToken as string;

    const fakePayload = Buffer.from('<script>alert(1)</script>', 'utf8');
    const res = await client.agent
      .post('/api/v1/footprints/photos')
      .set('x-csrf-token', csrfToken)
      .field('lat', '10.31')
      .field('lng', '105.74')
      .field('takenAt', new Date().toISOString())
      .attach('photo', fakePayload, { filename: 'evil.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(400);
    expect(res.body.error?.code).toBe('INVALID_IMAGE_SIGNATURE');
  });

  it('supports Companion Mobile App Bearer Auth, idempotent batch sync, filtering, and strict zero-IDOR', async () => {
    await createDestination({
      name: 'Nhà cổ Huỳnh Thủy Lê',
      slug: 'nha-co-huynh-thuy-le',
      area: 'sa-dec',
      category: 'culture',
      coordinates: { lat: 10.2923, lng: 105.7592 },
    });

    const { user: userA } = await createUser('tourist', 'mobile-a@test.local');
    const tokenA = signAccessToken(String(userA._id), 0);
    const { client: clientB } = await loggedInClient('tourist');

    const csrfRes = await request(app).get('/api/v1/csrf');
    const mobileCsrf = csrfRes.body.csrfToken as string;

    const batchPayload = {
      autoCheckIn: true,
      photos: [
        {
          clientPhotoId: 'ios-20261121-01',
          imageUrl: 'https://cdn.example.com/photos/sadec-01.jpg',
          lat: 10.2924,
          lng: 105.7591,
          takenAt: '2026-11-21T08:15:00.000Z',
          caption: 'Mặt tiền Nhà cổ buổi sáng',
          sourceApp: 'ios',
          deviceModel: 'iPhone 16 Pro',
          exifSource: 'exif',
        },
        {
          clientPhotoId: 'ios-20261121-02',
          imageUrl: 'https://cdn.example.com/photos/sadec-02.jpg',
          lat: 10.2925,
          lng: 105.7593,
          takenAt: '2026-11-21T09:40:00.000Z',
          caption: 'Nội thất gỗ chạm trổ tinh xảo',
          sourceApp: 'ios',
          deviceModel: 'iPhone 16 Pro',
          exifSource: 'gps',
        },
      ],
    };

    // First sync from Mobile App (Bearer + x-client-platform: mobile)
    const sync1 = await request(app)
      .post('/api/v1/footprints/photos/sync')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-client-platform', 'mobile')
      .set('x-csrf-token', mobileCsrf)
      .send(batchPayload);

    expect(sync1.status).toBe(200);
    expect(sync1.body.createdCount).toBe(2);
    expect(sync1.body.updatedCount).toBe(0);
    expect(sync1.body.autoCheckIns.length).toBe(1);

    // Retry same batch -> idempotent, zero duplicates!
    const sync2 = await request(app)
      .post('/api/v1/footprints/photos/sync')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-client-platform', 'mobile')
      .set('x-csrf-token', mobileCsrf)
      .send(batchPayload);

    expect(sync2.status).toBe(200);
    expect(sync2.body.createdCount).toBe(0);
    expect(sync2.body.updatedCount).toBe(2);

    // List photos & place collections
    const listRes = await request(app)
      .get('/api/v1/footprints/photos?q=Nhà%20cổ')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.photos.length).toBe(2);
    expect(listRes.body.places.length).toBe(1);
    expect(listRes.body.places[0].photoCount).toBe(2);
    expect(listRes.body.places[0].placeName).toBe('Nhà cổ Huỳnh Thủy Lê');

    const firstPhotoId = listRes.body.photos[0].id as string;

    // Zero-IDOR: User B cannot edit or delete User A's photo!
    const idorPatch = await clientB.patch(`/api/v1/footprints/photos/${firstPhotoId}`, {
      caption: 'Hacked caption',
    });
    expect(idorPatch.status).toBe(404);

    const idorDelete = await clientB.delete(`/api/v1/footprints/photos/${firstPhotoId}`);
    expect(idorDelete.status).toBe(404);

    // Owner A can edit caption cleanly
    const ownerPatch = await request(app)
      .patch(`/api/v1/footprints/photos/${firstPhotoId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-client-platform', 'mobile')
      .set('x-csrf-token', mobileCsrf)
      .send({ caption: 'Ghi chú đã cập nhật từ app' });

    expect(ownerPatch.status).toBe(200);
    expect(ownerPatch.body.photo.caption).toBe('Ghi chú đã cập nhật từ app');

    // Anonymous guest photo claimed automatically when listing after login
    const guest = await newClient();
    const guestPost = await guest.post('/api/v1/footprints/photos', {
      clientPhotoId: 'guest-photo-1',
      imageUrl: 'https://cdn.example.com/photos/guest.jpg',
      lat: 10.4562,
      lng: 105.6324,
      takenAt: '2026-11-21T10:00:00.000Z',
      placeName: 'Bảo tàng Đồng Tháp',
    });
    expect(guestPost.status).toBe(201);
  });
});
