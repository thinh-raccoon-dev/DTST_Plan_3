import { Flower2, Hotel, Landmark, Music, UtensilsCrossed, type LucideIcon } from 'lucide-react';
import type { V9Place, V9PlaceRole } from '../../types/api';

export interface RoleMeta {
  label: string;
  short: string;
  Icon: LucideIcon;
  /** Soft icon bubble classes. */
  bubble: string;
  /** Solid dot / accent classes. */
  dot: string;
}

export const ROLE_META: Record<V9PlaceRole | string, RoleMeta> = {
  attraction: { label: 'Điểm tham quan', short: 'Tham quan', Icon: Landmark, bubble: 'bg-leaf-100 text-leaf-700', dot: 'bg-leaf-600' },
  restaurant: { label: 'Nhà hàng / Quán ăn', short: 'Ăn uống', Icon: UtensilsCrossed, bubble: 'bg-teal-50 text-teal-700', dot: 'bg-teal-500' },
  accommodation: { label: 'Lưu trú / Khách sạn', short: 'Lưu trú', Icon: Hotel, bubble: 'bg-lotus-50 text-lotus-600', dot: 'bg-lotus-500' },
  entertainment: { label: 'Giải trí', short: 'Giải trí', Icon: Music, bubble: 'bg-river-100 text-river-700', dot: 'bg-river-600' },
  wellness: { label: 'Thư giãn / Spa', short: 'Spa', Icon: Flower2, bubble: 'bg-lotus-50 text-lotus-700', dot: 'bg-lotus-400' },
};

export function roleMeta(role: string | undefined): RoleMeta {
  return ROLE_META[role ?? ''] ?? ROLE_META.attraction!;
}

export function formatVnd(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return 'Chưa có giá';
  return `${Math.round(amount).toLocaleString('vi-VN')} ₫`;
}

export function formatVndShort(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return '—';
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tr`;
  if (amount >= 1_000) return `${Math.round(amount / 1_000).toLocaleString('vi-VN')}k`;
  return `${Math.round(amount)} ₫`;
}

/** Turns the planner's ranking_reason (string or object) into readable Vietnamese text. */
export function formatV9RankingReason(place: V9Place): string | null {
  const reason = place.ranking_reason;
  const parts: string[] = [];

  if (place.route_from_previous && typeof place.route_from_previous.duration_minutes === 'number') {
    const km =
      typeof place.route_from_previous.distance_km === 'number'
        ? `${place.route_from_previous.distance_km.toFixed(1)} km · `
        : '';
    parts.push(`Cách điểm trước: ${km}${Math.round(place.route_from_previous.duration_minutes)} phút chạy xe`);
  }

  if (!reason) {
    return parts.length > 0 ? parts.join(' · ') : null;
  }

  if (typeof reason === 'string') {
    parts.push(reason);
    return parts.join(' · ');
  }

  if (typeof reason === 'object') {
    if (Array.isArray(reason.road_time_tier_minutes) && reason.road_time_tier_minutes.length >= 2) {
      parts.push(`Nhóm di chuyển ${reason.road_time_tier_minutes[0]}–${reason.road_time_tier_minutes[1]} phút`);
    }
    if (typeof reason.rating_adjusted_for_review_count === 'number') {
      parts.push(`Điểm sao điều chỉnh: ${reason.rating_adjusted_for_review_count.toFixed(2)}/5`);
    }
    if (typeof reason.note === 'string' && reason.note.trim()) {
      parts.push(reason.note.trim());
    }
  }

  return parts.length > 0 ? parts.join(' · ') : null;
}

export function formatIsoClock(iso: string | undefined | null): string | null {
  if (!iso) return null;
  const match = iso.match(/T(\d{2}:\d{2})/);
  return match?.[1] ?? iso;
}

export function formatDateVi(isoDate: string | undefined | null): string {
  if (!isoDate) return '';
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
}
