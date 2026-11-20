import clsx from 'clsx';
import {
  Calendar,
  CheckCircle2,
  Mail,
  MessageSquare,
  Phone,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { useApiQuery } from '../../hooks/useApiQuery';
import { api, toApiError } from '../../lib/api';
import { formatDate, formatDateTime } from '../../lib/format';
import { toast } from '../../stores/toastStore';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Select } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { ErrorState, PageLoader } from '../ui/States';

type InquiryStatus = 'new' | 'contacted' | 'confirmed' | 'cancelled';

interface PartnerInquiryItem {
  id: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string | null;
  visitDate: string;
  groupSize: number;
  serviceInterest: string;
  notes: string;
  consentGiven: boolean;
  consentAcceptedAt: string;
  status: InquiryStatus;
  partnerReplyNote: string;
  handledAt: string | null;
  createdAt: string;
}

const STATUS_META: Record<
  InquiryStatus,
  { label: string; tone: 'lotus' | 'teal' | 'leaf' | 'neutral' }
> = {
  new: { label: 'Mới tiếp nhận', tone: 'lotus' },
  contacted: { label: 'Đã liên hệ tư vấn', tone: 'teal' },
  confirmed: { label: 'Đã chốt đoàn', tone: 'leaf' },
  cancelled: { label: 'Đã hủy', tone: 'neutral' },
};

export function PartnerInquiriesTab({
  destinationId,
  destinationName,
  onChanged,
}: {
  destinationId: string;
  destinationName: string;
  onChanged: () => void;
}) {
  const [statusFilter, setStatusFilter] = useState<'all' | InquiryStatus>('all');
  const [activeInquiry, setActiveInquiry] = useState<PartnerInquiryItem | null>(null);
  const [nextStatus, setNextStatus] = useState<InquiryStatus>('contacted');
  const [replyNote, setReplyNote] = useState('');
  const [saving, setSaving] = useState(false);

  const query = useApiQuery<{
    success: boolean;
    counts: Record<InquiryStatus, number>;
    items: PartnerInquiryItem[];
  }>(
    (signal) =>
      api
        .get('/admin/partner/inquiries', {
          params: {
            destinationId,
            status: statusFilter === 'all' ? undefined : statusFilter,
          },
          signal,
        })
        .then((r) => r.data),
    [destinationId, statusFilter],
  );

  const items = query.data?.items || [];
  const counts = query.data?.counts || { new: 0, contacted: 0, confirmed: 0, cancelled: 0 };

  const openHandleModal = (item: PartnerInquiryItem) => {
    setActiveInquiry(item);
    setNextStatus(item.status === 'new' ? 'contacted' : item.status);
    setReplyNote(item.partnerReplyNote || '');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeInquiry) return;
    setSaving(true);
    try {
      await api.patch(`/admin/partner/inquiries/${activeInquiry.id}`, {
        status: nextStatus,
        partnerReplyNote: replyNote.trim(),
      });
      toast.success('Đã cập nhật trạng thái chăm sóc đoàn khách!');
      setActiveInquiry(null);
      query.reload();
      onChanged();
    } catch (err) {
      toast.error(toApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="mt-6 p-5 sm:p-6 space-y-5">
      <div className="border-b border-sand-200 pb-4 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-bold text-lg text-river-900 flex items-center gap-2">
            <Users className="size-5 text-leaf-700" />
            Hộp Thư Yêu Cầu Đặt Đoàn & Tư Vấn Nhóm — {destinationName}
          </h3>
          <Badge tone={counts.new > 0 ? 'lotus' : 'leaf'}>
            {counts.new} yêu cầu mới chưa xử lý
          </Badge>
        </div>

        <div className="rounded-xl border border-leaf-200 bg-leaf-50/70 px-3.5 py-2 text-[11px] text-leaf-900 flex items-start gap-2">
          <ShieldCheck className="size-4 shrink-0 text-leaf-700 mt-0.5" />
          <span>
            <strong>Tuân thủ Nghị định 13/2023/NĐ-CP:</strong> Toàn bộ số điện thoại/email trong hộp thư này đã được trưởng đoàn chủ động đồng ý chia sẻ với mục đích duy nhất là liên hệ tư vấn & báo giá tham quan. Nghiêm cấm sử dụng vào mục đích spam hoặc chuyển giao cho bên thứ ba.
          </span>
        </div>

        {/* Status Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-2">
          {(
            [
              { id: 'all', label: `Tất cả (${counts.new + counts.contacted + counts.confirmed + counts.cancelled})` },
              { id: 'new', label: `Mới (${counts.new})` },
              { id: 'contacted', label: `Đã liên hệ (${counts.contacted})` },
              { id: 'confirmed', label: `Đã chốt (${counts.confirmed})` },
              { id: 'cancelled', label: `Đã hủy (${counts.cancelled})` },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatusFilter(f.id)}
              className={clsx(
                'rounded-full px-3 py-1 text-xs font-semibold transition border',
                statusFilter === f.id
                  ? 'border-leaf-700 bg-leaf-700 text-white'
                  : 'border-sand-300 bg-white text-river-700 hover:bg-sand-100',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {query.loading ? (
        <PageLoader />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={query.reload} />
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-sand-300 bg-sand-50/60 py-10 text-center space-y-2">
          <Users className="size-10 mx-auto text-river-400" />
          <p className="text-sm font-bold text-river-800">Chưa có yêu cầu đặt đoàn nào trong mục này</p>
          <p className="text-xs text-river-500 max-w-md mx-auto">
            Khi du khách bấm nút "Đặt đoàn / Tư vấn nhóm" trên trang chi tiết {destinationName}, yêu cầu sẽ xuất hiện tại đây ngay lập tức.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((inq) => {
            const meta = STATUS_META[inq.status];
            return (
              <div
                key={inq.id}
                className={clsx(
                  'rounded-2xl border p-4 space-y-3 transition',
                  inq.status === 'new'
                    ? 'border-lotus-300 bg-lotus-50/30 shadow-xs'
                    : 'border-sand-200 bg-white',
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-bold text-river-900 text-sm">{inq.contactName}</h4>
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                      <span className="rounded-full bg-leaf-100 px-2.5 py-0.5 text-xs font-bold text-leaf-900">
                        👥 Đoàn {inq.groupSize} khách
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-river-600 flex flex-wrap items-center gap-x-4 gap-y-1">
                      <a
                        href={`tel:${inq.contactPhone}`}
                        className="inline-flex items-center gap-1 font-mono font-bold text-leaf-800 hover:underline"
                      >
                        <Phone className="size-3.5" /> {inq.contactPhone}
                      </a>
                      {inq.contactEmail && (
                        <a
                          href={`mailto:${inq.contactEmail}`}
                          className="inline-flex items-center gap-1 text-river-700 hover:underline"
                        >
                          <Mail className="size-3.5" /> {inq.contactEmail}
                        </a>
                      )}
                      <span className="inline-flex items-center gap-1 font-medium">
                        <Calendar className="size-3.5 text-teal-600" /> Dự kiến: {formatDate(inq.visitDate)}
                      </span>
                    </p>
                  </div>

                  <Button size="sm" variant="primary" onClick={() => openHandleModal(inq)}>
                    Cập nhật xử lý
                  </Button>
                </div>

                {inq.serviceInterest && (
                  <p className="text-xs text-river-800">
                    <strong>Dịch vụ / Combo quan tâm:</strong> {inq.serviceInterest}
                  </p>
                )}

                {inq.notes && (
                  <p className="rounded-xl bg-sand-50 p-3 text-xs text-river-700 border border-sand-200 leading-relaxed">
                    <MessageSquare className="size-3.5 inline mr-1.5 text-river-400" />
                    {inq.notes}
                  </p>
                )}

                {inq.partnerReplyNote && (
                  <p className="rounded-xl bg-leaf-50/80 p-2.5 text-xs text-leaf-950 border border-leaf-200">
                    <strong>Ghi chú xử lý nội bộ:</strong> {inq.partnerReplyNote}
                  </p>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-sand-200 text-[11px] text-river-500">
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                    <CheckCircle2 className="size-3.5" /> Đã đồng ý chia sẻ liên hệ (NĐ 13) lúc{' '}
                    {formatDateTime(inq.consentAcceptedAt)}
                  </span>
                  <span>Gửi lúc: {formatDateTime(inq.createdAt)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={Boolean(activeInquiry)}
        size="md"
        title="Cập nhật Trạng thái Yêu cầu Đặt đoàn"
        onClose={() => setActiveInquiry(null)}
      >
        {activeInquiry && (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="rounded-xl bg-sand-50 border border-sand-200 p-3 text-xs space-y-1 text-river-800">
              <p>
                <strong>Trưởng đoàn:</strong> {activeInquiry.contactName} ({activeInquiry.contactPhone})
              </p>
              <p>
                <strong>Quy mô:</strong> {activeInquiry.groupSize} khách · Dự kiến{' '}
                {formatDate(activeInquiry.visitDate)}
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-river-700 mb-1">
                Trạng thái chăm sóc *
              </label>
              <Select
                value={nextStatus}
                onChange={(e) => setNextStatus(e.target.value as InquiryStatus)}
              >
                <option value="new">Mới tiếp nhận</option>
                <option value="contacted">Đã liên hệ tư vấn / gửi báo giá</option>
                <option value="confirmed">Đã xác nhận chốt đoàn</option>
                <option value="cancelled">Khách hủy / Không thực hiện</option>
              </Select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-river-700 mb-1">
                Ghi chú nội bộ (VD: Đã báo giá combo xuồng + cơm trưa, cọc 30%...)
              </label>
              <textarea
                rows={3}
                value={replyNote}
                onChange={(e) => setReplyNote(e.target.value)}
                placeholder="Ghi nhận tiến độ tư vấn cho nhân sự cùng cơ sở..."
                className="w-full rounded-control border border-sand-300 bg-white p-2.5 text-sm text-river-800 focus:border-leaf-600 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-sand-200">
              <Button type="button" variant="secondary" onClick={() => setActiveInquiry(null)}>
                Hủy
              </Button>
              <Button type="submit" variant="primary" loading={saving}>
                Lưu trạng thái
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </Card>
  );
}
