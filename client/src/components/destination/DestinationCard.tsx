import { ArrowUpRight, Clock, MapPin, Navigation, QrCode } from 'lucide-react';
import { Link } from 'react-router-dom';
import { areaLabel, categoryLabel } from '../../lib/catalog';
import { directionsUrl, formatMinutes } from '../../lib/format';
import type { DestinationSummary } from '../../types/api';
import { Badge } from '../ui/Badge';
import { CategoryIcon } from './CategoryIcon';
import { IllustrativeBadge } from './DataBadges';
import { DestinationImage } from './DestinationImage';

export function DestinationCard({
  destination,
  onSelectMap,
  isMapSelected = false,
}: {
  destination: DestinationSummary;
  onSelectMap?: (d: DestinationSummary) => void;
  isMapSelected?: boolean;
}) {
  const d = destination;
  return (
    <article
      className={`tp-fade-up group relative flex h-full flex-col overflow-hidden rounded-card bg-white shadow-card ring-1 transition-all duration-300 hover:-translate-y-1 hover:shadow-raised ${
        isMapSelected ? 'ring-2 ring-leaf-600' : 'ring-sand-200 hover:ring-leaf-300'
      }`}
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <DestinationImage image={d.image} category={d.category} name={d.name} />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {d.hasChallenge && (
            <Badge tone="teal" icon={<QrCode className="size-3" aria-hidden />} className="bg-teal-50/95 shadow-card backdrop-blur-sm">
              Có thử thách QR
            </Badge>
          )}
        </div>
        <span
          className="pointer-events-none absolute bottom-3 right-3 grid size-8 translate-y-1 place-items-center rounded-full bg-white/90 text-leaf-700 opacity-0 shadow-card ring-1 ring-sand-200 backdrop-blur-sm transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100"
          aria-hidden
        >
          <ArrowUpRight className="size-4" />
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-leaf-700">
          <CategoryIcon category={d.category} className="size-3.5" />
          {categoryLabel(d.category)}
        </p>
        <h3 className="mt-1.5 text-lg leading-snug transition-colors group-hover:text-leaf-700">
          <Link to={`/destinations/${d.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none group-focus-within:underline">
            {d.name}
          </Link>
        </h3>
        {d.summary && <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-river-600">{d.summary}</p>}
        {d.address && (
          <p className="mt-2 line-clamp-1 text-xs text-river-500" title={d.address}>
            📍 {d.address}
          </p>
        )}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-sand-100 pt-3.5 text-xs text-river-600">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1 font-medium text-river-700">
              <MapPin className="size-3.5 text-leaf-600" aria-hidden />
              {areaLabel(d.area)}
            </span>
            {d.estimatedVisitDuration && (
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3.5 text-river-400" aria-hidden />
                {d.estimatedVisitDuration.isEstimate ? '~' : ''}
                {formatMinutes(d.estimatedVisitDuration.minutes)}
              </span>
            )}
          </div>
          {d.coordinates && (
            <div className="relative z-10 flex items-center gap-1">
              {onSelectMap && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onSelectMap(d);
                  }}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    isMapSelected
                      ? 'bg-leaf-600 text-white'
                      : 'bg-leaf-50 text-leaf-700 ring-1 ring-leaf-200 hover:bg-leaf-100'
                  }`}
                  title="Xem vị trí địa điểm này trên bản đồ Google Maps"
                >
                  <MapPin className="size-3" aria-hidden />
                  Bản đồ
                </button>
              )}
              <a
                href={directionsUrl(d.coordinates)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 rounded-full bg-sand-100 px-2 py-1 text-[11px] font-semibold text-river-700 ring-1 ring-sand-200 transition-colors hover:bg-sand-200"
                title="Chỉ đường bằng Google Maps"
              >
                <Navigation className="size-3 text-leaf-600" aria-hidden />
              </a>
            </div>
          )}
          {d.isIllustrative && <IllustrativeBadge />}
          {d.operationalStatus !== 'active' && <Badge tone="red">{d.operationalStatus === 'closed' ? 'Ngừng hoạt động' : 'Tạm đóng cửa'}</Badge>}
        </div>
      </div>
    </article>
  );
}
