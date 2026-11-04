export type Category = 'nature' | 'eco' | 'culture' | 'history' | 'food' | 'local_experience';
export type Area = 'cao-lanh' | 'sa-dec' | 'thap-muoi' | 'tam-nong' | 'lai-vung' | 'hong-ngu' | 'my-tho' | 'cai-be';
export type VerificationLevel = 'verified' | 'unverified' | 'unknown';
export type VerificationStatus = 'verified' | 'partially_verified' | 'unverified';
export type PublicationStatus = 'draft' | 'pending_review' | 'published' | 'hidden';
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

export type BadgeIcon =
  | 'footprints'
  | 'compass'
  | 'lightbulb'
  | 'trophy'
  | 'landmark'
  | 'star'
  | 'medal'
  | 'award'
  | 'heart'
  | 'sparkles';

export interface BadgeInfo {
  key: string;
  name: string;
  description: string;
  icon: BadgeIcon;
  rewardPoints?: number;
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

// ---- Trip Planner V9 Types ----

export type V9PlaceRole = 'restaurant' | 'accommodation' | 'entertainment' | 'wellness' | 'attraction';
export type V9Goal = 'sightseeing' | 'food' | 'relaxation' | 'nightlife' | 'stay';
export type V9Mode = 'ai' | 'manual';
export type V9TransportMode = 'car' | 'motorcycle';
export type V9Pace = 'relaxed' | 'balanced' | 'busy';

export interface V9PlaceActivity {
  name: string;
  source_id: string;
  evidence_status: string;
  price_vnd: number | null;
  duration_minutes: number | null;
  schedule: string | null;
  requires_booking: boolean | null;
  note: string | null;
}

export interface V9RankingReasonObject {
  policy?: string;
  road_time_tier_minutes?: [number, number] | number[];
  tier_upper_bound_exclusive?: boolean;
  note?: string;
  google_rating?: number | null;
  google_review_count?: number | null;
  rating_adjusted_for_review_count?: number | null;
  rating_status?: string;
  rating_source_date?: string | null;
}

export interface V9Place {
  id: string;
  name: string;
  role: V9PlaceRole;
  tags: string[];
  activities_available: V9PlaceActivity[];
  address?: string | null;
  coordinates?: [number, number] | null;
  visit_duration_minutes?: number | null;
  phone: string | null;
  google_rating: number | null;
  google_review_count: number | null;
  rating_adjusted_for_review_count?: number | null;
  rating_status?: string;
  rating_source_date?: string | null;
  route_from_previous?: { distance_km: number; duration_minutes: number; transport_mode: string };
  ranking_reason?: string | V9RankingReasonObject | null;
  known_group_cost_vnd?: number | null;
  source_price_text?: string | null;
  price_status?: string;
  hours_status?: string;
  mongoId?: string;
  slug?: string;
  summary?: string;
  images?: Array<{ url: string; alt?: string }>;
  area?: string;
  category?: string;
  isPersonalizedMatch?: boolean;
  personalizationReason?: string;
}

export interface V9PlanRequest {
  mode: V9Mode;
  goal: V9Goal;
  start_id?: string;
  end_id?: string;
  selected_ids?: string[];
  excluded_ids?: string[];
  hotel_id?: string;
  start_date: string;
  days: number;
  people: number;
  budget_vnd: number;
  interests: string[];
  mode_of_transport: V9TransportMode;
  nearby_max_minutes?: number;
  primary_limit?: number;
  use_model?: boolean;
  daily_start: string;
  daily_end: string;
  pace: V9Pace;
  travel_buffer_minutes?: number;
  sleep_minutes?: number;
  include_breakfast?: boolean;
  meal_duration_minutes?: number;
  allow_unknown_hours?: boolean;
  assemble_itinerary?: boolean;
  visit_duration_overrides?: Record<string, number>;
  transport_cost?: { vnd_per_km?: number; fixed_trip_vnd?: number };
}

export interface V9StopIssue {
  stop_id?: string;
  reason: string;
}

export interface V9ActivityStep {
  type: 'visit' | 'meal' | 'meal_unassigned' | 'meal_unscheduled' | 'travel' | 'free_time' | 'checkout' | 'unresolved_return';
  stop_id?: string;
  status?: 'pending' | 'arrived' | 'completed';
  place_id?: string;
  meal?: 'breakfast' | 'lunch' | 'dinner';
  name: string;
  start: string;
  end: string;
  duration_minutes?: number;
  duration_status?: string;
  source_duration_minutes?: number;
  hours_status?: string;
  hours_need_confirmation?: boolean;
  price_status?: 'unknown' | 'estimate';
  estimated_group_cost_vnd?: number | null;
  spending_target_group_vnd?: number | null;
  source_price_text?: string | null;
  price_note?: string;
  distance_km?: number;
  route_duration_minutes?: number;
  buffer_minutes?: number;
  from_id?: string;
  to_id?: string;
  phone?: string | null;
  google_rating?: number | null;
  google_review_count?: number | null;
  activities_available?: V9PlaceActivity[];
  activities_note?: string;
  note?: string;
  // Replan fields
  arrived_at?: string;
  departed_at?: string;
  estimated_departure_at?: string;
  estimated_arrival_at?: string;
  planned_start_at?: string;
  planned_end_at?: string;
  latitude?: number;
  longitude?: number;
}

export interface V9OvernightStay {
  id: string;
  name: string;
  planned_arrival: string;
  nights: number;
  estimated_group_cost_vnd: number | null;
  spending_target_group_vnd: number;
  booking_status: string;
  availability_status: string;
  checkin_checkout_status: string;
  contact_note: string;
  phone: string | null;
  google_rating?: number | null;
  google_review_count?: number | null;
  evening_preparation_minutes: number;
  checkin_required: boolean;
  sleep_start_at: string;
  sleep_end_at: string;
  sleep_minutes: number;
  morning_preparation_minutes: number;
  ready_next_day_at: string;
  ready_next_day_minute: number;
  checkout_deadline: string;
  checkout_deadline_source: string;
  price_status?: 'unknown' | 'estimate';
}

export interface V9DayReplanState {
  status: string;
  next_stop: V9ActivityStep | null;
  issues: V9StopIssue[];
  estimated_day_end_at: string | null;
  later_days_need_review: boolean;
  updated_at: string;
}

export interface V9Day {
  day: number;
  date: string;
  status: string;
  start_place_id: string;
  planned_end_place_id: string;
  actual_end_place_id: string;
  activities: V9ActivityStep[];
  visit_count: number;
  overnight_stay: V9OvernightStay | null;
  replan_state?: V9DayReplanState;
}

export interface V9BudgetAllocation {
  kind: string;
  whole_group_vnd: {
    food: number;
    stay: number;
    transport: number;
    activities: number;
    reserve: number;
  };
  food_target_per_person_per_meal_vnd: number | null;
  food_meal_count_assumption: number;
  stay_target_whole_group_per_night_vnd: number | null;
  note: string;
}

export interface V9CostSummary {
  known_subtotal_vnd: number;
  unknown_cost_count: number;
  items: Array<{ kind: string; place_id?: string; date?: string; amount_vnd: number | null }>;
  road_distance_km: number;
  transport_variable_estimate_vnd: number | null;
  transport_fixed_vnd: number | null;
  total_trip_cost_vnd: number | null;
  budget_feasible: boolean | null;
  budget_overage_vnd: number;
  note: string;
}

export interface V9SharedAccommodation {
  id: string;
  name: string;
  selection: Record<string, unknown>;
  scheduled_nights: number;
  phone: string | null;
  availability_status: string;
}

export interface V9ItineraryObject {
  status: string;
  algorithm: string;
  input: V9PlanRequest;
  days: V9Day[];
  shared_accommodation: V9SharedAccommodation | null;
  scheduled_primary_ids: string[];
  unassigned_primary_places: Array<{ id: string; name: string; reason: string }>;
  budget_allocation: V9BudgetAllocation;
  cost_summary: V9CostSummary;
  routing_failures: Array<{ from_id: string; to_id: string; reason: string }>;
  warnings: string[];
  budget_adjusted?: boolean;
  known_savings_vnd?: number;
}

export interface V9PlanResponse {
  status: string;
  mode: V9Mode;
  goal: V9Goal;
  selection_method: string;
  primary_places: V9Place[];
  related_by_primary: Array<{
    anchor_id: string;
    suggestions: Record<string, V9Place[]>;
    missing_categories: string[];
  }>;
  itinerary?: V9ItineraryObject;
  budget_alternative?: V9ItineraryObject;
  budget_allocation: V9BudgetAllocation;
  budget_feasible: boolean | null;
  warnings: string[];
  readable_itinerary?: string;
}

export interface V9ReplanResponse {
  trip_id: string;
  itinerary_version: number;
  event_id: string;
  date: string;
  status: 'replanned' | 'needs_revision';
  current_stop: V9ActivityStep;
  remaining_stops: V9ActivityStep[];
  next_stop: V9ActivityStep | null;
  issues: V9StopIssue[];
  estimated_day_end_at: string | null;
  later_days_need_review: boolean;
}

export interface ReplanHistoryEntry {
  eventId: string;
  stopId: string;
  event: 'arrived' | 'departed';
  occurredAt: string;
  itineraryVersion: number;
  createdAt: string;
}

export interface SavedItinerary {
  id: string;
  title: string;
  preferences: Partial<Preferences>;
  numberOfDays: number;
  estimatedDurationMinutes: number;
  plannerVersion?: 'legacy' | 'v9';
  itineraryVersion?: number;
  v9Itinerary?: V9ItineraryObject | null;
  v9Meta?: Partial<V9PlanResponse> | null;
  replanHistory?: ReplanHistoryEntry[];
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
  plannerVersion?: 'legacy' | 'v9';
  itineraryVersion?: number;
  status?: string | null;
  startDate?: string | null;
  mode?: string | null;
  budgetVnd?: number | null;
  updatedAt: string;
}

export interface AdminDestination extends DestinationDetail {
  publicationStatus: PublicationStatus;
  reviewNote?: string | null;
  createdAt: string | null;
  managedById: string | null;
  managedByEmail: string | null;
  managedByName: string | null;
}

export type BadgeCriteriaType =
  | 'checkin_count'
  | 'challenge_count'
  | 'heritage_challenge_count'
  | 'points_threshold'
  | 'itinerary_created';

export interface AdminBadge {
  _id: string;
  id?: string;
  key: string;
  name: string;
  description: string;
  icon: BadgeIcon;
  criteriaType: BadgeCriteriaType;
  targetCount: number;
  rewardPoints: number;
  status: 'active' | 'inactive';
  awardedCount?: number;
  uniqueUsersCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface BadgeAnalyticsReport {
  summary: {
    totalBadges: number;
    activeBadges: number;
    totalAwards: number;
    totalUsers: number;
  };
  badgeStats: Array<{
    key: string;
    name: string;
    icon: BadgeIcon;
    status: 'active' | 'inactive';
    awardedCount: number;
    unlockRate: number;
  }>;
  recentAwards: Array<{
    id: string;
    badgeKey: string;
    badgeName: string;
    badgeIcon: string;
    userDisplayName: string;
    userEmail: string | null;
    scoreAwarded: number;
    completedAt: string;
  }>;
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
