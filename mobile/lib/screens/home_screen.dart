import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models/api_models.dart';
import '../services/api_client.dart';
import '../state/app_state.dart';
import '../theme/app_theme.dart';
import '../widgets/common_widgets.dart';
import 'destination_detail_screen.dart';

class HomeScreen extends StatefulWidget {
  final AppState appState;

  const HomeScreen({super.key, required this.appState});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final TextEditingController _searchController = TextEditingController();
  List<PublicBanner> _banners = const [];
  List<DestinationSummary> _featured = const [];
  List<DestinationSummary> _activeQrDestinations = const [];
  bool _personalized = false;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final api = ApiClient.instance;
      List<PublicBanner> banners = const [];
      try {
        banners = await api.getHomeBanners();
      } catch (_) {}

      bool personalized = false;
      List<DestinationSummary> featured = const [];
      try {
        final rec = await api.getRecommendedDestinations();
        if (rec.items.isNotEmpty) {
          featured = rec.items;
          personalized = rec.personalized;
        }
      } catch (_) {}

      if (featured.isEmpty) {
        final list = await api.getDestinations(limit: 6, sort: 'recent');
        featured = list.items;
      }

      List<DestinationSummary> activeQr = const [];
      try {
        final act = await api.getDestinations(limit: 4, hasActivity: true);
        activeQr = act.items;
      } catch (_) {}

      if (!mounted) return;
      setState(() {
        _banners = banners;
        _featured = featured;
        _personalized = personalized;
        _activeQrDestinations = activeQr;
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

  void _openDestination(DestinationSummary d) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => DestinationDetailScreen(
          slug: d.slug,
          appState: widget.appState,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      color: AppColors.leaf600,
      onRefresh: _loadData,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 36),
        children: [
          // Top Promotional / Event Banner
          if (_banners.isNotEmpty) ...[
            _buildBannerCard(_banners.first),
            const SizedBox(height: 14),
          ],

          // Hero Section
          Container(
            padding: const EdgeInsets.all(22),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Colors.white, AppColors.leaf50, AppColors.lotus50],
              ),
              borderRadius: BorderRadius.circular(26),
              border: Border.all(color: AppColors.sand200),
              boxShadow: [
                BoxShadow(
                  color: AppColors.river900.withValues(alpha: 0.06),
                  blurRadius: 24,
                  offset: const Offset(0, 10),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 10,
                      height: 6,
                      decoration: BoxDecoration(
                        color: AppColors.lotus400,
                        borderRadius: BorderRadius.circular(99),
                      ),
                    ),
                    const SizedBox(width: 8),
                    const Text(
                      'MỖI CHUYẾN ĐI, MỘT CÂU CHUYỆN',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.5,
                        color: AppColors.river600,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                RichText(
                  text: TextSpan(
                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                          fontSize: 27,
                          fontWeight: FontWeight.w800,
                          color: AppColors.river900,
                          height: 1.18,
                        ),
                    children: const [
                      TextSpan(text: 'Khám phá Đồng Tháp '),
                      TextSpan(
                        text: 'theo cách của bạn',
                        style: TextStyle(color: AppColors.leaf700),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 10),
                const Text(
                  'AI lập lịch trình Mỹ Tho – Thới Sơn – Đồng Tháp, nhiệm vụ khám phá QR tại điểm đến và hộ chiếu số lưu giữ từng dấu chân.',
                  style: TextStyle(
                    fontSize: 13.5,
                    color: AppColors.river600,
                    height: 1.45,
                  ),
                ),
                const SizedBox(height: 16),

                // Search bar
                TextField(
                  controller: _searchController,
                  textInputAction: TextInputAction.search,
                  onSubmitted: (val) {
                    widget.appState.navigateToExplore(query: val);
                  },
                  decoration: InputDecoration(
                    hintText: 'Tìm điểm đến: Tràm Chim, Gò Tháp, Sa Đéc...',
                    prefixIcon: const Icon(Icons.search_rounded, color: AppColors.leaf600),
                    suffixIcon: IconButton(
                      icon: const Icon(Icons.arrow_forward_rounded, color: AppColors.leaf600),
                      onPressed: () {
                        widget.appState.navigateToExplore(query: _searchController.text);
                      },
                    ),
                  ),
                ),

                const SizedBox(height: 14),

                // Main CTAs
                Row(
                  children: [
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: () => widget.appState.setTabIndex(3),
                        icon: const Icon(Icons.auto_awesome_rounded, size: 18),
                        label: const Text('AI Lập lịch trình'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => widget.appState.setTabIndex(2),
                        icon: const Icon(Icons.qr_code_scanner_rounded, size: 18, color: AppColors.leaf700),
                        label: const Text('Quét mã QR'),
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 14),

                // Feature pills
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    _featurePill(AppColors.leaf600, 'Trip Planner V9 + Valhalla'),
                    _featurePill(AppColors.lotus500, 'Check-in QR & Thử thách'),
                    _featurePill(AppColors.teal500, 'Hộ chiếu trải nghiệm số'),
                  ],
                ),
              ],
            ),
          ),

          const SizedBox(height: 24),

          // 6 Nhóm trải nghiệm
          const Text(
            'GIÁ TRỊ CỐT LÕI',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w800,
              letterSpacing: 1.4,
              color: AppColors.river500,
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'Khám phá theo sở thích',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w800,
              color: AppColors.river900,
            ),
          ),
          const SizedBox(height: 12),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: AppCatalog.categories.length,
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 3,
              mainAxisSpacing: 10,
              crossAxisSpacing: 10,
              mainAxisExtent: 86,
            ),
            itemBuilder: (context, index) {
              final cat = AppCatalog.categories[index];
              return Card(
                child: InkWell(
                  borderRadius: BorderRadius.circular(20),
                  onTap: () => widget.appState.navigateToExplore(category: cat.value),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Container(
                          padding: const EdgeInsets.all(6),
                          decoration: BoxDecoration(
                            color: AppColors.leaf50,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: AppColors.leaf200),
                          ),
                          child: Icon(cat.icon, size: 18, color: AppColors.leaf700),
                        ),
                        Text(
                          cat.label,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: AppColors.river900,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),

          const SizedBox(height: 26),

          // Điểm đến gợi ý
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _personalized ? 'DÀNH RIÊNG CHO BẠN' : 'ĐIỂM ĐẾN NỔI BẬT',
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.4,
                        color: AppColors.leaf700,
                      ),
                    ),
                    const SizedBox(height: 3),
                    const Text(
                      'Điểm đến gợi ý',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                        color: AppColors.river900,
                      ),
                    ),
                  ],
                ),
              ),
              TextButton.icon(
                onPressed: () => widget.appState.navigateToExplore(),
                icon: const Text('Xem tất cả'),
                label: const Icon(Icons.arrow_forward_rounded, size: 16),
              ),
            ],
          ),
          const SizedBox(height: 10),

          if (_loading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 32),
              child: Center(
                child: CircularProgressIndicator(color: AppColors.leaf600),
              ),
            )
          else if (_error != null)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: Column(
                  children: [
                    Text(
                      _error!,
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: AppColors.river600),
                    ),
                    const SizedBox(height: 12),
                    ElevatedButton.icon(
                      onPressed: _loadData,
                      icon: const Icon(Icons.refresh_rounded),
                      label: const Text('Tải lại'),
                    ),
                  ],
                ),
              ),
            )
          else if (_featured.isEmpty)
            const Card(
              child: Padding(
                padding: EdgeInsets.all(20),
                child: Text('Chưa có điểm đến nào được xuất bản.'),
              ),
            )
          else
            ..._featured.take(4).map(
                  (d) => Padding(
                    padding: const EdgeInsets.only(bottom: 14),
                    child: DestinationCardWidget(
                      destination: d,
                      onTap: () => _openDestination(d),
                    ),
                  ),
                ),

          const SizedBox(height: 16),

          // Khối Hộ chiếu trải nghiệm số & Trạm QR đang hoạt động
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: AppColors.heroGradient,
              borderRadius: BorderRadius.circular(24),
              boxShadow: [
                BoxShadow(
                  color: AppColors.river900.withValues(alpha: 0.18),
                  blurRadius: 24,
                  offset: const Offset(0, 10),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'HỘ CHIẾU TRẢI NGHIỆM SỐ',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.5,
                    color: AppColors.leaf200,
                  ),
                ),
                const SizedBox(height: 6),
                const Text(
                  'Mỗi dấu chân, một huy hiệu',
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 6),
                const Text(
                  'Mỗi điểm thí điểm có một mã QR. Quét mã để mở câu chuyện, check-in và trả lời thử thách văn hóa. Điểm thưởng do máy chủ chấm minh bạch.',
                  style: TextStyle(
                    fontSize: 13.5,
                    color: AppColors.leaf100,
                    height: 1.45,
                  ),
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    _stepMiniCard('Bước 1', Icons.qr_code_2_rounded, 'Quét QR'),
                    const SizedBox(width: 8),
                    _stepMiniCard('Bước 2', Icons.approval_rounded, 'Check-in'),
                    const SizedBox(width: 8),
                    _stepMiniCard('Bước 3', Icons.workspace_premium_rounded, 'Huy hiệu'),
                  ],
                ),
                if (_activeQrDestinations.isNotEmpty) ...[
                  const SizedBox(height: 18),
                  const Text(
                    'Điểm có QR / Thử thách đang hoạt động:',
                    style: TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 8),
                  ..._activeQrDestinations.map(
                    (d) => Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.11),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: Colors.white.withValues(alpha: 0.18)),
                      ),
                      child: ListTile(
                        dense: true,
                        onTap: () => _openDestination(d),
                        leading: Container(
                          padding: const EdgeInsets.all(7),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Icon(
                            AppCatalog.categoryIcon(d.category),
                            color: AppColors.teal200,
                            size: 18,
                          ),
                        ),
                        title: Text(
                          d.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w700,
                            fontSize: 13.5,
                          ),
                        ),
                        subtitle: Text(
                          d.summary,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(color: AppColors.leaf100, fontSize: 11.5),
                        ),
                        trailing: const Icon(Icons.chevron_right_rounded, color: AppColors.leaf200),
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.white,
                          foregroundColor: AppColors.leaf800,
                        ),
                        onPressed: () => widget.appState.setTabIndex(4),
                        icon: const Icon(Icons.auto_stories_rounded, size: 18),
                        label: const Text('Xem Hộ chiếu'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: OutlinedButton.icon(
                        style: OutlinedButton.styleFrom(
                          foregroundColor: Colors.white,
                          backgroundColor: Colors.white.withValues(alpha: 0.12),
                          side: BorderSide(color: Colors.white.withValues(alpha: 0.35)),
                        ),
                        onPressed: () => widget.appState.setTabIndex(2),
                        icon: const Icon(Icons.qr_code_scanner_rounded, size: 18),
                        label: const Text('Quét QR ngay'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBannerCard(PublicBanner b) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: b.theme == 'lotus'
            ? const LinearGradient(colors: [AppColors.lotus700, AppColors.lotus500])
            : AppColors.heroGradient,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (b.eyebrow != null && b.eyebrow!.isNotEmpty)
                  Text(
                    b.eyebrow!.toUpperCase(),
                    style: const TextStyle(
                      fontSize: 10.5,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1.2,
                      color: AppColors.teal200,
                    ),
                  ),
                const SizedBox(height: 3),
                Text(
                  b.title,
                  style: const TextStyle(
                    fontSize: 15.5,
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                  ),
                ),
                if (b.subtitle != null && b.subtitle!.isNotEmpty) ...[
                  const SizedBox(height: 3),
                  Text(
                    b.subtitle!,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 12, color: AppColors.leaf100),
                  ),
                ],
              ],
            ),
          ),
          if (b.linkUrl != null && b.linkUrl!.isNotEmpty) ...[
            const SizedBox(width: 10),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.white,
                foregroundColor: AppColors.leaf800,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              ),
              onPressed: () {
                ApiClient.instance.recordBannerClick(b.id);
                final link = b.linkUrl!;
                if (link.startsWith('/destinations')) {
                  widget.appState.navigateToExplore();
                } else if (link.startsWith('/itinerary')) {
                  widget.appState.setTabIndex(3);
                } else if (link.startsWith('/scan')) {
                  widget.appState.setTabIndex(2);
                } else if (link.startsWith('/passport')) {
                  widget.appState.setTabIndex(4);
                } else if (link.startsWith('http')) {
                  try {
                    launchUrl(Uri.parse(link), mode: LaunchMode.externalApplication);
                  } catch (_) {}
                }
              },
              child: Text(
                b.linkLabel?.isNotEmpty == true ? b.linkLabel! : 'Khám phá',
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _featurePill(Color dotColor, String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: AppColors.sand200),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 7,
            height: 7,
            decoration: BoxDecoration(color: dotColor, shape: BoxShape.circle),
          ),
          const SizedBox(width: 6),
          Text(
            label,
            style: const TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w700,
              color: AppColors.river800,
            ),
          ),
        ],
      ),
    );
  }

  Widget _stepMiniCard(String step, IconData icon, String title) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(11),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.11),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: Colors.white.withValues(alpha: 0.18)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              step,
              style: const TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                color: AppColors.lotus200,
              ),
            ),
            const SizedBox(height: 5),
            Icon(icon, color: AppColors.teal200, size: 20),
            const SizedBox(height: 5),
            Text(
              title,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w800,
                color: Colors.white,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
