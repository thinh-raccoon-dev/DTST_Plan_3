import { Heart, MapPin, QrCode, Route, Trophy } from 'lucide-react';
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

      <div className="mt-5 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="aspect-[16/10] overflow-hidden rounded-panel border border-sand-200">
          <DestinationImage image={heroImage} category={d.category} name={d.name} showPlaceholderNote />
        </div>
        <div className="flex flex-col">
          <p className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-leaf-700">
            <CategoryIcon category={d.category} className="size-4" />
            {categoryLabel(d.category)}
          </p>
          <h1 className="mt-2 text-3xl leading-tight">{d.name}</h1>
          <p className="mt-2 inline-flex items-center gap-1.5 text-river-600">
            <MapPin className="size-4" aria-hidden />
            {areaLabel(d.area)}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <VerificationStatusBadge status={d.verificationStatus} />
            {d.isIllustrative && <IllustrativeBadge />}
            {d.operationalStatus !== 'active' && <Badge tone="red">{d.operationalStatus === 'closed' ? 'Ngừng hoạt động' : 'Tạm đóng cửa'}</Badge>}
            {d.tags.map((tag) => (
              <Badge key={tag}>{tag}</Badge>
            ))}
          </div>
          {d.summary && <p className="mt-4 text-river-700">{d.summary}</p>}
          <div className="mt-auto flex flex-wrap gap-2 pt-6">
            <Button
              variant={favorite.favorited ? 'secondary' : 'primary'}
              onClick={favorite.toggle}
              loading={favorite.busy}
              aria-pressed={favorite.favorited}
              icon={<Heart className={`size-4 ${favorite.favorited ? 'fill-lotus-500 text-lotus-500' : ''}`} aria-hidden />}
            >
              {favorite.favorited ? 'Đã yêu thích' : 'Lưu yêu thích'}
            </Button>
            <ButtonLink to="/itinerary/create" state={{ priorityDestinationId: d.id }} variant="secondary" icon={<Route className="size-4" aria-hidden />}>
              Thêm vào lịch trình
            </ButtonLink>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Card className="p-5 sm:p-6">
            <h2 className="text-lg">Giới thiệu</h2>
            <div className="mt-3 space-y-3 whitespace-pre-line text-river-800">{d.description}</div>
          </Card>

          <Card className="p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-lg">
              <QrCode className="size-5 text-teal-500" aria-hidden />
              Trải nghiệm & thử thách QR
            </h2>
            {challenges.length === 0 ? (
              <p className="mt-2 text-sm text-river-600">Địa điểm này chưa có thử thách đang hoạt động.</p>
            ) : (
              <>
                <p className="mt-2 text-sm text-river-600">
                  {hasActiveQr
                    ? 'Quét mã QR đặt tại điểm đến để mở câu chuyện và tham gia thử thách. Điểm thưởng chỉ được cấp khi bạn hoàn thành đúng quy tắc.'
                    : 'Thử thách sẽ mở khi mã QR tại điểm đến được kích hoạt.'}
                </p>
                <ul className="mt-4 space-y-3">
                  {challenges.map((c) => (
                    <li key={c.id} className="flex items-start gap-3 rounded-card border border-sand-200 p-4">
                      <Trophy className="mt-0.5 size-5 shrink-0 text-teal-500" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-river-900">{c.title}</p>
                        {c.description && <p className="text-sm text-river-600">{c.description}</p>}
                        <p className="mt-1 text-xs text-river-500">
                          {c.questionCount} câu hỏi · cần đúng {c.minCorrect} câu
                        </p>
                      </div>
                      <Badge tone="teal">+{c.rewardPoints} điểm</Badge>
                    </li>
                  ))}
                </ul>
                {hasActiveQr && (
                  <ButtonLink to="/scan" variant="accent" size="sm" className="mt-4" icon={<QrCode className="size-4" aria-hidden />}>
                    Mở máy quét QR
                  </ButtonLink>
                )}
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
