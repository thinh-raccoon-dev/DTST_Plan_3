import clsx from 'clsx';
import {
  Award,
  Download,
  QrCode,
  RotateCw,
  Share2,
  Sparkles,
} from 'lucide-react';
import { useCallback, useState } from 'react';
import { Button } from '../ui/Button';
import { formatNumber } from '../../lib/format';
import { toast } from '../../stores/toastStore';
import type { Passport } from '../../types/api';

interface TravelerPassProps {
  user: {
    id?: string;
    email?: string;
    displayName: string;
    role?: string;
  } | null;
  passport: Passport;
}

interface TierConfig {
  name: string;
  enName: string;
  badgeTone: string;
  gradient: string;
  accentColor: string;
  borderGlow: string;
  description: string;
}

export function getTier(points: number): TierConfig {
  if (points >= 300) {
    return {
      name: 'Huyền Thoại Sen Hồng',
      enName: 'LOTUS LEGEND',
      badgeTone: 'text-rose-300',
      gradient: 'from-[#170a14] via-[#2d1222] to-[#0d2a20]',
      accentColor: '#f472b6',
      borderGlow: 'ring-rose-400/40 shadow-rose-950/40',
      description: 'Cấp bậc danh dự cao nhất của du khách Đồng Tháp',
    };
  }
  if (points >= 150) {
    return {
      name: 'Đại Sứ Đất Sen',
      enName: 'AMBASSADOR',
      badgeTone: 'text-amber-300',
      gradient: 'from-[#1f1906] via-[#2f2409] to-[#0c2419]',
      accentColor: '#fbbf24',
      borderGlow: 'ring-amber-400/40 shadow-amber-950/40',
      description: 'Đại sứ trải nghiệm văn hóa và sinh thái',
    };
  }
  if (points >= 50) {
    return {
      name: 'Nhà Du Hành',
      enName: 'PATHFINDER',
      badgeTone: 'text-emerald-300',
      gradient: 'from-[#071f16] via-[#0e3b2b] to-[#122b22]',
      accentColor: '#34d399',
      borderGlow: 'ring-emerald-400/35 shadow-emerald-950/40',
      description: 'Đã hoàn thành nhiều chặng hành trình tiêu biểu',
    };
  }
  return {
    name: 'Du Khách Tập Sự',
    enName: 'EXPLORER',
    badgeTone: 'text-teal-200',
    gradient: 'from-[#081b15] via-[#103026] to-[#132822]',
    accentColor: '#2dd4bf',
    borderGlow: 'ring-teal-400/30 shadow-teal-950/30',
    description: 'Bắt đầu hành trình khám phá Đất Sen Hồng',
  };
}

export function DigitalTravelerPass({ user, passport }: TravelerPassProps) {
  const [flipped, setFlipped] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const displayName = user?.displayName || 'Du khách Khám phá';
  const points = passport.totals.points || 0;
  const tier = getTier(points);

  // Derive stable Pass ID
  const passId = `DTST-${(user?.id || 'GUEST').slice(-4).toUpperCase()}-2026`;
  const exploredCount = passport.totals.exploredDestinations;
  const totalDestinations = passport.progress.total || 56;
  const badgesCount = passport.totals.badges;

  // Draw high-resolution canvas card for downloading (1200x756px)
  const downloadCardImage = useCallback(async () => {
    setDownloading(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 756;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Không thể khởi tạo đồ họa.');

      // 1. Base Dark Emerald Background
      const bgGrad = ctx.createLinearGradient(0, 0, 1200, 756);
      if (points >= 300) {
        bgGrad.addColorStop(0, '#190a16');
        bgGrad.addColorStop(0.5, '#2b1022');
        bgGrad.addColorStop(1, '#0c2419');
      } else if (points >= 150) {
        bgGrad.addColorStop(0, '#1c1605');
        bgGrad.addColorStop(0.5, '#2c220a');
        bgGrad.addColorStop(1, '#0b2419');
      } else {
        bgGrad.addColorStop(0, '#071e16');
        bgGrad.addColorStop(0.5, '#0e3829');
        bgGrad.addColorStop(1, '#112920');
      }
      ctx.fillStyle = bgGrad;
      ctx.beginPath();
      ctx.roundRect(0, 0, 1200, 756, 40);
      ctx.fill();

      // 2. Outer Golden Rim
      ctx.strokeStyle = points >= 150 ? '#f59e0b' : '#34d399';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(16, 16, 1168, 724, 32);
      ctx.stroke();

      // 3. Holographic Sheen Overlay
      const sheenGrad = ctx.createLinearGradient(0, 0, 1200, 756);
      sheenGrad.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
      sheenGrad.addColorStop(0.3, 'rgba(255, 215, 0, 0.05)');
      sheenGrad.addColorStop(0.7, 'rgba(244, 114, 182, 0.06)');
      sheenGrad.addColorStop(1, 'rgba(255, 255, 255, 0.02)');
      ctx.fillStyle = sheenGrad;
      ctx.beginPath();
      ctx.roundRect(0, 0, 1200, 756, 40);
      ctx.fill();

      // 4. Stylized Lotus Graphic / Circuits (Top Right)
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
      ctx.lineWidth = 2;
      for (let r = 80; r <= 320; r += 60) {
        ctx.beginPath();
        ctx.arc(1050, 150, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      // 5. Card Header: Brand Title
      ctx.font = 'bold 26px "Be Vietnam Pro", sans-serif';
      ctx.fillStyle = '#f3f4f6';
      ctx.letterSpacing = '3px';
      ctx.fillText('ĐỒNG THÁP SMART TRAVEL', 70, 85);

      ctx.font = '600 16px "Be Vietnam Pro", sans-serif';
      ctx.fillStyle = points >= 150 ? '#fcd34d' : '#6ee7b7';
      ctx.fillText('HỘ CHIẾU TRẢI NGHIỆM SỐ · DIGITAL TRAVELER PASS', 70, 115);

      // 6. Gold Smart EMV Chip (Left)
      ctx.fillStyle = '#eab308';
      ctx.beginPath();
      ctx.roundRect(70, 160, 95, 75, 12);
      ctx.fill();
      ctx.strokeStyle = '#ca8a04';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Chip internal circuit lines
      ctx.strokeStyle = '#854d0e';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(70, 197);
      ctx.lineTo(165, 197);
      ctx.moveTo(117, 160);
      ctx.lineTo(117, 235);
      ctx.stroke();

      // 7. Contactless NFC Waves
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 2.5;
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.arc(200, 197, i * 10, -Math.PI / 3, Math.PI / 3);
        ctx.stroke();
      }

      // 8. Membership Tier Badge (Right)
      ctx.fillStyle = points >= 150 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(52, 211, 153, 0.15)';
      ctx.strokeStyle = points >= 150 ? '#f59e0b' : '#34d399';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(830, 60, 300, 52, 26);
      ctx.fill();
      ctx.stroke();

      ctx.font = 'bold 18px "Be Vietnam Pro", sans-serif';
      ctx.fillStyle = points >= 150 ? '#fef08a' : '#a7f3d0';
      ctx.textAlign = 'center';
      ctx.fillText(`★ ${tier.name.toUpperCase()} ★`, 980, 93);
      ctx.textAlign = 'left';

      // 9. Card Pass ID Number (Embossed look)
      ctx.font = 'bold 36px "Courier New", monospace';
      ctx.fillStyle = '#ffffff';
      ctx.letterSpacing = '4px';
      ctx.fillText(passId, 70, 310);

      // 10. Traveler Name
      ctx.font = '500 15px "Be Vietnam Pro", sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fillText('CHỦ SỞ HỮU THẺ / TRAVELER NAME', 70, 380);

      ctx.font = 'bold 38px "Be Vietnam Pro", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(displayName.toUpperCase(), 70, 430);

      // 11. Stats Row: Explored & Points & Badges
      const statY = 560;
      // Box 1: Explored
      ctx.font = '500 15px "Be Vietnam Pro", sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fillText('ĐIỂM ĐẾN ĐÃ KHÁM PHÁ', 70, statY);
      ctx.font = 'bold 32px "Be Vietnam Pro", sans-serif';
      ctx.fillStyle = '#6ee7b7';
      ctx.fillText(`${exploredCount} / ${totalDestinations} Điểm`, 70, statY + 40);

      // Box 2: Points
      ctx.font = '500 15px "Be Vietnam Pro", sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fillText('ĐIỂM THƯỞNG TÍCH LŨY', 450, statY);
      ctx.font = 'bold 32px "Be Vietnam Pro", sans-serif';
      ctx.fillStyle = '#fde047';
      ctx.fillText(`+${formatNumber(points)} ĐIỂM`, 450, statY + 40);

      // Box 3: Badges
      ctx.font = '500 15px "Be Vietnam Pro", sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fillText('HUY HIỆU ĐÃ ĐẠT', 820, statY);
      ctx.font = 'bold 32px "Be Vietnam Pro", sans-serif';
      ctx.fillStyle = '#f472b6';
      ctx.fillText(`${badgesCount} Huy hiệu`, 820, statY + 40);

      // 12. Verification Official Seal (Bottom Right Stamp)
      ctx.save();
      ctx.translate(1080, 420);
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.7)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 52, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 46, 0, Math.PI * 2);
      ctx.stroke();

      ctx.font = 'bold 10px "Be Vietnam Pro", sans-serif';
      ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
      ctx.textAlign = 'center';
      ctx.fillText('ĐỒNG THÁP SMART', 0, -10);
      ctx.fillText('TRAVEL', 0, 5);
      ctx.font = '8px "Be Vietnam Pro", sans-serif';
      ctx.fillText('VERIFIED 2026', 0, 22);
      ctx.restore();

      // 13. Footer Notice
      ctx.font = 'italic 14px "Be Vietnam Pro", sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.fillText('Xác thực điện tử trên Hệ sinh thái Du lịch Thông minh Đồng Tháp · www.dongthaptravel.vn', 70, 700);

      // 14. Export to Download
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      const cleanName = displayName.replace(/[^a-zA-Z0-9]/g, '_');
      a.download = `The_Du_Hanh_Dong_Thap_${cleanName}.png`;
      a.click();
      toast.success('Đã tải thành công Thẻ Du Hành Số (HD)', 'Bạn có thể dùng ảnh này để khoe lên Facebook, Zalo, Story!');
    } catch (err: unknown) {
      toast.error('Không thể xuất ảnh thẻ', (err as Error)?.message || 'Vui lòng thử lại.');
    } finally {
      setDownloading(false);
    }
  }, [displayName, points, tier, passId, exploredCount, totalDestinations, badgesCount]);

  const copyShareLink = () => {
    const url = window.location.href;
    navigator.clipboard?.writeText(url);
    toast.success('Đã sao chép liên kết Hộ chiếu');
  };

  return (
    <div className="w-full">
      {/* Action Header above Card */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-teal-500/10 text-teal-700 ring-1 ring-teal-500/20">
            <Sparkles className="size-4 text-teal-600" />
          </span>
          <h2 className="text-base font-bold text-river-900 sm:text-lg">
            Thẻ Căn Cước Du Lịch Sen Hồng (Digital Traveler Pass)
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setFlipped((f) => !f)}
            icon={<RotateCw className="size-3.5" />}
            title="Lật xem mặt sau thẻ"
          >
            {flipped ? 'Xem mặt trước' : 'Lật mặt sau'}
          </Button>

          <Button
            size="sm"
            variant="secondary"
            onClick={copyShareLink}
            icon={<Share2 className="size-3.5" />}
            title="Sao chép liên kết Hộ chiếu"
          >
            Chia sẻ
          </Button>

          <Button
            size="sm"
            variant="primary"
            onClick={downloadCardImage}
            loading={downloading}
            icon={<Download className="size-3.5" />}
          >
            Tải thẻ HD
          </Button>
        </div>
      </div>

      {/* 3D Card Container */}
      <div className="mx-auto w-full max-w-[500px]" style={{ perspective: '1200px' }}>
        <div
          onClick={() => setFlipped((f) => !f)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setFlipped((f) => !f)}
          }}
          className="group relative aspect-[1.586/1] w-full cursor-pointer select-none transition-transform duration-700 ease-out"
          style={{
            transformStyle: 'preserve-3d',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
          title="Bấm vào thẻ để lật mặt trước / sau"
        >
          {/* ==================== FRONT OF CARD ==================== */}
          <div
            className={clsx(
              'absolute inset-0 overflow-hidden rounded-[24px] p-5 sm:p-6 text-white shadow-2xl transition-all duration-300',
              'ring-1 ring-white/20 group-hover:shadow-[0_20px_50px_rgba(23,107,80,0.35)]',
              'bg-gradient-to-br',
              tier.gradient,
              tier.borderGlow,
            )}
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
            }}
          >
            {/* Holographic Sheen & Radial Glow */}
            <div
              className="pointer-events-none absolute -right-20 -top-20 size-60 rounded-full opacity-40 blur-3xl transition-opacity group-hover:opacity-70"
              style={{ background: tier.accentColor }}
            />
            <div className="pointer-events-none absolute -bottom-16 -left-16 size-48 rounded-full bg-leaf-500/20 blur-2xl" />

            {/* Subtle concentric circles */}
            <div className="pointer-events-none absolute -right-10 -top-10 size-48 rounded-full border border-white/5" />
            <div className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full border border-white/5" />

            {/* Top row: Brand & Tier Badge */}
            <div className="relative z-10 flex items-start justify-between">
              <div>
                <p className="text-[11px] font-extrabold tracking-widest uppercase text-white/90">
                  ĐỒNG THÁP SMART TRAVEL
                </p>
                <p className="text-[9px] font-semibold tracking-wider text-teal-300/90 uppercase">
                  OFFICIAL TRAVELER PASS · HỘ CHIẾU SỐ
                </p>
              </div>

              <div
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase ring-1"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.12)',
                  borderColor: tier.accentColor,
                  color: '#ffffff',
                }}
              >
                <span className="size-1.5 rounded-full" style={{ backgroundColor: tier.accentColor }} />
                {tier.name}
              </div>
            </div>

            {/* Middle row: Gold EMV Chip & NFC */}
            <div className="relative z-10 mt-3 flex items-center gap-3">
              <div className="relative flex h-8 w-11 items-center justify-center rounded-md bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 shadow-md ring-1 ring-amber-700/50">
                <div className="h-full w-px bg-amber-800/40" />
                <div className="absolute inset-x-0 h-px bg-amber-800/40" />
                <div className="size-4 rounded-full border border-amber-800/30" />
              </div>

              {/* NFC icon */}
              <svg className="size-4 text-white/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8.5 16.5a5 5 0 0 1 0-7" />
                <path d="M12 19a8.5 8.5 0 0 0 0-14" />
                <path d="M15.5 21.5a12 12 0 0 0 0-19" />
              </svg>
            </div>

            {/* Pass ID (Embossed style) */}
            <div className="relative z-10 mt-3 font-mono text-sm sm:text-base font-bold tracking-widest text-white/95 drop-shadow">
              {passId}
            </div>

            {/* Bottom row: Name & Key Stats */}
            <div className="relative z-10 mt-auto pt-2 flex items-end justify-between border-t border-white/10">
              <div>
                <p className="text-[9px] font-semibold tracking-wider uppercase text-white/50">
                  DU KHÁCH / TRAVELER
                </p>
                <p className="text-sm sm:text-base font-bold tracking-wide text-white uppercase drop-shadow truncate max-w-[220px]">
                  {displayName}
                </p>
              </div>

              <div className="flex items-center gap-4 text-right">
                <div>
                  <p className="text-[9px] font-medium text-white/50">ĐÃ KHÁM PHÁ</p>
                  <p className="text-xs sm:text-sm font-extrabold text-teal-300">
                    {exploredCount}/{totalDestinations}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-medium text-white/50">ĐIỂM TÍCH LŨY</p>
                  <p className="text-xs sm:text-sm font-extrabold text-amber-300">
                    +{formatNumber(points)}
                  </p>
                </div>
              </div>
            </div>

            {/* Official Seal Watermark (Bottom right) */}
            <div className="pointer-events-none absolute -bottom-6 -right-6 flex size-24 items-center justify-center rounded-full border-2 border-red-500/30 text-center opacity-60">
              <span className="text-[8px] font-extrabold uppercase text-red-400 rotate-[-15deg] leading-none">
                ĐỒNG THÁP<br />VERIFIED
              </span>
            </div>
          </div>

          {/* ==================== BACK OF CARD ==================== */}
          <div
            className={clsx(
              'absolute inset-0 flex flex-col justify-between overflow-hidden rounded-[24px] p-5 sm:p-6 text-white shadow-2xl',
              'ring-1 ring-white/20 bg-gradient-to-br from-[#0a1813] via-[#102b21] to-[#07130e]',
              tier.borderGlow,
            )}
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
            }}
          >
            {/* Magnetic Stripe */}
            <div className="-mx-6 -mt-1 h-9 bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-900 shadow-inner" />

            {/* Signature Panel */}
            <div className="mt-2 flex items-center justify-between rounded-lg bg-sand-100/90 px-3 py-1.5 text-river-900 shadow-sm">
              <span className="font-mono text-[9px] text-river-500">CHỮ KÝ ĐIỆN TỬ:</span>
              <span className="font-serif italic text-xs font-bold text-leaf-800">
                Đồng Tháp Smart Travel
              </span>
              <span className="font-mono text-[9px] font-bold text-river-700">CVV: 868</span>
            </div>

            {/* QR Code and Badges Summary */}
            <div className="mt-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-white p-1 shadow-md">
                  {/* Decorative stylized QR icon */}
                  <div className="grid size-full place-items-center bg-sand-50 rounded text-leaf-800">
                    <QrCode className="size-10 text-leaf-800" />
                  </div>
                </div>
                <div className="text-[10px] text-white/70 leading-tight">
                  <p className="font-bold text-white">Xác thực điện tử</p>
                  <p className="text-[9px] text-teal-300">Quét để đối chiếu Hộ chiếu</p>
                  <p className="text-[8px] text-white/40 mt-1">Cấp bởi Sở VHTTDL Đồng Tháp</p>
                </div>
              </div>

              {/* Mini Badges Unlocked */}
              <div className="text-right">
                <p className="text-[9px] text-white/50 uppercase">HUY HIỆU DANH GIÁ</p>
                <div className="mt-1 flex items-center justify-end gap-1">
                  {passport.badges
                    .filter((b) => b.earned)
                    .slice(0, 4)
                    .map((b) => (
                      <span
                        key={b.key}
                        className="flex size-6 items-center justify-center rounded-full bg-teal-400/20 text-teal-300 ring-1 ring-teal-400/40"
                        title={b.name}
                      >
                        <Award className="size-3.5" />
                      </span>
                    ))}
                  {badgesCount === 0 && (
                    <span className="text-[10px] text-white/40 italic">Chưa có huy hiệu</span>
                  )}
                </div>
              </div>
            </div>

            {/* Culture Motto Footer */}
            <div className="mt-auto pt-2 border-t border-white/10 text-center">
              <p className="font-serif italic text-[11px] text-teal-200">
                "Về Đồng Tháp – Thuần khiết như hồn sen, Đậm đà tình đất phương Nam"
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Helper caption */}
      <p className="mt-3 text-center text-xs text-river-500">
        💡 <em>Nhấp vào thẻ để lật 3D xem mặt trước / mặt sau. Bấm <strong>"Tải thẻ HD"</strong> để lưu ảnh chất lượng cao chia sẻ mạng xã hội.</em>
      </p>
    </div>
  );
}
