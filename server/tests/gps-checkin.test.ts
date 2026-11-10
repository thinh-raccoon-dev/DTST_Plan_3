import { describe, expect, it } from 'vitest';
import { PassportEntryModel } from '../src/models/PassportEntry.js';
import {
  createDestination,
  newClient,
  useTestDatabase,
} from './helpers.js';

useTestDatabase();

describe('GPS Geofencing Check-in API', () => {
  it('lists nearby destinations sorted by distance and flags canCheckIn', async () => {
    // Cao Lanh location: ~10.45, 105.63
    const destNear = await createDestination({
      name: 'Khu di tích Nguyễn Sinh Sắc',
      coordinates: { lat: 10.453, lng: 105.634 },
    });

    // Sa Dec location: ~10.29, 105.75 (~22 km away)
    const destFar = await createDestination({
      name: 'Làng hoa Sa Đéc',
      coordinates: { lat: 10.298, lng: 105.758 },
    });

    const visitor = await newClient();
    const res = await visitor.get('/api/v1/destinations/nearby?lat=10.453&lng=105.634');

    expect(res.status).toBe(200);
    expect(res.body.items).toBeDefined();
    expect(res.body.items.length).toBeGreaterThanOrEqual(2);

    const first = res.body.items[0];
    expect(first.name).toBe(destNear.name);
    expect(first.distanceMeters).toBeLessThanOrEqual(50);
    expect(first.canCheckIn).toBe(true);

    const second = res.body.items.find((i: { name: string }) => i.name === destFar.name);
    expect(second).toBeDefined();
    expect(second.distanceMeters).toBeGreaterThan(15000);
    expect(second.canCheckIn).toBe(false);
  });

  it('rejects GPS check-in if user is too far from the destination', async () => {
    const dest = await createDestination({
      name: 'Vườn quốc gia Tràm Chim',
      coordinates: { lat: 10.702, lng: 105.518 },
    });

    const visitor = await newClient();
    // User is at Cao Lanh (~10.45, 105.63), ~30km away
    const res = await visitor
      .post(`/api/v1/destinations/${dest.slug}/check-in`)
      .send({ lat: 10.453, lng: 105.634 });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('LOCATION_TOO_FAR');
  });

  it('successfully checks in with source: gps when within range (<= 1000m)', async () => {
    const dest = await createDestination({
      name: 'Chùa Kiến An Cung',
      coordinates: { lat: 10.302, lng: 105.761 },
    });

    const visitor = await newClient();
    // User is standing 100m away
    const res = await visitor
      .post(`/api/v1/destinations/${dest.slug}/check-in`)
      .send({ lat: 10.3025, lng: 105.7615 });

    expect(res.status).toBe(201);
    expect(res.body.created).toBe(true);
    expect(res.body.pointsAwarded).toBe(10);
    expect(res.body.distanceMeters).toBeLessThan(200);

    // Verify passport entry in database
    const entry = await PassportEntryModel.findOne({ destinationId: dest._id });
    expect(entry).not.toBeNull();
    expect(entry?.entryType).toBe('check_in');
    expect(entry?.source).toBe('gps');
    expect(entry?.qrCodeId).toBeUndefined();

    // Duplicate check-in at same destination does not award points again
    const resDup = await visitor
      .post(`/api/v1/destinations/${dest.slug}/check-in`)
      .send({ lat: 10.3025, lng: 105.7615 });

    expect(resDup.status).toBe(200);
    expect(resDup.body.created).toBe(false);
    expect(resDup.body.pointsAwarded).toBe(0);
  });
});
