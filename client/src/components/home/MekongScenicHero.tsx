import clsx from 'clsx';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Compass,
  Footprints,
  HeartHandshake,
  MapPin,
  MapPinCheck,
  MessageCircleHeart,
  MoonStar,
  Route,
  Sparkles,
  Sun,
  Sunrise,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { triggerMekoAssistant, useUiComfortStore } from '../../stores/uiComfortStore';
import { ButtonLink } from '../ui/Button';
import { CountUp, TiltCard } from '../ui/MotionPrimitives';
import { SearchBar } from '../ui/Navigation';

type ScenicMood = 'morning' | 'sunset' | 'night';

interface StorySlide {
  title: string;
  area: string;
  vibe: string;
  caption: string;
  image: string;
  query: string;
  aiPrompt: string;
}

const STORY_SLIDES: StorySlide[] = [
  {
    title: 'Đồng Sen Tháp Mười',
    area: 'Tháp Mười · Đồng Tháp',
    vibe: '📸 Góc sống ảo 10/10',
    caption: 'Bạt ngàn sen hồng nở rộ giữa đầm nước trong veo, check-in áo bà ba cực nghệ.',
    image: '/images/destinations/thap-muoi/dong-sen-thap-muoi.jpg',
    query: 'Đồng Sen',
    aiPrompt: 'Gợi ý lịch trình đi Đồng Sen Tháp Mười chụp ảnh đẹp và ăn món sen ngon nhất',
  },
  {
    title: 'Vườn Quốc gia Tràm Chim',
    area: 'Tam Nông · Khu Ramsar thế giới',
    vibe: '🦩 Săn hoàng hôn & Sếu đầu đỏ',
    caption: 'Ngồi vỏ lãi lướt qua biển rừng tràm xanh mướt và ngắm chim trời bay rợp bóng chiều.',
    image: '/images/destinations/tam-nong/vuon-quoc-gia-tram-chim.jpg',
    query: 'Tràm Chim',
    aiPrompt: 'Gợi ý trải nghiệm và thời điểm ngắm hoàng hôn đẹp nhất ở Vườn Quốc gia Tràm Chim',
  },
  {
    title: 'Làng hoa Sa Đéc',
    area: 'TP. Sa Đéc · Thủ phủ hoa miền Tây',
    vibe: '🌸 Vibe rực rỡ triệu tim',
    caption: 'Hàng trăm giống hoa kiểng trên giàn nước độc đáo hơn trăm năm tuổi.',
    image: '/images/destinations/sa-dec/lang-hoa-sa-dec.jpg',
    query: 'Làng hoa Sa Đéc',
    aiPrompt: 'Lập lịch trình nửa ngày tham quan Làng hoa Sa Đéc và ăn hủ tiếu ngon gần đó',
  },
  {
    title: 'Khu di tích Xẻo Quýt',
    area: 'Cao Lãnh · Rừng tràm nguyên sinh',
    vibe: '🛶 Chữa lành cực chill',
    caption: 'Chèo xuồng ba lá len lỏi dưới tán rừng tràm cổ thụ mát rượi quanh năm.',
    image: '/images/destinations/cao-lanh/khu-di-tich-xeo-quyt.jpg',
    query: 'Xẻo Quýt',
    aiPrompt: 'Giới thiệu chi tiết khu di tích Xẻo Quýt và gợi ý đi cùng gia đình',
  },
  {
    title: 'Nhà cổ Huỳnh Thủy Lê',
    area: 'TP. Sa Đéc · Di sản 130 năm',
    vibe: '🏛️ Vintage Đông – Tây',
    caption: 'Kiến trúc giao thoa Pháp – Hoa gắn liền với tiểu thuyết lãng mạn "Người Tình".',
    image: '/images/destinations/sa-dec/nha-co-huynh-thuy-le.jpg',
    query: 'Huỳnh Thủy Lê',
    aiPrompt: 'Kể câu chuyện thú vị về Nhà cổ Huỳnh Thủy Lê ở Sa Đéc',
  },
];

const MOOD_META: Record<
  ScenicMood,
  {
    label: string;
    shortLabel: string;
    icon: typeof Sun;
    bgClass: string;
    orbClass: string;
    waterColor: string;
    hillBack: string;
    hillFront: string;
    boatColor: string;
    accentPill: string;
    showFireflies: boolean;
    greeting: string;
  }
> = {
  morning: {
    label: 'Bình minh Sen',
    shortLabel: 'Bình minh',
    icon: Sunrise,
    bgClass: 'from-[#0d3b2e] via-[#176b50] to-[#2f8f66]',
    orbClass: 'from-[#fff6d6] via-[#f9c9d4] to-[#efa4b5]/60',
    waterColor: '#0e4c3a',
    hillBack: '#125440',
    hillFront: '#0a3327',
    boatColor: '#072219',
    accentPill: 'bg-lotus-300/20 text-lotus-100 ring-lotus-200/35',
    showFireflies: false,
    greeting: 'Chào buổi sáng bình yên tại Đất Sen Hồng',
  },
  sunset: {
    label: 'Hoàng hôn Tràm Chim',
    shortLabel: 'Hoàng hôn',
    icon: Sun,
    bgClass: 'from-[#281b2f] via-[#7a374d] to-[#c47a45]',
    orbClass: 'from-[#fff0b8] via-[#ffb56b] to-[#f47a8a]/70',
    waterColor: '#4c2638',
    hillBack: '#3e2030',
    hillFront: '#23131e',
    boatColor: '#160b12',
    accentPill: 'bg-amber-300/20 text-amber-100 ring-amber-200/40',
    showFireflies: true,
    greeting: 'Hoàng hôn nhuộm vàng trên sóng nước Tràm Chim',
  },
  night: {
    label: 'Đêm Phố Cổ',
    shortLabel: 'Đêm',
    icon: MoonStar,
    bgClass: 'from-[#091820] via-[#0f2f25] to-[#16423c]',
    orbClass: 'from-[#fffbe6] via-[#f3e7c9] to-[#8ebf83]/40',
    waterColor: '#081d1b',
    hillBack: '#0d2b24',
    hillFront: '#071814',
    boatColor: '#040e0c',
    accentPill: 'bg-teal-300/20 text-teal-100 ring-teal-200/35',
    showFireflies: true,
    greeting: 'Lung linh ánh đèn hoa đăng miền sông nước về đêm',
  },
};

function defaultMoodByHour(): ScenicMood {
  const h = new Date().getHours();
  if (h >= 15 && h < 19) return 'sunset';
  if (h >= 19 || h < 5) return 'night';
  return 'morning';
}

const FIREFLIES = [
  { left: '12%', top: '28%', delay: '0s', size: 'size-2' },
  { left: '26%', top: '54%', delay: '1.3s', size: 'size-1.5' },
  { left: '44%', top: '22%', delay: '2.1s', size: 'size-2' },
  { left: '58%', top: '62%', delay: '0.7s', size: 'size-1.5' },
  { left: '74%', top: '34%', delay: '1.9s', size: 'size-2' },
  { left: '88%', top: '52%', delay: '2.8s', size: 'size-1.5' },
];

export function MekongScenicHero() {
  const navigate = useNavigate();
  const { seniorMode, calmMotion, setSeniorMode } = useUiComfortStore();
  const [mood, setMood] = useState<ScenicMood>(defaultMoodByHour);
  const [slideIdx, setSlideIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  const m = MOOD_META[mood];
  const slide = STORY_SLIDES[slideIdx] ?? STORY_SLIDES[0]!;

  useEffect(() => {
    if (seniorMode || calmMotion || paused) return;
    const t = window.setInterval(() => {
      setSlideIdx((i) => (i + 1) % STORY_SLIDES.length);
    }, 6200);
    return () => window.clearInterval(t);
  }, [seniorMode, calmMotion, paused]);

  /* ── SENIOR MODE: Ultra-Clear, High-Contrast 4-Action Launchpad ── */
  if (seniorMode) {
    return (
      <section className="mx-auto max-w-6xl px-3.5 pt-4 sm:px-6 sm:pt-6">
        <div className="rounded-panel border-2 border-leaf-700 bg-white p-5 shadow-raised sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-sand-200 pb-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-leaf-700 px-3.5 py-1.5 text-sm font-extrabold text-white">
              <HeartHandshake className="size-5 shrink-0" aria-hidden />
              <span>Chế độ Dễ Đọc · Thân thiện Người Lớn Tuổi</span>
            </div>
            <button
              type="button"
              onClick={() => setSeniorMode(false)}
              className="inline-flex items-center gap-1.5 rounded-full border-2 border-sand-300 bg-sand-50 px-3.5 py-2 text-sm font-bold text-river-900 hover:border-leaf-600"
            >
              <Sparkles className="size-4 text-leaf-700" />
              Giao diện Sống động
            </button>
          </div>

          <div className="mt-5">
            <h1 className="text-2xl font-extrabold text-river-950 sm:text-4xl">
              Chào mừng đến với Du lịch Đồng Tháp!
            </h1>
            <p className="mt-2 text-base font-medium leading-relaxed text-river-800 sm:text-lg">
              Cô chú và anh chị muốn làm gì hôm nay? Chỉ cần chạm vào <strong>1 trong 4 ô lớn</strong> bên dưới:
            </p>
          </div>

          {/* 4 Giant, Unmistakable Tap Cards */}
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Link
              to="/destinations"
              className="group flex min-w-0 items-center gap-4 rounded-2xl border-2 border-leaf-700 bg-leaf-50 p-5 text-left transition hover:bg-leaf-100"
            >
              <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-leaf-700 text-white shadow">
                <Compass className="size-8" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-extrabold text-river-950">
                  1. Xem điểm tham quan đẹp
                </span>
                <span className="mt-1 block text-sm font-medium text-river-800">
                  Ảnh to rõ ràng, địa chỉ đầy đủ, bấm 1 chạm để xem chỉ đường.
                </span>
              </span>
              <ArrowRight className="size-6 shrink-0 text-leaf-800" aria-hidden />
            </Link>

            <Link
              to="/itinerary/create"
              className="group flex min-w-0 items-center gap-4 rounded-2xl border-2 border-teal-700 bg-teal-50 p-5 text-left transition hover:bg-teal-100"
            >
              <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-teal-700 text-white shadow">
                <Route className="size-8" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-extrabold text-river-950">
                  2. Nhờ AI xếp lịch đi chơi
                </span>
                <span className="mt-1 block text-sm font-medium text-river-800">
                  Tự chọn chỗ nghỉ mát, đường dễ đi và quán ăn ngon cho gia đình.
                </span>
              </span>
              <ArrowRight className="size-6 shrink-0 text-teal-900" aria-hidden />
            </Link>

            <Link
              to="/check-in"
              className="group flex min-w-0 items-center gap-4 rounded-2xl border-2 border-emerald-700 bg-emerald-50 p-5 text-left transition hover:bg-emerald-100"
            >
              <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-emerald-700 text-white shadow">
                <MapPinCheck className="size-8" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-extrabold text-river-950">
                  3. Điểm danh khi đến nơi
                </span>
                <span className="mt-1 block text-sm font-medium text-river-800">
                  Tự động nhận biết vị trí GPS để lưu kỷ niệm vào Hộ chiếu số.
                </span>
              </span>
              <ArrowRight className="size-6 shrink-0 text-emerald-800" aria-hidden />
            </Link>

            <button
              type="button"
              onClick={() => triggerMekoAssistant()}
              className="group flex min-w-0 items-center gap-4 rounded-2xl border-2 border-lotus-700 bg-lotus-50 p-5 text-left transition hover:bg-lotus-100"
            >
              <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-lotus-700 text-white shadow">
                <MessageCircleHeart className="size-8" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-extrabold text-river-950">
                  4. Hỏi Trợ lý AI Pé Meko
                </span>
                <span className="mt-1 block text-sm font-medium text-river-800">
                  Cần tìm đường, quán ăn ngon hay lịch đi chơi nhẹ nhàng — cứ nhắn cho Pé Meko!
                </span>
              </span>
              <ArrowRight className="size-6 shrink-0 text-lotus-800" aria-hidden />
            </button>
          </div>

          <div className="mt-5">
            <SearchBar
              value=""
              size="lg"
              debounceMs={0}
              placeholder="Hoặc gõ tên nơi muốn đến (vd: Đồng Sen, Sa Đéc, Xẻo Quýt)..."
              onSearch={(q) => navigate(q ? `/destinations?q=${encodeURIComponent(q)}` : '/destinations')}
            />
          </div>
        </div>
      </section>
    );
  }

  /* ── STANDARD / GEN Z MODE: Living Animated Mekong Scenic Stage ── */
  return (
    <section className="mx-auto max-w-6xl px-3.5 pt-4 sm:px-6 sm:pt-6">
      <div
        className={clsx(
          'relative isolate overflow-hidden rounded-[2rem] bg-gradient-to-br text-white shadow-raised ring-1 ring-white/15 transition-colors duration-1000',
          m.bgClass,
        )}
      >
        {/* ── LAYER 1: Living Animated Mekong Sky, Sun/Moon, Clouds, Cranes & Sampan Boat ── */}
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
          {/* Glowing Sun / Moon Orb */}
          <div
            className={clsx(
              'absolute right-[8%] top-[8%] size-36 rounded-full bg-gradient-to-br opacity-85 blur-[2px] transition-all duration-1000 sm:size-52',
              m.orbClass,
            )}
          />
          <div
            className={clsx(
              'absolute right-[4%] top-[3%] size-60 rounded-full bg-gradient-to-br opacity-30 blur-3xl transition-all duration-1000 sm:size-80',
              m.orbClass,
            )}
          />

          {/* Drifting Clouds */}
          <svg
            viewBox="0 0 1200 420"
            preserveAspectRatio="xMidYMax slice"
            className="absolute inset-0 size-full"
          >
            {/* Cloud layer 1 */}
            <g className="dtst-cloud-glide opacity-20" fill="#ffffff">
              <ellipse cx="180" cy="86" rx="110" ry="22" />
              <ellipse cx="235" cy="74" rx="68" ry="20" />
              <ellipse cx="640" cy="64" rx="135" ry="20" />
              <ellipse cx="705" cy="54" rx="74" ry="18" />
            </g>
            {/* Cloud layer 2 */}
            <g className="dtst-cloud-glide-slow opacity-15" fill="#ffffff">
              <ellipse cx="420" cy="128" rx="95" ry="16" />
              <ellipse cx="960" cy="112" rx="120" ry="19" />
            </g>

            {/* Silhouetted Red-Crowned Cranes (Sếu đầu đỏ) gliding smoothly */}
            <g className="dtst-crane-fly" fill="none" stroke="rgba(255,255,255,0.68)" strokeWidth="2.2" strokeLinecap="round">
              <path d="M120 112 Q128 103 137 110 Q145 103 153 111" />
              <path d="M158 96 Q165 89 172 95 Q179 89 186 96" strokeWidth="1.8" />
              <path d="M192 118 Q198 112 204 117 Q210 112 216 118" strokeWidth="1.5" />
            </g>

            {/* Distant cajuput forest (Rừng tràm Tràm Chim) */}
            <path
              d="M0 328 Q120 296 240 314 T490 306 T760 318 T1020 300 T1200 316 L1200 420 L0 420 Z"
              fill={m.hillBack}
              opacity="0.58"
            />
            {/* Foreground riverbanks & lotus silhouettes */}
            <path
              d="M0 356 Q170 330 350 348 T720 342 T1060 350 L1200 344 L1200 420 L0 420 Z"
              fill={m.hillFront}
              opacity="0.72"
            />

            {/* Shimmering Mekong Water Surface */}
            <rect x="0" y="356" width="1200" height="64" fill={m.waterColor} opacity="0.78" />
            <g className="dtst-water-shimmer" stroke="rgba(255,255,255,0.28)" strokeWidth="2" strokeLinecap="round">
              <line x1="90" y1="374" x2="210" y2="374" />
              <line x1="340" y1="388" x2="490" y2="388" />
              <line x1="620" y1="376" x2="770" y2="376" />
              <line x1="860" y1="392" x2="1050" y2="392" />
              <line x1="220" y1="404" x2="360" y2="404" opacity="0.6" />
            </g>

            {/* Gently gliding wooden sampan boat (Xuồng ba lá & Nón lá) */}
            <g className="dtst-boat-glide" transform="translate(365, 344)">
              {/* Boat hull */}
              <path d="M0 16 Q38 25 84 14 L74 22 Q38 30 10 22 Z" fill={m.boatColor} />
              {/* Traveler with conical hat (Nón lá) */}
              <path d="M44 15 L49 6 L54 15 Z" fill={m.boatColor} />
              <path d="M40 7 L49 1 L58 7 Z" fill="#f3e7c9" opacity="0.92" />
              {/* Oar */}
              <line x1="51" y1="11" x2="66" y2="25" stroke="#f3e7c9" strokeWidth="1.5" opacity="0.7" />
            </g>
          </svg>

          {/* Warm floating fireflies / lanterns in Sunset & Night moods */}
          {m.showFireflies &&
            !calmMotion &&
            FIREFLIES.map((f, idx) => (
              <span
                key={idx}
                style={{ left: f.left, top: f.top, animationDelay: f.delay }}
                className={clsx(
                  'dtst-firefly absolute rounded-full bg-amber-200 shadow-[0_0_12px_4px_rgba(253,230,138,0.65)]',
                  f.size,
                )}
              />
            ))}

          {/* Subtle glass vignette for ultra-crisp text legibility */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/38 via-black/15 to-black/25" />
        </div>

        {/* ── LAYER 2: Interactive Foreground Content ── */}
        <div className="relative z-10 px-4 py-6 sm:px-8 sm:py-9 lg:px-10 lg:py-11">
          {/* Top Scenic Mood Switcher + Senior 1-Click Hint */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="inline-flex max-w-full flex-nowrap items-center gap-1 rounded-full bg-black/25 p-1 ring-1 ring-white/15 backdrop-blur-md">
              {(Object.keys(MOOD_META) as ScenicMood[]).map((key) => {
                const item = MOOD_META[key];
                const Icon = item.icon;
                const active = mood === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setMood(key)}
                    className={clsx(
                      'inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-bold transition-all sm:gap-1.5 sm:px-3 sm:text-xs',
                      active
                        ? 'bg-white text-river-950 shadow-sm'
                        : 'text-white/85 hover:bg-white/10 hover:text-white',
                    )}
                  >
                    <Icon className="size-3.5 shrink-0" aria-hidden />
                    <span className="hidden sm:inline">{item.label}</span>
                    <span className="sm:hidden">{item.shortLabel}</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setSeniorMode(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-amber-300/20 px-3 py-1.5 text-xs font-bold text-amber-100 ring-1 ring-amber-200/40 backdrop-blur-md transition hover:bg-amber-300/30"
              title="Bật giao diện chữ to, nút lớn dễ dùng cho ông bà, cha mẹ"
            >
              <HeartHandshake className="size-3.5 shrink-0" aria-hidden />
              <span>Chế độ Lớn tuổi</span>
            </button>
          </div>

          {/* Main 2-Column Stage: Headline & Controls (Left) + Gen Z Live Story Deck (Right) */}
          <div className="mt-6 grid items-center gap-7 lg:grid-cols-[1.18fr_0.82fr] lg:gap-10">
            <div className="min-w-0">
              <span
                className={clsx(
                  'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ring-1 backdrop-blur-sm',
                  m.accentPill,
                )}
              >
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-300 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
                </span>
                {m.greeting}
              </span>

              <h1 className="mt-4 text-balance text-[1.95rem] font-extrabold leading-[1.12] tracking-tight text-white sm:text-[2.85rem] lg:text-[3.2rem]">
                Khám phá Đồng Tháp{' '}
                <span className="relative inline-block bg-gradient-to-r from-[#fff4cc] via-[#f7cbd5] to-[#a7f3d0] bg-clip-text text-transparent">
                  sống động từng khoảnh khắc
                </span>
              </h1>

              <p className="mt-3.5 max-w-xl text-pretty text-sm leading-relaxed text-white/90 sm:text-base">
                Bản đồ 3D bay lượn, trợ lý AI <strong>Pé Meko</strong> thông minh, điểm danh GPS tự động và Hộ chiếu trải nghiệm số — đẹp chuẩn gu Gen Z, dễ chạm cho cả gia đình.
              </p>

              {/* SearchBar */}
              <div className="mt-5 max-w-xl">
                <SearchBar
                  value=""
                  size="lg"
                  debounceMs={0}
                  placeholder="Tìm Đồng Sen, Sa Đéc, hủ tiếu, điểm sống ảo..."
                  onSearch={(q) => navigate(q ? `/destinations?q=${encodeURIComponent(q)}` : '/destinations')}
                />
              </div>

              {/* Primary Action CTAs */}
              <div className="mt-5 flex flex-wrap items-center gap-2.5 sm:gap-3">
                <ButtonLink
                  to="/itinerary/create"
                  size="lg"
                  className="dtst-aurora-btn relative overflow-hidden bg-gradient-to-r from-emerald-500 via-leaf-600 to-teal-600 text-white shadow-[0_12px_28px_-10px_rgba(16,185,129,0.75)] ring-1 ring-white/30 hover:brightness-110"
                  icon={<Sparkles className="size-5" aria-hidden />}
                >
                  <span className="tp-shimmer pointer-events-none absolute inset-0" aria-hidden />
                  AI Lập lịch trình 3D
                </ButtonLink>
                <ButtonLink
                  to="/check-in"
                  variant="inverted"
                  size="lg"
                  icon={<MapPinCheck className="size-5 text-leaf-700" aria-hidden />}
                >
                  Điểm danh GPS
                </ButtonLink>
                <ButtonLink
                  to="/footprints"
                  variant="outlineInverted"
                  size="lg"
                  icon={<Footprints className="size-5" aria-hidden />}
                >
                  Bản đồ Dấu chân
                </ButtonLink>
              </div>

              {/* Compact Animated Platform Metrics */}
              <dl className="mt-6 grid grid-cols-3 gap-2.5 border-t border-white/15 pt-5 sm:max-w-lg sm:gap-4">
                <div className="min-w-0 rounded-2xl bg-white/8 px-3 py-2.5 ring-1 ring-white/12 backdrop-blur-xs">
                  <dt className="truncate text-[11px] font-medium text-white/75">Điểm số hóa</dt>
                  <dd className="mt-0.5 text-lg font-extrabold text-white sm:text-xl">
                    <CountUp end={56} suffix="+" />
                  </dd>
                </div>
                <div className="min-w-0 rounded-2xl bg-white/8 px-3 py-2.5 ring-1 ring-white/12 backdrop-blur-xs">
                  <dt className="truncate text-[11px] font-medium text-white/75">Lộ trình 3D</dt>
                  <dd className="mt-0.5 text-lg font-extrabold text-emerald-200 sm:text-xl">
                    WebGL
                  </dd>
                </div>
                <div className="min-w-0 rounded-2xl bg-white/8 px-3 py-2.5 ring-1 ring-white/12 backdrop-blur-xs">
                  <dt className="truncate text-[11px] font-medium text-white/75">Trợ lý Pé Meko</dt>
                  <dd className="mt-0.5 text-lg font-extrabold text-lotus-200 sm:text-xl">
                    24/7 AI
                  </dd>
                </div>
              </dl>
            </div>

            {/* Right Column: Gen Z Live Photo Story Deck */}
            <div
              className="min-w-0"
              onMouseEnter={() => setPaused(true)}
              onMouseLeave={() => setPaused(false)}
            >
              <TiltCard
                maxTiltDeg={5}
                glowColor="rgba(239, 164, 181, 0.25)"
                className="overflow-hidden rounded-[1.75rem] border border-white/25 bg-black/30 shadow-2xl backdrop-blur-md"
              >
                {/* Story Progress Bars */}
                <div className="absolute inset-x-3 top-3 z-20 flex gap-1.5">
                  {STORY_SLIDES.map((s, idx) => (
                    <button
                      key={s.title}
                      type="button"
                      aria-label={`Xem cảnh ${idx + 1}: ${s.title}`}
                      onClick={() => setSlideIdx(idx)}
                      className="h-1 flex-1 overflow-hidden rounded-full bg-white/30"
                    >
                      <span
                        key={`${idx}-${slideIdx}`}
                        className={clsx(
                          'block h-full rounded-full bg-white',
                          idx < slideIdx && 'w-full',
                          idx === slideIdx && (!paused && !calmMotion ? 'dtst-story-bar w-full' : 'w-full'),
                          idx > slideIdx && 'w-0',
                        )}
                      />
                    </button>
                  ))}
                </div>

                {/* Cinematic Photo Viewport */}
                <div className="relative aspect-[4/3] w-full overflow-hidden sm:aspect-[4/4.3]">
                  <img
                    key={slide.image}
                    src={slide.image}
                    alt={slide.title}
                    className="dtst-ken-burns size-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/20" />

                  {/* Floating Vibe Chip */}
                  <div className="absolute left-3.5 top-7 z-10 inline-flex items-center gap-1.5 rounded-full bg-black/45 px-3 py-1 text-xs font-extrabold text-white ring-1 ring-white/25 backdrop-blur-md">
                    <span>{slide.vibe}</span>
                  </div>

                  {/* Story Prev / Next Arrows */}
                  <div className="absolute right-3 top-7 z-10 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSlideIdx((i) => (i - 1 + STORY_SLIDES.length) % STORY_SLIDES.length)}
                      aria-label="Cảnh trước"
                      className="grid size-8 place-items-center rounded-full bg-black/40 text-white ring-1 ring-white/25 backdrop-blur-md transition hover:bg-white hover:text-river-950"
                    >
                      <ChevronLeft className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSlideIdx((i) => (i + 1) % STORY_SLIDES.length)}
                      aria-label="Cảnh tiếp theo"
                      className="grid size-8 place-items-center rounded-full bg-black/40 text-white ring-1 ring-white/25 backdrop-blur-md transition hover:bg-white hover:text-river-950"
                    >
                      <ChevronRight className="size-4" />
                    </button>
                  </div>

                  {/* Bottom Editorial Story Info & Instant AI Action */}
                  <div className="absolute inset-x-0 bottom-0 z-10 p-4 sm:p-5">
                    <p className="flex items-center gap-1 text-xs font-semibold text-emerald-200">
                      <MapPin className="size-3.5 shrink-0" aria-hidden />
                      <span className="truncate">{slide.area}</span>
                    </p>
                    <h2 className="mt-1 text-xl font-extrabold text-white sm:text-2xl">
                      {slide.title}
                    </h2>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-white/85 sm:text-sm">
                      {slide.caption}
                    </p>
                    <div className="mt-3.5 flex flex-wrap items-center gap-2">
                      <Link
                        to={`/destinations?q=${encodeURIComponent(slide.query)}`}
                        className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-extrabold text-river-950 transition hover:bg-leaf-50"
                      >
                        Khám phá ngay
                        <ArrowRight className="size-3.5" aria-hidden />
                      </Link>
                      <button
                        type="button"
                        onClick={() => triggerMekoAssistant({ prompt: slide.aiPrompt })}
                        className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1.5 text-xs font-bold text-white ring-1 ring-white/30 backdrop-blur-md transition hover:bg-white/25"
                      >
                        <Sparkles className="size-3.5 text-lotus-200" aria-hidden />
                        Hỏi Pé Meko
                      </button>
                    </div>
                  </div>
                </div>
              </TiltCard>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
