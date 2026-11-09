import {
  Award,
  Compass,
  KeyRound,
  Lock,
  Search,
  Shield,
  ShieldAlert,
  Trash2,
  Unlock,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { AdminPageHeader } from '../../components/layout/AdminLayout';
import { Badge, StatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, StatCard } from '../../components/ui/Card';
import { FormField, Input, Select } from '../../components/ui/Field';
import { ConfirmDialog, Modal } from '../../components/ui/Modal';
import { EmptyState, ErrorState, PageLoader } from '../../components/ui/States';
import { useApiQuery } from '../../hooks/useApiQuery';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { useAuthStore } from '../../stores/authStore';
import { toast } from '../../stores/toastStore';
import type { AdminUserItem, AdminUsersResponse, UserRole } from '../../types/api';

const roleLabels: Record<UserRole, string> = {
  admin: 'Quản trị viên',
  partner: 'Đối tác',
  tourist: 'Du khách',
};

const roleTones: Record<UserRole, 'lotus' | 'teal' | 'leaf'> = {
  admin: 'lotus',
  partner: 'teal',
  tourist: 'leaf',
};

export function AdminUsersPage() {
  useDocumentTitle('Quản lý người dùng & phân quyền');
  const currentUser = useAuthStore((s) => s.user);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [roleModalUser, setRoleModalUser] = useState<AdminUserItem | null>(null);
  const [newRole, setNewRole] = useState<UserRole>('tourist');
  const [passwordModalUser, setPasswordModalUser] = useState<AdminUserItem | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [toggleStatusUser, setToggleStatusUser] = useState<AdminUserItem | null>(null);
  const [deleteUserTarget, setDeleteUserTarget] = useState<AdminUserItem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // New user form state
  const [newUser, setNewUser] = useState({
    email: '',
    displayName: '',
    password: '',
    role: 'tourist' as UserRole,
  });

  const query = useApiQuery<AdminUsersResponse>(
    (signal) =>
      api
        .get<AdminUsersResponse>('/admin/users', {
          params: {
            page,
            limit: 15,
            q: search || undefined,
            role: roleFilter !== 'all' ? roleFilter : undefined,
            status: statusFilter !== 'all' ? statusFilter : undefined,
          },
          signal,
        })
        .then((r) => r.data),
    [page, search, roleFilter, statusFilter],
  );

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.email || !newUser.displayName || !newUser.password) {
      toast.error('Vui lòng điền đầy đủ thông tin bắt buộc.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/admin/users', newUser);
      toast.success('Đã tạo tài khoản người dùng thành công.');
      setCreateModalOpen(false);
      setNewUser({ email: '', displayName: '', password: '', role: 'tourist' });
      query.reload();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Không thể tạo tài khoản.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateRole = async () => {
    if (!roleModalUser) return;
    setSubmitting(true);
    try {
      await api.patch(`/admin/users/${roleModalUser.id}/role`, { role: newRole });
      toast.success(`Đã cập nhật vai trò của ${roleModalUser.displayName} thành ${roleLabels[newRole]}.`);
      setRoleModalUser(null);
      query.reload();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Không thể cập nhật vai trò.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordModalUser || newPassword.length < 6) {
      toast.error('Mật khẩu mới tối thiểu 6 ký tự.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/admin/users/${passwordModalUser.id}/reset-password`, { password: newPassword });
      toast.success(`Đã đặt lại mật khẩu cho tài khoản ${passwordModalUser.email}.`);
      setPasswordModalUser(null);
      setNewPassword('');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Không thể đặt lại mật khẩu.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!toggleStatusUser) return;
    const targetStatus = toggleStatusUser.status === 'active' ? 'disabled' : 'active';
    setSubmitting(true);
    try {
      await api.patch(`/admin/users/${toggleStatusUser.id}/status`, { status: targetStatus });
      toast.success(targetStatus === 'active' ? 'Đã kích hoạt lại tài khoản.' : 'Đã khóa tài khoản.');
      setToggleStatusUser(null);
      query.reload();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Không thể thay đổi trạng thái.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUserTarget) return;
    setSubmitting(true);
    try {
      await api.delete(`/admin/users/${deleteUserTarget.id}`);
      toast.success(`Đã xóa tài khoản ${deleteUserTarget.email}.`);
      setDeleteUserTarget(null);
      query.reload();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Không thể xóa người dùng.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const stats = query.data?.stats;

  return (
    <>
      <AdminPageHeader
        title="Quản lý tài khoản & phân quyền"
        description="Xem danh sách người dùng toàn hệ thống, phân quyền đối tác/quản trị viên, mở hoặc khóa tài khoản và quản lý thông tin."
        actions={
          <Button onClick={() => setCreateModalOpen(true)}>
            <UserPlus className="size-4" /> Thêm tài khoản mới
          </Button>
        }
      />

      {/* Stats row */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Tổng người dùng" value={stats?.totalUsers ?? '—'} icon={<Users className="size-5 text-leaf-700" />} />
        <StatCard label="Du khách" value={stats?.tourists ?? '—'} icon={<UserCheck className="size-5 text-teal-700" />} />
        <StatCard label="Đối tác" value={stats?.partners ?? '—'} icon={<Shield className="size-5 text-leaf-600" />} />
        <StatCard label="Quản trị viên" value={stats?.admins ?? '—'} icon={<ShieldAlert className="size-5 text-lotus-700" />} />
        <StatCard label="Đang bị khóa" value={stats?.disabled ?? '—'} icon={<Lock className="size-5 text-red-600" />} />
      </div>

      {/* Filter and search bar */}
      <Card className="mb-6 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-river-400" />
            <Input
              type="search"
              placeholder="Tìm theo tên hiển thị hoặc email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="w-40">
              <Select
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all">Tất cả vai trò</option>
                <option value="tourist">Du khách</option>
                <option value="partner">Đối tác</option>
                <option value="admin">Quản trị viên</option>
              </Select>
            </div>

            <div className="w-36">
              <Select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="active">Hoạt động</option>
                <option value="disabled">Bị khóa</option>
              </Select>
            </div>
          </div>
        </div>
      </Card>

      {/* Content list */}
      {query.loading && <PageLoader />}
      {query.error && <ErrorState error={query.error} onRetry={() => query.reload()} />}

      {query.data && query.data.items.length === 0 && (
        <Card className="p-8">
          <EmptyState
            title="Không tìm thấy người dùng nào"
            description={search ? 'Thử tìm với từ khóa khác hoặc bỏ bớt bộ lọc.' : 'Chưa có tài khoản nào phù hợp.'}
          />
        </Card>
      )}

      {query.data && query.data.items.length > 0 && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-sand-200 bg-sand-100/60 text-xs font-semibold text-river-700">
                <tr>
                  <th className="px-4 py-3">Người dùng</th>
                  <th className="px-4 py-3">Vai trò</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3 text-center">Hoạt động</th>
                  <th className="px-4 py-3">Ngày tham gia</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-100">
                {query.data.items.map((user) => {
                  const isCurrent = currentUser?.id === user.id;
                  return (
                    <tr key={user.id} className="hover:bg-sand-50/70 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-leaf-100 text-xs font-bold text-leaf-800">
                            {user.displayName.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-river-900 truncate">
                              {user.displayName}
                              {isCurrent && (
                                <span className="ml-2 rounded bg-leaf-100 px-1.5 py-0.5 text-[10px] font-semibold text-leaf-800">
                                  Bạn
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-river-500 truncate">{user.email}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <Badge tone={roleTones[user.role]}>
                          <Shield className="size-3" />
                          {roleLabels[user.role]}
                        </Badge>
                      </td>

                      <td className="px-4 py-3.5">
                        <StatusBadge
                          status={user.status}
                          label={user.status === 'active' ? 'Hoạt động' : 'Đã khóa'}
                        />
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-3 text-xs text-river-600">
                          <span title="Lịch trình đã lập" className="flex items-center gap-1">
                            <Compass className="size-3.5 text-teal-600" /> {user.stats.itinerariesCount}
                          </span>
                          <span title="Lượt check-in QR" className="flex items-center gap-1">
                            <Users className="size-3.5 text-leaf-600" /> {user.stats.checkInsCount}
                          </span>
                          <span title="Huy hiệu đạt được" className="flex items-center gap-1">
                            <Award className="size-3.5 text-lotus-600" /> {user.stats.badgesCount}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-xs text-river-500 whitespace-nowrap">
                        {formatDate(user.createdAt)}
                      </td>

                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="secondary"
                            className="text-xs"
                            disabled={isCurrent}
                            onClick={() => {
                              setRoleModalUser(user);
                              setNewRole(user.role);
                            }}
                            title="Phân quyền vai trò"
                          >
                            <Shield className="size-3.5" /> Vai trò
                          </Button>

                          <Button
                            size="sm"
                            variant="secondary"
                            className="text-xs"
                            onClick={() => {
                              setPasswordModalUser(user);
                              setNewPassword('');
                            }}
                            title="Đặt lại mật khẩu"
                          >
                            <KeyRound className="size-3.5" />
                          </Button>

                          <Button
                            size="sm"
                            variant={user.status === 'active' ? 'secondary' : 'primary'}
                            className={`text-xs ${user.status === 'active' ? 'text-red-700 hover:bg-red-50' : ''}`}
                            disabled={isCurrent}
                            onClick={() => setToggleStatusUser(user)}
                            title={user.status === 'active' ? 'Khóa tài khoản' : 'Mở khóa'}
                          >
                            {user.status === 'active' ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
                          </Button>

                          <Button
                            size="sm"
                            variant="danger"
                            className="text-xs"
                            disabled={isCurrent}
                            onClick={() => setDeleteUserTarget(user)}
                            title="Xóa tài khoản"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {query.data.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-sand-200 px-4 py-3 text-sm">
              <span className="text-river-600">
                Hiển thị trang <strong>{query.data.page}</strong> / <strong>{query.data.totalPages}</strong> ({query.data.total} người dùng)
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  Trước
                </Button>
                <Button size="sm" variant="secondary" disabled={page >= query.data.totalPages} onClick={() => setPage((p) => p + 1)}>
                  Sau
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Modal: Thêm người dùng mới */}
      <Modal
        open={createModalOpen}
        title="Thêm tài khoản người dùng mới"
        onClose={() => setCreateModalOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateModalOpen(false)} disabled={submitting}>
              Hủy
            </Button>
            <Button onClick={handleCreateUser} loading={submitting}>
              Tạo tài khoản
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <FormField label="Email" required>
            <Input
              type="email"
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              placeholder="vidu@dongthap.gov.vn"
              required
            />
          </FormField>
          <FormField label="Tên hiển thị" required>
            <Input
              type="text"
              value={newUser.displayName}
              onChange={(e) => setNewUser({ ...newUser, displayName: e.target.value })}
              placeholder="Nguyễn Văn A"
              required
            />
          </FormField>
          <FormField label="Mật khẩu khởi tạo" required hint="Tối thiểu 6 ký tự.">
            <Input
              type="password"
              value={newUser.password}
              onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
              placeholder="••••••••"
              required
            />
          </FormField>
          <FormField label="Vai trò hệ thống" required>
            <Select
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value as UserRole })}
            >
              <option value="tourist">Du khách (Mặc định)</option>
              <option value="partner">Đối tác (Quản lý điểm du lịch & dịch vụ)</option>
              <option value="admin">Quản trị viên (Toàn quyền hệ thống)</option>
            </Select>
          </FormField>
        </form>
      </Modal>

      {/* Modal: Đổi vai trò */}
      <Modal
        open={Boolean(roleModalUser)}
        title="Thay đổi vai trò người dùng"
        onClose={() => setRoleModalUser(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRoleModalUser(null)} disabled={submitting}>
              Hủy
            </Button>
            <Button onClick={handleUpdateRole} loading={submitting}>
              Lưu thay đổi
            </Button>
          </>
        }
      >
        {roleModalUser && (
          <div className="space-y-4">
            <p className="text-sm text-river-700">
              Bạn đang thay đổi vai trò của người dùng: <strong>{roleModalUser.displayName}</strong> ({roleModalUser.email}).
            </p>
            <FormField label="Chọn vai trò mới" required>
              <Select value={newRole} onChange={(e) => setNewRole(e.target.value as UserRole)}>
                <option value="tourist">Du khách (Khám phá, quét QR, lập lịch trình)</option>
                <option value="partner">Đối tác (Quản lý các địa điểm được phân công)</option>
                <option value="admin">Quản trị viên (Toàn quyền quản trị hệ thống)</option>
              </Select>
            </FormField>
          </div>
        )}
      </Modal>

      {/* Modal: Đặt lại mật khẩu */}
      <Modal
        open={Boolean(passwordModalUser)}
        title="Đặt lại mật khẩu người dùng"
        onClose={() => setPasswordModalUser(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPasswordModalUser(null)} disabled={submitting}>
              Hủy
            </Button>
            <Button onClick={handleResetPassword} loading={submitting}>
              Đổi mật khẩu
            </Button>
          </>
        }
      >
        {passwordModalUser && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <p className="text-sm text-river-700">
              Nhập mật khẩu mới cho tài khoản: <strong>{passwordModalUser.email}</strong>.
            </p>
            <FormField label="Mật khẩu mới" required hint="Tối thiểu 6 ký tự.">
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Nhập mật khẩu mới..."
                required
              />
            </FormField>
          </form>
        )}
      </Modal>

      {/* Confirm: Khóa / Mở khóa */}
      <ConfirmDialog
        open={Boolean(toggleStatusUser)}
        title={toggleStatusUser?.status === 'active' ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
        message={
          toggleStatusUser?.status === 'active'
            ? `Bạn có chắc muốn khóa tài khoản "${toggleStatusUser.email}"? Người dùng này sẽ không thể đăng nhập vào hệ thống.`
            : `Kích hoạt lại tài khoản "${toggleStatusUser?.email}"? Người dùng sẽ có thể đăng nhập bình thường.`
        }
        confirmLabel={toggleStatusUser?.status === 'active' ? 'Khóa tài khoản' : 'Kích hoạt lại'}
        tone={toggleStatusUser?.status === 'active' ? 'danger' : 'primary'}
        loading={submitting}
        onConfirm={handleToggleStatus}
        onCancel={() => setToggleStatusUser(null)}
      />

      {/* Confirm: Xóa người dùng */}
      <ConfirmDialog
        open={Boolean(deleteUserTarget)}
        title="Xóa vĩnh viễn tài khoản"
        message={
          <>
            Bạn có chắc chắn muốn xóa tài khoản <strong>{deleteUserTarget?.email}</strong>?
            Hành động này sẽ xóa đồng thời tất cả lịch trình và thông tin hộ chiếu liên quan. Không thể hoàn tác!
          </>
        }
        confirmLabel="Xóa tài khoản"
        tone="danger"
        loading={submitting}
        onConfirm={handleDeleteUser}
        onCancel={() => setDeleteUserTarget(null)}
      />
    </>
  );
}
