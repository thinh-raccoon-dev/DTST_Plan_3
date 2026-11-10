import clsx from 'clsx';
import { Award, Compass, Eye, Footprints, Heart, Landmark, Lightbulb, Lock, MapPinCheck, Medal, QrCode, RefreshCw, Smartphone, Sparkles, Stamp, Star, Trophy } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { announceBadges } from '../components/challenge/ChallengeQuiz';
import { PageContainer } from '../components/layout/PublicLayout';
import { DigitalTravelerPass } from '../components/passport/DigitalTravelerPass';
import { Button, ButtonLink } from '../components/ui/Button';
import { Card, StatCard } from '../components/ui/Card';
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
  star: Star,
  medal: Medal,
  award: Award,
  heart: Heart,
  sparkles: Sparkles,
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
      {/* Digital Passport Cover Hero */}
      <section className="tp-fade-up relative overflow-hidden rounded-panel bg-gradient-to-br from-leaf-900 via-leaf-800 to-leaf-600 p-6 text-white shadow-raised sm:p-8">
        <div className="pointer-events-none absolute -right-12 -top-16 size-64 rounded-full bg-teal-300/20 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-20 left-1/4 size-72 rounded-full bg-lotus-300/20 blur-3xl" aria-hidden />
        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold ring-1 ring-white/20">
              <Stamp className="size-3.5 text-teal-200" aria-hidden />
              {user ? `Hộ chiếu của ${user.displayName}` : 'Hộ chiếu trên thiết bị này'}
            </span>
            <h1 className="mt-3 text-3xl text-white sm:text-4xl">Hộ chiếu trải nghiệm số</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-leaf-100 sm:text-base">
              Điểm đã khám phá = điểm bạn đã điểm danh GPS hoặc hoàn thành thử thách. Có mặt trong phạm vi 1.000m tại điểm đến để nhận điểm EXP và mở khóa huy hiệu.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <ButtonLink to="/check-in" variant="inverted" icon={<MapPinCheck className="size-4" aria-hidden />}>
                Điểm danh GPS ngay
              </ButtonLink>
              <ButtonLink to="/destinations?hasActivity=true" variant="outlineInverted" icon={<Compass className="size-4" aria-hidden />}>
                Xem điểm có thử thách
              </ButtonLink>
            </div>
          </div>

          <div className="rounded-3xl bg-white/10 p-5 ring-1 ring-white/20 backdrop-blur-sm lg:min-w-72">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-leaf-100">
              <span>Tiến độ khám phá</span>
              <span className="text-teal-200">{percent}%</span>
            </div>
            <p className="mt-1 text-2xl font-extrabold text-white">
              {p.progress.explored} <span className="text-base font-medium text-leaf-100">/ {p.progress.total} địa điểm</span>
            </p>
            <div
              className="mt-3 h-3 overflow-hidden rounded-full bg-white/15"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              aria-label="Tiến trình khám phá"
            >
              <div
                className="tp-grow-x h-full rounded-full bg-gradient-to-r from-teal-300 via-leaf-300 to-lotus-300 transition-[width] duration-700"
                style={{ width: `${Math.max(4, percent)}%` }}
              />
            </div>
            <p className="mt-2.5 text-xs text-leaf-100">
              Tổng điểm tích lũy: <strong className="text-white">{formatNumber(p.totals.points)} điểm</strong>
            </p>
          </div>
        </div>
      </section>

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

      {/* Digital Traveler Pass (Thẻ Du Hành Số 3D Sen Hồng) */}
      <section className="tp-fade-up mt-8 rounded-panel border border-sand-200 bg-white/95 p-5 shadow-raised backdrop-blur-sm sm:p-8">
        <DigitalTravelerPass user={user} passport={p} />
      </section>

      <div className="mt-8 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <StatCard label="Tổng điểm" value={formatNumber(p.totals.points)} icon={<Trophy className="size-5 text-teal-600" aria-hidden />} />
        <StatCard label="Điểm đã khám phá" value={p.totals.exploredDestinations} icon={<Compass className="size-5" aria-hidden />} />
        <StatCard label="Thử thách hoàn thành" value={p.totals.completedChallenges} icon={<Lightbulb className="size-5" aria-hidden />} />
        <StatCard label="Huy hiệu đạt được" value={`${p.totals.badges}/${p.badges.length}`} icon={<Stamp className="size-5" aria-hidden />} />
      </div>

      <Card className="tp-fade-up mt-5 p-5">
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          {[
            { icon: Eye, label: 'Đã mở trang địa điểm', value: p.totals.destinationsViewed },
            { icon: QrCode, label: 'Đã mở nội dung từ QR', value: p.totals.qrContentsOpened },
            { icon: MapPinCheck, label: 'Đã check-in', value: p.totals.checkIns },
            { icon: Trophy, label: 'Đã hoàn thành thử thách', value: p.totals.completedChallenges },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="rounded-2xl bg-sand-50 p-3.5 transition hover:bg-leaf-50">
              <dt className="flex items-center gap-1.5 text-xs font-medium text-river-600">
                <Icon className="size-4 text-leaf-600" aria-hidden />
                {label}
              </dt>
              <dd className="mt-1.5 text-xl font-extrabold text-river-900">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {isEmpty && (
        <div className="mt-6">
          <EmptyState
            icon={<Stamp className="size-6" aria-hidden />}
            title="Hộ chiếu của bạn còn trống"
            description="Có mặt trong phạm vi 1.000m tại các điểm đến Đất Sen Hồng để điểm danh GPS và nhận điểm thưởng đầu tiên."
            action={<ButtonLink to="/check-in">Điểm danh GPS ngay</ButtonLink>}
          />
        </div>
      )}

      <section className="mt-10" aria-labelledby="badges-heading">
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="eyebrow">Bộ sưu tập</p>
            <h2 id="badges-heading" className="mt-1 text-2xl">Huy hiệu ({p.totals.badges}/{p.badges.length})</h2>
          </div>
        </div>
        <ul className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {p.badges.map((badge, idx) => {
            const Icon = badgeIcons[badge.icon];
            return (
              <li
                key={badge.key}
                style={{ animationDelay: `${idx * 60}ms` }}
                className={clsx(
                  'tp-fade-up group relative flex flex-col items-center rounded-card border p-5 text-center transition-all duration-300',
                  badge.earned
                    ? 'border-teal-300 bg-gradient-to-b from-teal-50 via-white to-white shadow-raised hover:-translate-y-1'
                    : 'border-dashed border-sand-300 bg-white/70 opacity-85 hover:opacity-100',
                )}
              >
                <span
                  className={clsx(
                    'relative mx-auto flex size-16 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110',
                    badge.earned
                      ? 'bg-gradient-to-br from-teal-400 to-teal-600 text-white shadow-cta'
                      : 'bg-sand-100 text-river-300',
                  )}
                >
                  <Icon className="size-8" aria-hidden />
                  {!badge.earned && (
                    <span className="absolute -bottom-1 -right-1 grid size-6 place-items-center rounded-full bg-white text-river-400 shadow-card ring-1 ring-sand-200">
                      <Lock className="size-3" aria-hidden />
                    </span>
                  )}
                </span>
                <p className={clsx('mt-3.5 text-sm font-bold', badge.earned ? 'text-river-900' : 'text-river-600')}>{badge.name}</p>
                <p className="mt-1 text-xs leading-relaxed text-river-500">{badge.description}</p>
                <p className="mt-auto pt-3 text-xs font-semibold">
                  {badge.earned ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-teal-100/80 px-2.5 py-0.5 text-teal-800">
                      <Sparkles className="size-3" aria-hidden />
                      Đạt {formatDateTime(badge.awardedAt)}
                    </span>
                  ) : (
                    <span className="text-river-400">Chưa mở khóa</span>
                  )}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <Card className="p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-lg">
            <MapPinCheck className="size-5 text-leaf-600" aria-hidden />
            Địa điểm đã check-in ({p.checkIns.length})
          </h2>
          {p.checkIns.length === 0 ? (
            <p className="mt-2 text-sm text-river-500">Chưa có check-in nào.</p>
          ) : (
            <ul className="mt-4 space-y-2.5">
              {p.checkIns.map((c, i) => (
                <li key={i} className="flex items-center justify-between gap-3 rounded-2xl bg-sand-50 p-3 text-sm">
                  <span className="min-w-0">
                    {c.destination ? (
                      <Link to={`/destinations/${c.destination.slug}`} className="font-bold text-river-900 hover:text-leaf-700">{c.destination.name}</Link>
                    ) : (
                      <span className="text-river-500">Địa điểm đã bị xóa</span>
                    )}
                    <span className="block text-xs text-river-500">{formatDateTime(c.completedAt)}</span>
                  </span>
                  <span className="shrink-0 rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-800 ring-1 ring-teal-200">
                    +{c.scoreAwarded} điểm
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-lg">
            <Trophy className="size-5 text-teal-600" aria-hidden />
            Thử thách đã hoàn thành ({p.completions.length})
          </h2>
          {p.completions.length === 0 ? (
            <p className="mt-2 text-sm text-river-500">Chưa hoàn thành thử thách nào.</p>
          ) : (
            <ul className="mt-4 space-y-2.5">
              {p.completions.map((c, i) => (
                <li key={i} className="flex items-center justify-between gap-3 rounded-2xl bg-sand-50 p-3 text-sm">
                  <span className="min-w-0">
                    <span className="font-bold text-river-900">{c.challenge?.title ?? 'Thử thách đã bị xóa'}</span>
                    <span className="block text-xs text-river-500">
                      {c.destination?.name ?? '—'} · đúng {c.correctCount ?? '?'}/{c.totalQuestions ?? '?'} · {formatDateTime(c.completedAt)}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-800 ring-1 ring-teal-200">
                    +{c.scoreAwarded} điểm
                  </span>
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
                <Link to={`/destinations/${d.slug}`} className="inline-flex min-h-9 items-center rounded-full border border-sand-300 bg-white px-3.5 text-sm font-medium transition hover:border-leaf-400 hover:text-leaf-700">
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
