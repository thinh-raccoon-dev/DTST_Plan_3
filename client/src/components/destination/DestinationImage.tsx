import clsx from 'clsx';
import { useState } from 'react';
import type { Category } from '../../types/api';
import { CategoryIcon } from './CategoryIcon';

const placeholderTones: Record<Category, string> = {
  nature: 'bg-gradient-to-br from-leaf-100 via-leaf-50 to-sand-50 text-leaf-700',
  eco: 'bg-gradient-to-br from-leaf-100 via-sand-50 to-leaf-50 text-leaf-600',
  culture: 'bg-gradient-to-br from-lotus-100 via-lotus-50 to-sand-50 text-lotus-600',
  history: 'bg-gradient-to-br from-sand-200 via-sand-100 to-white text-river-700',
  food: 'bg-gradient-to-br from-teal-100 via-teal-50 to-sand-50 text-teal-700',
  local_experience: 'bg-gradient-to-br from-leaf-100 via-teal-50 to-sand-50 text-leaf-700',
};

/** Shows the licensed image when one exists, otherwise (or on load error) a designed placeholder. */
export function DestinationImage({
  image,
  category,
  name,
  className,
  showPlaceholderNote = false,
}: {
  image: { url: string; alt: string } | null;
  category: Category | null;
  name: string;
  className?: string;
  showPlaceholderNote?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (image && !failed) {
    return (
      <img
        src={image.url}
        alt={image.alt || name}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className={clsx('h-full w-full object-cover transition-transform duration-500 group-hover:scale-105', className)}
      />
    );
  }
  const tone = category ? placeholderTones[category] : 'bg-sand-100 text-river-500';
  return (
    <div
      role="img"
      aria-label={`Chưa có ảnh cho ${name}`}
      className={clsx('relative flex h-full w-full flex-col items-center justify-center gap-2 overflow-hidden', tone, className)}
    >
      <div className="pointer-events-none absolute -right-8 -top-8 size-28 rounded-full bg-white/40 blur-xl" aria-hidden />
      <svg className="absolute inset-x-0 bottom-0 h-1/3 w-full opacity-30" viewBox="0 0 400 100" preserveAspectRatio="none" aria-hidden>
        <path d="M0 60 Q 100 30 200 60 T 400 60 V100 H0 Z" fill="currentColor" />
        <path d="M0 80 Q 100 55 200 80 T 400 80 V100 H0 Z" fill="currentColor" opacity="0.6" />
      </svg>
      <span className="relative grid size-14 place-items-center rounded-2xl bg-white/75 shadow-card ring-1 ring-white/80 backdrop-blur-sm transition-transform duration-300 group-hover:scale-110">
        <CategoryIcon category={category} className="size-7" strokeWidth={1.75} />
      </span>
      {showPlaceholderNote && <span className="relative text-xs font-medium opacity-80">Chưa có ảnh được cấp phép sử dụng</span>}
    </div>
  );
}
