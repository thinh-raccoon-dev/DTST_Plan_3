import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';

/// Hệ màu & Design System đồng bộ với phiên bản Web Du lịch số Đồng Tháp.
class AppColors {
  // Forest / Soft Leaf (Primary)
  static const Color leaf50 = Color(0xFFF4F8EF);
  static const Color leaf100 = Color(0xFFDCEBD4);
  static const Color leaf200 = Color(0xFFC5DFB8);
  static const Color leaf300 = Color(0xFF8EBF83);
  static const Color leaf400 = Color(0xFF5FA97A);
  static const Color leaf500 = Color(0xFF2F8F66);
  static const Color leaf600 = Color(0xFF176B50);
  static const Color leaf700 = Color(0xFF125A43);
  static const Color leaf800 = Color(0xFF153F32);
  static const Color leaf900 = Color(0xFF0F2F25);

  // River / Ink (Text & Dark surfaces)
  static const Color river50 = Color(0xFFF4F8EF);
  static const Color river100 = Color(0xFFE3E8DC);
  static const Color river200 = Color(0xFFC9D2C0);
  static const Color river300 = Color(0xFFA3B0A0);
  static const Color river400 = Color(0xFF7A8A7E);
  static const Color river500 = Color(0xFF718176);
  static const Color river600 = Color(0xFF5B6B60);
  static const Color river700 = Color(0xFF34483D);
  static const Color river800 = Color(0xFF1F3D32);
  static const Color river900 = Color(0xFF153F32);
  static const Color river950 = Color(0xFF0F2F25);

  // Gold / Warm Teal accents (Rewards / QR / Badges)
  static const Color teal50 = Color(0xFFF3E7C9);
  static const Color teal100 = Color(0xFFEBE0B8);
  static const Color teal200 = Color(0xFFE0CF96);
  static const Color teal300 = Color(0xFFD4BB74);
  static const Color teal400 = Color(0xFFCCAD62);
  static const Color teal500 = Color(0xFFC4A15A);
  static const Color teal600 = Color(0xFFA8863F);
  static const Color teal700 = Color(0xFF8A6A2A);
  static const Color teal800 = Color(0xFF7A5A1E);

  // Lotus Pink (Sen hồng Đồng Tháp)
  static const Color lotus50 = Color(0xFFFBE8EC);
  static const Color lotus100 = Color(0xFFF7CBD5);
  static const Color lotus200 = Color(0xFFF3B5C3);
  static const Color lotus300 = Color(0xFFEFA4B5);
  static const Color lotus400 = Color(0xFFEFA4B5);
  static const Color lotus500 = Color(0xFFD97F98);
  static const Color lotus600 = Color(0xFFB2506B);
  static const Color lotus700 = Color(0xFF94455A);

  // Cream / Neutral Sand
  static const Color sand50 = Color(0xFFFAF8F0);
  static const Color sand100 = Color(0xFFF4F8EF);
  static const Color sand200 = Color(0xFFE3E8DC);
  static const Color sand300 = Color(0xFFC9D2C0);

  static const LinearGradient heroGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [leaf900, leaf800, leaf600],
  );

  static const LinearGradient darkForestGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [river950, leaf900, river900],
  );

  static const LinearGradient goldBadgeGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [teal400, teal600],
  );
}

class AppTheme {
  static ThemeData get lightTheme {
    final fontFamily = GoogleFonts.beVietnamPro().fontFamily;
    return ThemeData(
      useMaterial3: true,
      fontFamily: fontFamily,
      scaffoldBackgroundColor: AppColors.sand50,
      colorScheme: ColorScheme.fromSeed(
        seedColor: AppColors.leaf600,
        primary: AppColors.leaf600,
        onPrimary: Colors.white,
        secondary: AppColors.teal500,
        onSecondary: Colors.white,
        tertiary: AppColors.lotus600,
        surface: Colors.white,
        onSurface: AppColors.river800,
      ),
      textTheme: const TextTheme(
        headlineLarge: TextStyle(
          fontWeight: FontWeight.w800,
          color: AppColors.river900,
          letterSpacing: -0.5,
        ),
        headlineMedium: TextStyle(
          fontWeight: FontWeight.w800,
          color: AppColors.river900,
          letterSpacing: -0.4,
        ),
        titleLarge: TextStyle(
          fontWeight: FontWeight.w800,
          color: AppColors.river900,
        ),
        titleMedium: TextStyle(
          fontWeight: FontWeight.w700,
          color: AppColors.river900,
        ),
        bodyLarge: TextStyle(
          color: AppColors.river700,
          height: 1.45,
        ),
        bodyMedium: TextStyle(
          color: AppColors.river700,
          height: 1.45,
        ),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.white.withValues(alpha: 0.94),
        foregroundColor: AppColors.river900,
        elevation: 0,
        scrolledUnderElevation: 1,
        surfaceTintColor: Colors.transparent,
        centerTitle: false,
        titleTextStyle: GoogleFonts.beVietnamPro(
          fontSize: 18,
          fontWeight: FontWeight.w800,
          color: AppColors.river900,
        ),
      ),
      cardTheme: CardThemeData(
        color: Colors.white,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: const BorderSide(color: AppColors.sand200, width: 1),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        hintStyle: const TextStyle(color: AppColors.river400, fontSize: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: AppColors.sand300),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: AppColors.sand200),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: AppColors.leaf600, width: 1.8),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: Colors.redAccent),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.leaf600,
          foregroundColor: Colors.white,
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          textStyle: GoogleFonts.beVietnamPro(
            fontWeight: FontWeight.w700,
            fontSize: 14,
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.river800,
          side: const BorderSide(color: AppColors.sand300),
          backgroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 13),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          textStyle: GoogleFonts.beVietnamPro(
            fontWeight: FontWeight.w700,
            fontSize: 14,
          ),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: Colors.white,
        indicatorColor: AppColors.leaf100,
        surfaceTintColor: Colors.transparent,
        elevation: 8,
        shadowColor: AppColors.river900.withValues(alpha: 0.12),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return GoogleFonts.beVietnamPro(
            fontSize: 11.5,
            fontWeight: selected ? FontWeight.w700 : FontWeight.w600,
            color: selected ? AppColors.leaf700 : AppColors.river500,
          );
        }),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return IconThemeData(
            color: selected ? AppColors.leaf700 : AppColors.river500,
            size: 23,
          );
        }),
      ),
    );
  }
}

/// Danh mục Loại hình & Khu vực đồng bộ với client/src/lib/catalog.ts
class AppCatalog {
  static const List<({String value, String label, IconData icon})> categories = [
    (value: 'nature', label: 'Thiên nhiên', icon: Icons.park_outlined),
    (value: 'eco', label: 'Sinh thái', icon: Icons.eco_outlined),
    (value: 'culture', label: 'Văn hóa', icon: Icons.temple_buddhist_outlined),
    (value: 'history', label: 'Lịch sử', icon: Icons.account_balance_outlined),
    (value: 'food', label: 'Ẩm thực', icon: Icons.restaurant_outlined),
    (value: 'local_experience', label: 'Trải nghiệm địa phương', icon: Icons.kayaking_outlined),
  ];

  static const List<({String value, String label})> areas = [
    (value: 'cao-lanh', label: 'Cao Lãnh'),
    (value: 'sa-dec', label: 'Sa Đéc'),
    (value: 'thap-muoi', label: 'Tháp Mười'),
    (value: 'tam-nong', label: 'Tam Nông'),
    (value: 'lai-vung', label: 'Lai Vung'),
    (value: 'hong-ngu', label: 'Hồng Ngự'),
    (value: 'my-tho', label: 'Mỹ Tho'),
    (value: 'cai-be', label: 'Cái Bè'),
    (value: 'thoi-son', label: 'Cù lao Thới Sơn'),
  ];

  static String categoryLabel(String? value) {
    for (final item in categories) {
      if (item.value == value) return item.label;
    }
    return 'Khác';
  }

  static IconData categoryIcon(String? value) {
    for (final item in categories) {
      if (item.value == value) return item.icon;
    }
    return Icons.place_outlined;
  }

  static String areaLabel(String? value) {
    for (final item in areas) {
      if (item.value == value) return item.label;
    }
    return value ?? 'Đồng Tháp';
  }

  static String verificationStatusLabel(String? status) {
    switch (status) {
      case 'verified':
        return 'Đã xác minh';
      case 'partially_verified':
        return 'Xác minh một phần';
      default:
        return 'Chưa xác minh';
    }
  }

  static IconData badgeIcon(String? iconName) {
    switch (iconName) {
      case 'footprints':
        return Icons.directions_walk_rounded;
      case 'compass':
        return Icons.explore_rounded;
      case 'lightbulb':
        return Icons.lightbulb_rounded;
      case 'trophy':
        return Icons.emoji_events_rounded;
      case 'landmark':
        return Icons.account_balance_rounded;
      case 'star':
        return Icons.star_rounded;
      case 'medal':
        return Icons.military_tech_rounded;
      case 'award':
        return Icons.workspace_premium_rounded;
      case 'heart':
        return Icons.favorite_rounded;
      case 'sparkles':
        return Icons.auto_awesome_rounded;
      default:
        return Icons.emoji_events_rounded;
    }
  }

  static ({String label, String shortLabel, IconData icon, Color bg, Color fg}) roleMeta(String? role) {
    switch (role) {
      case 'restaurant':
        return (
          label: 'Nhà hàng / Quán ăn',
          shortLabel: 'Ăn uống',
          icon: Icons.restaurant_rounded,
          bg: AppColors.teal50,
          fg: AppColors.teal700,
        );
      case 'accommodation':
        return (
          label: 'Lưu trú / Khách sạn',
          shortLabel: 'Lưu trú',
          icon: Icons.hotel_rounded,
          bg: AppColors.lotus50,
          fg: AppColors.lotus600,
        );
      case 'entertainment':
        return (
          label: 'Giải trí',
          shortLabel: 'Giải trí',
          icon: Icons.music_note_rounded,
          bg: AppColors.river100,
          fg: AppColors.river700,
        );
      case 'wellness':
        return (
          label: 'Thư giãn / Spa',
          shortLabel: 'Spa',
          icon: Icons.spa_rounded,
          bg: AppColors.lotus50,
          fg: AppColors.lotus700,
        );
      default:
        return (
          label: 'Điểm tham quan',
          shortLabel: 'Tham quan',
          icon: Icons.account_balance_rounded,
          bg: AppColors.leaf100,
          fg: AppColors.leaf700,
        );
    }
  }
}

/// Các hàm định dạng tiền tệ, ngày giờ, khoảng thời gian và phân tích mã QR.
class AppFormatters {
  static final NumberFormat _numFormat = NumberFormat.decimalPattern('vi_VN');

  static String formatNumber(num? value) {
    if (value == null) return '0';
    return _numFormat.format(value.round());
  }

  static String formatVnd(num? amount) {
    if (amount == null || amount.isNaN || amount.isInfinite) {
      return 'Chưa có giá';
    }
    return '${_numFormat.format(amount.round())} ₫';
  }

  static String formatVndShort(num? amount) {
    if (amount == null || amount.isNaN || amount.isInfinite) return '—';
    if (amount >= 1000000) {
      final tr = amount / 1000000;
      final formatted = tr == tr.roundToDouble()
          ? tr.toInt().toString()
          : tr.toStringAsFixed(1).replaceAll('.', ',');
      return '$formatted tr';
    }
    if (amount >= 1000) {
      return '${(amount / 1000).round()}k';
    }
    return '${amount.round()} ₫';
  }

  static String formatMinutes(int? minutes) {
    if (minutes == null || minutes <= 0) return '—';
    if (minutes < 60) return '$minutes phút';
    final h = minutes ~/ 60;
    final m = minutes % 60;
    return m > 0 ? '$h giờ $m phút' : '$h giờ';
  }

  static String formatDateTime(String? iso) {
    if (iso == null || iso.isEmpty) return '';
    final dt = DateTime.tryParse(iso)?.toLocal();
    if (dt == null) return iso;
    final d = dt.day.toString().padLeft(2, '0');
    final m = dt.month.toString().padLeft(2, '0');
    final y = dt.year;
    final hh = dt.hour.toString().padLeft(2, '0');
    final mm = dt.minute.toString().padLeft(2, '0');
    return '$d/$m/$y $hh:$mm';
  }

  static String formatIsoClock(String? iso) {
    if (iso == null || iso.isEmpty) return '';
    final match = RegExp(r'T(\d{2}:\d{2})').firstMatch(iso);
    if (match != null) return match.group(1)!;
    return iso;
  }

  static String formatDateVi(String? isoDate) {
    if (isoDate == null || isoDate.isEmpty) return '';
    final parts = isoDate.split('-');
    if (parts.length == 3) {
      return '${parts[2]}/${parts[1]}/${parts[0]}';
    }
    return isoDate;
  }

  /// Trích xuất mã QR hợp lệ (A-Z, 0-9, -) từ chuỗi hoặc URL `{PUBLIC_APP_URL}/qr/{code}`.
  static String? extractQrCode(String rawInput) {
    final trimmed = rawInput.trim();
    if (trimmed.isEmpty) return null;

    final codePattern = RegExp(r'^[A-Z0-9][A-Z0-9-]{1,62}[A-Z0-9]$');
    final upper = trimmed.toUpperCase();
    if (codePattern.hasMatch(upper)) return upper;

    final urlMatch = RegExp(r'/qr/([A-Za-z0-9-]+)').firstMatch(trimmed);
    if (urlMatch != null) {
      final candidate = urlMatch.group(1)!.toUpperCase();
      if (codePattern.hasMatch(candidate)) return candidate;
    }
    return null;
  }
}
