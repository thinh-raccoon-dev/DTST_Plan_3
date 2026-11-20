import type { LocalFootprintTrack } from './footprintOfflineStore';

function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function downloadFootprintShareCard(
  track: LocalFootprintTrack,
  exploredPercent: number,
): boolean {
  if (typeof document === 'undefined' || track.points.length < 2) return false;

  const W = 1080;
  const H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;

  const accent = track.color || '#10b981';

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#07171f');
  bg.addColorStop(0.5, '#0f2f25');
  bg.addColorStop(1, '#123e32');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Soft ambient lotus & emerald orbs
  const orb1 = ctx.createRadialGradient(920, 180, 20, 920, 180, 380);
  orb1.addColorStop(0, 'rgba(239, 164, 181, 0.25)');
  orb1.addColorStop(1, 'rgba(239, 164, 181, 0)');
  ctx.fillStyle = orb1;
  ctx.fillRect(0, 0, W, H);

  const orb2 = ctx.createRadialGradient(180, 1120, 20, 180, 1120, 420);
  orb2.addColorStop(0, 'rgba(16, 185, 129, 0.24)');
  orb2.addColorStop(1, 'rgba(16, 185, 129, 0)');
  ctx.fillStyle = orb2;
  ctx.fillRect(0, 0, W, H);

  // Subtle topo dot grid
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  for (let gx = 48; gx < W; gx += 36) {
    for (let gy = 48; gy < H; gy += 36) {
      ctx.fillRect(gx, gy, 2, 2);
    }
  }

  // Top Brand Header
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  drawRoundRect(ctx, 68, 64, 460, 50, 25);
  ctx.fill();
  ctx.fillStyle = '#a7f3d0';
  ctx.font = '700 22px "Be Vietnam Pro", system-ui, sans-serif';
  ctx.fillText('ĐỒNG THÁP SMART TRAVEL · BẢN ĐỒ DẤU CHÂN', 94, 96);

  // Title
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 50px "Be Vietnam Pro", system-ui, sans-serif';
  const titleText = track.title.length > 34 ? `${track.title.slice(0, 33)}…` : track.title;
  ctx.fillText(titleText, 68, 190);

  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  ctx.font = '500 24px "Be Vietnam Pro", system-ui, sans-serif';
  const dateLabel = new Date(track.startedAt || Date.now()).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  ctx.fillText(`Hành trình khám phá Đất Sen Hồng · ${dateLabel}`, 68, 232);

  // Route Canvas Frame
  const boxX = 68;
  const boxY = 276;
  const boxW = W - 136;
  const boxH = 560;

  ctx.fillStyle = 'rgba(5, 19, 26, 0.72)';
  drawRoundRect(ctx, boxX, boxY, boxW, boxH, 36);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Compute bounding box of GPS route
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const pt of track.points) {
    if (pt.lat < minLat) minLat = pt.lat;
    if (pt.lat > maxLat) maxLat = pt.lat;
    if (pt.lng < minLng) minLng = pt.lng;
    if (pt.lng > maxLng) maxLng = pt.lng;
  }

  const latSpan = Math.max(0.004, maxLat - minLat);
  const lngSpan = Math.max(0.004, maxLng - minLng);
  const pad = 84;
  const usableW = boxW - pad * 2;
  const usableH = boxH - pad * 2;
  const scale = Math.min(usableW / lngSpan, usableH / latSpan);
  const offsetX = boxX + pad + (usableW - lngSpan * scale) / 2;
  const offsetY = boxY + pad + (usableH - latSpan * scale) / 2;

  const project = (lat: number, lng: number) => ({
    x: offsetX + (lng - minLng) * scale,
    y: offsetY + (maxLat - lat) * scale,
  });

  // Glow layer
  ctx.save();
  ctx.beginPath();
  track.points.forEach((pt, idx) => {
    const p = project(pt.lat, pt.lng);
    if (idx === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.strokeStyle = accent;
  ctx.lineWidth = 24;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalAlpha = 0.25;
  ctx.stroke();

  // White casing
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 11;
  ctx.stroke();

  // Bright core
  ctx.globalAlpha = 1;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.restore();

  // Numbered Stop Nodes
  const stops = track.memories || [];
  stops.forEach((m, idx) => {
    const p = project(m.lat, m.lng);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 20, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = accent;
    ctx.stroke();

    ctx.fillStyle = '#0f2f25';
    ctx.font = '800 20px "Be Vietnam Pro", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(idx + 1), p.x, p.y + 1);
  });
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Stat Cards Row
  const statsY = 874;
  const cardW = (W - 136 - 40) / 3;
  const statItems = [
    { label: 'QUÃNG ĐƯỜNG', val: `${track.distanceKm} km`, color: '#6ee7b7' },
    { label: 'ĐIỂM DỪNG CHÂN', val: `${Math.max(1, stops.length)} chặng`, color: '#f9a8d4' },
    { label: 'MỞ KHÓA ĐỒNG THÁP', val: `${exploredPercent}%`, color: '#fde68a' },
  ];

  statItems.forEach((st, idx) => {
    const x = 68 + idx * (cardW + 20);
    ctx.fillStyle = 'rgba(255,255,255,0.09)';
    drawRoundRect(ctx, x, statsY, cardW, 134, 26);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.68)';
    ctx.font = '700 18px "Be Vietnam Pro", system-ui, sans-serif';
    ctx.fillText(st.label, x + 26, statsY + 46);

    ctx.fillStyle = st.color;
    ctx.font = '800 42px "Be Vietnam Pro", system-ui, sans-serif';
    ctx.fillText(st.val, x + 26, statsY + 104);
  });

  // Stop Itinerary Footer Strip
  const listY = 1048;
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  drawRoundRect(ctx, 68, listY, W - 136, 198, 28);
  ctx.fill();

  ctx.fillStyle = '#a7f3d0';
  ctx.font = '700 20px "Be Vietnam Pro", system-ui, sans-serif';
  ctx.fillText('LỘ TRÌNH ĐÃ ĐI QUA', 98, listY + 42);

  const visibleStops = stops.slice(0, 4);
  visibleStops.forEach((s, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const sx = 98 + col * 440;
    const sy = listY + 94 + row * 56;
    const label = `${idx + 1}. ${s.placeName || s.moodLabel}`;
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 22px "Be Vietnam Pro", system-ui, sans-serif';
    ctx.fillText(label.length > 29 ? `${label.slice(0, 28)}…` : label, sx, sy);
  });

  // Bottom signature
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '600 20px "Be Vietnam Pro", system-ui, sans-serif';
  ctx.fillText('“Về Đồng Tháp – Thuần khiết như hồn sen” · dongthapgo.com', 68, H - 46);

  const link = document.createElement('a');
  link.download = `lo-trinh-dong-thap-${Date.now()}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
  return true;
}
