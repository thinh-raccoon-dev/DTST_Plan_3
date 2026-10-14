import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { DraftDay } from '../lib/itineraryOps';
import type { Preferences } from '../types/api';

interface DraftState {
  title: string;
  preferences: Preferences | null;
  days: DraftDay[];
  warnings: string[];
  setPlan: (preferences: Preferences, days: DraftDay[], warnings: string[]) => void;
  setDays: (days: DraftDay[]) => void;
  setTitle: (title: string) => void;
  clear: () => void;
}

const empty = { title: 'Lịch trình Đồng Tháp của tôi', preferences: null, days: [] as DraftDay[], warnings: [] as string[] };

/** Unsaved itinerary kept on this device only (localStorage). It is never treated as saved. */
export const useItineraryDraft = create<DraftState>()(
  persist(
    (set) => ({
      ...empty,
      setPlan: (preferences, days, warnings) => set({ preferences, days, warnings }),
      setDays: (days) => set({ days }),
      setTitle: (title) => set({ title }),
      clear: () => set(empty),
    }),
    {
      name: 'dtst-itinerary-draft',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Drop anything that does not look like a draft written by this version.
      migrate: () => empty,
      merge: (persisted, current) => {
        const p = persisted as Partial<DraftState> | undefined;
        const valid =
          p && Array.isArray(p.days) && p.days.every((d) => Array.isArray(d?.items) && d.items.every((i) => typeof i?.destinationId === 'string'));
        return valid ? { ...current, ...p } : current;
      },
    },
  ),
);
