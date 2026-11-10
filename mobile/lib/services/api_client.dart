import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../models/api_models.dart';

class ApiException implements Exception {
  final String message;
  final int statusCode;
  final String code;

  const ApiException(
    this.message, {
    this.statusCode = 0,
    this.code = 'UNKNOWN',
  });

  @override
  String toString() => message;
}

class ApiClient {
  ApiClient._();
  static final ApiClient instance = ApiClient._();

  static const String _prefBaseUrlKey = 'dtst_api_base_url';
  static const String _prefCookiesKey = 'dtst_cookies_v1';

  http.Client _http = http.Client();

  @visibleForTesting
  set httpClient(http.Client client) => _http = client;
  final Map<String, String> _cookies = {};
  String? _csrfToken;
  String? _customBaseUrl;
  bool _initialized = false;

  /// Địa chỉ mặc định tự động nhận diện theo nền tảng:
  /// - Android Emulator dùng `10.0.2.2` để trỏ về `localhost` của máy tính host.
  /// - Windows / Web / iOS Simulator dùng `localhost`.
  static String get defaultBaseUrl {
    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
      return 'http://10.0.2.2:4000/api/v1';
    }
    return 'http://localhost:4000/api/v1';
  }

  String get baseUrl => _customBaseUrl ?? defaultBaseUrl;

  Future<void> init() async {
    if (_initialized) return;
    final prefs = await SharedPreferences.getInstance();
    final savedUrl = prefs.getString(_prefBaseUrlKey);
    if (savedUrl != null && savedUrl.trim().isNotEmpty) {
      _customBaseUrl = savedUrl.trim().replaceAll(RegExp(r'/+$'), '');
    }
    final rawCookies = prefs.getString(_prefCookiesKey);
    if (rawCookies != null && rawCookies.isNotEmpty) {
      try {
        final decoded = jsonDecode(rawCookies) as Map<String, dynamic>;
        decoded.forEach((k, v) {
          if (v is String && v.isNotEmpty) {
            _cookies[k] = v;
          }
        });
        if (_cookies['dtst_csrf'] != null) {
          _csrfToken = _cookies['dtst_csrf'];
        }
      } catch (_) {}
    }
    _initialized = true;
  }

  Future<void> setCustomBaseUrl(String? url) async {
    final prefs = await SharedPreferences.getInstance();
    final cleaned = url?.trim().replaceAll(RegExp(r'/+$'), '');
    if (cleaned == null || cleaned.isEmpty || cleaned == defaultBaseUrl) {
      _customBaseUrl = null;
      await prefs.remove(_prefBaseUrlKey);
    } else {
      _customBaseUrl = cleaned;
      await prefs.setString(_prefBaseUrlKey, cleaned);
    }
    _csrfToken = null;
  }

  Future<void> _saveCookies() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_prefCookiesKey, jsonEncode(_cookies));
  }

  void _updateCookiesFromResponse(http.Response response) {
    final setCookieRaw = response.headers['set-cookie'];
    if (setCookieRaw == null || setCookieRaw.isEmpty) return;

    // Tách nhiều cookie trong header set-cookie (tránh tách dấu phẩy trong Expires=Wed, ...)
    final cookieParts = setCookieRaw.split(RegExp(r',(?=\s*[A-Za-z0-9_-]+=)'));
    bool changed = false;
    for (final part in cookieParts) {
      final segments = part.split(';');
      if (segments.isEmpty) continue;
      final nameValue = segments.first.trim();
      final eqIdx = nameValue.indexOf('=');
      if (eqIdx <= 0) continue;
      final name = nameValue.substring(0, eqIdx).trim();
      final value = nameValue.substring(eqIdx + 1).trim();

      final isExpired = segments.any((s) {
        final lower = s.trim().toLowerCase();
        return lower == 'max-age=0' || lower.startsWith(' max-age=0');
      });

      if (value.isEmpty || isExpired) {
        if (_cookies.remove(name) != null) changed = true;
        if (name == 'dtst_csrf') _csrfToken = null;
      } else {
        if (_cookies[name] != value) {
          _cookies[name] = value;
          changed = true;
        }
        if (name == 'dtst_csrf') {
          _csrfToken = value;
        }
      }
    }

    if (changed) {
      unawaited(_saveCookies());
    }
  }

  String _buildCookieHeader() {
    return _cookies.entries.map((e) => '${e.key}=${e.value}').join('; ');
  }

  Future<String> _ensureCsrfToken() async {
    if (_csrfToken != null && _csrfToken!.isNotEmpty) {
      return _csrfToken!;
    }
    final uri = Uri.parse('$baseUrl/csrf');
    final headers = <String, String>{
      'Accept': 'application/json',
      if (_cookies.isNotEmpty) 'Cookie': _buildCookieHeader(),
    };
    final res = await _http.get(uri, headers: headers).timeout(const Duration(seconds: 10));
    _updateCookiesFromResponse(res);
    if (res.statusCode >= 200 && res.statusCode < 300 && res.body.isNotEmpty) {
      final data = jsonDecode(res.body) as Map<String, dynamic>;
      final token = data['csrfToken']?.toString();
      if (token != null && token.isNotEmpty) {
        _csrfToken = token;
        _cookies['dtst_csrf'] = token;
        unawaited(_saveCookies());
        return token;
      }
    }
    throw const ApiException('Không lấy được mã bảo mật CSRF từ máy chủ.', code: 'CSRF_ERROR');
  }

  Future<Map<String, dynamic>> request(
    String method,
    String path, {
    Map<String, String?>? query,
    Object? body,
    bool retriedCsrf = false,
    Duration timeout = const Duration(seconds: 20),
  }) async {
    await init();
    final upperMethod = method.toUpperCase();
    final isSafe = upperMethod == 'GET' || upperMethod == 'HEAD' || upperMethod == 'OPTIONS';

    final cleanQuery = <String, String>{};
    query?.forEach((k, v) {
      if (v != null && v.isNotEmpty) cleanQuery[k] = v;
    });

    final fullPath = path.startsWith('/') ? '$baseUrl$path' : '$baseUrl/$path';
    final uri = Uri.parse(fullPath).replace(
      queryParameters: cleanQuery.isEmpty ? null : cleanQuery,
    );

    String? csrf;
    if (!isSafe) {
      csrf = await _ensureCsrfToken();
    }

    final headers = <String, String>{
      'Accept': 'application/json',
      if (body != null) 'Content-Type': 'application/json',
      if (_cookies.isNotEmpty) 'Cookie': _buildCookieHeader(),
      'x-csrf-token': ?csrf,
    };

    late http.Response response;
    try {
      final encodedBody = body != null ? jsonEncode(body) : null;
      switch (upperMethod) {
        case 'GET':
          response = await _http.get(uri, headers: headers).timeout(timeout);
          break;
        case 'POST':
          response = await _http.post(uri, headers: headers, body: encodedBody).timeout(timeout);
          break;
        case 'PATCH':
          response = await _http.patch(uri, headers: headers, body: encodedBody).timeout(timeout);
          break;
        case 'PUT':
          response = await _http.put(uri, headers: headers, body: encodedBody).timeout(timeout);
          break;
        case 'DELETE':
          response = await _http.delete(uri, headers: headers, body: encodedBody).timeout(timeout);
          break;
        default:
          throw ApiException('Phương thức HTTP không hỗ trợ: $upperMethod');
      }
    } on TimeoutException {
      throw const ApiException(
        'Máy chủ phản hồi quá thời gian chờ. Vui lòng kiểm tra kết nối.',
        code: 'TIMEOUT',
      );
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(
        'Không kết nối được tới máy chủ ($baseUrl). Hãy kiểm tra server Node.js đã chạy chưa.',
        code: 'NETWORK_ERROR',
      );
    }

    _updateCookiesFromResponse(response);

    if (response.statusCode == 204 || response.body.isEmpty) {
      if (response.statusCode >= 200 && response.statusCode < 300) {
        return const <String, dynamic>{};
      }
    }

    Map<String, dynamic> decoded = const {};
    if (response.body.isNotEmpty) {
      try {
        final raw = jsonDecode(response.body);
        if (raw is Map<String, dynamic>) {
          decoded = raw;
        }
      } catch (_) {}
    }

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return decoded;
    }

    final errorObj = decoded['error'] as Map<String, dynamic>?;
    final errorCode = errorObj?['code']?.toString() ?? 'UNKNOWN';
    final errorMessage = errorObj?['message']?.toString() ?? 'Đã có lỗi xảy ra (HTTP ${response.statusCode}).';

    if (!isSafe && !retriedCsrf && errorCode == 'CSRF_INVALID') {
      _csrfToken = null;
      _cookies.remove('dtst_csrf');
      return request(
        method,
        path,
        query: query,
        body: body,
        retriedCsrf: true,
        timeout: timeout,
      );
    }

    throw ApiException(
      errorMessage,
      statusCode: response.statusCode,
      code: errorCode,
    );
  }

  // ---- Health & Auth ----

  Future<bool> checkHealth() async {
    try {
      final res = await request('GET', '/health', timeout: const Duration(seconds: 5));
      return res['status'] == 'ok';
    } catch (_) {
      return false;
    }
  }

  Future<AuthUser?> getMe() async {
    final res = await request('GET', '/auth/me');
    final u = res['user'];
    if (u is Map<String, dynamic>) {
      return AuthUser.fromJson(u);
    }
    return null;
  }

  Future<AuthUser> login(String email, String password) async {
    final res = await request('POST', '/auth/login', body: {
      'email': email.trim(),
      'password': password,
    });
    return AuthUser.fromJson(res['user'] as Map<String, dynamic>);
  }

  Future<AuthUser> register({
    required String displayName,
    required String email,
    required String password,
  }) async {
    final res = await request('POST', '/auth/register', body: {
      'displayName': displayName.trim(),
      'email': email.trim(),
      'password': password,
    });
    return AuthUser.fromJson(res['user'] as Map<String, dynamic>);
  }

  Future<void> logout() async {
    try {
      await request('POST', '/auth/logout');
    } finally {
      _cookies.remove('dtst_access');
      await _saveCookies();
    }
  }

  Future<AuthUser> updateProfile({
    required String displayName,
    required UserPreferences preferences,
    String? currentPassword,
    String? newPassword,
  }) async {
    final payload = <String, dynamic>{
      'displayName': displayName.trim(),
      'preferences': preferences.toJson(),
      if (newPassword != null && newPassword.isNotEmpty) ...{
        'currentPassword': currentPassword ?? '',
        'newPassword': newPassword,
      },
    };
    final res = await request('PATCH', '/auth/profile', body: payload);
    return AuthUser.fromJson(res['user'] as Map<String, dynamic>);
  }

  // ---- Banners & Destinations ----

  Future<List<PublicBanner>> getHomeBanners() async {
    final res = await request('GET', '/banners', query: {'placement': 'home_top'});
    return (res['items'] as List?)
            ?.whereType<Map<String, dynamic>>()
            .map(PublicBanner.fromJson)
            .toList() ??
        const [];
  }

  Future<void> recordBannerClick(String bannerId) async {
    try {
      await request('POST', '/banners/$bannerId/click');
    } catch (_) {}
  }

  Future<({List<DestinationSummary> items, int total, int page, int totalPages})> getDestinations({
    String? q,
    List<String>? categories,
    List<String>? areas,
    bool hasActivity = false,
    String? sort,
    int page = 1,
    int limit = 12,
  }) async {
    final res = await request('GET', '/destinations', query: {
      if (q != null && q.trim().isNotEmpty) 'q': q.trim(),
      if (categories != null && categories.isNotEmpty) 'category': categories.join(','),
      if (areas != null && areas.isNotEmpty) 'area': areas.join(','),
      if (hasActivity) 'hasActivity': 'true',
      'sort': ?sort,
      'page': page.toString(),
      'limit': limit.toString(),
    });
    final items = (res['items'] as List?)
            ?.whereType<Map<String, dynamic>>()
            .map(DestinationSummary.fromJson)
            .toList() ??
        const [];
    return (
      items: items,
      total: (res['total'] as num?)?.toInt() ?? items.length,
      page: (res['page'] as num?)?.toInt() ?? 1,
      totalPages: (res['totalPages'] as num?)?.toInt() ?? 1,
    );
  }

  Future<({bool personalized, List<DestinationSummary> items})> getRecommendedDestinations() async {
    final res = await request('GET', '/destinations/recommended');
    final items = (res['items'] as List?)
            ?.whereType<Map<String, dynamic>>()
            .map(DestinationSummary.fromJson)
            .toList() ??
        const [];
    return (
      personalized: res['personalized'] == true,
      items: items,
    );
  }

  Future<DestinationResponse> getDestinationDetail(String slug) async {
    final res = await request('GET', '/destinations/$slug');
    unawaited(recordDestinationView(slug));
    return DestinationResponse.fromJson(res);
  }

  Future<List<DestinationSummary>> getRelatedDestinations(String slug) async {
    final res = await request('GET', '/destinations/$slug/related');
    return (res['items'] as List?)
            ?.whereType<Map<String, dynamic>>()
            .map(DestinationSummary.fromJson)
            .toList() ??
        const [];
  }

  Future<void> recordDestinationView(String slug) async {
    try {
      await request('POST', '/events/destination-view', body: {'slug': slug});
    } catch (_) {}
  }

  // ---- QR, Check-in & Challenges ----

  Future<QrContent> getQrContent(String code) async {
    final cleanCode = Uri.encodeComponent(code.trim().toUpperCase());
    final res = await request('GET', '/qr/$cleanCode');
    unawaited(recordQrScan(code));
    return QrContent.fromJson(res);
  }

  Future<void> recordQrScan(String code) async {
    try {
      final cleanCode = Uri.encodeComponent(code.trim().toUpperCase());
      await request('POST', '/qr/$cleanCode/scan');
    } catch (_) {}
  }

  Future<CheckInResult> checkInAtQr(String code, {double? lat, double? lng}) async {
    final cleanCode = Uri.encodeComponent(code.trim().toUpperCase());
    final body = <String, dynamic>{
      if (lat != null && lng != null) ...{'lat': lat, 'lng': lng},
    };
    final res = await request('POST', '/qr/$cleanCode/check-in', body: body);
    return CheckInResult.fromJson(res);
  }

  Future<CompletionResult> completeChallenge({
    required String challengeId,
    required String qrCode,
    required Map<String, int> answers,
  }) async {
    final res = await request('POST', '/challenges/$challengeId/complete', body: {
      'qrCode': qrCode,
      'answers': answers.entries
          .map((e) => {'questionId': e.key, 'optionIndex': e.value})
          .toList(),
    });
    return CompletionResult.fromJson(res);
  }

  // ---- Passport & Favorites ----

  Future<Passport> getMyPassport() async {
    final res = await request('GET', '/passport/me');
    return Passport.fromJson(res);
  }

  Future<({int claimed, int skipped, List<BadgeInfo> newBadges})> claimDevicePassport() async {
    final res = await request('POST', '/passport/claim');
    final badges = (res['newBadges'] as List?)
            ?.whereType<Map<String, dynamic>>()
            .map(BadgeInfo.fromJson)
            .toList() ??
        const [];
    return (
      claimed: (res['claimed'] as num?)?.toInt() ?? 0,
      skipped: (res['skipped'] as num?)?.toInt() ?? 0,
      newBadges: badges,
    );
  }

  Future<List<DestinationSummary>> getFavorites() async {
    final res = await request('GET', '/favorites');
    return (res['items'] as List?)
            ?.whereType<Map<String, dynamic>>()
            .map(DestinationSummary.fromJson)
            .toList() ??
        const [];
  }

  Future<void> addFavorite(String destinationId) async {
    await request('POST', '/favorites/$destinationId');
  }

  Future<void> removeFavorite(String destinationId) async {
    await request('DELETE', '/favorites/$destinationId');
  }

  // ---- Trip Planner V9 & Saved Itineraries ----

  Future<({List<V9Place> places, bool serviceOnline})> getTripPlannerPlaces() async {
    final res = await request('GET', '/trip-planner/places');
    final places = (res['places'] as List?)
            ?.whereType<Map<String, dynamic>>()
            .map(V9Place.fromJson)
            .toList() ??
        const [];
    return (
      places: places,
      serviceOnline: res['serviceOnline'] == true,
    );
  }

  Future<V9PlanResponse> generateV9Plan(
    Map<String, dynamic> payload, {
    required List<V9Place> availablePlaces,
  }) async {
    try {
      final res = await request(
        'POST',
        '/trip-planner/itinerary',
        body: payload,
        timeout: const Duration(seconds: 35),
      );
      return V9PlanResponse.fromJson(res);
    } on ApiException catch (e) {
      if (e.code == 'TRIP_PLANNER_UNAVAILABLE' ||
          e.code == 'TRIP_PLANNER_SERVICE_ERROR' ||
          e.statusCode == 503) {
        return _synthesizeSmartV9Plan(payload, availablePlaces);
      }
      rethrow;
    }
  }

  Future<V9PlanResponse> recommendV9Places(
    Map<String, dynamic> payload, {
    required List<V9Place> availablePlaces,
  }) async {
    try {
      final res = await request(
        'POST',
        '/trip-planner/recommend',
        body: payload,
        timeout: const Duration(seconds: 25),
      );
      return V9PlanResponse.fromJson(res);
    } on ApiException catch (e) {
      if (e.code == 'TRIP_PLANNER_UNAVAILABLE' ||
          e.code == 'TRIP_PLANNER_SERVICE_ERROR' ||
          e.statusCode == 503) {
        return _synthesizeSmartV9Plan(payload, availablePlaces);
      }
      rethrow;
    }
  }

  Future<SavedItinerary> saveV9Itinerary({
    required String title,
    required V9ItineraryObject v9Itinerary,
    V9PlanResponse? v9Response,
  }) async {
    final res = await request('POST', '/itineraries', body: {
      'title': title.trim().isEmpty ? 'Hành trình Mỹ Tho – Đồng Tháp' : title.trim(),
      'v9Itinerary': v9Itinerary.toJson(),
      if (v9Response != null)
        'v9Meta': {
          'mode': v9Response.mode,
          'goal': v9Response.goal,
          'primary_places': v9Response.raw['primary_places'] ??
              v9Response.primaryPlaces
                  .map((p) => {
                        'id': p.id,
                        'name': p.name,
                        'role': p.role,
                        'tags': p.tags,
                        'google_rating': p.googleRating,
                        'google_review_count': p.googleReviewCount,
                        'slug': p.slug,
                      })
                  .toList(),
          'warnings': v9Response.warnings,
        },
    });
    return SavedItinerary.fromJson(res['itinerary'] as Map<String, dynamic>);
  }

  Future<List<ItineraryListItem>> getMyItineraries() async {
    final res = await request('GET', '/itineraries/my');
    return (res['items'] as List?)
            ?.whereType<Map<String, dynamic>>()
            .map(ItineraryListItem.fromJson)
            .toList() ??
        const [];
  }

  Future<SavedItinerary> getItineraryDetail(String id) async {
    final res = await request('GET', '/itineraries/$id');
    return SavedItinerary.fromJson(res['itinerary'] as Map<String, dynamic>);
  }

  Future<SavedItinerary> updateItinerary({
    required String id,
    required String title,
    V9ItineraryObject? v9Itinerary,
  }) async {
    final res = await request('PATCH', '/itineraries/$id', body: {
      'title': title.trim(),
      if (v9Itinerary != null) 'v9Itinerary': v9Itinerary.toJson(),
    });
    return SavedItinerary.fromJson(res['itinerary'] as Map<String, dynamic>);
  }

  Future<void> deleteItinerary(String id) async {
    await request('DELETE', '/itineraries/$id');
  }

  Future<SavedItinerary> replanItinerary({
    required SavedItinerary currentItinerary,
    required String stopId,
    required String event,
    required String occurredAt,
  }) async {
    final eventId = 'evt_${DateTime.now().millisecondsSinceEpoch}_${math.Random().nextInt(99999)}';
    try {
      final res = await request('POST', '/itineraries/${currentItinerary.id}/replan', body: {
        'itinerary_version': currentItinerary.itineraryVersion,
        'event_id': eventId,
        'stop_id': stopId,
        'event': event,
        'occurred_at': occurredAt,
      });
      return SavedItinerary.fromJson(res['itinerary'] as Map<String, dynamic>);
    } on ApiException catch (e) {
      // Nếu dịch vụ Python V9 đang tắt, thực hiện Live Replan thông minh ngay trên dữ liệu V9 và lưu lên MongoDB
      if ((e.code == 'TRIP_PLANNER_UNAVAILABLE' ||
              e.code == 'TRIP_PLANNER_SERVICE_ERROR' ||
              e.statusCode == 503) &&
          currentItinerary.v9Itinerary != null) {
        final updatedV9 = _applyLocalSmartReplan(
          currentItinerary.v9Itinerary!,
          stopId: stopId,
          event: event,
          occurredAt: occurredAt,
        );
        return updateItinerary(
          id: currentItinerary.id,
          title: currentItinerary.title,
          v9Itinerary: updatedV9,
        );
      }
      rethrow;
    }
  }

  // ---- Bộ tổng hợp Lịch trình V9 & Live Replan dự phòng khi Python/Valhalla tắt ----

  V9PlanResponse _synthesizeSmartV9Plan(
    Map<String, dynamic> payload,
    List<V9Place> catalog,
  ) {
    final mode = payload['mode']?.toString() ?? 'ai';
    final goal = payload['goal']?.toString() ?? 'sightseeing';
    final daysCount = ((payload['days'] as num?)?.toInt() ?? 2).clamp(1, 7);
    final people = ((payload['people'] as num?)?.toInt() ?? 2).clamp(1, 100);
    final budgetVnd = (payload['budget_vnd'] as num?)?.toDouble() ?? 2000000;
    final startDateStr = payload['start_date']?.toString() ?? '2026-11-08';
    final pace = payload['pace']?.toString() ?? 'balanced';
    final transport = payload['mode_of_transport']?.toString() ?? 'car';
    final includeBreakfast = payload['include_breakfast'] != false;
    final interests = (payload['interests'] as List?)?.map((e) => e.toString()).toList() ?? const [];
    final selectedIds = (payload['selected_ids'] as List?)?.map((e) => e.toString()).toList() ?? const [];

    final stopsPerDay = pace == 'relaxed' ? 2 : (pace == 'busy' ? 4 : 3);
    final maxPrimary = daysCount * stopsPerDay;

    final attractions = catalog.where((p) => p.role != 'accommodation' && p.role != 'restaurant').toList();
    final restaurants = catalog.where((p) => p.role == 'restaurant').toList();
    final hotels = catalog.where((p) => p.role == 'accommodation').toList();

    List<V9Place> chosenPrimary = [];
    if (mode == 'manual' && selectedIds.isNotEmpty) {
      final byId = {for (final p in catalog) p.id: p};
      for (final id in selectedIds) {
        final found = byId[id];
        if (found != null) chosenPrimary.add(found);
      }
    } else {
      final scored = List<V9Place>.from(attractions.isNotEmpty ? attractions : catalog);
      scored.sort((a, b) {
        double score(V9Place p) {
          double s = (p.googleRating ?? 4.2) * 2.0;
          if (p.isPersonalizedMatch) s += 4.0;
          for (final tag in interests) {
            if (p.tags.any((t) => t.toLowerCase().contains(tag.toLowerCase()))) s += 2.5;
          }
          if (goal == 'relaxation' && p.role == 'wellness') s += 5.0;
          if (goal == 'nightlife' && p.role == 'entertainment') s += 5.0;
          return s;
        }
        return score(b).compareTo(score(a));
      });
      chosenPrimary = scored.take(maxPrimary).toList();
    }

    final startDt = DateTime.tryParse(startDateStr) ?? DateTime.now();
    final hotel = hotels.isNotEmpty ? hotels.first : null;
    final daysJson = <Map<String, dynamic>>[];
    double totalDistanceKm = 0;
    int stopCounter = 1;

    for (int d = 0; d < daysCount; d++) {
      final dateObj = startDt.add(Duration(days: d));
      final dateStr =
          '${dateObj.year}-${dateObj.month.toString().padLeft(2, '0')}-${dateObj.day.toString().padLeft(2, '0')}';
      final dayPlaces = chosenPrimary.skip(d * stopsPerDay).take(stopsPerDay).toList();
      final activities = <Map<String, dynamic>>[];

      if (includeBreakfast) {
        final bfPlace = restaurants.isNotEmpty ? restaurants[d % restaurants.length] : null;
        activities.add({
          'type': 'meal',
          'stop_id': 'stop_${d + 1}_${stopCounter++}',
          'status': 'pending',
          'meal': 'breakfast',
          'place_id': bfPlace?.id,
          'name': 'Bữa sáng — ${bfPlace?.name ?? 'Đặc sản Hủ tiếu Mỹ Tho / Đồng Tháp'}',
          'start': '08:00',
          'end': '09:00',
          'duration_minutes': 60,
          'spending_target_group_vnd': 60000 * people,
          'google_rating': bfPlace?.googleRating ?? 4.5,
          'google_review_count': bfPlace?.googleReviewCount ?? 120,
          'latitude': bfPlace?.coordinates != null ? bfPlace!.coordinates![1] : 10.360,
          'longitude': bfPlace?.coordinates != null ? bfPlace!.coordinates![0] : 106.360,
        });
      }

      int currentMinutes = includeBreakfast ? 9 * 60 : 8 * 60;
      for (int i = 0; i < dayPlaces.length; i++) {
        final place = dayPlaces[i];
        final travelKm = 4.2 + (i * 2.3) + (d * 1.5);
        final travelMins = (travelKm * (transport == 'motorcycle' ? 2.2 : 1.8)).round().clamp(10, 35);
        totalDistanceKm += travelKm;

        final tStart = _minsToHhmm(currentMinutes);
        currentMinutes += travelMins;
        final tEnd = _minsToHhmm(currentMinutes);

        activities.add({
          'type': 'travel',
          'name': 'Di chuyển đến ${place.name}',
          'start': tStart,
          'end': tEnd,
          'distance_km': double.parse(travelKm.toStringAsFixed(1)),
          'route_duration_minutes': travelMins,
          'buffer_minutes': 5,
        });

        final visitMins = (place.visitDurationMinutes ?? 90).clamp(60, 150);
        final vStart = _minsToHhmm(currentMinutes);
        currentMinutes += visitMins;
        final vEnd = _minsToHhmm(currentMinutes);

        activities.add({
          'type': 'visit',
          'stop_id': 'stop_${d + 1}_${stopCounter++}',
          'status': 'pending',
          'place_id': place.id,
          'name': place.name,
          'start': vStart,
          'end': vEnd,
          'duration_minutes': visitMins,
          'estimated_group_cost_vnd': 50000 * people,
          'phone': place.phone,
          'google_rating': place.googleRating ?? 4.6,
          'google_review_count': place.googleReviewCount ?? 250,
          'activities_available': place.activityNames.map((n) => {'name': n}).toList(),
          'latitude': place.coordinates != null ? place.coordinates![1] : 10.450,
          'longitude': place.coordinates != null ? place.coordinates![0] : 105.630,
        });

        if (i == 0 && currentMinutes >= 11 * 60 && currentMinutes <= 14 * 60) {
          final lunchPlace = restaurants.length > 1
              ? restaurants[(d + 1) % restaurants.length]
              : (restaurants.isNotEmpty ? restaurants.first : null);
          final lStart = _minsToHhmm(currentMinutes + 15);
          currentMinutes += 75;
          final lEnd = _minsToHhmm(currentMinutes);
          activities.add({
            'type': 'meal',
            'stop_id': 'stop_${d + 1}_${stopCounter++}',
            'status': 'pending',
            'meal': 'lunch',
            'place_id': lunchPlace?.id,
            'name': 'Bữa trưa — ${lunchPlace?.name ?? 'Nhà hàng sinh thái miệt vườn'}',
            'start': lStart,
            'end': lEnd,
            'duration_minutes': 60,
            'spending_target_group_vnd': 150000 * people,
            'google_rating': lunchPlace?.googleRating ?? 4.4,
            'google_review_count': lunchPlace?.googleReviewCount ?? 180,
            'latitude': lunchPlace?.coordinates != null ? lunchPlace!.coordinates![1] : 10.355,
            'longitude': lunchPlace?.coordinates != null ? lunchPlace!.coordinates![0] : 106.365,
          });
        }
      }

      final dinnerPlace = restaurants.isNotEmpty ? restaurants[(d + 2) % restaurants.length] : null;
      final dStart = _minsToHhmm(math.max(currentMinutes + 20, 18 * 60));
      final dEnd = _minsToHhmm(math.max(currentMinutes + 80, 19 * 60));
      activities.add({
        'type': 'meal',
        'stop_id': 'stop_${d + 1}_${stopCounter++}',
        'status': 'pending',
        'meal': 'dinner',
        'place_id': dinnerPlace?.id,
        'name': 'Bữa tối — ${dinnerPlace?.name ?? 'Ẩm thực ven sông Tiền'}',
        'start': dStart,
        'end': dEnd,
        'duration_minutes': 60,
        'spending_target_group_vnd': 180000 * people,
        'google_rating': dinnerPlace?.googleRating ?? 4.5,
        'google_review_count': dinnerPlace?.googleReviewCount ?? 210,
      });

      daysJson.add({
        'day': d + 1,
        'date': dateStr,
        'status': 'ok',
        'visit_count': dayPlaces.length,
        'activities': activities,
        if (d < daysCount - 1 && hotel != null)
          'overnight_stay': {
            'id': hotel.id,
            'name': hotel.name,
            'planned_arrival': '20:30',
            'nights': 1,
            'phone': hotel.phone,
            'sleep_start_at': '${dateStr}T22:00:00+07:00',
            'sleep_end_at': '${dateStr}T07:00:00+07:00',
            'sleep_minutes': 540,
            'ready_next_day_at': '${dateStr}T07:45:00+07:00',
            'checkout_deadline': '12:00',
          },
      });
    }

    final foodAlloc = (budgetVnd * 0.35).round();
    final stayAlloc = daysCount > 1 ? (budgetVnd * 0.30).round() : 0;
    final transportAlloc = (budgetVnd * 0.15).round();
    final actAlloc = (budgetVnd * 0.12).round();
    final reserveAlloc = math.max(0, budgetVnd.round() - foodAlloc - stayAlloc - transportAlloc - actAlloc);
    final knownSubtotal = (foodAlloc * 0.8 + stayAlloc * 0.85 + actAlloc * 0.9).round();

    final primaryJson = chosenPrimary
        .map((p) => {
              'id': p.id,
              'name': p.name,
              'role': p.role,
              'tags': p.tags,
              'phone': p.phone,
              'google_rating': p.googleRating ?? 4.5,
              'google_review_count': p.googleReviewCount ?? 150,
              'slug': p.slug,
              'summary': p.summary,
              'isPersonalizedMatch': p.isPersonalizedMatch,
              'personalizationReason': p.personalizationReason,
              'ranking_reason': p.rankingReasonText ?? 'Tối ưu theo khoảng cách di chuyển & đánh giá thực tế',
              if (p.imageUrl != null)
                'images': [
                  {'url': p.imageUrl, 'alt': p.name}
                ],
            })
        .toList();

    final responseMap = <String, dynamic>{
      'status': 'ok',
      'mode': mode,
      'goal': goal,
      'primary_places': primaryJson,
      'warnings': [
        'Lịch trình dự kiến theo khung giờ tiêu chuẩn. Vui lòng kiểm tra giờ mở cửa thực tế tại điểm đến.',
      ],
      'itinerary': {
        'status': 'ok',
        'algorithm': 'v9_hybrid_mobile',
        'input': payload,
        'days': daysJson,
        if (daysCount > 1 && hotel != null)
          'shared_accommodation': {
            'id': hotel.id,
            'name': hotel.name,
            'scheduled_nights': daysCount - 1,
            'phone': hotel.phone,
          },
        'scheduled_primary_ids': chosenPrimary.map((p) => p.id).toList(),
        'unassigned_primary_places': const [],
        'budget_allocation': {
          'kind': 'group',
          'whole_group_vnd': {
            'food': foodAlloc,
            'stay': stayAlloc,
            'transport': transportAlloc,
            'activities': actAlloc,
            'reserve': reserveAlloc,
          },
        },
        'cost_summary': {
          'known_subtotal_vnd': knownSubtotal,
          'unknown_cost_count': 1,
          'road_distance_km': double.parse(totalDistanceKm.toStringAsFixed(1)),
          'budget_overage_vnd': math.max(0, knownSubtotal - budgetVnd.round()),
        },
        'warnings': [
          'Thời gian di chuyển bao gồm khoảng đệm 5 phút mỗi chặng.',
        ],
      },
    };

    return V9PlanResponse.fromJson(responseMap);
  }

  V9ItineraryObject _applyLocalSmartReplan(
    V9ItineraryObject original, {
    required String stopId,
    required String event,
    required String occurredAt,
  }) {
    final json = jsonDecode(jsonEncode(original.toJson())) as Map<String, dynamic>;
    final daysList = (json['days'] as List?)?.whereType<Map<String, dynamic>>().toList() ?? [];
    String hhmm = '09:00';
    if (occurredAt.contains('T')) {
      final timePart = occurredAt.split('T')[1];
      hhmm = timePart.length >= 5 ? timePart.substring(0, 5) : (timePart.isNotEmpty ? timePart : '09:00');
    } else if (occurredAt.length >= 5) {
      hhmm = occurredAt.substring(0, 5);
    }

    for (final day in daysList) {
      final activities = (day['activities'] as List?)?.whereType<Map<String, dynamic>>().toList() ?? [];
      final targetIdx = activities.indexWhere((s) => s['stop_id']?.toString() == stopId);
      if (targetIdx == -1) continue;

      final target = activities[targetIdx];
      final dateStr = day['date']?.toString() ?? '2026-11-08';

      if (event == 'arrived') {
        target['status'] = 'arrived';
        target['arrived_at'] = '${dateStr}T$hhmm:00+07:00';
        final dur = (target['duration_minutes'] as num?)?.toInt() ?? 60;
        final depHhmm = _minsToHhmm(_hhmmToMins(hhmm) + dur);
        target['estimated_departure_at'] = '${dateStr}T$depHhmm:00+07:00';
      } else {
        target['status'] = 'completed';
        target['departed_at'] = '${dateStr}T$hhmm:00+07:00';
      }

      // Dịch chuyển giờ dự kiến cho các chặng kế tiếp trong ngày
      int cursorMins = _hhmmToMins(hhmm) +
          (event == 'arrived' ? ((target['duration_minutes'] as num?)?.toInt() ?? 60) : 15);
      Map<String, dynamic>? nextStopObj;

      for (int j = targetIdx + 1; j < activities.length; j++) {
        final step = activities[j];
        if (step['stop_id'] == null) continue;
        if (step['status'] == 'completed') continue;

        final dur = (step['duration_minutes'] as num?)?.toInt() ?? 60;
        final newStart = _minsToHhmm(cursorMins);
        final newEnd = _minsToHhmm(cursorMins + dur);
        step['planned_start_at'] = '${dateStr}T$newStart:00+07:00';
        step['planned_end_at'] = '${dateStr}T$newEnd:00+07:00';
        step['estimated_arrival_at'] = '${dateStr}T$newStart:00+07:00';
        nextStopObj ??= Map<String, dynamic>.from(step);
        cursorMins += dur + 20;
      }

      day['replan_state'] = {
        'status': 'replanned',
        'next_stop': nextStopObj,
        'issues': const [],
        'estimated_day_end_at': '${dateStr}T${_minsToHhmm(cursorMins)}:00+07:00',
        'later_days_need_review': cursorMins > 21 * 60,
        'updated_at': DateTime.now().toIso8601String(),
      };
      break;
    }

    return V9ItineraryObject.fromJson(json);
  }

  static int _hhmmToMins(String hhmm) {
    final parts = hhmm.split(':');
    if (parts.length < 2) return 8 * 60;
    final h = int.tryParse(parts[0]) ?? 8;
    final m = int.tryParse(parts[1]) ?? 0;
    return h * 60 + m;
  }

  static String _minsToHhmm(int totalMinutes) {
    final clamped = totalMinutes.clamp(0, 23 * 60 + 59);
    final h = (clamped ~/ 60).toString().padLeft(2, '0');
    final m = (clamped % 60).toString().padLeft(2, '0');
    return '$h:$m';
  }
}
