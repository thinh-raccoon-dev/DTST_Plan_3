import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { env } from '../config/env.js';
import type { V9PlanRequestInput } from '../schemas/itinerary.schemas.js';
import { AppError, badRequest } from '../utils/errors.js';

export interface V9PlaceActivity {
  name: string;
  source_id: string;
  evidence_status: string;
  price_vnd: number | null;
  duration_minutes: number | null;
  schedule: string | null;
  requires_booking: boolean | null;
  note: string | null;
}

export interface V9Place {
  id: string;
  name: string;
  role: 'restaurant' | 'accommodation' | 'entertainment' | 'wellness' | 'attraction';
  tags: string[];
  activities_available: V9PlaceActivity[];
  address?: string | null;
  coordinates?: [number, number] | null;
  visit_duration_minutes?: number | null;
  phone: string | null;
  google_rating: number | null;
  google_review_count: number | null;
  rating_adjusted_for_review_count?: number | null;
  rating_status?: string;
  rating_source_date?: string | null;
}

export interface V9StopIssue {
  stop_id?: string;
  reason: string;
}

export interface V9ActivityStep {
  type: 'visit' | 'meal' | 'meal_unassigned' | 'meal_unscheduled' | 'travel' | 'free_time' | 'checkout' | 'unresolved_return';
  stop_id?: string;
  status?: 'pending' | 'arrived' | 'completed';
  place_id?: string;
  meal?: 'breakfast' | 'lunch' | 'dinner';
  name: string;
  start: string;
  end: string;
  duration_minutes?: number;
  duration_status?: string;
  source_duration_minutes?: number;
  hours_status?: string;
  hours_need_confirmation?: boolean;
  price_status?: 'unknown' | 'estimate';
  estimated_group_cost_vnd?: number | null;
  spending_target_group_vnd?: number | null;
  distance_km?: number;
  route_duration_minutes?: number;
  buffer_minutes?: number;
  from_id?: string;
  to_id?: string;
  phone?: string | null;
  google_rating?: number | null;
  google_review_count?: number | null;
  activities_available?: V9PlaceActivity[];
  activities_note?: string;
  note?: string;
  // Replan fields
  arrived_at?: string;
  departed_at?: string;
  estimated_departure_at?: string;
  estimated_arrival_at?: string;
  planned_start_at?: string;
  planned_end_at?: string;
  latitude?: number;
  longitude?: number;
  [key: string]: unknown;
}

export interface V9Day {
  day: number;
  date: string;
  status: string;
  start_place_id: string;
  planned_end_place_id: string;
  actual_end_place_id: string;
  activities: V9ActivityStep[];
  visit_count: number;
  overnight_stay: Record<string, unknown> | null;
  replan_state?: {
    status: string;
    next_stop: V9ActivityStep | null;
    issues: V9StopIssue[];
    estimated_day_end_at: string | null;
    later_days_need_review: boolean;
    updated_at: string;
  };
  [key: string]: unknown;
}

export interface V9ItineraryObject {
  status: string;
  algorithm: string;
  input: Record<string, unknown>;
  days: V9Day[];
  shared_accommodation: Record<string, unknown> | null;
  scheduled_primary_ids: string[];
  unassigned_primary_places: Array<{ id: string; name: string; reason: string }>;
  budget_allocation: Record<string, unknown>;
  cost_summary: Record<string, unknown>;
  routing_failures: Array<{ from_id: string; to_id: string; reason: string }>;
  warnings: string[];
  budget_adjusted?: boolean;
  known_savings_vnd?: number;
  [key: string]: unknown;
}

export interface V9ReplanResponse {
  trip_id: string;
  itinerary_version: number;
  event_id: string;
  date: string;
  status: 'replanned' | 'needs_revision';
  current_stop: V9ActivityStep;
  remaining_stops: V9ActivityStep[];
  next_stop: V9ActivityStep | null;
  issues: V9StopIssue[];
  estimated_day_end_at: string | null;
  later_days_need_review: boolean;
}

function resolvePlacesCatalogPath(): string | null {
  const candidates = [
    path.resolve(process.cwd(), 'documents/trip_planner_17_v9/places_catalog.json'),
    path.resolve(process.cwd(), '../documents/trip_planner_17_v9/places_catalog.json'),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function readBundledPlaces(): V9Place[] {
  const catalogPath = resolvePlacesCatalogPath();
  if (!catalogPath) return [];
  try {
    const parsed = JSON.parse(readFileSync(catalogPath, 'utf-8')) as { places?: V9Place[] };
    return Array.isArray(parsed.places) ? parsed.places : [];
  } catch {
    return [];
  }
}

async function callPythonJson<T>(endpoint: string, options: { method?: 'GET' | 'POST'; body?: unknown; timeoutMs?: number } = {}): Promise<T> {
  const url = `${env.tripPlannerApiUrl}${endpoint}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 45_000);

  try {
    const res = await fetch(url, {
      method: options.method ?? 'GET',
      headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    const text = await res.text();
    let parsed: Record<string, unknown> = {};
    try {
      parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      parsed = { error: text || 'Phản hồi từ dịch vụ Python không hợp lệ.' };
    }

    if (!res.ok) {
      const message = typeof parsed.error === 'string' ? parsed.error : `Lỗi từ dịch vụ lập lịch Python (HTTP ${res.status}).`;
      if (res.status === 400) {
        throw badRequest(message, 'TRIP_PLANNER_BAD_REQUEST');
      }
      throw new AppError(res.status === 413 ? 413 : 503, 'TRIP_PLANNER_SERVICE_ERROR', message);
    }

    return parsed as T;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      503,
      'TRIP_PLANNER_UNAVAILABLE',
      `Không kết nối được tới dịch vụ AI Trip Planner V9 tại ${env.tripPlannerApiUrl}. Hãy kiểm tra Python web_api.py (cổng 8010) và Valhalla (cổng 8002) đã bật chưa.`,
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function getPlannerHealth(): Promise<{ status: string; routing_status?: string; online: boolean }> {
  try {
    const data = await callPythonJson<{ status: string; routing_status?: string }>('/health', { timeoutMs: 4_000 });
    return { ...data, online: data.status === 'ok' };
  } catch {
    return { status: 'offline', online: false };
  }
}

export async function getPlannerPlaces(): Promise<{ places: V9Place[]; serviceOnline: boolean }> {
  try {
    const data = await callPythonJson<{ places: V9Place[] }>('/places', { timeoutMs: 6_000 });
    return { places: data.places ?? [], serviceOnline: true };
  } catch {
    const fallback = readBundledPlaces();
    return { places: fallback, serviceOnline: false };
  }
}

export async function requestPlannerRecommend(input: V9PlanRequestInput): Promise<Record<string, unknown>> {
  return callPythonJson<Record<string, unknown>>('/recommend', {
    method: 'POST',
    body: input,
  });
}

export async function requestPlannerItinerary(input: V9PlanRequestInput): Promise<Record<string, unknown>> {
  return callPythonJson<Record<string, unknown>>('/itinerary', {
    method: 'POST',
    body: { ...input, assemble_itinerary: true },
  });
}

export async function requestPlannerReplan(payload: {
  trip_id: string;
  itinerary_version: number;
  event_id: string;
  stop_id: string;
  event: 'arrived' | 'departed';
  occurred_at: string;
  itinerary: V9ItineraryObject;
}): Promise<V9ReplanResponse> {
  return callPythonJson<V9ReplanResponse>('/itineraries/replan', {
    method: 'POST',
    body: payload,
  });
}

/**
 * Merges a Python `/itineraries/replan` response into the stored `v9Itinerary` object:
 * - Updates `current_stop` by `stop_id` (preserving `arrived_at` on departure and removing `estimated_departure_at`).
 * - Updates each stop in `remaining_stops` by `stop_id` with new ISO timestamps and GPS coordinates.
 * - Keeps unresolved/conflicting stops intact in `day.activities` so nothing is lost.
 */
export function mergeReplanIntoItinerary(
  original: V9ItineraryObject,
  replanResult: V9ReplanResponse,
): V9ItineraryObject {
  const next: V9ItineraryObject = structuredClone(original);
  const remainingByStopId = new Map<string, V9ActivityStep>();
  for (const stop of replanResult.remaining_stops ?? []) {
    if (stop.stop_id) {
      remainingByStopId.set(stop.stop_id, stop);
    }
  }

  const currentStopId = replanResult.current_stop?.stop_id;

  next.days = (next.days ?? []).map((day) => {
    if (day.date !== replanResult.date) return day;

    const activities = (day.activities ?? []).map((step) => {
      if (!step.stop_id) return step;
      if (currentStopId && step.stop_id === currentStopId) {
        return { ...replanResult.current_stop };
      }
      const updatedRemaining = remainingByStopId.get(step.stop_id);
      if (updatedRemaining) {
        return { ...step, ...updatedRemaining };
      }
      return step;
    });

    return {
      ...day,
      status: replanResult.status === 'needs_revision' ? 'needs_revision' : day.status,
      activities,
      replan_state: {
        status: replanResult.status,
        next_stop: replanResult.next_stop ?? null,
        issues: replanResult.issues ?? [],
        estimated_day_end_at: replanResult.estimated_day_end_at ?? null,
        later_days_need_review: Boolean(replanResult.later_days_need_review),
        updated_at: new Date().toISOString(),
      },
    };
  });

  if (replanResult.status === 'needs_revision') {
    next.status = 'needs_revision';
  }

  return next;
}
