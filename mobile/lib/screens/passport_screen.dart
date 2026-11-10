import 'package:flutter/material.dart';

import '../models/api_models.dart';
import '../services/api_client.dart';
import '../state/app_state.dart';
import '../theme/app_theme.dart';
import '../widgets/common_widgets.dart';
import 'auth_profile_screen.dart';
import 'destination_detail_screen.dart';

class PassportScreen extends StatefulWidget {
  final AppState appState;

  const PassportScreen({
    super.key,
    required this.appState,
  });

  @override
  State<PassportScreen> createState() => _PassportScreenState();
}

class _PassportScreenState extends State<PassportScreen> {
  Passport? _passport;
  bool _loading = true;
  bool _claiming = false;
  String? _error;
  String? _claimMessage;
  int _lastPassportTick = 0;

  @override
  void initState() {
    super.initState();
    _lastPassportTick = widget.appState.passportRefreshTick;
    widget.appState.addListener(_onAppStateChanged);
    _loadPassport();
  }

  @override
  void dispose() {
    widget.appState.removeListener(_onAppStateChanged);
    super.dispose();
  }

  void _onAppStateChanged() {
    if (widget.appState.passportRefreshTick != _lastPassportTick) {
      _lastPassportTick = widget.appState.passportRefreshTick;
      _loadPassport();
    }
  }

  Future<void> _loadPassport() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final res = await ApiClient.instance.getMyPassport();
      if (!mounted) return;
      setState(() {
        _passport = res;
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

  Future<void> _handleClaimDevicePassport() async {
    setState(() {
      _claiming = true;
      _claimMessage = null;
    });

    try {
      final res = await ApiClient.instance.claimDevicePassport();
      await _loadPassport();
      if (!mounted) return;
      setState(() {
        _claimMessage = (res.claimed == 0)
            ? 'Tài khoản của bạn đã đồng bộ đầy đủ dữ liệu trên thiết bị này.'
            : 'Đã gộp thành công +${res.claimed} mục trải nghiệm từ thiết bị vào tài khoản!';
      });
      if (res.newBadges.isNotEmpty) {
        await showNewBadgesDialog(context, res.newBadges);
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _claimMessage = e.toString());
    } finally {
      if (mounted) setState(() => _claiming = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading && _passport == null) {
      return const Center(child: CircularProgressIndicator());
    }

    final passport = _passport;
    if (passport == null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.error_outline_rounded, size: 48, color: Colors.red.shade400),
              const SizedBox(height: 12),
              Text(
                _error ?? 'Không thể tải dữ liệu Hộ chiếu trải nghiệm số.',
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
              ElevatedButton(
                onPressed: _loadPassport,
                child: const Text('Thử lại'),
              ),
            ],
          ),
        ),
      );
    }

    final user = widget.appState.user;
    final isAnonymous = passport.mode == 'device' || user == null;
    final progressPct = passport.progressTotal > 0
        ? ((passport.progressExplored / passport.progressTotal) * 100).clamp(0, 100).round()
        : 0;
    final earnedBadgesCount = passport.badges.where((b) => b.earned).length;

    return RefreshIndicator(
      onRefresh: _loadPassport,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 36),
        children: [
          // Passport Cover Hero
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: AppColors.darkForestGradient,
              borderRadius: BorderRadius.circular(26),
              boxShadow: [
                BoxShadow(
                  color: AppColors.leaf900.withValues(alpha: 0.25),
                  blurRadius: 18,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  spacing: 8,
                  runSpacing: 6,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: AppColors.teal400.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: AppColors.teal300.withValues(alpha: 0.4)),
                      ),
                      child: const Text(
                        '🌸 HỘ CHIẾU TRẢI NGHIỆM SỐ • ĐỒNG THÁP',
                        style: TextStyle(
                          color: AppColors.teal200,
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.6,
                        ),
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: isAnonymous
                            ? Colors.white.withValues(alpha: 0.14)
                            : AppColors.leaf500.withValues(alpha: 0.35),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        isAnonymous
                            ? '📱 Chế độ Khách trên thiết bị'
                            : '☁️ Đã đồng bộ tài khoản',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            user?.displayName ?? 'Du khách Đất Sen Hồng',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 22,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            isAnonymous
                                ? 'Du khách khám phá tự do • Chưa cần đăng nhập'
                                : user.email,
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.8),
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
                      ),
                      child: Column(
                        children: [
                          const Text(
                            'TỔNG ĐIỂM',
                            style: TextStyle(
                              color: AppColors.teal200,
                              fontSize: 9,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.8,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '${passport.points}',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 24,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 18),

                // Exploration Progress Bar
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.22),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: Colors.white.withValues(alpha: 0.12)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Text(
                              'Tiến độ chinh phục',
                              style: TextStyle(
                                color: Colors.white.withValues(alpha: 0.9),
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            '${passport.progressExplored}/${passport.progressTotal} điểm ($progressPct%)',
                            style: const TextStyle(
                              color: AppColors.teal300,
                              fontSize: 12,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(10),
                        child: LinearProgressIndicator(
                          value: progressPct / 100.0,
                          minHeight: 9,
                          backgroundColor: Colors.white.withValues(alpha: 0.15),
                          valueColor: const AlwaysStoppedAnimation<Color>(AppColors.teal400),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),

                // Action buttons inside Passport cover
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    ElevatedButton.icon(
                      onPressed: () => widget.appState.setTabIndex(2),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.teal400,
                        foregroundColor: AppColors.river950,
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      ),
                      icon: const Icon(Icons.qr_code_scanner_rounded, size: 17),
                      label: const Text(
                        'Quét QR tích điểm',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800),
                      ),
                    ),
                    if (isAnonymous)
                      OutlinedButton.icon(
                        onPressed: () async {
                          await Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => AuthProfileScreen(appState: widget.appState),
                            ),
                          );
                          _loadPassport();
                        },
                        style: OutlinedButton.styleFrom(
                          foregroundColor: Colors.white,
                          backgroundColor: Colors.white.withValues(alpha: 0.08),
                          side: BorderSide(color: Colors.white.withValues(alpha: 0.35)),
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        ),
                        icon: const Icon(Icons.cloud_upload_outlined, size: 17),
                        label: const Text(
                          'Đăng nhập lưu vĩnh viễn',
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
                        ),
                      )
                    else ...[
                      OutlinedButton.icon(
                        onPressed: _claiming ? null : _handleClaimDevicePassport,
                        style: OutlinedButton.styleFrom(
                          foregroundColor: Colors.white,
                          backgroundColor: Colors.white.withValues(alpha: 0.08),
                          side: BorderSide(color: Colors.white.withValues(alpha: 0.35)),
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        ),
                        icon: const Icon(Icons.sync_rounded, size: 16),
                        label: Text(
                          _claiming
                              ? 'Đang đồng bộ...'
                              : 'Đồng bộ thiết bị${passport.pendingDeviceEntries > 0 ? ' (${passport.pendingDeviceEntries})' : ''}',
                          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
                        ),
                      ),
                      OutlinedButton.icon(
                        onPressed: () {
                          Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => AuthProfileScreen(appState: widget.appState),
                            ),
                          );
                        },
                        style: OutlinedButton.styleFrom(
                          foregroundColor: Colors.white,
                          backgroundColor: Colors.white.withValues(alpha: 0.08),
                          side: BorderSide(color: Colors.white.withValues(alpha: 0.35)),
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        ),
                        icon: const Icon(Icons.manage_accounts_outlined, size: 16),
                        label: const Text(
                          'Hồ sơ & Yêu thích',
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
                        ),
                      ),
                    ],
                  ],
                ),
                if (_claimMessage != null) ...[
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.14),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      _claimMessage!,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 16),

          // 4 Stat Cards
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 10,
            crossAxisSpacing: 10,
            childAspectRatio: 1.9,
            children: [
              _PassportStatCard(
                emoji: '📍',
                label: 'Lượt Check-in QR',
                value: '${passport.checkInsCount}',
                color: AppColors.leaf700,
              ),
              _PassportStatCard(
                emoji: '🧩',
                label: 'Thử thách văn hóa',
                value: '${passport.completedChallengesCount}',
                color: AppColors.river700,
              ),
              _PassportStatCard(
                emoji: '🗺️',
                label: 'Điểm đến đã mở',
                value: '${passport.exploredDestinations}',
                color: AppColors.teal800,
              ),
              _PassportStatCard(
                emoji: '🎖️',
                label: 'Huy hiệu đạt được',
                value: '$earnedBadgesCount/${passport.badges.length}',
                color: AppColors.lotus700,
              ),
            ],
          ),
          const SizedBox(height: 22),

          // Badges Collection Section
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '🎖️ Bộ sưu tập Huy hiệu Đồng Tháp',
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w800,
                        color: AppColors.river900,
                      ),
                    ),
                    SizedBox(height: 2),
                    Text(
                      'Mở khóa tự động khi check-in QR và vượt qua thử thách',
                      style: TextStyle(fontSize: 12, color: AppColors.river600),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: AppColors.teal50,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: AppColors.teal200),
                ),
                child: Text(
                  '$earnedBadgesCount/${passport.badges.length}',
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    color: AppColors.teal800,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          ...passport.badges.map((badge) {
            return Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: badge.earned ? AppColors.teal50.withValues(alpha: 0.45) : Colors.white,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(
                  color: badge.earned ? AppColors.teal300 : AppColors.sand200,
                ),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 52,
                    height: 52,
                    decoration: BoxDecoration(
                      gradient: badge.earned ? AppColors.goldBadgeGradient : null,
                      color: badge.earned ? null : AppColors.sand100,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    alignment: Alignment.center,
                    child: Icon(
                      AppCatalog.badgeIcon(badge.icon),
                      color: badge.earned ? Colors.white : AppColors.river400,
                      size: 26,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                badge.name,
                                style: TextStyle(
                                  fontWeight: FontWeight.w800,
                                  fontSize: 14,
                                  color: badge.earned ? AppColors.river900 : AppColors.river600,
                                ),
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: badge.earned ? AppColors.leaf100 : AppColors.sand100,
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Text(
                                badge.earned ? '✓ Đã mở khóa' : '🔒 Chưa mở',
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w800,
                                  color: badge.earned ? AppColors.leaf800 : AppColors.river500,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(
                          badge.description,
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppColors.river600,
                            height: 1.35,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            if (badge.rewardPoints > 0)
                              Text(
                                'Thưởng +${badge.rewardPoints} điểm',
                                style: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.teal800,
                                ),
                              ),
                            if (badge.earned && badge.awardedAt != null)
                              Text(
                                'Đạt ${AppFormatters.formatDateTime(badge.awardedAt)}',
                                style: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.leaf700,
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
          }),

          const SizedBox(height: 20),

          // Recent Check-ins Section
          _PassportHistorySection(
            title: '📍 Nhật ký Check-in tại điểm đến (${passport.checkIns.length})',
            emptyText: 'Bạn chưa có lượt check-in nào. Hãy mở tab Quét QR để trải nghiệm ngay!',
            children: passport.checkIns.map((ci) {
              final dest = ci.destination;
              return ListTile(
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                onTap: dest != null
                    ? () {
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => DestinationDetailScreen(
                              slug: dest.slug,
                              appState: widget.appState,
                            ),
                          ),
                        );
                      }
                    : null,
                leading: Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: AppColors.leaf50,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  alignment: Alignment.center,
                  child: Icon(
                    AppCatalog.categoryIcon(dest?.category),
                    color: AppColors.leaf700,
                    size: 22,
                  ),
                ),
                title: Text(
                  dest?.name ?? 'Điểm đến Đồng Tháp',
                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
                ),
                subtitle: Text(
                  '${AppCatalog.areaLabel(dest?.area)} • ${AppFormatters.formatDateTime(ci.completedAt)}',
                  style: const TextStyle(fontSize: 11, color: AppColors.river500),
                ),
                trailing: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.leaf50,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    '+${ci.scoreAwarded} đ',
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: AppColors.leaf700,
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 16),

          // Completed Challenges Section
          _PassportHistorySection(
            title: '🧩 Thử thách văn hóa đã vượt qua (${passport.completions.length})',
            emptyText: 'Chưa có thử thách nào hoàn thành. Quét mã QR tại điểm đến để giải đố văn hóa!',
            children: passport.completions.map((cc) {
              final dest = cc.destination;
              return ListTile(
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                onTap: dest != null
                    ? () {
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => DestinationDetailScreen(
                              slug: dest.slug,
                              appState: widget.appState,
                            ),
                          ),
                        );
                      }
                    : null,
                leading: Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: AppColors.teal50,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.teal200),
                  ),
                  alignment: Alignment.center,
                  child: const Text('🏆', style: TextStyle(fontSize: 20)),
                ),
                title: Text(
                  cc.challengeTitle ?? 'Thử thách văn hóa',
                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
                ),
                subtitle: Text(
                  '${dest?.name ?? 'Đồng Tháp'} • ${AppFormatters.formatDateTime(cc.completedAt)}',
                  style: const TextStyle(fontSize: 11, color: AppColors.river500),
                ),
                trailing: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.teal50,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    '+${cc.scoreAwarded} đ',
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: AppColors.teal800,
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }
}

class _PassportStatCard extends StatelessWidget {
  final String emoji;
  final String label;
  final String value;
  final Color color;

  const _PassportStatCard({
    required this.emoji,
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.sand200),
      ),
      child: Row(
        children: [
          Text(emoji, style: const TextStyle(fontSize: 24)),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  value,
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
                    color: color,
                  ),
                ),
                Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: AppColors.river600,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _PassportHistorySection extends StatelessWidget {
  final String title;
  final String emptyText;
  final List<Widget> children;

  const _PassportHistorySection({
    required this.title,
    required this.emptyText,
    required this.children,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.sand200),
      ),
      child: Material(
        color: Colors.transparent,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w800,
                color: AppColors.river900,
              ),
            ),
            const SizedBox(height: 8),
            if (children.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 16),
                child: Text(
                  emptyText,
                  style: const TextStyle(fontSize: 12, color: AppColors.river500),
                ),
              )
            else
              ...children,
          ],
        ),
      ),
    );
  }
}
