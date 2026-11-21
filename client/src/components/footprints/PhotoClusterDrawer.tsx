import { Calendar, Camera, Clock, MapPin, Navigation, Smartphone, X } from 'lucide-react';
import { useMemo } from 'react';
import { haversineDistanceKm } from '../../lib/footprintOfflineStore';
import {
  formatPhotoClock,
  formatPhotoDayHeading,
  formatPhotoShortDate,
  formatSourceAppLabel,
  type FootprintPhotoItem,
  type LiveUserLocation,
  type PhotoCluster,
} from '../../lib/footprintPhotoStore';

interface PhotoClusterDrawerProps {
  cluster: PhotoCluster;
  userLocation: LiveUserLocation | null;
  onClose: () => void;
  onOpenLightbox: (photos: FootprintPhotoItem[], startIndex: number) => void;
  onAddPhotoHere: (coords: { lat: number; lng: number }, placeName: string) => void;
}

export function PhotoClusterDrawer({
  cluster,
  userLocation,
  onClose,
  onOpenLightbox,
  onAddPhotoHere,
}: PhotoClusterDrawerProps) {
  const distanceKm = useMemo(() => {
    if (!userLocation) return null;
    return Math.round(haversineDistanceKm(userLocation, { lat: cluster.lat, lng: cluster.lng }) * 10) / 10;
  }, [userLocation, cluster.lat, cluster.lng]);

  // Group cluster photos chronologically by calendar day (newest first)
  const groupedByDay = useMemo(() => {
    const groups: Array<{ dayKey: string; heading: string; items: Array<{ photo: FootprintPhotoItem; flatIdx: number }> }> = [];
    const byKey = new Map<string, (typeof groups)[number]>();

    cluster.photos.forEach((photo, flatIdx) => {
      const d = new Date(photo.takenAt);
      const dayKey = Number.isNaN(d.getTime())
        ? 'unknown'
        : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      let group = byKey.get(dayKey);
      if (!group) {
        group = {
          dayKey,
          heading: formatPhotoDayHeading(photo.takenAt),
          items: [],
        };
        byKey.set(dayKey, group);
        groups.push(group);
      }
      group.items.push({ photo, flatIdx });
    });

    return groups;
  }, [cluster.photos]);

  const dateRangeText = useMemo(() => {
    const first = formatPhotoShortDate(cluster.earliestTakenAt);
    const last = formatPhotoShortDate(cluster.latestTakenAt);
    return first === last ? last : `${first} – ${last}`;
  }, [cluster.earliestTakenAt, cluster.latestTakenAt]);

  return (
    <aside
      aria-label={`Ảnh đã chụp tại ${cluster.title}`}
      className="fixed inset-x-3 bottom-[4.85rem] z-[960] flex max-h-[64dvh] flex-col overflow-hidden rounded-[26px] border border-white/20 bg-slate-950/88 text-white shadow-[0_24px_60px_-14px_rgba(0,0,0,0.65)] backdrop-blur-2xl sm:inset-x-auto sm:bottom-24 sm:left-4 sm:top-20 sm:max-h-none sm:w-[390px] lg:bottom-24"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-white/12 px-4 py-3.5">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-300 tabular-nums">
            <MapPin className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{cluster.area || 'Vị trí đã ghé thăm'}</span>
            {distanceKm !== null && (
              <>
                <span className="text-white/30">·</span>
                <span className="inline-flex shrink-0 items-center gap-1 text-sky-300">
                  <Navigation className="size-3" aria-hidden />
                  Cách bạn {distanceKm} km
                </span>
              </>
            )}
          </div>
          <h2 className="mt-0.5 truncate text-base font-extrabold tracking-tight text-white">
            {cluster.title}
          </h2>
          <p className="mt-0.5 flex items-center gap-2 text-xs text-slate-300 tabular-nums">
            <span className="font-bold text-white">{cluster.count} ảnh</span>
            <span className="text-white/30">·</span>
            <span className="inline-flex items-center gap-1">
              <Calendar className="size-3 text-slate-400" aria-hidden />
              {dateRangeText}
            </span>
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="grid size-8 shrink-0 place-items-center rounded-full bg-white/10 text-slate-200 transition hover:bg-white/20 hover:text-white"
          aria-label="Đóng bảng ảnh"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Quick Action Bar */}
      <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-white/[0.04] px-4 py-2.5">
        <span className="text-[11px] font-medium text-slate-300">
          Chạm ảnh để xem chi tiết ngày giờ & tọa độ
        </span>
        <button
          type="button"
          onClick={() => onAddPhotoHere({ lat: cluster.lat, lng: cluster.lng }, cluster.title)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-400 active:scale-95"
        >
          <Camera className="size-3.5" />
          Thêm ảnh tại đây
        </button>
      </div>

      {/* Chronological Photo Grid grouped by Day */}
      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
        {groupedByDay.map((group) => (
          <section key={group.dayKey}>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-bold capitalize tracking-tight text-slate-100">
                {group.heading}
              </h3>
              <span className="text-[11px] font-medium text-slate-400 tabular-nums">
                {group.items.length} tấm
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {group.items.map(({ photo, flatIdx }) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => onOpenLightbox(cluster.photos, flatIdx)}
                  className="group relative aspect-square overflow-hidden rounded-xl bg-slate-900 ring-1 ring-white/12 transition hover:ring-2 hover:ring-white focus-visible:ring-2 focus-visible:ring-emerald-400"
                >
                  <img
                    src={photo.thumbnailUrl || photo.imageUrl}
                    alt={photo.caption || photo.placeName || 'Ảnh kỷ niệm'}
                    className="size-full object-cover transition duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent px-1.5 pb-1.5 pt-5 text-left">
                    <div className="flex items-center justify-between gap-1">
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-white tabular-nums">
                        <Clock className="size-2.5 text-emerald-300" aria-hidden />
                        {formatPhotoClock(photo.takenAt)}
                      </span>
                      {(photo.sourceApp === 'ios' ||
                        photo.sourceApp === 'android' ||
                        photo.sourceApp === 'flutter') && (
                        <span
                          title={formatSourceAppLabel(photo.sourceApp)}
                          className="rounded bg-sky-500/80 p-0.5 text-white"
                        >
                          <Smartphone className="size-2.5" aria-hidden />
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </aside>
  );
}
