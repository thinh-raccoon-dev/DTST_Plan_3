import { describe, expect, it } from 'vitest';
import { resolveRange } from '../src/controllers/admin/analytics.controller.js';
import { AnalyticsEventModel } from '../src/models/AnalyticsEvent.js';
import { correctAnswers, createChallenge, createDestination, createQr, loggedInClient, newClient, useTestDatabase } from './helpers.js';

useTestDatabase();

describe('analytics range', () => {
  it('uses inclusive Vietnam calendar days', () => {
    const range = resolveRange('2026-10-01', '2026-10-01');
    expect(range.start.toISOString()).toBe('2026-09-30T17:00:00.000Z');
    expect(range.endExclusive.toISOString()).toBe('2026-10-01T17:00:00.000Z');
    expect(range.days).toBe(1);
    expect(() => resolveRange('2026-10-05', '2026-10-01')).toThrow();
  });
});

describe('admin analytics', () => {
  it('aggregates real events, distinguishes event types and filters by time', async () => {
    const destination = await createDestination({ slug: 'tram-chim' });
    const challenge = await createChallenge(destination._id);
    const qr = await createQr(destination._id, { code: 'STAT-01' });

    const visitorA = await newClient();
    const visitorB = await newClient();
    await visitorA.post('/api/v1/events/destination-view', { slug: 'tram-chim' });
    await visitorA.post('/api/v1/events/destination-view', { slug: 'tram-chim' }); // deduped
    await visitorB.post('/api/v1/events/destination-view', { slug: 'tram-chim' });
    await visitorA.post(`/api/v1/qr/${qr.code}/scan`);
    await visitorA.post(`/api/v1/challenges/${challenge.id}/complete`, { qrCode: qr.code, answers: correctAnswers(challenge) });

    // An old event outside the default 30-day window.
    await AnalyticsEventModel.create({
      eventType: 'destination_page_view',
      destinationId: destination._id,
      anonymousSessionId: '00000000-0000-4000-8000-000000000000',
      timestamp: new Date('2020-01-01T00:00:00Z'),
    });

    const { client: admin } = await loggedInClient('admin');
    const res = await admin.get('/api/v1/admin/analytics');
    expect(res.status).toBe(200);
    expect(res.body.totals).toMatchObject({
      destinationPageViews: 2,
      qrLandingViews: 1,
      challengeAttempts: 1,
      challengeCompletions: 1,
      interactions: 1,
      uniqueVisitors: 2,
    });
    expect(res.body.funnel.steps.find((s: { key: string }) => s.key === 'challengeCompletions').count).toBe(1);
    expect(res.body.funnel.rates.attemptToCompletion).toBe(100);
    expect(res.body.current).toMatchObject({ publishedDestinations: 1, activeQrCodes: 1 });
    expect(res.body.daily).toHaveLength(30);
    expect(res.body.topDestinations[0]).toMatchObject({ slug: 'tram-chim', count: 2 });
    expect(res.body.topQrCodes[0]).toMatchObject({ code: 'STAT-01', count: 1 });
    expect(res.body.definitions.qrLandingViews).toContain('Không phải số khách');

    const old = await admin.get('/api/v1/admin/analytics?from=2020-01-01&to=2020-01-31');
    expect(old.body.totals.destinationPageViews).toBe(1);
    expect(old.body.totals.qrLandingViews).toBe(0);

    expect((await admin.get('/api/v1/admin/analytics?from=2020-01-01&to=2026-01-01')).status).toBe(400);
  });

  it('shows zeros, not fake numbers, when there is no activity', async () => {
    const { client: admin } = await loggedInClient('admin');
    const res = await admin.get('/api/v1/admin/analytics');
    expect(res.body.totals.destinationPageViews).toBe(0);
    expect(res.body.funnel.rates.qrToCheckIn).toBeNull();
    expect(res.body.topDestinations).toEqual([]);
  });
});
