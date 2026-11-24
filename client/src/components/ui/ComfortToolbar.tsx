import clsx from 'clsx';
import {
  Contrast,
  HeartHandshake,
  MapPinCheck,
  RotateCcw,
  Settings,
  Sparkles,
  Stamp,
  Type,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useGpsAutoCheckInStore } from '../../stores/gpsAutoCheckInStore';
import { useUiComfortStore, type FontScale } from '../../stores/uiComfortStore';
import { toast } from '../../stores/toastStore';

const FONT_OPTIONS: Array<{ value: FontScale; label: string; sample: string }> = [
  { value: 'normal', label: 'Vừa', sample: 'A' },
  { value: 'large', label: 'Lớn', sample: 'A+' },
  { value: 'xlarge', label: 'Rất lớn', sample: 'A++' },
];

export function SettingsMenuContent({ onClose }: { onClose?: () => void }) {
  const {
    seniorMode,
    fontScale,
    highContrast,
    calmMotion,
    setSeniorMode,
    setFontScale,
    setHighContrast,
    setCalmMotion,
    resetDefaults,
  } = useUiComfortStore();
  const user = useAuthStore((s) => s.user);
  const autoGpsEnabled = useGpsAutoCheckInStore((s) => s.enabled);
  const toggleAutoGps = useGpsAutoCheckInStore((s) => s.toggle);

  const handleToggleSenior = () => {
    const next = !seniorMode;
    setSeniorMode(next);
    if (next) {
      toast.success(
        'Đã bật Chế độ Dễ đọc (Người Lớn Tuổi)',
        'Chữ đã phóng to, tăng độ nét, nút bấm lớn hơn và tắt hiệu ứng bay.',
      );
    } else {
      toast.info('Đã chuyển về Giao diện Sống động (Mặc định)');
    }
  };

  const hasCustom = seniorMode || fontScale !== 'normal' || highContrast || calmMotion;

  return (
    <div>
      <div className="flex items-start justify-between gap-2 border-b border-sand-200 pb-3">
        <div className="flex items-center gap-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-leaf-50 text-leaf-700 ring-1 ring-leaf-200">
            <Settings className="size-4" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-extrabold text-river-900">Cài đặt hiển thị</p>
            <p className="text-[11px] text-river-500">Chế độ dễ đọc, cỡ chữ & trợ năng</p>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cài đặt"
            className="grid size-8 shrink-0 place-items-center rounded-full text-river-500 hover:bg-sand-100 hover:text-river-900"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* 1-Click Senior / Easy-Read Master Card */}
      <button
        type="button"
        onClick={handleToggleSenior}
        aria-pressed={seniorMode}
        className={clsx(
          'mt-3 flex w-full items-center justify-between gap-3 rounded-2xl border-2 p-3 text-left transition-all',
          seniorMode
            ? 'border-leaf-600 bg-leaf-50 shadow-card'
            : 'border-sand-200 bg-gradient-to-r from-sand-50 to-white hover:border-leaf-400',
        )}
      >
        <div className="flex min-w-0 items-start gap-2.5">
          <span
            className={clsx(
              'grid size-9 shrink-0 place-items-center rounded-xl',
              seniorMode ? 'bg-leaf-700 text-white' : 'bg-leaf-100 text-leaf-800',
            )}
          >
            <HeartHandshake className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-extrabold text-river-900">Chế độ Dễ đọc (Lớn tuổi)</p>
            <p className="mt-0.5 text-xs leading-snug text-river-600">
              Chữ to rõ, tương phản cao, nút lớn & giảm hiệu ứng chuyển động.
            </p>
          </div>
        </div>
        <span
          className={clsx(
            'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors',
            seniorMode ? 'bg-leaf-600' : 'bg-sand-300',
          )}
          aria-hidden
        >
          <span
            className={clsx(
              'size-5 rounded-full bg-white shadow transition-transform',
              seniorMode ? 'translate-x-5' : 'translate-x-0',
            )}
          />
        </span>
      </button>

      {/* Guest fallback for GPS Check-In & Passport when User Dropdown is not mounted */}
      {!user && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between gap-2 rounded-2xl border border-sand-200 bg-sand-50/90 px-3 py-2.5">
            <Link
              to="/check-in"
              onClick={onClose}
              className="flex min-w-0 flex-1 items-center gap-2.5"
            >
              <span
                className={clsx(
                  'grid size-8 shrink-0 place-items-center rounded-xl',
                  autoGpsEnabled ? 'bg-leaf-600 text-white' : 'bg-sand-200 text-river-600',
                )}
              >
                <MapPinCheck className="size-4" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-extrabold text-river-900">Điểm danh GPS</span>
                <span className="block truncate text-[11px] text-river-600">
                  {autoGpsEnabled ? 'Tự động (<1km) · Đang bật' : 'Tự động · Đang tắt'}
                </span>
              </span>
            </Link>
            <button
              type="button"
              role="switch"
              aria-checked={autoGpsEnabled}
              aria-label="Bật hoặc tắt tự động điểm danh GPS"
              onClick={() => {
                const next = toggleAutoGps();
                toast.info(next ? 'Đã bật tự động điểm danh GPS' : 'Đã tắt tự động điểm danh GPS');
              }}
              className={clsx(
                'relative inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors',
                autoGpsEnabled ? 'bg-leaf-600' : 'bg-sand-300',
              )}
            >
              <span
                aria-hidden
                className={clsx(
                  'size-5 rounded-full bg-white shadow transition-transform',
                  autoGpsEnabled ? 'translate-x-4' : 'translate-x-0',
                )}
              />
            </button>
          </div>
          <Link
            to="/passport"
            onClick={onClose}
            className="flex items-center gap-2.5 rounded-2xl border border-sand-200 bg-white px-3 py-2 text-xs font-bold text-river-800 transition-colors hover:border-leaf-300 hover:bg-leaf-50"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-leaf-50 text-leaf-700">
              <Stamp className="size-4" aria-hidden />
            </span>
            <span>Hộ chiếu trải nghiệm số</span>
          </Link>
        </div>
      )}

      {/* Font Size Controls */}
      <div className="mt-3.5">
        <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-river-700">
          <Type className="size-3.5 text-leaf-700" aria-hidden /> Cỡ chữ toàn trang
        </p>
        <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-sand-100 p-1 ring-1 ring-sand-200">
          {FONT_OPTIONS.map((opt) => {
            const active = fontScale === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFontScale(opt.value)}
                className={clsx(
                  'flex flex-col items-center justify-center rounded-xl py-1.5 transition-all',
                  active
                    ? 'bg-white text-leaf-800 shadow-sm ring-1 ring-leaf-300'
                    : 'text-river-600 hover:text-river-900',
                )}
              >
                <span className="text-sm font-extrabold leading-none">{opt.sample}</span>
                <span className="mt-0.5 text-[11px] font-semibold">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Individual Toggles */}
      <div className="mt-3 space-y-2">
        <ToggleRow
          icon={<Contrast className="size-4 text-leaf-700" />}
          label="Tăng độ tương phản chữ"
          checked={highContrast}
          onChange={setHighContrast}
        />
        <ToggleRow
          icon={<Sparkles className="size-4 text-lotus-600" />}
          label="Tắt hiệu ứng bay (Giảm lóa)"
          checked={calmMotion}
          onChange={setCalmMotion}
        />
      </div>

      {/* Reset Footer */}
      {hasCustom && (
        <div className="mt-3.5 border-t border-sand-200 pt-3">
          <button
            type="button"
            onClick={() => {
              resetDefaults();
              toast.info('Đã khôi phục cài đặt mặc định');
            }}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-sand-100 py-2 text-xs font-bold text-river-700 transition hover:bg-sand-200 hover:text-river-900"
          >
            <RotateCcw className="size-3.5" aria-hidden />
            Khôi phục mặc định
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Clean circular Settings (⚙️) trigger button for the Header.
 * Keeps the header uncluttered while putting Easy-Read / Senior Mode, font size,
 * contrast, and calm motion settings neatly inside one Settings popover.
 */
export function ComfortToolbar() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const { seniorMode, fontScale, highContrast, calmMotion } = useUiComfortStore();
  const hasCustom = seniorMode || fontScale !== 'normal' || highContrast || calmMotion;

  useEffect(() => {
    if (!open) return;
    const onOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Cài đặt hiển thị và chế độ dễ đọc"
        title="Cài đặt (Chế độ dễ đọc, cỡ chữ, độ tương phản)"
        className={clsx(
          'relative inline-flex size-10 items-center justify-center rounded-full transition-all duration-200 ring-1',
          open
            ? 'bg-leaf-700 text-white ring-leaf-800 shadow-cta'
            : seniorMode
              ? 'bg-leaf-100 text-leaf-800 ring-leaf-300 hover:bg-leaf-200'
              : 'bg-white/90 text-river-700 ring-sand-200 shadow-card hover:bg-leaf-50 hover:text-leaf-800 hover:ring-leaf-300',
        )}
      >
        <Settings
          className={clsx('size-[1.15rem] transition-transform duration-300', open && 'rotate-90')}
          aria-hidden
        />
        {hasCustom && !open && (
          <span
            aria-hidden
            className="absolute right-1.5 top-1.5 size-2 rounded-full bg-emerald-500 ring-2 ring-white"
          />
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Cài đặt hiển thị"
          className="fixed right-3 top-[4.6rem] z-[950] w-[min(340px,calc(100vw-1.5rem))] rounded-3xl border border-sand-200 bg-white p-4 shadow-2xl animate-in fade-in zoom-in-95 sm:absolute sm:right-0 sm:top-full sm:mt-2.5"
        >
          <SettingsMenuContent onClose={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}

function ToggleRow({
  icon,
  label,
  checked,
  onChange,
}: {
  icon: ReactNode;
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-2 rounded-xl border border-sand-200 bg-sand-50/70 px-3 py-2 text-left transition hover:border-leaf-300 hover:bg-white"
    >
      <span className="flex min-w-0 items-center gap-2 text-xs font-bold text-river-800">
        {icon}
        <span className="truncate">{label}</span>
      </span>
      <span
        className={clsx(
          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors',
          checked ? 'bg-leaf-600' : 'bg-sand-300',
        )}
        aria-hidden
      >
        <span
          className={clsx(
            'size-4 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-4' : 'translate-x-0',
          )}
        />
      </span>
    </button>
  );
}
