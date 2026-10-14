import { AREA_LABELS, CATEGORY_LABELS, type Area, type Category, type Interest } from '../config/catalog.js';
import { haversineKm } from '../utils/geo.js';
import { normalizeText } from '../utils/text.js';

export { haversineKm } from '../utils/geo.js';

export type PlannerScenario = 'balanced' | 'indoor' | 'compact';

export const DEFAULT_VISIT_MINUTES = 90;
/** Fixed buffer between consecutive stops. It is NOT a computed travel time. */
export const TRANSITION_BUFFER_MINUTES = 30;
/** Stops farther than this (straight line) are not considered "nearby". */
const NEARBY_KM = 25;

export interface PlannerDestination {
  id: string;
  slug: string;
  name: string;
  category: Category;
  tags: string[];
  area: Area;
  coordinates: { lat: number; lng: number } | null;
  estimatedVisitMinutes: number | null;
}

export interface PlannerInput {
  numberOfDays: number;
  hoursPerDay: number;
  areas: Area[];
  interests: Interest[];
  priorityDestinationIds: string[];
  excludeDestinationIds?: string[];
  scenario?: PlannerScenario;
}

export interface PlanAlternative {
  key: PlannerScenario;
  label: string;
  description: string;
  plan: PlanResult;
}

export interface PlannedItem {
  destinationId: string;
  slug: string;
  name: string;
  category: Category;
  area: Area;
  durationMinutes: number;
  durationIsEstimate: boolean;
  durationIsDefault: boolean;
  reasons: string[];
}

export interface PlannedDay {
  dayNumber: number;
  items: PlannedItem[];
  visitMinutes: number;
  bufferMinutes: number;
  totalMinutes: number;
}

export interface PlanResult {
  days: PlannedDay[];
  warnings: string[];
  unscheduled: Array<{ destinationId: string; name: string; reason: string }>;
  assumptions: { defaultVisitMinutes: number; transitionBufferMinutes: number; dailyLimitMinutes: number };
}

interface Candidate {
  destination: PlannerDestination;
  score: number;
  isPriority: boolean;
  duration: number;
  durationIsDefault: boolean;
  reasons: string[];
}

function scoreCandidate(destination: PlannerDestination, input: PlannerInput): Candidate {
  const reasons: string[] = [];
  let score = 0;
  const isPriority = input.priorityDestinationIds.includes(destination.id);
  if (isPriority) reasons.push('Điểm đến bạn chọn ưu tiên');

  if (input.interests.length === 0) {
    score = 1;
  } else {
    if (input.interests.includes(destination.category)) {
      score += 3;
      reasons.push(`Loại hình ${CATEGORY_LABELS[destination.category]} phù hợp sở thích`);
    }
    const normalizedTags = destination.tags.map(normalizeText);
    for (const interest of input.interests) {
      if (interest === destination.category) continue;
      if (normalizedTags.includes(normalizeText(CATEGORY_LABELS[interest]))) {
        score += 1;
        reasons.push(`Có yếu tố ${CATEGORY_LABELS[interest].toLowerCase()}`);
      }
    }
  }
  if (input.areas.length > 0) reasons.push(`Thuộc khu vực ${AREA_LABELS[destination.area]}`);

  const hasDuration = destination.estimatedVisitMinutes !== null;
  if (hasDuration) score += 0.5;

  if (input.scenario === 'indoor') {
    if (destination.category === 'culture' || destination.category === 'history' || destination.category === 'food') {
      score += 2;
      reasons.push('Phù hợp khi thời tiết xấu hoặc hạn chế hoạt động ngoài trời');
    } else if (!isPriority && (destination.category === 'nature' || destination.category === 'eco')) {
      score -= 1.5;
    }
  }

  return {
    destination,
    score,
    isPriority,
    duration: destination.estimatedVisitMinutes ?? DEFAULT_VISIT_MINUTES,
    durationIsDefault: !hasDuration,
    reasons,
  };
}

function compareCandidates(a: Candidate, b: Candidate): number {
  if (a.isPriority !== b.isPriority) return a.isPriority ? -1 : 1;
  if (a.score !== b.score) return b.score - a.score;
  return a.destination.slug.localeCompare(b.destination.slug);
}

function pathLengthKm(items: Candidate[]): number {
  let total = 0;
  for (let i = 1; i < items.length; i += 1) {
    const a = items[i - 1]!.destination.coordinates;
    const b = items[i]!.destination.coordinates;
    if (!a || !b) return Number.POSITIVE_INFINITY;
    total += haversineKm(a, b);
  }
  return total;
}

/** 2-opt local search: reverse a subsequence when it shortens the day's path. */
function twoOptDay(items: Candidate[]): Candidate[] {
  if (items.length < 3 || items.some((c) => !c.destination.coordinates)) return items;
  let best = items;
  let bestLen = pathLengthKm(best);
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < best.length - 1; i += 1) {
      for (let k = i + 1; k < best.length; k += 1) {
        const next = [...best.slice(0, i), ...best.slice(i, k + 1).reverse(), ...best.slice(k + 1)];
        const len = pathLengthKm(next);
        if (len + 1e-6 < bestLen) {
          best = next;
          bestLen = len;
          improved = true;
        }
      }
    }
  }
  return best;
}

/**
 * Constraint-aware planner:
 *  1. keep destinations in the selected areas (and drop explicit exclusions);
 *  2. score by interest match (+3 category, +1 per matching tag, +0.5 if a visit duration exists);
 *     indoor scenario boosts culture/history/food;
 *  3. drop non-matching places when interests are given (priority picks are always kept);
 *  4. fill each day greedily under the daily time budget, preferring nearby high-score neighbours
 *     (compact scenario weights distance more) and penalising same-category stacking;
 *  5. 2-opt the day's order when every stop has coordinates.
 */
export function planItinerary(destinations: PlannerDestination[], input: PlannerInput): PlanResult {
  const warnings: string[] = [];
  const dailyLimit = Math.round(input.hoursPerDay * 60);
  const excluded = new Set(input.excludeDestinationIds ?? []);
  const distanceWeight = input.scenario === 'compact' ? 3 : 1;

  const inArea = destinations.filter(
    (d) => !excluded.has(d.id) && (input.areas.length === 0 || input.areas.includes(d.area)),
  );
  const scored = inArea.map((d) => scoreCandidate(d, input));
  const matching = scored.filter((c) => c.isPriority || input.interests.length === 0 || c.score >= 1).sort(compareCandidates);

  const unscheduled: PlanResult['unscheduled'] = [];
  const remaining: Candidate[] = [];
  for (const candidate of matching) {
    if (candidate.duration > dailyLimit) {
      unscheduled.push({
        destinationId: candidate.destination.id,
        name: candidate.destination.name,
        reason: 'Thời lượng tham quan dài hơn giới hạn mỗi ngày',
      });
    } else {
      remaining.push(candidate);
    }
  }

  const days: PlannedDay[] = [];
  for (let dayNumber = 1; dayNumber <= input.numberOfDays; dayNumber += 1) {
    const items: Candidate[] = [];
    let used = 0;
    while (remaining.length > 0) {
      const last = items.at(-1);
      const budget = dailyLimit - used - (last ? TRANSITION_BUFFER_MINUTES : 0);
      const fitting = remaining.filter((c) => c.duration <= budget);
      if (fitting.length === 0) break;

      let next = fitting[0]!;
      let nearbyKm: number | null = null;
      const lastCoords = last?.destination.coordinates;
      if (lastCoords && !next.isPriority) {
        let bestCost = Number.POSITIVE_INFINITY;
        for (const candidate of fitting) {
          if (candidate.isPriority) {
            next = candidate;
            nearbyKm = null;
            break;
          }
          const coords = candidate.destination.coordinates;
          const distance = coords ? haversineKm(lastCoords, coords) : null;
          const sameCategory = items.filter((c) => c.destination.category === candidate.destination.category).length;
          // Lower is better: distance, interest score, and category diversity.
          const cost = (distance ?? NEARBY_KM * 2) * distanceWeight - candidate.score * 10 + sameCategory * 12;
          if (cost < bestCost) {
            bestCost = cost;
            next = candidate;
            nearbyKm = distance;
          }
        }
      }

      const reasons = [...next.reasons];
      if (nearbyKm !== null && nearbyKm <= NEARBY_KM) {
        reasons.push(`Gần điểm trước (~${nearbyKm.toFixed(1).replace('.', ',')} km đường chim bay)`);
      }
      used += (last ? TRANSITION_BUFFER_MINUTES : 0) + next.duration;
      items.push({ ...next, reasons });
      remaining.splice(remaining.indexOf(next), 1);
    }

    const optimized = twoOptDay(items);
    if (optimized !== items && optimized[0]) {
      optimized[0] = {
        ...optimized[0],
        reasons: [...optimized[0].reasons, 'Thứ tự trong ngày được tinh chỉnh theo khoảng cách (2-opt)'],
      };
    }

    const visitMinutes = optimized.reduce((sum, c) => sum + c.duration, 0);
    const bufferMinutes = Math.max(0, optimized.length - 1) * TRANSITION_BUFFER_MINUTES;
    days.push({
      dayNumber,
      items: optimized.map((c) => ({
        destinationId: c.destination.id,
        slug: c.destination.slug,
        name: c.destination.name,
        category: c.destination.category,
        area: c.destination.area,
        durationMinutes: c.duration,
        durationIsEstimate: true,
        durationIsDefault: c.durationIsDefault,
        reasons: c.reasons,
      })),
      visitMinutes,
      bufferMinutes,
      totalMinutes: visitMinutes + bufferMinutes,
    });
  }

  for (const candidate of remaining) {
    unscheduled.push({
      destinationId: candidate.destination.id,
      name: candidate.destination.name,
      reason: 'Không đủ thời gian trong số ngày đã chọn',
    });
  }

  const scheduled = days.flatMap((d) => d.items);
  if (inArea.length === 0) {
    warnings.push('Chưa có địa điểm đã xuất bản nào trong khu vực bạn chọn.');
  } else if (matching.length === 0) {
    warnings.push('Không có địa điểm phù hợp với sở thích đã chọn trong khu vực này. Hãy thử thêm sở thích hoặc khu vực.');
  } else if (scheduled.length < input.numberOfDays) {
    warnings.push('Số địa điểm phù hợp ít hơn số ngày, một số ngày có thể trống.');
  }
  const emptyDays = days.filter((d) => d.items.length === 0).map((d) => d.dayNumber);
  if (emptyDays.length > 0 && scheduled.length > 0) {
    warnings.push(`Ngày ${emptyDays.join(', ')} chưa có địa điểm phù hợp. Bạn có thể thêm thủ công.`);
  }
  if (scheduled.some((item) => item.durationIsDefault)) {
    warnings.push(
      `Một số địa điểm chưa có dữ liệu thời lượng tham quan, hệ thống tạm dùng ${DEFAULT_VISIT_MINUTES} phút.`,
    );
  }
  if (scheduled.some((item) => !destinations.find((d) => d.id === item.destinationId)?.coordinates)) {
    warnings.push('Một số địa điểm chưa có tọa độ nên không thể gom theo vị trí.');
  }
  warnings.push(
    `Thời gian di chuyển chưa được tính theo tuyến đường thực tế; mỗi lần chuyển điểm được cộng ${TRANSITION_BUFFER_MINUTES} phút dự phòng.`,
  );
  if (input.scenario === 'indoor') {
    warnings.push('Phương án trong nhà ưu tiên văn hóa, lịch sử và ẩm thực khi thời tiết xấu hoặc điểm ngoài trời tạm đóng.');
  }
  if (input.scenario === 'compact') {
    warnings.push('Phương án gom cụm ưu tiên các điểm gần nhau hơn, có thể bỏ qua một số điểm xa dù phù hợp sở thích.');
  }

  return {
    days,
    warnings,
    unscheduled,
    assumptions: {
      defaultVisitMinutes: DEFAULT_VISIT_MINUTES,
      transitionBufferMinutes: TRANSITION_BUFFER_MINUTES,
      dailyLimitMinutes: dailyLimit,
    },
  };
}

const ALTERNATIVE_META: Record<PlannerScenario, { label: string; description: string }> = {
  balanced: {
    label: 'Phương án cân bằng',
    description: 'Kết hợp sở thích, khu vực và thời gian trong ngày.',
  },
  indoor: {
    label: 'Phương án dự phòng (trong nhà)',
    description: 'Ưu tiên văn hóa, lịch sử, ẩm thực khi mưa hoặc điểm ngoài trời tạm đóng.',
  },
  compact: {
    label: 'Phương án gom cụm',
    description: 'Ưu tiên các điểm gần nhau để giảm di chuyển.',
  },
};

function scheduledIds(plan: PlanResult): string[] {
  return plan.days.flatMap((day) => day.items.map((item) => item.destinationId));
}

function plansDiffer(a: PlanResult, b: PlanResult): boolean {
  const aIds = scheduledIds(a).join('|');
  const bIds = scheduledIds(b).join('|');
  return aIds !== bIds;
}

/** Primary plan plus indoor and compact alternatives. Duplicates of the primary are omitted. */
export function planItineraryWithAlternatives(
  destinations: PlannerDestination[],
  input: PlannerInput,
): { plan: PlanResult; alternatives: PlanAlternative[] } {
  const primaryScenario: PlannerScenario = input.scenario ?? 'balanced';
  const plan = planItinerary(destinations, { ...input, scenario: primaryScenario });
  const alternatives: PlanAlternative[] = [];

  for (const key of ['indoor', 'compact'] as const) {
    if (key === primaryScenario) continue;
    const alt = planItinerary(destinations, { ...input, scenario: key });
    if (!plansDiffer(plan, alt)) continue;
    alternatives.push({
      key,
      label: ALTERNATIVE_META[key].label,
      description: ALTERNATIVE_META[key].description,
      plan: alt,
    });
  }

  return { plan, alternatives };
}
