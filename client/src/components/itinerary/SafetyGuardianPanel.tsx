import clsx from 'clsx';
import {
  AlertTriangle,
  Car,
  CheckCircle2,
  CloudLightning,
  CloudRain,
  Compass,
  Mountain,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Thermometer,
  Wind,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import type { V9ItineraryObject, V9Place } from '../../types/api';

export type SimulatePreset = 'heavy_storm' | 'route_accident' | 'mountain_landslide';

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

export interface SafetyHazardWarning {
  id: string;
  category: 'weather' | 'accident' | 'landslide' | 'flood' | 'road_closed' | 'storm' | 'closed';
  severity: 'advisory' | 'warning' | 'critical';
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
  shelterType: 'indoor' | 'outdoor' | 'mountain' | 'coastal_river';
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
  terrainType: 'indoor' | 'outdoor' | 'mountain' | 'coastal_river';
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

const PRESETS: Array<{ value: SimulatePreset | null; label: string; badge: string }> = [
  { value: null, label: 'Thời tiết thực tế', badge: '🌤️' },
  { value: 'heavy_storm', label: 'Mô phỏng Mưa bão', badge: '⛈️' },
  { value: 'route_accident', label: 'Mô phỏng Tai nạn', badge: '🚧' },
  { value: 'mountain_landslide', label: 'Mô phỏng Sạt lở', badge: '⛰️' },
];

export function SafetyGuardianPanel({
  itinerary,
  placesById,
  onReportChange,
  onApplyAlternative,
  editable,
}: {
  itinerary: V9ItineraryObject;
  placesById?: Map<string, V9Place>;
  onReportChange: (report: ItinerarySafetyReport | null) => void;
  onApplyAlternative?: (report: StopSafetyReport, alt: SafeAlternativeSuggestion) => void;
  editable?: boolean;
}) {
  const [simulatePreset, setSimulatePreset] = useState<SimulatePreset | null>(null);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ItinerarySafetyReport | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const runCheck = useCallback(
    async (preset: SimulatePreset | null) => {
      if (!itinerary?.days?.length) return;
      setLoading(true);
      setErrorMsg(null);
      try {
        const enrichedDays = itinerary.days.map((day) => ({
          ...day,
          activities: day.activities.map((act) => {
            const place = act.place_id ? placesById?.get(act.place_id) : undefined;
            const lat =
              typeof act.latitude === 'number'
                ? act.latitude
                : place?.coordinates
                  ? place.coordinates[1]
                  : undefined;
            const lng =
              typeof act.longitude === 'number'
                ? act.longitude
                : place?.coordinates
                  ? place.coordinates[0]
                  : undefined;
            return {
              ...act,
              latitude: lat,
              longitude: lng,
            };
          }),
        }));

        const res = await api.post<{ success: boolean; report: ItinerarySafetyReport }>(
          '/safety/check-itinerary',
          {
            days: enrichedDays,
            simulatePreset: preset,
          },
          { timeout: 12000 },
        );
        setReport(res.data.report);
        onReportChange(res.data.report);
      } catch {
        setErrorMsg('Không thể đồng bộ dữ liệu thời tiết & sự cố lúc này.');
      } finally {
        setLoading(false);
      }
    },
    [itinerary.days, onReportChange, placesById],
  );

  useEffect(() => {
    void runCheck(simulatePreset);
  }, [runCheck, simulatePreset]);

  const riskyReports = report?.stopReports.filter((r) => r.status !== 'safe') ?? [];
  const overall = report?.overallStatus ?? 'safe';

  return (
    <section
      className={clsx(
        'tp-fade-up rounded-panel border p-5 shadow-card transition-all',
        overall === 'danger'
          ? 'border-rose-300 bg-gradient-to-br from-rose-50 via-white to-amber-50/40'
          : overall === 'caution'
            ? 'border-amber-300 bg-gradient-to-br from-amber-50 via-white to-white'
            : 'border-emerald-200 bg-gradient-to-br from-emerald-50/70 via-white to-teal-50/30',
      )}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3.5">
          <span
            className={clsx(
              'grid size-11 shrink-0 place-items-center rounded-2xl text-white shadow-sm',
              overall === 'danger'
                ? 'bg-rose-600 animate-pulse'
                : overall === 'caution'
                  ? 'bg-amber-500'
                  : 'bg-emerald-600',
            )}
          >
            {overall === 'danger' ? (
              <ShieldAlert className="size-5" />
            ) : overall === 'caution' ? (
              <AlertTriangle className="size-5" />
            ) : (
              <ShieldCheck className="size-5" />
            )}
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-extrabold text-river-900">
                Giám sát An toàn Thời gian thực (Thời tiết · Tai nạn · Sạt lở)
              </h3>
              {report?.simulatePreset && (
                <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-bold text-rose-700 ring-1 ring-rose-300">
                  Đang bật chế độ Mô phỏng sự cố
                </span>
              )}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-river-700">
              {loading
                ? 'Đang quét thời tiết trực tiếp Open-Meteo & kiểm tra điểm sạt lở / tai nạn dọc lộ trình...'
                : errorMsg || report?.summaryMessage || 'Sẵn sàng kiểm tra an toàn hành trình.'}
            </p>
            {report && (report.weatherOverview.minTempC !== undefined || report.activeGlobalAlertsCount > 0) && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-river-600">
                {report.weatherOverview.minTempC !== undefined && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-0.5 ring-1 ring-sand-200">
                    <Thermometer className="size-3 text-teal-600" />
                    {report.weatherOverview.minTempC}°C – {report.weatherOverview.maxTempC}°C
                  </span>
                )}
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-0.5 ring-1 ring-sand-200">
                  <Compass className="size-3 text-leaf-600" />
                  Đã quét {report.stopReports.length} điểm dừng
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Simulation & Refresh Controls */}
        <div className="flex flex-wrap items-center gap-1.5">
          {PRESETS.map((p) => {
            const active = simulatePreset === p.value;
            return (
              <button
                key={String(p.value)}
                type="button"
                disabled={loading}
                onClick={() => setSimulatePreset(p.value)}
                className={clsx(
                  'inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-all',
                  active
                    ? p.value
                      ? 'bg-rose-600 text-white shadow-sm ring-1 ring-rose-700'
                      : 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-white text-river-700 ring-1 ring-sand-300 hover:bg-sand-50',
                )}
              >
                <span>{p.badge}</span>
                <span>{p.label}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => void runCheck(simulatePreset)}
            disabled={loading}
            title="Kiểm tra lại thời tiết & sự cố ngay"
            className="inline-flex size-8 items-center justify-center rounded-full bg-white text-river-600 ring-1 ring-sand-300 transition hover:bg-leaf-50 hover:text-leaf-700 disabled:opacity-50"
          >
            <RefreshCw className={clsx('size-3.5', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Actionable Hazard Cards + 1-Click Safe Replacement */}
      {riskyReports.length > 0 && (
        <div className="mt-4 space-y-3 border-t border-rose-200/70 pt-4">
          {riskyReports.map((rep, idx) => (
            <div
              key={`${rep.dayNumber}-${rep.stopId || idx}`}
              className="rounded-2xl border border-rose-200 bg-white p-4 shadow-2xs"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-bold text-rose-800">
                    Ngày {rep.dayNumber} · {rep.stepName}
                  </span>
                  {rep.hazards.map((hz) => (
                    <div key={hz.id} className="mt-2 flex items-start gap-2">
                      <span className="mt-0.5 shrink-0 text-rose-600">
                        {hz.category === 'accident' ? (
                          <Car className="size-4" />
                        ) : hz.category === 'landslide' ? (
                          <Mountain className="size-4" />
                        ) : hz.category === 'weather' || hz.category === 'storm' ? (
                          <CloudLightning className="size-4" />
                        ) : (
                          <CloudRain className="size-4" />
                        )}
                      </span>
                      <div>
                        <p className="text-xs font-bold text-rose-950">{hz.title}</p>
                        <p className="text-xs text-river-600">{hz.description}</p>
                        <p className="mt-0.5 text-[10px] font-medium text-river-400">
                          Nguồn: {hz.source}
                          {hz.distanceKm !== undefined ? ` · Cách điểm/tuyến ${hz.distanceKm} km` : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {rep.alternatives.length > 0 && (
                <div className="mt-3 rounded-xl bg-emerald-50/70 p-3 ring-1 ring-emerald-200/80">
                  <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-emerald-800">
                    <Sparkles className="size-3.5 text-emerald-600" />
                    Điểm thay thế an toàn được AI đề xuất ({rep.alternatives.length})
                  </p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {rep.alternatives.slice(0, 2).map((alt) => (
                      <div
                        key={alt.slug}
                        className="flex flex-col justify-between gap-2 rounded-xl bg-white p-2.5 ring-1 ring-emerald-200"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1">
                            <p className="truncate text-xs font-bold text-river-900">{alt.name}</p>
                            <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                              {alt.matchScore}% an toàn
                            </span>
                          </div>
                          <p className="mt-0.5 text-[11px] text-river-600">
                            {alt.shelterType === 'indoor' ? '🏠 Trong nhà / Mái che' : '🌿 Đồng bằng thoáng'} ·{' '}
                            {alt.distanceKm} km (~{alt.estimatedMinutes}p)
                          </p>
                          <p className="mt-0.5 line-clamp-2 text-[11px] text-river-500">{alt.reason}</p>
                        </div>
                        {editable && onApplyAlternative && (
                          <button
                            type="button"
                            onClick={() => onApplyAlternative(rep, alt)}
                            className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-700"
                          >
                            <CheckCircle2 className="size-3.5" />
                            Đổi sang điểm an toàn này
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function StopWeatherChip({ weather }: { weather?: WeatherSnapshot }) {
  if (!weather) return null;
  const isBad = weather.riskLevel === 'danger';
  const isCaution = weather.riskLevel === 'caution';
  return (
    <span
      title={`${weather.conditionLabel} · Mưa ${weather.precipitationMm}mm · Gió giật ${weather.windGustsKmh}km/h`}
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
        isBad
          ? 'bg-rose-100 text-rose-800 ring-rose-300'
          : isCaution
            ? 'bg-amber-100 text-amber-800 ring-amber-300'
            : 'bg-sky-50 text-sky-800 ring-sky-200',
      )}
    >
      {isBad ? (
        <CloudLightning className="size-3" />
      ) : isCaution ? (
        <CloudRain className="size-3" />
      ) : (
        <Wind className="size-3" />
      )}
      {weather.temperatureC}°C · {weather.conditionLabel}
    </span>
  );
}
