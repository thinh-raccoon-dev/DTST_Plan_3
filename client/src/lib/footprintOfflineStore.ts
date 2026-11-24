export interface TrackPoint {
  lat: number;
  lng: number;
  timestamp: number;
  speedKmh?: number;
}

export interface MemoryPin {
  clientId: string;
  lat: number;
  lng: number;
  emoji: string;
  moodLabel: string;
  note: string;
  placeName?: string;
  imageUrl?: string;
  createdAt: number;
}

export interface LocalFootprintTrack {
  storageKey?: string;
  ownerKey?: string;
  clientId: string;
  title: string;
  color: string;
  distanceKm: number;
  durationSeconds: number;
  startedAt: number;
  endedAt: number;
  points: TrackPoint[];
  memories: MemoryPin[];
  isDemoRoute?: boolean;
  syncStatus: 'pending' | 'synced';
}

export interface CheckInPinItem {
  id: string;
  destinationId: string;
  name: string;
  slug: string;
  area: string;
  category: string;
  summary: string;
  imageUrl?: string;
  coordinates: { lat: number; lng: number };
  pointsAwarded: number;
  checkedInAt: string;
}

const DB_NAME = 'dtst_footprints_offline_db';
const DB_VERSION = 2;
const STORE_TRACKS = 'footprint_tracks_v2';
const LEGACY_STORE_TRACKS = 'footprint_tracks';
const LEGACY_LS_KEY = 'dtst_footprints_offline_backup_v1';
const LS_FALLBACK_PREFIX = 'dtst_footprints_offline_backup_v2_';

export function buildFootprintOwnerKey(userId?: string | null): string {
  return userId ? `user:${userId}` : 'guest';
}

function makeStorageKey(ownerKey: string, clientId: string): string {
  return `${ownerKey}::${clientId}`;
}

function lsKeyForOwner(ownerKey: string): string {
  return `${LS_FALLBACK_PREFIX}${ownerKey}`;
}

function purgeLegacyUnscopedBackup(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(LEGACY_LS_KEY);
    }
  } catch {
    // ignore
  }
}

export function haversineDistanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export function calculatePolylineKm(points: Array<{ lat: number; lng: number }>): number {
  if (points.length < 2) return 0;
  let sum = 0;
  for (let i = 1; i < points.length; i++) {
    sum += haversineDistanceKm(points[i - 1]!, points[i]!);
  }
  return Math.round(sum * 100) / 100;
}

function openFootprintDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      // Drop legacy v1 unscoped store so stale cross-account / demo starter tracks never leak into new users
      if (db.objectStoreNames.contains(LEGACY_STORE_TRACKS)) {
        db.deleteObjectStore(LEGACY_STORE_TRACKS);
      }
      if (!db.objectStoreNames.contains(STORE_TRACKS)) {
        db.createObjectStore(STORE_TRACKS, { keyPath: 'storageKey' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open IndexedDB'));
  });
}

function readLsFallback(ownerKey: string): LocalFootprintTrack[] {
  purgeLegacyUnscopedBackup();
  try {
    const raw = localStorage.getItem(lsKeyForOwner(ownerKey));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((t) => t && t.ownerKey === ownerKey) : [];
  } catch {
    return [];
  }
}

function writeLsFallback(ownerKey: string, tracks: LocalFootprintTrack[]): void {
  purgeLegacyUnscopedBackup();
  try {
    localStorage.setItem(lsKeyForOwner(ownerKey), JSON.stringify(tracks.slice(0, 50)));
  } catch {
    // ignore storage quota errors
  }
}

export async function getAllLocalTracks(ownerKey = 'guest'): Promise<LocalFootprintTrack[]> {
  purgeLegacyUnscopedBackup();
  try {
    const db = await openFootprintDb();
    return await new Promise<LocalFootprintTrack[]>((resolve, reject) => {
      const tx = db.transaction(STORE_TRACKS, 'readonly');
      const store = tx.objectStore(STORE_TRACKS);
      const req = store.getAll();
      req.onsuccess = () => {
        const list = ((req.result as LocalFootprintTrack[]) || []).filter((t) => t.ownerKey === ownerKey);
        list.sort((a, b) => b.startedAt - a.startedAt);
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return readLsFallback(ownerKey);
  }
}

export async function saveLocalTrack(track: LocalFootprintTrack, ownerKey = track.ownerKey || 'guest'): Promise<void> {
  const scoped: LocalFootprintTrack = {
    ...track,
    ownerKey,
    storageKey: makeStorageKey(ownerKey, track.clientId),
  };
  const existingFallback = readLsFallback(ownerKey).filter((t) => t.clientId !== scoped.clientId);
  writeLsFallback(ownerKey, [scoped, ...existingFallback]);

  try {
    const db = await openFootprintDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_TRACKS, 'readwrite');
      const store = tx.objectStore(STORE_TRACKS);
      store.put(scoped);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // fallback already written to localStorage
  }
}

export async function deleteLocalTrackById(clientId: string, ownerKey = 'guest'): Promise<void> {
  const existingFallback = readLsFallback(ownerKey).filter((t) => t.clientId !== clientId);
  writeLsFallback(ownerKey, existingFallback);

  try {
    const db = await openFootprintDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_TRACKS, 'readwrite');
      const store = tx.objectStore(STORE_TRACKS);
      store.delete(makeStorageKey(ownerKey, clientId));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}

export async function markTracksAsSynced(clientIds: string[], ownerKey = 'guest'): Promise<void> {
  const idSet = new Set(clientIds);
  const all = await getAllLocalTracks(ownerKey);
  for (const t of all) {
    if (idSet.has(t.clientId) && t.syncStatus !== 'synced') {
      await saveLocalTrack({ ...t, syncStatus: 'synced' }, ownerKey);
    }
  }
}

export async function mergeServerTracksWithLocal(
  serverTracks: Array<{
    clientId: string;
    title: string;
    color: string;
    distanceKm: number;
    durationSeconds: number;
    startedAt: string | number;
    endedAt: string | number;
    points: TrackPoint[];
    memories: MemoryPin[];
    isDemoRoute?: boolean;
  }>,
  ownerKey = 'guest',
): Promise<LocalFootprintTrack[]> {
  const localTracks = await getAllLocalTracks(ownerKey);
  const byId = new Map<string, LocalFootprintTrack>();

  // Keep only local pending tracks (not yet synced) or local preview demo tracks; server is the source of truth for synced tracks
  for (const loc of localTracks) {
    if (loc.syncStatus === 'pending' || loc.isDemoRoute) {
      byId.set(loc.clientId, loc);
    }
  }

  for (const srv of serverTracks) {
    const existingLoc = byId.get(srv.clientId);
    // Keep local pending version if it has more points or memories than server
    if (
      existingLoc &&
      existingLoc.syncStatus === 'pending' &&
      (existingLoc.points.length > (srv.points?.length || 0) ||
        existingLoc.memories.length > (srv.memories?.length || 0))
    ) {
      continue;
    }

    const merged: LocalFootprintTrack = {
      ownerKey,
      storageKey: makeStorageKey(ownerKey, srv.clientId),
      clientId: srv.clientId,
      title: srv.title,
      color: srv.color || '#10b981',
      distanceKm: srv.distanceKm || calculatePolylineKm(srv.points || []),
      durationSeconds: srv.durationSeconds || 0,
      startedAt: typeof srv.startedAt === 'number' ? srv.startedAt : new Date(srv.startedAt).getTime(),
      endedAt: typeof srv.endedAt === 'number' ? srv.endedAt : new Date(srv.endedAt).getTime(),
      points: srv.points || [],
      memories: srv.memories || [],
      isDemoRoute: srv.isDemoRoute,
      syncStatus: 'synced',
    };
    byId.set(merged.clientId, merged);
    await saveLocalTrack(merged, ownerKey);
  }

  return Array.from(byId.values()).sort((a, b) => b.startedAt - a.startedAt);
}

export function registerFootprintServiceWorker(): void {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw-footprints.js').catch(() => {
      // ignore in dev if sw is restricted
    });
  }
}

export interface PresetJourneyRoute {
  id: string;
  title: string;
  subtitle: string;
  color: string;
  waypoints: Array<{
    lat: number;
    lng: number;
    placeName?: string;
    emoji?: string;
    mood?: string;
    note?: string;
    imageUrl?: string;
  }>;
}

export const PRESET_DEMO_JOURNEYS: PresetJourneyRoute[] = [
  {
    id: 'demo-sa-dec-heritage',
    title: 'Hành trình Di sản & Hoa Sa Đéc',
    subtitle: 'Làng hoa Sa Đéc → Nhà cổ Huỳnh Thủy Lê → Chùa Ông Quách → Phố Hủ tiếu',
    color: '#10b981',
    waypoints: [
      {
        lat: 10.3125,
        lng: 105.7468,
        placeName: 'Làng hoa Sa Đéc (Tân Quy Đông)',
        emoji: '🌸',
        mood: 'Rực rỡ sắc hoa',
        note: 'Check-in giàn hoa cúc mâm xôi trên mặt nước cực đẹp!',
        imageUrl: '/images/destinations/sa-dec/lang-hoa-sa-dec.jpg',
      },
      { lat: 10.3078, lng: 105.7518 },
      { lat: 10.3016, lng: 105.7554 },
      { lat: 10.2966, lng: 105.7576 },
      {
        lat: 10.2923,
        lng: 105.7592,
        placeName: 'Nhà cổ Huỳnh Thủy Lê',
        emoji: '🏛️',
        mood: 'Hoài niệm Đông Dương',
        note: 'Nghe kể chuyện tình Người Tình bên kiến trúc Pháp - Hoa trăm tuổi.',
        imageUrl: '/images/destinations/sa-dec/nha-co-huynh-thuy-le.jpg',
      },
      { lat: 10.2931, lng: 105.7584 },
      {
        lat: 10.2941,
        lng: 105.7572,
        placeName: 'Kiến An Cung – Chùa Ông Quách',
        emoji: '🏮',
        mood: 'Tâm linh cổ kính',
        note: 'Kiến trúc chạm khắc gỗ tinh xảo tuyệt mỹ ngay trung tâm Sa Đéc.',
        imageUrl: '/images/destinations/sa-dec/kien-an-cung-chua-ong-quach.jpg',
      },
      { lat: 10.2916, lng: 105.7618 },
      {
        lat: 10.2896,
        lng: 105.7646,
        placeName: 'Phố Ẩm thực & Hủ tiếu Sa Đéc',
        emoji: '🍜',
        mood: 'Ngon xuất sắc',
        note: 'Thưởng thức tô hủ tiếu Bà Sẩm đậm đà chuẩn vị xứ bột!',
        imageUrl: '/images/destinations/sa-dec/hu-tieu-sa-dec-ba-sam.jpg',
      },
    ],
  },
  {
    id: 'demo-cao-lanh-lotus',
    title: 'Cung đường Sen Hồng Cao Lãnh – Xẻo Quýt',
    subtitle: 'Văn Thánh Miếu → Bảo tàng Đồng Tháp → Lăng Cụ Phó bảng → Rừng tràm Xẻo Quýt',
    color: '#0ea5e9',
    waypoints: [
      {
        lat: 10.4555,
        lng: 105.6375,
        placeName: 'Văn Thánh Miếu Cao Lãnh',
        emoji: '🪷',
        mood: 'Bình yên buổi sớm',
        note: 'Dạo bước bên hồ sen và đường sách trung tâm TP. Cao Lãnh.',
        imageUrl: '/images/destinations/cao-lanh/van-thanh-mieu-cao-lanh.jpg',
      },
      {
        lat: 10.4562,
        lng: 105.6324,
        placeName: 'Bảo tàng Tổng hợp Đồng Tháp',
        emoji: '🏺',
        mood: 'Khám phá văn hóa Óc Eo',
        note: 'Chiêm ngưỡng bộ sưu tập cổ vật vàng văn hóa Óc Eo quý giá.',
        imageUrl: '/images/destinations/cao-lanh/bao-tang-tong-hop-dong-thap.jpg',
      },
      { lat: 10.4521, lng: 105.6338 },
      {
        lat: 10.4491,
        lng: 105.6352,
        placeName: 'Khu di tích Cụ Phó bảng Nguyễn Sinh Sắc',
        emoji: '🙏',
        mood: 'Trang nghiêm & Tự hào',
        note: 'Viếng vòm mộ cánh sen trắng và thăm nhà sàn Bác Hồ.',
        imageUrl: '/images/destinations/cao-lanh/khu-di-tich-nguyen-sinh-sac.jpg',
      },
      { lat: 10.4435, lng: 105.668 },
      { lat: 10.4385, lng: 105.709 },
      {
        lat: 10.4317,
        lng: 105.7521,
        placeName: 'Khu di tích Xẻo Quýt',
        emoji: '🚣',
        mood: 'Xanh mát rừng tràm',
        note: 'Ngồi xuồng ba lá len lỏi dưới tán rừng tràm nguyên sinh.',
        imageUrl: '/images/destinations/cao-lanh/khu-di-tich-xeo-quyt.jpg',
      },
    ],
  },
  {
    id: 'demo-tram-chim-eco',
    title: 'Chinh phục Tràm Chim – Đồng Sen Tháp Mười',
    subtitle: 'Vườn quốc gia Tràm Chim → Gáo Giồng → Đồng sen Tháp Mười',
    color: '#f43f5e',
    waypoints: [
      {
        lat: 10.6749,
        lng: 105.5653,
        placeName: 'Vườn quốc gia Tràm Chim (Ramsar)',
        emoji: '🦩',
        mood: 'Thiên nhiên kỳ vĩ',
        note: 'Đi tắc ráng xuyên đồng nước nổi ngắm đàn chim trời bay rợp bóng.',
        imageUrl: '/images/destinations/tam-nong/vuon-quoc-gia-tram-chim.jpg',
      },
      { lat: 10.625, lng: 105.612 },
      { lat: 10.578, lng: 105.652 },
      {
        lat: 10.5318,
        lng: 105.6894,
        placeName: 'Khu du lịch sinh thái Gáo Giồng',
        emoji: '🌿',
        mood: 'Chill giữa ốc đảo xanh',
        note: 'Lên đài quan sát 18m ngắm toàn cảnh rừng tràm bạt ngàn.',
        imageUrl: '/images/destinations/cao-lanh/khu-du-lich-sinh-thai-gao-giong.jpg',
      },
      { lat: 10.548, lng: 105.735 },
      {
        lat: 10.5621,
        lng: 105.7812,
        placeName: 'Đồng sen Tháp Mười',
        emoji: '🌸',
        mood: 'Ngát hương Sen Hồng',
        note: 'Thưởng thức cá lóc nướng trui cuốn lá sen non giữa đồng sen.',
        imageUrl: '/images/destinations/thap-muoi/dong-sen-thap-muoi.jpg',
      },
    ],
  },
];

export function resolveStopPhoto(placeName?: string, existing?: string): string | undefined {
  if (existing) return existing;
  if (!placeName) return undefined;
  const lower = placeName.toLowerCase();
  for (const pr of PRESET_DEMO_JOURNEYS) {
    for (const wp of pr.waypoints) {
      if (wp.placeName && wp.imageUrl) {
        const key = wp.placeName.toLowerCase();
        if (key === lower || lower.includes(key.slice(0, 14)) || key.includes(lower.slice(0, 14))) {
          return wp.imageUrl;
        }
      }
    }
  }
  return undefined;
}

/** Interpolate smooth GPS points between waypoints for lifelike path drawing and replay */
export function interpolateWaypoints(
  waypoints: PresetJourneyRoute['waypoints'],
  stepsPerSegment: number = 8,
): { points: TrackPoint[]; memories: MemoryPin[] } {
  const now = Date.now();
  const points: TrackPoint[] = [];
  const memories: MemoryPin[] = [];
  let stepCounter = 0;

  for (let i = 0; i < waypoints.length; i++) {
    const cur = waypoints[i]!;
    if (cur.placeName && cur.emoji) {
      memories.push({
        clientId: `mem-${now}-${i}`,
        lat: cur.lat,
        lng: cur.lng,
        emoji: cur.emoji,
        moodLabel: cur.mood || 'Trải nghiệm tuyệt vời',
        note: cur.note || '',
        placeName: cur.placeName,
        imageUrl: cur.imageUrl,
        createdAt: now + stepCounter * 15000,
      });
    }

    if (i < waypoints.length - 1) {
      const next = waypoints[i + 1]!;
      for (let s = 0; s < stepsPerSegment; s++) {
        const ratio = s / stepsPerSegment;
        points.push({
          lat: Number((cur.lat + (next.lat - cur.lat) * ratio).toFixed(6)),
          lng: Number((cur.lng + (next.lng - cur.lng) * ratio).toFixed(6)),
          timestamp: now + stepCounter * 15000,
          speedKmh: 32 + Math.round(Math.sin(stepCounter) * 8),
        });
        stepCounter++;
      }
    } else {
      points.push({
        lat: cur.lat,
        lng: cur.lng,
        timestamp: now + stepCounter * 15000,
        speedKmh: 0,
      });
    }
  }

  return { points, memories };
}

/**
 * Snap preset waypoints onto real Đồng Tháp roads via OSRM when online so routes follow
 * actual highways, streets, and bridges instead of straight lines! Falls back smoothly offline.
 */
export async function resolveRoadSnappedJourney(
  waypoints: PresetJourneyRoute['waypoints'],
  online: boolean,
): Promise<{ points: TrackPoint[]; memories: MemoryPin[]; roadSnapped: boolean }> {
  const fallback = interpolateWaypoints(waypoints, 8);
  if (!online || waypoints.length < 2) {
    return { ...fallback, roadSnapped: false };
  }

  // Only route through meaningful named stops (or all waypoints if <= 6) so OSRM picks clean highways
  const named = waypoints.filter((w) => Boolean(w.placeName));
  const routeNodes = named.length >= 2 ? named : waypoints;
  const coordsParam = routeNodes.map((w) => `${w.lng.toFixed(6)},${w.lat.toFixed(6)}`).join(';');

  try {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 3800);
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${coordsParam}?overview=full&geometries=geojson`,
      { signal: ctrl.signal },
    );
    window.clearTimeout(timer);

    if (!res.ok) return { ...fallback, roadSnapped: false };
    const json = (await res.json()) as {
      routes?: Array<{ geometry?: { coordinates?: Array<[number, number]> } }>;
    };
    const rawCoords = json.routes?.[0]?.geometry?.coordinates;
    if (!rawCoords || rawCoords.length < 4) {
      return { ...fallback, roadSnapped: false };
    }

    // Downsample gracefully to ~70-110 smooth points so animation & IndexedDB storage stay super snappy
    const maxPts = 96;
    const stride = rawCoords.length > maxPts ? Math.ceil(rawCoords.length / maxPts) : 1;
    const now = Date.now();
    const points: TrackPoint[] = [];
    for (let i = 0; i < rawCoords.length; i += stride) {
      const [lng, lat] = rawCoords[i]!;
      points.push({
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6)),
        timestamp: now + points.length * 15000,
        speedKmh: 36,
      });
    }
    const [lastLng, lastLat] = rawCoords[rawCoords.length - 1]!;
    const lastPt = points[points.length - 1];
    if (!lastPt || lastPt.lat !== Number(lastLat.toFixed(6)) || lastPt.lng !== Number(lastLng.toFixed(6))) {
      points.push({
        lat: Number(lastLat.toFixed(6)),
        lng: Number(lastLng.toFixed(6)),
        timestamp: now + points.length * 15000,
        speedKmh: 0,
      });
    }

    return { points, memories: fallback.memories, roadSnapped: true };
  } catch {
    return { ...fallback, roadSnapped: false };
  }
}

/**
 * When recording on Mobile Web / PWA, locking the phone screen pauses browser GPS until the user reopens the app.
 * This helper detects large highway gaps (>= 1.0 km) between consecutive recorded points and smoothly bridges them
 * along real roads via OSRM when online so inter-provincial trips (e.g. Cần Thơ -> Sài Gòn) follow real highways.
 */
export async function bridgeTrackRoadGaps(
  rawPoints: TrackPoint[],
  online: boolean,
): Promise<{ points: TrackPoint[]; bridgedSegments: number }> {
  if (!online || rawPoints.length < 2) {
    return { points: rawPoints, bridgedSegments: 0 };
  }

  const MAX_GAPS_TO_BRIDGE = 10;
  const GAP_THRESHOLD_KM = 1.0;
  const MAX_TOTAL_POINTS = 1800;

  const result: TrackPoint[] = [rawPoints[0]!];
  let bridgedSegments = 0;

  for (let i = 1; i < rawPoints.length; i++) {
    const prev = rawPoints[i - 1]!;
    const curr = rawPoints[i]!;
    const distKm = haversineDistanceKm(prev, curr);

    if (distKm >= GAP_THRESHOLD_KM && distKm <= 450 && bridgedSegments < MAX_GAPS_TO_BRIDGE) {
      try {
        const ctrl = new AbortController();
        const timer = window.setTimeout(() => ctrl.abort(), 4500);
        const res = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${prev.lng.toFixed(6)},${prev.lat.toFixed(6)};${curr.lng.toFixed(6)},${curr.lat.toFixed(6)}?overview=simplified&geometries=geojson`,
          { signal: ctrl.signal },
        );
        window.clearTimeout(timer);
        if (res.ok) {
          const json = (await res.json()) as {
            routes?: Array<{ geometry?: { coordinates?: Array<[number, number]> } }>;
          };
          const coords = json.routes?.[0]?.geometry?.coordinates;
          if (coords && coords.length >= 3) {
            const maxSegPts = 80;
            const stride = coords.length > maxSegPts ? Math.ceil(coords.length / maxSegPts) : 1;
            const startTs = prev.timestamp;
            const spanTs = Math.max(1000, curr.timestamp - startTs);
            // Append interior bridged points (skip index 0 and last because prev/curr are already preserved)
            for (let j = stride; j < coords.length - 1; j += stride) {
              const [lng, lat] = coords[j]!;
              const ratio = j / (coords.length - 1);
              result.push({
                lat: Number(lat.toFixed(6)),
                lng: Number(lng.toFixed(6)),
                timestamp: Math.round(startTs + spanTs * ratio),
              });
            }
            bridgedSegments += 1;
          }
        }
      } catch {
        // Offline / OSRM timeout -> keep direct segment cleanly
      }
    }
    result.push(curr);
  }

  // Cap safely under MongoDB schema limit (2000)
  if (result.length > MAX_TOTAL_POINTS) {
    const stride = Math.ceil(result.length / MAX_TOTAL_POINTS);
    const compacted: TrackPoint[] = [];
    for (let i = 0; i < result.length; i += stride) {
      compacted.push(result[i]!);
    }
    const last = result[result.length - 1]!;
    if (compacted[compacted.length - 1] !== last) compacted.push(last);
    return { points: compacted, bridgedSegments };
  }

  return { points: result, bridgedSegments };
}
