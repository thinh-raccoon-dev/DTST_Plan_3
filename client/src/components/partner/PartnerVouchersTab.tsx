import clsx from 'clsx';
import {
  CheckCircle2,
  Clock,
  Gift,
  PauseCircle,
  PenLine,
  PlayCircle,
  Plus,
  QrCode,
  Search,
  ShieldCheck,
  Ticket,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { useApiQuery } from '../../hooks/useApiQuery';
import { api, toApiError } from '../../lib/api';
import { formatDate, formatDateTime } from '../../lib/format';
import { toast } from '../../stores/toastStore';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Input } from '../ui/Field';
import { ConfirmDialog, Modal } from '../ui/Modal';
import { ErrorState, PageLoader } from '../ui/States';

interface PartnerVoucherItem {
  id: string;
  title: string;
  description: string;
  discountLabel: string;
  terms: string;
  pointsCost: number;
  totalQuantity: number;
  claimedCount: number;
  redeemedCount: number;
  remaining: number;
  maxPerUser: number;
  validFrom: string;
  validUntil: string;
  status: 'active' | 'paused';
  isExpired: boolean;
  createdAt: string;
}

interface PartnerVoucherClaimRow {
  id: string;
  claimCode: string;
  voucherTitle: string;
  discountLabel: string;
  visitorName: string;
  pointsSpent: number;
  status: 'issued' | 'redeemed' | 'expired';
  expiresAt: string;
  redeemedAt: string | null;
  redeemNote: string;
  createdAt: string;
}

interface LookupResult {
  id: string;
  claimCode: string;
  voucherTitle: string;
  discountLabel: string;
  terms: string;
  visitorName: string;
  pointsSpent: number;
  status: 'issued' | 'redeemed' | 'expired';
  canRedeem: boolean;
  expiresAt: string;
  redeemedAt: string | null;
  redeemNote: string;
}

function toDateInputValue(iso?: string): string {
  if (!iso) {
    const d = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 10);
  }
  return new Date(iso).toISOString().slice(0, 10);
}

export function PartnerVouchersTab({
  destinationId,
  destinationName,
  onChanged,
}: {
  destinationId: string;
  destinationName: string;
  onChanged: () => void;
}) {
  // Counter redemption state
  const [lookupCode, setLookupCode] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [redeemNote, setRedeemNote] = useState('');
  const [redeeming, setRedeeming] = useState(false);

  // Create / Edit voucher modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PartnerVoucherItem | null>(null);
  const [title, setTitle] = useState('');
  const [discountLabel, setDiscountLabel] = useState('');
  const [description, setDescription] = useState('');
  const [terms, setTerms] = useState('');
  const [pointsCost, setPointsCost] = useState(50);
  const [totalQuantity, setTotalQuantity] = useState(100);
  const [maxPerUser, setMaxPerUser] = useState(1);
  const [validUntil, setValidUntil] = useState(toDateInputValue());
  const [submitting, setSubmitting] = useState(false);

  // Delete / Pause confirm
  const [deleteTarget, setDeleteTarget] = useState<PartnerVoucherItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const query = useApiQuery<{
    success: boolean;
    items: PartnerVoucherItem[];
    recentClaims: PartnerVoucherClaimRow[];
  }>(
    (signal) =>
      api
        .get('/admin/partner/vouchers', { params: { destinationId }, signal })
        .then((r) => r.data),
    [destinationId],
  );

  const items = query.data?.items || [];
  const recentClaims = query.data?.recentClaims || [];

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = lookupCode.trim().toUpperCase();
    if (!cleaned) {
      toast.error('Vui lòng nhập mã ưu đãi do du khách xuất trình.');
      return;
    }
    setLookupLoading(true);
    setLookupResult(null);
    try {
      const res = await api.get<{ success: boolean; claim: LookupResult }>(
        '/admin/partner/vouchers/lookup',
        { params: { code: cleaned } },
      );
      setLookupResult(res.data.claim);
    } catch (err) {
      toast.error(toApiError(err).message);
    } finally {
      setLookupLoading(false);
    }
  };

  const handleRedeem = async () => {
    if (!lookupResult) return;
    setRedeeming(true);
    try {
      const res = await api.post<{ success: boolean; message: string }>(
        '/admin/partner/vouchers/redeem',
        {
          claimCode: lookupResult.claimCode,
          redeemNote: redeemNote.trim() || undefined,
        },
      );
      toast.success(res.data.message || 'Đối soát mã ưu đãi thành công!');
      setLookupResult(null);
      setLookupCode('');
      setRedeemNote('');
      query.reload();
      onChanged();
    } catch (err) {
      toast.error(toApiError(err).message);
    } finally {
      setRedeeming(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setTitle('');
    setDiscountLabel('');
    setDescription('');
    setTerms(
      'Áp dụng trực tiếp tại quầy vé khi xuất trình mã hợp lệ trên ứng dụng Đồng Tháp Smart Travel. Không quy đổi thành tiền mặt, không cộng dồn khuyến mãi khác.',
    );
    setPointsCost(50);
    setTotalQuantity(100);
    setMaxPerUser(1);
    setValidUntil(toDateInputValue());
    setModalOpen(true);
  };

  const openEdit = (v: PartnerVoucherItem) => {
    setEditing(v);
    setTitle(v.title);
    setDiscountLabel(v.discountLabel);
    setDescription(v.description);
    setTerms(v.terms);
    setPointsCost(v.pointsCost);
    setTotalQuantity(v.totalQuantity);
    setMaxPerUser(v.maxPerUser);
    setValidUntil(toDateInputValue(v.validUntil));
    setModalOpen(true);
  };

  const handleSaveVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const endOfDay = new Date(`${validUntil}T23:59:59+07:00`).toISOString();
      const payload = {
        destinationId,
        title: title.trim(),
        discountLabel: discountLabel.trim(),
        description: description.trim() || undefined,
        terms: terms.trim(),
        pointsCost: Number(pointsCost) || 0,
        totalQuantity: Number(totalQuantity) || 1,
        maxPerUser: Number(maxPerUser) || 1,
        validUntil: endOfDay,
      };
      if (editing) {
        await api.patch(`/admin/partner/vouchers/${editing.id}`, payload);
        toast.success('Đã cập nhật chương trình ưu đãi!');
      } else {
        await api.post('/admin/partner/vouchers', payload);
        toast.success('Đã phát hành Voucher ưu đãi mới!');
      }
      setModalOpen(false);
      query.reload();
      onChanged();
    } catch (err) {
      toast.error(toApiError(err).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (v: PartnerVoucherItem) => {
    setTogglingId(v.id);
    try {
      const next = v.status === 'active' ? 'paused' : 'active';
      await api.patch(`/admin/partner/vouchers/${v.id}`, { status: next });
      toast.success(next === 'active' ? 'Đã mở lại phát hành ưu đãi!' : 'Đã tạm ngừng phát hành mới.');
      query.reload();
      onChanged();
    } catch (err) {
      toast.error(toApiError(err).message);
    } finally {
      setTogglingId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await api.delete<{ message?: string }>(`/admin/partner/vouchers/${deleteTarget.id}`);
      toast.success(res.data?.message || 'Đã xử lý chương trình ưu đãi!');
      setDeleteTarget(null);
      query.reload();
      onChanged();
    } catch (err) {
      toast.error(toApiError(err).message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mt-6 space-y-6">
      {/* 1. Counter Redemption Verifier */}
      <Card className="p-5 sm:p-6 border-2 border-leaf-300 bg-gradient-to-br from-leaf-50/70 via-white to-sand-50">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-sand-200 pb-3">
          <div>
            <h3 className="font-bold text-base sm:text-lg text-river-900 flex items-center gap-2">
              <QrCode className="size-5 shrink-0 text-leaf-700" />
              Quầy Đối Soát Mã Voucher Du Khách (Chống dùng trùng tức thì)
            </h3>
            <p className="text-xs text-river-600 mt-0.5">
              Nhập mã <strong>VCH-XXXX-XXXX</strong> từ Hộ chiếu Sen Hồng của du khách để kiểm tra hiệu lực và xác nhận áp dụng tại quầy vé <strong>{destinationName}</strong>.
            </p>
          </div>
          <Badge tone="leaf" icon={<ShieldCheck className="size-3.5" />}>
            Atomic Anti-Double-Spend
          </Badge>
        </div>

        <form onSubmit={handleLookup} className="mt-4 flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-river-400" />
            <Input
              value={lookupCode}
              onChange={(e) => setLookupCode(e.target.value.toUpperCase())}
              placeholder="Nhập mã ưu đãi (VD: VCH-AB12-CD34)"
              className="pl-9 font-mono uppercase tracking-wider font-bold"
            />
          </div>
          <Button type="submit" variant="primary" loading={lookupLoading} icon={<Search className="size-4" />}>
            Kiểm tra mã
          </Button>
        </form>

        {lookupResult && (
          <div
            className={clsx(
              'mt-4 rounded-2xl border-2 p-4 space-y-3',
              lookupResult.canRedeem
                ? 'border-emerald-400 bg-emerald-50/70'
                : 'border-red-300 bg-red-50/70',
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {lookupResult.canRedeem ? (
                  <CheckCircle2 className="size-5 text-emerald-700" />
                ) : (
                  <XCircle className="size-5 text-red-600" />
                )}
                <span className="font-mono font-black text-base text-river-950">
                  {lookupResult.claimCode}
                </span>
                <Badge tone={lookupResult.canRedeem ? 'leaf' : 'red'}>
                  {lookupResult.status === 'issued'
                    ? 'Hợp lệ · Chưa sử dụng'
                    : lookupResult.status === 'redeemed'
                      ? 'Đã sử dụng trước đó'
                      : 'Đã hết hạn'}
                </Badge>
              </div>
              <span className="rounded-full bg-lotus-600 px-3 py-1 text-xs font-extrabold text-white">
                {lookupResult.discountLabel}
              </span>
            </div>

            <div className="grid gap-1.5 text-xs text-river-800 sm:grid-cols-2">
              <p>
                <strong>Chương trình:</strong> {lookupResult.voucherTitle}
              </p>
              <p>
                <strong>Du khách:</strong> {lookupResult.visitorName} ({lookupResult.pointsSpent} EXP)
              </p>
              <p>
                <strong>Hạn dùng:</strong> {formatDateTime(lookupResult.expiresAt)}
              </p>
              {lookupResult.redeemedAt && (
                <p className="text-red-700 font-semibold">
                  <strong>Đã gạch mã lúc:</strong> {formatDateTime(lookupResult.redeemedAt)}
                </p>
              )}
            </div>

            <p className="rounded-lg bg-white/80 p-2.5 text-[11px] text-river-700 border border-sand-200">
              <strong>Điều kiện áp dụng:</strong> {lookupResult.terms}
            </p>

            {lookupResult.canRedeem && (
              <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-emerald-200">
                <Input
                  value={redeemNote}
                  onChange={(e) => setRedeemNote(e.target.value)}
                  placeholder="Ghi chú quầy vé (tuỳ chọn, VD: Hóa đơn #128 - Quầy 1)"
                  className="text-xs flex-1"
                />
                <Button
                  type="button"
                  variant="primary"
                  loading={redeeming}
                  onClick={handleRedeem}
                  icon={<CheckCircle2 className="size-4" />}
                >
                  Xác nhận áp dụng (Gạch mã)
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* 2. Voucher Catalog */}
      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sand-200 pb-4">
          <div>
            <h3 className="font-bold text-lg text-river-900 flex items-center gap-2">
              <Gift className="size-5 text-lotus-600" />
              Chương Trình Voucher & Ưu Đãi Đổi Điểm EXP
            </h3>
            <p className="text-xs text-river-600 mt-0.5">
              Biến điểm Hộ chiếu Sen Hồng của du khách thành lượt mua vé, thuê xuồng, dùng ẩm thực tại <strong>{destinationName}</strong>. Minh bạch điều kiện & thời hạn theo Luật BVQLNTD 2023.
            </p>
          </div>
          <Button variant="primary" size="sm" onClick={openCreate} icon={<Plus className="size-4" />}>
            Phát hành Voucher mới
          </Button>
        </div>

        {query.loading ? (
          <PageLoader />
        ) : query.error ? (
          <ErrorState error={query.error} onRetry={query.reload} />
        ) : items.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-sand-300 bg-sand-50/50 py-10 text-center space-y-2">
            <Ticket className="size-10 mx-auto text-lotus-500/60" />
            <p className="text-sm font-bold text-river-800">Chưa có Voucher ưu đãi nào tại {destinationName}</p>
            <p className="text-xs text-river-500 max-w-md mx-auto">
              Ví dụ: Đổi 50 EXP lấy mã "Giảm 15% vé xuồng ba lá" hoặc "Tặng 1 ly trà sen" để hút du khách quay lại quầy dịch vụ!
            </p>
          </div>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((v) => {
              const isActive = v.status === 'active' && !v.isExpired;
              return (
                <div
                  key={v.id}
                  className={clsx(
                    'rounded-2xl border p-4 flex flex-col justify-between gap-3 transition',
                    isActive ? 'border-sand-200 bg-white shadow-xs' : 'border-sand-200 bg-sand-50/70 opacity-80',
                  )}
                >
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <span className="rounded-full bg-lotus-600 px-2.5 py-0.5 text-xs font-extrabold text-white">
                        {v.discountLabel}
                      </span>
                      <Badge tone={isActive ? 'leaf' : v.isExpired ? 'red' : 'neutral'}>
                        {v.isExpired ? 'Hết hạn' : v.status === 'active' ? 'Đang mở' : 'Tạm ngừng'}
                      </Badge>
                    </div>

                    <div>
                      <h4 className="font-bold text-river-900 text-sm">{v.title}</h4>
                      {v.description && (
                        <p className="mt-0.5 text-xs text-river-600 line-clamp-2">{v.description}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-sand-50 p-2 text-center text-[11px] border border-sand-200">
                      <div>
                        <p className="text-river-500">Chi phí</p>
                        <p className="font-bold text-leaf-800">{v.pointsCost} EXP</p>
                      </div>
                      <div>
                        <p className="text-river-500">Đã đổi</p>
                        <p className="font-bold text-river-900">
                          {v.claimedCount}/{v.totalQuantity}
                        </p>
                      </div>
                      <div>
                        <p className="text-river-500">Đã dùng</p>
                        <p className="font-bold text-teal-700">{v.redeemedCount}</p>
                      </div>
                    </div>

                    <p className="text-[11px] text-river-500 flex items-center gap-1">
                      <Clock className="size-3" /> HSD: {formatDate(v.validUntil)} · Tối đa {v.maxPerUser}/khách
                    </p>
                  </div>

                  <div className="pt-2.5 border-t border-sand-200 flex flex-wrap items-center gap-1.5">
                    <Button size="sm" variant="secondary" onClick={() => openEdit(v)} icon={<PenLine className="size-3.5" />}>
                      Sửa
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={togglingId === v.id}
                      onClick={() => handleToggleStatus(v)}
                      icon={
                        v.status === 'active' ? (
                          <PauseCircle className="size-3.5 text-amber-600" />
                        ) : (
                          <PlayCircle className="size-3.5 text-leaf-700" />
                        )
                      }
                    >
                      {v.status === 'active' ? 'Tạm ngừng' : 'Mở lại'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDeleteTarget(v)}
                      icon={<Trash2 className="size-3.5 text-red-600" />}
                    >
                      Xóa
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* 3. Recent Claims / Redemptions Feed */}
      {recentClaims.length > 0 && (
        <Card className="p-5 sm:p-6">
          <h4 className="font-bold text-sm text-river-900 mb-3">
            Lịch sử Du khách Đổi & Đối soát Voucher gần đây (Ẩn danh theo NĐ 13/2023)
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-sand-200 bg-sand-50 text-[11px] font-bold uppercase text-river-600">
                  <th className="py-2 px-3">Mã Voucher</th>
                  <th className="py-2 px-3">Ưu đãi</th>
                  <th className="py-2 px-3">Du khách</th>
                  <th className="py-2 px-3">Trạng thái</th>
                  <th className="py-2 px-3">Thời gian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-200">
                {recentClaims.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2.5 px-3 font-mono font-bold text-river-900">{c.claimCode}</td>
                    <td className="py-2.5 px-3">
                      <span className="font-semibold text-river-900">{c.discountLabel}</span>
                      <span className="block text-[11px] text-river-500">{c.voucherTitle}</span>
                    </td>
                    <td className="py-2.5 px-3 text-river-700">{c.visitorName}</td>
                    <td className="py-2.5 px-3">
                      <Badge
                        tone={
                          c.status === 'redeemed' ? 'leaf' : c.status === 'issued' ? 'teal' : 'neutral'
                        }
                      >
                        {c.status === 'redeemed'
                          ? 'Đã đối soát'
                          : c.status === 'issued'
                            ? 'Chờ dùng tại quầy'
                            : 'Hết hạn'}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 text-river-500">
                      {c.redeemedAt ? `Dùng: ${formatDateTime(c.redeemedAt)}` : `Đổi: ${formatDateTime(c.createdAt)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Create / Edit Voucher Modal */}
      <Modal
        open={modalOpen}
        size="lg"
        title={editing ? `Chỉnh sửa Voucher — ${destinationName}` : `Phát hành Voucher Mới — ${destinationName}`}
        onClose={() => setModalOpen(false)}
      >
        <form onSubmit={handleSaveVoucher} className="space-y-4">
          <div className="rounded-xl border border-leaf-200 bg-leaf-50/70 p-3 text-xs text-leaf-900">
            <strong>Tuân thủ Luật Bảo vệ quyền lợi người tiêu dùng 2023 & NĐ 81/2018:</strong> Bắt buộc ghi rõ mức ưu đãi, số lượng phát hành, thời hạn và điều kiện áp dụng minh bạch. Các mã du khách đã đổi sẽ luôn được bảo toàn điều kiện tại thời điểm đổi.
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold uppercase text-river-700 mb-1">
                Tên chương trình ưu đãi *
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: Ưu đãi Trải nghiệm Xuồng Ba Lá Mùa Sen"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-river-700 mb-1">
                Nhãn mức giảm / Quà tặng *
              </label>
              <Input
                value={discountLabel}
                onChange={(e) => setDiscountLabel(e.target.value)}
                placeholder="VD: Giảm 20% · Tặng 1 trà sen"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-river-700 mb-1">
              Mô tả ngắn hấp dẫn
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Áp dụng cho du khách check-in Hộ chiếu Sen Hồng tại điểm..."
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <label className="block text-xs font-bold uppercase text-river-700 mb-1">
                Điểm đổi (EXP) *
              </label>
              <Input
                type="number"
                min={0}
                max={5000}
                value={pointsCost}
                onChange={(e) => setPointsCost(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-river-700 mb-1">
                Tổng số lượng *
              </label>
              <Input
                type="number"
                min={editing ? Math.max(1, editing.claimedCount) : 1}
                max={50000}
                value={totalQuantity}
                onChange={(e) => setTotalQuantity(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-river-700 mb-1">
                Tối đa / khách *
              </label>
              <Input
                type="number"
                min={1}
                max={5}
                value={maxPerUser}
                onChange={(e) => setMaxPerUser(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-river-700 mb-1">
                Hạn sử dụng *
              </label>
              <Input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-river-700 mb-1">
              Điều kiện áp dụng công khai (tối thiểu 10 ký tự) *
            </label>
            <textarea
              rows={3}
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              className="w-full rounded-control border border-sand-300 bg-white p-2.5 text-sm text-river-800 focus:border-leaf-600 focus:outline-none"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-sand-200">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Hủy
            </Button>
            <Button type="submit" variant="primary" loading={submitting}>
              {editing ? 'Lưu cập nhật' : 'Phát hành Voucher'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xác nhận gỡ chương trình ưu đãi?"
        message={
          deleteTarget && deleteTarget.claimedCount > 0 ? (
            <p>
              Ưu đãi <strong>{deleteTarget.title}</strong> đã có <strong>{deleteTarget.claimedCount}</strong> lượt du khách đổi. Theo Luật Bảo vệ người tiêu dùng, hệ thống sẽ chuyển sang <strong>Tạm ngừng phát hành mới</strong> để các mã đã cấp vẫn được sử dụng đến hết hạn.
            </p>
          ) : (
            <p>
              Bạn có chắc muốn xóa vĩnh viễn ưu đãi <strong>{deleteTarget?.title}</strong>?
            </p>
          )
        }
        confirmLabel="Xác nhận"
        tone="danger"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
