import clsx from 'clsx';
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Eye,
  EyeOff,
  Filter,
  Flag,
  MapPin,
  MessageSquare,
  MessageSquareQuote,
  PenLine,
  Search,
  Send,
  Star,
  Trash2,
  X,
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
import { api } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { useAuthStore } from '../../stores/authStore';
import { toast } from '../../stores/toastStore';
import type { AdminReviewItem, AdminReviewsResponse } from '../../types/api';

export function AdminReviewsPage() {
  useDocumentTitle('Quản lý Đánh giá & Phản hồi du khách');
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role === 'admin';
  const isPartner = currentUser?.role === 'partner';

  // Filters
  const [search, setSearch] = useState('');
  const [selectedDestination, setSelectedDestination] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'flagged' | 'published' | 'hidden'>('all');
  const [selectedRating, setSelectedRating] = useState<string>('all');
  const [page, setPage] = useState(1);

  // Modals state
  const [respondModalReview, setRespondModalReview] = useState<AdminReviewItem | null>(null);
  const [responseText, setResponseText] = useState('');
  const [responderName, setResponderName] = useState('');
  const [isSubmittingResponse, setIsSubmittingResponse] = useState(false);

  const [reportModalReview, setReportModalReview] = useState<AdminReviewItem | null>(null);
  const [reportReasonText, setReportReasonText] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  const [deleteModalReview, setDeleteModalReview] = useState<AdminReviewItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch data
  const query = useApiQuery<AdminReviewsResponse>(
    (signal) =>
      api
        .get<AdminReviewsResponse>('/admin/reviews', {
          params: {
            page,
            limit: 15,
            destinationId: selectedDestination !== 'all' ? selectedDestination : undefined,
            status: selectedStatus,
            rating: selectedRating !== 'all' ? Number(selectedRating) : undefined,
            q: search || undefined,
          },
          signal,
        })
        .then((r) => r.data),
    [page, selectedDestination, selectedStatus, selectedRating, search],
  );

  const stats = query.data?.stats;
  const managedDestinations = query.data?.managedDestinations || [];

  // Handlers
  const handleOpenRespond = (review: AdminReviewItem) => {
    setRespondModalReview(review);
    setResponseText(review.response?.content || '');
    setResponderName(
      review.response?.responderName ||
        (review.destination ? `Ban Quản lý ${review.destination.name}` : 'Ban Quản trị Đồng Tháp Smart Travel'),
    );
  };

  const handleSubmitResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!respondModalReview) return;
    if (!responseText.trim()) {
      toast.error('Vui lòng nhập nội dung phản hồi.');
      return;
    }

    setIsSubmittingResponse(true);
    try {
      await api.post(`/admin/reviews/${respondModalReview.id}/respond`, {
        content: responseText.trim(),
        responderName: responderName.trim() || undefined,
      });
      toast.success('Đã gửi phản hồi chính thức thành công!');
      setRespondModalReview(null);
      query.reload();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Không thể gửi phản hồi.');
    } finally {
      setIsSubmittingResponse(false);
    }
  };

  const handleDeleteResponse = async (reviewId: string) => {
    if (!window.confirm('Bạn có chắc muốn xóa phản hồi này không?')) return;
    try {
      await api.delete(`/admin/reviews/${reviewId}/respond`);
      toast.success('Đã xóa phản hồi.');
      query.reload();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Không thể xóa phản hồi.');
    }
  };

  const handleUpdateStatus = async (reviewId: string, status: 'published' | 'hidden', isFlagged?: boolean) => {
    try {
      await api.patch(`/admin/reviews/${reviewId}/status`, { status, isFlagged });
      toast.success(
        status === 'published'
          ? 'Đã duyệt đánh giá hợp lệ và gỡ cảnh báo.'
          : 'Đã ẩn đánh giá khỏi trang du khách.',
      );
      query.reload();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Không thể cập nhật trạng thái.');
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportModalReview) return;
    if (!reportReasonText.trim()) {
      toast.error('Vui lòng nhập lý do báo cáo vi phạm.');
      return;
    }

    setIsSubmittingReport(true);
    try {
      await api.post(`/reviews/${reportModalReview.id}/report`, {
        reason: reportReasonText.trim(),
      });
      toast.success('Đã gửi báo cáo vi phạm tới Ban Quản trị hệ thống.');
      setReportModalReview(null);
      setReportReasonText('');
      query.reload();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Không thể gửi báo cáo.');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const handleDeleteReview = async () => {
    if (!deleteModalReview) return;
    setIsDeleting(true);
    try {
      await api.delete(`/admin/reviews/${deleteModalReview.id}`);
      toast.success('Đã xóa vĩnh viễn đánh giá.');
      setDeleteModalReview(null);
      query.reload();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Không thể xóa đánh giá.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <AdminPageHeader
        title="Quản lý Đánh giá & Phản hồi du khách"
        description={
          isAdmin
            ? 'Kiểm duyệt đánh giá từ cộng đồng du khách trên toàn tỉnh Đồng Tháp, xử lý báo cáo tố cáo vi phạm, quản lý ẩn/hiện và xóa nội dung không phù hợp.'
            : 'Xem toàn bộ đánh giá của du khách đối với điểm đến do bạn quản lý, gửi phản hồi chính thức từ Ban Quản lý và khiếu nại các đánh giá vi phạm.'
        }
      />

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Tổng lượt đánh giá"
          value={stats?.total ?? '—'}
          icon={<MessageSquare className="size-5 text-leaf-600" />}
        />
        <StatCard
          label="Bị tố cáo / Cần duyệt"
          value={stats?.pendingReports ?? '—'}
          hint={stats && stats.pendingReports > 0 ? '⚠️ Cần kiểm tra ngay' : 'Bình thường'}
          icon={<AlertTriangle className={clsx('size-5', (stats?.pendingReports ?? 0) > 0 ? 'text-red-500 animate-pulse' : 'text-river-400')} />}
        />
        <StatCard
          label="Đã có phản hồi BQL"
          value={stats?.responded ?? '—'}
          icon={<MessageSquareQuote className="size-5 text-teal-600" />}
        />
        <StatCard
          label="Đang bị ẩn"
          value={stats?.hidden ?? '—'}
          icon={<EyeOff className="size-5 text-river-500" />}
        />
        <StatCard
          label="Điểm trung bình"
          value={stats ? `${stats.averageRating.toFixed(1)} / 5.0` : '—'}
          icon={<Star className="size-5 fill-amber-400 text-amber-500" />}
        />
      </div>

      {/* Filter and Search Bar */}
      <Card className="mt-6 p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-river-400" />
            <Input
              type="text"
              placeholder="Tìm theo tác giả, nội dung, lý do..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>

          <Select
            value={selectedDestination}
            onChange={(e) => {
              setSelectedDestination(e.target.value);
              setPage(1);
            }}
            aria-label="Chọn điểm đến"
          >
            <option value="all">
              {isAdmin ? 'Tất cả điểm đến (Toàn tỉnh)' : 'Tất cả điểm bạn quản lý'}
            </option>
            {managedDestinations.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>

          <Select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value as 'all' | 'flagged' | 'published' | 'hidden');
              setPage(1);
            }}
            aria-label="Lọc theo trạng thái"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="flagged">🚩 Bị tố cáo / Cần duyệt ({stats?.pendingReports || 0})</option>
            <option value="published">✓ Đang hiển thị công khai</option>
            <option value="hidden">👁️ Đang ẩn</option>
          </Select>

          <Select
            value={selectedRating}
            onChange={(e) => {
              setSelectedRating(e.target.value);
              setPage(1);
            }}
            aria-label="Lọc theo số sao"
          >
            <option value="all">Tất cả mức sao</option>
            <option value="5">5 sao ⭐⭐⭐⭐⭐</option>
            <option value="4">4 sao ⭐⭐⭐⭐</option>
            <option value="3">3 sao ⭐⭐⭐</option>
            <option value="2">2 sao ⭐⭐</option>
            <option value="1">1 sao ⭐</option>
          </Select>
        </div>

        {/* Status Tabs Navigation */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-sand-200 pt-3">
          <span className="text-xs font-semibold text-river-500 uppercase tracking-wide mr-1 flex items-center gap-1">
            <Filter className="size-3" /> Tab nhanh:
          </span>
          <button
            type="button"
            onClick={() => {
              setSelectedStatus('all');
              setPage(1);
            }}
            className={clsx(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              selectedStatus === 'all' ? 'bg-river-800 text-white' : 'bg-sand-100 text-river-700 hover:bg-sand-200',
            )}
          >
            Tất cả ({stats?.total || 0})
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedStatus('flagged');
              setPage(1);
            }}
            className={clsx(
              'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors border',
              selectedStatus === 'flagged'
                ? 'bg-red-600 text-white border-red-600 shadow-sm'
                : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100',
            )}
          >
            <Flag className="size-3" />
            Cần duyệt / Bị tố cáo ({stats?.pendingReports || 0})
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedStatus('published');
              setPage(1);
            }}
            className={clsx(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              selectedStatus === 'published' ? 'bg-leaf-700 text-white' : 'bg-sand-100 text-river-700 hover:bg-sand-200',
            )}
          >
            Công khai
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedStatus('hidden');
              setPage(1);
            }}
            className={clsx(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              selectedStatus === 'hidden' ? 'bg-river-700 text-white' : 'bg-sand-100 text-river-700 hover:bg-sand-200',
            )}
          >
            Đang ẩn ({stats?.hidden || 0})
          </button>
        </div>
      </Card>

      {/* Review List Feed */}
      <div className="mt-6 space-y-4">
        {query.loading ? (
          <PageLoader />
        ) : query.error ? (
          <ErrorState error={query.error} onRetry={query.reload} />
        ) : query.data?.items.length === 0 ? (
          <EmptyState
            title="Không tìm thấy đánh giá nào"
            description="Không có đánh giá nào phù hợp với các tiêu chí tìm kiếm hoặc bộ lọc hiện tại."
          />
        ) : (
          query.data?.items.map((review) => (
            <Card
              key={review.id}
              className={clsx(
                'p-5 transition-all',
                review.isFlagged
                  ? 'border-2 border-red-300 bg-red-50/20'
                  : review.status === 'hidden'
                    ? 'border-sand-300 bg-sand-50/50 opacity-80'
                    : 'border-sand-200 bg-white',
              )}
            >
              {/* Header: Destination & Status badging */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sand-200 pb-3">
                <div className="flex flex-wrap items-center gap-2">
                  {review.destination ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-leaf-50 px-3 py-1 text-xs font-bold text-leaf-800 ring-1 ring-leaf-200">
                      <MapPin className="size-3.5 text-leaf-600" />
                      {review.destination.name}
                    </span>
                  ) : (
                    <span className="text-xs text-river-500 italic">Điểm đến không xác định</span>
                  )}

                  {review.isFlagged && (
                    <Badge tone="red">
                      🚩 BỊ TỐ CÁO ({review.reportCount} lượt)
                    </Badge>
                  )}
                  {review.status === 'hidden' && (
                    <Badge tone="neutral">👁️ Đang ẩn</Badge>
                  )}
                  {review.status === 'published' && !review.isFlagged && (
                    <Badge tone="leaf">✓ Công khai</Badge>
                  )}
                </div>

                <span className="text-xs text-river-500">
                  Đăng lúc: {formatDateTime(review.createdAt)}
                </span>
              </div>

              {/* Author and Rating details */}
              <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-leaf-600 to-teal-500 font-bold text-white shadow-xs text-xs">
                    {review.authorName.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h4 className="font-bold text-river-900">{review.authorName}</h4>
                      {review.authorTier && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-sand-100 px-2 py-0.5 text-[11px] font-medium text-river-700">
                          <Award className="size-3 text-amber-500" />
                          {review.authorTier}
                        </span>
                      )}
                      {review.isVerifiedVisitor && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                          <CheckCircle2 className="size-3 text-emerald-600" />
                          Đã đến thực địa
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={clsx(
                            'size-3.5',
                            star <= review.rating ? 'fill-amber-400 text-amber-500' : 'fill-sand-200 text-sand-300',
                          )}
                        />
                      ))}
                      <span className="ml-1 text-xs font-semibold text-river-700">
                        {review.rating}/5 sao
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-right text-xs text-river-500">
                  <span>{review.likesCount} lượt hữu ích</span>
                </div>
              </div>

              {/* Content and Tags */}
              <div className="mt-3">
                {review.tags && review.tags.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {review.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-sand-100 px-2.5 py-0.5 text-[11px] font-medium text-river-700"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                <p className="whitespace-pre-line text-sm leading-relaxed text-river-800 bg-sand-50/50 p-3 rounded-lg border border-sand-200/70">
                  {review.content}
                </p>
              </div>

              {/* Reported alert banner if flagged */}
              {review.isFlagged && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle className="size-4 text-red-600" />
                    Báo cáo vi phạm từ người dùng / đối tác:
                  </div>
                  <p className="mt-1 text-sm font-medium text-red-900">
                    "{review.reportReason || 'Nội dung có dấu hiệu vi phạm tiêu chuẩn cộng đồng hoặc sai sự thật.'}"
                  </p>
                  {review.reportedAt && (
                    <p className="mt-1 text-[11px] text-red-600">
                      Thời điểm báo cáo: {formatDateTime(review.reportedAt)}
                    </p>
                  )}
                </div>
              )}

              {/* Official Management Response Card */}
              {review.response && (
                <div className="mt-3 rounded-lg border-l-4 border-l-teal-600 border border-sand-200 bg-teal-50/40 p-3 sm:p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-teal-900">
                      🌸 Phản hồi từ: {review.response.responderName}
                    </span>
                    <span className="text-[11px] text-river-500">
                      {formatDateTime(review.response.respondedAt)}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm text-river-800 italic">
                    "{review.response.content}"
                  </p>
                </div>
              )}

              {/* Action Toolbar */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-sand-200 pt-3">
                <div className="flex flex-wrap items-center gap-2">
                  {/* Respond button (Partner & Admin) */}
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => handleOpenRespond(review)}
                    icon={<PenLine className="size-3.5" />}
                  >
                    {review.response ? 'Sửa phản hồi BQL' : '🌸 Trả lời nhận xét'}
                  </Button>

                  {/* Remove response button */}
                  {review.response && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleDeleteResponse(review.id)}
                      icon={<X className="size-3.5" />}
                    >
                      Xóa phản hồi
                    </Button>
                  )}

                  {/* Partner flag action */}
                  {isPartner && !review.isFlagged && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setReportModalReview(review);
                        setReportReasonText('');
                      }}
                      icon={<Flag className="size-3.5 text-red-600" />}
                    >
                      Báo cáo tới Admin
                    </Button>
                  )}
                </div>

                {/* Admin moderation buttons */}
                {isAdmin && (
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Approve / Unflag button */}
                    {review.isFlagged && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleUpdateStatus(review.id, 'published', false)}
                        icon={<CheckCircle2 className="size-3.5 text-leaf-600" />}
                      >
                        Duyệt hợp lệ (Gỡ cờ)
                      </Button>
                    )}

                    {/* Hide / Unhide button */}
                    {review.status === 'published' ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleUpdateStatus(review.id, 'hidden')}
                        icon={<EyeOff className="size-3.5 text-river-600" />}
                      >
                        Ẩn đánh giá
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleUpdateStatus(review.id, 'published', false)}
                        icon={<Eye className="size-3.5 text-leaf-600" />}
                      >
                        Hiện công khai
                      </Button>
                    )}

                    {/* Delete permanently */}
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setDeleteModalReview(review)}
                      icon={<Trash2 className="size-3.5 text-red-600" />}
                    >
                      Xóa
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Pagination */}
      {query.data && query.data.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between border-t border-sand-200 pt-4">
          <p className="text-sm text-river-600">
            Trang {query.data.page} / {query.data.totalPages} ({query.data.total} đánh giá)
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Trang trước
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={page >= query.data.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Trang sau
            </Button>
          </div>
        </div>
      )}

      {/* Modal: Trả lời nhận xét (Partner & Admin) */}
      <Modal
        open={Boolean(respondModalReview)}
        title={
          respondModalReview?.response
            ? 'Chỉnh sửa phản hồi chính thức'
            : 'Gửi phản hồi chính thức từ Ban Quản lý'
        }
        onClose={() => setRespondModalReview(null)}
      >
        {respondModalReview && (
          <form onSubmit={handleSubmitResponse} className="p-5 space-y-4">
            <div className="rounded-lg bg-sand-50 p-3 text-xs text-river-700 space-y-1">
              <p>
                <strong>Điểm đến:</strong> {respondModalReview.destination?.name}
              </p>
              <p>
                <strong>Du khách:</strong> {respondModalReview.authorName} (
                {respondModalReview.rating}/5 sao)
              </p>
              <p className="italic text-river-600 line-clamp-2">"{respondModalReview.content}"</p>
            </div>

            <div>
              <label htmlFor="responder-name" className="block text-xs font-semibold uppercase tracking-wider text-river-600">
                Tên đại diện phản hồi *
              </label>
              <Input
                id="responder-name"
                type="text"
                value={responderName}
                onChange={(e) => setResponderName(e.target.value)}
                placeholder="Ví dụ: Ban Quản lý Khu Di Tích Xẻo Quýt"
                className="mt-1"
                required
              />
            </div>

            <div>
              <label htmlFor="response-content" className="block text-xs font-semibold uppercase tracking-wider text-river-600">
                Nội dung phản hồi chính thức *
              </label>
              <textarea
                id="response-content"
                rows={5}
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                placeholder="Cảm ơn quý khách đã ghé thăm và gửi những đóng góp quý báu. Ban Quản lý chúng tôi luôn nỗ lực hoàn thiện để..."
                className="mt-1 block w-full rounded-control border border-sand-200 bg-white p-3 text-sm text-river-800 placeholder:text-river-400 focus:border-leaf-600 focus:outline-none focus:ring-1 focus:ring-leaf-600 leading-relaxed"
                required
              />
              <p className="mt-1 text-xs text-river-500">
                Phản hồi này sẽ được hiển thị công khai ngay bên dưới nhận xét của du khách.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-sand-200">
              <Button type="button" variant="secondary" onClick={() => setRespondModalReview(null)}>
                Hủy
              </Button>
              <Button type="submit" variant="primary" loading={isSubmittingResponse} icon={<Send className="size-4" />}>
                Gửi phản hồi
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal: Partner báo cáo vi phạm tới Admin */}
      <Modal
        open={Boolean(reportModalReview)}
        title="Báo cáo đánh giá vi phạm tới Ban Quản trị"
        onClose={() => setReportModalReview(null)}
      >
        {reportModalReview && (
          <form onSubmit={handleSubmitReport} className="p-5 space-y-4">
            <p className="text-sm text-river-700">
              Nếu nhận xét này chứa thông tin sai sự thật, xúc phạm, thô tục hoặc có dấu hiệu phá hoại hình ảnh điểm đến, bạn có thể gửi yêu cầu tố cáo để Quản trị viên hệ thống can thiệp và gỡ bỏ.
            </p>

            <div className="rounded-lg bg-sand-50 p-3 text-xs text-river-700 space-y-1">
              <p>
                <strong>Tác giả:</strong> {reportModalReview.authorName}
              </p>
              <p className="italic text-river-600">"{reportModalReview.content}"</p>
            </div>

            <div>
              <label htmlFor="report-reason" className="block text-xs font-semibold uppercase tracking-wider text-river-600">
                Lý do báo cáo vi phạm *
              </label>
              <textarea
                id="report-reason"
                rows={4}
                value={reportReasonText}
                onChange={(e) => setReportReasonText(e.target.value)}
                placeholder="Ví dụ: Đánh giá này chứa ngôn từ xúc phạm nhân viên, thông tin sai sự thật về giá vé niêm yết..."
                className="mt-1 block w-full rounded-control border border-sand-200 bg-white p-3 text-sm text-river-800 placeholder:text-river-400 focus:border-leaf-600 focus:outline-none focus:ring-1 focus:ring-leaf-600 leading-relaxed"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-sand-200">
              <Button type="button" variant="secondary" onClick={() => setReportModalReview(null)}>
                Hủy
              </Button>
              <Button type="submit" variant="primary" loading={isSubmittingReport} icon={<Flag className="size-4" />}>
                Gửi báo cáo
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal: Xác nhận xóa vĩnh viễn (Admin) */}
      <Modal
        open={Boolean(deleteModalReview)}
        title="Xác nhận xóa vĩnh viễn đánh giá"
        onClose={() => setDeleteModalReview(null)}
      >
        <div className="p-5 space-y-4">
          <p className="text-sm text-river-700">
            Hành động này sẽ <strong>xóa hoàn toàn</strong> đánh giá của{' '}
            <strong>{deleteModalReview?.authorName}</strong> khỏi hệ thống cơ sở dữ liệu và không thể khôi phục.
          </p>
          <div className="flex justify-end gap-2 pt-2 border-t border-sand-200">
            <Button variant="secondary" onClick={() => setDeleteModalReview(null)}>
              Hủy
            </Button>
            <Button variant="danger" loading={isDeleting} onClick={handleDeleteReview} icon={<Trash2 className="size-4" />}>
              Xóa vĩnh viễn
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
