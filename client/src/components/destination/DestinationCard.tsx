import { Clock, MapPin, QrCode } from 'lucide-react';
import { Link } from 'react-router-dom';
import { areaLabel, categoryLabel } from '../../lib/catalog';
import { formatMinutes } from '../../lib/format';
import type { DestinationSummary } from '../../types/api';
import { Badge } from '../ui/Badge';
import { CategoryIcon } from './CategoryIcon';
import { IllustrativeBadge } from './DataBadges';
import { DestinationImage } from './DestinationImage';

export function DestinationCard({ destination }: { destination: DestinationSummary }) {
  const d = destination;
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-card bg-white shadow-card ring-1 ring-sand-200 transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-raised">
      <div className="relative aspect-[4/3] overflow-hidden">
        <DestinationImage image={d.image} category={d.category} name={d.name} />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {d.hasChallenge && (
            <Badge tone="teal" icon={<QrCode className="size-3" aria-hidden />} className="bg-teal-50/95">
              Có thử thách QR
            </Badge>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-leaf-700">
          <CategoryIcon category={d.category} className="size-3.5" />
          {categoryLabel(d.category)}
        </p>
        <h3 className="mt-1.5 text-lg leading-snug">
          <Link to={`/destinations/${d.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none group-focus-within:underline">
            {d.name}
          </Link>
        </h3>
        {d.summary && <p className="mt-1.5 line-clamp-2 text-sm text-river-600">{d.summary}</p>}
        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-4 text-xs text-river-600">
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3.5" aria-hidden />
            {areaLabel(d.area)}
          </span>
          {d.estimatedVisitDuration && (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" aria-hidden />
              {d.estimatedVisitDuration.isEstimate ? '~' : ''}
              {formatMinutes(d.estimatedVisitDuration.minutes)}
            </span>
          )}
          {d.isIllustrative && <IllustrativeBadge />}
          {d.operationalStatus !== 'active' && <Badge tone="red">{d.operationalStatus === 'closed' ? 'Ngừng hoạt động' : 'Tạm đóng cửa'}</Badge>}
        </div>
      </div>
    </article>
  );
}
