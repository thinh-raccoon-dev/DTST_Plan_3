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
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end" aria-live="polite" role="status">
      {toasts.map((t) => {
        const Icon = icons[t.tone];
        return (
          <div
            key={t.id}
            className={clsx('animate-toast-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-card border bg-white p-4 shadow-raised', tones[t.tone])}
          >
            <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{t.title}</p>
              {t.description && <p className="mt-0.5 text-sm text-river-600">{t.description}</p>}
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
