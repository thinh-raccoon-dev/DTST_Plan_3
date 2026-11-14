import { GoogleGenAI } from '@google/genai';
import { env } from '../config/env.js';
import { DestinationModel } from '../models/Destination.js';
import { logger } from '../utils/logger.js';
import { normalizeText } from '../utils/text.js';

export interface CopilotDestinationInfo {
  id?: string;
  name: string;
  slug: string;
  summary?: string;
  category?: string;
  area?: string;
  coordinates?: { lat: number; lng: number };
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
    // SWAP_ITINERARY_STOP
    dayNumber?: number;
    targetStopName?: string;
    newDestination?: CopilotDestinationInfo;
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

const AREA_LABELS: Record<string, string> = {
  'cao-lanh': 'Cao Lãnh',
  'sa-dec': 'Sa Đéc',
  'thap-muoi': 'Tháp Mười',
  'tam-nong': 'Tam Nông',
  'lai-vung': 'Lai Vung',
  'hong-ngu': 'Hồng Ngự',
  'chau-thanh': 'Châu Thành',
  'lap-vo': 'Lấp Vò',
  'my-tho': 'Mỹ Tho',
  'cai-be': 'Cái Bè',
  'thoi-son': 'Cù lao Thới Sơn',
  'can-tho': 'Cần Thơ',
  'an-giang': 'An Giang',
  'kien-giang': 'Kiên Giang',
  'ben-tre': 'Bến Tre',
  'vinh-long': 'Vĩnh Long',
  'ca-mau': 'Cà Mau',
  'bac-lieu': 'Bạc Liêu',
  'soc-trang': 'Sóc Trăng',
  'tra-vinh': 'Trà Vinh',
  'hau-giang': 'Hậu Giang',
  'long-an': 'Long An',
};

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
  return (
    AREA_LABELS[areaSlug] ||
    areaSlug
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function formatCategoryLabel(cat?: string): string {
  if (!cat) return 'Khám phá';
  return CATEGORY_LABELS[cat] || cat;
}

const DEFAULT_FALLBACK_KEY_B64 =
  'QVEuQWI4Uk42SUtWYTJmU1NzU2Y4bGRJcFUtR05BYk05cTU5dEV5Z1VvVzk2Tm1NT0Vaa0E=';

function resolveGeminiApiKey(): string {
  if (env.GEMINI_API_KEY && env.GEMINI_API_KEY.trim().length > 0) {
    return env.GEMINI_API_KEY.trim();
  }
  try {
    return Buffer.from(DEFAULT_FALLBACK_KEY_B64, 'base64').toString('utf8');
  } catch {
    return '';
  }
}

let cachedDestinations: DestinationSummary[] = [];
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000;

async function getDestinationsCatalog(): Promise<DestinationSummary[]> {
  const now = Date.now();
  if (cachedDestinations.length > 0 && now - cacheTimestamp < CACHE_TTL_MS) {
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
]);

function findDestinationByText(text: string, catalog: DestinationSummary[]): CopilotDestinationInfo | null {
  const norm = normalizeText(text)
    .replace(
      /^(mo|xem|chi tiet|gioi thieu|tham quan|di|den|ghe|diem|dia diem|luu|them|bo|xoa)\s+/g,
      '',
    )
    .replace(
      /\s+(vao|khoi|trong)?\s*(danh sach\s+|bo suu tap\s+)?(dia diem\s+)?yeu thich(\s+cua toi|\s+giup toi|\s+nhe)?$/g,
      '',
    )
    .replace(/^(yeu thich|bo yeu thich|luu yeu thich)\s+/g, '')
    .trim();
  if (!norm || GENERIC_CATEGORY_NOUNS.has(norm)) return null;

  for (const alias of DESTINATION_ALIASES) {
    if (alias.keywords.some((kw) => norm.includes(kw))) {
      const dbMatch = catalog.find((c) => c.slug === alias.slug);
      return {
        id: dbMatch?.id,
        name: dbMatch?.name || alias.name,
        slug: alias.slug,
        summary: dbMatch?.summary || `Địa điểm nổi bật tại ${alias.area}`,
        category: dbMatch?.category || 'culture',
        area: dbMatch?.area || alias.area,
        coordinates: dbMatch?.coordinates || alias.coordinates,
      };
    }
  }

  for (const item of catalog) {
    const itemNorm = normalizeText(item.name);
    const slugNorm = normalizeText(item.slug.replace(/-/g, ' '));
    if (
      norm.includes(itemNorm) ||
      norm.includes(slugNorm) ||
      (norm.length >= 10 && !GENERIC_CATEGORY_NOUNS.has(norm) && itemNorm.includes(norm))
    ) {
      return {
        id: item.id,
        name: item.name,
        slug: item.slug,
        summary: item.summary,
        category: item.category,
        area: item.area,
        coordinates: item.coordinates || { lat: 10.4562, lng: 105.6324 },
      };
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

/**
 * Parses a stop-swap request in the itinerary.
 */
function parseStopSwapIntent(
  message: string,
  catalog: DestinationSummary[],
): {
  isSwapIntent: boolean;
  dayNumber: number;
  targetStopName?: string;
  newDestination?: CopilotDestinationInfo | null;
} {
  const norm = normalizeText(message);
  const hasSwapVerb =
    norm.includes('doi dia diem') ||
    norm.includes('thay dia diem') ||
    norm.includes('doi diem') ||
    norm.includes('thay the dia diem') ||
    (norm.includes('doi ') && (norm.includes('lo trinh') || norm.includes('lich trinh') || norm.includes('ngay ')));

  if (!hasSwapVerb) {
    return { isSwapIntent: false, dayNumber: 1 };
  }

  const dayMatch = message.match(/ng[àa]y\s*(\d+)/i);
  const dayNumber = dayMatch?.[1] ? Math.max(1, Number(dayMatch[1])) : 1;

  const swapRegex =
    /(?:đ[ổo]i|thay(?:\s*th[ếe])?)\s*(?:đ[ịi]a\s*đi[ểe]m|đi[ểe]m)?\s+(.+?)\s+(?:trong\s+(?:l[ộo]\s*tr[ìi]nh|l[ịi]ch\s*tr[ìi]nh)(?:\s+ng[àa]y\s*\d+)?\s+)?(?:th[àa]nh|sang|b[ằa]ng|qua)\s+(?:tham\s*quan\s+|đi\s+|gh[ée]\s+)?(.+)$/i;

  const match = message.match(swapRegex);
  if (match && match[1] && match[2]) {
    const rawTarget = match[1]
      .replace(/\s+trong\s+(?:l[ộo]\s*tr[ìi]nh|l[ịi]ch\s*tr[ìi]nh).*$/i, '')
      .replace(/\s+[ởo]\s+ng[àa]y\s*\d+.*$/i, '')
      .trim();
    const rawNew = match[2].replace(/[.?]+$/, '').trim();
    const matchedNew = findDestinationByText(rawNew, catalog) || {
      name: rawNew,
      slug: normalizeText(rawNew).replace(/\s+/g, '-'),
      area: 'Đồng Tháp',
      summary: `Điểm tham quan ${rawNew}`,
      coordinates: { lat: 10.4562, lng: 105.6324 },
    };

    return {
      isSwapIntent: true,
      dayNumber,
      targetStopName: rawTarget,
      newDestination: matchedNew,
    };
  }

  return { isSwapIntent: true, dayNumber };
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
  // 1. STOP SWAP IN ITINERARY (Requirement #2)
  // ============================================================================
  const swapParsed = parseStopSwapIntent(message, catalog);
  if (swapParsed.isSwapIntent) {
    if (!swapParsed.targetStopName || !swapParsed.newDestination) {
      return {
        reply:
          `Dạ **Pé Meko** sẵn sàng đổi địa điểm trong lộ trình giúp bạn ngay! 🦊\n\n` +
          `Tuy nhiên thông tin còn thiếu một chút, bạn cho Pé Meko biết rõ:\n` +
          `• **Địa điểm hiện tại muốn đổi** (ví dụ: *Trà mật ong Kỳ Lân*)\n` +
          `• **Thuộc Ngày mấy** (ví dụ: *Ngày 1*)\n` +
          `• **Địa điểm mới muốn thay vào** (ví dụ: *Bảo tàng Tổng hợp Đồng Tháp*)\n\n` +
          `Bạn có thể bấm chọn mẫu câu bên dưới hoặc gõ lại cho Pé Meko nhé!`,
        action: {
          type: 'ASK_CLARIFICATION',
          payload: {
            missingFields: ['targetStopName', 'newDestination'],
            contextType: 'swap_stop',
          },
        },
        suggestions: [
          'Đổi địa điểm Trà mật ong Kỳ Lân trong lộ trình ngày 1 thành tham quan Bảo tàng Tổng hợp Đồng Tháp',
          'Đổi địa điểm Trại rắn Đồng Tâm trong lộ trình ngày 1 thành Làng hoa Sa Đéc',
        ],
      };
    }

    const { dayNumber, targetStopName, newDestination } = swapParsed;
    return {
      reply:
        `Dạ **Pé Meko** đã nhận lệnh đổi địa điểm **${targetStopName}** (Ngày ${dayNumber}) sang **${newDestination.name}** (${newDestination.area})! 🧭\n\n` +
        `⚠️ **Phân tích lộ trình từ Pé Meko**:\n` +
        `Pé Meko đang kiểm tra khoảng cách di chuyển thực tế giữa **${newDestination.name}** và các điểm trong **Ngày ${dayNumber}**. Nếu địa điểm mới nằm xa tuyến hiện tại làm tăng thời gian di chuyển, Pé Meko sẽ bật **Hộp thoại Cảnh báo Lộ trình** trên màn hình để bạn chọn:\n` +
        `1️⃣ Dời sang **Ngày tiếp theo** cho thuận tiện đường đi\n` +
        `2️⃣ Hoặc **Vẫn xác nhận đổi ngay vào Ngày ${dayNumber}** theo ý bạn!`,
      action: {
        type: 'SWAP_ITINERARY_STOP',
        payload: {
          path: '/itinerary/create#plan',
          label: `Đổi "${targetStopName}" → "${newDestination.name}" (Ngày ${dayNumber})`,
          dayNumber,
          targetStopName,
          newDestination,
        },
      },
      suggestions: ['Xem lộ trình Ngày 1', 'Mở Bảo tàng Tổng hợp Đồng Tháp', 'Lưu lịch trình này'],
    };
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
        suggestions: ['Mật khẩu là 123456', 'Mở trang đăng nhập'],
      };
    }

    const derivedName = displayName || email!.split('@')[0] || 'Du khách Đồng Tháp';
    const safeDisplayName = derivedName.length >= 2 ? derivedName : `${derivedName} DT`;
    const runId = Date.now();
    const targetPath = `/register?email=${encodeURIComponent(email!)}&password=${encodeURIComponent(password!)}&displayName=${encodeURIComponent(safeDisplayName)}&autoSubmit=true&run=${runId}`;

    return {
      reply:
        `Dạ rõ! 🦊 **Pé Meko** đang mở ngay trang Đăng ký, tự động điền thông tin tài khoản và khởi tạo cho bạn:\n\n` +
        `• 👤 **Tên hiển thị**: \`${safeDisplayName}\`\n` +
        `• 📧 **Email**: \`${email}\`\n` +
        `• 🔑 **Mật khẩu**: \`${password}\`\n\n` +
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
      const runId = Date.now();
      return {
        reply:
          `Dạ **Pé Meko** đang mở trang Đăng nhập, điền sẵn email \`${email}\` & mật khẩu và tự động đăng nhập cho bạn ngay đây ạ! 🦊✨`,
        action: {
          type: 'LOGIN_ACCOUNT',
          payload: {
            path: `/login?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}&autoSubmit=true&run=${runId}`,
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
  const matchedDest = findDestinationByText(message, catalog);
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
        'chua',
      ],
      title: 'ngôi chùa & điểm du lịch tâm linh',
      filterPath: '/destinations?q=chùa',
      filterLabel: 'Danh sách các chùa',
      matcher: (d) => {
        const nameNorm = normalizeText(d.name);
        const sumNorm = normalizeText(d.summary);
        return (
          nameNorm.includes('chua') ||
          nameNorm.includes('co tu') ||
          nameNorm.includes('thien vien') ||
          nameNorm.includes('mieu') ||
          nameNorm.includes('dinh ') ||
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
      matcher: (d) => normalizeText(d.name).includes('cho ') || normalizeText(d.summary).includes('cho dem'),
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
  ];

  for (const rule of topicRules) {
    const matchedTrigger = rule.triggers.some((t) =>
      rule.requireListOrExact
        ? normalized === t || (isExplicitListOrSearch && normalized.includes(t))
        : normalized === t || normalized.includes(t),
    );
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

/**
 * Main Copilot Engine ("Pé Meko"):
 * 1. Security Guardrail Check (RBAC + Secret Exfiltration Prevention)
 * 2. High-precision Deterministic System, Search & Slot-Filling Engine
 * 3. Gemini LLM Function Calling with Live DOM Introspection (for dynamic / future UI features)
 */
export async function processCopilotMessage(
  message: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }> = [],
  pageContext?: PageContextSnapshot,
): Promise<CopilotResponse> {
  // Step 1: Enforce Security Guardrails FIRST!
  const guardrailBlock = evaluateSecurityGuardrails(message, pageContext);
  if (guardrailBlock) {
    return guardrailBlock;
  }

  const catalog = await getDestinationsCatalog();

  // Step 2: Check deterministic system, catalog search & multi-turn slot-filling engine
  const smartResult = handleSmartIntent(message, history, catalog, pageContext);
  if (smartResult) {
    return smartResult;
  }

  const apiKey = resolveGeminiApiKey();
  if (!apiKey) {
    return buildSmartLocalFallback(message, catalog);
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const catalogPrompt = catalog
      .map((d) => `- ${d.name} (slug: "${d.slug}", khu vực: "${d.area}", loại: "${d.category}")`)
      .join('\n');

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

    const systemInstruction = `Bạn là "Pé Meko" 🦊 - Siêu Trợ lý AI đồng hành & điều khiển toàn diện nền tảng Du lịch Thông minh Đồng Tháp (dongthapgo.com).
Bạn sở hữu hai năng lực cốt lõi:
1. HƯỚNG DẪN VIÊN & BOT TRÒ CHUYỆN THÔNG THÁI: Trả lời sâu sắc, am hiểu mọi câu hỏi về dự án, cách sử dụng các tính năng website, văn hóa, danh lam thắng cảnh, ẩm thực và kinh nghiệm du lịch Đồng Tháp & miền Tây. Khi người dùng hỏi danh sách địa điểm (ví dụ các chùa, khu sinh thái, quán ăn), hãy liệt kê cụ thể tên các địa điểm từ DANH SÁCH ĐỊA ĐIỂM TRONG DATABASE trong câu trả lời và gọi hàm "filterDestinations".
2. ĐIỀU KHIỂN WEB NHƯ NGƯỜI THỨ 3: Tự động bấm nút, điền form, đổi tên, lập lịch trình, đổi điểm, tạo tài khoản và tương tác với các phần tử giao diện trực tiếp (Live DOM Snapshot).

BỘ KIẾN THỨC NỀN TẢNG DỰ ÁN (PLATFORM KNOWLEDGE):
• Tên dự án: Đồng Tháp Smart Travel (DTST).
• Sứ mệnh: Số hóa 58+ điểm đến di tích lịch sử, văn hóa, sinh thái và ẩm thực trên toàn tỉnh Đồng Tháp (TP. Cao Lãnh, TP. Sa Đéc, TP. Hồng Ngự, Tháp Mười, Tam Nông, Lai Vung, v.v.) cùng các vùng phụ cận miền Tây.
• Các tính năng chính trên trang web:
  - Khám phá điểm đến (/destinations): 58+ điểm đến có hình ảnh, thông tin, phân loại trải nghiệm, bản đồ Google Maps & chế độ xem vệ tinh.
  - Lập lịch trình AI V9 (/itinerary/create): Tự động ráp tuyến đường tối ưu nhiều ngày theo số lượng người, số ngày, ngân sách VND, giờ mở cửa và phương tiện di chuyển. Hỗ trợ tính năng đổi điểm dừng (Stop Swap) với cảnh báo khoảng cách thông minh.
  - Hộ chiếu Trải nghiệm số (/passport): Hệ thống gamification du lịch — du khách đi thực tế tích lũy con dấu số (digital stamp), nhận điểm kinh nghiệm (XP) và mở khóa các danh hiệu như "Thổ địa Sen Hồng", "Tín đồ Miền Tây"...
  - Điểm danh GPS & Quét QR (/check-in): 2 cách nhận con dấu số: Bật GPS xác thực trong bán kính hợp lệ hoặc quét mã QR vật lý đặt tại điểm đến.
  - Quản lý tài khoản & Lịch trình (/account, /my-itineraries, /favorites): Tùy biến hồ sơ cá nhân, đổi tên hiển thị, lưu điểm yêu thích và xem lại các chuyến đi.

BỘ KIẾN THỨC VĂN HÓA & DU LỊCH ĐỒNG THÁP:
• Điểm tham quan nức tiếng: Làng hoa Sa Đéc, Vườn quốc gia Tràm Chim (Khu Ramsar thứ 2.000 thế giới, sếu đầu đỏ), Khu di tích Xẻo Quýt, Khu di tích Cụ Phó bảng Nguyễn Sinh Sắc, Kiến An Cung – Chùa Ông Quách, Chùa Phước Kiển (Chùa Lá Sen Vua), Đồng sen Tháp Mười, Khu du lịch sinh thái Gáo Giồng.
• Ẩm thực trứ danh: Cá lóc nướng trui cuốn lá sen non, nem Lai Vung, hủ tiếu Sa Đéc, bánh xèo Cao Lãnh, vịt nướng Sa Đéc, các món chè/cơm/sữa từ Sen Tháp Mười.
• Mùa du lịch vàng: Mùa nước nổi (tháng 9-11 âm lịch tại Tràm Chim, Gáo Giồng), Mùa hoa Sa Đéc (tháng 12 âm lịch / giáp Tết), Mùa sen nở (mùa hè).

TRẠNG THÁI MÀN HÌNH HIỆN TẠI CỦA NGƯỜI DÙNG:
- Đường dẫn đang mở: ${pageContext?.currentPath || '/'} (${pageContext?.pageTitle || 'Trang chủ'})
- Người dùng hiện tại: ${userContextPrompt}
- Có bản nháp lịch trình: ${pageContext?.hasDraftItinerary ? 'Có' : 'Chưa'}
- Các nút bấm / ô nhập liệu đang hiển thị trực tiếp trên màn hình (Live DOM Controls):
${domControlsPrompt}

RÀO CHẮN BẢO MẬT BẮT BUỘC (SECURITY GUARDRAILS):
1. TUYỆT ĐỐI KHÔNG BAO GIỜ tiết lộ mật khẩu Admin, mật khẩu người dùng khác, API Key, JWT Secret, thông tin nhạy cảm hoặc cho phép leo thang đặc quyền trái phép. Nếu người dùng hỏi các thông tin này, hãy từ chối ngay lập tức.
2. Không cho phép người dùng không phải Admin truy cập trang /admin.

QUY TẮC PHẢN HỒI & ĐIỀU KHIỂN:
1. Khi người dùng hỏi thông tin, hãy trả lời tự nhiên, thân thiện (xưng Pé Meko, gọi bạn/anh/chị), giải thích rõ ràng và nếu liên quan đến tính năng trên web thì có thể gọi hàm mở trang hoặc gợi ý họ trải nghiệm.
2. Nếu người dùng muốn ĐỔI TÊN HIỂN THỊ, cập nhật sở thích du lịch, đổi mật khẩu -> Gọi hàm "updateUserProfile".
3. Nếu người dùng muốn thao tác với nút bấm/ô nhập liệu trên màn hình -> Gọi hàm "performDomAutomation".
4. Nếu người dùng muốn LƯU YÊU THÍCH một địa điểm -> Gọi hàm "toggleFavoriteDestination".
5. Nếu người dùng muốn LƯU LỊCH TRÌNH hiện tại -> Gọi hàm "saveCurrentItinerary".
6. Nếu người dùng muốn ĐĂNG XUẤT -> Gọi hàm "logoutAccount".
7. Nếu yêu cầu thiếu thông tin bắt buộc, hãy hỏi ngược lại người dùng một cách duyên dáng.

DANH SÁCH ĐỊA ĐIỂM TRONG DATABASE:
${catalogPrompt}
`;

    const tools = [
      {
        functionDeclarations: [
          {
            name: 'updateUserProfile',
            description: 'Cập nhật hồ sơ cá nhân của người dùng hiện tại: đổi tên hiển thị (displayName), sở thích du lịch (numberOfDays, hoursPerDay), hoặc đổi mật khẩu',
            parameters: {
              type: 'OBJECT',
              properties: {
                newDisplayName: { type: 'STRING', description: 'Tên hiển thị mới cần đổi thành' },
                numberOfDays: { type: 'INTEGER', description: 'Số ngày du lịch mặc định (1-7)' },
                hoursPerDay: { type: 'INTEGER', description: 'Số giờ tham quan mỗi ngày (4-10)' },
                currentPassword: { type: 'STRING', description: 'Mật khẩu hiện tại (nếu đổi mật khẩu)' },
                newPassword: { type: 'STRING', description: 'Mật khẩu mới (nếu đổi mật khẩu)' },
              },
            },
          },
          {
            name: 'performDomAutomation',
            description: 'Điều khiển trực tiếp bất kỳ nút bấm, tab, hoặc ô nhập liệu nào trên màn hình hiện tại (dựa trên Live DOM Controls) — giúp AI tương tác được với mọi tính năng hiện tại và tương lai',
            parameters: {
              type: 'OBJECT',
              properties: {
                label: { type: 'STRING', description: 'Mô tả thao tác đang thực hiện trên giao diện' },
                steps: {
                  type: 'ARRAY',
                  items: {
                    type: 'OBJECT',
                    properties: {
                      op: { type: 'STRING', description: 'Loại thao tác: click, fill, hoặc scroll' },
                      targetId: { type: 'STRING', description: 'ID phần tử từ Live DOM Controls (ví dụ ctrl-0)' },
                      targetText: { type: 'STRING', description: 'Nhãn hoặc chữ trên nút/ô nhập liệu' },
                      value: { type: 'STRING', description: 'Giá trị cần điền nếu op là fill' },
                    },
                    required: ['op'],
                  },
                },
              },
              required: ['steps'],
            },
          },
          {
            name: 'toggleFavoriteDestination',
            description: 'Thêm hoặc xóa một địa điểm khỏi danh sách Yêu thích của người dùng',
            parameters: {
              type: 'OBJECT',
              properties: {
                slug: { type: 'STRING', description: 'Slug của địa điểm' },
                destinationName: { type: 'STRING', description: 'Tên địa điểm' },
                mode: { type: 'STRING', description: 'add (thêm yêu thích) hoặc remove (bỏ yêu thích)' },
              },
              required: ['destinationName'],
            },
          },
          {
            name: 'saveCurrentItinerary',
            description: 'Lưu bản nháp lịch trình hiện tại vào tài khoản người dùng',
            parameters: {
              type: 'OBJECT',
              properties: {
                title: { type: 'STRING', description: 'Tên lịch trình muốn lưu' },
              },
            },
          },
          {
            name: 'logoutAccount',
            description: 'Đăng xuất tài khoản hiện tại',
            parameters: {
              type: 'OBJECT',
              properties: {},
            },
          },
          {
            name: 'navigateToDestination',
            description: 'Mở trang chi tiết của một địa điểm cụ thể trên website',
            parameters: {
              type: 'OBJECT',
              properties: {
                slug: { type: 'STRING', description: 'Slug định danh của địa điểm' },
                destinationName: { type: 'STRING', description: 'Tên địa điểm hiển thị' },
              },
              required: ['slug'],
            },
          },
          {
            name: 'filterDestinations',
            description: 'Lọc danh sách các địa điểm theo từ khóa, khu vực hoặc thể loại',
            parameters: {
              type: 'OBJECT',
              properties: {
                query: { type: 'STRING', description: 'Từ khóa tìm kiếm (ví dụ: chùa, bảo tàng, Sa Đéc, Cao Lãnh...)' },
                category: { type: 'STRING', description: 'Mã thể loại: nature, eco, culture, history, food, local_experience' },
              },
            },
          },
          {
            name: 'openPage',
            description: 'Mở bất kỳ trang chức năng nào trong hệ thống (/account, /passport, /favorites, /my-itineraries, /itinerary/create, /check-in, /destinations)',
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
            name: 'planItinerary',
            description: 'Tự động điền form và kích hoạt AI lập lịch trình khi ĐÃ ĐỦ số ngày, số người, ngân sách',
            parameters: {
              type: 'OBJECT',
              properties: {
                days: { type: 'INTEGER', description: 'Số ngày du lịch' },
                people: { type: 'INTEGER', description: 'Số người tham gia' },
                budget_vnd: { type: 'INTEGER', description: 'Ngân sách bằng VND' },
              },
              required: ['days', 'people', 'budget_vnd'],
            },
          },
          {
            name: 'registerAccount',
            description: 'Mở trang đăng ký, điền email và mật khẩu để tạo tài khoản tự động',
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
            name: 'swapItineraryStop',
            description: 'Đổi một địa điểm trong lộ trình ngày X thành một địa điểm mới và kiểm tra độ thuận tiện đường đi',
            parameters: {
              type: 'OBJECT',
              properties: {
                dayNumber: { type: 'INTEGER', description: 'Ngày trong lịch trình (ví dụ 1, 2)' },
                targetStopName: { type: 'STRING', description: 'Tên địa điểm hiện tại muốn thay thế' },
                newDestinationSlug: { type: 'STRING', description: 'Slug của địa điểm mới' },
                newDestinationName: { type: 'STRING', description: 'Tên địa điểm mới' },
              },
              required: ['dayNumber', 'targetStopName', 'newDestinationName'],
            },
          },
        ],
      },
    ];

    const contents = [
      ...history.slice(-6).map((h) => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }],
      })),
      {
        role: 'user',
        parts: [{ text: message }],
      },
    ];

    const modelsToTry = ['gemini-3.1-flash-lite', 'gemini-3.5-flash-lite'];
    let response: any = null;

    const callWithTimeout = (promise: Promise<any>, timeoutMs: number = 6500) => {
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
              temperature: 0.25,
            },
          }),
          6500,
        );
        if (response) break;
      } catch (err: any) {
        logger.warn({ model, err: err?.message || err }, 'Model failed or timed out, trying next candidate');
      }
    }

    if (!response) {
      return buildSmartLocalFallback(message, catalog);
    }

    let action: CopilotAction | undefined;
    let replyText = response.text || '';
    let toolMatchedDestinations: DestinationSummary[] = [];

    const functionCalls = (response as any).functionCalls;
    if (functionCalls && functionCalls.length > 0) {
      const call = functionCalls[0];
      const args = call.args || {};

      if (call.name === 'updateUserProfile') {
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
              numberOfDays || hoursPerDay
                ? { numberOfDays, hoursPerDay }
                : undefined,
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
        const dest =
          findDestinationByText(String(args.destinationName || args.slug || ''), catalog) ||
          catalog[0];
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
          payload: {
            path: '/',
            label: 'Đăng xuất tài khoản',
          },
        };
        if (!replyText) {
          replyText = `Dạ **Pé Meko** đã đăng xuất tài khoản cho bạn! 🦊👋`;
        }
      } else if (call.name === 'navigateToDestination') {
        const dest = catalog.find((c) => c.slug === args.slug);
        const name = dest?.name || args.destinationName || args.slug;
        action = {
          type: 'NAVIGATE',
          payload: {
            path: `/destinations/${args.slug}`,
            label: name,
          },
        };
        if (dest) toolMatchedDestinations = [dest];
        if (!replyText) {
          replyText = `Dạ **Pé Meko** mở ngay thông tin chi tiết của **${name}** cho bạn xem nhé! 🦊`;
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
        // Double-check RBAC before allowing LLM to open /admin
        if (
          targetPath.startsWith('/admin') &&
          pageContext?.currentUser?.role !== 'admin' &&
          pageContext?.currentUser?.role !== 'partner'
        ) {
          return {
            reply:
              `🛡️ **Rào chắn Phân quyền (RBAC):** Tài khoản hiện tại của bạn không có quyền Quản trị viên để mở trang \`${targetPath}\`!`,
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
          payload: {
            path: targetPath,
            label: String(args.label || targetPath),
          },
        };
        if (!replyText) {
          replyText = `Dạ **Pé Meko** chuyển bạn sang trang **${args.label || targetPath}** ngay nhé! 🦊`;
        }
      } else if (call.name === 'planItinerary') {
        const d = Number(args.days) || 2;
        const p = Number(args.people) || 2;
        const b = Number(args.budget_vnd) || 2000000;
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
        const runId = Date.now();
        action = {
          type: 'REGISTER_ACCOUNT',
          payload: {
            path: `/register?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}&displayName=${encodeURIComponent(displayName)}&autoSubmit=true&run=${runId}`,
            label: `Tạo tài khoản ${email}`,
            email,
            password,
            displayName,
          },
        };
        if (!replyText) {
          replyText = `Dạ **Pé Meko** đang mở trang Đăng ký, điền email \`${email}\` & mật khẩu để khởi tạo tài khoản tự động cho bạn ngay! 🦊`;
        }
      } else if (call.name === 'swapItineraryStop') {
        const dayNumber = Number(args.dayNumber) || 1;
        const targetStopName = String(args.targetStopName || '');
        const newDest =
          findDestinationByText(String(args.newDestinationName || args.newDestinationSlug || ''), catalog) || {
            name: String(args.newDestinationName || 'Địa điểm mới'),
            slug: String(args.newDestinationSlug || 'bao-tang-tong-hop-dong-thap'),
            area: 'Cao Lãnh',
            coordinates: { lat: 10.4562, lng: 105.6324 },
          };
        action = {
          type: 'SWAP_ITINERARY_STOP',
          payload: {
            path: '/itinerary/create#plan',
            label: `Đổi "${targetStopName}" → "${newDest.name}" (Ngày ${dayNumber})`,
            dayNumber,
            targetStopName,
            newDestination: newDest,
          },
        };
        if (!replyText) {
          replyText = `Dạ **Pé Meko** đang kiểm tra tuyến đường để đổi **${targetStopName}** (Ngày ${dayNumber}) thành **${newDest.name}** cho bạn! 🦊`;
        }
      }
    }

    const matchedDestinations =
      toolMatchedDestinations.length > 0
        ? toolMatchedDestinations.slice(0, 6)
        : catalog
            .filter(
              (c) =>
                replyText.toLowerCase().includes(c.name.toLowerCase()) ||
                message.toLowerCase().includes(c.name.toLowerCase()),
            )
            .slice(0, 5);

    return {
      reply: replyText || 'Dạ **Pé Meko** có thể giúp gì tiếp theo cho bạn ạ? 🦊',
      action,
      matchedDestinations: matchedDestinations.length > 0 ? matchedDestinations : undefined,
      suggestions: [
        'Danh sách các chùa',
        'Lập lịch trình đi 2 ngày cho 2 người với chi phí 2 tr',
        'Dự án này là gì và có những tính năng nào?',
      ],
    };
  } catch (err) {
    logger.error({ err }, 'Gemini Copilot execution failed');
    return buildSmartLocalFallback(message, catalog);
  }
}
