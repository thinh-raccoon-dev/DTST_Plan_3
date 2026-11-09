import clsx from 'clsx';
import {
  BookMarked,
  ChevronDown,
  Compass,
  Heart,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  Route,
  ScanLine,
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
    <header className="sticky top-0 z-50 border-b border-sand-200/60 bg-sand-50/80 backdrop-blur-md transition-[background-color,box-shadow,border-color] duration-300 supports-[backdrop-filter]:bg-sand-50/75">
      <a
        href="#main"
        className="sr-only rounded-full bg-leaf-600 px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[60]"
      >
        Bỏ qua điều hướng
      </a>
      <div className="mx-auto flex h-[4.25rem] max-w-7xl items-center justify-between gap-2 px-4 sm:px-6">
        <Logo />

        {/* Main navigation */}
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Điều hướng chính">
          {mainNav.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={navLinkClass}>
              <Icon className="size-4" aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User / Actions desktop */}
        <div className="hidden shrink-0 items-center gap-1.5 lg:flex">
          {user ? (
            <>
              {/* Phím tắt Quản trị cho Admin/Partner */}
              {(user.role === 'admin' || user.role === 'partner') && (
                <NavLink
                  to="/admin"
                  className={({ isActive }) =>
                    clsx(
                      'inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-xs font-semibold uppercase tracking-wider transition-colors',
                      isActive ? 'bg-leaf-700 text-white' : 'bg-sand-100 text-river-800 hover:bg-sand-200 ring-1 ring-sand-200',
                    )
                  }
                  title={user.role === 'partner' ? 'Khu vực Đối tác' : 'Trang Quản trị'}
                >
                  <LayoutDashboard className="size-3.5" aria-hidden />
                  <span>{user.role === 'partner' ? 'Đối tác' : 'Quản trị'}</span>
                </NavLink>
              )}

              {/* Phím tắt Yêu thích */}
              <NavLink to="/favorites" className={navLinkClass} title="Địa điểm yêu thích">
                <Heart className="size-4" aria-hidden />
                <span className="sr-only 2xl:not-sr-only">Yêu thích</span>
              </NavLink>

              {/* Phím tắt Lịch trình đã lưu */}
              <NavLink to="/my-itineraries" className={navLinkClass} title="Lịch trình đã lưu">
                <BookMarked className="size-4" aria-hidden />
                <span className="sr-only 2xl:not-sr-only">Lịch trình</span>
              </NavLink>

              {/* User Dropdown Menu */}
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className="flex items-center gap-2 rounded-full border border-sand-300 bg-white/90 py-1 pl-1.5 pr-2.5 text-sm font-medium text-river-800 shadow-sm transition-all hover:bg-sand-50 hover:ring-1 hover:ring-leaf-300 focus-visible:outline-none"
                  aria-expanded={userMenuOpen}
                  aria-haspopup="true"
                  title={user.displayName}
                >
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-leaf-700 to-leaf-900 text-xs font-bold text-white shadow-sm">
                    {initials}
                  </span>
                  <span className="max-w-[120px] truncate text-left xl:max-w-[160px]">{user.displayName}</span>
                  <ChevronDown
                    className={`size-3.5 shrink-0 text-river-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`}
                    aria-hidden
                  />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-sand-200 bg-white p-2 shadow-raised animate-in fade-in zoom-in-95 z-50">
                    <div className="border-b border-sand-100 p-3">
                      <p className="truncate text-sm font-bold text-river-900">{user.displayName}</p>
                      <p className="truncate text-xs text-river-500">{user.email}</p>
                      <span className="mt-1.5 inline-block rounded-full bg-leaf-50 px-2 py-0.5 text-[10px] font-semibold text-leaf-800 ring-1 ring-leaf-200">
                        {user.role === 'admin' ? 'Quản trị viên' : user.role === 'partner' ? 'Đối tác' : 'Du khách'}
                      </span>
                    </div>

                    <div className="py-1">
                      <Link
                        to="/account"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-river-700 hover:bg-leaf-50 hover:text-leaf-800"
                      >
                        <UserRound className="size-4 text-leaf-600" />
                        Trang cá nhân
                      </Link>
                      <Link
                        to="/favorites"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-river-700 hover:bg-leaf-50 hover:text-leaf-800"
                      >
                        <Heart className="size-4 text-leaf-600" />
                        Yêu thích
                      </Link>
                      <Link
                        to="/my-itineraries"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-river-700 hover:bg-leaf-50 hover:text-leaf-800"
                      >
                        <BookMarked className="size-4 text-leaf-600" />
                        Lịch trình đã lưu
                      </Link>
                      {(user.role === 'admin' || user.role === 'partner') && (
                        <Link
                          to="/admin"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-river-700 hover:bg-leaf-50 hover:text-leaf-800"
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
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50"
                      >
                        <LogOut className="size-4 text-rose-500" />
                        Đăng xuất
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Nút Đăng xuất ngoài thanh header (luôn shrink-0, không bao giờ bị tràn mất) */}
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex shrink-0 min-h-10 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-sm font-medium text-river-700 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                title="Đăng xuất khỏi tài khoản"
              >
                <LogOut className="size-4 text-rose-500" aria-hidden />
                <span>Đăng xuất</span>
              </button>
            </>
          ) : (
            <ButtonLink to="/login" state={{ from: location.pathname }} size="sm" icon={<LogIn className="size-4" aria-hidden />}>
              Đăng nhập
            </ButtonLink>
          )}
        </div>

        {/* Mobile menu hamburger button */}
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

      {/* Mobile nav drawer */}
      {open && (
        <nav
          id="mobile-nav"
          className="border-t border-sand-200 bg-sand-50/95 px-4 pb-4 pt-2 backdrop-blur lg:hidden"
          aria-label="Điều hướng di động"
        >
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
                <span className="truncate text-sm font-medium text-river-700">{user.displayName}</span>
                <button type="button" onClick={handleLogout} className={navLinkClass({ isActive: false })}>
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
