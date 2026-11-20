import { ArrowRight, Award, Footprints, MapPinCheck, Navigation, Route, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CategoryIcon } from '../components/destination/CategoryIcon';
import { DestinationCard } from '../components/destination/DestinationCard';
import { AiVibeShowcase } from '../components/home/AiVibeShowcase';
import { HomeBanner } from '../components/home/HomeBanner';
import { MekongScenicHero } from '../components/home/MekongScenicHero';
import { ButtonLink } from '../components/ui/Button';
import { SectionHeading } from '../components/ui/Card';
import { Reveal, TiltCard } from '../components/ui/MotionPrimitives';
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
      <MekongScenicHero />
      <AiVibeShowcase />

      <Reveal className="mx-auto max-w-6xl px-3.5 py-10 sm:px-6">
        <section>
          <SectionHeading
            eyebrow="Giá trị cốt lõi"
            title="Khám phá theo sở thích"
            description="Chọn một nhóm trải nghiệm để bắt đầu hành trình thật đơn giản."
          />
          <ul className="mt-6 grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-6">
            {CATEGORY_OPTIONS.map((c, idx) => (
              <li key={c.value} className="min-w-0 tp-fade-up" style={{ animationDelay: `${idx * 50}ms` }}>
                <TiltCard maxTiltDeg={5} className="h-full">
                  <Link
                    to={`/destinations?category=${c.value}`}
                    className="group flex min-h-28 flex-col items-start justify-between gap-3 rounded-card bg-white p-4 shadow-card ring-1 ring-sand-200 transition-all duration-300 hover:shadow-raised hover:ring-leaf-300"
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="rounded-2xl bg-gradient-to-br from-leaf-100 to-leaf-50 p-2.5 text-leaf-700 ring-1 ring-leaf-200/70 transition-transform duration-300 group-hover:scale-110 group-hover:bg-leaf-600 group-hover:text-white">
                        <CategoryIcon category={c.value} className="size-5" />
                      </span>
                      <ArrowRight className="size-4 -translate-x-1 text-river-300 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:text-leaf-600 group-hover:opacity-100" aria-hidden />
                    </div>
                    <span className="text-sm font-bold text-river-900 transition-colors group-hover:text-leaf-700">{c.label}</span>
                  </Link>
                </TiltCard>
              </li>
            ))}
          </ul>
        </section>
      </Reveal>

      <Reveal className="mx-auto max-w-6xl px-3.5 py-6 sm:px-6">
        <section>
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
      </Reveal>

      <Reveal direction="scale" className="mx-auto mt-10 max-w-6xl px-3.5 sm:px-6">
        <section>
          <div className="relative overflow-hidden rounded-panel bg-gradient-to-br from-leaf-900 via-leaf-800 to-leaf-700 p-5 text-white shadow-raised sm:p-10">
            <div className="pointer-events-none absolute -right-16 -top-16 size-72 rounded-full bg-lotus-300/20 blur-3xl" aria-hidden />
            <div className="pointer-events-none absolute -bottom-20 left-10 size-72 rounded-full bg-teal-300/15 blur-3xl" aria-hidden />
            <div className="relative grid gap-8 lg:grid-cols-2">
              <div className="min-w-0">
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-leaf-300">Hộ chiếu trải nghiệm số & Sương mù khám phá</p>
                <h2 className="mt-3 text-white">Mỗi dấu chân, một huy hiệu</h2>
                <p className="mt-3 leading-relaxed text-leaf-100">
                  Tự động nhận diện qua GPS vệ tinh khi bạn đến gần điểm đến trong phạm vi 1.000m. Hệ thống tự đóng dấu Hộ chiếu số, mở sáng bản đồ sương mù và lưu kỷ niệm ngay cả khi mất mạng.
                </p>
                <ol className="mt-6 grid gap-3 sm:grid-cols-3">
                  {[
                    { icon: Navigation, title: 'Đến điểm thực tế', text: 'GPS tự nhận diện bán kính 1km' },
                    { icon: MapPinCheck, title: 'Tự động điểm danh', text: 'Nhận ngay +10 đến +15 EXP' },
                    { icon: Award, title: 'Thăng hạng Sen Hồng', text: 'Mở khóa Thẻ 3D & huy hiệu' },
                  ].map(({ icon: Icon, title, text }, i) => (
                    <li key={title} className="min-w-0 rounded-2xl bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur-sm transition hover:bg-white/15">
                      <span className="inline-block rounded-full bg-lotus-300/25 px-2 py-0.5 text-[11px] font-semibold text-lotus-100">
                        Bước {i + 1}
                      </span>
                      <Icon className="mt-2.5 size-6 text-teal-200" aria-hidden />
                      <p className="mt-2 font-bold text-white">{title}</p>
                      <p className="mt-0.5 text-xs text-leaf-100">{text}</p>
                    </li>
                  ))}
                </ol>
                <div className="mt-6 flex flex-wrap gap-3">
                  <ButtonLink to="/passport" variant="inverted">
                    Xem hộ chiếu của tôi
                  </ButtonLink>
                  <ButtonLink to="/footprints" variant="outlineInverted" icon={<Footprints className="size-4" />}>
                    Bản đồ Dấu chân
                  </ButtonLink>
                  <ButtonLink to="/check-in" variant="outlineInverted" icon={<MapPinCheck className="size-4" />}>
                    Điểm danh GPS
                  </ButtonLink>
                </div>
              </div>
              <div className="min-w-0">
                <h3 className="text-lg text-white">Điểm có QR / thử thách đang hoạt động</h3>
                <div className="mt-4 space-y-3">
                  {active.loading && <p className="text-sm text-leaf-200">Đang tải…</p>}
                  {active.error && <p className="text-sm text-red-200">{active.error.message}</p>}
                  {active.data?.items.length === 0 && <p className="text-sm text-leaf-200">Hiện chưa có điểm thí điểm nào đang hoạt động.</p>}
                  {active.data?.items.map((d) => (
                    <Link
                      key={d.id}
                      to={`/destinations/${d.slug}`}
                      className="group flex items-center gap-3.5 rounded-2xl bg-white/10 p-3.5 ring-1 ring-white/15 backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/15"
                    >
                      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/15 text-teal-200 transition-transform duration-200 group-hover:scale-110">
                        <CategoryIcon category={d.category} className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-bold text-white">{d.name}</span>
                        <span className="block truncate text-xs text-leaf-100">{d.summary}</span>
                      </span>
                      <ArrowRight className="size-4 shrink-0 text-leaf-200 transition-transform duration-200 group-hover:translate-x-1" aria-hidden />
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </Reveal>

      <Reveal className="mx-auto mt-10 max-w-6xl px-3.5 sm:px-6">
        <section>
          <div className="relative flex flex-col items-start justify-between gap-6 overflow-hidden rounded-panel border border-leaf-200 bg-gradient-to-r from-leaf-50 via-white to-teal-50/60 p-6 shadow-card sm:flex-row sm:items-center sm:p-8">
            <div className="min-w-0 max-w-xl">
              <p className="eyebrow mb-2">Trip Planner V9 · Bản đồ 3D Bay Lượn</p>
              <h2 className="text-xl sm:text-2xl">Chưa biết lên lịch đi Mỹ Tho – Thới Sơn – Đồng Tháp thế nào?</h2>
              <p className="mt-2 text-sm leading-relaxed text-river-600 sm:text-base">
                Chọn mục đích, ngân sách và sở thích — AI tự động chọn điểm đến, tính giờ chạy xe thực tế, cảnh báo thời tiết an toàn và cho bạn bay tham quan lộ trình 3D ngay trên màn hình!
              </p>
            </div>
            <ButtonLink
              to="/itinerary/create"
              size="lg"
              className="relative shrink-0 overflow-hidden"
              icon={<Route className="size-5" aria-hidden />}
            >
              <span className="tp-shimmer pointer-events-none absolute inset-0" aria-hidden />
              <Sparkles className="size-4 text-teal-200" aria-hidden />
              Lập lịch trình 3D ngay
            </ButtonLink>
          </div>
        </section>
      </Reveal>
    </>
  );
}
