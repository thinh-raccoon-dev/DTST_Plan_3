import clsx from 'clsx';
import {
  ArrowRight,
  Camera,
  Clock,
  HeartHandshake,
  Sparkles,
  Trees,
  UtensilsCrossed,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { triggerMekoAssistant, useUiComfortStore } from '../../stores/uiComfortStore';
import { Reveal, TiltCard } from '../ui/MotionPrimitives';

type VibeKey = 'genz' | 'family_senior' | 'foodtour' | 'healing';

interface VibeSpot {
  name: string;
  tag: string;
  duration: string;
  reason: string;
  image: string;
  query: string;
}

interface VibeConfig {
  key: VibeKey;
  label: string;
  shortLabel: string;
  subtitle: string;
  icon: typeof Camera;
  accent: string;
  badgeClass: string;
  aiSummary: string;
  aiPrompt: string;
  spots: VibeSpot[];
}

const VIBE_CONFIGS: VibeConfig[] = [
  {
    key: 'genz',
    label: 'Gen Z Sống Ảo',
    shortLabel: 'Sống ảo',
    subtitle: 'Aesthetic Sen Hồng · Triệu tim',
    icon: Camera,
    accent: 'from-lotus-600 to-rose-500',
    badgeClass: 'bg-lotus-50 text-lotus-700 ring-lotus-200',
    aiSummary:
      'Pé Meko chọn khung giờ ánh sáng vàng (07:30–10:00 và 15:30–17:30) tại Làng hoa, Đồng Sen và Nhà cổ để ảnh lên màu phim cực nghệ không bị gắt nắng.',
    aiPrompt:
      'Lập lịch trình 1 ngày chụp ảnh sống ảo phong cách Gen Z ở Đồng Tháp (Đồng Sen, Làng hoa Sa Đéc, Nhà cổ Huỳnh Thủy Lê) kèm giờ ánh sáng đẹp nhất',
    spots: [
      {
        name: 'Đồng Sen Tháp Mười',
        tag: '📸 Áo bà ba & đầm sen',
        duration: '~2 giờ',
        reason: 'Sáng sớm hoa nở rực rỡ, có cầu gỗ xuyên đầm sen chụp toàn cảnh cực đẹp.',
        image: '/images/destinations/thap-muoi/dong-sen-thap-muoi.jpg',
        query: 'Đồng Sen',
      },
      {
        name: 'Làng hoa Sa Đéc',
        tag: '🌸 Giàn hoa trăm tuổi',
        duration: '~1.5 giờ',
        reason: 'Hàng ngàn sắc hoa rực rỡ trên mặt nước, góc nào giơ máy lên cũng ra ảnh tạp chí.',
        image: '/images/destinations/sa-dec/lang-hoa-sa-dec.jpg',
        query: 'Làng hoa Sa Đéc',
      },
      {
        name: 'Nhà cổ Huỳnh Thủy Lê',
        tag: '🏛️ Vintage Đông – Tây',
        duration: '~1 giờ',
        reason: 'Gạch bông Pháp cổ & ánh sáng qua cửa chớp gỗ mang vibe điện ảnh hoài cổ.',
        image: '/images/destinations/sa-dec/nha-co-huynh-thuy-le.jpg',
        query: 'Huỳnh Thủy Lê',
      },
    ],
  },
  {
    key: 'family_senior',
    label: 'Gia Đình & Ông Bà',
    shortLabel: 'Ông bà',
    subtitle: 'Nhẹ nhàng · Bóng mát · Ít đi bộ',
    icon: HeartHandshake,
    accent: 'from-leaf-700 to-emerald-600',
    badgeClass: 'bg-leaf-50 text-leaf-800 ring-leaf-200',
    aiSummary:
      'Lộ trình ưu tiên đường bằng phẳng, nhiều cây xanh bóng mát, có thuyền chở êm ái thay vì đi bộ xa và dừng chân nghỉ trưa tại quán đặc sản món mềm, thanh đạm.',
    aiPrompt:
      'Lập lịch trình 1 ngày đi Đồng Tháp cùng gia đình có người lớn tuổi, ưu tiên đi lại nhẹ nhàng, nhiều bóng mát, ít đi bộ và quán ăn mềm dễ tiêu',
    spots: [
      {
        name: 'Chùa Lá Sen (Phước Kiển Tự)',
        tag: '🪷 Thanh tịnh & kỳ thú',
        duration: '~1 giờ',
        reason: 'Sân chùa bằng phẳng, râm mát, chiêm ngưỡng lá sen khổng lồ đường kính hơn 1,5m.',
        image: '/images/destinations/sa-dec/chua-la-sen-phuoc-kien.jpg',
        query: 'Chùa Lá Sen',
      },
      {
        name: 'Khu di tích Nguyễn Sinh Sắc',
        tag: '🌳 Công viên xanh mát',
        duration: '~1.5 giờ',
        reason: 'Không gian trang nghiêm, nhiều ghế đá dưới tán cây cổ thụ và ao sen yên bình.',
        image: '/images/destinations/cao-lanh/khu-di-tich-nguyen-sinh-sac.jpg',
        query: 'Nguyễn Sinh Sắc',
      },
      {
        name: 'Khu di tích Xẻo Quýt',
        tag: '🛶 Ngồi xuồng xuyên rừng',
        duration: '~2 giờ',
        reason: 'Không cần đi bộ nhiều — chỉ việc ngồi xuồng ba lá mát rượi nghe cô lái đò kể chuyện.',
        image: '/images/destinations/cao-lanh/khu-di-tich-xeo-quyt.jpg',
        query: 'Xẻo Quýt',
      },
    ],
  },
  {
    key: 'foodtour',
    label: 'Food Tour Miền Tây',
    shortLabel: 'Ẩm thực',
    subtitle: 'Đặc sản chính gốc · Ngon bá cháy',
    icon: UtensilsCrossed,
    accent: 'from-teal-600 to-amber-600',
    badgeClass: 'bg-teal-50 text-teal-800 ring-teal-200',
    aiSummary:
      'Combo 3 bữa chuẩn vị địa phương: sáng hủ tiếu Sa Đéc sợi mềm ngọt nước, trưa cá lóc nướng trui cuốn lá sen non, chiều ghé Lai Vung mua nem chua làm quà.',
    aiPrompt:
      'Gợi ý Food Tour 1 ngày ăn sập đặc sản Đồng Tháp (Hủ tiếu Sa Đéc, Cá lóc nướng trui lá sen, Bánh xèo, Nem Lai Vung) kèm chi phí dự kiến',
    spots: [
      {
        name: 'Hủ Tiếu Sa Đéc Bà Sẫm',
        tag: '🍜 Bữa sáng quốc dân',
        duration: '~45 phút',
        reason: 'Sợi hủ tiếu bột gạo Sa Đéc trứ danh, nước lèo xương hầm trong veo đậm vị miền Tây.',
        image: '/images/destinations/sa-dec/hu-tieu-sa-dec-ba-sam.jpg',
        query: 'Hủ Tiếu',
      },
      {
        name: 'Cá Lóc Nướng Trui Lá Sen',
        tag: '🐟 Đặc sản trứ danh',
        duration: '~1.5 giờ',
        reason: 'Cá lóc đồng nướng rơm thơm lừng, cuốn lá sen non và chấm mắm me chua ngọt.',
        image: '/images/destinations/cao-lanh/ca-loc-nuong-trui-la-sen-cao-lanh.jpg',
        query: 'Cá lóc nướng',
      },
      {
        name: 'Làng nghề Nem Lai Vung',
        tag: '🎁 Quà ngon mang về',
        duration: '~1 giờ',
        reason: 'Xem quy trình gói nem truyền thống và thưởng thức nem chua giòn sần sật chuẩn vị.',
        image: '/images/destinations/lai-vung/lang-nghe-nem-lai-vung.jpg',
        query: 'Nem Lai Vung',
      },
    ],
  },
  {
    key: 'healing',
    label: 'Chữa Lành Sông Nước',
    shortLabel: 'Chữa lành',
    subtitle: 'Tràm Chim · Gáo Giồng · Chill hết nấc',
    icon: Trees,
    accent: 'from-emerald-700 to-cyan-700',
    badgeClass: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    aiSummary:
      'Tạm rời phố thị ồn ào để nghe tiếng chim trời, gió thổi qua rừng tràm xanh mướt và đón khoảnh khắc hoàng hôn đỏ rực trên vùng đất ngập nước Ramsar.',
    aiPrompt:
      'Lập lịch trình 2 ngày chữa lành gần gũi thiên nhiên tại Vườn Quốc gia Tràm Chim và Khu sinh thái Gáo Giồng',
    spots: [
      {
        name: 'Vườn Quốc gia Tràm Chim',
        tag: '🦩 Khu Ramsar thế giới',
        duration: '~3 giờ',
        reason: 'Ngồi tắc ráng lướt giữa đồng cỏ năng, đón hàng ngàn cánh chim bay về tổ lúc hoàng hôn.',
        image: '/images/destinations/tam-nong/vuon-quoc-gia-tram-chim.jpg',
        query: 'Tràm Chim',
      },
      {
        name: 'Khu du lịch sinh thái Gáo Giồng',
        tag: '🌿 Rừng tràm & sân chim',
        duration: '~2.5 giờ',
        reason: 'Lên đài quan sát ngắm toàn cảnh biển rừng xanh bát ngát và ăn cơm gói lá sen.',
        image: '/images/destinations/cao-lanh/khu-du-lich-sinh-thai-gao-giong.jpg',
        query: 'Gáo Giồng',
      },
      {
        name: 'KDL Sinh thái Mỹ Phước Thành',
        tag: '🌾 Cánh đồng lúa & đầm sen',
        duration: '~2 giờ',
        reason: 'Chòi lá lộng gió giữa đồng lúa – đầm sen yên ả, lý tưởng để "sạc pin" cuối tuần.',
        image: '/images/destinations/sa-dec/khu-du-lich-sinh-thai-my-phuoc-thanh.jpg',
        query: 'Mỹ Phước Thành',
      },
    ],
  },
];

const MARQUEE_TAGS = [
  { label: '🪷 Đồng Sen Tháp Mười', query: 'Đồng Sen' },
  { label: '🦩 Sếu Đầu Đỏ Tràm Chim', query: 'Tràm Chim' },
  { label: '🌸 Làng Hoa Sa Đéc', query: 'Làng hoa Sa Đéc' },
  { label: '🍜 Hủ Tiếu Sa Đéc', query: 'Hủ Tiếu' },
  { label: '🐟 Cá Lóc Nướng Lá Sen', query: 'Cá lóc' },
  { label: '🛶 Rừng Tràm Xẻo Quýt', query: 'Xẻo Quýt' },
  { label: '🏛️ Nhà Cổ Huỳnh Thủy Lê', query: 'Huỳnh Thủy Lê' },
  { label: '🍊 Quýt Hồng Lai Vung', query: 'Quýt Hồng' },
  { label: '🌿 Chùa Lá Sen Khổng Lồ', query: 'Chùa Lá Sen' },
];

export function AiVibeShowcase() {
  const { seniorMode, calmMotion } = useUiComfortStore();
  const [activeKey, setActiveKey] = useState<VibeKey>(seniorMode ? 'family_senior' : 'genz');
  const active = VIBE_CONFIGS.find((v) => v.key === activeKey) ?? VIBE_CONFIGS[0]!;

  return (
    <div className="mt-6 sm:mt-8">
      {/* Kinetic Marquee Discovery Ribbon (hidden in calmMotion/seniorMode for visual calm) */}
      {!seniorMode && !calmMotion && (
        <div
          aria-label="Điểm nổi bật Đồng Tháp"
          className="relative mx-auto max-w-6xl overflow-hidden py-2 [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]"
        >
          <div className="dtst-marquee-track flex items-center gap-2.5">
            {[...MARQUEE_TAGS, ...MARQUEE_TAGS].map((tag, i) => (
              <Link
                key={`${tag.label}-${i}`}
                to={`/destinations?q=${encodeURIComponent(tag.query)}`}
                className="inline-flex shrink-0 items-center rounded-full border border-sand-200 bg-white/90 px-4 py-1.5 text-xs font-bold text-river-800 shadow-2xs transition hover:-translate-y-0.5 hover:border-leaf-400 hover:bg-leaf-50 hover:text-leaf-800"
              >
                {tag.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Interactive AI Vibe Concierge Section */}
      <Reveal className="mx-auto mt-6 max-w-6xl px-3.5 sm:px-6">
        <section className="overflow-hidden rounded-panel border border-sand-200 bg-white/95 p-4 shadow-raised backdrop-blur-sm sm:p-7">
          <div className="min-w-0">
            <p className="eyebrow">AI Cá nhân hóa theo gu · Pé Meko Concierge</p>
            <h2 className="mt-2 text-2xl font-extrabold text-river-900 sm:text-[1.85rem]">
              Bạn đi cùng ai? AI chọn điểm chuẩn gu ngay!
            </h2>
            <p className="mt-1.5 text-sm text-river-600 sm:text-base">
              Chạm 1 phong cách bên dưới — Pé Meko tự lọc địa điểm hợp nhất cho giới trẻ thích ảnh đẹp lẫn cô chú lớn tuổi thích nhẹ nhàng.
            </p>
          </div>

          {/* 4 Persona Selector Pills */}
          <div
            role="tablist"
            aria-label="Chọn phong cách du lịch"
            className="mt-5 grid grid-cols-2 gap-2.5 lg:grid-cols-4"
          >
            {VIBE_CONFIGS.map((vibe) => {
              const Icon = vibe.icon;
              const isSelected = vibe.key === active.key;
              return (
                <button
                  key={vibe.key}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setActiveKey(vibe.key)}
                  className={clsx(
                    'group flex min-w-0 items-center gap-2.5 rounded-2xl border-2 p-3 text-left transition-all duration-200 sm:p-3.5',
                    isSelected
                      ? `border-transparent bg-gradient-to-br ${vibe.accent} text-white shadow-raised`
                      : 'border-sand-200 bg-sand-50/70 text-river-800 hover:-translate-y-0.5 hover:border-leaf-300 hover:bg-white',
                  )}
                >
                  <span
                    className={clsx(
                      'grid size-9 shrink-0 place-items-center rounded-xl transition-transform group-hover:scale-105 sm:size-10',
                      isSelected ? 'bg-white/20 text-white' : 'bg-white text-leaf-700 shadow-2xs',
                    )}
                  >
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-extrabold sm:text-sm">
                      {vibe.label}
                    </span>
                    <span
                      className={clsx(
                        'block truncate text-[11px]',
                        isSelected ? 'text-white/85' : 'text-river-500',
                      )}
                    >
                      {vibe.subtitle}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* AI Reasoning Callout + 1-Click Auto-Plan */}
          <div className="mt-4 flex flex-col justify-between gap-3 rounded-2xl border border-leaf-200/80 bg-gradient-to-r from-leaf-50 via-white to-sand-50 p-3.5 sm:flex-row sm:items-center sm:p-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-leaf-700 text-lg text-white shadow-sm">
                🦊
              </span>
              <div className="min-w-0">
                <p className="text-xs font-extrabold uppercase tracking-wider text-leaf-800">
                  Mẹo thông minh từ Pé Meko AI
                </p>
                <p className="mt-0.5 text-sm leading-relaxed text-river-800">{active.aiSummary}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => triggerMekoAssistant({ prompt: active.aiPrompt })}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-leaf-700 px-4 py-2.5 text-xs font-extrabold text-white shadow-cta transition hover:-translate-y-0.5 hover:bg-leaf-800 sm:text-sm"
            >
              <Sparkles className="size-4 text-teal-200" aria-hidden />
              Nhờ AI lập lịch gu này
            </button>
          </div>

          {/* 3 Curated Real-Photo Preview Cards */}
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {active.spots.map((spot) => (
              <TiltCard key={`${active.key}-${spot.name}`} maxTiltDeg={4} className="h-full">
                <Link
                  to={`/destinations?q=${encodeURIComponent(spot.query)}`}
                  className="group flex h-full flex-col overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-card transition-all duration-300 hover:border-leaf-300 hover:shadow-raised"
                >
                  <div className="relative aspect-[16/10] overflow-hidden bg-sand-100">
                    <img
                      src={spot.image}
                      alt={spot.name}
                      loading="lazy"
                      className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
                    <span className="absolute left-2.5 top-2.5 rounded-full bg-white/92 px-2.5 py-0.5 text-[11px] font-extrabold text-river-900 shadow-sm backdrop-blur-sm">
                      {spot.tag}
                    </span>
                    <span className="absolute bottom-2 right-2.5 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-bold text-white backdrop-blur-xs">
                      <Clock className="size-3" aria-hidden />
                      {spot.duration}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col p-3.5 sm:p-4">
                    <h3 className="text-base font-extrabold text-river-900 transition-colors group-hover:text-leaf-700">
                      {spot.name}
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-river-600 sm:text-sm">
                      {spot.reason}
                    </p>
                    <span className="mt-auto inline-flex items-center gap-1 pt-3 text-xs font-extrabold text-leaf-700 group-hover:translate-x-0.5 transition-transform">
                      Xem chi tiết địa điểm
                      <ArrowRight className="size-3.5" aria-hidden />
                    </span>
                  </div>
                </Link>
              </TiltCard>
            ))}
          </div>
        </section>
      </Reveal>
    </div>
  );
}
