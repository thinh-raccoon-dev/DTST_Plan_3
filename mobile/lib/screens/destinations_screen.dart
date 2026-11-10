import 'package:flutter/material.dart';

import '../models/api_models.dart';
import '../services/api_client.dart';
import '../state/app_state.dart';
import '../theme/app_theme.dart';
import '../widgets/common_widgets.dart';
import 'destination_detail_screen.dart';

class DestinationsScreen extends StatefulWidget {
  final AppState appState;

  const DestinationsScreen({super.key, required this.appState});

  @override
  State<DestinationsScreen> createState() => _DestinationsScreenState();
}

class _DestinationsScreenState extends State<DestinationsScreen> {
  final TextEditingController _searchController = TextEditingController();
  final List<String> _selectedCategories = [];
  final List<String> _selectedAreas = [];
  bool _hasActivity = false;

  List<DestinationSummary> _items = const [];
  int _total = 0;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _consumeQuickFilters();
    widget.appState.addListener(_onAppStateChanged);
    _load();
  }

  @override
  void dispose() {
    widget.appState.removeListener(_onAppStateChanged);
    _searchController.dispose();
    super.dispose();
  }

  void _onAppStateChanged() {
    if (widget.appState.quickCategoryFilter != null ||
        widget.appState.quickSearchQuery != null ||
        widget.appState.quickHasActivityFilter) {
      setState(_consumeQuickFilters);
      _load();
    }
  }

  void _consumeQuickFilters() {
    final qCat = widget.appState.quickCategoryFilter;
    final qSearch = widget.appState.quickSearchQuery;
    final qAct = widget.appState.quickHasActivityFilter;
    if (qCat != null) {
      _selectedCategories
        ..clear()
        ..add(qCat);
    }
    if (qSearch != null) {
      _searchController.text = qSearch;
    }
    if (qAct) {
      _hasActivity = true;
    }
    widget.appState.clearQuickExploreFilters();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await ApiClient.instance.getDestinations(
        q: _searchController.text,
        categories: _selectedCategories,
        areas: _selectedAreas,
        hasActivity: _hasActivity,
        limit: 24,
      );
      if (!mounted) return;
      setState(() {
        _items = res.items;
        _total = res.total;
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

  void _resetFilters() {
    setState(() {
      _searchController.clear();
      _selectedCategories.clear();
      _selectedAreas.clear();
      _hasActivity = false;
    });
    _load();
  }

  Future<void> _openFilterSheet() async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(26)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => DraggableScrollableSheet(
          expand: false,
          initialChildSize: 0.72,
          maxChildSize: 0.9,
          minChildSize: 0.45,
          builder: (_, scrollController) => ListView(
            controller: scrollController,
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Bộ lọc điểm đến',
                    style: TextStyle(fontSize: 19, fontWeight: FontWeight.w800),
                  ),
                  TextButton(
                    onPressed: () {
                      setModalState(() {
                        _selectedCategories.clear();
                        _selectedAreas.clear();
                        _hasActivity = false;
                      });
                    },
                    child: const Text('Đặt lại'),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                activeThumbColor: AppColors.leaf600,
                title: const Text(
                  'Chỉ hiện điểm có Trạm QR / Thử thách',
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                ),
                subtitle: const Text(
                  'Các điểm thí điểm có thể quét QR check-in và nhận điểm',
                  style: TextStyle(fontSize: 12),
                ),
                value: _hasActivity,
                onChanged: (v) => setModalState(() => _hasActivity = v),
              ),
              const Divider(height: 24, color: AppColors.sand200),
              const Text(
                'Nhóm trải nghiệm',
                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14.5),
              ),
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: AppCatalog.categories.map((cat) {
                  final selected = _selectedCategories.contains(cat.value);
                  return FilterChip(
                    selected: selected,
                    selectedColor: AppColors.leaf100,
                    checkmarkColor: AppColors.leaf800,
                    avatar: Icon(cat.icon, size: 16, color: AppColors.leaf700),
                    label: Text(cat.label),
                    onSelected: (on) {
                      setModalState(() {
                        if (on) {
                          _selectedCategories.add(cat.value);
                        } else {
                          _selectedCategories.remove(cat.value);
                        }
                      });
                    },
                  );
                }).toList(),
              ),
              const SizedBox(height: 20),
              const Text(
                'Khu vực',
                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14.5),
              ),
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: AppCatalog.areas.map((area) {
                  final selected = _selectedAreas.contains(area.value);
                  return FilterChip(
                    selected: selected,
                    selectedColor: AppColors.leaf100,
                    checkmarkColor: AppColors.leaf800,
                    label: Text(area.label),
                    onSelected: (on) {
                      setModalState(() {
                        if (on) {
                          _selectedAreas.add(area.value);
                        } else {
                          _selectedAreas.remove(area.value);
                        }
                      });
                    },
                  );
                }).toList(),
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () {
                    Navigator.of(ctx).pop();
                    setState(() {});
                    _load();
                  },
                  child: const Text('Áp dụng bộ lọc'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final activeFilterCount =
        _selectedCategories.length + _selectedAreas.length + (_hasActivity ? 1 : 0);

    return RefreshIndicator(
      color: AppColors.leaf600,
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 36),
        children: [
          // Header
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: AppColors.heroGradient,
              borderRadius: BorderRadius.circular(24),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'BẢN ĐỒ ĐIỂM ĐẾN ĐỒNG THÁP',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.4,
                    color: AppColors.teal200,
                  ),
                ),
                const SizedBox(height: 6),
                const Text(
                  'Khám phá địa điểm',
                  style: TextStyle(
                    fontSize: 23,
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 6),
                const Text(
                  'Tìm kiếm theo từ khóa, lọc theo nhóm trải nghiệm, khu vực hoặc điểm có trạm QR đang hoạt động.',
                  style: TextStyle(
                    fontSize: 13,
                    color: AppColors.leaf100,
                  ),
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _searchController,
                        textInputAction: TextInputAction.search,
                        onSubmitted: (_) => _load(),
                        decoration: InputDecoration(
                          hintText: 'Tìm địa điểm, món ăn, di tích...',
                          prefixIcon: const Icon(Icons.search_rounded, color: AppColors.leaf700),
                          suffixIcon: _searchController.text.isNotEmpty
                              ? IconButton(
                                  icon: const Icon(Icons.clear_rounded, size: 18),
                                  onPressed: () {
                                    _searchController.clear();
                                    _load();
                                  },
                                )
                              : null,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Badge(
                      isLabelVisible: activeFilterCount > 0,
                      label: Text('$activeFilterCount'),
                      backgroundColor: AppColors.teal500,
                      child: IconButton.filled(
                        style: IconButton.styleFrom(
                          backgroundColor: Colors.white,
                          foregroundColor: AppColors.leaf800,
                          minimumSize: const Size(48, 48),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                          ),
                        ),
                        onPressed: _openFilterSheet,
                        icon: const Icon(Icons.tune_rounded),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          const SizedBox(height: 12),

          // Quick horizontal category filter chips
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                FilterChip(
                  selected: _hasActivity,
                  selectedColor: AppColors.teal100,
                  checkmarkColor: AppColors.teal800,
                  avatar: const Icon(Icons.qr_code_2_rounded, size: 16, color: AppColors.teal800),
                  label: const Text('Có QR / Thử thách'),
                  onSelected: (on) {
                    setState(() => _hasActivity = on);
                    _load();
                  },
                ),
                const SizedBox(width: 8),
                ...AppCatalog.categories.map((cat) {
                  final selected = _selectedCategories.contains(cat.value);
                  return Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: FilterChip(
                      selected: selected,
                      selectedColor: AppColors.leaf100,
                      checkmarkColor: AppColors.leaf800,
                      label: Text(cat.label),
                      onSelected: (on) {
                        setState(() {
                          if (on) {
                            _selectedCategories.add(cat.value);
                          } else {
                            _selectedCategories.remove(cat.value);
                          }
                        });
                        _load();
                      },
                    ),
                  );
                }),
              ],
            ),
          ),

          const SizedBox(height: 12),

          // Summary row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                _loading ? 'Đang tải danh sách...' : 'Tìm thấy $_total địa điểm',
                style: const TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w700,
                  color: AppColors.river700,
                ),
              ),
              if (activeFilterCount > 0 || _searchController.text.isNotEmpty)
                TextButton(
                  onPressed: _resetFilters,
                  child: const Text('Xóa bộ lọc'),
                ),
            ],
          ),

          const SizedBox(height: 8),

          if (_loading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 48),
              child: Center(
                child: CircularProgressIndicator(color: AppColors.leaf600),
              ),
            )
          else if (_error != null)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  children: [
                    Text(
                      _error!,
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: AppColors.river600),
                    ),
                    const SizedBox(height: 12),
                    ElevatedButton.icon(
                      onPressed: _load,
                      icon: const Icon(Icons.refresh_rounded),
                      label: const Text('Thử lại'),
                    ),
                  ],
                ),
              ),
            )
          else if (_items.isEmpty)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(26),
                child: Column(
                  children: [
                    const Icon(Icons.travel_explore_rounded, size: 44, color: AppColors.river400),
                    const SizedBox(height: 10),
                    const Text(
                      'Không tìm thấy địa điểm phù hợp',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Hãy thử từ khóa khác hoặc bỏ bớt bộ lọc.',
                      style: TextStyle(fontSize: 13, color: AppColors.river600),
                    ),
                    const SizedBox(height: 14),
                    OutlinedButton(
                      onPressed: _resetFilters,
                      child: const Text('Xóa tìm kiếm & bộ lọc'),
                    ),
                  ],
                ),
              ),
            )
          else
            ..._items.map(
              (d) => Padding(
                padding: const EdgeInsets.only(bottom: 14),
                child: DestinationCardWidget(
                  destination: d,
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => DestinationDetailScreen(
                          slug: d.slug,
                          appState: widget.appState,
                        ),
                      ),
                    );
                  },
                ),
              ),
            ),
        ],
      ),
    );
  }
}
