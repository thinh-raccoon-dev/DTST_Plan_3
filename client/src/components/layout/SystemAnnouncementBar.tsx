import clsx from 'clsx';
import { AlertTriangle, CheckCircle2, Info, Megaphone, Wrench, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';

interface PublicSystemConfig {
  announcement: {
    enabled: boolean;
    message: string;
    tone: 'info' | 'warning' | 'success' | 'lotus';
    linkUrl?: string;
  } | null;
  maintenanceMode?: boolean;
}

const TONE_STYLES: Record<'info' | 'warning' | 'success' | 'lotus', { bar: string; icon: typeof Info }> = {
  info: {
    bar: 'bg-river-900 text-white border-river-800',
    icon: Info,
  },
  warning: {
    bar: 'bg-amber-600 text-white border-amber-700',
    icon: AlertTriangle,
  },
  success: {
    bar: 'bg-leaf-700 text-white border-leaf-800',
    icon: CheckCircle2,
  },
  lotus: {
    bar: 'bg-gradient-to-r from-lotus-700 via-lotus-600 to-amber-600 text-white border-lotus-700',
    icon: Megaphone,
  },
};

function isSafeLink(url?: string): boolean {
  if (!url) return false;
  return /^(\/(?!\/)|https?:\/\/)/i.test(url.trim());
}

export function SystemAnnouncementBar() {
  const [config, setConfig] = useState<PublicSystemConfig | null>(null);
  const [dismissedMsg, setDismissedMsg] = useState<string>('');

  useEffect(() => {
    const controller = new AbortController();
    api
      .get<PublicSystemConfig>('/system/announcement', { signal: controller.signal })
      .then((res) => setConfig(res.data))
      .catch(() => {
        // Non-blocking decorative/global notice
      });
    return () => controller.abort();
  }, []);

  if (!config) return null;

  const showMaintenance = Boolean(config.maintenanceMode);
  const ann = config.announcement;
  const showAnnouncement = Boolean(ann?.enabled && ann.message.trim() && dismissedMsg !== ann.message);

  if (!showMaintenance && !showAnnouncement) return null;

  const toneMeta = ann ? TONE_STYLES[ann.tone] || TONE_STYLES.info : TONE_STYLES.info;
  const ToneIcon = toneMeta.icon;

  return (
    <div className="relative z-40">
      {showMaintenance && (
        <div
          role="alert"
          className="border-b border-amber-700 bg-amber-600 px-4 py-2.5 text-center text-xs sm:text-sm font-semibold text-white"
        >
          <span className="inline-flex items-center gap-2">
            <Wrench className="size-4 shrink-0" aria-hidden />
            Hệ thống Đồng Tháp Smart Travel đang bảo trì nâng cấp định kỳ. Một số tính năng tạm ngưng trong ít phút!
          </span>
        </div>
      )}

      {showAnnouncement && ann && (
        <div
          role="status"
          className={clsx(
            'border-b px-4 py-2 text-xs sm:text-sm font-medium',
            toneMeta.bar,
          )}
        >
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <div className="flex flex-1 flex-wrap items-center justify-center gap-2 text-center">
              <ToneIcon className="size-4 shrink-0 opacity-90" aria-hidden />
              <span>{ann.message}</span>
              {isSafeLink(ann.linkUrl) && (
                ann.linkUrl!.startsWith('/') ? (
                  <Link
                    to={ann.linkUrl!}
                    className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-bold underline-offset-2 hover:bg-white/30"
                  >
                    Xem chi tiết →
                  </Link>
                ) : (
                  <a
                    href={ann.linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-bold underline-offset-2 hover:bg-white/30"
                  >
                    Xem chi tiết →
                  </a>
                )
              )}
            </div>
            <button
              type="button"
              onClick={() => setDismissedMsg(ann.message)}
              aria-label="Đóng thông báo"
              className="shrink-0 rounded-full p-1 text-white/80 hover:bg-white/15 hover:text-white"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
