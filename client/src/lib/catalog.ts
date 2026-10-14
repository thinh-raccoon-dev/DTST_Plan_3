import type { Area, Category, OperationalStatus, PublicationStatus, VerificationLevel, VerificationStatus } from '../types/api';

export const CATEGORY_OPTIONS: Array<{ value: Category; label: string }> = [
  { value: 'nature', label: 'Thiên nhiên' },
  { value: 'eco', label: 'Sinh thái' },
  { value: 'culture', label: 'Văn hóa' },
  { value: 'history', label: 'Lịch sử' },
  { value: 'food', label: 'Ẩm thực' },
  { value: 'local_experience', label: 'Trải nghiệm địa phương' },
];

export const AREA_OPTIONS: Array<{ value: Area; label: string }> = [
  { value: 'cao-lanh', label: 'Cao Lãnh' },
  { value: 'sa-dec', label: 'Sa Đéc' },
  { value: 'thap-muoi', label: 'Tháp Mười' },
  { value: 'tam-nong', label: 'Tam Nông' },
  { value: 'lai-vung', label: 'Lai Vung' },
  { value: 'hong-ngu', label: 'Hồng Ngự' },
  { value: 'my-tho', label: 'Mỹ Tho' },
  { value: 'cai-be', label: 'Cái Bè' },
];

export const categoryLabel = (value: Category | null | undefined) =>
  CATEGORY_OPTIONS.find((o) => o.value === value)?.label ?? 'Khác';
export const areaLabel = (value: Area | null | undefined) => AREA_OPTIONS.find((o) => o.value === value)?.label ?? '—';

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
