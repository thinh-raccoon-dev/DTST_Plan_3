// Các mô hình dữ liệu đồng bộ 100% với API v2.1 (client/src/types/api.ts)

class UserPreferences {
  final List<String> areas;
  final List<String> interests;
  final int numberOfDays;
  final int hoursPerDay;

  const UserPreferences({
    this.areas = const [],
    this.interests = const [],
    this.numberOfDays = 2,
    this.hoursPerDay = 8,
  });

  factory UserPreferences.fromJson(Map<String, dynamic>? json) {
    if (json == null) return const UserPreferences();
    return UserPreferences(
      areas: (json['areas'] as List?)?.map((e) => e.toString()).toList() ?? const [],
      interests: (json['interests'] as List?)?.map((e) => e.toString()).toList() ?? const [],
      numberOfDays: (json['numberOfDays'] as num?)?.toInt() ?? 2,
      hoursPerDay: (json['hoursPerDay'] as num?)?.toInt() ?? 8,
    );
  }

  Map<String, dynamic> toJson() => {
        'areas': areas,
        'interests': interests,
        'numberOfDays': numberOfDays,
        'hoursPerDay': hoursPerDay,
      };
}

class AuthUser {
  final String id;
  final String email;
  final String displayName;
  final String role;
  final UserPreferences preferences;

  const AuthUser({
    required this.id,
    required this.email,
    required this.displayName,
    required this.role,
    required this.preferences,
  });

  factory AuthUser.fromJson(Map<String, dynamic> json) {
    return AuthUser(
      id: json['id']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      displayName: json['displayName']?.toString() ?? '',
      role: json['role']?.toString() ?? 'tourist',
      preferences: UserPreferences.fromJson(json['preferences'] as Map<String, dynamic>?),
    );
  }
}

class PublicBanner {
  final String id;
  final String kind;
  final String theme;
  final String? eyebrow;
  final String title;
  final String? subtitle;
  final String? imageUrl;
  final String? imageAlt;
  final String? linkUrl;
  final String? linkLabel;
  final String? sponsorName;

  const PublicBanner({
    required this.id,
    required this.kind,
    required this.theme,
    this.eyebrow,
    required this.title,
    this.subtitle,
    this.imageUrl,
    this.imageAlt,
    this.linkUrl,
    this.linkLabel,
    this.sponsorName,
  });

  factory PublicBanner.fromJson(Map<String, dynamic> json) {
    return PublicBanner(
      id: json['id']?.toString() ?? json['_id']?.toString() ?? '',
      kind: json['kind']?.toString() ?? 'cover',
      theme: json['theme']?.toString() ?? 'forest',
      eyebrow: json['eyebrow']?.toString(),
      title: json['title']?.toString() ?? '',
      subtitle: json['subtitle']?.toString(),
      imageUrl: json['imageUrl']?.toString(),
      imageAlt: json['imageAlt']?.toString(),
      linkUrl: json['linkUrl']?.toString(),
      linkLabel: json['linkLabel']?.toString(),
      sponsorName: json['sponsorName']?.toString(),
    );
  }
}

class VisitDuration {
  final int minutes;
  final bool isEstimate;
  final String? note;

  const VisitDuration({
    required this.minutes,
    required this.isEstimate,
    this.note,
  });

  factory VisitDuration.fromJson(Map<String, dynamic>? json) {
    if (json == null) return const VisitDuration(minutes: 90, isEstimate: true);
    return VisitDuration(
      minutes: (json['minutes'] as num?)?.toInt() ?? 90,
      isEstimate: json['isEstimate'] == true,
      note: json['note']?.toString(),
    );
  }
}

class DestinationImage {
  final String url;
  final String alt;
  final String? credit;
  final String? license;
  final String? sourceUrl;

  const DestinationImage({
    required this.url,
    required this.alt,
    this.credit,
    this.license,
    this.sourceUrl,
  });

  factory DestinationImage.fromJson(Map<String, dynamic> json) {
    return DestinationImage(
      url: json['url']?.toString() ?? '',
      alt: json['alt']?.toString() ?? '',
      credit: json['credit']?.toString(),
      license: json['license']?.toString(),
      sourceUrl: json['sourceUrl']?.toString(),
    );
  }
}

class DestinationSummary {
  final String id;
  final String slug;
  final String name;
  final String summary;
  final String category;
  final String area;
  final List<String> tags;
  final String? imageUrl;
  final String? imageAlt;
  final bool isIllustrative;
  final String verificationStatus;
  final String operationalStatus;
  final VisitDuration? estimatedVisitDuration;
  final bool hasCoordinates;
  final bool hasChallenge;

  const DestinationSummary({
    required this.id,
    required this.slug,
    required this.name,
    required this.summary,
    required this.category,
    required this.area,
    this.tags = const [],
    this.imageUrl,
    this.imageAlt,
    this.isIllustrative = false,
    this.verificationStatus = 'unverified',
    this.operationalStatus = 'active',
    this.estimatedVisitDuration,
    this.hasCoordinates = false,
    this.hasChallenge = false,
  });

  factory DestinationSummary.fromJson(Map<String, dynamic> json) {
    final imageMap = json['image'] as Map<String, dynamic>?;
    return DestinationSummary(
      id: json['id']?.toString() ?? json['_id']?.toString() ?? '',
      slug: json['slug']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      summary: json['summary']?.toString() ?? '',
      category: json['category']?.toString() ?? 'nature',
      area: json['area']?.toString() ?? 'cao-lanh',
      tags: (json['tags'] as List?)?.map((e) => e.toString()).toList() ?? const [],
      imageUrl: imageMap?['url']?.toString() ?? json['imageUrl']?.toString(),
      imageAlt: imageMap?['alt']?.toString() ?? json['imageAlt']?.toString(),
      isIllustrative: json['isIllustrative'] == true,
      verificationStatus: json['verificationStatus']?.toString() ?? 'unverified',
      operationalStatus: json['operationalStatus']?.toString() ?? 'active',
      estimatedVisitDuration: json['estimatedVisitDuration'] != null
          ? VisitDuration.fromJson(json['estimatedVisitDuration'] as Map<String, dynamic>)
          : null,
      hasCoordinates: json['hasCoordinates'] == true,
      hasChallenge: json['hasChallenge'] == true,
    );
  }
}

class DestinationDetail extends DestinationSummary {
  final String description;
  final String? address;
  final double? lat;
  final double? lng;
  final List<DestinationImage> images;
  final String? openingHours;
  final String? referencePrice;
  final String? phone;
  final String? website;
  final String? email;
  final List<String> sourceUrls;
  final Map<String, String> verification;
  final String? lastVerifiedAt;

  const DestinationDetail({
    required super.id,
    required super.slug,
    required super.name,
    required super.summary,
    required super.category,
    required super.area,
    super.tags,
    super.imageUrl,
    super.imageAlt,
    super.isIllustrative,
    super.verificationStatus,
    super.operationalStatus,
    super.estimatedVisitDuration,
    super.hasCoordinates,
    super.hasChallenge,
    required this.description,
    this.address,
    this.lat,
    this.lng,
    this.images = const [],
    this.openingHours,
    this.referencePrice,
    this.phone,
    this.website,
    this.email,
    this.sourceUrls = const [],
    this.verification = const {},
    this.lastVerifiedAt,
  });

  factory DestinationDetail.fromJson(Map<String, dynamic> json) {
    final base = DestinationSummary.fromJson(json);
    final coords = json['coordinates'] as Map<String, dynamic>?;
    final contact = json['contactInfo'] as Map<String, dynamic>?;
    final imgs = (json['images'] as List?)
            ?.whereType<Map<String, dynamic>>()
            .map(DestinationImage.fromJson)
            .toList() ??
        const [];
    final verifMap = <String, String>{};
    if (json['verification'] is Map) {
      (json['verification'] as Map).forEach((k, v) {
        verifMap[k.toString()] = v?.toString() ?? 'unknown';
      });
    }

    return DestinationDetail(
      id: base.id,
      slug: base.slug,
      name: base.name,
      summary: base.summary,
      category: base.category,
      area: base.area,
      tags: base.tags,
      imageUrl: base.imageUrl ?? (imgs.isNotEmpty ? imgs.first.url : null),
      imageAlt: base.imageAlt ?? (imgs.isNotEmpty ? imgs.first.alt : null),
      isIllustrative: base.isIllustrative,
      verificationStatus: base.verificationStatus,
      operationalStatus: base.operationalStatus,
      estimatedVisitDuration: base.estimatedVisitDuration,
      hasCoordinates: base.hasCoordinates || (coords != null),
      hasChallenge: base.hasChallenge,
      description: json['description']?.toString() ?? '',
      address: json['address']?.toString(),
      lat: (coords?['lat'] as num?)?.toDouble(),
      lng: (coords?['lng'] as num?)?.toDouble(),
      images: imgs,
      openingHours: json['openingHours']?.toString(),
      referencePrice: json['referencePrice']?.toString(),
      phone: contact?['phone']?.toString(),
      website: contact?['website']?.toString(),
      email: contact?['email']?.toString(),
      sourceUrls: (json['sourceUrls'] as List?)?.map((e) => e.toString()).toList() ?? const [],
      verification: verifMap,
      lastVerifiedAt: json['lastVerifiedAt']?.toString(),
    );
  }
}

class ChallengeSummary {
  final String id;
  final String destinationId;
  final String title;
  final String description;
  final String story;
  final int rewardPoints;
  final int minCorrect;
  final int questionCount;

  const ChallengeSummary({
    required this.id,
    required this.destinationId,
    required this.title,
    required this.description,
    required this.story,
    required this.rewardPoints,
    required this.minCorrect,
    required this.questionCount,
  });

  factory ChallengeSummary.fromJson(Map<String, dynamic> json) {
    final questionsList = json['questions'] as List?;
    return ChallengeSummary(
      id: json['id']?.toString() ?? '',
      destinationId: json['destinationId']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      description: json['description']?.toString() ?? '',
      story: json['story']?.toString() ?? '',
      rewardPoints: (json['rewardPoints'] as num?)?.toInt() ?? 20,
      minCorrect: (json['minCorrect'] as num?)?.toInt() ?? 1,
      questionCount: (json['questionCount'] as num?)?.toInt() ?? (questionsList?.length ?? 0),
    );
  }
}

class ChallengeQuestion {
  final String id;
  final String prompt;
  final List<String> options;

  const ChallengeQuestion({
    required this.id,
    required this.prompt,
    required this.options,
  });

  factory ChallengeQuestion.fromJson(Map<String, dynamic> json) {
    return ChallengeQuestion(
      id: json['id']?.toString() ?? '',
      prompt: json['prompt']?.toString() ?? '',
      options: (json['options'] as List?)?.map((e) => e.toString()).toList() ?? const [],
    );
  }
}

class PublicChallenge extends ChallengeSummary {
  final List<ChallengeQuestion> questions;

  const PublicChallenge({
    required super.id,
    required super.destinationId,
    required super.title,
    required super.description,
    required super.story,
    required super.rewardPoints,
    required super.minCorrect,
    required super.questionCount,
    required this.questions,
  });

  factory PublicChallenge.fromJson(Map<String, dynamic> json) {
    final base = ChallengeSummary.fromJson(json);
    final qList = (json['questions'] as List?)
            ?.whereType<Map<String, dynamic>>()
            .map(ChallengeQuestion.fromJson)
            .toList() ??
        const [];
    return PublicChallenge(
      id: base.id,
      destinationId: base.destinationId,
      title: base.title,
      description: base.description,
      story: base.story,
      rewardPoints: base.rewardPoints,
      minCorrect: base.minCorrect,
      questionCount: qList.isNotEmpty ? qList.length : base.questionCount,
      questions: qList,
    );
  }
}

class DestinationResponse {
  final DestinationDetail destination;
  final List<ChallengeSummary> challenges;
  final bool hasActiveQr;

  const DestinationResponse({
    required this.destination,
    required this.challenges,
    required this.hasActiveQr,
  });

  factory DestinationResponse.fromJson(Map<String, dynamic> json) {
    return DestinationResponse(
      destination: DestinationDetail.fromJson(json['destination'] as Map<String, dynamic>? ?? const {}),
      challenges: (json['challenges'] as List?)
              ?.whereType<Map<String, dynamic>>()
              .map(ChallengeSummary.fromJson)
              .toList() ??
          const [],
      hasActiveQr: json['hasActiveQr'] == true,
    );
  }
}

class BadgeInfo {
  final String key;
  final String name;
  final String description;
  final String icon;
  final int rewardPoints;
  final bool earned;
  final String? awardedAt;

  const BadgeInfo({
    required this.key,
    required this.name,
    required this.description,
    required this.icon,
    this.rewardPoints = 0,
    this.earned = false,
    this.awardedAt,
  });

  factory BadgeInfo.fromJson(Map<String, dynamic> json) {
    return BadgeInfo(
      key: json['key']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      description: json['description']?.toString() ?? '',
      icon: json['icon']?.toString() ?? 'trophy',
      rewardPoints: (json['rewardPoints'] as num?)?.toInt() ?? 0,
      earned: json['earned'] == true,
      awardedAt: json['awardedAt']?.toString(),
    );
  }
}

class QrContent {
  final String code;
  final String label;
  final String targetType;
  final DestinationDetail destination;
  final List<PublicChallenge> challenges;
  final String? featuredChallengeId;
  final bool checkedIn;
  final List<String> completedChallengeIds;

  const QrContent({
    required this.code,
    required this.label,
    required this.targetType,
    required this.destination,
    required this.challenges,
    this.featuredChallengeId,
    required this.checkedIn,
    required this.completedChallengeIds,
  });

  factory QrContent.fromJson(Map<String, dynamic> json) {
    final qrMap = json['qr'] as Map<String, dynamic>? ?? const {};
    final progMap = json['progress'] as Map<String, dynamic>? ?? const {};
    return QrContent(
      code: qrMap['code']?.toString() ?? '',
      label: qrMap['label']?.toString() ?? 'Trạm QR',
      targetType: qrMap['targetType']?.toString() ?? 'destination',
      destination: DestinationDetail.fromJson(json['destination'] as Map<String, dynamic>? ?? const {}),
      challenges: (json['challenges'] as List?)
              ?.whereType<Map<String, dynamic>>()
              .map(PublicChallenge.fromJson)
              .toList() ??
          const [],
      featuredChallengeId: json['featuredChallengeId']?.toString(),
      checkedIn: progMap['checkedIn'] == true,
      completedChallengeIds:
          (progMap['completedChallengeIds'] as List?)?.map((e) => e.toString()).toList() ?? const [],
    );
  }

  QrContent copyWith({
    bool? checkedIn,
    List<String>? completedChallengeIds,
  }) {
    return QrContent(
      code: code,
      label: label,
      targetType: targetType,
      destination: destination,
      challenges: challenges,
      featuredChallengeId: featuredChallengeId,
      checkedIn: checkedIn ?? this.checkedIn,
      completedChallengeIds: completedChallengeIds ?? this.completedChallengeIds,
    );
  }
}

class CheckInResult {
  final bool created;
  final int pointsAwarded;
  final List<BadgeInfo> newBadges;
  final bool locationVerified;

  const CheckInResult({
    required this.created,
    required this.pointsAwarded,
    required this.newBadges,
    required this.locationVerified,
  });

  factory CheckInResult.fromJson(Map<String, dynamic> json) {
    return CheckInResult(
      created: json['created'] == true,
      pointsAwarded: (json['pointsAwarded'] as num?)?.toInt() ?? 0,
      newBadges: (json['newBadges'] as List?)
              ?.whereType<Map<String, dynamic>>()
              .map(BadgeInfo.fromJson)
              .toList() ??
          const [],
      locationVerified: json['locationVerified'] == true,
    );
  }
}

class GradedQuestionResult {
  final String questionId;
  final bool correct;
  final int? correctOptionIndex;
  final String? explanation;

  const GradedQuestionResult({
    required this.questionId,
    required this.correct,
    this.correctOptionIndex,
    this.explanation,
  });

  factory GradedQuestionResult.fromJson(Map<String, dynamic> json) {
    return GradedQuestionResult(
      questionId: json['questionId']?.toString() ?? '',
      correct: json['correct'] == true,
      correctOptionIndex: (json['correctOptionIndex'] as num?)?.toInt(),
      explanation: json['explanation']?.toString(),
    );
  }
}

class CompletionResult {
  final int correctCount;
  final int totalQuestions;
  final int minCorrect;
  final bool passed;
  final List<GradedQuestionResult> results;
  final bool alreadyCompleted;
  final int pointsAwarded;
  final List<BadgeInfo> newBadges;
  final String savedTo;

  const CompletionResult({
    required this.correctCount,
    required this.totalQuestions,
    required this.minCorrect,
    required this.passed,
    required this.results,
    required this.alreadyCompleted,
    required this.pointsAwarded,
    required this.newBadges,
    required this.savedTo,
  });

  factory CompletionResult.fromJson(Map<String, dynamic> json) {
    return CompletionResult(
      correctCount: (json['correctCount'] as num?)?.toInt() ?? 0,
      totalQuestions: (json['totalQuestions'] as num?)?.toInt() ?? 0,
      minCorrect: (json['minCorrect'] as num?)?.toInt() ?? 1,
      passed: json['passed'] == true,
      results: (json['results'] as List?)
              ?.whereType<Map<String, dynamic>>()
              .map(GradedQuestionResult.fromJson)
              .toList() ??
          const [],
      alreadyCompleted: json['alreadyCompleted'] == true,
      pointsAwarded: (json['pointsAwarded'] as num?)?.toInt() ?? 0,
      newBadges: (json['newBadges'] as List?)
              ?.whereType<Map<String, dynamic>>()
              .map(BadgeInfo.fromJson)
              .toList() ??
          const [],
      savedTo: json['savedTo']?.toString() ?? 'device',
    );
  }
}

class MiniDestination {
  final String id;
  final String slug;
  final String name;
  final String category;
  final String area;

  const MiniDestination({
    required this.id,
    required this.slug,
    required this.name,
    required this.category,
    required this.area,
  });

  factory MiniDestination.fromJson(Map<String, dynamic> json) {
    return MiniDestination(
      id: json['id']?.toString() ?? '',
      slug: json['slug']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      category: json['category']?.toString() ?? 'nature',
      area: json['area']?.toString() ?? 'cao-lanh',
    );
  }
}

class PassportCheckIn {
  final MiniDestination? destination;
  final int scoreAwarded;
  final String completedAt;

  const PassportCheckIn({
    this.destination,
    required this.scoreAwarded,
    required this.completedAt,
  });

  factory PassportCheckIn.fromJson(Map<String, dynamic> json) {
    return PassportCheckIn(
      destination: json['destination'] is Map<String, dynamic>
          ? MiniDestination.fromJson(json['destination'] as Map<String, dynamic>)
          : null,
      scoreAwarded: (json['scoreAwarded'] as num?)?.toInt() ?? 0,
      completedAt: json['completedAt']?.toString() ?? '',
    );
  }
}

class PassportCompletion {
  final String? challengeId;
  final String? challengeTitle;
  final MiniDestination? destination;
  final int scoreAwarded;
  final int? correctCount;
  final int? totalQuestions;
  final String completedAt;

  const PassportCompletion({
    this.challengeId,
    this.challengeTitle,
    this.destination,
    required this.scoreAwarded,
    this.correctCount,
    this.totalQuestions,
    required this.completedAt,
  });

  factory PassportCompletion.fromJson(Map<String, dynamic> json) {
    final ch = json['challenge'] as Map<String, dynamic>?;
    return PassportCompletion(
      challengeId: ch?['id']?.toString(),
      challengeTitle: ch?['title']?.toString(),
      destination: json['destination'] is Map<String, dynamic>
          ? MiniDestination.fromJson(json['destination'] as Map<String, dynamic>)
          : null,
      scoreAwarded: (json['scoreAwarded'] as num?)?.toInt() ?? 0,
      correctCount: (json['correctCount'] as num?)?.toInt(),
      totalQuestions: (json['totalQuestions'] as num?)?.toInt(),
      completedAt: json['completedAt']?.toString() ?? '',
    );
  }
}

class Passport {
  final String mode;
  final int points;
  final int exploredDestinations;
  final int checkInsCount;
  final int completedChallengesCount;
  final int badgesCount;
  final int destinationsViewed;
  final int qrContentsOpened;
  final int progressExplored;
  final int progressTotal;
  final List<PassportCheckIn> checkIns;
  final List<PassportCompletion> completions;
  final List<MiniDestination> qrOpened;
  final List<BadgeInfo> badges;
  final int pendingDeviceEntries;

  const Passport({
    required this.mode,
    required this.points,
    required this.exploredDestinations,
    required this.checkInsCount,
    required this.completedChallengesCount,
    required this.badgesCount,
    required this.destinationsViewed,
    required this.qrContentsOpened,
    required this.progressExplored,
    required this.progressTotal,
    required this.checkIns,
    required this.completions,
    required this.qrOpened,
    required this.badges,
    required this.pendingDeviceEntries,
  });

  factory Passport.fromJson(Map<String, dynamic> json) {
    final totals = json['totals'] as Map<String, dynamic>? ?? const {};
    final prog = json['progress'] as Map<String, dynamic>? ?? const {};
    return Passport(
      mode: json['mode']?.toString() ?? 'device',
      points: (totals['points'] as num?)?.toInt() ?? 0,
      exploredDestinations: (totals['exploredDestinations'] as num?)?.toInt() ?? 0,
      checkInsCount: (totals['checkIns'] as num?)?.toInt() ?? 0,
      completedChallengesCount: (totals['completedChallenges'] as num?)?.toInt() ?? 0,
      badgesCount: (totals['badges'] as num?)?.toInt() ?? 0,
      destinationsViewed: (totals['destinationsViewed'] as num?)?.toInt() ?? 0,
      qrContentsOpened: (totals['qrContentsOpened'] as num?)?.toInt() ?? 0,
      progressExplored: (prog['explored'] as num?)?.toInt() ?? 0,
      progressTotal: (prog['total'] as num?)?.toInt() ?? 0,
      checkIns: (json['checkIns'] as List?)
              ?.whereType<Map<String, dynamic>>()
              .map(PassportCheckIn.fromJson)
              .toList() ??
          const [],
      completions: (json['completions'] as List?)
              ?.whereType<Map<String, dynamic>>()
              .map(PassportCompletion.fromJson)
              .toList() ??
          const [],
      qrOpened: (json['qrOpened'] as List?)
              ?.whereType<Map<String, dynamic>>()
              .map(MiniDestination.fromJson)
              .toList() ??
          const [],
      badges: (json['badges'] as List?)
              ?.whereType<Map<String, dynamic>>()
              .map(BadgeInfo.fromJson)
              .toList() ??
          const [],
      pendingDeviceEntries: (json['pendingDeviceEntries'] as num?)?.toInt() ?? 0,
    );
  }
}

// ---- Trip Planner V9 & Itinerary Models ----

class V9Place {
  final String id;
  final String name;
  final String role;
  final List<String> tags;
  final String? address;
  final List<double>? coordinates;
  final int? visitDurationMinutes;
  final String? phone;
  final double? googleRating;
  final int? googleReviewCount;
  final String? summary;
  final String? slug;
  final String? area;
  final String? category;
  final String? imageUrl;
  final bool isPersonalizedMatch;
  final String? personalizationReason;
  final String? rankingReasonText;
  final List<String> activityNames;

  const V9Place({
    required this.id,
    required this.name,
    required this.role,
    this.tags = const [],
    this.address,
    this.coordinates,
    this.visitDurationMinutes,
    this.phone,
    this.googleRating,
    this.googleReviewCount,
    this.summary,
    this.slug,
    this.area,
    this.category,
    this.imageUrl,
    this.isPersonalizedMatch = false,
    this.personalizationReason,
    this.rankingReasonText,
    this.activityNames = const [],
  });

  factory V9Place.fromJson(Map<String, dynamic> json) {
    final imgs = json['images'] as List?;
    String? firstImg;
    if (imgs != null && imgs.isNotEmpty && imgs.first is Map) {
      firstImg = (imgs.first as Map)['url']?.toString();
    }

    List<double>? coords;
    if (json['coordinates'] is List && (json['coordinates'] as List).length >= 2) {
      final list = json['coordinates'] as List;
      final lon = (list[0] as num?)?.toDouble();
      final lat = (list[1] as num?)?.toDouble();
      if (lon != null && lat != null) coords = [lon, lat];
    }

    final acts = (json['activities_available'] as List?)
            ?.whereType<Map<String, dynamic>>()
            .map((a) => a['name']?.toString() ?? '')
            .where((s) => s.isNotEmpty)
            .toList() ??
        const [];

    return V9Place(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      role: json['role']?.toString() ?? 'attraction',
      tags: (json['tags'] as List?)?.map((e) => e.toString()).toList() ?? const [],
      address: json['address']?.toString(),
      coordinates: coords,
      visitDurationMinutes: (json['visit_duration_minutes'] as num?)?.toInt(),
      phone: json['phone']?.toString(),
      googleRating: (json['google_rating'] as num?)?.toDouble(),
      googleReviewCount: (json['google_review_count'] as num?)?.toInt(),
      summary: json['summary']?.toString(),
      slug: json['slug']?.toString(),
      area: json['area']?.toString(),
      category: json['category']?.toString(),
      imageUrl: firstImg,
      isPersonalizedMatch: json['isPersonalizedMatch'] == true,
      personalizationReason: json['personalizationReason']?.toString(),
      rankingReasonText: _parseRankingReason(json),
      activityNames: acts,
    );
  }

  static String? _parseRankingReason(Map<String, dynamic> json) {
    final parts = <String>[];
    final routePrev = json['route_from_previous'] as Map<String, dynamic>?;
    if (routePrev != null && routePrev['duration_minutes'] is num) {
      final km = routePrev['distance_km'] is num
          ? '${(routePrev['distance_km'] as num).toStringAsFixed(1)} km · '
          : '';
      parts.add('Cách điểm trước: $km${(routePrev['duration_minutes'] as num).round()} phút chạy xe');
    }

    final reason = json['ranking_reason'];
    if (reason is String && reason.trim().isNotEmpty) {
      parts.add(reason.trim());
    } else if (reason is Map) {
      final tier = reason['road_time_tier_minutes'];
      if (tier is List && tier.length >= 2) {
        parts.add('Nhóm di chuyển ${tier[0]}–${tier[1]} phút');
      }
      final adj = reason['rating_adjusted_for_review_count'];
      if (adj is num) {
        parts.add('Điểm sao điều chỉnh: ${adj.toStringAsFixed(2)}/5');
      }
      final note = reason['note'];
      if (note is String && note.trim().isNotEmpty) {
        parts.add(note.trim());
      }
    }
    return parts.isEmpty ? null : parts.join(' · ');
  }
}

class V9ActivityStep {
  final String type;
  final String? stopId;
  final String status;
  final String? placeId;
  final String? meal;
  final String name;
  final String start;
  final String end;
  final int? durationMinutes;
  final num? estimatedGroupCostVnd;
  final num? spendingTargetGroupVnd;
  final double? distanceKm;
  final double? routeDurationMinutes;
  final int? bufferMinutes;
  final String? phone;
  final double? googleRating;
  final int? googleReviewCount;
  final List<String> activityNames;
  final String? note;
  final String? arrivedAt;
  final String? departedAt;
  final String? estimatedDepartureAt;
  final String? estimatedArrivalAt;
  final String? plannedStartAt;
  final String? plannedEndAt;
  final double? latitude;
  final double? longitude;
  final Map<String, dynamic> raw;

  const V9ActivityStep({
    required this.type,
    this.stopId,
    this.status = 'pending',
    this.placeId,
    this.meal,
    required this.name,
    required this.start,
    required this.end,
    this.durationMinutes,
    this.estimatedGroupCostVnd,
    this.spendingTargetGroupVnd,
    this.distanceKm,
    this.routeDurationMinutes,
    this.bufferMinutes,
    this.phone,
    this.googleRating,
    this.googleReviewCount,
    this.activityNames = const [],
    this.note,
    this.arrivedAt,
    this.departedAt,
    this.estimatedDepartureAt,
    this.estimatedArrivalAt,
    this.plannedStartAt,
    this.plannedEndAt,
    this.latitude,
    this.longitude,
    this.raw = const {},
  });

  factory V9ActivityStep.fromJson(Map<String, dynamic> json) {
    final acts = (json['activities_available'] as List?)
            ?.whereType<Map<String, dynamic>>()
            .map((a) => a['name']?.toString() ?? '')
            .where((s) => s.isNotEmpty)
            .toList() ??
        const [];
    return V9ActivityStep(
      type: json['type']?.toString() ?? 'visit',
      stopId: json['stop_id']?.toString(),
      status: json['status']?.toString() ?? 'pending',
      placeId: json['place_id']?.toString(),
      meal: json['meal']?.toString(),
      name: json['name']?.toString() ?? '',
      start: json['start']?.toString() ?? '08:00',
      end: json['end']?.toString() ?? '09:30',
      durationMinutes: (json['duration_minutes'] as num?)?.toInt(),
      estimatedGroupCostVnd: json['estimated_group_cost_vnd'] as num?,
      spendingTargetGroupVnd: json['spending_target_group_vnd'] as num?,
      distanceKm: (json['distance_km'] as num?)?.toDouble(),
      routeDurationMinutes: (json['route_duration_minutes'] as num?)?.toDouble(),
      bufferMinutes: (json['buffer_minutes'] as num?)?.toInt(),
      phone: json['phone']?.toString(),
      googleRating: (json['google_rating'] as num?)?.toDouble(),
      googleReviewCount: (json['google_review_count'] as num?)?.toInt(),
      activityNames: acts,
      note: json['note']?.toString(),
      arrivedAt: json['arrived_at']?.toString(),
      departedAt: json['departed_at']?.toString(),
      estimatedDepartureAt: json['estimated_departure_at']?.toString(),
      estimatedArrivalAt: json['estimated_arrival_at']?.toString(),
      plannedStartAt: json['planned_start_at']?.toString(),
      plannedEndAt: json['planned_end_at']?.toString(),
      latitude: (json['latitude'] as num?)?.toDouble(),
      longitude: (json['longitude'] as num?)?.toDouble(),
      raw: Map<String, dynamic>.from(json),
    );
  }

  Map<String, dynamic> toJson() {
    final copy = Map<String, dynamic>.from(raw);
    copy['type'] = type;
    if (stopId != null) copy['stop_id'] = stopId;
    copy['status'] = status;
    copy['name'] = name;
    copy['start'] = start;
    copy['end'] = end;
    return copy;
  }
}

class V9StopIssue {
  final String? stopId;
  final String reason;

  const V9StopIssue({this.stopId, required this.reason});

  factory V9StopIssue.fromJson(Map<String, dynamic> json) {
    return V9StopIssue(
      stopId: json['stop_id']?.toString(),
      reason: json['reason']?.toString() ?? '',
    );
  }
}

class V9Day {
  final int day;
  final String date;
  final String status;
  final int visitCount;
  final List<V9ActivityStep> activities;
  final Map<String, dynamic>? overnightStay;
  final V9ActivityStep? nextStop;
  final List<V9StopIssue> issues;
  final String? estimatedDayEndAt;
  final bool laterDaysNeedReview;
  final Map<String, dynamic> raw;

  const V9Day({
    required this.day,
    required this.date,
    required this.status,
    required this.visitCount,
    required this.activities,
    this.overnightStay,
    this.nextStop,
    this.issues = const [],
    this.estimatedDayEndAt,
    this.laterDaysNeedReview = false,
    this.raw = const {},
  });

  factory V9Day.fromJson(Map<String, dynamic> json) {
    final replan = json['replan_state'] as Map<String, dynamic>?;
    return V9Day(
      day: (json['day'] as num?)?.toInt() ?? 1,
      date: json['date']?.toString() ?? '',
      status: json['status']?.toString() ?? 'ok',
      visitCount: (json['visit_count'] as num?)?.toInt() ?? 0,
      activities: (json['activities'] as List?)
              ?.whereType<Map<String, dynamic>>()
              .map(V9ActivityStep.fromJson)
              .toList() ??
          const [],
      overnightStay: json['overnight_stay'] is Map<String, dynamic>
          ? Map<String, dynamic>.from(json['overnight_stay'] as Map)
          : null,
      nextStop: replan?['next_stop'] is Map<String, dynamic>
          ? V9ActivityStep.fromJson(replan!['next_stop'] as Map<String, dynamic>)
          : null,
      issues: (replan?['issues'] as List?)
              ?.whereType<Map<String, dynamic>>()
              .map(V9StopIssue.fromJson)
              .toList() ??
          const [],
      estimatedDayEndAt: replan?['estimated_day_end_at']?.toString(),
      laterDaysNeedReview: replan?['later_days_need_review'] == true,
      raw: Map<String, dynamic>.from(json),
    );
  }

  Map<String, dynamic> toJson() {
    final copy = Map<String, dynamic>.from(raw);
    copy['day'] = day;
    copy['date'] = date;
    copy['status'] = status;
    copy['visit_count'] = visitCount;
    copy['activities'] = activities.map((e) => e.toJson()).toList();
    return copy;
  }
}

class V9ItineraryObject {
  final String status;
  final String algorithm;
  final Map<String, dynamic> input;
  final List<V9Day> days;
  final Map<String, dynamic>? sharedAccommodation;
  final List<String> scheduledPrimaryIds;
  final List<Map<String, String>> unassignedPrimaryPlaces;
  final Map<String, num> wholeGroupAllocation;
  final num knownSubtotalVnd;
  final int unknownCostCount;
  final double roadDistanceKm;
  final num budgetOverageVnd;
  final List<String> warnings;
  final bool budgetAdjusted;
  final Map<String, dynamic> raw;

  const V9ItineraryObject({
    required this.status,
    required this.algorithm,
    required this.input,
    required this.days,
    this.sharedAccommodation,
    this.scheduledPrimaryIds = const [],
    this.unassignedPrimaryPlaces = const [],
    this.wholeGroupAllocation = const {},
    this.knownSubtotalVnd = 0,
    this.unknownCostCount = 0,
    this.roadDistanceKm = 0,
    this.budgetOverageVnd = 0,
    this.warnings = const [],
    this.budgetAdjusted = false,
    this.raw = const {},
  });

  factory V9ItineraryObject.fromJson(Map<String, dynamic> json) {
    final allocMap = <String, num>{};
    final ba = json['budget_allocation'] as Map<String, dynamic>?;
    final wg = ba?['whole_group_vnd'] as Map<String, dynamic>?;
    if (wg != null) {
      wg.forEach((k, v) {
        if (v is num) allocMap[k] = v;
      });
    }

    final cost = json['cost_summary'] as Map<String, dynamic>?;
    final unassigned = (json['unassigned_primary_places'] as List?)
            ?.whereType<Map>()
            .map((u) => {
                  'id': u['id']?.toString() ?? '',
                  'name': u['name']?.toString() ?? '',
                  'reason': u['reason']?.toString() ?? '',
                })
            .toList() ??
        const [];

    return V9ItineraryObject(
      status: json['status']?.toString() ?? 'ok',
      algorithm: json['algorithm']?.toString() ?? 'v9',
      input: json['input'] is Map<String, dynamic>
          ? Map<String, dynamic>.from(json['input'] as Map)
          : const {},
      days: (json['days'] as List?)
              ?.whereType<Map<String, dynamic>>()
              .map(V9Day.fromJson)
              .toList() ??
          const [],
      sharedAccommodation: json['shared_accommodation'] is Map<String, dynamic>
          ? Map<String, dynamic>.from(json['shared_accommodation'] as Map)
          : null,
      scheduledPrimaryIds:
          (json['scheduled_primary_ids'] as List?)?.map((e) => e.toString()).toList() ?? const [],
      unassignedPrimaryPlaces: unassigned,
      wholeGroupAllocation: allocMap,
      knownSubtotalVnd: (cost?['known_subtotal_vnd'] as num?) ?? 0,
      unknownCostCount: (cost?['unknown_cost_count'] as num?)?.toInt() ?? 0,
      roadDistanceKm: (cost?['road_distance_km'] as num?)?.toDouble() ?? 0,
      budgetOverageVnd: (cost?['budget_overage_vnd'] as num?) ?? 0,
      warnings: (json['warnings'] as List?)?.map((e) => e.toString()).toList() ?? const [],
      budgetAdjusted: json['budget_adjusted'] == true,
      raw: Map<String, dynamic>.from(json),
    );
  }

  Map<String, dynamic> toJson() {
    final copy = Map<String, dynamic>.from(raw);
    copy['days'] = days.map((d) => d.toJson()).toList();
    copy['scheduled_primary_ids'] = scheduledPrimaryIds;
    return copy;
  }
}

class V9PlanResponse {
  final String status;
  final String mode;
  final String goal;
  final List<V9Place> primaryPlaces;
  final V9ItineraryObject? itinerary;
  final V9ItineraryObject? budgetAlternative;
  final List<String> warnings;
  final Map<String, dynamic> raw;

  const V9PlanResponse({
    required this.status,
    required this.mode,
    required this.goal,
    required this.primaryPlaces,
    this.itinerary,
    this.budgetAlternative,
    this.warnings = const [],
    this.raw = const {},
  });

  factory V9PlanResponse.fromJson(Map<String, dynamic> json) {
    return V9PlanResponse(
      status: json['status']?.toString() ?? 'ok',
      mode: json['mode']?.toString() ?? 'ai',
      goal: json['goal']?.toString() ?? 'sightseeing',
      primaryPlaces: (json['primary_places'] as List?)
              ?.whereType<Map<String, dynamic>>()
              .map(V9Place.fromJson)
              .toList() ??
          const [],
      itinerary: json['itinerary'] is Map<String, dynamic>
          ? V9ItineraryObject.fromJson(json['itinerary'] as Map<String, dynamic>)
          : null,
      budgetAlternative: json['budget_alternative'] is Map<String, dynamic>
          ? V9ItineraryObject.fromJson(json['budget_alternative'] as Map<String, dynamic>)
          : null,
      warnings: (json['warnings'] as List?)?.map((e) => e.toString()).toList() ?? const [],
      raw: Map<String, dynamic>.from(json),
    );
  }
}

class ReplanHistoryEntry {
  final String eventId;
  final String stopId;
  final String event;
  final String occurredAt;
  final int itineraryVersion;
  final String createdAt;

  const ReplanHistoryEntry({
    required this.eventId,
    required this.stopId,
    required this.event,
    required this.occurredAt,
    required this.itineraryVersion,
    required this.createdAt,
  });

  factory ReplanHistoryEntry.fromJson(Map<String, dynamic> json) {
    return ReplanHistoryEntry(
      eventId: json['eventId']?.toString() ?? '',
      stopId: json['stopId']?.toString() ?? '',
      event: json['event']?.toString() ?? 'arrived',
      occurredAt: json['occurredAt']?.toString() ?? '',
      itineraryVersion: (json['itineraryVersion'] as num?)?.toInt() ?? 1,
      createdAt: json['createdAt']?.toString() ?? '',
    );
  }
}

class PlannedItem {
  final String destinationId;
  final String slug;
  final String name;
  final String? category;
  final String? area;
  final int durationMinutes;
  final bool durationIsEstimate;
  final List<String> reasons;
  final bool available;
  final String? unavailableReason;

  const PlannedItem({
    required this.destinationId,
    required this.slug,
    required this.name,
    this.category,
    this.area,
    required this.durationMinutes,
    this.durationIsEstimate = true,
    this.reasons = const [],
    this.available = true,
    this.unavailableReason,
  });

  factory PlannedItem.fromJson(Map<String, dynamic> json) {
    return PlannedItem(
      destinationId: json['destinationId']?.toString() ?? '',
      slug: json['slug']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      category: json['category']?.toString(),
      area: json['area']?.toString(),
      durationMinutes: (json['durationMinutes'] as num?)?.toInt() ?? 90,
      durationIsEstimate: json['durationIsEstimate'] != false,
      reasons: (json['reasons'] as List?)?.map((e) => e.toString()).toList() ?? const [],
      available: json['available'] != false,
      unavailableReason: json['unavailableReason']?.toString(),
    );
  }
}

class LegacyPlanDay {
  final int dayNumber;
  final List<PlannedItem> items;

  const LegacyPlanDay({
    required this.dayNumber,
    required this.items,
  });

  factory LegacyPlanDay.fromJson(Map<String, dynamic> json) {
    return LegacyPlanDay(
      dayNumber: (json['dayNumber'] as num?)?.toInt() ?? 1,
      items: (json['items'] as List?)
              ?.whereType<Map<String, dynamic>>()
              .map(PlannedItem.fromJson)
              .toList() ??
          const [],
    );
  }
}

class SavedItinerary {
  final String id;
  final String title;
  final int numberOfDays;
  final int estimatedDurationMinutes;
  final String plannerVersion;
  final int itineraryVersion;
  final V9ItineraryObject? v9Itinerary;
  final List<V9Place> primaryPlaces;
  final List<ReplanHistoryEntry> replanHistory;
  final List<LegacyPlanDay> legacyDays;
  final String updatedAt;

  const SavedItinerary({
    required this.id,
    required this.title,
    required this.numberOfDays,
    required this.estimatedDurationMinutes,
    required this.plannerVersion,
    required this.itineraryVersion,
    this.v9Itinerary,
    this.primaryPlaces = const [],
    this.replanHistory = const [],
    this.legacyDays = const [],
    required this.updatedAt,
  });

  factory SavedItinerary.fromJson(Map<String, dynamic> json) {
    final v9Meta = json['v9Meta'] as Map<String, dynamic>?;
    final prim = (v9Meta?['primary_places'] as List?)
            ?.whereType<Map<String, dynamic>>()
            .map(V9Place.fromJson)
            .toList() ??
        const [];
    return SavedItinerary(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      numberOfDays: (json['numberOfDays'] as num?)?.toInt() ?? 1,
      estimatedDurationMinutes: (json['estimatedDurationMinutes'] as num?)?.toInt() ?? 0,
      plannerVersion: json['plannerVersion']?.toString() ?? 'v9',
      itineraryVersion: (json['itineraryVersion'] as num?)?.toInt() ?? 1,
      v9Itinerary: json['v9Itinerary'] is Map<String, dynamic>
          ? V9ItineraryObject.fromJson(json['v9Itinerary'] as Map<String, dynamic>)
          : null,
      primaryPlaces: prim,
      replanHistory: (json['replanHistory'] as List?)
              ?.whereType<Map<String, dynamic>>()
              .map(ReplanHistoryEntry.fromJson)
              .toList() ??
          const [],
      legacyDays: (json['days'] as List?)
              ?.whereType<Map<String, dynamic>>()
              .map(LegacyPlanDay.fromJson)
              .toList() ??
          const [],
      updatedAt: json['updatedAt']?.toString() ?? '',
    );
  }
}

class ItineraryListItem {
  final String id;
  final String title;
  final int numberOfDays;
  final int destinationCount;
  final int estimatedDurationMinutes;
  final String plannerVersion;
  final int itineraryVersion;
  final String? status;
  final String? startDate;
  final String? mode;
  final num? budgetVnd;
  final String updatedAt;

  const ItineraryListItem({
    required this.id,
    required this.title,
    required this.numberOfDays,
    required this.destinationCount,
    required this.estimatedDurationMinutes,
    required this.plannerVersion,
    required this.itineraryVersion,
    this.status,
    this.startDate,
    this.mode,
    this.budgetVnd,
    required this.updatedAt,
  });

  factory ItineraryListItem.fromJson(Map<String, dynamic> json) {
    return ItineraryListItem(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      numberOfDays: (json['numberOfDays'] as num?)?.toInt() ?? 1,
      destinationCount: (json['destinationCount'] as num?)?.toInt() ?? 0,
      estimatedDurationMinutes: (json['estimatedDurationMinutes'] as num?)?.toInt() ?? 0,
      plannerVersion: json['plannerVersion']?.toString() ?? 'v9',
      itineraryVersion: (json['itineraryVersion'] as num?)?.toInt() ?? 1,
      status: json['status']?.toString(),
      startDate: json['startDate']?.toString(),
      mode: json['mode']?.toString(),
      budgetVnd: json['budgetVnd'] as num?,
      updatedAt: json['updatedAt']?.toString() ?? '',
    );
  }
}
