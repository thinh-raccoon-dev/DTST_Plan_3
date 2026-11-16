import { DestinationModel } from '../models/Destination.js';
import {
  SafetyAlertModel,
  type SafetyAlertType,
  type SafetySeverity,
  type TerrainImpact,
} from '../models/SafetyAlert.js';
import { haversineKm } from '../utils/geo.js';
import { logger } from '../utils/logger.js';
import { normalizeText } from '../utils/text.js';

export type SimulatePreset = 'heavy_storm' | 'route_accident' | 'mountain_landslide';
export type VenueTerrain = 'indoor' | 'outdoor' | 'mountain' | 'coastal_river';

export interface WeatherSnapshot {
  conditionCode: number;
  conditionLabel: string;
  temperatureC: number;
  precipitationMm: number;
  windSpeedKmh: number;
  windGustsKmh: number;
  riskLevel: 'safe' | 'caution' | 'danger';
  isSimulated?: boolean;
}

export type HazardCategory = SafetyAlertType | 'weather' | 'closed';

export interface SafetyHazardWarning {
  id: string;
  category: HazardCategory;
  severity: SafetySeverity;
  title: string;
  description: string;
  source: string;
  distanceKm?: number;
}

export interface SafeAlternativeSuggestion {
  id: string;
  slug: string;
  name: string;
  area: string;
  category: string;
  coordinates: { lat: number; lng: number };
  shelterType: VenueTerrain;
  distanceKm: number;
  estimatedMinutes: number;
  matchScore: number;
  reason: string;
  summary: string;
}

export interface StopSafetyReport {
  dayNumber: number;
  stopId?: string;
  stepName: string;
  placeId?: string;
  stepType: string;
  coordinates?: { lat: number; lng: number };
  terrainType: VenueTerrain;
  weather?: WeatherSnapshot;
  status: 'safe' | 'caution' | 'danger';
  hazards: SafetyHazardWarning[];
  alternatives: SafeAlternativeSuggestion[];
}

export interface ItinerarySafetyReport {
  overallStatus: 'safe' | 'caution' | 'danger';
  checkedAt: string;
  simulatePreset: SimulatePreset | null;
  activeGlobalAlertsCount: number;
  summaryMessage: string;
  stopReports: StopSafetyReport[];
  weatherOverview: {
    minTempC?: number;
    maxTempC?: number;
    riskyStopsCount: number;
    severeHazardsCount: number;
  };
}

export interface InputActivityStep {
  stop_id?: string;
  type: string;
  name: string;
  place_id?: string;
  latitude?: number;
  longitude?: number;
  start?: string;
  end?: string;
}

export interface InputItineraryDay {
  day: number;
  date?: string;
  activities: InputActivityStep[];
}

interface CatalogPlace {
  id: string;
  slug: string;
  name: string;
  summary: string;
  category: string;
  area: string;
  tags: string[];
  operationalStatus: string;
  coordinates: { lat: number; lng: number };
  terrainType: VenueTerrain;
}

const weatherCache = new Map<string, { data: WeatherSnapshot; fetchedAt: number }>();
const WEATHER_CACHE_TTL_MS = 5 * 60 * 1000;

function decodeWmoWeather(code: number, precipMm: number, gustsKmh: number): {
  label: string;
  riskLevel: 'safe' | 'caution' | 'danger';
} {
  if (code >= 95 || gustsKmh >= 55 || precipMm >= 15) {
    return {
      label: code >= 95 ? 'Giông bão có sấm sét mạnh' : 'Mưa rất to / Gió giật mạnh',
      riskLevel: 'danger',
    };
  }
  if (code >= 80 || code === 63 || code === 65 || precipMm >= 5 || gustsKmh >= 40) {
    return {
      label: 'Mưa vừa đến mưa rào nặng hạt',
      riskLevel: 'caution',
    };
  }
  if (code >= 51 || precipMm >= 1) {
    return { label: 'Mưa nhẹ / Mưa phùn', riskLevel: 'caution' };
  }
  if (code >= 45) {
    return { label: 'Sương mù hạn chế tầm nhìn', riskLevel: 'caution' };
  }
  if (code === 3) return { label: 'Nhiều mây mát mẻ', riskLevel: 'safe' };
  if (code >= 1) return { label: 'Nắng nhẹ, ít mây', riskLevel: 'safe' };
  return { label: 'Trời quang nắng đẹp', riskLevel: 'safe' };
}

export function classifyTerrainType(name: string, category?: string, tags: string[] = []): VenueTerrain {
  const hay = normalizeText(`${name} ${tags.join(' ')}`);
  if (
    hay.includes('nui ') ||
    hay.includes('nui-') ||
    hay.includes('doi nui') ||
    hay.includes('deo ') ||
    hay.includes('cap treo') ||
    hay.includes('sat lo') ||
    hay.includes('thac ')
  ) {
    return 'mountain';
  }
  if (
    hay.includes('bien ') ||
    hay.includes('bai bien') ||
    hay.includes('con phung') ||
    hay.includes('con thoi son') ||
    hay.includes('tram chim') ||
    hay.includes('gao giong') ||
    hay.includes('dong sen') ||
    hay.includes('canh dong sen')
  ) {
    return 'coastal_river';
  }
  if (
    category === 'food' ||
    hay.includes('bao tang') ||
    hay.includes('nha co') ||
    hay.includes('kien an cung') ||
    hay.includes('chua ') ||
    hay.includes('thien vien') ||
    hay.includes('van thanh mieu') ||
    hay.includes('dinh ') ||
    hay.includes('lang nghe') ||
    hay.includes('co so') ||
    hay.includes('dai hoc fpt') ||
    hay.includes('nha hang') ||
    hay.includes('quan ')
  ) {
    return 'indoor';
  }
  return 'outdoor';
}

/** Minimum distance in km from point P to segment AB. */
function pointToSegmentKm(
  p: { lat: number; lng: number },
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dx = b.lng - a.lng;
  const dy = b.lat - a.lat;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-9) return haversineKm(p, a);
  const t = Math.max(0, Math.min(1, ((p.lng - a.lng) * dx + (p.lat - a.lat) * dy) / lenSq));
  return haversineKm(p, { lat: a.lat + t * dy, lng: a.lng + t * dx });
}

async function fetchLiveWeatherForCoordinates(
  points: Array<{ lat: number; lng: number }>,
): Promise<Map<string, WeatherSnapshot>> {
  const result = new Map<string, WeatherSnapshot>();
  if (points.length === 0) return result;

  const uniqueKeys = new Map<string, { lat: number; lng: number }>();
  const now = Date.now();

  for (const pt of points) {
    const key = `${pt.lat.toFixed(2)},${pt.lng.toFixed(2)}`;
    const cached = weatherCache.get(key);
    if (cached && now - cached.fetchedAt < WEATHER_CACHE_TTL_MS) {
      result.set(key, cached.data);
    } else if (!uniqueKeys.has(key)) {
      uniqueKeys.set(key, pt);
    }
  }

  if (uniqueKeys.size === 0) return result;

  const entries = Array.from(uniqueKeys.entries()).slice(0, 20);
  const lats = entries.map(([, p]) => p.lat.toFixed(4)).join(',');
  const lngs = entries.map(([, p]) => p.lng.toFixed(4)).join(',');
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}&current=temperature_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m&timezone=Asia%2FHo_Chi_Minh&forecast_days=1`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4500) });
    if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
    const payload: any = await res.json();
    const list: any[] = Array.isArray(payload) ? payload : [payload];

    entries.forEach(([key], idx) => {
      const item = list[idx];
      const cur = item?.current;
      if (!cur) return;
      const code = Number(cur.weather_code ?? 0);
      const precip = Number(cur.precipitation ?? 0);
      const windSpeed = Number(cur.wind_speed_10m ?? 0);
      const windGusts = Number(cur.wind_gusts_10m ?? windSpeed);
      const temp = Number(cur.temperature_2m ?? 30);
      const decoded = decodeWmoWeather(code, precip, windGusts);

      const snap: WeatherSnapshot = {
        conditionCode: code,
        conditionLabel: decoded.label,
        temperatureC: Math.round(temp * 10) / 10,
        precipitationMm: Math.round(precip * 10) / 10,
        windSpeedKmh: Math.round(windSpeed),
        windGustsKmh: Math.round(windGusts),
        riskLevel: decoded.riskLevel,
      };
      weatherCache.set(key, { data: snap, fetchedAt: now });
      result.set(key, snap);
    });
  } catch (err: any) {
    logger.warn({ err: err?.message || err }, 'Open-Meteo live weather unavailable, using safe baseline');
  }

  return result;
}

async function loadPublishedCatalogPlaces(): Promise<CatalogPlace[]> {
  const docs = await DestinationModel.find({ publicationStatus: 'published' })
    .select('_id slug name summary category area tags operationalStatus coordinates')
    .lean();

  return docs
    .filter((d) => typeof d.coordinates?.lat === 'number' && typeof d.coordinates?.lng === 'number')
    .map((d) => ({
      id: String(d._id),
      slug: d.slug,
      name: d.name,
      summary: d.summary || '',
      category: d.category || 'culture',
      area: d.area || 'cao-lanh',
      tags: Array.isArray(d.tags) ? d.tags : [],
      operationalStatus: d.operationalStatus || 'active',
      coordinates: { lat: d.coordinates!.lat, lng: d.coordinates!.lng },
      terrainType: classifyTerrainType(d.name, d.category, Array.isArray(d.tags) ? d.tags : []),
    }));
}

function findSafeAlternativesForStop(
  targetCoord: { lat: number; lng: number },
  riskReasons: HazardCategory[],
  excludedNamesAndSlugs: Set<string>,
  activeAlerts: Array<{ coordinates: { lat: number; lng: number }; radiusKm: number; terrainImpact?: string }>,
  catalog: CatalogPlace[],
): SafeAlternativeSuggestion[] {
  const needsIndoor =
    riskReasons.includes('weather') || riskReasons.includes('flood') || riskReasons.includes('storm');
  const needsFlatland = riskReasons.includes('landslide');

  const candidates: SafeAlternativeSuggestion[] = [];

  for (const place of catalog) {
    if (place.operationalStatus !== 'active') continue;
    if (excludedNamesAndSlugs.has(place.slug) || excludedNamesAndSlugs.has(normalizeText(place.name))) {
      continue;
    }

    // Never suggest a candidate inside an active hazard radius or vulnerable to the active hazard
    const inActiveHazard = activeAlerts.some((a) => {
      const dist = haversineKm(place.coordinates, a.coordinates);
      if (dist <= a.radiusKm) return true;
      if (a.terrainImpact === 'mountain' && place.terrainType === 'mountain') return true;
      if (a.terrainImpact === 'coastal_river' && place.terrainType === 'coastal_river') return true;
      return false;
    });
    if (inActiveHazard) continue;

    if (needsFlatland && place.terrainType === 'mountain') continue;
    if (needsIndoor && place.terrainType === 'coastal_river') continue;

    const distanceKm = Math.round(haversineKm(targetCoord, place.coordinates) * 10) / 10;
    let score = 60;
    const reasons: string[] = [];

    if (needsIndoor && place.terrainType === 'indoor') {
      score += 35;
      reasons.push('Không gian trong nhà / có mái che tránh mưa bão tốt');
    } else if (needsFlatland && place.terrainType === 'indoor') {
      score += 30;
      reasons.push('Địa hình đồng bằng an toàn, tránh khu vực sạt lở');
    } else if (needsFlatland && place.terrainType !== 'mountain') {
      score += 20;
      reasons.push('Khu vực đồng bằng ổn định, tuyến đường thông thoáng');
    } else if (place.terrainType === 'indoor') {
      score += 18;
      reasons.push('Điểm tham quan văn hóa/ẩm thực ổn định ít phụ thuộc thời tiết');
    }

    if (distanceKm <= 8) {
      score += 20;
      reasons.push(`Rất gần vị trí hiện tại (${distanceKm} km)`);
    } else if (distanceKm <= 25) {
      score += 10;
      reasons.push(`Thuận tuyến di chuyển (${distanceKm} km)`);
    } else if (distanceKm > 80) {
      score -= 25;
    }

    if (reasons.length === 0) {
      reasons.push(`Cách tuyến cũ ${distanceKm} km · Vận hành bình thường`);
    }

    candidates.push({
      id: place.id,
      slug: place.slug,
      name: place.name,
      area: place.area,
      category: place.category,
      coordinates: place.coordinates,
      shelterType: place.terrainType,
      distanceKm,
      estimatedMinutes: Math.max(8, Math.round(distanceKm * 1.4)),
      matchScore: Math.max(40, Math.min(99, score)),
      reason: reasons.join(' · '),
      summary: place.summary,
    });
  }

  return candidates.sort((a, b) => b.matchScore - a.matchScore || a.distanceKm - b.distanceKm).slice(0, 4);
}

function stripMealPrefix(name: string): string {
  return name
    .replace(/^(?:B[ữư]a|Ăn)\s+(?:s[áa]ng|tr[ưươ]a|t[ốo]i)\s*[—–-]\s*/i, '')
    .trim();
}

function findCatalogMatchForStep(
  step: InputActivityStep,
  catalog: CatalogPlace[],
  catalogBySlug: Map<string, CatalogPlace>,
  catalogByNormName: Map<string, CatalogPlace>,
): CatalogPlace | undefined {
  if (step.place_id && catalogBySlug.has(step.place_id)) {
    return catalogBySlug.get(step.place_id);
  }
  const cleanName = stripMealPrefix(step.name);
  const normName = normalizeText(cleanName);
  if (catalogByNormName.has(normName)) {
    return catalogByNormName.get(normName);
  }
  const words = normName.split(' ').filter((w) => w.length >= 2);
  let best: { item: CatalogPlace; score: number } | undefined;
  for (const item of catalog) {
    const itemNorm = normalizeText(item.name);
    if (itemNorm.includes(normName) || normName.includes(itemNorm)) {
      return item;
    }
    const overlap = words.filter((w) => itemNorm.includes(w)).length;
    if (overlap >= 3 && (!best || overlap > best.score)) {
      best = { item, score: overlap };
    }
  }
  return best?.item;
}

const DEFAULT_FALLBACK_COORD = { lat: 10.358, lng: 106.362 };

/**
 * Assess live weather, DB hazards (accidents, landslides, floods, road closures),
 * partner closures, and optional demo simulation scenarios for a multi-day itinerary.
 */
export async function assessItinerarySafety(params: {
  days: InputItineraryDay[];
  simulatePreset?: SimulatePreset | null;
}): Promise<ItinerarySafetyReport> {
  const { days, simulatePreset = null } = params;
  const catalog = await loadPublishedCatalogPlaces();
  const catalogBySlug = new Map(catalog.map((c) => [c.slug, c]));
  const catalogByNormName = new Map(catalog.map((c) => [normalizeText(c.name), c]));

  const excludedNamesAndSlugs = new Set<string>();
  const resolvedStopCoords = new Map<string, { lat: number; lng: number }>();
  const allCoords: Array<{ lat: number; lng: number }> = [];

  for (const day of days) {
    for (let idx = 0; idx < day.activities.length; idx++) {
      const act = day.activities[idx]!;
      if (act.stop_id) {
        if (act.place_id) excludedNamesAndSlugs.add(act.place_id);
        excludedNamesAndSlugs.add(normalizeText(stripMealPrefix(act.name)));
        const matched = findCatalogMatchForStep(act, catalog, catalogBySlug, catalogByNormName);
        if (matched) excludedNamesAndSlugs.add(matched.slug);

        const resolvedCoord =
          typeof act.latitude === 'number' && typeof act.longitude === 'number'
            ? { lat: act.latitude, lng: act.longitude }
            : matched?.coordinates || DEFAULT_FALLBACK_COORD;

        resolvedStopCoords.set(`${day.day}:${act.stop_id}`, resolvedCoord);
        allCoords.push(resolvedCoord);
      }
    }
  }

  // 1. Fetch live Open-Meteo weather + persisted SafetyAlerts in parallel
  const now = new Date();
  const [liveWeatherMap, persistedAlerts] = await Promise.all([
    fetchLiveWeatherForCoordinates(allCoords),
    SafetyAlertModel.find({
      isActive: true,
      $or: [{ expiresAt: { $gt: now } }, { expiresAt: null }],
    }).lean(),
  ]);

  // Build effective alerts list (real persisted alerts + optional transient demo simulation)
  const effectiveAlerts: Array<{
    id: string;
    type: SafetyAlertType;
    severity: SafetySeverity;
    title: string;
    description: string;
    coordinates: { lat: number; lng: number };
    radiusKm: number;
    terrainImpact: TerrainImpact;
    source: string;
  }> = persistedAlerts.map((a) => ({
    id: String(a._id),
    type: a.type as SafetyAlertType,
    severity: a.severity as SafetySeverity,
    title: a.title,
    description: a.description,
    coordinates: { lat: a.coordinates.lat, lng: a.coordinates.lng },
    radiusKm: a.radiusKm ?? 8,
    terrainImpact: (a.terrainImpact || 'outdoor') as TerrainImpact,
    source: a.source || 'admin',
  }));

  // Pick a target outdoor/visit stop coordinate for realistic demo simulation if requested
  const actionableStops = days.flatMap((d) =>
    d.activities
      .filter((s) => Boolean(s.stop_id))
      .map((s) => ({
        day: d.day,
        step: s,
        coords: resolvedStopCoords.get(`${d.day}:${s.stop_id!}`) || DEFAULT_FALLBACK_COORD,
      })),
  );
  const simTargetStop =
    actionableStops.find((s) => {
      const t = classifyTerrainType(s.step.name);
      return t === 'mountain' || t === 'outdoor' || t === 'coastal_river';
    }) ||
    actionableStops[1] ||
    actionableStops[0];

  if (simulatePreset && simTargetStop) {
    const simCoord = simTargetStop.coords;
    if (simulatePreset === 'heavy_storm') {
      effectiveAlerts.push({
        id: 'sim-storm-1',
        type: 'storm',
        severity: 'critical',
        title: `Cảnh báo mưa giông lớn & gió giật tại khu vực ${simTargetStop.step.name}`,
        description:
          'Phát hiện vùng mây đối lưu gây mưa rất to (28mm/h) và gió giật 62 km/h. Khuyến nghị chuyển các điểm tham quan ngoài trời sang điểm có mái che/trong nhà.',
        coordinates: simCoord,
        radiusKm: 25,
        terrainImpact: 'outdoor',
        source: 'Cảnh báo thời tiết Open-Meteo (Mô phỏng)',
      });
    } else if (simulatePreset === 'route_accident') {
      effectiveAlerts.push({
        id: 'sim-accident-1',
        type: 'accident',
        severity: 'critical',
        title: `Tai nạn giao thông nghiêm trọng gần tuyến đường đi ${simTargetStop.step.name}`,
        description:
          'Xảy ra va chạm xe tải trên đoạn đường dẫn vào điểm dừng gây kẹt xe kéo dài > 45 phút và phong tỏa 1 làn xe. Đề xuất đổi sang điểm tham quan tuyến khác thông thoáng.',
        coordinates: simCoord,
        radiusKm: 6,
        terrainImpact: 'road_corridor',
        source: 'Giám sát giao thông thời gian thực (Mô phỏng)',
      });
    } else if (simulatePreset === 'mountain_landslide') {
      effectiveAlerts.push({
        id: 'sim-landslide-1',
        type: 'landslide',
        severity: 'critical',
        title: `Cảnh báo Sạt lở đất đá & Ngập cục bộ tuyến đèo / khu vực ${simTargetStop.step.name}`,
        description:
          'Mưa lớn kéo dài gây nguy cơ sạt lở taluy dương trên tuyến đường đồi dốc / khu du lịch ngoài trời. Hệ thống khuyến nghị đổi sang điểm đồng bằng an toàn ngay.',
        coordinates: simCoord,
        radiusKm: 12,
        terrainImpact: 'all',
        source: 'Cảnh báo địa chất & thiên tai (Mô phỏng)',
      });
    }
  }

  const stopReports: StopSafetyReport[] = [];
  const temps: number[] = [];
  let riskyStopsCount = 0;
  let severeHazardsCount = 0;

  for (const day of days) {
    const dayStops = day.activities.filter((s) => Boolean(s.stop_id));

    for (let idx = 0; idx < dayStops.length; idx++) {
      const step = dayStops[idx]!;
      const matchedCatalog = findCatalogMatchForStep(step, catalog, catalogBySlug, catalogByNormName);

      const coords =
        resolvedStopCoords.get(`${day.day}:${step.stop_id!}`) ||
        matchedCatalog?.coordinates ||
        DEFAULT_FALLBACK_COORD;

      const terrainType =
        matchedCatalog?.terrainType || classifyTerrainType(step.name, undefined, []);

      let weather: WeatherSnapshot | undefined;
      if (coords) {
        const wKey = `${coords.lat.toFixed(2)},${coords.lng.toFixed(2)}`;
        weather = liveWeatherMap.get(wKey);
        if (simulatePreset === 'heavy_storm') {
          weather = {
            conditionCode: 95,
            conditionLabel: 'Giông bão & Mưa rất to (Mô phỏng)',
            temperatureC: 25.4,
            precipitationMm: 28.5,
            windSpeedKmh: 38,
            windGustsKmh: 62,
            riskLevel: 'danger',
            isSimulated: true,
          };
        }
        if (weather) temps.push(weather.temperatureC);
      }

      const hazards: SafetyHazardWarning[] = [];
      const riskCategories: HazardCategory[] = [];

      // Check operational closure from DB
      if (matchedCatalog && matchedCatalog.operationalStatus !== 'active') {
        hazards.push({
          id: `closed-${matchedCatalog.slug}`,
          category: 'closed',
          severity: 'critical',
          title: `${matchedCatalog.name} hiện đang tạm ngừng đón khách`,
          description: 'Đối tác quản lý điểm đến đã cập nhật trạng thái tạm đóng cửa bảo trì/khắc phục sự cố.',
          source: 'Trạng thái Đối tác DTST',
        });
        riskCategories.push('closed');
      }

      // Check Weather Hazards
      if (weather && weather.riskLevel !== 'safe') {
        if (terrainType === 'mountain' && (weather.riskLevel === 'danger' || weather.precipitationMm >= 8)) {
          hazards.push({
            id: `landslide-weather-${step.stop_id || idx}`,
            category: 'landslide',
            severity: 'critical',
            title: `Nguy cơ Sạt lở & Trượt đất vùng núi tại ${step.name}`,
            description: `Thời tiết khu vực đang có ${weather.conditionLabel.toLowerCase()} (${weather.precipitationMm}mm, gió ${weather.windGustsKmh}km/h) — không an toàn cho lộ trình đèo dốc/cáp treo.`,
            source: weather.isSimulated ? 'Mô phỏng Open-Meteo' : 'Open-Meteo Live Weather',
          });
          riskCategories.push('landslide');
        } else if (terrainType === 'outdoor' || terrainType === 'coastal_river') {
          hazards.push({
            id: `weather-${step.stop_id || idx}`,
            category: 'weather',
            severity: weather.riskLevel === 'danger' ? 'critical' : 'warning',
            title: `${weather.conditionLabel} ảnh hưởng trải nghiệm ngoài trời`,
            description: `Điểm tham quan "${step.name}" là không gian mở ngoài trời (${weather.temperatureC}°C, lượng mưa ${weather.precipitationMm}mm). Nên đổi sang điểm có mái che nếu trời mưa nặng hạt.`,
            source: weather.isSimulated ? 'Mô phỏng Open-Meteo' : 'Open-Meteo Live Weather',
          });
          riskCategories.push('weather');
        }
      }

      // Check Geospatial Alerts (Accidents, Landslides, Floods, Storms along stop OR corridor from previous stop)
      if (coords) {
        const prevStep = idx > 0 ? dayStops[idx - 1] : undefined;
        const prevCoords =
          prevStep && typeof prevStep.latitude === 'number' && typeof prevStep.longitude === 'number'
            ? { lat: prevStep.latitude, lng: prevStep.longitude }
            : undefined;

        for (const alert of effectiveAlerts) {
          const distToStop = haversineKm(coords, alert.coordinates);
          const distToCorridor = prevCoords ? pointToSegmentKm(alert.coordinates, prevCoords, coords) : distToStop;
          const effectiveDist = Math.min(distToStop, distToCorridor);

          const isTerrainMatched =
            alert.terrainImpact === 'all' ||
            alert.terrainImpact === 'road_corridor' ||
            alert.terrainImpact === terrainType ||
            (alert.terrainImpact === 'outdoor' &&
              (terrainType === 'outdoor' || terrainType === 'coastal_river' || terrainType === 'mountain'));

          if (effectiveDist <= alert.radiusKm && isTerrainMatched) {
            hazards.push({
              id: alert.id,
              category: alert.type,
              severity: alert.severity,
              title: alert.title,
              description: alert.description,
              source: alert.source,
              distanceKm: Math.round(effectiveDist * 10) / 10,
            });
            riskCategories.push(alert.type);
          }
        }
      }

      const severityRank: Record<SafetySeverity, number> = { critical: 3, warning: 2, advisory: 1 };
      hazards.sort((a, b) => severityRank[b.severity] - severityRank[a.severity]);

      const hasCritical = hazards.some((h) => h.severity === 'critical');
      const hasWarning = hazards.length > 0;
      const status: 'safe' | 'caution' | 'danger' = hasCritical ? 'danger' : hasWarning ? 'caution' : 'safe';

      let alternatives: SafeAlternativeSuggestion[] = [];
      if (status !== 'safe' && coords) {
        alternatives = findSafeAlternativesForStop(
          coords,
          riskCategories,
          excludedNamesAndSlugs,
          effectiveAlerts,
          catalog,
        );
      }

      if (status !== 'safe') riskyStopsCount++;
      severeHazardsCount += hazards.filter((h) => h.severity === 'critical' || h.severity === 'warning').length;

      stopReports.push({
        dayNumber: day.day,
        stopId: step.stop_id,
        stepName: step.name,
        placeId: step.place_id,
        stepType: step.type,
        coordinates: coords,
        terrainType,
        weather,
        status,
        hazards,
        alternatives,
      });
    }
  }

  const overallStatus: 'safe' | 'caution' | 'danger' = stopReports.some((r) => r.status === 'danger')
    ? 'danger'
    : stopReports.some((r) => r.status === 'caution')
      ? 'caution'
      : 'safe';

  const summaryMessage =
    overallStatus === 'danger'
      ? `Phát hiện ${severeHazardsCount} cảnh báo rủi ro cao (thời tiết xấu / tai nạn / sạt lở) tại ${riskyStopsCount} điểm trong lịch trình. AI đã chuẩn bị sẵn điểm thay thế an toàn!`
      : overallStatus === 'caution'
        ? `Có ${riskyStopsCount} điểm cần lưu ý điều kiện thời tiết nhẹ hoặc tuyến di chuyển. Bạn có thể xem trước phương án dự phòng trong nhà.`
        : `Thời tiết thực tế tại các điểm dừng đều thuận lợi và chưa ghi nhận tai nạn hay sạt lở nào trên tuyến di chuyển của bạn!`;

  return {
    overallStatus,
    checkedAt: new Date().toISOString(),
    simulatePreset,
    activeGlobalAlertsCount: persistedAlerts.length,
    summaryMessage,
    stopReports,
    weatherOverview: {
      minTempC: temps.length > 0 ? Math.min(...temps) : undefined,
      maxTempC: temps.length > 0 ? Math.max(...temps) : undefined,
      riskyStopsCount,
      severeHazardsCount,
    },
  };
}
