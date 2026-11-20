import clsx from 'clsx';
import { Send, Sparkles, Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, toApiError } from '../../lib/api';
import { toast } from '../../stores/toastStore';
import { Button } from '../ui/Button';
import { Input } from '../ui/Field';
import { Modal } from '../ui/Modal';

export interface PartnerQuickReplyReview {
  id: string;
  authorName: string;
  rating: number;
  content: string;
  response?: { content: string; responderName?: string; respondedAt: string };
}

interface PartnerQuickReplyModalProps {
  review: PartnerQuickReplyReview | null;
  destinationName: string;
  onClose: () => void;
  onSaved: () => void;
}

export function PartnerQuickReplyModal({
  review,
  destinationName,
  onClose,
  onSaved,
}: PartnerQuickReplyModalProps) {
  const [content, setContent] = useState('');
  const [responderName, setResponderName] = useState('');
  const [suggestions, setSuggestions] = useState<Array<{ tone: string; content: string }>>([]);
  const [loadingAi, setLoadingAi] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!review) return;
    setContent(review.response?.content || '');
    setResponderName(review.response?.responderName || `Ban Quản lý ${destinationName}`);
    setSuggestions([]);
  }, [review, destinationName]);

  const handleSuggestAi = async () => {
    if (!review) return;
    setLoadingAi(true);
    try {
      const res = await api.post<{
        success: boolean;
        suggestions: Array<{ tone: string; content: string }>;
      }>('/admin/partner/ai/suggest-review-reply', { reviewId: review.id });
      setSuggestions(res.data.suggestions || []);
      toast.success('Đã tạo 2 gợi ý phản hồi lịch sự! Chọn 1 mẫu để áp dụng.');
    } catch (err) {
      toast.error(toApiError(err).message);
    } finally {
      setLoadingAi(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!review) return;
    if (!content.trim()) {
      toast.error('Vui lòng nhập nội dung phản hồi.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/admin/reviews/${review.id}/respond`, {
        content: content.trim(),
        responderName: responderName.trim() || undefined,
      });
      toast.success('Đã gửi phản hồi chính thức tới du khách!');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(toApiError(err).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={Boolean(review)} size="md" title="Phản hồi Đánh giá Du khách" onClose={onClose}>
      {review && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-xl border border-sand-200 bg-sand-50 p-3.5 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-river-900">{review.authorName}</span>
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={clsx(
                      'size-3.5',
                      s <= review.rating ? 'fill-amber-400 text-amber-500' : 'fill-sand-200 text-sand-300',
                    )}
                  />
                ))}
              </div>
            </div>
            <p className="text-xs text-river-700 leading-relaxed italic">"{review.content}"</p>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-river-700">
                Gợi ý phản hồi từ AI CSKH
              </span>
              <Button
                type="button"
                variant="accent"
                size="sm"
                loading={loadingAi}
                onClick={handleSuggestAi}
                icon={<Sparkles className="size-3.5" />}
              >
                AI Gợi ý trả lời
              </Button>
            </div>

            {suggestions.length > 0 && (
              <div className="grid gap-2">
                {suggestions.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setContent(s.content)}
                    className="rounded-xl border border-lotus-200 bg-lotus-50/40 p-3 text-left transition hover:border-lotus-400 hover:bg-lotus-50"
                  >
                    <span className="inline-block rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-lotus-800 border border-lotus-200 mb-1">
                      ✨ Giọng điệu: {s.tone} (Bấm chọn)
                    </span>
                    <p className="text-xs text-river-800 leading-relaxed">{s.content}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label htmlFor="pqr-responder" className="block text-xs font-bold uppercase tracking-wider text-river-700 mb-1">
              Danh xưng người phản hồi
            </label>
            <Input
              id="pqr-responder"
              value={responderName}
              onChange={(e) => setResponderName(e.target.value)}
              placeholder={`Ban Quản lý ${destinationName}`}
            />
          </div>

          <div>
            <label htmlFor="pqr-content" className="block text-xs font-bold uppercase tracking-wider text-river-700 mb-1">
              Nội dung phản hồi chính thức *
            </label>
            <textarea
              id="pqr-content"
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Cảm ơn Quý khách đã ghé thăm..."
              className="w-full rounded-control border border-sand-300 bg-white p-3 text-sm text-river-800 focus:border-leaf-600 focus:outline-none focus:ring-1 focus:ring-leaf-600"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-sand-200">
            <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
              Hủy
            </Button>
            <Button type="submit" variant="primary" loading={submitting} icon={<Send className="size-4" />}>
              Gửi phản hồi công khai
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
