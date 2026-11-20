import clsx from 'clsx';
import { Check, Clock, Copy, Gift, MapPin, Ticket } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApiQuery } from '../../hooks/useApiQuery';
import { api } from '../../lib/api';
import { formatDate, formatDateTime } from '../../lib/format';
import { useAuthStore } from '../../stores/authStore';
import { toast } from '../../stores/toastStore';
import type { ExpBalance, MyVoucherClaimItem } from '../../types/api';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';

export function PassportVoucherWallet() {
  const user = useAuthStore((s) => s.user);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const query = useApiQuery<{
    success: boolean;
    balance: ExpBalance;
    items: MyVoucherClaimItem[];
  }>(
    (signal) => {
      if (!user) return Promise.resolve({ success: true, balance: { totalEarnedExp: 0, totalSpentExp: 0, spendableExp: 0 }, items: [] });
      return api.get('/passport/vouchers', { signal }).then((r) => r.data);
    },
    [user?.id],
  );

  if (!user) return null;

  const items = query.data?.items || [];
  const balance = query.data?.balance;

  const handleCopy = async (id: string, code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      toast.success(`Đã sao chép mã ${code}`);
      setTimeout(() => setCopiedId(null), 1600);
    } catch {
      toast.error('Không thể sao chép mã.');
    }
  };

  return (
    <section className="mt-10" aria-labelledby="voucher-wallet-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Đặc quyền đổi điểm</p>
          <h2 id="voucher-wallet-heading" className="mt-1 text-2xl flex items-center gap-2">
            <Gift className="size-6 text-lotus-600" aria-hidden />
            Ví Voucher & Ưu đãi KDL ({items.length})
          </h2>
        </div>

        {balance && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge tone="leaf">Khả dụng: {balance.spendableExp.toLocaleString()} EXP</Badge>
            <Badge tone="neutral">Đã dùng đổi quà: {balance.totalSpentExp.toLocaleString()} EXP</Badge>
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <Card className="mt-4 p-6 text-center border-dashed border-2 border-sand-300 bg-sand-50/50">
          <Ticket className="size-9 mx-auto text-lotus-500/70 mb-2" />
          <p className="text-sm font-bold text-river-900">Bạn chưa đổi ưu đãi nào từ các Khu Du Lịch</p>
          <p className="text-xs text-river-600 mt-1 max-w-md mx-auto">
            Ghé trang chi tiết các điểm đến tại Đồng Tháp để dùng điểm EXP tích lũy đổi mã giảm giá vé xuồng, trà sen và combo trải nghiệm!
          </p>
          <Link
            to="/destinations"
            className="mt-3 inline-flex items-center justify-center rounded-control bg-leaf-700 px-4 py-2 text-xs font-bold text-white hover:bg-leaf-800"
          >
            Khám phá điểm đến có ưu đãi →
          </Link>
        </Card>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((claim) => {
            const usable = claim.status === 'issued';
            return (
              <Card
                key={claim.id}
                className={clsx(
                  'p-4 flex flex-col justify-between gap-3 transition',
                  usable ? 'border-lotus-300 bg-white' : 'border-sand-200 bg-sand-50/70 opacity-75',
                )}
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <span className="rounded-full bg-lotus-600 px-2.5 py-0.5 text-xs font-extrabold text-white">
                      {claim.discountLabel}
                    </span>
                    <Badge
                      tone={usable ? 'leaf' : claim.status === 'redeemed' ? 'teal' : 'neutral'}
                    >
                      {usable
                        ? 'Sẵn sàng tại quầy'
                        : claim.status === 'redeemed'
                          ? 'Đã sử dụng'
                          : 'Hết hạn'}
                    </Badge>
                  </div>

                  <h3 className="font-bold text-sm text-river-900">{claim.voucherTitle}</h3>

                  {claim.destination && (
                    <Link
                      to={`/destinations/${claim.destination.slug}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-leaf-700 hover:underline"
                    >
                      <MapPin className="size-3.5" /> {claim.destination.name}
                    </Link>
                  )}

                  <div className="flex items-center justify-between gap-2 rounded-xl border border-dashed border-leaf-400 bg-leaf-50/60 px-3 py-2">
                    <span className="font-mono font-black text-sm tracking-wider text-river-950">
                      {claim.claimCode}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(claim.id, claim.claimCode)}
                      className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[11px] font-bold text-river-800 border border-sand-200 hover:bg-sand-100"
                    >
                      {copiedId === claim.id ? (
                        <Check className="size-3 text-leaf-700" />
                      ) : (
                        <Copy className="size-3" />
                      )}
                      {copiedId === claim.id ? 'Đã chép' : 'Chép'}
                    </button>
                  </div>

                  <p className="text-[11px] text-river-500 leading-relaxed line-clamp-2">
                    {claim.terms}
                  </p>
                </div>

                <div className="pt-2 border-t border-sand-200 flex items-center justify-between text-[11px] text-river-500">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3" /> HSD: {formatDate(claim.expiresAt)}
                  </span>
                  {claim.redeemedAt ? (
                    <span className="text-teal-700 font-semibold">
                      Dùng: {formatDateTime(claim.redeemedAt)}
                    </span>
                  ) : (
                    <span>-{claim.pointsSpent} EXP</span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
