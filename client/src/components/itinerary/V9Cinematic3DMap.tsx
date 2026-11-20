import clsx from 'clsx';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// Use static self-contained worker from public/ so Vite dev & prod never hit 504 on pre-bundled worker path
maplibregl.setWorkerUrl('/maplibre-gl-worker.mjs');
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Compass,
  ExternalLink,
  Film,
  MapPinCheck,
  Orbit,
  Pause,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  Thermometer,
  Wind,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { saveLocalTrack } from '../../lib/footprintOfflineStore';
import { toast } from '../../stores/toastStore';
import type {
  BadgeInfo,
  V9ActivityStep,
  V9ItineraryObject,
  V9Place,
} from '../../types/api';
import { announceBadges } from '../challenge/ChallengeQuiz';
import type {
  ItinerarySafetyReport,
  SafeAlternativeSuggestion,
  SimulatePreset,
  StopSafetyReport,
} from './SafetyGuardianPanel';
import { formatIsoClock, formatV9RankingReason } from './v9Meta';

export interface Resolved3DStop {
  orderIndex: number;
  dayNumber: number;
  dayDate: string;
  stopId: string;
  placeId?: string;
  slug?: string;
  title: string;
  eyebrow: string;
  stepType: V9ActivityStep['type'];
  start: string;
  end: string;
  lat: number;
  lng: number;
  summary: string;
  rating?: number | null;
  reviewCount?: number | null;
  imageUrl?: string;
  travelBeforeKm?: number;
  travelBeforeMin?: number;
  step: V9ActivityStep;
  place?: V9Place;
  safety?: StopSafetyReport;
}

type Map3DTheme = 'day' | 'night' | 'satellite';

const LIBERTY_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

const HAZARD_PRESETS: Array<{ value: SimulatePreset | null; label: string; icon: string }> = [
  { value: null, label: 'Thực tế', icon: '🌤️' },
  { value: 'heavy_storm', label: 'Mưa bão', icon: '⛈️' },
  { value: 'route_accident', label: 'Tai nạn', icon: '🚧' },
  { value: 'mountain_landslide', label: 'Sạt lở', icon: '⛰️' },
];

// Cache fetched OpenFreeMap style JSON across theme switches
let cachedLibertyStyle: any = null;

async function buildMap3DStyle(theme: Map3DTheme): Promise<any> {
  if (theme === 'satellite') {
    return {
      version: 8,
      sources: {
        esri_satellite: {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          ],
          tileSize: 256,
          attribution: 'Tiles &copy; Esri',
          maxzoom: 19,
        },
      },
      layers: [
        {
          id: 'esri-satellite-layer',
          type: 'raster',
          source: 'esri_satellite',
          minzoom: 0,
          maxzoom: 22,
        },
      ],
      sky: {
        'sky-color': '#5fa8e6',
        'horizon-color': '#d7eeff',
        'fog-color': '#cfe8fb',
        'sky-horizon-blend': 0.7,
        'horizon-fog-blend': 0.6,
        'fog-ground-blend': 0.5,
      },
    };
  }

  if (!cachedLibertyStyle) {
    const res = await fetch(LIBERTY_STYLE_URL);
    cachedLibertyStyle = await res.json();
  }

  const style = JSON.parse(JSON.stringify(cachedLibertyStyle));

  if (theme === 'day') {
    style.sky = {
      'sky-color': '#78bef5',
      'horizon-color': '#eaf6ff',
      'fog-color': '#eef7ff',
      'sky-horizon-blend': 0.72,
      'horizon-fog-blend': 0.65,
      'fog-ground-blend': 0.45,
    };
    for (const layer of style.layers ?? []) {
      if (layer.id === 'building-3d' || layer.type === 'fill-extrusion') {
        layer.minzoom = 12.5;
        layer.paint = {
          ...(layer.paint ?? {}),
          'fill-extrusion-color': '#e7dfd4',
          'fill-extrusion-opacity': 0.88,
        };
      }
    }
    return style;
  }

  // True Native WebGL Dark Cyber-Neon 3D City style (zero API key, crisp Vietnamese labels & 3D buildings!)
  style.sky = {
    'sky-color': '#040c16',
    'horizon-color': '#103452',
    'fog-color': '#0b2236',
    'sky-horizon-blend': 0.78,
    'horizon-fog-blend': 0.7,
    'fog-ground-blend': 0.55,
  };

  for (const layer of style.layers ?? []) {
    const id = String(layer.id || '').toLowerCase();
    const paint = (layer.paint = layer.paint ?? {});

    if (layer.type === 'background') {
      paint['background-color'] = '#07111d';
    } else if (layer.type === 'raster') {
      paint['raster-opacity'] = 0.14;
    } else if (layer.type === 'fill-extrusion' || id === 'building-3d') {
      layer.minzoom = 12.5;
      paint['fill-extrusion-color'] = '#193556';
      paint['fill-extrusion-opacity'] = 0.92;
    } else if (layer.type === 'fill') {
      if (id.includes('water')) {
        paint['fill-color'] = '#0a2e4d';
      } else if (
        id.includes('park') ||
        id.includes('grass') ||
        id.includes('wood') ||
        id.includes('forest') ||
        id.includes('green') ||
        id.includes('landcover')
      ) {
        paint['fill-color'] = '#0a2824';
        if (paint['fill-outline-color']) paint['fill-outline-color'] = '#11433a';
      } else if (id.includes('building')) {
        paint['fill-color'] = '#12263e';
        if (paint['fill-outline-color']) paint['fill-outline-color'] = '#1d3b5e';
      } else {
        paint['fill-color'] = '#0c1b2b';
      }
    } else if (layer.type === 'line') {
      if (id.includes('water')) {
        paint['line-color'] = '#0f426b';
      } else if (id.includes('boundary')) {
        paint['line-color'] = '#215968';
      } else if (id.includes('casing')) {
        paint['line-color'] = '#0b1826';
      } else if (
        id.includes('motorway') ||
        id.includes('trunk') ||
        id.includes('primary')
      ) {
        paint['line-color'] = '#28597d';
      } else if (id.includes('secondary') || id.includes('tertiary')) {
        paint['line-color'] = '#1e425e';
      } else {
        paint['line-color'] = '#162f47';
      }
    } else if (layer.type === 'symbol') {
      if (id.includes('water')) {
        paint['text-color'] = '#5cc8ff';
      } else {
        paint['text-color'] = '#e6f5ff';
      }
      paint['text-halo-color'] = '#06101c';
      paint['text-halo-width'] = 1.6;
    }
  }

  return style;
}

function getWeatherVisualKind(
  weather?: StopSafetyReport['weather'],
  status?: StopSafetyReport['status'],
): 'storm' | 'rain' | 'sunny' {
  if (status === 'danger') return 'storm';
  const code = weather?.conditionCode ?? 0;
  if (code >= 95 || (weather?.precipitationMm ?? 0) >= 5) return 'storm';
  if (code >= 51 || (weather?.precipitationMm ?? 0) > 0.3 || status === 'caution') return 'rain';
  return 'sunny';
}

function getWeatherEmoji(code?: number, status?: string): string {
  if (status === 'danger') return '⛈️';
  if (typeof code !== 'number') return '☀️';
  if (code >= 95) return '⛈️';
  if (code >= 51) return '🌧️';
  if (code >= 1 && code <= 3) return '⛅';
  return '☀️';
}

function splitStepTitle(step: V9ActivityStep): { eyebrow: string; title: string } {
  if (
    (step.type === 'meal' ||
      step.type === 'meal_unassigned' ||
      step.type === 'meal_unscheduled') &&
    step.name.includes(' — ')
  ) {
    const [label, ...rest] = step.name.split(' — ');
    return { eyebrow: label ?? 'Ẩm thực', title: rest.join(' — ') };
  }
  const eyebrow =
    step.type === 'checkout'
      ? 'Lưu trú nghỉ đêm'
      : step.type === 'meal'
        ? 'Ẩm thực địa phương'
        : 'Điểm tham quan';
  return { eyebrow, title: step.name };
}

/**
 * Animated Atmospheric Weather Canvas floating directly over the 3D Map:
 * - Slanted 3D-perspective raindrops & lightning flash when Storm/Rain
 * - Warm sunlit horizon glow when Sunny
 */
function WeatherAtmosphereOverlay({
  kind,
  theme,
}: {
  kind: 'storm' | 'rain' | 'sunny';
  theme: Map3DTheme;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (kind === 'sunny') {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const count = kind === 'storm' ? 140 : 65;
    const drops = Array.from({ length: count }, () => ({
      x: Math.random() * (canvas.width || 800),
      y: Math.random() * (canvas.height || 600),
      len: kind === 'storm' ? 16 + Math.random() * 16 : 10 + Math.random() * 10,
      speed: kind === 'storm' ? 13 + Math.random() * 8 : 7 + Math.random() * 5,
      alpha: kind === 'storm' ? 0.35 + Math.random() * 0.35 : 0.22 + Math.random() * 0.2,
    }));

    let rafId = 0;
    let flashOpacity = 0;
    let tick = 0;

    const render = () => {
      tick++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Subtle atmospheric storm tint
      if (kind === 'storm') {
        const grad = ctx.createLinearGradient(0, 0, 0, canvas.height * 0.45);
        grad.addColorStop(0, 'rgba(15, 23, 42, 0.38)');
        grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Occasional cinematic lightning shimmer
        if (tick % 190 === 0 || tick % 197 === 0) {
          flashOpacity = 0.24;
        }
        if (flashOpacity > 0.01) {
          ctx.fillStyle = `rgba(224, 242, 254, ${flashOpacity})`;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          flashOpacity *= 0.84;
        }
      }

      ctx.lineCap = 'round';
      for (const d of drops) {
        ctx.strokeStyle =
          kind === 'storm'
            ? `rgba(186, 230, 253, ${d.alpha})`
            : `rgba(203, 213, 225, ${d.alpha})`;
        ctx.lineWidth = kind === 'storm' ? 1.5 : 1.1;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        const dx = kind === 'storm' ? -4.5 : -2;
        ctx.lineTo(d.x + dx, d.y + d.len);
        ctx.stroke();

        d.x += dx * 0.45;
        d.y += d.speed;
        if (d.y > canvas.height) {
          d.y = -d.len;
          d.x = Math.random() * (canvas.width + 80);
        }
      }

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, [kind]);

  return (
    <>
      {kind === 'sunny' && theme !== 'night' && (
        <div
          className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
          aria-hidden
        >
          <div className="absolute -right-24 -top-24 size-80 rounded-full bg-amber-300/25 blur-3xl animate-pulse" />
          <div className="absolute right-8 top-4 size-40 rounded-full bg-yellow-200/20 blur-2xl" />
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 z-10 size-full"
        aria-hidden
      />
    </>
  );
}

export interface V9Cinematic3DMapProps {
  itinerary: V9ItineraryObject;
  activeDayIndex: number;
  activeStopId: string | null;
  onSelectStop: (stopId: string) => void;
  placesById?: Map<string, V9Place>;
  safetyReport: ItinerarySafetyReport | null;
  onSafetyReportChange: (rep: ItinerarySafetyReport | null) => void;
  onApplySafeAlternative?: (rep: StopSafetyReport, alt: SafeAlternativeSuggestion) => Promise<void> | void;
  editable?: boolean;
}

export function V9Cinematic3DMap({
  itinerary,
  activeDayIndex,
  activeStopId,
  onSelectStop,
  placesById,
  safetyReport,
  onSafetyReportChange,
  onApplySafeAlternative,
  editable = true,
}: V9Cinematic3DMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const hazardMarkersRef = useRef<maplibregl.Marker[]>([]);

  const [theme, setTheme] = useState<Map3DTheme>('night');
  const [mapReady, setMapReady] = useState(false);

  // Camera modes: 360° Flyover Orbit & Auto 3D Fly-Through Tour
  const [isOrbiting, setIsOrbiting] = useState(false);
  const [isFlyTourActive, setIsFlyTourActive] = useState(false);
  const orbitRafRef = useRef<number | null>(null);
  const flyTourTimerRef = useRef<number | null>(null);

  // Live Weather & Hazard Simulator right on the 3D Map
  const [simulatePreset, setSimulatePreset] = useState<SimulatePreset | null>(null);
  const [loadingSafety, setLoadingSafety] = useState(false);

  // Real road geometry fetched from OSRM
  const [roadCoordsLngLat, setRoadCoordsLngLat] = useState<Array<[number, number]>>([]);

  // Hands-Free Auto Check-in tracking
  const [checkedInKeys, setCheckedInKeys] = useState<Set<string>>(() => new Set());
  const autoCheckedRef = useRef<Set<string>>(new Set());

  // 1. Fetch Weather, Accident & Landslide Intelligence for the 3D Map
  const runSafetyCheck = useCallback(
    async (preset: SimulatePreset | null) => {
      if (!itinerary?.days?.length) return;
      setLoadingSafety(true);
      try {
        const enrichedDays = itinerary.days.map((day) => ({
          ...day,
          activities: day.activities.map((act) => {
            const place = act.place_id ? placesById?.get(act.place_id) : undefined;
            const lat =
              typeof act.latitude === 'number'
                ? act.latitude
                : place?.coordinates
                  ? place.coordinates[1]
                  : undefined;
            const lng =
              typeof act.longitude === 'number'
                ? act.longitude
                : place?.coordinates
                  ? place.coordinates[0]
                  : undefined;
            return { ...act, latitude: lat, longitude: lng };
          }),
        }));

        const res = await api.post<{ success: boolean; report: ItinerarySafetyReport }>(
          '/safety/check-itinerary',
          { days: enrichedDays, simulatePreset: preset },
          { timeout: 12000 },
        );
        onSafetyReportChange(res.data.report);
      } catch {
        // ignore transient errors
      } finally {
        setLoadingSafety(false);
      }
    },
    [itinerary.days, onSafetyReportChange, placesById],
  );

  useEffect(() => {
    void runSafetyCheck(simulatePreset);
  }, [runSafetyCheck, simulatePreset]);

  // Safety lookup by stop
  const safetyByKey = useMemo(() => {
    const m = new Map<string, StopSafetyReport>();
    for (const rep of safetyReport?.stopReports ?? []) {
      if (rep.stopId) m.set(`${rep.dayNumber}:${rep.stopId}`, rep);
      m.set(`${rep.dayNumber}:name:${rep.stepName}`, rep);
    }
    return m;
  }, [safetyReport]);

  // 2. Resolve ordered stops for the active day (or all days)
  const stops = useMemo<Resolved3DStop[]>(() => {
    const days =
      activeDayIndex === -1
        ? itinerary.days
        : itinerary.days.filter((_, idx) => idx === activeDayIndex);

    const out: Resolved3DStop[] = [];
    let order = 1;

    for (const day of days) {
      let pendingKm: number | undefined;
      let pendingMin: number | undefined;

      for (const act of day.activities) {
        if (act.type === 'travel') {
          pendingKm = act.distance_km;
          pendingMin = act.route_duration_minutes;
          continue;
        }
        if (!act.stop_id && act.type !== 'visit' && act.type !== 'meal' && act.type !== 'checkout') {
          continue;
        }

        const place = act.place_id ? placesById?.get(act.place_id) : undefined;
        const safety =
          (act.stop_id ? safetyByKey.get(`${day.day}:${act.stop_id}`) : undefined) ??
          safetyByKey.get(`${day.day}:name:${act.name}`);

        const lat =
          typeof act.latitude === 'number'
            ? act.latitude
            : typeof safety?.coordinates?.lat === 'number'
              ? safety.coordinates.lat
              : place?.coordinates
                ? place.coordinates[1]
                : undefined;

        const lng =
          typeof act.longitude === 'number'
            ? act.longitude
            : typeof safety?.coordinates?.lng === 'number'
              ? safety.coordinates.lng
              : place?.coordinates
                ? place.coordinates[0]
                : undefined;

        if (typeof lat !== 'number' || typeof lng !== 'number') continue;

        const { eyebrow, title } = splitStepTitle(act);
        const rankingReason = place ? formatV9RankingReason(place) : '';
        const summary =
          act.note ||
          rankingReason ||
          `Chặng #${order} trong lịch trình Đồng Tháp · ${eyebrow} (${act.start || '08:00'} – ${act.end || '09:30'}).`;

        out.push({
          orderIndex: order++,
          dayNumber: day.day,
          dayDate: day.date,
          stopId: act.stop_id || `${day.day}-${order}`,
          placeId: act.place_id,
          slug: place?.slug || act.place_id,
          title,
          eyebrow,
          stepType: act.type,
          start: formatIsoClock(act.planned_start_at) || act.start || '08:00',
          end: formatIsoClock(act.planned_end_at) || act.end || '09:30',
          lat,
          lng,
          summary,
          rating: act.google_rating ?? place?.google_rating,
          reviewCount: act.google_review_count ?? place?.google_review_count,
          imageUrl: place?.images?.[0]?.url,
          travelBeforeKm: pendingKm,
          travelBeforeMin: pendingMin,
          step: act,
          place,
          safety,
        });

        pendingKm = undefined;
        pendingMin = undefined;
      }
    }

    return out;
  }, [activeDayIndex, itinerary.days, placesById, safetyByKey]);

  const focusedStop = useMemo(
    () => stops.find((s) => s.stopId === activeStopId) ?? stops[0] ?? null,
    [activeStopId, stops],
  );

  const weatherKind = useMemo(
    () => getWeatherVisualKind(focusedStop?.safety?.weather, focusedStop?.safety?.status),
    [focusedStop?.safety?.status, focusedStop?.safety?.weather],
  );

  // 3. Fetch real OSRM road route coordinates [lng, lat] for glowing 3D route ribbon
  useEffect(() => {
    if (stops.length < 2) {
      setRoadCoordsLngLat(stops.map((s) => [s.lng, s.lat]));
      return;
    }
    let cancelled = false;
    const query = stops.map((s) => `${s.lng},${s.lat}`).join(';');
    fetch(
      `https://router.project-osrm.org/route/v1/driving/${query}?overview=full&geometries=geojson`,
    )
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const coords = d?.routes?.[0]?.geometry?.coordinates;
        if (Array.isArray(coords) && coords.length >= 2) {
          setRoadCoordsLngLat(coords);
        } else {
          setRoadCoordsLngLat(stops.map((s) => [s.lng, s.lat]));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRoadCoordsLngLat(stops.map((s) => [s.lng, s.lat]));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [stops]);

  // Helper: Trigger Hands-Free Auto Check-in during 3D Fly-Through Tour
  const triggerAutoCheckIn = useCallback(async (stop: Resolved3DStop) => {
    if (autoCheckedRef.current.has(stop.stopId)) return;
    autoCheckedRef.current.add(stop.stopId);
    setCheckedInKeys((prev) => new Set([...prev, stop.stopId]));

    if (stop.slug) {
      try {
        const res = await api.post<{
          created: boolean;
          pointsAwarded: number;
          newBadges: BadgeInfo[];
        }>(`/destinations/${stop.slug}/check-in`, {
          lat: stop.lat,
          lng: stop.lng,
          isSimulated: true,
        });
        if (res.data?.created) {
          toast.success(
            `🛂 Tự động Check-in 3D: ${stop.title} (+${res.data.pointsAwarded} EXP)`,
            `Đã đóng dấu chặng #${stop.orderIndex} vào Hộ chiếu số & Bản đồ Dấu chân!`,
          );
          if (res.data.newBadges?.length) announceBadges(res.data.newBadges);
        }
      } catch {
        // ignore if meal stop isn't in published Destination catalog
      }
    }

    try {
      await saveLocalTrack({
        clientId: `3d-tour-${stop.stopId}`,
        title: `Hành trình 3D: ${stop.title}`,
        color: '#10b981',
        distanceKm: stop.travelBeforeKm ?? 0.5,
        durationSeconds: 120,
        startedAt: Date.now(),
        endedAt: Date.now(),
        points: [
          { lat: stop.lat, lng: stop.lng, timestamp: Date.now() },
          { lat: stop.lat + 0.0004, lng: stop.lng + 0.0004, timestamp: Date.now() + 1000 },
        ],
        memories: [
          {
            clientId: `mem-3d-${stop.stopId}`,
            lat: stop.lat,
            lng: stop.lng,
            emoji: '✈️',
            moodLabel: 'Bay tham quan 3D',
            placeName: stop.title,
            note: `Chặng #${stop.orderIndex} (${stop.start} – ${stop.end})`,
            createdAt: Date.now(),
          },
        ],
        syncStatus: 'pending',
      });
    } catch {
      // ignore
    }
  }, []);

  // 4. Initialize MapLibre GL 3D WebGL Engine
  useEffect(() => {
    let mounted = true;
    let mapInstance: maplibregl.Map | null = null;
    let resizeObs: ResizeObserver | null = null;

    (async () => {
      if (!containerRef.current) return;
      const styleObj = await buildMap3DStyle(theme);
      if (!mounted || !containerRef.current) return;

      const first = stops[0];
      mapInstance = new maplibregl.Map({
        container: containerRef.current,
        style: styleObj,
        center: first ? [first.lng, first.lat] : [105.6324, 10.4562],
        zoom: 14.8,
        pitch: 58,
        bearing: -22,
        maxPitch: 75,
        attributionControl: false,
      });

      mapInstance.addControl(
        new maplibregl.NavigationControl({ visualizePitch: true }),
        'bottom-right',
      );

      mapInstance.on('style.load', () => {
        if (!mounted) return;
        mapInstance?.resize();
        setMapReady(true);
      });

      resizeObs = new ResizeObserver(() => {
        mapInstance?.resize();
      });
      resizeObs.observe(containerRef.current);

      mapRef.current = mapInstance;
    })();

    return () => {
      mounted = false;
      setMapReady(false);
      resizeObs?.disconnect();
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      hazardMarkersRef.current.forEach((m) => m.remove());
      hazardMarkersRef.current = [];
      if (mapInstance) {
        mapInstance.remove();
      }
      mapRef.current = null;
    };
    // Re-init cleanly when switching 3D theme
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  // 5. Render Glowing 3D Road Route + Animated Energy Flow + Hazard Zones on MapLibre GL
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const coords =
      roadCoordsLngLat.length >= 2
        ? roadCoordsLngLat
        : stops.map((s) => [s.lng, s.lat] as [number, number]);

    const routeGeoJson: GeoJSON.Feature<GeoJSON.LineString> = {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: coords },
    };

    const hasDanger = stops.some((s) => s.safety?.status === 'danger');
    const glowColor = hasDanger ? '#f59e0b' : '#10b981';
    const coreColor = hasDanger ? '#fbbf24' : '#34d399';

    if (map.getSource('itinerary-3d-route')) {
      (map.getSource('itinerary-3d-route') as maplibregl.GeoJSONSource).setData(routeGeoJson);
    } else if (coords.length >= 2) {
      map.addSource('itinerary-3d-route', {
        type: 'geojson',
        data: routeGeoJson,
      });

      // Soft Wide Neon Glow under the road
      map.addLayer({
        id: 'route-3d-glow',
        type: 'line',
        source: 'itinerary-3d-route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': glowColor,
          'line-width': 16,
          'line-blur': 10,
          'line-opacity': 0.55,
        },
      });

      // Crisp Core 3D Road Ribbon
      map.addLayer({
        id: 'route-3d-core',
        type: 'line',
        source: 'itinerary-3d-route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': coreColor,
          'line-width': 5.5,
          'line-opacity': 0.96,
        },
      });

      // Animated Flowing White Energy Pulse along Route
      map.addLayer({
        id: 'route-3d-pulse',
        type: 'line',
        source: 'itinerary-3d-route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#ffffff',
          'line-width': 2.5,
          'line-opacity': 0.85,
          'line-dasharray': [0, 4, 3],
        },
      });
    }

    if (map.getLayer('route-3d-glow')) {
      map.setPaintProperty('route-3d-glow', 'line-color', glowColor);
    }
    if (map.getLayer('route-3d-core')) {
      map.setPaintProperty('route-3d-core', 'line-color', coreColor);
    }

    // Build Safe Alternative Bypass Arcs GeoJSON
    const bypassFeatures: GeoJSON.Feature<GeoJSON.LineString>[] = [];
    for (const s of stops) {
      const alt = s.safety?.alternatives?.[0];
      if (
        (s.safety?.status === 'danger' || s.safety?.status === 'caution') &&
        alt &&
        typeof alt.coordinates?.lng === 'number'
      ) {
        bypassFeatures.push({
          type: 'Feature',
          properties: { name: alt.name },
          geometry: {
            type: 'LineString',
            coordinates: [
              [s.lng, s.lat],
              [alt.coordinates.lng, alt.coordinates.lat],
            ],
          },
        });
      }
    }

    const bypassCollection: GeoJSON.FeatureCollection<GeoJSON.LineString> = {
      type: 'FeatureCollection',
      features: bypassFeatures,
    };

    if (map.getSource('itinerary-3d-bypass')) {
      (map.getSource('itinerary-3d-bypass') as maplibregl.GeoJSONSource).setData(bypassCollection);
    } else {
      map.addSource('itinerary-3d-bypass', { type: 'geojson', data: bypassCollection });
      map.addLayer({
        id: 'route-3d-bypass-line',
        type: 'line',
        source: 'itinerary-3d-bypass',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#34d399',
          'line-width': 4,
          'line-dasharray': [2, 2],
          'line-opacity': 0.95,
        },
      });
    }

    // Animate energy pulse along route ribbon smoothly
    const dashSteps: number[][] = [
      [0, 4, 3],
      [0.5, 4, 2.5],
      [1, 4, 2],
      [1.5, 4, 1.5],
      [2, 4, 1],
      [2.5, 4, 0.5],
      [3, 4, 0],
      [0, 0.5, 3, 3.5],
      [0, 1, 3, 3],
      [0, 1.5, 3, 2.5],
      [0, 2, 3, 2],
      [0, 2.5, 3, 1.5],
      [0, 3, 3, 1],
      [0, 3.5, 3, 0.5],
    ];
    let animStep = 0;
    let lastTs = 0;
    let raf = 0;

    const animateDash = (ts: number) => {
      if (ts - lastTs > 95) {
        lastTs = ts;
        if (map.getLayer('route-3d-pulse')) {
          map.setPaintProperty(
            'route-3d-pulse',
            'line-dasharray',
            dashSteps[animStep % dashSteps.length],
          );
        }
        animStep++;
      }
      raf = requestAnimationFrame(animateDash);
    };
    raf = requestAnimationFrame(animateDash);

    return () => cancelAnimationFrame(raf);
  }, [mapReady, roadCoordsLngLat, stops]);

  // 6. Render Floating 3D Pylon Stop Markers + 3D Hazard Beacons on MapLibre GL
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    hazardMarkersRef.current.forEach((m) => m.remove());
    hazardMarkersRef.current = [];

    for (const stop of stops) {
      const isFocused = focusedStop?.stopId === stop.stopId;
      const status = stop.safety?.status ?? 'safe';
      const weather = stop.safety?.weather;
      const wEmoji = getWeatherEmoji(weather?.conditionCode, status);
      const checked =
        checkedInKeys.has(stop.stopId) ||
        stop.step.status === 'completed' ||
        stop.step.status === 'arrived';

      const accent =
        status === 'danger'
          ? '#ef4444'
          : status === 'caution'
            ? '#f59e0b'
            : isFocused
              ? '#10b981'
              : stop.stepType === 'meal'
                ? '#f97316'
                : '#0d9488';

      const el = document.createElement('div');
      el.className = 'dtst-3d-pylon-marker';
      el.style.cursor = 'pointer';
      el.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;transform:translateY(-6px);transition:transform 0.25s ease;">
          <div style="display:flex;align-items:center;gap:6px;padding:6px 11px;border-radius:16px;background:${isFocused ? 'linear-gradient(135deg,#042f2e,#065f46)' : 'rgba(10,20,30,0.9)'};color:#ffffff;border:2px solid ${accent};box-shadow:0 12px 30px rgba(0,0,0,0.45), 0 0 ${isFocused ? '22px' : '10px'} ${accent}66;backdrop-filter:blur(8px);white-space:nowrap;transform:scale(${isFocused ? '1.08' : '0.94'});">
            <span style="display:grid;place-items:center;min-width:22px;height:22px;padding:0 5px;border-radius:999px;background:${accent};color:white;font-size:11px;font-weight:900;">
              ${stop.orderIndex}
            </span>
            <div style="display:flex;flex-direction:column;line-height:1.15;">
              <span style="font-size:12px;font-weight:800;letter-spacing:-0.01em;">
                ${stop.title.length > 24 ? stop.title.slice(0, 24) + '…' : stop.title}
              </span>
              <span style="font-size:10px;font-weight:700;color:#a7f3d0;margin-top:2px;">
                ${stop.start} · ${wEmoji} ${weather ? `${weather.temperatureC}°C` : 'Đẹp'} ${checked ? '· 🛂 Đã Check-in' : ''}
              </span>
            </div>
          </div>
          <div style="width:2.5px;height:${isFocused ? '34px' : '22px'};background:linear-gradient(to bottom, ${accent}, ${accent}15);box-shadow:0 0 10px ${accent};"></div>
          <div style="position:relative;width:14px;height:14px;display:grid;place-items:center;">
            ${
              isFocused || status === 'danger'
                ? `<span style="position:absolute;width:36px;height:36px;border-radius:999px;border:2px solid ${accent};background:${accent}33;animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></span>`
                : ''
            }
            <span style="width:10px;height:10px;border-radius:999px;background:${accent};border:2px solid white;box-shadow:0 0 12px ${accent};"></span>
          </div>
        </div>
      `;

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelectStop(stop.stopId);
      });

      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([stop.lng, stop.lat])
        .addTo(map);

      markersRef.current.push(marker);

      // Render Safe Alternative 3D Pin if stop has a Weather/Accident/Landslide Hazard
      const bestAlt = stop.safety?.alternatives?.[0];
      if (
        (status === 'danger' || status === 'caution') &&
        bestAlt &&
        typeof bestAlt.coordinates?.lng === 'number'
      ) {
        const altEl = document.createElement('div');
        altEl.style.cursor = 'pointer';
        altEl.innerHTML = `
          <div style="display:flex;flex-direction:column;align-items:center;">
            <div style="display:inline-flex;align-items:center;gap:5px;background:linear-gradient(135deg,#059669,#0d9488);color:white;border:2px solid white;border-radius:14px;padding:5px 10px;font-size:11px;font-weight:800;white-space:nowrap;box-shadow:0 10px 24px rgba(16,185,129,0.5);">
              <span>🛡️ Điểm thay thế an toàn: ${bestAlt.name} (${bestAlt.distanceKm}km)</span>
            </div>
            <div style="width:2px;height:18px;background:#34d399;"></div>
            <span style="width:10px;height:10px;border-radius:999px;background:#34d399;border:2px solid white;"></span>
          </div>
        `;
        altEl.addEventListener('click', (e) => {
          e.stopPropagation();
          if (onApplySafeAlternative && stop.safety) {
            void onApplySafeAlternative(stop.safety, bestAlt);
          }
        });
        const altMarker = new maplibregl.Marker({ element: altEl, anchor: 'bottom' })
          .setLngLat([bestAlt.coordinates.lng, bestAlt.coordinates.lat])
          .addTo(map);
        hazardMarkersRef.current.push(altMarker);
      }
    }
  }, [checkedInKeys, focusedStop?.stopId, mapReady, onApplySafeAlternative, onSelectStop, stops]);

  // 7. Cinematic 3D Camera Fly-To whenever activeStopId changes (Synced to Scroll on Left!)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !focusedStop) return;

    // Slight varied cinematic bearing per stop so every swoop feels dynamic like Apple Maps Flyover!
    const targetBearing = ((focusedStop.orderIndex * 28) % 90) - 45;
    map.flyTo({
      center: [focusedStop.lng, focusedStop.lat],
      zoom: 15.6,
      pitch: 60,
      bearing: targetBearing,
      speed: 1.05,
      curve: 1.45,
      essential: true,
    });
  }, [focusedStop?.lat, focusedStop?.lng, focusedStop?.orderIndex, mapReady]);

  // 8. 360° Flyover Orbit Animation around the Focused Landmark
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !isOrbiting) {
      if (orbitRafRef.current) {
        cancelAnimationFrame(orbitRafRef.current);
        orbitRafRef.current = null;
      }
      return;
    }

    const rotate = () => {
      if (!mapRef.current) return;
      mapRef.current.rotateTo((mapRef.current.getBearing() + 0.16) % 360, { duration: 0 });
      orbitRafRef.current = requestAnimationFrame(rotate);
    };
    orbitRafRef.current = requestAnimationFrame(rotate);

    return () => {
      if (orbitRafRef.current) {
        cancelAnimationFrame(orbitRafRef.current);
        orbitRafRef.current = null;
      }
    };
  }, [isOrbiting, mapReady]);

  // 9. Auto 3D Fly-Through Cinema Tour (Swoops Stop #1 -> #2 -> #3... + Auto Check-in!)
  const handleToggleFlyTour = () => {
    if (isFlyTourActive) {
      if (flyTourTimerRef.current) {
        window.clearInterval(flyTourTimerRef.current);
        flyTourTimerRef.current = null;
      }
      setIsFlyTourActive(false);
      setIsOrbiting(false);
      return;
    }

    if (stops.length === 0) return;
    setIsFlyTourActive(true);
    setIsOrbiting(true);

    let idx = 0;
    const first = stops[0]!;
    onSelectStop(first.stopId);
    void triggerAutoCheckIn(first);

    toast.info(
      '🎬 Đang khởi chạy Bay Tham Quan 3D (Fly-Through)!',
      'Camera 3D sẽ tự động bay qua từng địa điểm trong lịch trình, mô phỏng thời tiết và tự động Check-in!',
    );

    flyTourTimerRef.current = window.setInterval(() => {
      idx++;
      if (idx >= stops.length) {
        if (flyTourTimerRef.current) {
          window.clearInterval(flyTourTimerRef.current);
          flyTourTimerRef.current = null;
        }
        setIsFlyTourActive(false);
        setIsOrbiting(false);
        // Zoom out to show full glowing 3D route overview
        const map = mapRef.current;
        if (map && stops.length >= 2) {
          const bounds = new maplibregl.LngLatBounds();
          stops.forEach((s) => bounds.extend([s.lng, s.lat]));
          map.fitBounds(bounds, { padding: 80, pitch: 52, bearing: -15, duration: 1600 });
        }
        toast.success('✨ Đã hoàn thành chuyến bay tham quan 3D toàn tuyến!');
        return;
      }
      const nextStop = stops[idx]!;
      onSelectStop(nextStop.stopId);
      void triggerAutoCheckIn(nextStop);
    }, 3800);
  };

  useEffect(() => {
    return () => {
      if (flyTourTimerRef.current) window.clearInterval(flyTourTimerRef.current);
    };
  }, []);

  const handleFitFullRoute = () => {
    const map = mapRef.current;
    if (!map || stops.length === 0) return;
    setIsOrbiting(false);
    if (stops.length === 1) {
      map.flyTo({ center: [stops[0]!.lng, stops[0]!.lat], zoom: 15, pitch: 55 });
      return;
    }
    const bounds = new maplibregl.LngLatBounds();
    stops.forEach((s) => bounds.extend([s.lng, s.lat]));
    map.fitBounds(bounds, { padding: 85, pitch: 50, bearing: -12, duration: 1200 });
  };

  const focusedHazard = focusedStop?.safety?.hazards?.[0];
  const focusedBestAlt = focusedStop?.safety?.alternatives?.[0];
  const focusedWeather = focusedStop?.safety?.weather;

  return (
    <div className="tp-3d-map-stage relative flex h-[65dvh] min-h-[430px] w-full flex-col overflow-hidden rounded-3xl border border-river-800/40 bg-[#07111d] shadow-2xl md:h-[calc(100vh-9.5rem)] md:min-h-[540px]">
      <style>{`
        @media (max-width: 639px) {
          .tp-3d-map-stage .maplibregl-ctrl-bottom-right {
            display: none !important;
          }
        }
      `}</style>
      {/* ── WebGL 3D MapLibre Canvas ──────────────────────────────── */}
      <div ref={containerRef} className="size-full" />

      {/* ── Live Atmospheric Weather Canvas (Raindrops / Lightning / Sunbeam) ── */}
      <WeatherAtmosphereOverlay kind={weatherKind} theme={theme} />

      {/* ── Top Floating Sleek Dark-Glass HUD Controls (Single-row swipeable on mobile!) ── */}
      <div className="pointer-events-none absolute inset-x-2.5 top-2.5 z-20 flex flex-col gap-1.5 sm:inset-x-3 sm:top-3 sm:gap-2">
        <div className="pointer-events-auto flex flex-nowrap items-center justify-between gap-1.5 overflow-x-auto no-scrollbar sm:flex-wrap sm:overflow-visible">
          {/* Left: Fly-Through Cinema Tour & 360° Orbit */}
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={handleToggleFlyTour}
              className={clsx(
                'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-extrabold text-white shadow-lg transition sm:px-3.5 sm:text-xs',
                isFlyTourActive
                  ? 'bg-rose-600 ring-2 ring-rose-300 animate-pulse'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400',
              )}
            >
              {isFlyTourActive ? (
                <>
                  <Pause className="size-3.5" /> Dừng Bay 3D
                </>
              ) : (
                <>
                  <Film className="size-3.5" /> Bay 3D
                  <span className="hidden sm:inline">tham quan</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsOrbiting((v) => !v)}
              className={clsx(
                'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1.5 text-[11px] font-bold backdrop-blur-md transition sm:px-3 sm:text-xs',
                isOrbiting
                  ? 'bg-teal-500 text-white ring-1 ring-teal-300'
                  : 'bg-slate-950/75 text-slate-100 ring-1 ring-white/20 hover:bg-slate-900/90',
              )}
              title="Xoay camera 360° quanh địa điểm đang chọn"
            >
              <Orbit className={clsx('size-3.5', isOrbiting && 'animate-spin')} />
              360°
            </button>

            <button
              type="button"
              onClick={handleFitFullRoute}
              className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-slate-950/75 px-2.5 py-1.5 text-[11px] font-bold text-slate-100 ring-1 ring-white/20 backdrop-blur-md hover:bg-slate-900/90 sm:px-3 sm:text-xs"
              title="Thu phóng xem toàn tuyến đường trong ngày"
            >
              <Compass className="size-3.5 text-teal-300" />
              Toàn tuyến
            </button>
          </div>

          {/* Right: 3D Map Theme Switcher */}
          <div className="inline-flex shrink-0 rounded-full bg-slate-950/80 p-0.5 text-[11px] font-bold text-slate-200 ring-1 ring-white/20 backdrop-blur-md sm:p-1">
            {(
              [
                { id: 'night', label: '🌙 Đêm 3D', full: '🌙 3D Đêm Neon' },
                { id: 'day', label: '🌆 Sáng 3D', full: '🌆 3D Thành phố' },
                { id: 'satellite', label: '🛰️ Vệ tinh', full: '🛰️ Vệ tinh' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTheme(opt.id)}
                className={clsx(
                  'whitespace-nowrap rounded-full px-2 py-1 transition sm:px-2.5',
                  theme === opt.id
                    ? 'bg-emerald-500 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white',
                )}
              >
                <span className="sm:hidden">{opt.label}</span>
                <span className="hidden sm:inline">{opt.full}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Second slim bar: Live Weather & Hazard Simulator directly on 3D Canvas */}
        <div className="pointer-events-auto flex flex-nowrap items-center justify-between gap-1.5 overflow-x-auto no-scrollbar sm:flex-wrap sm:overflow-visible">
          <div
            className={clsx(
              'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold backdrop-blur-md ring-1 sm:px-3 sm:text-[11px]',
              safetyReport?.overallStatus === 'danger'
                ? 'bg-red-950/85 text-red-100 ring-red-400/60'
                : safetyReport?.overallStatus === 'caution'
                  ? 'bg-amber-950/85 text-amber-100 ring-amber-400/60'
                  : 'bg-slate-950/75 text-emerald-200 ring-white/15',
            )}
          >
            {safetyReport?.overallStatus === 'danger' ? (
              <ShieldAlert className="size-3.5 text-red-400 animate-pulse" />
            ) : (
              <ShieldCheck className="size-3.5 text-emerald-400" />
            )}
            <span>
              {loadingSafety
                ? 'Quét thời tiết 3D...'
                : safetyReport?.overallStatus === 'danger'
                  ? 'Cảnh báo sự cố!'
                  : weatherKind === 'rain'
                    ? 'Có mưa nhẹ'
                    : 'Thời tiết 3D An toàn'}
            </span>
          </div>

          <div className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-950/75 p-0.5 ring-1 ring-white/15 backdrop-blur-md sm:p-1">
            {HAZARD_PRESETS.map((p) => {
              const active = simulatePreset === p.value;
              return (
                <button
                  key={p.label}
                  type="button"
                  disabled={loadingSafety}
                  onClick={() => setSimulatePreset(p.value)}
                  className={clsx(
                    'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold transition sm:px-2.5 sm:text-[11px]',
                    active
                      ? p.value === null
                        ? 'bg-emerald-500 text-white'
                        : 'bg-red-600 text-white shadow-xs'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white',
                  )}
                >
                  <span>{p.icon}</span>
                  <span>{p.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Bottom Sleek Cinema Spotlight Card (Focused Stop + 1-Click Safe Reroute) ── */}
      {focusedStop && (
        <div className="pointer-events-none absolute inset-x-2.5 bottom-2.5 z-20 flex flex-col gap-1.5 sm:inset-x-3 sm:bottom-3 sm:gap-2 sm:pr-44">
          {/* Rescue Banner if Focused Stop has Weather / Accident / Landslide Warning */}
          {focusedHazard && (
            <div className="pointer-events-auto flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-red-400/80 bg-red-950/90 px-3 py-2 text-xs text-white shadow-xl backdrop-blur-md sm:px-3.5 sm:py-2.5">
              <div className="flex items-start gap-2 min-w-0 flex-1">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-300" />
                <div className="min-w-0">
                  <p className="truncate font-extrabold text-amber-200">{focusedHazard.title}</p>
                  <p className="line-clamp-1 text-[11px] text-red-100/90">
                    {focusedHazard.description}
                  </p>
                </div>
              </div>
              {focusedBestAlt && editable && onApplySafeAlternative && focusedStop.safety && (
                <button
                  type="button"
                  onClick={() => void onApplySafeAlternative(focusedStop.safety!, focusedBestAlt)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500 px-2.5 py-1 text-[10px] font-black text-white shadow-sm hover:bg-emerald-400 sm:px-3 sm:py-1.5 sm:text-[11px]"
                >
                  <RefreshCw className="size-3" />
                  Đổi sang {focusedBestAlt.name}
                </button>
              )}
            </div>
          )}

          {/* Sleek Frosted Dark-Glass Focused Stop Bar */}
          <div className="pointer-events-auto flex items-center gap-2.5 rounded-2xl border border-white/20 bg-slate-950/88 p-2.5 text-white shadow-2xl backdrop-blur-xl sm:gap-3 sm:p-3">
            {focusedStop.imageUrl ? (
              <img
                src={focusedStop.imageUrl}
                alt={focusedStop.title}
                className="size-12 shrink-0 rounded-xl object-cover ring-1 ring-white/20 sm:size-16"
              />
            ) : (
              <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-base font-black text-white sm:size-14 sm:text-lg">
                #{focusedStop.orderIndex}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/25 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-300 ring-1 ring-emerald-400/40">
                  <Sparkles className="size-2.5" /> #{focusedStop.orderIndex}/{stops.length}
                </span>
                <span className="text-[10px] font-bold text-slate-300 sm:text-[11px]">
                  🕒 {focusedStop.start} – {focusedStop.end}
                </span>
                {focusedWeather && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-sky-200">
                    <Thermometer className="size-2.5" />
                    {focusedWeather.temperatureC}°C
                    <span className="hidden sm:inline"> · {focusedWeather.conditionLabel}</span>
                  </span>
                )}
                {focusedWeather && (
                  <span className="hidden items-center gap-1 text-[10px] text-slate-400 sm:inline-flex">
                    <Wind className="size-2.5" /> {focusedWeather.windSpeedKmh} km/h
                  </span>
                )}
              </div>

              <div className="mt-1 flex items-center justify-between gap-2">
                <h3 className="truncate text-xs font-black text-white sm:text-base">
                  {focusedStop.title}
                </h3>
                {focusedStop.slug && (
                  <a
                    href={`/destinations/${focusedStop.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hidden shrink-0 items-center gap-1 text-[11px] font-bold text-teal-300 hover:underline sm:inline-flex"
                  >
                    Chi tiết <ExternalLink className="size-3" />
                  </a>
                )}
              </div>

              <div className="mt-1 flex items-center justify-between gap-2">
                <p className="line-clamp-1 min-w-0 flex-1 text-[11px] text-slate-300">
                  {focusedStop.rating ? (
                    <span className="mr-1.5 inline-flex items-center gap-0.5 font-bold text-amber-300">
                      <Star className="size-3 fill-amber-400 text-amber-400" />
                      {focusedStop.rating}
                    </span>
                  ) : null}
                  {focusedStop.summary}
                </p>

                <div className="flex shrink-0 items-center gap-1">
                  {checkedInKeys.has(focusedStop.stopId) ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/25 px-2 py-0.5 text-[10px] font-extrabold text-emerald-300 ring-1 ring-emerald-400/50">
                      <CheckCircle2 className="size-3" />
                      <span className="hidden sm:inline">Đã Check-in</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void triggerAutoCheckIn(focusedStop)}
                      className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-[10px] font-extrabold text-teal-200 ring-1 ring-white/20 hover:bg-emerald-600 hover:text-white sm:px-2.5"
                      title="Điểm danh GPS nhanh tại chặng này"
                    >
                      <MapPinCheck className="size-3" /> Check-in
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={focusedStop.orderIndex <= 1}
                    onClick={() => {
                      const prev = stops[focusedStop.orderIndex - 2];
                      if (prev) onSelectStop(prev.stopId);
                    }}
                    className="grid size-7 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-35 sm:size-7"
                    title="Bay về chặng trước"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <button
                    type="button"
                    disabled={focusedStop.orderIndex >= stops.length}
                    onClick={() => {
                      const next = stops[focusedStop.orderIndex];
                      if (next) onSelectStop(next.stopId);
                    }}
                    className="grid size-7 place-items-center rounded-full bg-emerald-500 text-white hover:bg-emerald-400 disabled:opacity-35 sm:size-7"
                    title="Bay tới chặng tiếp theo"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
