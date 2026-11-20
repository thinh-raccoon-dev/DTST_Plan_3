import { Link } from 'react-router-dom';

/**
 * Logo chính thức của dự án.
 *  - public/images/logo.png      : logo gốc đầy đủ (biểu tượng + chữ), dùng ở footer.
 *  - public/images/logo-mark.png : phần biểu tượng cắt từ logo gốc, dùng trong header/admin.
 */
export function Logo({
  to = '/',
  subtitle = 'SMART TRAVEL',
  stacked = true,
}: {
  to?: string;
  subtitle?: string;
  /** When false, shows a single-line subtitle (admin / compact). */
  stacked?: boolean;
}) {
  return (
    <Link to={to} className="flex min-w-0 shrink items-center gap-1.5 rounded-xl sm:shrink-0 sm:gap-2.5" aria-label="Trang chủ Hộ chiếu Trải nghiệm Đồng Tháp">
      <img
        src="/images/logo-mark.png"
        alt=""
        width={420}
        height={329}
        decoding="async"
        className="h-9 w-auto shrink-0 select-none sm:h-11"
        draggable={false}
      />
      <span className="flex min-w-0 flex-col whitespace-nowrap leading-none">
        <span className="text-[0.9rem] font-extrabold tracking-[0.01em] text-river-900 sm:text-[1.05rem] sm:tracking-[0.02em]">
          ĐỒNG <span className="text-lotus-600">THÁP</span>
        </span>
        <span
          className={
            stacked
              ? 'mt-1 text-[0.55rem] font-semibold tracking-[0.18em] text-leaf-700 sm:text-[0.62rem] sm:tracking-[0.3em]'
              : 'mt-1 text-[0.6rem] font-semibold tracking-wide text-leaf-700 sm:text-[0.65rem]'
          }
        >
          {subtitle}
        </span>
      </span>
    </Link>
  );
}

/** Logo đầy đủ (ảnh gốc có chữ, nền trong suốt) — dùng ở footer hoặc nơi có nhiều không gian. */
export function LogoFull({ className = 'h-28 w-28' }: { className?: string }) {
  return (
    <img
      src="/images/logo.png"
      alt="Logo Đồng Tháp – Hộ chiếu Trải nghiệm số"
      width={500}
      height={500}
      loading="lazy"
      decoding="async"
      className={`${className} object-contain`}
    />
  );
}
