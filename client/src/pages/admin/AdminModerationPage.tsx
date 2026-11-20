import clsx from 'clsx';
import {
  AlertTriangle,
  CheckCircle2,
  EyeOff,
  Flag,
  Image as ImageIcon,
  MapPinned,
  Pencil,
  ShieldAlert,
  Star,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminPageHeader } from '../../components/layout/AdminLayout';
import { Badge } from '../../components/ui/Badge';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Card, StatCard } from '../../components/ui/Card';
import { Textarea } from '../../components/ui/Field';
import { ConfirmDialog, Modal } from '../../components/ui/Modal';
import { EmptyState, ErrorState, PageLoader } from '../../components/ui/States';
import { useApiQuery } from '../../hooks/useApiQuery';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { api, toApiError } from '../../lib/api';
import { areaLabel, categoryLabel } from '../../lib/catalog';
import { formatDate, formatDateTime } from '../../lib/format';
import { toast } from '../../stores/toastStore';
import type { AdminDestination } from '../../types/api';

interface PendingBannerItem {
  id: string;
  kind: 'cover' | 'event' | 'promo';
  theme: 'forest' | 'lotus' | 'cream';
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  linkLabel: string | null;
  sponsorName: string | null;
  approvalStatus: 'pending_review';
  status: 'active' | 'inactive';
  startAt: string | null;
  endAt: string | null;
  createdAt: string | null;
  destination: { id: string; name: string; slug: string; area: string } | null;
}

interface FlaggedReviewItem {
  id: string;
  authorName: string;
  rating: number;
  content: string;
  status: string;
  isFlagged: boolean;
  reportReason: string;
  reportCount: number;
  reportedAt: string | null;
  createdAt: string | null;
  destination: { id: string; name: string; slug: string } | null;
}

interface ModerationSummaryResponse {
  counts: {
    pendingDestinations: number;
    pendingBanners: number;
    flaggedReviews: number;
    activePartnerAlerts: number;
    totalPending: number;
  };
  queues: {
    destinations: AdminDestination[];
    banners: PendingBannerItem[];
    reviews: FlaggedReviewItem[];
  };
}

type ModerationTab = 'destinations' | 'banners' | 'reviews';

export function AdminModerationPage() {
  useDocumentTitle('Trung tâm Kiểm duyệt Sở VHTTDL');
  const [activeTab, setActiveTab] = useState<ModerationTab>('destinations');
  const [busyId, setBusyId] = useState<string | null>(null);

  // Reject / Return modal state
  const [returnDest, setReturnDest] = useState<AdminDestination | null>(null);
  const [returnNote, setReturnNote] = useState('');
  const [rejectBanner, setRejectBanner] = useState<PendingBannerItem | null>(null);
  const [rejectBannerNote, setRejectBannerNote] = useState('');
  const [deleteReview, setDeleteReview] = useState<FlaggedReviewItem | null>(null);

  const query = useApiQuery<ModerationSummaryResponse>(
    (signal) => api.get<ModerationSummaryResponse>('/admin/moderation/summary', { signal }).then((r) => r.data),
    [],
  );

  const counts = query.data?.counts;
  const queues = query.data?.queues;

  const handleReviewDestination = async (
    dest: AdminDestination,
    decision: 'approve' | 'return_draft',
    reviewNote?: string,
  ) => {
    setBusyId(dest.id);
    try {
      const res = await api.patch<{ message?: string }>(`/admin/destinations/${dest.id}/review`, {
        decision,
        reviewNote: reviewNote?.trim() || undefined,
      });
      toast.success(res.data?.message || 'Đã xử lý hồ sơ địa điểm!');
      setReturnDest(null);
      setReturnNote('');
      query.reload();
    } catch (err) {
      toast.error(toApiError(err).message);
    } finally {
      setBusyId(null);
    }
  };

  const handleReviewBanner = async (
    banner: PendingBannerItem,
    decision: 'approve' | 'reject',
    feedback?: string,
  ) => {
    setBusyId(banner.id);
    try {
      const res = await api.patch<{ message?: string }>(`/admin/banners/${banner.id}/review`, {
        decision,
        activateNow: decision === 'approve',
        feedback: feedback?.trim() || undefined,
      });
      toast.success(res.data?.message || 'Đã xét duyệt banner!');
      setRejectBanner(null);
      setRejectBannerNote('');
      query.reload();
    } catch (err) {
      toast.error(toApiError(err).message);
    } finally {
      setBusyId(null);
    }
  };

  const handleModerateReview = async (review: FlaggedReviewItem, status: 'published' | 'hidden') => {
    setBusyId(review.id);
    try {
      await api.patch(`/admin/reviews/${review.id}/status`, { status, isFlagged: false });
      toast.success(
        status === 'published'
          ? 'Đã gỡ cờ báo cáo và giữ hiển thị công khai.'
          : 'Đã ẩn đánh giá vi phạm khỏi trang du khách.',
      );
      query.reload();
    } catch (err) {
      toast.error(toApiError(err).message);
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteReview = async () => {
    if (!deleteReview) return;
    setBusyId(deleteReview.id);
    try {
      await api.delete(`/admin/reviews/${deleteReview.id}`);
      toast.success('Đã xóa vĩnh viễn đánh giá vi phạm.');
      setDeleteReview(null);
      query.reload();
    } catch (err) {
      toast.error(toApiError(err).message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <AdminPageHeader
        title="Trung tâm Hàng đợi Kiểm duyệt (Sở VHTTDL)"
        description="Tập trung toàn bộ hồ sơ địa điểm mới, banner quảng bá mùa vụ của đối tác và đánh giá bị báo cáo vi phạm cần phê duyệt xử lý."
      />

      {/* KPI Summary */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Địa điểm chờ duyệt"
          value={counts?.pendingDestinations ?? '—'}
          hint="Hồ sơ đối tác gửi xuất bản"
          icon={<MapPinned className="size-5 text-leaf-700" />}
        />
        <StatCard
          label="Banner mùa vụ chờ duyệt"
          value={counts?.pendingBanners ?? '—'}
          hint="Kiểm duyệt theo Luật Quảng cáo"
          icon={<ImageIcon className="size-5 text-teal-700" />}
        />
        <StatCard
          label="Đánh giá bị tố cáo"
          value={counts?.flaggedReviews ?? '—'}
          hint="Cần xem xét giữ / ẩn / xóa"
          icon={<Flag className="size-5 text-red-600" />}
        />
        <StatCard
          label="Cảnh báo đối tác đang phát"
          value={counts?.activePartnerAlerts ?? '—'}
          hint="Cảnh báo thực địa đồng bộ 3D Map"
          icon={<ShieldAlert className="size-5 text-lotus-600" />}
        />
      </div>

      {/* Tabs */}
      <div className="mt-7 -mx-1 px-1 overflow-x-auto no-scrollbar border-b border-sand-300">
        <div className="flex items-center gap-2 min-w-max pb-2" role="tablist">
          {(
            [
              {
                id: 'destinations',
                label: 'Địa điểm chờ duyệt',
                count: counts?.pendingDestinations ?? 0,
                icon: <MapPinned className="size-4" />,
              },
              {
                id: 'banners',
                label: 'Banner đối tác chờ duyệt',
                count: counts?.pendingBanners ?? 0,
                icon: <ImageIcon className="size-4" />,
              },
              {
                id: 'reviews',
                label: 'Đánh giá bị tố cáo',
                count: counts?.flaggedReviews ?? 0,
                icon: <Flag className="size-4" />,
              },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={activeTab === t.id}
              onClick={() => setActiveTab(t.id)}
              className={clsx(
                'inline-flex shrink-0 items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-semibold transition-colors',
                activeTab === t.id
                  ? 'border-b-2 border-leaf-600 bg-white text-leaf-800 shadow-xs'
                  : 'text-river-600 hover:text-river-900 hover:bg-sand-100/70',
              )}
            >
              {t.icon}
              <span>{t.label}</span>
              <span
                className={clsx(
                  'rounded-full px-2 py-0.5 text-xs font-bold',
                  t.count > 0 ? 'bg-red-600 text-white' : 'bg-sand-200 text-river-600',
                )}
              >
                {t.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {query.loading && !query.data ? (
        <PageLoader />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={query.reload} />
      ) : (
        <div className="mt-6">
          {/* Tab 1: Pending Destinations */}
          {activeTab === 'destinations' && (
            <div className="space-y-3">
              {!queues?.destinations.length ? (
                <EmptyState
                  icon={<CheckCircle2 className="size-7 text-leaf-600" />}
                  title="Không có địa điểm nào đang chờ duyệt"
                  description="Tất cả hồ sơ địa điểm do đối tác gửi lên đã được xử lý sạch sẽ."
                />
              ) : (
                queues.destinations.map((d) => (
                  <Card key={d.id} className="p-4 sm:p-5 flex flex-col gap-4 lg:flex-row lg:items-center justify-between">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/admin/destinations/${d.id}/edit`}
                          className="font-bold text-base text-river-900 hover:text-leaf-700"
                        >
                          {d.name}
                        </Link>
                        <Badge tone="teal">Chờ duyệt xuất bản</Badge>
                        <Badge tone="neutral">{categoryLabel(d.category)}</Badge>
                        <span className="text-xs text-river-500">📍 {areaLabel(d.area)}</span>
                      </div>
                      <p className="text-xs text-river-600 line-clamp-2">{d.summary || d.description}</p>
                      <p className="text-[11px] text-river-500">
                        Đối tác phụ trách: <strong>{d.managedByName || d.managedByEmail || 'Chưa gán'}</strong> · Cập nhật:{' '}
                        {formatDateTime(d.updatedAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <ButtonLink
                        to={`/admin/destinations/${d.id}/edit`}
                        size="sm"
                        variant="secondary"
                        icon={<Pencil className="size-3.5" />}
                      >
                        Xem hồ sơ
                      </ButtonLink>
                      <Button
                        size="sm"
                        variant="primary"
                        loading={busyId === d.id}
                        onClick={() => handleReviewDestination(d, 'approve')}
                        icon={<CheckCircle2 className="size-4" />}
                      >
                        Duyệt & Xuất bản
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => {
                          setReturnDest(d);
                          setReturnNote('');
                        }}
                        icon={<XCircle className="size-4" />}
                      >
                        Trả về sửa
                      </Button>
                    </div>
                  </Card>
                ))
              )}
            </div>
          )}

          {/* Tab 2: Pending Partner Banners */}
          {activeTab === 'banners' && (
            <div className="space-y-3">
              {!queues?.banners.length ? (
                <EmptyState
                  icon={<CheckCircle2 className="size-7 text-leaf-600" />}
                  title="Không có Banner đối tác nào chờ duyệt"
                  description="Tất cả đề xuất banner quảng bá mùa vụ đã được Sở VHTTDL xử lý."
                />
              ) : (
                queues.banners.map((b) => (
                  <Card key={b.id} className="p-4 sm:p-5 flex flex-col gap-4 lg:flex-row lg:items-center justify-between">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={b.kind === 'promo' ? 'lotus' : 'leaf'}>
                          {b.kind === 'promo' ? 'Quảng cáo' : 'Sự kiện mùa vụ'}
                        </Badge>
                        <Badge tone="teal">Chờ Sở VHTTDL duyệt</Badge>
                        {b.sponsorName && (
                          <span className="text-xs font-semibold text-river-700">Đơn vị: {b.sponsorName}</span>
                        )}
                      </div>
                      <h3 className="font-bold text-base text-river-900">{b.title}</h3>
                      {b.subtitle && <p className="text-xs text-river-600">{b.subtitle}</p>}
                      <p className="text-[11px] text-river-500">
                        Đích điều hướng: <span className="font-mono">{b.linkUrl || '—'}</span> · Lịch:{' '}
                        {b.startAt ? formatDate(b.startAt) : 'Ngay khi duyệt'} →{' '}
                        {b.endAt ? formatDate(b.endAt) : 'Không giới hạn'}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="primary"
                        loading={busyId === b.id}
                        onClick={() => handleReviewBanner(b, 'approve')}
                        icon={<CheckCircle2 className="size-4" />}
                      >
                        Duyệt & Bật ngay
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => {
                          setRejectBanner(b);
                          setRejectBannerNote('');
                        }}
                        icon={<XCircle className="size-4" />}
                      >
                        Từ chối
                      </Button>
                    </div>
                  </Card>
                ))
              )}
            </div>
          )}

          {/* Tab 3: Flagged Reviews */}
          {activeTab === 'reviews' && (
            <div className="space-y-3">
              {!queues?.reviews.length ? (
                <EmptyState
                  icon={<CheckCircle2 className="size-7 text-leaf-600" />}
                  title="Không có đánh giá nào bị tố cáo vi phạm"
                  description="Cộng đồng đánh giá hiện an toàn, chưa có báo cáo chờ kiểm duyệt."
                />
              ) : (
                queues.reviews.map((r) => (
                  <Card key={r.id} className="p-4 sm:p-5 border-red-200 bg-red-50/20 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-sm text-river-900">{r.authorName}</span>
                          <span className="inline-flex items-center gap-0.5 text-amber-500 text-xs font-bold">
                            <Star className="size-3.5 fill-amber-400" /> {r.rating}/5
                          </span>
                          {r.destination && (
                            <Badge tone="neutral">{r.destination.name}</Badge>
                          )}
                          <Badge tone="red">🚩 {r.reportCount} lượt báo cáo</Badge>
                        </div>
                        <p className="text-sm text-river-800 italic">"{r.content}"</p>
                        {r.reportReason && (
                          <p className="text-xs font-semibold text-red-700 flex items-center gap-1">
                            <AlertTriangle className="size-3.5" /> Lý do báo cáo: {r.reportReason}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="primary"
                          loading={busyId === r.id}
                          onClick={() => handleModerateReview(r, 'published')}
                          icon={<CheckCircle2 className="size-3.5" />}
                        >
                          Giữ công khai (Gỡ cờ)
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={busyId === r.id}
                          onClick={() => handleModerateReview(r, 'hidden')}
                          icon={<EyeOff className="size-3.5" />}
                        >
                          Ẩn đánh giá
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => setDeleteReview(r)}
                          icon={<Trash2 className="size-3.5" />}
                        >
                          Xóa
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal: Return Destination with reviewNote */}
      <Modal
        open={Boolean(returnDest)}
        size="sm"
        title="Trả hồ sơ Địa điểm về Bản nháp"
        onClose={() => setReturnDest(null)}
      >
        {returnDest && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleReviewDestination(returnDest, 'return_draft', returnNote);
            }}
            className="space-y-4"
          >
            <p className="text-sm text-river-700">
              Nhập ghi chú yêu cầu chỉnh sửa cho <strong>{returnDest.name}</strong> (tối thiểu 5 ký tự) để đối tác KDL bổ sung chính xác:
            </p>
            <Textarea
              rows={3}
              value={returnNote}
              onChange={(e) => setReturnNote(e.target.value)}
              placeholder="VD: Vui lòng bổ sung tọa độ GPS chuẩn, ảnh thực tế rõ nét và nguồn xác minh giá vé..."
              required
            />
            <div className="flex justify-end gap-2 pt-2 border-t border-sand-200">
              <Button type="button" variant="secondary" onClick={() => setReturnDest(null)}>
                Hủy
              </Button>
              <Button type="submit" variant="danger" loading={busyId === returnDest.id}>
                Xác nhận trả về sửa
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal: Reject Banner */}
      <Modal
        open={Boolean(rejectBanner)}
        size="sm"
        title="Từ chối Banner Đối tác"
        onClose={() => setRejectBanner(null)}
      >
        {rejectBanner && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleReviewBanner(rejectBanner, 'reject', rejectBannerNote);
            }}
            className="space-y-4"
          >
            <p className="text-sm text-river-700">
              Ghi rõ lý do từ chối banner <strong>{rejectBanner.title}</strong> để đối tác điều chỉnh theo Luật Quảng cáo:
            </p>
            <Textarea
              rows={3}
              value={rejectBannerNote}
              onChange={(e) => setRejectBannerNote(e.target.value)}
              placeholder="VD: Tiêu đề quảng bá chưa khớp giá vé niêm yết hoặc thiếu ảnh rõ nét..."
              required
            />
            <div className="flex justify-end gap-2 pt-2 border-t border-sand-200">
              <Button type="button" variant="secondary" onClick={() => setRejectBanner(null)}>
                Hủy
              </Button>
              <Button type="submit" variant="danger" loading={busyId === rejectBanner.id}>
                Xác nhận từ chối
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteReview)}
        title="Xóa vĩnh viễn đánh giá vi phạm?"
        message={
          <p>
            Bạn chắc chắn muốn xóa vĩnh viễn đánh giá của <strong>{deleteReview?.authorName}</strong>? Hành động này sẽ được ghi vào Nhật ký kiểm toán.
          </p>
        }
        confirmLabel="Xóa vĩnh viễn"
        tone="danger"
        loading={Boolean(deleteReview && busyId === deleteReview.id)}
        onConfirm={handleDeleteReview}
        onCancel={() => setDeleteReview(null)}
      />
    </>
  );
}
