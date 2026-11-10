import clsx from 'clsx';
import {
  AlertCircle,
  Award,
  CheckCircle2,
  ExternalLink,
  Info,
  MapPinCheck,
  Navigation,
  Radio,
  RefreshCw,
  Search,
  Sparkles,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { announceBadges } from '../components/challenge/ChallengeQuiz';
import { PageContainer } from '../components/layout/PublicLayout';
import { Button, ButtonLink } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState, PageLoader } from '../components/ui/States';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { api, toApiError } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { toast } from '../stores/toastStore';
import type { BadgeInfo } from '../types/api';

export interface NearbyDestinationItem {
  id: string;
  name: string;
  slug: string;
  summary: string;
  category: string;
  area: string;
  address: string | null;
  images: Array<{ url: string; alt?: string }>;
  coordinates: { lat: number; lng: number };
  distanceMeters: number;
  distanceKm: number;
  canCheckIn: boolean;
  isCheckedIn: boolean;
}

interface NearbyResponse {
  items: NearbyDestinationItem[];
  totalCount: number;
  inRangeCount: number;
  checkedInCount: number;
  maxCheckInMeters: number;
  userLocation: { lat: number; lng: number };
}

interface CheckInResult {
  created: boolean;
  pointsAwarded: number;
  newBadges: BadgeInfo[];
  distanceMeters: number;
  destination: {
    id: string;
    name: string;
    slug: string;
    category: string;
    area: string;
  };
}

// Preset destinations in Dong Thap for quick demo / simulation
const DEMO_PRESETS = [
  { name: 'Khu di tích Nguyễn Sinh Sắc (TP. Cao Lãnh)', lat: 10.4533, lng: 105.6339 },
  { name: 'Vườn quốc gia Tràm Chim (Huyện Tam Nông)', lat: 10.7022, lng: 105.5186 },
  { name: 'Làng hoa kiểng Sa Đéc (TP. Sa Đéc)', lat: 10.2986, lng: 105.7589 },
  { name: 'Khu du lịch sinh thái Gáo Giồng (Cao Lãnh)', lat: 10.5512, lng: 105.5804 },
  { name: 'Nhà cổ Huỳnh Thủy Lê (TP. Sa Đéc)', lat: 10.2965, lng: 105.7621 },
  { name: 'Chùa Kiến An Cung (TP. Sa Đéc)', lat: 10.3018, lng: 105.7607 },
  { name: 'Khu di tích Xẻo Quýt (Cao Lãnh)', lat: 10.3756, lng: 105.7483 },
  { name: 'Vườn quýt hồng Lai Vung (Huyện Lai Vung)', lat: 10.2289, lng: 105.6742 },
];

export function GpsCheckInPage() {
  useDocumentTitle('Điểm danh thực địa GPS (Geofencing)');
  const user = useAuthStore((s) => s.user);

  // GPS state
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(true);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [selectedDemoIndex, setSelectedDemoIndex] = useState(0);

  // Data state
  const [data, setData] = useState<NearbyResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingInId, setCheckingInId] = useState<string | null>(null);

  // Filter & Search
  const [activeTab, setActiveTab] = useState<'all' | 'inRange' | 'unvisited' | 'visited'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Get real GPS location
  const requestRealLocation = useCallback(() => {
    setGpsLoading(true);
    setGpsError(null);
    if (!navigator.geolocation) {
      setGpsError('Trình duyệt của bạn không hỗ trợ định vị GPS.');
      setGpsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsError(null);
        setGpsLoading(false);
        setIsDemoMode(false);
      },
      (err) => {
        let msg = 'Không thể xác định vị trí thực tế.';
        if (err.code === err.PERMISSION_DENIED) {
          msg = 'Bạn đã từ chối quyền truy cập vị trí. Hãy bật GPS và cấp quyền cho trình duyệt, hoặc sử dụng Chế độ Mô phỏng Kiểm thử bên dưới.';
        } else if (err.code === err.TIMEOUT) {
          msg = 'Hết thời gian chờ phản hồi GPS. Đang chuyển sang vị trí mặc định.';
        }
        setGpsLoading(false);
        // Only show error if we have no valid coordinates at all
        setCoords((prev) => {
          if (prev) {
            setGpsError(null);
            return prev;
          }
          setGpsError(msg);
          const defaultPreset = DEMO_PRESETS[0]!;
          return { lat: defaultPreset.lat, lng: defaultPreset.lng };
        });
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 },
    );
  }, []);

  // Initialize GPS on load
  useEffect(() => {
    requestRealLocation();
  }, [requestRealLocation]);

  // 2. Fetch nearby destinations based on current coordinates
  const fetchNearby = useCallback(async (currentCoords: { lat: number; lng: number }) => {
    setLoading(true);
    try {
      const res = await api.get<NearbyResponse>(
        `/destinations/nearby?lat=${currentCoords.lat}&lng=${currentCoords.lng}&limit=60`,
      );
      setData(res.data);
    } catch (err) {
      toast.error('Lỗi tải danh sách địa điểm', toApiError(err).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (coords) {
      fetchNearby(coords);
    }
  }, [coords, fetchNearby]);

  // 3. Handle Simulation Mode toggle
  const toggleDemoMode = (enabled: boolean) => {
    setIsDemoMode(enabled);
    if (enabled) {
      const preset = DEMO_PRESETS[selectedDemoIndex] ?? DEMO_PRESETS[0]!;
      setCoords({ lat: preset.lat, lng: preset.lng });
      toast.info('Đã bật Chế độ Mô phỏng', `Đang mô phỏng vị trí có mặt tại: ${preset.name}`);
    } else {
      requestRealLocation();
      toast.info('Đã chuyển về GPS vệ tinh thực tế');
    }
  };

  const selectDemoPreset = (index: number) => {
    setSelectedDemoIndex(index);
    const preset = DEMO_PRESETS[index] ?? DEMO_PRESETS[0]!;
    setCoords({ lat: preset.lat, lng: preset.lng });
    toast.success('Dịch chuyển vị trí thành công', `Tọa độ hiện tại: ${preset.name}`);
  };

  // 4. Perform GPS Check-in
  const handleCheckIn = async (item: NearbyDestinationItem) => {
    if (!coords) return;
    setCheckingInId(item.id);
    try {
      const res = await api.post<CheckInResult>(`/destinations/${item.slug}/check-in`, {
        lat: coords.lat,
        lng: coords.lng,
        isSimulated: isDemoMode,
      });

      if (res.data.created) {
        toast.success(
          `Điểm danh thành công! (+${res.data.pointsAwarded} EXP)`,
          `Bạn đã chính thức khám phá "${item.name}". Khoảng cách ghi nhận: ${res.data.distanceMeters} m.`,
        );
        if (res.data.newBadges?.length) {
          announceBadges(res.data.newBadges);
        }
      } else {
        toast.info('Bạn đã điểm danh địa điểm này trước đó', 'Mỗi địa điểm chỉ cộng điểm EXP một lần.');
      }

      // Refresh list to update check-in status
      await fetchNearby(coords);
    } catch (err) {
      toast.error('Không thể điểm danh thực địa', toApiError(err).message);
    } finally {
      setCheckingInId(null);
    }
  };

  // Filtered destinations list
  const filteredItems = useMemo(() => {
    if (!data?.items) return [];
    let list = data.items;

    if (activeTab === 'inRange') list = list.filter((i) => i.canCheckIn);
    else if (activeTab === 'unvisited') list = list.filter((i) => !i.isCheckedIn);
    else if (activeTab === 'visited') list = list.filter((i) => i.isCheckedIn);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.area.toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q),
      );
    }

    return list;
  }, [data?.items, activeTab, searchQuery]);

  const nearest = data?.items?.[0] || null;

  return (
    <PageContainer>
      {/* Hero Header */}
      <section className="tp-fade-up relative overflow-hidden rounded-panel bg-gradient-to-br from-leaf-900 via-leaf-800 to-teal-900 p-6 text-white shadow-raised sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 size-72 rounded-full bg-teal-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/4 size-80 rounded-full bg-amber-400/15 blur-3xl" />

        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold ring-1 ring-white/20">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-teal-300 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-teal-400" />
              </span>
              <span>ĐỊNH VỊ VỆ TINH GEOFENCING · BÁN KÍNH 1.000M</span>
            </div>

            <h1 className="mt-3 text-2xl font-bold text-white sm:text-4xl">
              Điểm Danh Thực Địa GPS
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-leaf-100 sm:text-base">
              Không cần dán hay quét mã QR phức tạp! Khi bạn có mặt thực tế tại các điểm đến di tích & sinh thái Đất Sen Hồng, hệ thống sẽ tự động đối chiếu tọa độ vệ tinh và mở khóa điểm danh nhận điểm <strong>EXP</strong> ngay trên thiết bị.
            </p>

            {/* Quick stats on banner */}
            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs sm:text-sm text-leaf-200">
              <div className="flex items-center gap-1.5">
                <MapPinCheck className="size-4 text-teal-300" />
                <span>Đã điểm danh: <strong className="text-white">{data?.checkedInCount ?? 0}</strong> địa điểm</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Radio className="size-4 text-amber-300" />
                <span>Trong phạm vi check-in: <strong className="text-white">{data?.inRangeCount ?? 0}</strong> điểm</span>
              </div>
            </div>
          </div>

          {/* Quick link to 3D Passport */}
          <div className="rounded-3xl bg-white/10 p-5 ring-1 ring-white/20 backdrop-blur-md lg:min-w-64">
            <p className="text-xs font-semibold uppercase tracking-wider text-leaf-200">HỘ CHIẾU TRẢI NGHIỆM SỐ</p>
            <p className="mt-1 text-lg font-bold text-white">
              {user?.displayName || 'Du khách Khám phá'}
            </p>
            <p className="text-xs text-leaf-100 mt-0.5">
              Tích lũy EXP để thăng hạng Thẻ Sen Hồng 3D
            </p>
            <ButtonLink
              to="/passport"
              variant="inverted"
              size="sm"
              className="mt-4 w-full justify-center"
              icon={<Award className="size-4 text-leaf-800" />}
            >
              Xem Thẻ Du Hành 3D
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* GPS Status & Demo Mode Control Bar */}
      <section className="tp-fade-up mt-6 rounded-2xl border border-sand-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className={clsx(
              'flex size-10 shrink-0 items-center justify-center rounded-xl ring-1',
              isDemoMode ? 'bg-amber-50 text-amber-600 ring-amber-200' : 'bg-teal-50 text-teal-600 ring-teal-200',
            )}>
              {isDemoMode ? <Radio className="size-5" /> : <Navigation className="size-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-river-500">TRẠNG THÁI GPS:</span>
                <span className={clsx(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1',
                  isDemoMode
                    ? 'bg-amber-50 text-amber-700 ring-amber-200'
                    : 'bg-emerald-50 text-emerald-700 ring-emerald-200',
                )}>
                  <span className={clsx('size-1.5 rounded-full', isDemoMode ? 'bg-amber-500' : 'bg-emerald-500')} />
                  {isDemoMode ? 'Chế độ Mô phỏng Kiểm thử' : 'GPS Vệ tinh Trực tuyến'}
                </span>
              </div>
              <p className="text-sm font-medium text-river-800 mt-0.5">
                {coords
                  ? `Tọa độ: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)} ${isDemoMode ? `(${DEMO_PRESETS[selectedDemoIndex]?.name ?? ''})` : ''}`
                  : gpsLoading ? 'Đang xác định vị trí...' : 'Chưa có tọa độ'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <Button
              size="sm"
              variant="secondary"
              onClick={requestRealLocation}
              loading={gpsLoading}
              icon={<RefreshCw className="size-3.5" />}
              title="Lấy lại vị trí GPS thực tế từ thiết bị"
            >
              Cập nhật GPS
            </Button>

            <button
              type="button"
              onClick={() => toggleDemoMode(!isDemoMode)}
              className={clsx(
                'inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all shadow-sm ring-1',
                isDemoMode
                  ? 'bg-amber-500 text-white ring-amber-600 shadow-amber-200 hover:bg-amber-600'
                  : 'bg-sand-100 text-river-700 ring-sand-300 hover:bg-sand-200',
              )}
            >
              <Sparkles className="size-3.5" />
              {isDemoMode ? 'Đang bật Demo (Tắt)' : 'Bật Demo Dùng Thử'}
            </button>
          </div>
        </div>

        {/* Demo Preset Selector (Visible when Demo Mode is ON) */}
        {isDemoMode && (
          <div className="mt-4 pt-4 border-t border-sand-200">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold text-amber-800 uppercase tracking-wide">
                🎯 Dịch chuyển tức thời đến điểm đến để test Check-in:
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {DEMO_PRESETS.map((p, idx) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => selectDemoPreset(idx)}
                  className={clsx(
                    'rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ring-1',
                    selectedDemoIndex === idx
                      ? 'bg-amber-500 text-white ring-amber-600 shadow-sm font-semibold'
                      : 'bg-sand-50 text-river-700 ring-sand-200 hover:bg-sand-100',
                  )}
                >
                  {p.name.split(' (')[0]}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-river-500 italic">
              💡 Chế độ Demo cho phép ban giám khảo, thầy cô hoặc người dùng thử nghiệm tính năng Geofencing bất kỳ lúc nào mà không bắt buộc phải có mặt trực tiếp tại Đồng Tháp.
            </p>
          </div>
        )}

        {/* GPS Warning if completely unable to get location */}
        {gpsError && !coords && !isDemoMode && (
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 ring-1 ring-amber-200">
            <AlertCircle className="size-4 shrink-0 mt-0.5 text-amber-600" />
            <div className="flex-1">
              <p className="font-semibold">{gpsError}</p>
              <p className="mt-0.5 text-amber-700">
                Bạn có thể bấm <strong>"Bật Demo Dùng Thử"</strong> ở trên để thử nghiệm tính năng ngay lập tức.
              </p>
            </div>
          </div>
        )}

        {/* Clear and friendly guidance when user is outside Dong Thap */}
        {!isDemoMode && coords && data && data.inRangeCount === 0 && nearest && (
          <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-leaf-50/80 p-3.5 text-xs text-leaf-900 ring-1 ring-leaf-200/80">
            <Info className="size-4 shrink-0 mt-0.5 text-leaf-700" />
            <div className="flex-1">
              <p className="font-bold text-leaf-900">
                Bạn chưa ở trong bán kính điểm danh (1.000m) của điểm đến nào tại Đồng Tháp
              </p>
              <p className="mt-0.5 text-leaf-800 leading-relaxed">
                Hệ thống đã nhận diện chính xác vị trí thực tế của bạn ({coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}), cách điểm đến gần nhất là <strong>&ldquo;{nearest.name}&rdquo;</strong> khoảng <strong>{nearest.distanceKm} km</strong>. Khi đến thực địa trong phạm vi 1.000m, nút <strong>Điểm danh GPS</strong> sẽ tự động mở sáng. Nếu đang kiểm thử từ xa, hãy bấm <strong>&ldquo;Bật Demo Dùng Thử&rdquo;</strong> ở trên để trải nghiệm tính năng ngay lập tức!
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Hero: Nearest Destination Spotlight */}
      {nearest && (
        <section className="tp-fade-up mt-6">
          <div className={clsx(
            'relative overflow-hidden rounded-panel border p-5 sm:p-7 transition-all shadow-raised',
            nearest.canCheckIn
              ? 'border-emerald-300 bg-gradient-to-br from-emerald-50/90 via-teal-50/50 to-white shadow-emerald-900/10'
              : 'border-sand-200 bg-gradient-to-br from-white to-sand-50/60',
          )}>
            {/* Ambient halo if ready to check in */}
            {nearest.canCheckIn && (
              <div className="pointer-events-none absolute -right-20 -top-20 size-60 rounded-full bg-emerald-400/20 blur-3xl animate-pulse" />
            )}

            <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={clsx(
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ring-1 uppercase tracking-wider',
                    nearest.canCheckIn
                      ? 'bg-emerald-500 text-white ring-emerald-600 shadow-sm'
                      : 'bg-sand-100 text-river-600 ring-sand-200',
                  )}>
                    <Radio className="size-3.5" />
                    {nearest.canCheckIn ? '🎯 Trong phạm vi điểm danh' : 'Điểm đến gần bạn nhất'}
                  </span>

                  {nearest.isCheckedIn && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-semibold text-teal-800">
                      <CheckCircle2 className="size-3.5 text-teal-600" /> Đã điểm danh
                    </span>
                  )}
                </div>

                <h2 className="text-xl sm:text-2xl font-extrabold text-river-900">
                  {nearest.name}
                </h2>

                <p className="text-sm text-river-600 max-w-2xl leading-relaxed">
                  {nearest.summary || nearest.address}
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-1 text-xs font-semibold">
                  <span className="flex items-center gap-1 text-teal-700">
                    <Navigation className="size-4" />
                    Khoảng cách: <strong>{nearest.distanceMeters < 1000 ? `${nearest.distanceMeters} m` : `${nearest.distanceKm} km`}</strong>
                  </span>
                  <span className="text-river-400">·</span>
                  <span className="text-river-600">Khu vực: {nearest.area}</span>
                  <span className="text-river-400">·</span>
                  <span className="text-river-600">Phạm vi cho phép: ≤ {data?.maxCheckInMeters || 1000} m</span>
                </div>
              </div>

              {/* Action Button */}
              <div className="shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                {nearest.canCheckIn ? (
                  nearest.isCheckedIn ? (
                    <ButtonLink to="/passport" variant="secondary" icon={<CheckCircle2 className="size-4 text-teal-600" />}>
                      Đã ghi vào Hộ chiếu
                    </ButtonLink>
                  ) : (
                    <Button
                      size="lg"
                      variant="primary"
                      onClick={() => handleCheckIn(nearest)}
                      loading={checkingInId === nearest.id}
                      icon={<MapPinCheck className="size-5" />}
                      className="bg-emerald-600 hover:bg-emerald-700 shadow-md ring-emerald-500 font-bold"
                    >
                      Bấm Điểm Danh GPS Ngay (+10 EXP)
                    </Button>
                  )
                ) : (
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${nearest.coordinates.lat},${nearest.coordinates.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-leaf-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-leaf-700"
                  >
                    <ExternalLink className="size-4" />
                    Chỉ đường Google Maps
                  </a>
                )}

                <ButtonLink to={`/destinations/${nearest.slug}`} variant="secondary">
                  Xem chi tiết điểm
                </ButtonLink>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Filter Tabs & Search Bar */}
      <section className="tp-fade-up mt-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-sand-100 p-1 ring-1 ring-sand-200">
            {[
              { id: 'all', label: 'Tất cả' },
              { id: 'inRange', label: `Trong bán kính (${data?.inRangeCount ?? 0})` },
              { id: 'unvisited', label: 'Chưa điểm danh' },
              { id: 'visited', label: `Đã điểm danh (${data?.checkedInCount ?? 0})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={clsx(
                  'rounded-xl px-3 py-1.5 text-xs font-semibold transition-all',
                  activeTab === tab.id
                    ? 'bg-white text-river-900 shadow-sm'
                    : 'text-river-600 hover:text-river-900',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative min-w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-river-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tên hoặc khu vực..."
              className="w-full rounded-xl border border-sand-300 bg-white py-1.5 pl-9 pr-3 text-sm text-river-900 placeholder:text-river-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />
          </div>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="py-12 text-center">
            <PageLoader />
          </div>
        )}

        {/* Empty list */}
        {!loading && filteredItems.length === 0 && (
          <div className="py-12">
            <EmptyState
              title="Không tìm thấy địa điểm phù hợp"
              description="Hãy thử đổi bộ lọc hoặc từ khóa tìm kiếm để khám phá thêm địa điểm khác."
              action={
                <Button size="sm" onClick={() => { setActiveTab('all'); setSearchQuery(''); }}>
                  Xem tất cả địa điểm
                </Button>
              }
            />
          </div>
        )}

        {/* Grid of Destinations with Distance */}
        {!loading && filteredItems.length > 0 && (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredItems.map((item) => (
              <Card
                key={item.id}
                className={clsx(
                  'flex flex-col justify-between overflow-hidden p-4 transition-all duration-200 hover:shadow-md',
                  item.canCheckIn
                    ? 'border-emerald-300 bg-gradient-to-b from-emerald-50/40 to-white'
                    : 'border-sand-200 bg-white',
                )}
              >
                <div>
                  {/* Top info: Area & Distance badge */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-river-500 uppercase tracking-wide">
                      {item.area}
                    </span>

                    <span className={clsx(
                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ring-1',
                      item.canCheckIn
                        ? 'bg-emerald-100 text-emerald-800 ring-emerald-300'
                        : 'bg-sand-100 text-river-600 ring-sand-200',
                    )}>
                      <Navigation className="size-3" />
                      {item.distanceMeters < 1000 ? `${item.distanceMeters} m` : `${item.distanceKm} km`}
                    </span>
                  </div>

                  {/* Destination Title */}
                  <h3 className="mt-2 text-base font-bold text-river-900 leading-snug">
                    <Link to={`/destinations/${item.slug}`} className="hover:text-teal-700 transition">
                      {item.name}
                    </Link>
                  </h3>

                  <p className="mt-1 text-xs text-river-600 line-clamp-2 leading-relaxed">
                    {item.summary || item.address}
                  </p>
                </div>

                {/* Bottom Action Footer */}
                <div className="mt-4 pt-3 border-t border-sand-100 flex items-center justify-between gap-2">
                  <div>
                    {item.isCheckedIn ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700">
                        <CheckCircle2 className="size-3.5 text-teal-600" /> Đã điểm danh
                      </span>
                    ) : item.canCheckIn ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 animate-pulse">
                        <Sparkles className="size-3.5 text-emerald-600" /> Sẵn sàng điểm danh
                      </span>
                    ) : (
                      <span className="text-[11px] text-river-400">
                        Cần &lt; 1.000m
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {item.canCheckIn && !item.isCheckedIn ? (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => handleCheckIn(item)}
                        loading={checkingInId === item.id}
                        className="bg-emerald-600 hover:bg-emerald-700"
                      >
                        Điểm danh
                      </Button>
                    ) : (
                      <ButtonLink to={`/destinations/${item.slug}`} size="sm" variant="ghost">
                        Chi tiết
                      </ButtonLink>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </PageContainer>
  );
}
