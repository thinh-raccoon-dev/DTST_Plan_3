import clsx from 'clsx';
import {
  Award,
  BarChart3,
  CheckSquare,
  ExternalLink,
  FileText,
  Gift,
  Image,
  LayoutDashboard,
  LogOut,
  MapPinned,
  Menu,
  MessageSquare,
  QrCode,
  Route,
  Settings,
  Shield,
  ShieldAlert,
  Trophy,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, NavLink, Outlet, ScrollRestoration, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { toast } from '../../stores/toastStore';
import { Logo } from './Logo';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  badgeCount?: number;
}

interface NavGroup {
  heading: string;
  items: NavItem[];
}

function buildAdminGroups(pendingTotal: number): NavGroup[] {
  return [
    {
      heading: 'Điều hành & Giám sát',
      items: [
        { to: '/admin', label: 'Tổng quan cấp tỉnh', icon: BarChart3, end: true },
        { to: '/admin/moderation', label: 'Hàng đợi kiểm duyệt', icon: CheckSquare, badgeCount: pendingTotal },
        { to: '/admin/safety-alerts', label: 'Cảnh báo An toàn', icon: ShieldAlert },
        { to: '/admin/commerce', label: 'Voucher & Đặt đoàn', icon: Gift },
        { to: '/admin/passport-logs', label: 'Nhật ký Check-in', icon: FileText },
        { to: '/admin/audit-logs', label: 'Nhật ký kiểm toán', icon: Shield },
      ],
    },
    {
      heading: 'Nội dung & Điểm đến',
      items: [
        { to: '/admin/destinations', label: 'Hồ sơ điểm đến', icon: MapPinned },
        { to: '/admin/reviews', label: 'Đánh giá & Phản hồi', icon: MessageSquare },
        { to: '/admin/banners', label: 'Banner trang chủ', icon: Image },
        { to: '/admin/itineraries', label: 'Lịch trình du khách', icon: Route },
      ],
    },
    {
      heading: 'Gamification & Trải nghiệm',
      items: [
        { to: '/admin/qr', label: 'Mã QR', icon: QrCode },
        { to: '/admin/challenges', label: 'Thử thách', icon: Trophy },
        { to: '/admin/badges', label: 'Huy hiệu & Thành tựu', icon: Award },
      ],
    },
    {
      heading: 'Tài khoản & Hệ thống',
      items: [
        { to: '/admin/users', label: 'Tài khoản & Phân quyền', icon: Users },
        { to: '/admin/system', label: 'Hệ thống & Dịch vụ', icon: Settings },
      ],
    },
  ];
}

const partnerGroups: NavGroup[] = [
  {
    heading: 'Điều hành Khu Du Lịch',
    items: [
      { to: '/admin/partner', label: 'Bảng điều khiển KDL', icon: LayoutDashboard, end: true },
      { to: '/admin/destinations', label: 'Hồ sơ điểm đến', icon: MapPinned },
      { to: '/admin/reviews', label: 'Đánh giá & Phản hồi', icon: MessageSquare },
    ],
  },
];

function SideNav({ onNavigate, pendingTotal }: { onNavigate?: () => void; pendingTotal: number }) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const isPartner = user?.role === 'partner';
  const groups = isPartner ? partnerGroups : buildAdminGroups(pendingTotal);

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="px-2 pt-2">
        <Logo
          to={isPartner ? '/admin/partner' : '/admin'}
          subtitle={isPartner ? 'ĐỐI TÁC' : 'QUẢN TRỊ'}
          stacked={false}
        />
      </div>
      <nav aria-label="Điều hướng quản trị" className="flex-1 overflow-y-auto pr-1 space-y-5">
        {groups.map((group) => (
          <div key={group.heading}>
            <p className="px-3 mb-1.5 text-[10px] font-extrabold uppercase tracking-wider text-river-400">
              {group.heading}
            </p>
            <ul className="space-y-1">
              {group.items.map(({ to, label, icon: Icon, end, badgeCount }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={end}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      clsx(
                        'flex min-h-10 items-center justify-between gap-2 rounded-control px-3 text-sm font-medium transition-colors',
                        isActive ? 'bg-leaf-600 text-white shadow-cta' : 'text-river-700 hover:bg-leaf-50',
                      )
                    }
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Icon className="size-4.5 shrink-0" aria-hidden />
                      <span className="truncate">{label}</span>
                    </span>
                    {badgeCount !== undefined && badgeCount > 0 && (
                      <span className="shrink-0 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">
                        {badgeCount > 99 ? '99+' : badgeCount}
                      </span>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="space-y-1 border-t border-sand-200 pt-3 text-sm">
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
  const [pendingTotal, setPendingTotal] = useState(0);
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  useEffect(() => setOpen(false), [location.pathname]);

  useEffect(() => {
    if (user?.role !== 'admin') return;
    const controller = new AbortController();
    api
      .get<{ counts?: { totalPending?: number } }>('/admin/moderation/summary', { signal: controller.signal })
      .then((res) => setPendingTotal(res.data.counts?.totalPending ?? 0))
      .catch(() => {
        // Silent background badge refresh
      });
    return () => controller.abort();
  }, [user?.role, location.pathname]);

  const isPartnerAllowed =
    location.pathname.startsWith('/admin/partner') ||
    location.pathname.startsWith('/admin/destinations') ||
    location.pathname.startsWith('/admin/reviews');
  if (user?.role === 'partner' && !isPartnerAllowed) {
    return <Navigate to="/admin/partner" replace />;
  }
  return (
    <div className="min-h-dvh bg-sand-50 lg:grid lg:grid-cols-[268px_1fr]">
      <aside className="sticky top-0 hidden h-dvh border-r border-sand-200 bg-white lg:block">
        <SideNav pendingTotal={pendingTotal} />
      </aside>
      <div className="flex items-center justify-between border-b border-sand-200 bg-white px-4 py-3 lg:hidden">
        <Logo to={user?.role === 'partner' ? '/admin/partner' : '/admin'} subtitle={user?.role === 'partner' ? 'ĐỐI TÁC' : 'QUẢN TRỊ'} stacked={false} />
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
            <SideNav onNavigate={() => setOpen(false)} pendingTotal={pendingTotal} />
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
