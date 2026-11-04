import { Compass, SlidersHorizontal, X } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DestinationCard } from '../components/destination/DestinationCard';
import { FilterPanel, type DestinationFilters } from '../components/destination/FilterPanel';
import { PageContainer } from '../components/layout/PublicLayout';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Pagination, SearchBar } from '../components/ui/Navigation';
import { CardGridSkeleton, EmptyState, ErrorState } from '../components/ui/States';
import { useApiQuery } from '../hooks/useApiQuery';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { api } from '../lib/api';
import { AREA_OPTIONS, areaLabel, CATEGORY_OPTIONS, categoryLabel } from '../lib/catalog';
import type { Area, Category, DestinationSummary, Paginated } from '../types/api';

const PAGE_SIZE = 9;

function parseList<T extends string>(raw: string | null, allowed: Array<{ value: T }>): T[] {
  if (!raw) return [];
  const values = new Set(allowed.map((a) => a.value));
  return raw.split(',').filter((v): v is T => values.has(v as T));
}

export function DestinationsPage() {
  useDocumentTitle('Khám phá địa điểm');
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
      {/* Hero Header */}
      <section className="tp-fade-up relative overflow-hidden rounded-panel bg-gradient-to-br from-leaf-900 via-leaf-800 to-leaf-600 p-6 text-white shadow-raised sm:p-8">
        <div className="pointer-events-none absolute -right-12 -top-16 size-64 rounded-full bg-lotus-300/20 blur-3xl" aria-hidden />
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold ring-1 ring-white/20">
            <Compass className="size-3.5 text-teal-200" aria-hidden />
            Bản đồ điểm đến Đồng Tháp
          </span>
          <h1 className="mt-3 text-3xl text-white sm:text-4xl">Khám phá địa điểm</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-leaf-100 sm:text-base">
            Tìm kiếm theo từ khóa, lọc theo nhóm trải nghiệm, khu vực hoặc điểm có thử thách QR đang hoạt động.
          </p>
          <div className="mt-5 max-w-2xl">
            <SearchBar value={q} onSearch={(value) => update({ q: value || null })} />
          </div>
        </div>
      </section>

      <details className="mt-4 lg:hidden" open={activeFilterCount > 0 || undefined}>
        <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-full border border-sand-300 bg-white px-4 text-sm font-semibold text-river-800 shadow-card">
          <SlidersHorizontal className="size-4 text-leaf-600" aria-hidden />
          Bộ lọc{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
        </summary>
        <Card className="mt-3 p-4">{panel}</Card>
      </details>

      <div className="mt-6 grid gap-8 lg:grid-cols-[280px_1fr]">
        <aside className="hidden lg:block" aria-label="Bộ lọc">
          <Card className="sticky top-24 p-5">{panel}</Card>
        </aside>
        <section aria-live="polite" aria-busy={query.loading}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            {query.data && !query.loading ? (
              <p className="text-sm text-river-600">
                Tìm thấy <strong className="text-river-900">{query.data.total}</strong> địa điểm
                {q && (
                  <>
                    {' '}cho “<strong className="text-river-900">{q}</strong>”
                  </>
                )}
              </p>
            ) : (
              <span />
            )}

            {/* Active filter pills */}
            {(activeFilterCount > 0 || q) && (
              <div className="flex flex-wrap items-center gap-1.5">
                {filters.category.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => update({ category: filters.category.filter((c) => c !== cat).join(',') || null })}
                    className="inline-flex items-center gap-1 rounded-full bg-leaf-50 px-2.5 py-1 text-xs font-semibold text-leaf-800 ring-1 ring-leaf-200 hover:bg-leaf-100"
                  >
                    {categoryLabel(cat)}
                    <X className="size-3" aria-hidden />
                  </button>
                ))}
                {filters.area.map((ar) => (
                  <button
                    key={ar}
                    type="button"
                    onClick={() => update({ area: filters.area.filter((a) => a !== ar).join(',') || null })}
                    className="inline-flex items-center gap-1 rounded-full bg-sand-100 px-2.5 py-1 text-xs font-semibold text-river-800 ring-1 ring-sand-200 hover:bg-sand-200"
                  >
                    {areaLabel(ar)}
                    <X className="size-3" aria-hidden />
                  </button>
                ))}
                {filters.hasActivity && (
                  <button
                    type="button"
                    onClick={() => update({ hasActivity: null })}
                    className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800 ring-1 ring-teal-200 hover:bg-teal-100"
                  >
                    Có QR / Thử thách
                    <X className="size-3" aria-hidden />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setParams(new URLSearchParams())}
                  className="text-xs font-semibold text-river-500 underline hover:text-leaf-700"
                >
                  Xóa tất cả
                </button>
              </div>
            )}
          </div>

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
