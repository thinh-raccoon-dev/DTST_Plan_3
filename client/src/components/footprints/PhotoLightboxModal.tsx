import {
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  MapPin,
  Pencil,
  Smartphone,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  formatAreaDisplay,
  formatPhotoFullDateTime,
  formatSourceAppLabel,
  type FootprintPhotoItem,
} from '../../lib/footprintPhotoStore';

interface PhotoLightboxModalProps {
  photos: FootprintPhotoItem[];
  activeIndex: number;
  onChangeIndex: (nextIndex: number) => void;
  onClose: () => void;
  onFocusOnMap: (photo: FootprintPhotoItem) => void;
  onUpdatePhoto?: (id: string, patch: { caption?: string; placeName?: string }) => Promise<void>;
  onDeletePhoto?: (photo: FootprintPhotoItem) => Promise<void>;
}

export function PhotoLightboxModal({
  photos,
  activeIndex,
  onChangeIndex,
  onClose,
  onFocusOnMap,
  onUpdatePhoto,
  onDeletePhoto,
}: PhotoLightboxModalProps) {
  const photo = photos[activeIndex];
  const [editing, setEditing] = useState(false);
  const [captionDraft, setCaptionDraft] = useState(photo?.caption || '');
  const [placeDraft, setPlaceDraft] = useState(photo?.placeName || '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setEditing(false);
    setImgFailed(false);
    setCaptionDraft(photo?.caption || '');
    setPlaceDraft(photo?.placeName || '');
  }, [photo?.id, photo?.caption, photo?.placeName]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editing) return;
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' && activeIndex > 0) onChangeIndex(activeIndex - 1);
      else if (e.key === 'ArrowRight' && activeIndex < photos.length - 1) onChangeIndex(activeIndex + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeIndex, photos.length, editing, onClose, onChangeIndex]);

  if (!photo) return null;

  const canModify = !photo.isStarterMemory;
  const areaLabel = formatAreaDisplay(photo.area);

  const handleSave = async () => {
    if (!onUpdatePhoto) return;
    setSaving(true);
    try {
      await onUpdatePhoto(photo.id, {
        caption: captionDraft.trim(),
        placeName: placeDraft.trim(),
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDeletePhoto || !canModify) return;
    setDeleting(true);
    try {
      await onDeletePhoto(photo);
      if (photos.length <= 1) {
        onClose();
      } else if (activeIndex >= photos.length - 1) {
        onChangeIndex(Math.max(0, activeIndex - 1));
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1200] flex flex-col bg-slate-950/95 text-white backdrop-blur-2xl"
      role="dialog"
      aria-modal="true"
      aria-label="Xem ảnh kỷ niệm"
    >
      {/* Top Bar */}
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold text-white sm:text-base">
            {photo.placeName || areaLabel || 'Khoảnh khắc trên hành trình'}
          </h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-slate-300 tabular-nums">
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="size-3.5 text-emerald-400" aria-hidden />
              {formatPhotoFullDateTime(photo.takenAt)}
            </span>
            {areaLabel && <span>· {areaLabel}</span>}
            {photos.length > 1 && (
              <span className="text-slate-400">
                · {activeIndex + 1} / {photos.length}
              </span>
            )}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              onFocusOnMap(photo);
              onClose();
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/10 px-3 text-xs font-semibold text-white transition hover:bg-white/20"
            title="Định vị tấm ảnh này trên bản đồ"
          >
            <MapPin className="size-3.5 text-sky-400" />
            <span className="hidden sm:inline">Xem vị trí</span>
          </button>

          <a
            href={photo.imageUrl}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="grid size-9 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            title="Tải ảnh gốc"
            aria-label="Tải ảnh gốc"
          >
            <Download className="size-4" />
          </a>

          {canModify && onUpdatePhoto && (
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className="grid size-9 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
              title="Chỉnh sửa ghi chú & tên địa điểm"
              aria-label="Chỉnh sửa ghi chú"
            >
              <Pencil className="size-4" />
            </button>
          )}

          {canModify && onDeletePhoto && (
            <button
              type="button"
              disabled={deleting}
              onClick={() => void handleDelete()}
              className="grid size-9 place-items-center rounded-full bg-white/10 text-rose-300 transition hover:bg-rose-500/30 hover:text-white disabled:opacity-50"
              title="Xóa ảnh khỏi bản đồ"
              aria-label="Xóa ảnh"
            >
              <Trash2 className="size-4" />
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
            aria-label="Đóng"
          >
            <X className="size-4" />
          </button>
        </div>
      </header>

      {/* Main Photo Stage */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center p-4 sm:p-8">
        {activeIndex > 0 && (
          <button
            type="button"
            onClick={() => onChangeIndex(activeIndex - 1)}
            className="absolute left-3 top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-white ring-1 ring-white/20 backdrop-blur-md transition hover:scale-105 hover:bg-black/75 sm:left-6"
            aria-label="Ảnh trước"
          >
            <ChevronLeft className="size-5" />
          </button>
        )}

        {imgFailed ? (
          <div className="flex max-w-sm flex-col items-center justify-center rounded-3xl border border-white/15 bg-white/[0.06] px-6 py-10 text-center">
            <p className="text-sm font-bold text-white">Không tải được tệp ảnh gốc</p>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
              Tấm ảnh này có thể được lưu từ phiên bản cũ trước khi chuyển sang kho ảnh bền vững trên Cloud. Bạn có thể bấm biểu tượng thùng rác ở góc trên để dọn đi rồi chụp/tải lại ảnh mới.
            </p>
          </div>
        ) : (
          <img
            src={photo.imageUrl}
            alt={photo.caption || photo.placeName || 'Ảnh kỷ niệm'}
            onError={() => setImgFailed(true)}
            className="max-h-full max-w-full rounded-2xl object-contain shadow-2xl ring-1 ring-white/10"
          />
        )}

        {activeIndex < photos.length - 1 && (
          <button
            type="button"
            onClick={() => onChangeIndex(activeIndex + 1)}
            className="absolute right-3 top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-white ring-1 ring-white/20 backdrop-blur-md transition hover:scale-105 hover:bg-black/75 sm:right-6"
            aria-label="Ảnh tiếp theo"
          >
            <ChevronRight className="size-5" />
          </button>
        )}
      </div>

      {/* Bottom Metadata & Filmstrip Bar */}
      <footer className="border-t border-white/10 bg-slate-950/90 px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-4xl flex-col gap-3">
          {editing ? (
            <div className="grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]">
              <input
                type="text"
                value={placeDraft}
                onChange={(e) => setPlaceDraft(e.target.value)}
                placeholder="Tên địa điểm..."
                className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs text-white placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none"
              />
              <input
                type="text"
                value={captionDraft}
                onChange={(e) => setCaptionDraft(e.target.value)}
                placeholder="Ghi chú cho khoảnh khắc này..."
                className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs text-white placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none"
              />
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSave()}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-400 disabled:opacity-50"
              >
                <Check className="size-3.5" />
                {saving ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <p className="max-w-2xl text-slate-200">
                {photo.caption || 'Không có ghi chú — bấm biểu tượng bút để thêm kỷ niệm cho tấm ảnh này.'}
              </p>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 tabular-nums">
                <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-slate-200">
                  <Smartphone className="size-3 text-emerald-400" aria-hidden />
                  {photo.deviceModel || formatSourceAppLabel(photo.sourceApp)}
                </span>
                <span className="rounded-full bg-white/10 px-2.5 py-1">
                  {photo.coordinates.lat.toFixed(5)}, {photo.coordinates.lng.toFixed(5)}
                </span>
                {photo.destinationSlug && (
                  <Link
                    to={`/destinations/${photo.destinationSlug}`}
                    onClick={onClose}
                    className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-1 font-semibold text-emerald-300 hover:bg-emerald-500/30"
                  >
                    Chi tiết điểm <ExternalLink className="size-3" />
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Mini Filmstrip when viewing multiple photos */}
          {photos.length > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
              {photos.map((item, idx) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onChangeIndex(idx)}
                  className={`relative size-11 shrink-0 overflow-hidden rounded-lg transition ${
                    idx === activeIndex
                      ? 'scale-105 ring-2 ring-white'
                      : 'opacity-50 hover:opacity-90'
                  }`}
                >
                  <img
                    src={item.thumbnailUrl || item.imageUrl}
                    alt=""
                    className="size-full object-cover"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}
