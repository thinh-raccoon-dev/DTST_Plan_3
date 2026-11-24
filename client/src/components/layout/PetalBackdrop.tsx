import type { CSSProperties } from 'react';
import { useUiComfortStore } from '../../stores/uiComfortStore';

/**
 * Lớp nền sống động Sen Hồng Đồng Tháp:
 * - Hoa sen neo nhẹ hai góc dưới màn hình, đung đưa theo gió đồng (GPU transform).
 * - Cánh sen hồng trôi nhẹ nhàng trên nền để tạo chiều sâu sống động.
 * - Tự động lắng dịu (ẩn cánh bay, giữ bố cục sạch sẽ) khi bật Chế độ Người Lớn Tuổi hoặc Giảm chuyển động.
 */
type Decor = { src: string; className: string; style?: CSSProperties };

const FLOWERS: Decor[] = [
  {
    src: '/images/lotus_flower_3.png',
    className:
      'dtst-petal-sway bottom-[-3%] left-[-5%] w-44 -rotate-6 opacity-55 sm:w-60 lg:left-[-2%] lg:w-72 xl:w-80',
  },
  {
    src: '/images/lotus_flower_5.png',
    className:
      'dtst-petal-sway hidden bottom-[24%] left-[5%] w-12 rotate-12 opacity-45 lg:block xl:left-[8%] xl:w-14',
    style: { animationDelay: '1.8s' },
  },
  {
    src: '/images/lotus_flower_4.png',
    className:
      'dtst-petal-sway bottom-[-3%] right-[-5%] w-40 rotate-3 opacity-55 sm:w-56 lg:right-[-2%] lg:w-64 xl:w-72',
    style: { animationDelay: '2.7s' },
  },
  {
    src: '/images/lotus_flower_2.png',
    className:
      'dtst-petal-sway hidden bottom-[26%] right-[5%] w-16 -rotate-12 opacity-40 lg:block xl:right-[8%] xl:w-20',
    style: { animationDelay: '0.9s' },
  },
];

const STATIC_PETALS: Decor[] = [
  {
    src: '/images/lotus_leaf_7.png',
    className: 'left-[-2%] top-[14%] w-32 -rotate-[18deg] opacity-25 md:w-40',
  },
  {
    src: '/images/lotus_leaf_2.png',
    className: 'right-[4%] top-[8%] w-16 rotate-[24deg] opacity-25 md:w-20',
  },
  {
    src: '/images/lotus_leaf_4.png',
    className: 'hidden right-[-1%] top-[40%] w-28 -rotate-[32deg] opacity-20 md:block md:w-36',
  },
  {
    src: '/images/lotus_leaf_1.png',
    className: 'hidden left-[14%] top-[48%] w-20 rotate-[14deg] opacity-20 lg:block',
  },
];

interface DriftingPetal {
  src: string;
  left: string;
  size: string;
  dur: string;
  delay: string;
  sway: string;
  rot: string;
  opacity: number;
  reverse?: boolean;
  blur?: string;
  desktopOnly?: boolean;
}

const DRIFTING_PETALS: DriftingPetal[] = [
  { src: '/images/lotus_leaf_2.png', left: '4%', size: 'w-7 sm:w-9', dur: '17s', delay: '-1s', sway: '14vw', rot: '235deg', opacity: 0.56 },
  { src: '/images/lotus_leaf_5.png', left: '13%', size: 'w-5 sm:w-7', dur: '22s', delay: '-9s', sway: '-10vw', rot: '-210deg', opacity: 0.44, reverse: true, blur: 'blur-[0.5px]' },
  { src: '/images/lotus_leaf_1.png', left: '22%', size: 'w-8 sm:w-10', dur: '15.5s', delay: '-4.5s', sway: '16vw', rot: '265deg', opacity: 0.58 },
  { src: '/images/lotus_leaf_6.png', left: '31%', size: 'w-6 sm:w-8', dur: '21s', delay: '-13s', sway: '11vw', rot: '220deg', opacity: 0.48, desktopOnly: true },
  { src: '/images/lotus_leaf_3.png', left: '40%', size: 'w-6 sm:w-8', dur: '19s', delay: '-7.5s', sway: '-13vw', rot: '-245deg', opacity: 0.5, reverse: true },
  { src: '/images/lotus_leaf_4.png', left: '49%', size: 'w-7 sm:w-9', dur: '24s', delay: '-18s', sway: '12vw', rot: '215deg', opacity: 0.42, blur: 'blur-[0.6px]', desktopOnly: true },
  { src: '/images/lotus_leaf_2.png', left: '58%', size: 'w-6 sm:w-8', dur: '16.5s', delay: '-2.5s', sway: '15vw', rot: '260deg', opacity: 0.55 },
  { src: '/images/lotus_leaf_7.png', left: '67%', size: 'w-8 sm:w-10', dur: '20.5s', delay: '-11.5s', sway: '-14vw', rot: '-230deg', opacity: 0.5, reverse: true },
  { src: '/images/lotus_leaf_1.png', left: '76%', size: 'w-5 sm:w-7', dur: '23s', delay: '-16s', sway: '10vw', rot: '205deg', opacity: 0.45, blur: 'blur-[0.4px]', desktopOnly: true },
  { src: '/images/lotus_leaf_6.png', left: '85%', size: 'w-7 sm:w-9', dur: '18s', delay: '-6s', sway: '-12vw', rot: '-250deg', opacity: 0.54, reverse: true },
  { src: '/images/lotus_leaf_3.png', left: '93%', size: 'w-6 sm:w-8', dur: '19.5s', delay: '-14.5s', sway: '-16vw', rot: '-220deg', opacity: 0.48, reverse: true, desktopOnly: true },
];

function DecorImage({ src, className, style }: Decor) {
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      decoding="async"
      loading="lazy"
      style={style}
      className={`absolute h-auto select-none ${className}`}
    />
  );
}

export function PetalBackdrop() {
  const calmMotion = useUiComfortStore((s) => s.calmMotion);
  const highContrast = useUiComfortStore((s) => s.highContrast);

  if (highContrast) return null;

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      {STATIC_PETALS.map((p) => (
        <DecorImage key={p.src} {...p} className={`blur-[0.5px] ${p.className}`} />
      ))}

      {!calmMotion &&
        DRIFTING_PETALS.map((p, idx) => (
          <img
            key={`${p.src}-${idx}`}
            src={p.src}
            alt=""
            draggable={false}
            decoding="async"
            loading="lazy"
            style={
              {
                left: p.left,
                top: 0,
                '--petal-dur': p.dur,
                '--petal-delay': p.delay,
                '--petal-sway': p.sway,
                '--petal-rot': p.rot,
                '--petal-opacity': p.opacity,
              } as CSSProperties
            }
            className={`${p.reverse ? 'dtst-petal-drift-reverse' : 'dtst-petal-drift'} absolute h-auto select-none ${p.blur ?? 'blur-[0.25px]'} ${p.desktopOnly ? 'hidden sm:block' : ''} ${p.size}`}
          />
        ))}

      {FLOWERS.map((f) => (
        <DecorImage key={f.src} {...f} className={`drop-shadow-sm ${f.className}`} />
      ))}
    </div>
  );
}
