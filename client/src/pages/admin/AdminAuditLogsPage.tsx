import {
  Activity,
  Clock,
  Download,
  Eye,
  FileText,
  Search,
  Shield,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';
import { AdminPageHeader } from '../../components/layout/AdminLayout';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, StatCard } from '../../components/ui/Card';
import { Input, Select } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { EmptyState, ErrorState, PageLoader } from '../../components/ui/States';
import { useApiQuery } from '../../hooks/useApiQuery';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { api, toApiError } from '../../lib/api';
import { toast } from '../../stores/toastStore';
import type { AuditLog, AuditLogStats, Paginated } from '../../types/api';

const actionConfig: Record<string, { label: string; tone: 'leaf' | 'teal' | 'lotus' | 'neutral' | 'river' }> = {
  'destination.create': { label: 'Tạo KDL mới', tone: 'leaf' },
  'destination.update': { label: 'Sửa thông tin KDL', tone: 'neutral' },
  'destination.delete': { label: 'Xóa KDL', tone: 'lotus' },
  'destination.approve': { label: 'Phê duyệt xuất bản KDL', tone: 'leaf' },
  'destination.return_draft': { label: 'Trả KDL về nháp', tone: 'lotus' },
  'destination.hide': { label: 'Ẩn khẩn cấp KDL', tone: 'lotus' },
  'destination.operational_status.toggle': { label: 'Đổi trạng thái vận hành', tone: 'teal' },
  'qr.create': { label: 'Tạo mã QR', tone: 'leaf' },
  'qr.update': { label: 'Cập nhật mã QR', tone: 'neutral' },
  'challenge.create': { label: 'Tạo thử thách KDL', tone: 'teal' },
  'challenge.update': { label: 'Sửa thử thách', tone: 'neutral' },
  'challenge.status.update': { label: 'Đổi trạng thái thử thách', tone: 'teal' },
  'challenge.delete': { label: 'Xóa thử thách', tone: 'lotus' },
  'badge.create': { label: 'Tạo Huy hiệu mới', tone: 'lotus' },
  'badge.update': { label: 'Sửa huy hiệu', tone: 'neutral' },
  'badge.deactivate': { label: 'Tạm dừng huy hiệu', tone: 'neutral' },
  'badge.delete': { label: 'Xóa huy hiệu', tone: 'lotus' },
  'review.respond': { label: 'Phản hồi đánh giá', tone: 'teal' },
  'review.respond.delete': { label: 'Xóa phản hồi', tone: 'lotus' },
  'review.moderate': { label: 'Duyệt đánh giá', tone: 'river' },
  'review.flag': { label: 'Báo cáo đánh giá', tone: 'lotus' },
  'review.delete': { label: 'Xóa đánh giá vĩnh viễn', tone: 'lotus' },
  'user.create': { label: 'Tạo người dùng', tone: 'leaf' },
  'user.role.update': { label: 'Đổi phân quyền', tone: 'lotus' },
  'user.status.update': { label: 'Đổi trạng thái tài khoản', tone: 'neutral' },
  'user.password.reset': { label: 'Đặt lại mật khẩu', tone: 'lotus' },
  'user.destinations.assign': { label: 'Phân công KDL cho đối tác', tone: 'teal' },
  'user.delete': { label: 'Xóa tài khoản (NĐ 13)', tone: 'lotus' },
  'banner.create': { label: 'Tạo banner mới', tone: 'leaf' },
  'banner.update': { label: 'Cập nhật banner', tone: 'neutral' },
  'banner.delete': { label: 'Xóa banner', tone: 'lotus' },
  'banner.submit': { label: 'Đối tác trình duyệt banner', tone: 'teal' },
  'banner.approve': { label: 'Phê duyệt banner đối tác', tone: 'leaf' },
  'banner.reject': { label: 'Từ chối banner đối tác', tone: 'lotus' },
  'banner.pause': { label: 'Tạm dừng banner', tone: 'neutral' },
  'banner.withdraw': { label: 'Rút đề xuất banner', tone: 'neutral' },
  'voucher.create': { label: 'Tạo ưu đãi EXP', tone: 'leaf' },
  'voucher.update': { label: 'Sửa ưu đãi EXP', tone: 'neutral' },
  'voucher.pause': { label: 'Tạm dừng ưu đãi', tone: 'neutral' },
  'voucher.delete': { label: 'Xóa ưu đãi EXP', tone: 'lotus' },
  'voucher.redeem': { label: 'Xác thực đổi mã ưu đãi', tone: 'teal' },
  'voucher.admin_suspend': { label: 'Sở đình chỉ ưu đãi', tone: 'lotus' },
  'voucher.admin_resume': { label: 'Sở khôi phục ưu đãi', tone: 'leaf' },
  'service.create': { label: 'Niêm yết dịch vụ/combo', tone: 'leaf' },
  'service.update': { label: 'Cập nhật bảng giá dịch vụ', tone: 'neutral' },
  'service.delete': { label: 'Xóa dịch vụ niêm yết', tone: 'lotus' },
  'inquiry.update': { label: 'Xử lý yêu cầu đặt đoàn', tone: 'teal' },
  'safety_alert.create': { label: 'Phát cảnh báo an toàn', tone: 'lotus' },
  'safety_alert.deactivate': { label: 'Gỡ cảnh báo an toàn', tone: 'neutral' },
  'media.upload': { label: 'Tải lên ảnh hệ thống', tone: 'river' },
  'itinerary.delete': { label: 'Xóa lịch trình', tone: 'lotus' },
  'system.settings.update': { label: 'Cập nhật cấu hình hệ thống', tone: 'teal' },
  'partner.report.export': { label: 'Đối tác xuất báo cáo CSV', tone: 'river' },
  'admin.analytics.export': { label: 'Xuất báo cáo thống kê CSV', tone: 'river' },
  'admin.audit_logs.export': { label: 'Xuất nhật ký kiểm toán CSV', tone: 'river' },
  'admin.passport_logs.export': { label: 'Xuất nhật ký check-in CSV', tone: 'river' },
};

function formatAction(action: string) {
  return actionConfig[action] || { label: action, tone: 'river' as const };
}

export function AdminAuditLogsPage() {
  useDocumentTitle('Nhật ký hoạt động & Giám sát hệ thống');

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [targetTypeFilter, setTargetTypeFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [exporting, setExporting] = useState(false);

  const logsQuery = useApiQuery<Paginated<AuditLog>>(
    (signal) =>
      api
        .get<Paginated<AuditLog>>('/admin/audit-logs', {
          params: {
            page,
            limit: 20,
            q: search || undefined,
            role: roleFilter !== 'all' ? roleFilter : undefined,
            targetType: targetTypeFilter !== 'all' ? targetTypeFilter : undefined,
            from: fromDate || undefined,
            to: toDate || undefined,
          },
          signal,
        })
        .then((r) => r.data),
    [page, search, roleFilter, targetTypeFilter, fromDate, toDate],
  );

  const statsQuery = useApiQuery<AuditLogStats>(
    (signal) => api.get<AuditLogStats>('/admin/audit-logs/stats', { signal }).then((r) => r.data),
    [],
  );

  const stats = statsQuery.data;

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const res = await api.get<Blob>('/admin/audit-logs/export', {
        params: {
          q: search || undefined,
          role: roleFilter !== 'all' ? roleFilter : undefined,
          targetType: targetTypeFilter !== 'all' ? targetTypeFilter : undefined,
          from: fromDate || undefined,
          to: toDate || undefined,
        },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nhat-ky-kiem-toan-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success('Đã xuất file CSV nhật ký kiểm toán.');
    } catch (err) {
      toast.error('Không thể xuất nhật ký CSV', toApiError(err).message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <AdminPageHeader
        title="Nhật ký hoạt động & Kiểm toán (Audit Logs)"
        description="Ghi nhận bất biến toàn bộ hành động của Quản trị viên và Đối tác: kiểm duyệt KDL/banner, quản lý ưu đãi, cảnh báo an toàn, phân quyền và cấu hình hệ thống."
        actions={
          <Button
            variant="secondary"
            icon={<Download className="size-4" aria-hidden />}
            loading={exporting}
            onClick={handleExportCsv}
          >
            Xuất CSV
          </Button>
        }
      />

      {/* KPI Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Tổng nhật ký hệ thống"
          value={stats?.totalLogs ?? '—'}
          hint="Hồ sơ thao tác được lưu trữ vĩnh viễn"
          icon={<Shield className="size-5 text-river-600" />}
        />
        <StatCard
          label="Thao tác hôm nay (UTC+7)"
          value={stats?.todayLogs ?? '—'}
          hint="Số hành động phát sinh trong ngày giờ VN"
          icon={<Clock className="size-5 text-teal-600" />}
        />
        <StatCard
          label="Tác vụ của Đối tác"
          value={stats?.partnerToday ?? '—'}
          hint="Đối tác KDL cập nhật hoặc tạo nội dung hôm nay"
          icon={<Sparkles className="size-5 text-leaf-600" />}
        />
        <StatCard
          label="Tác vụ của Quản trị viên"
          value={stats?.adminToday ?? '—'}
          hint="Admin phê duyệt và điều phối hệ thống hôm nay"
          icon={<Activity className="size-5 text-lotus-600" />}
        />
      </div>

      {/* Filter and Search Bar */}
      <Card className="mt-6 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative lg:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-river-400" />
            <Input
              type="search"
              placeholder="Tìm theo email, tên, đối tượng, hành động..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>

          <Select
            aria-label="Lọc theo vai trò"
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">Tất cả vai trò tác nhân</option>
            <option value="admin">Quản trị viên (Admin)</option>
            <option value="partner">Đối tác KDL (Partner)</option>
            <option value="system">Tự động hệ thống (System)</option>
          </Select>

          <Select
            aria-label="Lọc theo đối tượng"
            value={targetTypeFilter}
            onChange={(e) => {
              setTargetTypeFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">Tất cả loại đối tượng</option>
            <option value="destination">Điểm đến du lịch (Destination)</option>
            <option value="qr">Mã QR & Standee (QR)</option>
            <option value="challenge">Thử thách & Trò chơi (Challenge)</option>
            <option value="badge">Huy hiệu & Thành tựu (Badge)</option>
            <option value="review">Đánh giá du khách (Review)</option>
            <option value="banner">Banner & Quảng cáo (Banner)</option>
            <option value="voucher">Ưu đãi EXP (Voucher)</option>
            <option value="service">Dịch vụ niêm yết (Service)</option>
            <option value="inquiry">Yêu cầu đặt đoàn (Inquiry)</option>
            <option value="safety_alert">Cảnh báo an toàn (Safety Alert)</option>
            <option value="user">Người dùng & Tài khoản (User)</option>
            <option value="media">Ảnh tải lên (Media)</option>
            <option value="report">Báo cáo xuất file (Report)</option>
            <option value="itinerary">Lịch trình du khách (Itinerary)</option>
            <option value="system">Cấu hình hệ thống (System)</option>
          </Select>

          <div className="flex items-center gap-2">
            <Input
              type="date"
              aria-label="Từ ngày"
              value={fromDate}
              max={toDate || undefined}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(1);
              }}
            />
            <Input
              type="date"
              aria-label="Đến ngày"
              value={toDate}
              min={fromDate || undefined}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
      </Card>

      {/* Audit Logs Table */}
      <div className="mt-6">
        {logsQuery.loading && !logsQuery.data ? (
          <PageLoader />
        ) : logsQuery.error ? (
          <ErrorState error={logsQuery.error} onRetry={logsQuery.reload} />
        ) : logsQuery.data?.items.length === 0 ? (
          <EmptyState
            icon={<FileText className="size-8 text-sand-500" />}
            title="Chưa có nhật ký nào phù hợp"
            description="Các thao tác tạo mới hoặc chỉnh sửa dữ liệu của Admin và Đối tác sẽ xuất hiện tự động tại đây."
          />
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-sand-300 bg-sand-100 text-xs font-semibold text-river-700">
                  <tr>
                    <th className="px-4 py-3">Thời gian</th>
                    <th className="px-4 py-3">Tác nhân</th>
                    <th className="px-4 py-3">Hành động</th>
                    <th className="px-4 py-3">Đối tượng tác động</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="px-4 py-3 text-right">Chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand-200">
                  {logsQuery.data?.items.map((log) => {
                    const act = formatAction(log.action);
                    return (
                      <tr key={log.id} className="hover:bg-sand-50 transition-colors">
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-river-600">
                          <div className="font-medium text-river-900">
                            {new Date(log.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </div>
                          <div>
                            {new Date(log.createdAt).toLocaleDateString('vi-VN')}
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-river-900">
                              {log.actorName || log.actorEmail || 'Hệ thống'}
                            </span>
                            <Badge tone={log.actorRole === 'admin' ? 'lotus' : log.actorRole === 'partner' ? 'teal' : 'river'}>
                              {log.actorRole === 'admin' ? 'Admin' : log.actorRole === 'partner' ? 'Đối tác' : 'Hệ thống'}
                            </Badge>
                          </div>
                          {log.actorEmail && log.actorName !== log.actorEmail && (
                            <div className="text-xs text-river-500">{log.actorEmail}</div>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <Badge tone={act.tone}>{act.label}</Badge>
                        </td>

                        <td className="px-4 py-3">
                          <div className="font-medium text-river-900">
                            {log.targetName || log.targetId || '—'}
                          </div>
                          <div className="text-xs text-river-500 uppercase tracking-wider font-mono">
                            {log.targetType}
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <Badge tone={log.status === 'success' ? 'leaf' : 'lotus'}>
                            {log.status === 'success' ? 'Thành công' : 'Thất bại'}
                          </Badge>
                        </td>

                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setSelectedLog(log)}
                            icon={<Eye className="size-3.5" />}
                          >
                            Xem
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {logsQuery.data && logsQuery.data.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-sand-300 p-4">
                <span className="text-xs text-river-600">
                  Hiển thị trang {logsQuery.data.page} / {logsQuery.data.totalPages} ({logsQuery.data.total} mục)
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Trang trước
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page >= logsQuery.data.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Trang sau
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}
      </div>

      {/* Details Modal */}
      {selectedLog && (
        <Modal
          open={Boolean(selectedLog)}
          onClose={() => setSelectedLog(null)}
          title="Chi tiết Nhật ký Thao tác (Audit Trail)"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg bg-sand-50 p-3">
                <span className="block font-medium text-river-500">Mã nhật ký (Log ID)</span>
                <span className="font-mono font-semibold text-river-900">{selectedLog.id}</span>
              </div>
              <div className="rounded-lg bg-sand-50 p-3">
                <span className="block font-medium text-river-500">Thời gian ghi nhận</span>
                <span className="font-semibold text-river-900">
                  {new Date(selectedLog.createdAt).toLocaleString('vi-VN')}
                </span>
              </div>
              <div className="rounded-lg bg-sand-50 p-3">
                <span className="block font-medium text-river-500">Người thực hiện</span>
                <span className="font-semibold text-river-900">
                  {selectedLog.actorName} ({selectedLog.actorEmail || 'No email'})
                </span>
              </div>
              <div className="rounded-lg bg-sand-50 p-3">
                <span className="block font-medium text-river-500">Vai trò</span>
                <span className="font-semibold text-river-900 uppercase">{selectedLog.actorRole}</span>
              </div>
              <div className="rounded-lg bg-sand-50 p-3">
                <span className="block font-medium text-river-500">Hành động & Đối tượng</span>
                <span className="font-semibold text-river-900">
                  {selectedLog.action} ({selectedLog.targetType}: {selectedLog.targetName || selectedLog.targetId})
                </span>
              </div>
              <div className="rounded-lg bg-sand-50 p-3">
                <span className="block font-medium text-river-500">Địa chỉ IP truy cập</span>
                <span className="font-mono font-semibold text-river-900">{selectedLog.ipAddress || '127.0.0.1'}</span>
              </div>
            </div>

            <div>
              <span className="mb-1 block text-xs font-semibold text-river-700">Dữ liệu chi tiết thay đổi (Payload Details):</span>
              <pre className="max-h-60 overflow-auto rounded-lg bg-river-950 p-3 text-xs font-mono text-emerald-400">
                {JSON.stringify(selectedLog.details, null, 2)}
              </pre>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="secondary" onClick={() => setSelectedLog(null)}>
                Đóng
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
