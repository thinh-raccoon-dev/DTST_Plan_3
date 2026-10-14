import { Heart } from 'lucide-react';
import { DestinationCard } from '../components/destination/DestinationCard';
import { PageContainer } from '../components/layout/PublicLayout';
import { ButtonLink } from '../components/ui/Button';
import { SectionHeading } from '../components/ui/Card';
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
  return (
    <PageContainer>
      <SectionHeading as="h1" title="Địa điểm yêu thích" description="Những nơi bạn đã lưu để xem lại hoặc thêm vào lịch trình." />
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
