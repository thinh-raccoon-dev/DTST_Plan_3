import clsx from 'clsx';
import { Compass, Eye, Footprints, Landmark, Lightbulb, MapPinCheck, QrCode, RefreshCw, Smartphone, Stamp, Trophy } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { announceBadges } from '../components/challenge/ChallengeQuiz';
import { PageContainer } from '../components/layout/PublicLayout';
import { Button, ButtonLink } from '../components/ui/Button';
import { Card, SectionHeading, StatCard } from '../components/ui/Card';
import { EmptyState, ErrorState, Notice, PageLoader } from '../components/ui/States';
import { useApiQuery } from '../hooks/useApiQuery';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { api, toApiError } from '../lib/api';
import { formatDateTime, formatNumber } from '../lib/format';
import { useAuthStore } from '../stores/authStore';
import { toast } from '../stores/toastStore';
import type { BadgeInfo, Passport } from '../types/api';

const badgeIcons: Record<BadgeInfo['icon'], typeof Trophy> = {
  footprints: Footprints,
  compass: Compass,
  lightbulb: Lightbulb,
  trophy: Trophy,
  landmark: Landmark,
};

export function PassportPage() {
  useDocumentTitle('Hộ chiếu trải nghiệm');
  const user = useAuthStore((s) => s.user);
  const query = useApiQuery((signal) => api.get<Passport>('/passport/me', { signal }).then((r) => r.data), [user?.id]);
  const [claiming, setClaiming] = useState(false);

  if (query.loading && !query.data) return <PageContainer><PageLoader /></PageContainer>;
  if (query.error || !query.data) return <PageContainer><ErrorState error={query.error} onRetry={query.reload} /></PageContainer>;
  const p = query.data;
  const isEmpty = p.totals.checkIns + p.totals.completedChallenges + p.totals.qrContentsOpened === 0;
  const percent = p.progress.total > 0 ? Math.round((p.progress.explored / p.progress.total) * 100) : 0;

  const claim = async () => {
    setClaiming(true);
    try {
      const res = await api.post<{ claimed: number; skipped: number; newBadges: BadgeInfo[] }>('/passport/claim');
      toast.success(
        'Đã đồng bộ hộ chiếu',
        `${res.data.claimed} mục được chuyển vào tài khoản${res.data.skipped ? `, ${res.data.skipped} mục trùng đã được bỏ qua (không cộng điểm hai lần)` : ''}.`,
      );
      announceBadges(res.data.newBadges);
      query.reload();
    } catch (error) {
      toast.error('Không đồng bộ được', toApiError(error).message);
    } finally {
      setClaiming(false);
    }
  };

  return (
    <PageContainer>
      <SectionHeading
        as="h1"
        title="Hộ chiếu trải nghiệm số"
        description="Điểm đã khám phá = điểm bạn đã check-in hoặc hoàn thành thử thách. Chỉ mở trang hay mở QR không được tính là khám phá."
      />

      <div className="mt-5 space-y-3">
        {p.mode === 'device' ? (
          <Notice tone="warning" icon={<Smartphone className="size-4" aria-hidden />} title="Dữ liệu đang gắn với trình duyệt này">
            Hộ chiếu chưa được đồng bộ vào tài khoản và có thể mất khi bạn xóa cookie/dữ liệu trình duyệt.{' '}
            <Link to="/login" state={{ from: '/passport' }} className="font-semibold underline">Đăng nhập</Link> hoặc{' '}
            <Link to="/register" className="font-semibold underline">tạo tài khoản</Link> để đồng bộ.
          </Notice>
        ) : (
          p.pendingDeviceEntries > 0 && (
            <Notice tone="info" icon={<RefreshCw className="size-4" aria-hidden />} title={`Có ${p.pendingDeviceEntries} mục trên trình duyệt này chưa đồng bộ`}>
              <p>Bạn đã check-in hoặc hoàn thành thử thách khi chưa đăng nhập. Đồng bộ để chuyển vào tài khoản; mục trùng sẽ không được cộng điểm lần nữa.</p>
              <Button size="sm" className="mt-3" onClick={claim} loading={claiming}>
                Đồng bộ vào tài khoản
              </Button>
            </Notice>
          )
        )}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Tổng điểm" value={formatNumber(p.totals.points)} icon={<Trophy className="size-5 text-teal-500" aria-hidden />} />
        <StatCard label="Điểm đã khám phá" value={p.totals.exploredDestinations} icon={<Compass className="size-5" aria-hidden />} />
        <StatCard label="Thử thách hoàn thành" value={p.totals.completedChallenges} icon={<Lightbulb className="size-5" aria-hidden />} />
        <StatCard label="Huy hiệu" value={`${p.totals.badges}/${p.badges.length}`} icon={<Stamp className="size-5" aria-hidden />} />
      </div>

      <Card className="mt-4 p-5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-river-800">Tiến trình điểm thí điểm có QR</span>
          <span className="text-river-600">
            {p.progress.explored}/{p.progress.total}
          </span>
        </div>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-sand-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label="Tiến trình khám phá">
          <div className="h-full rounded-full bg-leaf-500 transition-[width]" style={{ width: `${percent}%` }} />
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          {[
            { icon: Eye, label: 'Đã mở trang địa điểm', value: p.totals.destinationsViewed },
            { icon: QrCode, label: 'Đã mở nội dung từ QR', value: p.totals.qrContentsOpened },
            { icon: MapPinCheck, label: 'Đã check-in', value: p.totals.checkIns },
            { icon: Trophy, label: 'Đã hoàn thành thử thách', value: p.totals.completedChallenges },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="rounded-control bg-sand-50 p-3">
              <dt className="flex items-center gap-1.5 text-xs text-river-600">
                <Icon className="size-3.5" aria-hidden />
                {label}
              </dt>
              <dd className="mt-1 text-lg font-bold text-river-900">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {isEmpty && (
        <div className="mt-6">
          <EmptyState
            icon={<Stamp className="size-6" aria-hidden />}
            title="Hộ chiếu của bạn còn trống"
            description="Quét mã QR tại điểm đến thí điểm để check-in và tham gia thử thách đầu tiên."
            action={<ButtonLink to="/scan">Quét mã QR</ButtonLink>}
          />
        </div>
      )}

      <section className="mt-10" aria-labelledby="badges-heading">
        <h2 id="badges-heading" className="text-xl">Huy hiệu</h2>
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {p.badges.map((badge) => {
            const Icon = badgeIcons[badge.icon];
            return (
              <li key={badge.key} className={clsx('rounded-card border p-4 text-center', badge.earned ? 'border-teal-200 bg-teal-50' : 'border-dashed border-sand-300 bg-white')}>
                <span className={clsx('mx-auto flex size-14 items-center justify-center rounded-full', badge.earned ? 'bg-teal-500 text-white' : 'bg-sand-100 text-sand-300')}>
                  <Icon className="size-7" aria-hidden />
                </span>
                <p className={clsx('mt-3 text-sm font-semibold', badge.earned ? 'text-river-900' : 'text-river-500')}>{badge.name}</p>
                <p className="mt-1 text-xs text-river-500">{badge.description}</p>
                <p className="mt-2 text-xs font-medium">{badge.earned ? <span className="text-teal-700">Đạt {formatDateTime(badge.awardedAt)}</span> : <span className="text-river-400">Chưa đạt</span>}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-lg">Địa điểm đã check-in</h2>
          {p.checkIns.length === 0 ? (
            <p className="mt-2 text-sm text-river-500">Chưa có check-in nào.</p>
          ) : (
            <ul className="mt-3 divide-y divide-sand-200">
              {p.checkIns.map((c, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span className="min-w-0">
                    {c.destination ? (
                      <Link to={`/destinations/${c.destination.slug}`} className="font-medium text-river-900 hover:text-leaf-700">{c.destination.name}</Link>
                    ) : (
                      <span className="text-river-500">Địa điểm đã bị xóa</span>
                    )}
                    <span className="block text-xs text-river-500">{formatDateTime(c.completedAt)}</span>
                  </span>
                  <span className="shrink-0 font-semibold text-teal-700">+{c.scoreAwarded}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-5">
          <h2 className="text-lg">Thử thách đã hoàn thành</h2>
          {p.completions.length === 0 ? (
            <p className="mt-2 text-sm text-river-500">Chưa hoàn thành thử thách nào.</p>
          ) : (
            <ul className="mt-3 divide-y divide-sand-200">
              {p.completions.map((c, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span className="min-w-0">
                    <span className="font-medium text-river-900">{c.challenge?.title ?? 'Thử thách đã bị xóa'}</span>
                    <span className="block text-xs text-river-500">
                      {c.destination?.name ?? '—'} · đúng {c.correctCount ?? '?'}/{c.totalQuestions ?? '?'} · {formatDateTime(c.completedAt)}
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold text-teal-700">+{c.scoreAwarded}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {p.qrOpened.length > 0 && (
        <Card className="mt-6 p-5">
          <h2 className="text-lg">Đã mở nội dung từ QR</h2>
          <p className="mt-1 text-xs text-river-500">Mở nội dung QR không đồng nghĩa với check-in hay hoàn thành thử thách.</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {p.qrOpened.map((d) => (
              <li key={d.id}>
                <Link to={`/destinations/${d.slug}`} className="inline-flex min-h-9 items-center rounded-full border border-sand-300 bg-white px-3 text-sm hover:border-leaf-400">
                  {d.name}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </PageContainer>
  );
}
