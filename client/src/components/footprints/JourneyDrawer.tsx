import clsx from 'clsx';
import {
  Camera,
  CloudOff,
  Compass,
  Download,
  Eye,
  EyeOff,
  MapPinCheck,
  Maximize2,
  Navigation,
  Pause,
  Play,
  Radio,
  RefreshCw,
  Route,
  Square,
  Stamp,
  Trash2,
  Wifi,
  WifiOff,
  X,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  PRESET_DEMO_JOURNEYS,
  type LocalFootprintTrack,
  type PresetJourneyRoute,
} from '../../lib/footprintOfflineStore';

interface RouteStopDisplay {
  idx: number;
  lat: number;
  lng: number;
  title: string;
  emoji: string;
  moodLabel: string;
  note: string;
  imageUrl?: string;
  legKm: number;
  legMin: number;
}

interface JourneyDrawerProps {
  open: boolean;
  onClose: () => void;
  tracks: LocalFootprintTrack[];
  selectedTrack: LocalFootprintTrack | null;
  routeStops: RouteStopDisplay[];
  focusedStopIdx: number | null;
  isRecordingGps: boolean;
  isSavingLiveTrack?: boolean;
  liveElapsedLabel: string;
  livePointsCount?: number;
  liveKm?: number;
  wakeLockActive?: boolean;
  liveGpsError?: string | null;
  simulatingRouteId: string | null;
  isReplaying: boolean;
  replayProgress: number;
  replaySpeed: 1 | 2 | 4;
  fogEnabled: boolean;
  fogRadiusPx: number;
  autoCheckInEnabled: boolean;
  checkInCount: number;
  isEffectiveOnline: boolean;
  simulateOffline: boolean;
  pendingSyncCount: number;
  isSyncing: boolean;
  totalKm: number;
  exploredPercent: number;
  onSelectTrack: (clientId: string) => void;
  onDeleteTrack: (clientId: string) => void;
  onFocusStop: (idx: number, lat: number, lng: number) => void;
  onFitTrack: () => void;
  onStartLiveGps: () => void;
  onStopLiveGps: () => void;
  onRunDemoJourney: (route: PresetJourneyRoute) => void;
  onToggleReplay: () => void;
  onSeekReplay: (pct: number) => void;
  onChangeReplaySpeed: (speed: 1 | 2 | 4) => void;
  onToggleFog: () => void;
  onChangeFogRadius: (val: number) => void;
  onToggleAutoCheckIn: () => void;
  onToggleSimulateOffline: () => void;
  onSyncNow: () => void;
  onExportJson: () => void;
  onDownloadShareCard: () => void;
}

export function JourneyDrawer({
  open,
  onClose,
  tracks,
  selectedTrack,
  routeStops,
  focusedStopIdx,
  isRecordingGps,
  isSavingLiveTrack = false,
  liveElapsedLabel,
  livePointsCount = 0,
  liveKm = 0,
  wakeLockActive = false,
  liveGpsError = null,
  simulatingRouteId,
  isReplaying,
  replayProgress,
  replaySpeed,
  fogEnabled,
  fogRadiusPx,
  autoCheckInEnabled,
  checkInCount,
  isEffectiveOnline,
  simulateOffline,
  pendingSyncCount,
  isSyncing,
  totalKm,
  exploredPercent,
  onSelectTrack,
  onDeleteTrack,
  onFocusStop,
  onFitTrack,
  onStartLiveGps,
  onStopLiveGps,
  onRunDemoJourney,
  onToggleReplay,
  onSeekReplay,
  onChangeReplaySpeed,
  onToggleFog,
  onChangeFogRadius,
  onToggleAutoCheckIn,
  onToggleSimulateOffline,
  onSyncNow,
  onExportJson,
  onDownloadShareCard,
}: JourneyDrawerProps) {
  const [subTab, setSubTab] = useState<'timeline' | 'tracks'>('timeline');

  if (!open) return null;

  return (
    <aside
      aria-label="Quản lý lộ trình & GPS"
      className="fixed inset-x-3 bottom-[5.4rem] z-[960] flex max-h-[68dvh] flex-col overflow-hidden rounded-[26px] border border-white/20 bg-slate-950/90 text-white shadow-[0_24px_60px_-14px_rgba(0,0,0,0.7)] backdrop-blur-2xl sm:inset-x-auto sm:bottom-24 sm:left-4 sm:top-20 sm:max-h-none sm:w-[390px]"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-white/12 px-4 py-3.5">
        <div>
          <h2 className="text-base font-extrabold tracking-tight text-white">Lộ trình & Ghi GPS</h2>
          <p className="text-[11px] text-slate-300 tabular-nums">
            {totalKm} km · {exploredPercent}% Đồng Tháp · {checkInCount} dấu hộ chiếu
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid size-8 place-items-center rounded-full bg-white/10 text-slate-200 transition hover:bg-white/20"
          aria-label="Đóng bảng lộ trình"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Live GPS Recording Primary CTA */}
      <div className="border-b border-white/10 bg-white/[0.04] px-4 py-3">
        <div className="flex items-center gap-2">
          {!isRecordingGps ? (
            <button
              type="button"
              onClick={onStartLiveGps}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-rose-500 to-amber-500 px-3.5 py-2 text-xs font-extrabold text-white shadow-md transition hover:brightness-110"
            >
              <Radio className="size-3.5" />
              Bắt đầu ghi GPS
            </button>
          ) : (
            <button
              type="button"
              disabled={isSavingLiveTrack}
              onClick={onStopLiveGps}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-rose-600 px-3.5 py-2 text-xs font-extrabold text-white ring-2 ring-rose-300/60 disabled:opacity-60"
            >
              <Square className="size-3.5 fill-white" />
              {isSavingLiveTrack ? 'Đang nối đường & lưu...' : `Dừng & Lưu (${liveElapsedLabel})`}
            </button>
          )}

          <button
            type="button"
            onClick={onToggleFog}
            className={clsx(
              'inline-flex items-center gap-1 rounded-full px-3 py-2 text-xs font-bold transition',
              fogEnabled
                ? 'bg-emerald-500/25 text-emerald-200 ring-1 ring-emerald-400/40'
                : 'bg-white/10 text-slate-300 hover:bg-white/20',
            )}
            title="Bật/tắt hiệu ứng Sương mù Khám phá"
          >
            {fogEnabled ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
            Sương mù
          </button>
        </div>

        {isRecordingGps && (
          <div className="mt-2.5 rounded-2xl border border-rose-400/30 bg-rose-500/12 px-3 py-2 text-[11px] leading-relaxed text-rose-100">
            <div className="flex flex-wrap items-center justify-between gap-2 font-bold">
              <span className="tabular-nums">
                ● Đã ghi {liveKm.toFixed(2)} km · {livePointsCount} tọa độ (tự lưu liên tục)
              </span>
              <span className="rounded-full bg-white/12 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
                {wakeLockActive ? 'Giữ sáng màn hình: Bật' : 'Chế độ tự nối khi mở lại'}
              </span>
            </div>
            {liveGpsError ? (
              <p className="mt-1 text-amber-200">{liveGpsError}</p>
            ) : (
              <p className="mt-1 text-slate-300">
                Mẹo Web/PWA: Điện thoại sẽ tạm dừng GPS web khi khóa màn hình — bạn có thể giữ sáng màn hình hoặc mở app vài lần dọc đường để tự động nối trọn tuyến đường bộ!
              </p>
            )}
          </div>
        )}
      </div>

      {fogEnabled && (
        <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/[0.02] px-4 py-2 text-[11px] text-slate-300">
          <span>Độ mở vùng khám phá</span>
          <input
            type="range"
            min={32}
            max={88}
            value={fogRadiusPx}
            onChange={(e) => onChangeFogRadius(Number(e.target.value))}
            className="w-36 accent-emerald-400"
          />
        </div>
      )}

      {/* Sub-tab Switcher */}
      <div className="grid grid-cols-2 gap-1.5 border-b border-white/10 p-2">
        <button
          type="button"
          onClick={() => setSubTab('timeline')}
          className={clsx(
            'inline-flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition',
            subTab === 'timeline'
              ? 'bg-white text-slate-950'
              : 'text-slate-300 hover:bg-white/10 hover:text-white',
          )}
        >
          <Route className="size-3.5" />
          Chặng ({routeStops.length})
        </button>
        <button
          type="button"
          onClick={() => setSubTab('tracks')}
          className={clsx(
            'inline-flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition',
            subTab === 'tracks'
              ? 'bg-white text-slate-950'
              : 'text-slate-300 hover:bg-white/10 hover:text-white',
          )}
        >
          <Compass className="size-3.5" />
          Chuyến đi ({tracks.length})
        </button>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3.5">
        {subTab === 'timeline' ? (
          selectedTrack && routeStops.length > 0 ? (
            <>
              {/* Active Track Replay Bar */}
              <div className="rounded-2xl border border-white/12 bg-white/[0.06] p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-xs font-extrabold text-white">{selectedTrack.title}</p>
                  <button
                    type="button"
                    onClick={onFitTrack}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300 hover:bg-white/20"
                  >
                    <Maximize2 className="size-2.5" />
                    Toàn tuyến
                  </button>
                </div>

                {selectedTrack.points.length >= 2 && (
                  <div className="mt-2.5 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={onToggleReplay}
                      className="grid size-8 shrink-0 place-items-center rounded-full bg-emerald-500 text-white transition hover:bg-emerald-400"
                      aria-label={isReplaying ? 'Tạm dừng bay 3D' : 'Phát lại hành trình 3D'}
                    >
                      {isReplaying ? <Pause className="size-3.5" /> : <Play className="size-3.5 translate-x-0.5 fill-white" />}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={Math.round(replayProgress)}
                      onChange={(e) => onSeekReplay(Number(e.target.value))}
                      className="flex-1 accent-emerald-400"
                    />
                    <div className="flex items-center gap-1">
                      {([1, 2, 4] as const).map((spd) => (
                        <button
                          key={spd}
                          type="button"
                          onClick={() => onChangeReplaySpeed(spd)}
                          className={clsx(
                            'rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums',
                            replaySpeed === spd ? 'bg-emerald-500 text-white' : 'bg-white/10 text-slate-300',
                          )}
                        >
                          {spd}x
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-2.5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onDownloadShareCard}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/10 py-1.5 text-[11px] font-bold text-white transition hover:bg-white/20"
                  >
                    <Camera className="size-3.5 text-emerald-300" />
                    Xuất ảnh lộ trình HD
                  </button>
                  <button
                    type="button"
                    onClick={onExportJson}
                    className="inline-flex items-center justify-center gap-1 rounded-xl bg-white/10 px-3 py-1.5 text-[11px] font-bold text-slate-200 transition hover:bg-white/20"
                  >
                    <Download className="size-3" />
                    JSON
                  </button>
                </div>
              </div>

              {/* Stop Stepper */}
              <ol className="space-y-2">
                {routeStops.map((stop, i) => {
                  const isFocused = focusedStopIdx === i;
                  return (
                    <li key={`${stop.title}-${i}`}>
                      {i > 0 && (
                        <div className="mb-1.5 ml-4 flex items-center gap-1.5 border-l border-dashed border-white/25 py-0.5 pl-3 text-[11px] text-slate-400 tabular-nums">
                          <Navigation className="size-3 text-emerald-400" />
                          <span>
                            {stop.legKm} km · ~{stop.legMin} phút
                          </span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => onFocusStop(i, stop.lat, stop.lng)}
                        className={clsx(
                          'flex w-full items-center gap-3 rounded-2xl border p-2.5 text-left transition',
                          isFocused
                            ? 'border-emerald-400/60 bg-emerald-500/15'
                            : 'border-white/10 bg-white/[0.04] hover:border-white/25 hover:bg-white/[0.08]',
                        )}
                      >
                        {stop.imageUrl ? (
                          <img
                            src={stop.imageUrl}
                            alt=""
                            className="size-11 shrink-0 rounded-xl object-cover ring-1 ring-white/20"
                          />
                        ) : (
                          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/10 text-xs font-extrabold text-emerald-300">
                            {i + 1}
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-bold text-white">
                            {i + 1}. {stop.title}
                          </p>
                          <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-300">
                            {stop.note || stop.moodLabel}
                          </p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/20 bg-white/[0.03] p-5 text-center">
              <p className="text-xs font-bold text-white">Chưa có lộ trình nào được chọn</p>
              <p className="mt-1 text-[11px] text-slate-400">
                Bật Ghi GPS thực tế hoặc chạy thử 1 cung đường mẫu ở tab Chuyến đi.
              </p>
            </div>
          )
        ) : (
          <div className="space-y-4">
            {/* Demo Journeys */}
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-200">
                <Zap className="size-3.5 text-amber-400" />
                Cung đường mẫu (đường bộ thực tế)
              </p>
              <div className="space-y-2">
                {PRESET_DEMO_JOURNEYS.map((route) => {
                  const isRunning = simulatingRouteId === route.id;
                  return (
                    <button
                      key={route.id}
                      type="button"
                      disabled={Boolean(simulatingRouteId)}
                      onClick={() => onRunDemoJourney(route)}
                      className={clsx(
                        'flex w-full items-center justify-between gap-2 rounded-2xl border p-3 text-left transition',
                        isRunning
                          ? 'border-emerald-400 bg-emerald-500/20'
                          : 'border-white/12 bg-white/[0.04] hover:border-white/25 hover:bg-white/[0.08]',
                      )}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: route.color }} />
                          <p className="truncate text-xs font-bold text-white">{route.title}</p>
                        </div>
                        <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-400">{route.subtitle}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-white/12 px-2.5 py-1 text-[10px] font-bold text-emerald-200">
                        {isRunning ? 'Đang chạy' : 'Chạy thử'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Saved Tracks */}
            <div className="border-t border-white/10 pt-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-bold text-slate-200">Nhật ký đã lưu ({tracks.length})</p>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={onToggleSimulateOffline}
                    className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-[10px] font-bold text-amber-200 hover:bg-white/20"
                  >
                    {isEffectiveOnline ? <Wifi className="size-3" /> : <WifiOff className="size-3" />}
                    {simulateOffline ? 'Bật Wi-Fi' : 'Test Offline'}
                  </button>
                  <button
                    type="button"
                    disabled={isSyncing || !isEffectiveOnline}
                    onClick={onSyncNow}
                    className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-[10px] font-bold text-white hover:bg-white/20 disabled:opacity-40"
                  >
                    <RefreshCw className={clsx('size-3', isSyncing && 'animate-spin')} />
                    Sync{pendingSyncCount > 0 ? ` (${pendingSyncCount})` : ''}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {tracks.map((t) => {
                  const active = t.clientId === selectedTrack?.clientId;
                  return (
                    <div
                      key={t.clientId}
                      onClick={() => {
                        onSelectTrack(t.clientId);
                        setSubTab('timeline');
                      }}
                      className={clsx(
                        'cursor-pointer rounded-2xl border p-3 transition',
                        active
                          ? 'border-emerald-400/60 bg-emerald-500/15'
                          : 'border-white/10 bg-white/[0.04] hover:border-white/25',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: t.color || '#10b981' }} />
                          <p className="truncate text-xs font-bold text-white">{t.title}</p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteTrack(t.clientId);
                          }}
                          className="rounded-lg p-1 text-slate-400 hover:bg-rose-500/20 hover:text-rose-300"
                          aria-label={`Xóa ${t.title}`}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400 tabular-nums">
                        {t.distanceKm} km · {t.memories?.length || 0} chặng ·{' '}
                        {t.syncStatus === 'pending' ? 'Lưu Offline' : 'Đã đồng bộ Cloud'}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Auto Check-in & Passport Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/12 bg-white/[0.04] px-4 py-2.5">
        <button
          type="button"
          onClick={onToggleAutoCheckIn}
          className={clsx(
            'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold transition',
            autoCheckInEnabled
              ? 'bg-emerald-500/25 text-emerald-200 ring-1 ring-emerald-400/40'
              : 'bg-white/10 text-slate-300',
          )}
        >
          <MapPinCheck className="size-3.5" />
          Auto Check-in: {autoCheckInEnabled ? 'BẬT' : 'TẮT'}
        </button>

        <div className="flex items-center gap-2">
          {!isEffectiveOnline && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300">
              <CloudOff className="size-3" /> Offline
            </span>
          )}
          <Link
            to="/passport"
            className="inline-flex items-center gap-1 rounded-full bg-white/12 px-3 py-1 text-[11px] font-bold text-white transition hover:bg-white/20"
          >
            <Stamp className="size-3 text-emerald-300" />
            Hộ chiếu số
          </Link>
        </div>
      </div>
    </aside>
  );
}
