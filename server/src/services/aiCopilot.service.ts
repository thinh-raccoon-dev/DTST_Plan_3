import { GoogleGenAI } from '@google/genai';
import { getAreaLabel } from '../config/catalog.js';
import { DestinationModel } from '../models/Destination.js';
import { resolveGeminiApiKey } from '../utils/geminiKey.js';
import { logger } from '../utils/logger.js';
import { normalizeText } from '../utils/text.js';

export interface CopilotDestinationInfo {
  id?: string;
  name: string;
  slug: string;
  summary?: string;
  category?: string;
  categoryLabel?: string;
  area?: string;
  distanceKm?: number;
  matchReason?: string;
  coordinates?: { lat: number; lng: number };
}

export interface DraftItineraryStopSnapshot {
  stopId?: string;
  placeId?: string;
  name: string;
  type?: string;
  start?: string;
  end?: string;
  lat?: number;
  lng?: number;
}

export interface DraftItineraryDaySnapshot {
  day: number;
  date?: string;
  stops: DraftItineraryStopSnapshot[];
}

export interface DraftItinerarySnapshot {
  title?: string;
  totalDays?: number;
  days: DraftItineraryDaySnapshot[];
}

export interface PendingSwapSnapshot {
  dayNumber: number;
  targetStopId?: string;
  targetStopName: string;
  candidates?: CopilotDestinationInfo[];
}

export interface SwapSelectionPayload {
  dayNumber: number;
  targetStopId?: string;
  targetStopName: string;
  criteriaLabel?: string;
  notFoundQuery?: string;
  candidates: CopilotDestinationInfo[];
}

export interface DomControlSnapshot {
  id: string;
  tag: string;
  label: string;
  type?: string;
  value?: string;
}

export interface PageContextSnapshot {
  currentPath?: string;
  pageTitle?: string;
  currentUser?: {
    displayName: string;
    email: string;
    role: string;
  } | null;
  hasDraftItinerary?: boolean;
  draftTitle?: string;
  draftItinerary?: DraftItinerarySnapshot | null;
  pendingSwap?: PendingSwapSnapshot | null;
  lastDiscussedDestination?: CopilotDestinationInfo | null;
  controls?: DomControlSnapshot[];
}

export interface DomAutomationStep {
  op: 'click' | 'fill' | 'scroll';
  targetId?: string;
  targetText?: string;
  value?: string;
}

export interface CopilotAction {
  type:
    | 'NAVIGATE'
    | 'FILTER'
    | 'OPEN_PAGE'
    | 'PLAN_ITINERARY'
    | 'REGISTER_ACCOUNT'
    | 'LOGIN_ACCOUNT'
    | 'LOGOUT_ACCOUNT'
    | 'UPDATE_PROFILE'
    | 'SAVE_ITINERARY'
    | 'TOGGLE_FAVORITE'
    | 'SYNC_PASSPORT'
    | 'SWAP_ITINERARY_STOP'
    | 'CHOOSE_SWAP_CANDIDATE'
    | 'ADD_ITINERARY_STOP'
    | 'REMOVE_ITINERARY_STOP'
    | 'DOM_AUTOMATION'
    | 'ASK_CLARIFICATION'
    | 'SECURITY_BLOCKED';
  payload: {
    path?: string;
    label?: string;
    params?: Record<string, string>;
    // PLAN_ITINERARY
    days?: number;
    people?: number;
    budgetVnd?: number;
    goal?: string;
    // REGISTER_ACCOUNT / LOGIN_ACCOUNT
    email?: string;
    password?: string;
    displayName?: string;
    // UPDATE_PROFILE
    newDisplayName?: string;
    currentPassword?: string;
    newPassword?: string;
    preferences?: {
      numberOfDays?: number;
      hoursPerDay?: number;
      areas?: string[];
      interests?: string[];
    };
    // SAVE_ITINERARY
    itineraryTitle?: string;
    // TOGGLE_FAVORITE
    destinationId?: string;
    destinationSlug?: string;
    destinationName?: string;
    favoriteMode?: 'add' | 'remove';
    // SWAP_ITINERARY_STOP / CHOOSE_SWAP_CANDIDATE / REMOVE_ITINERARY_STOP
    dayNumber?: number;
    targetStopId?: string;
    targetStopName?: string;
    newDestination?: CopilotDestinationInfo;
    swapSelection?: SwapSelectionPayload;
    // DOM_AUTOMATION (Future-proof Universal UI Controller)
    domSteps?: DomAutomationStep[];
    // ASK_CLARIFICATION / SECURITY_BLOCKED
    missingFields?: string[];
    contextType?:
      | 'itinerary'
      | 'register'
      | 'login'
      | 'swap_stop'
      | 'update_profile'
      | 'change_password'
      | 'general';
    securityReason?: string;
  };
}

export interface CopilotResponse {
  reply: string;
  action?: CopilotAction;
  suggestions?: string[];
  matchedDestinations?: CopilotDestinationInfo[];
}

interface DestinationSummary {
  id: string;
  name: string;
  slug: string;
  summary: string;
  description: string;
  category: string;
  area: string;
  areaSlug: string;
  tags: string[];
  address: string;
  openingHours: string;
  referencePrice: string;
  coordinates?: { lat: number; lng: number };
}

const CATEGORY_LABELS: Record<string, string> = {
  nature: 'Thiên nhiên',
  eco: 'Sinh thái',
  culture: 'Văn hóa',
  history: 'Lịch sử',
  food: 'Ẩm thực',
  local_experience: 'Trải nghiệm địa phương',
};

function formatAreaLabel(areaSlug?: string): string {
  if (!areaSlug) return 'Đồng Tháp';
  return getAreaLabel(areaSlug);
}

function formatCategoryLabel(cat?: string): string {
  if (!cat) return 'Khám phá';
  return CATEGORY_LABELS[cat] || cat;
}

let cachedDestinations: DestinationSummary[] = [];
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000;

async function getDestinationsCatalog(): Promise<DestinationSummary[]> {
  const now = Date.now();
  const ttl = process.env.NODE_ENV === 'test' ? 0 : CACHE_TTL_MS;
  if (ttl > 0 && cachedDestinations.length > 0 && now - cacheTimestamp < ttl) {
    return cachedDestinations;
  }
  try {
    const list = await DestinationModel.find({ publicationStatus: 'published' })
      .select(
        '_id name slug summary description category area tags address openingHours referencePrice coordinates',
      )
      .lean();
    cachedDestinations = list.map((d) => ({
      id: String(d._id),
      name: d.name,
      slug: d.slug,
      summary: d.summary || '',
      description: d.description || '',
      category: d.category || '',
      areaSlug: d.area || '',
      area: formatAreaLabel(d.area),
      tags: Array.isArray(d.tags) ? d.tags : [],
      address: d.address || '',
      openingHours: d.openingHours || '',
      referencePrice: d.referencePrice || '',
      coordinates:
        d.coordinates && typeof d.coordinates.lat === 'number' && typeof d.coordinates.lng === 'number'
          ? { lat: d.coordinates.lat, lng: d.coordinates.lng }
          : undefined,
    }));
    cacheTimestamp = now;
    return cachedDestinations;
  } catch (err) {
    logger.error({ err }, 'Failed to load destinations for AI catalog');
    return cachedDestinations;
  }
}

const DESTINATION_ALIASES: Array<{
  keywords: string[];
  slug: string;
  name: string;
  area: string;
  coordinates: { lat: number; lng: number };
}> = [
  {
    keywords: ['bao tang dong thap', 'bao tang tong hop dong thap', 'bao tang tong hop'],
    slug: 'bao-tang-tong-hop-dong-thap',
    name: 'Bảo tàng Tổng hợp Đồng Tháp',
    area: 'Cao Lãnh',
    coordinates: { lat: 10.4562, lng: 105.6324 },
  },
  {
    keywords: ['fpt', 'dai hoc fpt', 'fpt can tho', 'campus can tho'],
    slug: 'dai-hoc-fpt-campus-can-tho',
    name: 'Đại học FPT Campus Cần Thơ',
    area: 'Cần Thơ',
    coordinates: { lat: 10.0124, lng: 105.7324 },
  },
  {
    keywords: ['lang hoa sa dec', 'tan quy dong'],
    slug: 'lang-hoa-sa-dec',
    name: 'Làng hoa Sa Đéc (Tân Quy Đông)',
    area: 'Sa Đéc',
    coordinates: { lat: 10.3125, lng: 105.7468 },
  },
  {
    keywords: ['tram chim', 'vuon quoc gia tram chim'],
    slug: 'vuon-quoc-gia-tram-chim',
    name: 'Vườn quốc gia Tràm Chim',
    area: 'Tam Nông',
    coordinates: { lat: 10.6749, lng: 105.5653 },
  },
  {
    keywords: ['xeo quyt', 'khu di tich xeo quyt'],
    slug: 'khu-di-tich-xeo-quyt',
    name: 'Khu di tích Xẻo Quýt',
    area: 'Cao Lãnh',
    coordinates: { lat: 10.4317, lng: 105.7521 },
  },
  {
    keywords: ['nha co huynh thuy le', 'huynh thuy le'],
    slug: 'nha-co-huynh-thuy-le',
    name: 'Nhà cổ Huỳnh Thủy Lê',
    area: 'Sa Đéc',
    coordinates: { lat: 10.2923, lng: 105.7592 },
  },
  {
    keywords: ['chua ong quach', 'kien an cung', 'chua kien an cung'],
    slug: 'kien-an-cung-chua-ong-quach',
    name: 'Kiến An Cung – Chùa Ông Quách',
    area: 'Sa Đéc',
    coordinates: { lat: 10.2935, lng: 105.7579 },
  },
  {
    keywords: ['chua phước kien', 'chua phuoc kien', 'chua la sen', 'la sen vua'],
    slug: 'chua-phuoc-kien-la-sen-vua',
    name: 'Chùa Phước Kiển (Chùa Lá Sen Vua)',
    area: 'Sa Đéc',
    coordinates: { lat: 10.2468, lng: 105.8142 },
  },
  {
    keywords: ['nguyen sinh sac', 'lang cu pho bang', 'khu di tich nguyen sinh sac'],
    slug: 'khu-di-tich-nguyen-sinh-sac',
    name: 'Khu di tích Cụ Phó bảng Nguyễn Sinh Sắc',
    area: 'Cao Lãnh',
    coordinates: { lat: 10.4491, lng: 105.6352 },
  },
  {
    keywords: ['khu du lich phuong nam', 'van hoa phuong nam', 'nam phuong'],
    slug: 'khu-du-lich-van-hoa-phuong-nam',
    name: 'Khu du lịch Văn hóa Phương Nam',
    area: 'Lấp Vò',
    coordinates: { lat: 10.3401, lng: 105.6122 },
  },
  {
    keywords: ['go thap', 'khu di tich go thap'],
    slug: 'khu-di-tich-go-thap',
    name: 'Khu di tích Gò Tháp',
    area: 'Tháp Mười',
    coordinates: { lat: 10.5882, lng: 105.8021 },
  },
  {
    keywords: ['gao giong', 'khu du lich sinh thai gao giong'],
    slug: 'khu-du-lich-sinh-thai-gao-giong',
    name: 'Khu du lịch sinh thái Gáo Giồng',
    area: 'Cao Lãnh',
    coordinates: { lat: 10.5318, lng: 105.6894 },
  },
  {
    keywords: ['dong sen thap muoi'],
    slug: 'dong-sen-thap-muoi',
    name: 'Đồng sen Tháp Mười',
    area: 'Tháp Mười',
    coordinates: { lat: 10.5621, lng: 105.7812 },
  },
  {
    keywords: ['trai ran dong tam'],
    slug: 'trai-ran-dong-tam',
    name: 'Trại Rắn Đồng Tâm (Trung tâm Dược liệu Quân khu 9)',
    area: 'Mỹ Tho',
    coordinates: { lat: 10.3561, lng: 106.3012 },
  },
];

const GENERIC_CATEGORY_NOUNS = new Set([
  'chua',
  'cac chua',
  'ngoi chua',
  'bao tang',
  'cac bao tang',
  'di tich',
  'khu di tich',
  'nha co',
  'lang hoa',
  'lang nghe',
  'cho',
  'cho dem',
  'vuon',
  'vuon trai cay',
  'khu du lich',
  'sinh thai',
  'van hoa',
  'lich su',
  'am thuc',
  'thien nhien',
  'trai nghiem',
  'quan an',
  'nha hang',
  'hu tieu',
  'banh xeo',
  'ca loc',
  'dong sen',
  'sen',
  'cu lao',
  'con',
  'bien',
  'bai bien',
  'nui',
  'trong nha',
  'mai che',
  'an uong',
  'tam linh',
  'diem khac',
  'dia diem khac',
  'cho khac',
  'noi khac',
  'diem moi',
  'dia diem moi',
  'cho moi',
  'bat ky',
  'tuy ban',
  'ngau nhien',
  'diem nao do',
  'dia diem nao do',
  'cho nao do',
  'noi nao do',
  'cho nao dep',
  'cho nao hay',
  'diem nao hay',
  'gan hon',
  'dep hon',
  'hay hon',
  'do met',
  'cao lanh',
  'sa dec',
  'thap muoi',
  'tam nong',
  'lai vung',
  'hong ngu',
  'my tho',
  'cai be',
  'thoi son',
  'can tho',
  'vinh long',
]);

const VAGUE_PLACEHOLDER_PATTERN =
  /^(?:mot\s+|1\s+|cai\s+|cac\s+)?(?:dia\s+diem|diem|cho|noi|quan|khu)\s+(?:khac|moi|nao\s+do|nao\s+khac|nao\s+dep|nao\s+hay|nao\s+gan|bat\s+ky|ngau\s+nhien|tuy\s+y|tuy\s+ban|thien\s+nhien|sinh\s+thai|van\s+hoa|lich\s+su|am\s+thuc|an\s+uong|tam\s+linh|trai\s+nghiem|trong\s+nha|chup\s+anh|song\s+ao|thu\s+gian|vui\s+choi|mat\s+me|gan\s+hon|dep\s+hon|hay\s+hon)|^(?:khac|cho\s+khac|noi\s+khac|diem\s+khac|gi\s+do|tuy\s+ban|tuy\s+meko|ngau\s+nhien|bat\s+ky|goi\s+y|de\s+xuat)/;

function haversineRoadKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const straight = 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(straight * 1.25 * 10) / 10;
}

function toCopilotDestinationInfo(
  item: DestinationSummary,
  extra?: { distanceKm?: number; matchReason?: string },
): CopilotDestinationInfo {
  return {
    id: item.id,
    name: item.name,
    slug: item.slug,
    summary: item.summary,
    category: item.category,
    categoryLabel: formatCategoryLabel(item.category),
    area: item.area,
    distanceKm: extra?.distanceKm,
    matchReason: extra?.matchReason,
    coordinates: item.coordinates || { lat: 10.4562, lng: 105.6324 },
  };
}

function stripConversationalEdges(norm: string): string {
  return norm
    .replace(
      /^(?:day\s+ne|nay\s+ne|ua\s+|ok\s+|vang\s+|da\s+)?(?:mo|xem|chi tiet|gioi thieu|tham quan|di|den|ghe|diem|dia diem|luu|them|bo|xoa|chon|lay|doi sang|doi qua|thay sang|thay qua|chuyen sang|chuyen qua)\s+/g,
      '',
    )
    .replace(
      /\s+(vao|khoi|trong)?\s*(danh sach\s+|bo suu tap\s+)?(dia diem\s+)?yeu thich(\s+cua toi|\s+giup toi|\s+nhe)?$/g,
      '',
    )
    .replace(/^(yeu thich|bo yeu thich|luu yeu thich)\s+/g, '')
    .replace(/\s+(nhe|nha|di|luon|giup|voi|a|nhen|ne|ngay)$/g, '')
    .trim();
}

function findDestinationByText(text: string, catalog: DestinationSummary[]): CopilotDestinationInfo | null {
  const norm = stripConversationalEdges(normalizeText(text));
  if (!norm || GENERIC_CATEGORY_NOUNS.has(norm) || VAGUE_PLACEHOLDER_PATTERN.test(norm)) return null;

  for (const alias of DESTINATION_ALIASES) {
    if (alias.keywords.some((kw) => norm.includes(kw))) {
      const dbMatch = catalog.find((c) => c.slug === alias.slug);
      // Only return destinations that genuinely exist in the live DB catalog (or match a known alias when DB has it)
      if (dbMatch) {
        return toCopilotDestinationInfo(dbMatch);
      }
      if (catalog.length === 0) {
        return {
          name: alias.name,
          slug: alias.slug,
          summary: `Địa điểm nổi bật tại ${alias.area}`,
          category: 'culture',
          categoryLabel: 'Văn hóa',
          area: alias.area,
          coordinates: alias.coordinates,
        };
      }
    }
  }

  // Exact or substring match against real catalog items (prefer longest name match first)
  const sortedCatalog = [...catalog].sort((a, b) => b.name.length - a.name.length);
  for (const item of sortedCatalog) {
    const itemNorm = normalizeText(item.name);
    const slugNorm = normalizeText(item.slug.replace(/-/g, ' '));
    if (
      norm === itemNorm ||
      norm === slugNorm ||
      norm.includes(itemNorm) ||
      norm.includes(slugNorm) ||
      (norm.length >= 8 && !GENERIC_CATEGORY_NOUNS.has(norm) && itemNorm.includes(norm))
    ) {
      return toCopilotDestinationInfo(item);
    }
  }

  // Token-overlap fuzzy match (strict threshold to prevent false positives on vague words)
  const queryTokens = norm
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !['diem', 'dia', 'khu', 'du', 'lich', 'tham', 'quan', 'tai', 'o', 'mot', 'cai', 'di', 'sang', 'thanh'].includes(w));

  if (queryTokens.length >= 2) {
    let best: { item: DestinationSummary; score: number } | null = null;
    for (const item of catalog) {
      const nameNorm = normalizeText(item.name);
      const nameTokens = new Set(nameNorm.split(/\s+/).filter((w) => w.length >= 2));
      const matchedCount = queryTokens.filter((t) => nameTokens.has(t) || nameNorm.includes(t)).length;
      const queryCoverage = matchedCount / queryTokens.length;
      const nameCoverage = matchedCount / Math.max(1, nameTokens.size);
      const score = queryCoverage * 0.72 + nameCoverage * 0.28;
      if (queryCoverage >= 0.8 && matchedCount >= 2 && score >= 0.72) {
        if (!best || score > best.score) {
          best = { item, score };
        }
      }
    }
    if (best) {
      return toCopilotDestinationInfo(best.item);
    }
  }

  return null;
}

/**
 * ============================================================================
 * MULTI-LAYER SECURITY GUARDRAIL ENGINE (Rào chắn Bảo mật Đa tầng)
 * ============================================================================
 * Prevents credential disclosure, admin password leaks, API key exfiltration,
 * privilege escalation, and unauthorized destructive operations.
 */
function evaluateSecurityGuardrails(
  message: string,
  pageContext?: PageContextSnapshot,
): CopilotResponse | null {
  const norm = normalizeText(message);
  const cleanNorm = norm.replace(/[_.-]+/g, ' ');

  // 1. Protect Admin / Other Users' Passwords, Credentials, Secrets, API Keys, DB URIs
  const asksForAdminOrSecret =
    ((cleanNorm.includes('mat khau') ||
      cleanNorm.includes('pass') ||
      cleanNorm.includes('mk') ||
      cleanNorm.includes('tai khoan')) &&
      (cleanNorm.includes('admin') ||
        cleanNorm.includes('quan tri') ||
        cleanNorm.includes('nguoi khac') ||
        cleanNorm.includes('user khac') ||
        cleanNorm.includes('he thong') ||
        cleanNorm.includes('database') ||
        cleanNorm.includes('tat ca'))) ||
    cleanNorm.includes('api key') ||
    cleanNorm.includes('gemini api key') ||
    cleanNorm.includes('gemini key') ||
    cleanNorm.includes('jwt secret') ||
    cleanNorm.includes('mongodb uri') ||
    cleanNorm.includes('chuoi ket noi') ||
    cleanNorm.includes('file env') ||
    norm.includes('.env') ||
    cleanNorm.includes('system prompt') ||
    cleanNorm.includes('hack ') ||
    cleanNorm.includes('chiem quyen') ||
    cleanNorm.includes('nang quyen admin') ||
    cleanNorm.includes('xoa database') ||
    cleanNorm.includes('drop database');

  if (asksForAdminOrSecret) {
    return {
      reply:
        `🛡️ **Rào chắn Bảo mật (Security Guardrail) đã kích hoạt!**\n\n` +
        `Pé Meko **từ chối thực hiện** yêu cầu này vì vi phạm chính sách an toàn thông tin của hệ thống:\n` +
        `• 🔒 **Bảo vệ thông tin nhạy cảm**: Tuyệt đối không tiết lộ mật khẩu Quản trị viên (` +
        `Admin), mật khẩu của tài khoản khác, khóa \`GEMINI_API_KEY\`, \`JWT_SECRET\` hoặc cấu hình cơ sở dữ liệu.\n` +
        `• 🚫 **Chống leo thang đặc quyền**: Không cho phép tự ý truy xuất hoặc can thiệp trái phép vào dữ liệu hệ thống.\n\n` +
        `Pé Meko chỉ hỗ trợ điều khiển các tính năng hợp lệ trong phạm vi quyền tài khoản hiện tại của bạn thôi nhé! 🦊🛡️`,
      action: {
        type: 'SECURITY_BLOCKED',
        payload: {
          label: '🛡️ Đã chặn yêu cầu vi phạm bảo mật',
          securityReason: 'CREDENTIAL_AND_SECRET_PROTECTION',
        },
      },
      suggestions: [
        'Dự án này là gì và có những tính năng nào?',
        'Mở trang cá nhân của tôi',
        'Lập lịch trình đi 2 ngày cho 2 người với chi phí 2 tr',
      ],
    };
  }

  // 2. Role-Based Access Control (RBAC) for Admin Dashboard & Staff Operations
  const asksForAdminPanel =
    cleanNorm.includes('vao trang admin') ||
    cleanNorm.includes('mo trang admin') ||
    cleanNorm.includes('mo trang quan tri') ||
    cleanNorm.includes('vao trang quan tri') ||
    cleanNorm.includes('truy cap trang quan tri') ||
    cleanNorm.includes('truy cap admin') ||
    norm.includes('/admin') ||
    cleanNorm.includes('xoa dia diem trong he thong') ||
    cleanNorm.includes('duyet dia diem') ||
    cleanNorm.includes('quan ly nguoi dung');

  if (asksForAdminPanel) {
    const userRole = pageContext?.currentUser?.role;
    if (userRole !== 'admin' && userRole !== 'partner') {
      return {
        reply:
          `🛡️ **Rào chắn Phân quyền (RBAC Guardrail):**\n\n` +
          `Tài khoản hiện tại của bạn (${pageContext?.currentUser ? `\`${pageContext.currentUser.email}\` · quyền **Du khách**` : '**Khách chưa đăng nhập**'}) **không có quyền Quản trị viên (Admin)** để truy cập bảng điều khiển quản trị hoặc chỉnh sửa dữ liệu gốc của hệ thống.\n\n` +
          `Bạn có thể nhờ Pé Meko điều khiển mọi tính năng dành cho Du khách (Hồ sơ cá nhân, Đổi tên hiển thị, Lập lịch trình, Hộ chiếu số, Điểm yêu thích) nhé! 🦊`,
        action: {
          type: 'SECURITY_BLOCKED',
          payload: {
            label: '🛡️ Chặn truy cập trái thẩm quyền (RBAC)',
            securityReason: 'INSUFFICIENT_ROLE_PRIVILEGE',
          },
        },
        suggestions: [
          'Mở trang cá nhân (/account)',
          'Xem Hộ chiếu trải nghiệm số',
          'Danh sách các chùa nổi tiếng',
        ],
      };
    }
  }

  return null;
}

/**
 * Extracts itinerary slots (days, people, budgetVnd) from text.
 */
function extractItinerarySlots(text: string): {
  days?: number;
  people?: number;
  budgetVnd?: number;
} {
  const daysMatch = text.match(/(\d+)\s*ng[àa]y/i);
  const peopleMatch = text.match(/(\d+)\s*(?:ng[ưươ]?[ờo]i|kh[áa]ch|b[ạa]n|th[àa]nh vi[êe]n)/i);
  const budgetTrMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(?:tr(?:i[eệ]u)?|m|c[ủu])\b/i);
  const budgetKMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(?:k|ngh[ìi]n|ng[àa]n)\b/i);
  const budgetRawMatch = text.match(/(\d{6,9})\s*(?:đ|vnd|đồng)?\b/i);

  let days: number | undefined;
  if (daysMatch && daysMatch[1]) {
    days = Math.min(7, Math.max(1, Number(daysMatch[1])));
  }

  let people: number | undefined;
  if (peopleMatch && peopleMatch[1]) {
    people = Math.min(100, Math.max(1, Number(peopleMatch[1])));
  } else if (/c[ặa]p\s*đ[ôo]i|2\s*đ[ứu]a|hai\s*ng[ưươ][ờo]i/i.test(text)) {
    people = 2;
  } else if (/m[ộo]t\s*m[ìi]nh|1\s*m[ìi]nh|đ[ộo]c\s*h[àa]nh/i.test(text)) {
    people = 1;
  }

  let budgetVnd: number | undefined;
  if (budgetTrMatch && budgetTrMatch[1]) {
    budgetVnd = Math.round(Number(budgetTrMatch[1].replace(',', '.')) * 1_000_000);
  } else if (budgetKMatch && budgetKMatch[1]) {
    budgetVnd = Math.round(Number(budgetKMatch[1].replace(',', '.')) * 1_000);
  } else if (budgetRawMatch && budgetRawMatch[1]) {
    budgetVnd = Number(budgetRawMatch[1]);
  }

  return { days, people, budgetVnd };
}

/**
 * Extracts email and password from text for account registration / login.
 */
function extractAuthSlots(text: string): {
  email?: string;
  password?: string;
  displayName?: string;
} {
  const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
  const email = emailMatch?.[1]?.trim().toLowerCase();

  let password: string | undefined;
  const passPatterns = [
    /(?:m[ậa]t\s*kh[ẩa]u|mk|pass(?:word)?|pw)\s*(?:l[àa]|:|=)?\s*([^\s,;]+)/i,
    /&\s*(?:mk|pass(?:word)?|m[ậa]t\s*kh[ẩa]u)?\s*:?\s*([^\s,;]+)/i,
  ];
  for (const regex of passPatterns) {
    const m = text.match(regex);
    if (m && m[1] && !m[1].includes('@')) {
      password = m[1].trim();
      break;
    }
  }

  if (!password && !email) {
    const bareToken = text.trim().match(/^([a-zA-Z0-9@#$%^&+=._-]{6,32})$/);
    if (bareToken?.[1]) {
      password = bareToken[1];
    }
  }

  const nameMatch = text.match(/(?:t[êe]n(?:\s*hi[ểe]n\s*th[ịi])?|name)\s*(?:l[àa]|:|=)\s*([^,&\n]+)/i);
  const displayName = nameMatch?.[1]?.trim();

  return { email, password, displayName };
}

interface SwapCriteria {
  categories: string[];
  topic?:
    | 'chua'
    | 'bao_tang'
    | 'nha_co'
    | 'lang_hoa'
    | 'dong_sen'
    | 'vuon_trai_cay'
    | 'bien'
    | 'nui'
    | 'cho'
    | 'indoor';
  areaSlug?: string;
  areaLabel?: string;
  preferNear?: boolean;
  criteriaLabel?: string;
  hasExplicitCriteria: boolean;
}

const SWAP_AREA_OPTIONS: Array<{ kw: string; slug: string; label: string }> = [
  { kw: 'cao lanh', slug: 'cao-lanh', label: 'Cao Lãnh' },
  { kw: 'sa dec', slug: 'sa-dec', label: 'Sa Đéc' },
  { kw: 'thap muoi', slug: 'thap-muoi', label: 'Tháp Mười' },
  { kw: 'tam nong', slug: 'tam-nong', label: 'Tam Nông' },
  { kw: 'lai vung', slug: 'lai-vung', label: 'Lai Vung' },
  { kw: 'hong ngu', slug: 'hong-ngu', label: 'Hồng Ngự' },
  { kw: 'my tho', slug: 'my-tho', label: 'Mỹ Tho' },
  { kw: 'cai be', slug: 'cai-be', label: 'Cái Bè' },
  { kw: 'thoi son', slug: 'thoi-son', label: 'Cù lao Thới Sơn' },
  { kw: 'can tho', slug: 'can-tho', label: 'Cần Thơ' },
  { kw: 'vinh long', slug: 'vinh-long', label: 'Vĩnh Long' },
  { kw: 'lap vo', slug: 'lap-vo', label: 'Lấp Vò' },
  { kw: 'chau thanh', slug: 'chau-thanh', label: 'Châu Thành' },
];

function hasVietnameseDiacritics(text: string): boolean {
  return /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i.test(text);
}

function hasAccentedWord(rawLower: string, accentedWord: string): boolean {
  const escaped = accentedWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    `(?:^|[\\s,.;:!?()\\[\\]"'“”/\\-])${escaped}(?:$|[\\s,.;:!?()\\[\\]"'“”/\\-])`,
    'i',
  ).test(rawLower);
}

function extractSwapCriteria(text: string): SwapCriteria {
  const rawLower = text.toLowerCase();
  const hasDiacritics = hasVietnameseDiacritics(rawLower);
  const norm = normalizeText(text);
  const categories: string[] = [];
  let topic: SwapCriteria['topic'];
  let areaSlug: string | undefined;
  let areaLabel: string | undefined;
  const labelParts: string[] = [];

  const mentionsForest =
    hasAccentedWord(rawLower, 'rừng') ||
    norm.includes('rung tram') ||
    norm.includes('vuon quoc gia') ||
    (!hasDiacritics && /\brung\b/.test(norm));

  if (
    norm.includes('thien nhien') ||
    norm.includes('hoang so') ||
    norm.includes('canh dep') ||
    mentionsForest ||
    norm.includes('san may')
  ) {
    categories.push('nature', 'eco');
    labelParts.push('Thiên nhiên & Sinh thái');
  } else if (
    norm.includes('sinh thai') ||
    norm.includes('song nuoc') ||
    norm.includes('mat me') ||
    norm.includes('dong que') ||
    norm.includes('thu gian') ||
    norm.includes('cu lao')
  ) {
    categories.push('eco', 'nature');
    labelParts.push('Sinh thái & Sông nước');
  }

  if (
    norm.includes('am thuc') ||
    norm.includes('an uong') ||
    norm.includes('quan an') ||
    norm.includes('nha hang') ||
    norm.includes('dac san') ||
    norm.includes('mon ngon') ||
    norm.includes('an trua') ||
    norm.includes('an toi') ||
    norm.includes('an sang') ||
    norm.includes('hu tieu') ||
    norm.includes('banh xeo') ||
    norm.includes('ca loc')
  ) {
    categories.push('food');
    labelParts.push('Ẩm thực & Đặc sản');
  }

  if (norm.includes('lich su') || norm.includes('di tich') || norm.includes('chien khu')) {
    categories.push('history', 'culture');
    labelParts.push('Lịch sử & Di tích');
  } else if (norm.includes('van hoa') || norm.includes('tam linh') || norm.includes('kien truc')) {
    categories.push('culture');
    labelParts.push('Văn hóa & Tâm linh');
  }

  if (
    norm.includes('trai nghiem') ||
    norm.includes('lang nghe') ||
    norm.includes('check in') ||
    norm.includes('chup anh') ||
    norm.includes('chup hinh') ||
    norm.includes('song ao')
  ) {
    categories.push('local_experience');
    labelParts.push('Trải nghiệm & Check-in');
  }

  // Specific sub-topics (diacritic-safe to prevent Vietnamese homograph bugs:
  // "chưa" ≠ "chùa", "cho/chỗ" ≠ "chợ", "biến/biên" ≠ "biển", "núi" vs unaccented)
  const mentionsPagoda =
    hasAccentedWord(rawLower, 'chùa') ||
    norm.includes('co tu') ||
    norm.includes('thien vien') ||
    norm.includes('ngoi chua') ||
    norm.includes('cac chua') ||
    norm.includes('danh sach chua') ||
    norm.includes('chua co') ||
    (!hasDiacritics &&
      /\bchua\b/.test(norm) &&
      !/\bchua\s+(?:di|co|biet|tung|muon|thay|chon|doi|den|ghe)\b/.test(norm));

  const mentionsSea =
    hasAccentedWord(rawLower, 'biển') ||
    norm.includes('bai bien') ||
    norm.includes('du lich bien') ||
    (!hasDiacritics && /\bbien\b/.test(norm));

  const mentionsMountain =
    hasAccentedWord(rawLower, 'núi') ||
    norm.includes('leo nui') ||
    norm.includes('doi nui') ||
    norm.includes('khu du lich nui') ||
    norm.includes('san may') ||
    (!hasDiacritics && /\bnui\b/.test(norm));

  const mentionsMarket =
    hasAccentedWord(rawLower, 'chợ') ||
    norm.includes('cho dem') ||
    norm.includes('cho noi') ||
    norm.includes('cho am thuc') ||
    norm.includes('cho my tho') ||
    norm.includes('cho sa dec') ||
    (!hasDiacritics &&
      (norm.includes('khu cho') ||
        (/\bdi\s+cho\b/.test(norm) &&
          !/\bdi\s+cho\s+(?:nao|khac|do|nay|kia|dep|gan|mat|thien|sinh|am|van)\b/.test(norm))));

  if (mentionsPagoda) {
    topic = 'chua';
    labelParts.push('Chùa & Tâm linh');
  } else if (norm.includes('bao tang')) {
    topic = 'bao_tang';
    labelParts.push('Bảo tàng');
  } else if (norm.includes('nha co')) {
    topic = 'nha_co';
    labelParts.push('Nhà cổ di sản');
  } else if (norm.includes('lang hoa') || norm.includes('vuon hoa')) {
    topic = 'lang_hoa';
    labelParts.push('Làng hoa');
  } else if (norm.includes('dong sen') || norm.includes('hoa sen')) {
    topic = 'dong_sen';
    labelParts.push('Đồng sen');
  } else if (norm.includes('vuon trai cay') || norm.includes('miet vuon') || norm.includes('hai trai')) {
    topic = 'vuon_trai_cay';
    labelParts.push('Miệt vườn trái cây');
  } else if (mentionsSea) {
    topic = 'bien';
    if (!categories.includes('nature')) categories.push('nature');
    labelParts.push('Biển');
  } else if (mentionsMountain) {
    topic = 'nui';
    if (!categories.includes('nature')) categories.push('nature');
    labelParts.push('Núi non');
  } else if (mentionsMarket) {
    topic = 'cho';
    labelParts.push('Chợ & Phố đêm');
  } else if (
    norm.includes('trong nha') ||
    norm.includes('mai che') ||
    norm.includes('tranh mua') ||
    norm.includes('tranh nang')
  ) {
    topic = 'indoor';
    labelParts.push('Trong nhà / Có mái che');
  }

  for (const a of SWAP_AREA_OPTIONS) {
    if (norm.includes(a.kw)) {
      areaSlug = a.slug;
      areaLabel = a.label;
      labelParts.push(`Khu vực ${a.label}`);
      break;
    }
  }

  const preferNear =
    norm.includes('gan hon') ||
    norm.includes('gan nhat') ||
    norm.includes('gan do') ||
    norm.includes('gan tuyen') ||
    norm.includes('thuan tuyen') ||
    norm.includes('do met') ||
    norm.includes('it di chuyen');

  if (preferNear) {
    labelParts.push('Gần tuyến đường nhất');
  }

  const dedupLabels = Array.from(new Set(labelParts));
  const hasExplicitCriteria = Boolean(categories.length > 0 || topic || areaSlug || preferNear);

  return {
    categories: Array.from(new Set(categories)),
    topic,
    areaSlug,
    areaLabel,
    preferNear,
    criteriaLabel: dedupLabels.length > 0 ? dedupLabels.join(' · ') : undefined,
    hasExplicitCriteria,
  };
}

interface ResolvedDraftStop {
  dayNumber: number;
  stopId?: string;
  stopName: string;
  refCoords?: { lat: number; lng: number };
  existingStopNamesNorm: Set<string>;
}

function getAllExistingStopNamesNorm(draft?: DraftItinerarySnapshot | null): Set<string> {
  const set = new Set<string>();
  if (!draft?.days) return set;
  for (const d of draft.days) {
    for (const s of d.stops || []) {
      if (s.name) set.add(normalizeText(s.name));
      if (s.placeId && s.placeId.length >= 5) set.add(normalizeText(s.placeId.replace(/-/g, ' ')));
    }
  }
  return set;
}

function normalizeStopCore(name: string): string {
  return normalizeText(name)
    .replace(/\([^)]*\)/g, ' ')
    .replace(/^(?:an\s+(?:sang|trua|toi)\s*[-–—:]?\s*)/i, '')
    .replace(
      /^(?:diem\s+du\s+lich\s+sinh\s+thai|khu\s+du\s+lich\s+sinh\s+thai|khu\s+du\s+lich|diem\s+du\s+lich|nha\s+hang\s+sinh\s+thai|nha\s+hang|quan\s+an|quan)\s+/i,
      '',
    )
    .replace(/\s+/g, ' ')
    .trim();
}

function isDuplicateStopName(candidateName: string, existingNamesRawOrNorm: Set<string>): boolean {
  const candNorm = normalizeText(candidateName);
  const candBase = normalizeText(candidateName.replace(/\([^)]*\)/g, ' '));
  const candCore = normalizeStopCore(candidateName);

  for (const ex of existingNamesRawOrNorm) {
    if (!ex) continue;
    const exNorm = normalizeText(ex);
    if (candNorm === exNorm) return true;
    const exBase = normalizeText(ex.replace(/\([^)]*\)/g, ' '));
    const exCore = normalizeStopCore(ex);
    if (
      candBase.length >= 5 &&
      exBase.length >= 5 &&
      (candBase === exBase || candBase.includes(exBase) || exBase.includes(candBase))
    ) {
      return true;
    }
    if (
      candCore.length >= 6 &&
      exCore.length >= 6 &&
      (candCore === exCore || candCore.includes(exCore) || exCore.includes(candCore))
    ) {
      return true;
    }
  }
  return false;
}

const TOOL_CATEGORY_CONFIG: Record<string, { categories: string[]; label: string }> = {
  nature: { categories: ['nature', 'eco'], label: 'Thiên nhiên & Sinh thái' },
  'thien-nhien': { categories: ['nature', 'eco'], label: 'Thiên nhiên & Sinh thái' },
  eco: { categories: ['eco', 'nature'], label: 'Sinh thái & Sông nước' },
  'sinh-thai': { categories: ['eco', 'nature'], label: 'Sinh thái & Sông nước' },
  food: { categories: ['food'], label: 'Ẩm thực & Đặc sản' },
  'am-thuc': { categories: ['food'], label: 'Ẩm thực & Đặc sản' },
  culture: { categories: ['culture', 'history'], label: 'Văn hóa & Tâm linh' },
  'van-hoa': { categories: ['culture', 'history'], label: 'Văn hóa & Tâm linh' },
  history: { categories: ['history', 'culture'], label: 'Lịch sử & Di tích' },
  'lich-su': { categories: ['history', 'culture'], label: 'Lịch sử & Di tích' },
  local_experience: { categories: ['local_experience'], label: 'Trải nghiệm & Check-in' },
  'trai-nghiem': { categories: ['local_experience'], label: 'Trải nghiệm & Check-in' },
};

function buildSwapCriteriaFromToolArgs(
  args: {
    category?: unknown;
    area?: unknown;
    topicHint?: unknown;
    preferNear?: unknown;
  },
  rawMessage: string,
): SwapCriteria {
  const rawCat = typeof args.category === 'string' ? args.category.trim().toLowerCase() : '';
  const rawArea = typeof args.area === 'string' ? args.area.trim() : '';
  const rawTopic = typeof args.topicHint === 'string' ? args.topicHint.trim() : '';
  const rawPreferNear = Boolean(args.preferNear);

  const hasStructuredArgs = Boolean(rawCat || rawArea || rawTopic || rawPreferNear);
  if (!hasStructuredArgs) {
    // Only extract from the positive clause after "đổi/thay/chuyển" so negated old stops never leak
    const positivePartMatch = rawMessage.match(
      /(?:[đd][ổo]i|thay(?:\s*th[ếe])?|chuy[ểe]n)\s+(?:(?:cho\s+(?:t[ôo]i|m[ìi]nh|em|anh|ch[ịi])|gi[úu]p\s+(?:t[ôo]i|m[ìi]nh|em)|gi[ùu]m)\s+)?(?:(?:sang|qua|th[àa]nh|b[ằa]ng)\s+)?(.+)$/i,
    );
    return extractSwapCriteria(positivePartMatch?.[1] || rawMessage);
  }

  const categories: string[] = [];
  const labelParts: string[] = [];
  let topic: SwapCriteria['topic'];
  let areaSlug: string | undefined;
  let areaLabel: string | undefined;

  if (rawCat) {
    const mapped =
      TOOL_CATEGORY_CONFIG[rawCat] || TOOL_CATEGORY_CONFIG[normalizeText(rawCat).replace(/\s+/g, '-')];
    if (mapped) {
      categories.push(...mapped.categories);
      labelParts.push(mapped.label);
    } else {
      const catCrit = extractSwapCriteria(rawCat);
      categories.push(...catCrit.categories);
      if (catCrit.criteriaLabel) labelParts.push(catCrit.criteriaLabel);
    }
  }

  if (rawTopic) {
    const topicCrit = extractSwapCriteria(rawTopic);
    if (topicCrit.topic) {
      topic = topicCrit.topic;
      if (topicCrit.criteriaLabel) labelParts.push(topicCrit.criteriaLabel);
    }
    for (const c of topicCrit.categories) {
      if (!categories.includes(c)) categories.push(c);
    }
    if (!topicCrit.topic && topicCrit.criteriaLabel && labelParts.length === 0) {
      labelParts.push(topicCrit.criteriaLabel);
    }
  }

  if (rawArea) {
    const normArea = normalizeText(rawArea);
    const matchedArea = SWAP_AREA_OPTIONS.find(
      (a) => normArea.includes(a.kw) || a.slug === normArea || normalizeText(a.label) === normArea,
    );
    if (matchedArea) {
      areaSlug = matchedArea.slug;
      areaLabel = matchedArea.label;
      labelParts.push(`Khu vực ${matchedArea.label}`);
    }
  }

  const msgNorm = normalizeText(rawMessage);
  const userAskedNear =
    msgNorm.includes('gan hon') ||
    msgNorm.includes('gan nhat') ||
    msgNorm.includes('gan do') ||
    msgNorm.includes('gan tuyen') ||
    msgNorm.includes('thuan tuyen') ||
    msgNorm.includes('do met') ||
    msgNorm.includes('it di chuyen');

  const preferNear = rawPreferNear || userAskedNear;
  if (userAskedNear || (rawPreferNear && labelParts.length === 0)) {
    labelParts.push('Gần tuyến đường nhất');
  }

  const dedupLabels = Array.from(new Set(labelParts));
  const hasExplicitCriteria = Boolean(categories.length > 0 || topic || areaSlug || preferNear);

  return {
    categories: Array.from(new Set(categories)),
    topic,
    areaSlug,
    areaLabel,
    preferNear,
    criteriaLabel: dedupLabels.length > 0 ? dedupLabels.join(' · ') : undefined,
    hasExplicitCriteria,
  };
}

function sanitizeNotFoundQuery(
  rawNotFound: unknown,
  context: {
    targetStopName: string;
    rawTarget: string;
    existingNamesNorm: Set<string>;
  },
): string | undefined {
  const cleaned = typeof rawNotFound === 'string' ? rawNotFound.trim() : '';
  if (!cleaned) return undefined;

  const nfNorm = normalizeText(cleaned);
  if (!nfNorm || nfNorm.length < 2) return undefined;

  // Never treat generic category phrases or vague placeholders as a "not found destination"
  if (
    GENERIC_CATEGORY_NOUNS.has(nfNorm) ||
    VAGUE_PLACEHOLDER_PATTERN.test(nfNorm) ||
    /^(?:mot\s+|1\s+)?(?:dia\s*diem|diem|cho|noi)\b/.test(nfNorm)
  ) {
    return undefined;
  }

  // NEVER treat the OLD stop being replaced or ANY stop already in draftItinerary as "not found"
  const checkSet = new Set<string>(context.existingNamesNorm);
  if (context.targetStopName) checkSet.add(normalizeText(context.targetStopName));
  if (context.rawTarget) checkSet.add(normalizeText(context.rawTarget));

  if (isDuplicateStopName(cleaned, checkSet)) {
    return undefined;
  }

  // Also reject significant token overlap with targetStopName (e.g. "Trà mật ong" vs "Trà mật ong Kỳ Lân")
  const nfTokens = nfNorm.split(/\s+/).filter((t) => t.length >= 2);
  const targetTokens = normalizeText(context.targetStopName)
    .split(/\s+/)
    .filter((t) => t.length >= 2);
  if (nfTokens.length > 0 && targetTokens.length > 0) {
    const overlap = nfTokens.filter((t) => targetTokens.includes(t)).length;
    if (overlap / Math.min(nfTokens.length, targetTokens.length) >= 0.5) {
      return undefined;
    }
  }

  return cleaned;
}

function inferCoordsForStop(
  stop: DraftItineraryStopSnapshot,
  catalog: DestinationSummary[],
): { lat: number; lng: number } | undefined {
  if (typeof stop.lat === 'number' && typeof stop.lng === 'number') {
    return { lat: stop.lat, lng: stop.lng };
  }
  const stopNorm = normalizeText(stop.name);
  const matched = catalog.find((c) => {
    const cn = normalizeText(c.name);
    return cn === stopNorm || cn.includes(stopNorm) || stopNorm.includes(cn);
  });
  if (matched?.coordinates) return matched.coordinates;

  if (
    stopNorm.includes('thoi son') ||
    stopNorm.includes('my tho') ||
    stopNorm.includes('ky lan') ||
    stopNorm.includes('vinh trang') ||
    stopNorm.includes('dong tam')
  ) {
    return { lat: 10.354, lng: 106.362 };
  }
  if (stopNorm.includes('sa dec') || stopNorm.includes('huynh thuy le')) {
    return { lat: 10.301, lng: 105.755 };
  }
  if (stopNorm.includes('cao lanh') || stopNorm.includes('xeo quyt') || stopNorm.includes('gao giong')) {
    return { lat: 10.456, lng: 105.633 };
  }
  return undefined;
}

function getDayRefCoords(
  day: DraftItineraryDaySnapshot | undefined,
  excludeStopId?: string,
  catalog: DestinationSummary[] = [],
): { lat: number; lng: number } | undefined {
  if (!day?.stops?.length) return undefined;
  const coords = day.stops
    .filter((s) => !excludeStopId || s.stopId !== excludeStopId)
    .map((s) => inferCoordsForStop(s, catalog))
    .filter((p): p is { lat: number; lng: number } => Boolean(p));
  const pool =
    coords.length > 0
      ? coords
      : day.stops
          .map((s) => inferCoordsForStop(s, catalog))
          .filter((p): p is { lat: number; lng: number } => Boolean(p));
  if (pool.length === 0) return undefined;
  const avgLat = pool.reduce((sum, p) => sum + p.lat, 0) / pool.length;
  const avgLng = pool.reduce((sum, p) => sum + p.lng, 0) / pool.length;
  return { lat: avgLat, lng: avgLng };
}

function resolveTargetStopInDraft(
  rawTarget: string | undefined,
  requestedDay: number | undefined,
  draft?: DraftItinerarySnapshot | null,
  catalog: DestinationSummary[] = [],
): ResolvedDraftStop | null {
  const existingStopNamesNorm = getAllExistingStopNamesNorm(draft);
  if (!draft?.days?.length) {
    if (!rawTarget) return null;
    return {
      dayNumber: requestedDay || 1,
      stopName: rawTarget,
      existingStopNamesNorm,
    };
  }

  const orderedDays = requestedDay
    ? [
        ...draft.days.filter((d) => d.day === requestedDay),
        ...draft.days.filter((d) => d.day !== requestedDay),
      ]
    : draft.days;

  if (!rawTarget || !rawTarget.trim()) {
    return null;
  }

  const normTarget = normalizeText(rawTarget)
    .replace(/^(dia diem|diem|quan|khu|chua)\s+/g, '')
    .trim();

  // Check ordinal references: "điểm đầu tiên", "điểm thứ 2", "điểm cuối"
  const ordinalMatch = normTarget.match(/^(?:thu\s*)?(\d+)$|^dau\s*tien$|^cuoi(?:\s*cung)?$/);
  if (ordinalMatch) {
    const targetDay = orderedDays[0];
    if (targetDay && targetDay.stops.length > 0) {
      let chosen: DraftItineraryStopSnapshot | undefined;
      if (normTarget.includes('dau')) chosen = targetDay.stops[0];
      else if (normTarget.includes('cuoi')) chosen = targetDay.stops[targetDay.stops.length - 1];
      else {
        const idx = Number(ordinalMatch[1]) - 1;
        if (idx >= 0 && idx < targetDay.stops.length) chosen = targetDay.stops[idx];
      }
      if (chosen) {
        return {
          dayNumber: targetDay.day,
          stopId: chosen.stopId,
          stopName: chosen.name,
          refCoords: getDayRefCoords(targetDay, chosen.stopId, catalog),
          existingStopNamesNorm,
        };
      }
    }
  }

  // Fuzzy match stop name across days (prioritizing requestedDay if provided)
  const targetTokens = normTarget.split(/\s+/).filter((w) => w.length >= 2);
  let bestMatch: {
    day: DraftItineraryDaySnapshot;
    stop: DraftItineraryStopSnapshot;
    score: number;
  } | null = null;

  for (const day of orderedDays) {
    const dayBonus = requestedDay && day.day === requestedDay ? 0.12 : 0;
    for (const stop of day.stops || []) {
      const stopNorm = normalizeText(stop.name);
      if (stopNorm === normTarget) {
        return {
          dayNumber: day.day,
          stopId: stop.stopId,
          stopName: stop.name,
          refCoords: getDayRefCoords(day, stop.stopId, catalog),
          existingStopNamesNorm,
        };
      }
      if (stopNorm.includes(normTarget) || (normTarget.length >= 4 && normTarget.includes(stopNorm))) {
        const score = 0.92 + dayBonus;
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { day, stop, score };
        }
        continue;
      }
      if (targetTokens.length > 0) {
        const hits = targetTokens.filter((t) => stopNorm.includes(t)).length;
        const coverage = hits / targetTokens.length;
        if (coverage >= 0.6 && hits >= Math.min(2, targetTokens.length)) {
          const score = coverage * 0.8 + dayBonus;
          if (!bestMatch || score > bestMatch.score) {
            bestMatch = { day, stop, score };
          }
        }
      }
    }
  }

  if (bestMatch) {
    return {
      dayNumber: bestMatch.day.day,
      stopId: bestMatch.stop.stopId,
      stopName: bestMatch.stop.name,
      refCoords: getDayRefCoords(bestMatch.day, bestMatch.stop.stopId, catalog),
      existingStopNamesNorm,
    };
  }

  // Stop name wasn't found verbatim in draft — still pass cleaned name + ref coords of requested day
  const fallbackDay = orderedDays[0];
  return {
    dayNumber: requestedDay || fallbackDay?.day || 1,
    stopName: rawTarget,
    refCoords: getDayRefCoords(fallbackDay, undefined, catalog),
    existingStopNamesNorm,
  };
}

function matchesSwapTopic(d: DestinationSummary, topic: NonNullable<SwapCriteria['topic']>): boolean {
  const rawHay = `${d.name} ${d.summary} ${d.tags.join(' ')}`.toLowerCase();
  const hay = normalizeText(rawHay);
  switch (topic) {
    case 'chua':
      return (
        hasAccentedWord(rawHay, 'chùa') ||
        hay.includes('co tu') ||
        hay.includes('thien vien') ||
        hay.includes('kien an cung') ||
        hasAccentedWord(rawHay, 'miếu') ||
        hay.includes('ngoi chua') ||
        hay.includes('chua co')
      );
    case 'bao_tang':
      return hay.includes('bao tang');
    case 'nha_co':
      return hay.includes('nha co') || hay.includes('kien an cung');
    case 'lang_hoa':
      return hay.includes('lang hoa') || hay.includes('vuon hoa');
    case 'dong_sen':
      return hasAccentedWord(rawHay, 'sen') || hay.includes('dong sen') || hay.includes('hoa sen');
    case 'vuon_trai_cay':
      return (
        hasAccentedWord(rawHay, 'vườn') ||
        hay.includes('trai cay') ||
        hay.includes('miet vuon') ||
        hasAccentedWord(rawHay, 'quýt')
      );
    case 'bien':
      return hasAccentedWord(rawHay, 'biển') || hay.includes('bai bien') || hay.includes('bai sao');
    case 'nui':
      return hasAccentedWord(rawHay, 'núi') || hay.includes('that son') || hay.includes('nui cam');
    case 'cho':
      return (
        hasAccentedWord(rawHay, 'chợ') ||
        hay.includes('cho dem') ||
        hay.includes('cho noi') ||
        hay.includes('cho am thuc') ||
        hay.includes('pho am thuc')
      );
    case 'indoor':
      return (
        d.category === 'culture' ||
        d.category === 'food' ||
        hay.includes('bao tang') ||
        hay.includes('nha co') ||
        hasAccentedWord(rawHay, 'chùa') ||
        hasAccentedWord(rawHay, 'quán')
      );
  }
}

function rankSwapCandidates(
  catalog: DestinationSummary[],
  criteria: SwapCriteria,
  options: {
    excludeNamesNorm: Set<string>;
    targetStopName: string;
    refCoords?: { lat: number; lng: number };
    limit?: number;
  },
): { candidates: CopilotDestinationInfo[]; exactMatchCount: number } {
  const limit = options.limit ?? 6;
  const fullExcludeSet = new Set<string>(options.excludeNamesNorm);
  if (options.targetStopName) {
    fullExcludeSet.add(normalizeText(options.targetStopName));
  }

  // Exclude destinations already in the user's itinerary (including parenthetical/area variants like "Trại Rắn Đồng Tâm (...)")
  const eligible = catalog.filter((d) => !isDuplicateStopName(d.name, fullExcludeSet));

  const scored = eligible.map((d) => {
    const distKm =
      options.refCoords && d.coordinates
        ? haversineRoadKm(
            options.refCoords.lat,
            options.refCoords.lng,
            d.coordinates.lat,
            d.coordinates.lng,
          )
        : undefined;

    let score = 0;
    const reasons: string[] = [];
    let matchesCategory = criteria.categories.length === 0;
    let matchesTopic = !criteria.topic;
    let matchesArea = !criteria.areaSlug;

    // Category match (primary category gets stronger boost than secondary fallback category)
    if (criteria.categories.length > 0) {
      const catIdx = criteria.categories.indexOf(d.category);
      if (catIdx === 0) {
        score += 55;
        matchesCategory = true;
        reasons.push(`Đúng loại ${formatCategoryLabel(d.category)}`);
      } else if (catIdx > 0) {
        score += 38;
        matchesCategory = true;
        reasons.push(`Tương đồng · ${formatCategoryLabel(d.category)}`);
      } else {
        score -= 45;
      }
    }

    // Topic match
    if (criteria.topic) {
      if (matchesSwapTopic(d, criteria.topic)) {
        score += 50;
        matchesTopic = true;
        reasons.push('Khớp đúng chủ đề yêu cầu');
      }
    }

    // Area match
    if (criteria.areaSlug) {
      const areaMatch =
        d.areaSlug === criteria.areaSlug ||
        (criteria.areaLabel && normalizeText(d.area).includes(normalizeText(criteria.areaLabel)));
      if (areaMatch) {
        score += 45;
        matchesArea = true;
        reasons.push(`Tại ${d.area}`);
      } else {
        score -= 30;
      }
    }

    const matchesPrimary = !criteria.hasExplicitCriteria
      ? true
      : criteria.categories.length > 0 && criteria.topic
        ? matchesCategory && matchesTopic && (!criteria.areaSlug || matchesArea)
        : criteria.categories.length > 0
          ? matchesCategory && (!criteria.areaSlug || matchesArea)
          : criteria.topic
            ? matchesTopic && (!criteria.areaSlug || matchesArea)
            : criteria.areaSlug
              ? matchesArea
              : true;

    // Distance scoring: strongly favor nearby route-convenient destinations, penalize out-of-region 150km+ spots unless explicitly requested (e.g. biển/núi)
    if (distKm !== undefined) {
      const distWeight = criteria.preferNear ? 2.4 : criteria.hasExplicitCriteria ? 0.65 : 1.5;
      score += Math.max(0, 52 - distKm * distWeight);
      if (distKm > 140 && criteria.topic !== 'bien' && criteria.topic !== 'nui' && !criteria.areaSlug) {
        score -= 28;
      }
      if (distKm <= 15) {
        reasons.push(`Thuận tuyến (~${distKm} km)`);
      } else if (distKm <= 45) {
        reasons.push(`Cách tuyến ~${distKm} km`);
      }
    }

    if (reasons.length === 0) {
      reasons.push(`${formatCategoryLabel(d.category)} · ${d.area}`);
    }

    return {
      item: d,
      distKm,
      score,
      matchesCategory,
      matchesPrimary,
      reason: reasons.slice(0, 2).join(' · '),
    };
  });

  const strictMatches = scored.filter((s) => s.matchesPrimary).sort((a, b) => b.score - a.score);
  const categoryMatches =
    criteria.categories.length > 0
      ? scored.filter((s) => s.matchesCategory).sort((a, b) => b.score - a.score)
      : [];
  const pool =
    strictMatches.length > 0
      ? strictMatches
      : categoryMatches.length > 0
        ? categoryMatches
        : scored.sort((a, b) => b.score - a.score);

  // When open-ended ("sang điểm khác"), diversify categories so the user sees varied real choices
  let selected = pool.slice(0, limit);
  if (!criteria.hasExplicitCriteria && pool.length > limit) {
    const picked: typeof pool = [];
    const seenCats = new Set<string>();
    for (const cand of pool) {
      if (picked.length >= limit) break;
      if (!seenCats.has(cand.item.category) || picked.length >= 4) {
        picked.push(cand);
        seenCats.add(cand.item.category);
      }
    }
    if (picked.length < limit) {
      for (const cand of pool) {
        if (picked.length >= limit) break;
        if (!picked.some((p) => p.item.id === cand.item.id)) picked.push(cand);
      }
    }
    selected = picked;
  }

  return {
    candidates: selected.map((s) =>
      toCopilotDestinationInfo(s.item, {
        distanceKm: s.distKm,
        matchReason: s.reason,
      }),
    ),
    exactMatchCount: strictMatches.length,
  };
}

function buildChooseSwapCandidateResponse(params: {
  dayNumber: number;
  targetStopId?: string;
  targetStopName: string;
  criteriaLabel?: string;
  notFoundQuery?: string;
  candidates: CopilotDestinationInfo[];
}): CopilotResponse {
  const { dayNumber, targetStopId, targetStopName, criteriaLabel, notFoundQuery, candidates } = params;

  const listLines = candidates
    .map(
      (c, idx) =>
        `${idx + 1}. **${c.name}** *(${c.area}${c.categoryLabel ? ` · ${c.categoryLabel}` : ''}${c.distanceKm !== undefined ? ` · ~${c.distanceKm} km` : ''})*`,
    )
    .join('\n');

  let headerText: string;
  if (notFoundQuery) {
    headerText =
      `Dạ **Pé Meko** đã kiểm tra dữ liệu hệ thống nhưng **chưa có địa điểm "${notFoundQuery}"** trong danh mục Đồng Tháp Smart Travel, nên Pé Meko sẽ không tự tạo điểm ảo vào lịch trình của bạn nhé! 🦊🛡️\n\n` +
      `Thay vào đó, dưới đây là **${candidates.length} địa điểm thật đang có trong hệ thống** phù hợp để thay cho **${targetStopName}** (Ngày ${dayNumber}):`;
  } else if (criteriaLabel) {
    headerText =
      `Dạ **Pé Meko** đã lọc sẵn **${candidates.length} địa điểm thật thuộc nhóm "${criteriaLabel}"** (chưa có trong lịch trình) để thay cho **${targetStopName}** (Ngày ${dayNumber})! 🦊🌿`;
  } else {
    headerText =
      `Dạ **Pé Meko** đã chọn ra **${candidates.length} địa điểm thật trong hệ thống** (ưu tiên gần tuyến & chưa trùng lịch trình) để bạn đổi thay cho **${targetStopName}** (Ngày ${dayNumber})! 🦊🧭`;
  }

  return {
    reply:
      `${headerText}\n\n${listLines}\n\n` +
      `👉 Bạn chỉ cần bấm nút **"Đổi sang điểm này"** ngay trên thẻ bên dưới (hoặc nhắn *"chọn số 1"* / *"đổi sang điểm ẩm thực"* để lọc lại) nhé!`,
    action: {
      type: 'CHOOSE_SWAP_CANDIDATE',
      payload: {
        label: `Chọn điểm thay cho "${targetStopName}" (Ngày ${dayNumber})`,
        dayNumber,
        targetStopId,
        targetStopName,
        swapSelection: {
          dayNumber,
          targetStopId,
          targetStopName,
          criteriaLabel,
          notFoundQuery,
          candidates,
        },
      },
    },
    suggestions: [
      'Đổi sang điểm thiên nhiên',
      'Đổi sang điểm ẩm thực',
      'Đổi sang chùa / văn hóa',
      'Tìm điểm gần tuyến nhất',
    ],
  };
}

function buildDirectSwapResponse(params: {
  dayNumber: number;
  targetStopId?: string;
  targetStopName: string;
  newDestination: CopilotDestinationInfo;
}): CopilotResponse {
  const { dayNumber, targetStopId, targetStopName, newDestination } = params;
  return {
    reply:
      `Dạ **Pé Meko** đã xác nhận đổi **${targetStopName}** (Ngày ${dayNumber}) sang **${newDestination.name}** (${newDestination.area || 'Đồng Tháp'})! 🧭✨\n\n` +
      `⚠️ **Kiểm tra tuyến đường thông minh**:\n` +
      `Pé Meko đang tính khoảng cách thực tế giữa **${newDestination.name}** và các điểm lân cận trong **Ngày ${dayNumber}**. Nếu nằm xa tuyến hiện tại, hộp thoại sẽ mở ra để bạn chọn dời sang ngày kế tiếp hoặc vẫn giữ ở Ngày ${dayNumber}!`,
    action: {
      type: 'SWAP_ITINERARY_STOP',
      payload: {
        path: '/itinerary/create#plan',
        label: `Đổi "${targetStopName}" → "${newDestination.name}" (Ngày ${dayNumber})`,
        dayNumber,
        targetStopId,
        targetStopName,
        newDestination,
      },
    },
    suggestions: [
      `Xem chi tiết ${newDestination.name}`,
      'Lưu lịch trình này vào tài khoản',
      'Lịch trình hiện tại của tôi gồm những điểm nào?',
    ],
  };
}

function resolveLastDiscussedDestination(
  pageContext: PageContextSnapshot | undefined,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  catalog: DestinationSummary[],
): CopilotDestinationInfo | null {
  if (pageContext?.lastDiscussedDestination?.slug) {
    const db = catalog.find((c) => c.slug === pageContext.lastDiscussedDestination!.slug);
    return db ? toCopilotDestinationInfo(db) : pageContext.lastDiscussedDestination;
  }

  // Infer from current destination detail URL (/destinations/:slug)
  const pathMatch = pageContext?.currentPath?.match(/^\/destinations\/([^/?#]+)/i);
  if (pathMatch?.[1]) {
    const slug = decodeURIComponent(pathMatch[1]);
    const db = catalog.find((c) => c.slug === slug);
    if (db) return toCopilotDestinationInfo(db);
  }

  // Fallback: inspect latest messages in conversation history for an unambiguously mentioned destination
  for (const h of [...history].reverse().slice(0, 6)) {
    const textNorm = normalizeText(h.content);
    const sorted = [...catalog].sort((a, b) => b.name.length - a.name.length);
    for (const item of sorted) {
      if (item.name.length >= 6 && textNorm.includes(normalizeText(item.name))) {
        return toCopilotDestinationInfo(item);
      }
    }
  }

  return null;
}

function tryInstantPendingSwapIndexPick(
  message: string,
  catalog: DestinationSummary[],
  pageContext?: PageContextSnapshot,
): CopilotResponse | null {
  const pending = pageContext?.pendingSwap;
  const candidates = pending?.candidates || [];
  if (!pending?.targetStopName || candidates.length === 0) return null;

  const norm = normalizeText(message);
  let pickedIndex: number | null = null;
  const explicitNum = norm.match(
    /^(?:chon|lay|doi\s+(?:sang|qua)|thay\s+(?:sang|qua)|chuyen\s+(?:sang|qua)|so|diem|cai|phuong\s+an)?\s*(?:so|thu)?\s*(\d+)(?:\s*(?:di|nhe|nha|luon|ne))?$/,
  );
  if (explicitNum?.[1]) {
    pickedIndex = Number(explicitNum[1]) - 1;
  } else if (/^(?:chon\s+|lay\s+|doi\s+(?:sang|qua)\s+)?(?:cai\s+|diem\s+)?dau\s*tien(?:\s*(?:di|nhe|nha|luon|ne))?$/.test(norm)) {
    pickedIndex = 0;
  } else if (/^(?:chon\s+|lay\s+|doi\s+(?:sang|qua)\s+)?(?:cai\s+|diem\s+)?cuoi(?:\s*cung)?(?:\s*(?:di|nhe|nha|luon|ne))?$/.test(norm)) {
    pickedIndex = candidates.length - 1;
  }

  if (pickedIndex === null || pickedIndex < 0 || pickedIndex >= candidates.length) {
    return null;
  }

  const picked = candidates[pickedIndex]!;
  const verified = catalog.find((c) => c.slug === picked.slug);
  const realDest = verified ? toCopilotDestinationInfo(verified) : picked;
  return buildDirectSwapResponse({
    dayNumber: pending.dayNumber,
    targetStopId: pending.targetStopId,
    targetStopName: pending.targetStopName,
    newDestination: realDest,
  });
}

/**
 * Multi-turn follow-up handler when user already has an active swap candidate picker open (for offline/test deterministic mode).
 */
function handlePendingSwapFollowUp(
  message: string,
  catalog: DestinationSummary[],
  pageContext?: PageContextSnapshot,
): CopilotResponse | null {
  const instantPick = tryInstantPendingSwapIndexPick(message, catalog, pageContext);
  if (instantPick) return instantPick;

  const pending = pageContext?.pendingSwap;
  if (!pending || !pending.targetStopName) return null;

  const norm = normalizeText(message);
  const cleanedNorm = stripConversationalEdges(norm);
  const candidates = pending.candidates || [];

  // 1. User names one of the shown candidates directly (even abbreviated, e.g., "đổi qua biển tân thành đi" or "đây nè Biển Tân Thành (Gò Công Đông)")
  if (candidates.length > 0 && cleanedNorm.length >= 3) {
    const matchedShown = candidates.find((c) => {
      const cn = normalizeText(c.name);
      const cnBase = cn.replace(/\([^)]*\)/g, '').trim();
      return (
        norm.includes(cn) ||
        (cnBase.length >= 5 && norm.includes(cnBase)) ||
        (cleanedNorm.length >= 5 && (cn.includes(cleanedNorm) || cnBase.includes(cleanedNorm)))
      );
    });
    if (matchedShown) {
      const verified = catalog.find((c) => c.slug === matchedShown.slug);
      return buildDirectSwapResponse({
        dayNumber: pending.dayNumber,
        targetStopId: pending.targetStopId,
        targetStopName: pending.targetStopName,
        newDestination: verified ? toCopilotDestinationInfo(verified) : matchedShown,
      });
    }
  }

  // 2. User directly names any real DB destination while pendingSwap picker is active (e.g., "đây nè Biển Tân Thành", "đổi qua Chùa Vĩnh Tràng đi")
  const looksLikeOtherAction =
    norm.includes('tao tai khoan') ||
    norm.includes('dang ky') ||
    norm.includes('dang nhap') ||
    norm.includes('yeu thich') ||
    norm.includes('luu lich trinh') ||
    norm.includes('xoa diem') ||
    norm.includes('bo diem') ||
    norm.includes('bo dia diem');
  if (!looksLikeOtherAction) {
    const directReal = findDestinationByText(message, catalog);
    if (directReal) {
      return buildDirectSwapResponse({
        dayNumber: pending.dayNumber,
        targetStopId: pending.targetStopId,
        targetStopName: pending.targetStopName,
        newDestination: directReal,
      });
    }
  }

  // 3. User refines the swap filter without repeating the target stop:
  // e.g., "đổi qua điểm thiên nhiên", "có điểm ẩm thực không", "tìm điểm gần hơn", "điểm ở Sa Đéc"
  const isRefinementPhrase =
    norm.startsWith('doi sang') ||
    norm.startsWith('doi qua') ||
    norm.startsWith('thay sang') ||
    norm.startsWith('thay qua') ||
    norm.startsWith('chuyen sang') ||
    norm.startsWith('chuyen qua') ||
    norm.startsWith('tim diem') ||
    norm.startsWith('chon diem') ||
    norm.startsWith('goi y diem') ||
    norm.startsWith('co diem') ||
    norm.includes('gan tuyen') ||
    norm.includes('gan hon') ||
    norm.includes('diem khac') ||
    norm.includes('cho khac');

  if (isRefinementPhrase) {
    const criteria = extractSwapCriteria(message);
    const resolved = resolveTargetStopInDraft(
      pending.targetStopName,
      pending.dayNumber,
      pageContext?.draftItinerary,
      catalog,
    );
    const { candidates: nextCandidates } = rankSwapCandidates(catalog, criteria, {
      excludeNamesNorm: resolved?.existingStopNamesNorm ?? getAllExistingStopNamesNorm(pageContext?.draftItinerary),
      targetStopName: pending.targetStopName,
      refCoords: resolved?.refCoords,
      limit: 6,
    });
    return buildChooseSwapCandidateResponse({
      dayNumber: pending.dayNumber,
      targetStopId: pending.targetStopId ?? resolved?.stopId,
      targetStopName: pending.targetStopName,
      criteriaLabel: criteria.criteriaLabel,
      candidates: nextCandidates,
    });
  }

  return null;
}

/**
 * Matches a stop mentioned inside the user's draft itinerary from free-form text
 * (handles cases where stop comes BEFORE "đổi", e.g., "tôi không muốn tham quan bảo tàng đổi qua thiên nhiên").
 */
function findMentionedStopInText(
  text: string,
  requestedDay: number | undefined,
  draft?: DraftItinerarySnapshot | null,
): { dayNumber: number; stopId?: string; stopName: string } | null {
  if (!draft?.days?.length) return null;
  const norm = normalizeText(text);
  const stopWords = new Set(['khu', 'du', 'lich', 'diem', 'dia', 'tham', 'quan', 'ngay', 'toi', 'khong', 'muon', 'doi', 'qua', 'sang', 'voi', 'mot', 'cai', 'khac']);

  const orderedDays = requestedDay
    ? [...draft.days.filter((d) => d.day === requestedDay), ...draft.days.filter((d) => d.day !== requestedDay)]
    : draft.days;

  let best: { dayNumber: number; stopId?: string; stopName: string; score: number } | null = null;
  for (const day of orderedDays) {
    for (const stop of day.stops || []) {
      const stopNorm = normalizeText(stop.name);
      if (stopNorm.length >= 4 && norm.includes(stopNorm)) {
        return { dayNumber: day.day, stopId: stop.stopId, stopName: stop.name };
      }
      const meaningfulTokens = stopNorm
        .split(/\s+/)
        .filter((t) => t.length >= 3 && !stopWords.has(t));
      if (meaningfulTokens.length === 0) continue;

      // Distinctive 2+ token phrases like "bao tang", "tra mat", "vinh trang", "lang hoa", "tram chim"
      const matchedTokens = meaningfulTokens.filter((t) => norm.includes(t));
      if (matchedTokens.length >= 2) {
        const score = matchedTokens.length / meaningfulTokens.length + (requestedDay === day.day ? 0.2 : 0);
        if (!best || score > best.score) {
          best = { dayNumber: day.day, stopId: stop.stopId, stopName: stop.name, score };
        }
      }
    }
  }
  return best ? { dayNumber: best.dayNumber, stopId: best.stopId, stopName: best.stopName } : null;
}

/**
 * Ground-Truth Stop-Swap Intent Parser & Resolver for offline/test mode (NEVER fabricates fake destinations!).
 */
function handleSmartSwapIntent(
  message: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  catalog: DestinationSummary[],
  pageContext?: PageContextSnapshot,
): CopilotResponse | null {
  const norm = normalizeText(message);

  // Exclude profile/account edits like "đổi tên", "đổi mật khẩu"
  if (norm.includes('doi ten') || norm.includes('doi mat khau')) {
    return null;
  }

  const hasSwapVerb =
    norm.includes('doi dia diem') ||
    norm.includes('thay dia diem') ||
    norm.includes('doi diem') ||
    norm.includes('thay diem') ||
    norm.includes('thay the dia diem') ||
    norm.includes('thay the diem') ||
    norm.includes('doi qua') ||
    norm.includes('doi sang') ||
    norm.includes('doi no') ||
    /\b(?:doi|thay(?:\s+the)?|chuyen)\b.+\b(?:sang|thanh|bang|qua|voi)\b/.test(norm) ||
    /\b(?:doi|thay(?:\s+the)?|chuyen)\b.+\b(?:dia\s*diem|diem|cho|noi)\b/.test(norm) ||
    ((norm.includes('doi ') || norm.includes('thay ')) &&
      (norm.includes('lo trinh') ||
        norm.includes('lich trinh') ||
        norm.includes('ngay ') ||
        norm.includes('diem khac') ||
        norm.includes('cho khac') ||
        norm.includes('noi khac')));

  if (!hasSwapVerb) {
    return null;
  }

  const dayMatch = message.match(/ng[àa]y\s*(\d+)/i);
  const requestedDay = dayMatch?.[1] ? Math.max(1, Number(dayMatch[1])) : undefined;

  let rawTarget: string | undefined;
  let rawNew: string | undefined;

  // 0. Check anaphoric & inverted swap: "ừa dổi nó với địa điểm bảo tàng ở ngày 1 đi"
  const anaphoraMatch = message.match(
    /(?:^|\s)[đd][ổo]i\s+(?:n[oó]|đi[ểe]m\s+n[àa]y|ch[ỗo]\s+n[àa]y|c[áa]i\s+n[àa]y|đi[ểe]m\s+đ[oó]|ch[ỗo]\s+đ[oó]|đi[ểe]m\s+v[ừu]a\s+r[ồo]i)\s+(?:v[ớo]i|cho|thay\s+cho|th[ếe]\s+cho)\s+(.+)$/i,
  );
  if (anaphoraMatch?.[1]) {
    const anaphoricDest = resolveLastDiscussedDestination(pageContext, history, catalog);
    const cleanedTargetSide = anaphoraMatch[1]
      .replace(/^(?:đ[ịi]a\s*đi[ểe]m|đi[ểe]m|ch[ỗo])\s+/i, '')
      .replace(/\s+(?:trong|c[ủu]a)\s+(?:l[ộo]\s*tr[ìi]nh|l[ịi]ch\s*tr[ìi]nh).*$/i, '')
      .replace(/\s+(?:ở|tại|thuộc)?\s*ng[àa]y\s*\d+.*$/i, '')
      .replace(/\s+(?:đi|nh[ée]|nha|lu[ôo]n|ạ|n[èe])$/i, '')
      .trim();
    const resolvedTarget = resolveTargetStopInDraft(
      cleanedTargetSide,
      requestedDay,
      pageContext?.draftItinerary,
      catalog,
    );
    if (anaphoricDest && resolvedTarget) {
      return buildDirectSwapResponse({
        dayNumber: resolvedTarget.dayNumber,
        targetStopId: resolvedTarget.stopId,
        targetStopName: resolvedTarget.stopName,
        newDestination: anaphoricDest,
      });
    }
    rawTarget = cleanedTargetSide;
  }

  // 1a. Check direct command without pre-verb target: e.g. "đổi qua biển tân thành đi" or "tôi không muốn tham quan bảo tàng đổi qua thiên nhiên"
  if (!rawTarget) {
    const preTargetDirectMatch = message.match(
      /^(.*?)[đd][ổo]i\s+(?:qua|sang|th[àa]nh|b[ằa]ng)\s+(?:tham\s*quan\s+|đi\s+|gh[ée]\s+|m[ộo]t\s+|1\s+)?(.+)$/i,
    );
    if (preTargetDirectMatch && preTargetDirectMatch[2]) {
      const beforeSwapClause = (preTargetDirectMatch[1] || '').trim();
      const afterSwapClause = preTargetDirectMatch[2]
        .replace(/[?!.]+$/, '')
        .replace(/\s+(?:gi[úu]p\s+t[ôo]i|gi[úu]p\s+m[ìi]nh|nh[ée]|nha|đi|lu[ôo]n|v[ớo]i|ạ|n[èe])$/i, '')
        .trim();

      const mentionedStopBefore = findMentionedStopInText(
        beforeSwapClause,
        requestedDay,
        pageContext?.draftItinerary,
      );
      if (mentionedStopBefore) {
        rawTarget = mentionedStopBefore.stopName;
        rawNew = afterSwapClause;
      } else if (!beforeSwapClause || beforeSwapClause.length <= 12) {
        // User wrote "đổi qua <X>" without repeating target (maybe target is in pendingSwap)
        rawTarget = pageContext?.pendingSwap?.targetStopName;
        rawNew = afterSwapClause;
      }
    }
  }

  // 1b. Natural benefactive pattern: "tôi không muốn đi Trà mật ong đổi cho tôi một địa điểm tham quan về thiên nhiên khác đi"
  if (!rawTarget) {
    const preTargetBenefactiveMatch = message.match(
      /^(.+?)\s+(?:[đd][ổo]i|thay(?:\s*th[ếe])?)\s+(?:(?:cho\s+(?:t[ôo]i|m[ìi]nh|em|anh|ch[ịi])|gi[úu]p\s+(?:t[ôo]i|m[ìi]nh|em)|gi[ùu]m)\s+)(?:(?:qua|sang|th[àa]nh|b[ằa]ng)\s+)?(.+)$/i,
    );
    if (preTargetBenefactiveMatch?.[1] && preTargetBenefactiveMatch[2]) {
      const mentionedStopBefore = findMentionedStopInText(
        preTargetBenefactiveMatch[1],
        requestedDay,
        pageContext?.draftItinerary,
      );
      if (mentionedStopBefore) {
        rawTarget = mentionedStopBefore.stopName;
        rawNew = preTargetBenefactiveMatch[2]
          .replace(/[?!.]+$/, '')
          .replace(/\s+(?:gi[úu]p\s+t[ôo]i|gi[úu]p\s+m[ìi]nh|nh[ée]|nha|đi|lu[ôo]n|v[ớo]i|ạ|n[èe])$/i, '')
          .trim();
      }
    }
  }

  // 2. Classic inline A -> B syntax: "đổi X sang/qua/bằng/thành Y"
  // NOTE: avoid splitting inside place names like "Biển Tân Thành" by only splitting on "thành" when preceded by X of length >= 2 and X doesn't start with qua/sang/thanh/bang
  if (!rawTarget && !rawNew) {
    const swapRegex =
      /(?:[đd][ổo]i|thay(?:\s*th[ếe])?)\s*(?:đ[ịi]a\s*đi[ểe]m|đi[ểe]m|ch[ỗo]|n[ơo]i)?\s+(?!(?:qua|sang|th[àa]nh|b[ằa]ng)\b)(.+?)\s+(?:trong\s+(?:l[ộo]\s*tr[ìi]nh|l[ịi]ch\s*tr[ìi]nh)(?:\s+ng[àa]y\s*\d+)?\s+)?(?:sang|qua|b[ằa]ng|th[àa]nh)\s+(?:tham\s*quan\s+|đi\s+|gh[ée]\s+|m[ộo]t\s+|1\s+)?(.+)$/i;

    const match = message.match(swapRegex);
    if (match && match[1] && match[2]) {
      rawTarget = match[1]
        .replace(/^(?:đ[ịi]a\s*đi[ểe]m|đi[ểe]m|ch[ỗo])\s+/i, '')
        .replace(/\s+(?:trong|c[ủu]a)\s+(?:l[ộo]\s*tr[ìi]nh|l[ịi]ch\s*tr[ìi]nh).*$/i, '')
        .replace(/\s+[ởo]?\s*ng[àa]y\s*\d+.*$/i, '')
        .replace(/["'“”]/g, '')
        .trim();
      rawNew = match[2]
        .replace(/[?!.]+$/, '')
        .replace(/\s+(?:gi[úu]p\s+t[ôo]i|gi[úu]p\s+m[ìi]nh|nh[ée]|nha|đi|lu[ôo]n|v[ớo]i|ạ|n[èe])$/i, '')
        .trim();
    } else {
      const targetOnlyMatch = message.match(
        /(?:[đd][ổo]i|thay(?:\s*th[ếe])?)\s+(?:đ[ịi]a\s*đi[ểe]m|đi[ểe]m)\s+(.+?)(?:\s+(?:trong|ở)\s+(?:l[ộo]\s*tr[ìi]nh|l[ịi]ch\s*tr[ìi]nh|ng[àa]y\s*\d+)|\s+(?:đi|nh[ée]|nha|gi[úu]p)|$)/i,
      );
      if (targetOnlyMatch?.[1]) {
        const candidateTarget = targetOnlyMatch[1].trim();
        const candNorm = normalizeText(candidateTarget);
        if (candNorm.length >= 2 && !GENERIC_CATEGORY_NOUNS.has(candNorm) && !VAGUE_PLACEHOLDER_PATTERN.test(candNorm)) {
          rawTarget = candidateTarget;
        }
      }
    }
  }

  // Last try: scan full message for a draft stop if target is still unset
  if (!rawTarget) {
    const inferredStop = findMentionedStopInText(message, requestedDay, pageContext?.draftItinerary);
    if (inferredStop) {
      rawTarget = inferredStop.stopName;
    }
  }

  // Filter out generic non-targets like "1 địa điểm", "một điểm", "địa điểm trong lịch trình"
  if (rawTarget) {
    const rtNorm = normalizeText(rawTarget);
    if (
      /^(?:1|mot|cac|nhung)?\s*(?:dia\s*diem|diem|cho|noi)?(?:\s*(?:trong|cua|o))?$/.test(rtNorm) ||
      rtNorm === 'trong lich trinh' ||
      rtNorm === 'trong lo trinh'
    ) {
      rawTarget = undefined;
    }
  }

  // Case 1: User didn't specify which stop to replace -> show actual stops from their draft itinerary!
  if (!rawTarget) {
    const draft = pageContext?.draftItinerary;
    const realStops =
      draft?.days?.flatMap((d) =>
        (d.stops || []).map((s) => ({ day: d.day, name: s.name, start: s.start })),
      ) || [];

    if (realStops.length > 0) {
      const stopListText = realStops
        .slice(0, 8)
        .map((s, i) => `${i + 1}. **${s.name}** *(Ngày ${s.day}${s.start ? ` · ${s.start}` : ''})*`)
        .join('\n');

      return {
        reply:
          `Dạ **Pé Meko** thấy lịch trình hiện tại của bạn đang có các điểm dừng sau:\n\n${stopListText}\n\n` +
          `Bạn muốn **đổi điểm nào** ạ? Bấm chọn nhanh bên dưới hoặc nhắn *"Đổi [tên điểm] sang điểm thiên nhiên / điểm khác"* để Pé Meko xổ danh sách gợi ý thật cho bạn chọn nhé! 🦊🧭`,
        action: {
          type: 'ASK_CLARIFICATION',
          payload: {
            missingFields: ['targetStopName'],
            contextType: 'swap_stop',
          },
        },
        suggestions: realStops
          .slice(0, 4)
          .map((s) => `Đổi ${s.name} (Ngày ${s.day}) sang điểm khác`),
      };
    }

    return {
      reply:
        `Dạ **Pé Meko** sẵn sàng đổi địa điểm trong lộ trình giúp bạn ngay! 🦊\n\n` +
        `Bạn cho Pé Meko biết **tên điểm muốn đổi** (và tùy chọn **loại địa điểm mới**, ví dụ *thiên nhiên*, *ẩm thực*, *chùa* hoặc *tên điểm cụ thể*) nhé!`,
      action: {
        type: 'ASK_CLARIFICATION',
        payload: {
          missingFields: ['targetStopName'],
          contextType: 'swap_stop',
        },
      },
      suggestions: [
        'Lập lịch trình đi 2 ngày cho 2 người với chi phí 2 tr',
        'Đổi điểm Trà mật ong Kỳ Lân sang điểm thiên nhiên',
        'Đổi điểm Trà mật ong Kỳ Lân sang điểm khác',
      ],
    };
  }

  // Resolve target stop accurately against live draftItinerary
  const resolvedStop = resolveTargetStopInDraft(rawTarget, requestedDay, pageContext?.draftItinerary, catalog);
  const finalDay = resolvedStop?.dayNumber ?? requestedDay ?? 1;
  const finalStopName = resolvedStop?.stopName ?? rawTarget;
  const finalStopId = resolvedStop?.stopId;
  const excludeNamesNorm =
    resolvedStop?.existingStopNamesNorm ?? getAllExistingStopNamesNorm(pageContext?.draftItinerary);

  // Case 2: Check if user named a SPECIFIC REAL destination in the database
  if (rawNew) {
    const exactRealDest = findDestinationByText(rawNew, catalog);
    if (exactRealDest) {
      return buildDirectSwapResponse({
        dayNumber: finalDay,
        targetStopId: finalStopId,
        targetStopName: finalStopName,
        newDestination: exactRealDest,
      });
    }
  }

  // Case 3 & 4: User asked for "điểm khác", criteria ("thiên nhiên", "ẩm thực", "ở Sa Đéc"),
  // OR named a place that does NOT exist in the database -> NEVER fabricate a fake place!
  let criteria = extractSwapCriteria(rawNew || '');
  const normNew = rawNew ? normalizeText(rawNew) : '';
  const isDemonstrativeNew = /^(?:do|day|nay|cho\s+do|noi\s+do|diem\s+do|cho\s+nay|diem\s+nay|noi\s+nay)$/.test(
    normNew,
  );
  if (!criteria.hasExplicitCriteria && (!normNew || isDemonstrativeNew)) {
    const beforeSwap = message.split(/(?:[đd][ổo]i|thay(?:\s*th[ếe])?)\b/i)[0] || '';
    if (beforeSwap.trim().length >= 4) {
      criteria = extractSwapCriteria(beforeSwap);
    }
  }

  const isVagueOrGeneric =
    !normNew ||
    isDemonstrativeNew ||
    GENERIC_CATEGORY_NOUNS.has(normNew) ||
    VAGUE_PLACEHOLDER_PATTERN.test(normNew) ||
    criteria.hasExplicitCriteria;

  const { candidates } = rankSwapCandidates(catalog, criteria, {
    excludeNamesNorm,
    targetStopName: finalStopName,
    refCoords: resolvedStop?.refCoords,
    limit: 6,
  });

  if (candidates.length === 0) {
    return {
      reply:
        `Dạ hiện tại Pé Meko chưa tìm thấy địa điểm thay thế phù hợp trong cơ sở dữ liệu. Bạn thử mở trang **Khám phá điểm đến** để xem toàn bộ điểm hiện có nhé! 🦊`,
      action: {
        type: 'OPEN_PAGE',
        payload: { path: '/destinations', label: 'Khám phá địa điểm' },
      },
    };
  }

  const sanitizedNotFound =
    !isVagueOrGeneric && rawNew
      ? sanitizeNotFoundQuery(rawNew, {
          targetStopName: finalStopName,
          rawTarget,
          existingNamesNorm: excludeNamesNorm,
        })
      : undefined;

  return buildChooseSwapCandidateResponse({
    dayNumber: finalDay,
    targetStopId: finalStopId,
    targetStopName: finalStopName,
    criteriaLabel: criteria.criteriaLabel,
    notFoundQuery: sanitizedNotFound,
    candidates,
  });
}

/**
 * Remove a stop cleanly from the active draft itinerary ("bỏ điểm X khỏi lịch trình").
 */
function handleRemoveStopIntent(
  message: string,
  pageContext?: PageContextSnapshot,
): CopilotResponse | null {
  const norm = normalizeText(message);
  if (norm.includes('yeu thich')) return null;

  const isRemoveTrigger =
    (norm.includes('xoa diem') ||
      norm.includes('bo diem') ||
      norm.includes('bo dia diem') ||
      norm.includes('xoa dia diem') ||
      norm.includes('cat bo') ||
      norm.includes('bo khoi lich trinh') ||
      norm.includes('xoa khoi lich trinh')) &&
    (norm.includes('lich trinh') || norm.includes('lo trinh') || norm.includes('ngay ') || Boolean(pageContext?.hasDraftItinerary));

  if (!isRemoveTrigger) return null;

  const dayMatch = message.match(/ng[àa]y\s*(\d+)/i);
  const requestedDay = dayMatch?.[1] ? Math.max(1, Number(dayMatch[1])) : undefined;

  const targetMatch = message.match(
    /(?:x[óo]a|b[ỏo]|c[ắa]t\s*b[ỏo])\s+(?:đ[ịi]a\s*đi[ểe]m|đi[ểe]m)?\s*(.+?)(?:\s+(?:kh[ỏo]i|trong)\s+(?:l[ộo]\s*tr[ìi]nh|l[ịi]ch\s*tr[ìi]nh)|\s+[ởo]?\s*ng[àa]y\s*\d+|\s+(?:đi|nh[ée]|gi[úu]p)|$)/i,
  );
  const rawTarget = targetMatch?.[1]?.trim();
  const resolved = resolveTargetStopInDraft(rawTarget, requestedDay, pageContext?.draftItinerary);
  if (!resolved) return null;

  return {
    reply: `Dạ **Pé Meko** đang gỡ điểm **${resolved.stopName}** khỏi **Ngày ${resolved.dayNumber}** trong lịch trình của bạn ngay đây ạ! 🦊✂️`,
    action: {
      type: 'REMOVE_ITINERARY_STOP',
      payload: {
        path: '/itinerary/create#plan',
        label: `Bỏ "${resolved.stopName}" (Ngày ${resolved.dayNumber})`,
        dayNumber: resolved.dayNumber,
        targetStopId: resolved.stopId,
        targetStopName: resolved.stopName,
      },
    },
    suggestions: ['Lịch trình hiện tại của tôi gồm những điểm nào?', 'Lưu lịch trình này vào tài khoản'],
  };
}

function buildItinerarySummaryResponse(
  pageContext?: PageContextSnapshot,
  requestedDay?: number,
): CopilotResponse {
  const draft = pageContext?.draftItinerary;
  if (!draft || !draft.days?.length) {
    return {
      reply:
        `Hiện tại bạn chưa có bản nháp lịch trình nào trên máy ạ! 🦊\n` +
        `Bạn chỉ cần nhắn số ngày, số người và ngân sách (ví dụ: *"Lập lịch trình 2 ngày cho 2 người chi phí 2 triệu"*) để **Pé Meko** lập ngay giúp bạn nhé!`,
      suggestions: ['Lập lịch trình đi 2 ngày cho 2 người với chi phí 2 tr'],
    };
  }

  const daysToShow = requestedDay ? draft.days.filter((d) => d.day === requestedDay) : draft.days;
  const targetDays = daysToShow.length > 0 ? daysToShow : draft.days;

  const summaryBlocks = targetDays.map((d) => {
    const lines = d.stops.map(
      (s, idx) =>
        `  ${idx + 1}. **${s.name}**${s.start && s.end ? ` *(${s.start} – ${s.end})*` : ''}`,
    );
    return `📅 **Ngày ${d.day}** (${d.stops.length} điểm):\n${lines.join('\n')}`;
  });

  const firstStop = targetDays[0]?.stops[0];
  return {
    reply:
      `Dạ đây là lịch trình hiện tại của bạn${draft.title ? ` (**${draft.title}**)` : ''}: 🦊🗺️\n\n` +
      `${summaryBlocks.join('\n\n')}\n\n` +
      `Bạn muốn **đổi điểm nào** (theo thể loại thiên nhiên, ẩm thực, chùa hay gần tuyến), **thêm điểm** hay **bỏ điểm nào** thì nhắn Pé Meko xử lý ngay nhé!`,
    suggestions: firstStop
      ? [
          `Đổi ${firstStop.name} sang điểm thiên nhiên`,
          `Đổi ${firstStop.name} sang điểm khác`,
          'Lưu lịch trình này vào tài khoản',
        ]
      : ['Lưu lịch trình này vào tài khoản'],
  };
}

/**
 * Inspects and summarizes the user's active draft itinerary when asked.
 */
function handleItineraryInspectionIntent(
  message: string,
  pageContext?: PageContextSnapshot,
): CopilotResponse | null {
  const norm = normalizeText(message);
  const asksCurrentPlan =
    norm.includes('lich trinh hien tai') ||
    (norm.includes('lich trinh cua toi') &&
      (norm.includes('nhung diem nao') || norm.includes('di dau') || norm.includes('co gi'))) ||
    ((norm.includes('ngay 1') || norm.includes('ngay 2') || norm.includes('ngay 3') || norm.includes('hom nay')) &&
      (norm.includes('di dau') || norm.includes('nhung diem nao') || norm.includes('co nhung diem')));

  if (!asksCurrentPlan) return null;

  const dayMatch = message.match(/ng[àa]y\s*(\d+)/i);
  const requestedDay = dayMatch?.[1] ? Number(dayMatch[1]) : undefined;
  return buildItinerarySummaryResponse(pageContext, requestedDay);
}

/**
 * Deterministic Smart Agent ("Pé Meko") for full system control, slot-filling, and live DOM actions.
 */
function handleSmartIntent(
  message: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  catalog: DestinationSummary[],
  pageContext?: PageContextSnapshot,
): CopilotResponse | null {
  const normalized = normalizeText(message);
  const lastAssistantMsg = [...history].reverse().find((h) => h.role === 'assistant')?.content || '';
  const lastAssistantNorm = normalizeText(lastAssistantMsg);

  // ============================================================================
  // 0. PROFILE CONTROL: CHANGE DISPLAY NAME, PREFERENCES, PASSWORD, LOGOUT
  // ============================================================================
  const isChangeNameTrigger =
    normalized.includes('doi ten hien thi') ||
    normalized.includes('sua ten hien thi') ||
    normalized.includes('cap nhat ten hien thi') ||
    normalized.includes('doi ten tai khoan') ||
    normalized.includes('doi ten toi') ||
    normalized.includes('doi ten thanh') ||
    normalized.includes('dat ten hien thi');

  const isFollowUpChangeName = lastAssistantNorm.includes('muon doi ten hien thi thanh ten gi');

  if (isChangeNameTrigger || isFollowUpChangeName) {
    let newName: string | undefined;

    if (isFollowUpChangeName && !isChangeNameTrigger) {
      newName = message.replace(/^["']|["']$/g, '').trim();
    } else {
      const nameMatch = message.match(
        /(?:đ[ổo]i|s[ửu]a|c[ậa]p\s*nh[ậa]t|đ[ặa]t)\s*t[êe]n(?:\s*hi[ểe]n\s*th[ịi]|\s*t[àa]i\s*kho[ảa]n|\s*c[ủu]a\s*t[ôo]i|\s*t[ôo]i)?\s*(?:th[àa]nh|sang|l[àa]|:|=)\s*["']?([^"'\n.!?]+)["']?/i,
      );
      if (nameMatch?.[1]) {
        newName = nameMatch[1].trim();
      }
    }

    if (!newName || newName.length < 2) {
      return {
        reply:
          `Dạ **Pé Meko** có thể đổi **Tên hiển thị** trực tiếp trên hệ thống cho bạn ngay! 🦊✨\n\n` +
          `Bạn **muốn đổi tên hiển thị thành tên gì** ạ? (Tối thiểu 2 ký tự, ví dụ: \`Thịnh Raccoon\` hoặc \`Lê Văn Thịnh\`).\n` +
          `Bạn chỉ cần gõ tên mới vào khung chat là Pé Meko cập nhật ngay!`,
        action: {
          type: 'ASK_CLARIFICATION',
          payload: {
            missingFields: ['newDisplayName'],
            contextType: 'update_profile',
          },
        },
        suggestions: [
          'Đổi tên hiển thị thành Thịnh Raccoon',
          'Đổi tên hiển thị thành Lê Văn Thịnh',
        ],
      };
    }

    return {
      reply:
        `Dạ rõ! 🦊 **Pé Meko** đang mở trang **Cá nhân**, cập nhật tên hiển thị mới là **${newName}** và lưu trực tiếp vào tài khoản của bạn ngay đây ạ!`,
      action: {
        type: 'UPDATE_PROFILE',
        payload: {
          path: '/account',
          label: `Đổi tên hiển thị → "${newName}"`,
          newDisplayName: newName,
        },
      },
      suggestions: ['Xem Hộ chiếu số', 'Mở trang Yêu thích', 'Lập lịch trình 2 ngày'],
    };
  }

  // Change Password Control
  const isChangePassTrigger =
    normalized.includes('doi mat khau') ||
    normalized.includes('thay doi mat khau') ||
    normalized.includes('cap nhat mat khau');

  if (isChangePassTrigger) {
    const passPairMatch = message.match(
      /(?:t[ừu]|c[ũu]|hi[ệe]n\s*t[ạa]i)\s*(?:l[àa]|:)?\s*(\S+)\s+(?:th[àa]nh|sang|m[ớo]i(?:\s*l[àa]|:)?)\s*(\S+)/i,
    );
    if (!passPairMatch?.[1] || !passPairMatch?.[2]) {
      return {
        reply:
          `Dạ để **Pé Meko** đổi mật khẩu tài khoản giúp bạn, bạn cho Pé Meko biết:\n` +
          `• 🔑 **Mật khẩu hiện tại**\n` +
          `• 🔐 **Mật khẩu mới** (tối thiểu 6 ký tự)\n\n` +
          `Ví dụ bạn nhắn: *"Đổi mật khẩu từ 123456 thành 654321"* nhé! 🦊`,
        action: {
          type: 'ASK_CLARIFICATION',
          payload: {
            missingFields: ['currentPassword', 'newPassword'],
            contextType: 'change_password',
          },
        },
        suggestions: ['Mở trang Cá nhân', 'Xem Hộ chiếu số'],
      };
    }

    return {
      reply:
        `Dạ **Pé Meko** đang mở trang **Cá nhân** và cập nhật mật khẩu mới cho tài khoản của bạn ngay đây ạ! 🦊🔐`,
      action: {
        type: 'UPDATE_PROFILE',
        payload: {
          path: '/account',
          label: 'Cập nhật mật khẩu mới',
          currentPassword: passPairMatch[1],
          newPassword: passPairMatch[2],
        },
      },
      suggestions: ['Mở trang Cá nhân', 'Xem Hộ chiếu số'],
    };
  }

  // Logout Control
  if (
    normalized === 'dang xuat' ||
    normalized.includes('dang xuat tai khoan') ||
    normalized.includes('thoat tai khoan') ||
    normalized === 'logout'
  ) {
    return {
      reply: `Dạ **Pé Meko** đang thực hiện **Đăng xuất** tài khoản khỏi phiên làm việc hiện tại cho bạn ngay đây ạ! 🦊👋`,
      action: {
        type: 'LOGOUT_ACCOUNT',
        payload: {
          path: '/',
          label: 'Đăng xuất tài khoản',
        },
      },
      suggestions: ['Đăng nhập tài khoản', 'Khám phá địa điểm'],
    };
  }

  // Save Draft Itinerary to Account
  if (
    normalized.includes('luu lich trinh') ||
    normalized.includes('luu ban nhap') ||
    normalized.includes('luu chuyen di')
  ) {
    const titleMatch = message.match(/(?:t[êe]n(?:\s*l[àa])?|v[ớo]i\s*t[êe]n)\s*["']?([^"'\n]+)["']?/i);
    const customTitle = titleMatch?.[1]?.trim();
    return {
      reply:
        `Dạ **Pé Meko** đang tự động lưu lịch trình hiện tại vào tài khoản của bạn${customTitle ? ` với tên **"${customTitle}"**` : ''} và mở trang chi tiết hành trình ngay nhé! 🦊💾`,
      action: {
        type: 'SAVE_ITINERARY',
        payload: {
          path: '/my-itineraries',
          label: customTitle ? `Lưu lịch trình "${customTitle}"` : 'Lưu lịch trình vào tài khoản',
          itineraryTitle: customTitle,
        },
      },
      suggestions: ['Xem danh sách lịch trình đã lưu', 'Mở Hộ chiếu số'],
    };
  }

  // Favorites / Bookmark Destination Control
  const isFavoriteActionTrigger =
    normalized.includes('them vao yeu thich') ||
    normalized.includes('luu yeu thich') ||
    normalized.includes('thich dia diem') ||
    normalized.includes('bo yeu thich') ||
    normalized.includes('xoa khoi yeu thich') ||
    ((normalized.includes('them ') ||
      normalized.includes('luu ') ||
      normalized.includes('bo ') ||
      normalized.includes('xoa ')) &&
      normalized.includes('yeu thich'));

  if (isFavoriteActionTrigger) {
    const isRemove =
      normalized.includes('bo yeu thich') ||
      normalized.includes('xoa khoi yeu thich') ||
      normalized.startsWith('bo ') ||
      normalized.startsWith('xoa ');
    const targetDest = findDestinationByText(message, catalog);
    if (!targetDest) {
      return {
        reply:
          `Dạ bạn muốn **Pé Meko** ${isRemove ? 'bỏ lưu' : 'lưu'} địa điểm nào vào danh sách **Yêu thích** ạ? Bạn cho Pé Meko xin tên địa điểm nhé (ví dụ: *Bảo tàng Tổng hợp Đồng Tháp*, *Làng hoa Sa Đéc*)! 🦊❤️`,
        action: {
          type: 'ASK_CLARIFICATION',
          payload: {
            missingFields: ['destinationName'],
            contextType: 'general',
          },
        },
        suggestions: [
          'Lưu yêu thích Bảo tàng Tổng hợp Đồng Tháp',
          'Lưu yêu thích Làng hoa Sa Đéc',
          'Mở trang Địa điểm yêu thích',
        ],
      };
    }

    return {
      reply:
        `Dạ **Pé Meko** đang tự động ${isRemove ? 'bỏ lưu' : 'thêm'} **${targetDest.name}** ${isRemove ? 'khỏi' : 'vào'} bộ sưu tập **Địa điểm yêu thích** của bạn! 🦊❤️`,
      action: {
        type: 'TOGGLE_FAVORITE',
        payload: {
          path: '/favorites',
          label: `${isRemove ? 'Bỏ yêu thích' : 'Lưu yêu thích'}: ${targetDest.name}`,
          destinationId: targetDest.id,
          destinationSlug: targetDest.slug,
          destinationName: targetDest.name,
          favoriteMode: isRemove ? 'remove' : 'add',
        },
      },
      suggestions: ['Mở trang Địa điểm yêu thích', `Xem chi tiết ${targetDest.name}`],
    };
  }

  // Sync Guest Passport to Account
  if (
    normalized.includes('dong bo ho chieu') ||
    normalized.includes('gop ho chieu') ||
    ((normalized.includes('dong bo') || normalized.includes('gop ')) && normalized.includes('ho chieu'))
  ) {
    return {
      reply:
        `Dạ **Pé Meko** đang đồng bộ toàn bộ dữ liệu Hộ chiếu trải nghiệm trên trình duyệt này vào tài khoản của bạn ngay! 🦊🛂`,
      action: {
        type: 'SYNC_PASSPORT',
        payload: {
          path: '/passport',
          label: 'Đồng bộ Hộ chiếu số vào tài khoản',
        },
      },
      suggestions: ['Xem Hộ chiếu số', 'Điểm danh GPS ngay'],
    };
  }

  // ============================================================================
  // 1. STOP SWAP, MULTI-TURN PICKER, REMOVE STOP & ITINERARY INSPECTION
  // ============================================================================
  const pendingSwapFollowUp = handlePendingSwapFollowUp(message, catalog, pageContext);
  if (pendingSwapFollowUp) {
    return pendingSwapFollowUp;
  }

  const smartSwapResult = handleSmartSwapIntent(message, history, catalog, pageContext);
  if (smartSwapResult) {
    return smartSwapResult;
  }

  const removeStopResult = handleRemoveStopIntent(message, pageContext);
  if (removeStopResult) {
    return removeStopResult;
  }

  const itineraryInspectionResult = handleItineraryInspectionIntent(message, pageContext);
  if (itineraryInspectionResult) {
    return itineraryInspectionResult;
  }

  // ============================================================================
  // 2. ACCOUNT REGISTRATION / AUTH CONTROL (Requirement #3 & #4)
  // ============================================================================
  const isRegisterTrigger =
    normalized.includes('tao tai khoan') ||
    normalized.includes('tao mot tai khoan') ||
    normalized.includes('tao 1 tai khoan') ||
    normalized.includes('dang ky tai khoan') ||
    normalized.includes('lap tai khoan') ||
    normalized.includes('register');

  const isFollowUpRegister =
    lastAssistantNorm.includes('email dang ky') || lastAssistantNorm.includes('tao tai khoan giup ban');

  if (isRegisterTrigger || isFollowUpRegister) {
    const combinedText = isFollowUpRegister
      ? [...history.slice(-4).filter((h) => h.role === 'user').map((h) => h.content), message].join(' & ')
      : message;

    const { email, password, displayName } = extractAuthSlots(combinedText);
    const missing: string[] = [];
    if (!email) missing.push('Email');
    if (!password) missing.push('Mật khẩu');

    if (missing.length > 0) {
      return {
        reply:
          `Dạ được luôn ạ! 🦊 Để **Pé Meko** tự động mở trang Đăng ký và tạo tài khoản giúp bạn, bạn cho Pé Meko xin thêm **${missing.join(' và ')}** nhé:\n\n` +
          `${email ? `✅ **Email**: \`${email}\`` : '❓ **Email đăng ký**: (ví dụ: `dukhach@gmail.com`)'}\n` +
          `${password ? `✅ **Mật khẩu**: \`••••••\`` : '❓ **Mật khẩu**: (tối thiểu 6 ký tự, ví dụ: `123456`)'}\n\n` +
          `Bạn chỉ cần nhắn tiếp phần còn thiếu là Pé Meko làm ngay!`,
        action: {
          type: 'ASK_CLARIFICATION',
          payload: {
            missingFields: missing,
            contextType: 'register',
          },
        },
        suggestions: ['Mật khẩu là DongThap123', 'Mở trang đăng nhập'],
      };
    }

    const derivedName = displayName || email!.split('@')[0] || 'Du khách Đồng Tháp';
    const safeDisplayName = derivedName.length >= 2 ? derivedName : `${derivedName} DT`;
    const targetPath = '/register';

    return {
      reply:
        `Dạ rõ! 🦊 **Pé Meko** đang mở ngay trang Đăng ký, tự động điền thông tin tài khoản và khởi tạo cho bạn:\n\n` +
        `• 👤 **Tên hiển thị**: \`${safeDisplayName}\`\n` +
        `• 📧 **Email**: \`${email}\`\n` +
        `• 🔑 **Mật khẩu**: \`••••••••\`\n\n` +
        `🚀 *Pé Meko đang tự động nhấn nút Đăng ký & Đăng nhập vào hệ thống cho bạn ngay trên màn hình!*`,
      action: {
        type: 'REGISTER_ACCOUNT',
        payload: {
          path: targetPath,
          label: `Tạo tài khoản ${email}`,
          email: email!,
          password: password!,
          displayName: safeDisplayName,
        },
      },
      suggestions: ['Mở Hộ chiếu số', 'Lập lịch trình 2 ngày 2 người chi phí 2 triệu', 'Khám phá địa điểm'],
    };
  }

  // Check Login trigger
  const isLoginTrigger =
    normalized.includes('dang nhap') ||
    normalized.includes('login') ||
    (normalized.includes('vao tai khoan') && !normalized.includes('luu'));

  if (isLoginTrigger) {
    const { email, password } = extractAuthSlots(message);
    if (email && password) {
      return {
        reply:
          `Dạ **Pé Meko** đang mở trang Đăng nhập, điền sẵn email \`${email}\` & mật khẩu và tự động đăng nhập cho bạn ngay đây ạ! 🦊✨`,
        action: {
          type: 'LOGIN_ACCOUNT',
          payload: {
            path: '/login',
            label: `Đăng nhập ${email}`,
            email,
            password,
          },
        },
        suggestions: ['Mở trang cá nhân', 'Xem Hộ chiếu số'],
      };
    }

    return {
      reply:
        `Dạ **Pé Meko** đã mở trang **Đăng nhập** cho bạn rồi ạ! 🦊\n` +
        `Nếu muốn Pé Meko tự điền và đăng nhập luôn, bạn nhắn giúp Pé Meko **Email** và **Mật khẩu** nhé!`,
      action: {
        type: 'OPEN_PAGE',
        payload: {
          path: '/login',
          label: 'Trang Đăng nhập',
        },
      },
      suggestions: ['Khám phá địa điểm', 'Lập lịch trình 2 ngày 2 người chi phí 2 triệu'],
    };
  }

  // ============================================================================
  // 3. ITINERARY PLANNING WITH SLOT-FILLING (Requirement #1 & #4)
  // ============================================================================
  const isPlanTrigger =
    normalized.includes('lap lich trinh') ||
    normalized.includes('tao lich trinh') ||
    normalized.includes('len lich trinh') ||
    normalized.includes('itinerary');

  const isFollowUpPlan =
    lastAssistantNorm.includes('so ngay di') ||
    lastAssistantNorm.includes('ngan sach du kien') ||
    lastAssistantNorm.includes('thong tin con thieu de pe meko lap lich trinh');

  const currentSlots = extractItinerarySlots(message);
  const hasAllSlotsInCurrent = Boolean(currentSlots.days && currentSlots.people && currentSlots.budgetVnd);
  const hasTwoSlotsWithTripIntent =
    Boolean(
      (currentSlots.days && currentSlots.people) ||
        (currentSlots.days && currentSlots.budgetVnd) ||
        (currentSlots.people && currentSlots.budgetVnd),
    ) &&
    (normalized.includes('di ') ||
      normalized.includes('ngay') ||
      normalized.includes('nguoi') ||
      normalized.includes('ngan sach') ||
      normalized.includes('chi phi'));

  if (isPlanTrigger || isFollowUpPlan || hasAllSlotsInCurrent || hasTwoSlotsWithTripIntent) {
    let accDays = currentSlots.days;
    let accPeople = currentSlots.people;
    let accBudget = currentSlots.budgetVnd;

    if (isFollowUpPlan || isPlanTrigger || hasTwoSlotsWithTripIntent) {
      for (const h of [...history].reverse().slice(0, 4)) {
        if (h.role === 'user') {
          const prev = extractItinerarySlots(h.content);
          if (!accDays && prev.days) accDays = prev.days;
          if (!accPeople && prev.people) accPeople = prev.people;
          if (!accBudget && prev.budgetVnd) accBudget = prev.budgetVnd;
        }
      }
    }

    const missingSlots: string[] = [];
    if (!accDays) missingSlots.push('Số ngày đi (ví dụ: 2 ngày)');
    if (!accPeople) missingSlots.push('Số người tham gia (ví dụ: 2 người)');
    if (!accBudget) missingSlots.push('Ngân sách dự kiến (ví dụ: 2 triệu)');

    if (missingSlots.length > 0) {
      return {
        reply:
          `Dạ **Pé Meko** rất sẵn lòng lập lịch trình tự động trên web cho bạn! 🦊✨\n\n` +
          `Hiện tại Pé Meko đã ghi nhận:\n` +
          `• 📅 **Số ngày**: ${accDays ? `**${accDays} ngày** ✅` : '*Chưa có — bạn muốn đi mấy ngày ạ?*'}\n` +
          `• 👥 **Số người**: ${accPeople ? `**${accPeople} người** ✅` : '*Chưa có — đoàn mình đi mấy người ạ?*'}\n` +
          `• 💰 **Chi phí (Ngân sách)**: ${accBudget ? `**${accBudget.toLocaleString('vi-VN')}đ** ✅` : '*Chưa có — ngân sách khoảng bao nhiêu ạ?*'}\n\n` +
          `Bạn cho Pé Meko xin nốt **thông tin còn thiếu để Pé Meko lập lịch trình** tự động từ A–Z luôn nhé!`,
        action: {
          type: 'ASK_CLARIFICATION',
          payload: {
            missingFields: missingSlots,
            contextType: 'itinerary',
          },
        },
        suggestions: [
          'Lập lịch trình đi 2 ngày cho 2 người với chi phí 2 tr',
          'Đi 3 ngày cho 4 người ngân sách 5 triệu',
          '2 người với ngân sách 2 triệu',
        ],
      };
    }

    const d = accDays!;
    const p = accPeople!;
    const b = accBudget!;
    const runId = Date.now();

    return {
      reply:
        `Dạ đủ thông tin rồi ạ! 🦊 **Pé Meko** đang tự động điền biểu mẫu (**${d} ngày · ${p} người · ngân sách ${b.toLocaleString('vi-VN')}đ**) và **trực tiếp kích hoạt AI Trip Planner V9** lập lịch trình chi tiết cho bạn ngay trên màn hình!\n\n` +
        `💡 *Mẹo nhỏ*: Sau khi lịch hiện ra, bạn có thể bảo Pé Meko *"Đổi địa điểm..."* hoặc *"Lưu lịch trình này vào tài khoản"* nhé!`,
      action: {
        type: 'PLAN_ITINERARY',
        payload: {
          path: `/itinerary/create?days=${d}&people=${p}&budget=${b}&autoPlan=true&run=${runId}#plan`,
          label: `Tự động lập lịch trình ${d} ngày (${p} người, ${(b / 1_000_000).toLocaleString('vi-VN')}tr)`,
          days: d,
          people: p,
          budgetVnd: b,
        },
      },
      suggestions: [
        'Đổi địa điểm Trà mật ong Kỳ Lân trong lộ trình ngày 1 thành tham quan Bảo tàng Tổng hợp Đồng Tháp',
        'Lưu lịch trình này vào tài khoản',
      ],
    };
  }

  // ============================================================================
  // 4. PROJECT & PLATFORM KNOWLEDGE BASE (FAQs & Comprehensive Guidance)
  // ============================================================================
  if (
    normalized.includes('du an nay la gi') ||
    normalized.includes('du an dong thap') ||
    normalized.includes('dong thap smart travel') ||
    normalized.includes('dtst') ||
    normalized.includes('website nay la gi') ||
    normalized.includes('web nay la gi') ||
    normalized.includes('web nay lam gi') ||
    normalized.includes('gioi thieu web') ||
    normalized.includes('gioi thieu du an') ||
    normalized.includes('he thong nay lam gi') ||
    normalized.includes('co nhung tinh nang nao') ||
    normalized.includes('tinh nang cua web')
  ) {
    return {
      reply:
        `Chào bạn! Nền tảng này là **Đồng Tháp Smart Travel (DTST)** 🦊🌸 — Hệ sinh thái Du lịch Thông minh & Hộ chiếu Trải nghiệm số tỉnh Đồng Tháp!\n\n` +
        `Dự án mang đến các tiện ích số hóa du lịch hiện đại nhất:\n` +
        `• 🗺️ **Số hóa 58+ điểm đến**: Phân loại chi tiết di tích lịch sử, văn hóa, sinh thái, ẩm thực và tích hợp bản đồ vệ tinh/chỉ đường trực tiếp.\n` +
        `• 🧭 **AI Trip Planner V9**: Lập lịch trình du lịch thông minh, tự động tối ưu tuyến đường, quản lý chi phí và thời gian mở cửa.\n` +
        `• 🛂 **Hộ chiếu Trải nghiệm số**: Hệ thống tích điểm gamification — du khách check-in các điểm đến, thu thập con dấu số và mở khóa các danh hiệu độc quyền.\n` +
        `• 📍 **Điểm danh GPS & Quét QR**: Xác thực ghé thăm thực tế bằng tọa độ GPS hoặc quét mã QR bảng thông tin.\n` +
        `• 🦊 **Pé Meko**: Trợ lý AI thế hệ mới vừa tư vấn du lịch vừa có khả năng điều khiển website trực tiếp cho bạn!`,
      action: {
        type: 'OPEN_PAGE',
        payload: { path: '/destinations', label: 'Khám phá 58+ Điểm đến' },
      },
      suggestions: [
        'Hộ chiếu số là gì và cách tích điểm?',
        'Danh sách các chùa nổi tiếng',
        'Lập lịch trình 2 ngày cho 2 người chi phí 2 tr',
        'Đặc sản Đồng Tháp có gì ngon?',
      ],
    };
  }

  // Question: Who is Pé Meko / Greeting / Help
  if (
    normalized === 'xin chao' ||
    normalized === 'chao' ||
    normalized === 'hello' ||
    normalized === 'hi' ||
    normalized === 'chao pe meko' ||
    normalized === 'pe meko oi' ||
    normalized.includes('pe meko la ai') ||
    normalized.includes('ban la ai') ||
    normalized.includes('ban lam duoc gi') ||
    normalized.includes('huong dan su dung')
  ) {
    return {
      reply:
        `Chào bạn! Mình là **Pé Meko** 🦊 — Hướng dẫn viên & Trợ lý AI điều khiển toàn diện của **Đồng Tháp Smart Travel**!\n\n` +
        `Bạn có thể trò chuyện hoặc giao việc trực tiếp cho Pé Meko:\n` +
        `• 🔍 **Tìm kiếm & Lọc danh sách**: *"Danh sách các chùa"*, *"Các điểm sinh thái"*, *"Địa điểm ở Sa Đéc"*...\n` +
        `• 🧭 **Tự động lập lịch trình**: *"Lập lịch trình đi 2 ngày cho 2 người với chi phí 2 tr"*\n` +
        `• 🔄 **Đổi điểm trong lộ trình**: *"Đổi địa điểm A trong lộ trình ngày 1 thành B"*\n` +
        `• 👤 **Điều khiển tài khoản**: *"Đổi tên hiển thị thành..."*, *"Lưu yêu thích..."*, *"Đồng bộ hộ chiếu số"*\n` +
        `• 💬 **Hỏi đáp dự án & du lịch**: Hỏi về Hộ chiếu số, Điểm danh GPS, mùa nước nổi, ẩm thực Đồng Tháp!`,
      suggestions: [
        'Danh sách các chùa',
        'Dự án này là gì và có những tính năng nào?',
        'Lập lịch trình đi 2 ngày cho 2 người với chi phí 2 tr',
        'Đồng Tháp mùa nào đi đẹp nhất và có đặc sản gì ngon?',
      ],
    };
  }

  // Question: What is Digital Passport & How to earn stamps/points?
  if (
    normalized.includes('ho chieu so la gi') ||
    normalized.includes('ho chieu trai nghiem so') ||
    normalized.includes('cach tich diem') ||
    normalized.includes('tich diem nhan huy hieu') ||
    normalized.includes('con dau so') ||
    normalized.includes('kiem diem thuong') ||
    normalized.includes('lam sao co huy hieu') ||
    normalized.includes('lam sao de co huy hieu') ||
    normalized.includes('lam sao de duoc tich diem')
  ) {
    return {
      reply:
        `Dạ **Hộ chiếu Trải nghiệm số (Digital Passport)** 🛂 là tính năng tương tác du lịch đặc biệt của Đồng Tháp Smart Travel:\n\n` +
        `1️⃣ **Thu thập Con dấu số**: Mỗi khi bạn ghé thăm một di tích, danh lam hay quán ăn đặc sản trên địa bàn Đồng Tháp, bạn có thể thực hiện **Điểm danh GPS** hoặc **Quét mã QR** để nhận 1 con dấu số độc bản.\n` +
        `2️⃣ **Tích lũy Điểm thưởng & Cấp bậc**: Mỗi con dấu sẽ cộng điểm kinh nghiệm (XP) cho tài khoản của bạn.\n` +
        `3️⃣ **Mở khóa Huy hiệu**: Tích lũy đủ các điểm theo chủ đề sẽ mở khóa các danh hiệu danh giá như *Thổ địa Sen Hồng*, *Tín đồ Miền Tây*, *Nhà khám phá di sản*...\n\n` +
        `Pé Meko đang mở trang **Hộ chiếu số** để bạn kiểm tra bộ sưu tập con dấu của mình ngay nhé! 🦊✨`,
      action: {
        type: 'OPEN_PAGE',
        payload: { path: '/passport', label: 'Hộ chiếu số của bạn' },
      },
      suggestions: ['Điểm danh GPS ngay (/check-in)', 'Danh sách các chùa', 'Đồng bộ hộ chiếu số vào tài khoản của tôi'],
    };
  }

  // Question: How does GPS Check-in & QR Scan work?
  if (
    normalized.includes('diem danh gps la gi') ||
    normalized.includes('diem danh nhu the nao') ||
    normalized.includes('diem danh gps hoat dong') ||
    normalized.includes('cach diem danh') ||
    normalized.includes('quet qr nhu the nao') ||
    normalized.includes('check in nhu the nao') ||
    normalized.includes('quet ma qr o dau')
  ) {
    return {
      reply:
        `Dạ tính năng **Điểm danh GPS & Quét mã QR** giúp bạn chứng thực chuyến đi thực tế để nhận con dấu Hộ chiếu số:\n\n` +
        `• 📍 **Cách 1: Điểm danh GPS**: Khi bạn đang có mặt tại điểm đến (trong bán kính hợp lệ), chỉ cần bấm nút *"Điểm danh GPS"* trên điện thoại, hệ thống sẽ tự động đối soát tọa độ và trao ngay con dấu!\n` +
        `• 📷 **Cách 2: Quét mã QR**: Bạn dùng camera trên trang web quét mã QR vật lý gắn tại bảng chỉ dẫn ở điểm tham quan để xác thực tức thì.\n\n` +
        `Pé Meko mở sẵn trang **Điểm danh GPS / Quét QR** cho bạn đây ạ! 🦊📍`,
      action: {
        type: 'OPEN_PAGE',
        payload: { path: '/check-in', label: 'Điểm danh GPS & Quét QR' },
      },
      suggestions: ['Xem Hộ chiếu số (/passport)', 'Khám phá các điểm tham quan', 'Lập lịch trình AI'],
    };
  }

  // Feature: Real-time Safety Guardian (Weather, Accidents, Landslides & Safe Alternatives)
  if (
    normalized.includes('thoi tiet') ||
    normalized.includes('sat lo') ||
    normalized.includes('tai nan') ||
    normalized.includes('su co') ||
    normalized.includes('ngap lut') ||
    normalized.includes('mua bao') ||
    normalized.includes('an toan lich trinh') ||
    normalized.includes('kiem tra duong di')
  ) {
    return {
      reply:
        `🛡️ **Hệ thống Cảnh báo Thời tiết & Sự cố Thời gian thực (Smart Safety Guardian)** đang bật trực tiếp trên trang **Lập lịch trình V9**!\n\n` +
        `Hệ thống tự động:\n` +
        `• 🌦️ Quét thời tiết thực tế (Open-Meteo Live) tại từng tọa độ điểm dừng trong lịch trình.\n` +
        `• 🚧 Phát hiện tai nạn giao thông, đóng đường hoặc cảnh báo **sạt lở đất đá** ở khu vực núi đèo.\n` +
        `• 🔄 Tự động gợi ý & **Đổi 1 chạm sang điểm đến an toàn** *(ví dụ: chuyển sang điểm trong nhà có mái che khi mưa bão, hoặc vùng đồng bằng an toàn nếu có sạt lở)*.\n\n` +
        `Pé Meko đang mở ngay màn hình Lịch trình để bạn xem báo cáo an toàn hoặc bấm thử chế độ **Mô phỏng sự cố** nhé! 🦊🛡️`,
      action: {
        type: 'OPEN_PAGE',
        payload: { path: '/itinerary/create#plan', label: 'Mở Cảnh báo Thời tiết & Sự cố Lịch trình' },
      },
      suggestions: [
        'Lập lịch trình đi 2 ngày cho 2 người với chi phí 2 tr',
        'Khám phá các điểm trong nhà (Bảo tàng, Nhà cổ)',
      ],
    };
  }

  // Feature: AI Visual Vibe Search Guide
  if (
    normalized.includes('tim bang anh') ||
    normalized.includes('tim theo anh') ||
    normalized.includes('tim diem bang hinh') ||
    normalized.includes('tim diem bang anh') ||
    normalized.includes('bang hinh anh') ||
    normalized.includes('up anh') ||
    normalized.includes('gui anh') ||
    normalized.includes('chup anh tim') ||
    normalized.includes('khung canh tuong tu') ||
    normalized.includes('giong anh nay')
  ) {
    return {
      reply:
        `📸 **Tính năng Tìm điểm đến bằng Hình ảnh (AI Visual Vibe Search)** đã sẵn sàng!\n\n` +
        `Bạn chỉ cần bấm nút **📷 Tải ảnh lên** ngay cạnh ô nhập tin nhắn ở góc dưới khung chat này *(hoặc nút **Tìm bằng hình ảnh** trên trang Khám phá)* và chọn 1 bức ảnh bất kỳ *(ví dụ: ảnh biển Phú Quốc, núi non, vườn hoa hay chùa cổ)*.\n\n` +
        `✨ AI Vision của **Pé Meko** sẽ tự động đọc hiểu khung cảnh, phân tích vibe và tìm ngay những địa điểm có cảnh sắc tương đồng **gần vị trí bạn nhất**! 🦊📷`,
      action: {
        type: 'OPEN_PAGE',
        payload: { path: '/destinations', label: 'Mở trang Khám phá (Tìm bằng ảnh)' },
      },
      suggestions: ['Danh sách bãi biển gần bạn', 'Danh sách các chùa', 'Làng hoa Sa Đéc'],
    };
  }

  // Question: Combined or Individual Travel Seasons & Food Specialties Q&A
  const asksSeason =
    normalized.includes('mua nao di dep') ||
    normalized.includes('mua nao dep') ||
    normalized.includes('mua nao di dong thap') ||
    normalized.includes('thang may di dong thap') ||
    normalized.includes('thoi diem du lich') ||
    normalized.includes('mua nuoc noi');

  const asksFood =
    normalized.includes('dac san') ||
    normalized.includes('an gi o dong thap') ||
    normalized.includes('mon an ngon') ||
    normalized.includes('am thuc dong thap') ||
    normalized.includes('mon ngon');

  if (asksSeason && asksFood) {
    const foodSpots = catalog.filter((c) => c.category === 'food').slice(0, 5);
    return {
      reply:
        `Dạ **Pé Meko** bật mí trọn bộ **Thời điểm du lịch đẹp nhất** và **Đặc sản trứ danh** của Đồng Tháp cho bạn đây ạ! 🦊🌸🍲\n\n` +
        `🌿 **3 Thời điểm vàng nên ghé Đồng Tháp:**\n` +
        `1. 🌊 **Mùa nước nổi (Tháng 9 – 11 âm lịch)**: Vườn quốc gia Tràm Chim & Gáo Giồng ngập nước, chim trời bay rợp bóng, bông điên điển nở vàng rực.\n` +
        `2. 🌸 **Mùa hoa Tết Sa Đéc (Tháng 12 âm lịch / giáp Tết)**: Làng hoa Sa Đéc rực rỡ sắc xuân lớn nhất miền Tây.\n` +
        `3. 🪷 **Mùa sen nở (Tháng 5 – 8 dương lịch)**: Đồng sen Tháp Mười ngát hương, chèo xuồng ngắm sen tuyệt đẹp.\n\n` +
        `🍲 **5 Đặc sản ngon quên lối về:**\n` +
        `1. 🐟 **Cá lóc nướng trui cuốn lá sen non** chấm mắm me chua ngọt.\n` +
        `2. 🥢 **Hủ tiếu Sa Đéc** sợi bánh mềm dai, nước lèo thanh ngọt.\n` +
        `3. 🥓 **Nem Lai Vung** chua ngọt cay nhẹ đặc trưng.\n` +
        `4. 🥞 **Bánh xèo Cao Lãnh & Vịt nướng Sa Đéc** ăn kèm rau đồng nội.\n` +
        `5. 🌸 **Ẩm thực từ Sen**: Cơm gói lá sen, gỏi ngó sen tôm thịt, sữa hạt sen.`,
      action: {
        type: 'FILTER',
        payload: { path: '/destinations?category=food', label: 'Đặc sản & Ẩm thực Đồng Tháp' },
      },
      matchedDestinations: foodSpots,
      suggestions: [
        'Lập lịch trình đi 2 ngày cho 2 người với chi phí 2 tr',
        'Danh sách các chùa',
        'Mở Vườn quốc gia Tràm Chim',
      ],
    };
  }

  if (asksFood) {
    const foodSpots = catalog.filter((c) => c.category === 'food').slice(0, 6);
    return {
      reply:
        `Về Đồng Tháp xứ Sen Hồng là phải thưởng thức ngay các món đặc sản trứ danh này bạn nhé! 🦊🍲\n\n` +
        `1. 🐟 **Cá lóc nướng trui cuốn lá sen non**: Vị bùi chát nhẹ của sen non hòa cùng thịt cá thơm lừng chấm mắm me chua ngọt.\n` +
        `2. 🥢 **Hủ tiếu Sa Đéc**: Sợi bánh dai mềm đặc trưng xứ bột Sa Đéc, nước dùng thanh ngọt đậm đà.\n` +
        `3. 🥓 **Nem Lai Vung**: Đủ vị chua, cay, mặn, ngọt trứ danh vùng Lai Vung.\n` +
        `4. 🦆 **Vịt nướng Sa Đéc / Bánh xèo Cao Lãnh**: Thơm nức mũi với các loại rau đồng nội tươi ngon.\n` +
        `5. 🌸 **Món ngon từ Sen Tháp Mười**: Cơm hấp lá sen, gỏi ngó sen tôm thịt, chè sen, sữa hạt sen thơm mát bổ dưỡng.\n\n` +
        `Pé Meko đã lọc sẵn **${foodSpots.length}+ địa điểm ẩm thực** trên màn hình cho bạn chọn quán ngon ghé ăn ngay nhé!`,
      action: {
        type: 'FILTER',
        payload: { path: '/destinations?category=food', label: 'Ẩm thực Đồng Tháp' },
      },
      matchedDestinations: foodSpots,
      suggestions: [
        'Lập lịch trình đi 2 ngày cho 2 người với chi phí 2 tr',
        'Danh sách các chùa',
        'Mùa nào đi Đồng Tháp đẹp nhất?',
      ],
    };
  }

  if (asksSeason) {
    return {
      reply:
        `Đồng Tháp mùa nào cũng có vẻ đẹp riêng, nhưng **3 thời điểm vàng** dưới đây là lý tưởng nhất bạn nên ghé: 🦊🌿\n\n` +
        `1. 🌊 **Mùa nước nổi (Tháng 9 – 11 âm lịch)**: Thời điểm đẹp nhất năm! Vườn quốc gia Tràm Chim và Gáo Giồng ngập nước, chim trời bay rợp bóng, hoa sen, hoa súng và điên điển nở vàng rực.\n` +
        `2. 🌸 **Mùa hoa Tết Sa Đéc (Tháng 12 âm lịch / giáp Tết)**: Làng hoa Sa Đéc bước vào vụ hoa xuân lớn nhất miền Tây, bạt ngàn cúc mâm xôi, thược dược rực rỡ sắc màu.\n` +
        `3. 🪷 **Mùa sen nở (Mùa hè, tháng 5 – 8)**: Khu du lịch Đồng Sen Tháp Mười ngát hương, du khách có thể chèo xuồng giữa đồng sen và chụp ảnh áo bà ba cực thơ mộng.\n\n` +
        `Bạn đã có ngày dự kiến chưa? Hãy để Pé Meko lập lịch trình tự động tối ưu nhất cho bạn nhé!`,
      action: {
        type: 'OPEN_PAGE',
        payload: { path: '/itinerary/create', label: 'Lập lịch trình AI' },
      },
      suggestions: [
        'Lập lịch trình 2 ngày cho 2 người với chi phí 2 tr',
        'Mở Vườn quốc gia Tràm Chim',
        'Mở Làng hoa Sa Đéc',
      ],
    };
  }

  // Feature: Footprint Map & Offline Journey Tracker (Bump / Jagat style)
  if (
    normalized.includes('dau chan') ||
    normalized.includes('ban do dau chan') ||
    normalized.includes('ve hanh trinh') ||
    normalized.includes('suong mu') ||
    normalized.includes('bump') ||
    normalized.includes('jagat') ||
    normalized.includes('ghi hanh trinh') ||
    (normalized.includes('mat mang') && normalized.includes('hanh trinh')) ||
    (normalized.includes('mat wifi') && normalized.includes('hanh trinh'))
  ) {
    return {
      reply:
        `🗺️ **Bản đồ Dấu chân Khám phá (Bump / Jagat Style + Offline-First)** đã sẵn sàng cho bạn! 🦊✨\n\n` +
        `• 🌫️ **Xóa Sương mù Bản đồ (Fog-of-War)**: Đi tới đâu hoặc Check-in ở đâu, vùng sương mù trên bản đồ sẽ tự động sáng bừng lên và tính **% khám phá Đồng Tháp**.\n` +
        `• ⚡ **Vẽ Vệt Hành trình Neon & Tua lại (Replay)**: Vẽ đường đi phát sáng thời gian thực, thả ghim kỷ niệm cảm xúc và phát lại toàn bộ chuyến đi.\n` +
        `• 🛰️ **Chống mất dữ liệu khi mất Wi-Fi (Offline-First IndexedDB)**: Kể cả khi mất mạng giữa đường, tọa độ GPS và ghim kỷ niệm vẫn được lưu an toàn trong bộ nhớ máy và **tự động đồng bộ lên Cloud** ngay khi có Wi-Fi lại!\n\n` +
        `Pé Meko đang mở ngay **Bản đồ Dấu chân** cho bạn trải nghiệm nhé!`,
      action: {
        type: 'OPEN_PAGE',
        payload: { path: '/footprints', label: 'Mở Bản đồ Dấu chân Khám phá' },
      },
      suggestions: [
        'Xem Hộ chiếu số (/passport)',
        'Điểm danh GPS (/check-in)',
        'Lập lịch trình đi 2 ngày cho 2 người với chi phí 2 tr',
      ],
    };
  }

  // ============================================================================
  // 5. ALL SYSTEM PAGES NAVIGATION (Account, Favorites, My Itineraries, Passport, QR)
  // ============================================================================
  if (
    normalized.includes('trang ca nhan') ||
    normalized.includes('thong tin tai khoan') ||
    normalized.includes('ho so ca nhan') ||
    normalized.includes('tai khoan cua toi')
  ) {
    return {
      reply: 'Dạ **Pé Meko** mở ngay **Trang cá nhân** để bạn xem hoặc chỉnh sửa tên hiển thị và sở thích du lịch nhé! 🦊👤',
      action: {
        type: 'OPEN_PAGE',
        payload: { path: '/account', label: 'Trang cá nhân' },
      },
      suggestions: ['Xem Hộ chiếu số', 'Địa điểm yêu thích', 'Lập lịch trình AI'],
    };
  }

  if (normalized.includes('dia diem yeu thich') || normalized.includes('danh sach yeu thich') || normalized === 'yeu thich') {
    return {
      reply: 'Dạ **Pé Meko** chuyển bạn đến trang **Địa điểm yêu thích** ngay đây ạ! 🦊❤️',
      action: {
        type: 'OPEN_PAGE',
        payload: { path: '/favorites', label: 'Địa điểm yêu thích' },
      },
      suggestions: ['Lưu yêu thích Làng hoa Sa Đéc', 'Khám phá địa điểm'],
    };
  }

  if (normalized.includes('lich trinh da luu') || normalized.includes('lich trinh cua toi')) {
    return {
      reply: 'Dạ **Pé Meko** mở ngay danh sách **Lịch trình đã lưu** của bạn nhé! 🦊📚',
      action: {
        type: 'OPEN_PAGE',
        payload: { path: '/my-itineraries', label: 'Lịch trình đã lưu' },
      },
      suggestions: ['Lập lịch trình 2 ngày 2 người chi phí 2 triệu', 'Xem Hộ chiếu số'],
    };
  }

  if (normalized.includes('ho chieu') || normalized.includes('passport') || normalized.includes('huy hieu')) {
    return {
      reply: 'Dạ **Pé Meko** chuyển bạn đến trang **Hộ chiếu Trải nghiệm số** để kiểm tra huy hiệu và điểm thưởng ngay nhé! 🦊🛂',
      action: {
        type: 'OPEN_PAGE',
        payload: { path: '/passport', label: 'Hộ chiếu số' },
      },
      suggestions: ['Đồng bộ hộ chiếu vào tài khoản', 'Quét mã QR check-in'],
    };
  }

  if (normalized.includes('quet qr') || normalized.includes('scan') || normalized.includes('check in') || normalized.includes('diem danh gps')) {
    return {
      reply: 'Dạ **Pé Meko** mở trang **Điểm danh GPS & Quét mã QR** ngay cho bạn đây ạ! 📸📍',
      action: {
        type: 'OPEN_PAGE',
        payload: { path: '/check-in', label: 'Điểm danh GPS / Quét QR' },
      },
      suggestions: ['Xem Hộ chiếu số', 'Khám phá địa điểm'],
    };
  }

  if (normalized.includes('trang chu') || normalized === 've dau trang') {
    return {
      reply: 'Dạ **Pé Meko** đưa bạn về **Trang chủ** ngay nhé! 🦊🏠',
      action: {
        type: 'OPEN_PAGE',
        payload: { path: '/', label: 'Trang chủ' },
      },
      suggestions: ['Khám phá địa điểm', 'Lập lịch trình AI', 'Mở trang cá nhân'],
    };
  }

  // ============================================================================
  // 6. LIVE DOM INTROSPECTION MATCHING (Future-Proof UI Controller!)
  // ============================================================================
  if (
    pageContext?.controls &&
    pageContext.controls.length > 0 &&
    (normalized.startsWith('bam nut ') ||
      normalized.startsWith('nhan nut ') ||
      normalized.startsWith('click ') ||
      normalized.startsWith('chon tab ') ||
      normalized.startsWith('mo tab '))
  ) {
    const targetPhrase = normalized
      .replace(/^(bam nut|nhan nut|click|chon tab|mo tab)\s+/g, '')
      .trim();
    if (targetPhrase.length >= 2) {
      const matchedCtrl = pageContext.controls.find((c) =>
        normalizeText(c.label).includes(targetPhrase),
      );
      if (matchedCtrl) {
        return {
          reply: `Dạ **Pé Meko** đã tìm thấy nút **"${matchedCtrl.label}"** trên màn hình hiện tại và đang tự động kích hoạt cho bạn! 🦊⚡`,
          action: {
            type: 'DOM_AUTOMATION',
            payload: {
              label: `Kích hoạt "${matchedCtrl.label}"`,
              domSteps: [{ op: 'click', targetId: matchedCtrl.id, targetText: matchedCtrl.label }],
            },
          },
        };
      }
    }
  }

  // ============================================================================
  // 7. SMART TOPIC, CATEGORY, AREA & KEYWORD LIST SEARCH ("danh sách các chùa", etc.)
  // ============================================================================
  const searchFilterResult = searchAndFilterDestinations(message, normalized, catalog);
  if (searchFilterResult) {
    return searchFilterResult;
  }

  // ============================================================================
  // 8. SPECIFIC DESTINATION NAVIGATION & Q&A (Opening Hours, Ticket Price, Address)
  // ============================================================================
  // Avoid hijacking nuanced comparison or multi-criteria advisory questions so Gemini LLM can reason deeply!
  const isComparisonOrAdvisory =
    /\b(?:hay|hoac|so\s+sanh|khac\s+nhau|nen\s+chon|nen\s+di|co\s+nen|co\s+dep\s+khong|review|danh\s+gia|kinh\s+nghiem|tu\s+van|mat\s+bao\s+lau|cach\s+bao\s+xa|bao\s+nhieu\s+km)\b/.test(
      normalized,
    );

  const matchedDest = !isComparisonOrAdvisory ? findDestinationByText(message, catalog) : null;
  if (matchedDest) {
    const fullItem = catalog.find((c) => c.slug === matchedDest.slug);
    const extraDetails: string[] = [];
    if (fullItem?.summary) extraDetails.push(`• 📝 **Giới thiệu**: ${fullItem.summary}`);
    if (fullItem?.address) extraDetails.push(`• 📍 **Địa chỉ**: ${fullItem.address}`);
    if (fullItem?.openingHours) extraDetails.push(`• ⏰ **Giờ mở cửa**: ${fullItem.openingHours}`);
    if (fullItem?.referencePrice) extraDetails.push(`• 🎫 **Giá vé tham khảo**: ${fullItem.referencePrice}`);

    return {
      reply:
        `Dạ **Pé Meko** mở ngay trang thông tin chi tiết của **${matchedDest.name}** (${matchedDest.area}) trên màn hình cho bạn xem nhé! 🦊📍` +
        (extraDetails.length > 0 ? `\n\n${extraDetails.join('\n')}` : ''),
      action: {
        type: 'NAVIGATE',
        payload: {
          path: `/destinations/${matchedDest.slug}`,
          label: matchedDest.name,
        },
      },
      matchedDestinations: [matchedDest],
      suggestions: [
        `Lưu yêu thích ${matchedDest.name}`,
        'Danh sách các chùa',
        'Lập lịch trình đi 2 ngày cho 2 người với chi phí 2 tr',
      ],
    };
  }

  return null;
}

/**
 * Formats a bulleted list of matched destinations for Pé Meko's chat bubble.
 */
function formatDestinationBulletList(items: DestinationSummary[], maxCount: number = 8): string {
  return items
    .slice(0, maxCount)
    .map((d, idx) => `${idx + 1}. **${d.name}** *(${d.area} · ${formatCategoryLabel(d.category)})*`)
    .join('\n');
}

/**
 * Smart Keyword, Topic, Category & Area Search Engine.
 * Handles queries like "danh sách các chùa", "tìm chùa", "các bảo tàng", "khu di tích",
 * "điểm sinh thái", "nhà cổ", "chợ", "vườn", "địa điểm ở Sa Đéc", etc.
 */
function searchAndFilterDestinations(
  rawMessage: string,
  normalized: string,
  catalog: DestinationSummary[],
): CopilotResponse | null {
  const isExplicitListOrSearch =
    normalized.includes('danh sach') ||
    normalized.includes('tim kiem') ||
    normalized.startsWith('tim ') ||
    normalized.includes('cac diem') ||
    normalized.includes('cac dia diem') ||
    normalized.includes('nhung dia diem') ||
    normalized.includes('liet ke') ||
    normalized.includes('goi y') ||
    normalized.includes('co nhung ') ||
    normalized.includes('top ');

  // 1. All destinations overview request
  if (
    normalized === 'danh sach dia diem' ||
    normalized === 'tat ca dia diem' ||
    normalized === 'cac dia diem du lich' ||
    normalized === 'kham pha dia diem' ||
    normalized === 'danh sach cac dia diem'
  ) {
    const listText = formatDestinationBulletList(catalog, 8);
    return {
      reply:
        `Dạ hệ thống **Đồng Tháp Smart Travel** hiện có **${catalog.length} địa điểm du lịch** đã được số hóa kèm bản đồ định vị! 🦊🗺️\n\n` +
        `**Một số địa điểm tiêu biểu:**\n${listText}\n\n` +
        `Pé Meko đã mở trang **Khám phá địa điểm** trên màn hình để bạn xem trọn bộ nhé!`,
      action: {
        type: 'OPEN_PAGE',
        payload: { path: '/destinations', label: `Khám phá ${catalog.length} địa điểm` },
      },
      matchedDestinations: catalog.slice(0, 6),
      suggestions: [
        'Danh sách các chùa',
        'Các khu du lịch sinh thái',
        'Địa điểm tại Sa Đéc',
        'Lập lịch trình đi 2 ngày cho 2 người với chi phí 2 tr',
      ],
    };
  }

  // 2. Topic / Keyword Groups (Pagodas/Temples, Museums, Historical Sites, Ancient Houses, Flower Villages, Markets, Gardens, Lotus, etc.)
  const topicRules: Array<{
    triggers: string[];
    rawTriggerCheck?: (rawLower: string) => boolean;
    requireListOrExact?: boolean;
    title: string;
    filterPath: string;
    filterLabel: string;
    matcher: (d: DestinationSummary) => boolean;
  }> = [
    {
      triggers: [
        'danh sach cac chua',
        'danh sach chua',
        'cac chua',
        'cac ngoi chua',
        'tim chua',
        'chua o',
        'chua nao',
        'ngoi chua',
        'co tu',
        'thien vien',
        'tam linh',
      ],
      rawTriggerCheck: (rawLower) => hasAccentedWord(rawLower, 'chùa'),
      title: 'ngôi chùa & điểm du lịch tâm linh',
      filterPath: '/destinations?q=chùa',
      filterLabel: 'Danh sách các chùa',
      matcher: (d) => {
        const nameLower = d.name.toLowerCase();
        const nameNorm = normalizeText(d.name);
        const sumNorm = normalizeText(d.summary);
        return (
          hasAccentedWord(nameLower, 'chùa') ||
          nameNorm.includes('co tu') ||
          nameNorm.includes('thien vien') ||
          hasAccentedWord(nameLower, 'miếu') ||
          hasAccentedWord(nameLower, 'đình') ||
          nameNorm.includes('kien an cung') ||
          sumNorm.includes('ngoi chua') ||
          sumNorm.includes('chua co')
        );
      },
    },
    {
      triggers: ['danh sach bao tang', 'cac bao tang', 'tim bao tang', 'bao tang'],
      requireListOrExact: true,
      title: 'bảo tàng & nhà trưng bày',
      filterPath: '/destinations?q=bảo tàng',
      filterLabel: 'Danh sách Bảo tàng',
      matcher: (d) =>
        normalizeText(d.name).includes('bao tang') || normalizeText(d.summary).includes('bao tang'),
    },
    {
      triggers: [
        'danh sach di tich',
        'cac khu di tich',
        'khu di tich',
        'di tich lich su',
        'dia diem lich su',
        'cac diem lich su',
        'lich su',
      ],
      requireListOrExact: true,
      title: 'khu di tích & điểm đến lịch sử',
      filterPath: '/destinations?category=history',
      filterLabel: 'Di tích & Lịch sử',
      matcher: (d) =>
        d.category === 'history' ||
        normalizeText(d.name).includes('di tich') ||
        normalizeText(d.name).includes('dinh '),
    },
    {
      triggers: ['danh sach nha co', 'cac nha co', 'tim nha co', 'nha co'],
      requireListOrExact: true,
      title: 'nhà cổ & kiến trúc di sản',
      filterPath: '/destinations?q=nhà cổ',
      filterLabel: 'Nhà cổ di sản',
      matcher: (d) =>
        normalizeText(d.name).includes('nha co') ||
        normalizeText(d.summary).includes('nha co') ||
        normalizeText(d.name).includes('kien an cung'),
    },
    {
      triggers: ['danh sach lang hoa', 'cac lang hoa', 'vuon hoa', 'lang hoa', 'hoa sa dec'],
      requireListOrExact: true,
      title: 'làng hoa & vườn hoa rực rỡ',
      filterPath: '/destinations?q=hoa',
      filterLabel: 'Làng hoa & Vườn hoa',
      matcher: (d) =>
        normalizeText(d.name).includes('hoa') || normalizeText(d.summary).includes('lang hoa'),
    },
    {
      triggers: ['dong sen', 'canh dong sen', 'cac diem sen', 'hoa sen', 'sen thap muoi'],
      requireListOrExact: true,
      title: 'đồng sen & điểm trải nghiệm Sen Hồng',
      filterPath: '/destinations?q=sen',
      filterLabel: 'Đồng sen Đồng Tháp',
      matcher: (d) =>
        normalizeText(d.name).includes('sen') || normalizeText(d.summary).includes('dong sen'),
    },
    {
      triggers: [
        'danh sach cho',
        'cac cho',
        'cho dem',
        'cho am thuc',
        'tim cho',
        'cho my tho',
        'cho sa dec',
      ],
      title: 'khu chợ & phố đêm ẩm thực',
      filterPath: '/destinations?q=chợ',
      filterLabel: 'Chợ & Phố ẩm thực',
      matcher: (d) =>
        hasAccentedWord(d.name.toLowerCase(), 'chợ') ||
        normalizeText(d.name).includes('cho dem') ||
        normalizeText(d.summary).includes('cho dem'),
    },
    {
      triggers: [
        'vuon trai cay',
        'danh sach vuon',
        'cac vuon',
        'miet vuon',
        'vuon quyt',
        'vuon hong',
        'vuon tao',
        'vuon thanh long',
      ],
      title: 'nhà vườn trái cây & miệt vườn',
      filterPath: '/destinations?q=vườn',
      filterLabel: 'Miệt vườn & Trái cây',
      matcher: (d) => normalizeText(d.name).includes('vuon'),
    },
    {
      triggers: ['lang nghe', 'danh sach lang nghe', 'cac lang nghe'],
      title: 'làng nghề truyền thống trăm năm',
      filterPath: '/destinations?q=làng nghề',
      filterLabel: 'Làng nghề truyền thống',
      matcher: (d) =>
        normalizeText(d.name).includes('lang nghe') ||
        normalizeText(d.name).includes('co so') ||
        normalizeText(d.summary).includes('lang nghe'),
    },
    {
      triggers: ['hu tieu', 'quan hu tieu', 'hu tieu sa dec', 'hu tieu my tho'],
      title: 'quán Hủ tiếu trứ danh',
      filterPath: '/destinations?q=hủ tiếu',
      filterLabel: 'Quán Hủ tiếu ngon',
      matcher: (d) =>
        normalizeText(d.name).includes('hu tieu') ||
        normalizeText(d.name).includes('bot sa dec') ||
        normalizeText(d.summary).includes('hu tieu'),
    },
    {
      triggers: [
        'khu du lich sinh thai',
        'du lich sinh thai',
        'cac diem sinh thai',
        'dia diem sinh thai',
        'danh sach sinh thai',
        'sinh thai',
      ],
      title: 'khu du lịch sinh thái miền sông nước',
      filterPath: '/destinations?category=eco',
      filterLabel: 'Du lịch Sinh thái',
      matcher: (d) => d.category === 'eco' || normalizeText(d.name).includes('sinh thai'),
    },
    {
      triggers: [
        'dia diem van hoa',
        'cac diem van hoa',
        'danh sach van hoa',
        'du lich van hoa',
        'van hoa',
      ],
      requireListOrExact: true,
      title: 'điểm đến văn hóa & tâm linh',
      filterPath: '/destinations?category=culture',
      filterLabel: 'Điểm đến Văn hóa',
      matcher: (d) => d.category === 'culture',
    },
    {
      triggers: [
        'dia diem thien nhien',
        'cac diem thien nhien',
        'danh sach thien nhien',
        'canh dep thien nhien',
        'thien nhien',
      ],
      requireListOrExact: true,
      title: 'điểm khám phá thiên nhiên hoang sơ',
      filterPath: '/destinations?category=nature',
      filterLabel: 'Khám phá Thiên nhiên',
      matcher: (d) => d.category === 'nature',
    },
    {
      triggers: [
        'trai nghiem dia phuong',
        'cac diem trai nghiem',
        'danh sach trai nghiem',
      ],
      title: 'điểm trải nghiệm bản địa đặc sắc',
      filterPath: '/destinations?category=local_experience',
      filterLabel: 'Trải nghiệm địa phương',
      matcher: (d) => d.category === 'local_experience',
    },
    {
      triggers: [
        'danh sach quan an',
        'cac quan an',
        'nha hang',
        'dia diem an uong',
        'danh sach am thuc',
        'cac diem am thuc',
      ],
      title: 'nhà hàng & quán ăn đặc sản',
      filterPath: '/destinations?category=food',
      filterLabel: 'Địa điểm Ẩm thực',
      matcher: (d) => d.category === 'food',
    },
    {
      triggers: ['danh sach bien', 'cac bai bien', 'du lich bien', 'bai bien', 'bien gan'],
      title: 'bãi biển đẹp khu vực ĐBSCL & lân cận',
      filterPath: '/destinations?q=biển',
      filterLabel: 'Du lịch Biển gần bạn',
      matcher: (d) => normalizeText(d.name).includes('bien') || normalizeText(d.tags.join(' ')).includes('bai bien'),
    },
    {
      triggers: ['danh sach nui', 'khu du lich nui', 'cac nui', 'du lich nui'],
      title: 'khu du lịch núi non & săn mây',
      filterPath: '/destinations?q=núi',
      filterLabel: 'Du lịch Núi & Săn mây',
      matcher: (d) => normalizeText(d.name).includes('nui') || normalizeText(d.tags.join(' ')).includes('doi nui'),
    },
  ];

  const rawLowerMsg = rawMessage.toLowerCase();
  for (const rule of topicRules) {
    const matchedTrigger =
      rule.triggers.some((t) =>
        rule.requireListOrExact
          ? normalized === t || (isExplicitListOrSearch && normalized.includes(t))
          : normalized === t || normalized.includes(t),
      ) || Boolean(rule.rawTriggerCheck && rule.rawTriggerCheck(rawLowerMsg));
    if (matchedTrigger) {
      // Do not intercept if the user typed a specific full destination name (e.g. "Mở Chùa Phước Kiển")
      // unless they explicitly asked for a list ("danh sách", "các", "tìm")
      if (!isExplicitListOrSearch && !GENERIC_CATEGORY_NOUNS.has(normalized)) {
        const exactDest = findDestinationByText(rawMessage, catalog);
        if (exactDest) continue;
      }

      const matched = catalog
        .filter(rule.matcher)
        .sort((a, b) => {
          const aHasChua = normalizeText(a.name).includes('chua') ? 1 : 0;
          const bHasChua = normalizeText(b.name).includes('chua') ? 1 : 0;
          return bHasChua - aHasChua;
        });
      if (matched.length > 0) {
        const bulletList = formatDestinationBulletList(matched, 8);
        return {
          reply:
            `Dạ **Pé Meko** tìm thấy **${matched.length} ${rule.title}** trong hệ thống và đã lọc ngay trên màn hình cho bạn! 🦊✨\n\n` +
            `**Danh sách tiêu biểu:**\n${bulletList}` +
            (matched.length > 8 ? `\n*(và ${matched.length - 8} địa điểm khác đang hiển thị trên trang)*` : '') +
            `\n\nBạn có thể bấm trực tiếp vào từng địa điểm bên dưới để xem chi tiết & bản đồ chỉ đường nhé!`,
          action: {
            type: 'FILTER',
            payload: {
              path: rule.filterPath,
              label: `${rule.filterLabel} (${matched.length})`,
            },
          },
          matchedDestinations: matched.slice(0, 6),
          suggestions: [
            matched[0] ? `Xem chi tiết ${matched[0].name}` : 'Khám phá địa điểm',
            'Lập lịch trình đi 2 ngày cho 2 người với chi phí 2 tr',
            'Đồng Tháp mùa nào đi đẹp nhất và có đặc sản gì ngon?',
          ],
        };
      }
    }
  }

  // 3. Area / Province / City Filtering
  const areas = [
    { kw: 'cao lanh', slug: 'cao-lanh', name: 'Cao Lãnh', useAreaParam: true },
    { kw: 'sa dec', slug: 'sa-dec', name: 'Sa Đéc', useAreaParam: true },
    { kw: 'thap muoi', slug: 'thap-muoi', name: 'Tháp Mười', useAreaParam: true },
    { kw: 'tam nong', slug: 'tam-nong', name: 'Tam Nông', useAreaParam: true },
    { kw: 'lai vung', slug: 'lai-vung', name: 'Lai Vung', useAreaParam: true },
    { kw: 'hong ngu', slug: 'hong-ngu', name: 'Hồng Ngự', useAreaParam: true },
    { kw: 'my tho', slug: 'my-tho', name: 'Mỹ Tho', useAreaParam: true },
    { kw: 'cai be', slug: 'cai-be', name: 'Cái Bè', useAreaParam: true },
    { kw: 'thoi son', slug: 'thoi-son', name: 'Cù lao Thới Sơn', useAreaParam: true },
    { kw: 'can tho', slug: 'can-tho', name: 'Cần Thơ', useAreaParam: true },
    { kw: 'vinh long', slug: 'vinh-long', name: 'Vĩnh Long', useAreaParam: true },
    { kw: 'chau thanh', slug: 'chau-thanh', name: 'Châu Thành', useAreaParam: false },
    { kw: 'lap vo', slug: 'lap-vo', name: 'Lấp Vò', useAreaParam: false },
  ];

  // Only trigger area filtering if user didn't name a single specific destination (unless asking for a list)
  const specificDestCheck = !isExplicitListOrSearch ? findDestinationByText(rawMessage, catalog) : null;
  if (!specificDestCheck) {
    for (const area of areas) {
      if (normalized.includes(area.kw)) {
        const matched = catalog.filter(
          (c) =>
            c.areaSlug === area.slug ||
            normalizeText(c.area).includes(area.kw) ||
            normalizeText(c.name).includes(area.kw) ||
            normalizeText(c.summary).includes(area.kw) ||
            normalizeText(c.address).includes(area.kw),
        );

        if (matched.length > 0) {
          const bulletList = formatDestinationBulletList(matched, 8);
          const filterPath = area.useAreaParam
            ? `/destinations?area=${area.slug}`
            : `/destinations?q=${encodeURIComponent(area.name)}`;

          return {
            reply:
              `Dạ **Pé Meko** tìm thấy **${matched.length} địa điểm du lịch tại ${area.name}** và đã lọc danh sách trên màn hình cho bạn xem đây ạ! 🦊🌿\n\n` +
              `**Các điểm đến nổi bật tại ${area.name}:**\n${bulletList}`,
            action: {
              type: 'FILTER',
              payload: {
                path: filterPath,
                label: `Địa điểm ${area.name} (${matched.length})`,
              },
            },
            matchedDestinations: matched.slice(0, 6),
            suggestions: [
              matched[0] ? `Mở ${matched[0].name}` : 'Khám phá địa điểm',
              'Lập lịch trình đi 2 ngày cho 2 người với chi phí 2 tr',
              'Danh sách các chùa',
            ],
          };
        }
      }
    }
  }

  // 4. Generic Free-Text List / Search Query ("danh sách <X>", "tìm <X>", "các điểm <X>")
  if (isExplicitListOrSearch) {
    const cleanedQuery = rawMessage
      .replace(
        /^(cho\s+t[ôo]i\s+xem\s+|h[ãa]y\s+|vui\s+l[òo]ng\s+|p[ée]\s+meko\s+)?(danh\s+s[áa]ch|t[ìi]m\s+ki[ếe]m|t[ìi]m|li[ệe]t\s+k[êe]|g[ợo]i\s+[ýy]|c[áa]c\s+đi[ểe]m|c[áa]c\s+đ[ịi]a\s+đi[ểe]m|nh[ữư]ng\s+đ[ịi]a\s+đi[ểe]m|c[áa]c|nh[ữư]ng)\s+/i,
        '',
      )
      .replace(/\s+(ở|tại)\s+đồng\s+tháp.*$/i, '')
      .replace(/[?!.]+$/, '')
      .trim();

    const normQuery = normalizeText(cleanedQuery);
    if (normQuery.length >= 2) {
      const terms = normQuery.split(/\s+/).filter((w) => w.length >= 2);
      const matched = catalog.filter((c) => {
        const hay = normalizeText(`${c.name} ${c.summary} ${c.description} ${c.area} ${c.tags.join(' ')}`);
        return hay.includes(normQuery) || (terms.length > 0 && terms.every((t) => hay.includes(t)));
      });

      if (matched.length > 0) {
        const bulletList = formatDestinationBulletList(matched, 8);
        return {
          reply:
            `Dạ **Pé Meko** tìm thấy **${matched.length} địa điểm** phù hợp với từ khóa **"${cleanedQuery}"** và đã lọc danh sách trên màn hình cho bạn! 🦊🔍\n\n` +
            `${bulletList}`,
          action: {
            type: 'FILTER',
            payload: {
              path: `/destinations?q=${encodeURIComponent(cleanedQuery)}`,
              label: `Tìm kiếm: ${cleanedQuery} (${matched.length})`,
            },
          },
          matchedDestinations: matched.slice(0, 6),
          suggestions: [
            matched[0] ? `Xem chi tiết ${matched[0].name}` : 'Khám phá tất cả địa điểm',
            'Lập lịch trình đi 2 ngày cho 2 người với chi phí 2 tr',
          ],
        };
      }
    }
  }

  return null;
}

/**
 * Intelligent local fallback when Gemini API is unreachable or rate-limited.
 * Searches the catalog by keywords in the user's message and responds naturally.
 */
function buildSmartLocalFallback(
  message: string,
  catalog: DestinationSummary[],
): CopilotResponse {
  const norm = normalizeText(message);
  const stopWords = new Set([
    'toi',
    'muon',
    'cho',
    'hoi',
    'xem',
    'tim',
    'biet',
    've',
    'cua',
    'nhung',
    'cac',
    'dia',
    'diem',
    'nao',
    'gi',
    'la',
    'co',
    'khong',
    'tai',
    'dong',
    'thap',
    'pe',
    'meko',
    'oi',
    'giup',
    'nhe',
    'voi',
  ]);
  const words = norm.split(/\s+/).filter((w) => w.length >= 3 && !stopWords.has(w));

  if (words.length > 0) {
    const scored = catalog
      .map((c) => {
        const hay = normalizeText(`${c.name} ${c.summary} ${c.description} ${c.area} ${c.tags.join(' ')}`);
        const hits = words.filter((w) => hay.includes(w)).length;
        return { item: c, hits };
      })
      .filter((x) => x.hits > 0)
      .sort((a, b) => b.hits - a.hits);

    if (scored.length > 0) {
      const matched = scored.map((s) => s.item);
      const bulletList = formatDestinationBulletList(matched, 6);
      return {
        reply:
          `Dạ **Pé Meko** tìm thấy **${matched.length} địa điểm liên quan** đến yêu cầu của bạn trong hệ thống **Đồng Tháp Smart Travel**: 🦊✨\n\n` +
          `${bulletList}\n\n` +
          `Bạn có thể nhấn vào địa điểm bên dưới để xem thông tin chi tiết, giờ mở cửa và bản đồ chỉ đường nhé!`,
        action: {
          type: 'FILTER',
          payload: {
            path: `/destinations?q=${encodeURIComponent(message.trim())}`,
            label: `Kết quả liên quan (${matched.length})`,
          },
        },
        matchedDestinations: matched.slice(0, 6),
        suggestions: [
          'Danh sách các chùa',
          'Lập lịch trình đi 2 ngày cho 2 người với chi phí 2 tr',
          'Dự án này là gì và có những tính năng nào?',
        ],
      };
    }
  }

  return {
    reply:
      `Chào bạn! Mình là **Pé Meko** 🦊 — Trợ lý AI kiêm hướng dẫn viên của **Đồng Tháp Smart Travel**.\n\n` +
      `Bạn có thể nhờ Pé Meko:\n` +
      `• 🔍 **Tìm danh sách điểm đến**: *"Danh sách các chùa"*, *"Các điểm sinh thái"*, *"Địa điểm ở Sa Đéc"*\n` +
      `• 🧭 **Lập lịch trình tự động**: *"Lập lịch trình đi 2 ngày cho 2 người với chi phí 2 tr"*\n` +
      `• 💬 **Hỏi đáp về dự án & đặc sản**: *"Dự án này là gì?"*, *"Hộ chiếu số là gì?"*, *"Đặc sản Đồng Tháp"*`,
    suggestions: [
      'Danh sách các chùa',
      'Dự án này là gì và có những tính năng nào?',
      'Lập lịch trình đi 2 ngày cho 2 người với chi phí 2 tr',
      'Đồng Tháp mùa nào đi đẹp nhất và có đặc sản gì ngon?',
    ],
  };
}

function buildContextualSuggestions(
  action: CopilotAction | undefined,
  pageContext: PageContextSnapshot | undefined,
  matchedDestinations: DestinationSummary[],
): string[] {
  if (action?.type === 'CHOOSE_SWAP_CANDIDATE') {
    return [
      'Đổi sang điểm thiên nhiên',
      'Đổi sang điểm ẩm thực',
      'Đổi sang chùa / văn hóa',
      'Tìm điểm gần tuyến nhất',
    ];
  }
  if (action?.type === 'SWAP_ITINERARY_STOP' || action?.type === 'ADD_ITINERARY_STOP') {
    const destName = action.payload.newDestination?.name;
    return [
      destName ? `Xem chi tiết ${destName}` : 'Xem lịch trình hiện tại',
      'Lịch trình hiện tại của tôi gồm những điểm nào?',
      'Lưu lịch trình này vào tài khoản',
    ];
  }
  if (action?.type === 'NAVIGATE' && matchedDestinations[0]) {
    const d = matchedDestinations[0];
    const hasDraft = Boolean(pageContext?.draftItinerary?.days?.length);
    const hasPending = Boolean(pageContext?.pendingSwap?.targetStopName);
    if (hasPending) {
      return [
        `Đổi ${pageContext!.pendingSwap!.targetStopName} sang ${d.name}`,
        `Lưu yêu thích ${d.name}`,
        'Mở lại trang Lập lịch trình',
      ];
    }
    if (hasDraft) {
      const firstStop = pageContext?.draftItinerary?.days?.[0]?.stops?.[0];
      return [
        firstStop ? `Đổi ${d.name} với ${firstStop.name} ngày 1` : `Thêm ${d.name} vào lịch trình ngày 1`,
        `Lưu yêu thích ${d.name}`,
        'Lịch trình hiện tại của tôi gồm những điểm nào?',
      ];
    }
    return [
      `Lưu yêu thích ${d.name}`,
      'Lập lịch trình đi 2 ngày cho 2 người với chi phí 2 tr',
      'Danh sách các chùa',
    ];
  }
  if (pageContext?.draftItinerary?.days?.length) {
    return [
      'Lịch trình hiện tại của tôi gồm những điểm nào?',
      'Lưu lịch trình này vào tài khoản',
      'Kiểm tra cảnh báo thời tiết & an toàn lịch trình',
    ];
  }
  return [
    'Danh sách các chùa',
    'Lập lịch trình đi 2 ngày cho 2 người với chi phí 2 tr',
    'Dự án này là gì và có những tính năng nào?',
  ];
}

function runOfflineDeterministicFallback(
  message: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  catalog: DestinationSummary[],
  pageContext?: PageContextSnapshot,
): CopilotResponse {
  const smartResult = handleSmartIntent(message, history, catalog, pageContext);
  if (smartResult) {
    return smartResult;
  }
  return buildSmartLocalFallback(message, catalog);
}

/**
 * Main Copilot Engine ("Pé Meko Brain 3.0" — AI-First Agentic Architecture):
 * - Tier 1: Hard Security & RBAC Guardrails (always first, non-bypassable)
 * - Tier 1.5: Instant deterministic index selection ("chọn số 2", "cái đầu tiên") when Swap Picker is open
 * - Tier 2: Gemini 3.5 Flash Lite AI-First NLU + Function Calling with 12-turn memory, live draft itinerary,
 *           pendingSwap, lastDiscussedDestination & full ground-truth catalog
 * - Tier 3: Deterministic Ground-Truth Tool Executor (strictly validates DB slugs/stops, never hallucinates)
 * - Tier 4: Upgraded Deterministic Fallback (for offline mode, Gemini outage, or NODE_ENV === 'test')
 */
export async function processCopilotMessage(
  message: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }> = [],
  pageContext?: PageContextSnapshot,
): Promise<CopilotResponse> {
  // Tier 1: Hard Security Guardrails FIRST!
  const guardrailBlock = evaluateSecurityGuardrails(message, pageContext);
  if (guardrailBlock) {
    return guardrailBlock;
  }

  const catalog = await getDestinationsCatalog();

  // Tier 1.5: Instant zero-latency index pick when user clicks/types "số 2" / "chọn 1" / "đầu tiên"
  const instantPick = tryInstantPendingSwapIndexPick(message, catalog, pageContext);
  if (instantPick) {
    return instantPick;
  }

  // Fast deterministic path for automated tests (Vitest) or when no Gemini API key is configured
  const apiKey = resolveGeminiApiKey();
  const isTestEnv = process.env.NODE_ENV === 'test';
  if (!apiKey || isTestEnv) {
    return runOfflineDeterministicFallback(message, history, catalog, pageContext);
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const lastDiscussed = resolveLastDiscussedDestination(pageContext, history, catalog);

    const catalogPrompt = catalog
      .map(
        (d) =>
          `- ${d.name} (slug: "${d.slug}", khu vực: "${d.area}", loại: "${d.category}"/${formatCategoryLabel(d.category)}${d.openingHours ? `, giờ: "${d.openingHours}"` : ''}${d.referencePrice ? `, giá: "${d.referencePrice}"` : ''})`,
      )
      .join('\n');

    const draftItineraryPrompt =
      pageContext?.draftItinerary?.days && pageContext.draftItinerary.days.length > 0
        ? pageContext.draftItinerary.days
            .map((d) => {
              const stopsText = d.stops
                .map(
                  (s, idx) =>
                    `    ${idx + 1}. "${s.name}"${s.start && s.end ? ` (${s.start}-${s.end})` : ''}${s.stopId ? ` [stopId=${s.stopId}]` : ''}`,
                )
                .join('\n');
              return `  Ngày ${d.day}${d.date ? ` (${d.date})` : ''}:\n${stopsText}`;
            })
            .join('\n')
        : '  (Chưa có bản nháp lịch trình)';

    const pendingSwapPrompt = pageContext?.pendingSwap
      ? `ĐANG MỞ BỘ CHỌN ĐỔI ĐIỂM cho điểm mục tiêu "${pageContext.pendingSwap.targetStopName}" (Ngày ${pageContext.pendingSwap.dayNumber}${pageContext.pendingSwap.targetStopId ? `, stopId=${pageContext.pendingSwap.targetStopId}` : ''}); danh sách gợi ý đang hiển thị: ${(pageContext.pendingSwap.candidates || []).map((c, i) => `${i + 1}.${c.name} [slug=${c.slug}]`).join('; ')}`
      : 'Không có';

    const lastDiscussedPrompt = lastDiscussed
      ? `"${lastDiscussed.name}" (slug: "${lastDiscussed.slug}", khu vực: "${lastDiscussed.area || 'Đồng Tháp'}")`
      : 'Chưa xác định';

    const domControlsPrompt =
      pageContext?.controls && pageContext.controls.length > 0
        ? pageContext.controls
            .map(
              (c) =>
                `  * [id="${c.id}"] <${c.tag}${c.type ? ` type="${c.type}"` : ''}> label="${c.label}"${c.value ? ` current_value="${c.value}"` : ''}`,
            )
            .join('\n')
        : '  (Không có danh sách phần tử DOM)';

    const userContextPrompt = pageContext?.currentUser
      ? `Đã đăng nhập: Tên hiển thị="${pageContext.currentUser.displayName}", Email="${pageContext.currentUser.email}", Quyền="${pageContext.currentUser.role}"`
      : 'Chưa đăng nhập (Khách)';

    const systemInstruction = `Bạn là "Pé Meko" 🦊 - Siêu Trợ lý AI đồng hành & điều khiển toàn diện nền tảng Du lịch Thông minh Đồng Tháp (Đồng Tháp Smart Travel).
Bạn giao tiếp tự nhiên bằng tiếng Việt như một người bạn am hiểu bản địa: hiểu tiếng nói tắt, lỗi gõ chính tả (vd "dổi" = "đổi"), câu phủ định, đại từ hồi chiếu ("nó", "chỗ này", "điểm đó") và câu đảo trật tự.

NGUYÊN TẮC CỐT LÕI VỀ DỮ LIỆU THẬT (ZERO HALLUCINATION):
1. TUYỆT ĐỐI KHÔNG tự bịa tên địa điểm ngoài DANH SÁCH ĐỊA ĐIỂM THẬT TRONG DATABASE bên dưới.
2. ĐỔI ĐIỂM CHƯA RÕ TÊN CỤ THỂ ("đổi sang điểm khác", "không muốn đi Trà mật ong đổi cho tôi một địa điểm tham quan về thiên nhiên khác đi", "không muốn tham quan bảo tàng, đổi qua thiên nhiên", "chỗ nào mát mẻ / ẩm thực / chùa / gần tuyến"):
   -> BẮT BUỘC gọi hàm "suggestSwapCandidates" với \`targetStopName\` = điểm CŨ đang nằm trong Bản nháp lịch trình (ví dụ "Trà mật ong Kỳ Lân" hoặc "Bảo tàng Tổng hợp Đồng Tháp") và \`category\` / \`topicHint\` / \`area\`.
   -> LƯU Ý CỰC KỲ QUAN TRỌNG: Điểm cũ trong lịch trình (như "Trà mật ong Kỳ Lân") có thể đến từ bộ lập lịch V9 nên KHÔNG cần có trong DANH SÁCH DATABASE — TUYỆT ĐỐI KHÔNG điền tên điểm cũ này vào \`notFoundPlaceName\`! Để trống \`notFoundPlaceName\` khi người dùng chỉ muốn đổi theo thể loại (vd thiên nhiên, ẩm thực, chùa) hoặc sang "điểm khác".
3. ĐỔI ĐIỂM CÓ TÊN ĐỊA DANH MỚI NGOÀI DATABASE (vd user đích danh đòi đổi sang "Đà Lạt", "Nha Trang", "Vũng Tàu"):
   -> Gọi "suggestSwapCandidates" với \`notFoundPlaceName\` = tên địa danh MỚI đó (TUYỆT ĐỐI KHÔNG phải tên điểm cũ trong lịch trình) để hệ thống báo khéo chưa có và xổ danh sách điểm thật thay thế.
4. ĐỔI ĐIỂM ĐÃ RÕ TÊN ĐỊA ĐIỂM THẬT ("đổi qua biển tân thành đi", "đây nè Biển Tân Thành", "ừa dổi nó với địa điểm bảo tàng ở ngày 1 đi"):
   -> Phân biệt rạch ròi:
      • \`targetStopName\`: điểm ĐANG NẰM TRONG LỊCH TRÌNH bị thay ra (vd "Bảo tàng Tổng hợp Đồng Tháp", hoặc \`pendingSwap.targetStopName\` nếu đang mở phiên đổi điểm).
      • \`newDestinationSlug\` & \`newDestinationName\`: điểm MỚI muốn đưa VÀO lịch trình (khớp đúng DANH SÁCH DATABASE, hoặc suy từ \`lastDiscussedDestination\` / tên vừa nhắc khi user nói "nó" / "chỗ đó").
   -> LƯU Ý QUAN TRỌNG: Nếu đang có \`pendingSwap\` (user đang trong luồng chọn điểm thay thế) và user gõ tên một địa điểm mới (vd "đây nè Biển Tân Thành", "đổi qua biển tân thành đi"), HÃY GỌI \`swapItineraryStop\` để đổi điểm đó vào lịch trình cho \`pendingSwap.targetStopName\`, TUYỆT ĐỐI KHÔNG gọi \`navigateToDestination\` làm mất mạch đổi điểm!
5. THÊM / GỠ / XEM LỊCH TRÌNH:
   - Muốn thêm 1 địa điểm thật vào ngày X -> gọi \`addItineraryStop\`.
   - Muốn gỡ/bỏ 1 điểm khỏi lịch trình -> gọi \`removeItineraryStop\`.
   - Hỏi lịch trình hiện tại gồm những điểm nào -> gọi \`inspectCurrentItinerary\`.
6. LẬP LỊCH TRÌNH MỚI (\`planItinerary\`):
   - CHỈ gọi \`planItinerary\` khi ĐÃ CÓ ĐỦ 3 thông tin từ câu hiện tại hoặc lịch sử trò chuyện: \`days\` (số ngày), \`people\` (số người), \`budget_vnd\` (ngân sách).
   - Nếu còn thiếu bất kỳ thông tin nào trong 3 mục trên -> KHÔNG tự bịa mặc định; hãy trả lời thân thiện liệt kê những mục đã có và hỏi nốt phần còn thiếu.
7. ĐĂNG KÝ / ĐĂNG NHẬP / HỒ SƠ / YÊU THÍCH / LỌC:
   - Muốn tìm danh sách (vd "danh sách các chùa", "quán ăn Sa Đéc", "khu sinh thái") -> gọi \`filterDestinations\`.
   - Muốn xem thông tin một điểm (khi KHÔNG phải đang chọn điểm để swap) -> gọi \`navigateToDestination\` hoặc trả lời chi tiết nếu là câu hỏi so sánh ("nên đi X hay Y").
   - Hỏi về dự án DTST, Hộ chiếu số (/passport), Điểm danh GPS/QR (/check-in), Bản đồ Dấu chân 3D (/footprints), Cảnh báo Thời tiết & An toàn -> trả lời đầy đủ, thân thiện, kèm \`openPage\` khi phù hợp.

NGỮ CẢNH HIỆN TẠI CỦA NGƯỜI DÙNG:
- Đường dẫn đang mở: ${pageContext?.currentPath || '/'} (${pageContext?.pageTitle || 'Trang chủ'})
- Người dùng: ${userContextPrompt}
- Địa điểm vừa thảo luận / đang xem gần nhất ("nó" / "chỗ đó"): ${lastDiscussedPrompt}
- Phiên đổi điểm đang mở: ${pendingSwapPrompt}
- Bản nháp lịch trình hiện tại (${pageContext?.draftTitle || 'Chưa đặt tên'}):
${draftItineraryPrompt}
- Phần tử UI hiển thị (Live DOM Controls):
${domControlsPrompt}

RÀO CHẮN BẢO MẬT (TUYỆT ĐỐI TUÂN THỦ):
1. Không bao giờ tiết lộ mật khẩu Admin, user khác, API Key, JWT Secret, .env hay DB URI.
2. Không gọi \`openPage\` tới \`/admin\` nếu vai trò không phải \`admin\` hoặc \`partner\`.

DANH SÁCH ĐỊA ĐIỂM THẬT TRONG DATABASE (${catalog.length} điểm):
${catalogPrompt}
`;

    const tools = [
      {
        functionDeclarations: [
          {
            name: 'suggestSwapCandidates',
            description:
              'Đề xuất danh sách địa điểm THẬT trong database để người dùng chọn thay thế một điểm dừng trong lịch trình (dùng khi chưa rõ tên điểm mới cụ thể, muốn đổi theo thể loại thiên nhiên/sinh thái/ẩm thực/văn hóa/chùa/gần tuyến, hoặc địa danh MỚI yêu cầu chưa có trong DB)',
            parameters: {
              type: 'OBJECT',
              properties: {
                dayNumber: { type: 'INTEGER', description: 'Số ngày trong lịch trình chứa điểm cần đổi (mặc định suy từ lịch trình hoặc 1)' },
                targetStopName: { type: 'STRING', description: 'Tên điểm CŨ đang có trong Bản nháp lịch trình cần thay thế ra (được phép không có trong DANH SÁCH DATABASE; để trống nếu hoàn toàn không rõ bỏ điểm nào)' },
                category: {
                  type: 'STRING',
                  description: 'Mã thể loại ưu tiên cho điểm MỚI: nature, eco, culture, history, food, local_experience',
                },
                area: { type: 'STRING', description: 'Khu vực mong muốn cho điểm MỚI (vd: Sa Đéc, Cao Lãnh, Mỹ Tho, Tháp Mười...)' },
                preferNear: { type: 'BOOLEAN', description: 'CHỈ đặt true nếu người dùng yêu cầu ưu tiên điểm gần tuyến / ít di chuyển / đỡ mệt' },
                topicHint: { type: 'STRING', description: 'CHỈ điền chủ đề phụ cụ thể nếu có: chùa, nhà cổ, làng hoa, biển, núi, trong nhà, chợ; ĐỂ TRỐNG nếu người dùng chỉ nói chung theo category (vd thiên nhiên)' },
                notFoundPlaceName: { type: 'STRING', description: 'CHỈ điền khi người dùng đích danh đòi đổi sang một địa danh MỚI không tồn tại trong DANH SÁCH DATABASE (vd Đà Lạt, Vũng Tàu). TUYỆT ĐỐI KHÔNG điền tên điểm CŨ (targetStopName) từ lịch trình vào đây!' },
              },
            },
          },
          {
            name: 'swapItineraryStop',
            description:
              'Đổi một điểm dừng trong lịch trình sang MỘT ĐỊA ĐIỂM MỚI CÓ THẬT trong DANH SÁCH ĐỊA ĐIỂM TRONG DATABASE (hỗ trợ cả hồi chiếu "nó" = địa điểm vừa xem/nhắc)',
            parameters: {
              type: 'OBJECT',
              properties: {
                dayNumber: { type: 'INTEGER', description: 'Ngày chứa điểm cần đổi trong lịch trình' },
                targetStopName: { type: 'STRING', description: 'Tên điểm CŨ đang nằm trong lịch trình sẽ bị thay ra' },
                newDestinationSlug: { type: 'STRING', description: 'Slug chính xác của điểm MỚI từ DANH SÁCH DATABASE' },
                newDestinationName: { type: 'STRING', description: 'Tên chính xác của điểm MỚI từ DANH SÁCH DATABASE' },
              },
              required: ['targetStopName', 'newDestinationSlug', 'newDestinationName'],
            },
          },
          {
            name: 'addItineraryStop',
            description: 'Thêm một địa điểm CÓ THẬT trong database vào ngày X của lịch trình hiện tại',
            parameters: {
              type: 'OBJECT',
              properties: {
                dayNumber: { type: 'INTEGER', description: 'Ngày muốn thêm điểm vào (mặc định 1)' },
                destinationSlug: { type: 'STRING', description: 'Slug chính xác của địa điểm cần thêm' },
                destinationName: { type: 'STRING', description: 'Tên chính xác của địa điểm cần thêm' },
              },
              required: ['destinationSlug', 'destinationName'],
            },
          },
          {
            name: 'removeItineraryStop',
            description: 'Gỡ/bỏ một điểm dừng khỏi lịch trình hiện tại',
            parameters: {
              type: 'OBJECT',
              properties: {
                dayNumber: { type: 'INTEGER', description: 'Ngày chứa điểm dừng cần bỏ' },
                targetStopName: { type: 'STRING', description: 'Tên điểm dừng cần gỡ bỏ' },
              },
              required: ['targetStopName'],
            },
          },
          {
            name: 'inspectCurrentItinerary',
            description: 'Liệt kê tóm tắt lịch trình nháp hiện tại theo ngày và khung giờ',
            parameters: {
              type: 'OBJECT',
              properties: {
                dayNumber: { type: 'INTEGER', description: 'Ngày cụ thể muốn xem (bỏ trống để xem tất cả các ngày)' },
              },
            },
          },
          {
            name: 'planItinerary',
            description: 'Tự động điền form và kích hoạt AI Trip Planner V9 lập lịch trình mới KHI ĐÃ ĐỦ days, people, và budget_vnd',
            parameters: {
              type: 'OBJECT',
              properties: {
                days: { type: 'INTEGER', description: 'Số ngày du lịch (1-7)' },
                people: { type: 'INTEGER', description: 'Số người tham gia' },
                budget_vnd: { type: 'INTEGER', description: 'Tổng ngân sách bằng VND (vd 2 triệu = 2000000)' },
              },
              required: ['days', 'people', 'budget_vnd'],
            },
          },
          {
            name: 'saveCurrentItinerary',
            description: 'Lưu bản nháp lịch trình hiện tại vào tài khoản người dùng',
            parameters: {
              type: 'OBJECT',
              properties: {
                title: { type: 'STRING', description: 'Tên lịch trình muốn lưu (nếu người dùng có đặt)' },
              },
            },
          },
          {
            name: 'navigateToDestination',
            description: 'Mở trang thông tin chi tiết của một địa điểm (CHỈ dùng khi người dùng muốn xem thông tin điểm đó, KHÔNG dùng khi đang muốn đổi điểm vào lịch trình)',
            parameters: {
              type: 'OBJECT',
              properties: {
                slug: { type: 'STRING', description: 'Slug chính xác của địa điểm trong database' },
                destinationName: { type: 'STRING', description: 'Tên địa điểm hiển thị' },
              },
              required: ['slug'],
            },
          },
          {
            name: 'filterDestinations',
            description: 'Lọc danh sách các địa điểm trên trang Khám phá theo từ khóa, khu vực hoặc thể loại',
            parameters: {
              type: 'OBJECT',
              properties: {
                query: { type: 'STRING', description: 'Từ khóa tìm kiếm (chùa, bảo tàng, Sa Đéc, hủ tiếu...)' },
                category: { type: 'STRING', description: 'Mã thể loại: nature, eco, culture, history, food, local_experience' },
              },
            },
          },
          {
            name: 'openPage',
            description: 'Mở trang chức năng trong hệ thống (/account, /passport, /favorites, /my-itineraries, /itinerary/create, /check-in, /destinations, /footprints)',
            parameters: {
              type: 'OBJECT',
              properties: {
                path: { type: 'STRING', description: 'Đường dẫn nội bộ bắt đầu bằng /' },
                label: { type: 'STRING', description: 'Tên trang hiển thị' },
              },
              required: ['path'],
            },
          },
          {
            name: 'toggleFavoriteDestination',
            description: 'Thêm hoặc bỏ một địa điểm khỏi danh sách Yêu thích',
            parameters: {
              type: 'OBJECT',
              properties: {
                slug: { type: 'STRING', description: 'Slug của địa điểm' },
                destinationName: { type: 'STRING', description: 'Tên địa điểm' },
                mode: { type: 'STRING', description: 'add hoặc remove' },
              },
              required: ['destinationName'],
            },
          },
          {
            name: 'updateUserProfile',
            description: 'Cập nhật hồ sơ cá nhân (đổi tên hiển thị, sở thích hoặc đổi mật khẩu)',
            parameters: {
              type: 'OBJECT',
              properties: {
                newDisplayName: { type: 'STRING', description: 'Tên hiển thị mới' },
                numberOfDays: { type: 'INTEGER', description: 'Số ngày du lịch mặc định (1-7)' },
                hoursPerDay: { type: 'INTEGER', description: 'Số giờ tham quan mỗi ngày (4-10)' },
                currentPassword: { type: 'STRING', description: 'Mật khẩu hiện tại' },
                newPassword: { type: 'STRING', description: 'Mật khẩu mới' },
              },
            },
          },
          {
            name: 'registerAccount',
            description: 'Mở trang đăng ký, tự điền email & mật khẩu và tạo tài khoản',
            parameters: {
              type: 'OBJECT',
              properties: {
                email: { type: 'STRING', description: 'Email đăng ký' },
                password: { type: 'STRING', description: 'Mật khẩu (tối thiểu 6 ký tự)' },
                displayName: { type: 'STRING', description: 'Tên hiển thị' },
              },
              required: ['email', 'password'],
            },
          },
          {
            name: 'loginAccount',
            description: 'Mở trang đăng nhập và tự điền email & mật khẩu nếu đã có đủ cả hai',
            parameters: {
              type: 'OBJECT',
              properties: {
                email: { type: 'STRING', description: 'Email đăng nhập' },
                password: { type: 'STRING', description: 'Mật khẩu' },
              },
            },
          },
          {
            name: 'logoutAccount',
            description: 'Đăng xuất tài khoản hiện tại',
            parameters: { type: 'OBJECT', properties: {} },
          },
          {
            name: 'syncPassport',
            description: 'Đồng bộ Hộ chiếu Trải nghiệm số trên trình duyệt vào tài khoản đăng nhập',
            parameters: { type: 'OBJECT', properties: {} },
          },
          {
            name: 'performDomAutomation',
            description: 'Điều khiển trực tiếp nút bấm, tab hoặc ô nhập liệu trên màn hình hiện tại (dựa trên Live DOM Controls)',
            parameters: {
              type: 'OBJECT',
              properties: {
                label: { type: 'STRING', description: 'Mô tả thao tác trên giao diện' },
                steps: {
                  type: 'ARRAY',
                  items: {
                    type: 'OBJECT',
                    properties: {
                      op: { type: 'STRING', description: 'click, fill, hoặc scroll' },
                      targetId: { type: 'STRING', description: 'ID phần tử từ Live DOM Controls' },
                      targetText: { type: 'STRING', description: 'Nhãn nút hoặc tab' },
                      value: { type: 'STRING', description: 'Giá trị điền nếu op là fill' },
                    },
                    required: ['op'],
                  },
                },
              },
              required: ['steps'],
            },
          },
        ],
      },
    ];

    const contents = [
      ...history.slice(-12).map((h) => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }],
      })),
      {
        role: 'user',
        parts: [{ text: message }],
      },
    ];

    const modelsToTry = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'];
    let response: any = null;

    const callWithTimeout = (promise: Promise<any>, timeoutMs: number = 12000) => {
      let timer: NodeJS.Timeout;
      const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs);
      });
      return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer!));
    };

    for (const model of modelsToTry) {
      try {
        response = await callWithTimeout(
          ai.models.generateContent({
            model,
            contents: contents as any,
            config: {
              systemInstruction,
              tools: tools as any,
              temperature: 0.2,
            },
          }),
          12000,
        );
        if (response) break;
      } catch (err: any) {
        logger.warn({ model, err: err?.message || err }, 'Model failed or timed out, trying next candidate');
      }
    }

    if (!response) {
      return runOfflineDeterministicFallback(message, history, catalog, pageContext);
    }

    // Tier 3: Deterministic Ground-Truth Tool Executor
    let action: CopilotAction | undefined;
    let replyText = response.text || '';
    let toolMatchedDestinations: DestinationSummary[] = [];

    const functionCalls = (response as any).functionCalls;
    if (functionCalls && functionCalls.length > 0) {
      const call = functionCalls[0];
      const args = call.args || {};

      if (call.name === 'suggestSwapCandidates') {
        const reqDay = args.dayNumber ? Number(args.dayNumber) : undefined;
        let rawTarget = String(args.targetStopName || '').trim();
        if (!rawTarget && pageContext?.pendingSwap?.targetStopName) {
          rawTarget = pageContext.pendingSwap.targetStopName;
        }

        const resolved = resolveTargetStopInDraft(rawTarget, reqDay, pageContext?.draftItinerary, catalog);
        const draftStops =
          pageContext?.draftItinerary?.days?.flatMap((d) =>
            (d.stops || []).map((s) => ({ day: d.day, name: s.name, start: s.start })),
          ) || [];

        // If AI still has no target stop and there is a multi-stop itinerary, list real stops politely
        if (!rawTarget && draftStops.length > 1) {
          const stopListText = draftStops
            .slice(0, 8)
            .map((s, i) => `${i + 1}. **${s.name}** *(Ngày ${s.day}${s.start ? ` · ${s.start}` : ''})*`)
            .join('\n');
          return {
            reply:
              `Dạ **Pé Meko** thấy lịch trình hiện tại của bạn đang có các điểm dừng sau:\n\n${stopListText}\n\n` +
              `Bạn muốn **đổi điểm nào** ạ? Bấm chọn nhanh bên dưới hoặc nhắn tên điểm đó cho Pé Meko xổ danh sách gợi ý thật nhé! 🦊🧭`,
            action: {
              type: 'ASK_CLARIFICATION',
              payload: { missingFields: ['targetStopName'], contextType: 'swap_stop' },
            },
            suggestions: draftStops.slice(0, 4).map((s) => `Đổi ${s.name} (Ngày ${s.day}) sang điểm khác`),
          };
        }

        const finalTarget = resolved?.stopName || rawTarget || draftStops[0]?.name || 'điểm dừng hiện tại';
        const finalDay = resolved?.dayNumber ?? reqDay ?? draftStops[0]?.day ?? 1;
        const excludeNamesNorm =
          resolved?.existingStopNamesNorm ?? getAllExistingStopNamesNorm(pageContext?.draftItinerary);
        const criteria = buildSwapCriteriaFromToolArgs(args, message);

        const { candidates } = rankSwapCandidates(catalog, criteria, {
          excludeNamesNorm,
          targetStopName: finalTarget,
          refCoords: resolved?.refCoords,
          limit: 6,
        });

        const safeNotFoundQuery = sanitizeNotFoundQuery(args.notFoundPlaceName, {
          targetStopName: finalTarget,
          rawTarget,
          existingNamesNorm: excludeNamesNorm,
        });

        const built = buildChooseSwapCandidateResponse({
          dayNumber: finalDay,
          targetStopId: resolved?.stopId,
          targetStopName: finalTarget,
          criteriaLabel: criteria.criteriaLabel,
          notFoundQuery: safeNotFoundQuery,
          candidates,
        });
        action = built.action;
        replyText = built.reply;
      } else if (call.name === 'swapItineraryStop') {
        const reqDay = args.dayNumber ? Number(args.dayNumber) : pageContext?.pendingSwap?.dayNumber || 1;
        let rawTarget = String(args.targetStopName || '').trim();
        if (!rawTarget && pageContext?.pendingSwap?.targetStopName) {
          rawTarget = pageContext.pendingSwap.targetStopName;
        }
        const resolved = resolveTargetStopInDraft(rawTarget, reqDay, pageContext?.draftItinerary, catalog);
        const finalDay = resolved?.dayNumber ?? reqDay;
        const finalTarget = resolved?.stopName || rawTarget || 'điểm dừng hiện tại';

        const bySlug = args.newDestinationSlug
          ? catalog.find((c) => c.slug === String(args.newDestinationSlug).trim())
          : undefined;
        let verifiedDest = bySlug
          ? toCopilotDestinationInfo(bySlug)
          : findDestinationByText(String(args.newDestinationName || args.newDestinationSlug || ''), catalog);

        // Guard against pronoun placeholder passed by LLM
        if (
          !verifiedDest &&
          lastDiscussed &&
          /^(?:no|diem nay|cho nay|diem do|cho do|it)$/i.test(normalizeText(String(args.newDestinationName || '')))
        ) {
          verifiedDest = lastDiscussed;
        }

        if (!verifiedDest) {
          const requestedNewText = String(args.newDestinationName || '').trim();
          const criteria = extractSwapCriteria(requestedNewText || message);
          const excludeNamesNorm =
            resolved?.existingStopNamesNorm ?? getAllExistingStopNamesNorm(pageContext?.draftItinerary);
          const { candidates } = rankSwapCandidates(catalog, criteria, {
            excludeNamesNorm,
            targetStopName: finalTarget,
            refCoords: resolved?.refCoords,
            limit: 6,
          });
          const safeNotFound =
            requestedNewText && !criteria.hasExplicitCriteria
              ? sanitizeNotFoundQuery(requestedNewText, {
                  targetStopName: finalTarget,
                  rawTarget,
                  existingNamesNorm: excludeNamesNorm,
                })
              : undefined;
          const fallbackChoose = buildChooseSwapCandidateResponse({
            dayNumber: finalDay,
            targetStopId: resolved?.stopId,
            targetStopName: finalTarget,
            criteriaLabel: criteria.criteriaLabel,
            notFoundQuery: safeNotFound,
            candidates,
          });
          action = fallbackChoose.action;
          replyText = fallbackChoose.reply;
        } else {
          const directResp = buildDirectSwapResponse({
            dayNumber: finalDay,
            targetStopId: resolved?.stopId,
            targetStopName: finalTarget,
            newDestination: verifiedDest,
          });
          action = directResp.action;
          replyText = replyText || directResp.reply;
        }
      } else if (call.name === 'addItineraryStop') {
        const dayNumber = Math.max(1, Number(args.dayNumber) || 1);
        const bySlug = args.destinationSlug
          ? catalog.find((c) => c.slug === String(args.destinationSlug).trim())
          : undefined;
        const verifiedDest = bySlug
          ? toCopilotDestinationInfo(bySlug)
          : findDestinationByText(String(args.destinationName || args.destinationSlug || ''), catalog) ||
            lastDiscussed;

        if (verifiedDest) {
          action = {
            type: 'ADD_ITINERARY_STOP',
            payload: {
              path: '/itinerary/create#plan',
              label: `Thêm "${verifiedDest.name}" vào Ngày ${dayNumber}`,
              dayNumber,
              newDestination: verifiedDest,
            },
          };
          replyText =
            replyText ||
            `Dạ **Pé Meko** đang thêm **${verifiedDest.name}** (${verifiedDest.area}) vào **Ngày ${dayNumber}** trong lịch trình của bạn ngay đây ạ! 🦊➕`;
        }
      } else if (call.name === 'removeItineraryStop') {
        const reqDay = args.dayNumber ? Number(args.dayNumber) : undefined;
        const rawTarget = String(args.targetStopName || '').trim();
        const resolved = resolveTargetStopInDraft(rawTarget, reqDay, pageContext?.draftItinerary, catalog);
        const finalDay = resolved?.dayNumber ?? reqDay ?? 1;
        const finalTarget = resolved?.stopName || rawTarget;
        action = {
          type: 'REMOVE_ITINERARY_STOP',
          payload: {
            path: '/itinerary/create#plan',
            label: `Bỏ "${finalTarget}" (Ngày ${finalDay})`,
            dayNumber: finalDay,
            targetStopId: resolved?.stopId,
            targetStopName: finalTarget,
          },
        };
        if (!replyText) {
          replyText = `Dạ **Pé Meko** đang gỡ **${finalTarget}** khỏi **Ngày ${finalDay}** trong lịch trình của bạn! 🦊✂️`;
        }
      } else if (call.name === 'inspectCurrentItinerary') {
        const reqDay = args.dayNumber ? Number(args.dayNumber) : undefined;
        const summary = buildItinerarySummaryResponse(pageContext, reqDay);
        replyText = summary.reply;
      } else if (call.name === 'updateUserProfile') {
        const newDisplayName = args.newDisplayName ? String(args.newDisplayName).trim() : undefined;
        const numberOfDays = args.numberOfDays ? Number(args.numberOfDays) : undefined;
        const hoursPerDay = args.hoursPerDay ? Number(args.hoursPerDay) : undefined;
        const currentPassword = args.currentPassword ? String(args.currentPassword) : undefined;
        const newPassword = args.newPassword ? String(args.newPassword) : undefined;

        action = {
          type: 'UPDATE_PROFILE',
          payload: {
            path: '/account',
            label: newDisplayName
              ? `Đổi tên hiển thị → "${newDisplayName}"`
              : 'Cập nhật hồ sơ cá nhân',
            newDisplayName,
            currentPassword,
            newPassword,
            preferences:
              numberOfDays || hoursPerDay ? { numberOfDays, hoursPerDay } : undefined,
          },
        };
        if (!replyText) {
          replyText = newDisplayName
            ? `Dạ **Pé Meko** đang cập nhật **Tên hiển thị** của bạn thành **${newDisplayName}** và mở trang Cá nhân cho bạn kiểm tra ngay! 🦊✨`
            : `Dạ **Pé Meko** đang cập nhật thông tin hồ sơ cá nhân cho bạn ngay đây ạ! 🦊✨`;
        }
      } else if (call.name === 'performDomAutomation') {
        const rawSteps = Array.isArray(args.steps) ? args.steps : [];
        const domSteps: DomAutomationStep[] = rawSteps.map((s: any) => ({
          op: s.op === 'fill' ? 'fill' : s.op === 'scroll' ? 'scroll' : 'click',
          targetId: s.targetId ? String(s.targetId) : undefined,
          targetText: s.targetText ? String(s.targetText) : undefined,
          value: s.value !== undefined ? String(s.value) : undefined,
        }));
        action = {
          type: 'DOM_AUTOMATION',
          payload: {
            label: String(args.label || 'Tự động tương tác giao diện'),
            domSteps,
          },
        };
        if (!replyText) {
          replyText = `Dạ **Pé Meko** đã nhận diện các phần tử trên màn hình và đang tự động thao tác giúp bạn ngay! 🦊⚡`;
        }
      } else if (call.name === 'toggleFavoriteDestination') {
        const bySlug = args.slug ? catalog.find((c) => c.slug === String(args.slug).trim()) : undefined;
        const dest =
          (bySlug ? toCopilotDestinationInfo(bySlug) : null) ||
          findDestinationByText(String(args.destinationName || args.slug || ''), catalog) ||
          lastDiscussed;
        const isRemove = args.mode === 'remove';
        if (dest) {
          action = {
            type: 'TOGGLE_FAVORITE',
            payload: {
              path: '/favorites',
              label: `${isRemove ? 'Bỏ yêu thích' : 'Lưu yêu thích'}: ${dest.name}`,
              destinationId: dest.id,
              destinationSlug: dest.slug,
              destinationName: dest.name,
              favoriteMode: isRemove ? 'remove' : 'add',
            },
          };
          if (!replyText) {
            replyText = `Dạ **Pé Meko** đã ${isRemove ? 'bỏ lưu' : 'lưu'} **${dest.name}** vào danh sách Yêu thích cho bạn! 🦊❤️`;
          }
        }
      } else if (call.name === 'saveCurrentItinerary') {
        const itineraryTitle = args.title ? String(args.title).trim() : undefined;
        action = {
          type: 'SAVE_ITINERARY',
          payload: {
            path: '/my-itineraries',
            label: itineraryTitle ? `Lưu lịch trình "${itineraryTitle}"` : 'Lưu lịch trình vào tài khoản',
            itineraryTitle,
          },
        };
        if (!replyText) {
          replyText = `Dạ **Pé Meko** đang lưu lịch trình hiện tại vào tài khoản của bạn ngay! 🦊💾`;
        }
      } else if (call.name === 'logoutAccount') {
        action = {
          type: 'LOGOUT_ACCOUNT',
          payload: { path: '/', label: 'Đăng xuất tài khoản' },
        };
        if (!replyText) {
          replyText = `Dạ **Pé Meko** đã đăng xuất tài khoản cho bạn! 🦊👋`;
        }
      } else if (call.name === 'syncPassport') {
        action = {
          type: 'SYNC_PASSPORT',
          payload: { path: '/passport', label: 'Đồng bộ Hộ chiếu số vào tài khoản' },
        };
        if (!replyText) {
          replyText = `Dạ **Pé Meko** đang đồng bộ dữ liệu Hộ chiếu trải nghiệm số vào tài khoản của bạn ngay! 🦊🛂`;
        }
      } else if (call.name === 'navigateToDestination') {
        const slugStr = String(args.slug || '').trim();
        const dest =
          catalog.find((c) => c.slug === slugStr) ||
          catalog.find(
            (c) => normalizeText(c.name) === normalizeText(String(args.destinationName || '')),
          );
        if (dest) {
          action = {
            type: 'NAVIGATE',
            payload: { path: `/destinations/${dest.slug}`, label: dest.name },
          };
          toolMatchedDestinations = [dest];
          if (!replyText) {
            const extraDetails: string[] = [];
            if (dest.summary) extraDetails.push(`• 📝 **Giới thiệu**: ${dest.summary}`);
            if (dest.address) extraDetails.push(`• 📍 **Địa chỉ**: ${dest.address}`);
            if (dest.openingHours) extraDetails.push(`• ⏰ **Giờ mở cửa**: ${dest.openingHours}`);
            if (dest.referencePrice) extraDetails.push(`• 🎫 **Giá vé**: ${dest.referencePrice}`);
            replyText =
              `Dạ **Pé Meko** mở ngay thông tin chi tiết của **${dest.name}** (${dest.area}) cho bạn xem nhé! 🦊📍` +
              (extraDetails.length > 0 ? `\n\n${extraDetails.join('\n')}` : '');
          }
        }
      } else if (call.name === 'filterDestinations') {
        const rawQuery = args.query ? String(args.query).trim() : '';
        const rawCat = args.category ? String(args.category).trim() : '';
        const catMap: Record<string, string> = {
          'sinh-thai': 'eco',
          'van-hoa': 'culture',
          'lich-su': 'history',
          'am-thuc': 'food',
          'thien-nhien': 'nature',
          'trai-nghiem': 'local_experience',
        };
        const mappedCat = catMap[rawCat] || rawCat;

        const q = rawQuery ? `q=${encodeURIComponent(rawQuery)}` : '';
        const cat = mappedCat ? `category=${encodeURIComponent(mappedCat)}` : '';
        const qs = [q, cat].filter(Boolean).join('&');

        const normQ = normalizeText(rawQuery);
        toolMatchedDestinations = catalog.filter((c) => {
          const catMatch = mappedCat ? c.category === mappedCat : true;
          const qMatch = normQ
            ? normalizeText(`${c.name} ${c.summary} ${c.area} ${c.tags.join(' ')}`).includes(normQ)
            : true;
          return catMatch && qMatch;
        });

        action = {
          type: 'FILTER',
          payload: {
            path: `/destinations${qs ? `?${qs}` : ''}`,
            label: rawQuery || formatCategoryLabel(mappedCat) || 'Tìm kiếm địa điểm',
          },
        };
        if (!replyText) {
          const bulletList =
            toolMatchedDestinations.length > 0
              ? `\n\n**Danh sách địa điểm phù hợp (${toolMatchedDestinations.length}):**\n${formatDestinationBulletList(toolMatchedDestinations, 8)}`
              : '';
          replyText = `Dạ **Pé Meko** đã lọc danh sách các địa điểm phù hợp trên màn hình cho bạn rồi nhé! 🦊${bulletList}`;
        }
      } else if (call.name === 'openPage') {
        const targetPath = String(args.path || '/');
        if (
          targetPath.startsWith('/admin') &&
          pageContext?.currentUser?.role !== 'admin' &&
          pageContext?.currentUser?.role !== 'partner'
        ) {
          return {
            reply: `🛡️ **Rào chắn Phân quyền (RBAC):** Tài khoản hiện tại của bạn không có quyền Quản trị viên để mở trang \`${targetPath}\`!`,
            action: {
              type: 'SECURITY_BLOCKED',
              payload: {
                label: '🛡️ Chặn truy cập /admin trái phép',
                securityReason: 'RBAC_ADMIN_BLOCKED',
              },
            },
          };
        }
        action = {
          type: 'OPEN_PAGE',
          payload: { path: targetPath, label: String(args.label || targetPath) },
        };
        if (!replyText) {
          replyText = `Dạ **Pé Meko** chuyển bạn sang trang **${args.label || targetPath}** ngay nhé! 🦊`;
        }
      } else if (call.name === 'planItinerary') {
        const d = Math.min(7, Math.max(1, Number(args.days) || 2));
        const p = Math.min(100, Math.max(1, Number(args.people) || 2));
        const b = Math.max(100000, Number(args.budget_vnd) || 2000000);
        const runId = Date.now();
        action = {
          type: 'PLAN_ITINERARY',
          payload: {
            path: `/itinerary/create?days=${d}&people=${p}&budget=${b}&autoPlan=true&run=${runId}#plan`,
            label: `Tự động lập lịch trình ${d} ngày (${p} người, ${b.toLocaleString('vi-VN')}đ)`,
            days: d,
            people: p,
            budgetVnd: b,
          },
        };
        if (!replyText) {
          replyText = `Dạ **Pé Meko** đã nạp thông số chuyến đi **${d} ngày cho ${p} người (ngân sách ${b.toLocaleString('vi-VN')}đ)** và kích hoạt AI Trip Planner V9 lập lịch trình ngay cho bạn đây ạ! 🦊`;
        }
      } else if (call.name === 'registerAccount') {
        const email = String(args.email || '').trim();
        const password = String(args.password || '').trim();
        const displayName = String(args.displayName || email.split('@')[0] || 'Du khách').trim();
        action = {
          type: 'REGISTER_ACCOUNT',
          payload: {
            path: '/register',
            label: `Tạo tài khoản ${email}`,
            email,
            password,
            displayName,
          },
        };
        if (!replyText) {
          replyText = `Dạ **Pé Meko** đang mở trang Đăng ký, điền email \`${email}\` & mật khẩu để khởi tạo tài khoản tự động cho bạn ngay! 🦊`;
        }
      } else if (call.name === 'loginAccount') {
        const email = args.email ? String(args.email).trim() : undefined;
        const password = args.password ? String(args.password).trim() : undefined;
        if (email && password) {
          action = {
            type: 'LOGIN_ACCOUNT',
            payload: {
              path: '/login',
              label: `Đăng nhập ${email}`,
              email,
              password,
            },
          };
          replyText =
            replyText ||
            `Dạ **Pé Meko** đang mở trang Đăng nhập, điền sẵn email \`${email}\` & mật khẩu để đăng nhập tự động cho bạn ngay! 🦊`;
        } else {
          action = {
            type: 'OPEN_PAGE',
            payload: { path: '/login', label: 'Trang Đăng nhập' },
          };
          replyText =
            replyText ||
            `Dạ **Pé Meko** đã mở trang **Đăng nhập** cho bạn rồi ạ! Nếu muốn đăng nhập tự động, bạn nhắn thêm Email và Mật khẩu nhé! 🦊`;
        }
      }
    }

    const matchedDestinations =
      toolMatchedDestinations.length > 0
        ? toolMatchedDestinations.slice(0, 6)
        : action?.type === 'CHOOSE_SWAP_CANDIDATE' ||
            action?.type === 'SWAP_ITINERARY_STOP' ||
            action?.type === 'ADD_ITINERARY_STOP'
          ? []
          : catalog
              .filter(
                (c) =>
                  replyText.toLowerCase().includes(c.name.toLowerCase()) ||
                  message.toLowerCase().includes(c.name.toLowerCase()),
              )
              .slice(0, 5);

    const suggestions = buildContextualSuggestions(action, pageContext, matchedDestinations);

    return {
      reply: replyText || 'Dạ **Pé Meko** có thể giúp gì tiếp theo cho bạn ạ? 🦊',
      action,
      matchedDestinations: matchedDestinations.length > 0 ? matchedDestinations : undefined,
      suggestions,
    };
  } catch (err) {
    logger.error({ err }, 'Gemini Copilot execution failed');
    return runOfflineDeterministicFallback(message, history, catalog, pageContext);
  }
}
