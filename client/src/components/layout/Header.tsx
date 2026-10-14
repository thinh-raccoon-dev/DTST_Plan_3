import clsx from 'clsx';
import { BookMarked, Compass, Heart, LayoutDashboard, LogIn, LogOut, Menu, Route, ScanLine, Stamp, UserRound, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { toApiError } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { toast } from '../../stores/toastStore';
import { ButtonLink } from '../ui/Button';
import { Logo } from './Logo';

const mainNav = [
  { to: '/destinations', label: 'Khám phá', icon: Compass },
  { to: '/itinerary/create', label: 'Lập lịch trình', icon: Route },
  { to: '/scan', label: 'Quét QR', icon: ScanLine },
  { to: '/passport', label: 'Hộ chiếu', icon: Stamp },
];

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  clsx(
    'inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-full px-3 text-sm font-medium transition-colors',
    isActive ? 'bg-leaf-100 text-leaf-800' : 'text-river-700 hover:bg-leaf-50 hover:text-river-900',
  );

export function Header() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  useEffect(() => setOpen(false), [location.pathname]);

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Đã đăng xuất');
      navigate('/');
    } catch (error) {
      toast.error('Đăng xuất thất bại', toApiError(error).message);
    }
  };

  const accountLinks = user
    ? [
        { to: '/account', label: 'Trang cá nhân', icon: UserRound },
        { to: '/favorites', label: 'Yêu thích', icon: Heart },
        { to: '/my-itineraries', label: 'Lịch trình đã lưu', icon: BookMarked },
        ...(user.role === 'admin' || user.role === 'partner' ? [{ to: '/admin', label: user.role === 'partner' ? 'Nội dung đối tác' : 'Quản trị', icon: LayoutDashboard }] : []),
      ]
    : [];

  return (
    <header className="sticky top-0 z-50 border-b border-transparent bg-sand-50/60 backdrop-blur-sm transition-[background-color,box-shadow,border-color] duration-300 supports-[backdrop-filter]:bg-sand-50/60">
      <a
        href="#main"
        className="sr-only rounded-full bg-leaf-600 px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[60]"
      >
        Bỏ qua điều hướng
      </a>
      <div className="mx-auto flex h-[4.25rem] max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Điều hướng chính">
          {mainNav.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={navLinkClass}>
              <Icon className="size-4" aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden shrink-0 items-center gap-1 lg:flex">
          {user ? (
            <>
              {accountLinks.map(({ to, label, icon: Icon }) => (
                <NavLink key={to} to={to} className={navLinkClass} title={label}>
                  <Icon className="size-4" aria-hidden />
                  <span className="sr-only xl:not-sr-only">{label}</span>
                </NavLink>
              ))}
              <span className="mx-1 hidden max-w-32 truncate text-sm text-river-600 2xl:inline" title={user.email}>
                {user.displayName}
              </span>
              <button type="button" onClick={handleLogout} className={navLinkClass({ isActive: false })}>
                <LogOut className="size-4" aria-hidden />
                Đăng xuất
              </button>
            </>
          ) : (
            <ButtonLink to="/login" state={{ from: location.pathname }} size="sm" icon={<LogIn className="size-4" aria-hidden />}>
              Đăng nhập
            </ButtonLink>
          )}
        </div>
        <button
          type="button"
          className="inline-flex size-11 items-center justify-center rounded-full bg-white text-river-800 shadow-card ring-1 ring-sand-200 hover:bg-leaf-50 lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? 'Đóng menu' : 'Mở menu'}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
        </button>
      </div>
      {open && (
        <nav id="mobile-nav" className="border-t border-sand-200 bg-sand-50/95 px-4 pb-4 pt-2 backdrop-blur lg:hidden" aria-label="Điều hướng di động">
          <ul className="grid gap-1">
            {[...mainNav, ...accountLinks].map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink to={to} className={({ isActive }) => clsx(navLinkClass({ isActive }), 'w-full')}>
                  <Icon className="size-5" aria-hidden />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
          <div className="mt-3 border-t border-sand-200 pt-3">
            {user ? (
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-sm text-river-600">{user.displayName}</span>
                <button type="button" onClick={handleLogout} className={navLinkClass({ isActive: false })}>
                  <LogOut className="size-4" aria-hidden />
                  Đăng xuất
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <ButtonLink to="/login" state={{ from: location.pathname }}>
                  Đăng nhập
                </ButtonLink>
                <ButtonLink to="/register" variant="secondary">
                  Đăng ký
                </ButtonLink>
              </div>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
