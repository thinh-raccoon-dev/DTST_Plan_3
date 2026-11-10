import { Compass, ExternalLink, Layers, Map as MapIcon, MapPin, Navigation, SlidersHorizontal, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { DestinationCard } from '../components/destination/DestinationCard';
import { FilterPanel, type DestinationFilters } from '../components/destination/FilterPanel';
import { PageContainer } from '../components/layout/PublicLayout';
import { Button, buttonClasses } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Pagination, SearchBar } from '../components/ui/Navigation';
import { CardGridSkeleton, EmptyState, ErrorState } from '../components/ui/States';
import { useApiQuery } from '../hooks/useApiQuery';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { api } from '../lib/api';
import { AREA_OPTIONS, areaLabel, CATEGORY_OPTIONS, categoryLabel } from '../lib/catalog';
import { directionsUrl, googleMapsEmbedUrl, googleMapsPlaceUrl } from '../lib/format';
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
  const [showMapPanel, setShowMapPanel] = useState(true);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [mapType, setMapType] = useState<'m' | 'h'>('m');
  const mapSectionRef = useRef<HTMLDivElement | null>(null);

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

  const mappableItems = useMemo(
    () => (query.data?.items ?? []).filter((d) => Boolean(d.coordinates)),
    [query.data?.items],
  );

  const activeMapDestination = useMemo(() => {
    if (!mappableItems.length) return null;
    if (selectedSlug) {
      const found = mappableItems.find((d) => d.slug === selectedSlug);
      if (found) return found;
    }
    return mappableItems[0] ?? null;
  }, [mappableItems, selectedSlug]);

  useEffect(() => {
    if (mappableItems.length > 0 && (!selectedSlug || !mappableItems.some((d) => d.slug === selectedSlug))) {
      setSelectedSlug(mappableItems[0]!.slug);
    }
  }, [mappableItems, selectedSlug]);

  const handleSelectOnMap = useCallback((d: DestinationSummary) => {
    setSelectedSlug(d.slug);
    setShowMapPanel(true);
    setTimeout(() => {
      mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  }, []);

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
            Bản đồ điểm đến Đồng Tháp – Mỹ Tho – Thới Sơn
          </span>
          <h1 className="mt-3 text-3xl text-white sm:text-4xl">Khám phá địa điểm</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-leaf-100 sm:text-base">
            Tìm kiếm theo từ khóa, lọc theo nhóm trải nghiệm, khu vực và định vị trực tiếp từng điểm đến trên Google Maps.
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

            <div className="flex flex-wrap items-center gap-2">
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

              {mappableItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowMapPanel((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold shadow-sm transition-colors ${
                    showMapPanel
                      ? 'bg-leaf-600 text-white hover:bg-leaf-700'
                      : 'border border-sand-300 bg-white text-river-800 hover:bg-sand-100'
                  }`}
                >
                  <MapPin className="size-3.5" aria-hidden />
                  {showMapPanel ? 'Đang bật Google Maps' : 'Hiện bản đồ Google Maps'}
                </button>
              )}
            </div>
          </div>

          {/* Interactive Google Maps Explorer */}
          {showMapPanel && activeMapDestination && activeMapDestination.coordinates && (
            <div ref={mapSectionRef} className="mb-6">
              <Card className="overflow-hidden border border-leaf-200 shadow-raised">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sand-200 bg-gradient-to-r from-leaf-50 via-white to-sand-50 px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-8 place-items-center rounded-full bg-leaf-600 text-white shadow-sm">
                      <MapPin className="size-4" aria-hidden />
                    </span>
                    <div>
                      <h2 className="text-sm font-bold text-river-900">
                        Bản đồ Google Maps · {activeMapDestination.name}
                      </h2>
                      <p className="text-xs text-river-600">
                        {areaLabel(activeMapDestination.area)} · Chọn một địa điểm bên dưới để định vị trực tiếp trên bản đồ
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="inline-flex rounded-full border border-sand-300 bg-white p-0.5 text-xs font-semibold">
                      <button
                        type="button"
                        onClick={() => setMapType('m')}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 transition-colors ${
                          mapType === 'm' ? 'bg-leaf-600 text-white' : 'text-river-700 hover:bg-sand-100'
                        }`}
                      >
                        <MapIcon className="size-3" aria-hidden />
                        Bản đồ
                      </button>
                      <button
                        type="button"
                        onClick={() => setMapType('h')}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 transition-colors ${
                          mapType === 'h' ? 'bg-leaf-600 text-white' : 'text-river-700 hover:bg-sand-100'
                        }`}
                      >
                        <Layers className="size-3" aria-hidden />
                        Vệ tinh
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid lg:grid-cols-[1fr_320px]">
                  <div className="relative h-72 w-full bg-sand-100 sm:h-80 lg:h-96">
                    <iframe
                      key={`${activeMapDestination.slug}-${mapType}`}
                      title={`Google Maps - ${activeMapDestination.name}`}
                      src={googleMapsEmbedUrl(activeMapDestination.coordinates, {
                        label: activeMapDestination.name,
                        mapType,
                        zoom: 15,
                      })}
                      className="h-full w-full border-0"
                      loading="lazy"
                      allowFullScreen
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  </div>

                  <div className="flex max-h-96 flex-col border-t border-sand-200 bg-white lg:border-l lg:border-t-0">
                    {/* Selected place detail header */}
                    <div className="border-b border-sand-200 bg-sand-50/60 p-3.5">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-leaf-700">
                        {categoryLabel(activeMapDestination.category)} · {areaLabel(activeMapDestination.area)}
                      </p>
                      <h3 className="mt-0.5 text-sm font-bold text-river-900">{activeMapDestination.name}</h3>
                      {activeMapDestination.address && (
                        <p className="mt-1 line-clamp-2 text-xs text-river-600">📍 {activeMapDestination.address}</p>
                      )}
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        <a
                          href={directionsUrl(activeMapDestination.coordinates)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={buttonClasses('primary', 'sm')}
                        >
                          <Navigation className="size-3.5" aria-hidden />
                          Chỉ đường
                        </a>
                        <a
                          href={googleMapsPlaceUrl(activeMapDestination.coordinates, activeMapDestination.name)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={buttonClasses('secondary', 'sm')}
                        >
                          Google Maps
                          <ExternalLink className="size-3" aria-hidden />
                        </a>
                        <Link
                          to={`/destinations/${activeMapDestination.slug}`}
                          className="inline-flex min-h-9 items-center rounded-full border border-sand-300 bg-white px-3 text-xs font-semibold text-river-800 hover:bg-sand-100"
                        >
                          Chi tiết →
                        </Link>
                      </div>
                    </div>

                    {/* Quick selector list for destinations on this page */}
                    <div className="flex-1 overflow-y-auto divide-y divide-sand-100 p-2">
                      {mappableItems.map((item, idx) => {
                        const isSelected = item.slug === activeMapDestination.slug;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setSelectedSlug(item.slug)}
                            className={`flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-colors ${
                              isSelected ? 'bg-leaf-50 ring-1 ring-leaf-300' : 'hover:bg-sand-50'
                            }`}
                          >
                            <span
                              className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold ${
                                isSelected ? 'bg-leaf-600 text-white' : 'bg-sand-200 text-river-700'
                              }`}
                            >
                              {idx + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className={`truncate text-xs font-semibold ${isSelected ? 'text-leaf-800' : 'text-river-900'}`}>
                                {item.name}
                              </p>
                              <p className="truncate text-[11px] text-river-500">
                                {areaLabel(item.area)} · {categoryLabel(item.category)}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {query.loading ? (
            <CardGridSkeleton count={6} />
          ) : query.error ? (
            <ErrorState error={query.error} onRetry={query.reload} />
          ) : query.data && query.data.items.length > 0 ? (
            <div className="space-y-8">
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {query.data.items.map((d) => (
                  <DestinationCard
                    key={d.id}
                    destination={d}
                    onSelectMap={handleSelectOnMap}
                    isMapSelected={showMapPanel && activeMapDestination?.slug === d.slug}
                  />
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
