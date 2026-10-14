import { Mail, Phone } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, Outlet, ScrollRestoration } from 'react-router-dom';
import { Header } from './Header';
import { LogoFull } from './Logo';
import { PetalBackdrop } from './PetalBackdrop';

const CONTACT = {
  phone: '0942067646',
  phoneDisplay: '0942 067 646',
  email: 'minhuyenn1101@gmail.com',
  fanpage: 'https://www.facebook.com/share/1CCKSRvhPa/?mibextid=wwXIfr',
};

const footerLinkClass = 'transition-colors hover:text-leaf-700';

/** lucide-react không còn icon thương hiệu → vẽ chữ "f" tối giản. */
function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M13.5 21v-7.3h2.5l.4-3h-2.9V8.8c0-.9.3-1.5 1.5-1.5h1.5V4.6c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.4H8v3h2.6V21h2.9Z" />
    </svg>
  );
}

function Footer() {
  return (
    <footer className="mt-16 border-t border-sand-200 bg-white/80 backdrop-blur-sm">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.6fr_1fr_1fr_1.2fr]">
        <div className="space-y-4">
          <Link to="/" className="inline-block rounded-2xl" aria-label="Trang chủ Hộ chiếu Trải nghiệm Đồng Tháp">
            <LogoFull className="h-36 w-36" />
          </Link>
          <p className="max-w-md text-sm leading-relaxed text-river-600">
            Nền tảng Du lịch Thông minh và Hộ chiếu Trải nghiệm số Đồng Tháp — kết nối công nghệ với những giá trị văn hóa, thiên nhiên
            và trải nghiệm địa phương.
          </p>
          <p className="max-w-md text-xs leading-relaxed text-river-500">
            Một số nội dung đang là dữ liệu minh họa và được gắn nhãn rõ ràng; vui lòng kiểm tra thông tin với nguồn chính thức trước
            chuyến đi.
          </p>
        </div>

        <div>
          <h2 className="text-sm font-extrabold tracking-wide text-river-900">Khám phá</h2>
          <ul className="mt-3 space-y-2 text-sm text-river-600">
            <li><Link className={footerLinkClass} to="/destinations">Địa điểm</Link></li>
            <li><Link className={footerLinkClass} to="/itinerary/create">Lập lịch trình</Link></li>
            <li><Link className={footerLinkClass} to="/scan">Quét mã QR</Link></li>
            <li><Link className={footerLinkClass} to="/passport">Hộ chiếu trải nghiệm</Link></li>
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-extrabold tracking-wide text-river-900">Thông tin</h2>
          <ul className="mt-3 space-y-2 text-sm text-river-600">
            <li><Link className={footerLinkClass} to="/privacy">Chính sách quyền riêng tư</Link></li>
            <li><Link className={footerLinkClass} to="/terms">Điều khoản sử dụng</Link></li>
            <li><Link className={footerLinkClass} to="/admin/login">Dành cho quản trị viên</Link></li>
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-extrabold tracking-wide text-river-900">Liên hệ</h2>
          <ul className="mt-3 space-y-2.5 text-sm text-river-600">
            <li>
              <a className={`inline-flex items-center gap-2.5 ${footerLinkClass}`} href={`tel:${CONTACT.phone}`}>
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-leaf-50 text-leaf-700 ring-1 ring-leaf-100">
                  <Phone className="size-4" aria-hidden />
                </span>
                <span>
                  <span className="sr-only">Điện thoại: </span>
                  {CONTACT.phoneDisplay}
                </span>
              </a>
            </li>
            <li>
              <a className={`inline-flex items-center gap-2.5 ${footerLinkClass}`} href={`mailto:${CONTACT.email}`}>
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-leaf-50 text-leaf-700 ring-1 ring-leaf-100">
                  <Mail className="size-4" aria-hidden />
                </span>
                <span className="break-all">
                  <span className="sr-only">Email: </span>
                  {CONTACT.email}
                </span>
              </a>
            </li>
            <li>
              <a
                className={`inline-flex items-center gap-2.5 ${footerLinkClass}`}
                href={CONTACT.fanpage}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-leaf-50 text-leaf-700 ring-1 ring-leaf-100">
                  <FacebookIcon className="size-4" />
                </span>
                <span>
                  Fanpage Đồng Tháp Smart Travel
                  <span className="sr-only"> (mở trong tab mới)</span>
                </span>
              </a>
            </li>
          </ul>
        </div>
      </div>
      <p className="border-t border-sand-200 py-4 text-center text-xs text-river-500">
        © {new Date().getFullYear()} Đồng Tháp Smart Travel · Bản đồ: © OpenStreetMap contributors
      </p>
    </footer>
  );
}

export function PublicLayout() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-clip">
      <PetalBackdrop />
      <Header />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <ScrollRestoration />
    </div>
  );
}

const containerWidths = { wide: 'max-w-6xl', medium: 'max-w-3xl', narrow: 'max-w-2xl' };

export function PageContainer({ children, width = 'wide' }: { children: ReactNode; width?: keyof typeof containerWidths }) {
  return <div className={`mx-auto w-full ${containerWidths[width]} px-4 py-8 sm:px-6 sm:py-10`}>{children}</div>;
}
