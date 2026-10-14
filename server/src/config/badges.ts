export interface PassportStats {
  checkInDestinations: number;
  completedChallenges: number;
  heritageChallengeDestinations: number;
}

export interface BadgeDefinition {
  key: string;
  name: string;
  description: string;
  icon: 'footprints' | 'compass' | 'lightbulb' | 'trophy' | 'landmark';
  isEarned: (stats: PassportStats) => boolean;
}

export const BADGES: BadgeDefinition[] = [
  {
    key: 'first-steps',
    name: 'Bước chân đầu tiên',
    description: 'Check-in tại 1 điểm có mã QR.',
    icon: 'footprints',
    isEarned: (s) => s.checkInDestinations >= 1,
  },
  {
    key: 'explorer',
    name: 'Nhà thám hiểm Đồng Tháp',
    description: 'Check-in tại 3 điểm đến khác nhau.',
    icon: 'compass',
    isEarned: (s) => s.checkInDestinations >= 3,
  },
  {
    key: 'local-insight',
    name: 'Hiểu biết địa phương',
    description: 'Hoàn thành 1 thử thách.',
    icon: 'lightbulb',
    isEarned: (s) => s.completedChallenges >= 1,
  },
  {
    key: 'challenge-master',
    name: 'Bậc thầy thử thách',
    description: 'Hoàn thành 3 thử thách.',
    icon: 'trophy',
    isEarned: (s) => s.completedChallenges >= 3,
  },
  {
    key: 'heritage-keeper',
    name: 'Người giữ hồn di sản',
    description: 'Hoàn thành thử thách tại 2 điểm văn hóa hoặc lịch sử.',
    icon: 'landmark',
    isEarned: (s) => s.heritageChallengeDestinations >= 2,
  },
];
export function badgeByKey(key: string): BadgeDefinition | undefined {
  return BADGES.find((badge) => badge.key === key);
}

