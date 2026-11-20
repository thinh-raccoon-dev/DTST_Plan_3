import clsx from 'clsx';
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { useUiComfortStore } from '../../stores/uiComfortStore';

/** Sleek lotus-to-emerald hairline progress indicator at the top of the viewport. */
export function ScrollProgressBar() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let rafId = 0;
    const update = () => {
      rafId = 0;
      const doc = document.documentElement;
      const max = Math.max(1, doc.scrollHeight - window.innerHeight);
      setProgress(Math.min(1, Math.max(0, window.scrollY / max)));
    };
    const onScroll = () => {
      if (!rafId) rafId = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-[3px] bg-transparent"
    >
      <div
        className="h-full origin-left bg-gradient-to-r from-leaf-500 via-lotus-400 to-teal-400 transition-transform duration-75 ease-out"
        style={{ transform: `scaleX(${progress})` }}
      />
    </div>
  );
}

/** Choreographed scroll-reveal container using IntersectionObserver. */
export function Reveal({
  children,
  className,
  delayMs = 0,
  direction = 'up',
}: {
  children: ReactNode;
  className?: string;
  delayMs?: number;
  direction?: 'up' | 'scale';
}) {
  const calmMotion = useUiComfortStore((s) => s.calmMotion);
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(calmMotion);

  useEffect(() => {
    if (calmMotion) {
      setVisible(true);
      return;
    }
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -30px 0px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [calmMotion]);

  return (
    <div
      ref={ref}
      data-visible={visible ? 'true' : 'false'}
      data-reveal-dir={direction}
      style={delayMs > 0 && !calmMotion ? { transitionDelay: `${delayMs}ms` } : undefined}
      className={clsx('dtst-reveal', className)}
    >
      {children}
    </div>
  );
}

/**
 * Interactive 3D micro-tilt + soft radial cursor spotlight wrapper for Gen Z tactile delight.
 * Automatically degrades to flat crisp elevation on touch devices and in Senior / Calm Motion modes.
 */
export function TiltCard({
  children,
  className,
  maxTiltDeg = 4.5,
  glowColor = 'rgba(23, 107, 80, 0.13)',
  ...rest
}: HTMLAttributes<HTMLDivElement> & {
  maxTiltDeg?: number;
  glowColor?: string;
}) {
  const calmMotion = useUiComfortStore((s) => s.calmMotion);
  const seniorMode = useUiComfortStore((s) => s.seniorMode);
  const disabled = calmMotion || seniorMode;

  const [style, setStyle] = useState<CSSProperties>({});
  const [spot, setSpot] = useState<{ x: number; y: number; active: boolean }>({
    x: 50,
    y: 50,
    active: false,
  });

  const handleMove = (e: MouseEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (window.matchMedia?.('(pointer: coarse)').matches) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const rotY = (px - 0.5) * 2 * maxTiltDeg;
    const rotX = (0.5 - py) * 2 * maxTiltDeg;
    setStyle({
      transform: `perspective(900px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) translateY(-4px)`,
    });
    setSpot({ x: px * 100, y: py * 100, active: true });
  };

  const handleLeave = () => {
    setStyle({});
    setSpot((s) => ({ ...s, active: false }));
  };

  return (
    <div
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={{
        ...style,
        transition: spot.active
          ? 'transform 120ms ease-out'
          : 'transform 420ms cubic-bezier(0.22, 1, 0.36, 1)',
      }}
      className={clsx('relative min-w-0 will-change-transform', className)}
      {...rest}
    >
      {children}
      {!disabled && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity duration-300"
          style={{
            opacity: spot.active ? 1 : 0,
            background: `radial-gradient(280px circle at ${spot.x}% ${spot.y}%, ${glowColor}, transparent 70%)`,
          }}
        />
      )}
    </div>
  );
}

/** Smooth animated stat counter when scrolled into view. */
export function CountUp({
  end,
  suffix = '',
  prefix = '',
  durationMs = 1100,
}: {
  end: number;
  suffix?: string;
  prefix?: string;
  durationMs?: number;
}) {
  const calmMotion = useUiComfortStore((s) => s.calmMotion);
  const ref = useRef<HTMLSpanElement | null>(null);
  const [val, setVal] = useState(calmMotion ? end : 0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (calmMotion) {
      setVal(end);
      return;
    }
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVal(end);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        if (startedRef.current || !entries.some((e) => e.isIntersecting)) return;
        startedRef.current = true;
        const startTs = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - startTs) / durationMs);
          const eased = 1 - Math.pow(1 - t, 3);
          setVal(Math.round(end * eased));
          if (t < 1) window.requestAnimationFrame(tick);
        };
        window.requestAnimationFrame(tick);
        obs.disconnect();
      },
      { threshold: 0.2 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [calmMotion, durationMs, end]);

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      {val.toLocaleString('vi-VN')}
      {suffix}
    </span>
  );
}
