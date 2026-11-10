import 'package:dtst_mobile/models/api_models.dart';
import 'package:dtst_mobile/theme/app_theme.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('AppFormatters Tests', () {
    test('formatVnd formats Vietnamese currency correctly', () {
      expect(AppFormatters.formatVnd(2500000), contains('2.500.000'));
      expect(AppFormatters.formatVnd(0), contains('0'));
      expect(AppFormatters.formatVnd(null), equals('Chưa có giá'));
    });

    test('formatVndShort abbreviates millions and thousands', () {
      expect(AppFormatters.formatVndShort(2500000), equals('2,5 tr'));
      expect(AppFormatters.formatVndShort(2000000), equals('2 tr'));
      expect(AppFormatters.formatVndShort(50000), equals('50k'));
      expect(AppFormatters.formatVndShort(null), equals('—'));
    });

    test('formatMinutes formats hours and minutes correctly', () {
      expect(AppFormatters.formatMinutes(90), equals('1 giờ 30 phút'));
      expect(AppFormatters.formatMinutes(60), equals('1 giờ'));
      expect(AppFormatters.formatMinutes(45), equals('45 phút'));
      expect(AppFormatters.formatMinutes(null), equals('—'));
    });

    test('formatDateVi parses ISO yyyy-mm-dd to dd/mm/yyyy', () {
      expect(AppFormatters.formatDateVi('2026-11-08'), equals('08/11/2026'));
      expect(AppFormatters.formatDateVi(null), equals(''));
      expect(AppFormatters.formatDateVi(''), equals(''));
    });

    test('extractQrCode parses direct code and web URLs correctly', () {
      expect(AppFormatters.extractQrCode('TRAMCHIM-01'), equals('TRAMCHIM-01'));
      expect(AppFormatters.extractQrCode('  htl-01  '), equals('HTL-01'));
      expect(
        AppFormatters.extractQrCode('http://localhost:5173/qr/GOTHAP-01'),
        equals('GOTHAP-01'),
      );
      expect(
        AppFormatters.extractQrCode('https://dongthap.vn/qr/SADEC-HOA'),
        equals('SADEC-HOA'),
      );
      expect(AppFormatters.extractQrCode(''), isNull);
      expect(AppFormatters.extractQrCode('invalid url with no code'), isNull);
    });
  });

  group('AppCatalog Tests', () {
    test('Category and Area lookups return proper labels', () {
      expect(AppCatalog.categoryLabel('nature'), equals('Thiên nhiên'));
      expect(AppCatalog.categoryLabel('eco'), equals('Sinh thái'));
      expect(AppCatalog.categoryLabel('unknown'), equals('Khác'));

      expect(AppCatalog.areaLabel('cao-lanh'), equals('Cao Lãnh'));
      expect(AppCatalog.areaLabel('sa-dec'), equals('Sa Đéc'));
      expect(AppCatalog.areaLabel('tam-nong'), equals('Tam Nông'));
      expect(AppCatalog.areaLabel('custom-area'), equals('custom-area'));
    });

    test('Role meta returns expected styling and badges', () {
      final rest = AppCatalog.roleMeta('restaurant');
      expect(rest.shortLabel, equals('Ăn uống'));
      final hotel = AppCatalog.roleMeta('accommodation');
      expect(hotel.shortLabel, equals('Lưu trú'));
      final attr = AppCatalog.roleMeta('attraction');
      expect(attr.shortLabel, equals('Tham quan'));
    });
  });

  group('API Models Serialization Tests', () {
    test('DestinationSummary and Detail fromJson', () {
      final summaryJson = {
        'id': 'dest_01',
        'slug': 'tram-chim',
        'name': 'Vườn quốc gia Tràm Chim',
        'summary': 'Khu ramsar thứ 2000 thế giới',
        'category': 'nature',
        'area': 'tam-nong',
        'tags': ['chim', 'sen', 'du-thuyen'],
        'verificationStatus': 'verified',
        'operationalStatus': 'active',
        'hasChallenge': true,
      };
      final summary = DestinationSummary.fromJson(summaryJson);
      expect(summary.id, equals('dest_01'));
      expect(summary.slug, equals('tram-chim'));
      expect(summary.hasChallenge, isTrue);

      final detailJson = {
        ...summaryJson,
        'description': 'Mô tả chi tiết Tràm Chim...',
        'address': 'Khóm 4, TT. Tràm Chim, H. Tam Nông',
        'coordinates': {'lat': 10.706, 'lng': 105.534},
      };
      final detail = DestinationDetail.fromJson(detailJson);
      expect(detail.description, contains('Tràm Chim'));
      expect(detail.lat, equals(10.706));
      expect(detail.lng, equals(105.534));
    });

    test('Passport and Badges fromJson', () {
      final passportJson = {
        'mode': 'account',
        'totals': {
          'points': 150,
          'exploredDestinations': 4,
          'checkIns': 3,
          'completedChallenges': 2,
          'badges': 2,
        },
        'progress': {'explored': 4, 'total': 12},
        'badges': [
          {
            'key': 'first_footprint',
            'name': 'Dấu Chân Đầu Tiên',
            'description': 'Hoàn thành check-in QR đầu tiên',
            'icon': 'footprints',
            'rewardPoints': 10,
            'earned': true,
            'awardedAt': '2026-11-08T10:00:00.000Z',
          }
        ],
        'checkIns': [],
        'completions': [],
        'qrOpened': [],
        'pendingDeviceEntries': 0,
      };
      final passport = Passport.fromJson(passportJson);
      expect(passport.mode, equals('account'));
      expect(passport.points, equals(150));
      expect(passport.progressExplored, equals(4));
      expect(passport.badges.length, equals(1));
      expect(passport.badges.first.earned, isTrue);
    });

    test('V9ItineraryObject and Days fromJson', () {
      final v9Json = {
        'status': 'ok',
        'algorithm': 'v9',
        'input': {'days': 2, 'people': 2, 'budget_vnd': 2500000},
        'days': [
          {
            'day': 1,
            'date': '2026-11-08',
            'status': 'ok',
            'visit_count': 2,
            'activities': [
              {
                'type': 'visit',
                'stop_id': 'stop_1_1',
                'status': 'pending',
                'name': 'Khu di tích Nguyễn Sinh Sắc',
                'start': '08:30',
                'end': '10:00',
                'duration_minutes': 90,
              }
            ],
          }
        ],
        'scheduled_primary_ids': ['place_1'],
        'cost_summary': {
          'known_subtotal_vnd': 800000,
          'road_distance_km': 15.2,
        },
      };
      final v9 = V9ItineraryObject.fromJson(v9Json);
      expect(v9.days.length, equals(1));
      expect(v9.days.first.activities.length, equals(1));
      expect(v9.days.first.activities.first.name, equals('Khu di tích Nguyễn Sinh Sắc'));
      expect(v9.roadDistanceKm, equals(15.2));
    });
  });
}
