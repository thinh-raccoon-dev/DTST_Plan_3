import clsx from 'clsx';
import {
  Award,
  CheckCircle2,
  Filter,
  Flag,
  MessageSquare,
  PenLine,
  Send,
  Sparkles,
  Star,
  ThumbsUp,
  User,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useApiQuery } from '../../hooks/useApiQuery';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { useAuthStore } from '../../stores/authStore';
import { toast } from '../../stores/toastStore';
import type { DestinationReviewItem, DestinationReviewsResponse } from '../../types/api';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Modal } from '../ui/Modal';

interface DestinationReviewsProps {
  destinationId: string;
  destinationSlug: string;
  destinationName: string;
}

const SUGGESTED_TAGS = [
  '🏛️ Kiến trúc cổ kính',
  '📜 Hiện vật phong phú',
  '🌿 Không gian xanh mát',
  '📸 Chụp ảnh đẹp',
  '👨‍👩‍👧‍👦 Phù hợp gia đình',
  '💰 Giá vé hợp lý',
  '🧭 Dễ tìm đường',
  '🌸 Thân thiện hiếu khách',
  '🚲 Thuận tiện tham quan',
  '🍜 Nhiều món ngon gần đó',
];

const RATING_LABELS: Record<number, string> = {
  1: '😞 1 sao — Rất không hài lòng',
  2: '🙁 2 sao — Chưa ưng ý',
  3: '😐 3 sao — Bình thường, tạm ổn',
  4: '😊 4 sao — Rất tốt, trải nghiệm thú vị',
  5: '🌟 5 sao — Tuyệt vời, rất đáng trải nghiệm!',
};

function formatRelativeTime(dateString: string): string {
  try {
    const diffMs = Date.now() - new Date(dateString).getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours < 1) return 'Vừa xong';
    if (diffHours < 24) return `${diffHours} giờ trước`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays} ngày trước`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} tuần trước`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} tháng trước`;
    return formatDate(dateString);
  } catch {
    return formatDate(dateString);
  }
}

export function DestinationReviews({ destinationSlug, destinationName }: DestinationReviewsProps) {
  const currentUser = useAuthStore((s) => s.user);

  // Filters and sorting
  const [selectedRatingFilter, setSelectedRatingFilter] = useState<number | 'all'>('all');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'recent' | 'highest' | 'helpful'>('recent');

  // Form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formRating, setFormRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [formAuthorName, setFormAuthorName] = useState(currentUser?.displayName || '');
  const [formContent, setFormContent] = useState('');
  const [formTags, setFormTags] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Local likes tracker for instantaneous feedback
  const [likedReviews, setLikedReviews] = useState<Record<string, number>>({});

  // Report modal state
  const [reportingReview, setReportingReview] = useState<DestinationReviewItem | null>(null);
  const [reportReason, setReportReason] = useState('Nội dung xúc phạm, sai sự thật hoặc dùng từ ngữ thô tục');
  const [customReportReason, setCustomReportReason] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  // Query reviews from API
  const { data, loading, reload } = useApiQuery<DestinationReviewsResponse>(
    (signal) =>
      api
        .get<DestinationReviewsResponse>(`/destinations/${destinationSlug}/reviews`, {
          params: {
            rating: selectedRatingFilter === 'all' ? undefined : selectedRatingFilter,
            sort: sortBy,
            limit: 50,
          },
          signal,
        })
        .then((r) => r.data),
    [destinationSlug, selectedRatingFilter, sortBy],
  );

  const stats = data?.stats || {
    averageRating: 5.0,
    totalReviews: 0,
    distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    popularTags: [],
  };

  // Filter items locally by tag or verified status if active
  const filteredItems = (data?.items || []).filter((item) => {
    if (selectedTagFilter && !item.tags.includes(selectedTagFilter)) return false;
    if (verifiedOnly && !item.isVerifiedVisitor) return false;
    return true;
  });

  const toggleTagInForm = (tag: string) => {
    setFormTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const handleLike = async (reviewId: string, currentLikes: number) => {
    if (likedReviews[reviewId] !== undefined) {
      toast.info('Bạn đã bày tỏ sự hữu ích cho nhận xét này.');
      return;
    }
    // Optimistic UI update
    setLikedReviews((prev) => ({ ...prev, [reviewId]: currentLikes + 1 }));

    try {
      const res = await api.post<{ success: boolean; likesCount: number }>(`/reviews/${reviewId}/like`);
      setLikedReviews((prev) => ({ ...prev, [reviewId]: res.data.likesCount }));
      toast.success('Cảm ơn bạn đã phản hồi hữu ích!');
    } catch {
      // Revert if error
      setLikedReviews((prev) => {
        const copy = { ...prev };
        delete copy[reviewId];
        return copy;
      });
      toast.error('Không thể cập nhật lượt thích vào lúc này.');
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formContent.trim()) {
      toast.error('Vui lòng nhập nội dung đánh giá của bạn.');
      return;
    }
    if (formContent.trim().length < 5) {
      toast.error('Nội dung đánh giá cần ít nhất 5 ký tự.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post(`/destinations/${destinationSlug}/reviews`, {
        rating: formRating,
        content: formContent.trim(),
        tags: formTags,
        authorName: formAuthorName.trim() || undefined,
      });

      toast.success('Gửi đánh giá thành công!', 'Nhận xét của bạn đã được xuất bản và chia sẻ cùng cộng đồng du khách.');
      setFormContent('');
      setFormTags([]);
      setIsFormOpen(false);
      reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể gửi đánh giá vào lúc này.';
      toast.error('Lỗi gửi đánh giá', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportingReview) return;
    const finalReason = reportReason === 'Khác' ? customReportReason.trim() : reportReason;
    if (!finalReason) {
      toast.error('Vui lòng nhập lý do báo cáo.');
      return;
    }
    setIsSubmittingReport(true);
    try {
      await api.post(`/reviews/${reportingReview.id}/report`, { reason: finalReason });
      toast.success('Đã gửi báo cáo vi phạm!', 'Ban Quản trị hệ thống sẽ sớm duyệt lại đánh giá này.');
      setReportingReview(null);
      setCustomReportReason('');
    } catch {
      toast.error('Không thể gửi báo cáo vào lúc này.');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const activeStar = hoverRating || formRating;

  return (
    <Card className="overflow-hidden border-leaf-200/80 p-5 sm:p-6 shadow-sm">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sand-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-leaf-50 text-leaf-700 ring-1 ring-leaf-200/70">
              <Star className="size-5 fill-amber-400 text-amber-500" aria-hidden />
            </span>
            <h2 className="text-xl font-bold tracking-tight text-river-900">Đánh giá & Nhận xét du khách</h2>
          </div>
          <p className="mt-1 text-xs text-river-600 sm:text-sm">
            Hệ thống đánh giá trải nghiệm thực tế theo phong cách cộng đồng tại {destinationName}
          </p>
        </div>

        <Button
          variant={isFormOpen ? 'secondary' : 'primary'}
          size="sm"
          onClick={() => {
            setIsFormOpen((v) => !v);
            if (!isFormOpen && currentUser && !formAuthorName) {
              setFormAuthorName(currentUser.displayName);
            }
          }}
          icon={isFormOpen ? <X className="size-4" /> : <PenLine className="size-4" />}
        >
          {isFormOpen ? 'Đóng form' : 'Viết đánh giá'}
        </Button>
      </div>

      {/* Google Maps Style Rating Overview */}
      <div className="mt-5 grid gap-6 rounded-card border border-sand-200 bg-gradient-to-br from-white via-sand-50/60 to-leaf-50/20 p-5 sm:grid-cols-[1.1fr_1.9fr] sm:items-center">
        {/* Left: Score & Stars */}
        <div className="flex flex-col items-center justify-center text-center sm:border-r sm:border-sand-200 sm:pr-6">
          <div className="text-5xl font-black tracking-tight text-river-900">
            {stats.totalReviews > 0 ? stats.averageRating.toFixed(1) : '5.0'}
          </div>
          <div className="mt-2 flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={clsx(
                  'size-5',
                  star <= Math.round(stats.averageRating)
                    ? 'fill-amber-400 text-amber-500 drop-shadow-sm'
                    : 'fill-sand-200 text-sand-300',
                )}
                aria-hidden
              />
            ))}
          </div>
          <p className="mt-2 text-xs font-medium text-river-600">
            Dựa trên <strong className="text-river-900">{stats.totalReviews}</strong> lượt đánh giá
          </p>
          <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-leaf-50 px-3 py-1 text-xs font-semibold text-leaf-700 ring-1 ring-leaf-200">
            <Sparkles className="size-3.5 text-leaf-600" />
            {stats.averageRating >= 4.5 ? 'Điểm đến xuất sắc' : 'Rất đáng trải nghiệm'}
          </div>
        </div>

        {/* Right: Distribution Bars (5 to 1 star) */}
        <div className="space-y-2">
          {[5, 4, 3, 2, 1].map((rating) => {
            const count = stats.distribution[rating] || 0;
            const percentage = stats.totalReviews > 0 ? Math.round((count / stats.totalReviews) * 100) : 0;
            const isSelected = selectedRatingFilter === rating;

            return (
              <button
                type="button"
                key={rating}
                onClick={() => setSelectedRatingFilter((prev) => (prev === rating ? 'all' : rating))}
                className={clsx(
                  'group flex w-full items-center gap-2.5 rounded-lg px-2 py-1 text-left text-xs transition-colors hover:bg-sand-100/70',
                  isSelected && 'bg-amber-50 ring-1 ring-amber-300 font-medium',
                )}
                title={`Lọc theo đánh giá ${rating} sao`}
              >
                <span className="flex w-10 shrink-0 items-center gap-1 font-semibold text-river-800">
                  {rating} <Star className="size-3 fill-amber-400 text-amber-500" />
                </span>
                <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-sand-200/80">
                  <div
                    className={clsx(
                      'h-full rounded-full transition-all duration-500',
                      rating >= 4 ? 'bg-amber-400 group-hover:bg-amber-500' : 'bg-river-400 group-hover:bg-river-500',
                    )}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className="w-14 text-right text-river-500 group-hover:text-river-800">
                  {percentage}% ({count})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Popular Tag Filters */}
      {stats.popularTags.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-river-500 flex items-center gap-1 mr-1">
            <Filter className="size-3" /> Đặc điểm nổi bật:
          </span>
          {stats.popularTags.map((tag) => {
            const isSelected = selectedTagFilter === tag;
            return (
              <button
                key={tag}
                type="button"
                onClick={() => setSelectedTagFilter((curr) => (curr === tag ? null : tag))}
                className={clsx(
                  'rounded-full px-2.5 py-1 text-xs font-medium transition-all',
                  isSelected
                    ? 'bg-leaf-700 text-white shadow-sm'
                    : 'bg-sand-100 text-river-700 hover:bg-sand-200 border border-sand-200',
                )}
              >
                {tag} {isSelected && '✕'}
              </button>
            );
          })}
        </div>
      )}

      {/* Review Submission Form Drawer */}
      {isFormOpen && (
        <form
          onSubmit={handleSubmitReview}
          className="mt-6 space-y-4 rounded-card border-2 border-dashed border-leaf-300 bg-leaf-50/30 p-5 transition-all animate-in fade-in slide-in-from-top-4 duration-300"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-river-900 flex items-center gap-2">
              <PenLine className="size-4 text-leaf-600" />
              Gửi nhận xét và cảm nhận của bạn
            </h3>
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="text-xs text-river-500 hover:text-river-800"
            >
              Hủy bỏ
            </button>
          </div>

          {/* Interactive Star Picker */}
          <div className="rounded-card border border-sand-200 bg-white p-4">
            <label className="block text-xs font-semibold uppercase tracking-wider text-river-600">
              Đánh giá chất lượng điểm đến *
            </label>
            <div className="mt-2.5 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setFormRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(null)}
                    className="p-1 transition-transform hover:scale-125 focus:outline-none"
                    aria-label={`${star} sao`}
                  >
                    <Star
                      className={clsx(
                        'size-7 transition-colors',
                        star <= activeStar
                          ? 'fill-amber-400 text-amber-500 drop-shadow-sm'
                          : 'fill-sand-200 text-sand-300',
                      )}
                    />
                  </button>
                ))}
              </div>
              <span className="text-sm font-medium text-river-800 bg-sand-100 px-3 py-1 rounded-full">
                {RATING_LABELS[activeStar]}
              </span>
            </div>
          </div>

          {/* User info */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="review-author" className="block text-xs font-semibold uppercase tracking-wider text-river-600">
                Tên hiển thị của bạn
              </label>
              <input
                id="review-author"
                type="text"
                value={formAuthorName}
                onChange={(e) => setFormAuthorName(e.target.value)}
                placeholder="Ví dụ: Du khách Minh An"
                className="mt-1 block w-full rounded-control border border-sand-200 bg-white px-3.5 py-2 text-sm text-river-800 placeholder:text-river-400 focus:border-leaf-600 focus:outline-none focus:ring-1 focus:ring-leaf-600"
              />
            </div>
            <div className="flex flex-col justify-end">
              {currentUser ? (
                <div className="flex items-center gap-2 rounded-control border border-sand-200 bg-sand-50/70 p-2 text-xs text-river-600">
                  <User className="size-4 text-leaf-600" />
                  <span>
                    Đang đăng nhập dưới tư cách: <strong>{currentUser.displayName}</strong>
                  </span>
                </div>
              ) : (
                <p className="text-xs text-river-500 italic pt-2">
                  💡 Bạn có thể đăng nhận xét dưới dạng khách tham quan trải nghiệm.
                </p>
              )}
            </div>
          </div>

          {/* Vibe Tag Picker */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-river-600">
              Chọn các đặc điểm bạn thấy ấn tượng:
            </label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {SUGGESTED_TAGS.map((tag) => {
                const isSelected = formTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTagInForm(tag)}
                    className={clsx(
                      'rounded-full px-3 py-1 text-xs font-medium transition-all',
                      isSelected
                        ? 'bg-leaf-700 text-white ring-2 ring-leaf-400 shadow-sm'
                        : 'bg-white text-river-700 border border-sand-200 hover:bg-sand-50',
                    )}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content Textarea */}
          <div>
            <label htmlFor="review-content" className="block text-xs font-semibold uppercase tracking-wider text-river-600">
              Cảm nhận chi tiết *
            </label>
            <textarea
              id="review-content"
              rows={4}
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              placeholder="Chia sẻ trải nghiệm thực tế của bạn về cảnh quan, hiện vật, không gian, dịch vụ hoặc lời khuyên hữu ích cho người đến sau..."
              className="mt-1 block w-full rounded-control border border-sand-200 bg-white p-3 text-sm text-river-800 placeholder:text-river-400 focus:border-leaf-600 focus:outline-none focus:ring-1 focus:ring-leaf-600 leading-relaxed"
            />
            <div className="mt-1 flex justify-between text-xs text-river-500">
              <span>Tối thiểu 5 ký tự</span>
              <span>{formContent.length} ký tự</span>
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setIsFormOpen(false)}>
              Hủy
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={isSubmitting}
              icon={<Send className="size-4" />}
            >
              Đăng nhận xét
            </Button>
          </div>
        </form>
      )}

      {/* Filters & Sorting Bar */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-sand-200 pt-4">
        {/* Rating & Verified pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedRatingFilter('all')}
            className={clsx(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              selectedRatingFilter === 'all'
                ? 'bg-river-800 text-white'
                : 'bg-sand-100 text-river-700 hover:bg-sand-200',
            )}
          >
            Tất cả ({stats.totalReviews})
          </button>
          {[5, 4, 3, 2, 1].map((r) => {
            const count = stats.distribution[r] || 0;
            return (
              <button
                key={r}
                type="button"
                onClick={() => setSelectedRatingFilter((curr) => (curr === r ? 'all' : r))}
                className={clsx(
                  'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                  selectedRatingFilter === r
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'bg-sand-100 text-river-700 hover:bg-sand-200',
                )}
              >
                <span>{r}</span>
                <Star className="size-3 fill-current text-current" />
                <span className="opacity-80">({count})</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setVerifiedOnly((v) => !v)}
            className={clsx(
              'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors border',
              verifiedOnly
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                : 'bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50',
            )}
          >
            <CheckCircle2 className="size-3" />
            Đã đến thực địa
          </button>
        </div>

        {/* Sort Select */}
        <div className="flex items-center gap-1.5 text-xs text-river-600">
          <span>Sắp xếp:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'recent' | 'highest' | 'helpful')}
            aria-label="Sắp xếp đánh giá"
            className="rounded-control border border-sand-200 bg-white px-2.5 py-1 text-xs text-river-800 focus:border-leaf-600 focus:outline-none"
          >
            <option value="recent">Mới nhất</option>
            <option value="highest">Đánh giá cao nhất</option>
            <option value="helpful">Hữu ích nhất</option>
          </select>
        </div>
      </div>

      {/* Review Feed */}
      <div className="mt-5 space-y-4">
        {loading ? (
          <div className="space-y-4 py-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse rounded-card border border-sand-200 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-full bg-sand-200" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-4 w-32 rounded bg-sand-200" />
                    <div className="h-3 w-20 rounded bg-sand-200" />
                  </div>
                </div>
                <div className="h-4 w-full rounded bg-sand-200" />
                <div className="h-4 w-3/4 rounded bg-sand-200" />
              </div>
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-card border border-dashed border-sand-300 bg-sand-50/50 p-8 text-center">
            <MessageSquare className="mx-auto size-10 text-river-400" />
            <h4 className="mt-2 text-sm font-semibold text-river-800">Chưa có đánh giá phù hợp</h4>
            <p className="mt-1 text-xs text-river-600 max-w-sm mx-auto">
              Không tìm thấy đánh giá nào với bộ lọc hiện tại. Bạn có thể xóa bộ lọc hoặc là người đầu tiên để lại nhận xét!
            </p>
            <div className="mt-4 flex justify-center gap-2">
              {(selectedRatingFilter !== 'all' || selectedTagFilter || verifiedOnly) && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setSelectedRatingFilter('all');
                    setSelectedTagFilter(null);
                    setVerifiedOnly(false);
                  }}
                >
                  Xóa bộ lọc
                </Button>
              )}
              <Button size="sm" variant="primary" onClick={() => setIsFormOpen(true)} icon={<PenLine className="size-4" />}>
                Viết đánh giá đầu tiên
              </Button>
            </div>
          </div>
        ) : (
          filteredItems.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              destinationName={destinationName}
              likedLikesCount={likedReviews[review.id]}
              onLike={() => handleLike(review.id, likedReviews[review.id] ?? review.likesCount)}
              onReport={() => setReportingReview(review)}
            />
          ))
        )}
      </div>

      {/* Report Modal */}
      <Modal
        open={Boolean(reportingReview)}
        title="Báo cáo đánh giá vi phạm"
        onClose={() => setReportingReview(null)}
      >
        {reportingReview && (
          <form onSubmit={handleSubmitReport} className="p-5 space-y-4">
            <p className="text-xs text-river-600">
              Hãy giúp chúng tôi xây dựng cộng đồng du lịch Đồng Tháp văn minh. Vui lòng cho biết lý do bạn báo cáo nhận xét của <strong>{reportingReview.authorName}</strong>:
            </p>

            <div className="space-y-2">
              {[
                'Nội dung xúc phạm, sai sự thật hoặc dùng từ ngữ thô tục',
                'Thông tin sai sự thật về điểm đến / dịch vụ',
                'Quảng cáo thương mại hoặc spam không liên quan',
                'Trải nghiệm giả mạo, chưa từng đến thực tế',
                'Khác',
              ].map((reason) => (
                <label key={reason} className="flex items-center gap-2.5 text-xs text-river-800 cursor-pointer">
                  <input
                    type="radio"
                    name="report-reason"
                    checked={reportReason === reason}
                    onChange={() => setReportReason(reason)}
                    className="text-leaf-600 focus:ring-leaf-500"
                  />
                  <span>{reason}</span>
                </label>
              ))}
            </div>

            {reportReason === 'Khác' && (
              <textarea
                rows={3}
                value={customReportReason}
                onChange={(e) => setCustomReportReason(e.target.value)}
                placeholder="Nhập chi tiết lý do báo cáo..."
                className="w-full rounded-control border border-sand-200 bg-white p-2.5 text-xs text-river-800 focus:border-leaf-600 focus:outline-none"
                required
              />
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-sand-200">
              <Button type="button" variant="secondary" size="sm" onClick={() => setReportingReview(null)}>
                Hủy
              </Button>
              <Button type="submit" variant="primary" size="sm" loading={isSubmittingReport} icon={<Flag className="size-3.5" />}>
                Gửi báo cáo
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </Card>
  );
}

interface ReviewCardProps {
  review: DestinationReviewItem;
  destinationName: string;
  likedLikesCount?: number;
  onLike: () => void;
  onReport: () => void;
}

function ReviewCard({ review, destinationName, likedLikesCount, onLike, onReport }: ReviewCardProps) {
  const displayLikes = likedLikesCount !== undefined ? likedLikesCount : review.likesCount;
  const isLiked = likedLikesCount !== undefined;

  // Determine avatar background color from author name
  const initials = review.authorName
    .split(' ')
    .filter(Boolean)
    .slice(-2)
    .map((s) => s[0])
    .join('')
    .toUpperCase();

  return (
    <div className="rounded-card border border-sand-200 bg-white p-4 sm:p-5 transition-shadow hover:shadow-sm">
      {/* Reviewer Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-leaf-600 to-teal-500 font-bold text-white shadow-xs text-xs tracking-wider">
            {initials || 'DK'}
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <h4 className="text-sm font-bold text-river-900">{review.authorName}</h4>

              {/* Author Tier Badge */}
              {review.authorTier && (
                <span className="inline-flex items-center gap-1 rounded-full bg-sand-100 px-2 py-0.5 text-[11px] font-medium text-river-700">
                  <Award className="size-3 text-amber-500" />
                  {review.authorTier}
                </span>
              )}

              {/* Verified Visitor Checkmark Badge */}
              {review.isVerifiedVisitor && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                  <CheckCircle2 className="size-3 text-emerald-600" />
                  Đã đến thực địa
                </span>
              )}
            </div>

            <div className="mt-1 flex items-center gap-2 text-xs text-river-500">
              {/* Stars */}
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={clsx(
                      'size-3.5',
                      star <= review.rating
                        ? 'fill-amber-400 text-amber-500'
                        : 'fill-sand-200 text-sand-300',
                    )}
                    aria-hidden
                  />
                ))}
              </div>
              <span>·</span>
              <span>{formatRelativeTime(review.createdAt)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Action: Like / Helpful Button */}
          <button
            type="button"
            onClick={onLike}
            className={clsx(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all',
              isLiked
                ? 'border-leaf-300 bg-leaf-50 text-leaf-700 font-semibold'
                : 'border-sand-200 bg-white text-river-600 hover:bg-sand-50 hover:text-river-900',
            )}
            title="Bình chọn nhận xét hữu ích"
          >
            <ThumbsUp className={clsx('size-3.5', isLiked && 'fill-leaf-600 text-leaf-700')} />
            <span>Hữu ích</span>
            {displayLikes > 0 && <span className="font-semibold">({displayLikes})</span>}
          </button>

          {/* Action: Report button */}
          <button
            type="button"
            onClick={onReport}
            className="rounded-full p-1.5 text-river-400 transition-colors hover:bg-red-50 hover:text-red-600"
            title="Báo cáo đánh giá vi phạm / sai sự thật"
            aria-label="Báo cáo đánh giá vi phạm"
          >
            <Flag className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Tags Chips */}
      {review.tags && review.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {review.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-full bg-sand-100/80 px-2.5 py-0.5 text-[11px] font-medium text-river-700"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Review Content */}
      <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-river-800">
        {review.content}
      </p>

      {/* Official Management Response (if present) */}
      {review.response && (
        <div className="mt-4 rounded-card border-l-4 border-l-leaf-600 border border-sand-200 bg-sand-50/70 p-3.5 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-bold text-leaf-800">
              <span className="flex size-5 items-center justify-center rounded-full bg-leaf-100 text-leaf-700">
                🌸
              </span>
              Phản hồi từ Ban Quản lý {destinationName}
            </span>
            <span className="text-[11px] text-river-500">
              {formatRelativeTime(review.response.respondedAt)}
            </span>
          </div>
          <p className="mt-2 text-xs sm:text-sm text-river-700 leading-relaxed italic">
            "{review.response.content}"
          </p>
          <p className="mt-1.5 text-[11px] font-medium text-river-500">
            — {review.response.responderName || review.response.author || 'Ban Quản lý'}
          </p>
        </div>
      )}
    </div>
  );
}
