import { ArrowRight, Award, QrCode, Route, ScanLine, Stamp } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { CategoryIcon } from '../components/destination/CategoryIcon';
import { DestinationCard } from '../components/destination/DestinationCard';
import { HomeBanner } from '../components/home/HomeBanner';
import { ButtonLink } from '../components/ui/Button';
import { SectionHeading } from '../components/ui/Card';
import { SearchBar } from '../components/ui/Navigation';
import { CardGridSkeleton, EmptyState, ErrorState } from '../components/ui/States';
import { useApiQuery } from '../hooks/useApiQuery';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { api } from '../lib/api';
import { CATEGORY_OPTIONS } from '../lib/catalog';
import { useAuthStore } from '../stores/authStore';
import type { DestinationSummary, Paginated } from '../types/api';

function useDestinations(params: Record<string, string | number>) {
  return useApiQuery(
    (signal) => api.get<Paginated<DestinationSummary>>('/destinations', { params, signal }).then((r) => r.data),
    [JSON.stringify(params)],
  );
}

function Hero() {
  const navigate = useNavigate();
  return (
    <section className="relative isolate overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div className="absolute left-1/2 top-0 h-80 w-[36rem] -translate-x-1/2 rounded-full bg-leaf-100/50 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6 md:pb-20 md:pt-14">
        <div className="mx-auto max-w-3xl text-center">
          <p className="eyebrow mx-auto">Mỗi chuyến đi, một câu chuyện</p>
          <h1 className="mt-5 text-balance text-[2.25rem] font-extrabold leading-[1.1] tracking-tight text-river-900 sm:text-[3rem] lg:text-[3.5rem]">
            Khám phá Đồng Tháp{' '}
            <span className="relative inline-block">
              theo cách của bạn
              <span className="absolute -bottom-1 left-0 h-[3px] w-full rounded-full bg-lotus-400/80" aria-hidden />
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-relaxed text-river-600 sm:text-lg">
            Lịch trình thông minh, nhiệm vụ khám phá tại điểm đến và hộ chiếu số lưu giữ từng dấu chân. Đồng Tháp đang chờ bạn trải nghiệm!
          </p>
          <div className="mx-auto mt-8 max-w-2xl">
            <SearchBar value="" size="lg" debounceMs={0} onSearch={(q) => navigate(q ? `/destinations?q=${encodeURIComponent(q)}` : '/destinations')} />
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <ButtonLink to="/itinerary/create" size="lg" icon={<Route className="size-5" aria-hidden />}>
              Tạo lịch trình ngay
            </ButtonLink>
            <ButtonLink to="/scan" variant="secondary" size="lg" icon={<ScanLine className="size-5" aria-hidden />}>
              Quét mã QR
            </ButtonLink>
          </div>
          <ul className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-medium text-river-600">
            <li className="inline-flex items-center gap-2">
              <span className="size-1.5 rotate-45 bg-leaf-600" aria-hidden />
              Khám phá theo sở thích
            </li>
            <li className="inline-flex items-center gap-2">
              <span className="size-1.5 rotate-45 bg-lotus-400" aria-hidden />
              Tích lũy huy hiệu
            </li>
            <li className="inline-flex items-center gap-2">
              <span className="size-1.5 rotate-45 bg-teal-500" aria-hidden />
              Lưu giữ kỷ niệm
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}

export function HomePage() {
  useDocumentTitle(null);
  const user = useAuthStore((s) => s.user);
  const featured = useDestinations({ limit: 6, sort: 'recent' });
  const recommended = useApiQuery(
    (signal) => api.get<{ personalized: boolean; items: DestinationSummary[] }>('/destinations/recommended', { signal }).then((r) => r.data),
    [user?.id],
  );
  const active = useDestinations({ limit: 3, hasActivity: 'true' });
  const featuredItems = recommended.data?.items?.length ? recommended.data.items : featured.data?.items;
  const featuredLoading = (recommended.loading || featured.loading) && !featuredItems;
  const featuredError = featuredItems ? null : featured.error ?? recommended.error;
  const personalized = Boolean(recommended.data?.personalized);

  return (
    <>
      <HomeBanner />
      <Hero />

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <SectionHeading eyebrow="Giá trị cốt lõi" title="Khám phá theo sở thích" description="Chọn một nhóm trải nghiệm để bắt đầu." />
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {CATEGORY_OPTIONS.map((c) => (
            <li key={c.value}>
              <Link
                to={`/destinations?category=${c.value}`}
                className="flex min-h-24 flex-col items-start justify-between gap-3 rounded-card bg-white p-4 shadow-card ring-1 ring-sand-200 transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-raised"
              >
                <span className="rounded-2xl bg-leaf-50 p-2.5 text-leaf-700 ring-1 ring-leaf-100">
                  <CategoryIcon category={c.value} className="size-5" />
                </span>
                <span className="text-sm font-semibold text-river-900">{c.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <SectionHeading
          eyebrow="Điểm đến"
          title="Điểm đến gợi ý"
          description={
            personalized
              ? 'Xếp theo sở thích trên trang cá nhân, điểm đã yêu thích và check-in. Nội dung gắn nhãn “Dữ liệu minh họa” chưa được xác minh chính thức.'
              : 'Lấy trực tiếp từ dữ liệu đã xuất bản. Đăng nhập và lưu sở thích để nhận gợi ý phù hợp hơn.'
          }
          action={
            <ButtonLink to="/destinations" variant="secondary" size="sm">
              Xem tất cả <ArrowRight className="size-4" aria-hidden />
            </ButtonLink>
          }
        />
        <div className="mt-6">
          {featuredLoading ? (
            <CardGridSkeleton count={3} />
          ) : featuredError ? (
            <ErrorState error={featuredError} onRetry={() => { recommended.reload(); featured.reload(); }} />
          ) : featuredItems && featuredItems.length > 0 ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {featuredItems.map((d) => (
                <DestinationCard key={d.id} destination={d} />
              ))}
            </div>
          ) : (
            <EmptyState title="Chưa có điểm đến nào được xuất bản" description="Quản trị viên sẽ sớm cập nhật nội dung." />
          )}
        </div>
      </section>

      <section className="mx-auto mt-10 max-w-6xl px-4 sm:px-6">
        <div className="grid gap-6 rounded-panel bg-leaf-800 p-6 text-white shadow-raised sm:p-10 lg:grid-cols-2">
          <div>
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-leaf-300">Hộ chiếu trải nghiệm số</p>
            <h2 className="mt-3 text-white">Mỗi dấu chân, một huy hiệu</h2>
            <p className="mt-3 leading-relaxed text-leaf-100">
              Mỗi điểm thí điểm có một mã QR. Quét mã để mở câu chuyện, check-in và trả lời thử thách. Điểm thưởng do máy chủ chấm,
              mỗi thử thách chỉ nhận thưởng một lần.
            </p>
            <ol className="mt-6 grid gap-4 sm:grid-cols-3">
              {[
                { icon: QrCode, title: 'Quét QR', text: 'Tại điểm đến thí điểm' },
                { icon: Stamp, title: 'Check-in & thử thách', text: 'Trả lời câu hỏi về địa phương' },
                { icon: Award, title: 'Nhận huy hiệu', text: 'Tích lũy điểm và con dấu' },
              ].map(({ icon: Icon, title, text }, i) => (
                <li key={title} className="rounded-card bg-white/5 p-4 ring-1 ring-white/10">
                  <span className="text-xs font-semibold text-lotus-200">Bước {i + 1}</span>
                  <Icon className="mt-2 size-6 text-leaf-300" aria-hidden />
                  <p className="mt-2 font-semibold text-white">{title}</p>
                  <p className="text-sm text-leaf-100">{text}</p>
                </li>
              ))}
            </ol>
            <div className="mt-6 flex flex-wrap gap-3">
              <ButtonLink to="/passport" variant="inverted">
                Xem hộ chiếu của tôi
              </ButtonLink>
              <ButtonLink to="/scan" variant="outlineInverted">
                Mở máy quét QR
              </ButtonLink>
            </div>
          </div>
          <div>
            <h3 className="text-lg text-white">Điểm có QR / thử thách đang hoạt động</h3>
            <div className="mt-4 space-y-3">
              {active.loading && <p className="text-sm text-leaf-200">Đang tải…</p>}
              {active.error && <p className="text-sm text-red-200">{active.error.message}</p>}
              {active.data?.items.length === 0 && <p className="text-sm text-leaf-200">Hiện chưa có điểm thí điểm nào đang hoạt động.</p>}
              {active.data?.items.map((d) => (
                <Link key={d.id} to={`/destinations/${d.slug}`} className="flex items-center gap-3 rounded-card bg-white/5 p-3 ring-1 ring-white/10 hover:bg-white/10">
                  <span className="rounded-2xl bg-leaf-700 p-2.5">
                    <CategoryIcon category={d.category} className="size-5 text-leaf-100" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-white">{d.name}</span>
                    <span className="block truncate text-sm text-leaf-100">{d.summary}</span>
                  </span>
                  <ArrowRight className="ml-auto size-4 shrink-0 text-leaf-300" aria-hidden />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-10 max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col items-start gap-4 rounded-panel bg-white p-6 shadow-card ring-1 ring-sand-200 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <p className="eyebrow mb-2">Lịch trình thông minh</p>
            <h2 className="text-xl sm:text-2xl">Chưa biết đi đâu?</h2>
            <p className="mt-2 leading-relaxed text-river-600">Chọn số ngày, khu vực và sở thích — hệ thống gợi ý lịch trình kèm lý do chọn từng điểm.</p>
          </div>
          <ButtonLink to="/itinerary/create" size="lg" icon={<Route className="size-5" aria-hidden />}>
            Tạo lịch trình
          </ButtonLink>
        </div>
      </section>
    </>
  );
}
