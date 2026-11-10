import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models/api_models.dart';
import '../services/api_client.dart';
import '../state/app_state.dart';
import '../theme/app_theme.dart';
import '../widgets/common_widgets.dart';

class DestinationDetailScreen extends StatefulWidget {
  final String slug;
  final AppState appState;

  const DestinationDetailScreen({
    super.key,
    required this.slug,
    required this.appState,
  });

  @override
  State<DestinationDetailScreen> createState() => _DestinationDetailScreenState();
}

class _DestinationDetailScreenState extends State<DestinationDetailScreen> {
  DestinationResponse? _data;
  List<DestinationSummary> _related = const [];
  bool _loading = true;
  String? _error;
  bool _togglingFav = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await ApiClient.instance.getDestinationDetail(widget.slug);
      List<DestinationSummary> related = const [];
      try {
        related = await ApiClient.instance.getRelatedDestinations(widget.slug);
      } catch (_) {}
      if (!mounted) return;
      setState(() {
        _data = res;
        _related = related;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _openMaps(DestinationDetail d) async {
    try {
      final Uri uri;
      if (d.lat != null && d.lng != null) {
        uri = Uri.parse(
          'https://www.google.com/maps/dir/?api=1&destination=${d.lat},${d.lng}',
        );
      } else {
        uri = Uri.parse(
          'https://www.google.com/maps/search/?api=1&query=${Uri.encodeComponent('${d.name} Đồng Tháp')}',
        );
      }
      if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
        await launchUrl(uri);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Không thể mở bản đồ chỉ đường: $e')),
        );
      }
    }
  }

  Future<void> _openPhone(String phone) async {
    try {
      final clean = phone.replaceAll(RegExp(r'\s+'), '');
      final uri = Uri.parse('tel:$clean');
      if (!await launchUrl(uri)) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Không thể gọi điện đến: $clean')),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Không thể thực hiện cuộc gọi: $e')),
        );
      }
    }
  }

  Future<void> _toggleFav(DestinationDetail d) async {
    if (widget.appState.user == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Vui lòng đăng nhập ở tab Hộ chiếu / Tài khoản để lưu địa điểm yêu thích.'),
        ),
      );
      return;
    }
    setState(() => _togglingFav = true);
    try {
      final nowFav = await widget.appState.toggleFavorite(d.id);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(nowFav ? 'Đã thêm vào Địa điểm yêu thích' : 'Đã bỏ khỏi Địa điểm yêu thích'),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString())),
      );
    } finally {
      if (mounted) setState(() => _togglingFav = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: widget.appState,
      builder: (context, _) {
        if (_loading) {
          return Scaffold(
            appBar: AppBar(title: const Text('Chi tiết điểm đến')),
            body: const Center(
              child: CircularProgressIndicator(color: AppColors.leaf600),
            ),
          );
        }

        if (_error != null || _data == null) {
          return Scaffold(
            appBar: AppBar(title: const Text('Chi tiết điểm đến')),
            body: Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.error_outline_rounded, size: 48, color: AppColors.lotus600),
                    const SizedBox(height: 12),
                    Text(
                      _error ?? 'Không tải được thông tin điểm đến.',
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 16),
                    ElevatedButton.icon(
                      onPressed: _load,
                      icon: const Icon(Icons.refresh_rounded),
                      label: const Text('Thử lại'),
                    ),
                  ],
                ),
              ),
            ),
          );
        }

        final d = _data!.destination;
        final challenges = _data!.challenges;
        final hasActiveQr = _data!.hasActiveQr;
        final isFav = widget.appState.isFavorite(d.id);

        return Scaffold(
          appBar: AppBar(
            title: Text(d.name, maxLines: 1, overflow: TextOverflow.ellipsis),
            actions: [
              IconButton(
                tooltip: isFav ? 'Đã yêu thích' : 'Lưu yêu thích',
                onPressed: _togglingFav ? null : () => _toggleFav(d),
                icon: Icon(
                  isFav ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                  color: isFav ? AppColors.lotus600 : AppColors.river700,
                ),
              ),
            ],
          ),
          body: RefreshIndicator(
            color: AppColors.leaf600,
            onRefresh: _load,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 36),
              children: [
                // Hero Card
                Card(
                  clipBehavior: Clip.antiAlias,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Stack(
                        children: [
                          DestinationImageView(
                            imageUrl: d.imageUrl,
                            category: d.category,
                            name: d.name,
                            height: 220,
                          ),
                          if (hasActiveQr)
                            Positioned(
                              top: 12,
                              left: 12,
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                decoration: BoxDecoration(
                                  color: AppColors.river950.withValues(alpha: 0.86),
                                  borderRadius: BorderRadius.circular(999),
                                ),
                                child: const Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(Icons.qr_code_scanner_rounded, size: 15, color: AppColors.teal300),
                                    SizedBox(width: 6),
                                    Text(
                                      'Có trạm QR tương tác',
                                      style: TextStyle(
                                        color: AppColors.teal200,
                                        fontWeight: FontWeight.w700,
                                        fontSize: 12,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                        ],
                      ),
                      Padding(
                        padding: const EdgeInsets.all(18),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Wrap(
                              spacing: 8,
                              runSpacing: 6,
                              crossAxisAlignment: WrapCrossAlignment.center,
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: AppColors.leaf50,
                                    borderRadius: BorderRadius.circular(999),
                                    border: Border.all(color: AppColors.leaf200),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(AppCatalog.categoryIcon(d.category), size: 14, color: AppColors.leaf700),
                                      const SizedBox(width: 5),
                                      Text(
                                        AppCatalog.categoryLabel(d.category),
                                        style: const TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w700,
                                          color: AppColors.leaf800,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    const Icon(Icons.location_on_outlined, size: 15, color: AppColors.leaf600),
                                    const SizedBox(width: 3),
                                    Text(
                                      AppCatalog.areaLabel(d.area),
                                      style: const TextStyle(
                                        fontSize: 12.5,
                                        fontWeight: FontWeight.w600,
                                        color: AppColors.river600,
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                            const SizedBox(height: 10),
                            Text(
                              d.name,
                              style: const TextStyle(
                                fontSize: 22,
                                fontWeight: FontWeight.w800,
                                color: AppColors.river900,
                                height: 1.2,
                              ),
                            ),
                            const SizedBox(height: 10),
                            Wrap(
                              spacing: 6,
                              runSpacing: 6,
                              children: [
                                VerificationBadgeWidget(status: d.verificationStatus),
                                if (d.isIllustrative) const IllustrativeBadgeWidget(),
                                ...d.tags.map(
                                  (tag) => Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: AppColors.sand100,
                                      borderRadius: BorderRadius.circular(999),
                                    ),
                                    child: Text(
                                      '#$tag',
                                      style: const TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w600,
                                        color: AppColors.river700,
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            if (d.summary.isNotEmpty) ...[
                              const SizedBox(height: 12),
                              Text(
                                d.summary,
                                style: const TextStyle(
                                  fontSize: 14.5,
                                  color: AppColors.river700,
                                  height: 1.45,
                                ),
                              ),
                            ],
                            const SizedBox(height: 16),
                            Row(
                              children: [
                                Expanded(
                                  child: ElevatedButton.icon(
                                    onPressed: () => _openMaps(d),
                                    icon: const Icon(Icons.directions_rounded, size: 18),
                                    label: const Text('Chỉ đường bản đồ'),
                                  ),
                                ),
                                const SizedBox(width: 10),
                                OutlinedButton.icon(
                                  onPressed: () {
                                    Navigator.of(context).pop();
                                    widget.appState.setTabIndex(3);
                                  },
                                  icon: const Icon(Icons.auto_awesome_rounded, size: 17, color: AppColors.leaf700),
                                  label: const Text('Lập lịch AI'),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 16),

                // Trải nghiệm & Thử thách QR tại điểm
                Card(
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(20),
                    side: const BorderSide(color: AppColors.teal200, width: 1.2),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(18),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: AppColors.teal50,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: const Icon(Icons.qr_code_2_rounded, color: AppColors.teal700, size: 22),
                            ),
                            const SizedBox(width: 10),
                            const Expanded(
                              child: Text(
                                'Trải nghiệm & Thử thách QR',
                                style: TextStyle(
                                  fontSize: 17,
                                  fontWeight: FontWeight.w800,
                                  color: AppColors.river900,
                                ),
                              ),
                            ),
                            if (hasActiveQr)
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                decoration: BoxDecoration(
                                  color: AppColors.teal50,
                                  borderRadius: BorderRadius.circular(999),
                                ),
                                child: const Text(
                                  'Đang mở tại điểm',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.teal800,
                                  ),
                                ),
                              ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        if (challenges.isEmpty)
                          const Text(
                            'Địa điểm này hiện chưa có thử thách trắc nghiệm đang hoạt động.',
                            style: TextStyle(fontSize: 13.5, color: AppColors.river600),
                          )
                        else ...[
                          Text(
                            hasActiveQr
                                ? 'Quét mã QR đặt tại điểm đến để mở câu chuyện bản địa, check-in nhận dấu mộc và trả lời thử thách văn hóa.'
                                : 'Thử thách sẽ mở khi mã QR tại điểm đến được kích hoạt.',
                            style: const TextStyle(fontSize: 13.5, color: AppColors.river600),
                          ),
                          const SizedBox(height: 12),
                          ...challenges.map(
                            (c) => Container(
                              margin: const EdgeInsets.only(bottom: 10),
                              padding: const EdgeInsets.all(13),
                              decoration: BoxDecoration(
                                color: AppColors.sand50,
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(color: AppColors.sand200),
                              ),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Container(
                                    padding: const EdgeInsets.all(8),
                                    decoration: BoxDecoration(
                                      color: AppColors.teal50,
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: const Icon(Icons.emoji_events_rounded, color: AppColors.teal600, size: 20),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          c.title,
                                          style: const TextStyle(
                                            fontWeight: FontWeight.w700,
                                            fontSize: 14.5,
                                            color: AppColors.river900,
                                          ),
                                        ),
                                        if (c.description.isNotEmpty) ...[
                                          const SizedBox(height: 3),
                                          Text(
                                            c.description,
                                            style: const TextStyle(fontSize: 12.5, color: AppColors.river600),
                                          ),
                                        ],
                                        const SizedBox(height: 5),
                                        Text(
                                          '${c.questionCount} câu hỏi · cần đúng ${c.minCorrect} câu',
                                          style: const TextStyle(
                                            fontSize: 11.5,
                                            fontWeight: FontWeight.w600,
                                            color: AppColors.river500,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                    decoration: BoxDecoration(
                                      color: AppColors.teal50,
                                      borderRadius: BorderRadius.circular(999),
                                      border: Border.all(color: AppColors.teal200),
                                    ),
                                    child: Text(
                                      '+${c.rewardPoints} đ',
                                      style: const TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w800,
                                        color: AppColors.teal800,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          if (hasActiveQr) ...[
                            const SizedBox(height: 4),
                            SizedBox(
                              width: double.infinity,
                              child: ElevatedButton.icon(
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: AppColors.teal600,
                                ),
                                onPressed: () {
                                  Navigator.of(context).pop();
                                  widget.appState.setTabIndex(2);
                                },
                                icon: const Icon(Icons.qr_code_scanner_rounded),
                                label: const Text('Mở Máy quét QR để Check-in & Làm thử thách'),
                              ),
                            ),
                          ],
                        ],
                      ],
                    ),
                  ),
                ),

                const SizedBox(height: 16),

                // Câu chuyện & Giới thiệu điểm đến
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(18),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Row(
                          children: [
                            Icon(Icons.menu_book_rounded, color: AppColors.leaf600, size: 20),
                            SizedBox(width: 8),
                            Text(
                              'Giới thiệu điểm đến',
                              style: TextStyle(
                                fontSize: 17,
                                fontWeight: FontWeight.w800,
                                color: AppColors.river900,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Text(
                          d.description,
                          style: const TextStyle(
                            fontSize: 14.5,
                            color: AppColors.river800,
                            height: 1.55,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

                const SizedBox(height: 16),

                // Thông tin thực tế & Độ xác minh
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(18),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Row(
                          children: [
                            Icon(Icons.info_outline_rounded, color: AppColors.leaf600, size: 20),
                            SizedBox(width: 8),
                            Text(
                              'Thông tin thực tế',
                              style: TextStyle(
                                fontSize: 17,
                                fontWeight: FontWeight.w800,
                                color: AppColors.river900,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        _factRow(
                          icon: Icons.place_outlined,
                          label: 'Địa chỉ',
                          value: d.address ?? 'Chưa có thông tin xác minh',
                        ),
                        const Divider(height: 20, color: AppColors.sand200),
                        _factRow(
                          icon: Icons.access_time_rounded,
                          label: 'Giờ mở cửa',
                          value: d.openingHours ?? 'Chưa có thông tin xác minh',
                        ),
                        const Divider(height: 20, color: AppColors.sand200),
                        _factRow(
                          icon: Icons.payments_outlined,
                          label: 'Giá vé tham khảo',
                          value: d.referencePrice ?? 'Chưa có thông tin xác minh',
                        ),
                        const Divider(height: 20, color: AppColors.sand200),
                        _factRow(
                          icon: Icons.timer_outlined,
                          label: 'Thời lượng ghé thăm',
                          value: d.estimatedVisitDuration != null
                              ? '${AppFormatters.formatMinutes(d.estimatedVisitDuration!.minutes)}${d.estimatedVisitDuration!.isEstimate ? ' (ước lượng)' : ''}'
                              : 'Khoảng 90 phút (mặc định)',
                        ),
                        if (d.phone != null && d.phone!.isNotEmpty) ...[
                          const Divider(height: 20, color: AppColors.sand200),
                          InkWell(
                            onTap: () => _openPhone(d.phone!),
                            child: _factRow(
                              icon: Icons.phone_outlined,
                              label: 'Điện thoại liên hệ',
                              value: d.phone!,
                              isLink: true,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),

                // Điểm đến liên quan
                if (_related.isNotEmpty) ...[
                  const SizedBox(height: 22),
                  const Text(
                    'Điểm đến liên quan',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: AppColors.river900,
                    ),
                  ),
                  const SizedBox(height: 12),
                  ..._related.take(3).map(
                        (rel) => Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: DestinationCardWidget(
                            destination: rel,
                            onTap: () {
                              Navigator.of(context).pushReplacement(
                                MaterialPageRoute(
                                  builder: (_) => DestinationDetailScreen(
                                    slug: rel.slug,
                                    appState: widget.appState,
                                  ),
                                ),
                              );
                            },
                          ),
                        ),
                      ),
                ],
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _factRow({
    required IconData icon,
    required String label,
    required String value,
    bool isLink = false,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 18, color: AppColors.leaf600),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: AppColors.river500,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                value,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: isLink ? AppColors.leaf700 : AppColors.river900,
                  decoration: isLink ? TextDecoration.underline : null,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
