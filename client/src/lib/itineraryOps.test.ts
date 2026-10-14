import { describe, expect, it } from 'vitest';
import type { PlannedItem } from '../types/api';
import {
  addDay,
  addItem,
  dayTotals,
  moveItem,
  moveItemToDay,
  removeDay,
  removeItem,
  tripTotal,
  type DraftDay,
} from './itineraryOps';

const item = (id: string, minutes = 60): PlannedItem => ({
  destinationId: id,
  slug: id,
  name: id,
  category: 'nature',
  area: 'cao-lanh',
  durationMinutes: minutes,
  durationIsEstimate: true,
});

const ids = (days: DraftDay[]) => days.map((d) => d.items.map((i) => i.destinationId));

describe('itinerary editing', () => {
  const base: DraftDay[] = [{ items: [item('a'), item('b'), item('c')] }, { items: [item('d')] }];

  it('reorders within a day and ignores out-of-range moves', () => {
    expect(ids(moveItem(base, 0, 0, 1))).toEqual([['b', 'a', 'c'], ['d']]);
    expect(moveItem(base, 0, 0, -1)).toBe(base);
    expect(ids(base)).toEqual([['a', 'b', 'c'], ['d']]);
  });

  it('moves a place to another day', () => {
    expect(ids(moveItemToDay(base, 0, 1, 1))).toEqual([['a', 'c'], ['d', 'b']]);
  });

  it('refuses moving onto a day that already has the place', () => {
    const days: DraftDay[] = [{ items: [item('a'), item('b')] }, { items: [item('a')] }];
    expect(moveItemToDay(days, 0, 0, 1)).toBe(days);
  });

  it('adds without duplicates and removes', () => {
    expect(addItem(base, 1, item('a'))).toBe(base);
    expect(ids(addItem(base, 1, item('e')))).toEqual([['a', 'b', 'c'], ['d', 'e']]);
    expect(ids(removeItem(base, 0, 2))).toEqual([['a', 'b'], ['d']]);
  });

  it('adds and removes days without losing places', () => {
    expect(addDay(base)).toHaveLength(3);
    expect(ids(removeDay(base, 1))).toEqual([['a', 'b', 'c', 'd']]);
    expect(ids(removeDay(base, 0))).toEqual([['d', 'a', 'b', 'c']]);
    expect(removeDay([{ items: [] }], 0)).toHaveLength(1);
  });

  it('computes totals with a 30 minute buffer between stops', () => {
    expect(dayTotals([item('a', 60), item('b', 90)])).toEqual({ visit: 150, buffer: 30, total: 180 });
    expect(dayTotals([])).toEqual({ visit: 0, buffer: 0, total: 0 });
    expect(tripTotal(base)).toBe(3 * 60 + 2 * 30 + 60);
  });
});
