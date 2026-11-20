import clsx from 'clsx';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useToastStore, type ToastTone } from '../../stores/toastStore';

const icons: Record<ToastTone, typeof Info> = { success: CheckCircle2, error: XCircle, info: Info };
const tones: Record<ToastTone, string> = {
  success: 'border-leaf-200 text-leaf-800',
  error: 'border-red-200 text-red-800',
  info: 'border-river-200 text-river-800',
};

export function Toaster() {
  const { toasts, dismiss } = useToastStore();
  const visibleToasts = toasts.slice(-2);
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-[4.4rem] z-[1100] flex flex-col items-center gap-2 px-3 py-2 sm:inset-x-auto sm:bottom-4 sm:right-4 sm:top-auto sm:items-end sm:p-4"
      aria-live="polite"
      role="status"
    >
      {visibleToasts.map((t) => {
        const Icon = icons[t.tone];
        return (
          <div
            key={t.id}
            className={clsx(
              'animate-toast-in pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-2xl border bg-white/95 p-3 shadow-raised backdrop-blur-md sm:gap-3 sm:rounded-card sm:p-4',
              tones[t.tone],
            )}
          >
            <Icon className="mt-0.5 size-4 shrink-0 sm:size-5" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold sm:text-sm">{t.title}</p>
              {t.description && <p className="mt-0.5 line-clamp-2 text-xs text-river-600 sm:text-sm">{t.description}</p>}
            </div>
            <button type="button" onClick={() => dismiss(t.id)} className="rounded p-1 text-river-400 hover:text-river-700" aria-label="Đóng thông báo">
              <X className="size-4" aria-hidden />
            </button>
          </div>
        );
      })}
    </div>
  );
}
