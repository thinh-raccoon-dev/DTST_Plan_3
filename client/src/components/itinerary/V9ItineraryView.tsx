import clsx from 'clsx';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BedDouble,
  CalendarDays,
  Car,
  CheckCircle2,
  ChevronDown,
  Clock,
  CloudRain,
  Compass,
  ExternalLink,
  FastForward,
  Flag,
  Hourglass,
  Info,
  Landmark,
  LogOut,
  MapPinned,
  Moon,
  Navigation,
  Phone,
  PlayCircle,
  RefreshCw,
  Route,
  Sparkles,
  Star,
  Sun,
  Sunrise,
  Trash2,
  Users,
  UtensilsCrossed,
  Wallet,
  Zap,
} from 'lucide-react';
import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import type {
  V9ActivityStep,
  V9Day,
  V9ItineraryObject,
  V9Place,
  V9StopIssue,
} from '../../types/api';
import { Button } from '../ui/Button';
import { Notice } from '../ui/States';
import {
  formatDateVi,
  formatIsoClock,
  formatV9RankingReason,
  formatVnd,
  formatVndShort,
  roleMeta,
} from './v9Meta';

// Re-exported for backwards compatibility with existing imports.
export { formatV9RankingReason } from './v9Meta';

const ISSUE_REASON_LABELS: Record<string, string> = {
  current_stop_has_no_feasible_window: 'Điểm dừng hiện tại không còn nằm trong khung giờ mở cửa hợp lệ.',
  route_unavailable: 'Không tính được tuyến đường di chuyển tới điểm này.',
  time_window_or_return_conflict: 'Không kịp khung giờ mở cửa/ăn uống hoặc không kịp giờ quay về cuối ngày.',
  return_after_daily_end: 'Giờ về cuối ngày vượt quá khung giờ kết thúc trong ngày.',
  return_route_unavailable: 'Không tính được tuyến đường quay về điểm kết thúc ngày.',
};

const MEAL_META: Record<string, { label: string; Icon: typeof Sun }> = {
  breakfast: { label: 'Bữa sáng', Icon: Sunrise },
  lunch: { label: 'Bữa trưa', Icon: Sun },
  dinner: { label: 'Bữa tối', Icon: Moon },
};

function toMinutes(hhmm: string | undefined): number | null {
  if (!hhmm) return null;
  const m = hhmm.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function spanMinutes(start?: string, end?: string): number | null {
  const a = toMinutes(start);
  const b = toMinutes(end);
  return a !== null && b !== null && b >= a ? b - a : null;
}

function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return '';
  if (minutes < 60) return `${minutes} phút`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} giờ ${m} phút` : `${h} giờ`;
}

function buildMapsUrl(lat?: number, lon?: number, name?: string, origin?: { lat: number; lng: number } | null): string {
  if (typeof lat === 'number' && typeof lon === 'number') {
    const dest = `${lat},${lon}`;
    const originParam = origin ? `&origin=${origin.lat},${origin.lng}` : '';
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}${originParam}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name || 'Đồng Tháp')}`;
}

function defaultEventTimeForStep(step: V9ActivityStep, event: 'arrived' | 'departed'): string {
  if (event === 'arrived') {
    return formatIsoClock(step.planned_start_at) || step.start || '08:00';
  }
  return (
    formatIsoClock(step.estimated_departure_at) ||
    formatIsoClock(step.planned_end_at) ||
    step.end ||
    formatIsoClock(step.arrived_at) ||
    '10:00'
  );
}

function splitStepName(step: V9ActivityStep): { eyebrow: string | null; title: string } {
  if ((step.type === 'meal' || step.type === 'meal_unassigned' || step.type === 'meal_unscheduled') && step.name.includes(' — ')) {
    const [label, ...rest] = step.name.split(' — ');
    return { eyebrow: label ?? null, title: rest.join(' — ') };
  }
  return { eyebrow: null, title: step.name };
}

function Stars({ rating }: { rating: number }) {
  const full = Math.round(rating);
  return (
    <span className="inline-flex items-center" aria-label={`${rating} trên 5 sao`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={clsx('size-3.5', i < full ? 'fill-amber-400 text-amber-400' : 'fill-sand-200 text-sand-200')}
          aria-hidden
        />
      ))}
    </span>
  );
}

function StatTile({
  icon,
  label,
  value,
  hint,
  children,
  style,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  children?: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      className="tp-fade-up rounded-2xl bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur-sm transition-colors hover:bg-white/15"
      style={style}
    >
      <p className="flex items-center gap-2 text-xs font-medium text-leaf-100">
        <span className="grid size-7 place-items-center rounded-lg bg-white/15 text-white">{icon}</span>
        {label}
      </p>
      <p className="mt-2 text-xl font-extrabold tracking-tight text-white sm:text-2xl">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-leaf-100/90">{hint}</p>}
      {children}
    </div>
  );
}

function ActivityChips({ items }: { items?: V9Place['activities_available'] }) {
  const [expanded, setExpanded] = useState(false);
  if (!items || items.length === 0) return null;
  const names = items.map((a) => a.name).filter(Boolean);
  if (names.length === 0) return null;
  const visible = expanded ? names : names.slice(0, 4);
  return (
    <div className="mt-3">
      <p className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-river-500">
        <Sparkles className="size-3" aria-hidden /> Trải nghiệm có thể chọn
      </p>
      <div className="flex flex-wrap gap-1.5">
        {visible.map((name, i) => (
          <span
            key={`${name}-${i}`}
            className="rounded-full bg-leaf-50 px-2.5 py-1 text-xs font-medium text-leaf-800 ring-1 ring-inset ring-leaf-100"
          >
            {name}
          </span>
        ))}
        {names.length > 4 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="rounded-full px-2.5 py-1 text-xs font-semibold text-leaf-700 hover:bg-leaf-50"
          >
            {expanded ? 'Thu gọn' : `+${names.length - 4} khác`}
          </button>
        )}
      </div>
    </div>
  );
}

export interface V9ItineraryViewProps {
  itinerary: V9ItineraryObject;
  primaryPlaces?: V9Place[];
  budgetAlternative?: V9ItineraryObject | null;
  onApplyBudgetAlternative?: (alt: V9ItineraryObject) => void;
  itineraryVersion?: number;
  placesById?: Map<string, V9Place>;
  onReplan?: (params: {
    stopId: string;
    event: 'arrived' | 'departed';
    occurredAt: string;
  }) => Promise<void>;
  replanningStopId?: string | null;
  onUpdateItinerary?: (updatedItinerary: V9ItineraryObject) => void | Promise<void>;
  onRequestSwapStop?: (dayNumber: number, step: V9ActivityStep) => void;
  editable?: boolean;
}

export function V9ItineraryView({
  itinerary,
  primaryPlaces = [],
  budgetAlternative,
  onApplyBudgetAlternative,
  itineraryVersion,
  placesById,
  onReplan,
  replanningStopId,
  onUpdateItinerary,
  onRequestSwapStop,
  editable = true,
}: V9ItineraryViewProps) {
  const [customTimeByStop, setCustomTimeByStop] = useState<Record<string, string>>({});
  const [userGps, setUserGps] = useState<{ lat: number; lng: number } | null>(null);
  const [locatingGps, setLocatingGps] = useState(false);
  const [situationModalStop, setSituationModalStop] = useState<{
    dayNumber: number;
    step: V9ActivityStep;
  } | null>(null);

  // Default tab: the day that still has an incomplete stop when tracking live, otherwise day 1.
  const initialDayIndex = useMemo(() => {
    if (!onReplan) return 0;
    const idx = itinerary.days.findIndex((d) => d.activities.some((s) => s.stop_id && s.status !== 'completed'));
    return idx >= 0 ? idx : 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [activeDay, setActiveDay] = useState<number>(initialDayIndex); // -1 = show all days

  const requestGps = () => {
    if (!('geolocation' in navigator)) return;
    setLocatingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserGps({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocatingGps(false);
      },
      () => setLocatingGps(false),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const activeDayWithNextStop = itinerary.days.find((d) => d.replan_state?.next_stop);
  const highlightedNextStop = activeDayWithNextStop?.replan_state?.next_stop;

  const cost = itinerary.cost_summary as
    | {
        known_subtotal_vnd: number;
        road_distance_km: number;
        unknown_cost_count: number;
        budget_overage_vnd: number;
      }
    | undefined;

  const budget = typeof itinerary.input?.budget_vnd === 'number' ? itinerary.input.budget_vnd : 0;
  const knownCost = cost?.known_subtotal_vnd ?? 0;
  const budgetRatio = budget > 0 ? knownCost / budget : 0;

  const totalStops = itinerary.days.reduce(
    (n, d) => n + d.activities.filter((s) => Boolean(s.stop_id)).length,
    0,
  );
  const completedStops = itinerary.days.reduce(
    (n, d) => n + d.activities.filter((s) => Boolean(s.stop_id) && s.status === 'completed').length,
    0,
  );

  const daysToRender = activeDay === -1 ? itinerary.days : itinerary.days.filter((_, i) => i === activeDay);
  const alloc = itinerary.budget_allocation?.whole_group_vnd;

  // Manual itinerary modification handlers (Backlog 8)
  const handleMoveStop = async (dayNumber: number, stopId: string, direction: 'up' | 'down') => {
    if (!onUpdateItinerary) return;
    const next: V9ItineraryObject = JSON.parse(JSON.stringify(itinerary));
    const targetDay = next.days.find((d) => d.day === dayNumber);
    if (!targetDay) return;

    // Find all actionable stop steps (visit, meal) in this day
    const stopSteps = targetDay.activities.filter((s) => Boolean(s.stop_id));
    const currentIndex = stopSteps.findIndex((s) => s.stop_id === stopId);
    if (currentIndex === -1) return;

    const swapTargetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (swapTargetIndex < 0 || swapTargetIndex >= stopSteps.length) return;

    const currentStep = stopSteps[currentIndex];
    const targetStep = stopSteps[swapTargetIndex];
    if (!currentStep?.stop_id || !targetStep?.stop_id) return;

    // Swap positions in the full targetDay.activities array
    const posA = targetDay.activities.findIndex((s) => s.stop_id === currentStep.stop_id);
    const posB = targetDay.activities.findIndex((s) => s.stop_id === targetStep.stop_id);
    const actA = targetDay.activities[posA];
    const actB = targetDay.activities[posB];
    if (!actA || !actB) return;

    // Preserve time slots: Step moving into earlier slot gets earlier start/end
    const tempStart = actA.start;
    const tempEnd = actA.end;
    actA.start = actB.start;
    actA.end = actB.end;
    actB.start = tempStart;
    actB.end = tempEnd;

    // Swap items
    targetDay.activities[posA] = actB;
    targetDay.activities[posB] = actA;

    await onUpdateItinerary(next);
  };

  const handleRemoveStop = async (dayNumber: number, stopId: string) => {
    if (!onUpdateItinerary) return;
    const next: V9ItineraryObject = JSON.parse(JSON.stringify(itinerary));
    const targetDay = next.days.find((d) => d.day === dayNumber);
    if (!targetDay) return;

    const stepToRemove = targetDay.activities.find((s) => s.stop_id === stopId);
    if (!stepToRemove) return;

    // Filter out step
    targetDay.activities = targetDay.activities.filter((s) => s.stop_id !== stopId);
    if (stepToRemove.type === 'visit') {
      targetDay.visit_count = Math.max(0, targetDay.visit_count - 1);
    }

    if (stepToRemove.place_id) {
      next.scheduled_primary_ids = (next.scheduled_primary_ids ?? []).filter((id) => id !== stepToRemove.place_id);
      if (!next.unassigned_primary_places) next.unassigned_primary_places = [];
      next.unassigned_primary_places.push({
        id: stepToRemove.place_id,
        name: stepToRemove.name,
        reason: 'Người dùng đã chủ động bỏ bớt điểm này khỏi lịch trình.',
      });
    }

    await onUpdateItinerary(next);
  };

  // Quick 1-click Situational Replan (Backlog 9)
  const handleQuickSituation = async (
    day: V9Day,
    step: V9ActivityStep,
    situation: 'checkin_now' | 'leave_now' | 'traffic_30m' | 'rain_delay_45m' | 'skip_stop',
  ) => {
    if (!step.stop_id) return;
    const now = new Date();

    if (situation === 'checkin_now' && onReplan) {
      await onReplan({
        stopId: step.stop_id,
        event: 'arrived',
        occurredAt: now.toISOString(),
      });
      return;
    }

    if (situation === 'leave_now' && onReplan) {
      await onReplan({
        stopId: step.stop_id,
        event: 'departed',
        occurredAt: now.toISOString(),
      });
      return;
    }

    if (situation === 'skip_stop') {
      if (onReplan && step.status === 'arrived') {
        // If arrived, depart immediately to advance to next
        await onReplan({
          stopId: step.stop_id,
          event: 'departed',
          occurredAt: now.toISOString(),
        });
      } else if (onUpdateItinerary) {
        // Remove stop from day and shift forward
        await handleRemoveStop(day.day, step.stop_id);
      }
      return;
    }

    if (situation === 'traffic_30m' || situation === 'rain_delay_45m') {
      const delayMinutes = situation === 'traffic_30m' ? 30 : 45;
      const delayedDate = new Date(now.getTime() + delayMinutes * 60 * 1000);
      const hours = String(delayedDate.getHours()).padStart(2, '0');
      const mins = String(delayedDate.getMinutes()).padStart(2, '0');
      const delayedHhmm = `${hours}:${mins}`;

      // Update custom time for stop
      setCustomTimeByStop((prev) => ({ ...prev, [step.stop_id!]: delayedHhmm }));

      // If user is currently triggering live replan
      if (onReplan) {
        const eventType = step.status === 'arrived' ? 'departed' : 'arrived';
        await onReplan({
          stopId: step.stop_id,
          event: eventType,
          occurredAt: `${day.date}T${delayedHhmm}:00+07:00`,
        });
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Header banner ────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-panel bg-gradient-to-br from-leaf-700 via-leaf-800 to-river-900 p-6 text-white shadow-raised sm:p-8">
        <div className="relative z-10 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
                <Sparkles className="size-3.5 text-teal-200" aria-hidden />
                Trip Planner V9 · Valhalla Routing
              </span>
              {typeof itineraryVersion === 'number' && (
                <span className="rounded-full bg-teal-400/20 px-2.5 py-0.5 text-xs font-bold text-teal-200 ring-1 ring-inset ring-teal-300/40">
                  Phiên bản v{itineraryVersion}
                </span>
              )}
              {itinerary.budget_adjusted && (
                <span className="rounded-full bg-lotus-400/30 px-2.5 py-0.5 text-xs font-semibold text-lotus-100 ring-1 ring-inset ring-lotus-300/40">
                  Đã tối ưu ngân sách
                </span>
              )}
            </div>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">
              Hành trình trải nghiệm Đồng Tháp
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-leaf-100">
              {[
                `Bắt đầu: ${String(itinerary.input?.daily_start ?? '08:00')}`,
                `Kết thúc ngày: ${String(itinerary.input?.daily_end ?? '20:00')}`,
                `Phương tiện: ${itinerary.input?.mode_of_transport === 'motorcycle' ? 'Xe máy' : 'Ô tô'}`,
                `Mục tiêu: ${
                  itinerary.input?.goal === 'sightseeing'
                    ? 'Tham quan'
                    : itinerary.input?.goal === 'food'
                      ? 'Ẩm thực'
                      : itinerary.input?.goal === 'relaxation'
                        ? 'Thư giãn nghỉ dưỡng'
                        : itinerary.input?.goal === 'nightlife'
                          ? 'Về đêm'
                          : 'Trải nghiệm'
                }`,
              ].map((label) => (
                <span key={label} className="rounded-full bg-white/10 px-2.5 py-1 font-medium text-white ring-1 ring-white/15">
                  {label}
                </span>
              ))}
            </div>
          </div>
          {onReplan && (
            <Button
              type="button"
              variant="inverted"
              size="sm"
              loading={locatingGps}
              onClick={requestGps}
              icon={<Navigation className="size-4" aria-hidden />}
            >
              {userGps ? `GPS: ${userGps.lat.toFixed(4)}, ${userGps.lng.toFixed(4)}` : 'Bật vị trí GPS'}
            </Button>
          )}
        </div>

        <div className="relative mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            icon={<CalendarDays className="size-4" aria-hidden />}
            label="Thời gian & nhóm"
            value={`${itinerary.days.length} ngày`}
            hint={`${itinerary.input?.people ?? 2} khách`}
          />
          <StatTile
            icon={<MapPinned className="size-4" aria-hidden />}
            label="Điểm chính đã xếp"
            value={`${itinerary.scheduled_primary_ids?.length ?? 0} điểm`}
            hint={
              itinerary.unassigned_primary_places?.length
                ? `${itinerary.unassigned_primary_places.length} điểm chưa xếp được`
                : 'Đã xếp đủ các điểm chính'
            }
            style={{ animationDelay: '60ms' }}
          />
          <StatTile
            icon={<Route className="size-4" aria-hidden />}
            label="Quãng đường chạy xe"
            value={`${(cost?.road_distance_km ?? 0).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} km`}
            hint="Theo tuyến đường thực tế"
            style={{ animationDelay: '120ms' }}
          />
          <StatTile
            icon={<Wallet className="size-4" aria-hidden />}
            label="Chi phí đã biết / ngân sách"
            value={`${formatVndShort(knownCost)} / ${formatVndShort(budget)}`}
            hint={`${cost?.unknown_cost_count ?? 0} khoản chưa có giá`}
            style={{ animationDelay: '180ms' }}
          >
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15">
              <div
                className={clsx(
                  'tp-grow-x h-full rounded-full',
                  budgetRatio > 1 ? 'bg-lotus-300' : budgetRatio > 0.8 ? 'bg-teal-300' : 'bg-leaf-300',
                )}
                style={{ width: `${Math.min(100, Math.max(4, budgetRatio * 100))}%` }}
              />
            </div>
          </StatTile>
        </div>

        {onReplan && totalStops > 0 && (
          <div className="relative mt-5">
            <div className="flex items-center justify-between text-xs text-leaf-100">
              <span>Tiến độ chuyến đi</span>
              <span className="font-semibold text-white">
                {completedStops}/{totalStops} điểm dừng
              </span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-gradient-to-r from-teal-200 to-leaf-300 transition-[width] duration-700"
                style={{ width: `${(completedStops / totalStops) * 100}%` }}
              />
            </div>
          </div>
        )}
      </section>

      {/* ── Next stop after replan ───────────────────────────────── */}
      {highlightedNextStop && (
        <section className="tp-fade-up relative overflow-hidden rounded-card border-2 border-leaf-400 bg-gradient-to-r from-leaf-50 via-white to-white p-5 shadow-raised">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-start gap-4">
              <span className="tp-pulse-ring grid size-12 shrink-0 place-items-center rounded-full bg-leaf-600 text-white">
                <Flag className="size-5" aria-hidden />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-leaf-700">Điểm đến tiếp theo (Next Stop)</p>
                <h3 className="mt-0.5 text-lg font-bold text-river-900">{highlightedNextStop.name}</h3>
                <p className="mt-1 text-sm text-river-600">
                  Dự kiến đến{' '}
                  <strong className="text-river-900">
                    {formatIsoClock(highlightedNextStop.estimated_arrival_at) ?? highlightedNextStop.start}
                  </strong>{' '}
                  · Giờ ghé{' '}
                  <strong className="text-river-900">
                    {formatIsoClock(highlightedNextStop.planned_start_at) ?? highlightedNextStop.start} –{' '}
                    {formatIsoClock(highlightedNextStop.planned_end_at) ?? highlightedNextStop.end}
                  </strong>
                </p>
              </div>
            </div>
            <a
              href={buildMapsUrl(highlightedNextStop.latitude, highlightedNextStop.longitude, highlightedNextStop.name, userGps)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-leaf-600 px-5 py-2.5 text-sm font-semibold text-white shadow-cta transition hover:-translate-y-0.5 hover:bg-leaf-700"
            >
              <Compass className="size-4" aria-hidden />
              Mở bản đồ chỉ đường
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          </div>
        </section>
      )}

      {/* ── Budget ───────────────────────────────────────────────── */}
      {cost && cost.budget_overage_vnd > 0 && (
        <Notice tone="warning" icon={<AlertTriangle className="size-4" aria-hidden />} title="Cảnh báo vượt ngân sách">
          Các khoản đã biết giá ({formatVnd(cost.known_subtotal_vnd)}) đang vượt ngân sách{' '}
          <strong>{formatVnd(cost.budget_overage_vnd)}</strong>. Hãy cân nhắc tăng ngân sách hoặc đổi dịch vụ.
        </Notice>
      )}

      {budgetAlternative && onApplyBudgetAlternative && (
        <section className="tp-fade-up flex flex-col justify-between gap-3 rounded-card border border-teal-200 bg-gradient-to-r from-teal-50 to-white p-5 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-teal-500 text-white">
              <Wallet className="size-5" aria-hidden />
            </span>
            <div>
              <p className="font-semibold text-river-900">Có phương án tiết kiệm hơn</p>
              <p className="mt-0.5 text-sm text-river-600">
                Chi phí đã biết giảm từ {formatVnd(cost?.known_subtotal_vnd)} xuống{' '}
                <strong className="text-leaf-700">{formatVnd(budgetAlternative.cost_summary?.known_subtotal_vnd)}</strong>, giữ nguyên các
                điểm tham quan.
              </p>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => onApplyBudgetAlternative(budgetAlternative)}
            icon={<Sparkles className="size-4" aria-hidden />}
          >
            Áp dụng phương án tiết kiệm
          </Button>
        </section>
      )}

      {/* ── Primary places ───────────────────────────────────────── */}
      {primaryPlaces.length > 0 && (
        <section>
          <div className="mb-3 flex items-end justify-between gap-2">
            <div>
              <h3 className="text-lg">Điểm chính được chọn ({primaryPlaces.length})</h3>
              <p className="text-xs text-river-500">Đồng bộ từ cơ sở dữ liệu Đồng Tháp & tính toán bằng thuật toán AI V9</p>
            </div>
            <span className="text-xs text-river-500">Xếp theo thời gian chạy xe và điểm đánh giá</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {primaryPlaces.map((place, idx) => {
              const meta = roleMeta(place.role);
              const reason = formatV9RankingReason(place);
              const thumbUrl = place.images?.[0]?.url;

              return (
                <article
                  key={place.id}
                  className="tp-fade-up group relative flex flex-col justify-between overflow-hidden rounded-card bg-white p-4 shadow-card ring-1 ring-sand-200 transition-all duration-200 hover:-translate-y-1 hover:shadow-raised hover:ring-leaf-300"
                  style={{ animationDelay: `${idx * 70}ms` }}
                >
                  <span className="absolute right-3 top-3 text-4xl font-black text-sand-100 transition-colors group-hover:text-leaf-100" aria-hidden>
                    {String(idx + 1).padStart(2, '0')}
                  </span>

                  <div>
                    {thumbUrl && (
                      <div className="relative -mx-4 -mt-4 mb-3 h-32 overflow-hidden bg-sand-100">
                        <img
                          src={thumbUrl}
                          alt={place.name}
                          className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                        {place.isPersonalizedMatch && (
                          <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-lotus-600/90 px-2.5 py-0.5 text-[10px] font-bold text-white shadow backdrop-blur-sm">
                            <Sparkles className="size-3" /> Dành riêng cho bạn
                          </span>
                        )}
                      </div>
                    )}

                    <div className="relative flex items-center gap-3">
                      <span className={clsx('grid size-11 shrink-0 place-items-center rounded-xl', meta.bubble)}>
                        <meta.Icon className="size-5" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-river-500">{meta.label}</p>
                        {place.slug ? (
                          <a
                            href={`/destinations/${place.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 truncate font-bold text-river-900 transition hover:text-leaf-700 hover:underline"
                            title={place.name}
                          >
                            <span>{place.name}</span>
                            <ExternalLink className="size-3 shrink-0 opacity-60" />
                          </a>
                        ) : (
                          <p className="truncate font-bold text-river-900" title={place.name}>
                            {place.name}
                          </p>
                        )}
                      </div>
                    </div>

                    {!thumbUrl && place.isPersonalizedMatch && (
                      <div className="mt-2.5">
                        <span className="inline-flex items-center gap-1 rounded-full bg-lotus-50 px-2.5 py-0.5 text-[10px] font-bold text-lotus-700 ring-1 ring-inset ring-lotus-200">
                          <Sparkles className="size-3" /> {place.personalizationReason ?? 'Gợi ý theo sở thích của bạn'}
                        </span>
                      </div>
                    )}

                    {place.google_rating !== null && place.google_rating !== undefined && (
                      <div className="relative mt-3 flex items-center gap-2 text-xs text-river-600">
                        <Stars rating={place.google_rating} />
                        <span className="font-semibold text-river-800">{place.google_rating}</span>
                        <span>({(place.google_review_count ?? 0).toLocaleString('vi-VN')} đánh giá)</span>
                      </div>
                    )}
                    {reason && <p className="relative mt-2 line-clamp-3 text-xs leading-relaxed text-river-600">{reason}</p>}
                  </div>

                  {place.tags?.length > 0 && (
                    <div className="relative mt-3 flex flex-wrap gap-1">
                      {place.tags.slice(0, 4).map((t) => (
                        <span key={t} className="rounded-full bg-sand-100 px-2 py-0.5 text-[11px] text-river-700">
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Shared accommodation ─────────────────────────────────── */}
      {itinerary.shared_accommodation && (
        <section className="tp-fade-up flex items-start gap-4 rounded-card border border-lotus-200 bg-gradient-to-r from-lotus-50 to-white p-5">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-lotus-500 text-white">
            <BedDouble className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-lotus-700">Lưu trú chung cho chuyến đi</p>
            <h3 className="mt-0.5 text-base font-bold text-river-900">{itinerary.shared_accommodation.name}</h3>
            <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-river-600">
              <span>
                <strong className="text-river-900">{itinerary.shared_accommodation.scheduled_nights}</strong> đêm
              </span>
              {itinerary.shared_accommodation.phone && (
                <a href={`tel:${itinerary.shared_accommodation.phone}`} className="inline-flex items-center gap-1 hover:text-leaf-700">
                  <Phone className="size-3.5" aria-hidden />
                  {itinerary.shared_accommodation.phone}
                </a>
              )}
            </p>
            <p className="mt-1 text-xs text-river-500">
              Mặc định ngủ {Math.round((itinerary.input?.sleep_minutes ?? 540) / 60)} tiếng/đêm, trả phòng trước 12:00. Vui lòng gọi xác
              nhận giá và tình trạng phòng.
            </p>
          </div>
        </section>
      )}

      {itinerary.unassigned_primary_places?.length > 0 && (
        <Notice
          tone="warning"
          icon={<AlertTriangle className="size-4" aria-hidden />}
          title={`Có ${itinerary.unassigned_primary_places.length} điểm chính chưa xếp được vào lịch`}
        >
          <ul className="list-disc space-y-1 pl-4">
            {itinerary.unassigned_primary_places.map((u) => (
              <li key={u.id}>
                <strong>{u.name}</strong>: {u.reason}
              </li>
            ))}
          </ul>
        </Notice>
      )}

      {/* ── Day tabs ─────────────────────────────────────────────── */}
      <section>
        <div className="sticky top-[4.75rem] z-20 -mx-1 mb-4 overflow-x-auto rounded-full bg-white/85 p-1 shadow-card ring-1 ring-sand-200 backdrop-blur">
          <div role="tablist" aria-label="Chọn ngày" className="flex min-w-max gap-1">
            {itinerary.days.map((d, i) => {
              const active = activeDay === i;
              return (
                <button
                  key={d.day}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveDay(i)}
                  className={clsx(
                    'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200',
                    active ? 'bg-leaf-600 text-white shadow-cta' : 'text-river-600 hover:bg-leaf-50 hover:text-river-900',
                  )}
                >
                  <span
                    className={clsx(
                      'size-2 rounded-full',
                      d.status === 'needs_revision' ? 'bg-lotus-400' : active ? 'bg-leaf-200' : 'bg-leaf-500',
                    )}
                    aria-hidden
                  />
                  Ngày {d.day}
                  <span className={clsx('text-xs font-medium', active ? 'text-leaf-100' : 'text-river-400')}>
                    {d.date.slice(8, 10)}/{d.date.slice(5, 7)}
                  </span>
                </button>
              );
            })}
            {itinerary.days.length > 1 && (
              <button
                type="button"
                role="tab"
                aria-selected={activeDay === -1}
                onClick={() => setActiveDay(-1)}
                className={clsx(
                  'rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200',
                  activeDay === -1 ? 'bg-leaf-600 text-white shadow-cta' : 'text-river-600 hover:bg-leaf-50',
                )}
              >
                Xem tất cả
              </button>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {daysToRender.map((day) => (
            <DayTimeline
              key={`${day.day}-${activeDay}`}
              day={day}
              placesById={placesById}
              onReplan={onReplan}
              replanningStopId={replanningStopId}
              customTimeByStop={customTimeByStop}
              setCustomTimeByStop={setCustomTimeByStop}
              userGps={userGps}
              editable={editable && Boolean(onUpdateItinerary)}
              onMoveStop={(stopId, dir) => handleMoveStop(day.day, stopId, dir)}
              onRemoveStop={(stopId) => handleRemoveStop(day.day, stopId)}
              onRequestSwapStop={onRequestSwapStop ? (step) => onRequestSwapStop(day.day, step) : undefined}
              onQuickSituation={(step, situation) => handleQuickSituation(day, step, situation)}
              onOpenSituationModal={(step) => setSituationModalStop({ dayNumber: day.day, step })}
            />
          ))}
        </div>
      </section>

      {/* ── Situation details modal ───────────────────────────────── */}
      {situationModalStop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="tp-scale-up w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-sand-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-leaf-700">Tùy biến tình huống thực tế</p>
                <h3 className="text-lg font-bold text-river-900">{situationModalStop.step.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSituationModalStop(null)}
                className="rounded-lg p-1 text-river-400 hover:bg-sand-100 hover:text-river-700"
              >
                ✕
              </button>
            </div>

            <p className="mt-2 text-xs text-river-600">
              Chọn nhanh tình huống bạn đang gặp phải tại Đồng Tháp để hệ thống điều chỉnh lịch trình tối ưu:
            </p>

            <div className="mt-4 grid gap-2.5">
              <button
                type="button"
                onClick={() => {
                  const targetDay = itinerary.days.find((d) => d.day === situationModalStop.dayNumber);
                  if (targetDay) {
                    void handleQuickSituation(targetDay, situationModalStop.step, 'rain_delay_45m');
                  }
                  setSituationModalStop(null);
                }}
                className="flex items-center gap-3 rounded-xl border border-sand-200 bg-sand-50/50 p-3 text-left transition hover:border-teal-400 hover:bg-teal-50/60"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-teal-500 text-white">
                  <CloudRain className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-bold text-river-900">🌧️ Trời mưa lớn (Lùi lịch 45 phút)</p>
                  <p className="text-xs text-river-500">Tự động cộng thêm 45 phút nghỉ chờ ngớt mưa và tính lại các chặng sau.</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  const targetDay = itinerary.days.find((d) => d.day === situationModalStop.dayNumber);
                  if (targetDay) {
                    void handleQuickSituation(targetDay, situationModalStop.step, 'traffic_30m');
                  }
                  setSituationModalStop(null);
                }}
                className="flex items-center gap-3 rounded-xl border border-sand-200 bg-sand-50/50 p-3 text-left transition hover:border-amber-400 hover:bg-amber-50/60"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-amber-500 text-white">
                  <Car className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-bold text-river-900">🚗 Kẹt xe / Đường trắc trở (+30 phút)</p>
                  <p className="text-xs text-river-500">Cộng thêm 30 phút di chuyển dự phòng để không bị trễ giờ đóng cửa.</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  const targetDay = itinerary.days.find((d) => d.day === situationModalStop.dayNumber);
                  if (targetDay) {
                    void handleQuickSituation(targetDay, situationModalStop.step, 'skip_stop');
                  }
                  setSituationModalStop(null);
                }}
                className="flex items-center gap-3 rounded-xl border border-sand-200 bg-sand-50/50 p-3 text-left transition hover:border-lotus-400 hover:bg-lotus-50/60"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-lotus-500 text-white">
                  <FastForward className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-bold text-river-900">⏭️ Bỏ qua điểm này và đi tiếp</p>
                  <p className="text-xs text-river-500">Bỏ qua điểm này ngay lập tức để chuyển tuyến đến địa điểm kế tiếp.</p>
                </div>
              </button>
            </div>

            <div className="mt-5 flex justify-end">
              <Button type="button" variant="secondary" size="sm" onClick={() => setSituationModalStop(null)}>
                Đóng
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Budget allocation ────────────────────────────────────── */}
      {alloc && <BudgetAllocation alloc={alloc} budget={budget} />}

      {/* ── Warnings ─────────────────────────────────────────────── */}
      {itinerary.warnings?.length > 0 && (
        <details className="group rounded-card border border-river-100 bg-river-50/70 p-4 text-sm text-river-800">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-semibold">
            <span className="inline-flex items-center gap-2">
              <Info className="size-4" aria-hidden />
              Lưu ý cho hành trình ({itinerary.warnings.length})
            </span>
            <ChevronDown className="size-4 transition-transform duration-200 group-open:rotate-180" aria-hidden />
          </summary>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-river-700">
            {itinerary.warnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

const ALLOC_META: Array<{ key: 'food' | 'stay' | 'transport' | 'activities' | 'reserve'; label: string; color: string }> = [
  { key: 'food', label: 'Ăn uống', color: 'bg-teal-400' },
  { key: 'stay', label: 'Lưu trú', color: 'bg-lotus-400' },
  { key: 'transport', label: 'Di chuyển', color: 'bg-river-500' },
  { key: 'activities', label: 'Hoạt động', color: 'bg-leaf-500' },
  { key: 'reserve', label: 'Dự phòng', color: 'bg-sand-300' },
];

function BudgetAllocation({
  alloc,
  budget,
}: {
  alloc: V9ItineraryObject['budget_allocation']['whole_group_vnd'];
  budget: number;
}) {
  const total = ALLOC_META.reduce((n, m) => n + (alloc[m.key] ?? 0), 0) || 1;
  return (
    <section className="rounded-card bg-white p-5 shadow-card ring-1 ring-sand-200">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-lg">Phân bổ ngân sách cả nhóm</h3>
          <p className="text-xs text-river-500">Khoản dự kiến dành ra, không phải báo giá cố định của cơ sở.</p>
        </div>
        <p className="text-xl font-extrabold text-river-900">{formatVnd(budget)}</p>
      </div>
      <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-sand-100">
        {ALLOC_META.map((m) =>
          alloc[m.key] > 0 ? (
            <div
              key={m.key}
              className={clsx('tp-grow-x h-full first:rounded-l-full last:rounded-r-full', m.color)}
              style={{ width: `${(alloc[m.key] / total) * 100}%` }}
              title={`${m.label}: ${formatVnd(alloc[m.key])}`}
            />
          ) : null,
        )}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {ALLOC_META.map((m) => (
          <div key={m.key} className="rounded-xl bg-sand-50 p-3 transition hover:bg-leaf-50">
            <p className="flex items-center gap-1.5 text-xs text-river-500">
              <span className={clsx('size-2.5 rounded-full', m.color)} aria-hidden />
              {m.label}
            </p>
            <p className="mt-1 font-bold text-river-900">{formatVnd(alloc[m.key])}</p>
            <p className="text-[11px] text-river-400">{Math.round((alloc[m.key] / total) * 100)}%</p>
          </div>
        ))}
      </div>
    </section>
  );
}

interface DayTimelineProps {
  day: V9Day;
  placesById?: Map<string, V9Place>;
  onReplan?: V9ItineraryViewProps['onReplan'];
  replanningStopId?: string | null;
  customTimeByStop: Record<string, string>;
  setCustomTimeByStop: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  userGps: { lat: number; lng: number } | null;
  editable: boolean;
  onMoveStop: (stopId: string, direction: 'up' | 'down') => void;
  onRemoveStop: (stopId: string) => void;
  onRequestSwapStop?: (step: V9ActivityStep) => void;
  onQuickSituation: (step: V9ActivityStep, situation: 'checkin_now' | 'leave_now' | 'traffic_30m' | 'rain_delay_45m' | 'skip_stop') => void;
  onOpenSituationModal: (step: V9ActivityStep) => void;
}

function DayTimeline({
  day,
  placesById,
  onReplan,
  replanningStopId,
  customTimeByStop,
  setCustomTimeByStop,
  userGps,
  editable,
  onMoveStop,
  onRemoveStop,
  onRequestSwapStop,
  onQuickSituation,
  onOpenSituationModal,
}: DayTimelineProps) {
  const firstIncompleteStop = day.activities.find((s) => Boolean(s.stop_id) && s.status !== 'completed');
  const dayIssues: V9StopIssue[] = day.replan_state?.issues ?? [];
  const issueByStopId = new Map<string, string>();
  for (const issue of dayIssues) {
    if (issue.stop_id) issueByStopId.set(issue.stop_id, issue.reason);
  }
  const stops = day.activities.filter((s) => Boolean(s.stop_id));
  const doneStops = stops.filter((s) => s.status === 'completed').length;
  const travelKm = day.activities.reduce((n, s) => n + (s.type === 'travel' && typeof s.distance_km === 'number' ? s.distance_km : 0), 0);

  return (
    <article className="tp-fade-up rounded-panel bg-white p-5 shadow-card ring-1 ring-sand-200 sm:p-7">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-sand-200 pb-5">
        <div className="flex items-center gap-4">
          <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-leaf-600 to-leaf-800 text-white shadow-cta">
            <span className="text-center leading-none">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-leaf-100">Ngày</span>
              <span className="block text-2xl font-black">{day.day}</span>
            </span>
          </div>
          <div>
            <h3 className="text-xl capitalize">{formatDateVi(day.date)}</h3>
            <p className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-river-500">
              <span className="inline-flex items-center gap-1">
                <Landmark className="size-3.5" aria-hidden /> {day.visit_count} điểm tham quan
              </span>
              <span className="inline-flex items-center gap-1">
                <Car className="size-3.5" aria-hidden /> {travelKm.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} km
              </span>
              {day.replan_state?.estimated_day_end_at && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3.5" aria-hidden /> Kết thúc dự kiến {formatIsoClock(day.replan_state.estimated_day_end_at)}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span
            className={clsx(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset',
              day.status === 'needs_revision' ? 'bg-lotus-50 text-lotus-700 ring-lotus-200' : 'bg-leaf-50 text-leaf-800 ring-leaf-200',
            )}
          >
            <span className={clsx('size-1.5 rounded-full', day.status === 'needs_revision' ? 'bg-lotus-500' : 'bg-leaf-500')} aria-hidden />
            {day.status === 'needs_revision' ? 'Cần điều chỉnh' : 'Hợp lệ'}
          </span>
          {day.replan_state?.later_days_need_review && (
            <span className="rounded-full bg-lotus-50 px-3 py-1 text-xs font-semibold text-lotus-700 ring-1 ring-inset ring-lotus-200">
              Cần xem lại lịch ngày sau
            </span>
          )}
          {onReplan && stops.length > 0 && (
            <span className="text-xs text-river-500">
              Đã xong <strong className="text-river-900">{doneStops}</strong>/{stops.length}
            </span>
          )}
        </div>
      </header>

      {dayIssues.length > 0 && (
        <div className="mt-4">
          <Notice tone="warning" icon={<AlertTriangle className="size-4" aria-hidden />} title="Vướng mắc khi tính lại tiến độ trong ngày">
            <ul className="list-disc space-y-1 pl-4">
              {dayIssues.map((iss, i) => {
                const matchedStep = iss.stop_id ? day.activities.find((s) => s.stop_id === iss.stop_id) : undefined;
                return (
                  <li key={`${iss.stop_id ?? 'day'}-${i}`}>
                    {matchedStep ? <strong>{matchedStep.name}: </strong> : null}
                    {ISSUE_REASON_LABELS[iss.reason] ?? iss.reason}
                  </li>
                );
              })}
            </ul>
          </Notice>
        </div>
      )}

      {/* Timeline */}
      <ol className="relative mt-6">
        <span className="absolute bottom-3 left-[19px] top-3 w-0.5 rounded-full bg-gradient-to-b from-leaf-300 via-sand-200 to-lotus-200" aria-hidden />
        {day.activities.map((step, index) => {
          const delay: CSSProperties = { animationDelay: `${Math.min(index, 14) * 35}ms` };

          if (step.type === 'travel') {
            return (
              <li key={`travel-${index}`} className="tp-fade-up relative flex items-center gap-3 py-1.5 pl-1.5" style={delay}>
                <span className="relative z-10 grid size-7 shrink-0 place-items-center rounded-full bg-white text-river-500 ring-2 ring-sand-200">
                  <Car className="size-3.5" aria-hidden />
                </span>
                <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-river-500">
                  <span className="font-semibold tabular-nums text-river-700">
                    {step.start} – {step.end}
                  </span>
                  {typeof step.distance_km === 'number' && (
                    <span className="rounded-full bg-sand-100 px-2 py-0.5 font-medium text-river-700">
                      {step.distance_km.toFixed(1)} km · {Math.round(step.route_duration_minutes ?? 0)} phút
                      {step.buffer_minutes ? ` (+${step.buffer_minutes}p)` : ''}
                    </span>
                  )}
                  <span className="truncate">{step.name}</span>
                </p>
              </li>
            );
          }

          if (step.type === 'free_time' || step.type === 'checkout') {
            const mins = spanMinutes(step.start, step.end);
            return (
              <li key={`aux-${index}`} className="tp-fade-up relative flex items-center gap-3 py-1.5 pl-1.5" style={delay}>
                <span className="relative z-10 grid size-7 shrink-0 place-items-center rounded-full border-2 border-dashed border-sand-300 bg-sand-50 text-river-400">
                  {step.type === 'checkout' ? <LogOut className="size-3.5" aria-hidden /> : <Hourglass className="size-3.5" aria-hidden />}
                </span>
                <p className="text-xs text-river-500">
                  <span className="font-semibold tabular-nums text-river-600">
                    {step.start} – {step.end}
                  </span>{' '}
                  · <span className="italic">{step.type === 'checkout' ? 'Trả phòng' : 'Thời gian tự do / nghỉ ngơi'}</span>
                  {mins ? <span className="text-river-400"> ({formatDuration(mins)})</span> : null}
                </p>
              </li>
            );
          }

          const stopIndexInStops = stops.findIndex((s) => s.stop_id === step.stop_id);
          const canMoveUp = editable && stopIndexInStops > 0;
          const canMoveDown = editable && stopIndexInStops < stops.length - 1;

          return (
            <StopCard
              key={step.stop_id ?? `step-${index}`}
              step={step}
              day={day}
              style={delay}
              placeInfo={step.place_id ? placesById?.get(step.place_id) : undefined}
              stepIssue={step.stop_id ? issueByStopId.get(step.stop_id) : undefined}
              isCurrentActionable={Boolean(onReplan) && Boolean(firstIncompleteStop) && step.stop_id === firstIncompleteStop?.stop_id}
              onReplan={onReplan}
              replanningStopId={replanningStopId}
              customTimeByStop={customTimeByStop}
              setCustomTimeByStop={setCustomTimeByStop}
              userGps={userGps}
              editable={editable}
              canMoveUp={canMoveUp}
              canMoveDown={canMoveDown}
              onMoveUp={() => step.stop_id && onMoveStop(step.stop_id, 'up')}
              onMoveDown={() => step.stop_id && onMoveStop(step.stop_id, 'down')}
              onRemove={() => step.stop_id && onRemoveStop(step.stop_id)}
              onRequestSwap={onRequestSwapStop ? () => onRequestSwapStop(step) : undefined}
              onQuickSituation={(situation) => onQuickSituation(step, situation)}
              onOpenSituationModal={() => onOpenSituationModal(step)}
            />
          );
        })}

        {day.overnight_stay && (
          <li className="tp-fade-up relative flex gap-3 pt-3">
            <span className="relative z-10 grid size-10 shrink-0 place-items-center rounded-full bg-lotus-500 text-white shadow-[0_8px_20px_-10px_rgb(178_80_107/0.8)]">
              <Moon className="size-4.5" aria-hidden />
            </span>
            <div className="flex-1 rounded-2xl border border-lotus-200 bg-gradient-to-br from-lotus-50 to-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-lotus-700">Nghỉ qua đêm · đến lúc {day.overnight_stay.planned_arrival}</p>
              <p className="mt-0.5 font-bold text-river-900">{day.overnight_stay.name}</p>
              <div className="mt-2 grid gap-2 text-xs text-river-600 sm:grid-cols-3">
                <span>
                  Ngủ: <strong className="text-river-900">{formatIsoClock(day.overnight_stay.sleep_start_at)}</strong> →{' '}
                  <strong className="text-river-900">{formatIsoClock(day.overnight_stay.sleep_end_at)}</strong> (
                  {Math.round(day.overnight_stay.sleep_minutes / 60)} tiếng)
                </span>
                <span>
                  Sẵn sàng sáng mai: <strong className="text-river-900">{formatIsoClock(day.overnight_stay.ready_next_day_at)}</strong>
                </span>
                <span>
                  Hạn trả phòng: <strong className="text-river-900">{day.overnight_stay.checkout_deadline}</strong>
                </span>
              </div>
              {day.overnight_stay.phone && (
                <a
                  href={`tel:${day.overnight_stay.phone}`}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-lotus-700 hover:underline"
                >
                  <Phone className="size-3.5" aria-hidden /> {day.overnight_stay.phone}
                </a>
              )}
            </div>
          </li>
        )}
      </ol>
    </article>
  );
}

interface StopCardProps {
  step: V9ActivityStep;
  day: V9Day;
  style: CSSProperties;
  placeInfo?: V9Place;
  stepIssue?: string;
  isCurrentActionable: boolean;
  onReplan?: V9ItineraryViewProps['onReplan'];
  replanningStopId?: string | null;
  customTimeByStop: Record<string, string>;
  setCustomTimeByStop: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  userGps: { lat: number; lng: number } | null;
  editable?: boolean;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onRemove?: () => void;
  onRequestSwap?: () => void;
  onQuickSituation?: (situation: 'checkin_now' | 'leave_now' | 'traffic_30m' | 'rain_delay_45m' | 'skip_stop') => void;
  onOpenSituationModal?: () => void;
}

function StopCard({
  step,
  day,
  style,
  placeInfo,
  stepIssue,
  isCurrentActionable,
  onReplan,
  replanningStopId,
  customTimeByStop,
  setCustomTimeByStop,
  userGps,
  editable,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onRemove,
  onRequestSwap,
  onQuickSituation,
  onOpenSituationModal,
}: StopCardProps) {
  const isStop = Boolean(step.stop_id);
  const isMeal = step.type === 'meal' || step.type === 'meal_unassigned' || step.type === 'meal_unscheduled';
  const isProblem = step.type === 'unresolved_return' || step.type === 'meal_unscheduled';
  const mealMeta = step.meal ? MEAL_META[step.meal] : undefined;
  const { eyebrow, title } = splitStepName(step);

  const coords =
    typeof step.latitude === 'number' && typeof step.longitude === 'number'
      ? { lat: step.latitude, lon: step.longitude }
      : placeInfo?.coordinates
        ? { lat: placeInfo.coordinates[1], lon: placeInfo.coordinates[0] }
        : null;

  const plannedStartClock = formatIsoClock(step.planned_start_at);
  const plannedEndClock = formatIsoClock(step.planned_end_at);
  const estArrivalClock = formatIsoClock(step.estimated_arrival_at);
  const arrivedClock = formatIsoClock(step.arrived_at);
  const departedClock = formatIsoClock(step.departed_at);
  const estDepartureClock = formatIsoClock(step.estimated_departure_at);

  const nextEvent: 'arrived' | 'departed' = step.status === 'arrived' ? 'departed' : 'arrived';
  const timeInputValue = customTimeByStop[step.stop_id ?? ''] ?? defaultEventTimeForStep(step, nextEvent);

  const RailIcon = step.status === 'completed' ? CheckCircle2 : isProblem ? AlertTriangle : isMeal ? (mealMeta?.Icon ?? UtensilsCrossed) : Landmark;
  const railClass =
    step.status === 'completed'
      ? 'bg-leaf-500 text-white'
      : isProblem
        ? 'bg-lotus-500 text-white'
        : isMeal
          ? 'bg-teal-500 text-white'
          : 'bg-leaf-600 text-white';

  return (
    <li className="tp-fade-up relative flex gap-3 py-2" style={style}>
      <span
        className={clsx(
          'relative z-10 mt-3 grid size-10 shrink-0 place-items-center rounded-full shadow-card ring-4 ring-white',
          railClass,
          (step.status === 'arrived' || isCurrentActionable) && 'tp-pulse-ring',
        )}
      >
        <RailIcon className="size-4.5" aria-hidden />
      </span>

      <div
        className={clsx(
          'flex-1 rounded-2xl border p-4 transition-all duration-200',
          stepIssue
            ? 'border-lotus-300 bg-lotus-50/50'
            : step.status === 'completed'
              ? 'border-leaf-200 bg-leaf-50/40 opacity-80'
              : step.status === 'arrived'
                ? 'border-leaf-500 bg-leaf-50/70 shadow-raised'
                : isCurrentActionable
                  ? 'border-leaf-400 bg-white shadow-raised'
                  : 'border-sand-200 bg-white hover:-translate-y-0.5 hover:border-leaf-300 hover:shadow-raised',
        )}
      >
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-river-900 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-white">
                <Clock className="size-3" aria-hidden />
                {plannedStartClock && plannedEndClock ? `${plannedStartClock} – ${plannedEndClock}` : `${step.start} – ${step.end}`}
              </span>
              {plannedStartClock && (plannedStartClock !== step.start || plannedEndClock !== step.end) && (
                <span className="text-xs text-river-400 line-through">
                  {step.start} – {step.end}
                </span>
              )}
              <span
                className={clsx(
                  'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                  isProblem ? 'bg-lotus-50 text-lotus-700' : isMeal ? 'bg-teal-50 text-teal-800' : 'bg-leaf-50 text-leaf-800',
                )}
              >
                {step.type === 'visit'
                  ? 'Tham quan'
                  : step.type === 'meal'
                    ? (mealMeta?.label ?? 'Ăn uống')
                    : step.type === 'meal_unassigned'
                      ? 'Tự chọn quán'
                      : 'Cần lưu ý'}
              </span>
              {isStop && step.status !== 'pending' && (
                <span
                  className={clsx(
                    'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                    step.status === 'completed' ? 'bg-leaf-600 text-white' : 'bg-teal-500 text-white',
                  )}
                >
                  {step.status === 'completed' ? 'Đã hoàn thành' : 'Đang ở tại điểm'}
                </span>
              )}
            </div>

            {eyebrow && step.type !== 'meal' && <p className="text-xs font-medium text-river-500">{eyebrow}</p>}
            <h4 className={clsx('text-base font-bold text-river-900', step.status === 'completed' && 'line-through decoration-leaf-400')}>
              {title}
            </h4>

            {(estArrivalClock || arrivedClock || estDepartureClock || departedClock) && (
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-leaf-800">
                {estArrivalClock && !arrivedClock && (
                  <span>
                    Dự kiến đến: <strong>{estArrivalClock}</strong>
                  </span>
                )}
                {arrivedClock && (
                  <span>
                    Đã đến: <strong>{arrivedClock}</strong>
                  </span>
                )}
                {estDepartureClock && (
                  <span>
                    Dự kiến rời: <strong>{estDepartureClock}</strong>
                  </span>
                )}
                {departedClock && (
                  <span>
                    Đã rời: <strong>{departedClock}</strong>
                  </span>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-river-500">
              {typeof step.duration_minutes === 'number' && step.duration_minutes > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Hourglass className="size-3" aria-hidden /> {formatDuration(step.duration_minutes)}
                </span>
              )}
              {step.google_rating !== null && step.google_rating !== undefined && (
                <span className="inline-flex items-center gap-1">
                  <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden />
                  <strong className="text-river-800">{step.google_rating}</strong> ({(step.google_review_count ?? 0).toLocaleString('vi-VN')})
                </span>
              )}
              {step.phone && (
                <a href={`tel:${step.phone}`} className="inline-flex items-center gap-1 hover:text-leaf-700">
                  <Phone className="size-3" aria-hidden /> {step.phone}
                </a>
              )}
              {step.estimated_group_cost_vnd !== undefined && (
                <span className="inline-flex items-center gap-1">
                  <Wallet className="size-3" aria-hidden /> {formatVnd(step.estimated_group_cost_vnd)}
                </span>
              )}
              {step.spending_target_group_vnd !== null && step.spending_target_group_vnd !== undefined && (
                <span className="inline-flex items-center gap-1">
                  <Users className="size-3" aria-hidden /> Mục tiêu nhóm {formatVnd(step.spending_target_group_vnd)}
                </span>
              )}
            </div>

            <ActivityChips items={step.activities_available} />

            {step.note && <p className="text-xs text-river-500">{step.note}</p>}
            {stepIssue && (
              <p className="flex items-center gap-1 text-xs font-medium text-lotus-700">
                <AlertTriangle className="size-3.5" aria-hidden /> {ISSUE_REASON_LABELS[stepIssue] ?? stepIssue}
              </p>
            )}

            {/* Quick 1-click Situational Pills (Backlog 9) */}
            {isStop && step.status !== 'completed' && onQuickSituation && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] font-semibold text-river-400">Tình huống nhanh:</span>
                <button
                  type="button"
                  onClick={() => onQuickSituation('traffic_30m')}
                  title="Kẹt xe: lùi lịch 30 phút"
                  className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50/80 px-2 py-0.5 text-[11px] font-medium text-amber-800 transition hover:bg-amber-100"
                >
                  <Car className="size-3" aria-hidden /> Kẹt xe (+30p)
                </button>
                <button
                  type="button"
                  onClick={() => onQuickSituation('rain_delay_45m')}
                  title="Trời mưa lớn: lùi lịch 45 phút"
                  className="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-teal-50/80 px-2 py-0.5 text-[11px] font-medium text-teal-800 transition hover:bg-teal-100"
                >
                  <CloudRain className="size-3" aria-hidden /> Mưa to (+45p)
                </button>
                <button
                  type="button"
                  onClick={() => onQuickSituation('skip_stop')}
                  title="Bỏ qua điểm này để đi tiếp"
                  className="inline-flex items-center gap-1 rounded-full border border-sand-300 bg-sand-50 px-2 py-0.5 text-[11px] font-medium text-river-700 transition hover:bg-lotus-50 hover:text-lotus-700"
                >
                  <FastForward className="size-3" aria-hidden /> Bỏ qua
                </button>
                {onOpenSituationModal && (
                  <button
                    type="button"
                    onClick={onOpenSituationModal}
                    className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold text-leaf-700 hover:bg-leaf-50"
                  >
                    <Zap className="size-3" aria-hidden /> Thêm...
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
            {/* Stop Reordering & Delete Controls (Backlog 8) */}
            {editable && isStop && (
              <div className="flex items-center gap-1.5 rounded-2xl bg-white p-1 shadow-2xs ring-1 ring-sand-200/90 backdrop-blur-xs">
                {onRequestSwap && (
                  <>
                    <button
                      type="button"
                      onClick={onRequestSwap}
                      title="Đổi địa điểm này bằng AI — Tự động tính toán & cảnh báo đường đi"
                      className="group relative inline-flex items-center gap-1.5 overflow-hidden rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-leaf-700 px-3 py-1.5 text-xs font-extrabold text-white shadow-xs ring-1 ring-emerald-400/40 transition-all duration-300 hover:scale-105 hover:shadow-md hover:shadow-emerald-600/30 hover:ring-emerald-300 active:scale-95"
                    >
                      {/* Animated Shimmer sweep */}
                      <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/35 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full" />

                      {/* Glowing Sparkle icon */}
                      <Sparkles className="size-3.5 text-amber-300 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110" />

                      <span className="tracking-tight text-white drop-shadow-xs">Đổi điểm</span>

                      {/* Animated rotating icon pill */}
                      <span className="inline-flex size-4 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-xs transition-all duration-500 group-hover:bg-white/30 group-hover:rotate-180">
                        <RefreshCw className="size-2.5" />
                      </span>
                    </button>
                    <span className="h-4 w-px bg-sand-200" />
                  </>
                )}
                <button
                  type="button"
                  disabled={!canMoveUp}
                  onClick={onMoveUp}
                  title="Di chuyển lên trước"
                  aria-label="Di chuyển lên trước"
                  className="rounded-lg p-1.5 text-river-400 transition hover:bg-sand-100 hover:text-leaf-700 disabled:opacity-20"
                >
                  <ArrowUp className="size-3.5" />
                </button>
                <button
                  type="button"
                  disabled={!canMoveDown}
                  onClick={onMoveDown}
                  title="Di chuyển xuống sau"
                  aria-label="Di chuyển xuống sau"
                  className="rounded-lg p-1.5 text-river-400 transition hover:bg-sand-100 hover:text-leaf-700 disabled:opacity-20"
                >
                  <ArrowDown className="size-3.5" />
                </button>
                <span className="h-4 w-px bg-sand-200" />
                <button
                  type="button"
                  onClick={onRemove}
                  title="Bỏ điểm này khỏi lịch trình"
                  aria-label="Bỏ điểm này khỏi lịch trình"
                  className="rounded-lg p-1.5 text-river-400 transition hover:bg-rose-50 hover:text-rose-600"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            )}

            {(coords || step.place_id) && (
              <a
                href={buildMapsUrl(coords?.lat, coords?.lon, title, userGps)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-sand-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-river-700 shadow-2xs transition-all hover:-translate-y-0.5 hover:border-leaf-400 hover:text-leaf-700 hover:shadow-xs"
              >
                <Compass className="size-3.5 text-leaf-600" aria-hidden />
                Mở bản đồ
              </a>
            )}

            {isCurrentActionable && step.stop_id && onReplan && (
              <div className="mt-1 flex flex-col gap-2 rounded-2xl border border-leaf-300 bg-gradient-to-br from-leaf-50 to-white p-3 sm:items-end">
                <label className="flex items-center gap-2 text-xs font-medium text-river-700">
                  <span>Giờ thực tế:</span>
                  <input
                    type="time"
                    value={timeInputValue}
                    onChange={(e) => setCustomTimeByStop((prev) => ({ ...prev, [step.stop_id!]: e.target.value }))}
                    className="rounded-lg border border-sand-300 bg-white px-2 py-1 text-xs font-semibold text-river-900 focus:border-leaf-500 focus:outline-none focus:ring-2 focus:ring-leaf-100"
                  />
                </label>
                {step.status === 'pending' ? (
                  <div className="flex flex-col gap-1.5 sm:items-end">
                    <Button
                      type="button"
                      size="sm"
                      loading={replanningStopId === step.stop_id}
                      icon={<PlayCircle className="size-4" aria-hidden />}
                      onClick={() => {
                        const hhmm = customTimeByStop[step.stop_id!] || defaultEventTimeForStep(step, 'arrived');
                        void onReplan({ stopId: step.stop_id!, event: 'arrived', occurredAt: `${day.date}T${hhmm}:00+07:00` });
                      }}
                    >
                      Tôi đã đến nơi
                    </Button>
                    <button
                      type="button"
                      onClick={() => onQuickSituation && onQuickSituation('checkin_now')}
                      className="text-[11px] font-medium text-leaf-700 hover:underline"
                    >
                      ⚡ Đến nơi ngay bây giờ ({new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })})
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5 sm:items-end">
                    <Button
                      type="button"
                      size="sm"
                      loading={replanningStopId === step.stop_id}
                      icon={<CheckCircle2 className="size-4" aria-hidden />}
                      onClick={() => {
                        const hhmm = customTimeByStop[step.stop_id!] || defaultEventTimeForStep(step, 'departed');
                        void onReplan({ stopId: step.stop_id!, event: 'departed', occurredAt: `${day.date}T${hhmm}:00+07:00` });
                      }}
                    >
                      Hoàn thành và đi tiếp
                    </Button>
                    <button
                      type="button"
                      onClick={() => onQuickSituation && onQuickSituation('leave_now')}
                      className="text-[11px] font-medium text-teal-700 hover:underline"
                    >
                      ⚡ Rời điểm ngay bây giờ ({new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })})
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
