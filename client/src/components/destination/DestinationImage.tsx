import clsx from 'clsx';
import { useState } from 'react';
import type { Category } from '../../types/api';
import { CategoryIcon } from './CategoryIcon';

const placeholderTones: Record<Category, string> = {
  nature: 'bg-leaf-100 text-leaf-700',
  eco: 'bg-leaf-50 text-leaf-600',
  culture: 'bg-lotus-50 text-lotus-600',
  history: 'bg-sand-100 text-river-700',
  food: 'bg-teal-50 text-teal-700',
  local_experience: 'bg-leaf-50 text-leaf-700',
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
        className={clsx('h-full w-full object-cover', className)}
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
      <svg className="absolute inset-x-0 bottom-0 h-1/3 w-full opacity-30" viewBox="0 0 400 100" preserveAspectRatio="none" aria-hidden>
        <path d="M0 60 Q 100 30 200 60 T 400 60 V100 H0 Z" fill="currentColor" />
        <path d="M0 80 Q 100 55 200 80 T 400 80 V100 H0 Z" fill="currentColor" opacity="0.6" />
      </svg>
      <CategoryIcon category={category} className="relative size-10" strokeWidth={1.5} />
      {showPlaceholderNote && <span className="relative text-xs font-medium opacity-80">Chưa có ảnh được cấp phép sử dụng</span>}
    </div>
  );
}
