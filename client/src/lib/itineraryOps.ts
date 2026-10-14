import type { PlannedItem } from '../types/api';
import { TRANSITION_BUFFER_MINUTES } from './catalog';

export interface DraftDay {
  items: PlannedItem[];
}

export const MAX_DAYS = 7;

export function dayTotals(items: PlannedItem[]) {
  const visit = items.reduce((sum, item) => sum + item.durationMinutes, 0);
  const buffer = Math.max(0, items.length - 1) * TRANSITION_BUFFER_MINUTES;
  return { visit, buffer, total: visit + buffer };
}

export function tripTotal(days: DraftDay[]): number {
  return days.reduce((sum, day) => sum + dayTotals(day.items).total, 0);
}

export function containsDestination(days: DraftDay[], destinationId: string): boolean {
  return days.some((day) => day.items.some((item) => item.destinationId === destinationId));
}

function cloneDays(days: DraftDay[]): DraftDay[] {
  return days.map((day) => ({ items: [...day.items] }));
}

export function addItem(days: DraftDay[], dayIndex: number, item: PlannedItem): DraftDay[] {
  if (containsDestination(days, item.destinationId) || !days[dayIndex]) return days;
  const next = cloneDays(days);
  next[dayIndex]!.items.push(item);
  return next;
}

export function removeItem(days: DraftDay[], dayIndex: number, itemIndex: number): DraftDay[] {
  const next = cloneDays(days);
  next[dayIndex]?.items.splice(itemIndex, 1);
  return next;
}

export function moveItem(days: DraftDay[], dayIndex: number, itemIndex: number, direction: -1 | 1): DraftDay[] {
  const items = days[dayIndex]?.items;
  const target = itemIndex + direction;
  if (!items || target < 0 || target >= items.length) return days;
  const next = cloneDays(days);
  const list = next[dayIndex]!.items;
  [list[itemIndex], list[target]] = [list[target]!, list[itemIndex]!];
  return next;
}

export function moveItemToDay(days: DraftDay[], fromDay: number, itemIndex: number, toDay: number): DraftDay[] {
  const item = days[fromDay]?.items[itemIndex];
  if (!item || fromDay === toDay || !days[toDay]) return days;
  // Target day must not already contain this place (would fail server save with DUPLICATE_DESTINATION).
  if (days[toDay]!.items.some((existing) => existing.destinationId === item.destinationId)) return days;
  const next = cloneDays(days);
  next[fromDay]!.items.splice(itemIndex, 1);
  next[toDay]!.items.push(item);
  return next;
}

export function addDay(days: DraftDay[]): DraftDay[] {
  return days.length >= MAX_DAYS ? days : [...cloneDays(days), { items: [] }];
}

/** Removes a day; its places move to the previous day (or the next one when removing day 1). */
export function removeDay(days: DraftDay[], dayIndex: number): DraftDay[] {
  if (days.length <= 1 || !days[dayIndex]) return days;
  const next = cloneDays(days);
  const [removed] = next.splice(dayIndex, 1);
  const receiver = next[Math.max(0, dayIndex - 1)]!;
  for (const item of removed?.items ?? []) {
    if (!receiver.items.some((existing) => existing.destinationId === item.destinationId)) {
      receiver.items.push(item);
    }
  }
  return next;
}
