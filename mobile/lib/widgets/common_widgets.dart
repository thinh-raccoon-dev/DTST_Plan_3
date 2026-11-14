import 'package:flutter/material.dart';

import '../models/api_models.dart';
import '../services/api_client.dart';
import '../state/app_state.dart';
import '../theme/app_theme.dart';

/// Ảnh điểm đến có tự động chuyển sang Placeholder nghệ thuật khi thiếu ảnh hoặc lỗi tải ảnh.
class DestinationImageView extends StatelessWidget {
  final String? imageUrl;
  final String category;
  final String name;
  final double? height;
  final double? width;
  final BorderRadius? borderRadius;

  const DestinationImageView({
    super.key,
    required this.imageUrl,
    required this.category,
    required this.name,
    this.height,
    this.width,
    this.borderRadius,
  });

  @override
  Widget build(BuildContext context) {
    Widget content;
    if (imageUrl != null && imageUrl!.trim().isNotEmpty) {
      content = Image.network(
        imageUrl!,
        height: height,
        width: width ?? double.infinity,
        fit: BoxFit.cover,
        errorBuilder: (context, error, stackTrace) => _buildPlaceholder(),
        loadingBuilder: (context, child, progress) {
          if (progress == null) return child;
          return Container(
            height: height,
            width: width ?? double.infinity,
            color: AppColors.sand100,
            alignment: Alignment.center,
            child: const SizedBox(
              width: 24,
              height: 24,
              child: CircularProgressIndicator(
                strokeWidth: 2.2,
                color: AppColors.leaf600,
              ),
            ),
          );
        },
      );
    } else {
      content = _buildPlaceholder();
    }

    if (borderRadius != null) {
      return ClipRRect(borderRadius: borderRadius!, child: content);
    }
    return content;
  }

  Widget _buildPlaceholder() {
    return Container(
      height: height,
      width: width ?? double.infinity,
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.leaf800, AppColors.leaf600, AppColors.teal600],
        ),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      alignment: Alignment.center,
      child: FittedBox(
        fit: BoxFit.scaleDown,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.16),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(
                AppCatalog.categoryIcon(category),
                color: Colors.white,
                size: 24,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w700,
                fontSize: 12.5,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              AppCatalog.categoryLabel(category),
              style: const TextStyle(
                color: AppColors.leaf100,
                fontSize: 10.5,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Nhãn trạng thái xác minh dữ liệu (Trung thực dữ liệu).
class VerificationBadgeWidget extends StatelessWidget {
  final String status;

  const VerificationBadgeWidget({super.key, required this.status});

  @override
  Widget build(BuildContext context) {
    final isVerified = status == 'verified';
    final isPartial = status == 'partially_verified';
    final bgColor = isVerified
        ? AppColors.leaf50
        : (isPartial ? AppColors.teal50 : AppColors.sand100);
    final fgColor = isVerified
        ? AppColors.leaf700
        : (isPartial ? AppColors.teal800 : AppColors.river600);
    final icon = isVerified
        ? Icons.verified_rounded
        : (isPartial ? Icons.fact_check_outlined : Icons.info_outline_rounded);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(
          color: isVerified
              ? AppColors.leaf200
              : (isPartial ? AppColors.teal200 : AppColors.sand300),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: fgColor),
          const SizedBox(width: 4),
          Text(
            AppCatalog.verificationStatusLabel(status),
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: fgColor,
            ),
          ),
        ],
      ),
    );
  }
}

/// Nhãn "Dữ liệu minh họa"
class IllustrativeBadgeWidget extends StatelessWidget {
  const IllustrativeBadgeWidget({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.lotus50,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: AppColors.lotus200),
      ),
      child: const Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.auto_stories_outlined, size: 12, color: AppColors.lotus700),
          SizedBox(width: 4),
          Text(
            'Dữ liệu minh họa',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: AppColors.lotus700,
            ),
          ),
        ],
      ),
    );
  }
}

/// Thẻ Địa điểm dùng chung trên Trang chủ, Khám phá và Yêu thích.
class DestinationCardWidget extends StatelessWidget {
  final DestinationSummary destination;
  final VoidCallback onTap;

  const DestinationCardWidget({
    super.key,
    required this.destination,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final d = destination;
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Stack(
              children: [
                DestinationImageView(
                  imageUrl: d.imageUrl,
                  category: d.category,
                  name: d.name,
                  height: 175,
                ),
                Positioned(
                  top: 10,
                  left: 10,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.92),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          AppCatalog.categoryIcon(d.category),
                          size: 14,
                          color: AppColors.leaf700,
                        ),
                        const SizedBox(width: 5),
                        Text(
                          AppCatalog.categoryLabel(d.category),
                          style: const TextStyle(
                            fontSize: 11.5,
                            fontWeight: FontWeight.w700,
                            color: AppColors.river900,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                if (d.hasChallenge)
                  Positioned(
                    top: 10,
                    right: 10,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: AppColors.river950.withValues(alpha: 0.85),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.qr_code_2_rounded, size: 14, color: AppColors.teal300),
                          SizedBox(width: 4),
                          Text(
                            'Có QR / Thử thách',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: AppColors.teal200,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
            Padding(
              padding: const EdgeInsets.all(15),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.location_on_outlined, size: 14, color: AppColors.leaf600),
                      const SizedBox(width: 3),
                      Expanded(
                        child: Text(
                          AppCatalog.areaLabel(d.area),
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: AppColors.river600,
                          ),
                        ),
                      ),
                      if (d.estimatedVisitDuration != null)
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.schedule_rounded, size: 13, color: AppColors.river400),
                            const SizedBox(width: 3),
                            Text(
                              AppFormatters.formatMinutes(d.estimatedVisitDuration!.minutes),
                              style: const TextStyle(
                                fontSize: 11.5,
                                color: AppColors.river500,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    d.name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 16.5,
                      fontWeight: FontWeight.w800,
                      color: AppColors.river900,
                      height: 1.25,
                    ),
                  ),
                  if (d.summary.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Text(
                      d.summary,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 13,
                        color: AppColors.river600,
                        height: 1.4,
                      ),
                    ),
                  ],
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: [
                      VerificationBadgeWidget(status: d.verificationStatus),
                      if (d.isIllustrative) const IllustrativeBadgeWidget(),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Hộp thoại vinh danh khi mở khóa Huy hiệu mới sau Check-in / Thử thách / Đồng bộ.
Future<void> showNewBadgesDialog(BuildContext context, List<BadgeInfo> badges) async {
  if (badges.isEmpty || !context.mounted) return;
  await showDialog<void>(
    context: context,
    builder: (ctx) => AlertDialog(
      backgroundColor: Colors.white,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      title: const Row(
        children: [
          Icon(Icons.auto_awesome_rounded, color: AppColors.teal500, size: 26),
          SizedBox(width: 8),
          Expanded(
            child: Text(
              'Mở khóa Huy hiệu mới!',
              style: TextStyle(fontSize: 19, fontWeight: FontWeight.w800),
            ),
          ),
        ],
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: badges
            .map(
              (b) => Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.teal50.withValues(alpha: 0.6),
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: AppColors.teal300),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        gradient: AppColors.goldBadgeGradient,
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Icon(
                        AppCatalog.badgeIcon(b.icon),
                        color: Colors.white,
                        size: 26,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            b.name,
                            style: const TextStyle(
                              fontWeight: FontWeight.w800,
                              fontSize: 15,
                              color: AppColors.river900,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            b.description,
                            style: const TextStyle(
                              fontSize: 12.5,
                              color: AppColors.river700,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            )
            .toList(),
      ),
      actions: [
        ElevatedButton(
          onPressed: () => Navigator.of(ctx).pop(),
          child: const Text('Tuyệt vời!'),
        ),
      ],
    ),
  );
}

/// Hộp thoại cấu hình nhanh địa chỉ Máy chủ API (hỗ trợ cả Máy ảo Android 10.0.2.2 và Điện thoại thật qua LAN).
Future<void> showServerConfigDialog(BuildContext context, AppState appState) async {
  final controller = TextEditingController(text: ApiClient.instance.baseUrl);
  bool checking = false;
  String? statusMessage;

  await showDialog<void>(
    context: context,
    builder: (ctx) => StatefulBuilder(
      builder: (ctx, setModalState) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        title: const Row(
          children: [
            Icon(Icons.dns_outlined, color: AppColors.leaf600),
            SizedBox(width: 8),
            Expanded(
              child: Text(
                'Cấu hình Máy chủ API',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
              ),
            ),
          ],
        ),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Chọn nhanh môi trường hoặc nhập địa chỉ IP LAN khi chạy trên điện thoại thật:',
                style: TextStyle(fontSize: 13, color: AppColors.river600),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: controller,
                decoration: const InputDecoration(
                  labelText: 'Base URL (/api/v1)',
                  hintText: 'http://10.0.2.2:4000/api/v1',
                ),
              ),
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  ActionChip(
                    label: const Text('Android Emulator (10.0.2.2)'),
                    onPressed: () {
                      controller.text = 'http://10.0.2.2:4000/api/v1';
                    },
                  ),
                  ActionChip(
                    label: const Text('Localhost (127.0.0.1)'),
                    onPressed: () {
                      controller.text = 'http://localhost:4000/api/v1';
                    },
                  ),
                ],
              ),
              if (statusMessage != null) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppColors.leaf50,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    statusMessage!,
                    style: const TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w600,
                      color: AppColors.leaf800,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Đóng'),
          ),
          ElevatedButton.icon(
            onPressed: checking
                ? null
                : () async {
                    setModalState(() {
                      checking = true;
                      statusMessage = null;
                    });
                    await ApiClient.instance.setCustomBaseUrl(controller.text);
                    await appState.checkServerConnection();
                    setModalState(() {
                      checking = false;
                      statusMessage = appState.serverOnline
                          ? '✅ Đã kết nối thành công tới máy chủ!'
                          : '⚠️ Chưa phản hồi. Hãy kiểm tra npm run dev -w server đã bật chưa.';
                    });
                  },
            icon: checking
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                  )
                : const Icon(Icons.check_circle_outline, size: 18),
            label: const Text('Lưu & Kiểm tra'),
          ),
        ],
      ),
    ),
  );
}
