import clsx from 'clsx';
import type { ReactNode } from 'react';

export type BadgeTone = 'neutral' | 'leaf' | 'river' | 'teal' | 'lotus' | 'red';

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-sand-100 text-river-700 ring-sand-200',
  leaf: 'bg-leaf-50 text-leaf-800 ring-leaf-200',
  river: 'bg-river-50 text-river-700 ring-river-100',
  teal: 'bg-teal-50 text-teal-700 ring-teal-200',
  lotus: 'bg-lotus-50 text-lotus-700 ring-lotus-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
};

export function Badge({ tone = 'neutral', icon, children, className }: { tone?: BadgeTone; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', tones[tone], className)}>
      {icon}
      {children}
    </span>
  );
}

const statusTones: Record<string, BadgeTone> = {
  published: 'leaf',
  active: 'leaf',
  verified: 'leaf',
  draft: 'neutral',
  inactive: 'neutral',
  unknown: 'neutral',
  hidden: 'lotus',
  partially_verified: 'lotus',
  unverified: 'lotus',
  temporarily_closed: 'lotus',
  closed: 'red',
};

/** Badge whose colour follows a known status value. */
export function StatusBadge({ status, label }: { status: string; label: string }) {
  return (
    <Badge tone={statusTones[status] ?? 'neutral'}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {label}
    </Badge>
  );
}
