import {
  Calendar,
  Clock,
  Eye,
  MapPin,
  Route,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { AdminPageHeader } from '../../components/layout/AdminLayout';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, StatCard } from '../../components/ui/Card';
import { Input, Select } from '../../components/ui/Field';
import { ConfirmDialog, Modal } from '../../components/ui/Modal';
import { EmptyState, ErrorState, PageLoader } from '../../components/ui/States';
import { useApiQuery } from '../../hooks/useApiQuery';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { toast } from '../../stores/toastStore';
import type { AdminItinerariesResponse, AdminItineraryItem } from '../../types/api';

interface DetailedItinerary {
  id: string;
  title: string;
  numberOfDays: number;
  estimatedDurationMinutes: number;
  plannerVersion?: string;
  preferences?: {
    areas?: string[];
    interests?: string[];
    hoursPerDay?: number;
  };
  days?: Array<{
    dayNumber: number;
    items: Array<{
      destinationId?: {
        name?: string;
        slug?: string;
        category?: string;
        area?: string;
        address?: string;
      };
      nameSnapshot: string;
      slugSnapshot: string;
      durationMinutes: number;
      durationIsEstimate: boolean;
      note?: string;
    }>;
  }>;
  user?: {
    email?: string;
    displayName?: string;
    role?: string;
  };
  createdAt: string;
}

export function AdminItinerariesPage() {
  useDocumentTitle('Quản lý lịch trình du khách');

  const [search, setSearch] = useState('');
  const [daysFilter, setDaysFilter] = useState('0');
  const [page, setPage] = useState(1);

  const [selectedItineraryId, setSelectedItineraryId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminItineraryItem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const query = useApiQuery<AdminItinerariesResponse>(
    (signal) =>
      api
        .get<AdminItinerariesResponse>('/admin/itineraries', {
          params: {
            page,
            limit: 15,
            q: search || undefined,
            days: daysFilter !== '0' ? daysFilter : undefined,
          },
          signal,
        })
        .then((r) => r.data),
    [page, search, daysFilter],
  );

  const detailQuery = useApiQuery<{ itinerary: DetailedItinerary }>(
    (signal) =>
      selectedItineraryId
        ? api.get<{ itinerary: DetailedItinerary }>(`/admin/itineraries/${selectedItineraryId}`, { signal }).then((r) => r.data)
        : Promise.resolve({ itinerary: null as unknown as DetailedItinerary }),
    [selectedItineraryId],
  );

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSubmitting(true);
    try {
      await api.delete(`/admin/itineraries/${deleteTarget.id}`);
      toast.success(`Đã xóa lịch trình "${deleteTarget.title}".`);
      setDeleteTarget(null);
      query.reload();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Không thể xóa lịch trình.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const stats = query.data?.stats;

  return (
    <>
      <AdminPageHeader
        title="Quản lý lịch trình du khách"
        description="Theo dõi toàn bộ lịch trình tham quan do du khách tạo hoặc lưu lại, phân tích xu hướng chuyến đi và kiểm duyệt nội dung."
      />

      {/* Stats row */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Tổng lịch trình" value={stats?.totalItineraries ?? '—'} icon={<Route className="size-5 text-leaf-700" />} />
        <StatCard label="Chuyến đi 1 ngày" value={stats?.oneDayCount ?? '—'} icon={<Calendar className="size-5 text-teal-700" />} />
        <StatCard label="Chuyến đi 2 ngày" value={stats?.twoDayCount ?? '—'} icon={<Calendar className="size-5 text-leaf-600" />} />
        <StatCard label="Chuyến đi 3+ ngày" value={stats?.multiDayCount ?? '—'} icon={<Calendar className="size-5 text-lotus-700" />} />
      </div>

      {/* Filter and search */}
      <Card className="mb-6 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-river-400" />
            <Input
              type="search"
              placeholder="Tìm theo tiêu đề lịch trình hoặc email người tạo..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>

          <div className="w-48">
            <Select
              value={daysFilter}
              onChange={(e) => {
                setDaysFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="0">Tất cả số ngày</option>
              <option value="1">1 ngày</option>
              <option value="2">2 ngày</option>
              <option value="3">3 ngày trở lên</option>
            </Select>
          </div>
        </div>
      </Card>

      {/* Content */}
      {query.loading && <PageLoader />}
      {query.error && <ErrorState error={query.error} onRetry={() => query.reload()} />}

      {query.data && query.data.items.length === 0 && (
        <Card className="p-8">
          <EmptyState
            title="Chưa có lịch trình nào"
            description={search ? 'Thử tìm với từ khóa khác.' : 'Hiện tại chưa có du khách nào tạo lịch trình.'}
          />
        </Card>
      )}

      {query.data && query.data.items.length > 0 && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-sand-200 bg-sand-100/60 text-xs font-semibold text-river-700">
                <tr>
                  <th className="px-4 py-3">Tên lịch trình</th>
                  <th className="px-4 py-3">Người tạo</th>
                  <th className="px-4 py-3 text-center">Thời lượng</th>
                  <th className="px-4 py-3 text-center">Số điểm dừng</th>
                  <th className="px-4 py-3">Điểm đến tiêu biểu</th>
                  <th className="px-4 py-3">Ngày tạo</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-100">
                {query.data.items.map((it) => (
                  <tr key={it.id} className="hover:bg-sand-50/70 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="font-medium text-river-900">{it.title}</div>
                      {it.plannerVersion === 'v9' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-leaf-700">
                          <Sparkles className="size-3 text-leaf-600" /> AI V9 Smart Plan
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3.5">
                      {it.user ? (
                        <div>
                          <div className="font-medium text-river-800">{it.user.displayName}</div>
                          <div className="text-xs text-river-500">{it.user.email}</div>
                        </div>
                      ) : (
                        <span className="text-xs text-river-500 italic">Khách vãng lai</span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 text-center">
                      <Badge tone="teal">
                        <Calendar className="size-3" /> {it.numberOfDays} ngày
                      </Badge>
                    </td>

                    <td className="px-4 py-3.5 text-center">
                      <span className="font-semibold text-river-800">{it.totalStops}</span>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {it.destinationNames.map((name, idx) => (
                          <span
                            key={idx}
                            className="inline-block rounded bg-sand-100 px-1.5 py-0.5 text-[11px] text-river-700 truncate max-w-[140px]"
                            title={name}
                          >
                            {name}
                          </span>
                        ))}
                        {it.totalStops > it.destinationNames.length && (
                          <span className="text-[11px] text-river-500">
                            +{it.totalStops - it.destinationNames.length} điểm
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3.5 text-xs text-river-500 whitespace-nowrap">
                      {formatDate(it.createdAt)}
                    </td>

                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="text-xs"
                          onClick={() => setSelectedItineraryId(it.id)}
                          title="Xem chi tiết lộ trình"
                        >
                          <Eye className="size-3.5" /> Chi tiết
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          className="text-xs"
                          onClick={() => setDeleteTarget(it)}
                          title="Xóa lịch trình"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {query.data.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-sand-200 px-4 py-3 text-sm">
              <span className="text-river-600">
                Hiển thị trang <strong>{query.data.page}</strong> / <strong>{query.data.totalPages}</strong> ({query.data.total} lịch trình)
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

      {/* Modal: Xem chi tiết lộ trình */}
      <Modal
        open={Boolean(selectedItineraryId)}
        title={detailQuery.data?.itinerary?.title ?? 'Chi tiết lịch trình'}
        onClose={() => setSelectedItineraryId(null)}
        size="lg"
        footer={
          <Button variant="secondary" onClick={() => setSelectedItineraryId(null)}>
            Đóng
          </Button>
        }
      >
        {detailQuery.loading && <PageLoader />}
        {detailQuery.data?.itinerary && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 rounded-panel bg-sand-50 p-4 sm:grid-cols-3 text-sm">
              <div>
                <span className="text-xs text-river-500">Người tạo:</span>
                <p className="font-semibold text-river-900">
                  {detailQuery.data.itinerary.user?.displayName ?? 'Ẩn danh'}
                </p>
                <p className="text-xs text-river-500">{detailQuery.data.itinerary.user?.email}</p>
              </div>
              <div>
                <span className="text-xs text-river-500">Thời gian:</span>
                <p className="font-semibold text-river-900">{detailQuery.data.itinerary.numberOfDays} ngày</p>
              </div>
              <div>
                <span className="text-xs text-river-500">Tổng thời gian tham quan:</span>
                <p className="font-semibold text-river-900">
                  {Math.round((detailQuery.data.itinerary.estimatedDurationMinutes ?? 0) / 60)} giờ
                </p>
              </div>
            </div>

            {/* Day by day stops */}
            <div className="space-y-4">
              <h3 className="font-semibold text-river-900 flex items-center gap-2">
                <Route className="size-4 text-leaf-600" /> Lộ trình chi tiết từng ngày
              </h3>

              {detailQuery.data.itinerary.days?.map((day) => (
                <div key={day.dayNumber} className="rounded-panel border border-sand-200 bg-white p-4">
                  <h4 className="font-semibold text-leaf-800 text-sm mb-3 flex items-center gap-2">
                    <Calendar className="size-4" /> Ngày {day.dayNumber} ({day.items.length} điểm đến)
                  </h4>
                  <div className="space-y-2">
                    {day.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-3 rounded-control border border-sand-100 bg-sand-50/50 p-2.5 text-xs text-river-800"
                      >
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-leaf-600 text-[10px] font-bold text-white">
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-river-900">{item.nameSnapshot}</p>
                          {item.destinationId?.address && (
                            <p className="text-river-500 flex items-center gap-1 mt-0.5 truncate">
                              <MapPin className="size-3 text-river-400" /> {item.destinationId.address}
                            </p>
                          )}
                          {item.note && <p className="text-river-600 italic mt-1">Ghi chú: {item.note}</p>}
                        </div>
                        <div className="shrink-0 text-river-500 flex items-center gap-1">
                          <Clock className="size-3" /> {item.durationMinutes} phút
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* Confirm: Xóa lịch trình */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xóa lịch trình du khách"
        message={
          <>
            Bạn có chắc chắn muốn xóa lịch trình <strong>"{deleteTarget?.title}"</strong> của người dùng{' '}
            <strong>{deleteTarget?.user?.displayName ?? 'Ẩn danh'}</strong>? Hành động này không thể hoàn tác.
          </>
        }
        confirmLabel="Xóa lịch trình"
        tone="danger"
        loading={submitting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
