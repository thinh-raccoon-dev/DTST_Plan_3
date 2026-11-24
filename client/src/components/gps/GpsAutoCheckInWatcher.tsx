import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../../lib/api';
import { buildFootprintOwnerKey, saveLocalTrack } from '../../lib/footprintOfflineStore';
import { useAuthStore } from '../../stores/authStore';
import {
  hasSessionAutoChecked,
  markSessionAutoChecked,
  useGpsAutoCheckInStore,
} from '../../stores/gpsAutoCheckInStore';
import { toast } from '../../stores/toastStore';
import type { BadgeInfo } from '../../types/api';
import { announceBadges } from '../challenge/ChallengeQuiz';

interface NearbyItem {
  id: string;
  name: string;
  slug: string;
  coordinates: { lat: number; lng: number };
  canCheckIn: boolean;
  isCheckedIn: boolean;
}

interface NearbyResponse {
  items: NearbyItem[];
}

interface CheckInResponse {
  created: boolean;
  pointsAwarded: number;
  newBadges: BadgeInfo[];
  distanceMeters: number;
}

const MIN_POLL_INTERVAL_MS = 60_000;
const MIN_MOVE_DEGREES = 0.00055; // ~60m

/**
 * Lightweight global background watcher that keeps hands-free GPS geofencing active
 * across all public pages whenever `useGpsAutoCheckInStore.enabled` is true.
 * Automatically pauses when turned off or while the foreground `/check-in` radar page is active.
 */
export function GpsAutoCheckInWatcher() {
  const { pathname } = useLocation();
  const enabled = useGpsAutoCheckInStore((s) => s.enabled);
  const setStatus = useGpsAutoCheckInStore((s) => s.setStatus);
  const setLastCoords = useGpsAutoCheckInStore((s) => s.setLastCoords);
  const setLastAutoCheckedName = useGpsAutoCheckInStore((s) => s.setLastAutoCheckedName);

  const lastQueryRef = useRef<{ lat: number; lng: number; at: number } | null>(null);
  const inFlightRef = useRef(false);

  const isOnCheckInPage = pathname === '/check-in' || pathname === '/scan';

  useEffect(() => {
    if (!enabled) {
      setStatus('paused');
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('unsupported');
      return;
    }

    // While user is on /check-in, GpsCheckInPage runs its own foreground live radar
    if (isOnCheckInPage) {
      setStatus('watching');
      return;
    }

    let cancelled = false;
    setStatus('watching');

    const handleCoords = async (lat: number, lng: number) => {
      if (cancelled || inFlightRef.current) return;
      setLastCoords({ lat, lng });

      const now = Date.now();
      const prev = lastQueryRef.current;
      const movedEnough =
        !prev ||
        Math.abs(prev.lat - lat) >= MIN_MOVE_DEGREES ||
        Math.abs(prev.lng - lng) >= MIN_MOVE_DEGREES;
      const intervalPassed = !prev || now - prev.at >= MIN_POLL_INTERVAL_MS;

      if (!movedEnough && !intervalPassed) return;

      inFlightRef.current = true;
      lastQueryRef.current = { lat, lng, at: now };

      try {
        const res = await api.get<NearbyResponse>(`/destinations/nearby?lat=${lat}&lng=${lng}&limit=12`);
        if (cancelled || !res.data?.items?.length) return;

        const candidates = res.data.items.filter(
          (item) => item.canCheckIn && !item.isCheckedIn && !hasSessionAutoChecked(item.slug),
        );

        for (const candidate of candidates) {
          if (cancelled) break;
          markSessionAutoChecked(candidate.slug);
          try {
            const chkRes = await api.post<CheckInResponse>(`/destinations/${candidate.slug}/check-in`, {
              lat,
              lng,
              isSimulated: false,
            });
            if (chkRes.data.created) {
              setLastAutoCheckedName(candidate.name);
              toast.success(
                `🛂 Tự động Điểm danh GPS (+${chkRes.data.pointsAwarded} EXP)!`,
                `Bạn vừa đến "${candidate.name}" (${chkRes.data.distanceMeters}m) — Hộ chiếu số đã tự động đóng dấu!`,
              );
              if (chkRes.data.newBadges?.length) {
                announceBadges(chkRes.data.newBadges);
              }
              const ownerKey = buildFootprintOwnerKey(useAuthStore.getState().user?.id);
              await saveLocalTrack(
                {
                  clientId: `checkin-${candidate.slug}`,
                  title: `Check-in: ${candidate.name}`,
                  color: '#10b981',
                  distanceKm: 0.25,
                  durationSeconds: 60,
                  startedAt: Date.now(),
                  endedAt: Date.now(),
                  points: [
                    {
                      lat: candidate.coordinates.lat,
                      lng: candidate.coordinates.lng,
                      timestamp: Date.now(),
                    },
                    {
                      lat: candidate.coordinates.lat + 0.0005,
                      lng: candidate.coordinates.lng + 0.0005,
                      timestamp: Date.now() + 1000,
                    },
                  ],
                  memories: [
                    {
                      clientId: `mem-chk-${candidate.slug}`,
                      lat: candidate.coordinates.lat,
                      lng: candidate.coordinates.lng,
                      emoji: '🛂',
                      moodLabel: 'Đã tự động điểm danh GPS',
                      placeName: candidate.name,
                      note: `Tự động điểm danh cách ${chkRes.data.distanceMeters}m`,
                      createdAt: Date.now(),
                    },
                  ],
                  syncStatus: 'pending',
                },
                ownerKey,
              );
            }
          } catch {
            // Silent fail in background — never nag the user while browsing
          }
        }
      } catch {
        // Silent fail in background
      } finally {
        inFlightRef.current = false;
      }
    };

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (!cancelled) {
          setStatus('watching');
          void handleCoords(pos.coords.latitude, pos.coords.longitude);
        }
      },
      (err) => {
        if (!cancelled && err.code === err.PERMISSION_DENIED) {
          setStatus('denied');
        }
      },
      { enableHighAccuracy: false, maximumAge: 30_000, timeout: 20_000 },
    );

    return () => {
      cancelled = true;
      navigator.geolocation.clearWatch(watchId);
    };
  }, [enabled, isOnCheckInPage, setStatus, setLastCoords, setLastAutoCheckedName]);

  return null;
}
