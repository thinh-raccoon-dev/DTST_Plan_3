import http from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { env } from '../src/config/env.js';
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

describe('Trip Planner V9 API & Replan integration', () => {
  let mockPythonServer: http.Server;
  let originalPlannerUrl: string;
  let replanCallCount = 0;

  beforeAll(async () => {
    originalPlannerUrl = env.tripPlannerApiUrl;
    mockPythonServer = http.createServer((req, res) => {
      if (req.method === 'POST' && req.url === '/itineraries/replan') {
        replanCallCount += 1;
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });
        req.on('end', () => {
          const payload = JSON.parse(body);
          const day = payload.itinerary.days[0];
          const stops = day.activities.filter((s: { stop_id?: string }) => Boolean(s.stop_id));
          const current = stops.find((s: { status?: string }) => s.status !== 'completed');
          if (!current || current.stop_id !== payload.stop_id) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Sự kiện phải thuộc lượt ghé chưa hoàn thành đầu tiên' }));
            return;
          }
          const isArrived = payload.event === 'arrived';
          const currentUpdate = isArrived
            ? {
                ...current,
                status: 'arrived',
                arrived_at: payload.occurred_at,
                estimated_departure_at: '2026-11-07T10:30:00+07:00',
              }
            : {
                ...current,
                status: 'completed',
                departed_at: payload.occurred_at,
              };
          if (!isArrived) {
            delete currentUpdate.estimated_departure_at;
          }
          const remaining = stops.slice(stops.indexOf(current) + 1).map((s: Record<string, unknown>) => ({
            ...s,
            latitude: 10.3430936,
            longitude: 106.3559523,
            estimated_arrival_at: '2026-11-07T10:50:00+07:00',
            planned_start_at: '2026-11-07T10:50:00+07:00',
            planned_end_at: '2026-11-07T12:50:00+07:00',
          }));

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              trip_id: payload.trip_id,
              itinerary_version: payload.itinerary_version,
              event_id: payload.event_id,
              date: day.date,
              status: 'replanned',
              current_stop: currentUpdate,
              remaining_stops: remaining,
              next_stop: remaining[0] ?? null,
              issues: [],
              estimated_day_end_at: '2026-11-07T15:00:00+07:00',
              later_days_need_review: false,
            }),
          );
        });
        return;
      }
      res.writeHead(404);
      res.end();
    });

    await new Promise<void>((resolve) => mockPythonServer.listen(0, '127.0.0.1', () => resolve()));
    const address = mockPythonServer.address() as { port: number };
    (env as { tripPlannerApiUrl: string }).tripPlannerApiUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    (env as { tripPlannerApiUrl: string }).tripPlannerApiUrl = originalPlannerUrl;
    await new Promise<void>((resolve) => mockPythonServer.close(() => resolve()));
  });

  it('returns the 17 places catalog from /trip-planner/places', async () => {
    const visitor = await newClient();
    const res = await visitor.get('/api/v1/trip-planner/places');
    expect(res.status).toBe(200);
    expect(res.body.places).toHaveLength(17);
    expect(res.body.places[0].id).toBe('new_001');
    expect(res.body.places[16].id).toBe('new_017');
  });

  it('saves a V9 itinerary, updates progress (arrived -> departed), deduplicates event_id and enforces version locking', async () => {
    const { client: owner } = await loggedInClient('tourist');
    const sampleV9Itinerary = {
      status: 'provisional_itinerary',
      algorithm: 'primary_order_then_meal_windows_shared_hotel',
      input: {
        mode: 'manual',
        goal: 'sightseeing',
        start_id: 'new_001',
        selected_ids: ['new_014', 'new_016'],
        start_date: '2026-11-07',
        days: 1,
        people: 2,
        budget_vnd: 2000000,
        mode_of_transport: 'car',
        daily_start: '08:00',
        daily_end: '20:00',
        pace: 'balanced',
      },
      days: [
        {
          day: 1,
          date: '2026-11-07',
          status: 'provisional',
          start_place_id: 'new_001',
          planned_end_place_id: 'new_001',
          actual_end_place_id: 'new_001',
          visit_count: 2,
          overnight_stay: null,
          activities: [
            {
              type: 'visit',
              stop_id: 'stop_014',
              status: 'pending',
              place_id: 'new_014',
              name: 'Trại rắn Đồng Tâm',
              start: '08:20',
              end: '10:20',
              duration_minutes: 120,
            },
            {
              type: 'visit',
              stop_id: 'stop_016',
              status: 'pending',
              place_id: 'new_016',
              name: 'Khu Du Lịch Công Đoàn Thới Sơn Mỹ Tho Tiền Giang',
              start: '10:40',
              end: '12:40',
              duration_minutes: 120,
            },
          ],
        },
      ],
      shared_accommodation: null,
      scheduled_primary_ids: ['new_014', 'new_016'],
      unassigned_primary_places: [],
      budget_allocation: { whole_group_vnd: { food: 700000, stay: 0, transport: 500000, activities: 500000, reserve: 300000 } },
      cost_summary: { known_subtotal_vnd: 120000, unknown_cost_count: 1, road_distance_km: 18.4, budget_overage_vnd: 0 },
      routing_failures: [],
      warnings: [],
    };

    const created = await owner.post('/api/v1/itineraries', {
      title: 'Chuyến đi Mỹ Tho V9',
      v9Itinerary: sampleV9Itinerary,
    });
    expect(created.status).toBe(201);
    const id = created.body.itinerary.id as string;
    expect(created.body.itinerary.plannerVersion).toBe('v9');
    expect(created.body.itinerary.itineraryVersion).toBe(1);

    const beforeCalls = replanCallCount;

    // 1. Confirm arrived at stop_014
    const arrivedRes = await owner.post(`/api/v1/itineraries/${id}/replan`, {
      itinerary_version: 1,
      event_id: 'evt_arrived_1',
      stop_id: 'stop_014',
      event: 'arrived',
      occurred_at: '2026-11-07T08:30:00+07:00',
    });
    expect(arrivedRes.status).toBe(200);
    expect(arrivedRes.body.idempotentReplay).toBe(false);
    expect(arrivedRes.body.itinerary.itineraryVersion).toBe(2);
    expect(arrivedRes.body.replan.current_stop.status).toBe('arrived');
    expect(arrivedRes.body.replan.next_stop.stop_id).toBe('stop_016');
    expect(replanCallCount).toBe(beforeCalls + 1);

    // 2. Resend same event_id -> idempotent replay without calling Python or bumping version
    const replayRes = await owner.post(`/api/v1/itineraries/${id}/replan`, {
      itinerary_version: 1,
      event_id: 'evt_arrived_1',
      stop_id: 'stop_014',
      event: 'arrived',
      occurred_at: '2026-11-07T08:30:00+07:00',
    });
    expect(replayRes.status).toBe(200);
    expect(replayRes.body.idempotentReplay).toBe(true);
    expect(replayRes.body.itinerary.itineraryVersion).toBe(2);
    expect(replanCallCount).toBe(beforeCalls + 1);

    // 3. Stale version with new event_id -> 409 conflict
    const conflictRes = await owner.post(`/api/v1/itineraries/${id}/replan`, {
      itinerary_version: 1,
      event_id: 'evt_departed_stale',
      stop_id: 'stop_014',
      event: 'departed',
      occurred_at: '2026-11-07T10:35:00+07:00',
    });
    expect(conflictRes.status).toBe(409);
    expect(conflictRes.body.error.code).toBe('ITINERARY_VERSION_MISMATCH');

    // 4. Confirm departed with version 2 -> version becomes 3, stop_014 completed
    const departedRes = await owner.post(`/api/v1/itineraries/${id}/replan`, {
      itinerary_version: 2,
      event_id: 'evt_departed_1',
      stop_id: 'stop_014',
      event: 'departed',
      occurred_at: '2026-11-07T10:35:00+07:00',
    });
    expect(departedRes.status).toBe(200);
    expect(departedRes.body.itinerary.itineraryVersion).toBe(3);
    const updatedStop014 = departedRes.body.itinerary.v9Itinerary.days[0].activities[0];
    expect(updatedStop014.status).toBe('completed');
    expect(updatedStop014.arrived_at).toBe('2026-11-07T08:30:00+07:00');
    expect(updatedStop014.departed_at).toBe('2026-11-07T10:35:00+07:00');
    expect(updatedStop014.estimated_departure_at).toBeUndefined();
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
