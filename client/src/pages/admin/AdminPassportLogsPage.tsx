import {
  Award,
  CheckCircle2,
  Clock,
  Download,
  MapPin,
  QrCode,
  Search,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { useState } from 'react';
import { AdminPageHeader } from '../../components/layout/AdminLayout';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, StatCard } from '../../components/ui/Card';
import { Input, Select } from '../../components/ui/Field';
import { EmptyState, ErrorState, PageLoader } from '../../components/ui/States';
import { useApiQuery } from '../../hooks/useApiQuery';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { api, toApiError } from '../../lib/api';
import { toast } from '../../stores/toastStore';
import type { AdminPassportLogItem, AdminPassportLogsResponse } from '../../types/api';

function resolveEntryBadge(log: AdminPassportLogItem) {
  if (log.entryType === 'check_in') {
    if (log.source === 'gps') {
      return { label: 'Check-in GPS thực địa', icon: MapPin, tone: 'teal' as const };
    }
    return { label: 'Check-in Quét QR', icon: QrCode, tone: 'leaf' as const };
  }
  if (log.entryType === 'challenge_completed') {
    return { label: 'Vượt qua thử thách', icon: Trophy, tone: 'teal' as const };
  }
  if (log.entryType === 'badge_awarded') {
    return { label: 'Nhận huy hiệu', icon: Award, tone: 'lotus' as const };
  }
  return { label: log.entryType, icon: CheckCircle2, tone: 'leaf' as const };
}

function renderSourceBadge(source: AdminPassportLogItem['source']) {
  if (source === 'gps') return <Badge tone="teal">GPS thực địa</Badge>;
  if (source === 'qr') return <Badge tone="leaf">Quét QR tại điểm</Badge>;
  return <Badge tone="neutral">Hệ thống tự động</Badge>;
}

export function AdminPassportLogsPage() {
  useDocumentTitle('Nhật ký check-in & hộ chiếu số');

  const [search, setSearch] = useState('');
  const [entryTypeFilter, setEntryTypeFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  const query = useApiQuery<AdminPassportLogsResponse>(
    (signal) =>
      api
        .get<AdminPassportLogsResponse>('/admin/passport-logs', {
          params: {
            page,
            limit: 20,
            q: search || undefined,
            entryType: entryTypeFilter !== 'all' ? entryTypeFilter : undefined,
          },
          signal,
        })
        .then((r) => r.data),
    [page, search, entryTypeFilter],
  );

  const stats = query.data?.stats;

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const res = await api.get<Blob>('/admin/passport-logs/export', {
        params: {
          entryType: entryTypeFilter !== 'all' ? entryTypeFilter : undefined,
        },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nhat-ky-ho-chieu-so-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success('Đã xuất CSV hộ chiếu số (đã ẩn email du khách theo NĐ 13/2023).');
    } catch (err) {
      toast.error('Không thể xuất nhật ký hộ chiếu CSV', toApiError(err).message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <AdminPageHeader
        title="Nhật ký check-in & hộ chiếu số"
        description="Theo dõi lưu lượng du khách thực tế qua check-in GPS thực địa, quét mã QR tại điểm, giải câu đố thử thách và cấp điểm thưởng số."
        actions={
          <Button
            variant="secondary"
            icon={<Download className="size-4" aria-hidden />}
            loading={exporting}
            onClick={handleExportCsv}
          >
            Xuất CSV (Ẩn danh NĐ 13)
          </Button>
        }
      />

      {/* Stats row */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Tổng lượt check-in" value={stats?.totalCheckIns ?? '—'} icon={<QrCode className="size-5 text-leaf-700" />} />
        <StatCard label="Thử thách hoàn thành" value={stats?.totalChallenges ?? '—'} icon={<Trophy className="size-5 text-teal-700" />} />
        <StatCard label="Huy hiệu đã cấp" value={stats?.totalBadges ?? '—'} icon={<Award className="size-5 text-lotus-700" />} />
        <StatCard label="Tổng điểm thưởng" value={stats?.totalPoints ? `+${stats.totalPoints}` : '—'} icon={<Sparkles className="size-5 text-leaf-600" />} />
        <StatCard label="Hoạt động hôm nay (UTC+7)" value={stats?.todayActivities ?? '—'} icon={<Clock className="size-5 text-river-700" />} />
      </div>

      {/* Filter and search */}
      <Card className="mb-6 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-river-400" />
            <Input
              type="search"
              placeholder="Tìm theo tên du khách, email hoặc tên địa điểm check-in..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>

          <div className="w-56">
            <Select
              value={entryTypeFilter}
              onChange={(e) => {
                setEntryTypeFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">Tất cả loại hoạt động</option>
              <option value="check_in">Check-in (QR / GPS)</option>
              <option value="challenge_completed">Hoàn thành thử thách</option>
              <option value="badge_awarded">Đạt huy hiệu</option>
            </Select>
          </div>
        </div>
      </Card>

      {/* Content table */}
      {query.loading && <PageLoader />}
      {query.error && <ErrorState error={query.error} onRetry={() => query.reload()} />}

      {query.data && query.data.items.length === 0 && (
        <Card className="p-8">
          <EmptyState
            title="Chưa có nhật ký check-in nào"
            description={search ? 'Thử tìm với từ khóa khác.' : 'Chưa có hoạt động check-in nào được ghi nhận.'}
          />
        </Card>
      )}

      {query.data && query.data.items.length > 0 && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-sand-200 bg-sand-100/60 text-xs font-semibold text-river-700">
                <tr>
                  <th className="px-4 py-3">Thời gian</th>
                  <th className="px-4 py-3">Du khách</th>
                  <th className="px-4 py-3">Địa điểm / Chi tiết</th>
                  <th className="px-4 py-3">Loại hoạt động</th>
                  <th className="px-4 py-3 text-center">Điểm thưởng</th>
                  <th className="px-4 py-3 text-right">Nguồn xác thực</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-100">
                {query.data.items.map((log) => {
                  const cfg = resolveEntryBadge(log);
                  const Icon = cfg.icon;

                  return (
                    <tr key={log.id} className="hover:bg-sand-50/70 transition-colors">
                      <td className="px-4 py-3.5 whitespace-nowrap text-xs text-river-600">
                        {new Date(log.completedAt).toLocaleString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })}
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-sand-200 text-xs font-bold text-river-800">
                            {log.user.displayName.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-xs text-river-900 truncate">{log.user.displayName}</p>
                            <p className="text-[11px] text-river-500 truncate">{log.user.email}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        {log.destination ? (
                          <div className="flex items-center gap-2">
                            {log.destination.imageUrl && (
                              <img
                                src={log.destination.imageUrl}
                                alt={log.destination.name}
                                className="size-8 rounded object-cover shrink-0"
                              />
                            )}
                            <div className="min-w-0">
                              <p className="font-medium text-xs text-river-900 truncate">{log.destination.name}</p>
                              {log.qrCode && (
                                <p className="text-[11px] text-river-500 truncate">QR: {log.qrCode.label || log.qrCode.code}</p>
                              )}
                            </div>
                          </div>
                        ) : log.challenge ? (
                          <div>
                            <p className="font-medium text-xs text-river-900 truncate">Thử thách: {log.challenge.title}</p>
                            {log.metadata?.correctCount !== undefined && (
                              <p className="text-[11px] text-teal-700">
                                Đúng {log.metadata.correctCount}/{log.metadata.totalQuestions} câu hỏi
                              </p>
                            )}
                          </div>
                        ) : log.badgeKey ? (
                          <div>
                            <p className="font-medium text-xs text-lotus-800">Huy hiệu: {log.badgeKey}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-river-400">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        <Badge tone={cfg.tone}>
                          <Icon className="size-3" /> {cfg.label}
                        </Badge>
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        {log.scoreAwarded > 0 ? (
                          <span className="font-bold text-xs text-leaf-700 bg-leaf-50 px-2 py-0.5 rounded-full ring-1 ring-leaf-200">
                            +{log.scoreAwarded}
                          </span>
                        ) : (
                          <span className="text-xs text-river-400">0</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        {renderSourceBadge(log.source)}
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
                Hiển thị trang <strong>{query.data.page}</strong> / <strong>{query.data.totalPages}</strong> ({query.data.total} lượt)
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
    </>
  );
}
