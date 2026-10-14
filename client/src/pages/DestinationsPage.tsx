import { SlidersHorizontal } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DestinationCard } from '../components/destination/DestinationCard';
import { FilterPanel, type DestinationFilters } from '../components/destination/FilterPanel';
import { PageContainer } from '../components/layout/PublicLayout';
import { Button } from '../components/ui/Button';
import { Card, SectionHeading } from '../components/ui/Card';
import { Pagination, SearchBar } from '../components/ui/Navigation';
import { CardGridSkeleton, EmptyState, ErrorState } from '../components/ui/States';
import { useApiQuery } from '../hooks/useApiQuery';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { api } from '../lib/api';
import { AREA_OPTIONS, CATEGORY_OPTIONS } from '../lib/catalog';
import type { Area, Category, DestinationSummary, Paginated } from '../types/api';

const PAGE_SIZE = 9;

function parseList<T extends string>(raw: string | null, allowed: Array<{ value: T }>): T[] {
  if (!raw) return [];
  const values = new Set(allowed.map((a) => a.value));
  return raw.split(',').filter((v): v is T => values.has(v as T));
}

export function DestinationsPage() {
  useDocumentTitle('Khám phá địa điểm');
  // Filters live in the URL, so back/forward, reload and sharing keep the same results.
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const filters: DestinationFilters = useMemo(
    () => ({
      category: parseList<Category>(params.get('category'), CATEGORY_OPTIONS),
      area: parseList<Area>(params.get('area'), AREA_OPTIONS),
      hasActivity: params.get('hasActivity') === 'true',
    }),
    [params],
  );

  const update = useCallback(
    (changes: Record<string, string | null>) => {
      setParams((current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        if (!('page' in changes)) next.delete('page');
        return next;
      });
    },
    [setParams],
  );

  const query = useApiQuery(
    (signal) =>
      api
        .get<Paginated<DestinationSummary>>('/destinations', {
          signal,
          params: {
            q: q || undefined,
            category: filters.category.join(',') || undefined,
            area: filters.area.join(',') || undefined,
            hasActivity: filters.hasActivity ? 'true' : undefined,
            page,
            limit: PAGE_SIZE,
          },
        })
        .then((r) => r.data),
    [q, filters.category.join(), filters.area.join(), filters.hasActivity, page],
  );

  const activeFilterCount = filters.category.length + filters.area.length + (filters.hasActivity ? 1 : 0);
  const panel = (
    <FilterPanel
      value={filters}
      onChange={(next) =>
        update({
          category: next.category.join(',') || null,
          area: next.area.join(',') || null,
          hasActivity: next.hasActivity ? 'true' : null,
        })
      }
    />
  );

  return (
    <PageContainer>
      <SectionHeading as="h1" title="Khám phá địa điểm" description="Tìm kiếm và lọc các điểm đến đã được xuất bản tại Đồng Tháp." />
      <div className="mt-6">
        <SearchBar value={q} onSearch={(value) => update({ q: value || null })} />
      </div>

      <details className="mt-4 lg:hidden" open={activeFilterCount > 0 || undefined}>
        <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-control border border-sand-300 bg-white px-4 text-sm font-semibold text-river-800">
          <SlidersHorizontal className="size-4" aria-hidden />
          Bộ lọc{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
        </summary>
        <Card className="mt-3 p-4">{panel}</Card>
      </details>

      <div className="mt-6 grid gap-8 lg:grid-cols-[280px_1fr]">
        <aside className="hidden lg:block" aria-label="Bộ lọc">
          <Card className="sticky top-24 p-5">{panel}</Card>
        </aside>
        <section aria-live="polite" aria-busy={query.loading}>
          {query.data && !query.loading && (
            <p className="mb-4 text-sm text-river-600">
              Tìm thấy <strong className="text-river-900">{query.data.total}</strong> địa điểm
              {q && (
                <>
                  {' '}cho “<strong className="text-river-900">{q}</strong>”
                </>
              )}
            </p>
          )}
          {query.loading ? (
            <CardGridSkeleton count={6} />
          ) : query.error ? (
            <ErrorState error={query.error} onRetry={query.reload} />
          ) : query.data && query.data.items.length > 0 ? (
            <div className="space-y-8">
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {query.data.items.map((d) => (
                  <DestinationCard key={d.id} destination={d} />
                ))}
              </div>
              <Pagination page={query.data.page} totalPages={query.data.totalPages} onChange={(p) => update({ page: String(p) })} />
            </div>
          ) : (
            <EmptyState
              title="Không tìm thấy địa điểm phù hợp"
              description="Hãy thử từ khóa khác hoặc bỏ bớt bộ lọc."
              action={
                (q || activeFilterCount > 0) && (
                  <Button variant="secondary" onClick={() => setParams(new URLSearchParams())}>
                    Xóa tìm kiếm và bộ lọc
                  </Button>
                )
              }
            />
          )}
        </section>
      </div>
    </PageContainer>
  );
}
