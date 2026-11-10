import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:dtst_mobile/main.dart';
import 'package:dtst_mobile/services/api_client.dart';
import 'mock_api_client.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    ApiClient.instance.httpClient = createDtstMockClient();
    await ApiClient.instance.setCustomBaseUrl(null);
  });

  testWidgets('Screens Flow Test: 5 navigation tabs can be switched seamlessly', (WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 2200);
    tester.view.devicePixelRatio = 2.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await tester.pumpWidget(const DtstMobileApp());
    await tester.pumpAndSettle();

    // Default tab is Trang chủ (index 0)
    expect(find.text('Du lịch số Đồng Tháp'), findsWidgets);
    expect(find.text('Trang chủ'), findsWidgets);

    // Switch to Tab 1: Khám phá
    await tester.tap(find.byType(NavigationDestination).at(1));
    await tester.pumpAndSettle();
    expect(find.text('Khám phá địa điểm'), findsOneWidget);

    // Switch to Tab 2: Quét QR
    await tester.tap(find.byType(NavigationDestination).at(2));
    await tester.pumpAndSettle();
    expect(find.text('Quét mã QR tại điểm đến'), findsOneWidget);

    // Switch to Tab 3: Lịch trình AI
    await tester.tap(find.byType(NavigationDestination).at(3));
    await tester.pumpAndSettle();
    expect(find.text('🤖 Lập lịch AI V9'), findsOneWidget);
    expect(find.textContaining('Đã lưu'), findsOneWidget);

    // Switch to Tab 4: Hộ chiếu
    await tester.tap(find.byType(NavigationDestination).at(4));
    await tester.pumpAndSettle();
    expect(find.textContaining('HỘ CHIẾU TRẢI NGHIỆM SỐ'), findsOneWidget);

    // Switch back to Tab 0: Trang chủ
    await tester.tap(find.byType(NavigationDestination).at(0));
    await tester.pumpAndSettle();
    expect(find.text('Du lịch số Đồng Tháp'), findsWidgets);
  });

  testWidgets('Screens Flow Test: Server config dialog opens and displays presets', (WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 2200);
    tester.view.devicePixelRatio = 2.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await tester.pumpWidget(const DtstMobileApp());
    await tester.pumpAndSettle();

    // Find the server icon in AppBar (dns_outlined)
    final dnsIcon = find.byIcon(Icons.dns_outlined);
    expect(dnsIcon, findsOneWidget);

    await tester.tap(dnsIcon);
    await tester.pumpAndSettle();

    // Verify dialog content
    expect(find.text('Cấu hình Máy chủ API'), findsOneWidget);
    expect(find.text('Android Emulator (10.0.2.2)'), findsOneWidget);
    expect(find.text('Localhost (127.0.0.1)'), findsOneWidget);

    // Close dialog
    await tester.tap(find.text('Đóng'));
    await tester.pumpAndSettle();
    expect(find.text('Cấu hình Máy chủ API'), findsNothing);
  });

  testWidgets('Screens Flow Test: Favorites button in AppBar pushes AuthProfileScreen when logged out', (WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 2200);
    tester.view.devicePixelRatio = 2.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await tester.pumpWidget(const DtstMobileApp());
    await tester.pumpAndSettle();

    // Find favorite button (favorite_border_rounded)
    final favIcon = find.byIcon(Icons.favorite_border_rounded);
    expect(favIcon, findsOneWidget);

    await tester.tap(favIcon);
    await tester.pumpAndSettle();

    // Since logged out, shows login view with demo account chips
    expect(find.text('Đăng nhập'), findsWidgets);
    expect(find.text('Du khách (dukhach@dongthap.vn)'), findsOneWidget);

    // Close / Pop back
    final backBtn = find.byTooltip('Back');
    if (backBtn.evaluate().isNotEmpty) {
      await tester.tap(backBtn);
    } else {
      await tester.tap(find.byType(BackButton));
    }
    await tester.pumpAndSettle();
    expect(find.text('Đăng nhập'), findsNothing);
  });

  testWidgets('Screens Flow Test: Auth Profile screen autofills demo credentials', (WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 2200);
    tester.view.devicePixelRatio = 2.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await tester.pumpWidget(const DtstMobileApp());
    await tester.pumpAndSettle();

    // Tap account pill in AppBar
    final accountText = find.text('Tài khoản');
    expect(accountText, findsOneWidget);

    await tester.tap(accountText);
    await tester.pumpAndSettle();

    // Verify Auth screen
    expect(find.text('Đăng nhập'), findsWidgets);
    expect(find.text('Du khách (dukhach@dongthap.vn)'), findsOneWidget);
    expect(find.text('Quản trị viên (admin@example.com)'), findsOneWidget);

    // Tap the tourist demo chip
    await tester.tap(find.text('Du khách (dukhach@dongthap.vn)'));
    await tester.pumpAndSettle();

    // Verify email and password text fields are populated
    expect(find.text('dukhach@dongthap.vn'), findsOneWidget);
    expect(find.text('DongThap123!'), findsOneWidget);

    // Tap the admin demo chip
    await tester.tap(find.text('Quản trị viên (admin@example.com)'));
    await tester.pumpAndSettle();

    // Verify updated credentials
    expect(find.text('admin@example.com'), findsOneWidget);
    expect(find.text('Dt-FbhNoHLx8l90'), findsOneWidget);

    // Pop back to home
    final backBtn = find.byTooltip('Back');
    if (backBtn.evaluate().isNotEmpty) {
      await tester.tap(backBtn);
    } else {
      await tester.tap(find.byType(BackButton));
    }
    await tester.pumpAndSettle();
    expect(find.text('Đăng nhập'), findsNothing);
  });

  testWidgets('Screens Flow Test: QR scanner pilot stations and manual code entry work', (WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 2200);
    tester.view.devicePixelRatio = 2.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await tester.pumpWidget(const DtstMobileApp());
    await tester.pumpAndSettle();

    // Switch to QR tab
    await tester.tap(find.byType(NavigationDestination).at(2));
    await tester.pumpAndSettle();

    // Verify header and pilot QR chips
    expect(find.text('Quét mã QR tại điểm đến'), findsOneWidget);
    expect(find.textContaining('TRAMCHIM-01'), findsWidgets);
    expect(find.textContaining('GOTHAP-01'), findsWidgets);
    expect(find.textContaining('HTL-01'), findsWidgets);
    expect(find.textContaining('SADEC-HOA'), findsWidgets);

    // Verify manual entry card
    expect(find.text('Nhập mã định danh QR thủ công'), findsOneWidget);
    expect(find.text('Mở mã'), findsOneWidget);

    // Enter custom test QR code
    final textInput = find.byType(TextField);
    expect(textInput, findsWidgets);
    await tester.enterText(textInput.first, 'TRAMCHIM-01');
    await tester.pumpAndSettle();
    expect(find.text('TRAMCHIM-01'), findsWidgets);
  });

  testWidgets('Screens Flow Test: AI Trip planner subtabs toggle and default values render', (WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 2200);
    tester.view.devicePixelRatio = 2.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await tester.pumpWidget(const DtstMobileApp());
    await tester.pumpAndSettle();

    // Switch to AI Trip planner
    await tester.tap(find.byType(NavigationDestination).at(3));
    await tester.pumpAndSettle();

    // Verify initial values
    expect(find.text('TP. Cao Lãnh, Đồng Tháp'), findsOneWidget);
    expect(find.text('🛵 Xe máy'), findsOneWidget);
    expect(find.text('⚖️ Cân bằng'), findsOneWidget);

    // Switch subtab to 'Lịch trình đã lưu'
    await tester.tap(find.textContaining('Đã lưu'));
    await tester.pumpAndSettle();

    // Should display login prompt for saved itineraries when guest
    expect(find.textContaining('Đăng nhập để quản lý Lịch trình đã lưu'), findsOneWidget);

    // Switch back to '🤖 Lập lịch AI V9'
    await tester.tap(find.text('🤖 Lập lịch AI V9'));
    await tester.pumpAndSettle();
    expect(find.text('✨ Trip Planner V9 + Valhalla Routing'), findsOneWidget);
  });
}
