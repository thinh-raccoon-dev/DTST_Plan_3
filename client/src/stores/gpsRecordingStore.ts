import { create } from 'zustand';
import {
  calculatePolylineKm,
  haversineDistanceKm,
  type MemoryPin,
  type TrackPoint,
} from '../lib/footprintOfflineStore';

const STORAGE_KEY = 'dtst_active_gps_recording_v1';
const MAX_STORED_POINTS = 1800;

export interface ActiveGpsRecording {
  clientId: string;
  ownerKey: string;
  title: string;
  startedAt: number;
  lastPointAt: number | null;
  points: TrackPoint[];
  memories: MemoryPin[];
  backgroundGapsDetected: number;
}

function readPersistedRecording(): ActiveGpsRecording | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveGpsRecording;
    if (
      parsed &&
      typeof parsed.clientId === 'string' &&
      typeof parsed.startedAt === 'number' &&
      Array.isArray(parsed.points)
    ) {
      return {
        ...parsed,
        ownerKey: typeof parsed.ownerKey === 'string' ? parsed.ownerKey : 'guest',
        title: typeof parsed.title === 'string' ? parsed.title : 'Hành trình của tôi',
        memories: Array.isArray(parsed.memories) ? parsed.memories : [],
        lastPointAt: typeof parsed.lastPointAt === 'number' ? parsed.lastPointAt : null,
        backgroundGapsDetected:
          typeof parsed.backgroundGapsDetected === 'number' ? parsed.backgroundGapsDetected : 0,
      };
    }
  } catch {
    // ignore corrupt storage
  }
  return null;
}

function writePersistedRecording(session: ActiveGpsRecording | null): void {
  try {
    if (typeof localStorage === 'undefined') return;
    if (!session) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    }
  } catch {
    // ignore quota errors
  }
}

/** Downsample oldest interior points while preserving start, end, and large jumps so multi-hour trips never exceed 1,800 points. */
function compactPoints(points: TrackPoint[]): TrackPoint[] {
  if (points.length <= MAX_STORED_POINTS) return points;
  const keepHead = points.slice(0, 1);
  const keepTail = points.slice(-300);
  const middle = points.slice(1, -300);
  const compactedMiddle: TrackPoint[] = [];
  for (let i = 0; i < middle.length; i += 2) {
    compactedMiddle.push(middle[i]!);
  }
  return [...keepHead, ...compactedMiddle, ...keepTail];
}

interface GpsRecordingState {
  session: ActiveGpsRecording | null;
  wakeLockActive: boolean;
  gpsError: string | null;
  startRecording: (input: {
    ownerKey: string;
    title: string;
    initialPoint?: TrackPoint | null;
  }) => ActiveGpsRecording;
  appendPoint: (pt: TrackPoint, options?: { accuracyMeters?: number; force?: boolean }) => {
    added: boolean;
    gapKm: number;
  };
  addMemory: (mem: MemoryPin) => void;
  setTitle: (title: string) => void;
  setWakeLockActive: (active: boolean) => void;
  setGpsError: (msg: string | null) => void;
  clearSession: () => void;
}

export const useGpsRecordingStore = create<GpsRecordingState>((set, get) => ({
  session: readPersistedRecording(),
  wakeLockActive: false,
  gpsError: null,
  startRecording: ({ ownerKey, title, initialPoint }) => {
    const now = Date.now();
    const points = initialPoint ? [initialPoint] : [];
    const next: ActiveGpsRecording = {
      clientId: `track-${now}-${Math.random().toString(36).slice(2, 7)}`,
      ownerKey,
      title: title.trim() || `Hành trình ngày ${new Date(now).toLocaleDateString('vi-VN')}`,
      startedAt: now,
      lastPointAt: initialPoint ? initialPoint.timestamp : null,
      points,
      memories: [],
      backgroundGapsDetected: 0,
    };
    writePersistedRecording(next);
    set({ session: next, gpsError: null });
    return next;
  },
  appendPoint: (pt, options) => {
    const current = get().session;
    if (!current) return { added: false, gapKm: 0 };

    // Reject severely inaccurate cell-tower jumps (>250m) once we already have a good fix, unless forced on resume
    if (
      !options?.force &&
      current.points.length > 0 &&
      typeof options?.accuracyMeters === 'number' &&
      options.accuracyMeters > 250
    ) {
      return { added: false, gapKm: 0 };
    }

    const last = current.points[current.points.length - 1];
    let gapKm = 0;
    if (last) {
      gapKm = haversineDistanceKm(last, pt);
      const elapsedMs = pt.timestamp - last.timestamp;
      // Ignore tiny stationary GPS drift (< 12m) unless >= 45s passed or explicitly forced
      if (!options?.force && gapKm < 0.012 && elapsedMs < 45_000) {
        return { added: false, gapKm: 0 };
      }
      // Still skip exact same coordinate (< 3m)
      if (gapKm < 0.003) {
        return { added: false, gapKm: 0 };
      }
    }

    const isBackgroundGap = Boolean(last && (gapKm >= 0.8 || pt.timestamp - last.timestamp >= 90_000));
    const nextPoints = compactPoints([...current.points, pt]);
    const updated: ActiveGpsRecording = {
      ...current,
      lastPointAt: pt.timestamp,
      points: nextPoints,
      backgroundGapsDetected: current.backgroundGapsDetected + (isBackgroundGap ? 1 : 0),
    };
    writePersistedRecording(updated);
    set({ session: updated, gpsError: null });
    return { added: true, gapKm };
  },
  addMemory: (mem) => {
    const current = get().session;
    if (!current) return;
    const updated: ActiveGpsRecording = {
      ...current,
      memories: [...current.memories, mem],
    };
    writePersistedRecording(updated);
    set({ session: updated });
  },
  setTitle: (title) => {
    const current = get().session;
    if (!current) return;
    const updated: ActiveGpsRecording = { ...current, title };
    writePersistedRecording(updated);
    set({ session: updated });
  },
  setWakeLockActive: (active) => set({ wakeLockActive: active }),
  setGpsError: (msg) => set({ gpsError: msg }),
  clearSession: () => {
    writePersistedRecording(null);
    set({ session: null, wakeLockActive: false, gpsError: null });
  },
}));

export function getActiveRecordingKm(session: ActiveGpsRecording | null): number {
  if (!session || session.points.length < 2) return 0;
  return calculatePolylineKm(session.points);
}
