import clsx from 'clsx';
import {
  CheckCircle2,
  Clock,
  Eye,
  Megaphone,
  MousePointerClick,
  Plus,
  Send,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { useApiQuery } from '../../hooks/useApiQuery';
import { api, toApiError } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { toast } from '../../stores/toastStore';
import type { BannerTheme } from '../../types/api';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Input, Select } from '../ui/Field';
import { ConfirmDialog, Modal } from '../ui/Modal';
import { ErrorState, PageLoader } from '../ui/States';

interface PartnerBannerItem {
  id: string;
  kind: 'event' | 'promo';
  theme: BannerTheme;
  eyebrow: string;
  title: string;
  subtitle: string;
  imageUrl: string | null;
  linkUrl: string | null;
  linkLabel: string;
  sponsorName: string;
  approvalStatus: 'approved' | 'pending_review' | 'rejected';
  reviewFeedback: string;
  status: 'active' | 'inactive';
  startAt: string | null;
  endAt: string | null;
  impressions: number;
  clicks: number;
  createdAt: string;
}

const APPROVAL_META: Record<
  PartnerBannerItem['approvalStatus'],
  { label: string; tone: 'teal' | 'leaf' | 'red' }
> = {
  pending_review: { label: 'Chờ Sở VHTTDL duyệt', tone: 'teal' },
  approved: { label: 'Đã phê duyệt', tone: 'leaf' },
  rejected: { label: 'Cần chỉnh sửa / Từ chối', tone: 'red' },
};

const THEME_PREVIEW_STYLES: Record<BannerTheme, string> = {
  forest: 'bg-gradient-to-r from-leaf-950 via-leaf-800 to-teal-900 text-white',
  lotus: 'bg-gradient-to-r from-lotus-900 via-lotus-700 to-amber-700 text-white',
  cream: 'bg-gradient-to-r from-sand-100 via-white to-leaf-50 text-river-950 border border-sand-300',
};

export function PartnerBannersTab({
  destinationId,
  destinationName,
  onChanged,
}: {
  destinationId: string;
  destinationName: string;
  onChanged: () => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [kind, setKind] = useState<'promo' | 'event'>('event');
  const [theme, setTheme] = useState<BannerTheme>('forest');
  const [eyebrow, setEyebrow] = useState('Sự kiện mùa vụ');
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [linkLabel, setLinkLabel] = useState('Khám phá ngay');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [withdrawTarget, setWithdrawTarget] = useState<PartnerBannerItem | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);

  const query = useApiQuery<{ success: boolean; items: PartnerBannerItem[] }>(
    (signal) =>
      api
        .get('/admin/partner/banners', { params: { destinationId }, signal })
        .then((r) => r.data),
    [destinationId],
  );

  const items = query.data?.items || [];
  const pendingCount = items.filter((b) => b.approvalStatus === 'pending_review').length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/admin/partner/banners', {
        destinationId,
        kind,
        theme,
        eyebrow: eyebrow.trim() || undefined,
        title: title.trim(),
        subtitle: subtitle.trim(),
        imageUrl: imageUrl.trim() || undefined,
        linkLabel: linkLabel.trim() || undefined,
        startAt: startAt ? new Date(`${startAt}T00:00:00+07:00`).toISOString() : undefined,
        endAt: endAt ? new Date(`${endAt}T23:59:59+07:00`).toISOString() : undefined,
      });
      toast.success('Đã gửi Banner tới Sở VHTTDL phê duyệt!');
      setModalOpen(false);
      setTitle('');
      setSubtitle('');
      setImageUrl('');
      setStartAt('');
      setEndAt('');
      query.reload();
      onChanged();
    } catch (err) {
      toast.error(toApiError(err).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawTarget) return;
    setWithdrawing(true);
    try {
      const res = await api.delete<{ message?: string }>(`/admin/partner/banners/${withdrawTarget.id}`);
      toast.success(res.data?.message || 'Đã xử lý banner.');
      setWithdrawTarget(null);
      query.reload();
      onChanged();
    } catch (err) {
      toast.error(toApiError(err).message);
    } finally {
      setWithdrawing(false);
    }
  };

  return (
    <Card className="mt-6 p-5 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-sand-200 pb-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-lg text-river-900 flex items-center gap-2">
              <Megaphone className="size-5 text-lotus-600" />
              Gửi Duyệt Banner Quảng Bá Mùa Vụ & Lễ Hội
            </h3>
            <Badge tone={pendingCount > 0 ? 'teal' : 'neutral'}>
              {pendingCount}/3 đang chờ duyệt
            </Badge>
          </div>
          <p className="text-xs text-river-600 max-w-2xl">
            Gửi yêu cầu hiển thị sự kiện mùa hoa, lễ hội sen hoặc ưu đãi của <strong>{destinationName}</strong> lên Trang chủ. Theo Luật Quảng cáo 2012, mọi banner đều qua Sở VHTTDL kiểm duyệt nội dung trước khi hiển thị công khai và luôn dẫn về trang điểm đến chính thức.
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          disabled={pendingCount >= 3}
          onClick={() => setModalOpen(true)}
          icon={<Plus className="size-4" />}
        >
          Gửi duyệt Banner mới
        </Button>
      </div>

      {query.loading ? (
        <PageLoader />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={query.reload} />
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-sand-300 bg-sand-50/60 py-10 text-center space-y-2">
          <Megaphone className="size-10 mx-auto text-lotus-500/60" />
          <p className="text-sm font-bold text-river-800">Chưa có chiến dịch Banner mùa vụ nào</p>
          <p className="text-xs text-river-500 max-w-md mx-auto">
            Sắp có Lễ hội Hoa Xuân, Mùa Nước Nổi hay Tuần lễ Sen? Bấm "Gửi duyệt Banner mới" để đăng ký quảng bá lên Trang chủ Đồng Tháp Smart Travel!
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((b) => {
            const meta = APPROVAL_META[b.approvalStatus];
            return (
              <div key={b.id} className="rounded-2xl border border-sand-200 bg-white overflow-hidden shadow-xs flex flex-col justify-between">
                <div>
                  <div className={clsx('p-4 space-y-1', THEME_PREVIEW_STYLES[b.theme])}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest opacity-85">
                        {b.kind === 'promo' ? 'Quảng cáo · ' : ''}
                        {b.eyebrow || b.sponsorName}
                      </span>
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                    </div>
                    <h4 className="font-black text-base leading-snug">{b.title}</h4>
                    <p className="text-xs opacity-90 line-clamp-2">{b.subtitle}</p>
                  </div>

                  <div className="p-4 space-y-2 text-xs text-river-700">
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-river-500">
                      <span className="inline-flex items-center gap-1">
                        <Eye className="size-3.5" /> {b.impressions.toLocaleString()} hiển thị
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MousePointerClick className="size-3.5" /> {b.clicks.toLocaleString()} lượt bấm
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3.5" />
                        {b.startAt ? formatDate(b.startAt) : 'Ngay khi duyệt'} →{' '}
                        {b.endAt ? formatDate(b.endAt) : 'Không giới hạn'}
                      </span>
                    </div>

                    {b.reviewFeedback && (
                      <div
                        className={clsx(
                          'rounded-lg p-2.5 text-xs border',
                          b.approvalStatus === 'rejected'
                            ? 'border-red-200 bg-red-50 text-red-900'
                            : 'border-leaf-200 bg-leaf-50 text-leaf-900',
                        )}
                      >
                        <strong className="inline-flex items-center gap-1">
                          {b.approvalStatus === 'rejected' ? (
                            <ShieldAlert className="size-3.5 text-red-600" />
                          ) : (
                            <CheckCircle2 className="size-3.5 text-leaf-700" />
                          )}
                          Phản hồi Sở VHTTDL:
                        </strong>{' '}
                        {b.reviewFeedback}
                      </div>
                    )}
                  </div>
                </div>

                <div className="px-4 py-3 border-t border-sand-200 bg-sand-50/50 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-river-500">
                    Trạng thái hiển thị:{' '}
                    <strong className={b.status === 'active' ? 'text-leaf-700' : 'text-river-700'}>
                      {b.status === 'active' ? 'Đang chạy Trang chủ' : 'Chưa hiển thị'}
                    </strong>
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setWithdrawTarget(b)}
                    icon={<Trash2 className="size-3.5 text-red-600" />}
                  >
                    {b.status === 'active' ? 'Tạm ngừng' : 'Rút hồ sơ'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        size="lg"
        title={`Gửi Duyệt Banner Mùa Vụ — ${destinationName}`}
        onClose={() => setModalOpen(false)}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Live Visual Preview */}
          <div className={clsx('rounded-2xl p-4 space-y-1 shadow-sm', THEME_PREVIEW_STYLES[theme])}>
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">
              {kind === 'promo' ? `Quảng cáo · ${destinationName}` : eyebrow || destinationName}
            </p>
            <h4 className="font-black text-base">
              {title.trim() || 'Tiêu đề Banner mùa vụ sẽ hiển thị tại đây...'}
            </h4>
            <p className="text-xs opacity-90">
              {subtitle.trim() || 'Mô tả ngắn gọn về lễ hội, mùa hoa hoặc chương trình ưu đãi đặc biệt của KDL.'}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-bold uppercase text-river-700 mb-1">
                Loại chiến dịch *
              </label>
              <Select value={kind} onChange={(e) => setKind(e.target.value as 'promo' | 'event')}>
                <option value="event">🎉 Sự kiện / Lễ hội mùa vụ</option>
                <option value="promo">🏷️ Quảng cáo ưu đãi (Gắn nhãn Quảng cáo)</option>
              </Select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-river-700 mb-1">
                Tông màu chủ đạo
              </label>
              <Select value={theme} onChange={(e) => setTheme(e.target.value as BannerTheme)}>
                <option value="forest">🌿 Xanh Tràm Đất Sen</option>
                <option value="lotus">🌸 Hồng Sen Rực Rỡ</option>
                <option value="cream">📜 Kem Thanh Lịch</option>
              </Select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-river-700 mb-1">
                Nhãn phụ (Eyebrow)
              </label>
              <Input value={eyebrow} onChange={(e) => setEyebrow(e.target.value)} maxLength={60} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-river-700 mb-1">
              Tiêu đề Banner (5–120 ký tự) *
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Lễ hội Mùa Sen Nở Rộ — Giảm 20% trải nghiệm xuồng ba lá"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-river-700 mb-1">
              Mô tả chi tiết (10–300 ký tự) *
            </label>
            <textarea
              rows={2}
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="Nêu rõ điểm nhấn lễ hội, khung giờ đẹp nhất hoặc quyền lợi ưu đãi cho du khách..."
              className="w-full rounded-control border border-sand-300 bg-white p-2.5 text-sm text-river-800 focus:border-leaf-600 focus:outline-none"
              required
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold uppercase text-river-700 mb-1">
                Ảnh nền tùy chọn (bỏ trống sẽ lấy ảnh đại diện KDL)
              </label>
              <Input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://... hoặc /uploads/..."
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-river-700 mb-1">
                Chữ nút bấm CTA
              </label>
              <Input
                value={linkLabel}
                onChange={(e) => setLinkLabel(e.target.value)}
                placeholder="Khám phá ngay"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold uppercase text-river-700 mb-1">
                Ngày bắt đầu (tuỳ chọn)
              </label>
              <Input type="date" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-river-700 mb-1">
                Ngày kết thúc (tuỳ chọn)
              </label>
              <Input type="date" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-sand-200">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Hủy
            </Button>
            <Button type="submit" variant="primary" loading={submitting} icon={<Send className="size-4" />}>
              Gửi Sở VHTTDL duyệt
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(withdrawTarget)}
        title={withdrawTarget?.status === 'active' ? 'Tạm ngừng hiển thị Banner?' : 'Rút hồ sơ Banner?'}
        message={
          <p>
            Bạn xác nhận muốn {withdrawTarget?.status === 'active' ? 'tạm ngừng chạy' : 'rút bỏ'} banner{' '}
            <strong>{withdrawTarget?.title}</strong>?
          </p>
        }
        confirmLabel="Xác nhận"
        tone="danger"
        loading={withdrawing}
        onConfirm={handleWithdraw}
        onCancel={() => setWithdrawTarget(null)}
      />
    </Card>
  );
}
