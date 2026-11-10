export function formatMinutes(total: number): string {
  if (total <= 0) return '0 phút';
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours === 0) return `${minutes} phút`;
  return minutes === 0 ? `${hours} giờ` : `${hours} giờ ${minutes} phút`;
}

const dateFormatter = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
const dateTimeFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : dateFormatter.format(date);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : dateTimeFormatter.format(date);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('vi-VN').format(value);
}

/** YYYY-MM-DD in Vietnam time, used for analytics filters. */
export function vnDateString(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function directionsUrl(coords: { lat: number; lng: number }): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`;
}

export function googleMapsEmbedUrl(
  coords: { lat: number; lng: number },
  options?: { label?: string; mapType?: 'm' | 'h'; zoom?: number },
): string {
  const zoom = options?.zoom ?? 15;
  const mapType = options?.mapType ?? 'm';
  const query = options?.label
    ? `${coords.lat},${coords.lng} (${options.label})`
    : `${coords.lat},${coords.lng}`;
  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&t=${mapType}&z=${zoom}&hl=vi&output=embed`;
}

export function googleMapsPlaceUrl(coords: { lat: number; lng: number }, name?: string): string {
  const query = name ? `${name} (${coords.lat},${coords.lng})` : `${coords.lat},${coords.lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function osmEmbedUrl(coords: { lat: number; lng: number }): string {
  return googleMapsEmbedUrl(coords);
}

export function osmLinkUrl(coords: { lat: number; lng: number }): string {
  return `https://www.openstreetmap.org/?mlat=${coords.lat}&mlon=${coords.lng}#map=14/${coords.lat}/${coords.lng}`;
}
