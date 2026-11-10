import 'package:flutter/foundation.dart';

import '../models/api_models.dart';
import '../services/api_client.dart';

class AppState extends ChangeNotifier {
  final ApiClient api = ApiClient.instance;

  AuthUser? _user;
  bool _loadingSession = true;
  bool _serverOnline = true;
  int _currentTabIndex = 0;

  // Bộ lọc nhanh khi chuyển từ Trang chủ sang tab Khám phá
  String? _quickCategoryFilter;
  String? _quickSearchQuery;
  bool _quickHasActivityFilter = false;

  // Tập hợp ID địa điểm yêu thích
  final Set<String> _favoriteIds = {};

  // Bộ đếm để tự động làm mới Hộ chiếu & Lịch trình khi có thay đổi
  int _passportRefreshTick = 0;
  int _itinerariesRefreshTick = 0;

  AuthUser? get user => _user;
  bool get loadingSession => _loadingSession;
  bool get serverOnline => _serverOnline;
  int get currentTabIndex => _currentTabIndex;
  String? get quickCategoryFilter => _quickCategoryFilter;
  String? get quickSearchQuery => _quickSearchQuery;
  bool get quickHasActivityFilter => _quickHasActivityFilter;
  Set<String> get favoriteIds => _favoriteIds;
  int get passportRefreshTick => _passportRefreshTick;
  int get itinerariesRefreshTick => _itinerariesRefreshTick;

  Future<void> initialize() async {
    _loadingSession = true;
    notifyListeners();
    try {
      await api.init();
      _serverOnline = await api.checkHealth();
      _user = await api.getMe();
      if (_user != null) {
        await refreshFavorites();
      }
    } catch (_) {
      _serverOnline = false;
    } finally {
      _loadingSession = false;
      notifyListeners();
    }
  }

  Future<void> checkServerConnection() async {
    _serverOnline = await api.checkHealth();
    if (_serverOnline && _user == null) {
      try {
        _user = await api.getMe();
        if (_user != null) {
          await refreshFavorites();
        }
      } catch (_) {}
    }
    notifyListeners();
  }

  void setTabIndex(int index) {
    if (_currentTabIndex == index) return;
    _currentTabIndex = index;
    notifyListeners();
  }

  /// Chuyển sang tab Khám phá (index 1) kèm bộ lọc danh mục hoặc từ khóa.
  void navigateToExplore({
    String? category,
    String? query,
    bool hasActivity = false,
  }) {
    _quickCategoryFilter = category;
    _quickSearchQuery = query;
    _quickHasActivityFilter = hasActivity;
    _currentTabIndex = 1;
    notifyListeners();
  }

  void clearQuickExploreFilters() {
    _quickCategoryFilter = null;
    _quickSearchQuery = null;
    _quickHasActivityFilter = false;
  }

  void notifyPassportUpdated() {
    _passportRefreshTick++;
    notifyListeners();
  }

  void notifyItinerariesUpdated() {
    _itinerariesRefreshTick++;
    notifyListeners();
  }

  Future<AuthUser> login(String email, String password) async {
    final loggedIn = await api.login(email, password);
    _user = loggedIn;
    _serverOnline = true;
    await refreshFavorites();
    _passportRefreshTick++;
    _itinerariesRefreshTick++;
    notifyListeners();
    return loggedIn;
  }

  Future<AuthUser> register({
    required String displayName,
    required String email,
    required String password,
  }) async {
    final created = await api.register(
      displayName: displayName,
      email: email,
      password: password,
    );
    _user = created;
    _serverOnline = true;
    _favoriteIds.clear();
    _passportRefreshTick++;
    _itinerariesRefreshTick++;
    notifyListeners();
    return created;
  }

  Future<void> logout() async {
    await api.logout();
    _user = null;
    _favoriteIds.clear();
    _passportRefreshTick++;
    _itinerariesRefreshTick++;
    notifyListeners();
  }

  Future<AuthUser> updateProfile({
    required String displayName,
    required UserPreferences preferences,
    String? currentPassword,
    String? newPassword,
  }) async {
    final updated = await api.updateProfile(
      displayName: displayName,
      preferences: preferences,
      currentPassword: currentPassword,
      newPassword: newPassword,
    );
    _user = updated;
    notifyListeners();
    return updated;
  }

  Future<void> refreshFavorites() async {
    if (_user == null) {
      _favoriteIds.clear();
      notifyListeners();
      return;
    }
    try {
      final list = await api.getFavorites();
      _favoriteIds
        ..clear()
        ..addAll(list.map((d) => d.id));
      notifyListeners();
    } catch (_) {}
  }

  bool isFavorite(String destinationId) => _favoriteIds.contains(destinationId);

  Future<bool> toggleFavorite(String destinationId) async {
    final currentlyFav = _favoriteIds.contains(destinationId);
    if (currentlyFav) {
      _favoriteIds.remove(destinationId);
      notifyListeners();
      try {
        await api.removeFavorite(destinationId);
        return false;
      } catch (e) {
        _favoriteIds.add(destinationId);
        notifyListeners();
        rethrow;
      }
    } else {
      _favoriteIds.add(destinationId);
      notifyListeners();
      try {
        await api.addFavorite(destinationId);
        return true;
      } catch (e) {
        _favoriteIds.remove(destinationId);
        notifyListeners();
        rethrow;
      }
    }
  }
}
