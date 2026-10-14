import clsx from 'clsx';
import { AlertTriangle, Inbox, RotateCw } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ApiError } from '../../lib/api';
import { Button } from './Button';

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded-control bg-sand-200/70', className)} aria-hidden />;
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-label="Đang tải">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="overflow-hidden rounded-card border border-sand-200 bg-white">
          <Skeleton className="aspect-[4/3] rounded-none" />
          <div className="space-y-2 p-4">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PageLoader({ label = 'Đang tải…' }: { label?: string }) {
  return (
    <div className="space-y-4 py-6" role="status" aria-label={label}>
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx('flex flex-col items-center rounded-card border border-dashed border-sand-300 bg-white/60 px-6 py-12 text-center', className)}>
      <span className="mb-3 rounded-full bg-sand-100 p-3 text-river-500">{icon ?? <Inbox className="size-6" aria-hidden />}</span>
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-river-600">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, title = 'Không tải được dữ liệu' }: { error: ApiError | null; onRetry?: () => void; title?: string }) {
  return (
    <div role="alert" className="flex flex-col items-center rounded-card border border-red-200 bg-red-50/60 px-6 py-10 text-center">
      <AlertTriangle className="mb-3 size-7 text-red-600" aria-hidden />
      <h3 className="text-base font-semibold text-red-900">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-red-800">{error?.message ?? 'Đã có lỗi xảy ra.'}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-5" onClick={onRetry} icon={<RotateCw className="size-4" aria-hidden />}>
          Thử lại
        </Button>
      )}
    </div>
  );
}

export function Notice({ tone = 'info', title, children, icon }: { tone?: 'info' | 'warning' | 'success'; title?: string; children: ReactNode; icon?: ReactNode }) {
  const styles = {
    info: 'border-river-100 bg-river-50 text-river-800',
    warning: 'border-lotus-300 bg-lotus-50 text-lotus-700',
    success: 'border-leaf-200 bg-leaf-50 text-leaf-800',
  }[tone];
  return (
    <div className={clsx('flex gap-3 rounded-card border p-4 text-sm', styles)}>
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        <div className={title ? 'mt-0.5' : undefined}>{children}</div>
      </div>
    </div>
  );
}
