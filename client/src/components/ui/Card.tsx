import clsx from 'clsx';
import type { HTMLAttributes, ReactNode } from 'react';

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        'rounded-card bg-white shadow-card ring-1 ring-sand-200',
        className,
      )}
      {...rest}
    />
  );
}

export function SectionHeading({
  title,
  description,
  action,
  eyebrow,
  as: Tag = 'h2',
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  eyebrow?: string;
  as?: 'h1' | 'h2' | 'h3';
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
        <Tag className={Tag === 'h1' ? 'text-[1.875rem] leading-tight sm:text-4xl' : Tag === 'h2' ? 'text-2xl leading-tight sm:text-[2rem]' : 'text-lg leading-snug sm:text-xl'}>
          {title}
        </Tag>
        {description && <p className="mt-2 text-sm leading-relaxed text-river-600 sm:text-base">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: string; icon?: ReactNode }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-river-600">{label}</p>
        {icon && <span className="text-leaf-600">{icon}</span>}
      </div>
      <p className="mt-2 text-2xl font-extrabold text-river-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-river-500">{hint}</p>}
    </Card>
  );
}
