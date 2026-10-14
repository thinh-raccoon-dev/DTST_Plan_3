import { describe, expect, it } from 'vitest';
import {
  DEFAULT_VISIT_MINUTES,
  TRANSITION_BUFFER_MINUTES,
  haversineKm,
  planItinerary,
  planItineraryWithAlternatives,
  type PlannerDestination,
  type PlannerInput,
} from '../src/services/itineraryPlanner.js';

function place(overrides: Partial<PlannerDestination> & { id: string }): PlannerDestination {
  return {
    slug: overrides.id,
    name: overrides.id,
    category: 'nature',
    tags: [],
    area: 'cao-lanh',
    coordinates: null,
    estimatedVisitMinutes: 60,
    ...overrides,
  };
}

const baseInput: PlannerInput = { numberOfDays: 1, hoursPerDay: 8, areas: [], interests: [], priorityDestinationIds: [] };

describe('planItinerary', () => {
  it('filters by area and interest, explaining why each place was chosen', () => {
    const result = planItinerary(
      [
        place({ id: 'a', category: 'culture', area: 'sa-dec' }),
        place({ id: 'b', category: 'food', area: 'sa-dec' }),
        place({ id: 'c', category: 'culture', area: 'my-tho' }),
      ],
      { ...baseInput, areas: ['sa-dec'], interests: ['culture'] },
    );
    const ids = result.days.flatMap((d) => d.items.map((i) => i.destinationId));
    expect(ids).toEqual(['a']);
    expect(result.days[0]!.items[0]!.reasons.join(' ')).toContain('Văn hóa');
  });

  it('counts matching tags as secondary interests', () => {
    const result = planItinerary(
      [place({ id: 'tagged', category: 'eco', tags: ['Ẩm thực'] }), place({ id: 'none', category: 'eco' })],
      { ...baseInput, interests: ['food'] },
    );
    expect(result.days[0]!.items.map((i) => i.destinationId)).toEqual(['tagged']);
  });

  it('respects the daily time limit including transition buffers', () => {
    const places = ['a', 'b', 'c', 'd'].map((id) => place({ id, estimatedVisitMinutes: 90 }));
    const result = planItinerary(places, { ...baseInput, numberOfDays: 2, hoursPerDay: 3.5 });
    for (const day of result.days) {
      expect(day.totalMinutes).toBeLessThanOrEqual(210);
      expect(day.bufferMinutes).toBe(Math.max(0, day.items.length - 1) * TRANSITION_BUFFER_MINUTES);
    }
    expect(result.days.map((d) => d.items.length)).toEqual([2, 2]);
    expect(result.unscheduled).toHaveLength(0);
  });

  it('reports places that do not fit instead of overfilling', () => {
    const result = planItinerary(
      [place({ id: 'long', estimatedVisitMinutes: 400 }), place({ id: 'a' }), place({ id: 'b' }), place({ id: 'c' })],
      { ...baseInput, hoursPerDay: 2 },
    );
    expect(result.unscheduled.map((u) => u.destinationId)).toContain('long');
    expect(result.days[0]!.totalMinutes).toBeLessThanOrEqual(120);
  });

  it('uses a flagged default duration when data is missing and warns about it', () => {
    const result = planItinerary([place({ id: 'x', estimatedVisitMinutes: null })], baseInput);
    const item = result.days[0]!.items[0]!;
    expect(item.durationMinutes).toBe(DEFAULT_VISIT_MINUTES);
    expect(item.durationIsDefault).toBe(true);
    expect(result.warnings.some((w) => w.includes(`${DEFAULT_VISIT_MINUTES} phút`))).toBe(true);
    expect(result.warnings.some((w) => w.includes('Thời gian di chuyển chưa được tính'))).toBe(true);
  });

  it('groups nearby places on the same day when coordinates exist', () => {
    const near1 = place({ id: 'near-1', coordinates: { lat: 10.3, lng: 105.76 } });
    const near2 = place({ id: 'near-2', coordinates: { lat: 10.31, lng: 105.75 } });
    const far1 = place({ id: 'far-1', coordinates: { lat: 10.36, lng: 106.38 } });
    const far2 = place({ id: 'far-2', coordinates: { lat: 10.35, lng: 106.37 } });
    const result = planItinerary([near1, far1, near2, far2], { ...baseInput, numberOfDays: 2, hoursPerDay: 2.5 });
    const days = result.days.map((d) => d.items.map((i) => i.destinationId).sort());
    expect(days).toContainEqual(['far-1', 'far-2']);
    expect(days).toContainEqual(['near-1', 'near-2']);
    expect(haversineKm(near1.coordinates!, far1.coordinates!)).toBeGreaterThan(50);
  });

  it('is deterministic and puts priority places first', () => {
    const places = ['c', 'a', 'b'].map((id) => place({ id }));
    const input = { ...baseInput, priorityDestinationIds: ['c'] };
    const first = planItinerary(places, input);
    expect(planItinerary(places, input)).toEqual(first);
    expect(first.days[0]!.items[0]!.destinationId).toBe('c');
  });

  it('warns when nothing matches', () => {
    const result = planItinerary([place({ id: 'a', category: 'food' })], { ...baseInput, interests: ['history'] });
    expect(result.days[0]!.items).toHaveLength(0);
    expect(result.warnings[0]).toContain('Không có địa điểm phù hợp');
  });

  it('indoor scenario prefers culture over nature', () => {
    const result = planItinerary(
      [place({ id: 'lake', category: 'nature' }), place({ id: 'museum', category: 'culture' })],
      { ...baseInput, hoursPerDay: 2, scenario: 'indoor' },
    );
    expect(result.days[0]!.items[0]!.destinationId).toBe('museum');
    expect(result.warnings.some((w) => w.includes('trong nhà'))).toBe(true);
  });

  it('skips excluded destinations', () => {
    const result = planItinerary(
      [place({ id: 'keep' }), place({ id: 'skip' })],
      { ...baseInput, excludeDestinationIds: ['skip'] },
    );
    expect(result.days.flatMap((d) => d.items.map((i) => i.destinationId))).toEqual(['keep']);
  });

  it('returns indoor and compact alternatives when they differ', () => {
    const places = [
      place({ id: 'pagoda', category: 'culture', coordinates: { lat: 10.3, lng: 105.76 } }),
      place({ id: 'wetland', category: 'nature', coordinates: { lat: 10.7, lng: 105.5 } }),
      place({ id: 'market', category: 'food', coordinates: { lat: 10.31, lng: 105.75 } }),
    ];
    const { plan, alternatives } = planItineraryWithAlternatives(places, {
      ...baseInput,
      hoursPerDay: 2,
      interests: ['nature'],
    });
    expect(plan.days[0]!.items.map((i) => i.destinationId)).toContain('wetland');
    expect(alternatives.some((a) => a.key === 'indoor')).toBe(true);
    expect(alternatives.find((a) => a.key === 'indoor')!.plan.days[0]!.items[0]!.category).not.toBe('nature');
  });
});
