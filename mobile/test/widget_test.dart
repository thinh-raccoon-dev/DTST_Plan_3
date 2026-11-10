import 'package:flutter_test/flutter_test.dart';
import 'package:dtst_mobile/main.dart';

void main() {
  testWidgets('DTST Mobile v1.0 renders main shell and 5 core navigation tabs', (WidgetTester tester) async {
    await tester.pumpWidget(const DtstMobileApp());

    expect(find.text('Du lịch số Đồng Tháp'), findsOneWidget);
    expect(find.text('Trang chủ'), findsOneWidget);
    expect(find.text('Khám phá'), findsOneWidget);
    expect(find.text('Quét QR'), findsOneWidget);
    expect(find.text('Lịch trình AI'), findsOneWidget);
    expect(find.text('Hộ chiếu'), findsOneWidget);
  });
}
