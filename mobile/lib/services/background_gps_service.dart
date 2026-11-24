import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api_client.dart';

class GpsTrackPoint {
  final double lat;
  final double lng;
  final int timestamp;
  final double? speedKmh;

  const GpsTrackPoint({
    required this.lat,
    required this.lng,
    required this.timestamp,
    this.speedKmh,
  });

  factory GpsTrackPoint.fromJson(Map<String, dynamic> json) {
    return GpsTrackPoint(
      lat: (json['lat'] as num).toDouble(),
      lng: (json['lng'] as num).toDouble(),
      timestamp: (json['timestamp'] as num).toInt(),
      speedKmh: (json['speedKmh'] as num?)?.toDouble(),
    );
  }

  Map<String, dynamic> toJson() => {
        'lat': lat,
        'lng': lng,
        'timestamp': timestamp,
        if (speedKmh != null) 'speedKmh': speedKmh,
      };
}

class BackgroundFootprintTrack {
  final String clientId;
  final String ownerKey;
  final String title;
  final String color;
  final double distanceKm;
  final int durationSeconds;
  final int startedAt;
  final int endedAt;
  final List<GpsTrackPoint> points;
  final bool synced;

  const BackgroundFootprintTrack({
    required this.clientId,
    required this.ownerKey,
    required this.title,
    this.color = '#10b981',
    required this.distanceKm,
    required this.durationSeconds,
    required this.startedAt,
    required this.endedAt,
    required this.points,
    this.synced = false,
  });

  factory BackgroundFootprintTrack.fromJson(Map<String, dynamic> json) {
    final rawPts = (json['points'] as List?) ?? const [];
    return BackgroundFootprintTrack(
      clientId: json['clientId']?.toString() ?? '',
      ownerKey: json['ownerKey']?.toString() ?? 'guest',
      title: json['title']?.toString() ?? 'Hành trình GPS',
      color: json['color']?.toString() ?? '#10b981',
      distanceKm: (json['distanceKm'] as num?)?.toDouble() ?? 0,
      durationSeconds: (json['durationSeconds'] as num?)?.toInt() ?? 0,
      startedAt: (json['startedAt'] as num?)?.toInt() ?? 0,
      endedAt: (json['endedAt'] as num?)?.toInt() ?? 0,
      points: rawPts
          .whereType<Map<String, dynamic>>()
          .map(GpsTrackPoint.fromJson)
          .toList(),
      synced: json['synced'] == true,
    );
  }

  Map<String, dynamic> toJson() => {
        'clientId': clientId,
        'ownerKey': ownerKey,
        'title': title,
        'color': color,
        'distanceKm': distanceKm,
        'durationSeconds': durationSeconds,
        'startedAt': startedAt,
        'endedAt': endedAt,
        'points': points.map((p) => p.toJson()).toList(),
        'synced': synced,
      };

  /// Payload format matching `POST /api/v1/footprints/sync` on Express backend.
  Map<String, dynamic> toSyncPayload() => {
        'clientId': clientId,
        'title': title,
        'color': color,
        'distanceKm': distanceKm,
        'durationSeconds': durationSeconds,
        'startedAt': startedAt,
        'endedAt': endedAt,
        'points': points.map((p) => p.toJson()).toList(),
        'memories': const <Map<String, dynamic>>[],
        'isDemoRoute': false,
      };
}

class SyncFootprintsResult {
  final int syncedCount;
  final List<String> autoCheckedInNames;
  final int newBadgesCount;

  const SyncFootprintsResult({
    required this.syncedCount,
    this.autoCheckedInNames = const [],
    this.newBadgesCount = 0,
  });
}

/// Native Background GPS Tracker for Android (Foreground Service with persistent notification + WakeLock)
/// and iOS (CLLocationManager `allowBackgroundLocationUpdates = true`).
///
/// Keeps recording even when the phone screen is locked or user switches apps (e.g. Cần Thơ -> Sài Gòn),
/// persists every GPS point immediately to SharedPreferences, and syncs to `/api/v1/footprints/sync`.
class BackgroundGpsTracker extends ChangeNotifier {
  static const String _prefActiveSessionKey = 'dtst_mobile_active_gps_session_v1';
  static const String _prefPendingTracksKey = 'dtst_mobile_pending_tracks_v1';
  static const int _maxStoredPoints = 1800;

  final ApiClient _api;
  final VoidCallback? onPassportUpdated;

  StreamSubscription<Position>? _positionSub;
  Timer? _elapsedTimer;

  bool _initialized = false;
  bool _isRecording = false;
  bool _isSyncing = false;
  String? _activeClientId;
  String _activeOwnerKey = 'guest';
  String _activeTitle = 'Hành trình của tôi';
  int? _startedAtMs;
  int _elapsedSeconds = 0;
  final List<GpsTrackPoint> _activePoints = [];
  final List<BackgroundFootprintTrack> _pendingTracks = [];
  LocationPermission? _permission;
  String? _statusMessage;
  String? _errorMessage;

  /// Optional test hook to inject a synthetic position stream without platform channels.
  @visibleForTesting
  Stream<Position> Function(LocationSettings settings)? positionStreamBuilder;

  @visibleForTesting
  Future<LocationPermission> Function()? permissionRequester;

  @visibleForTesting
  Future<bool> Function()? serviceEnabledChecker;

  BackgroundGpsTracker({
    ApiClient? api,
    this.onPassportUpdated,
  }) : _api = api ?? ApiClient.instance;

  bool get isRecording => _isRecording;
  bool get isSyncing => _isSyncing;
  String get activeTitle => _activeTitle;
  int get elapsedSeconds => _elapsedSeconds;
  int get pointCount => _activePoints.length;
  double get liveDistanceKm => computePolylineKm(_activePoints);
  List<GpsTrackPoint> get activePoints => List.unmodifiable(_activePoints);
  List<BackgroundFootprintTrack> get pendingTracks => List.unmodifiable(_pendingTracks);
  int get pendingSyncCount => _pendingTracks.length;
  LocationPermission? get permission => _permission;
  bool get hasAlwaysPermission => _permission == LocationPermission.always;
  String? get statusMessage => _statusMessage;
  String? get errorMessage => _errorMessage;

  String get formattedElapsed {
    final hrs = _elapsedSeconds ~/ 3600;
    final mins = (_elapsedSeconds % 3600) ~/ 60;
    final secs = _elapsedSeconds % 60;
    if (hrs > 0) {
      return '${hrs}h ${mins.toString().padLeft(2, '0')}p ${secs.toString().padLeft(2, '0')}s';
    }
    return '${mins}p ${secs.toString().padLeft(2, '0')}s';
  }

  static double haversineKm(double lat1, double lng1, double lat2, double lng2) {
    const earthKm = 6371.0;
    double toRad(double d) => d * math.pi / 180.0;
    final dLat = toRad(lat2 - lat1);
    final dLng = toRad(lng2 - lng1);
    final a = math.sin(dLat / 2) * math.sin(dLat / 2) +
        math.cos(toRad(lat1)) * math.cos(toRad(lat2)) * math.sin(dLng / 2) * math.sin(dLng / 2);
    return 2 * earthKm * math.asin(math.sqrt(a.clamp(0.0, 1.0)));
  }

  static double computePolylineKm(List<GpsTrackPoint> pts) {
    if (pts.length < 2) return 0;
    double sum = 0;
    for (int i = 1; i < pts.length; i++) {
      sum += haversineKm(pts[i - 1].lat, pts[i - 1].lng, pts[i].lat, pts[i].lng);
    }
    return double.parse(sum.toStringAsFixed(2));
  }

  /// Platform-tuned LocationSettings:
  /// - Android: Foreground Service with persistent ongoing notification + WakeLock so OS never pauses GPS when screen locks.
  /// - iOS: CLLocationManager with `allowBackgroundLocationUpdates = true` & blue status bar indicator.
  static LocationSettings buildBackgroundLocationSettings() {
    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
      return AndroidSettings(
        accuracy: LocationAccuracy.bestForNavigation,
        distanceFilter: 15,
        intervalDuration: const Duration(seconds: 5),
        foregroundNotificationConfig: const ForegroundNotificationConfig(
          notificationTitle: 'Đồng Tháp Go · Đang ghi dấu chân',
          notificationText: 'GPS đang chạy ngầm lưu hành trình ngay cả khi tắt màn hình',
          notificationChannelName: 'Ghi hành trình GPS chạy ngầm',
          notificationIcon: AndroidResource(name: 'ic_launcher', defType: 'mipmap'),
          enableWakeLock: true,
          setOngoing: true,
          color: Color(0xFF176B50),
        ),
      );
    }
    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.iOS) {
      return AppleSettings(
        accuracy: LocationAccuracy.bestForNavigation,
        activityType: ActivityType.otherNavigation,
        distanceFilter: 15,
        pauseLocationUpdatesAutomatically: false,
        showBackgroundLocationIndicator: true,
        allowBackgroundLocationUpdates: true,
      );
    }
    return const LocationSettings(
      accuracy: LocationAccuracy.high,
      distanceFilter: 15,
    );
  }

  Future<void> init() async {
    if (_initialized) return;
    _initialized = true;
    final prefs = await SharedPreferences.getInstance();

    // 1. Restore unsynced offline tracks queue
    final rawPending = prefs.getString(_prefPendingTracksKey);
    if (rawPending != null && rawPending.isNotEmpty) {
      try {
        final decoded = jsonDecode(rawPending) as List;
        _pendingTracks
          ..clear()
          ..addAll(
            decoded
                .whereType<Map<String, dynamic>>()
                .map(BackgroundFootprintTrack.fromJson),
          );
      } catch (_) {}
    }

    // 2. Restore interrupted active recording session (crash / OS kill recovery)
    final rawActive = prefs.getString(_prefActiveSessionKey);
    if (rawActive != null && rawActive.isNotEmpty) {
      try {
        final decoded = jsonDecode(rawActive) as Map<String, dynamic>;
        final pts = ((decoded['points'] as List?) ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(GpsTrackPoint.fromJson)
            .toList();
        _activeClientId = decoded['clientId']?.toString();
        _activeOwnerKey = decoded['ownerKey']?.toString() ?? 'guest';
        _activeTitle = decoded['title']?.toString() ?? 'Hành trình đang ghi';
        _startedAtMs = (decoded['startedAt'] as num?)?.toInt() ?? DateTime.now().millisecondsSinceEpoch;
        _activePoints
          ..clear()
          ..addAll(pts);
        _elapsedSeconds = math.max(
          0,
          (DateTime.now().millisecondsSinceEpoch - _startedAtMs!) ~/ 1000,
        );
        _isRecording = true;
        _statusMessage = 'Đã khôi phục phiên ghi GPS trước đó (${_activePoints.length} điểm)';
        // Re-attach native foreground stream cleanly
        _attachLocationStream();
        _startElapsedTicker();
      } catch (_) {
        await prefs.remove(_prefActiveSessionKey);
      }
    }

    notifyListeners();
  }

  Future<bool> startRecording({
    required String ownerKey,
    String? title,
  }) async {
    await init();
    _errorMessage = null;
    _statusMessage = null;

    // 1. Verify GPS hardware is enabled
    final serviceEnabled = serviceEnabledChecker != null
        ? await serviceEnabledChecker!()
        : await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      _errorMessage = 'Vui lòng bật Vị trí (GPS) trên điện thoại để bắt đầu ghi dấu chân.';
      notifyListeners();
      return false;
    }

    // 2. Request location permission (guide to Always for best background reliability)
    LocationPermission perm;
    if (permissionRequester != null) {
      perm = await permissionRequester!();
    } else {
      perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }
    }
    _permission = perm;

    if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) {
      _errorMessage = perm == LocationPermission.deniedForever
          ? 'Quyền Vị trí đang bị chặn vĩnh viễn. Vui lòng mở Cài đặt ứng dụng → Quyền → Vị trí → Luôn cho phép.'
          : 'Bạn chưa cấp quyền truy cập Vị trí GPS cho ứng dụng.';
      notifyListeners();
      return false;
    }

    final now = DateTime.now();
    final formattedDate =
        '${now.day.toString().padLeft(2, '0')}/${now.month.toString().padLeft(2, '0')}/${now.year}';
    _activeClientId = 'mobile-track-${now.millisecondsSinceEpoch}-${math.Random().nextInt(99999)}';
    _activeOwnerKey = ownerKey;
    _activeTitle = (title != null && title.trim().isNotEmpty)
        ? title.trim()
        : 'Hành trình ngày $formattedDate';
    _startedAtMs = now.millisecondsSinceEpoch;
    _elapsedSeconds = 0;
    _activePoints.clear();
    _isRecording = true;
    _statusMessage = perm == LocationPermission.always
        ? 'Đang chạy ngầm (Foreground Service) — khóa màn hình vẫn ghi liên tục!'
        : 'Đang ghi GPS (Foreground Service). Mẹo: chọn "Luôn cho phép" trong Cài đặt để chạy ngầm bền nhất.';

    await _saveActiveSession();
    _attachLocationStream();
    _startElapsedTicker();
    notifyListeners();
    return true;
  }

  void _startElapsedTicker() {
    _elapsedTimer?.cancel();
    _elapsedTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!_isRecording || _startedAtMs == null) return;
      _elapsedSeconds = math.max(
        0,
        (DateTime.now().millisecondsSinceEpoch - _startedAtMs!) ~/ 1000,
      );
      notifyListeners();
    });
  }

  void _attachLocationStream() {
    _positionSub?.cancel();
    final settings = buildBackgroundLocationSettings();
    final stream = positionStreamBuilder != null
        ? positionStreamBuilder!(settings)
        : Geolocator.getPositionStream(locationSettings: settings);

    _positionSub = stream.listen(
      (Position pos) {
        _ingestPosition(pos);
      },
      onError: (Object err) {
        _errorMessage = 'Tín hiệu GPS tạm yếu ($err) — đang tự động kết nối lại...';
        notifyListeners();
      },
      cancelOnError: false,
    );
  }

  void _ingestPosition(Position pos) {
    if (!_isRecording) return;

    // Filter out noisy cell-tower spikes (>200m accuracy) once we already have at least 1 valid GPS fix
    if (_activePoints.isNotEmpty && pos.accuracy > 200) {
      return;
    }

    final ts = pos.timestamp.millisecondsSinceEpoch;
    final nextPt = GpsTrackPoint(
      lat: double.parse(pos.latitude.toStringAsFixed(6)),
      lng: double.parse(pos.longitude.toStringAsFixed(6)),
      timestamp: ts > 0 ? ts : DateTime.now().millisecondsSinceEpoch,
      speedKmh: pos.speed >= 0 ? double.parse((pos.speed * 3.6).toStringAsFixed(1)) : null,
    );

    if (_activePoints.isNotEmpty) {
      final last = _activePoints.last;
      final distKm = haversineKm(last.lat, last.lng, nextPt.lat, nextPt.lng);
      final elapsedMs = nextPt.timestamp - last.timestamp;
      if (distKm < 0.003) return;
      if (distKm < 0.012 && elapsedMs < 45000) return;
    }

    _activePoints.add(nextPt);
    _compactPointsIfNeeded();
    _errorMessage = null;
    unawaited(_saveActiveSession());
    notifyListeners();
  }

  void _compactPointsIfNeeded() {
    if (_activePoints.length <= _maxStoredPoints) return;
    final head = _activePoints.first;
    final tail = _activePoints.sublist(_activePoints.length - 300);
    final middle = _activePoints.sublist(1, _activePoints.length - 300);
    final thinned = <GpsTrackPoint>[head];
    for (int i = 0; i < middle.length; i += 2) {
      thinned.add(middle[i]);
    }
    thinned.addAll(tail);
    _activePoints
      ..clear()
      ..addAll(thinned);
  }

  Future<SyncFootprintsResult?> stopAndSave() async {
    if (!_isRecording) return null;

    await _positionSub?.cancel();
    _positionSub = null;
    _elapsedTimer?.cancel();
    _elapsedTimer = null;
    _isRecording = false;

    final nowMs = DateTime.now().millisecondsSinceEpoch;
    final startedAt = _startedAtMs ?? nowMs;
    final capturedPoints = List<GpsTrackPoint>.from(_activePoints);
    final clientId = _activeClientId ?? 'mobile-track-$nowMs';
    final ownerKey = _activeOwnerKey;
    final title = _activeTitle;

    _activePoints.clear();
    _activeClientId = null;
    _startedAtMs = null;
    _elapsedSeconds = 0;
    await _clearActiveSession();

    if (capturedPoints.isEmpty) {
      _statusMessage = 'Chưa ghi nhận tọa độ GPS nào trong phiên vừa rồi.';
      notifyListeners();
      return const SyncFootprintsResult(syncedCount: 0);
    }

    final track = BackgroundFootprintTrack(
      clientId: clientId,
      ownerKey: ownerKey,
      title: title,
      distanceKm: computePolylineKm(capturedPoints),
      durationSeconds: math.max(1, (nowMs - startedAt) ~/ 1000),
      startedAt: startedAt,
      endedAt: nowMs,
      points: capturedPoints,
      synced: false,
    );

    _pendingTracks.insert(0, track);
    await _savePendingTracks();
    _statusMessage = 'Đã lưu hành trình ${track.distanceKm} km (${capturedPoints.length} điểm). Đang đồng bộ Cloud...';
    notifyListeners();

    return syncPendingTracks();
  }

  Future<SyncFootprintsResult> syncPendingTracks() async {
    if (_isSyncing || _pendingTracks.isEmpty) {
      return const SyncFootprintsResult(syncedCount: 0);
    }
    _isSyncing = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final batch = List<BackgroundFootprintTrack>.from(_pendingTracks);
      final res = await _api.syncFootprintTracks(
        batch.map((t) => t.toSyncPayload()).toList(),
        autoCheckIn: true,
      );
      final syncedIds = batch.map((t) => t.clientId).toSet();
      _pendingTracks.removeWhere((t) => syncedIds.contains(t.clientId));
      await _savePendingTracks();

      final checkInNames = res.autoCheckedInNames;
      if (checkInNames.isNotEmpty) {
        _statusMessage =
            'Đã đồng bộ ${res.syncedCount} hành trình & tự động đóng dấu tại: ${checkInNames.join(', ')}!';
        onPassportUpdated?.call();
      } else {
        _statusMessage = 'Đã đồng bộ thành công ${res.syncedCount} hành trình lên Cloud!';
      }
      return res;
    } catch (_) {
      _statusMessage =
          'Chưa có mạng — đã lưu an toàn ${_pendingTracks.length} hành trình offline trên máy, sẽ tự đồng bộ khi có mạng.';
      return const SyncFootprintsResult(syncedCount: 0);
    } finally {
      _isSyncing = false;
      notifyListeners();
    }
  }

  Future<void> openAppLocationSettings() async {
    await Geolocator.openAppSettings();
  }

  Future<void> _saveActiveSession() async {
    final prefs = await SharedPreferences.getInstance();
    if (!_isRecording || _activeClientId == null) {
      await prefs.remove(_prefActiveSessionKey);
      return;
    }
    await prefs.setString(
      _prefActiveSessionKey,
      jsonEncode({
        'clientId': _activeClientId,
        'ownerKey': _activeOwnerKey,
        'title': _activeTitle,
        'startedAt': _startedAtMs,
        'points': _activePoints.map((p) => p.toJson()).toList(),
      }),
    );
  }

  Future<void> _clearActiveSession() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_prefActiveSessionKey);
  }

  Future<void> _savePendingTracks() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _prefPendingTracksKey,
      jsonEncode(_pendingTracks.take(30).map((t) => t.toJson()).toList()),
    );
  }

  @override
  void dispose() {
    _positionSub?.cancel();
    _elapsedTimer?.cancel();
    super.dispose();
  }
}
