import { Radio } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  calculatePolylineKm,
  saveLocalTrack,
  type LocalFootprintTrack,
  type TrackPoint,
} from '../../lib/footprintOfflineStore';
import { getActiveRecordingKm, useGpsRecordingStore } from '../../stores/gpsRecordingStore';
import { toast } from '../../stores/toastStore';

const USER_LOC_CACHE_KEY = 'dtst_last_known_user_loc_v1';
const CHECKPOINT_INTERVAL_MS = 30_000;

interface WakeLockSentinelLike {
  released?: boolean;
  release: () => Promise<void>;
  addEventListener?: (type: string, listener: () => void) => void;
}

/**
 * Global layout-level GPS track recorder.
 * - Survives in-app page navigation (e.g. /footprints -> /destinations -> /passport).
 * - Persists every GPS fix immediately to localStorage + checkpoints to IndexedDB every 30s & on pagehide.
 * - Auto-resumes after PWA / browser tab reload, auto-reacquires Screen Wake Lock, and grabs an immediate
 *   catch-up checkpoint whenever the phone wakes from sleep / returns from another app.
 */
export function GpsTrackRecorderWatcher() {
  const { pathname } = useLocation();
  const session = useGpsRecordingStore((s) => s.session);
  const isRecording = Boolean(session);
  const appendPoint = useGpsRecordingStore((s) => s.appendPoint);
  const setWakeLockActive = useGpsRecordingStore((s) => s.setWakeLockActive);
  const setGpsError = useGpsRecordingStore((s) => s.setGpsError);

  const watchIdRef = useRef<number | null>(null);
  const restartTimerRef = useRef<number | null>(null);
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);

  useEffect(() => {
    if (!isRecording) return;
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setGpsError('Thiết bị không hỗ trợ cảm biến GPS.');
      return;
    }

    let cancelled = false;

    const persistLastKnown = (pos: GeolocationPosition) => {
      try {
        localStorage.setItem(
          USER_LOC_CACHE_KEY,
          JSON.stringify({
            lat: Number(pos.coords.latitude.toFixed(6)),
            lng: Number(pos.coords.longitude.toFixed(6)),
            accuracyMeters: pos.coords.accuracy || undefined,
            headingDegrees:
              typeof pos.coords.heading === 'number' && !Number.isNaN(pos.coords.heading)
                ? pos.coords.heading
                : null,
            speedKmh: pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : undefined,
            updatedAt: Date.now(),
            isManualFallback: false,
          }),
        );
      } catch {
        // ignore quota errors
      }
    };

    const recordPosition = (pos: GeolocationPosition, force = false) => {
      if (cancelled) return;
      persistLastKnown(pos);
      const pt: TrackPoint = {
        lat: Number(pos.coords.latitude.toFixed(6)),
        lng: Number(pos.coords.longitude.toFixed(6)),
        timestamp: pos.timestamp && pos.timestamp > 0 ? pos.timestamp : Date.now(),
        speedKmh:
          typeof pos.coords.speed === 'number' && pos.coords.speed >= 0
            ? Math.round(pos.coords.speed * 3.6)
            : undefined,
      };
      const { added, gapKm } = appendPoint(pt, {
        accuracyMeters: pos.coords.accuracy,
        force,
      });
      if (added && gapKm >= 1.5) {
        toast.info(
          `Đã nối tiếp vị trí mới (+${gapKm.toFixed(1)} km)`,
          'Hành trình sẽ tự động nối tuyến đường bộ khi bạn bấm Dừng & Lưu.',
        );
      }
    };

    const requestWakeLock = async () => {
      if (cancelled || document.visibilityState !== 'visible') return;
      const wl = (navigator as { wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> } }).wakeLock;
      if (!wl) return;
      try {
        if (wakeLockRef.current && !wakeLockRef.current.released) return;
        const sentinel = await wl.request('screen');
        if (cancelled) {
          await sentinel.release().catch(() => {});
          return;
        }
        wakeLockRef.current = sentinel;
        setWakeLockActive(true);
        sentinel.addEventListener?.('release', () => {
          if (!cancelled) setWakeLockActive(false);
        });
      } catch {
        setWakeLockActive(false);
      }
    };

    const clearCurrentWatch = () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (restartTimerRef.current !== null) {
        window.clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
      }
    };

    const startWatch = () => {
      if (cancelled) return;
      clearCurrentWatch();
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => recordPosition(pos, false),
        (err) => {
          if (cancelled) return;
          if (err.code === err.PERMISSION_DENIED) {
            setGpsError('Chưa được cấp quyền Vị trí GPS. Hãy bật quyền Vị trí trong cài đặt trình duyệt.');
            return;
          }
          // Transient timeout / signal loss (e.g. under bridge or highway tunnel): auto-restart cleanly
          setGpsError('Tín hiệu GPS đang yếu, tự động kết nối lại...');
          clearCurrentWatch();
          restartTimerRef.current = window.setTimeout(() => {
            if (!cancelled) startWatch();
          }, 4000);
        },
        { enableHighAccuracy: true, maximumAge: 3000, timeout: 15_000 },
      );
    };

    const grabResumeCheckpoint = () => {
      if (cancelled) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => recordPosition(pos, true),
        () => {
          // watchPosition will keep trying
        },
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 12_000 },
      );
    };

    const persistDraftToIndexedDb = () => {
      const latest = useGpsRecordingStore.getState().session;
      if (!latest || latest.points.length === 0) return;
      const now = Date.now();
      const draft: LocalFootprintTrack = {
        clientId: latest.clientId,
        title: latest.title,
        color: '#f43f5e',
        distanceKm: calculatePolylineKm(latest.points),
        durationSeconds: Math.max(1, Math.floor((now - latest.startedAt) / 1000)),
        startedAt: latest.startedAt,
        endedAt: now,
        points: latest.points,
        memories: latest.memories,
        syncStatus: 'pending',
      };
      void saveLocalTrack(draft, latest.ownerKey);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void requestWakeLock();
        grabResumeCheckpoint();
        startWatch();
      } else {
        // Save safe checkpoint immediately whenever user locks phone or switches away
        persistDraftToIndexedDb();
      }
    };

    const onFocusOrOnline = () => {
      if (document.visibilityState === 'visible') {
        void requestWakeLock();
        grabResumeCheckpoint();
      }
    };

    const onPageHide = () => {
      persistDraftToIndexedDb();
    };

    void requestWakeLock();
    grabResumeCheckpoint();
    startWatch();

    const checkpointTimer = window.setInterval(persistDraftToIndexedDb, CHECKPOINT_INTERVAL_MS);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onFocusOrOnline);
    window.addEventListener('online', onFocusOrOnline);
    window.addEventListener('pagehide', onPageHide);

    return () => {
      cancelled = true;
      window.clearInterval(checkpointTimer);
      clearCurrentWatch();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onFocusOrOnline);
      window.removeEventListener('online', onFocusOrOnline);
      window.removeEventListener('pagehide', onPageHide);
      if (wakeLockRef.current) {
        void wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
      setWakeLockActive(false);
    };
  }, [isRecording, appendPoint, setWakeLockActive, setGpsError]);

  // Show a sleek floating live-recording indicator whenever user browses other pages while recording
  if (!session || pathname === '/footprints') return null;

  const liveKm = getActiveRecordingKm(session);
  return (
    <Link
      to="/footprints"
      className="fixed bottom-[4.9rem] left-3.5 z-40 inline-flex items-center gap-2 rounded-full border border-rose-300/60 bg-rose-600/95 px-3.5 py-2 text-xs font-extrabold text-white shadow-[0_12px_28px_-6px_rgba(225,29,72,0.7)] backdrop-blur-md transition hover:bg-rose-500 active:scale-95 lg:bottom-6 lg:left-6"
      title="Đang ghi hành trình GPS — bấm để quay lại Bản đồ Dấu chân"
    >
      <span className="relative flex size-2.5">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-80" />
        <span className="relative inline-flex size-2.5 rounded-full bg-white" />
      </span>
      <Radio className="size-3.5 shrink-0" aria-hidden />
      <span className="tabular-nums">
        Đang ghi · {liveKm.toFixed(1)} km ({session.points.length} điểm)
      </span>
    </Link>
  );
}
