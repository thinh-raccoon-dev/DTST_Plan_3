import clsx from 'clsx';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  Camera,
  CloudOff,
  Compass,
  Download,
  Eye,
  EyeOff,
  Flag,
  Flame,
  Footprints,
  Layers,
  MapPin,
  MapPinCheck,
  MapPinPlus,
  Maximize2,
  Navigation,
  Pause,
  Play,
  Radio,
  RefreshCw,
  Route,
  Sparkles,
  Square,
  Stamp,
  Trash2,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { announceBadges } from '../components/challenge/ChallengeQuiz';
import { PageContainer } from '../components/layout/PublicLayout';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { api } from '../lib/api';
import {
  calculatePolylineKm,
  deleteLocalTrackById,
  getAllLocalTracks,
  haversineDistanceKm,
  markTracksAsSynced,
  mergeServerTracksWithLocal,
  PRESET_DEMO_JOURNEYS,
  registerFootprintServiceWorker,
  resolveRoadSnappedJourney,
  resolveStopPhoto,
  saveLocalTrack,
  type CheckInPinItem,
  type LocalFootprintTrack,
  type MemoryPin,
  type PresetJourneyRoute,
  type TrackPoint,
} from '../lib/footprintOfflineStore';
import { downloadFootprintShareCard } from '../lib/footprintShareCard';
import { toast } from '../stores/toastStore';
import type { BadgeInfo } from '../types/api';

// Use static self-contained worker from public/ so Vite dev & prod never hit 504
maplibregl.setWorkerUrl('/maplibre-gl-worker.mjs');

interface GeofenceTargetItem {
  id: string;
  name: string;
  slug: string;
  area: string;
  category: string;
  summary: string;
  imageUrl?: string;
  coordinates: { lat: number; lng: number };
  isCheckedIn: boolean;
}

const GEOFENCE_CACHE_KEY = 'dtst_geofence_targets_v1';
const LIBERTY_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

type MapStyleMode = 'day_3d' | 'night_neon' | 'satellite';

const MAP_STYLE_LABELS: Record<MapStyleMode, { label: string; short: string }> = {
  day_3d: { label: '☀️ Sáng 3D', short: '☀️ Sáng' },
  night_neon: { label: '🌙 Đêm Neon', short: '🌙 Đêm' },
  satellite: { label: '🛰️ Vệ tinh', short: '🛰️ Vệ tinh' },
};

const MOOD_PRESETS = [
  { emoji: '🦊', label: 'Tuyệt vời hết nấc' },
  { emoji: '🌸', label: 'Cảnh đẹp mê hồn' },
  { emoji: '🍜', label: 'Ngon xuất sắc' },
  { emoji: '📸', label: 'Góc sống ảo cực chất' },
  { emoji: '🪷', label: 'Bình yên xứ Sen' },
  { emoji: '🚣', label: 'Phiêu lưu sông nước' },
];

const TRACK_COLORS = ['#10b981', '#0ea5e9', '#f43f5e', '#f59e0b', '#8b5cf6'];

let cachedLibertyStyle: any = null;

async function buildFootprintMapStyle(mode: MapStyleMode): Promise<any> {
  if (mode === 'satellite') {
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

  try {
    if (!cachedLibertyStyle) {
      const res = await fetch(LIBERTY_STYLE_URL);
      cachedLibertyStyle = await res.json();
    }
  } catch {
    // Graceful offline raster OSM fallback if OpenFreeMap style cannot be fetched
    return {
      version: 8,
      sources: {
        osm_fallback: {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '&copy; OpenStreetMap contributors',
          maxzoom: 19,
        },
      },
      layers: [{ id: 'osm-fallback', type: 'raster', source: 'osm_fallback' }],
    };
  }

  const style = JSON.parse(JSON.stringify(cachedLibertyStyle));

  if (mode === 'day_3d') {
    style.sky = {
      'sky-color': '#78bef5',
      'horizon-color': '#eef7ff',
      'fog-color': '#f2f9ff',
      'sky-horizon-blend': 0.7,
      'horizon-fog-blend': 0.6,
      'fog-ground-blend': 0.4,
    };
    for (const layer of style.layers ?? []) {
      if (layer.id === 'building-3d' || layer.type === 'fill-extrusion') {
        layer.minzoom = 13;
        layer.paint = {
          ...(layer.paint ?? {}),
          'fill-extrusion-color': '#e7dfd4',
          'fill-extrusion-opacity': 0.86,
        };
      }
    }
    return style;
  }

  // Native WebGL Dark Cyber-Neon 3D Vector style (crisp labels, glowing waterways, zero raster blur!)
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
      paint['background-color'] = '#07131e';
    } else if (layer.type === 'raster') {
      paint['raster-opacity'] = 0.14;
    } else if (layer.type === 'fill-extrusion' || id === 'building-3d') {
      layer.minzoom = 13;
      paint['fill-extrusion-color'] = '#1b3a5c';
      paint['fill-extrusion-opacity'] = 0.9;
    } else if (layer.type === 'fill') {
      if (id.includes('water')) {
        paint['fill-color'] = '#0b3354';
      } else if (
        id.includes('park') ||
        id.includes('grass') ||
        id.includes('wood') ||
        id.includes('forest') ||
        id.includes('green') ||
        id.includes('landcover')
      ) {
        paint['fill-color'] = '#0b2b27';
        if (paint['fill-outline-color']) paint['fill-outline-color'] = '#134940';
      } else if (id.includes('building')) {
        paint['fill-color'] = '#132942';
        if (paint['fill-outline-color']) paint['fill-outline-color'] = '#204269';
      } else {
        paint['fill-color'] = '#0c1d2e';
      }
    } else if (layer.type === 'line') {
      if (id.includes('water')) {
        paint['line-color'] = '#114a75';
      } else if (id.includes('boundary')) {
        paint['line-color'] = '#246273';
      } else if (id.includes('casing')) {
        paint['line-color'] = '#0a1622';
      } else if (id.includes('motorway') || id.includes('trunk') || id.includes('primary')) {
        paint['line-color'] = '#2e658f';
      } else if (id.includes('secondary') || id.includes('tertiary')) {
        paint['line-color'] = '#214866';
      } else {
        paint['line-color'] = '#17324b';
      }
    } else if (layer.type === 'symbol') {
      paint['text-color'] = id.includes('water') ? '#67d1ff' : '#eaf6ff';
      paint['text-halo-color'] = '#06111c';
      paint['text-halo-width'] = 1.6;
    }
  }

  return style;
}

function formatDurationClock(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return `${mins}p ${String(secs).padStart(2, '0')}s`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hrs}h ${remMins}p`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function FootprintMapPage() {
  useDocumentTitle('Bản đồ Dấu chân & Lộ trình 3D · Đồng Tháp Smart Travel');

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const fogCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const avatarMarkerRef = useRef<maplibregl.Marker | null>(null);
  const dashAnimRef = useRef<number>(0);

  const [mapReady, setMapReady] = useState(false);
  const [tracks, setTracks] = useState<LocalFootprintTrack[]>([]);
  const [checkInPins, setCheckInPins] = useState<CheckInPinItem[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [focusedStopIdx, setFocusedStopIdx] = useState<number | null>(null);
  const [sidebarTab, setSidebarTab] = useState<'timeline' | 'journeys'>('timeline');

  // Hands-free Automatic GPS Check-in state (Geofencing <= 1,000m)
  const [autoCheckInEnabled, setAutoCheckInEnabled] = useState(true);
  const [geofenceTargets, setGeofenceTargets] = useState<GeofenceTargetItem[]>(() => {
    try {
      const raw = localStorage.getItem(GEOFENCE_CACHE_KEY);
      return raw ? (JSON.parse(raw) as GeofenceTargetItem[]) : [];
    } catch {
      return [];
    }
  });
  const checkedInSessionRef = useRef<Set<string>>(new Set());

  // Map & Fog-of-War visual controls (Default Daylight 3D so roads, rivers & routes pop immediately!)
  const [mapStyle, setMapStyle] = useState<MapStyleMode>('day_3d');
  const [is3DView, setIs3DView] = useState(true);
  const [fogEnabled, setFogEnabled] = useState(true);
  const [fogRadiusPx, setFogRadiusPx] = useState(54);

  // Network & Offline Simulation controls
  const [browserOnline, setBrowserOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [simulateOffline, setSimulateOffline] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const isEffectiveOnline = browserOnline && !simulateOffline;

  // Live GPS Tracking state
  const [isRecordingGps, setIsRecordingGps] = useState(false);
  const [liveTrackTitle, setLiveTrackTitle] = useState('Hành trình Khám phá Đồng Tháp');
  const [livePoints, setLivePoints] = useState<TrackPoint[]>([]);
  const [liveMemories, setLiveMemories] = useState<MemoryPin[]>([]);
  const [liveStartedAt, setLiveStartedAt] = useState<number | null>(null);
  const [liveElapsedSec, setLiveElapsedSec] = useState(0);
  const watchIdRef = useRef<number | null>(null);
  const wakeLockRef = useRef<any>(null);

  // Demo Route Simulator state
  const [simulatingRouteId, setSimulatingRouteId] = useState<string | null>(null);
  const simTimerRef = useRef<number | null>(null);

  // Route Replay state
  const [isReplaying, setIsReplaying] = useState(false);
  const [replayProgress, setReplayProgress] = useState(0); // 0..100
  const [replaySpeed, setReplaySpeed] = useState<1 | 2 | 4>(2);
  const [avatarPos, setAvatarPos] = useState<{ lat: number; lng: number; label?: string } | null>(null);
  const replayTimerRef = useRef<number | null>(null);

  // Drop Memory Pin Modal state
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinCoords, setPinCoords] = useState<{ lat: number; lng: number }>({
    lat: 10.3015,
    lng: 105.7554,
  });
  const [pinEmoji, setPinEmoji] = useState(MOOD_PRESETS[0]!.emoji);
  const [pinMood, setPinMood] = useState(MOOD_PRESETS[0]!.label);
  const [pinPlaceName, setPinPlaceName] = useState('');
  const [pinNote, setPinNote] = useState('');

  const selectedTrack = useMemo(
    () => tracks.find((t) => t.clientId === selectedTrackId) || tracks[0] || null,
    [tracks, selectedTrackId],
  );

  // Register offline tile caching Service Worker
  useEffect(() => {
    registerFootprintServiceWorker();
  }, []);

  // Listen to real browser online/offline events
  useEffect(() => {
    const onOnline = () => setBrowserOnline(true);
    const onOffline = () => setBrowserOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const pendingSyncCount = useMemo(
    () => tracks.filter((t) => t.syncStatus === 'pending').length,
    [tracks],
  );

  // Sync local pending tracks with MongoDB Server when online (+ auto-seed road-snapped starter journey)
  const syncWithCloud = useCallback(
    async (silent = false) => {
      let localList = await getAllLocalTracks();

      // Auto-seed a crisp road-snapped starter journey on first visit so the map is immediately vivid & clear
      if (
        localList.length === 0 &&
        typeof window !== 'undefined' &&
        !window.sessionStorage.getItem('dtst_footprint_user_cleared')
      ) {
        const preset = PRESET_DEMO_JOURNEYS[0]!;
        const { points: starterPts, memories: starterMems } = await resolveRoadSnappedJourney(
          preset.waypoints,
          isEffectiveOnline,
        );
        const starterTrack: LocalFootprintTrack = {
          clientId: `starter-${preset.id}`,
          title: preset.title,
          color: preset.color,
          distanceKm: calculatePolylineKm(starterPts),
          durationSeconds: starterPts.length * 16,
          startedAt: Date.now() - 1800000,
          endedAt: Date.now(),
          points: starterPts,
          memories: starterMems,
          isDemoRoute: true,
          syncStatus: 'pending',
        };
        await saveLocalTrack(starterTrack);
        localList = await getAllLocalTracks();
      } else {
        // Upgrade old straight-line starter track once to real road-snapped OSRM geometry + photos
        const starterNeedsSnap =
          isEffectiveOnline &&
          typeof window !== 'undefined' &&
          !window.localStorage.getItem('dtst_starter_snapped_v2');

        let touched = false;
        const presetMemImages = new Map<string, string>();
        for (const pr of PRESET_DEMO_JOURNEYS) {
          for (const wp of pr.waypoints) {
            if (wp.placeName && wp.imageUrl) presetMemImages.set(wp.placeName, wp.imageUrl);
          }
        }
        for (const tr of localList) {
          let changed = false;
          if (starterNeedsSnap && tr.clientId === 'starter-demo-sa-dec-heritage') {
            const preset = PRESET_DEMO_JOURNEYS[0]!;
            const snapped = await resolveRoadSnappedJourney(preset.waypoints, true);
            if (snapped.roadSnapped && snapped.points.length >= 4) {
              tr.points = snapped.points;
              tr.memories = snapped.memories;
              tr.distanceKm = calculatePolylineKm(snapped.points);
              changed = true;
              window.localStorage.setItem('dtst_starter_snapped_v2', '1');
            }
          }
          for (const mem of tr.memories || []) {
            if (!mem.imageUrl && mem.placeName && presetMemImages.has(mem.placeName)) {
              mem.imageUrl = presetMemImages.get(mem.placeName);
              changed = true;
            }
          }
          if (changed) {
            touched = true;
            await saveLocalTrack(tr);
          }
        }
        if (touched) localList = await getAllLocalTracks();
      }

      setTracks(localList);
      if (!selectedTrackId && localList[0]) {
        setSelectedTrackId(localList[0].clientId);
      }

      if (!isEffectiveOnline) {
        if (!silent) {
          toast.info(
            'Đang ở chế độ Offline',
            'Hành trình & các điểm tự động điểm danh đã được lưu an toàn trong IndexedDB và sẽ tự đồng bộ khi có mạng.',
          );
        }
        return;
      }

      setIsSyncing(true);
      try {
        const pending = localList.filter((t) => t.syncStatus === 'pending');
        if (pending.length > 0) {
          const syncRes = await api.post<{
            success: boolean;
            syncedCount: number;
            autoCheckIns?: Array<{
              id: string;
              name: string;
              slug: string;
              area: string;
              category: string;
              pointsAwarded: number;
              distanceMeters: number;
            }>;
            newBadges?: BadgeInfo[];
          }>('/footprints/sync', {
            tracks: pending,
            autoCheckIn: autoCheckInEnabled,
          });
          await markTracksAsSynced(pending.map((p) => p.clientId));

          const autoList = syncRes.data?.autoCheckIns ?? [];
          if (autoList.length > 0) {
            const totalExp = autoList.reduce((acc, item) => acc + (item.pointsAwarded || 10), 0);
            const names = autoList.map((a) => a.name).join(', ');
            toast.success(
              `🛂 Tự động Điểm danh GPS (+${totalExp} EXP)!`,
              `Hệ thống tự động đóng dấu Hộ chiếu tại ${autoList.length} điểm: ${names}.`,
            );
          } else if (!silent) {
            toast.success(
              'Đã đồng bộ lên Cloud!',
              `Đã sao lưu ${pending.length} hành trình từ bộ nhớ Offline lên máy chủ.`,
            );
          }

          if (syncRes.data?.newBadges?.length) {
            announceBadges(syncRes.data.newBadges);
          }
        }

        const res = await api.get<{
          success: boolean;
          tracks: Array<{
            clientId: string;
            title: string;
            color: string;
            distanceKm: number;
            durationSeconds: number;
            startedAt: string;
            endedAt: string;
            points: TrackPoint[];
            memories: MemoryPin[];
            isDemoRoute?: boolean;
          }>;
          checkInPins: CheckInPinItem[];
          geofenceTargets?: GeofenceTargetItem[];
        }>('/footprints');

        if (res.data?.tracks) {
          const merged = await mergeServerTracksWithLocal(res.data.tracks);
          setTracks(merged);
          if (!selectedTrackId && merged[0]) {
            setSelectedTrackId(merged[0].clientId);
          }
        }
        if (res.data?.checkInPins) {
          setCheckInPins(res.data.checkInPins);
          for (const p of res.data.checkInPins) {
            checkedInSessionRef.current.add(p.destinationId);
          }
        }
        if (res.data?.geofenceTargets) {
          setGeofenceTargets(res.data.geofenceTargets);
          for (const g of res.data.geofenceTargets) {
            if (g.isCheckedIn) checkedInSessionRef.current.add(g.id);
          }
          try {
            localStorage.setItem(GEOFENCE_CACHE_KEY, JSON.stringify(res.data.geofenceTargets));
          } catch {
            // ignore
          }
        }
      } catch {
        // Offline or transient network error — local tracks stay safe in IndexedDB
      } finally {
        setIsSyncing(false);
      }
    },
    [autoCheckInEnabled, isEffectiveOnline, selectedTrackId],
  );

  useEffect(() => {
    void syncWithCloud(true);
  }, [syncWithCloud]);

  // Compute statistics across all tracks + check-ins
  const stats = useMemo(() => {
    const liveDist = calculatePolylineKm(livePoints);
    const totalKm =
      Math.round((tracks.reduce((s, t) => s + (t.distanceKm || 0), 0) + liveDist) * 100) / 100;
    const totalMemories =
      tracks.reduce((s, t) => s + (t.memories?.length || 0), 0) + liveMemories.length;

    const unlockedCells = new Set<string>();
    for (const t of tracks) {
      for (const pt of t.points) {
        unlockedCells.add(`${(pt.lat * 50).toFixed(0)}:${(pt.lng * 50).toFixed(0)}`);
      }
    }
    for (const pt of livePoints) {
      unlockedCells.add(`${(pt.lat * 50).toFixed(0)}:${(pt.lng * 50).toFixed(0)}`);
    }
    for (const pin of checkInPins) {
      unlockedCells.add(
        `${(pin.coordinates.lat * 50).toFixed(0)}:${(pin.coordinates.lng * 50).toFixed(0)}`,
      );
    }

    const exploredPercent = Math.min(
      100,
      Math.round(((unlockedCells.size + checkInPins.length * 2) / 110) * 1000) / 10,
    );

    return {
      totalKm,
      totalTracks: tracks.length + (livePoints.length > 0 ? 1 : 0),
      totalMemories,
      totalCheckIns: checkInPins.length,
      unlockedZones: unlockedCells.size,
      exploredPercent,
    };
  }, [tracks, livePoints, liveMemories, checkInPins]);

  // Compute ordered stops with segment distances for the selected track's Route Timeline
  const routeStopsWithLegs = useMemo(() => {
    if (!selectedTrack) return [];
    const mems = selectedTrack.memories || [];
    if (mems.length > 0) {
      return mems.map((m, idx) => {
        const prev = idx > 0 ? mems[idx - 1]! : null;
        const legKm = prev
          ? Math.max(0.2, Math.round(haversineDistanceKm(prev, m) * 1.18 * 10) / 10)
          : 0;
        const legMin = prev ? Math.max(2, Math.round((legKm / 30) * 60)) : 0;
        return {
          idx,
          lat: m.lat,
          lng: m.lng,
          title: m.placeName || m.moodLabel,
          emoji: m.emoji,
          moodLabel: m.moodLabel,
          note: m.note,
          imageUrl: resolveStopPhoto(m.placeName, m.imageUrl),
          legKm,
          legMin,
        };
      });
    }
    // If a GPS track has no memory pins yet, create Start & Finish anchors
    if (selectedTrack.points.length >= 2) {
      const start = selectedTrack.points[0]!;
      const end = selectedTrack.points[selectedTrack.points.length - 1]!;
      return [
        {
          idx: 0,
          lat: start.lat,
          lng: start.lng,
          title: 'Điểm xuất phát',
          emoji: '🚩',
          moodLabel: 'Bắt đầu hành trình',
          note: `Tọa độ ${start.lat.toFixed(4)}, ${start.lng.toFixed(4)}`,
          imageUrl: undefined,
          legKm: 0,
          legMin: 0,
        },
        {
          idx: 1,
          lat: end.lat,
          lng: end.lng,
          title: 'Điểm kết thúc',
          emoji: '🏁',
          moodLabel: 'Hoàn thành lộ trình',
          note: `Tổng chiều dài ${selectedTrack.distanceKm} km`,
          imageUrl: undefined,
          legKm: selectedTrack.distanceKm,
          legMin: Math.max(2, Math.round((selectedTrack.durationSeconds || 120) / 60)),
        },
      ];
    }
    return [];
  }, [selectedTrack]);

  // Fit MapLibre camera cleanly to frame 100% of a track's points
  const fitTrackBounds = useCallback(
    (pts: TrackPoint[], instant = false) => {
      const map = mapRef.current;
      if (!map || pts.length === 0) return;

      if (pts.length === 1) {
        map.flyTo({
          center: [pts[0]!.lng, pts[0]!.lat],
          zoom: 14.2,
          pitch: is3DView ? 46 : 0,
          duration: instant ? 0 : 900,
        });
        return;
      }

      const bounds = new maplibregl.LngLatBounds();
      for (const p of pts) {
        bounds.extend([p.lng, p.lat]);
      }

      map.fitBounds(bounds, {
        padding: { top: 82, bottom: 112, left: 48, right: 48 },
        pitch: is3DView ? 44 : 0,
        bearing: is3DView ? -10 : 0,
        maxZoom: 15,
        duration: instant ? 0 : 950,
      });
    },
    [is3DView],
  );

  // Frame-accurate Fog-of-War Canvas overlay synced to MapLibre GL JS projection
  const redrawFogOfWar = useCallback(() => {
    const canvas = fogCanvasRef.current;
    const map = mapRef.current;
    if (!canvas || !map) return;

    const container = map.getContainer();
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w === 0 || h === 0) return;

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);

    if (!fogEnabled) return;

    // 1. Clean translucent mist so map streets & rivers stay recognizable
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle =
      mapStyle === 'night_neon'
        ? 'rgba(5, 16, 28, 0.40)'
        : mapStyle === 'satellite'
          ? 'rgba(6, 22, 18, 0.34)'
          : 'rgba(15, 47, 37, 0.22)';
    ctx.fillRect(0, 0, w, h);

    // 2. Carve glowing clear corridors along GPS trails, live points, memories & check-ins
    ctx.globalCompositeOperation = 'destination-out';
    const zoom = map.getZoom();
    const scaleFactor = Math.max(0.65, Math.min(2.3, Math.pow(1.16, zoom - 12)));
    const radius = fogRadiusPx * scaleFactor;

    const carveCircle = (lat: number, lng: number, r: number) => {
      const pt = map.project([lng, lat]);
      if (pt.x < -r || pt.y < -r || pt.x > w + r || pt.y > h + r) return;
      const grad = ctx.createRadialGradient(pt.x, pt.y, r * 0.3, pt.x, pt.y, r);
      grad.addColorStop(0, 'rgba(0,0,0,1)');
      grad.addColorStop(0.65, 'rgba(0,0,0,0.92)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
      ctx.fill();
    };

    for (const track of tracks) {
      for (const p of track.points) {
        carveCircle(p.lat, p.lng, radius);
      }
      for (const m of track.memories) {
        carveCircle(m.lat, m.lng, radius * 1.28);
      }
    }
    for (const p of livePoints) {
      carveCircle(p.lat, p.lng, radius * 1.2);
    }
    for (const pin of checkInPins) {
      carveCircle(pin.coordinates.lat, pin.coordinates.lng, radius * 1.4);
    }
    if (avatarPos) {
      carveCircle(avatarPos.lat, avatarPos.lng, radius * 1.55);
    }
    if (tracks.length === 0 && livePoints.length === 0 && checkInPins.length === 0) {
      const c = map.getCenter();
      carveCircle(c.lat, c.lng, radius * 2.2);
    }

    ctx.globalCompositeOperation = 'source-over';
  }, [fogEnabled, fogRadiusPx, mapStyle, tracks, livePoints, checkInPins, avatarPos]);

  // Synchronize WebGL GeoJSON Route Layers & Numbered Photo Markers
  const syncMapLayersAndMarkers = useCallback(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const activeTrackColor =
      livePoints.length >= 2 ? '#f43f5e' : selectedTrack?.color || '#10b981';

    // Secondary (unselected) tracks GeoJSON
    const secondaryFeatures: GeoJSON.Feature<GeoJSON.LineString>[] = [];
    for (const t of tracks) {
      if (t.points.length < 2) continue;
      if (livePoints.length < 2 && selectedTrack && t.clientId === selectedTrack.clientId) continue;
      secondaryFeatures.push({
        type: 'Feature',
        properties: { color: t.color || '#10b981' },
        geometry: {
          type: 'LineString',
          coordinates: t.points.map((p) => [p.lng, p.lat]),
        },
      });
    }

    // Active (highlighted) route GeoJSON
    const activePts = livePoints.length >= 2 ? livePoints : selectedTrack?.points || [];
    const activeFeatures: GeoJSON.Feature<GeoJSON.LineString>[] =
      activePts.length >= 2
        ? [
            {
              type: 'Feature',
              properties: { color: activeTrackColor },
              geometry: {
                type: 'LineString',
                coordinates: activePts.map((p) => [p.lng, p.lat]),
              },
            },
          ]
        : [];

    // Replayed progress trail GeoJSON (bright gold highlight behind avatar during Replay!)
    const replayFeatures: GeoJSON.Feature<GeoJSON.LineString>[] = [];
    if (isReplaying && selectedTrack && selectedTrack.points.length >= 2 && replayProgress > 1) {
      const cutIdx = Math.max(
        2,
        Math.min(
          selectedTrack.points.length,
          Math.ceil((replayProgress / 100) * selectedTrack.points.length),
        ),
      );
      replayFeatures.push({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: selectedTrack.points.slice(0, cutIdx).map((p) => [p.lng, p.lat]),
        },
      });
    }

    const secondaryData: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: secondaryFeatures,
    };
    const activeData: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: activeFeatures,
    };
    const replayData: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: replayFeatures,
    };

    const setOrAddSource = (id: string, data: GeoJSON.FeatureCollection) => {
      const src = map.getSource(id) as maplibregl.GeoJSONSource | undefined;
      if (src) {
        src.setData(data);
      } else {
        map.addSource(id, { type: 'geojson', data });
      }
    };

    setOrAddSource('fp-secondary-routes', secondaryData);
    setOrAddSource('fp-active-route', activeData);
    setOrAddSource('fp-replay-progress', replayData);

    const casingColor = mapStyle === 'night_neon' ? '#04111d' : '#ffffff';

    if (!map.getLayer('fp-secondary-line')) {
      map.addLayer({
        id: 'fp-secondary-line',
        type: 'line',
        source: 'fp-secondary-routes',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['coalesce', ['get', 'color'], '#10b981'],
          'line-width': 4,
          'line-opacity': 0.38,
          'line-dasharray': [2, 1.8],
        },
      });
    }

    if (!map.getLayer('fp-active-glow')) {
      map.addLayer({
        id: 'fp-active-glow',
        type: 'line',
        source: 'fp-active-route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': activeTrackColor,
          'line-width': 18,
          'line-blur': 8,
          'line-opacity': mapStyle === 'night_neon' ? 0.55 : 0.34,
        },
      });
    } else {
      map.setPaintProperty('fp-active-glow', 'line-color', activeTrackColor);
      map.setPaintProperty('fp-active-glow', 'line-opacity', mapStyle === 'night_neon' ? 0.55 : 0.34);
    }

    if (!map.getLayer('fp-active-casing')) {
      map.addLayer({
        id: 'fp-active-casing',
        type: 'line',
        source: 'fp-active-route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': casingColor,
          'line-width': 10,
          'line-opacity': 0.96,
        },
      });
    } else {
      map.setPaintProperty('fp-active-casing', 'line-color', casingColor);
    }

    if (!map.getLayer('fp-active-core')) {
      map.addLayer({
        id: 'fp-active-core',
        type: 'line',
        source: 'fp-active-route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': activeTrackColor,
          'line-width': 5.8,
          'line-opacity': 1,
        },
      });
    } else {
      map.setPaintProperty('fp-active-core', 'line-color', activeTrackColor);
    }

    if (!map.getLayer('fp-active-energy')) {
      map.addLayer({
        id: 'fp-active-energy',
        type: 'line',
        source: 'fp-active-route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#ffffff',
          'line-width': 2.6,
          'line-opacity': 0.85,
          'line-dasharray': [0.4, 3.2],
        },
      });
    }

    if (!map.getLayer('fp-replay-line')) {
      map.addLayer({
        id: 'fp-replay-line',
        type: 'line',
        source: 'fp-replay-progress',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#fbbf24',
          'line-width': 6.5,
          'line-opacity': 0.96,
        },
      });
    }

    // Clear and rebuild crisp Numbered Photo Markers (Zero overlapping pill clutter!)
    for (const m of markersRef.current) m.remove();
    markersRef.current = [];

    const activeStops = liveMemories.length > 0 ? liveMemories : selectedTrack?.memories || [];

    // If active route has points but no memory pins, render clear Start & End flags
    if (activePts.length >= 2 && activeStops.length === 0) {
      const startPt = activePts[0]!;
      const endPt = activePts[activePts.length - 1]!;
      const makeFlag = (emoji: string, label: string, bg: string) => {
        const el = document.createElement('div');
        el.innerHTML = `<div style="display:inline-flex;align-items:center;gap:4px;background:${bg};color:#fff;padding:4px 10px;border-radius:999px;border:2px solid #fff;font-size:11px;font-weight:800;box-shadow:0 8px 20px rgba(0,0,0,0.28);white-space:nowrap;">${emoji} ${label}</div>`;
        return el;
      };
      markersRef.current.push(
        new maplibregl.Marker({ element: makeFlag('🚩', 'Xuất phát', '#059669'), anchor: 'bottom' })
          .setLngLat([startPt.lng, startPt.lat])
          .addTo(map),
        new maplibregl.Marker({ element: makeFlag('🏁', 'Kết thúc', '#0f172a'), anchor: 'bottom' })
          .setLngLat([endPt.lng, endPt.lat])
          .addTo(map),
      );
    }

    // Render crisp Numbered Stop Pins with Real Thumbnail & Interactive Rich Popup
    activeStops.forEach((mem, idx) => {
      const isFocused = focusedStopIdx === idx;
      const isStart = idx === 0;
      const isEnd = idx === activeStops.length - 1 && activeStops.length > 1;
      const stopLabel = escapeHtml(mem.placeName || mem.moodLabel);
      const photoUrl = resolveStopPhoto(mem.placeName, mem.imageUrl);
      const roleTag = isStart ? 'XUẤT PHÁT' : isEnd ? 'ĐÍCH ĐẾN' : `CHẶNG ${idx + 1}`;

      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'fp-stop-marker group';
      el.setAttribute('aria-label', `Chặng ${idx + 1}: ${mem.placeName || mem.moodLabel}`);
      el.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;cursor:pointer;transition:transform 200ms ease;transform:${isFocused ? 'scale(1.14)' : 'scale(1)'};">
          ${
            isFocused
              ? `<div style="margin-bottom:5px;display:inline-flex;align-items:center;gap:5px;background:rgba(15,47,37,0.95);color:#fff;padding:4px 10px;border-radius:999px;border:1.5px solid ${activeTrackColor};font-size:11px;font-weight:800;white-space:nowrap;max-width:190px;box-shadow:0 10px 24px rgba(0,0,0,0.35);">
                  <span style="font-size:10px;color:#6ee7b7;flex-shrink:0">${roleTag}</span>
                  <span style="overflow:hidden;text-overflow:ellipsis">${stopLabel}</span>
                </div>`
              : ''
          }
          <div style="position:relative;width:${isFocused ? 46 : 38}px;height:${isFocused ? 46 : 38}px;border-radius:999px;border:3px solid ${isFocused ? '#ffffff' : activeTrackColor};background:#fff;box-shadow:0 8px 22px rgba(0,0,0,0.34);overflow:hidden;display:grid;place-items:center;">
            ${
              photoUrl
                ? `<img src="${escapeHtml(photoUrl)}" alt="" style="width:100%;height:100%;object-fit:cover;" />`
                : `<span style="font-size:18px;line-height:1">${mem.emoji}</span>`
            }
          </div>
          <span style="margin-top:-10px;position:relative;z-index:2;display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:22px;padding:0 5px;border-radius:999px;background:${isStart ? '#059669' : isEnd ? '#e11d48' : activeTrackColor};color:#fff;border:2px solid #fff;font-size:11px;font-weight:900;box-shadow:0 4px 10px rgba(0,0,0,0.3);">
            ${idx + 1}
          </span>
        </div>
      `;

      const popupHtml = `
        <div style="width:220px;font-family:'Be Vietnam Pro',system-ui,sans-serif;">
          ${
            photoUrl
              ? `<img src="${escapeHtml(photoUrl)}" alt="" style="width:100%;height:105px;object-fit:cover;border-radius:12px;margin-bottom:8px;" />`
              : ''
          }
          <div style="font-size:10px;font-weight:800;letter-spacing:0.06em;color:${activeTrackColor};text-transform:uppercase;">
            ${roleTag} · ${mem.emoji} ${escapeHtml(mem.moodLabel)}
          </div>
          <div style="font-size:13px;font-weight:800;color:#0f2f25;margin-top:2px;">${stopLabel}</div>
          ${
            mem.note
              ? `<p style="font-size:11px;line-height:1.45;color:#475569;margin:5px 0 0;">${escapeHtml(mem.note)}</p>`
              : ''
          }
        </div>
      `;

      const popup = new maplibregl.Popup({ offset: 24, maxWidth: '250px' }).setHTML(popupHtml);
      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([mem.lng, mem.lat])
        .setPopup(popup)
        .addTo(map);

      el.addEventListener('click', () => {
        setFocusedStopIdx(idx);
        map.flyTo({
          center: [mem.lng, mem.lat],
          zoom: Math.max(map.getZoom(), 14.6),
          pitch: is3DView ? 48 : 0,
          duration: 750,
        });
      });

      markersRef.current.push(marker);
    });

    // Render Passport Check-in Stamp Badges as sleek compact 26px emerald seals (never overlapping active numbered route stops!)
    for (const chk of checkInPins) {
      const overlapsActiveStop = activeStops.some(
        (s) =>
          haversineDistanceKm(
            { lat: s.lat, lng: s.lng },
            { lat: chk.coordinates.lat, lng: chk.coordinates.lng },
          ) < 0.25,
      );
      if (overlapsActiveStop) continue;

      const el = document.createElement('button');
      el.type = 'button';
      el.title = `Đã đóng dấu Hộ chiếu: ${chk.name}`;
      el.innerHTML = `
        <div style="display:grid;place-items:center;width:26px;height:26px;border-radius:999px;background:linear-gradient(135deg,#059669,#0d9488);color:#fff;border:2px solid #fff;box-shadow:0 4px 12px rgba(5,150,105,0.45);font-size:12px;cursor:pointer;transition:transform 150ms ease;">
          🛂
        </div>
      `;
      const popup = new maplibregl.Popup({ offset: 14 }).setHTML(`
        <div style="min-width:190px;font-family:'Be Vietnam Pro',system-ui,sans-serif;">
          <div style="font-size:10px;font-weight:800;text-transform:uppercase;color:#059669">🛂 Đã đóng dấu Hộ chiếu (+${chk.pointsAwarded}đ)</div>
          <div style="font-weight:800;font-size:13px;color:#0f2922;margin-top:2px">${escapeHtml(chk.name)}</div>
          <p style="font-size:11px;color:#475569;margin:4px 0 6px">${escapeHtml(chk.summary)}</p>
          <a href="/destinations/${encodeURIComponent(chk.slug)}" style="font-size:11px;font-weight:700;color:#059669;text-decoration:underline">Xem chi tiết địa điểm →</a>
        </div>
      `);
      markersRef.current.push(
        new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([chk.coordinates.lng, chk.coordinates.lat])
          .setPopup(popup)
          .addTo(map),
      );
    }

    redrawFogOfWar();
  }, [
    tracks,
    selectedTrack,
    livePoints,
    liveMemories,
    checkInPins,
    focusedStopIdx,
    mapStyle,
    is3DView,
    isReplaying,
    replayProgress,
    redrawFogOfWar,
  ]);

  // Initialize MapLibre GL JS 3D Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    let cancelled = false;

    const init = async () => {
      const style = await buildFootprintMapStyle(mapStyle);
      if (cancelled || !mapContainerRef.current) return;

      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style,
        center: [105.756, 10.301],
        zoom: 13.2,
        pitch: is3DView ? 44 : 0,
        bearing: is3DView ? -10 : 0,
      });

      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');

      map.on('load', () => {
        if (cancelled) return;
        setMapReady(true);
      });

      map.on('click', (e) => {
        setPinCoords({
          lat: Number(e.lngLat.lat.toFixed(6)),
          lng: Number(e.lngLat.lng.toFixed(6)),
        });
      });

      mapRef.current = map;
    };

    void init();

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(dashAnimRef.current);
      if (avatarMarkerRef.current) {
        avatarMarkerRef.current.remove();
        avatarMarkerRef.current = null;
      }
      for (const m of markersRef.current) m.remove();
      markersRef.current = [];
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      setMapReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-bind Fog-of-War redraw to every WebGL render frame
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    redrawFogOfWar();
    map.on('render', redrawFogOfWar);
    map.on('resize', redrawFogOfWar);
    return () => {
      map.off('render', redrawFogOfWar);
      map.off('resize', redrawFogOfWar);
    };
  }, [mapReady, redrawFogOfWar]);

  // Switch MapLibre 3D style cleanly without destroying map state
  const prevStyleRef = useRef<MapStyleMode>(mapStyle);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || prevStyleRef.current === mapStyle) return;
    prevStyleRef.current = mapStyle;

    let cancelled = false;
    void buildFootprintMapStyle(mapStyle).then((style) => {
      if (cancelled || !mapRef.current) return;
      map.setStyle(style);
      map.once('style.load', () => {
        if (!cancelled) syncMapLayersAndMarkers();
      });
    });

    return () => {
      cancelled = true;
    };
  }, [mapStyle, mapReady, syncMapLayersAndMarkers]);

  // Smoothly toggle 3D / 2D camera pitch
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    map.easeTo({
      pitch: is3DView ? 44 : 0,
      bearing: is3DView ? -10 : 0,
      duration: 650,
    });
  }, [is3DView, mapReady]);

  // Keep route layers & markers in sync whenever data changes
  useEffect(() => {
    if (!mapReady) return;
    syncMapLayersAndMarkers();
  }, [mapReady, syncMapLayersAndMarkers]);

  // Auto-fit full route bounds whenever user switches tracks or map finishes first load!
  const lastFittedTrackRef = useRef<string | null>(null);
  useEffect(() => {
    if (!mapReady || !selectedTrack || selectedTrack.points.length < 2) return;
    if (lastFittedTrackRef.current === selectedTrack.clientId) return;
    lastFittedTrackRef.current = selectedTrack.clientId;
    setFocusedStopIdx(0);
    fitTrackBounds(selectedTrack.points);
  }, [mapReady, selectedTrack, fitTrackBounds]);

  // Subtle animated marching light pulse along active route to make travel direction crystal clear
  useEffect(() => {
    if (!mapReady) return;
    const dashSteps: Array<[number, number, number]> = [
      [0, 3.6, 0.5],
      [0.6, 3.0, 0.5],
      [1.2, 2.4, 0.5],
      [1.8, 1.8, 0.5],
      [2.4, 1.2, 0.5],
      [3.0, 0.6, 0.5],
      [3.6, 0, 0.5],
    ];
    let step = 0;
    let lastTs = 0;

    const tick = (ts: number) => {
      const map = mapRef.current;
      if (map && ts - lastTs > 130 && map.isStyleLoaded() && map.getLayer('fp-active-energy')) {
        lastTs = ts;
        step = (step + 1) % dashSteps.length;
        try {
          map.setPaintProperty('fp-active-energy', 'line-dasharray', dashSteps[step]);
        } catch {
          // ignore while switching styles
        }
      }
      dashAnimRef.current = window.requestAnimationFrame(tick);
    };

    dashAnimRef.current = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(dashAnimRef.current);
  }, [mapReady]);

  // Moving Pé Meko 🦊 Beacon during Replay / Demo / Live GPS
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (!avatarPos) {
      if (avatarMarkerRef.current) {
        avatarMarkerRef.current.remove();
        avatarMarkerRef.current = null;
      }
      return;
    }

    if (!avatarMarkerRef.current) {
      const el = document.createElement('div');
      el.innerHTML = `
        <div style="position:relative;display:flex;align-items:center;justify-content:center;width:46px;height:46px;">
          <span style="position:absolute;inset:0;border-radius:999px;background:rgba(16,185,129,0.45);animation:ping 1.4s cubic-bezier(0,0,0.2,1) infinite;"></span>
          <span style="position:relative;display:grid;place-items:center;width:38px;height:38px;border-radius:999px;background:linear-gradient(135deg,#059669,#14b8a6);border:3px solid white;box-shadow:0 8px 24px rgba(0,0,0,0.42);font-size:20px;">🦊</span>
        </div>
      `;
      avatarMarkerRef.current = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([avatarPos.lng, avatarPos.lat])
        .addTo(map);
    } else {
      avatarMarkerRef.current.setLngLat([avatarPos.lng, avatarPos.lat]);
    }
    redrawFogOfWar();
  }, [avatarPos, mapReady, redrawFogOfWar]);

  // Timer for live GPS recording elapsed seconds
  useEffect(() => {
    if (!isRecordingGps || !liveStartedAt) return;
    const id = window.setInterval(() => {
      setLiveElapsedSec(Math.floor((Date.now() - liveStartedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [isRecordingGps, liveStartedAt]);

  // Hands-Free Automatic GPS Geofence Check-in (triggers <= 1,000m)
  const checkAndTriggerGeofence = useCallback(
    async (lat: number, lng: number) => {
      if (!autoCheckInEnabled || geofenceTargets.length === 0) return;

      for (const target of geofenceTargets) {
        if (target.isCheckedIn || checkedInSessionRef.current.has(target.id)) continue;

        const distKm = haversineDistanceKm(
          { lat, lng },
          { lat: target.coordinates.lat, lng: target.coordinates.lng },
        );
        if (distKm <= 1.0) {
          checkedInSessionRef.current.add(target.id);
          const distMeters = Math.round(distKm * 1000);

          const optimisticPin: CheckInPinItem = {
            id: `auto-chk-${target.id}-${Date.now()}`,
            destinationId: target.id,
            name: target.name,
            slug: target.slug,
            area: target.area,
            category: target.category,
            summary: target.summary,
            imageUrl: target.imageUrl,
            coordinates: target.coordinates,
            pointsAwarded: 15,
            checkedInAt: new Date().toISOString(),
          };
          setCheckInPins((prev) =>
            prev.some((p) => p.destinationId === target.id) ? prev : [optimisticPin, ...prev],
          );
          setGeofenceTargets((prev) =>
            prev.map((g) => (g.id === target.id ? { ...g, isCheckedIn: true } : g)),
          );

          if (isEffectiveOnline) {
            try {
              const res = await api.post<{
                created: boolean;
                pointsAwarded: number;
                newBadges: BadgeInfo[];
              }>(`/destinations/${target.slug}/check-in`, {
                lat,
                lng,
                isSimulated: Boolean(simulatingRouteId),
              });
              if (res.data.created) {
                toast.success(
                  `🛂 Tự động Điểm danh GPS (+${res.data.pointsAwarded} EXP)!`,
                  `Phát hiện bạn vừa đến gần "${target.name}" (${distMeters}m) và tự động đóng dấu Hộ chiếu số!`,
                );
                if (res.data.newBadges?.length) announceBadges(res.data.newBadges);
              }
            } catch {
              // handled on next sync
            }
          } else {
            toast.info(
              `🛂 Tự động Điểm danh Offline: ${target.name}`,
              `Đã ghi nhận vào máy (cách ${distMeters}m). Sẽ tự động cộng EXP khi có Wi-Fi lại!`,
            );
          }
        }
      }
    },
    [autoCheckInEnabled, geofenceTargets, isEffectiveOnline, simulatingRouteId],
  );

  // Start Live Real GPS Recording
  const handleStartLiveGps = async () => {
    if (!('geolocation' in navigator)) {
      toast.error('Thiết bị không hỗ trợ GPS', 'Hãy thử chạy Cung đường Mẫu ở tab Chuyến đi nhé!');
      return;
    }

    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      }
    } catch {
      // ignore
    }

    const startTs = Date.now();
    setLiveStartedAt(startTs);
    setLiveElapsedSec(0);
    setLivePoints([]);
    setLiveMemories([]);
    setIsRecordingGps(true);

    toast.success(
      'Đã bật ghi hành trình GPS & Tự động Điểm danh!',
      isEffectiveOnline
        ? 'Di chuyển đến bất kỳ điểm du lịch nào trong bán kính 1.000m sẽ tự động đóng dấu Hộ chiếu!'
        : 'Đang ghi ở chế độ Offline — dữ liệu vẫn lưu an toàn trong máy!',
    );

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const pt: TrackPoint = {
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
          timestamp: Date.now(),
          speedKmh: pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : undefined,
        };
        setAvatarPos({ lat: pt.lat, lng: pt.lng, label: 'Vị trí của bạn' });
        setPinCoords({ lat: pt.lat, lng: pt.lng });
        void checkAndTriggerGeofence(pt.lat, pt.lng);

        setLivePoints((prev) => {
          if (prev.length > 0) {
            const last = prev[prev.length - 1]!;
            if (haversineDistanceKm(last, pt) < 0.008) return prev;
          }
          const updated = [...prev, pt];
          mapRef.current?.easeTo({ center: [pt.lng, pt.lat], duration: 500 });
          return updated;
        });
      },
      () => {
        toast.info('Đang chờ tín hiệu GPS...', 'Nếu đang ở trong nhà, bạn có thể chạy Cung đường Mẫu!');
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 },
    );

    watchIdRef.current = watchId;
  };

  // Stop & Save Live GPS Recording
  const handleStopAndSaveLiveGps = async () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
      } catch {
        // ignore
      }
      wakeLockRef.current = null;
    }

    setIsRecordingGps(false);

    if (livePoints.length === 0) {
      toast.info('Chưa ghi nhận bước di chuyển nào', 'Hãy thử chạy 1 Cung đường Mẫu để xem lộ trình 3D!');
      return;
    }

    const newTrack: LocalFootprintTrack = {
      clientId: `track-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: liveTrackTitle.trim() || `Hành trình ngày ${new Date().toLocaleDateString('vi-VN')}`,
      color: TRACK_COLORS[tracks.length % TRACK_COLORS.length] || '#10b981',
      distanceKm: calculatePolylineKm(livePoints),
      durationSeconds: liveElapsedSec || 60,
      startedAt: liveStartedAt || Date.now() - 60000,
      endedAt: Date.now(),
      points: livePoints,
      memories: liveMemories,
      syncStatus: 'pending',
    };

    await saveLocalTrack(newTrack);
    setLivePoints([]);
    setLiveMemories([]);
    lastFittedTrackRef.current = null;
    setSelectedTrackId(newTrack.clientId);
    setSidebarTab('timeline');
    await syncWithCloud(false);
  };

  // 1-Click Road-Snapped Demo Journey Simulator
  const handleRunDemoJourney = async (preset: PresetJourneyRoute) => {
    if (simTimerRef.current) {
      window.clearInterval(simTimerRef.current);
      simTimerRef.current = null;
    }
    setIsReplaying(false);
    setSimulatingRouteId(preset.id);

    const { points: fullPoints, memories: fullMemories, roadSnapped } =
      await resolveRoadSnappedJourney(preset.waypoints, isEffectiveOnline);

    if (roadSnapped) {
      toast.info(`🛣️ Đang chạy tuyến "${preset.title}"`, 'Lộ trình đã bám sát đường bộ thực tế Đồng Tháp!');
    }

    const startPt = fullPoints[0]!;
    fitTrackBounds(fullPoints);

    setLiveStartedAt(Date.now());
    setLiveTrackTitle(preset.title);
    setLivePoints([startPt]);
    setLiveMemories([]);
    setAvatarPos({ lat: startPt.lat, lng: startPt.lng, label: preset.title });
    void checkAndTriggerGeofence(startPt.lat, startPt.lng);

    let idx = 1;
    simTimerRef.current = window.setInterval(async () => {
      if (idx >= fullPoints.length) {
        if (simTimerRef.current) window.clearInterval(simTimerRef.current);
        simTimerRef.current = null;
        setSimulatingRouteId(null);

        const completedTrack: LocalFootprintTrack = {
          clientId: `track-${preset.id}-${Date.now()}`,
          title: preset.title,
          color: preset.color,
          distanceKm: calculatePolylineKm(fullPoints),
          durationSeconds: fullPoints.length * 16,
          startedAt: Date.now() - fullPoints.length * 16000,
          endedAt: Date.now(),
          points: fullPoints,
          memories: fullMemories,
          isDemoRoute: true,
          syncStatus: 'pending',
        };

        await saveLocalTrack(completedTrack);
        setLivePoints([]);
        setLiveMemories([]);
        lastFittedTrackRef.current = null;
        setSelectedTrackId(completedTrack.clientId);
        setSidebarTab('timeline');
        fitTrackBounds(fullPoints);

        if (isEffectiveOnline) {
          await syncWithCloud(false);
        } else {
          const updated = await getAllLocalTracks();
          setTracks(updated);
          toast.info(
            'Đã lưu lộ trình vào Bộ nhớ Offline (IndexedDB)!',
            `Hành trình "${preset.title}" (${completedTrack.distanceKm} km) đã lưu an toàn khi mất mạng.`,
          );
        }
        return;
      }

      const nextPt = fullPoints[idx]!;
      const partialPoints = fullPoints.slice(0, idx + 1);
      const unlockedMems = fullMemories.filter((m) =>
        partialPoints.some((p) => haversineDistanceKm(p, m) < 0.25),
      );

      setLivePoints(partialPoints);
      setLiveMemories(unlockedMems);
      setAvatarPos({ lat: nextPt.lat, lng: nextPt.lng });
      setPinCoords({ lat: nextPt.lat, lng: nextPt.lng });
      void checkAndTriggerGeofence(nextPt.lat, nextPt.lng);
      idx++;
    }, 95);
  };

  // Cinematic 3D Route Replay along the road
  useEffect(() => {
    if (!isReplaying || !selectedTrack || selectedTrack.points.length < 2) {
      if (replayTimerRef.current) {
        window.clearInterval(replayTimerRef.current);
        replayTimerRef.current = null;
      }
      return;
    }

    const totalPts = selectedTrack.points.length;
    const intervalMs = Math.max(45, Math.round(150 / replaySpeed));

    replayTimerRef.current = window.setInterval(() => {
      setReplayProgress((prev) => {
        const next = prev + 100 / totalPts;
        if (next >= 100) {
          setIsReplaying(false);
          const last = selectedTrack.points[totalPts - 1]!;
          setAvatarPos({ lat: last.lat, lng: last.lng });
          fitTrackBounds(selectedTrack.points);
          return 100;
        }
        const ptIdx = Math.min(totalPts - 1, Math.floor((next / 100) * totalPts));
        const pt = selectedTrack.points[ptIdx]!;
        setAvatarPos({ lat: pt.lat, lng: pt.lng });
        mapRef.current?.easeTo({
          center: [pt.lng, pt.lat],
          zoom: Math.max(mapRef.current.getZoom(), 14.2),
          pitch: is3DView ? 50 : 0,
          duration: intervalMs * 1.1,
        });
        return next;
      });
    }, intervalMs);

    return () => {
      if (replayTimerRef.current) {
        window.clearInterval(replayTimerRef.current);
        replayTimerRef.current = null;
      }
    };
  }, [isReplaying, replaySpeed, selectedTrack, is3DView, fitTrackBounds]);

  const handleStartReplay = (track: LocalFootprintTrack) => {
    if (track.points.length < 2) return;
    setSelectedTrackId(track.clientId);
    setReplayProgress(0);
    const first = track.points[0]!;
    setAvatarPos({ lat: first.lat, lng: first.lng });
    mapRef.current?.flyTo({
      center: [first.lng, first.lat],
      zoom: 14.3,
      pitch: is3DView ? 50 : 0,
      duration: 850,
    });
    setIsReplaying(true);
  };

  // Drop a Memory Pin (Works both Online & Offline!)
  const handleAddMemoryPin = async () => {
    const newMem: MemoryPin = {
      clientId: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      lat: pinCoords.lat,
      lng: pinCoords.lng,
      emoji: pinEmoji,
      moodLabel: pinMood,
      placeName: pinPlaceName.trim() || undefined,
      note: pinNote.trim(),
      createdAt: Date.now(),
    };

    if (isRecordingGps) {
      setLiveMemories((prev) => [...prev, newMem]);
      toast.success('Đã thả Ghim Kỷ niệm vào hành trình đang đi!');
    } else if (selectedTrack) {
      const updatedTrack: LocalFootprintTrack = {
        ...selectedTrack,
        memories: [...(selectedTrack.memories || []), newMem],
        syncStatus: 'pending',
      };
      await saveLocalTrack(updatedTrack);
      await syncWithCloud(false);
    } else {
      const standaloneTrack: LocalFootprintTrack = {
        clientId: `track-pin-${Date.now()}`,
        title: pinPlaceName.trim() || `Dấu chân kỷ niệm (${pinMood})`,
        color: '#10b981',
        distanceKm: 0.2,
        durationSeconds: 60,
        startedAt: Date.now(),
        endedAt: Date.now(),
        points: [
          { lat: pinCoords.lat, lng: pinCoords.lng, timestamp: Date.now() },
          { lat: pinCoords.lat + 0.0008, lng: pinCoords.lng + 0.0008, timestamp: Date.now() + 1000 },
        ],
        memories: [newMem],
        syncStatus: 'pending',
      };
      await saveLocalTrack(standaloneTrack);
      setSelectedTrackId(standaloneTrack.clientId);
      await syncWithCloud(false);
    }

    setPinNote('');
    setPinPlaceName('');
    setPinModalOpen(false);
  };

  const handleDeleteTrack = async (clientId: string) => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('dtst_footprint_user_cleared', '1');
    }
    await deleteLocalTrackById(clientId);
    if (isEffectiveOnline) {
      try {
        await api.delete(`/footprints/${encodeURIComponent(clientId)}`);
      } catch {
        // ignore
      }
    }
    const remaining = await getAllLocalTracks();
    setTracks(remaining);
    if (selectedTrackId === clientId) {
      lastFittedTrackRef.current = null;
      setSelectedTrackId(remaining[0]?.clientId ?? null);
    }
    toast.info('Đã xóa hành trình khỏi bản đồ');
  };

  const handleExportJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      platform: 'Đồng Tháp Smart Travel - Footprint Map 3D',
      stats,
      tracks,
      checkInPins,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dau-chan-dong-thap-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Đã xuất file sao lưu hành trình (.json)');
  };

  const handleShareCard = () => {
    if (!selectedTrack) {
      toast.info('Chưa có lộ trình để xuất ảnh', 'Hãy chọn hoặc chạy thử 1 cung đường trước nhé!');
      return;
    }
    const ok = downloadFootprintShareCard(selectedTrack, stats.exploredPercent);
    if (ok) {
      toast.success('Đã tải Thẻ Lộ trình HD (.png)!', 'Bạn có thể chia sẻ ngay lên Facebook, TikTok hoặc Instagram.');
    }
  };

  const focusStopOnMap = (idx: number, lat: number, lng: number) => {
    setFocusedStopIdx(idx);
    mapRef.current?.flyTo({
      center: [lng, lat],
      zoom: 14.8,
      pitch: is3DView ? 48 : 0,
      duration: 750,
    });
  };

  return (
    <PageContainer width="cinema">
      {/* ── Compact Cinema Command Header (Keeps 3D Map immediately above the fold!) ── */}
      <section className="tp-fade-up relative overflow-hidden rounded-panel bg-gradient-to-br from-river-950 via-leaf-900 to-teal-900 p-4 text-white shadow-raised sm:px-6 sm:py-5">
        <div
          className="pointer-events-none absolute -right-12 -top-16 size-64 rounded-full bg-emerald-400/20 blur-3xl"
          aria-hidden
        />
        <div className="relative flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-0.5 text-[11px] font-bold text-emerald-200 ring-1 ring-white/20">
                <Footprints className="size-3.5" aria-hidden />
                Bản đồ Dấu chân 3D · Đường bộ thực tế
              </span>
              <button
                type="button"
                onClick={() => {
                  const next = !simulateOffline;
                  setSimulateOffline(next);
                  toast.info(
                    next ? '🟠 Đang giả lập Mất Wi-Fi (Offline)' : '🟢 Đã bật lại Wi-Fi (Auto-Sync)',
                    next
                      ? 'Vẫn ghi GPS & lưu hành trình 100% vào IndexedDB!'
                      : 'Tự động đồng bộ hành trình lên Cloud...',
                  );
                }}
                className={clsx(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 transition',
                  !isEffectiveOnline
                    ? 'bg-amber-400/25 text-amber-100 ring-amber-300/50'
                    : 'bg-emerald-400/20 text-emerald-100 ring-emerald-300/35 hover:bg-emerald-400/30',
                )}
                title="Bấm để kiểm thử chế độ Offline-First (Mất Wi-Fi)"
              >
                {!isEffectiveOnline ? <WifiOff className="size-3" /> : <Wifi className="size-3" />}
                {!isEffectiveOnline
                  ? `Offline${pendingSyncCount > 0 ? ` (${pendingSyncCount} chờ)` : ''}`
                  : 'Cloud + Offline'}
              </button>
            </div>

            <div className="mt-2 flex flex-wrap items-baseline gap-x-5 gap-y-1">
              <h1 className="text-xl font-black tracking-tight text-white sm:text-3xl">
                Bản đồ Dấu chân Khám phá
              </h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-leaf-100">
                <span className="inline-flex items-center gap-1">
                  <Flame className="size-3.5 text-amber-300" aria-hidden />
                  <strong className="text-white">{stats.exploredPercent}%</strong> Đồng Tháp
                </span>
                <span>
                  📏 <strong className="text-white">{stats.totalKm} km</strong>
                </span>
                <span>
                  🧭 <strong className="text-white">{stats.totalTracks}</strong> hành trình
                </span>
                <span>
                  🛂 <strong className="text-white">{stats.totalCheckIns + stats.totalMemories}</strong> điểm dấu
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isRecordingGps ? (
              <button
                type="button"
                onClick={() => void handleStartLiveGps()}
                className="inline-flex items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-rose-500 to-amber-500 px-4 py-2 text-xs font-extrabold text-white shadow-lg shadow-rose-600/30 transition hover:scale-105"
              >
                <Radio className="size-3.5 shrink-0 animate-pulse" />
                Ghi GPS thực tế
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleStopAndSaveLiveGps()}
                className="inline-flex items-center justify-center gap-1.5 rounded-full bg-rose-600 px-4 py-2 text-xs font-extrabold text-white ring-4 ring-rose-400/40 animate-pulse"
              >
                <Square className="size-3.5 shrink-0 fill-white" />
                Dừng ({formatDurationClock(liveElapsedSec)})
              </button>
            )}

            <button
              type="button"
              onClick={() => setPinModalOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 rounded-full bg-white/15 px-3.5 py-2 text-xs font-bold text-white ring-1 ring-white/25 backdrop-blur-sm transition hover:bg-white/25"
            >
              <MapPinPlus className="size-3.5 text-amber-300" />
              Thả Ghim
            </button>

            <button
              type="button"
              onClick={handleShareCard}
              className="inline-flex items-center justify-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-xs font-extrabold text-leaf-900 shadow-sm transition hover:bg-leaf-50"
              title="Xuất ảnh Poster Lộ trình chất lượng cao (.png)"
            >
              <Camera className="size-3.5 text-leaf-700" />
              Lưu ảnh HD
            </button>
          </div>
        </div>
      </section>

      {/* ── Main Cinema Split Stage: 3D Vector Map (Left) + Step-by-Step Route Studio (Right) ── */}
      <div className="mt-4 grid gap-4 sm:mt-5 sm:gap-5 lg:grid-cols-[1fr_390px] lg:items-start">
        {/* Left: Full-Height MapLibre 3D Interactive Stage */}
        <div className="min-w-0 space-y-3">
          {/* Sleek Map Controls Bar */}
          <div className="flex flex-nowrap items-center justify-between gap-2 overflow-x-auto rounded-2xl border border-sand-200 bg-white px-2.5 py-2 shadow-2xs no-scrollbar sm:flex-wrap sm:overflow-visible sm:px-3">
            <div className="flex shrink-0 items-center gap-1">
              {(Object.keys(MAP_STYLE_LABELS) as MapStyleMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setMapStyle(mode)}
                  className={clsx(
                    'shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold transition',
                    mapStyle === mode
                      ? 'bg-leaf-700 text-white shadow-xs'
                      : 'bg-sand-100 text-river-700 hover:bg-sand-200',
                  )}
                >
                  <span className="hidden sm:inline">{MAP_STYLE_LABELS[mode].label}</span>
                  <span className="sm:hidden">{MAP_STYLE_LABELS[mode].short}</span>
                </button>
              ))}
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIs3DView((v) => !v)}
                className={clsx(
                  'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-extrabold transition',
                  is3DView
                    ? 'bg-river-900 text-emerald-200 ring-1 ring-emerald-400/40'
                    : 'bg-sand-100 text-river-700 hover:bg-sand-200',
                )}
                title="Chuyển góc nhìn nghiêng 3D / Phẳng 2D"
              >
                <Layers className="size-3.5" />
                {is3DView ? 'Góc 3D' : 'Phẳng 2D'}
              </button>

              <button
                type="button"
                onClick={() => {
                  const pts = livePoints.length >= 2 ? livePoints : selectedTrack?.points || [];
                  if (pts.length > 0) fitTrackBounds(pts);
                }}
                className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-leaf-50 px-3 py-1.5 text-xs font-extrabold text-leaf-800 ring-1 ring-leaf-200 transition hover:bg-leaf-100"
                title="Tự động thu phóng để thấy toàn bộ lộ trình"
              >
                <Maximize2 className="size-3.5" />
                Toàn tuyến
              </button>

              <button
                type="button"
                onClick={() => setFogEnabled((v) => !v)}
                className={clsx(
                  'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-extrabold transition',
                  fogEnabled
                    ? 'bg-teal-50 text-teal-900 ring-1 ring-teal-300'
                    : 'bg-sand-100 text-river-600 hover:bg-sand-200',
                )}
              >
                {fogEnabled ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                Sương mù
              </button>

              {fogEnabled && (
                <label className="hidden items-center gap-1.5 pl-1 text-[11px] font-semibold text-river-600 xl:flex">
                  <span>Độ mở:</span>
                  <input
                    type="range"
                    min={32}
                    max={88}
                    value={fogRadiusPx}
                    onChange={(e) => setFogRadiusPx(Number(e.target.value))}
                    className="w-16 accent-leaf-600"
                  />
                </label>
              )}
            </div>
          </div>

          {/* 3D WebGL Map Canvas Container */}
          <div className="isolate relative z-0 h-[58dvh] min-h-[410px] w-full overflow-hidden rounded-3xl border border-sand-300 bg-river-950 shadow-raised sm:h-[580px]">
            <div ref={mapContainerRef} className="size-full" />
            <canvas
              ref={fogCanvasRef}
              className="pointer-events-none absolute inset-0 z-10"
            />

            {/* Floating Top-Left Active Route Pill inside Map */}
            {selectedTrack && (
              <div className="pointer-events-none absolute left-3 top-3 z-20 flex max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-2xl border border-white/25 bg-river-950/85 px-3 py-2 text-white shadow-xl backdrop-blur-md">
                <span
                  className="size-3 shrink-0 rounded-full ring-2 ring-white/70"
                  style={{ backgroundColor: selectedTrack.color || '#10b981' }}
                />
                <div className="min-w-0">
                  <p className="truncate text-xs font-extrabold leading-tight">
                    {selectedTrack.title}
                  </p>
                  <p className="mt-0.5 flex items-center gap-2 text-[10px] font-semibold text-emerald-200">
                    <span>📏 {selectedTrack.distanceKm} km</span>
                    <span>·</span>
                    <span>📍 {routeStopsWithLegs.length} chặng</span>
                    {autoCheckInEnabled && (
                      <>
                        <span>·</span>
                        <span className="text-teal-200">🛂 Auto Check-in</span>
                      </>
                    )}
                  </p>
                </div>
              </div>
            )}

            {/* Floating Bottom Replay HUD inside Map */}
            {selectedTrack && selectedTrack.points.length >= 2 && (
              <div className="absolute bottom-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/25 bg-river-950/90 px-3 py-2.5 text-white shadow-2xl backdrop-blur-md sm:bottom-4 sm:left-4 sm:right-4 sm:px-4">
                <div className="flex min-w-0 items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (isReplaying) {
                        setIsReplaying(false);
                      } else {
                        handleStartReplay(selectedTrack);
                      }
                    }}
                    className="grid size-9 shrink-0 place-items-center rounded-full bg-emerald-500 text-white shadow-md transition hover:scale-105 hover:bg-emerald-400"
                    title={isReplaying ? 'Tạm dừng' : 'Phát lại hành trình 3D'}
                  >
                    {isReplaying ? (
                      <Pause className="size-4" />
                    ) : (
                      <Play className="size-4 translate-x-0.5 fill-white" />
                    )}
                  </button>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-extrabold text-white">
                      {isReplaying ? '🦊 Đang bay theo lộ trình...' : '🎬 Bay phát lại 3D theo đường thật'}
                    </p>
                    <p className="truncate text-[11px] text-teal-200">
                      Kéo thanh trượt để xem từng chặng trên tuyến đường
                    </p>
                  </div>
                </div>

                <div className="flex min-w-[140px] max-w-xs flex-1 items-center gap-2.5">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(replayProgress)}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setReplayProgress(val);
                      const idx = Math.min(
                        selectedTrack.points.length - 1,
                        Math.floor((val / 100) * selectedTrack.points.length),
                      );
                      const pt = selectedTrack.points[idx];
                      if (pt) {
                        setAvatarPos({ lat: pt.lat, lng: pt.lng });
                        mapRef.current?.easeTo({ center: [pt.lng, pt.lat], duration: 250 });
                      }
                    }}
                    className="w-full accent-emerald-400"
                  />
                  <span className="w-8 text-right text-[11px] font-bold tabular-nums text-teal-200">
                    {Math.round(replayProgress)}%
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  {([1, 2, 4] as const).map((spd) => (
                    <button
                      key={spd}
                      type="button"
                      onClick={() => setReplaySpeed(spd)}
                      className={clsx(
                        'rounded-lg px-2 py-1 text-[11px] font-extrabold transition',
                        replaySpeed === spd
                          ? 'bg-emerald-500 text-white'
                          : 'bg-white/10 text-leaf-100 hover:bg-white/20',
                      )}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: 2-Tab Interactive Route Studio (Step-by-Step Timeline + Journeys & Demos) */}
        <aside className="min-w-0 space-y-4">
          <Card className="overflow-hidden p-0">
            {/* Clean 2-Tab Switcher */}
            <div className="grid grid-cols-2 border-b border-sand-200 bg-sand-50/80 p-1.5">
              <button
                type="button"
                onClick={() => setSidebarTab('timeline')}
                className={clsx(
                  'inline-flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-extrabold transition',
                  sidebarTab === 'timeline'
                    ? 'bg-white text-leaf-800 shadow-sm ring-1 ring-sand-200'
                    : 'text-river-600 hover:text-river-900',
                )}
              >
                <Route className="size-3.5" />
                Lộ trình ({routeStopsWithLegs.length})
              </button>
              <button
                type="button"
                onClick={() => setSidebarTab('journeys')}
                className={clsx(
                  'inline-flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-extrabold transition',
                  sidebarTab === 'journeys'
                    ? 'bg-white text-leaf-800 shadow-sm ring-1 ring-sand-200'
                    : 'text-river-600 hover:text-river-900',
                )}
              >
                <Compass className="size-3.5" />
                Chuyến đi ({tracks.length})
              </button>
            </div>

            {sidebarTab === 'timeline' ? (
              <div className="p-4">
                {selectedTrack && routeStopsWithLegs.length > 0 ? (
                  <>
                    <div className="flex items-start justify-between gap-2 pb-3 border-b border-sand-100">
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-leaf-700">
                          Bấm từng chặng để định vị trên bản đồ 3D
                        </p>
                        <h2 className="mt-0.5 truncate text-sm font-extrabold text-river-900">
                          {selectedTrack.title}
                        </h2>
                      </div>
                      <button
                        type="button"
                        onClick={() => fitTrackBounds(selectedTrack.points)}
                        className="shrink-0 whitespace-nowrap rounded-full bg-leaf-50 px-2.5 py-1 text-[11px] font-bold text-leaf-800 ring-1 ring-leaf-200 hover:bg-leaf-100"
                      >
                        Toàn tuyến
                      </button>
                    </div>

                    {/* Quick Action Bar at Top (Always clear of floating Pé Meko orb!) */}
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleStartReplay(selectedTrack)}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-leaf-700 py-2 text-xs font-extrabold text-white shadow-xs transition hover:bg-leaf-800"
                      >
                        <Play className="size-3.5 fill-white" />
                        Bay phát lại 3D
                      </button>
                      <button
                        type="button"
                        onClick={handleShareCard}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-sand-300 bg-white py-2 text-xs font-bold text-river-800 transition hover:border-leaf-400 hover:bg-leaf-50"
                      >
                        <Camera className="size-3.5 text-leaf-700" />
                        Tải ảnh HD
                      </button>
                    </div>

                    {/* Visual Vertical Connected Stop-by-Stop Stepper */}
                    <ol className="mt-3 max-h-[410px] space-y-2 overflow-y-auto pr-1">
                      {routeStopsWithLegs.map((stop, i) => {
                        const isFocused = focusedStopIdx === i;
                        const isStart = i === 0;
                        const isEnd = i === routeStopsWithLegs.length - 1 && routeStopsWithLegs.length > 1;
                        const color = selectedTrack.color || '#10b981';

                        return (
                          <li key={`${stop.title}-${i}`} className="relative">
                            {/* Leg distance connector pill between stops */}
                            {i > 0 && (
                              <div className="mb-2 ml-4 flex items-center gap-2 border-l-2 border-dashed border-leaf-300 py-1 pl-4 text-[11px] font-semibold text-river-500">
                                <Navigation className="size-3 shrink-0 text-leaf-600" aria-hidden />
                                <span>
                                  Di chuyển <strong className="text-river-800">{stop.legKm} km</strong> · ~{stop.legMin} phút
                                </span>
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={() => focusStopOnMap(i, stop.lat, stop.lng)}
                              className={clsx(
                                'group flex w-full items-start gap-3 rounded-2xl border p-2.5 text-left transition-all',
                                isFocused
                                  ? 'border-leaf-500 bg-leaf-50/75 shadow-sm ring-1 ring-leaf-300'
                                  : 'border-sand-200 bg-white hover:border-leaf-300 hover:bg-sand-50/60',
                              )}
                            >
                              {/* Numbered Stop Circle + Photo Thumbnail */}
                              <div className="relative shrink-0">
                                {stop.imageUrl ? (
                                  <img
                                    src={stop.imageUrl}
                                    alt={stop.title}
                                    className="size-12 rounded-xl object-cover ring-2 ring-white shadow-xs"
                                  />
                                ) : (
                                  <span className="grid size-12 place-items-center rounded-xl bg-sand-100 text-xl">
                                    {stop.emoji}
                                  </span>
                                )}
                                <span
                                  className="absolute -left-1.5 -top-1.5 grid size-5 place-items-center rounded-full text-[10px] font-black text-white ring-2 ring-white shadow"
                                  style={{
                                    backgroundColor: isStart ? '#059669' : isEnd ? '#e11d48' : color,
                                  }}
                                >
                                  {i + 1}
                                </span>
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={clsx(
                                      'shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase',
                                      isStart
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : isEnd
                                          ? 'bg-rose-100 text-rose-800'
                                          : 'bg-sand-100 text-river-600',
                                    )}
                                  >
                                    {isStart ? '🚩 Xuất phát' : isEnd ? '🏁 Đích đến' : `Chặng ${i + 1}`}
                                  </span>
                                  <span className="truncate text-[10px] font-semibold text-river-500">
                                    {stop.emoji} {stop.moodLabel}
                                  </span>
                                </div>
                                <p className="mt-1 truncate text-xs font-extrabold text-river-900 group-hover:text-leaf-800">
                                  {stop.title}
                                </p>
                                {stop.note && (
                                  <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-river-600">
                                    {stop.note}
                                  </p>
                                )}
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ol>
                  </>
                ) : (
                  <div className="rounded-2xl border border-dashed border-sand-300 bg-sand-50/70 p-6 text-center">
                    <Flag className="mx-auto size-8 text-leaf-600 opacity-75" />
                    <p className="mt-2 text-xs font-extrabold text-river-900">Chưa có lộ trình nào được chọn</p>
                    <p className="mt-1 text-[11px] text-river-500">
                      Hãy chạy thử ngay một cung đường mẫu bám sát đường thực tế bên dưới!
                    </p>
                    <button
                      type="button"
                      onClick={() => void handleRunDemoJourney(PRESET_DEMO_JOURNEYS[0]!)}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-leaf-700 px-4 py-2 text-xs font-extrabold text-white hover:bg-leaf-800"
                    >
                      <Play className="size-3.5 fill-white" /> Chạy Cung đường Sa Đéc
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4 p-4">
                {/* 1-Click Road-Snapped Demo Routes */}
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex items-center gap-1.5 text-xs font-extrabold text-river-900">
                      <Zap className="size-3.5 text-amber-500" />
                      Chạy thử Cung đường Mẫu (Đường thật)
                    </p>
                  </div>
                  <div className="mt-2 space-y-2">
                    {PRESET_DEMO_JOURNEYS.map((route) => {
                      const isRunning = simulatingRouteId === route.id;
                      return (
                        <button
                          key={route.id}
                          type="button"
                          disabled={Boolean(simulatingRouteId)}
                          onClick={() => void handleRunDemoJourney(route)}
                          className={clsx(
                            'flex w-full items-center justify-between gap-2.5 rounded-2xl border p-3 text-left transition-all',
                            isRunning
                              ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200'
                              : 'border-sand-200 bg-sand-50/60 hover:border-leaf-400 hover:bg-white',
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span
                                className="size-2.5 shrink-0 rounded-full"
                                style={{ backgroundColor: route.color }}
                              />
                              <p className="truncate text-xs font-extrabold text-river-900">
                                {route.title}
                              </p>
                            </div>
                            <p className="mt-0.5 line-clamp-1 text-[11px] text-river-500">
                              {route.subtitle}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-extrabold text-leaf-700 ring-1 ring-sand-200">
                            {isRunning ? '🦊 Đang chạy' : '▶️ Chạy'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Saved / Offline Tracks List */}
                <div className="border-t border-sand-200 pt-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-extrabold text-river-900">
                      Nhật ký đã lưu ({tracks.length})
                    </p>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={isSyncing || !isEffectiveOnline}
                        onClick={() => void syncWithCloud(false)}
                        className="inline-flex items-center gap-1 rounded-full bg-sand-100 px-2.5 py-1 text-[11px] font-bold text-river-700 hover:bg-leaf-50 disabled:opacity-40"
                        title="Đồng bộ lên Cloud"
                      >
                        <RefreshCw className={clsx('size-3', isSyncing && 'animate-spin')} />
                        Sync
                      </button>
                      <button
                        type="button"
                        onClick={handleExportJson}
                        className="inline-flex items-center gap-1 rounded-full bg-sand-100 px-2.5 py-1 text-[11px] font-bold text-river-700 hover:bg-leaf-50"
                        title="Tải file JSON sao lưu"
                      >
                        <Download className="size-3" />
                        JSON
                      </button>
                    </div>
                  </div>

                  <div className="mt-2.5 max-h-[240px] space-y-2 overflow-y-auto pr-1">
                    {tracks.map((t) => {
                      const isSelected = t.clientId === (selectedTrack?.clientId ?? '');
                      return (
                        <div
                          key={t.clientId}
                          onClick={() => {
                            lastFittedTrackRef.current = null;
                            setSelectedTrackId(t.clientId);
                            setSidebarTab('timeline');
                          }}
                          className={clsx(
                            'cursor-pointer rounded-2xl border p-3 transition-all',
                            isSelected
                              ? 'border-leaf-500 bg-leaf-50/60 ring-1 ring-leaf-300'
                              : 'border-sand-200 bg-white hover:border-leaf-300',
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                              <span
                                className="size-2.5 shrink-0 rounded-full"
                                style={{ backgroundColor: t.color || '#10b981' }}
                              />
                              <h3 className="truncate text-xs font-extrabold text-river-900">
                                {t.title}
                              </h3>
                            </div>
                            <span
                              className={clsx(
                                'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold',
                                t.syncStatus === 'pending'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-100 text-emerald-800',
                              )}
                            >
                              {t.syncStatus === 'pending' ? 'Offline' : 'Cloud'}
                            </span>
                          </div>
                          <div className="mt-1.5 flex items-center justify-between text-[11px] text-river-600">
                            <span>
                              📏 {t.distanceKm} km · 📍 {t.memories?.length || 0} chặng
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleDeleteTrack(t.clientId);
                              }}
                              className="rounded-lg p-1 text-river-400 hover:bg-rose-50 hover:text-rose-600"
                              title="Xóa hành trình"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Compact Auto Check-In & Passport Connection Card */}
          <Card className="bg-gradient-to-br from-leaf-900 to-river-950 p-4 text-white">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/15 text-teal-200">
                  <Stamp className="size-5" />
                </span>
                <div>
                  <h3 className="text-sm font-extrabold text-white">Hộ chiếu & Auto Check-in</h3>
                  <p className="text-[11px] text-leaf-100">
                    {checkInPins.length} điểm đã đóng dấu trên bản đồ
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const next = !autoCheckInEnabled;
                  setAutoCheckInEnabled(next);
                  toast.info(
                    next ? 'Đã BẬT Tự động Check-in (<1km)' : 'Đã TẮT Tự động Check-in',
                  );
                }}
                className={clsx(
                  'inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold transition',
                  autoCheckInEnabled
                    ? 'bg-emerald-500 text-white'
                    : 'bg-white/15 text-leaf-100 hover:bg-white/25',
                )}
              >
                <MapPinCheck className="size-3" />
                {autoCheckInEnabled ? 'Auto: BẬT' : 'Auto: TẮT'}
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                to="/check-in"
                className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-3.5 py-1.5 text-xs font-extrabold text-white hover:bg-emerald-400"
              >
                <MapPin className="size-3.5" /> Điểm danh GPS
              </Link>
              <Link
                to="/passport"
                className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-white/25"
              >
                Xem Hộ chiếu số →
              </Link>
              <button
                type="button"
                onClick={() => setSimulateOffline((v) => !v)}
                className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-bold text-amber-200 hover:bg-white/20"
              >
                <CloudOff className="size-3" />
                {simulateOffline ? 'Bật lại Wi-Fi' : 'Test Offline'}
              </button>
            </div>
          </Card>
        </aside>
      </div>

      {/* ── Drop Memory Pin Modal ─────────────────────────────────────── */}
      {pinModalOpen && (
        <div className="fixed inset-0 z-[1050] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div className="tp-scale-up w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-sand-200">
            <div className="flex items-start justify-between">
              <div>
                <span className="inline-flex items-center gap-1 rounded-full bg-leaf-50 px-2.5 py-0.5 text-[11px] font-bold text-leaf-700">
                  <Sparkles className="size-3" /> Ghim Kỷ Niệm trên Lộ trình
                </span>
                <h3 className="mt-1 text-lg font-extrabold text-river-900">
                  Thả Ghim Kỷ Niệm
                </h3>
                <p className="text-xs text-river-500">
                  Tọa độ: {pinCoords.lat.toFixed(4)}, {pinCoords.lng.toFixed(4)} (Chạm vào bản đồ để đổi điểm)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPinModalOpen(false)}
                className="rounded-xl p-1 text-river-400 hover:bg-sand-100 hover:text-river-700"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-river-700">Chọn Sticker Cảm xúc</label>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  {MOOD_PRESETS.map((m) => {
                    const active = pinEmoji === m.emoji && pinMood === m.label;
                    return (
                      <button
                        key={m.label}
                        type="button"
                        onClick={() => {
                          setPinEmoji(m.emoji);
                          setPinMood(m.label);
                        }}
                        className={clsx(
                          'flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-bold transition',
                          active
                            ? 'border-leaf-600 bg-leaf-50 text-leaf-900 ring-2 ring-leaf-200'
                            : 'border-sand-200 bg-white text-river-700 hover:bg-sand-50',
                        )}
                      >
                        <span className="text-base">{m.emoji}</span>
                        <span className="truncate">{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-river-700">Tên địa điểm / Góc check-in</label>
                <input
                  type="text"
                  value={pinPlaceName}
                  onChange={(e) => setPinPlaceName(e.target.value)}
                  placeholder="Ví dụ: Cầu tàu Làng hoa Sa Đéc..."
                  className="mt-1 w-full rounded-xl border border-sand-300 px-3 py-2 text-base text-river-900 focus:border-leaf-500 focus:outline-none sm:text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-river-700">Ghi chú kỷ niệm</label>
                <textarea
                  rows={2}
                  value={pinNote}
                  onChange={(e) => setPinNote(e.target.value)}
                  placeholder="Lưu lại cảm xúc hoặc mẹo nhỏ tại tọa độ này..."
                  className="mt-1 w-full rounded-xl border border-sand-300 px-3 py-2 text-base text-river-900 focus:border-leaf-500 focus:outline-none sm:text-xs"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setPinModalOpen(false)}>
                Hủy
              </Button>
              <Button type="button" size="sm" onClick={() => void handleAddMemoryPin()}>
                📍 Thả Ghim lên Bản đồ
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
