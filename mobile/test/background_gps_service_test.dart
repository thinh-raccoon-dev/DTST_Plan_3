import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:dtst_mobile/services/api_client.dart';
import 'package:dtst_mobile/services/background_gps_service.dart';
import 'mock_api_client.dart';

Position _pos(double lat, double lng, int ms, {double accuracy = 10, double speed = 12}) {
  return Position(
    longitude: lng,
    latitude: lat,
    timestamp: DateTime.fromMillisecondsSinceEpoch(ms),
    accuracy: accuracy,
    altitude: 0,
    altitudeAccuracy: 0,
    heading: 0,
    headingAccuracy: 0,
    speed: speed,
    speedAccuracy: 1,
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    ApiClient.instance.httpClient = createDtstMockClient();
    await ApiClient.instance.setCustomBaseUrl(null);
  });

  test('BackgroundGpsTracker records Cần Thơ -> Sài Gòn trip, filters jitter, recovers after restart, and syncs to Cloud', () async {
    final controller = StreamController<Position>.broadcast();
    int passportUpdates = 0;

    final tracker = BackgroundGpsTracker(
      api: ApiClient.instance,
      onPassportUpdated: () => passportUpdates++,
    );
    tracker.serviceEnabledChecker = () async => true;
    tracker.permissionRequester = () async => LocationPermission.always;
    tracker.positionStreamBuilder = (_) => controller.stream;

    final started = await tracker.startRecording(
      ownerKey: 'user:test-1',
      title: 'Cần Thơ → Sài Gòn',
    );
    expect(started, isTrue);
    expect(tracker.isRecording, isTrue);
    expect(tracker.hasAlwaysPermission, isTrue);

    final t0 = 1700000000000;
    // 1. Start in Cần Thơ
    controller.add(_pos(10.0268, 105.7223, t0));
    await Future<void>.delayed(const Duration(milliseconds: 20));
    expect(tracker.pointCount, 1);

    // 2. Stationary jitter (~1m, 2s later) must be filtered out
    controller.add(_pos(10.026805, 105.722305, t0 + 2000));
    await Future<void>.delayed(const Duration(milliseconds: 20));
    expect(tracker.pointCount, 1);

    // 3. Noisy cell-tower spike (>200m accuracy) must be ignored
    controller.add(_pos(10.09, 105.80, t0 + 5000, accuracy: 450));
    await Future<void>.delayed(const Duration(milliseconds: 20));
    expect(tracker.pointCount, 1);

    // 4. Mỹ Thuận & TP. Hồ Chí Minh real GPS fixes
    controller.add(_pos(10.2681, 105.9062, t0 + 3600000));
    controller.add(_pos(10.7769, 106.7009, t0 + 10800000));
    await Future<void>.delayed(const Duration(milliseconds: 30));

    expect(tracker.pointCount, 3);
    expect(tracker.liveDistanceKm, greaterThan(120));

    // 5. Simulate OS process restart: a fresh tracker instance recovers the active session from SharedPreferences!
    final recovered = BackgroundGpsTracker(
      api: ApiClient.instance,
      onPassportUpdated: () => passportUpdates++,
    );
    recovered.positionStreamBuilder = (_) => controller.stream;
    await recovered.init();
    expect(recovered.isRecording, isTrue);
    expect(recovered.pointCount, 3);
    expect(recovered.activeTitle, 'Cần Thơ → Sài Gòn');

    // 6. Stop & Save -> syncs to POST /api/v1/footprints/sync, notifies passport auto-check-in, clears queue
    final syncResult = await recovered.stopAndSave();
    expect(syncResult?.syncedCount, 1);
    expect(syncResult?.autoCheckedInNames, contains('Khu di tích Nguyễn Sinh Sắc'));
    expect(passportUpdates, 1);
    expect(recovered.isRecording, isFalse);
    expect(recovered.pendingSyncCount, 0);

    await controller.close();
    tracker.dispose();
    recovered.dispose();
  });
}
