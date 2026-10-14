import clsx from 'clsx';
import { ArrowUpRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useApiQuery } from '../../hooks/useApiQuery';
import { api } from '../../lib/api';
import type { PublicBanner } from '../../types/api';

const ROTATE_MS = 7000;

type ThemeClasses = { panel: string; eyebrow: string; title: string; text: string; cta: string; badge: string; glow: string; fade: string };

const THEMES: Record<PublicBanner['theme'], ThemeClasses> = {
  forest: {
    fade: 'from-leaf-800',
    panel: 'bg-leaf-800 text-white',
    eyebrow: 'text-leaf-300',
    title: 'text-white',
    text: 'text-leaf-100',
    cta: 'bg-white text-leaf-800 hover:bg-leaf-50',
    badge: 'bg-white/10 text-leaf-100 ring-white/15',
    glow: 'from-leaf-600/70 via-leaf-800 to-river-950',
  },
  lotus: {
    fade: 'from-lotus-600',
    panel: 'bg-lotus-600 text-white',
    eyebrow: 'text-lotus-100',
    title: 'text-white',
    text: 'text-lotus-50',
    cta: 'bg-white text-lotus-700 hover:bg-lotus-50',
    badge: 'bg-white/15 text-white ring-white/20',
    glow: 'from-lotus-400/80 via-lotus-600 to-lotus-700',
  },
  cream: {
    fade: 'from-white',
    panel: 'bg-white text-river-900 ring-1 ring-sand-200',
    eyebrow: 'text-leaf-600',
    title: 'text-river-900',
    text: 'text-river-600',
    cta: 'bg-leaf-600 text-white shadow-cta hover:bg-leaf-700',
    badge: 'bg-sand-50 text-river-600 ring-sand-200',
    glow: 'from-leaf-50 via-white to-lotus-50',
  },
};

function isExternal(url: string) {
  return /^https?:\/\//i.test(url);
}

function recordClick(id: string) {
  // Fire-and-forget; counting failures must never block navigation.
  api.post(`/banners/${id}/click`).catch(() => undefined);
}

function BannerLink({ banner, className, children }: { banner: PublicBanner; className: string; children: ReactNode }) {
  if (!banner.linkUrl) return null;
  const onClick = () => recordClick(banner.id);
  if (isExternal(banner.linkUrl)) {
    return (
      <a href={banner.linkUrl} target="_blank" rel="noopener noreferrer sponsored" className={className} onClick={onClick}>
        {children}
      </a>
    );
  }
  return (
    <Link to={banner.linkUrl} className={className} onClick={onClick}>
      {children}
    </Link>
  );
}

function Slide({ banner, active }: { banner: PublicBanner; active: boolean }) {
  const t = THEMES[banner.theme] ?? THEMES.forest;
  const isAd = banner.kind === 'promo';
  const ctaLabel = banner.linkLabel || (isAd ? 'Tìm hiểu thêm' : 'Khám phá');

  return (
    <div
      role="group"
      aria-roledescription="slide"
      aria-label={banner.title}
      aria-hidden={!active}
      {...(!active ? { inert: true as const } : {})}
      className={clsx(
        'col-start-1 row-start-1 overflow-hidden rounded-panel shadow-raised transition-opacity duration-700',
        t.panel,
        active ? 'opacity-100' : 'pointer-events-none opacity-0',
      )}
    >
      <div className="relative grid min-h-[15rem] md:min-h-[17rem] md:grid-cols-[1.2fr_1fr]">
        <div className="relative z-10 flex flex-col justify-center p-6 sm:p-8 md:p-10">
          <div className="flex flex-wrap items-center gap-2">
            {banner.eyebrow && <p className={clsx('text-[0.7rem] font-semibold uppercase tracking-[0.22em]', t.eyebrow)}>{banner.eyebrow}</p>}
            {isAd && (
              <span className={clsx('rounded-full px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.18em] ring-1', t.badge)}>
                Quảng cáo
              </span>
            )}
          </div>
          <h2 className={clsx('mt-3 text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl md:text-[2.4rem]', t.title)}>{banner.title}</h2>
          {banner.subtitle && <p className={clsx('mt-3 max-w-xl text-sm sm:text-base', t.text)}>{banner.subtitle}</p>}
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
            <BannerLink
              banner={banner}
              className={clsx('inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors', t.cta)}
            >
              {ctaLabel}
              <ArrowUpRight className="size-4" aria-hidden />
            </BannerLink>
            {banner.sponsorName && <p className={clsx('text-xs', t.text)}>Tài trợ bởi {banner.sponsorName}</p>}
          </div>
        </div>
        <div className="relative min-h-[9rem] md:min-h-0">
          {banner.imageUrl ? (
            <img src={banner.imageUrl} alt={banner.imageAlt ?? ''} loading={active ? 'eager' : 'lazy'} className="absolute inset-0 size-full object-cover" />
          ) : (
            <div className={clsx('absolute inset-0 bg-gradient-to-br', t.glow)} aria-hidden>
              <div className="absolute -right-10 -top-10 size-56 rounded-full bg-white/10 blur-2xl" />
              <div className="absolute -bottom-12 left-6 size-44 rounded-full bg-white/10 blur-2xl" />
            </div>
          )}
          <div className={clsx('absolute inset-y-0 left-0 hidden w-24 bg-gradient-to-r to-transparent md:block', t.fade)} aria-hidden />
        </div>
      </div>
    </div>
  );
}

/** Admin-managed cover / sponsored banner shown at the very top of the homepage. Renders nothing when there is none. */
export function HomeBanner() {
  const { data } = useApiQuery((signal) => api.get<{ items: PublicBanner[] }>('/banners', { params: { placement: 'home_top' }, signal }).then((r) => r.data.items), []);
  const banners = data ?? [];
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (banners.length < 2 || paused) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % banners.length), ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [banners.length, paused]);

  if (banners.length === 0) return null;
  const current = Math.min(index, banners.length - 1);
  const go = (next: number) => setIndex((next + banners.length) % banners.length);

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Banner nổi bật"
      className="mx-auto max-w-6xl px-4 pt-6 sm:px-6"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="grid">
        {banners.map((b, i) => (
          <Slide key={b.id} banner={b} active={i === current} />
        ))}
      </div>
      {banners.length > 1 && (
        <div className="mt-3 flex items-center justify-center gap-3">
          <button type="button" onClick={() => go(current - 1)} aria-label="Banner trước" className="grid size-8 place-items-center rounded-full bg-white text-river-700 shadow-card ring-1 ring-sand-200 hover:text-leaf-700">
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <div className="flex items-center gap-1.5" role="tablist" aria-label="Chọn banner">
            {banners.map((b, i) => (
              <button
                key={b.id}
                type="button"
                role="tab"
                aria-selected={i === current}
                aria-label={`Banner ${i + 1}: ${b.title}`}
                onClick={() => go(i)}
                className={clsx('h-2 rounded-full transition-all', i === current ? 'w-6 bg-leaf-600' : 'w-2 bg-sand-300 hover:bg-leaf-300')}
              />
            ))}
          </div>
          <button type="button" onClick={() => go(current + 1)} aria-label="Banner tiếp theo" className="grid size-8 place-items-center rounded-full bg-white text-river-700 shadow-card ring-1 ring-sand-200 hover:text-leaf-700">
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
      )}
    </section>
  );
}
