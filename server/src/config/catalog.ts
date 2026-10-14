export const CATEGORIES = ['nature', 'eco', 'culture', 'history', 'food', 'local_experience'] as const;
export type Category = (typeof CATEGORIES)[number];

/** Interests use the same vocabulary as categories so scoring stays explainable. */
export const INTERESTS = CATEGORIES;
export type Interest = Category;

export const CATEGORY_LABELS: Record<Category, string> = {
  nature: 'Thiên nhiên',
  eco: 'Sinh thái',
  culture: 'Văn hóa',
  history: 'Lịch sử',
  food: 'Ẩm thực',
  local_experience: 'Trải nghiệm địa phương',
};

/**
 * Familiar locality names. Since 07/2025 the new Đồng Tháp province also includes the former
 * Tiền Giang province, so Mỹ Tho and Cái Bè are listed here.
 */
export const AREAS = [
  'cao-lanh',
  'sa-dec',
  'thap-muoi',
  'tam-nong',
  'lai-vung',
  'hong-ngu',
  'my-tho',
  'cai-be',
] as const;
export type Area = (typeof AREAS)[number];

export const AREA_LABELS: Record<Area, string> = {
  'cao-lanh': 'Cao Lãnh',
  'sa-dec': 'Sa Đéc',
  'thap-muoi': 'Tháp Mười',
  'tam-nong': 'Tam Nông',
  'lai-vung': 'Lai Vung',
  'hong-ngu': 'Hồng Ngự',
  'my-tho': 'Mỹ Tho',
  'cai-be': 'Cái Bè',
};

export const VERIFICATION_LEVELS = ['verified', 'unverified', 'unknown'] as const;
export type VerificationLevel = (typeof VERIFICATION_LEVELS)[number];

export const PUBLICATION_STATUSES = ['draft', 'published', 'hidden'] as const;
export const OPERATIONAL_STATUSES = ['active', 'temporarily_closed', 'closed'] as const;

/** Points granted by the server for a self-declared check-in at a QR point. */
export const CHECKIN_POINTS = 10;
