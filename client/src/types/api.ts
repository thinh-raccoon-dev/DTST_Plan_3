export type Category = 'nature' | 'eco' | 'culture' | 'history' | 'food' | 'local_experience';
export type Area = 'cao-lanh' | 'sa-dec' | 'thap-muoi' | 'tam-nong' | 'lai-vung' | 'hong-ngu' | 'my-tho' | 'cai-be';
export type VerificationLevel = 'verified' | 'unverified' | 'unknown';
export type VerificationStatus = 'verified' | 'partially_verified' | 'unverified';
export type PublicationStatus = 'draft' | 'published' | 'hidden';
export type OperationalStatus = 'active' | 'temporarily_closed' | 'closed';

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export type UserRole = 'tourist' | 'admin' | 'partner';

export interface UserPreferences {
  areas: Area[];
  interests: Category[];
  numberOfDays: number;
  hoursPerDay: number;
}

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  preferences: UserPreferences;
}

export interface VisitDuration {
  minutes: number;
  isEstimate: boolean;
  note?: string | null;
}

export interface DestinationSummary {
  id: string;
  slug: string;
  name: string;
  summary: string;
  category: Category;
  area: Area;
  tags: string[];
  image: { url: string; alt: string } | null;
  isIllustrative: boolean;
  verificationStatus: VerificationStatus;
  operationalStatus: OperationalStatus;
  estimatedVisitDuration: VisitDuration | null;
  hasCoordinates: boolean;
  hasChallenge: boolean;
}

export interface DestinationImage {
  url: string;
  alt: string;
  credit: string | null;
  license: string | null;
  sourceUrl: string | null;
}

export interface DestinationDetail extends Omit<DestinationSummary, 'image'> {
  image: { url: string; alt: string } | null;
  description: string;
  address: string | null;
  coordinates: { lat: number; lng: number } | null;
  images: DestinationImage[];
  openingHours: string | null;
  referencePrice: string | null;
  contactInfo: { phone?: string; website?: string; email?: string } | null;
  sourceUrls: string[];
  verification: Record<'location' | 'openingHours' | 'referencePrice' | 'contactInfo', VerificationLevel>;
  lastVerifiedAt: string | null;
  updatedAt: string | null;
}

export interface ChallengeSummary {
  id: string;
  destinationId: string;
  title: string;
  description: string;
  story: string;
  type: 'quiz';
  rewardPoints: number;
  minCorrect: number;
  questionCount: number;
}

export interface PublicChallenge extends ChallengeSummary {
  questions: Array<{ id: string; prompt: string; options: string[] }>;
}

export interface DestinationResponse {
  destination: DestinationDetail;
  challenges: ChallengeSummary[];
  hasActiveQr: boolean;
}

export interface BadgeInfo {
  key: string;
  name: string;
  description: string;
  icon: 'footprints' | 'compass' | 'lightbulb' | 'trophy' | 'landmark';
}

export interface QrContent {
  qr: { code: string; label: string; targetType: 'destination' | 'challenge' };
  destination: DestinationDetail;
  challenges: PublicChallenge[];
  featuredChallengeId: string | null;
  progress: { checkedIn: boolean; completedChallengeIds: string[] };
}

export interface CheckInResult {
  created: boolean;
  pointsAwarded: number;
  newBadges: BadgeInfo[];
  locationVerified: boolean;
}

export interface CompletionResult {
  correctCount: number;
  totalQuestions: number;
  minCorrect: number;
  passed: boolean;
  results: Array<{ questionId: string; correct: boolean; correctOptionIndex?: number; explanation?: string }>;
  alreadyCompleted: boolean;
  pointsAwarded: number;
  newBadges: BadgeInfo[];
  savedTo: 'account' | 'device';
}

export interface MiniDestination {
  id: string;
  slug: string;
  name: string;
  category: Category;
  area: Area;
}

export interface Passport {
  mode: 'account' | 'device';
  totals: {
    points: number;
    exploredDestinations: number;
    checkIns: number;
    completedChallenges: number;
    badges: number;
    destinationsViewed: number;
    qrContentsOpened: number;
  };
  progress: { explored: number; total: number };
  checkIns: Array<{ destination: MiniDestination | null; scoreAwarded: number; completedAt: string }>;
  completions: Array<{
    challenge: { id: string; title: string } | null;
    destination: MiniDestination | null;
    scoreAwarded: number;
    correctCount: number | null;
    totalQuestions: number | null;
    completedAt: string;
  }>;
  qrOpened: MiniDestination[];
  badges: Array<BadgeInfo & { earned: boolean; awardedAt: string | null }>;
  pendingDeviceEntries: number;
}

export type PlannerScenario = 'balanced' | 'indoor' | 'compact';

export interface Preferences {
  numberOfDays: number;
  hoursPerDay: number;
  areas: Area[];
  interests: Category[];
  priorityDestinationIds: string[];
  excludeDestinationIds?: string[];
  scenario?: PlannerScenario;
}

export interface PlanAlternative {
  key: PlannerScenario;
  label: string;
  description: string;
  plan: PlanResult;
}

export interface PlannedItem {
  destinationId: string;
  slug: string;
  name: string;
  category: Category | null;
  area: Area | null;
  durationMinutes: number;
  durationIsEstimate: boolean;
  durationIsDefault?: boolean;
  reasons?: string[];
  available?: boolean;
  unavailableReason?: string | null;
}

export interface PlanResult {
  days: Array<{ dayNumber: number; items: PlannedItem[]; visitMinutes: number; bufferMinutes: number; totalMinutes: number }>;
  warnings: string[];
  unscheduled: Array<{ destinationId: string; name: string; reason: string }>;
  assumptions: { defaultVisitMinutes: number; transitionBufferMinutes: number; dailyLimitMinutes: number };
}

export interface SavedItinerary {
  id: string;
  title: string;
  preferences: Partial<Preferences>;
  numberOfDays: number;
  estimatedDurationMinutes: number;
  createdAt: string;
  updatedAt: string;
  days: Array<{ dayNumber: number; items: PlannedItem[] }>;
}

export interface ItineraryListItem {
  id: string;
  title: string;
  numberOfDays: number;
  destinationCount: number;
  estimatedDurationMinutes: number;
  updatedAt: string;
}

export interface AdminDestination extends DestinationDetail {
  publicationStatus: PublicationStatus;
  createdAt: string | null;
  managedById: string | null;
  managedByEmail: string | null;
  managedByName: string | null;
}

export interface AdminQr {
  id: string;
  code: string;
  label: string;
  targetType: 'destination' | 'challenge';
  targetId: string;
  target: {
    exists: boolean;
    label: string;
    destinationSlug: string | null;
    destinationName: string | null;
    publicationStatus: PublicationStatus | null;
    challengeStatus: 'active' | 'inactive' | null;
  };
  status: 'active' | 'inactive';
  notes: string | null;
  url: string;
  landingViews: number;
  lastLandingAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface AdminChallenge {
  id: string;
  destinationId: string;
  destination: { name: string; slug: string } | null;
  title: string;
  description: string;
  story: string;
  type: 'quiz';
  status: 'active' | 'inactive';
  scoringRules: { rewardPoints: number; minCorrect: number };
  questions: Array<{ id: string; prompt: string; options: string[]; correctOptionIndex: number; explanation: string }>;
  attempts: number;
  completions: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface AnalyticsReport {
  range: { from: string; to: string; timezone: string; days: number };
  current: { publishedDestinations: number; activeQrCodes: number };
  totals: {
    destinationPageViews: number;
    qrLandingViews: number;
    interactions: number;
    challengeAttempts: number;
    checkIns: number;
    challengeCompletions: number;
    itinerariesGenerated: number;
    itinerariesSaved: number;
    badgesAwarded: number;
    uniqueVisitors: number;
    uniqueAccounts: number;
  };
  daily: Array<{ date: string; pageViews: number; qrLandings: number; interactions: number; completions: number }>;
  topDestinations: Array<{ id: string; name: string; slug: string | null; count: number }>;
  topQrCodes: Array<{ id: string; code: string; label: string; count: number }>;
  topChallenges: Array<{ id: string; title: string; count: number }>;
  funnel: {
    steps: Array<{ key: string; label: string; count: number }>;
    rates: {
      pageViewToQr: number | null;
      qrToCheckIn: number | null;
      checkInToChallengeAttempt: number | null;
      attemptToCompletion: number | null;
      generateToSave: number | null;
    };
  };
  definitions: Record<string, string>;
}

export type BannerKind = 'cover' | 'event' | 'promo';
export type BannerTheme = 'forest' | 'lotus' | 'cream';

export interface PublicBanner {
  id: string;
  kind: BannerKind;
  theme: BannerTheme;
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  linkUrl: string | null;
  linkLabel: string | null;
  sponsorName: string | null;
}

export interface AdminBanner extends PublicBanner {
  placement: 'home_top';
  status: 'active' | 'inactive';
  isLive: boolean;
  startAt: string | null;
  endAt: string | null;
  sortOrder: number;
  impressions: number;
  clicks: number;
  createdAt: string | null;
  updatedAt: string | null;
}
