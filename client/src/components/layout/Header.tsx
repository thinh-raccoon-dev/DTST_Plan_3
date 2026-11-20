import clsx from 'clsx';
import {
  BookMarked,
  ChevronDown,
  Compass,
  Footprints,
  Heart,
  LayoutDashboard,
  LogIn,
  LogOut,
  MapPinCheck,
  Menu,
  Route,
  Settings,
  Stamp,
  UserRound,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { toApiError } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { toast } from '../../stores/toastStore';
import { ButtonLink } from '../ui/Button';
import { ComfortToolbar, SettingsMenuContent } from '../ui/ComfortToolbar';
import { Logo } from './Logo';

const mainNav = [
  { to: '/destinations', label: 'Khám phá', icon: Compass },
  { to: '/itinerary/create', label: 'Lập lịch trình', icon: Route },
  { to: '/check-in', label: 'Điểm danh GPS', icon: MapPinCheck },
  { to: '/footprints', label: 'Dấu chân', icon: Footprints },
  { to: '/passport', label: 'Hộ chiếu', icon: Stamp },
];

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  clsx(
    'inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[13px] font-semibold transition-all duration-200 xl:px-3.5 xl:text-sm',
    isActive
      ? 'bg-leaf-600 text-white shadow-cta'
      : 'text-river-700 hover:bg-leaf-50 hover:text-leaf-800',
  );

const mobileNavLinkClass = ({ isActive }: { isActive: boolean }) =>
  clsx(
    'inline-flex min-h-11 w-full items-center gap-2.5 whitespace-nowrap rounded-2xl px-3.5 text-sm font-semibold transition-colors',
    isActive ? 'bg-leaf-100 text-leaf-900' : 'text-river-700 hover:bg-leaf-50 hover:text-river-900',
  );

export function Header() {
  const [open, setOpen] = useState(false);
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setOpen(false);
    setMobileSettingsOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname]);

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
        ...(user.role === 'admin' || user.role === 'partner'
          ? [
              {
                to: '/admin',
                label: user.role === 'partner' ? 'Nội dung đối tác' : 'Quản trị',
                icon: LayoutDashboard,
              },
            ]
          : []),
      ]
    : [];

  const initials = user ? (user.displayName || user.email).slice(0, 2).toUpperCase() : '';

  return (
    <header className="sticky top-0 z-50 border-b border-sand-200/70 bg-sand-50/85 backdrop-blur-xl transition-[background-color,box-shadow,border-color] duration-300 supports-[backdrop-filter]:bg-sand-50/80">
      <a
        href="#main"
        className="sr-only rounded-full bg-leaf-600 px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[60]"
      >
        Bỏ qua điều hướng
      </a>
      <div className="mx-auto flex h-[4.25rem] max-w-7xl items-center justify-between gap-2 px-3.5 sm:px-6">
        <Logo />

        {/* Center Main Navigation Pill (Clean, Balanced & Zero Overflow) */}
        <nav
          className="hidden items-center gap-0.5 rounded-full bg-white/75 p-1 shadow-card ring-1 ring-sand-200/80 backdrop-blur-md lg:flex"
          aria-label="Điều hướng chính"
        >
          {mainNav.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={navLinkClass}>
              <Icon className="size-4 shrink-0" aria-hidden />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Right Actions Desktop: Sleek Settings Gear + Clean User Dropdown / Login */}
        <div className="hidden shrink-0 items-center gap-2 lg:flex">
          <ComfortToolbar />

          {user ? (
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen((v) => !v)}
                className="flex min-h-10 items-center gap-2 rounded-full border border-sand-200 bg-white/95 py-1 pl-1.5 pr-3 text-sm font-semibold text-river-800 shadow-card transition-all hover:border-leaf-300 hover:bg-leaf-50/60 focus-visible:outline-none"
                aria-expanded={userMenuOpen}
                aria-haspopup="true"
                title={user.displayName}
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-leaf-600 to-leaf-900 text-xs font-bold text-white shadow-sm">
                  {initials}
                </span>
                <span className="max-w-[100px] truncate text-left xl:max-w-[140px]">
                  {user.displayName}
                </span>
                <ChevronDown
                  className={clsx(
                    'size-3.5 shrink-0 text-river-400 transition-transform duration-200',
                    userMenuOpen && 'rotate-180',
                  )}
                  aria-hidden
                />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 z-50 mt-2 w-64 rounded-2xl border border-sand-200 bg-white p-2 shadow-raised animate-in fade-in zoom-in-95">
                  <div className="border-b border-sand-100 p-3">
                    <p className="truncate text-sm font-bold text-river-900">{user.displayName}</p>
                    <p className="truncate text-xs text-river-500">{user.email}</p>
                    <span className="mt-1.5 inline-block rounded-full bg-leaf-50 px-2 py-0.5 text-[10px] font-semibold text-leaf-800 ring-1 ring-leaf-200">
                      {user.role === 'admin'
                        ? 'Quản trị viên'
                        : user.role === 'partner'
                          ? 'Đối tác'
                          : 'Du khách'}
                    </span>
                  </div>

                  <div className="py-1">
                    <Link
                      to="/account"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-river-700 hover:bg-leaf-50 hover:text-leaf-800"
                    >
                      <UserRound className="size-4 text-leaf-600" />
                      Trang cá nhân
                    </Link>
                    <Link
                      to="/favorites"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-river-700 hover:bg-leaf-50 hover:text-leaf-800"
                    >
                      <Heart className="size-4 text-leaf-600" />
                      Yêu thích
                    </Link>
                    <Link
                      to="/my-itineraries"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-river-700 hover:bg-leaf-50 hover:text-leaf-800"
                    >
                      <BookMarked className="size-4 text-leaf-600" />
                      Lịch trình đã lưu
                    </Link>
                    {(user.role === 'admin' || user.role === 'partner') && (
                      <Link
                        to="/admin"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-river-700 hover:bg-leaf-50 hover:text-leaf-800"
                      >
                        <LayoutDashboard className="size-4 text-leaf-600" />
                        {user.role === 'partner' ? 'Nội dung đối tác' : 'Trang quản trị'}
                      </Link>
                    )}
                  </div>

                  <div className="border-t border-sand-100 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        void handleLogout();
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50"
                    >
                      <LogOut className="size-4 text-rose-500" />
                      Đăng xuất
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <ButtonLink
              to="/login"
              state={{ from: location.pathname }}
              size="sm"
              icon={<LogIn className="size-4" aria-hidden />}
            >
              Đăng nhập
            </ButtonLink>
          )}
        </div>

        {/* Mobile Right Actions: Clean Circular Settings Gear + Hamburger (Compact & Spacious!) */}
        <div className="flex shrink-0 items-center gap-1.5 lg:hidden">
          <ComfortToolbar />
          <button
            type="button"
            className="inline-flex size-10 items-center justify-center rounded-full bg-white/95 text-river-800 shadow-card ring-1 ring-sand-200 hover:bg-leaf-50"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? 'Đóng menu' : 'Mở menu'}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
          </button>
        </div>
      </div>

      {/* Mobile nav drawer */}
      {open && (
        <nav
          id="mobile-nav"
          className="max-h-[calc(100dvh-4.5rem)] overflow-y-auto border-t border-sand-200 bg-sand-50/98 px-4 pb-5 pt-2.5 backdrop-blur-xl lg:hidden"
          aria-label="Điều hướng di động"
        >
          <ul className="grid gap-1">
            {[...mainNav, ...accountLinks].map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink to={to} className={mobileNavLinkClass}>
                  <Icon className="size-5 shrink-0" aria-hidden />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>

          {/* Collapsible Settings Section inside Mobile Menu */}
          <div className="mt-3 border-t border-sand-200 pt-3">
            <button
              type="button"
              onClick={() => setMobileSettingsOpen((v) => !v)}
              aria-expanded={mobileSettingsOpen}
              className="flex min-h-11 w-full items-center justify-between rounded-2xl bg-white px-3.5 text-sm font-bold text-river-800 shadow-2xs ring-1 ring-sand-200"
            >
              <span className="flex items-center gap-2.5">
                <Settings className="size-4 text-leaf-700" aria-hidden />
                Cài đặt & Chế độ Dễ đọc
              </span>
              <ChevronDown
                className={clsx(
                  'size-4 text-river-500 transition-transform duration-200',
                  mobileSettingsOpen && 'rotate-180',
                )}
                aria-hidden
              />
            </button>
            {mobileSettingsOpen && (
              <div className="mt-2.5 rounded-2xl border border-sand-200 bg-white p-3.5 shadow-card">
                <SettingsMenuContent />
              </div>
            )}
          </div>

          <div className="mt-3 border-t border-sand-200 pt-3">
            {user ? (
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-sm font-semibold text-river-800">
                  {user.displayName}
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-rose-50 px-3.5 text-sm font-semibold text-rose-700 ring-1 ring-rose-200"
                >
                  <LogOut className="size-4 text-rose-500" aria-hidden />
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
