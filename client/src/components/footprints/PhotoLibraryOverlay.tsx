import clsx from 'clsx';
import {
  Calendar,
  Camera,
  Clock,
  FolderHeart,
  Images,
  MapPin,
  Navigation,
  Search,
  Smartphone,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { haversineDistanceKm } from '../../lib/footprintOfflineStore';
import {
  formatPhotoClock,
  formatPhotoDayHeading,
  formatPhotoShortDate,
  formatSourceAppLabel,
  groupPhotosByPlace,
  type FootprintPhotoItem,
  type LiveUserLocation,
} from '../../lib/footprintPhotoStore';

interface PhotoLibraryOverlayProps {
  mode: 'library' | 'places';
  photos: FootprintPhotoItem[];
  userLocation: LiveUserLocation | null;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onClose: () => void;
  onOpenLightbox: (photos: FootprintPhotoItem[], startIndex: number) => void;
  onFlyToPlace: (coords: { lat: number; lng: number }, placeName: string) => void;
  onOpenCapture: () => void;
}

export function PhotoLibraryOverlay({
  mode,
  photos,
  userLocation,
  searchQuery,
  onSearchChange,
  onClose,
  onOpenLightbox,
  onFlyToPlace,
  onOpenCapture,
}: PhotoLibraryOverlayProps) {
  const [sourceFilter, setSourceFilter] = useState<'all' | 'mine' | 'mobile'>('all');

  const filteredPhotos = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return photos.filter((p) => {
      if (sourceFilter === 'mine' && p.isStarterMemory) return false;
      if (
        sourceFilter === 'mobile' &&
        p.sourceApp !== 'ios' &&
        p.sourceApp !== 'android' &&
        p.sourceApp !== 'flutter'
      ) {
        return false;
      }
      if (!q) return true;
      return (
        (p.placeName || '').toLowerCase().includes(q) ||
        (p.caption || '').toLowerCase().includes(q) ||
        (p.area || '').toLowerCase().includes(q)
      );
    });
  }, [photos, sourceFilter, searchQuery]);

  const groupedByDay = useMemo(() => {
    const groups: Array<{ dayKey: string; heading: string; items: Array<{ photo: FootprintPhotoItem; flatIdx: number }> }> = [];
    const byKey = new Map<string, (typeof groups)[number]>();

    filteredPhotos.forEach((photo, flatIdx) => {
      const d = new Date(photo.takenAt);
      const dayKey = Number.isNaN(d.getTime())
        ? 'unknown'
        : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      let group = byKey.get(dayKey);
      if (!group) {
        group = { dayKey, heading: formatPhotoDayHeading(photo.takenAt), items: [] };
        byKey.set(dayKey, group);
        groups.push(group);
      }
      group.items.push({ photo, flatIdx });
    });

    return groups;
  }, [filteredPhotos]);

  const placeCollections = useMemo(() => groupPhotosByPlace(filteredPhotos), [filteredPhotos]);

  return (
    <section
      aria-label={mode === 'library' ? 'Thư viện ảnh theo thời gian' : 'Bộ sưu tập theo địa điểm'}
      className="fixed inset-x-3 bottom-[5.4rem] top-[4.85rem] z-[950] mx-auto flex max-w-5xl flex-col overflow-hidden rounded-[28px] border border-white/20 bg-slate-950/88 text-white shadow-[0_28px_70px_-16px_rgba(0,0,0,0.75)] backdrop-blur-2xl sm:inset-x-6 sm:bottom-24 sm:top-20"
    >
      {/* Top Bar */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/12 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-2xl bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/30">
            {mode === 'library' ? <Images className="size-5" /> : <FolderHeart className="size-5" />}
          </span>
          <div>
            <h2 className="text-base font-extrabold tracking-tight text-white sm:text-lg">
              {mode === 'library' ? 'Thư viện Ký ức Ảnh' : 'Bộ sưu tập theo Địa điểm'}
            </h2>
            <p className="text-xs text-slate-300 tabular-nums">
              {filteredPhotos.length} ảnh · {placeCollections.length} địa điểm đã lưu tọa độ & thời gian
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenCapture}
            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-3.5 py-2 text-xs font-extrabold text-white transition hover:bg-emerald-400"
          >
            <Camera className="size-3.5" />
            Thêm ảnh
          </button>
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-full bg-white/10 text-slate-200 transition hover:bg-white/20 hover:text-white"
            aria-label="Quay lại bản đồ"
          >
            <X className="size-4" />
          </button>
        </div>
      </header>

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-white/10 bg-white/[0.03] px-5 py-3">
        <div className="flex items-center gap-1.5">
          {(
            [
              { id: 'all', label: 'Tất cả' },
              { id: 'mine', label: 'Ảnh tôi chụp' },
              { id: 'mobile', label: 'Từ App Mobile' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSourceFilter(tab.id)}
              className={clsx(
                'rounded-full px-3 py-1.5 text-xs font-bold transition',
                sourceFilter === tab.id
                  ? 'bg-white text-slate-950'
                  : 'bg-white/10 text-slate-300 hover:bg-white/20 hover:text-white',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Tìm địa điểm, ghi chú..."
            className="w-full rounded-full border border-white/15 bg-white/10 py-1.5 pl-9 pr-3 text-xs text-white placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none"
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto px-5 py-5">
        {filteredPhotos.length === 0 ? (
          <div className="flex h-full min-h-[260px] flex-col items-center justify-center text-center">
            <span className="grid size-14 place-items-center rounded-3xl bg-white/10 text-emerald-300">
              <Camera className="size-7" />
            </span>
            <h3 className="mt-3 text-base font-bold text-white">Chưa có ảnh nào phù hợp</h3>
            <p className="mt-1 max-w-sm text-xs text-slate-300">
              {sourceFilter === 'mobile'
                ? 'Khi app Mobile chụp ảnh và đồng bộ về chung API, toàn bộ ảnh sẽ tự động hiển thị tại đây cùng tọa độ & thời gian chụp.'
                : 'Hãy chụp hoặc tải lên tấm ảnh đầu tiên để gắn dấu chân lên bản đồ Đồng Tháp nhé.'}
            </p>
            <button
              type="button"
              onClick={onOpenCapture}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-4 py-2 text-xs font-extrabold text-white transition hover:bg-emerald-400"
            >
              <Camera className="size-3.5" />
              Chụp / Tải ảnh ngay
            </button>
          </div>
        ) : mode === 'library' ? (
          <div className="space-y-6">
            {groupedByDay.map((group) => (
              <div key={group.dayKey}>
                <div className="mb-2.5 flex items-baseline justify-between">
                  <h3 className="text-sm font-extrabold capitalize text-white">{group.heading}</h3>
                  <span className="text-xs text-slate-400 tabular-nums">{group.items.length} ảnh</span>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-5">
                  {group.items.map(({ photo, flatIdx }) => (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => onOpenLightbox(filteredPhotos, flatIdx)}
                      className="group relative aspect-square overflow-hidden rounded-2xl bg-slate-900 ring-1 ring-white/12 transition hover:ring-2 hover:ring-white"
                    >
                      <img
                        src={photo.thumbnailUrl || photo.imageUrl}
                        alt={photo.caption || photo.placeName || ''}
                        className="size-full object-cover transition duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent p-2 text-left">
                        <p className="truncate text-[11px] font-bold text-white">
                          {photo.placeName || 'Điểm dừng'}
                        </p>
                        <div className="mt-0.5 flex items-center justify-between text-[10px] text-slate-300 tabular-nums">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="size-2.5 text-emerald-300" />
                            {formatPhotoClock(photo.takenAt)}
                          </span>
                          {(photo.sourceApp === 'ios' ||
                            photo.sourceApp === 'android' ||
                            photo.sourceApp === 'flutter') && (
                            <span title={formatSourceAppLabel(photo.sourceApp)}>
                              <Smartphone className="size-2.5 text-sky-300" />
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {placeCollections.map((col) => {
              const distKm = userLocation
                ? Math.round(haversineDistanceKm(userLocation, col.coordinates) * 10) / 10
                : null;
              return (
                <article
                  key={col.key}
                  className="group overflow-hidden rounded-3xl border border-white/15 bg-white/[0.05] transition hover:border-white/30 hover:bg-white/[0.08]"
                >
                  <button
                    type="button"
                    onClick={() => onOpenLightbox(col.photos, 0)}
                    className="relative block aspect-[16/10] w-full overflow-hidden bg-slate-900"
                  >
                    <img
                      src={col.coverImageUrl}
                      alt={col.placeName}
                      className="size-full object-cover transition duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
                    <span className="absolute bottom-2.5 left-3 inline-flex items-center gap-1 rounded-full bg-black/65 px-2.5 py-1 text-xs font-extrabold text-white ring-1 ring-white/25 backdrop-blur-md tabular-nums">
                      {col.photoCount} ảnh
                    </span>
                    <span className="absolute bottom-2.5 right-3 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold text-slate-200 backdrop-blur-md tabular-nums">
                      <Calendar className="size-2.5 text-emerald-300" />
                      {formatPhotoShortDate(col.latestTakenAt)}
                    </span>
                  </button>

                  <div className="flex items-center justify-between gap-2 p-3.5">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-extrabold text-white">{col.placeName}</h3>
                      <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-300 tabular-nums">
                        <MapPin className="size-3 shrink-0 text-emerald-400" />
                        <span className="truncate">{col.area || 'Đồng Tháp'}</span>
                        {distKm !== null && (
                          <>
                            <span className="text-white/30">·</span>
                            <span className="shrink-0 text-sky-300">{distKm} km</span>
                          </>
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onFlyToPlace(col.coordinates, col.placeName);
                        onClose();
                      }}
                      className="grid size-9 shrink-0 place-items-center rounded-full bg-white/10 text-white transition hover:bg-emerald-500"
                      title="Xem trên bản đồ"
                      aria-label={`Xem ${col.placeName} trên bản đồ`}
                    >
                      <Navigation className="size-4" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
