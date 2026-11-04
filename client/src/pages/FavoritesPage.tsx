import { Compass, Heart, Route } from 'lucide-react';
import { DestinationCard } from '../components/destination/DestinationCard';
import { PageContainer } from '../components/layout/PublicLayout';
import { ButtonLink } from '../components/ui/Button';
import { CardGridSkeleton, EmptyState, ErrorState } from '../components/ui/States';
import { useApiQuery } from '../hooks/useApiQuery';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { api } from '../lib/api';
import type { DestinationSummary } from '../types/api';

export function FavoritesPage() {
  useDocumentTitle('Địa điểm yêu thích');
  const query = useApiQuery(
    (signal) => api.get<{ items: DestinationSummary[]; hiddenCount: number }>('/favorites', { signal }).then((r) => r.data),
    [],
  );
  const count = query.data?.items.length ?? 0;

  return (
    <PageContainer>
      <div className="tp-fade-up flex flex-wrap items-center justify-between gap-4 rounded-panel border border-sand-200 bg-gradient-to-br from-white via-sand-50 to-lotus-100/35 p-6 shadow-card sm:p-7">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-pill bg-lotus-100 px-3 py-1 text-xs font-semibold text-lotus-600">
            <Heart className="size-3.5 fill-lotus-500 text-lotus-500" aria-hidden /> Bộ sưu tập cá nhân
          </span>
          <h1 className="mt-2.5 text-2xl sm:text-3xl">Địa điểm yêu thích</h1>
          <p className="mt-1 text-sm text-river-600">
            {count > 0 ? `Bạn đã lưu ${count} địa điểm để xem lại hoặc đưa vào lịch trình.` : 'Những nơi bạn đã lưu để xem lại hoặc thêm vào lịch trình.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink to="/destinations" variant="secondary" icon={<Compass className="size-4" aria-hidden />}>
            Khám phá thêm
          </ButtonLink>
          <ButtonLink to="/itinerary/create" variant="primary" icon={<Route className="size-4" aria-hidden />}>
            Tạo lịch trình
          </ButtonLink>
        </div>
      </div>

      <div className="mt-6">
        {query.loading ? (
          <CardGridSkeleton count={3} />
        ) : query.error ? (
          <ErrorState error={query.error} onRetry={query.reload} />
        ) : query.data && query.data.items.length > 0 ? (
          <>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {query.data.items.map((d) => (
                <DestinationCard key={d.id} destination={d} />
              ))}
            </div>
            {query.data.hiddenCount > 0 && (
              <p className="mt-4 text-sm text-river-500">{query.data.hiddenCount} địa điểm yêu thích hiện đang bị ẩn và tạm không hiển thị.</p>
            )}
          </>
        ) : (
          <EmptyState
            icon={<Heart className="size-6" aria-hidden />}
            title="Chưa có địa điểm yêu thích"
            description="Bấm “Lưu yêu thích” trên trang chi tiết địa điểm để thêm vào đây."
            action={<ButtonLink to="/destinations">Khám phá địa điểm</ButtonLink>}
          />
        )}
      </div>
    </PageContainer>
  );
}
