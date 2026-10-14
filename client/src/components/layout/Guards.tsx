import { ShieldAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { ButtonLink } from '../ui/Button';
import { EmptyState, PageLoader } from '../ui/States';

/** UX-only guard; every protected API also enforces authentication on the server. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, status } = useAuthStore();
  const location = useLocation();
  if (status === 'unknown') return <PageLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <>{children}</>;
}

function StaffGate({ children, allowPartner }: { children: ReactNode; allowPartner: boolean }) {
  const { user, status } = useAuthStore();
  const location = useLocation();
  if (status === 'unknown') {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <PageLoader />
      </div>
    );
  }
  if (!user) return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  const allowed = user.role === 'admin' || (allowPartner && user.role === 'partner');
  if (!allowed) {
    return (
      <div className="mx-auto max-w-xl p-6 pt-20">
        <EmptyState
          icon={<ShieldAlert className="size-6" aria-hidden />}
          title="403 · Không có quyền truy cập"
          description="Tài khoản của bạn không có quyền quản trị. Vui lòng đăng nhập bằng tài khoản quản trị viên hoặc đối tác."
          action={<ButtonLink to="/">Về trang chủ</ButtonLink>}
        />
      </div>
    );
  }
  return <>{children}</>;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  return <StaffGate allowPartner={false}>{children}</StaffGate>;
}

export function RequireStaff({ children }: { children: ReactNode }) {
  return <StaffGate allowPartner>{children}</StaffGate>;
}
