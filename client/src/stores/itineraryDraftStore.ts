import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { DraftDay } from '../lib/itineraryOps';
import type { Preferences, V9ItineraryObject, V9PlanResponse } from '../types/api';

interface DraftState {
  title: string;
  preferences: Preferences | null;
  days: DraftDay[];
  warnings: string[];
  v9Response: V9PlanResponse | null;
  v9Itinerary: V9ItineraryObject | null;
  setPlan: (preferences: Preferences, days: DraftDay[], warnings: string[]) => void;
  setV9Plan: (response: V9PlanResponse, itinerary: V9ItineraryObject) => void;
  setV9Itinerary: (itinerary: V9ItineraryObject) => void;
  setDays: (days: DraftDay[]) => void;
  setTitle: (title: string) => void;
  clear: () => void;
}

const empty = {
  title: 'Hành trình Mỹ Tho – Thới Sơn – Đồng Tháp',
  preferences: null,
  days: [] as DraftDay[],
  warnings: [] as string[],
  v9Response: null as V9PlanResponse | null,
  v9Itinerary: null as V9ItineraryObject | null,
};

/** Unsaved itinerary kept on this device only (localStorage). It is never treated as saved. */
export const useItineraryDraft = create<DraftState>()(
  persist(
    (set) => ({
      ...empty,
      setPlan: (preferences, days, warnings) => set({ preferences, days, warnings }),
      setV9Plan: (v9Response, v9Itinerary) => set({ v9Response, v9Itinerary }),
      setV9Itinerary: (v9Itinerary) => set({ v9Itinerary }),
      setDays: (days) => set({ days }),
      setTitle: (title) => set({ title }),
      clear: () => set(empty),
    }),
    {
      name: 'dtst-itinerary-draft',
      version: 2,
      storage: createJSONStorage(() => localStorage),
      migrate: () => empty,
      merge: (persisted, current) => {
        const p = persisted as Partial<DraftState> | undefined;
        if (!p || typeof p !== 'object') return current;
        return {
          ...current,
          title: typeof p.title === 'string' ? p.title : current.title,
          v9Response: p.v9Response ?? null,
          v9Itinerary: p.v9Itinerary ?? null,
        };
      },
    },
  ),
);
