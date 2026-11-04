import clsx from 'clsx';
import { Check, Minus, Plus } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

/** Numbered section header used to break the planner form into clear steps. */
export function StepHeader({
  step,
  title,
  description,
  action,
}: {
  step: number;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-leaf-600 text-sm font-bold text-white shadow-cta">
          {step}
        </span>
        <div>
          <h2 className="text-lg leading-snug sm:text-lg">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-river-500">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

/** Large selectable card with icon, used for mode and goal pickers. */
export function OptionCard({
  selected,
  onClick,
  icon,
  title,
  description,
  accent = 'leaf',
  compact = false,
}: {
  selected: boolean;
  onClick: () => void;
  icon: ReactNode;
  title: string;
  description?: string;
  accent?: 'leaf' | 'teal' | 'lotus' | 'river';
  compact?: boolean;
}) {
  const accentBg = {
    leaf: 'bg-leaf-100 text-leaf-700',
    teal: 'bg-teal-50 text-teal-700',
    lotus: 'bg-lotus-50 text-lotus-600',
    river: 'bg-river-100 text-river-700',
  }[accent];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={clsx(
        'group relative flex w-full items-start gap-3 rounded-2xl border-2 text-left transition-all duration-200',
        compact ? 'p-3' : 'p-4',
        selected
          ? 'border-leaf-600 bg-gradient-to-br from-leaf-50 to-white shadow-raised'
          : 'border-sand-200 bg-white hover:-translate-y-0.5 hover:border-leaf-300 hover:shadow-card',
      )}
    >
      <span
        className={clsx(
          'grid shrink-0 place-items-center rounded-xl transition-transform duration-200 group-hover:scale-110',
          compact ? 'size-9' : 'size-11',
          selected ? 'bg-leaf-600 text-white' : accentBg,
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className={clsx('block font-semibold text-river-900', compact ? 'text-sm' : 'text-[0.95rem]')}>{title}</span>
        {description && (
          <span className={clsx('mt-0.5 block text-river-500', compact ? 'text-[11px] leading-snug' : 'text-xs leading-relaxed')}>
            {description}
          </span>
        )}
      </span>
      <span
        className={clsx(
          'absolute right-3 top-3 grid size-5 place-items-center rounded-full transition-all duration-200',
          selected ? 'scale-100 bg-leaf-600 text-white opacity-100' : 'scale-50 opacity-0',
        )}
        aria-hidden
      >
        <Check className="size-3.5" strokeWidth={3} />
      </span>
    </button>
  );
}

/** − value + numeric stepper. */
export function Stepper({
  value,
  onChange,
  min,
  max,
  suffix,
  label,
  icon,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  suffix?: string;
  label: string;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-sand-200 bg-sand-50/70 p-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-river-500">
        {icon}
        {label}
      </p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label={`Giảm ${label}`}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
          className="grid size-9 place-items-center rounded-full border border-sand-300 bg-white text-river-700 transition hover:border-leaf-500 hover:text-leaf-700 active:scale-90 disabled:opacity-40"
        >
          <Minus className="size-4" aria-hidden />
        </button>
        <span className="text-center">
          <span className="text-2xl font-extrabold tabular-nums text-river-900">{value}</span>
          {suffix && <span className="ml-1 text-sm text-river-500">{suffix}</span>}
        </span>
        <button
          type="button"
          aria-label={`Tăng ${label}`}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
          className="grid size-9 place-items-center rounded-full border border-sand-300 bg-white text-river-700 transition hover:border-leaf-500 hover:text-leaf-700 active:scale-90 disabled:opacity-40"
        >
          <Plus className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}

/** Segmented pill control. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string; icon?: ReactNode; hint?: string }>;
  ariaLabel: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex gap-1 rounded-full bg-sand-100 p-1 ring-1 ring-sand-200">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={opt.hint}
            onClick={() => onChange(opt.value)}
            className={clsx(
              'inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-semibold transition-all duration-200',
              active ? 'bg-white text-leaf-700 shadow-card ring-1 ring-leaf-200' : 'text-river-500 hover:text-river-800',
            )}
          >
            {opt.icon}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

const GENERATING_STEPS = [
  'Đang chọn điểm đến phù hợp sở thích…',
  'Đang tính tuyến đường thực tế (Valhalla)…',
  'Đang xếp bữa ăn theo khung giờ…',
  'Đang chọn khách sạn và cân đối ngân sách…',
];

/** Animated placeholder shown while the planner is working. */
export function GeneratingPanel() {
  const [stepIndex, setStepIndex] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setStepIndex((i) => Math.min(i + 1, GENERATING_STEPS.length - 1)), 900);
    return () => window.clearInterval(t);
  }, []);
  return (
    <div
      role="status"
      aria-live="polite"
      className="tp-fade-up relative overflow-hidden rounded-panel bg-gradient-to-br from-leaf-800 via-leaf-700 to-leaf-600 p-8 text-white shadow-raised"
    >
      <div className="tp-shimmer pointer-events-none absolute inset-0" aria-hidden />
      <svg viewBox="0 0 400 80" className="mx-auto h-16 w-full max-w-md" aria-hidden>
        <path d="M10 60 C 90 10, 160 70, 220 35 S 340 10, 390 40" fill="none" stroke="rgb(255 255 255 / 0.25)" strokeWidth="4" strokeLinecap="round" />
        <path d="M10 60 C 90 10, 160 70, 220 35 S 340 10, 390 40" fill="none" stroke="#f3e7c9" strokeWidth="4" strokeLinecap="round" className="tp-route-dash" />
        {[10, 220, 390].map((x, i) => (
          <circle key={x} cx={x} cy={[60, 35, 40][i]} r="7" fill="#efa4b5" stroke="white" strokeWidth="3" />
        ))}
      </svg>
      <p className="mt-4 text-center text-lg font-bold">AI đang lập lịch trình cho bạn</p>
      <ul className="mx-auto mt-4 max-w-sm space-y-2 text-sm">
        {GENERATING_STEPS.map((label, i) => (
          <li
            key={label}
            className={clsx(
              'flex items-center gap-2 transition-opacity duration-300',
              i <= stepIndex ? 'opacity-100' : 'opacity-35',
            )}
          >
            <span
              className={clsx(
                'grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-bold',
                i < stepIndex ? 'bg-teal-50 text-leaf-800' : i === stepIndex ? 'tp-pulse-ring bg-white text-leaf-800' : 'bg-white/20',
              )}
            >
              {i < stepIndex ? <Check className="size-3" strokeWidth={3} aria-hidden /> : i + 1}
            </span>
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}
