import 'package:flutter/material.dart';

import 'screens/auth_profile_screen.dart';
import 'screens/destinations_screen.dart';
import 'screens/home_screen.dart';
import 'screens/passport_screen.dart';
import 'screens/qr_scan_screen.dart';
import 'screens/trip_planner_screen.dart';
import 'state/app_state.dart';
import 'theme/app_theme.dart';
import 'widgets/common_widgets.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const DtstMobileApp());
}

class DtstMobileApp extends StatefulWidget {
  const DtstMobileApp({super.key});

  @override
  State<DtstMobileApp> createState() => _DtstMobileAppState();
}

class _DtstMobileAppState extends State<DtstMobileApp> {
  final AppState _appState = AppState();

  @override
  void initState() {
    super.initState();
    _appState.initialize();
  }

  @override
  void dispose() {
    _appState.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Du lịch số Đồng Tháp',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      builder: (context, child) {
        return Container(
          color: const Color(0xFFE8EFE8),
          alignment: Alignment.center,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 520),
            child: child != null ? ClipRect(child: child) : const SizedBox.shrink(),
          ),
        );
      },
      home: DtstMainShell(appState: _appState),
    );
  }
}

class DtstMainShell extends StatelessWidget {
  final AppState appState;

  const DtstMainShell({super.key, required this.appState});

  @override
  Widget build(BuildContext context) {
    final tabs = [
      HomeScreen(appState: appState),
      DestinationsScreen(appState: appState),
      QrScanScreen(appState: appState),
      TripPlannerScreen(appState: appState),
      PassportScreen(appState: appState),
    ];

    return ListenableBuilder(
      listenable: appState,
      builder: (context, _) {
        final currentIndex = appState.currentTabIndex.clamp(0, tabs.length - 1);
        final user = appState.user;

        return Scaffold(
          appBar: AppBar(
            titleSpacing: 14,
            title: Row(
              children: [
                Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    gradient: AppColors.heroGradient,
                    borderRadius: BorderRadius.circular(11),
                  ),
                  alignment: Alignment.center,
                  child: const Text('🌸', style: TextStyle(fontSize: 18)),
                ),
                const SizedBox(width: 10),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Du lịch số Đồng Tháp',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w800,
                          color: AppColors.river900,
                          height: 1.15,
                        ),
                      ),
                      Text(
                        'Hộ chiếu trải nghiệm & AI V9 • v1.0',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 10.5,
                          fontWeight: FontWeight.w600,
                          color: AppColors.leaf700,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            actions: [
              // Favorites button
              IconButton(
                onPressed: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => AuthProfileScreen(
                        appState: appState,
                        initialSection: 1,
                      ),
                    ),
                  );
                },
                tooltip: 'Điểm đến yêu thích',
                icon: Badge(
                  isLabelVisible: appState.favoriteIds.isNotEmpty,
                  label: Text('${appState.favoriteIds.length}'),
                  backgroundColor: AppColors.lotus600,
                  child: const Icon(Icons.favorite_border_rounded, size: 22),
                ),
              ),
              // Server URL Config button with live connection indicator
              IconButton(
                onPressed: () => showServerConfigDialog(context, appState),
                tooltip: appState.serverOnline
                    ? 'Máy chủ: Đang kết nối (${appState.api.baseUrl})'
                    : 'Máy chủ: Mất kết nối (${appState.api.baseUrl})',
                icon: Stack(
                  clipBehavior: Clip.none,
                  children: [
                    const Icon(Icons.dns_outlined, size: 21),
                    Positioned(
                      right: -2,
                      top: -2,
                      child: Container(
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: appState.serverOnline
                              ? const Color(0xFF2E7D32)
                              : Colors.red.shade600,
                          border: Border.all(color: Colors.white, width: 1.5),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              // Account / Login pill
              Padding(
                padding: const EdgeInsets.only(right: 12),
                child: InkWell(
                  borderRadius: BorderRadius.circular(20),
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => AuthProfileScreen(
                          appState: appState,
                          initialSection: 0,
                        ),
                      ),
                    );
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: user != null ? AppColors.leaf50 : AppColors.sand100,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: user != null ? AppColors.leaf200 : AppColors.sand200,
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          user != null
                              ? Icons.verified_user_rounded
                              : Icons.person_outline_rounded,
                          size: 16,
                          color: user != null ? AppColors.leaf700 : AppColors.river700,
                        ),
                        const SizedBox(width: 5),
                        Text(
                          user != null
                              ? user.displayName.split(' ').last
                              : 'Tài khoản',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                            color: user != null ? AppColors.leaf800 : AppColors.river800,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
          body: IndexedStack(
            index: currentIndex,
            children: tabs,
          ),
          bottomNavigationBar: NavigationBar(
            selectedIndex: currentIndex,
            onDestinationSelected: (idx) => appState.setTabIndex(idx),
            height: 68,
            destinations: const [
              NavigationDestination(
                icon: Icon(Icons.home_outlined),
                selectedIcon: Icon(Icons.home_rounded, color: AppColors.leaf700),
                label: 'Trang chủ',
              ),
              NavigationDestination(
                icon: Icon(Icons.explore_outlined),
                selectedIcon: Icon(Icons.explore_rounded, color: AppColors.leaf700),
                label: 'Khám phá',
              ),
              NavigationDestination(
                icon: Icon(Icons.qr_code_scanner_rounded),
                selectedIcon: Icon(Icons.qr_code_scanner_rounded, color: AppColors.leaf700),
                label: 'Quét QR',
              ),
              NavigationDestination(
                icon: Icon(Icons.auto_awesome_outlined),
                selectedIcon: Icon(Icons.auto_awesome_rounded, color: AppColors.leaf700),
                label: 'Lịch trình AI',
              ),
              NavigationDestination(
                icon: Icon(Icons.workspace_premium_outlined),
                selectedIcon: Icon(Icons.workspace_premium_rounded, color: AppColors.leaf700),
                label: 'Hộ chiếu',
              ),
            ],
          ),
        );
      },
    );
  }
}
