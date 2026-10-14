/**
 * Lớp nền trang trí dùng chung cho các trang public (ảnh trong public/images/):
 *  - Hoa sen (lotus_flower_*) neo ở hai góc dưới màn hình, đối xứng trái/phải.
 *  - Cánh sen (lotus_leaf_*) rải nhẹ phía trên.
 * Cố định theo viewport, không bắt sự kiện chuột, ẩn với trình đọc màn hình.
 */
type Decor = { src: string; className: string };

const FLOWERS: Decor[] = [
  // Góc dưới trái
  { src: '/images/lotus_flower_3.png', className: 'bottom-[-3%] left-[-5%] w-44 -rotate-6 opacity-55 sm:w-60 lg:left-[-2%] lg:w-72 xl:w-80' },
  { src: '/images/lotus_flower_5.png', className: 'hidden bottom-[24%] left-[5%] w-12 rotate-12 opacity-45 lg:block xl:left-[8%] xl:w-14' },
  // Góc dưới phải
  { src: '/images/lotus_flower_4.png', className: 'bottom-[-3%] right-[-5%] w-40 rotate-3 opacity-55 sm:w-56 lg:right-[-2%] lg:w-64 xl:w-72' },
  { src: '/images/lotus_flower_2.png', className: 'hidden bottom-[26%] right-[5%] w-16 -rotate-12 opacity-40 lg:block xl:right-[8%] xl:w-20' },
];

const PETALS: Decor[] = [
  { src: '/images/lotus_leaf_7.png', className: 'left-[-2%] top-[14%] w-32 -rotate-[18deg] opacity-25 md:w-40' },
  { src: '/images/lotus_leaf_2.png', className: 'right-[4%] top-[8%] w-16 rotate-[24deg] opacity-25 md:w-20' },
  { src: '/images/lotus_leaf_4.png', className: 'hidden right-[-1%] top-[40%] w-28 -rotate-[32deg] opacity-20 md:block md:w-36' },
  { src: '/images/lotus_leaf_1.png', className: 'hidden left-[14%] top-[48%] w-20 rotate-[14deg] opacity-20 lg:block' },
  { src: '/images/lotus_leaf_6.png', className: 'hidden left-[42%] bottom-[6%] w-14 -rotate-[8deg] opacity-20 md:block md:w-16' },
];

function DecorImage({ src, className }: Decor) {
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      decoding="async"
      loading="lazy"
      className={`absolute h-auto select-none ${className}`}
    />
  );
}

export function PetalBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      {PETALS.map((p) => (
        <DecorImage key={p.src} {...p} className={`blur-[0.5px] ${p.className}`} />
      ))}
      {FLOWERS.map((f) => (
        <DecorImage key={f.src} {...f} className={`drop-shadow-sm ${f.className}`} />
      ))}
    </div>
  );
}
