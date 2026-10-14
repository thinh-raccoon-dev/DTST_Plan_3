const CODE_PATTERN = /^[A-Z0-9-]{4,32}$/;

/**
 * Extracts a platform QR code from scanned text. Accepts a bare code or a URL whose path is
 * /qr/{code}; anything else (external links, other apps' QR codes) is rejected.
 */
export function extractQrCode(raw: string): string | null {
  const text = raw.trim();
  if (CODE_PATTERN.test(text.toUpperCase()) && !text.includes('/')) return text.toUpperCase();
  try {
    const url = new URL(text);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    const match = url.pathname.match(/^\/qr\/([A-Za-z0-9-]{4,32})\/?$/);
    return match?.[1] ? match[1].toUpperCase() : null;
  } catch {
    return null;
  }
}
