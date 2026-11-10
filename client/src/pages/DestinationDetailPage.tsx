import { Heart, MapPin, MapPinCheck, QrCode, Route, Sparkles, Trophy } from 'lucide-react';
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { CategoryIcon } from '../components/destination/CategoryIcon';
import { IllustrativeBadge, VerificationStatusBadge } from '../components/destination/DataBadges';
import { DestinationCard } from '../components/destination/DestinationCard';
import { DestinationFacts, DestinationMap, DestinationSources } from '../components/destination/DestinationInfo';
import { DestinationImage } from '../components/destination/DestinationImage';
import { PageContainer } from '../components/layout/PublicLayout';
import { Badge } from '../components/ui/Badge';
import { Button, ButtonLink } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Breadcrumb } from '../components/ui/Navigation';
import { EmptyState, ErrorState, PageLoader } from '../components/ui/States';
import { useApiQuery } from '../hooks/useApiQuery';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useFavorite } from '../hooks/useFavorites';
import { api } from '../lib/api';
import { areaLabel, categoryLabel } from '../lib/catalog';
import type { DestinationResponse, DestinationSummary } from '../types/api';

export function DestinationDetailPage() {
  const { slug = '' } = useParams();
  const detail = useApiQuery((signal) => api.get<DestinationResponse>(`/destinations/${slug}`, { signal }).then((r) => r.data), [slug]);
  const related = useApiQuery(
    (signal) => api.get<{ items: DestinationSummary[] }>(`/destinations/${slug}/related`, { signal }).then((r) => r.data.items),
    [slug],
  );
  const destination = detail.data?.destination;
  const favorite = useFavorite(destination?.id);
  useDocumentTitle(destination?.name ?? 'Chi tiết địa điểm');

  useEffect(() => {
    if (!destination) return;
    // destination_page_view; the server dedupes repeated views from the same browser.
    api.post('/events/destination-view', { slug: destination.slug }).catch(() => {
      // Analytics must never interrupt reading the page.
    });
  }, [destination]);

  if (detail.loading) {
    return (
      <PageContainer>
        <PageLoader />
      </PageContainer>
    );
  }
  if (detail.error || !detail.data || !destination) {
    return (
      <PageContainer>
        {detail.error?.status === 404 ? (
          <EmptyState
            title="Không tìm thấy địa điểm"
            description="Địa điểm có thể đã bị ẩn hoặc đường dẫn không đúng."
            action={<ButtonLink to="/destinations">Quay lại khám phá</ButtonLink>}
          />
        ) : (
          <ErrorState error={detail.error} onRetry={detail.reload} />
        )}
      </PageContainer>
    );
  }

  const { challenges, hasActiveQr } = detail.data;
  const d = destination;
  const heroImage = d.images[0] ? { url: d.images[0].url, alt: d.images[0].alt } : null;

  return (
    <PageContainer>
      <Breadcrumb items={[{ label: 'Trang chủ', to: '/' }, { label: 'Khám phá', to: '/destinations' }, { label: d.name }]} />

      <div className="tp-fade-up mt-5 overflow-hidden rounded-panel border border-sand-200 bg-white shadow-card">
        <div className="grid gap-0 lg:grid-cols-[1.45fr_1fr]">
          <div className="relative aspect-[16/10] overflow-hidden bg-sand-100 lg:aspect-auto lg:min-h-[360px]">
            <DestinationImage image={heroImage} category={d.category} name={d.name} showPlaceholderNote />
            {hasActiveQr && (
              <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-pill bg-river-950/80 px-3 py-1 text-xs font-semibold text-teal-300 backdrop-blur-md">
                <QrCode className="size-3.5" aria-hidden /> Có trạm QR tương tác
              </span>
            )}
          </div>
          <div className="flex flex-col p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-pill bg-leaf-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-leaf-700 ring-1 ring-leaf-200">
                <CategoryIcon category={d.category} className="size-3.5" />
                {categoryLabel(d.category)}
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-river-600">
                <MapPin className="size-3.5 text-leaf-600" aria-hidden />
                {areaLabel(d.area)}
              </span>
            </div>

            <h1 className="mt-3 text-2xl leading-tight sm:text-3xl">{d.name}</h1>

            <div className="mt-3 flex flex-wrap gap-1.5">
              <VerificationStatusBadge status={d.verificationStatus} />
              {d.isIllustrative && <IllustrativeBadge />}
              {d.operationalStatus !== 'active' && (
                <Badge tone="red">{d.operationalStatus === 'closed' ? 'Ngừng hoạt động' : 'Tạm đóng cửa'}</Badge>
              )}
              {d.tags.map((tag) => (
                <Badge key={tag}>{tag}</Badge>
              ))}
            </div>

            {d.summary && <p className="mt-4 text-sm leading-relaxed text-river-700 sm:text-base">{d.summary}</p>}

            <div className="mt-auto flex flex-wrap gap-2.5 border-t border-sand-200 pt-6">
              <Button
                variant={favorite.favorited ? 'secondary' : 'primary'}
                onClick={favorite.toggle}
                loading={favorite.busy}
                aria-pressed={favorite.favorited}
                icon={<Heart className={`size-4 transition-transform ${favorite.favorited ? 'scale-110 fill-lotus-500 text-lotus-500' : ''}`} aria-hidden />}
              >
                {favorite.favorited ? 'Đã yêu thích' : 'Lưu yêu thích'}
              </Button>
              <ButtonLink
                to="/itinerary/create"
                state={{ priorityDestinationId: d.id }}
                variant="secondary"
                icon={<Route className="size-4" aria-hidden />}
              >
                Thêm vào lịch trình
              </ButtonLink>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Card className="p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-lg">
              <Sparkles className="size-5 text-leaf-600" aria-hidden />
              Giới thiệu điểm đến
            </h2>
            <div className="mt-3 space-y-3 whitespace-pre-line leading-relaxed text-river-800">{d.description}</div>
          </Card>

          <Card className="overflow-hidden border-teal-200/80 p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-lg">
                <span className="flex size-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                  <QrCode className="size-5" aria-hidden />
                </span>
                Trải nghiệm & thử thách QR
              </h2>
              {hasActiveQr && <Badge tone="teal">Đang mở tại điểm</Badge>}
            </div>
            {challenges.length === 0 ? (
              <p className="mt-3 text-sm text-river-600">Địa điểm này chưa có thử thách đang hoạt động.</p>
            ) : (
              <>
                <p className="mt-2 text-sm text-river-600">
                  {hasActiveQr
                    ? 'Quét mã QR đặt tại điểm đến để mở câu chuyện và tham gia thử thách. Điểm thưởng chỉ được cấp khi bạn hoàn thành đúng quy tắc.'
                    : 'Thử thách sẽ mở khi mã QR tại điểm đến được kích hoạt.'}
                </p>
                <ul className="mt-4 space-y-3">
                  {challenges.map((c) => (
                    <li
                      key={c.id}
                      className="flex items-start gap-3.5 rounded-card border border-sand-200 bg-gradient-to-r from-white to-sand-50/70 p-4 transition-all hover:border-teal-300 hover:shadow-sm"
                    >
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600 ring-1 ring-teal-200/60">
                        <Trophy className="size-5" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-river-900">{c.title}</p>
                        {c.description && <p className="mt-0.5 text-sm text-river-600">{c.description}</p>}
                        <p className="mt-1.5 text-xs font-medium text-river-500">
                          {c.questionCount} câu hỏi · cần đúng {c.minCorrect} câu
                        </p>
                      </div>
                      <Badge tone="teal">+{c.rewardPoints} điểm</Badge>
                    </li>
                  ))}
                </ul>
                <ButtonLink to="/check-in" variant="accent" size="sm" className="mt-5" icon={<MapPinCheck className="size-4" aria-hidden />}>
                  Điểm danh GPS tại điểm này
                </ButtonLink>
              </>
            )}
          </Card>
        </div>
        <div className="space-y-6">
          <DestinationFacts destination={d} />
          <DestinationMap destination={d} />
          <DestinationSources destination={d} />
        </div>
      </div>

      {related.data && related.data.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl">Địa điểm liên quan</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {related.data.map((r) => (
              <DestinationCard key={r.id} destination={r} />
            ))}
          </div>
        </section>
      )}
    </PageContainer>
  );
}
