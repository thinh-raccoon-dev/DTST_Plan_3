import {
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Gift,
  Send,
  ShieldCheck,
  Tag,
  Ticket,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApiQuery } from '../../hooks/useApiQuery';
import { api, toApiError } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { useAuthStore } from '../../stores/authStore';
import { toast } from '../../stores/toastStore';
import type {
  DestinationServiceItem,
  ExpBalance,
  PublicVoucherItem,
  ServiceCategory,
} from '../../types/api';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Input } from '../ui/Field';
import { Modal } from '../ui/Modal';

const SERVICE_CAT_LABELS: Record<ServiceCategory, string> = {
  ticket: 'Vé vào cổng',
  combo: 'Combo trọn gói',
  activity: 'Trải nghiệm',
  food: 'Ẩm thực',
  guide: 'Hướng dẫn viên',
  other: 'Dịch vụ',
};

function formatVnd(v: number) {
  return v === 0 ? 'Miễn phí' : `${v.toLocaleString('vi-VN')} đ`;
}

interface DestinationPartnerCommerceSectionProps {
  destinationSlug: string;
  destinationName: string;
  services?: DestinationServiceItem[];
}

export function DestinationPartnerCommerceSection({
  destinationSlug,
  destinationName,
  services = [],
}: DestinationPartnerCommerceSectionProps) {
  const user = useAuthStore((s) => s.user);

  // Vouchers
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimedPopup, setClaimedPopup] = useState<{
    claimCode: string;
    voucherTitle: string;
    discountLabel: string;
    terms: string;
    expiresAt: string;
  } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Group Inquiry Modal
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [contactName, setContactName] = useState(user?.displayName || '');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState(user?.email || '');
  const [visitDate, setVisitDate] = useState(() => {
    const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 10);
  });
  const [groupSize, setGroupSize] = useState(10);
  const [serviceInterest, setServiceInterest] = useState('');
  const [notes, setNotes] = useState('');
  const [consentGiven, setConsentGiven] = useState(false);
  const [submittingInquiry, setSubmittingInquiry] = useState(false);

  const vouchersQuery = useApiQuery<{
    success: boolean;
    balance: ExpBalance | null;
    items: PublicVoucherItem[];
  }>(
    (signal) =>
      api.get(`/destinations/${destinationSlug}/vouchers`, { signal }).then((r) => r.data),
    [destinationSlug, user?.id],
  );

  const vouchers = vouchersQuery.data?.items || [];
  const balance = vouchersQuery.data?.balance || null;

  const handleClaimVoucher = async (voucher: PublicVoucherItem) => {
    if (!user) {
      toast.info('Vui lòng đăng nhập để đổi điểm Hộ chiếu Sen Hồng lấy ưu đãi!');
      return;
    }
    setClaimingId(voucher.id);
    try {
      const res = await api.post<{
        success: boolean;
        claim: {
          claimCode: string;
          voucherTitle: string;
          discountLabel: string;
          terms: string;
          expiresAt: string;
        };
        message: string;
      }>(`/vouchers/${voucher.id}/claim`);
      setClaimedPopup(res.data.claim);
      toast.success(res.data.message);
      vouchersQuery.reload();
    } catch (err) {
      toast.error(toApiError(err).message);
    } finally {
      setClaimingId(null);
    }
  };

  const handleCopyClaimCode = async () => {
    if (!claimedPopup) return;
    try {
      await navigator.clipboard.writeText(claimedPopup.claimCode);
      setCopiedCode(true);
      toast.success('Đã sao chép mã ưu đãi!');
      setTimeout(() => setCopiedCode(false), 1800);
    } catch {
      toast.error('Không thể sao chép mã.');
    }
  };

  const handleSubmitInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consentGiven) {
      toast.error(
        'Bạn cần tích đồng ý chia sẻ thông tin liên hệ với Ban Quản lý KDL theo Nghị định 13/2023/NĐ-CP.',
      );
      return;
    }
    setSubmittingInquiry(true);
    try {
      const res = await api.post<{ success: boolean; message: string }>(
        `/destinations/${destinationSlug}/inquiries`,
        {
          contactName: contactName.trim(),
          contactPhone: contactPhone.trim(),
          contactEmail: contactEmail.trim() || undefined,
          visitDate: new Date(`${visitDate}T09:00:00+07:00`).toISOString(),
          groupSize: Number(groupSize) || 1,
          serviceInterest: serviceInterest.trim() || undefined,
          notes: notes.trim() || undefined,
          consentGiven: true,
        },
      );
      toast.success(res.data.message);
      setInquiryOpen(false);
      setNotes('');
      setConsentGiven(false);
    } catch (err) {
      toast.error(toApiError(err).message);
    } finally {
      setSubmittingInquiry(false);
    }
  };

  const openInquiryWithService = (srvName?: string) => {
    setContactName(user?.displayName || contactName);
    setContactEmail(user?.email || contactEmail);
    if (srvName) setServiceInterest(srvName);
    setInquiryOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* 1. Structured Official Price & Combo Catalog */}
      {services.length > 0 && (
        <Card className="p-5 sm:p-6 border-leaf-200/80">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold text-river-900">
                <Tag className="size-5 text-leaf-700" aria-hidden />
                Bảng giá Vé, Combo & Dịch vụ Niêm yết
              </h2>
              <p className="mt-0.5 text-xs text-river-600">
                Giá công khai trực tiếp từ Ban Quản lý {destinationName} theo Luật Giá 2023.
              </p>
            </div>
            <Badge tone="leaf">Niêm yết chính thức</Badge>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {services.map((s) => (
              <div
                key={s.id}
                className="rounded-xl border border-sand-200 bg-sand-50/60 p-4 flex flex-col justify-between gap-2.5"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-leaf-700">
                      {SERVICE_CAT_LABELS[s.category] || s.category}
                    </span>
                    <span className="text-[11px] text-river-500">
                      {s.includesVat ? '✓ Gồm VAT' : 'Chưa gồm VAT'}
                    </span>
                  </div>
                  <h3 className="font-bold text-river-900 text-sm">{s.name}</h3>
                  {s.description && <p className="text-xs text-river-600">{s.description}</p>}
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-sand-200">
                  <div>
                    <span className="text-base font-black text-leaf-800">{formatVnd(s.priceVnd)}</span>
                    <span className="text-xs text-river-500"> / {s.unit}</span>
                    {s.durationMinutes && (
                      <span className="ml-2 text-[11px] text-river-500">· ~{s.durationMinutes}p</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => openInquiryWithService(s.name)}
                    className="text-xs font-bold text-leaf-700 hover:underline"
                  >
                    Đặt đoàn →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 2. Partner EXP Vouchers */}
      {vouchers.length > 0 && (
        <Card className="p-5 sm:p-6 border-lotus-200/80 bg-gradient-to-br from-lotus-50/40 via-white to-sand-50/60">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold text-river-900">
                <Gift className="size-5 text-lotus-600" aria-hidden />
                Ưu đãi Đổi điểm Hộ chiếu Sen Hồng tại điểm
              </h2>
              <p className="mt-0.5 text-xs text-river-600">
                Dùng điểm EXP tích lũy từ check-in & giải đố để đổi mã ưu đãi áp dụng trực tiếp tại quầy vé.
              </p>
            </div>
            {balance ? (
              <Badge tone="leaf">Điểm EXP khả dụng: {balance.spendableExp.toLocaleString()} EXP</Badge>
            ) : (
              <Link to="/login" className="text-xs font-bold text-lotus-700 hover:underline">
                Đăng nhập để đổi ưu đãi →
              </Link>
            )}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {vouchers.map((v) => {
              const notEnoughExp = balance !== null && balance.spendableExp < v.pointsCost;
              const disabled = !v.canClaimMore || (Boolean(user) && notEnoughExp);
              return (
                <div
                  key={v.id}
                  className="rounded-2xl border border-lotus-200/80 bg-white p-4 shadow-xs flex flex-col justify-between gap-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-full bg-lotus-600 px-2.5 py-0.5 text-xs font-extrabold text-white">
                        {v.discountLabel}
                      </span>
                      <span className="text-xs font-bold text-leaf-800">
                        {v.pointsCost === 0 ? 'Miễn phí EXP' : `${v.pointsCost} EXP`}
                      </span>
                    </div>
                    <h3 className="font-bold text-sm text-river-900">{v.title}</h3>
                    {v.description && <p className="text-xs text-river-600">{v.description}</p>}
                    <p className="text-[11px] text-river-500 leading-relaxed">
                      <strong>Điều kiện:</strong> {v.terms}
                    </p>
                    <p className="text-[11px] text-river-500 flex items-center gap-2 pt-1">
                      <Clock className="size-3" /> HSD: {formatDate(v.validUntil)} · Còn {v.remaining} mã
                    </p>
                  </div>

                  <div className="pt-2 border-t border-sand-200 flex items-center justify-between gap-2">
                    {v.myClaimCount > 0 ? (
                      <Link to="/passport" className="text-xs font-semibold text-teal-700 hover:underline">
                        Bạn đã đổi ({v.myClaimCount}/{v.maxPerUser}) · Xem ví →
                      </Link>
                    ) : (
                      <span className="text-[11px] text-river-500">Tối đa {v.maxPerUser}/tài khoản</span>
                    )}

                    <Button
                      size="sm"
                      variant="primary"
                      disabled={disabled}
                      loading={claimingId === v.id}
                      onClick={() => handleClaimVoucher(v)}
                      icon={<Ticket className="size-3.5" />}
                    >
                      {!v.canClaimMore
                        ? v.remaining === 0
                          ? 'Hết lượt'
                          : 'Đã đạt giới hạn'
                        : notEnoughExp
                          ? `Thiếu EXP`
                          : 'Đổi ưu đãi'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* 3. Group Booking / Consultation Callout */}
      <Card className="p-5 sm:p-6 border-teal-200/80 bg-gradient-to-r from-leaf-50/70 via-white to-teal-50/60">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="flex items-center gap-2 text-base sm:text-lg font-bold text-river-900">
              <Users className="size-5 text-teal-700" aria-hidden />
              Đi theo đoàn / Gia đình / Công ty đến {destinationName}?
            </h2>
            <p className="text-xs sm:text-sm text-river-600">
              Gửi yêu cầu đặt lịch tham quan, báo giá combo hoặc đặt xuồng trước trực tiếp tới Ban Quản lý cơ sở.
            </p>
          </div>
          <Button
            variant="primary"
            onClick={() => openInquiryWithService()}
            icon={<Send className="size-4" />}
          >
            Đặt đoàn / Tư vấn
          </Button>
        </div>
      </Card>

      {/* Claimed Voucher Code Popup */}
      <Modal
        open={Boolean(claimedPopup)}
        size="sm"
        title="Đổi Ưu Đãi Thành Công!"
        onClose={() => setClaimedPopup(null)}
      >
        {claimedPopup && (
          <div className="space-y-4 text-center">
            <CheckCircle2 className="size-12 mx-auto text-emerald-600" />
            <div>
              <span className="inline-block rounded-full bg-lotus-600 px-3 py-0.5 text-xs font-extrabold text-white">
                {claimedPopup.discountLabel}
              </span>
              <h3 className="mt-2 font-bold text-base text-river-900">{claimedPopup.voucherTitle}</h3>
            </div>

            <div className="rounded-2xl border-2 border-dashed border-leaf-500 bg-leaf-50/70 p-4 space-y-2">
              <p className="text-[11px] uppercase tracking-wider font-bold text-leaf-800">
                Xuất trình mã này tại quầy vé {destinationName}
              </p>
              <p className="font-mono text-2xl font-black tracking-widest text-river-950">
                {claimedPopup.claimCode}
              </p>
              <Button
                size="sm"
                variant="secondary"
                onClick={handleCopyClaimCode}
                icon={copiedCode ? <Check className="size-3.5 text-leaf-700" /> : <Copy className="size-3.5" />}
              >
                {copiedCode ? 'Đã sao chép mã' : 'Sao chép mã'}
              </Button>
            </div>

            <p className="text-xs text-river-600 text-left bg-sand-50 rounded-xl p-3 border border-sand-200">
              <strong>Hạn dùng:</strong> {formatDate(claimedPopup.expiresAt)}
              <br />
              <strong>Điều kiện:</strong> {claimedPopup.terms}
            </p>

            <div className="flex justify-center gap-2">
              <Button variant="secondary" onClick={() => setClaimedPopup(null)}>
                Đóng
              </Button>
              <Link
                to="/passport"
                className="inline-flex items-center justify-center rounded-control bg-leaf-700 px-4 py-2 text-sm font-semibold text-white hover:bg-leaf-800"
              >
                Xem trong Hộ chiếu
              </Link>
            </div>
          </div>
        )}
      </Modal>

      {/* Group Inquiry Modal (NĐ 13/2023 Explicit Consent) */}
      <Modal
        open={inquiryOpen}
        size="md"
        title={`Yêu cầu Đặt đoàn & Báo giá — ${destinationName}`}
        onClose={() => setInquiryOpen(false)}
      >
        <form onSubmit={handleSubmitInquiry} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold uppercase text-river-700 mb-1">
                Họ tên người liên hệ *
              </label>
              <Input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Nguyễn Văn A"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-river-700 mb-1">
                Số điện thoại *
              </label>
              <Input
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="0912 345 678"
                required
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-bold uppercase text-river-700 mb-1">
                Ngày dự kiến *
              </label>
              <Input
                type="date"
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-river-700 mb-1">
                Số lượng khách *
              </label>
              <Input
                type="number"
                min={1}
                max={500}
                value={groupSize}
                onChange={(e) => setGroupSize(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-river-700 mb-1">
                Email (tuỳ chọn)
              </label>
              <Input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="email@domain.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-river-700 mb-1">
              Dịch vụ / Combo quan tâm
            </label>
            <Input
              value={serviceInterest}
              onChange={(e) => setServiceInterest(e.target.value)}
              placeholder="VD: Combo Xuồng ba lá + Cơm trưa đặc sản sen"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-river-700 mb-1">
              Ghi chú yêu cầu thêm
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Nêu rõ giờ đến dự kiến, có người lớn tuổi / trẻ em hoặc yêu cầu thực đơn chay..."
              className="w-full rounded-control border border-sand-300 bg-white p-2.5 text-sm text-river-800 focus:border-leaf-600 focus:outline-none"
            />
          </div>

          {/* Mandatory NĐ 13/2023/NĐ-CP Consent Checkbox */}
          <label className="flex items-start gap-2.5 rounded-xl border border-leaf-200 bg-leaf-50/70 p-3 text-xs text-river-800 cursor-pointer">
            <input
              type="checkbox"
              checked={consentGiven}
              onChange={(e) => setConsentGiven(e.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-leaf-600"
              required
            />
            <span>
              <ShieldCheck className="size-3.5 inline text-leaf-700 mr-1" />
              Tôi đồng ý chia sẻ tên, số điện thoại và thông tin chuyến đi cho{' '}
              <strong>Ban Quản lý {destinationName}</strong> với mục đích duy nhất là liên hệ tư vấn và báo giá theo{' '}
              <strong>Nghị định 13/2023/NĐ-CP</strong> về Bảo vệ dữ liệu cá nhân.
            </span>
          </label>

          <div className="flex justify-end gap-2 pt-2 border-t border-sand-200">
            <Button type="button" variant="secondary" onClick={() => setInquiryOpen(false)}>
              Hủy
            </Button>
            <Button type="submit" variant="primary" loading={submittingInquiry} icon={<Send className="size-4" />}>
              Gửi yêu cầu tới KDL
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
