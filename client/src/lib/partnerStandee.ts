function drawRoundedRect(
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

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

function wrapCenterText(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  startY: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 2,
): number {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);

  lines.forEach((line, i) => {
    ctx.fillText(line, centerX, startY + i * lineHeight);
  });
  return startY + lines.length * lineHeight;
}

/**
 * Generates an offline, print-ready A5/A4 Standee PNG (1240x1754) directly from the server's
 * local QR data URL — zero external API dependencies, crisp vector typography!
 */
export async function renderStandeePngDataUrl(params: {
  destinationName: string;
  qrLabel: string;
  qrCode: string;
  qrImageDataUrl: string;
  targetType: string;
}): Promise<string> {
  const W = 1240;
  const H = 1754;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable');

  // Cream botanical background
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#ffffff');
  bg.addColorStop(0.55, '#faf8f0');
  bg.addColorStop(1, '#eaf3e6');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Outer official emerald border
  ctx.strokeStyle = '#176b50';
  ctx.lineWidth = 22;
  drawRoundedRect(ctx, 42, 42, W - 84, H - 84, 52);
  ctx.stroke();

  // Inner warm gold accent border
  ctx.strokeStyle = '#c4a15a';
  ctx.lineWidth = 4;
  drawRoundedRect(ctx, 68, 68, W - 136, H - 136, 38);
  ctx.stroke();

  // Top emerald header band
  const headerGrad = ctx.createLinearGradient(96, 96, W - 96, 330);
  headerGrad.addColorStop(0, '#0f2f25');
  headerGrad.addColorStop(0.5, '#176b50');
  headerGrad.addColorStop(1, '#125a43');
  ctx.fillStyle = headerGrad;
  drawRoundedRect(ctx, 96, 96, W - 192, 238, 30);
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#c5dfb8';
  ctx.font = '700 26px "Be Vietnam Pro", system-ui, sans-serif';
  ctx.fillText('HỆ THỐNG DU LỊCH THÔNG MINH TỈNH ĐỒNG THÁP', W / 2, 165);

  ctx.fillStyle = '#ffffff';
  ctx.font = '800 54px "Be Vietnam Pro", system-ui, sans-serif';
  ctx.fillText('ĐỒNG THÁP SMART TRAVEL', W / 2, 240);

  ctx.fillStyle = '#f7cbd5';
  ctx.font = '600 25px "Be Vietnam Pro", system-ui, sans-serif';
  ctx.fillText('HỘ CHIẾU TRẢI NGHIỆM SỐ · ĐẤT SEN HỒNG', W / 2, 294);

  // Destination name pill
  ctx.fillStyle = '#fbe8ec';
  drawRoundedRect(ctx, 136, 382, W - 272, 118, 28);
  ctx.fill();
  ctx.strokeStyle = '#efa4b5';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = '#74374d';
  ctx.font = '800 38px "Be Vietnam Pro", system-ui, sans-serif';
  wrapCenterText(ctx, params.destinationName, W / 2, 444, W - 340, 44, 2);

  // Call to Action
  ctx.fillStyle = '#0f2f25';
  ctx.font = '800 44px "Be Vietnam Pro", system-ui, sans-serif';
  ctx.fillText(
    params.targetType === 'challenge'
      ? 'QUÉT MÃ GIẢI ĐỐ NHẬN ĐIỂM'
      : 'QUÉT MÃ ĐIỂM DANH NHẬN ĐIỂM',
    W / 2,
    576,
  );

  ctx.fillStyle = '#34483d';
  ctx.font = '600 28px "Be Vietnam Pro", system-ui, sans-serif';
  ctx.fillText(`Vị trí trạm: ${params.qrLabel}`, W / 2, 628);

  // QR Box Frame
  const qrBoxSize = 590;
  const qrBoxX = (W - qrBoxSize) / 2;
  const qrBoxY = 674;

  ctx.fillStyle = '#ffffff';
  drawRoundedRect(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 40);
  ctx.fill();
  ctx.save();
  ctx.setLineDash([16, 12]);
  ctx.strokeStyle = '#176b50';
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.restore();

  const qrImg = await loadImage(params.qrImageDataUrl);
  const imgPad = 40;
  ctx.drawImage(qrImg, qrBoxX + imgPad, qrBoxY + imgPad, qrBoxSize - imgPad * 2, qrBoxSize - imgPad * 2);

  // Code badge
  ctx.fillStyle = '#0f2f25';
  drawRoundedRect(ctx, W / 2 - 190, qrBoxY + qrBoxSize + 28, 380, 62, 31);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 32px ui-monospace, monospace';
  ctx.fillText(params.qrCode, W / 2, qrBoxY + qrBoxSize + 70);

  // 3-Step Tourist Guide Box
  const guideY = 1396;
  ctx.fillStyle = '#ffffff';
  drawRoundedRect(ctx, 130, guideY, W - 260, 224, 28);
  ctx.fill();
  ctx.strokeStyle = '#dcebd4';
  ctx.lineWidth = 3;
  ctx.stroke();

  const steps = [
    '1. Mở Camera điện thoại hoặc Zalo để quét mã QR ở trên',
    '2. Xác nhận điểm danh đóng dấu vào Hộ chiếu Trải nghiệm số',
    '3. Giải đố văn hóa tích lũy EXP & mở khóa huy hiệu Sen Hồng',
  ];
  ctx.textAlign = 'left';
  ctx.fillStyle = '#153f32';
  ctx.font = '700 26px "Be Vietnam Pro", system-ui, sans-serif';
  steps.forEach((line, idx) => {
    ctx.fillText(line, 174, guideY + 62 + idx * 58);
  });

  // Footer
  ctx.textAlign = 'center';
  ctx.fillStyle = '#5b6b60';
  ctx.font = '600 22px "Be Vietnam Pro", system-ui, sans-serif';
  ctx.fillText('© Đồng Tháp Smart Travel · Nền tảng Du lịch Thông minh Đất Sen Hồng', W / 2, H - 88);

  return canvas.toDataURL('image/png');
}

/** Opens a clean isolated print preview containing ONLY the Standee (no sidebar/header!). */
export function printStandeeImageIsolated(standeePngDataUrl: string, title: string) {
  const win = window.open('', '_blank', 'width=820,height=980');
  if (!win) {
    // Fallback: trigger direct PNG download if popups are blocked
    const a = document.createElement('a');
    a.href = standeePngDataUrl;
    a.download = `standee-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
    a.click();
    return;
  }
  const safeTitle = title.replace(/[<>&"]/g, '');
  win.document.write(`<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <title>In Standee — ${safeTitle}</title>
  <style>
    @page { size: A5 portrait; margin: 6mm; }
    * { box-sizing: border-box; }
    body { margin: 0; display: grid; place-items: center; min-height: 100vh; background: #f4f8ef; }
    img { max-width: 100%; max-height: 96vh; height: auto; box-shadow: 0 12px 32px rgba(0,0,0,0.18); }
    @media print {
      body { background: #fff; }
      img { max-height: 100vh; box-shadow: none; }
    }
  </style>
</head>
<body>
  <img src="${standeePngDataUrl}" alt="Standee QR" onload="setTimeout(() => window.print(), 250)" />
</body>
</html>`);
  win.document.close();
}
