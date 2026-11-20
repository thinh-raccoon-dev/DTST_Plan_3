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

const DRIFTING_PETALS: Array<{ src: string; left: string; size: string; dur: string; delay: string }> = [
  { src: '/images/lotus_leaf_2.png', left: '12%', size: 'w-7 sm:w-9', dur: '19s', delay: '0s' },
  { src: '/images/lotus_leaf_6.png', left: '34%', size: 'w-6 sm:w-8', dur: '24s', delay: '-6s' },
  { src: '/images/lotus_leaf_1.png', left: '62%', size: 'w-7 sm:w-9', dur: '21s', delay: '-11s' },
  { src: '/images/lotus_leaf_2.png', left: '84%', size: 'w-6 sm:w-8', dur: '26s', delay: '-16s' },
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
              } as CSSProperties
            }
            className={`dtst-petal-drift absolute h-auto select-none blur-[0.3px] ${p.size}`}
          />
        ))}

      {FLOWERS.map((f) => (
        <DecorImage key={f.src} {...f} className={`drop-shadow-sm ${f.className}`} />
      ))}
    </div>
  );
}
