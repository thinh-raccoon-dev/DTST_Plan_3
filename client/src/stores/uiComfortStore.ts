import { create } from 'zustand';

export type FontScale = 'normal' | 'large' | 'xlarge';

const STORAGE_KEY = 'dtst_ui_comfort_v1';

interface ComfortSnapshot {
  seniorMode: boolean;
  fontScale: FontScale;
  highContrast: boolean;
  calmMotion: boolean;
}

interface UiComfortState extends ComfortSnapshot {
  setSeniorMode: (enabled: boolean) => void;
  toggleSeniorMode: () => void;
  setFontScale: (scale: FontScale) => void;
  setHighContrast: (enabled: boolean) => void;
  setCalmMotion: (enabled: boolean) => void;
  resetDefaults: () => void;
}

const DEFAULT_SNAPSHOT: ComfortSnapshot = {
  seniorMode: false,
  fontScale: 'normal',
  highContrast: false,
  calmMotion: false,
};

function loadSnapshot(): ComfortSnapshot {
  if (typeof window === 'undefined') return DEFAULT_SNAPSHOT;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SNAPSHOT;
    const parsed = JSON.parse(raw) as Partial<ComfortSnapshot>;
    const fontScale: FontScale =
      parsed.fontScale === 'large' || parsed.fontScale === 'xlarge' ? parsed.fontScale : 'normal';
    return {
      seniorMode: Boolean(parsed.seniorMode),
      fontScale,
      highContrast: Boolean(parsed.highContrast),
      calmMotion: Boolean(parsed.calmMotion),
    };
  } catch {
    return DEFAULT_SNAPSHOT;
  }
}

function saveSnapshot(snap: ComfortSnapshot) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snap));
  } catch {
    // ignore storage quota errors
  }
}

export function applyComfortToDocument(snap: ComfortSnapshot) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.seniorMode = snap.seniorMode ? 'true' : 'false';
  root.dataset.fontScale = snap.fontScale;
  root.dataset.highContrast = snap.highContrast ? 'true' : 'false';
  root.dataset.calmMotion = snap.calmMotion ? 'true' : 'false';
}

const initial = loadSnapshot();
applyComfortToDocument(initial);

export const useUiComfortStore = create<UiComfortState>((set, get) => ({
  ...initial,

  setSeniorMode: (enabled) => {
    const next: ComfortSnapshot = enabled
      ? {
          seniorMode: true,
          fontScale: 'large',
          highContrast: true,
          calmMotion: true,
        }
      : {
          seniorMode: false,
          fontScale: 'normal',
          highContrast: false,
          calmMotion: false,
        };
    saveSnapshot(next);
    applyComfortToDocument(next);
    set(next);
  },

  toggleSeniorMode: () => {
    get().setSeniorMode(!get().seniorMode);
  },

  setFontScale: (fontScale) => {
    const cur = get();
    const next: ComfortSnapshot = {
      seniorMode: cur.seniorMode,
      fontScale,
      highContrast: cur.highContrast,
      calmMotion: cur.calmMotion,
    };
    saveSnapshot(next);
    applyComfortToDocument(next);
    set({ fontScale });
  },

  setHighContrast: (highContrast) => {
    const cur = get();
    const next: ComfortSnapshot = {
      seniorMode: cur.seniorMode,
      fontScale: cur.fontScale,
      highContrast,
      calmMotion: cur.calmMotion,
    };
    saveSnapshot(next);
    applyComfortToDocument(next);
    set({ highContrast });
  },

  setCalmMotion: (calmMotion) => {
    const cur = get();
    const next: ComfortSnapshot = {
      seniorMode: cur.seniorMode,
      fontScale: cur.fontScale,
      highContrast: cur.highContrast,
      calmMotion,
    };
    saveSnapshot(next);
    applyComfortToDocument(next);
    set({ calmMotion });
  },

  resetDefaults: () => {
    saveSnapshot(DEFAULT_SNAPSHOT);
    applyComfortToDocument(DEFAULT_SNAPSHOT);
    set({ ...DEFAULT_SNAPSHOT });
  },
}));

/** Open Pé Meko AI widget from anywhere in the app with an optional prompt. */
export function triggerMekoAssistant(detail?: { prompt?: string }) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('meko:open', { detail: detail ?? {} }));
}
