import type { Area, Category, OperationalStatus, PublicationStatus, VerificationLevel, VerificationStatus } from '../types/api';

export const CATEGORY_OPTIONS: Array<{ value: Category; label: string }> = [
  { value: 'nature', label: 'Thiên nhiên' },
  { value: 'eco', label: 'Sinh thái' },
  { value: 'culture', label: 'Văn hóa' },
  { value: 'history', label: 'Lịch sử' },
  { value: 'food', label: 'Ẩm thực' },
  { value: 'local_experience', label: 'Trải nghiệm địa phương' },
];

export interface AreaGroup {
  group: string;
  options: Array<{ value: Area; label: string }>;
}

export const AREA_GROUPS: AreaGroup[] = [
  {
    group: 'Đồng Tháp & Tiền Giang (Căn cứ ban đầu)',
    options: [
      { value: 'cao-lanh', label: 'Cao Lãnh' },
      { value: 'sa-dec', label: 'Sa Đéc' },
      { value: 'thap-muoi', label: 'Tháp Mười' },
      { value: 'tam-nong', label: 'Tam Nông' },
      { value: 'lai-vung', label: 'Lai Vung' },
      { value: 'hong-ngu', label: 'Hồng Ngự' },
      { value: 'my-tho', label: 'Mỹ Tho' },
      { value: 'cai-be', label: 'Cái Bè' },
      { value: 'thoi-son', label: 'Cù lao Thới Sơn' },
    ],
  },
  {
    group: 'Đồng Bằng Sông Cửu Long',
    options: [
      { value: 'can-tho', label: 'Cần Thơ' },
      { value: 'an-giang', label: 'An Giang' },
      { value: 'kien-giang', label: 'Kiên Giang (Phú Quốc)' },
      { value: 'ben-tre', label: 'Bến Tre' },
      { value: 'vinh-long', label: 'Vĩnh Long' },
      { value: 'ca-mau', label: 'Cà Mau' },
      { value: 'bac-lieu', label: 'Bạc Liêu' },
      { value: 'soc-trang', label: 'Sóc Trăng' },
      { value: 'tra-vinh', label: 'Trà Vinh' },
      { value: 'hau-giang', label: 'Hậu Giang' },
      { value: 'long-an', label: 'Long An' },
    ],
  },
  {
    group: 'Đông Nam Bộ & TP. Hồ Chí Minh',
    options: [
      { value: 'tp-ho-chi-minh', label: 'TP. Hồ Chí Minh' },
      { value: 'ba-ria-vung-tau', label: 'Bà Rịa - Vũng Tàu' },
      { value: 'binh-duong', label: 'Bình Dương' },
      { value: 'dong-nai', label: 'Đồng Nai' },
      { value: 'tay-ninh', label: 'Tây Ninh' },
      { value: 'binh-phuoc', label: 'Bình Phước' },
    ],
  },
  {
    group: 'Duyên Hải Miền Trung & Tây Nguyên',
    options: [
      { value: 'da-nang', label: 'Đà Nẵng' },
      { value: 'thua-thien-hue', label: 'Thừa Thiên Huế' },
      { value: 'quang-nam', label: 'Quảng Nam (Hội An)' },
      { value: 'khanh-hoa', label: 'Khánh Hòa (Nha Trang)' },
      { value: 'lam-dong', label: 'Lâm Đồng (Đà Lạt)' },
      { value: 'binh-thuan', label: 'Bình Thuận (Phan Thiết)' },
      { value: 'phu-yen', label: 'Phú Yên' },
      { value: 'binh-dinh', label: 'Bình Định (Quy Nhơn)' },
      { value: 'dak-lak', label: 'Đắk Lắk (Buôn Ma Thuột)' },
      { value: 'gia-lai', label: 'Gia Lai' },
      { value: 'kon-tum', label: 'Kon Tum' },
      { value: 'quang-binh', label: 'Quảng Bình (Phong Nha)' },
      { value: 'nghe-an', label: 'Nghệ An' },
      { value: 'thanh-hoa', label: 'Thanh Hóa' },
    ],
  },
  {
    group: 'Bắc Bộ & Thủ Đô Hà Nội',
    options: [
      { value: 'ha-noi', label: 'Hà Nội' },
      { value: 'quang-ninh', label: 'Quảng Ninh (Hạ Long)' },
      { value: 'hai-phong', label: 'Hải Phòng' },
      { value: 'ninh-binh', label: 'Ninh Bình (Tràng An)' },
      { value: 'lao-cai', label: 'Lào Cai (Sa Pa)' },
      { value: 'ha-giang', label: 'Hà Giang' },
      { value: 'cao-bang', label: 'Cao Bằng' },
      { value: 'lang-son', label: 'Lạng Sơn' },
      { value: 'thai-nguyen', label: 'Thái Nguyên' },
      { value: 'phu-tho', label: 'Phú Thọ' },
      { value: 'bac-ninh', label: 'Bắc Ninh' },
    ],
  },
];

export const AREA_OPTIONS: Array<{ value: Area; label: string }> = AREA_GROUPS.flatMap((g) => g.options);

export const categoryLabel = (value: Category | null | undefined) =>
  CATEGORY_OPTIONS.find((o) => o.value === value)?.label ?? 'Khác';
export const areaLabel = (value: Area | null | undefined): string => {
  if (!value) return '—';
  const found = AREA_OPTIONS.find((o) => o.value === value);
  if (found) return found.label;
  return value.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

export const VERIFICATION_LEVEL_LABELS: Record<VerificationLevel, string> = {
  verified: 'Đã xác minh',
  unverified: 'Chưa xác minh',
  unknown: 'Chưa có thông tin',
};

export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
  verified: 'Đã xác minh',
  partially_verified: 'Xác minh một phần',
  unverified: 'Chưa xác minh',
};

export const PUBLICATION_LABELS: Record<PublicationStatus, string> = {
  draft: 'Bản nháp',
  pending_review: 'Chờ duyệt',
  published: 'Đã xuất bản',
  hidden: 'Đã ẩn',
};

export const OPERATIONAL_LABELS: Record<OperationalStatus, string> = {
  active: 'Đang hoạt động',
  temporarily_closed: 'Tạm đóng cửa',
  closed: 'Ngừng hoạt động',
};

/** Must match the server's fixed transition buffer used by the planner. */
export const TRANSITION_BUFFER_MINUTES = 30;
export const DEFAULT_VISIT_MINUTES = 90;
export const NOT_VERIFIED_TEXT = 'Chưa có thông tin xác minh';
