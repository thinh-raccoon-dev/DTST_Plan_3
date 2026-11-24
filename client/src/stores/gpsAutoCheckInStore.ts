import { create } from 'zustand';

const STORAGE_KEY = 'dtst_auto_gps_checkin_v1';

export type GpsWatcherStatus = 'idle' | 'watching' | 'paused' | 'denied' | 'unsupported';

function readInitialEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === 'false' || saved === '0') return false;
    if (saved === 'true' || saved === '1') return true;
  } catch {
    // ignore storage read failures
  }
  // Always ON by default — user can turn it off anytime from the dropdown or /check-in page
  return true;
}

function persistEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
  } catch {
    // ignore storage write failures
  }
}

/** Module-level session deduplication shared between background watcher and GpsCheckInPage. */
const sessionAutoCheckedSlugs = new Set<string>();

export function hasSessionAutoChecked(slug: string): boolean {
  return sessionAutoCheckedSlugs.has(slug);
}

export function markSessionAutoChecked(slug: string): void {
  sessionAutoCheckedSlugs.add(slug);
}

interface GpsAutoCheckInState {
  enabled: boolean;
  status: GpsWatcherStatus;
  lastCoords: { lat: number; lng: number } | null;
  lastAutoCheckedName: string | null;
  setEnabled: (enabled: boolean) => void;
  toggle: () => boolean;
  setStatus: (status: GpsWatcherStatus) => void;
  setLastCoords: (coords: { lat: number; lng: number } | null) => void;
  setLastAutoCheckedName: (name: string | null) => void;
}

export const useGpsAutoCheckInStore = create<GpsAutoCheckInState>((set, get) => {
  const initialEnabled = readInitialEnabled();
  return {
    enabled: initialEnabled,
    status: initialEnabled ? 'idle' : 'paused',
    lastCoords: null,
    lastAutoCheckedName: null,
    setEnabled: (enabled) => {
      persistEnabled(enabled);
      set({ enabled, status: enabled ? 'idle' : 'paused' });
    },
    toggle: () => {
      const next = !get().enabled;
      persistEnabled(next);
      set({ enabled: next, status: next ? 'idle' : 'paused' });
      return next;
    },
    setStatus: (status) => set({ status }),
    setLastCoords: (lastCoords) => set({ lastCoords }),
    setLastAutoCheckedName: (lastAutoCheckedName) => set({ lastAutoCheckedName }),
  };
});
