import { describe, expect, it } from 'vitest';
import { DestinationModel } from '../src/models/Destination.js';
import { createDestination, loggedInClient, newClient, useTestDatabase } from './helpers.js';

useTestDatabase();

const prefs = { numberOfDays: 1, hoursPerDay: 8, areas: [], interests: [] };

describe('itinerary API', () => {
  it('generates only from published, operating destinations', async () => {
    const visible = await createDestination({ slug: 'visible' });
    await createDestination({ slug: 'hidden', publicationStatus: 'hidden' });
    await createDestination({ slug: 'closed', operationalStatus: 'closed' });
    const visitor = await newClient();
    const res = await visitor.post('/api/v1/itineraries/generate', prefs);
    expect(res.status).toBe(200);
    const ids = res.body.plan.days.flatMap((d: { items: Array<{ destinationId: string }> }) => d.items.map((i) => i.destinationId));
    expect(ids).toEqual([visible.id]);
    expect((await visitor.post('/api/v1/itineraries/generate', { ...prefs, numberOfDays: 30 })).status).toBe(400);
  });

  it('requires an account to save', async () => {
    const destination = await createDestination();
    const visitor = await newClient();
    const res = await visitor.post('/api/v1/itineraries', { title: 'Chuyến đi', days: [{ items: [{ destinationId: destination.id }] }] });
    expect(res.status).toBe(401);
  });

  it('saves, reads, updates and deletes only for the owner', async () => {
    const a = await createDestination({ slug: 'a', estimatedVisitDuration: { minutes: 60, isEstimate: true } });
    const b = await createDestination({ slug: 'b' });
    const { client: owner } = await loggedInClient('tourist');
    const created = await owner.post('/api/v1/itineraries', {
      title: 'Hai ngày Đồng Tháp',
      days: [{ items: [{ destinationId: a.id }, { destinationId: b.id }] }, { items: [] }],
    });
    expect(created.status).toBe(201);
    const id = created.body.itinerary.id as string;
    expect(created.body.itinerary.estimatedDurationMinutes).toBe(60 + 30 + 90);

    const { client: stranger } = await loggedInClient('tourist');
    expect((await stranger.get(`/api/v1/itineraries/${id}`)).status).toBe(404);
    expect((await stranger.delete(`/api/v1/itineraries/${id}`)).status).toBe(404);
    expect((await stranger.get('/api/v1/itineraries/my')).body.items).toHaveLength(0);

    // Reorder and move b to day 2.
    const updated = await owner.patch(`/api/v1/itineraries/${id}`, {
      title: 'Đã sửa',
      days: [{ items: [{ destinationId: a.id }] }, { items: [{ destinationId: b.id }] }],
    });
    expect(updated.status).toBe(200);
    expect(updated.body.itinerary.days[1].items[0].destinationId).toBe(b.id);

    // Hiding a destination later keeps the old itinerary readable and editable.
    await DestinationModel.updateOne({ _id: b._id }, { publicationStatus: 'hidden' });
    const reread = await owner.get(`/api/v1/itineraries/${id}`);
    expect(reread.body.itinerary.days[1].items[0]).toMatchObject({ available: false, name: 'Điểm thử nghiệm' });
    expect((await owner.patch(`/api/v1/itineraries/${id}`, { title: 'Vẫn giữ', days: [{ items: [{ destinationId: b.id }] }] })).status).toBe(200);

    // But hidden places cannot be newly added.
    const c = await createDestination({ slug: 'c', publicationStatus: 'hidden' });
    const addHidden = await owner.patch(`/api/v1/itineraries/${id}`, { title: 'Thêm điểm ẩn', days: [{ items: [{ destinationId: c.id }] }] });
    expect(addHidden.body.error.code).toBe('DESTINATION_UNAVAILABLE');

    expect((await owner.post('/api/v1/itineraries', { title: 'Trùng', days: [{ items: [{ destinationId: a.id }, { destinationId: a.id }] }] })).status).toBe(400);

    expect((await owner.delete(`/api/v1/itineraries/${id}`)).status).toBe(204);
    expect((await owner.get(`/api/v1/itineraries/${id}`)).status).toBe(404);
  });
});

describe('favorites', () => {
  it('adds idempotently, lists and removes', async () => {
    const destination = await createDestination();
    const { client } = await loggedInClient('tourist');
    expect((await client.post(`/api/v1/favorites/${destination.id}`)).status).toBe(201);
    expect((await client.post(`/api/v1/favorites/${destination.id}`)).status).toBe(201);
    expect((await client.get('/api/v1/favorites')).body.items).toHaveLength(1);
    await client.delete(`/api/v1/favorites/${destination.id}`);
    expect((await client.get('/api/v1/favorites')).body.items).toHaveLength(0);
    expect((await (await newClient()).get('/api/v1/favorites')).status).toBe(401);
  });
});
