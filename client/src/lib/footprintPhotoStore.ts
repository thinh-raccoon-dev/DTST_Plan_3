import { haversineDistanceKm } from './footprintOfflineStore';

export type PhotoSourceApp = 'web' | 'ios' | 'android' | 'flutter' | 'import' | 'journey';

export interface FootprintPhotoItem {
  id: string;
  clientPhotoId: string;
  imageUrl: string;
  thumbnailUrl?: string;
  coordinates: { lat: number; lng: number };
  accuracyMeters?: number;
  altitudeMeters?: number;
  headingDegrees?: number;
  takenAt: string; // ISO-8601 timestamp
  placeName: string;
  area?: string;
  destinationId?: string;
  destinationSlug?: string;
  trackClientId?: string;
  caption?: string;
  moodEmoji?: string;
  sourceApp: PhotoSourceApp;
  deviceModel?: string;
  exifSource?: 'exif' | 'gps' | 'manual';
  width?: number;
  height?: number;
  fileSize?: number;
  mimeType?: string;
  visibility?: 'private' | 'public';
  isStarterMemory?: boolean;
}

export interface PhotoPlaceCollection {
  key: string;
  placeName: string;
  area: string;
  destinationId?: string;
  destinationSlug?: string;
  coordinates: { lat: number; lng: number };
  coverImageUrl: string;
  photoCount: number;
  latestTakenAt: string;
  earliestTakenAt: string;
  photos: FootprintPhotoItem[];
}

export interface PhotoCluster {
  id: string;
  lat: number;
  lng: number;
  title: string;
  area: string;
  count: number;
  coverPhoto: FootprintPhotoItem;
  photos: FootprintPhotoItem[];
  latestTakenAt: string;
  earliestTakenAt: string;
  hasUserPhotos: boolean;
}

export interface LiveUserLocation {
  lat: number;
  lng: number;
  accuracyMeters?: number;
  headingDegrees?: number | null;
  speedKmh?: number;
  updatedAt: number;
  isManualFallback?: boolean;
}

export interface GeofenceTargetItem {
  id: string;
  name: string;
  slug: string;
  area: string;
  category: string;
  summary: string;
  imageUrl?: string;
  coordinates: { lat: number; lng: number };
  isCheckedIn: boolean;
}

const AREA_DISPLAY: Record<string, string> = {
  'sa-dec': 'Sa Đéc',
  'cao-lanh': 'Cao Lãnh',
  'tam-nong': 'Tam Nông',
  'thap-muoi': 'Tháp Mười',
  'lai-vung': 'Lai Vung',
  'hong-ngu': 'Hồng Ngự',
  'my-tho': 'Mỹ Tho',
  'tien-giang': 'Tiền Giang',
  'cai-be': 'Cái Bè',
  'go-cong': 'Gò Công',
  'thoi-son': 'Cù lao Thới Sơn',
  'vinh-long': 'Vĩnh Long',
  'can-tho': 'Cần Thơ',
  'lap-vo': 'Lấp Vò',
  'chau-thanh': 'Châu Thành',
};

export function formatAreaDisplay(area?: string): string {
  if (!area) return '';
  return AREA_DISPLAY[area.toLowerCase()] || area;
}

export function formatSourceAppLabel(sourceApp: PhotoSourceApp): string {
  switch (sourceApp) {
    case 'ios':
      return 'iOS App';
    case 'android':
      return 'Android App';
    case 'flutter':
      return 'Mobile App';
    case 'import':
      return 'Thư viện EXIF';
    case 'journey':
      return 'Kỷ niệm hành trình';
    default:
      return 'Web App';
  }
}

export function formatPhotoClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

export function formatPhotoShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatPhotoFullDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const date = d.toLocaleDateString('vi-VN', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  return `${time} · ${date}`;
}

export function formatPhotoDayHeading(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Không rõ ngày';
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return 'Hôm nay';

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  ) {
    return 'Hôm qua';
  }

  return d.toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function toLocalDateTimeInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Zoom-responsive spatial clustering algorithm inspired by Apple Photos Map:
 * - Wide regional zoom merges nearby towns into crisp stacked photo cards with total count.
 * - Close zoom separates individual spots while keeping photos taken at the same spot stacked.
 */
export function clusterPhotosByZoom(photos: FootprintPhotoItem[], zoom: number): PhotoCluster[] {
  if (photos.length === 0) return [];

  // Radius in km scaled smoothly with Web Mercator zoom
  let radiusKm: number;
  if (zoom <= 6.5) radiusKm = 75;
  else if (zoom <= 8) radiusKm = 32;
  else if (zoom <= 9.5) radiusKm = 14;
  else if (zoom <= 11) radiusKm = 5.5;
  else if (zoom <= 12.5) radiusKm = 1.8;
  else if (zoom <= 14) radiusKm = 0.45;
  else radiusKm = 0.12;

  // Sort newest first so cluster anchor & cover photo is always the latest memory
  const sorted = [...photos].sort(
    (a, b) => new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime(),
  );

  const rawClusters: Array<{
    latSum: number;
    lngSum: number;
    photos: FootprintPhotoItem[];
  }> = [];

  for (const photo of sorted) {
    let matched: (typeof rawClusters)[number] | null = null;
    let bestDist = Infinity;

    for (const c of rawClusters) {
      const centerLat = c.latSum / c.photos.length;
      const centerLng = c.lngSum / c.photos.length;
      const d = haversineDistanceKm(photo.coordinates, { lat: centerLat, lng: centerLng });
      if (d <= radiusKm && d < bestDist) {
        bestDist = d;
        matched = c;
      }
    }

    if (matched) {
      matched.photos.push(photo);
      matched.latSum += photo.coordinates.lat;
      matched.lngSum += photo.coordinates.lng;
    } else {
      rawClusters.push({
        latSum: photo.coordinates.lat,
        lngSum: photo.coordinates.lng,
        photos: [photo],
      });
    }
  }

  return rawClusters.map((c, idx) => {
    const coverPhoto = c.photos[0]!;
    const uniquePlaceNames = Array.from(
      new Set(c.photos.map((p) => p.placeName).filter((n) => n && n.trim().length > 0)),
    );
    const title =
      uniquePlaceNames.length === 1
        ? uniquePlaceNames[0]!
        : uniquePlaceNames.length > 1
          ? `${uniquePlaceNames[0]} +${uniquePlaceNames.length - 1} điểm`
          : formatAreaDisplay(coverPhoto.area) ||
            `${coverPhoto.coordinates.lat.toFixed(3)}, ${coverPhoto.coordinates.lng.toFixed(3)}`;

    const area = formatAreaDisplay(coverPhoto.area) || '';
    const times = c.photos.map((p) => p.takenAt).sort();

    return {
      id: `cluster-${idx}-${coverPhoto.id}`,
      lat: c.latSum / c.photos.length,
      lng: c.lngSum / c.photos.length,
      title,
      area,
      count: c.photos.length,
      coverPhoto,
      photos: c.photos,
      earliestTakenAt: times[0] || coverPhoto.takenAt,
      latestTakenAt: times[times.length - 1] || coverPhoto.takenAt,
      hasUserPhotos: c.photos.some((p) => !p.isStarterMemory),
    };
  });
}

export function groupPhotosByPlace(photos: FootprintPhotoItem[]): PhotoPlaceCollection[] {
  const map = new Map<string, PhotoPlaceCollection>();
  const sorted = [...photos].sort(
    (a, b) => new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime(),
  );

  for (const photo of sorted) {
    const key = photo.destinationId
      ? `dest:${photo.destinationId}`
      : photo.placeName
        ? `place:${photo.placeName.toLowerCase()}`
        : `grid:${photo.coordinates.lat.toFixed(2)},${photo.coordinates.lng.toFixed(2)}`;

    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        key,
        placeName:
          photo.placeName ||
          `Điểm ${photo.coordinates.lat.toFixed(3)}, ${photo.coordinates.lng.toFixed(3)}`,
        area: formatAreaDisplay(photo.area),
        destinationId: photo.destinationId,
        destinationSlug: photo.destinationSlug,
        coordinates: photo.coordinates,
        coverImageUrl: photo.thumbnailUrl || photo.imageUrl,
        photoCount: 1,
        latestTakenAt: photo.takenAt,
        earliestTakenAt: photo.takenAt,
        photos: [photo],
      });
    } else {
      existing.photoCount += 1;
      existing.photos.push(photo);
      if (photo.takenAt > existing.latestTakenAt) {
        existing.latestTakenAt = photo.takenAt;
        existing.coverImageUrl = photo.thumbnailUrl || photo.imageUrl;
      }
      if (photo.takenAt < existing.earliestTakenAt) {
        existing.earliestTakenAt = photo.takenAt;
      }
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(b.latestTakenAt).getTime() - new Date(a.latestTakenAt).getTime(),
  );
}
