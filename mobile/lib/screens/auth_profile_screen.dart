import 'package:flutter/material.dart';

import '../models/api_models.dart';
import '../services/api_client.dart';
import '../state/app_state.dart';
import '../theme/app_theme.dart';
import '../widgets/common_widgets.dart';
import 'destination_detail_screen.dart';

class AuthProfileScreen extends StatefulWidget {
  final AppState appState;
  final int initialSection; // 0: Hồ sơ/Auth, 1: Yêu thích

  const AuthProfileScreen({
    super.key,
    required this.appState,
    this.initialSection = 0,
  });

  @override
  State<AuthProfileScreen> createState() => _AuthProfileScreenState();
}

class _AuthProfileScreenState extends State<AuthProfileScreen> {
  bool _isLoginMode = true;
  bool _submitting = false;
  String? _error;
  String? _successMsg;

  // Auth & Profile controllers
  final TextEditingController _nameCtrl = TextEditingController();
  final TextEditingController _emailCtrl = TextEditingController();
  final TextEditingController _passwordCtrl = TextEditingController();

  // Profile preferences state (UserPreferences: areas, interests, numberOfDays, hoursPerDay)
  Set<String> _selectedInterests = {};
  Set<String> _selectedAreas = {};
  int _numberOfDays = 2;
  int _hoursPerDay = 8;

  // Active tab when logged in (0 = Hồ sơ & Sở thích, 1 = Điểm đến yêu thích)
  late int _activeTab;

  // Favorites list
  List<DestinationSummary> _favorites = const [];
  bool _loadingFavorites = false;

  @override
  void initState() {
    super.initState();
    _activeTab = widget.initialSection;
    _syncUserToForm();
    if (widget.appState.user != null) {
      _loadFavorites();
    }
  }

  void _syncUserToForm() {
    final user = widget.appState.user;
    if (user != null) {
      _nameCtrl.text = user.displayName;
      _emailCtrl.text = user.email;
      _selectedInterests = user.preferences.interests.toSet();
      _selectedAreas = user.preferences.areas.toSet();
      _numberOfDays = user.preferences.numberOfDays;
      _hoursPerDay = user.preferences.hoursPerDay;
    }
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _emailCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadFavorites() async {
    if (widget.appState.user == null) return;
    setState(() => _loadingFavorites = true);
    try {
      final list = await ApiClient.instance.getFavorites();
      if (!mounted) return;
      setState(() {
        _favorites = list;
        _loadingFavorites = false;
      });
    } catch (_) {
      if (mounted) {
        setState(() => _loadingFavorites = false);
      }
    }
  }

  Future<void> _submitAuth() async {
    final email = _emailCtrl.text.trim();
    final password = _passwordCtrl.text;
    final name = _nameCtrl.text.trim();

    if (email.isEmpty || password.isEmpty) {
      setState(() => _error = 'Vui lòng nhập đầy đủ Email và Mật khẩu.');
      return;
    }
    if (!_isLoginMode && name.length < 2) {
      setState(() => _error = 'Tên hiển thị cần tối thiểu 2 ký tự.');
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
      _successMsg = null;
    });

    try {
      if (_isLoginMode) {
        await widget.appState.login(email, password);
      } else {
        await widget.appState.register(
          displayName: name,
          email: email,
          password: password,
        );
      }
      _syncUserToForm();
      await _loadFavorites();
      if (!mounted) return;
      setState(() {
        _successMsg = _isLoginMode
            ? 'Đăng nhập thành công! Bạn có thể đồng bộ Hộ chiếu trải nghiệm và lưu Lịch trình AI.'
            : 'Đăng ký tài khoản thành công!';
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) {
        setState(() => _submitting = false);
      }
    }
  }

  Future<void> _saveProfile() async {
    final displayName = _nameCtrl.text.trim();
    if (displayName.length < 2) {
      setState(() => _error = 'Tên hiển thị cần tối thiểu 2 ký tự.');
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
      _successMsg = null;
    });

    try {
      await widget.appState.updateProfile(
        displayName: displayName,
        preferences: UserPreferences(
          areas: _selectedAreas.toList(),
          interests: _selectedInterests.toList(),
          numberOfDays: _numberOfDays,
          hoursPerDay: _hoursPerDay,
        ),
      );
      if (!mounted) return;
      setState(() {
        _successMsg = 'Đã lưu hồ sơ & sở thích du lịch thành công!';
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Đã cập nhật hồ sơ & sở thích du lịch'),
          backgroundColor: AppColors.leaf600,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) {
        setState(() => _submitting = false);
      }
    }
  }

  Future<void> _handleLogout() async {
    await widget.appState.logout();
    if (!mounted) return;
    setState(() {
      _favorites = const [];
      _passwordCtrl.clear();
      _successMsg = 'Đã đăng xuất khỏi tài khoản.';
    });
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: widget.appState,
      builder: (context, _) {
        final user = widget.appState.user;
        return Scaffold(
          appBar: AppBar(
            title: Text(
              user != null
                  ? 'Tài khoản & Yêu thích'
                  : (_isLoginMode ? 'Đăng nhập' : 'Đăng ký tài khoản'),
            ),
            actions: [
              IconButton(
                onPressed: () => showServerConfigDialog(context, widget.appState),
                icon: const Icon(Icons.dns_outlined),
                tooltip: 'Cấu hình máy chủ API',
              ),
              if (user != null)
                IconButton(
                  onPressed: _handleLogout,
                  icon: Icon(Icons.logout_rounded, color: Colors.red.shade700),
                  tooltip: 'Đăng xuất',
                ),
            ],
          ),
          body: user == null ? _buildAuthView() : _buildLoggedInView(user),
        );
      },
    );
  }

  Widget _buildAuthView() {
    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 36),
      children: [
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            gradient: AppColors.heroGradient,
            borderRadius: BorderRadius.circular(24),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.16),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Text(
                  '🌸 Du lịch số Đồng Tháp v1.0',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Text(
                _isLoginMode
                    ? 'Đăng nhập để đồng bộ Hộ chiếu số & Lịch trình AI'
                    : 'Tạo tài khoản khám phá Đất Sen Hồng',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                  height: 1.25,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Mọi điểm thưởng, huy hiệu và lượt check-in QR khi dùng thử ở chế độ Khách trên thiết bị có thể gộp vào tài khoản chỉ với 1 chạm.',
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.85),
                  fontSize: 12,
                  height: 1.4,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // Mode switcher
        Container(
          padding: const EdgeInsets.all(4),
          decoration: BoxDecoration(
            color: AppColors.sand100,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.sand200),
          ),
          child: Row(
            children: [
              Expanded(
                child: GestureDetector(
                  onTap: () => setState(() {
                    _isLoginMode = true;
                    _error = null;
                  }),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    decoration: BoxDecoration(
                      color: _isLoginMode ? Colors.white : Colors.transparent,
                      borderRadius: BorderRadius.circular(10),
                      boxShadow: _isLoginMode
                          ? [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.05),
                                blurRadius: 4,
                              ),
                            ]
                          : null,
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      'Đăng nhập',
                      style: TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 13,
                        color: _isLoginMode ? AppColors.leaf700 : AppColors.river600,
                      ),
                    ),
                  ),
                ),
              ),
              Expanded(
                child: GestureDetector(
                  onTap: () => setState(() {
                    _isLoginMode = false;
                    _error = null;
                  }),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    decoration: BoxDecoration(
                      color: !_isLoginMode ? Colors.white : Colors.transparent,
                      borderRadius: BorderRadius.circular(10),
                      boxShadow: !_isLoginMode
                          ? [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.05),
                                blurRadius: 4,
                              ),
                            ]
                          : null,
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      'Đăng ký mới',
                      style: TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 13,
                        color: !_isLoginMode ? AppColors.leaf700 : AppColors.river600,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        if (_error != null) ...[
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.red.shade50,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: Colors.red.shade200),
            ),
            child: Text(
              _error!,
              style: TextStyle(
                color: Colors.red.shade800,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          const SizedBox(height: 12),
        ],

        if (_successMsg != null) ...[
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.leaf50,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.leaf200),
            ),
            child: Text(
              _successMsg!,
              style: const TextStyle(
                color: AppColors.leaf800,
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(height: 12),
        ],

        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: AppColors.sand200),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (!_isLoginMode) ...[
                TextField(
                  controller: _nameCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Tên hiển thị *',
                    prefixIcon: Icon(Icons.person_outline_rounded),
                  ),
                ),
                const SizedBox(height: 12),
              ],
              TextField(
                controller: _emailCtrl,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(
                  labelText: 'Địa chỉ Email *',
                  prefixIcon: Icon(Icons.email_outlined),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _passwordCtrl,
                obscureText: true,
                decoration: const InputDecoration(
                  labelText: 'Mật khẩu * (tối thiểu 8 ký tự)',
                  prefixIcon: Icon(Icons.lock_outline_rounded),
                ),
              ),
              if (_isLoginMode) ...[
                const SizedBox(height: 12),
                const Text(
                  'Chạm để điền nhanh tài khoản Test:',
                  style: TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w700,
                    color: AppColors.river600,
                  ),
                ),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 8,
                  runSpacing: 6,
                  children: [
                    ActionChip(
                      avatar: const Icon(Icons.person_rounded, size: 16, color: AppColors.leaf700),
                      label: const Text(
                        'Du khách (dukhach@dongthap.vn)',
                        style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700),
                      ),
                      backgroundColor: AppColors.leaf50,
                      side: const BorderSide(color: AppColors.leaf200),
                      onPressed: () {
                        setState(() {
                          _emailCtrl.text = 'dukhach@dongthap.vn';
                          _passwordCtrl.text = 'DongThap123!';
                        });
                      },
                    ),
                    ActionChip(
                      avatar: const Icon(Icons.admin_panel_settings_rounded, size: 16, color: AppColors.teal800),
                      label: const Text(
                        'Quản trị viên (admin@example.com)',
                        style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700),
                      ),
                      backgroundColor: AppColors.teal50,
                      side: const BorderSide(color: AppColors.teal200),
                      onPressed: () {
                        setState(() {
                          _emailCtrl.text = 'admin@example.com';
                          _passwordCtrl.text = 'Dt-FbhNoHLx8l90';
                        });
                      },
                    ),
                  ],
                ),
              ],
              const SizedBox(height: 18),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: _submitting ? null : _submitAuth,
                  icon: _submitting
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : Icon(_isLoginMode ? Icons.login_rounded : Icons.person_add_alt_1_rounded),
                  label: Text(
                    _submitting
                        ? 'Đang xử lý...'
                        : (_isLoginMode ? 'Đăng nhập ngay' : 'Tạo tài khoản'),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildLoggedInView(AuthUser user) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 36),
      children: [
        // User Hero Card
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            gradient: AppColors.heroGradient,
            borderRadius: BorderRadius.circular(22),
          ),
          child: Row(
            children: [
              CircleAvatar(
                radius: 28,
                backgroundColor: Colors.white.withValues(alpha: 0.2),
                child: Text(
                  user.displayName.isNotEmpty ? user.displayName[0].toUpperCase() : 'U',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      user.displayName,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      user.email,
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.8),
                        fontSize: 12,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 6,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.16),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(
                            user.role == 'admin' ? '👑 Quản trị viên' : '🌿 Du khách Đất Sen Hồng',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: AppColors.lotus500.withValues(alpha: 0.35),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(
                            '❤️ ${widget.appState.favoriteIds.length} yêu thích',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
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

        // Sub-tab switcher: Hồ sơ & Sở thích vs Điểm đến yêu thích
        Container(
          padding: const EdgeInsets.all(4),
          decoration: BoxDecoration(
            color: AppColors.sand100,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.sand200),
          ),
          child: Row(
            children: [
              Expanded(
                child: GestureDetector(
                  onTap: () => setState(() => _activeTab = 0),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    decoration: BoxDecoration(
                      color: _activeTab == 0 ? Colors.white : Colors.transparent,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      '⚙️ Hồ sơ & Sở thích',
                      style: TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 13,
                        color: _activeTab == 0 ? AppColors.leaf700 : AppColors.river600,
                      ),
                    ),
                  ),
                ),
              ),
              Expanded(
                child: GestureDetector(
                  onTap: () {
                    setState(() => _activeTab = 1);
                    _loadFavorites();
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    decoration: BoxDecoration(
                      color: _activeTab == 1 ? Colors.white : Colors.transparent,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      '❤️ Yêu thích (${widget.appState.favoriteIds.length})',
                      style: TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 13,
                        color: _activeTab == 1 ? AppColors.lotus700 : AppColors.river600,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        if (_activeTab == 0) _buildProfileForm() else _buildFavoritesSection(),
      ],
    );
  }

  Widget _buildProfileForm() {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.sand200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Thông tin cá nhân',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              color: AppColors.river900,
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _nameCtrl,
            decoration: const InputDecoration(
              labelText: 'Tên hiển thị',
              prefixIcon: Icon(Icons.person_outline_rounded),
            ),
          ),
          const SizedBox(height: 20),
          const Text(
            'Sở thích du lịch (Dùng cho Gợi ý & AI Trip Planner)',
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w800,
              color: AppColors.river900,
            ),
          ),
          const SizedBox(height: 10),
          const Text(
            'Loại hình yêu thích:',
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.river600),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: AppCatalog.categories.map((cat) {
              final selected = _selectedInterests.contains(cat.value);
              return FilterChip(
                selected: selected,
                onSelected: (val) {
                  setState(() {
                    if (val) {
                      _selectedInterests.add(cat.value);
                    } else {
                      _selectedInterests.remove(cat.value);
                    }
                  });
                },
                avatar: Icon(cat.icon, size: 16, color: AppColors.leaf700),
                label: Text(cat.label),
                selectedColor: AppColors.leaf100,
                checkmarkColor: AppColors.leaf700,
              );
            }).toList(),
          ),
          const SizedBox(height: 16),
          const Text(
            'Khu vực ưu tiên tại Đồng Tháp:',
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.river600),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: AppCatalog.areas.map((area) {
              final selected = _selectedAreas.contains(area.value);
              return FilterChip(
                selected: selected,
                onSelected: (val) {
                  setState(() {
                    if (val) {
                      _selectedAreas.add(area.value);
                    } else {
                      _selectedAreas.remove(area.value);
                    }
                  });
                },
                label: Text(area.label),
                selectedColor: AppColors.teal100,
                checkmarkColor: AppColors.teal800,
              );
            }).toList(),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<int>(
                  initialValue: _numberOfDays.clamp(1, 5),
                  decoration: const InputDecoration(labelText: 'Số ngày mặc định'),
                  items: [1, 2, 3, 4, 5]
                      .map((d) => DropdownMenuItem(value: d, child: Text('$d ngày')))
                      .toList(),
                  onChanged: (v) {
                    if (v != null) setState(() => _numberOfDays = v);
                  },
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: DropdownButtonFormField<int>(
                  initialValue: _hoursPerDay.clamp(4, 12),
                  decoration: const InputDecoration(labelText: 'Thời lượng/ngày'),
                  items: [4, 6, 8, 10, 12]
                      .map((h) => DropdownMenuItem(value: h, child: Text('$h giờ/ngày')))
                      .toList(),
                  onChanged: (v) {
                    if (v != null) setState(() => _hoursPerDay = v);
                  },
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: _submitting ? null : _saveProfile,
              icon: const Icon(Icons.save_outlined),
              label: Text(_submitting ? 'Đang lưu...' : 'Lưu hồ sơ & sở thích'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFavoritesSection() {
    if (_loadingFavorites) {
      return const Padding(
        padding: EdgeInsets.all(32),
        child: Center(child: CircularProgressIndicator()),
      );
    }

    if (_favorites.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(28),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: AppColors.sand200),
        ),
        child: const Column(
          children: [
            Icon(Icons.favorite_border_rounded, size: 44, color: AppColors.lotus600),
            SizedBox(height: 10),
            Text(
              'Chưa có điểm đến yêu thích',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
            ),
            SizedBox(height: 4),
            Text(
              'Mở chi tiết điểm đến và nhấn Lưu yêu thích để giữ lại những nơi bạn muốn ghé thăm tại Đồng Tháp.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 13, color: AppColors.river600),
            ),
          ],
        ),
      );
    }

    return Column(
      children: _favorites.map((dest) {
        return Padding(
          padding: const EdgeInsets.only(bottom: 14),
          child: DestinationCardWidget(
            destination: dest,
            onTap: () async {
              await Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => DestinationDetailScreen(
                    slug: dest.slug,
                    appState: widget.appState,
                  ),
                ),
              );
              _loadFavorites();
            },
          ),
        );
      }).toList(),
    );
  }
}
