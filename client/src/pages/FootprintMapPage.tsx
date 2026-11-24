import clsx from 'clsx';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  Camera,
  Check,
  Compass,
  FolderHeart,
  Globe2,
  Images,
  Layers,
  LocateFixed,
  Map as MapIcon,
  Minus,
  Moon,
  Navigation,
  Plus,
  Route,
  Search,
  Sparkles,
  Sun,
  Upload,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { announceBadges } from '../components/challenge/ChallengeQuiz';
import { JourneyDrawer } from '../components/footprints/JourneyDrawer';
import { PhotoCaptureModal, type PhotoCaptureInitialMode } from '../components/footprints/PhotoCaptureModal';
import { PhotoClusterDrawer } from '../components/footprints/PhotoClusterDrawer';
import { PhotoLibraryOverlay } from '../components/footprints/PhotoLibraryOverlay';
import { PhotoLightboxModal } from '../components/footprints/PhotoLightboxModal';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { api, resolveMediaUrl, toApiError } from '../lib/api';
import {
  bridgeTrackRoadGaps,
  buildFootprintOwnerKey,
  calculatePolylineKm,
  deleteLocalTrackById,
  getAllLocalTracks,
  haversineDistanceKm,
  markTracksAsSynced,
  mergeServerTracksWithLocal,
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
import {
  clusterPhotosByZoom,
  formatAreaDisplay,
  type FootprintPhotoItem,
  type GeofenceTargetItem,
  type LiveUserLocation,
  type PhotoCluster,
} from '../lib/footprintPhotoStore';
import { downloadFootprintShareCard } from '../lib/footprintShareCard';
import { useAuthStore } from '../stores/authStore';
import { useGpsAutoCheckInStore } from '../stores/gpsAutoCheckInStore';
import { getActiveRecordingKm, useGpsRecordingStore } from '../stores/gpsRecordingStore';
import { toast } from '../stores/toastStore';
import type { BadgeInfo } from '../types/api';

// Use static self-contained worker from public/ so Vite dev & prod never hit 504
maplibregl.setWorkerUrl('/maplibre-gl-worker.mjs');

const GEOFENCE_CACHE_KEY = 'dtst_geofence_targets_v1';
const USER_LOC_CACHE_KEY = 'dtst_last_known_user_loc_v1';
const LIBERTY_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

type MapStyleMode = 'atlas' | 'satellite' | 'day_3d' | 'night';
type DockViewMode = 'map' | 'library' | 'places' | 'routes';
type GpsStatus = 'locating' | 'active' | 'denied' | 'unavailable';

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
        esri_labels: {
          type: 'raster',
          tiles: [
            'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
          ],
          tileSize: 256,
          maxzoom: 19,
        },
      },
      layers: [
        { id: 'esri-satellite-layer', type: 'raster', source: 'esri_satellite', minzoom: 0, maxzoom: 22 },
        { id: 'esri-labels-layer', type: 'raster', source: 'esri_labels', minzoom: 0, maxzoom: 22 },
      ],
      sky: {
        'sky-color': '#1e4e79',
        'horizon-color': '#7ab5d6',
        'fog-color': '#88bad6',
        'sky-horizon-blend': 0.65,
        'horizon-fog-blend': 0.5,
        'fog-ground-blend': 0.4,
      },
    };
  }

  try {
    if (!cachedLibertyStyle) {
      const res = await fetch(LIBERTY_STYLE_URL);
      cachedLibertyStyle = await res.json();
    }
  } catch {
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

  if (mode === 'atlas') {
    // Rich emerald-jade land & sapphire ocean palette inspired by Apple Photos Map so white photo cards pop cleanly
    style.sky = {
      'sky-color': '#0b2545',
      'horizon-color': '#184b7a',
      'fog-color': '#123a63',
      'sky-horizon-blend': 0.72,
      'horizon-fog-blend': 0.6,
      'fog-ground-blend': 0.45,
    };
    for (const layer of style.layers ?? []) {
      const id = String(layer.id || '').toLowerCase();
      const paint = (layer.paint = layer.paint ?? {});
      if (layer.type === 'background') {
        paint['background-color'] = '#206753';
      } else if (layer.type === 'raster') {
        paint['raster-opacity'] = 0.16;
      } else if (layer.type === 'fill-extrusion' || id === 'building-3d') {
        layer.minzoom = 13.5;
        paint['fill-extrusion-color'] = '#2c7e68';
        paint['fill-extrusion-opacity'] = 0.85;
      } else if (layer.type === 'fill') {
        if (id.includes('water')) {
          paint['fill-color'] = '#133572';
        } else if (
          id.includes('park') ||
          id.includes('grass') ||
          id.includes('wood') ||
          id.includes('forest') ||
          id.includes('green') ||
          id.includes('landcover')
        ) {
          paint['fill-color'] = '#1a5a49';
          if (paint['fill-outline-color']) paint['fill-outline-color'] = '#24735e';
        } else if (id.includes('residential') || id.includes('urban') || id.includes('landuse')) {
          paint['fill-color'] = '#25705b';
        } else if (id.includes('building')) {
          paint['fill-color'] = '#2a7c66';
          if (paint['fill-outline-color']) paint['fill-outline-color'] = '#348f77';
        } else {
          paint['fill-color'] = '#206753';
        }
      } else if (layer.type === 'line') {
        if (id.includes('water')) {
          paint['line-color'] = '#1a4a96';
        } else if (id.includes('boundary')) {
          paint['line-color'] = '#6bc7b0';
        } else if (id.includes('casing')) {
          paint['line-color'] = '#164d3e';
        } else if (id.includes('motorway') || id.includes('trunk') || id.includes('primary')) {
          paint['line-color'] = '#78b8ad';
        } else if (id.includes('secondary') || id.includes('tertiary')) {
          paint['line-color'] = '#4b8f83';
        } else {
          paint['line-color'] = '#35786c';
        }
      } else if (layer.type === 'symbol') {
        paint['text-color'] = id.includes('water') ? '#93c5fd' : '#f8fafc';
        paint['text-halo-color'] = '#0d2638';
        paint['text-halo-width'] = 1.6;
      }
    }
    return style;
  }

  // Deep Midnight Dark Vector style
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
      if (id.includes('water')) paint['fill-color'] = '#0b2a4a';
      else if (id.includes('park') || id.includes('wood') || id.includes('forest') || id.includes('grass')) {
        paint['fill-color'] = '#0b2926';
      } else if (id.includes('building')) {
        paint['fill-color'] = '#132942';
      } else {
        paint['fill-color'] = '#0c1d2e';
      }
    } else if (layer.type === 'line') {
      if (id.includes('water')) paint['line-color'] = '#114a75';
      else if (id.includes('boundary')) paint['line-color'] = '#246273';
      else if (id.includes('motorway') || id.includes('trunk') || id.includes('primary')) paint['line-color'] = '#2e658f';
      else paint['line-color'] = '#17324b';
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
  return `${hrs}h ${mins % 60}p`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function FootprintMapPage() {
  useDocumentTitle('Bản đồ Dấu chân & Ký ức Ảnh · Đồng Tháp Smart Travel');

  const authUser = useAuthStore((s) => s.user);
  const authStatus = useAuthStore((s) => s.status);
  const ownerKey = buildFootprintOwnerKey(authUser?.id);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const fogCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const photoMarkersRef = useRef<maplibregl.Marker[]>([]);
  const stampMarkersRef = useRef<maplibregl.Marker[]>([]);
  const userLocationMarkerRef = useRef<maplibregl.Marker | null>(null);
  const replayAvatarMarkerRef = useRef<maplibregl.Marker | null>(null);
  const bgWatchIdRef = useRef<number | null>(null);
  const simTimerRef = useRef<number | null>(null);
  const replayTimerRef = useRef<number | null>(null);
  const hasAutoCenteredOnUserRef = useRef(false);
  const syncInFlightRef = useRef(false);

  // Map UI & Dock State
  const [mapReady, setMapReady] = useState(false);
  const [mapZoom, setMapZoom] = useState(11.6);
  const [mapStyle, setMapStyle] = useState<MapStyleMode>('atlas');
  const [is3DView, setIs3DView] = useState(false);
  const [showRoutesOnMap, setShowRoutesOnMap] = useState(true);
  const [fogEnabled, setFogEnabled] = useState(false);
  const [fogRadiusPx, setFogRadiusPx] = useState(54);
  const [layerPopoverOpen, setLayerPopoverOpen] = useState(false);
  const [dockMode, setDockMode] = useState<DockViewMode>('map');

  // Search bar state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Always-On Live Current User Location (Requirement #1 — completely independent of replay/demo!)
  const [userLocation, setUserLocation] = useState<LiveUserLocation | null>(() => {
    try {
      const raw = localStorage.getItem(USER_LOC_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as LiveUserLocation;
      if (typeof parsed?.lat === 'number' && typeof parsed?.lng === 'number') return parsed;
    } catch {
      // ignore
    }
    return null;
  });
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>('locating');
  const [followUserLocation, setFollowUserLocation] = useState(false);
  const [pickingManualLocation, setPickingManualLocation] = useState(false);
  const userLocationRef = useRef<LiveUserLocation | null>(userLocation);
  userLocationRef.current = userLocation;

  // Core Data State (Photos + Tracks + Check-ins + Geofence Targets)
  const [userPhotos, setUserPhotos] = useState<FootprintPhotoItem[]>([]);
  const [tracks, setTracks] = useState<LocalFootprintTrack[]>([]);
  const [checkInPins, setCheckInPins] = useState<CheckInPinItem[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [focusedStopIdx, setFocusedStopIdx] = useState<number | null>(null);

  // Photo Cluster Drawer, Lightbox & Capture Modal State
  const [activeClusterId, setActiveClusterId] = useState<string | null>(null);
  const [lightboxState, setLightboxState] = useState<{
    photos: FootprintPhotoItem[];
    index: number;
  } | null>(null);
  const [captureModalState, setCaptureModalState] = useState<{
    open: boolean;
    coords?: { lat: number; lng: number } | null;
    placeName?: string;
    mode?: PhotoCaptureInitialMode;
    files?: File[] | null;
  }>({ open: false });
  const quickUploadInputRef = useRef<HTMLInputElement | null>(null);

  // Geofencing Auto Check-in (<1,000m) — synced globally with the User Dropdown quick toggle
  const autoCheckInEnabled = useGpsAutoCheckInStore((s) => s.enabled);
  const toggleAutoCheckIn = useGpsAutoCheckInStore((s) => s.toggle);
  const [geofenceTargets, setGeofenceTargets] = useState<GeofenceTargetItem[]>(() => {
    try {
      const raw = localStorage.getItem(GEOFENCE_CACHE_KEY);
      return raw ? (JSON.parse(raw) as GeofenceTargetItem[]) : [];
    } catch {
      return [];
    }
  });
  const checkedInSessionRef = useRef<Set<string>>(new Set());

  // Network & Offline Sync
  const [browserOnline, setBrowserOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [simulateOffline, setSimulateOffline] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const isEffectiveOnline = browserOnline && !simulateOffline;

  // Global Persistent Live GPS Track Recording (survives navigation, screen lock wake-up, and PWA reload!)
  const recordingSession = useGpsRecordingStore((s) => s.session);
  const wakeLockActive = useGpsRecordingStore((s) => s.wakeLockActive);
  const liveGpsError = useGpsRecordingStore((s) => s.gpsError);
  const startGlobalRecording = useGpsRecordingStore((s) => s.startRecording);
  const clearGlobalRecording = useGpsRecordingStore((s) => s.clearSession);

  const isRecordingGps = Boolean(recordingSession);
  const liveStartedAt = recordingSession?.startedAt ?? null;
  const liveTrackTitle = recordingSession?.title ?? `Hành trình ngày ${new Date().toLocaleDateString('vi-VN')}`;
  const [simPoints, setSimPoints] = useState<TrackPoint[]>([]);
  const livePoints = useMemo(
    () => (isRecordingGps && recordingSession ? recordingSession.points : simPoints),
    [isRecordingGps, recordingSession, simPoints],
  );
  const liveKm = useMemo(() => getActiveRecordingKm(recordingSession), [recordingSession]);
  const [liveElapsedSec, setLiveElapsedSec] = useState(() =>
    recordingSession ? Math.max(0, Math.floor((Date.now() - recordingSession.startedAt) / 1000)) : 0,
  );
  const [isSavingLiveTrack, setIsSavingLiveTrack] = useState(false);

  // Demo Route Simulator & 3D Replay
  const [simulatingRouteId, setSimulatingRouteId] = useState<string | null>(null);
  const [isReplaying, setIsReplaying] = useState(false);
  const [replayProgress, setReplayProgress] = useState(0);
  const [replaySpeed, setReplaySpeed] = useState<1 | 2 | 4>(2);
  const [replayAvatarPos, setReplayAvatarPos] = useState<{ lat: number; lng: number } | null>(null);

  const selectedTrack = useMemo(
    () => tracks.find((t) => t.clientId === selectedTrackId) || tracks[0] || null,
    [tracks, selectedTrackId],
  );

  // Register offline tile SW & online listeners
  useEffect(() => {
    registerFootprintServiceWorker();
    const onOnline = () => setBrowserOnline(true);
    const onOffline = () => setBrowserOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // ── REQUIREMENT #1: Always-On Live Current Location Watcher ────────────────
  const persistUserLocation = useCallback((loc: LiveUserLocation) => {
    setUserLocation(loc);
    try {
      localStorage.setItem(USER_LOC_CACHE_KEY, JSON.stringify(loc));
    } catch {
      // ignore storage quota errors
    }
  }, []);

  const requestLiveLocation = useCallback(
    (flyImmediately = false) => {
      if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
        setGpsStatus('unavailable');
        if (flyImmediately) {
          toast.info(
            'Trình duyệt không có cảm biến GPS',
            'Bạn có thể chạm vào bản đồ để đặt vị trí hiện tại thủ công.',
          );
        }
        return;
      }

      setGpsStatus((prev) => (prev === 'active' ? 'active' : 'locating'));

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const nextLoc: LiveUserLocation = {
            lat: Number(pos.coords.latitude.toFixed(6)),
            lng: Number(pos.coords.longitude.toFixed(6)),
            accuracyMeters: pos.coords.accuracy || undefined,
            headingDegrees: typeof pos.coords.heading === 'number' && !Number.isNaN(pos.coords.heading) ? pos.coords.heading : null,
            speedKmh: pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : undefined,
            updatedAt: Date.now(),
            isManualFallback: false,
          };
          persistUserLocation(nextLoc);
          setGpsStatus('active');

          if (flyImmediately || !hasAutoCenteredOnUserRef.current) {
            hasAutoCenteredOnUserRef.current = true;
            setFollowUserLocation(true);
            mapRef.current?.flyTo({
              center: [nextLoc.lng, nextLoc.lat],
              zoom: Math.max(mapRef.current.getZoom(), 13.5),
              duration: 900,
            });
          }
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            setGpsStatus('denied');
            if (flyImmediately) {
              toast.info(
                'Chưa cấp quyền vị trí GPS',
                'Hãy bật quyền Vị trí trên trình duyệt hoặc bấm "Đặt vị trí trên bản đồ".',
              );
            }
          } else {
            setGpsStatus((prev) => (prev === 'active' ? 'active' : 'unavailable'));
            if (flyImmediately && userLocation) {
              mapRef.current?.flyTo({
                center: [userLocation.lng, userLocation.lat],
                zoom: 14.5,
                duration: 800,
              });
            }
          }
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 12000 },
      );

      // Start continuous background location watch so your live blue dot always moves with you
      if (bgWatchIdRef.current === null) {
        bgWatchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            const nextLoc: LiveUserLocation = {
              lat: Number(pos.coords.latitude.toFixed(6)),
              lng: Number(pos.coords.longitude.toFixed(6)),
              accuracyMeters: pos.coords.accuracy || undefined,
              headingDegrees: typeof pos.coords.heading === 'number' && !Number.isNaN(pos.coords.heading) ? pos.coords.heading : null,
              speedKmh: pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : undefined,
              updatedAt: Date.now(),
              isManualFallback: false,
            };
            persistUserLocation(nextLoc);
            setGpsStatus('active');
          },
          () => {
            // keep last known location silently
          },
          { enableHighAccuracy: true, maximumAge: 4000, timeout: 15000 },
        );
      }
    },
    [persistUserLocation, userLocation],
  );

  // Trigger always-on live location immediately on mount!
  useEffect(() => {
    requestLiveLocation(false);
    return () => {
      if (bgWatchIdRef.current !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(bgWatchIdRef.current);
        bgWatchIdRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep map centered smoothly when follow mode is active
  useEffect(() => {
    if (!followUserLocation || !userLocation || !mapReady) return;
    mapRef.current?.easeTo({
      center: [userLocation.lng, userLocation.lat],
      duration: 600,
    });
  }, [followUserLocation, userLocation, mapReady]);

  // ── Cloud Sync (Photos + Tracks + Check-ins + Geofence Targets) ────────────
  const pendingSyncCount = useMemo(
    () => tracks.filter((t) => t.syncStatus === 'pending').length,
    [tracks],
  );

  // Reset visible footprint state cleanly whenever the signed-in account changes
  useEffect(() => {
    setUserPhotos([]);
    setTracks([]);
    setCheckInPins([]);
    setSelectedTrackId(null);
    setActiveClusterId(null);
    setLightboxState(null);
    checkedInSessionRef.current = new Set();
  }, [ownerKey]);

  const syncWithCloud = useCallback(
    async (silent = false) => {
      if (syncInFlightRef.current) return;
      syncInFlightRef.current = true;

      try {
        // Load strictly user-scoped local tracks (never auto-seed fake Đồng Tháp demo routes for new users!)
        const localList = await getAllLocalTracks(ownerKey);
        setTracks(localList);
        if (!selectedTrackId && localList[0]) {
          setSelectedTrackId(localList[0].clientId);
        }

        if (!isEffectiveOnline) {
          if (!silent) {
            toast.info(
              'Đang ở chế độ Offline',
              'Hành trình đã được lưu an toàn trong IndexedDB và sẽ tự đồng bộ khi có mạng.',
            );
          }
          return;
        }

        setIsSyncing(true);
        const pending = localList.filter((t) => t.syncStatus === 'pending' && !t.isDemoRoute);
        if (pending.length > 0) {
          const syncRes = await api.post<{
            success: boolean;
            syncedCount: number;
            autoCheckIns?: Array<{ name: string; pointsAwarded: number }>;
            newBadges?: BadgeInfo[];
          }>('/footprints/sync', {
            tracks: pending,
            autoCheckIn: autoCheckInEnabled,
          });
          await markTracksAsSynced(
            pending.map((p) => p.clientId),
            ownerKey,
          );

          const autoList = syncRes.data?.autoCheckIns ?? [];
          if (autoList.length > 0) {
            const totalExp = autoList.reduce((acc, item) => acc + (item.pointsAwarded || 10), 0);
            toast.success(
              `Tự động Điểm danh GPS (+${totalExp} EXP)`,
              `Đã đóng dấu Hộ chiếu tại ${autoList.map((a) => a.name).join(', ')}.`,
            );
          } else if (!silent) {
            toast.success('Đã đồng bộ lên Cloud!', `Sao lưu thành công ${pending.length} hành trình.`);
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
          photos?: FootprintPhotoItem[];
          checkInPins: CheckInPinItem[];
          geofenceTargets?: GeofenceTargetItem[];
        }>('/footprints');

        if (res.data?.tracks) {
          const merged = await mergeServerTracksWithLocal(res.data.tracks, ownerKey);
          setTracks(merged);
          if (!selectedTrackId && merged[0]) setSelectedTrackId(merged[0].clientId);
        }
        if (Array.isArray(res.data?.photos)) {
          setUserPhotos(
            res.data.photos.map((p) => ({
              ...p,
              imageUrl: resolveMediaUrl(p.imageUrl),
              thumbnailUrl: resolveMediaUrl(p.thumbnailUrl || p.imageUrl),
            })),
          );
        }
        if (res.data?.checkInPins) {
          setCheckInPins(res.data.checkInPins);
          for (const p of res.data.checkInPins) checkedInSessionRef.current.add(p.destinationId);
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
        // Offline / transient network error — keep local data cleanly
      } finally {
        setIsSyncing(false);
        syncInFlightRef.current = false;
      }
    },
    [autoCheckInEnabled, isEffectiveOnline, ownerKey, selectedTrackId],
  );

  useEffect(() => {
    if (authStatus !== 'ready') return;
    void syncWithCloud(true);
  }, [authStatus, syncWithCloud]);

  // ── Show ONLY Real User Photos (and user-attached non-demo track photos) ──
  // New users start with a clean blank photo map (0 ảnh · 0 cụm điểm); GPS check-ins without user photos
  // appear cleanly as subtle green stamp markers instead of fake stock destination photos!
  const allMapPhotos = useMemo<FootprintPhotoItem[]>(() => {
    const combined: FootprintPhotoItem[] = [...userPhotos];
    const seenKeys = new Set(
      userPhotos.map((p) => `${p.imageUrl}|${p.coordinates.lat.toFixed(3)},${p.coordinates.lng.toFixed(3)}`),
    );

    for (const tr of tracks) {
      if (tr.isDemoRoute) continue;
      for (const m of tr.memories || []) {
        // Only include memories where the user actually attached a photo URL (never synthesize stock images)
        if (!m.imageUrl) continue;
        const photoUrl = resolveMediaUrl(m.imageUrl);
        const key = `${photoUrl}|${m.lat.toFixed(3)},${m.lng.toFixed(3)}`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
        combined.push({
          id: `mem-${tr.clientId}-${m.clientId}`,
          clientPhotoId: m.clientId,
          imageUrl: photoUrl,
          thumbnailUrl: photoUrl,
          coordinates: { lat: m.lat, lng: m.lng },
          takenAt: new Date(m.createdAt || tr.startedAt || Date.now()).toISOString(),
          placeName: m.placeName || m.moodLabel,
          area: tr.title.includes('Sa Đéc') ? 'sa-dec' : tr.title.includes('Cao Lãnh') ? 'cao-lanh' : 'dong-thap',
          trackClientId: tr.clientId,
          caption: m.note || m.moodLabel,
          sourceApp: 'journey',
          isStarterMemory: false,
        });
      }
    }

    return combined.sort((a, b) => new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime());
  }, [userPhotos, tracks]);

  // Filter photos by search bar in real time
  const visibleMapPhotos = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allMapPhotos;
    return allMapPhotos.filter(
      (p) =>
        (p.placeName || '').toLowerCase().includes(q) ||
        (p.caption || '').toLowerCase().includes(q) ||
        formatAreaDisplay(p.area).toLowerCase().includes(q),
    );
  }, [allMapPhotos, searchQuery]);

  // Zoom-responsive Apple Photos spatial clusters
  const photoClusters = useMemo(
    () => clusterPhotosByZoom(visibleMapPhotos, mapZoom),
    [visibleMapPhotos, mapZoom],
  );

  const activeCluster = useMemo<PhotoCluster | null>(() => {
    if (!activeClusterId) return null;
    const direct = photoClusters.find((c) => c.id === activeClusterId);
    if (direct) return direct;
    // Fallback if zoom changed and cluster ID regenerated: keep matching by cover photo
    const coverId = activeClusterId.split('-').slice(2).join('-');
    return photoClusters.find((c) => c.photos.some((p) => p.id === coverId)) || null;
  }, [activeClusterId, photoClusters]);

  // Compute aggregate stats
  const stats = useMemo(() => {
    const liveDist = calculatePolylineKm(livePoints);
    const totalKm =
      Math.round((tracks.reduce((s, t) => s + (t.distanceKm || 0), 0) + liveDist) * 100) / 100;
    const unlockedCells = new Set<string>();
    for (const t of tracks) {
      for (const pt of t.points) unlockedCells.add(`${(pt.lat * 50).toFixed(0)}:${(pt.lng * 50).toFixed(0)}`);
    }
    for (const ph of allMapPhotos) {
      unlockedCells.add(`${(ph.coordinates.lat * 50).toFixed(0)}:${(ph.coordinates.lng * 50).toFixed(0)}`);
    }
    for (const pin of checkInPins) {
      unlockedCells.add(`${(pin.coordinates.lat * 50).toFixed(0)}:${(pin.coordinates.lng * 50).toFixed(0)}`);
    }
    const exploredPercent = Math.min(
      100,
      Math.round(((unlockedCells.size + checkInPins.length * 2) / 110) * 1000) / 10,
    );
    return {
      totalKm,
      totalPhotos: allMapPhotos.length,
      userPhotoCount: userPhotos.length,
      totalCheckIns: checkInPins.length,
      exploredPercent,
    };
  }, [tracks, livePoints, allMapPhotos, userPhotos.length, checkInPins]);

  // Route stops with segment legs for JourneyDrawer
  const routeStopsWithLegs = useMemo(() => {
    if (!selectedTrack) return [];
    const mems = selectedTrack.memories || [];
    if (mems.length > 0) {
      return mems.map((m, idx) => {
        const prev = idx > 0 ? mems[idx - 1]! : null;
        const legKm = prev ? Math.max(0.2, Math.round(haversineDistanceKm(prev, m) * 1.18 * 10) / 10) : 0;
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
    return [];
  }, [selectedTrack]);

  // Fit bounds helper
  const fitTrackBounds = useCallback(
    (pts: TrackPoint[]) => {
      const map = mapRef.current;
      if (!map || pts.length === 0) return;
      setFollowUserLocation(false);
      if (pts.length === 1) {
        map.flyTo({ center: [pts[0]!.lng, pts[0]!.lat], zoom: 14.5, pitch: is3DView ? 45 : 0, duration: 850 });
        return;
      }
      const bounds = new maplibregl.LngLatBounds();
      for (const p of pts) bounds.extend([p.lng, p.lat]);
      map.fitBounds(bounds, {
        padding: { top: 96, bottom: 120, left: 64, right: 64 },
        pitch: is3DView ? 42 : 0,
        maxZoom: 14.8,
        duration: 900,
      });
    },
    [is3DView],
  );

  // Fog-of-War optional canvas redraw
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

    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = mapStyle === 'day_3d' ? 'rgba(15, 47, 37, 0.24)' : 'rgba(4, 15, 28, 0.42)';
    ctx.fillRect(0, 0, w, h);

    ctx.globalCompositeOperation = 'destination-out';
    const scaleFactor = Math.max(0.65, Math.min(2.3, Math.pow(1.16, map.getZoom() - 12)));
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

    if (userLocation) carveCircle(userLocation.lat, userLocation.lng, radius * 1.8);
    for (const ph of allMapPhotos) carveCircle(ph.coordinates.lat, ph.coordinates.lng, radius * 1.45);
    for (const tr of tracks) {
      for (const p of tr.points) carveCircle(p.lat, p.lng, radius);
    }
    for (const p of livePoints) carveCircle(p.lat, p.lng, radius * 1.2);
    if (replayAvatarPos) carveCircle(replayAvatarPos.lat, replayAvatarPos.lng, radius * 1.5);
    ctx.globalCompositeOperation = 'source-over';
  }, [fogEnabled, fogRadiusPx, mapStyle, userLocation, allMapPhotos, tracks, livePoints, replayAvatarPos]);

  // ── Sync Route Polyline Layers ─────────────────────────────────────────────
  const syncRouteLayers = useCallback(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const activeTrackColor = livePoints.length >= 2 ? '#f43f5e' : selectedTrack?.color || '#34d399';
    const activePts = showRoutesOnMap
      ? livePoints.length >= 2
        ? livePoints
        : selectedTrack?.points || []
      : [];

    const activeData: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features:
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
          : [],
    };

    const replayFeatures: GeoJSON.Feature<GeoJSON.LineString>[] = [];
    if (isReplaying && selectedTrack && selectedTrack.points.length >= 2 && replayProgress > 1) {
      const cutIdx = Math.max(
        2,
        Math.min(selectedTrack.points.length, Math.ceil((replayProgress / 100) * selectedTrack.points.length)),
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

    const setOrAddSource = (id: string, data: GeoJSON.FeatureCollection) => {
      const src = map.getSource(id) as maplibregl.GeoJSONSource | undefined;
      if (src) src.setData(data);
      else map.addSource(id, { type: 'geojson', data });
    };

    setOrAddSource('fp-active-route', activeData);
    setOrAddSource('fp-replay-progress', { type: 'FeatureCollection', features: replayFeatures });

    if (!map.getLayer('fp-active-glow')) {
      map.addLayer({
        id: 'fp-active-glow',
        type: 'line',
        source: 'fp-active-route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': activeTrackColor, 'line-width': 14, 'line-blur': 7, 'line-opacity': 0.35 },
      });
    } else {
      map.setPaintProperty('fp-active-glow', 'line-color', activeTrackColor);
    }

    if (!map.getLayer('fp-active-core')) {
      map.addLayer({
        id: 'fp-active-core',
        type: 'line',
        source: 'fp-active-route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': activeTrackColor, 'line-width': 4.5, 'line-opacity': 0.92 },
      });
    } else {
      map.setPaintProperty('fp-active-core', 'line-color', activeTrackColor);
    }

    if (!map.getLayer('fp-replay-line')) {
      map.addLayer({
        id: 'fp-replay-line',
        type: 'line',
        source: 'fp-replay-progress',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#fbbf24', 'line-width': 5.5, 'line-opacity': 0.98 },
      });
    }

    redrawFogOfWar();
  }, [showRoutesOnMap, livePoints, selectedTrack, isReplaying, replayProgress, redrawFogOfWar]);

  // ── Render Apple Photos Rounded-Square Stacked Photo Pins ─────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    for (const m of photoMarkersRef.current) m.remove();
    photoMarkersRef.current = [];

    for (const cluster of photoClusters) {
      const isSelected = activeCluster?.id === cluster.id;
      const cardSize = isSelected ? 68 : cluster.count >= 5 ? 64 : 58;
      const coverSrc = escapeHtml(cluster.coverPhoto.thumbnailUrl || cluster.coverPhoto.imageUrl);
      const countText = cluster.count > 999 ? '999+' : String(cluster.count);
      const hasMobileSync = cluster.photos.some(
        (p) => p.sourceApp === 'ios' || p.sourceApp === 'android' || p.sourceApp === 'flutter',
      );

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'fp-photo-pin';
      btn.setAttribute('aria-label', `${cluster.title} — ${cluster.count} ảnh`);
      btn.setAttribute('data-photo-cluster', cluster.title);

      btn.innerHTML = `
        <div class="fp-photo-pin-inner" style="position:relative;display:flex;flex-direction:column;align-items:center;${
          isSelected ? 'transform:scale(1.1) translateY(-3px);z-index:20;' : ''
        }">
          ${
            cluster.count > 1
              ? `<div style="position:absolute;top:-4px;width:${cardSize - 8}px;height:${cardSize - 8}px;border-radius:13px;background:rgba(255,255,255,0.65);border:1.5px solid rgba(255,255,255,0.9);box-shadow:0 4px 12px rgba(0,0,0,0.28);transform:rotate(-3deg);"></div>`
              : ''
          }
          <div style="position:relative;width:${cardSize}px;height:${cardSize}px;border-radius:14px;border:2.5px solid ${
            isSelected ? '#34d399' : '#ffffff'
          };background:#0f172a;overflow:hidden;box-shadow:0 12px 26px -4px rgba(0,0,0,0.48),0 2px 6px rgba(0,0,0,0.28);">
            <img src="${coverSrc}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;" loading="lazy" />
            <div style="position:absolute;inset:0;background:linear-gradient(to top, rgba(0,0,0,0.68) 0%, rgba(0,0,0,0.12) 44%, transparent 70%);"></div>
            <span style="position:absolute;left:6px;bottom:4px;color:#ffffff;font-family:'Be Vietnam Pro',system-ui,sans-serif;font-size:12px;font-weight:800;line-height:1;letter-spacing:-0.02em;font-variant-numeric:tabular-nums;text-shadow:0 1px 4px rgba(0,0,0,0.85);">
              ${countText}
            </span>
            ${
              hasMobileSync
                ? `<span style="position:absolute;right:5px;top:5px;width:8px;height:8px;border-radius:999px;background:#38bdf8;border:1.5px solid #ffffff;box-shadow:0 1px 4px rgba(0,0,0,0.5);" title="Có ảnh đồng bộ từ App Mobile"></span>`
                : ''
            }
          </div>
          <div style="width:0;height:0;margin-top:-1px;border-left:7px solid transparent;border-right:7px solid transparent;border-top:8px solid ${
            isSelected ? '#34d399' : '#ffffff'
          };filter:drop-shadow(0 3px 3px rgba(0,0,0,0.35));"></div>
        </div>
      `;

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        setFollowUserLocation(false);
        setDockMode('map');
        setActiveClusterId(cluster.id);
        map.flyTo({
          center: [cluster.lng, cluster.lat],
          zoom: Math.max(map.getZoom(), cluster.count > 1 ? 13.4 : 14.2),
          duration: 700,
        });
      });

      const marker = new maplibregl.Marker({ element: btn, anchor: 'bottom' })
        .setLngLat([cluster.lng, cluster.lat])
        .addTo(map);
      photoMarkersRef.current.push(marker);
    }

    // Subtle secondary markers for check-in destinations that don't have a user photo nearby
    for (const m of stampMarkersRef.current) m.remove();
    stampMarkersRef.current = [];
    for (const chk of checkInPins) {
      const coveredByPhoto = photoClusters.some(
        (c) => haversineDistanceKm({ lat: c.lat, lng: c.lng }, chk.coordinates) < 0.25,
      );
      if (coveredByPhoto) continue;
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.title = `Đã đóng dấu Hộ chiếu: ${chk.name} · Chạm để thêm ảnh kỷ niệm`;
      dot.setAttribute('aria-label', `Đã đóng dấu Hộ chiếu ${chk.name}`);
      dot.style.cssText =
        'width:16px;height:16px;border-radius:999px;background:#10b981;border:2.5px solid #ffffff;box-shadow:0 4px 12px rgba(0,0,0,0.38);cursor:pointer;padding:0;';
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        setCaptureModalState({
          open: true,
          coords: chk.coordinates,
          placeName: chk.name,
        });
      });
      stampMarkersRef.current.push(
        new maplibregl.Marker({ element: dot, anchor: 'center' })
          .setLngLat([chk.coordinates.lng, chk.coordinates.lat])
          .addTo(map),
      );
    }
  }, [mapReady, photoClusters, activeCluster?.id, checkInPins]);

  // ── Dedicated Permanent Live Current User Location Blue Dot Marker ────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (!userLocation) {
      if (userLocationMarkerRef.current) {
        userLocationMarkerRef.current.remove();
        userLocationMarkerRef.current = null;
      }
      return;
    }

    const headingAngle = typeof userLocation.headingDegrees === 'number' ? userLocation.headingDegrees : null;

    if (!userLocationMarkerRef.current) {
      const el = document.createElement('div');
      el.setAttribute('data-live-user-location', 'true');
      el.title = 'Vị trí hiện tại của bạn';
      el.innerHTML = `
        <div style="position:relative;width:44px;height:44px;display:grid;place-items:center;pointer-events:auto;cursor:pointer;">
          <span class="fp-user-halo" style="position:absolute;width:30px;height:30px;border-radius:999px;background:rgba(10,132,255,0.42);"></span>
          <span style="position:absolute;width:34px;height:34px;border-radius:999px;background:rgba(10,132,255,0.18);border:1px solid rgba(10,132,255,0.35);"></span>
          ${
            headingAngle !== null
              ? `<span style="position:absolute;width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-bottom:18px solid rgba(10,132,255,0.45);transform:rotate(${headingAngle}deg) translateY(-16px);"></span>`
              : ''
          }
          <span style="position:relative;width:16px;height:16px;border-radius:999px;background:#0a84ff;border:3px solid #ffffff;box-shadow:0 3px 12px rgba(10,132,255,0.65),0 1px 4px rgba(0,0,0,0.4);"></span>
        </div>
      `;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const latest = userLocationRef.current;
        if (!latest) return;
        setCaptureModalState({
          open: true,
          coords: { lat: latest.lat, lng: latest.lng },
          placeName: '',
        });
      });

      userLocationMarkerRef.current = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([userLocation.lng, userLocation.lat])
        .addTo(map);
    } else {
      userLocationMarkerRef.current.setLngLat([userLocation.lng, userLocation.lat]);
    }
    redrawFogOfWar();
  }, [userLocation, mapReady, redrawFogOfWar]);

  // Separate Replay Avatar Marker (only visible during 3D Replay / Demo run — NEVER interferes with live blue dot!)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (!replayAvatarPos) {
      if (replayAvatarMarkerRef.current) {
        replayAvatarMarkerRef.current.remove();
        replayAvatarMarkerRef.current = null;
      }
      return;
    }
    if (!replayAvatarMarkerRef.current) {
      const el = document.createElement('div');
      el.innerHTML = `<div style="width:28px;height:28px;border-radius:999px;background:linear-gradient(135deg,#f59e0b,#f43f5e);border:3px solid #ffffff;box-shadow:0 6px 18px rgba(0,0,0,0.45);"></div>`;
      replayAvatarMarkerRef.current = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([replayAvatarPos.lng, replayAvatarPos.lat])
        .addTo(map);
    } else {
      replayAvatarMarkerRef.current.setLngLat([replayAvatarPos.lng, replayAvatarPos.lat]);
    }
  }, [replayAvatarPos, mapReady]);

  // ── Initialize MapLibre GL JS Full-Bleed Canvas ────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    let cancelled = false;

    const init = async () => {
      const style = await buildFootprintMapStyle(mapStyle);
      if (cancelled || !mapContainerRef.current) return;

      const initialCenter: [number, number] = userLocation
        ? [userLocation.lng, userLocation.lat]
        : [105.756, 10.312];

      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style,
        center: initialCenter,
        zoom: 11.6,
        pitch: is3DView ? 42 : 0,
        attributionControl: false,
      });

      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');

      map.on('load', () => {
        if (cancelled) return;
        setMapReady(true);
        setMapZoom(map.getZoom());
      });

      map.on('zoomend', () => {
        setMapZoom(Math.round(map.getZoom() * 10) / 10);
      });

      map.on('dragstart', () => {
        setFollowUserLocation(false);
      });

      mapRef.current = map;
    };

    void init();

    return () => {
      cancelled = true;
      for (const m of photoMarkersRef.current) m.remove();
      for (const m of stampMarkersRef.current) m.remove();
      userLocationMarkerRef.current?.remove();
      replayAvatarMarkerRef.current?.remove();
      mapRef.current?.remove();
      mapRef.current = null;
      setMapReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle manual map tap (either setting manual current position or closing popovers)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const onClick = (e: maplibregl.MapMouseEvent) => {
      setLayerPopoverOpen(false);
      if (pickingManualLocation) {
        const manualLoc: LiveUserLocation = {
          lat: Number(e.lngLat.lat.toFixed(6)),
          lng: Number(e.lngLat.lng.toFixed(6)),
          updatedAt: Date.now(),
          isManualFallback: true,
        };
        persistUserLocation(manualLoc);
        setGpsStatus('active');
        setPickingManualLocation(false);
        toast.success('Đã ghim vị trí hiện tại của bạn!', `${manualLoc.lat.toFixed(4)}, ${manualLoc.lng.toFixed(4)}`);
      }
    };
    map.on('click', onClick);
    return () => {
      map.off('click', onClick);
    };
  }, [mapReady, pickingManualLocation, persistUserLocation]);

  // Sync style changes smoothly
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
        if (!cancelled) syncRouteLayers();
      });
    });
    return () => {
      cancelled = true;
    };
  }, [mapStyle, mapReady, syncRouteLayers]);

  // Sync 3D pitch
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    map.easeTo({ pitch: is3DView ? 45 : 0, bearing: is3DView ? -10 : 0, duration: 600 });
  }, [is3DView, mapReady]);

  // Keep route layers & fog in sync
  useEffect(() => {
    if (!mapReady) return;
    syncRouteLayers();
  }, [mapReady, syncRouteLayers]);

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

  // ── Geofence Auto Check-in ─────────────────────────────────────────────────
  const checkAndTriggerGeofence = useCallback(
    async (lat: number, lng: number) => {
      if (!autoCheckInEnabled || geofenceTargets.length === 0) return;
      for (const target of geofenceTargets) {
        if (target.isCheckedIn || checkedInSessionRef.current.has(target.id)) continue;
        const distKm = haversineDistanceKm({ lat, lng }, target.coordinates);
        if (distKm <= 1.0) {
          checkedInSessionRef.current.add(target.id);
          const distMeters = Math.round(distKm * 1000);
          setCheckInPins((prev) =>
            prev.some((p) => p.destinationId === target.id)
              ? prev
              : [
                  {
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
                  },
                  ...prev,
                ],
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
                  `Tự động Điểm danh GPS (+${res.data.pointsAwarded} EXP)`,
                  `Phát hiện bạn gần "${target.name}" (${distMeters}m) và tự đóng dấu Hộ chiếu số!`,
                );
                if (res.data.newBadges?.length) announceBadges(res.data.newBadges);
              }
            } catch {
              // handled on next sync
            }
          }
        }
      }
    },
    [autoCheckInEnabled, geofenceTargets, isEffectiveOnline, simulatingRouteId],
  );

  // ── Live GPS Track Recording (Global Persistent Store + Watcher in PublicLayout) ──
  useEffect(() => {
    if (!isRecordingGps || !liveStartedAt) {
      setLiveElapsedSec(0);
      return;
    }
    setLiveElapsedSec(Math.max(0, Math.floor((Date.now() - liveStartedAt) / 1000)));
    const id = window.setInterval(() => {
      setLiveElapsedSec(Math.max(0, Math.floor((Date.now() - liveStartedAt) / 1000)));
    }, 1000);
    return () => window.clearInterval(id);
  }, [isRecordingGps, liveStartedAt]);

  // Trigger instant geofence check & follow live dot whenever the global recorder captures a fresh GPS fix
  useEffect(() => {
    if (!recordingSession || recordingSession.points.length === 0) return;
    const latestPt = recordingSession.points[recordingSession.points.length - 1]!;
    void checkAndTriggerGeofence(latestPt.lat, latestPt.lng);
  }, [recordingSession?.lastPointAt, recordingSession, checkAndTriggerGeofence]);

  const handleStartLiveGps = () => {
    if (!('geolocation' in navigator)) {
      toast.error('Thiết bị không hỗ trợ GPS', 'Bạn có thể chạy Cung đường Mẫu trong tab Lộ trình.');
      return;
    }
    const initialPoint: TrackPoint | null =
      userLocation && !userLocation.isManualFallback
        ? {
            lat: userLocation.lat,
            lng: userLocation.lng,
            timestamp: Date.now(),
            speedKmh: userLocation.speedKmh,
          }
        : null;

    startGlobalRecording({
      ownerKey,
      title: `Hành trình ngày ${new Date().toLocaleDateString('vi-VN')}`,
      initialPoint,
    });
    setShowRoutesOnMap(true);
    setFollowUserLocation(true);
    toast.success(
      'Đã bật ghi hành trình GPS (tự động lưu liên tục)',
      'Bạn có thể chuyển tab hoặc mở lại app dọc đường — lộ trình vẫn được lưu và tự nối đường bộ khi dừng!',
    );
  };

  const handleStopAndSaveLiveGps = async () => {
    const active = useGpsRecordingStore.getState().session;
    if (!active || isSavingLiveTrack) return;

    setIsSavingLiveTrack(true);
    try {
      let recordedPoints = [...active.points];
      // If user only had 1 point or moved slightly before tapping Stop, try one final live fix
      if (userLocation && !userLocation.isManualFallback) {
        const tail = recordedPoints[recordedPoints.length - 1];
        const finalPt: TrackPoint = {
          lat: userLocation.lat,
          lng: userLocation.lng,
          timestamp: Date.now(),
          speedKmh: userLocation.speedKmh,
        };
        if (!tail || haversineDistanceKm(tail, finalPt) >= 0.01) {
          recordedPoints.push(finalPt);
        }
      }

      if (recordedPoints.length === 0) {
        clearGlobalRecording();
        toast.info('Chưa ghi nhận tọa độ GPS nào', 'Hãy đảm bảo đã cấp quyền Vị trí cho trình duyệt.');
        return;
      }

      // Bridge any large lock-screen gaps (>= 1km, e.g. Cần Thơ -> Sài Gòn) cleanly along real highways via OSRM
      const { points: finalizedPoints, bridgedSegments } = await bridgeTrackRoadGaps(
        recordedPoints,
        isEffectiveOnline,
      );
      const now = Date.now();
      const totalKm = calculatePolylineKm(finalizedPoints);
      const newTrack: LocalFootprintTrack = {
        clientId: active.clientId,
        title: active.title.trim() || `Hành trình ngày ${new Date(active.startedAt).toLocaleDateString('vi-VN')}`,
        color: TRACK_COLORS[tracks.length % TRACK_COLORS.length] || '#10b981',
        distanceKm: totalKm,
        durationSeconds: Math.max(1, Math.floor((now - active.startedAt) / 1000)),
        startedAt: active.startedAt,
        endedAt: now,
        points: finalizedPoints,
        memories: active.memories,
        syncStatus: 'pending',
      };
      await saveLocalTrack(newTrack, ownerKey);
      clearGlobalRecording();
      setSelectedTrackId(newTrack.clientId);
      setShowRoutesOnMap(true);
      if (finalizedPoints.length >= 2) {
        fitTrackBounds(finalizedPoints);
      }
      if (bridgedSegments > 0) {
        toast.success(
          `Đã lưu hành trình ${totalKm} km!`,
          `Tự động nối mượt ${bridgedSegments} đoạn đường bộ khi bạn khóa màn hình.`,
        );
      }
      await syncWithCloud(false);
    } finally {
      setIsSavingLiveTrack(false);
    }
  };

  // ── Demo Journey & Replay (strictly local preview — never stamps fake check-ins or uploads to cloud!) ──
  const handleRunDemoJourney = async (preset: PresetJourneyRoute) => {
    if (simTimerRef.current) window.clearInterval(simTimerRef.current);
    setIsReplaying(false);
    setSimulatingRouteId(preset.id);
    setShowRoutesOnMap(true);

    const { points: fullPoints, memories: fullMemories } = await resolveRoadSnappedJourney(
      preset.waypoints,
      isEffectiveOnline,
    );
    const startPt = fullPoints[0]!;
    fitTrackBounds(fullPoints);
    setSimPoints([startPt]);
    setReplayAvatarPos({ lat: startPt.lat, lng: startPt.lng });

    let idx = 1;
    simTimerRef.current = window.setInterval(async () => {
      if (idx >= fullPoints.length) {
        if (simTimerRef.current) window.clearInterval(simTimerRef.current);
        simTimerRef.current = null;
        setSimulatingRouteId(null);
        setReplayAvatarPos(null);

        const completedTrack: LocalFootprintTrack = {
          clientId: `demo-${preset.id}-${Date.now()}`,
          title: `[Demo] ${preset.title}`,
          color: preset.color,
          distanceKm: calculatePolylineKm(fullPoints),
          durationSeconds: fullPoints.length * 16,
          startedAt: Date.now() - fullPoints.length * 16000,
          endedAt: Date.now(),
          points: fullPoints,
          memories: fullMemories,
          isDemoRoute: true,
          syncStatus: 'synced',
        };
        await saveLocalTrack(completedTrack, ownerKey);
        setSimPoints([]);
        setSelectedTrackId(completedTrack.clientId);
        setTracks(await getAllLocalTracks(ownerKey));
        toast.info('Đã hoàn tất chạy thử lộ trình Demo', 'Lộ trình mẫu chỉ xem cục bộ và không cộng điểm hay chèn ảnh vào tài khoản.');
        return;
      }
      const nextPt = fullPoints[idx]!;
      const partialPoints = fullPoints.slice(0, idx + 1);
      setSimPoints(partialPoints);
      setReplayAvatarPos({ lat: nextPt.lat, lng: nextPt.lng });
      idx++;
    }, 90);
  };

  useEffect(() => {
    if (!isReplaying || !selectedTrack || selectedTrack.points.length < 2) {
      if (replayTimerRef.current) window.clearInterval(replayTimerRef.current);
      return;
    }
    const totalPts = selectedTrack.points.length;
    const intervalMs = Math.max(45, Math.round(150 / replaySpeed));
    replayTimerRef.current = window.setInterval(() => {
      setReplayProgress((prev) => {
        const next = prev + 100 / totalPts;
        if (next >= 100) {
          setIsReplaying(false);
          setReplayAvatarPos(null);
          fitTrackBounds(selectedTrack.points);
          return 100;
        }
        const ptIdx = Math.min(totalPts - 1, Math.floor((next / 100) * totalPts));
        const pt = selectedTrack.points[ptIdx]!;
        setReplayAvatarPos({ lat: pt.lat, lng: pt.lng });
        mapRef.current?.easeTo({ center: [pt.lng, pt.lat], duration: intervalMs * 1.1 });
        return next;
      });
    }, intervalMs);
    return () => {
      if (replayTimerRef.current) window.clearInterval(replayTimerRef.current);
    };
  }, [isReplaying, replaySpeed, selectedTrack, fitTrackBounds]);

  // ── Photo Mutations (Upload / Edit / Delete) ───────────────────────────────
  const handlePhotosUploaded = (created: FootprintPhotoItem[]) => {
    const normalized = created.map((p) => ({
      ...p,
      imageUrl: resolveMediaUrl(p.imageUrl),
      thumbnailUrl: resolveMediaUrl(p.thumbnailUrl || p.imageUrl),
    }));
    setUserPhotos((prev) => {
      const existingIds = new Set(prev.map((p) => p.id));
      const fresh = normalized.filter((c) => !existingIds.has(c.id));
      return [...fresh, ...prev];
    });
    const first = normalized[0];
    if (first) {
      setFollowUserLocation(false);
      setDockMode('map');
      mapRef.current?.flyTo({
        center: [first.coordinates.lng, first.coordinates.lat],
        zoom: Math.max(mapRef.current.getZoom(), 14.2),
        duration: 850,
      });
    }
  };

  const handleUpdatePhoto = async (id: string, patch: { caption?: string; placeName?: string }) => {
    try {
      const res = await api.patch<{ success: boolean; photo: FootprintPhotoItem }>(
        `/footprints/photos/${encodeURIComponent(id)}`,
        patch,
      );
      if (res.data?.photo) {
        const updated: FootprintPhotoItem = {
          ...res.data.photo,
          imageUrl: resolveMediaUrl(res.data.photo.imageUrl),
          thumbnailUrl: resolveMediaUrl(res.data.photo.thumbnailUrl || res.data.photo.imageUrl),
        };
        setUserPhotos((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        setLightboxState((prev) =>
          prev ? { ...prev, photos: prev.photos.map((p) => (p.id === updated.id ? updated : p)) } : null,
        );
        toast.success('Đã cập nhật ghi chú ảnh');
      }
    } catch (err) {
      toast.error('Cập nhật ảnh thất bại', toApiError(err).message);
    }
  };

  const handleDeletePhoto = async (photo: FootprintPhotoItem) => {
    try {
      await api.delete(`/footprints/photos/${encodeURIComponent(photo.id)}`);
      setUserPhotos((prev) => prev.filter((p) => p.id !== photo.id));
      setLightboxState((prev) =>
        prev ? { ...prev, photos: prev.photos.filter((p) => p.id !== photo.id) } : null,
      );
      toast.info('Đã xóa ảnh khỏi Bản đồ Dấu chân');
    } catch (err) {
      toast.error('Không thể xóa ảnh', toApiError(err).message);
    }
  };

  const handleDeleteTrack = async (clientId: string) => {
    await deleteLocalTrackById(clientId, ownerKey);
    if (isEffectiveOnline && !clientId.startsWith('demo-')) {
      try {
        await api.delete(`/footprints/${encodeURIComponent(clientId)}`);
      } catch {
        // ignore
      }
    }
    const remaining = await getAllLocalTracks(ownerKey);
    setTracks(remaining);
    if (selectedTrackId === clientId) setSelectedTrackId(remaining[0]?.clientId ?? null);
    toast.info('Đã xóa hành trình khỏi bản đồ');
  };

  const handleExportJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      platform: 'Đồng Tháp Smart Travel - Footprint Photo Map',
      stats,
      photos: userPhotos,
      tracks,
      checkInPins,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dau-chan-anh-dong-thap-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Đã xuất file sao lưu (.json)');
  };

  const handleShareCard = () => {
    if (!selectedTrack) {
      toast.info('Chưa có lộ trình để xuất ảnh');
      return;
    }
    if (downloadFootprintShareCard(selectedTrack, stats.exploredPercent)) {
      toast.success('Đã tải Thẻ Lộ trình HD (.png)!');
    }
  };

  const handleLocateButtonClick = () => {
    if (userLocation) {
      setFollowUserLocation(true);
      mapRef.current?.flyTo({
        center: [userLocation.lng, userLocation.lat],
        zoom: Math.max(mapRef.current.getZoom(), 14.8),
        duration: 850,
      });
      requestLiveLocation(false);
    } else {
      requestLiveLocation(true);
    }
  };

  const handleSearchJump = () => {
    const first = visibleMapPhotos[0];
    if (!first) {
      toast.info('Không tìm thấy ảnh hoặc địa điểm khớp từ khóa');
      return;
    }
    setFollowUserLocation(false);
    mapRef.current?.flyTo({
      center: [first.coordinates.lng, first.coordinates.lat],
      zoom: 14.4,
      duration: 850,
    });
  };

  return (
    <div className="fp-map-canvas relative h-[calc(100%-4.1rem)] w-full overflow-hidden bg-[#133572] lg:h-full">
      {/* ── Full-Bleed MapLibre Canvas ───────────────────────────────────── */}
      <div
        ref={mapContainerRef}
        className={clsx('size-full', pickingManualLocation && 'cursor-crosshair')}
      />
      <canvas ref={fogCanvasRef} className="pointer-events-none absolute inset-0 z-10" />

      {/* ── Top-Left Compact Frosted Status Pill (Stacks cleanly on narrow mobile, never clips top-right capsule) ── */}
      <div className="pointer-events-none absolute left-3.5 right-[4.5rem] top-3.5 z-20 flex flex-col items-start gap-1.5 sm:left-5 sm:right-20 sm:top-5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
        <div className="pointer-events-auto flex items-center gap-2.5 rounded-full border border-white/20 bg-slate-950/65 px-3.5 py-2 text-white shadow-[0_12px_32px_-8px_rgba(0,0,0,0.55)] backdrop-blur-xl">
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-emerald-500/25 text-emerald-300 ring-1 ring-emerald-400/40">
            <Compass className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 leading-tight">
            <h1 className="text-xs font-extrabold tracking-tight text-white sm:text-sm">
              Bản đồ Dấu chân
            </h1>
            <p className="text-[11px] font-medium text-slate-300 tabular-nums">
              {stats.totalPhotos} ảnh · {photoClusters.length} cụm điểm
            </p>
          </div>
        </div>

        {/* Always-Visible Live GPS Status Pill */}
        <button
          type="button"
          onClick={() => {
            if (gpsStatus === 'denied' || gpsStatus === 'unavailable') {
              setPickingManualLocation((v) => !v);
            } else {
              handleLocateButtonClick();
            }
          }}
          className={clsx(
            'pointer-events-auto inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-[11px] font-bold shadow-[0_10px_26px_-8px_rgba(0,0,0,0.5)] backdrop-blur-xl transition active:scale-95',
            pickingManualLocation
              ? 'border-amber-300/60 bg-amber-500/90 text-slate-950'
              : gpsStatus === 'active'
                ? 'border-sky-300/35 bg-slate-950/65 text-sky-100 hover:bg-slate-900/80'
                : 'border-white/20 bg-slate-950/65 text-slate-200 hover:bg-slate-900/80',
          )}
          title={
            userLocation
              ? `Vị trí của bạn: ${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}`
              : 'Bấm để định vị hoặc chạm chọn vị trí trên bản đồ'
          }
        >
          <span
            className={clsx(
              'size-2 shrink-0 rounded-full',
              pickingManualLocation
                ? 'bg-slate-950 animate-ping'
                : gpsStatus === 'active'
                  ? 'bg-[#0a84ff] shadow-[0_0_8px_#0a84ff]'
                  : gpsStatus === 'locating'
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-slate-400',
            )}
          />
          <span className="tabular-nums">
            {pickingManualLocation
              ? 'Chạm vào bản đồ để đặt vị trí...'
              : gpsStatus === 'active' && userLocation
                ? userLocation.isManualFallback
                  ? 'Vị trí đã ghim'
                  : `Vị trí của bạn${userLocation.accuracyMeters ? ` · ±${Math.round(userLocation.accuracyMeters)}m` : ''}`
                : gpsStatus === 'locating'
                  ? 'Đang định vị GPS...'
                  : 'Chạm đặt vị trí'}
          </span>
        </button>

        {/* Always-Visible Live Recording Indicator Pill on the Map */}
        {isRecordingGps && (
          <button
            type="button"
            onClick={() => void handleStopAndSaveLiveGps()}
            disabled={isSavingLiveTrack}
            className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-rose-300/60 bg-rose-600/92 px-3 py-2 text-[11px] font-extrabold text-white shadow-[0_12px_28px_-6px_rgba(225,29,72,0.7)] backdrop-blur-xl transition hover:bg-rose-500 active:scale-95 disabled:opacity-60"
            title="Bấm để Dừng & Lưu lộ trình đang ghi"
          >
            <span className="relative flex size-2 shrink-0">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-80" />
              <span className="relative inline-flex size-2 rounded-full bg-white" />
            </span>
            <span className="tabular-nums">
              {isSavingLiveTrack
                ? 'Đang nối đường & lưu...'
                : `Đang ghi · ${liveKm.toFixed(1)} km · ${livePoints.length}đ · Dừng`}
            </span>
          </button>
        )}
      </div>

      {/* ── Top-Right Apple Maps Frosted Vertical Control Capsule ────────── */}
      <div className="absolute right-3.5 top-3.5 z-20 flex flex-col items-end gap-2.5 sm:right-5 sm:top-5">
        <div className="flex flex-col overflow-hidden rounded-[22px] border border-white/22 bg-slate-950/60 text-white shadow-[0_14px_34px_-8px_rgba(0,0,0,0.55)] backdrop-blur-xl">
          <button
            type="button"
            onClick={() => setLayerPopoverOpen((v) => !v)}
            className={clsx(
              'grid size-11 place-items-center transition hover:bg-white/15',
              layerPopoverOpen && 'bg-white/20 text-emerald-300',
            )}
            aria-label="Chọn kiểu bản đồ & lớp hiển thị"
            title="Kiểu bản đồ & Lớp hiển thị"
          >
            <MapIcon className="size-[1.15rem]" />
          </button>

          <div className="mx-2 h-px bg-white/15" />

          <button
            type="button"
            onClick={handleLocateButtonClick}
            className={clsx(
              'grid size-11 place-items-center transition hover:bg-white/15',
              followUserLocation ? 'text-[#38bdf8]' : 'text-white',
            )}
            aria-label="Về vị trí hiện tại của tôi"
            title="Về vị trí hiện tại của tôi"
          >
            <Navigation
              className={clsx('size-[1.15rem]', followUserLocation && 'fill-[#38bdf8]')}
            />
          </button>
        </div>

        {/* Sleek Map Zoom Capsule (Cleanly clear of bottom-right Pé Meko orb) */}
        <div className="hidden flex-col overflow-hidden rounded-[20px] border border-white/20 bg-slate-950/55 text-white shadow-[0_12px_28px_-8px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:flex">
          <button
            type="button"
            onClick={() => mapRef.current?.zoomIn({ duration: 280 })}
            className="grid size-10 place-items-center transition hover:bg-white/15"
            aria-label="Phóng to bản đồ"
          >
            <Plus className="size-4" />
          </button>
          <div className="mx-2 h-px bg-white/15" />
          <button
            type="button"
            onClick={() => mapRef.current?.zoomOut({ duration: 280 })}
            className="grid size-10 place-items-center transition hover:bg-white/15"
            aria-label="Thu nhỏ bản đồ"
          >
            <Minus className="size-4" />
          </button>
        </div>

        {/* Layer & Map Style Popover */}
        {layerPopoverOpen && (
          <div className="mt-1 w-60 rounded-3xl border border-white/20 bg-slate-950/90 p-3.5 text-white shadow-2xl backdrop-blur-2xl">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Giao diện bản đồ
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  { id: 'atlas', label: 'Bản đồ Ảnh', icon: Sparkles },
                  { id: 'satellite', label: 'Vệ tinh', icon: Globe2 },
                  { id: 'day_3d', label: 'Sáng 3D', icon: Sun },
                  { id: 'night', label: 'Đêm sâu', icon: Moon },
                ] as const
              ).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMapStyle(id)}
                  className={clsx(
                    'flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-bold transition',
                    mapStyle === id
                      ? 'bg-emerald-500 text-white'
                      : 'bg-white/10 text-slate-200 hover:bg-white/20',
                  )}
                >
                  <Icon className="size-3.5 shrink-0" />
                  <span className="truncate">{label}</span>
                </button>
              ))}
            </div>

            <div className="mt-3 space-y-1.5 border-t border-white/12 pt-3">
              {(
                [
                  {
                    label: 'Góc nhìn nghiêng 3D',
                    active: is3DView,
                    toggle: () => setIs3DView((v) => !v),
                    icon: Layers,
                  },
                  {
                    label: 'Hiện tuyến đường đã đi',
                    active: showRoutesOnMap,
                    toggle: () => setShowRoutesOnMap((v) => !v),
                    icon: Route,
                  },
                  {
                    label: 'Sương mù khám phá',
                    active: fogEnabled,
                    toggle: () => setFogEnabled((v) => !v),
                    icon: Compass,
                  },
                ] as const
              ).map(({ label, active, toggle, icon: Icon }) => (
                <button
                  key={label}
                  type="button"
                  onClick={toggle}
                  className="flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
                >
                  <span className="flex items-center gap-2">
                    <Icon className="size-3.5 text-emerald-400" />
                    {label}
                  </span>
                  <span
                    className={clsx(
                      'grid size-5 place-items-center rounded-full text-white transition',
                      active ? 'bg-emerald-500' : 'bg-white/15',
                    )}
                  >
                    {active && <Check className="size-3" />}
                  </span>
                </button>
              ))}

              <button
                type="button"
                onClick={() => {
                  setLayerPopoverOpen(false);
                  setPickingManualLocation(true);
                  toast.info('Chạm vào bất kỳ điểm nào trên bản đồ để ghim vị trí hiện tại của bạn');
                }}
                className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold text-sky-300 transition hover:bg-white/10"
              >
                <LocateFixed className="size-3.5" />
                Đặt vị trí hiện tại thủ công
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Expandable Search Bar (floats cleanly right above bottom dock) ─ */}
      {searchOpen && (
        <div className="pointer-events-auto absolute bottom-[6.25rem] left-1/2 z-30 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center gap-2 rounded-full border border-white/25 bg-slate-950/82 px-3.5 py-2 text-white shadow-2xl backdrop-blur-2xl sm:bottom-24">
          <Search className="size-4 shrink-0 text-emerald-300" />
          <input
            type="search"
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSearchJump();
              if (e.key === 'Escape') setSearchOpen(false);
            }}
            placeholder="Tìm địa điểm, khu vực hoặc ghi chú ảnh..."
            className="min-w-0 flex-1 bg-transparent text-xs font-medium text-white placeholder:text-slate-400 focus:outline-none sm:text-sm"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={handleSearchJump}
              className="shrink-0 rounded-full bg-emerald-500 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-400"
            >
              Đi tới ({visibleMapPhotos.length})
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSearchOpen(false);
            }}
            className="grid size-7 shrink-0 place-items-center rounded-full bg-white/10 text-slate-300 hover:bg-white/20 hover:text-white"
            aria-label="Đóng tìm kiếm"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* Hidden Quick-Upload File Picker triggered directly by the Upload dock icon */}
      <input
        ref={quickUploadInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const selected = e.target.files ? Array.from(e.target.files) : [];
          e.target.value = '';
          if (selected.length === 0) return;
          setCaptureModalState({
            open: true,
            coords: userLocation ? { lat: userLocation.lat, lng: userLocation.lng } : null,
            placeName: '',
            mode: 'upload',
            files: selected,
          });
        }}
      />

      {/* ── Friendly Clean-Slate Prompt for Brand-New Users (0 photos, hidden while recording GPS) ──── */}
      {authStatus === 'ready' && !isSyncing && !isRecordingGps && allMapPhotos.length === 0 && dockMode === 'map' && !activeCluster && !searchOpen && (
        <div className="pointer-events-none absolute left-3.5 right-[4.5rem] top-[7rem] z-20 flex justify-start sm:inset-x-0 sm:bottom-24 sm:top-auto sm:justify-center sm:px-4">
          <button
            type="button"
            onClick={() =>
              setCaptureModalState({
                open: true,
                coords: userLocation ? { lat: userLocation.lat, lng: userLocation.lng } : null,
                placeName: '',
                mode: 'camera',
                files: null,
              })
            }
            className="pointer-events-auto inline-flex items-center gap-2 rounded-2xl border border-white/25 bg-slate-950/75 px-3.5 py-2 text-left text-xs font-semibold text-white shadow-[0_14px_34px_-10px_rgba(0,0,0,0.6)] backdrop-blur-xl transition hover:bg-slate-900/90 active:scale-[0.98] sm:rounded-full sm:px-4"
          >
            <Camera className="size-3.5 shrink-0 text-emerald-300" aria-hidden />
            <span>Bản đồ đang trống · Chạm để ghim ảnh đầu tiên</span>
          </button>
        </div>
      )}

      {/* ── Bottom Apple Photos Floating Dock (Centered, clear of raised Mobile Dấu chân FAB & Pé Meko!) ─ */}
      <div className="pointer-events-none absolute inset-x-0 bottom-7 z-30 flex items-center justify-center px-2.5 sm:bottom-5 sm:px-3">
        <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2">
          {/* Segmented Frosted Pill: Bản đồ | Thư viện | Địa điểm | Lộ trình */}
          <nav
            aria-label="Chế độ xem Bản đồ Dấu chân"
            className="flex items-center gap-0.5 rounded-full border border-white/22 bg-slate-950/65 p-1 text-white shadow-[0_16px_40px_-8px_rgba(0,0,0,0.65)] backdrop-blur-2xl sm:gap-1 sm:p-1.5"
          >
            {(
              [
                { id: 'map', label: 'Bản đồ', icon: MapIcon },
                { id: 'library', label: 'Thư viện', icon: Images },
                { id: 'places', label: 'Địa điểm', icon: FolderHeart },
                { id: 'routes', label: 'Lộ trình', icon: Route },
              ] as const
            ).map(({ id, label, icon: Icon }) => {
              const active = dockMode === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setDockMode((prev) => (prev === id && id !== 'map' ? 'map' : id));
                    if (id !== 'map') setActiveClusterId(null);
                  }}
                  className={clsx(
                    'flex items-center gap-1.5 rounded-full px-2.5 py-2 text-xs font-bold transition-all active:scale-95 sm:px-4',
                    active
                      ? 'bg-white text-slate-950 shadow-sm'
                      : 'text-slate-200 hover:bg-white/12 hover:text-white',
                  )}
                >
                  <Icon className="size-3.5 shrink-0" aria-hidden />
                  <span className={clsx(active ? 'inline' : 'hidden sm:inline')}>{label}</span>
                </button>
              );
            })}
          </nav>

          {/* Icon-Only Action #1: Open Live Camera Immediately */}
          <button
            type="button"
            onClick={() =>
              setCaptureModalState({
                open: true,
                coords: userLocation ? { lat: userLocation.lat, lng: userLocation.lng } : null,
                placeName: '',
                mode: 'camera',
                files: null,
              })
            }
            className="grid size-11 shrink-0 place-items-center rounded-full border border-emerald-300/45 bg-emerald-500 text-white shadow-[0_14px_32px_-6px_rgba(16,185,129,0.75)] transition hover:scale-105 hover:bg-emerald-400 active:scale-95 sm:size-12"
            aria-label="Mở camera chụp ảnh"
            title="Mở camera chụp ảnh"
          >
            <Camera className="size-[1.15rem]" aria-hidden />
          </button>

          {/* Icon-Only Action #2: Upload Photos from Device Immediately */}
          <button
            type="button"
            onClick={() => quickUploadInputRef.current?.click()}
            className="grid size-11 shrink-0 place-items-center rounded-full border border-white/25 bg-slate-950/70 text-emerald-300 shadow-[0_14px_34px_-8px_rgba(0,0,0,0.6)] backdrop-blur-2xl transition hover:scale-105 hover:bg-slate-900/90 hover:text-white active:scale-95 sm:size-12"
            aria-label="Tải ảnh lên từ thiết bị"
            title="Tải ảnh lên từ thiết bị"
          >
            <Upload className="size-[1.15rem]" aria-hidden />
          </button>

          {/* Circular Frosted Search Trigger */}
          <button
            type="button"
            onClick={() => setSearchOpen((v) => !v)}
            className={clsx(
              'grid size-11 shrink-0 place-items-center rounded-full border border-white/22 shadow-[0_14px_34px_-8px_rgba(0,0,0,0.6)] backdrop-blur-2xl transition active:scale-95 sm:size-12',
              searchOpen || searchQuery
                ? 'bg-white text-slate-950'
                : 'bg-slate-950/65 text-white hover:bg-slate-900/80',
            )}
            aria-label="Tìm kiếm ảnh và địa điểm trên bản đồ"
            title="Tìm kiếm ảnh & địa điểm"
          >
            <Search className="size-[1.15rem]" aria-hidden />
          </button>
        </div>
      </div>

      {/* ── Selected Photo Cluster Drawer ────────────────────────────────── */}
      {activeCluster && dockMode === 'map' && (
        <PhotoClusterDrawer
          cluster={activeCluster}
          userLocation={userLocation}
          onClose={() => setActiveClusterId(null)}
          onOpenLightbox={(photos, startIndex) => setLightboxState({ photos, index: startIndex })}
          onAddPhotoHere={(coords, placeName) =>
            setCaptureModalState({ open: true, coords, placeName })
          }
        />
      )}

      {/* ── Library / Places Collection Overlay ──────────────────────────── */}
      {(dockMode === 'library' || dockMode === 'places') && (
        <PhotoLibraryOverlay
          mode={dockMode}
          photos={allMapPhotos}
          userLocation={userLocation}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onClose={() => setDockMode('map')}
          onOpenLightbox={(photos, startIndex) => setLightboxState({ photos, index: startIndex })}
          onFlyToPlace={(coords) => {
            setFollowUserLocation(false);
            mapRef.current?.flyTo({
              center: [coords.lng, coords.lat],
              zoom: 14.5,
              duration: 850,
            });
          }}
          onOpenCapture={() =>
            setCaptureModalState({
              open: true,
              coords: userLocation ? { lat: userLocation.lat, lng: userLocation.lng } : null,
              placeName: '',
            })
          }
        />
      )}

      {/* ── Journeys, GPS Recording & 3D Replay Drawer ───────────────────── */}
      <JourneyDrawer
        open={dockMode === 'routes'}
        onClose={() => setDockMode('map')}
        tracks={tracks}
        selectedTrack={selectedTrack}
        routeStops={routeStopsWithLegs}
        focusedStopIdx={focusedStopIdx}
        isRecordingGps={isRecordingGps}
        isSavingLiveTrack={isSavingLiveTrack}
        liveElapsedLabel={formatDurationClock(liveElapsedSec)}
        livePointsCount={recordingSession?.points.length ?? 0}
        liveKm={liveKm}
        wakeLockActive={wakeLockActive}
        liveGpsError={liveGpsError}
        simulatingRouteId={simulatingRouteId}
        isReplaying={isReplaying}
        replayProgress={replayProgress}
        replaySpeed={replaySpeed}
        fogEnabled={fogEnabled}
        fogRadiusPx={fogRadiusPx}
        autoCheckInEnabled={autoCheckInEnabled}
        checkInCount={checkInPins.length}
        isEffectiveOnline={isEffectiveOnline}
        simulateOffline={simulateOffline}
        pendingSyncCount={pendingSyncCount}
        isSyncing={isSyncing}
        totalKm={stats.totalKm}
        exploredPercent={stats.exploredPercent}
        onSelectTrack={(clientId) => {
          setSelectedTrackId(clientId);
          setShowRoutesOnMap(true);
          const found = tracks.find((t) => t.clientId === clientId);
          if (found?.points.length) fitTrackBounds(found.points);
        }}
        onDeleteTrack={(clientId) => void handleDeleteTrack(clientId)}
        onFocusStop={(idx, lat, lng) => {
          setFocusedStopIdx(idx);
          setFollowUserLocation(false);
          mapRef.current?.flyTo({ center: [lng, lat], zoom: 14.8, pitch: is3DView ? 45 : 0, duration: 750 });
        }}
        onFitTrack={() => {
          const pts = livePoints.length >= 2 ? livePoints : selectedTrack?.points || [];
          if (pts.length > 0) fitTrackBounds(pts);
        }}
        onStartLiveGps={() => void handleStartLiveGps()}
        onStopLiveGps={() => void handleStopAndSaveLiveGps()}
        onRunDemoJourney={(route) => void handleRunDemoJourney(route)}
        onToggleReplay={() => {
          if (!selectedTrack || selectedTrack.points.length < 2) return;
          if (isReplaying) {
            setIsReplaying(false);
          } else {
            setShowRoutesOnMap(true);
            setReplayProgress(0);
            const first = selectedTrack.points[0]!;
            setReplayAvatarPos({ lat: first.lat, lng: first.lng });
            mapRef.current?.flyTo({ center: [first.lng, first.lat], zoom: 14.3, duration: 800 });
            setIsReplaying(true);
          }
        }}
        onSeekReplay={(pct) => {
          if (!selectedTrack || selectedTrack.points.length < 2) return;
          setReplayProgress(pct);
          const idx = Math.min(
            selectedTrack.points.length - 1,
            Math.floor((pct / 100) * selectedTrack.points.length),
          );
          const pt = selectedTrack.points[idx];
          if (pt) {
            setReplayAvatarPos({ lat: pt.lat, lng: pt.lng });
            mapRef.current?.easeTo({ center: [pt.lng, pt.lat], duration: 250 });
          }
        }}
        onChangeReplaySpeed={setReplaySpeed}
        onToggleFog={() => setFogEnabled((v) => !v)}
        onChangeFogRadius={setFogRadiusPx}
        onToggleAutoCheckIn={() => {
          const next = !autoCheckInEnabled;
          toggleAutoCheckIn();
          toast.info(next ? 'Đã BẬT Tự động Điểm danh GPS (<1km)' : 'Đã TẮT Tự động Điểm danh GPS');
        }}
        onToggleSimulateOffline={() => setSimulateOffline((v) => !v)}
        onSyncNow={() => void syncWithCloud(false)}
        onExportJson={handleExportJson}
        onDownloadShareCard={handleShareCard}
      />

      {/* ── Photo Capture & Multi-Upload Modal ───────────────────────────── */}
      <PhotoCaptureModal
        open={captureModalState.open}
        onClose={() => setCaptureModalState({ open: false })}
        userLocation={userLocation}
        initialCoords={captureModalState.coords}
        initialPlaceName={captureModalState.placeName}
        initialMode={captureModalState.mode}
        initialFiles={captureModalState.files}
        geofenceTargets={geofenceTargets}
        activeTrackClientId={isRecordingGps ? liveTrackTitle : selectedTrack?.clientId}
        onUploaded={handlePhotosUploaded}
        onRequestLocation={() => requestLiveLocation(true)}
      />

      {/* ── Full-Screen Photo Lightbox Modal ─────────────────────────────── */}
      {lightboxState && (
        <PhotoLightboxModal
          photos={lightboxState.photos}
          activeIndex={lightboxState.index}
          onChangeIndex={(nextIndex) => setLightboxState((prev) => (prev ? { ...prev, index: nextIndex } : null))}
          onClose={() => setLightboxState(null)}
          onFocusOnMap={(photo) => {
            setFollowUserLocation(false);
            setDockMode('map');
            mapRef.current?.flyTo({
              center: [photo.coordinates.lng, photo.coordinates.lat],
              zoom: 15.2,
              duration: 850,
            });
          }}
          onUpdatePhoto={handleUpdatePhoto}
          onDeletePhoto={handleDeletePhoto}
        />
      )}
    </div>
  );
}
