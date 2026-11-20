import clsx from 'clsx';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  CloudOff,
  Download,
  Eye,
  EyeOff,
  Flame,
  Footprints,
  MapPin,
  MapPinCheck,
  MapPinPlus,
  Pause,
  Play,
  Radio,
  RefreshCw,
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
  interpolateWaypoints,
  markTracksAsSynced,
  mergeServerTracksWithLocal,
  PRESET_DEMO_JOURNEYS,
  registerFootprintServiceWorker,
  saveLocalTrack,
  type CheckInPinItem,
  type LocalFootprintTrack,
  type MemoryPin,
  type PresetJourneyRoute,
  type TrackPoint,
} from '../lib/footprintOfflineStore';
import { toast } from '../stores/toastStore';
import type { BadgeInfo } from '../types/api';

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

type MapStyleMode = 'night_neon' | 'day_street' | 'satellite';

const MAP_TILES: Record<
  MapStyleMode,
  { url: string; attribution: string; label: string; tileClassName?: string }
> = {
  night_neon: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors · Neon Night Mode',
    label: '🌙 Đêm Neon (Bump/Jagat)',
    tileClassName: 'tp-neon-night-tile',
  },
  day_street: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    label: '🌿 Bản đồ Sáng',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
    label: '🛰️ Vệ tinh',
  },
};

const MOOD_PRESETS = [
  { emoji: '🦊', label: 'Tuyệt vời hết nấc' },
  { emoji: '🌸', label: 'Cảnh đẹp mê hồn' },
  { emoji: '🍜', label: 'Ngon xuất sắc' },
  { emoji: '📸', label: 'Góc sống ảo cực chất' },
  { emoji: '🪷', label: 'Bình yên xứ Sen' },
  { emoji: '🚣', label: 'Phiêu lưu sông nước' },
];

const TRACK_COLORS = ['#10b981', '#06b6d4', '#f43f5e', '#f59e0b', '#a855f7'];

function formatDurationClock(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return `${mins}p ${String(secs).padStart(2, '0')}s`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hrs}h ${remMins}p`;
}

export function FootprintMapPage() {
  useDocumentTitle('Bản đồ Dấu chân Khám phá · Đồng Tháp Smart Travel');

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const fogCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const polylinesGroupRef = useRef<L.LayerGroup | null>(null);
  const pinsGroupRef = useRef<L.LayerGroup | null>(null);
  const avatarMarkerRef = useRef<L.Marker | null>(null);

  const [tracks, setTracks] = useState<LocalFootprintTrack[]>([]);
  const [checkInPins, setCheckInPins] = useState<CheckInPinItem[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);

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

  // Map & Fog-of-War visual controls
  const [mapStyle, setMapStyle] = useState<MapStyleMode>('night_neon');
  const [fogEnabled, setFogEnabled] = useState(true);
  const [fogRadiusPx, setFogRadiusPx] = useState(46);

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
    lat: 10.4562,
    lng: 105.6324,
  });
  const [pinEmoji, setPinEmoji] = useState(MOOD_PRESETS[0]!.emoji);
  const [pinMood, setPinMood] = useState(MOOD_PRESETS[0]!.label);
  const [pinPlaceName, setPinPlaceName] = useState('');
  const [pinNote, setPinNote] = useState('');

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

  // Sync local pending tracks with MongoDB Server when online
  const syncWithCloud = useCallback(
    async (silent = false) => {
      let localList = await getAllLocalTracks();

      // Auto-seed a starter journey on first visit so the map is immediately alive & clear
      if (
        localList.length === 0 &&
        typeof window !== 'undefined' &&
        !window.sessionStorage.getItem('dtst_footprint_user_cleared')
      ) {
        const preset = PRESET_DEMO_JOURNEYS[0]!;
        const { points: starterPts, memories: starterMems } = interpolateWaypoints(preset.waypoints, 7);
        const starterTrack: LocalFootprintTrack = {
          clientId: `starter-${preset.id}`,
          title: preset.title,
          color: preset.color,
          distanceKm: calculatePolylineKm(starterPts),
          durationSeconds: starterPts.length * 18,
          startedAt: Date.now() - 1800000,
          endedAt: Date.now(),
          points: starterPts,
          memories: starterMems,
          isDemoRoute: true,
          syncStatus: 'pending',
        };
        await saveLocalTrack(starterTrack);
        localList = await getAllLocalTracks();
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
              `🛂 Tự động Điểm danh GPS thành công! (+${totalExp} EXP)`,
              `Khi di chuyển trên hành trình, hệ thống đã tự động đóng dấu Hộ chiếu tại ${autoList.length} điểm: ${names}.`,
            );
          } else if (!silent) {
            toast.success(
              'Đã đồng bộ lên Cloud!',
              `Đã sao lưu thành công ${pending.length} hành trình từ bộ nhớ Offline lên máy chủ.`,
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
            // ignore storage quota
          }
        }
      } catch {
        // Offline or network hiccup — local tracks remain safe in IndexedDB
      } finally {
        setIsSyncing(false);
      }
    },
    [autoCheckInEnabled, isEffectiveOnline, selectedTrackId],
  );

  // Initial load & auto-sync when switching from Offline -> Online
  useEffect(() => {
    void syncWithCloud(true);
  }, [syncWithCloud]);

  // Calculate statistics across all tracks + check-ins
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

  // Draw HTML5 Canvas Fog-of-War overlay synced with Leaflet viewport
  const redrawFogOfWar = useCallback(() => {
    const canvas = fogCanvasRef.current;
    const map = mapInstanceRef.current;
    if (!canvas || !map) return;

    const size = map.getSize();
    if (canvas.width !== size.x || canvas.height !== size.y) {
      canvas.width = size.x;
      canvas.height = size.y;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!fogEnabled) return;

    // 1. Fill translucent atmospheric Fog of War mist so map roads/rivers remain visible underneath
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle =
      mapStyle === 'night_neon' ? 'rgba(6, 18, 26, 0.54)' : 'rgba(12, 34, 28, 0.42)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Carve out soft clearings along every GPS trail, live point, memory pin, and check-in
    ctx.globalCompositeOperation = 'destination-out';

    const zoom = map.getZoom();
    const scaleFactor = Math.max(0.7, Math.min(2.4, Math.pow(1.18, zoom - 11)));
    const radius = fogRadiusPx * scaleFactor;

    const carveCircle = (lat: number, lng: number, r: number) => {
      const pt = map.latLngToContainerPoint([lat, lng]);
      if (pt.x < -r || pt.y < -r || pt.x > canvas.width + r || pt.y > canvas.height + r) return;
      const grad = ctx.createRadialGradient(pt.x, pt.y, r * 0.25, pt.x, pt.y, r);
      grad.addColorStop(0, 'rgba(0,0,0,1)');
      grad.addColorStop(0.65, 'rgba(0,0,0,0.90)');
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
        carveCircle(m.lat, m.lng, radius * 1.25);
      }
    }

    for (const p of livePoints) {
      carveCircle(p.lat, p.lng, radius * 1.15);
    }

    for (const pin of checkInPins) {
      carveCircle(pin.coordinates.lat, pin.coordinates.lng, radius * 1.35);
    }

    if (avatarPos) {
      carveCircle(avatarPos.lat, avatarPos.lng, radius * 1.45);
    }

    // If user cleared all tracks, keep a welcoming spotlight at the center of the viewport
    if (tracks.length === 0 && livePoints.length === 0 && checkInPins.length === 0) {
      const center = map.getCenter();
      carveCircle(center.lat, center.lng, radius * 2.1);
    }

    ctx.globalCompositeOperation = 'source-over';
  }, [fogEnabled, fogRadiusPx, mapStyle, tracks, livePoints, checkInPins, avatarPos]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [10.3025, 105.758],
      zoom: 13,
      zoomControl: true,
    });

    const tileConfig = MAP_TILES[mapStyle];
    const tileLayer = L.tileLayer(tileConfig.url, {
      attribution: tileConfig.attribution,
      maxZoom: 19,
      className: tileConfig.tileClassName || '',
    }).addTo(map);

    const polylinesGroup = L.layerGroup().addTo(map);
    const pinsGroup = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;
    tileLayerRef.current = tileLayer;
    polylinesGroupRef.current = polylinesGroup;
    pinsGroupRef.current = pinsGroup;

    // Allow clicking on map to pre-fill Memory Pin coordinates
    map.on('click', (e: L.LeafletMouseEvent) => {
      setPinCoords({
        lat: Number(e.latlng.lat.toFixed(6)),
        lng: Number(e.latlng.lng.toFixed(6)),
      });
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bind redrawFogOfWar to map movement/zoom
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    redrawFogOfWar();
    map.on('move zoom moveend zoomend resize', redrawFogOfWar);
    return () => {
      map.off('move zoom moveend zoomend resize', redrawFogOfWar);
    };
  }, [redrawFogOfWar]);

  // Switch Map Tile Theme
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (tileLayerRef.current) {
      tileLayerRef.current.remove();
    }
    const cfg = MAP_TILES[mapStyle];
    tileLayerRef.current = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      maxZoom: 19,
      className: cfg.tileClassName || '',
    }).addTo(map);
    redrawFogOfWar();
  }, [mapStyle, redrawFogOfWar]);

  // Render Glowing Polylines, Check-in Stamps & Jagat Memory Pins on Leaflet
  useEffect(() => {
    const polyGroup = polylinesGroupRef.current;
    const pinGroup = pinsGroupRef.current;
    if (!polyGroup || !pinGroup) return;

    polyGroup.clearLayers();
    pinGroup.clearLayers();

    const drawGlowingTrail = (pts: TrackPoint[], color: string, isSelected: boolean) => {
      if (pts.length < 2) return;
      const latlngs: L.LatLngExpression[] = pts.map((p) => [p.lat, p.lng]);

      // Outer neon glow halo
      L.polyline(latlngs, {
        color,
        weight: isSelected ? 14 : 10,
        opacity: isSelected ? 0.35 : 0.22,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(polyGroup);

      // Inner bright core trail
      L.polyline(latlngs, {
        color,
        weight: isSelected ? 5 : 3.5,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(polyGroup);

      // Start & End breadcrumb dots
      const first = pts[0]!;
      const last = pts[pts.length - 1]!;
      L.circleMarker([first.lat, first.lng], {
        radius: 5,
        color: '#ffffff',
        weight: 2,
        fillColor: color,
        fillOpacity: 1,
      }).addTo(polyGroup);

      L.circleMarker([last.lat, last.lng], {
        radius: 6,
        color: '#ffffff',
        weight: 2,
        fillColor: color,
        fillOpacity: 1,
      }).addTo(polyGroup);
    };

    // Draw saved/offline tracks
    for (const t of tracks) {
      const isSel = t.clientId === selectedTrackId;
      drawGlowingTrail(t.points, t.color || '#10b981', isSel);

      for (const mem of t.memories || []) {
        const icon = L.divIcon({
          className: 'dtst-memory-pin',
          html: `<div style="display:inline-flex;align-items:center;gap:4px;background:rgba(255,255,255,0.95);border:2px solid ${t.color || '#10b981'};border-radius:999px;padding:3px 9px;box-shadow:0 6px 16px rgba(0,0,0,0.28);white-space:nowrap;font-size:11px;font-weight:700;color:#0f2922;transform:translate(-50%,-100%);max-width:165px;">
            <span style="font-size:14px;flex-shrink:0">${mem.emoji}</span>
            <span style="overflow:hidden;text-overflow:ellipsis">${mem.placeName || mem.moodLabel}</span>
          </div>`,
          iconSize: [0, 0],
        });
        L.marker([mem.lat, mem.lng], { icon })
          .bindPopup(
            `<div style="min-width:180px">
              <div style="font-weight:800;font-size:13px;color:#0f2922">${mem.emoji} ${mem.placeName || mem.moodLabel}</div>
              <div style="font-size:11px;color:#047857;font-weight:600;margin-top:2px">${mem.moodLabel}</div>
              ${mem.note ? `<p style="font-size:12px;color:#334155;margin:6px 0 0">${mem.note}</p>` : ''}
            </div>`,
          )
          .addTo(pinGroup);
      }
    }

    // Draw active live recording trail
    if (livePoints.length >= 2) {
      drawGlowingTrail(livePoints, '#f43f5e', true);
    }
    for (const mem of liveMemories) {
      const icon = L.divIcon({
        className: 'dtst-live-memory-pin',
        html: `<div style="display:inline-flex;align-items:center;gap:4px;background:#fff1f2;border:2px solid #f43f5e;border-radius:999px;padding:3px 9px;box-shadow:0 6px 16px rgba(244,63,94,0.35);white-space:nowrap;font-size:11px;font-weight:700;color:#881337;transform:translate(-50%,-100%);">
          <span style="font-size:14px">${mem.emoji}</span>
          <span>${mem.placeName || mem.moodLabel}</span>
        </div>`,
        iconSize: [0, 0],
      });
      L.marker([mem.lat, mem.lng], { icon }).addTo(pinGroup);
    }

    // Draw Passport Check-in Stamp Pins
    for (const chk of checkInPins) {
      const icon = L.divIcon({
        className: 'dtst-checkin-pin',
        html: `<div style="display:inline-flex;align-items:center;gap:4px;background:linear-gradient(135deg,#059669,#0d9488);color:white;border:2px solid white;border-radius:999px;padding:3px 9px;box-shadow:0 6px 16px rgba(5,150,105,0.45);white-space:nowrap;font-size:11px;font-weight:800;transform:translate(-50%,-100%);max-width:165px;">
          <span style="flex-shrink:0">🛂</span>
          <span style="overflow:hidden;text-overflow:ellipsis">${chk.name}</span>
        </div>`,
        iconSize: [0, 0],
      });
      L.marker([chk.coordinates.lat, chk.coordinates.lng], { icon })
        .bindPopup(
          `<div style="min-width:190px">
            <div style="font-size:10px;font-weight:800;text-transform:uppercase;color:#059669">🛂 Đã đóng dấu Hộ chiếu (+${chk.pointsAwarded}đ)</div>
            <div style="font-weight:800;font-size:13px;color:#0f2922;margin-top:2px">${chk.name}</div>
            <p style="font-size:11px;color:#475569;margin:4px 0 6px">${chk.summary}</p>
            <a href="/destinations/${chk.slug}" style="font-size:11px;font-weight:700;color:#059669;text-decoration:underline">Xem chi tiết địa điểm →</a>
          </div>`,
        )
        .addTo(pinGroup);
    }

    redrawFogOfWar();
  }, [tracks, selectedTrackId, livePoints, liveMemories, checkInPins, redrawFogOfWar]);

  // Render Moving Avatar Marker (Pé Meko 🦊) during Replay / Demo / Live GPS
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (!avatarPos) {
      if (avatarMarkerRef.current) {
        avatarMarkerRef.current.remove();
        avatarMarkerRef.current = null;
      }
      return;
    }

    const icon = L.divIcon({
      className: 'dtst-avatar-marker',
      html: `<div style="position:relative;display:flex;align-items:center;justify-content:center;width:42px;height:42px;transform:translate(-50%,-50%);">
        <span style="position:absolute;inset:0;border-radius:999px;background:rgba(16,185,129,0.45);animation:ping 1.4s cubic-bezier(0,0,0.2,1) infinite;"></span>
        <span style="position:relative;display:grid;place-items:center;width:36px;height:36px;border-radius:999px;background:linear-gradient(135deg,#059669,#14b8a6);border:2.5px solid white;box-shadow:0 8px 20px rgba(0,0,0,0.4);font-size:20px;">🦊</span>
      </div>`,
      iconSize: [0, 0],
    });

    if (!avatarMarkerRef.current) {
      avatarMarkerRef.current = L.marker([avatarPos.lat, avatarPos.lng], {
        icon,
        zIndexOffset: 1000,
      }).addTo(map);
    } else {
      avatarMarkerRef.current.setLatLng([avatarPos.lat, avatarPos.lng]);
    }
    redrawFogOfWar();
  }, [avatarPos, redrawFogOfWar]);

  // Timer for live recording elapsed seconds
  useEffect(() => {
    if (!isRecordingGps || !liveStartedAt) return;
    const id = window.setInterval(() => {
      setLiveElapsedSec(Math.floor((Date.now() - liveStartedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [isRecordingGps, liveStartedAt]);

  // Hands-Free Automatic GPS Geofence Check-in (triggers when entering <= 1,000m of any destination)
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

          // Immediately add Passport Stamp Pin on the map & open Fog-of-War
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
                  `Hệ thống phát hiện bạn vừa đến gần "${target.name}" (cách ${distMeters}m) và tự động đóng dấu Hộ chiếu số!`,
                );
                if (res.data.newBadges?.length) {
                  announceBadges(res.data.newBadges);
                }
              }
            } catch {
              // If transient network drop, syncFootprintsHandler will still auto-checkin on next sync!
            }
          } else {
            toast.info(
              `🛂 Tự động Điểm danh Offline: ${target.name}`,
              `Đã ghi nhận tự động vào bộ nhớ máy (cách ${distMeters}m). Sẽ tự động cộng +15 EXP khi có Wi-Fi lại!`,
            );
          }
        }
      }
    },
    [autoCheckInEnabled, geofenceTargets, isEffectiveOnline, simulatingRouteId],
  );

  // Start Live Real GPS Recording (with Screen Wake Lock + Offline IndexedDB autosave)
  const handleStartLiveGps = async () => {
    if (!('geolocation' in navigator)) {
      toast.error('Thiết bị không hỗ trợ GPS', 'Bạn có thể dùng nút Chạy thử Hành trình Mẫu bên cạnh nhé!');
      return;
    }

    // Request Screen Wake Lock so phone screen stays awake while riding/walking
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      }
    } catch {
      // ignore if browser blocks wakeLock
    }

    const startTs = Date.now();
    setLiveStartedAt(startTs);
    setLiveElapsedSec(0);
    setLivePoints([]);
    setLiveMemories([]);
    setIsRecordingGps(true);

    toast.success(
      'Đã bật ghi hành trình & Tự động Điểm danh GPS!',
      isEffectiveOnline
        ? 'Đi qua bất kỳ điểm du lịch nào trong bán kính 1.000m sẽ tự động được điểm danh nhận EXP!'
        : 'Đang ghi ở chế độ Offline (Mất Wi-Fi) — vẫn tự động phát hiện và lưu điểm danh vào máy!',
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
            if (haversineDistanceKm(last, pt) < 0.008) return prev; // filter GPS jitter < 8m
          }
          const updated = [...prev, pt];
          mapInstanceRef.current?.panTo([pt.lat, pt.lng], { animate: true });
          return updated;
        });
      },
      () => {
        toast.info('Đang chờ tín hiệu vệ tinh GPS...', 'Nếu bạn ngồi trong nhà, hãy thử bấm Chạy Hành trình Mẫu!');
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 },
    );

    watchIdRef.current = watchId;
  };

  // Stop & Save Live GPS Recording to IndexedDB (+ sync to Cloud if online)
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
      toast.info('Chưa ghi nhận được bước di chuyển nào', 'Bạn có thể bấm Chạy thử Hành trình Mẫu để xem hiệu ứng vẽ đường!');
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
    setSelectedTrackId(newTrack.clientId);

    await syncWithCloud(false);
  };

  // 1-Click Simulate a Realistic Journey Across Đồng Tháp (Great for Laptop Demo & Testing Offline Sync!)
  const handleRunDemoJourney = (preset: PresetJourneyRoute) => {
    if (simTimerRef.current) {
      window.clearInterval(simTimerRef.current);
      simTimerRef.current = null;
    }
    setIsReplaying(false);
    setSimulatingRouteId(preset.id);

    const { points: fullPoints, memories: fullMemories } = interpolateWaypoints(preset.waypoints, 7);
    const startPt = fullPoints[0]!;
    mapInstanceRef.current?.flyTo([startPt.lat, startPt.lng], 13, { duration: 1.2 });

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
          durationSeconds: fullPoints.length * 18,
          startedAt: Date.now() - fullPoints.length * 18000,
          endedAt: Date.now(),
          points: fullPoints,
          memories: fullMemories,
          isDemoRoute: true,
          syncStatus: 'pending',
        };

        await saveLocalTrack(completedTrack);
        setLivePoints([]);
        setLiveMemories([]);
        setSelectedTrackId(completedTrack.clientId);

        if (isEffectiveOnline) {
          await syncWithCloud(false);
        } else {
          const updated = await getAllLocalTracks();
          setTracks(updated);
          toast.info(
            'Đã lưu hành trình & điểm danh vào Bộ nhớ Offline (IndexedDB)!',
            `Hành trình "${preset.title}" (${completedTrack.distanceKm} km) đã được lưu an toàn khi mất Wi-Fi. Hãy bật lại Wi-Fi để xem tự động đồng bộ!`,
          );
        }
        return;
      }

      const nextPt = fullPoints[idx]!;
      const partialPoints = fullPoints.slice(0, idx + 1);
      const unlockedMems = fullMemories.filter((m) =>
        partialPoints.some((p) => haversineDistanceKm(p, m) < 0.08),
      );

      setLivePoints(partialPoints);
      setLiveMemories(unlockedMems);
      setAvatarPos({ lat: nextPt.lat, lng: nextPt.lng });
      setPinCoords({ lat: nextPt.lat, lng: nextPt.lng });
      void checkAndTriggerGeofence(nextPt.lat, nextPt.lng);
      mapInstanceRef.current?.panTo([nextPt.lat, nextPt.lng], { animate: true });
      idx++;
    }, 140);
  };

  // Animated Route Replay for Selected Track
  const selectedTrack = useMemo(
    () => tracks.find((t) => t.clientId === selectedTrackId) || tracks[0] || null,
    [tracks, selectedTrackId],
  );

  useEffect(() => {
    if (!isReplaying || !selectedTrack || selectedTrack.points.length < 2) {
      if (replayTimerRef.current) {
        window.clearInterval(replayTimerRef.current);
        replayTimerRef.current = null;
      }
      return;
    }

    const totalPts = selectedTrack.points.length;
    const intervalMs = Math.max(40, Math.round(180 / replaySpeed));

    replayTimerRef.current = window.setInterval(() => {
      setReplayProgress((prev) => {
        const next = prev + 100 / totalPts;
        if (next >= 100) {
          setIsReplaying(false);
          const last = selectedTrack.points[totalPts - 1]!;
          setAvatarPos({ lat: last.lat, lng: last.lng });
          return 100;
        }
        const ptIdx = Math.min(totalPts - 1, Math.floor((next / 100) * totalPts));
        const pt = selectedTrack.points[ptIdx]!;
        setAvatarPos({ lat: pt.lat, lng: pt.lng });
        mapInstanceRef.current?.panTo([pt.lat, pt.lng], { animate: true });
        return next;
      });
    }, intervalMs);

    return () => {
      if (replayTimerRef.current) {
        window.clearInterval(replayTimerRef.current);
        replayTimerRef.current = null;
      }
    };
  }, [isReplaying, replaySpeed, selectedTrack]);

  const handleStartReplay = (track: LocalFootprintTrack) => {
    if (track.points.length < 2) return;
    setSelectedTrackId(track.clientId);
    setReplayProgress(0);
    const first = track.points[0]!;
    setAvatarPos({ lat: first.lat, lng: first.lng });
    mapInstanceRef.current?.flyTo([first.lat, first.lng], 13, { duration: 0.9 });
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
      setSelectedTrackId(remaining[0]?.clientId ?? null);
    }
    toast.info('Đã xóa hành trình khỏi bản đồ');
  };

  const handleExportJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      platform: 'Đồng Tháp Smart Travel - Footprint Map',
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

  return (
    <PageContainer>
      <style>{`
        .leaflet-tile.tp-neon-night-tile {
          filter: invert(100%) hue-rotate(185deg) brightness(94%) contrast(96%) saturate(140%);
        }
        .tp-night-map-bg .leaflet-container {
          background: #0b1922 !important;
        }
      `}</style>
      {/* ── Top Offline-First & Cloud Sync Status Bar ────────────────── */}
      <div
        className={clsx(
          'mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-xs shadow-2xs transition-all',
          !isEffectiveOnline
            ? 'border-amber-300 bg-gradient-to-r from-amber-50 via-orange-50/70 to-white text-amber-950'
            : pendingSyncCount > 0
              ? 'border-teal-300 bg-teal-50/70 text-teal-950'
              : 'border-emerald-200 bg-emerald-50/60 text-emerald-950',
        )}
      >
        <div className="flex items-center gap-2.5">
          <span
            className={clsx(
              'grid size-8 shrink-0 place-items-center rounded-xl text-white shadow-xs',
              !isEffectiveOnline ? 'bg-amber-500 animate-pulse' : 'bg-emerald-600',
            )}
          >
            {!isEffectiveOnline ? <WifiOff className="size-4" /> : <Wifi className="size-4" />}
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2 font-bold">
              <span>
                {!isEffectiveOnline
                  ? '🟠 Đang ở Chế độ Offline (Mất kết nối Wi-Fi / 4G)'
                  : '🟢 Kết nối Cloud Trực tuyến · Tự động đồng bộ IndexedDB'}
              </span>
              {pendingSyncCount > 0 && (
                <span className="rounded-full bg-amber-200/90 px-2.5 py-0.5 text-[11px] font-extrabold text-amber-900">
                  {pendingSyncCount} hành trình đang lưu đệm trên máy chờ đồng bộ
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[11px] opacity-85">
              {!isEffectiveOnline
                ? 'Chip GPS và bộ nhớ IndexedDB vẫn đang ghi lại 100% bước di chuyển & ghim kỷ niệm của bạn mà không cần internet!'
                : 'Mọi vệt hành trình và vùng mở khóa sương mù đều được lưu song song trên thiết bị (Offline-First) và máy chủ đám mây.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const nextState = !simulateOffline;
              setSimulateOffline(nextState);
              if (!nextState) {
                toast.info('Đã bật lại kết nối mạng!', 'Đang tự động đẩy dữ liệu Offline từ IndexedDB lên Cloud...');
              } else {
                toast.info(
                  'Đã bật Giả lập Mất Wi-Fi!',
                  'Bây giờ bạn hãy thử Chạy hành trình mẫu hoặc Thả ghim để kiểm chứng khả năng lưu Offline 100%!',
                );
              }
            }}
            className={clsx(
              'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-extrabold transition shadow-2xs',
              simulateOffline
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'border border-amber-300 bg-white text-amber-800 hover:bg-amber-50',
            )}
          >
            {simulateOffline ? (
              <>
                <Wifi className="size-3.5" /> Bật lại Wi-Fi (Auto-Sync)
              </>
            ) : (
              <>
                <CloudOff className="size-3.5" /> Test giả lập Mất Wi-Fi
              </>
            )}
          </button>

          <button
            type="button"
            disabled={isSyncing || !isEffectiveOnline}
            onClick={() => void syncWithCloud(false)}
            className="inline-flex items-center gap-1 rounded-full border border-sand-300 bg-white px-3 py-1.5 text-xs font-bold text-river-700 hover:bg-sand-50 disabled:opacity-45"
          >
            <RefreshCw className={clsx('size-3.5', isSyncing && 'animate-spin')} />
            Đồng bộ ngay
          </button>
        </div>
      </div>

      {/* ── Hero Banner & Gamified Stats ──────────────────────────────── */}
      <section className="tp-fade-up relative overflow-hidden rounded-panel bg-gradient-to-br from-river-950 via-leaf-900 to-teal-900 p-4 text-white shadow-raised sm:p-8">
        <div
          className="pointer-events-none absolute -right-12 -top-16 size-72 rounded-full bg-emerald-400/15 blur-3xl"
          aria-hidden
        />
        <div className="relative flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold text-teal-200 ring-1 ring-white/20 sm:text-xs">
              <Footprints className="size-3.5" />
              Bump & Jagat Style · Fog-of-War & Live Trail
            </span>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-white sm:mt-2.5 sm:text-4xl">
              Bản đồ Dấu chân Khám phá
            </h1>
            <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-leaf-100 sm:text-sm">
              Đi đến đâu, xóa tan lớp sương mù bản đồ và vẽ lại vệt hành trình phát sáng tới đó. Tự động lưu Offline
              vào máy ngay cả khi đi giữa rừng tràm không có sóng Wi-Fi!
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            {!isRecordingGps ? (
              <button
                type="button"
                onClick={() => void handleStartLiveGps()}
                className="inline-flex items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-rose-500 to-amber-500 px-3.5 py-2.5 text-xs font-extrabold text-white shadow-lg shadow-rose-600/30 transition hover:scale-105 sm:px-5"
              >
                <Radio className="size-4 shrink-0 animate-pulse" />
                <span className="truncate">Ghi GPS thực tế</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleStopAndSaveLiveGps()}
                className="inline-flex items-center justify-center gap-1.5 rounded-full bg-rose-600 px-3.5 py-2.5 text-xs font-extrabold text-white ring-4 ring-rose-400/40 animate-pulse sm:px-5"
              >
                <Square className="size-3.5 shrink-0 fill-white" />
                <span className="truncate">Dừng ({formatDurationClock(liveElapsedSec)})</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setPinModalOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 rounded-full bg-white/15 px-3.5 py-2.5 text-xs font-bold text-white ring-1 ring-white/25 backdrop-blur-sm transition hover:bg-white/25 sm:px-4"
            >
              <MapPinPlus className="size-4 shrink-0 text-amber-300" />
              <span className="truncate">Thả Ghim Kỷ Niệm</span>
            </button>
          </div>
        </div>

        {/* 4 Gamified Stat Tiles (Compact 2x2 grid on mobile!) */}
        <div className="relative mt-4 grid grid-cols-2 gap-2.5 sm:mt-6 sm:gap-3 lg:grid-cols-4">
          <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/15 backdrop-blur-xs sm:p-4">
            <div className="flex items-center justify-between text-[11px] font-semibold text-teal-200 sm:text-xs">
              <span className="truncate">🌫️ Mở khóa Sương mù</span>
              <Flame className="size-3.5 shrink-0 text-amber-300 sm:size-4" />
            </div>
            <p className="mt-1 text-xl font-black text-white sm:mt-1.5 sm:text-2xl">{stats.exploredPercent}%</p>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/15 sm:mt-2">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-300 to-teal-300 transition-all duration-700"
                style={{ width: `${Math.max(5, stats.exploredPercent)}%` }}
              />
            </div>
            <p className="mt-1 truncate text-[10px] text-leaf-100/80 sm:text-[11px]">{stats.unlockedZones} vùng đã mở</p>
          </div>

          <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/15 backdrop-blur-xs sm:p-4">
            <p className="truncate text-[11px] font-semibold text-teal-200 sm:text-xs">👣 Quãng đường đã vẽ</p>
            <p className="mt-1 text-xl font-black text-white sm:mt-1.5 sm:text-2xl">{stats.totalKm} km</p>
            <p className="mt-1.5 truncate text-[10px] text-leaf-100/80 sm:mt-2 sm:text-[11px]">Vệ tinh GPS thực địa</p>
          </div>

          <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/15 backdrop-blur-xs sm:p-4">
            <p className="truncate text-[11px] font-semibold text-teal-200 sm:text-xs">⚡ Chuyến hành trình</p>
            <p className="mt-1 text-xl font-black text-white sm:mt-1.5 sm:text-2xl">{stats.totalTracks} chuyến</p>
            <p className="mt-1.5 truncate text-[10px] text-leaf-100/80 sm:mt-2 sm:text-[11px]">
              {pendingSyncCount > 0 ? `${pendingSyncCount} chuyến chờ mạng` : 'Sao lưu máy & Cloud'}
            </p>
          </div>

          <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/15 backdrop-blur-xs sm:p-4">
            <p className="truncate text-[11px] font-semibold text-teal-200 sm:text-xs">📍 Con dấu & Ghim</p>
            <p className="mt-1 text-xl font-black text-white sm:mt-1.5 sm:text-2xl">
              {stats.totalCheckIns + stats.totalMemories} điểm
            </p>
            <p className="mt-1.5 truncate text-[10px] text-leaf-100/80 sm:mt-2 sm:text-[11px]">
              {stats.totalCheckIns} Hộ chiếu · {stats.totalMemories} ghim
            </p>
          </div>
        </div>
      </section>

      {/* ── Main Interactive Map + Sidebar Layout ─────────────────────── */}
      <div className="mt-5 grid gap-5 sm:mt-6 sm:gap-6 lg:grid-cols-[1fr_360px]">
        {/* Left: Interactive Map & Floating Controls */}
        <div className="min-w-0 space-y-3.5 sm:space-y-4">
          {/* 1-Click Demo Route Simulator Bar (Swipeable carousel on mobile!) */}
          <Card className="border border-leaf-200 bg-gradient-to-r from-leaf-50/90 via-white to-teal-50/60 p-3.5 shadow-2xs sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="flex items-center gap-1.5 text-sm font-extrabold text-river-900">
                  <Zap className="size-4 text-amber-500" />
                  Chạy thử Hành trình Mẫu (1-Click)
                </h2>
                <p className="text-[11px] text-river-600 sm:text-xs">
                  Chạm 1 cung đường để xem <strong>Pé Meko 🦊</strong> tự chạy, xóa sương mù và Tự động Điểm danh (hoạt động cả khi <em>Mất Wi-Fi</em>!).
                </p>
              </div>
            </div>

            <div className="mt-2.5 flex snap-x gap-2.5 overflow-x-auto pb-1 no-scrollbar sm:mt-3 sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0">
              {PRESET_DEMO_JOURNEYS.map((route) => {
                const isRunning = simulatingRouteId === route.id;
                return (
                  <button
                    key={route.id}
                    type="button"
                    disabled={Boolean(simulatingRouteId)}
                    onClick={() => handleRunDemoJourney(route)}
                    className={clsx(
                      'flex w-[240px] max-w-[76vw] shrink-0 snap-start flex-col justify-between rounded-2xl border p-3 text-left transition-all sm:w-auto sm:max-w-none',
                      isRunning
                        ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-300'
                        : 'border-sand-200 bg-white hover:-translate-y-0.5 hover:border-leaf-400 hover:shadow-sm',
                    )}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className="inline-block size-3 rounded-full"
                          style={{ backgroundColor: route.color }}
                        />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-leaf-700">
                          {isRunning ? '🦊 Đang di chuyển...' : '▶️ Chạy thử'}
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs font-extrabold text-river-900">{route.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-[11px] text-river-500">{route.subtitle}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Map Toolbar (Single-row swipeable pills on mobile!) */}
          <div className="flex flex-nowrap items-center justify-between gap-2 overflow-x-auto rounded-2xl border border-sand-200 bg-white p-2.5 shadow-2xs no-scrollbar sm:flex-wrap sm:overflow-visible sm:p-3">
            <div className="flex shrink-0 items-center gap-1.5">
              {(Object.keys(MAP_TILES) as MapStyleMode[]).map((mode) => (
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
                  {MAP_TILES[mode].label}
                </button>
              ))}
            </div>

            <div className="flex shrink-0 items-center gap-1.5 sm:flex-wrap sm:gap-2">
              <button
                type="button"
                onClick={() => {
                  const next = !autoCheckInEnabled;
                  setAutoCheckInEnabled(next);
                  toast.info(
                    next
                      ? 'Đã BẬT Tự động Điểm danh GPS (<1.000m)'
                      : 'Đã TẮT Tự động Điểm danh GPS',
                    next
                      ? 'Khi bạn di chuyển qua bất kỳ điểm du lịch nào trong bán kính 1.000m, hệ thống sẽ tự động điểm danh nhận EXP mà không cần bấm tay!'
                      : 'Chuyển về chế độ điểm danh thủ công.',
                  );
                }}
                className={clsx(
                  'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-extrabold transition sm:px-3.5',
                  autoCheckInEnabled
                    ? 'bg-emerald-600 text-white shadow-xs ring-1 ring-emerald-400'
                    : 'bg-sand-100 text-river-600 hover:bg-sand-200',
                )}
              >
                <MapPinCheck className="size-3.5" />
                {autoCheckInEnabled ? 'Tự động Check-in: BẬT' : 'Tự động Check-in: TẮT'}
              </button>

              <button
                type="button"
                onClick={() => setFogEnabled((v) => !v)}
                className={clsx(
                  'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-extrabold transition sm:px-3.5',
                  fogEnabled
                    ? 'bg-river-900 text-teal-200 ring-1 ring-teal-400/50'
                    : 'bg-sand-100 text-river-600 hover:bg-sand-200',
                )}
              >
                {fogEnabled ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                {fogEnabled ? 'Sương mù: BẬT' : 'Sương mù: TẮT'}
              </button>

              {fogEnabled && (
                <label className="hidden items-center gap-1.5 text-[11px] font-semibold text-river-600 sm:flex">
                  <span>Độ mở:</span>
                  <input
                    type="range"
                    min={28}
                    max={80}
                    value={fogRadiusPx}
                    onChange={(e) => setFogRadiusPx(Number(e.target.value))}
                    className="w-20 accent-leaf-600"
                  />
                </label>
              )}
            </div>
          </div>

          {/* Map Canvas Container (isolated stacking context so Leaflet panes never bleed over modals/chat!) */}
          <div
            className={clsx(
              'isolate z-0 relative h-[58dvh] min-h-[380px] w-full overflow-hidden rounded-3xl border-2 border-leaf-300 shadow-raised sm:h-[520px]',
              mapStyle === 'night_neon' && 'tp-night-map-bg',
            )}
          >
            <div ref={mapContainerRef} className="size-full z-10" />
            <canvas
              ref={fogCanvasRef}
              className="pointer-events-none absolute inset-0 z-[400]"
            />

            {/* Floating Bottom Replay HUD inside Map */}
            {selectedTrack && selectedTrack.points.length >= 2 && (
              <div className="absolute bottom-3 left-3 right-3 z-[500] flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/25 bg-river-950/92 px-3 py-2.5 text-white shadow-2xl backdrop-blur-md sm:bottom-4 sm:left-4 sm:right-4 sm:gap-3 sm:px-4 sm:py-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (isReplaying) {
                        setIsReplaying(false);
                      } else {
                        handleStartReplay(selectedTrack);
                      }
                    }}
                    className="grid size-9 shrink-0 place-items-center rounded-full bg-emerald-500 text-white shadow-md transition hover:bg-emerald-400"
                    title={isReplaying ? 'Tạm dừng' : 'Phát lại hành trình (Replay)'}
                  >
                    {isReplaying ? <Pause className="size-4" /> : <Play className="size-4 fill-white" />}
                  </button>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-extrabold text-white">
                      🎬 {selectedTrack.title}
                    </p>
                    <p className="text-[11px] text-teal-200">
                      {selectedTrack.distanceKm} km · {selectedTrack.points.length} điểm GPS ·{' '}
                      {selectedTrack.memories?.length || 0} kỷ niệm
                    </p>
                  </div>
                </div>

                <div className="flex flex-1 items-center gap-3 min-w-[160px] max-w-xs">
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
                        mapInstanceRef.current?.panTo([pt.lat, pt.lng]);
                      }
                    }}
                    className="w-full accent-emerald-400"
                  />
                  <span className="w-9 text-right text-[11px] font-bold tabular-nums text-teal-200">
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

        {/* Right Sidebar: Recorded Journeys, Memory Pins & Backup */}
        <aside className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-extrabold text-river-900">
                  Nhật ký Hành trình ({tracks.length})
                </h2>
                <p className="text-xs text-river-500">
                  Bấm vào từng chuyến đi để định vị hoặc phát lại (Replay)
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportJson}
                title="Tải file sao lưu Offline (.json)"
                className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-sand-100 px-3 py-1.5 text-xs font-bold text-river-700 hover:bg-leaf-50 hover:text-leaf-800"
              >
                <Download className="size-3.5" />
                Sao lưu
              </button>
            </div>

            {tracks.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-sand-300 bg-sand-50/60 p-5 text-center">
                <Footprints className="mx-auto size-8 text-leaf-600 opacity-75" />
                <p className="mt-2 text-xs font-bold text-river-800">Chưa có vệt hành trình nào</p>
                <p className="mt-1 text-[11px] text-river-500">
                  Hãy bấm <strong>“Ghi hành trình GPS thực tế”</strong> hoặc chạy ngay cung đường mẫu bên dưới để xóa
                  sương mù nhé!
                </p>
                <button
                  type="button"
                  onClick={() => handleRunDemoJourney(PRESET_DEMO_JOURNEYS[0]!)}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-leaf-600 px-4 py-2 text-xs font-extrabold text-white shadow-xs hover:bg-leaf-700"
                >
                  <Play className="size-3.5 fill-white" /> Chạy thử Cung đường Sa Đéc
                </button>
              </div>
            ) : (
              <div className="mt-4 max-h-[380px] space-y-2.5 overflow-y-auto pr-1">
                {tracks.map((t) => {
                  const isSelected = t.clientId === (selectedTrack?.clientId ?? '');
                  return (
                    <div
                      key={t.clientId}
                      onClick={() => {
                        setSelectedTrackId(t.clientId);
                        const first = t.points[0];
                        if (first) {
                          mapInstanceRef.current?.flyTo([first.lat, first.lng], 13, { duration: 0.8 });
                        }
                      }}
                      className={clsx(
                        'cursor-pointer rounded-2xl border p-3.5 transition-all',
                        isSelected
                          ? 'border-leaf-500 bg-leaf-50/60 ring-1 ring-leaf-300'
                          : 'border-sand-200 bg-white hover:border-leaf-300',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="size-3 shrink-0 rounded-full"
                            style={{ backgroundColor: t.color || '#10b981' }}
                          />
                          <h3 className="truncate text-xs font-extrabold text-river-900">{t.title}</h3>
                        </div>
                        <span
                          className={clsx(
                            'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold',
                            t.syncStatus === 'pending'
                              ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-300'
                              : 'bg-emerald-100 text-emerald-800',
                          )}
                        >
                          {t.syncStatus === 'pending' ? '🟠 Lưu Offline' : '🟢 Đã đồng bộ'}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-river-600">
                        <span>📏 {t.distanceKm} km</span>
                        <span>⏱️ {formatDurationClock(t.durationSeconds || 60)}</span>
                        <span>📍 {t.memories?.length || 0} ghim</span>
                      </div>

                      <div className="mt-2.5 flex items-center justify-between border-t border-sand-100 pt-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartReplay(t);
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-extrabold text-leaf-700 hover:underline"
                        >
                          <Play className="size-3 fill-leaf-700" /> Phát lại chuyến đi
                        </button>
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
            )}
          </Card>

          {/* Passport Check-in Connection Card */}
          <Card className="bg-gradient-to-br from-leaf-900 to-river-900 p-5 text-white">
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-xl bg-white/15 text-teal-200">
                <Stamp className="size-5" />
              </span>
              <div>
                <h3 className="text-sm font-extrabold text-white">Liên kết Hộ chiếu Trải nghiệm</h3>
                <p className="text-[11px] text-leaf-100">
                  {checkInPins.length} điểm đã đóng dấu trên bản đồ
                </p>
              </div>
            </div>
            <p className="mt-2.5 text-xs leading-relaxed text-leaf-100/90">
              Mỗi lần bạn thực hiện <strong>Điểm danh GPS</strong> hoặc <strong>Quét mã QR</strong> tại điểm tham quan,
              con dấu sẽ tự động thắp sáng vùng sương mù trên Bản đồ Dấu chân này!
            </p>
            <div className="mt-3.5 flex flex-wrap gap-2">
              <Link
                to="/check-in"
                className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-3.5 py-1.5 text-xs font-extrabold text-white hover:bg-emerald-400"
              >
                <MapPin className="size-3.5" /> Điểm danh GPS ngay
              </Link>
              <Link
                to="/passport"
                className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-white/25"
              >
                Xem Hộ chiếu số →
              </Link>
            </div>
          </Card>
        </aside>
      </div>

      {/* ── Drop Memory Pin Modal (Jagat Style) ───────────────────────── */}
      {pinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div className="tp-scale-up w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-sand-200">
            <div className="flex items-start justify-between">
              <div>
                <span className="inline-flex items-center gap-1 rounded-full bg-leaf-50 px-2.5 py-0.5 text-[11px] font-bold text-leaf-700">
                  <Sparkles className="size-3" /> Jagat & Bump Memory Pin
                </span>
                <h3 className="mt-1 text-lg font-extrabold text-river-900">
                  Thả Ghim Kỷ Niệm trên Hành trình
                </h3>
                <p className="text-xs text-river-500">
                  Tọa độ: {pinCoords.lat.toFixed(4)}, {pinCoords.lng.toFixed(4)} *(Bạn có thể chạm vào bản đồ để chọn vị trí)*
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
                  className="mt-1 w-full rounded-xl border border-sand-300 px-3 py-2 text-xs text-river-900 focus:border-leaf-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-river-700">Ghi chú kỷ niệm</label>
                <textarea
                  rows={2}
                  value={pinNote}
                  onChange={(e) => setPinNote(e.target.value)}
                  placeholder="Lưu lại cảm xúc hoặc mẹo nhỏ tại tọa độ này..."
                  className="mt-1 w-full rounded-xl border border-sand-300 px-3 py-2 text-xs text-river-900 focus:border-leaf-500 focus:outline-none"
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
