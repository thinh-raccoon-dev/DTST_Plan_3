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
  // Căn cứ ban đầu (Đồng Tháp & Tiền Giang)
  'cao-lanh',
  'sa-dec',
  'thap-muoi',
  'tam-nong',
  'lai-vung',
  'hong-ngu',
  'my-tho',
  'cai-be',
  'thoi-son',
  // Đồng bằng Sông Cửu Long
  'can-tho',
  'an-giang',
  'kien-giang',
  'ben-tre',
  'vinh-long',
  'ca-mau',
  'bac-lieu',
  'soc-trang',
  'tra-vinh',
  'hau-giang',
  'long-an',
  'tien-giang',
  // Đông Nam Bộ & TP. Hồ Chí Minh
  'tp-ho-chi-minh',
  'ba-ria-vung-tau',
  'binh-duong',
  'dong-nai',
  'tay-ninh',
  'binh-phuoc',
  // Duyên hải Nam Trung Bộ & Tây Nguyên
  'da-nang',
  'thua-thien-hue',
  'quang-nam',
  'khanh-hoa',
  'lam-dong',
  'binh-thuan',
  'phu-yen',
  'binh-dinh',
  'dak-lak',
  'gia-lai',
  'kon-tum',
  'dak-nong',
  'quang-ngai',
  'quang-tri',
  'quang-binh',
  'ha-tinh',
  'nghe-an',
  'thanh-hoa',
  // Bắc Bộ & Thủ đô Hà Nội
  'ha-noi',
  'quang-ninh',
  'hai-phong',
  'ninh-binh',
  'lao-cai',
  'ha-giang',
  'cao-bang',
  'lang-son',
  'bac-kan',
  'tuyen-quang',
  'thai-nguyen',
  'phu-tho',
  'bac-giang',
  'bac-ninh',
  'hai-duong',
  'hung-yen',
  'hoa-binh',
  'son-la',
  'dien-bien',
  'lai-chau',
  'yen-bai',
  'nam-dinh',
  'thai-binh',
  'ha-nam',
  'vinh-phuc',
] as const;
export type Area = (typeof AREAS)[number] | string;

export const AREA_LABELS: Record<string, string> = {
  // Đồng Tháp & Tiền Giang
  'cao-lanh': 'Cao Lãnh',
  'sa-dec': 'Sa Đéc',
  'thap-muoi': 'Tháp Mười',
  'tam-nong': 'Tam Nông',
  'lai-vung': 'Lai Vung',
  'hong-ngu': 'Hồng Ngự',
  'my-tho': 'Mỹ Tho',
  'cai-be': 'Cái Bè',
  'thoi-son': 'Cù lao Thới Sơn',
  // Đồng bằng Sông Cửu Long
  'can-tho': 'Cần Thơ',
  'an-giang': 'An Giang',
  'kien-giang': 'Kiên Giang (Phú Quốc)',
  'ben-tre': 'Bến Tre',
  'vinh-long': 'Vĩnh Long',
  'ca-mau': 'Cà Mau',
  'bac-lieu': 'Bạc Liêu',
  'soc-trang': 'Sóc Trăng',
  'tra-vinh': 'Trà Vinh',
  'hau-giang': 'Hậu Giang',
  'long-an': 'Long An',
  'tien-giang': 'Tiền Giang',
  // Đông Nam Bộ & TP. Hồ Chí Minh
  'tp-ho-chi-minh': 'TP. Hồ Chí Minh',
  'ba-ria-vung-tau': 'Bà Rịa - Vũng Tàu',
  'binh-duong': 'Bình Dương',
  'dong-nai': 'Đồng Nai',
  'tay-ninh': 'Tây Ninh',
  'binh-phuoc': 'Bình Phước',
  // Duyên hải Nam Trung Bộ & Tây Nguyên
  'da-nang': 'Đà Nẵng',
  'thua-thien-hue': 'Thừa Thiên Huế',
  'quang-nam': 'Quảng Nam (Hội An)',
  'khanh-hoa': 'Khánh Hòa (Nha Trang)',
  'lam-dong': 'Lâm Đồng (Đà Lạt)',
  'binh-thuan': 'Bình Thuận (Phan Thiết)',
  'phu-yen': 'Phú Yên',
  'binh-dinh': 'Bình Định (Quy Nhơn)',
  'dak-lak': 'Đắk Lắk (Buôn Ma Thuột)',
  'gia-lai': 'Gia Lai',
  'kon-tum': 'Kon Tum',
  'dak-nong': 'Đắk Nông',
  'quang-ngai': 'Quảng Ngãi',
  'quang-tri': 'Quảng Trị',
  'quang-binh': 'Quảng Bình (Phong Nha)',
  'ha-tinh': 'Hà Tĩnh',
  'nghe-an': 'Nghệ An',
  'thanh-hoa': 'Thanh Hóa',
  // Bắc Bộ & Thủ đô Hà Nội
  'ha-noi': 'Hà Nội',
  'quang-ninh': 'Quảng Ninh (Hạ Long)',
  'hai-phong': 'Hải Phòng',
  'ninh-binh': 'Ninh Bình (Tràng An)',
  'lao-cai': 'Lào Cai (Sa Pa)',
  'ha-giang': 'Hà Giang',
  'cao-bang': 'Cao Bằng',
  'lang-son': 'Lạng Sơn',
  'bac-kan': 'Bắc Kạn',
  'tuyen-quang': 'Tuyên Quang',
  'thai-nguyen': 'Thái Nguyên',
  'phu-tho': 'Phú Thọ',
  'bac-giang': 'Bắc Giang',
  'bac-ninh': 'Bắc Ninh',
  'hai-duong': 'Hải Dương',
  'hung-yen': 'Hưng Yên',
  'hoa-binh': 'Hòa Bình',
  'son-la': 'Sơn La',
  'dien-bien': 'Điện Biên',
  'lai-chau': 'Lai Châu',
  'yen-bai': 'Yên Bái',
  'nam-dinh': 'Nam Định',
  'thai-binh': 'Thái Bình',
  'ha-nam': 'Hà Nam',
  'vinh-phuc': 'Vĩnh Phúc',
};

export function getAreaLabel(area: string): string {
  const label = AREA_LABELS[area];
  if (label) return label;
  return area.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export const VERIFICATION_LEVELS = ['verified', 'unverified', 'unknown'] as const;
export type VerificationLevel = (typeof VERIFICATION_LEVELS)[number];

export const PUBLICATION_STATUSES = ['draft', 'pending_review', 'published', 'hidden'] as const;
export const OPERATIONAL_STATUSES = ['active', 'temporarily_closed', 'closed'] as const;

/** Points granted by the server for a self-declared check-in at a QR point. */
export const CHECKIN_POINTS = 10;
