import clsx from 'clsx';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Bike,
  Bot,
  CalendarDays,
  Car,
  ChevronDown,
  Clock,
  Compass,
  Flower2,
  Hotel,
  Info,
  Landmark,
  ListChecks,
  MapPin,
  Music,
  RefreshCw,
  Route,
  Save,
  Sparkles,
  Star,
  Trash2,
  Users,
  UtensilsCrossed,
  Wallet,
  Wand2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { GeneratingPanel, OptionCard, Segmented, StepHeader, Stepper } from '../components/itinerary/PlannerControls';
import { V9ItineraryView } from '../components/itinerary/V9ItineraryView';
import { formatV9RankingReason, formatVnd, roleMeta } from '../components/itinerary/v9Meta';
import { PageContainer } from '../components/layout/PublicLayout';
import { Button } from '../components/ui/Button';
import { ChipToggle, FormField, Input, Select } from '../components/ui/Field';
import { ConfirmDialog } from '../components/ui/Modal';
import { Notice } from '../components/ui/States';
import { useApiQuery } from '../hooks/useApiQuery';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { api, toApiError } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { useItineraryDraft } from '../stores/itineraryDraftStore';
import { toast } from '../stores/toastStore';
import type {
  SavedItinerary,
  V9ActivityStep,
  V9Goal,
  V9ItineraryObject,
  V9Mode,
  V9Pace,
  V9Place,
  V9PlanRequest,
  V9PlanResponse,
  V9TransportMode,
} from '../types/api';

interface SwapDestinationCandidate {
  name: string;
  slug: string;
  area: string;
  summary?: string;
  coordinates: { lat: number; lng: number };
}

interface SwapConfirmationState {
  dayNumber: number;
  targetStopId: string;
  targetStopName: string;
  targetStopWindow: string;
  newDestination: SwapDestinationCandidate;
  extraDistanceKm: number;
  extraTravelMinutes: number;
  isInconvenient: boolean;
  suggestedNextDay: number;
}

const FEATURED_SWAP_DESTINATIONS: SwapDestinationCandidate[] = [
  {
    name: 'Bảo tàng Tổng hợp Đồng Tháp',
    slug: 'bao-tang-tong-hop-dong-thap',
    area: 'TP. Cao Lãnh, Đồng Tháp',
    summary: 'Bảo tàng lịch sử – văn hóa đặc sắc trung tâm TP. Cao Lãnh',
    coordinates: { lat: 10.4562, lng: 105.6324 },
  },
  {
    name: 'Làng hoa Sa Đéc',
    slug: 'lang-hoa-sa-dec',
    area: 'TP. Sa Đéc, Đồng Tháp',
    summary: 'Thủ phủ hoa kiểng trăm năm bên dòng sông Tiền',
    coordinates: { lat: 10.3125, lng: 105.7468 },
  },
  {
    name: 'Khu di tích Xẻo Quýt',
    slug: 'khu-di-tich-xeo-quyt',
    area: 'Cao Lãnh, Đồng Tháp',
    summary: 'Rừng tràm nguyên sinh & căn cứ kháng chiến lịch sử',
    coordinates: { lat: 10.4317, lng: 105.7521 },
  },
  {
    name: 'Vườn quốc gia Tràm Chim',
    slug: 'vuon-quoc-gia-tram-chim',
    area: 'Tam Nông, Đồng Tháp',
    summary: 'Khu Ramsar thế giới – thiên đường sếu đầu đỏ & chim nước',
    coordinates: { lat: 10.6749, lng: 105.5653 },
  },
  {
    name: 'Nhà cổ Huỳnh Thủy Lê',
    slug: 'nha-co-huynh-thuy-le',
    area: 'TP. Sa Đéc, Đồng Tháp',
    summary: 'Kiến trúc Đông – Tây giao thoa nổi tiếng trong tiểu thuyết Người Tình',
    coordinates: { lat: 10.2923, lng: 105.7592 },
  },
  {
    name: 'Khu du lịch Văn hóa Phương Nam',
    slug: 'khu-du-lich-van-hoa-phuong-nam',
    area: 'Lấp Vò, Đồng Tháp',
    summary: 'Đền thờ Nam Phương Linh Từ & không gian văn hóa đất phương Nam',
    coordinates: { lat: 10.3401, lng: 105.6122 },
  },
];

function stripViAccents(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

function haversineRoadKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  // Multiply straight-line distance by 1.28 for realistic Mekong Delta road winding
  return Math.round(R * c * 1.28 * 10) / 10;
}

const V9_INTEREST_OPTIONS = [
  'du lịch sinh thái',
  'thiên nhiên',
  'tham quan',
  'chụp ảnh',
  'ẩm thực',
  'miệt vườn',
  'sông nước',
  'văn hóa địa phương',
  'gia đình',
  'thư giãn',
  'giải trí',
  'lưu trú',
];

const GOAL_OPTIONS: Array<{ value: V9Goal; label: string; description: string; icon: typeof Landmark; accent: 'leaf' | 'teal' | 'lotus' | 'river' }> = [
  { value: 'sightseeing', label: 'Tham quan', description: 'Khám phá điểm nổi bật', icon: Landmark, accent: 'leaf' },
  { value: 'food', label: 'Ẩm thực', description: 'Món ngon địa phương', icon: UtensilsCrossed, accent: 'teal' },
  { value: 'relaxation', label: 'Thư giãn', description: 'Spa & chăm sóc', icon: Flower2, accent: 'lotus' },
  { value: 'nightlife', label: 'Giải trí', description: 'Karaoke & vui chơi', icon: Music, accent: 'river' },
  { value: 'stay', label: 'Nghỉ dưỡng', description: 'Lưu trú thoải mái', icon: Hotel, accent: 'lotus' },
];

const PACE_HINT: Record<V9Pace, string> = {
  relaxed: 'Tối đa 2 điểm chính mỗi ngày, nhiều thời gian nghỉ.',
  balanced: 'Tối đa 3 điểm chính mỗi ngày, cân bằng đi và nghỉ.',
  busy: 'Tối đa 4 điểm chính mỗi ngày, lịch dày đặc.',
};

const BUDGET_PRESETS = [1_000_000, 2_000_000, 3_000_000, 5_000_000];

export function ItineraryCreatePage() {
  useDocumentTitle('Lập lịch trình AI (Trip Planner V9)');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const draft = useItineraryDraft();

  const urlDays = searchParams.get('days') ? Number(searchParams.get('days')) : null;
  const urlPeople = searchParams.get('people') ? Number(searchParams.get('people')) : null;
  const urlBudget = searchParams.get('budget') ? Number(searchParams.get('budget')) : null;
  const urlGoal = (searchParams.get('goal') as V9Goal) || null;
  const autoPlan = searchParams.get('autoPlan') === 'true';
  const urlRun = searchParams.get('run') || `${urlDays}-${urlPeople}-${urlBudget}`;

  const placesQuery = useApiQuery(
    (signal) =>
      api
        .get<{ places: V9Place[]; serviceOnline: boolean }>('/trip-planner/places', { signal })
        .then((r) => r.data),
    [],
  );

  const places = placesQuery.data?.places ?? [];
  const placesById = useMemo(() => new Map(places.map((p) => [p.id, p])), [places]);
  const hotels = useMemo(() => places.filter((p) => p.role === 'accommodation'), [places]);
  const placesByRole = useMemo(() => {
    const groups = new Map<string, V9Place[]>();
    for (const p of places) groups.set(p.role, [...(groups.get(p.role) ?? []), p]);
    return groups;
  }, [places]);

  const savedInput = draft.v9Itinerary?.input;

  const [mode, setMode] = useState<V9Mode>(savedInput?.mode ?? 'ai');
  const [goal, setGoal] = useState<V9Goal>(urlGoal ?? savedInput?.goal ?? 'sightseeing');
  const [startId, setStartId] = useState<string>(savedInput?.start_id ?? 'new_003');
  const [selectedIds, setSelectedIds] = useState<string[]>(savedInput?.selected_ids ?? ['new_014', 'new_016']);
  const [hotelId, setHotelId] = useState<string>(savedInput?.hotel_id ?? '');
  const [startDate, setStartDate] = useState<string>(savedInput?.start_date ?? '2026-11-07');
  const [days, setDays] = useState<number>(urlDays ?? savedInput?.days ?? 2);
  const [people, setPeople] = useState<number>(urlPeople ?? savedInput?.people ?? 2);
  const [budgetVnd, setBudgetVnd] = useState<number>(urlBudget ?? savedInput?.budget_vnd ?? 2000000);
  const [transport, setTransport] = useState<V9TransportMode>(savedInput?.mode_of_transport ?? 'car');
  const [dailyStart, setDailyStart] = useState<string>(savedInput?.daily_start ?? '08:00');
  const [dailyEnd, setDailyEnd] = useState<string>(savedInput?.daily_end ?? '20:00');
  const [pace, setPace] = useState<V9Pace>(savedInput?.pace ?? 'balanced');
  const [interests, setInterests] = useState<string[]>(savedInput?.interests ?? ['du lịch sinh thái', 'chụp ảnh']);
  const [travelBufferMinutes, setTravelBufferMinutes] = useState<number>(savedInput?.travel_buffer_minutes ?? 5);
  const [sleepMinutes, setSleepMinutes] = useState<number>(savedInput?.sleep_minutes ?? 540);
  const [nearbyMaxMinutes, setNearbyMaxMinutes] = useState<number>(savedInput?.nearby_max_minutes ?? 30);
  const [includeBreakfast, setIncludeBreakfast] = useState<boolean>(savedInput?.include_breakfast ?? true);
  const [useModel, setUseModel] = useState<boolean>(savedInput?.use_model ?? true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [recommendingOnly, setRecommendingOnly] = useState(false);
  const [recommendationsOnlyResult, setRecommendationsOnlyResult] = useState<V9PlanResponse | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  // Stop Swap & Route Inconvenience Warning Modal States
  const [manualSwapStep, setManualSwapStep] = useState<{ dayNumber: number; step: V9ActivityStep } | null>(null);
  const [swapConfirmation, setSwapConfirmation] = useState<SwapConfirmationState | null>(null);

  useEffect(() => {
    if (urlDays && urlDays !== days) setDays(urlDays);
    if (urlPeople && urlPeople !== people) setPeople(urlPeople);
    if (urlBudget && urlBudget !== budgetVnd) setBudgetVnd(urlBudget);
    if (urlGoal && urlGoal !== goal) setGoal(urlGoal);
  }, [urlDays, urlPeople, urlBudget, urlGoal]);

  const scrollToPlan = useCallback(
    () =>
      window.requestAnimationFrame(() =>
        document.getElementById('plan')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      ),
    [],
  );

  // Reliable Auto-Planning triggered by Pé Meko (Requirement #1)
  const lastAutoRunRef = useRef<string | null>(null);
  useEffect(() => {
    if (!autoPlan || lastAutoRunRef.current === urlRun) return;
    lastAutoRunRef.current = urlRun;

    const effectiveDays = urlDays ?? days ?? 2;
    const effectivePeople = urlPeople ?? people ?? 2;
    const effectiveBudget = urlBudget ?? budgetVnd ?? 2000000;
    const effectiveGoal = urlGoal ?? goal ?? 'sightseeing';

    setDays(effectiveDays);
    setPeople(effectivePeople);
    setBudgetVnd(effectiveBudget);
    setGoal(effectiveGoal);
    setMode('ai');

    const runAutoPlan = async () => {
      setGenerating(true);
      setRecommendationsOnlyResult(null);
      scrollToPlan();
      try {
        const payload: V9PlanRequest = {
          mode: 'ai',
          goal: effectiveGoal,
          start_id: startId || 'new_003',
          start_date: startDate,
          days: effectiveDays,
          people: effectivePeople,
          budget_vnd: effectiveBudget,
          interests,
          mode_of_transport: transport,
          nearby_max_minutes: Number(nearbyMaxMinutes) || 30,
          daily_start: dailyStart,
          daily_end: dailyEnd,
          pace,
          travel_buffer_minutes: Number(travelBufferMinutes) || 5,
          sleep_minutes: Number(sleepMinutes) || 540,
          include_breakfast: includeBreakfast,
          use_model: useModel,
          assemble_itinerary: true,
        };
        const res = await api.post<V9PlanResponse>('/trip-planner/itinerary', payload);
        if (res.data.itinerary) {
          useItineraryDraft.getState().setV9Plan(res.data, res.data.itinerary);
          toast.success(
            '🦊 Pé Meko đã tự động lập lịch trình!',
            `${res.data.itinerary.scheduled_primary_ids?.length ?? 0} điểm chính trong ${res.data.itinerary.days.length} ngày.`,
          );
          setTimeout(() => scrollToPlan(), 150);
        }
      } catch (error) {
        toast.error('Không tạo được lịch trình', toApiError(error).message);
      } finally {
        setGenerating(false);
      }
    };

    void runAutoPlan();
  }, [autoPlan, urlRun]);

  // Evaluate route convenience & open Swap Confirmation Modal (Requirement #2)
  const evaluateAndOpenSwapModal = useCallback(
    (
      itineraryObj: V9ItineraryObject,
      dayNumber: number,
      targetStopQuery: string,
      newDest: SwapDestinationCandidate,
      explicitStopId?: string,
    ) => {
      const targetDay = itineraryObj.days.find((d) => d.day === dayNumber) ?? itineraryObj.days[0];
      if (!targetDay) return;

      const normQuery = stripViAccents(targetStopQuery);
      const actionableStops = targetDay.activities.filter((s) => Boolean(s.stop_id));

      let matchedStep = explicitStopId
        ? actionableStops.find((s) => s.stop_id === explicitStopId)
        : actionableStops.find((s) => {
            const normName = stripViAccents(s.name);
            return normName.includes(normQuery) || normQuery.includes(normName);
          });

      // Fallback to first visit stop in the target day if fuzzy match didn't hit exact name
      if (!matchedStep) {
        matchedStep = actionableStops.find((s) => s.type === 'visit') ?? actionableStops[0];
      }
      if (!matchedStep || !matchedStep.stop_id) return;

      // Determine reference coordinates in that day (other stops or default My Tho / Thoi Son cluster)
      const otherStopWithCoords = actionableStops.find(
        (s) => s.stop_id !== matchedStep!.stop_id && typeof s.latitude === 'number' && typeof s.longitude === 'number',
      );
      const refLat = otherStopWithCoords?.latitude ?? matchedStep.latitude ?? 10.354;
      const refLon = otherStopWithCoords?.longitude ?? matchedStep.longitude ?? 106.362;

      const extraDistanceKm = haversineRoadKm(
        refLat,
        refLon,
        newDest.coordinates.lat,
        newDest.coordinates.lng,
      );
      const extraTravelMinutes = Math.max(15, Math.round(extraDistanceKm * 1.35));
      const isInconvenient = extraDistanceKm >= 12;
      const suggestedNextDay =
        itineraryObj.days.length > dayNumber ? dayNumber + 1 : Math.min(7, itineraryObj.days.length + 1);

      setSwapConfirmation({
        dayNumber: targetDay.day,
        targetStopId: matchedStep.stop_id,
        targetStopName: matchedStep.name,
        targetStopWindow: `${matchedStep.start} – ${matchedStep.end}`,
        newDestination: newDest,
        extraDistanceKm,
        extraTravelMinutes,
        isInconvenient,
        suggestedNextDay,
      });
      scrollToPlan();
    },
    [scrollToPlan],
  );

  // Listen for Pé Meko SWAP_ITINERARY_STOP commands
  useEffect(() => {
    const processSwapPayload = async (payload: {
      dayNumber?: number;
      targetStopName?: string;
      newDestination?: SwapDestinationCandidate;
    }) => {
      if (!payload?.newDestination) return;
      const dayNum = payload.dayNumber || 1;
      const targetName = payload.targetStopName || 'Trà mật ong Kỳ Lân';
      const newDest: SwapDestinationCandidate = {
        name: payload.newDestination.name,
        slug: payload.newDestination.slug,
        area: payload.newDestination.area || 'Đồng Tháp',
        summary: payload.newDestination.summary,
        coordinates: payload.newDestination.coordinates || { lat: 10.4562, lng: 105.6324 },
      };

      let currentItinerary = useItineraryDraft.getState().v9Itinerary;
      // If user hasn't generated an itinerary yet, Pé Meko automatically generates a 2-day plan first!
      if (!currentItinerary) {
        setGenerating(true);
        try {
          const res = await api.post<V9PlanResponse>('/trip-planner/itinerary', {
            mode: 'ai',
            goal: 'sightseeing',
            start_id: 'new_003',
            start_date: startDate,
            days: 2,
            people: 2,
            budget_vnd: 2000000,
            interests: ['du lịch sinh thái', 'chụp ảnh'],
            mode_of_transport: 'car',
            nearby_max_minutes: 30,
            daily_start: '08:00',
            daily_end: '20:00',
            pace: 'balanced',
            travel_buffer_minutes: 5,
            sleep_minutes: 540,
            include_breakfast: true,
            use_model: true,
            assemble_itinerary: true,
          });
          if (res.data.itinerary) {
            useItineraryDraft.getState().setV9Plan(res.data, res.data.itinerary);
            currentItinerary = res.data.itinerary;
          }
        } catch {
          // ignore
        } finally {
          setGenerating(false);
        }
      }

      if (currentItinerary) {
        evaluateAndOpenSwapModal(currentItinerary, dayNum, targetName, newDest);
      }
    };

    // Check if there is a pending swap stored in sessionStorage on page navigation
    const pendingRaw = sessionStorage.getItem('pe_meko_pending_swap');
    if (pendingRaw) {
      sessionStorage.removeItem('pe_meko_pending_swap');
      try {
        const parsed = JSON.parse(pendingRaw);
        void processSwapPayload(parsed);
      } catch {
        // ignore
      }
    }

    const handleCustomSwapEvent = (evt: Event) => {
      const customEvt = evt as CustomEvent;
      if (customEvt.detail) {
        sessionStorage.removeItem('pe_meko_pending_swap');
        void processSwapPayload(customEvt.detail);
      }
    };

    window.addEventListener('pe-meko:swap-stop', handleCustomSwapEvent);
    return () => window.removeEventListener('pe-meko:swap-stop', handleCustomSwapEvent);
  }, [evaluateAndOpenSwapModal, startDate]);

  // Execute choice 1: Force swap into current requested day (e.g. Day 1)
  const handleConfirmForceSwapInCurrentDay = () => {
    if (!swapConfirmation || !draft.v9Itinerary) return;
    const next: V9ItineraryObject = JSON.parse(JSON.stringify(draft.v9Itinerary));
    const targetDay = next.days.find((d) => d.day === swapConfirmation.dayNumber);
    if (!targetDay) return;

    const stepIdx = targetDay.activities.findIndex((s) => s.stop_id === swapConfirmation.targetStopId);
    if (stepIdx !== -1) {
      const step = targetDay.activities[stepIdx]!;
      step.name = swapConfirmation.newDestination.name;
      step.place_id = swapConfirmation.newDestination.slug;
      step.latitude = swapConfirmation.newDestination.coordinates.lat;
      step.longitude = swapConfirmation.newDestination.coordinates.lng;
      step.note = `🦊 Đã đổi từ "${swapConfirmation.targetStopName}" theo xác nhận của bạn (+${swapConfirmation.extraDistanceKm} km · ~${swapConfirmation.extraTravelMinutes} phút di chuyển tới ${swapConfirmation.newDestination.area}).`;

      // Update preceding travel step if present
      if (stepIdx > 0 && targetDay.activities[stepIdx - 1]?.type === 'travel') {
        const travelStep = targetDay.activities[stepIdx - 1]!;
        travelStep.distance_km = swapConfirmation.extraDistanceKm;
        travelStep.route_duration_minutes = swapConfirmation.extraTravelMinutes;
        travelStep.name = `Di chuyển tới ${swapConfirmation.newDestination.name} (${swapConfirmation.newDestination.area})`;
      }
    }

    if (next.cost_summary) {
      next.cost_summary.road_distance_km =
        Math.round(((next.cost_summary.road_distance_km ?? 0) + swapConfirmation.extraDistanceKm) * 10) / 10;
    }

    draft.setV9Itinerary(next);
    toast.success(
      `Đã đổi thành "${swapConfirmation.newDestination.name}" vào Ngày ${swapConfirmation.dayNumber}`,
      `Quãng đường cộng thêm ~${swapConfirmation.extraDistanceKm} km (+${swapConfirmation.extraTravelMinutes} phút).`,
    );
    window.dispatchEvent(
      new CustomEvent('pe-meko:bot-notice', {
        detail: {
          text: `✅ **Pé Meko đã cập nhật lộ trình!**\nĐã đổi **${swapConfirmation.targetStopName}** thành **${swapConfirmation.newDestination.name}** ngay trong **Ngày ${swapConfirmation.dayNumber}** theo xác nhận của bạn (+${swapConfirmation.extraDistanceKm} km di chuyển).`,
        },
      }),
    );
    setSwapConfirmation(null);
  };

  // Execute choice 2: Schedule the new stop into the next day (e.g. Day 2) for convenient routing
  const handleConfirmScheduleNextDay = () => {
    if (!swapConfirmation || !draft.v9Itinerary) return;
    const next: V9ItineraryObject = JSON.parse(JSON.stringify(draft.v9Itinerary));
    const nextDayNum = swapConfirmation.suggestedNextDay;

    let nextDay = next.days.find((d) => d.day === nextDayNum);
    if (!nextDay) {
      const prevDate = next.days[next.days.length - 1]?.date || startDate;
      const createdDay = {
        day: nextDayNum,
        date: prevDate,
        status: 'ok' as const,
        visit_count: 1,
        start_place_id: startId || 'new_003',
        planned_end_place_id: startId || 'new_003',
        actual_end_place_id: startId || 'new_003',
        overnight_stay: null,
        activities: [] as V9ActivityStep[],
      };
      next.days.push(createdDay);
      nextDay = createdDay;
    }

    // Replace first afternoon visit in Day 2 or append a clean morning/afternoon slot in Day 2
    const existingVisitIdx = nextDay.activities.findIndex((s) => s.type === 'visit');
    const newStopStep: V9ActivityStep = {
      stop_id: `meko-swap-d${nextDayNum}-${Date.now()}`,
      type: 'visit',
      status: 'pending',
      place_id: swapConfirmation.newDestination.slug,
      name: swapConfirmation.newDestination.name,
      start: '09:00',
      end: '10:45',
      duration_minutes: 105,
      latitude: swapConfirmation.newDestination.coordinates.lat,
      longitude: swapConfirmation.newDestination.coordinates.lng,
      google_rating: 4.7,
      google_review_count: 420,
      note: `🦊 Pé Meko đã sắp xếp vào Ngày ${nextDayNum} (${swapConfirmation.newDestination.area}) để tối ưu lộ trình di chuyển và giữ nguyên "${swapConfirmation.targetStopName}" ở Ngày ${swapConfirmation.dayNumber}.`,
    };

    if (existingVisitIdx !== -1) {
      const targetSlot = nextDay.activities[existingVisitIdx]!;
      newStopStep.start = targetSlot.start;
      newStopStep.end = targetSlot.end;
      nextDay.activities[existingVisitIdx] = newStopStep;
    } else {
      nextDay.activities.push(newStopStep);
      nextDay.visit_count = (nextDay.visit_count || 0) + 1;
    }

    draft.setV9Itinerary(next);
    toast.success(
      `Đã xếp "${swapConfirmation.newDestination.name}" sang Ngày ${nextDayNum}!`,
      `Giữ nguyên "${swapConfirmation.targetStopName}" ở Ngày ${swapConfirmation.dayNumber} để tránh phải đi vòng xa.`,
    );
    window.dispatchEvent(
      new CustomEvent('pe-meko:bot-notice', {
        detail: {
          text: `🎉 **Tuyệt vời! Pé Meko đã tối ưu lộ trình cho bạn:**\n• Giữ nguyên **${swapConfirmation.targetStopName}** ở **Ngày ${swapConfirmation.dayNumber}** để đi lại thuận tiện.\n• Sắp xếp **${swapConfirmation.newDestination.name}** vào **Ngày ${nextDayNum}** cực kỳ hợp lý!`,
        },
      }),
    );
    setSwapConfirmation(null);
  };

  const toggleInterest = (tag: string, on: boolean) => {
    setInterests((prev) => (on ? [...new Set([...prev, tag])] : prev.filter((item) => item !== tag)));
  };

  const toggleSelectedPlace = (placeId: string) => {
    setSelectedIds((prev) => (prev.includes(placeId) ? prev.filter((id) => id !== placeId) : [...prev, placeId]));
  };

  const moveSelectedPlace = (index: number, delta: -1 | 1) => {
    setSelectedIds((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(index, 1);
      if (item !== undefined) next.splice(target, 0, item);
      return next;
    });
  };

  const buildRequestPayload = (assembleItinerary: boolean): V9PlanRequest => {
    const payload: V9PlanRequest = {
      mode,
      goal,
      start_id: startId || 'new_003',
      start_date: startDate,
      days: Number(days) || 1,
      people: Number(people) || 2,
      budget_vnd: Number(budgetVnd) || 2000000,
      interests,
      mode_of_transport: transport,
      nearby_max_minutes: Number(nearbyMaxMinutes) || 30,
      daily_start: dailyStart,
      daily_end: dailyEnd,
      pace,
      travel_buffer_minutes: Number(travelBufferMinutes) || 5,
      sleep_minutes: Number(sleepMinutes) || 540,
      include_breakfast: includeBreakfast,
      use_model: useModel,
      assemble_itinerary: assembleItinerary,
    };
    if (mode === 'manual') {
      payload.selected_ids = selectedIds;
    }
    if (hotelId && Number(days) > 1) {
      payload.hotel_id = hotelId;
    }
    return payload;
  };

  const handleGenerateItinerary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'manual' && selectedIds.length === 0) {
      toast.error('Chưa chọn địa điểm', 'Chế độ chọn tay cần chọn ít nhất 1 địa điểm.');
      return;
    }
    setGenerating(true);
    setRecommendationsOnlyResult(null);
    scrollToPlan();
    try {
      const payload = buildRequestPayload(true);
      const res = await api.post<V9PlanResponse>('/trip-planner/itinerary', payload);
      if (res.data.itinerary) {
        draft.setV9Plan(res.data, res.data.itinerary);
        toast.success(
          'Đã lập lịch trình thành công',
          `${res.data.itinerary.scheduled_primary_ids?.length ?? 0} điểm chính trong ${res.data.itinerary.days.length} ngày.`,
        );
        scrollToPlan();
      }
    } catch (error) {
      toast.error('Không tạo được lịch trình', toApiError(error).message);
    } finally {
      setGenerating(false);
    }
  };

  const handleRecommendOnly = async () => {
    if (mode === 'manual' && selectedIds.length === 0) {
      toast.error('Chưa chọn địa điểm', 'Chế độ chọn tay cần chọn ít nhất 1 địa điểm.');
      return;
    }
    setRecommendingOnly(true);
    try {
      const payload = buildRequestPayload(false);
      const res = await api.post<V9PlanResponse>('/trip-planner/recommend', payload);
      setRecommendationsOnlyResult(res.data);
      toast.info('Đã lấy danh sách gợi ý', `Tìm thấy ${res.data.primary_places.length} địa điểm phù hợp.`);
      window.requestAnimationFrame(() =>
        document.getElementById('recommendations')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      );
    } catch (error) {
      toast.error('Không lấy được gợi ý', toApiError(error).message);
    } finally {
      setRecommendingOnly(false);
    }
  };

  const handleSaveToAccount = async () => {
    if (!user || !draft.v9Itinerary) return;
    setSaving(true);
    try {
      const res = await api.post<{ itinerary: SavedItinerary }>('/itineraries', {
        title: draft.title.trim() || 'Hành trình Mỹ Tho – Thới Sơn',
        v9Itinerary: draft.v9Itinerary,
        v9Meta: draft.v9Response
          ? {
              mode: draft.v9Response.mode,
              goal: draft.v9Response.goal,
              primary_places: draft.v9Response.primary_places,
              budget_alternative: draft.v9Response.budget_alternative,
              warnings: draft.v9Response.warnings,
            }
          : undefined,
      });
      toast.success('Đã lưu lịch trình vào tài khoản');
      draft.clear();
      navigate(`/itinerary/${res.data.itinerary.id}`);
    } catch (error) {
      toast.error('Không lưu được lịch trình', toApiError(error).message);
    } finally {
      setSaving(false);
    }
  };

  const hasV9Plan = Boolean(draft.v9Itinerary);
  const startPlace = placesById.get(startId);
  const goalLabel = GOAL_OPTIONS.find((g) => g.value === goal)?.label ?? goal;
  const serviceOnline = placesQuery.data?.serviceOnline;

  return (
    <PageContainer>
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="tp-fade-up relative overflow-hidden rounded-panel bg-gradient-to-br from-leaf-900 via-leaf-800 to-leaf-600 px-6 py-8 text-white shadow-raised sm:px-10 sm:py-10">
        <div className="pointer-events-none absolute -right-10 -top-24 size-72 rounded-full bg-lotus-300/25 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-24 left-10 size-72 rounded-full bg-leaf-300/25 blur-3xl" aria-hidden />
        <div className="relative grid items-center gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold ring-1 ring-white/20">
              <Sparkles className="size-3.5 text-teal-200" aria-hidden />
              Trip Planner V9 · AI du lịch
            </span>
            <h1 className="mt-4 text-3xl text-white sm:text-[2.6rem] sm:leading-[1.1]">
              Lập lịch trình Mỹ Tho – Thới Sơn chỉ trong vài giây
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-leaf-100 sm:text-base">
              AI chọn điểm đến theo sở thích, tính thời gian chạy xe thực tế, xếp bữa ăn, khách sạn và cân đối ngân sách — bạn chỉ cần
              chọn vài thông tin bên dưới.
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 ring-1 ring-white/15">
                <MapPin className="size-3.5" aria-hidden /> {places.length || 17} địa điểm dữ liệu
              </span>
              {placesQuery.data && (
                <span
                  className={clsx(
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ring-1',
                    serviceOnline ? 'bg-leaf-300/20 ring-leaf-200/40' : 'bg-lotus-300/20 ring-lotus-200/40',
                  )}
                >
                  <span className={clsx('size-2 rounded-full', serviceOnline ? 'tp-pulse-ring bg-leaf-300' : 'bg-lotus-300')} aria-hidden />
                  {serviceOnline ? 'Dịch vụ AI đang hoạt động' : 'Dịch vụ AI đang tắt — dùng danh mục tĩnh'}
                </span>
              )}
            </div>
          </div>
          <div className="hidden lg:block" aria-hidden>
            <div className="tp-float relative mx-auto w-full max-w-xs rounded-3xl bg-white/10 p-5 ring-1 ring-white/20 backdrop-blur">
              {[
                { icon: Landmark, label: 'Trại rắn Đồng Tâm', time: '09:00' },
                { icon: UtensilsCrossed, label: 'Ăn trưa đặc sản', time: '12:00' },
                { icon: Compass, label: 'KDL Thới Sơn', time: '13:30' },
                { icon: Hotel, label: 'Nghỉ đêm Mỹ Tho', time: '19:00' },
              ].map((row, i) => (
                <div key={row.label} className="flex items-center gap-3 py-2">
                  <span className="grid size-9 place-items-center rounded-xl bg-white/15">
                    <row.icon className="size-4" />
                  </span>
                  <span className="flex-1 text-sm font-medium">{row.label}</span>
                  <span className="text-xs text-leaf-100">{row.time}</span>
                  {i < 3 && <span className="absolute left-[2.35rem] mt-12 h-3 w-px bg-white/30" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Planner form ─────────────────────────────────────────── */}
      <form id="itinerary-form" onSubmit={handleGenerateItinerary} noValidate className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {/* Step 1 */}
          <section className="tp-fade-up rounded-panel bg-white p-5 shadow-card ring-1 ring-sand-200 sm:p-7">
            <StepHeader step={1} title="Bạn muốn lập lịch thế nào?" description="Để AI tự gợi ý hoặc tự chọn các điểm muốn đến." />
            <div className="grid gap-3 sm:grid-cols-2">
              <OptionCard
                selected={mode === 'ai'}
                onClick={() => setMode('ai')}
                icon={<Wand2 className="size-5" aria-hidden />}
                title="AI gợi ý tự động"
                description="Tự chọn và xếp hạng điểm đến theo mục đích, sở thích, thời gian chạy xe và điểm đánh giá."
              />
              <OptionCard
                selected={mode === 'manual'}
                onClick={() => setMode('manual')}
                icon={<ListChecks className="size-5" aria-hidden />}
                title="Tự chọn địa điểm"
                description="Giữ đúng danh sách và thứ tự bạn chọn, AI tự ráp giờ chạy xe và bữa ăn."
                accent="teal"
              />
            </div>

            <p className="mb-2 mt-6 text-sm font-semibold text-river-800">Mục đích chính của chuyến đi</p>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
              {GOAL_OPTIONS.map((opt) => (
                <OptionCard
                  key={opt.value}
                  compact
                  selected={goal === opt.value}
                  onClick={() => setGoal(opt.value)}
                  icon={<opt.icon className="size-4" aria-hidden />}
                  title={opt.label}
                  description={opt.description}
                  accent={opt.accent}
                />
              ))}
            </div>

            {mode === 'manual' && (
              <div className="tp-fade-up mt-6 rounded-2xl border border-teal-200 bg-gradient-to-br from-teal-50/60 to-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-river-900 sm:text-base">Chọn địa điểm & sắp xếp thứ tự</h3>
                    <p className="text-xs text-river-500">Lịch sẽ ráp đúng thứ tự bên dưới và báo rõ nếu có điểm không kịp giờ.</p>
                  </div>
                  <span className="rounded-full bg-teal-500 px-3 py-1 text-xs font-bold text-white">Đã chọn {selectedIds.length}</span>
                </div>

                {selectedIds.length > 0 && (
                  <ol className="mt-3 space-y-2">
                    {selectedIds.map((id, idx) => {
                      const p = placesById.get(id);
                      const meta = roleMeta(p?.role);
                      return (
                        <li
                          key={id}
                          className="tp-fade-up flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 text-sm shadow-card ring-1 ring-sand-200"
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-leaf-600 text-xs font-bold text-white">
                              {idx + 1}
                            </span>
                            <span className={clsx('grid size-7 shrink-0 place-items-center rounded-lg', meta.bubble)}>
                              <meta.Icon className="size-3.5" aria-hidden />
                            </span>
                            <span className="truncate font-semibold text-river-900">{p?.name ?? id}</span>
                          </div>
                          <div className="flex shrink-0 items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => moveSelectedPlace(idx, -1)}
                              disabled={idx === 0}
                              className="rounded-full p-1.5 text-river-500 transition hover:bg-leaf-50 hover:text-leaf-700 disabled:opacity-30"
                              title="Lên trước"
                            >
                              <ArrowUp className="size-4" aria-hidden />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveSelectedPlace(idx, 1)}
                              disabled={idx === selectedIds.length - 1}
                              className="rounded-full p-1.5 text-river-500 transition hover:bg-leaf-50 hover:text-leaf-700 disabled:opacity-30"
                              title="Xuống sau"
                            >
                              <ArrowDown className="size-4" aria-hidden />
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleSelectedPlace(id)}
                              className="rounded-full p-1.5 text-river-400 transition hover:bg-red-50 hover:text-red-600"
                              title="Bỏ chọn"
                            >
                              <X className="size-4" aria-hidden />
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {places.map((p) => {
                    const isSelected = selectedIds.includes(p.id);
                    const meta = roleMeta(p.role);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => toggleSelectedPlace(p.id)}
                        aria-pressed={isSelected}
                        className={clsx(
                          'flex items-center gap-3 rounded-xl border p-2.5 text-left transition-all duration-200',
                          isSelected
                            ? 'border-leaf-500 bg-leaf-50 shadow-card'
                            : 'border-sand-200 bg-white hover:-translate-y-0.5 hover:border-leaf-300 hover:shadow-card',
                        )}
                      >
                        <span className={clsx('grid size-9 shrink-0 place-items-center rounded-lg', isSelected ? 'bg-leaf-600 text-white' : meta.bubble)}>
                          <meta.Icon className="size-4" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-river-900">{p.name}</span>
                          <span className="flex items-center gap-1 text-[11px] text-river-500">
                            {meta.short}
                            {p.google_rating ? (
                              <>
                                <span aria-hidden>·</span>
                                <Star className="size-3 fill-amber-400 text-amber-400" aria-hidden />
                                {p.google_rating}
                              </>
                            ) : null}
                          </span>
                        </span>
                        {isSelected && (
                          <span className="grid size-6 place-items-center rounded-full bg-leaf-600 text-[11px] font-bold text-white">
                            {selectedIds.indexOf(p.id) + 1}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {/* Step 2 */}
          <section className="tp-fade-up rounded-panel bg-white p-5 shadow-card ring-1 ring-sand-200 sm:p-7" style={{ animationDelay: '80ms' }}>
            <StepHeader step={2} title="Thời gian, nhóm & ngân sách" description="Thông tin cơ bản để AI tính lịch phù hợp." />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Điểm xuất phát" required>
                <Select value={startId} onChange={(e) => setStartId(e.target.value)}>
                  {places.length > 0 ? (
                    [...placesByRole.entries()].map(([role, items]) => (
                      <optgroup key={role} label={roleMeta(role).label}>
                        {items.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </optgroup>
                    ))
                  ) : (
                    <option value="new_003">Khách sạn Mekong Mỹ Tho</option>
                  )}
                </Select>
              </FormField>
              <FormField label="Ngày khởi hành" required>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
              </FormField>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Stepper label="Số ngày" value={days} onChange={setDays} min={1} max={7} suffix="ngày" icon={<CalendarDays className="size-3.5" aria-hidden />} />
              <Stepper label="Số khách" value={people} onChange={setPeople} min={1} max={100} suffix="người" icon={<Users className="size-3.5" aria-hidden />} />
            </div>

            <div className="mt-4 rounded-2xl border border-sand-200 bg-sand-50/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-xs font-medium text-river-500">
                  <Wallet className="size-3.5" aria-hidden /> Ngân sách cả nhóm
                </p>
                <p className="text-xs text-river-500">
                  ≈ <strong className="text-river-800">{formatVnd(Math.round(budgetVnd / Math.max(1, people)))}</strong> / người
                </p>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Input
                  type="number"
                  min={100000}
                  step={100000}
                  value={budgetVnd}
                  aria-label="Ngân sách cả nhóm (VNĐ)"
                  onChange={(e) => setBudgetVnd(Math.max(1000, Number(e.target.value) || 1000000))}
                  className="bg-white text-lg font-bold"
                />
                <span className="text-sm font-semibold text-river-500">₫</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {BUDGET_PRESETS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setBudgetVnd(v)}
                    className={clsx(
                      'rounded-full px-3 py-1 text-xs font-semibold transition-all',
                      budgetVnd === v ? 'bg-leaf-600 text-white shadow-cta' : 'bg-white text-river-600 ring-1 ring-sand-200 hover:ring-leaf-300',
                    )}
                  >
                    {(v / 1_000_000).toLocaleString('vi-VN')} triệu
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-1.5 text-sm font-medium text-river-800">Phương tiện</p>
                <Segmented<V9TransportMode>
                  ariaLabel="Phương tiện"
                  value={transport}
                  onChange={setTransport}
                  options={[
                    { value: 'car', label: 'Ô tô', icon: <Car className="size-4" aria-hidden /> },
                    { value: 'motorcycle', label: 'Xe máy', icon: <Bike className="size-4" aria-hidden /> },
                  ]}
                />
              </div>
              <div>
                <p className="mb-1.5 text-sm font-medium text-river-800">Nhịp độ</p>
                <Segmented<V9Pace>
                  ariaLabel="Nhịp độ"
                  value={pace}
                  onChange={setPace}
                  options={[
                    { value: 'relaxed', label: 'Thong thả' },
                    { value: 'balanced', label: 'Cân bằng' },
                    { value: 'busy', label: 'Dày đặc' },
                  ]}
                />
                <p className="mt-1.5 text-xs text-river-500">{PACE_HINT[pace]}</p>
              </div>
            </div>

            <div className="mt-4">
              <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-river-800">
                <Clock className="size-4 text-river-500" aria-hidden /> Khung giờ hoạt động mỗi ngày
              </p>
              <div className="grid grid-cols-2 gap-2 sm:max-w-sm">
                <Input type="time" aria-label="Giờ bắt đầu trong ngày" value={dailyStart} onChange={(e) => setDailyStart(e.target.value)} />
                <Input type="time" aria-label="Giờ kết thúc trong ngày" value={dailyEnd} onChange={(e) => setDailyEnd(e.target.value)} />
              </div>
            </div>
          </section>

          {/* Step 3 */}
          <section className="tp-fade-up rounded-panel bg-white p-5 shadow-card ring-1 ring-sand-200 sm:p-7" style={{ animationDelay: '160ms' }}>
            <StepHeader
              step={3}
              title="Sở thích của bạn"
              description="Chọn những gì bạn thích, AI sẽ ưu tiên các điểm phù hợp."
              action={
                <span className="rounded-full bg-leaf-50 px-3 py-1 text-xs font-semibold text-leaf-800 ring-1 ring-leaf-200">
                  {interests.length} đã chọn
                </span>
              }
            />
            <div className="flex flex-wrap gap-2">
              {V9_INTEREST_OPTIONS.map((tag) => (
                <ChipToggle key={tag} checked={interests.includes(tag)} onChange={(on) => toggleInterest(tag, on)}>
                  {tag}
                </ChipToggle>
              ))}
            </div>

            <div className="mt-6 border-t border-sand-200 pt-4">
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                aria-expanded={showAdvanced}
                className="flex w-full items-center justify-between text-sm font-semibold text-river-700 hover:text-leaf-700"
              >
                Tùy chọn nâng cao
                <ChevronDown className={clsx('size-4 transition-transform duration-200', showAdvanced && 'rotate-180')} aria-hidden />
              </button>
              {showAdvanced && (
                <div className="tp-fade-up mt-4 grid gap-4 sm:grid-cols-2">
                  <FormField label="Phút dự phòng mỗi chặng" hint="Mặc định 5 phút.">
                    <Input type="number" min={0} max={60} value={travelBufferMinutes} onChange={(e) => setTravelBufferMinutes(Number(e.target.value) || 0)} />
                  </FormField>
                  <FormField label="Thời gian ngủ mỗi đêm (phút)" hint="480–600 phút (mặc định 9 tiếng).">
                    <Input
                      type="number"
                      min={480}
                      max={600}
                      value={sleepMinutes}
                      onChange={(e) => setSleepMinutes(Math.min(600, Math.max(480, Number(e.target.value) || 540)))}
                    />
                  </FormField>
                  <FormField label="Giới hạn mỗi chặng đường (phút)" hint="Mặc định 30 phút chạy xe.">
                    <Input type="number" min={5} max={240} value={nearbyMaxMinutes} onChange={(e) => setNearbyMaxMinutes(Number(e.target.value) || 30)} />
                  </FormField>
                  {days > 1 && (
                    <FormField label="Khách sạn chung">
                      <Select value={hotelId} onChange={(e) => setHotelId(e.target.value)}>
                        <option value="">Để AI tự chọn khách sạn tối ưu</option>
                        {hotels.map((h) => (
                          <option key={h.id} value={h.id}>
                            {h.name}
                          </option>
                        ))}
                      </Select>
                    </FormField>
                  )}
                  <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-sand-50 p-3 text-sm text-river-800">
                    <input
                      type="checkbox"
                      checked={includeBreakfast}
                      onChange={(e) => setIncludeBreakfast(e.target.checked)}
                      className="size-4 rounded border-sand-300 accent-leaf-600"
                    />
                    Xếp bữa sáng (08:00–10:00)
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-sand-50 p-3 text-sm text-river-800">
                    <input
                      type="checkbox"
                      checked={useModel}
                      onChange={(e) => setUseModel(e.target.checked)}
                      className="size-4 rounded border-sand-300 accent-leaf-600"
                    />
                    Dùng mô hình học máy hỗ trợ xếp hạng
                  </label>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* ── Sticky summary sidebar ─────────────────────────────── */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="tp-fade-up overflow-hidden rounded-panel bg-white shadow-raised ring-1 ring-sand-200" style={{ animationDelay: '120ms' }}>
            <div className="bg-gradient-to-br from-leaf-50 to-white px-5 pb-4 pt-5">
              <p className="eyebrow">Tóm tắt chuyến đi</p>
              <p className="mt-2 text-lg font-extrabold text-river-900">
                {days} ngày · {people} khách
              </p>
              <p className="text-sm text-river-500">{mode === 'ai' ? 'AI gợi ý' : `Tự chọn ${selectedIds.length} điểm`} · {goalLabel}</p>
            </div>
            <dl className="space-y-2.5 px-5 py-4 text-sm">
              {[
                { icon: MapPin, label: 'Xuất phát', value: startPlace?.name ?? '—' },
                { icon: CalendarDays, label: 'Khởi hành', value: startDate.split('-').reverse().join('/') },
                { icon: Wallet, label: 'Ngân sách', value: formatVnd(budgetVnd) },
                { icon: transport === 'car' ? Car : Bike, label: 'Phương tiện', value: transport === 'car' ? 'Ô tô' : 'Xe máy' },
                { icon: Clock, label: 'Khung giờ', value: `${dailyStart} – ${dailyEnd}` },
              ].map((row) => (
                <div key={row.label} className="flex items-start justify-between gap-3">
                  <dt className="flex items-center gap-2 text-river-500">
                    <row.icon className="size-4" aria-hidden />
                    {row.label}
                  </dt>
                  <dd className="text-right font-semibold text-river-900">{row.value}</dd>
                </div>
              ))}
            </dl>
            <div className="space-y-2 border-t border-sand-200 p-5">
              <Button
                type="submit"
                size="lg"
                loading={generating}
                className="relative w-full overflow-hidden"
                icon={hasV9Plan ? <RefreshCw className="size-5" aria-hidden /> : <Sparkles className="size-5" aria-hidden />}
              >
                {!generating && <span className="tp-shimmer pointer-events-none absolute inset-0" aria-hidden />}
                {generating ? 'Đang lập lịch…' : hasV9Plan ? 'Tạo lại lịch trình' : 'Lập lịch trình ngay'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                loading={recommendingOnly}
                onClick={handleRecommendOnly}
                icon={<Compass className="size-4" aria-hidden />}
              >
                Chỉ lấy gợi ý địa điểm
              </Button>
              <p className="pt-1 text-center text-[11px] leading-snug text-river-400">
                Lịch dự kiến, chưa đặt dịch vụ. Hãy gọi xác nhận giá và giờ mở cửa trước khi đi.
              </p>
            </div>
          </div>
        </aside>
      </form>

      {/* ── Recommendations-only preview ─────────────────────────── */}
      {recommendationsOnlyResult && (
        <section id="recommendations" className="tp-fade-up mt-10 scroll-mt-24">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="eyebrow">Gợi ý từ AI</p>
              <h2 className="mt-1 text-2xl">Danh sách gợi ý địa điểm ({recommendationsOnlyResult.primary_places.length} điểm)</h2>
            </div>
            <button
              type="button"
              onClick={() => setRecommendationsOnlyResult(null)}
              className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-semibold text-river-500 hover:bg-sand-100"
            >
              <X className="size-4" aria-hidden /> Đóng
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recommendationsOnlyResult.primary_places.map((p, i) => {
              const meta = roleMeta(p.role);
              const reason = formatV9RankingReason(p);
              return (
                <article
                  key={p.id}
                  className="tp-fade-up rounded-card bg-white p-4 shadow-card ring-1 ring-sand-200 transition-all duration-200 hover:-translate-y-1 hover:shadow-raised hover:ring-leaf-300"
                  style={{ animationDelay: `${i * 70}ms` }}
                >
                  <div className="flex items-center gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-leaf-600 text-sm font-bold text-white">{i + 1}</span>
                    <span className={clsx('grid size-9 shrink-0 place-items-center rounded-lg', meta.bubble)}>
                      <meta.Icon className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-bold text-river-900">{p.name}</p>
                      {p.google_rating !== null && (
                        <p className="flex items-center gap-1 text-xs text-river-500">
                          <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden />
                          <strong className="text-river-800">{p.google_rating}</strong> ({(p.google_review_count ?? 0).toLocaleString('vi-VN')})
                        </p>
                      )}
                    </div>
                  </div>
                  {reason && <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-river-600">{reason}</p>}
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Assembled itinerary ──────────────────────────────────── */}
      <section id="plan" className="mt-10 scroll-mt-24">
        {generating ? (
          <GeneratingPanel />
        ) : !draft.v9Itinerary ? (
          <div className="flex flex-col items-center rounded-panel border-2 border-dashed border-sand-300 bg-white/60 px-6 py-14 text-center">
            <span className="tp-float grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-leaf-100 to-lotus-50 text-leaf-700">
              <Compass className="size-8" aria-hidden />
            </span>
            <h3 className="mt-4 text-lg">Lịch trình của bạn sẽ hiện ở đây</h3>
            <p className="mt-1 max-w-md text-sm text-river-500">
              Hoàn tất 3 bước bên trên rồi bấm <strong className="text-leaf-700">“Lập lịch trình ngay”</strong> — AI sẽ tính tuyến đường
              và ráp lịch chi tiết từng giờ.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="tp-fade-up flex flex-col gap-4 rounded-panel bg-white p-5 shadow-card ring-1 ring-sand-200 sm:flex-row sm:items-end sm:justify-between">
              <div className="w-full max-w-md">
                <FormField label="Đặt tên cho chuyến đi">
                  <Input value={draft.title} maxLength={120} onChange={(e) => draft.setTitle(e.target.value)} />
                </FormField>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="ghost" onClick={() => setConfirmClear(true)} icon={<Trash2 className="size-4" aria-hidden />}>
                  Xóa bản nháp
                </Button>
                {user ? (
                  <Button
                    type="button"
                    onClick={handleSaveToAccount}
                    loading={saving}
                    disabled={draft.title.trim().length < 2}
                    icon={<Save className="size-4" aria-hidden />}
                  >
                    Lưu lịch trình & Bắt đầu đi thực tế
                  </Button>
                ) : null}
              </div>
            </div>

            {!user && (
              <Notice tone="info" icon={<Info className="size-4" aria-hidden />} title="Đăng nhập để lưu và theo dõi chuyến đi">
                Bạn đang xem bản nháp trên thiết bị. Hãy{' '}
                <Link to="/login" state={{ from: '/itinerary/create' }} className="font-semibold underline">
                  đăng nhập
                </Link>{' '}
                để lưu chuyến đi và cập nhật giờ đến/giờ rời thực tế.
              </Notice>
            )}

            <V9ItineraryView
              itinerary={draft.v9Itinerary}
              primaryPlaces={draft.v9Response?.primary_places ?? []}
              budgetAlternative={draft.v9Response?.budget_alternative ?? null}
              onApplyBudgetAlternative={(alt) => {
                draft.setV9Itinerary(alt);
                toast.success('Đã chuyển sang phương án lịch trình tiết kiệm ngân sách');
              }}
              onUpdateItinerary={(updated) => {
                draft.setV9Itinerary(updated);
                toast.success('Đã cập nhật thứ tự / danh sách điểm trong bản nháp');
              }}
              onRequestSwapStop={(dayNumber, step) => {
                setManualSwapStep({ dayNumber, step });
              }}
              placesById={placesById}
            />
          </div>
        )}
      </section>

      {/* ── Manual Destination Swap Picker Modal ──────────────────────── */}
      {manualSwapStep && draft.v9Itinerary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div className="tp-scale-up w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-sand-200">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-leaf-50 px-3 py-1 text-xs font-bold text-leaf-700 ring-1 ring-leaf-200">
                  <Bot className="size-3.5" /> Đổi địa điểm trong lộ trình Ngày {manualSwapStep.dayNumber}
                </span>
                <h3 className="mt-2 text-lg font-extrabold text-river-900">
                  Thay thế: {manualSwapStep.step.name}
                </h3>
                <p className="mt-0.5 text-xs text-river-500">
                  Chọn địa điểm mới bên dưới — Pé Meko sẽ tự động kiểm tra khoảng cách và độ thuận tiện di chuyển trong ngày:
                </p>
              </div>
              <button
                type="button"
                onClick={() => setManualSwapStep(null)}
                className="rounded-xl p-1.5 text-river-400 hover:bg-sand-100 hover:text-river-700"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
              {FEATURED_SWAP_DESTINATIONS.map((cand) => (
                <button
                  key={cand.slug}
                  type="button"
                  onClick={() => {
                    const currentPlan = draft.v9Itinerary!;
                    const targetDayNum = manualSwapStep.dayNumber;
                    const stepObj = manualSwapStep.step;
                    setManualSwapStep(null);
                    evaluateAndOpenSwapModal(
                      currentPlan,
                      targetDayNum,
                      stepObj.name,
                      cand,
                      stepObj.stop_id,
                    );
                  }}
                  className="group flex w-full items-center justify-between gap-3 rounded-2xl border border-sand-200 bg-sand-50/60 p-3.5 text-left transition-all hover:border-emerald-400 hover:bg-emerald-50/50 hover:shadow-xs"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-river-900 group-hover:text-emerald-900">{cand.name}</p>
                    <p className="mt-0.5 text-xs font-medium text-emerald-700">📍 {cand.area}</p>
                    {cand.summary && <p className="mt-0.5 truncate text-xs text-river-500">{cand.summary}</p>}
                  </div>
                  <span className="shrink-0 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-leaf-700 px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs transition-all duration-200 group-hover:scale-105 group-hover:shadow-sm">
                    Chọn đổi →
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-4 flex justify-end">
              <Button type="button" variant="secondary" size="sm" onClick={() => setManualSwapStep(null)}>
                Đóng
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Route Inconvenience Warning & Confirmation Modal (Requirement #2) ── */}
      {swapConfirmation && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="swap-warning-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <div className="tp-scale-up w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-sand-200">
            {/* Warning Header */}
            <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-orange-500 px-6 py-4 text-white">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white backdrop-blur-xs">
                  <AlertTriangle className="size-4" /> Cảnh báo Lộ trình & Thời gian Di chuyển
                </span>
                <button
                  type="button"
                  onClick={() => setSwapConfirmation(null)}
                  className="rounded-lg p-1 text-white/80 hover:bg-white/20 hover:text-white"
                >
                  <X className="size-5" />
                </button>
              </div>
              <h3 id="swap-warning-title" className="mt-2 text-xl font-extrabold text-white">
                Địa điểm mới làm tăng thời gian di chuyển trong Ngày {swapConfirmation.dayNumber}!
              </h3>
            </div>

            <div className="space-y-4 p-6">
              {/* Swap summary box */}
              <div className="grid gap-3 rounded-2xl border border-sand-200 bg-sand-50/80 p-4 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-river-400">
                    Điểm hiện tại (Ngày {swapConfirmation.dayNumber} · {swapConfirmation.targetStopWindow})
                  </p>
                  <p className="mt-1 font-bold text-river-900 line-through decoration-rose-400">
                    {swapConfirmation.targetStopName}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-leaf-700">
                    Điểm muốn đổi sang
                  </p>
                  <p className="mt-1 font-extrabold text-leaf-800">
                    {swapConfirmation.newDestination.name}
                  </p>
                  <p className="text-xs text-river-500">📍 {swapConfirmation.newDestination.area}</p>
                </div>
              </div>

              {/* Detailed Route Warning Notice */}
              <div className="rounded-2xl border border-amber-300 bg-amber-50/90 p-4 text-sm text-amber-950">
                <div className="flex items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-500 text-white shadow-xs">
                    <Route className="size-5" />
                  </span>
                  <div className="space-y-1.5 leading-relaxed">
                    <p className="font-bold text-amber-950">
                      🦊 Phân tích lộ trình từ Pé Meko:
                    </p>
                    <p className="text-xs sm:text-sm text-amber-900">
                      Địa điểm <strong>{swapConfirmation.newDestination.name}</strong> ({swapConfirmation.newDestination.area}) nằm cách cụm lộ trình hiện tại trong <strong>Ngày {swapConfirmation.dayNumber}</strong> khoảng{' '}
                      <strong className="underline">~{swapConfirmation.extraDistanceKm} km</strong> (làm tăng thời gian di chuyển thêm khoảng{' '}
                      <strong className="underline">+{swapConfirmation.extraTravelMinutes} phút/chiều</strong>).
                    </p>
                    <p className="text-xs sm:text-sm font-medium text-amber-950">
                      💡 <strong>Đề xuất của Pé Meko:</strong> Việc đi vòng xa ngay trong Ngày {swapConfirmation.dayNumber} sẽ gây bất tiện và làm hụt thời gian tham quan các điểm khác. Pé Meko có thể{' '}
                      <strong>sắp xếp {swapConfirmation.newDestination.name} vào Ngày {swapConfirmation.suggestedNextDay}</strong> cho bạn thuận tiện hơn. Bạn có đồng ý không?
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Confirmation Buttons */}
              <div className="flex flex-col gap-2.5 pt-1 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setSwapConfirmation(null)}
                  className="rounded-xl border border-sand-300 bg-white px-4 py-2.5 text-xs font-bold text-river-700 transition hover:bg-sand-100"
                >
                  Hủy bỏ (Giữ nguyên)
                </button>
                <button
                  type="button"
                  onClick={handleConfirmForceSwapInCurrentDay}
                  className="rounded-xl border border-amber-400 bg-amber-100 px-4 py-2.5 text-xs font-bold text-amber-950 transition hover:bg-amber-200"
                >
                  ⚡ Vẫn đổi ngay vào Ngày {swapConfirmation.dayNumber}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmScheduleNextDay}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-leaf-600 px-5 py-2.5 text-xs font-extrabold text-white shadow-cta transition hover:bg-leaf-700"
                >
                  <CalendarDays className="size-4" />
                  Đồng ý xếp vào Ngày {swapConfirmation.suggestedNextDay} (Khuyên dùng)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmClear}
        title="Xóa bản nháp lịch trình?"
        message="Bản nháp trên thiết bị này sẽ bị xóa. Lịch trình đã lưu trong tài khoản không bị ảnh hưởng."
        confirmLabel="Xóa bản nháp"
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          draft.clear();
          setRecommendationsOnlyResult(null);
          setConfirmClear(false);
          toast.info('Đã xóa bản nháp');
        }}
      />
    </PageContainer>
  );
}
