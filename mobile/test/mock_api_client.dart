import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

MockClient createDtstMockClient() {
  return MockClient((http.Request request) async {
    final path = request.url.path;

    // CSRF token
    if (path.endsWith('/csrf')) {
      return http.Response(
        jsonEncode({'csrfToken': 'mock-csrf-token'}),
        200,
        headers: {'content-type': 'application/json'},
      );
    }

    // Auth status
    if (path.endsWith('/auth/me')) {
      return http.Response(
        jsonEncode({'success': false, 'message': 'Chưa đăng nhập'}),
        401,
        headers: {'content-type': 'application/json'},
      );
    }

    // Health
    if (path.endsWith('/health')) {
      return http.Response(
        jsonEncode({'status': 'ok'}),
        200,
        headers: {'content-type': 'application/json'},
      );
    }

    // Banners
    if (path.contains('/banners')) {
      return http.Response(
        jsonEncode({
          'success': true,
          'data': [
            {
              'id': 'b1',
              '_id': 'b1',
              'kind': 'cover',
              'theme': 'lotus',
              'title': 'Khám phá Sen Tháp Mười',
              'subtitle': 'Hành trình trải nghiệm rực rỡ',
              'linkUrl': '/destinations',
              'linkLabel': 'Khám phá ngay',
              'displayOrder': 1,
              'isActive': true,
            }
          ]
        }),
        200,
        headers: {'content-type': 'application/json'},
      );
    }

    // Destinations recommendations
    if (path.contains('/destinations/recommendations')) {
      return http.Response(
        jsonEncode({'success': true, 'data': []}),
        200,
        headers: {'content-type': 'application/json'},
      );
    }

    // Destinations list
    if (path.endsWith('/destinations')) {
      return http.Response(
        jsonEncode({
          'success': true,
          'data': [
            {
              'id': 'd1',
              '_id': 'd1',
              'name': 'Vườn quốc gia Tràm Chim',
              'slug': 'vuon-quoc-gia-tram-chim',
              'summary': 'Khu ramsar thứ 2000 của thế giới',
              'category': 'nature',
              'area': 'tam-nong',
              'address': 'Khóm 4, Thị trấn Tràm Chim, Huyện Tam Nông',
              'images': <String>[],
              'isActive': true,
              'isFeatured': true,
              'pricing': {'isFree': false, 'adult': 20000},
              'verification': {'isVerified': true, 'level': 'partner'},
              'qrStation': {'enabled': true, 'stationCode': 'TRAMCHIM-01'},
            },
            {
              'id': 'd2',
              '_id': 'd2',
              'name': 'Khu di tích Gò Tháp',
              'slug': 'khu-di-tich-go-thap',
              'summary': 'Di tích khảo cổ văn hóa Óc Eo',
              'category': 'culture',
              'area': 'thap-muoi',
              'address': 'Tân Kiều, Tháp Mười',
              'images': <String>[],
              'isActive': true,
              'isFeatured': true,
              'pricing': {'isFree': true},
              'verification': {'isVerified': true, 'level': 'official'},
              'qrStation': {'enabled': true, 'stationCode': 'GOTHAP-01'},
            }
          ],
          'total': 2,
        }),
        200,
        headers: {'content-type': 'application/json'},
      );
    }

    // Passport summary
    if (path.contains('/passport/summary')) {
      return http.Response(
        jsonEncode({
          'success': true,
          'data': {
            'totalCheckins': 4,
            'completedChallenges': 3,
            'unlockedBadges': 2,
            'totalScore': 150,
          }
        }),
        200,
        headers: {'content-type': 'application/json'},
      );
    }

    // Full Passport
    if (path.endsWith('/passport')) {
      return http.Response(
        jsonEncode({
          'success': true,
          'data': {
            'passportCode': 'DTST-TEST-888',
            'totalScore': 150,
            'badges': [],
            'recentCheckins': [],
            'history': [],
          }
        }),
        200,
        headers: {'content-type': 'application/json'},
      );
    }

    // Available badges
    if (path.contains('/badges')) {
      return http.Response(
        jsonEncode({'success': true, 'data': []}),
        200,
        headers: {'content-type': 'application/json'},
      );
    }

    // Favorites
    if (path.contains('/favorites')) {
      return http.Response(
        jsonEncode({'success': true, 'data': []}),
        200,
        headers: {'content-type': 'application/json'},
      );
    }

    // Saved Itineraries
    if (path.endsWith('/itineraries')) {
      return http.Response(
        jsonEncode({'success': true, 'data': []}),
        200,
        headers: {'content-type': 'application/json'},
      );
    }

    // QR landing info
    if (path.contains('/qr/')) {
      return http.Response(
        jsonEncode({
          'success': true,
          'data': {
            'code': 'TRAMCHIM-01',
            'stationName': 'Trạm Cổng Vườn Quốc Gia',
            'destination': {
              'id': 'd1',
              '_id': 'd1',
              'name': 'Vườn quốc gia Tràm Chim',
              'slug': 'vuon-quoc-gia-tram-chim',
            },
            'gpsCoords': {'lat': 10.7025, 'lng': 105.5186},
            'radiusMeters': 300,
            'challenges': [],
          }
        }),
        200,
        headers: {'content-type': 'application/json'},
      );
    }

    // Default 200 empty JSON
    return http.Response(
      jsonEncode({'success': true, 'data': {}}),
      200,
      headers: {'content-type': 'application/json'},
    );
  });
}
