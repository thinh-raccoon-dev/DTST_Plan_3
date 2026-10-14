import clsx from 'clsx';
import { BarChart3, ExternalLink, Image, LogOut, MapPinned, Menu, QrCode, Trophy, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, NavLink, Outlet, ScrollRestoration, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { toast } from '../../stores/toastStore';
import { Logo } from './Logo';

const allItems = [
  { to: '/admin', label: 'Tổng quan', icon: BarChart3, end: true, adminOnly: true },
  { to: '/admin/destinations', label: 'Địa điểm', icon: MapPinned, adminOnly: false },
  { to: '/admin/qr', label: 'Mã QR', icon: QrCode, adminOnly: true },
  { to: '/admin/challenges', label: 'Thử thách', icon: Trophy, adminOnly: true },
  { to: '/admin/banners', label: 'Banner', icon: Image, adminOnly: true },
];

function SideNav({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const items = allItems.filter((item) => user?.role === 'admin' || !item.adminOnly);
  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <div className="px-2 pt-2">
        <Logo to="/admin" subtitle={user?.role === 'partner' ? 'ĐỐI TÁC' : 'QUẢN TRỊ'} stacked={false} />
      </div>
      <nav aria-label="Điều hướng quản trị" className="flex-1">
        <ul className="space-y-1">
          {items.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                onClick={onNavigate}
                className={({ isActive }) =>
                  clsx(
                    'flex min-h-11 items-center gap-3 rounded-control px-3 text-sm font-medium',
                    isActive ? 'bg-leaf-600 text-white shadow-cta' : 'text-river-700 hover:bg-leaf-50',
                  )
                }
              >
                <Icon className="size-5" aria-hidden />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="space-y-1 border-t border-sand-200 pt-4 text-sm">
        <a href="/" target="_blank" rel="noopener" className="flex min-h-10 items-center gap-2 rounded-control px-3 text-river-600 hover:bg-sand-100">
          <ExternalLink className="size-4" aria-hidden /> Xem trang du khách
        </a>
        <p className="truncate px-3 py-1 text-xs text-river-500" title={user?.email}>
          {user?.displayName} · {user?.email}
        </p>
        <button
          type="button"
          onClick={async () => {
            await logout();
            toast.success('Đã đăng xuất');
            navigate('/admin/login');
          }}
          className="flex min-h-10 w-full items-center gap-2 rounded-control px-3 text-river-700 hover:bg-sand-100"
        >
          <LogOut className="size-4" aria-hidden /> Đăng xuất
        </button>
      </div>
    </div>
  );
}

export function AdminLayout() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  useEffect(() => setOpen(false), [location.pathname]);
  if (user?.role === 'partner' && !location.pathname.startsWith('/admin/destinations')) {
    return <Navigate to="/admin/destinations" replace />;
  }
  return (
    <div className="min-h-dvh bg-sand-50 lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="sticky top-0 hidden h-dvh border-r border-sand-200 bg-white lg:block">
        <SideNav />
      </aside>
      <div className="flex items-center justify-between border-b border-sand-200 bg-white px-4 py-3 lg:hidden">
        <Logo to="/admin" subtitle="QUẢN TRỊ" stacked={false} />
        <button type="button" onClick={() => setOpen(true)} className="inline-flex size-11 items-center justify-center rounded-control hover:bg-sand-100" aria-label="Mở menu quản trị">
          <Menu className="size-6" aria-hidden />
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" className="absolute inset-0 bg-river-950/40" aria-label="Đóng menu" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 bg-white shadow-raised">
            <button type="button" onClick={() => setOpen(false)} className="absolute right-3 top-3 rounded-full p-2 hover:bg-sand-100" aria-label="Đóng menu">
              <X className="size-5" aria-hidden />
            </button>
            <SideNav onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
      <main id="main" className="min-w-0 px-4 py-6 sm:px-8 sm:py-8">
        <Outlet />
      </main>
      <ScrollRestoration />
    </div>
  );
}

export function AdminPageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-river-600">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
