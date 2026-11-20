import clsx from 'clsx';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Gift,
  PauseCircle,
  PlayCircle,
  ShieldCheck,
  Ticket,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { AdminPageHeader } from '../../components/layout/AdminLayout';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, StatCard } from '../../components/ui/Card';
import { Textarea } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { EmptyState, ErrorState, PageLoader } from '../../components/ui/States';
import { useApiQuery } from '../../hooks/useApiQuery';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { api, toApiError } from '../../lib/api';
import { formatDate, formatDateTime } from '../../lib/format';
import { toast } from '../../stores/toastStore';

interface AdminVoucherRow {
  id: string;
  title: string;
  discountLabel: string;
  terms: string;
  pointsCost: number;
  totalQuantity: number;
  claimedCount: number;
  redeemedCount: number;
  validUntil: string;
  status: 'active' | 'paused';
  isExpired: boolean;
  destination: { id: string; name: string; slug: string; area: string } | null;
}

interface AdminInquiryRow {
  id: string;
  contactName: string;
  contactPhoneMasked: string;
  visitDate: string;
  groupSize: number;
  serviceInterest: string;
  status: 'new' | 'contacted' | 'confirmed' | 'cancelled';
  isOverdue48h: boolean;
  consentGiven: boolean;
  consentAcceptedAt: string;
  partnerReplyNote: string;
  destination: { id: string; name: string; slug: string; area: string } | null;
  createdAt: string;
}

interface AdminCommerceOverviewResponse {
  summary: {
    totalVouchers: number;
    activeVouchers: number;
    totalClaims: number;
    totalRedeemed: number;
    redemptionRate: number;
    totalInquiries: number;
    newInquiries: number;
    confirmedInquiries: number;
    overdue48hInquiries: number;
    totalGroupGuests: number;
  };
  vouchers: AdminVoucherRow[];
  inquiries: AdminInquiryRow[];
}

export function AdminCommercePage() {
  useDocumentTitle('Giám sát Thương mại & Ưu đãi Toàn tỉnh');
  const [tab, setTab] = useState<'vouchers' | 'inquiries'>('vouchers');
  const [actionTarget, setActionTarget] = useState<{
    voucher: AdminVoucherRow;
    nextStatus: 'active' | 'paused';
  } | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const query = useApiQuery<AdminCommerceOverviewResponse>(
    (signal) =>
      api.get<AdminCommerceOverviewResponse>('/admin/commerce/overview', { signal }).then((r) => r.data),
    [],
  );

  const summary = query.data?.summary;
  const vouchers = query.data?.vouchers || [];
  const inquiries = query.data?.inquiries || [];

  const handleToggleVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionTarget) return;
    setSubmitting(true);
    try {
      const res = await api.patch<{ message?: string }>(
        `/admin/commerce/vouchers/${actionTarget.voucher.id}/status`,
        { status: actionTarget.nextStatus, reason: reason.trim() },
      );
      toast.success(res.data?.message || 'Đã cập nhật trạng thái voucher!');
      setActionTarget(null);
      setReason('');
      query.reload();
    } catch (err) {
      toast.error('Không thể cập nhật voucher', toApiError(err).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <AdminPageHeader
        title="Giám sát Thương mại, Voucher & Đặt đoàn Toàn tỉnh"
        description="Theo dõi hiệu quả chuyển đổi ưu đãi Hộ chiếu Sen Hồng, quyền tạm đình chỉ khẩn cấp voucher vi phạm Luật BVQLNTD 2023 và giám sát SLA phản hồi khách đoàn (>48h)."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Voucher đang chạy"
          value={`${summary?.activeVouchers ?? 0}/${summary?.totalVouchers ?? 0}`}
          hint={`${summary?.totalClaims ?? 0} lượt đổi · ${summary?.totalRedeemed ?? 0} đã dùng (${summary?.redemptionRate ?? 0}%)`}
          icon={<Gift className="size-5 text-lotus-600" />}
        />
        <StatCard
          label="Tổng yêu cầu đặt đoàn"
          value={summary?.totalInquiries ?? 0}
          hint={`~${summary?.totalGroupGuests ?? 0} khách đoàn tiềm năng`}
          icon={<Users className="size-5 text-leaf-700" />}
        />
        <StatCard
          label="Đơn đoàn đã chốt"
          value={summary?.confirmedInquiries ?? 0}
          hint={`${summary?.newInquiries ?? 0} đơn mới đang chờ KDL`}
          icon={<CheckCircle2 className="size-5 text-teal-600" />}
        />
        <StatCard
          label="Đơn quá hạn 48h chưa xử lý"
          value={summary?.overdue48hInquiries ?? 0}
          hint={(summary?.overdue48hInquiries ?? 0) > 0 ? '⚠️ Cần nhắc nhở KDL' : 'Đảm bảo SLA phản hồi'}
          icon={
            <AlertTriangle
              className={clsx(
                'size-5',
                (summary?.overdue48hInquiries ?? 0) > 0 ? 'text-red-600' : 'text-leaf-600',
              )}
            />
          }
        />
      </div>

      {/* Tabs */}
      <div className="mt-7 flex flex-wrap gap-2 border-b border-sand-300 pb-2">
        <button
          type="button"
          onClick={() => setTab('vouchers')}
          className={clsx(
            'inline-flex items-center gap-2 rounded-t-lg px-4 py-2 text-sm font-semibold transition',
            tab === 'vouchers'
              ? 'border-b-2 border-leaf-600 bg-white text-leaf-800 shadow-xs'
              : 'text-river-600 hover:text-river-900',
          )}
        >
          <Ticket className="size-4" /> Voucher KDL toàn tỉnh ({vouchers.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('inquiries')}
          className={clsx(
            'inline-flex items-center gap-2 rounded-t-lg px-4 py-2 text-sm font-semibold transition',
            tab === 'inquiries'
              ? 'border-b-2 border-leaf-600 bg-white text-leaf-800 shadow-xs'
              : 'text-river-600 hover:text-river-900',
          )}
        >
          <Users className="size-4" /> Giám sát SLA Đặt đoàn ({inquiries.length})
          {(summary?.overdue48hInquiries ?? 0) > 0 && (
            <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">
              {summary?.overdue48hInquiries} quá hạn
            </span>
          )}
        </button>
      </div>

      {query.loading && !query.data ? (
        <PageLoader />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={query.reload} />
      ) : tab === 'vouchers' ? (
        <div className="mt-5">
          {vouchers.length === 0 ? (
            <EmptyState
              icon={<Gift className="size-7 text-lotus-500" />}
              title="Chưa có Voucher KDL nào được phát hành"
              description="Khi các đối tác KDL phát hành ưu đãi đổi điểm EXP, toàn bộ sẽ hiển thị giám sát tại đây."
            />
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-sand-200 bg-sand-50 text-[11px] font-bold uppercase text-river-600">
                      <th className="py-3 px-4">KDL & Chương trình ưu đãi</th>
                      <th className="py-3 px-4">Mức giảm / Chi phí</th>
                      <th className="py-3 px-4">Đổi / Đối soát</th>
                      <th className="py-3 px-4">Trạng thái & HSD</th>
                      <th className="py-3 px-4 text-right">Can thiệp Sở VHTTDL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sand-200">
                    {vouchers.map((v) => (
                      <tr key={v.id} className="hover:bg-sand-50/50">
                        <td className="py-3 px-4">
                          <p className="font-bold text-river-900">{v.title}</p>
                          <p className="text-[11px] text-leaf-700 font-medium">{v.destination?.name || '—'}</p>
                        </td>
                        <td className="py-3 px-4">
                          <Badge tone="lotus">{v.discountLabel}</Badge>
                          <span className="block mt-1 font-mono text-[11px] text-river-600">{v.pointsCost} EXP</span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-river-800">
                          {v.claimedCount}/{v.totalQuantity} đổi ·{' '}
                          <span className="text-teal-700">{v.redeemedCount} đã dùng</span>
                        </td>
                        <td className="py-3 px-4">
                          <Badge tone={v.status === 'active' && !v.isExpired ? 'leaf' : v.isExpired ? 'red' : 'neutral'}>
                            {v.isExpired ? 'Hết hạn' : v.status === 'active' ? 'Đang mở' : 'Tạm đình chỉ'}
                          </Badge>
                          <span className="block mt-1 text-[11px] text-river-500">HSD: {formatDate(v.validUntil)}</span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {v.status === 'active' ? (
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => {
                                setActionTarget({ voucher: v, nextStatus: 'paused' });
                                setReason('');
                              }}
                              icon={<PauseCircle className="size-3.5" />}
                            >
                              Đình chỉ khẩn
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setActionTarget({ voucher: v, nextStatus: 'active' });
                                setReason('');
                              }}
                              icon={<PlayCircle className="size-3.5" />}
                            >
                              Mở lại
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      ) : (
        <div className="mt-5">
          {inquiries.length === 0 ? (
            <EmptyState
              icon={<Users className="size-7 text-river-400" />}
              title="Chưa có yêu cầu đặt đoàn nào toàn tỉnh"
              description="Các yêu cầu đặt đoàn của du khách gửi tới KDL sẽ được tổng hợp theo dõi SLA tại đây."
            />
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-sand-200 bg-sand-50 text-[11px] font-bold uppercase text-river-600">
                      <th className="py-3 px-4">Điểm đến KDL</th>
                      <th className="py-3 px-4">Trưởng đoàn (ẩn bớt SĐT)</th>
                      <th className="py-3 px-4">Quy mô & Ngày đến</th>
                      <th className="py-3 px-4">Trạng thái & SLA</th>
                      <th className="py-3 px-4">Đồng ý NĐ 13/2023</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sand-200">
                    {inquiries.map((inq) => (
                      <tr key={inq.id} className={clsx(inq.isOverdue48h && 'bg-red-50/50')}>
                        <td className="py-3 px-4 font-bold text-river-900">
                          {inq.destination?.name || '—'}
                          <span className="block text-[11px] font-normal text-river-500">
                            Gửi: {formatDateTime(inq.createdAt)}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-river-900">{inq.contactName}</span>
                          <span className="block font-mono text-[11px] text-river-500">{inq.contactPhoneMasked}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-leaf-800">{inq.groupSize} khách</span>
                          <span className="block text-[11px] text-river-600">Ngày: {formatDate(inq.visitDate)}</span>
                        </td>
                        <td className="py-3 px-4 space-y-1">
                          <Badge
                            tone={
                              inq.status === 'confirmed'
                                ? 'leaf'
                                : inq.status === 'contacted'
                                  ? 'teal'
                                  : inq.status === 'new'
                                    ? 'lotus'
                                    : 'neutral'
                            }
                          >
                            {inq.status === 'new'
                              ? 'Chưa phản hồi'
                              : inq.status === 'contacted'
                                ? 'Đã liên hệ'
                                : inq.status === 'confirmed'
                                  ? 'Đã chốt đoàn'
                                  : 'Đã hủy'}
                          </Badge>
                          {inq.isOverdue48h && (
                            <span className="block text-[11px] font-bold text-red-700">
                              <Clock className="size-3 inline mr-0.5" /> Quá hạn 48h!
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-[11px] text-emerald-700 font-medium">
                          <span className="inline-flex items-center gap-1">
                            <ShieldCheck className="size-3.5" /> Hợp lệ ({formatDate(inq.consentAcceptedAt)})
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Suspend / Resume Voucher Modal */}
      <Modal
        open={Boolean(actionTarget)}
        size="sm"
        title={
          actionTarget?.nextStatus === 'paused'
            ? 'Đình chỉ khẩn cấp Voucher KDL'
            : 'Mở lại phát hành Voucher KDL'
        }
        onClose={() => setActionTarget(null)}
      >
        {actionTarget && (
          <form onSubmit={handleToggleVoucher} className="space-y-4">
            <p className="text-sm text-river-700">
              Nhập lý do {actionTarget.nextStatus === 'paused' ? 'đình chỉ' : 'mở lại'} voucher{' '}
              <strong>{actionTarget.voucher.title}</strong> (ghi vào Nhật ký kiểm toán bất biến):
            </p>
            <Textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="VD: Điều kiện áp dụng chưa rõ ràng theo Luật BVQLNTD 2023 / Đã khắc phục đầy đủ..."
              required
            />
            <div className="flex justify-end gap-2 pt-2 border-t border-sand-200">
              <Button type="button" variant="secondary" onClick={() => setActionTarget(null)}>
                Hủy
              </Button>
              <Button
                type="submit"
                variant={actionTarget.nextStatus === 'paused' ? 'danger' : 'primary'}
                loading={submitting}
              >
                Xác nhận
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
