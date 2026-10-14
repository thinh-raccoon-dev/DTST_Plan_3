import { Clock, ExternalLink, MapPin, Navigation, Phone, Ticket, Timer } from 'lucide-react';
import type { ReactNode } from 'react';
import { NOT_VERIFIED_TEXT } from '../../lib/catalog';
import { directionsUrl, formatDate, formatMinutes, osmEmbedUrl, osmLinkUrl } from '../../lib/format';
import type { DestinationDetail, VerificationLevel } from '../../types/api';
import { buttonClasses } from '../ui/Button';
import { Card } from '../ui/Card';
import { VerificationLevelTag } from './DataBadges';

function InfoRow({ icon, label, level, children }: { icon: ReactNode; label: string; level?: VerificationLevel; children: ReactNode }) {
  return (
    <div className="flex gap-3 py-3">
      <span className="mt-0.5 text-leaf-600">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <dt className="text-sm font-semibold text-river-800">{label}</dt>
          {level && <VerificationLevelTag level={level} />}
        </div>
        <dd className="mt-0.5 break-words text-sm text-river-700">{children}</dd>
      </div>
    </div>
  );
}

const missing = <span className="italic text-river-500">{NOT_VERIFIED_TEXT}</span>;

export function DestinationFacts({ destination: d }: { destination: DestinationDetail }) {
  const contact = d.contactInfo;
  return (
    <Card className="p-5">
      <h2 className="text-lg">Thông tin tham quan</h2>
      <dl className="mt-2 divide-y divide-sand-200">
        <InfoRow icon={<MapPin className="size-5" aria-hidden />} label="Địa chỉ" level={d.verification.location}>
          {d.address ?? missing}
        </InfoRow>
        <InfoRow icon={<Clock className="size-5" aria-hidden />} label="Giờ hoạt động" level={d.verification.openingHours}>
          {d.openingHours ?? missing}
        </InfoRow>
        <InfoRow icon={<Ticket className="size-5" aria-hidden />} label="Giá tham khảo" level={d.verification.referencePrice}>
          {d.referencePrice ?? missing}
        </InfoRow>
        <InfoRow icon={<Phone className="size-5" aria-hidden />} label="Liên hệ" level={d.verification.contactInfo}>
          {contact ? (
            <span className="flex flex-col gap-0.5">
              {contact.phone && <a className="text-leaf-700 hover:underline" href={`tel:${contact.phone.replace(/[^0-9+]/g, '')}`}>{contact.phone}</a>}
              {contact.email && <a className="text-leaf-700 hover:underline" href={`mailto:${contact.email}`}>{contact.email}</a>}
              {contact.website && (
                <a className="text-leaf-700 hover:underline" href={contact.website} target="_blank" rel="noopener noreferrer">
                  {contact.website}
                </a>
              )}
            </span>
          ) : (
            missing
          )}
        </InfoRow>
        <InfoRow icon={<Timer className="size-5" aria-hidden />} label="Thời lượng tham quan">
          {d.estimatedVisitDuration ? (
            <>
              {d.estimatedVisitDuration.isEstimate ? 'Khoảng ' : ''}
              {formatMinutes(d.estimatedVisitDuration.minutes)}
              {d.estimatedVisitDuration.note && <span className="block text-xs text-river-500">{d.estimatedVisitDuration.note}</span>}
            </>
          ) : (
            <span className="italic text-river-500">Chưa có dữ liệu</span>
          )}
        </InfoRow>
      </dl>
      <p className="mt-3 border-t border-sand-200 pt-3 text-xs text-river-500">
        Xác minh gần nhất: {d.lastVerifiedAt ? formatDate(d.lastVerifiedAt) : 'chưa xác minh'} · Cập nhật: {formatDate(d.updatedAt)}
      </p>
    </Card>
  );
}

export function DestinationMap({ destination: d }: { destination: DestinationDetail }) {
  if (!d.coordinates) {
    return (
      <Card className="p-5">
        <h2 className="text-lg">Bản đồ</h2>
        <p className="mt-2 text-sm text-river-600">Chưa có tọa độ cho địa điểm này nên chưa thể hiển thị bản đồ và chỉ đường.</p>
      </Card>
    );
  }
  return (
    <Card className="overflow-hidden">
      <iframe
        title={`Bản đồ ${d.name}`}
        src={osmEmbedUrl(d.coordinates)}
        className="h-56 w-full border-0"
        loading="lazy"
        referrerPolicy="no-referrer"
      />
      <div className="space-y-3 p-4">
        {d.verification.location !== 'verified' && (
          <p className="text-xs text-lotus-700">Vị trí là tọa độ gần đúng, chưa được xác minh. Hãy kiểm tra lại trước khi di chuyển.</p>
        )}
        <div className="flex flex-wrap gap-2">
          <a href={directionsUrl(d.coordinates)} target="_blank" rel="noopener noreferrer" className={buttonClasses('primary', 'sm')}>
            <Navigation className="size-4" aria-hidden />
            Chỉ đường (Google Maps)
          </a>
          <a href={osmLinkUrl(d.coordinates)} target="_blank" rel="noopener noreferrer" className={buttonClasses('secondary', 'sm')}>
            OpenStreetMap
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        </div>
      </div>
    </Card>
  );
}

export function DestinationSources({ destination: d }: { destination: DestinationDetail }) {
  const credits = d.images.filter((img) => img.credit || img.license);
  return (
    <Card className="p-5">
      <h2 className="text-lg">Nguồn thông tin</h2>
      {d.sourceUrls.length > 0 ? (
        <ul className="mt-2 space-y-1.5 text-sm">
          {d.sourceUrls.map((url) => (
            <li key={url}>
              <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 break-all text-leaf-700 hover:underline">
                {url.replace(/^https?:\/\//, '').slice(0, 70)}
                <ExternalLink className="size-3.5 shrink-0" aria-hidden />
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-river-600">Chưa có nguồn tham khảo được ghi nhận.</p>
      )}
      {credits.length > 0 && (
        <div className="mt-3 border-t border-sand-200 pt-3 text-xs text-river-500">
          {credits.map((img) => (
            <p key={img.url}>
              Ảnh: {img.credit ?? 'không rõ tác giả'}
              {img.license && ` · ${img.license}`}
            </p>
          ))}
        </div>
      )}
      {d.isIllustrative && (
        <p className="mt-3 rounded-control bg-lotus-50 p-3 text-xs text-lotus-600">
          Đây là dữ liệu minh họa do nhóm dự án soạn cho bản thử nghiệm, chưa phải thông tin chính thức.
        </p>
      )}
    </Card>
  );
}
