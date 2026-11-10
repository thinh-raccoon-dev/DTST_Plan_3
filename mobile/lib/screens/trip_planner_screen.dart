import 'package:flutter/material.dart';

import '../models/api_models.dart';
import '../services/api_client.dart';
import '../state/app_state.dart';
import '../theme/app_theme.dart';
import '../widgets/v9_itinerary_view.dart';
import 'auth_profile_screen.dart';
import 'itinerary_detail_screen.dart';

const List<String> _interestPresets = [
  'sinh thái',
  'văn hóa',
  'di tích',
  'ẩm thực',
  'chụp ảnh',
  'làng nghề',
  'hoa kiểng',
  'nghỉ dưỡng',
];

class TripPlannerScreen extends StatefulWidget {
  final AppState appState;

  const TripPlannerScreen({
    super.key,
    required this.appState,
  });

  @override
  State<TripPlannerScreen> createState() => _TripPlannerScreenState();
}

class _TripPlannerScreenState extends State<TripPlannerScreen> {
  int _activeTab = 0; // 0: Lập lịch AI V9, 1: Lịch trình đã lưu

  // Planner Mode: 'ai' or 'manual'
  String _mode = 'ai';
  final TextEditingController _titleCtrl = TextEditingController();
  final TextEditingController _goalCtrl = TextEditingController(
    text: 'nghỉ dưỡng nhẹ nhàng, chụp ảnh, ăn đặc sản',
  );
  final TextEditingController _startPlaceCtrl = TextEditingController(
    text: 'TP. Cao Lãnh, Đồng Tháp',
  );
  String _startDate = DateTime.now().toIso8601String().split('T').first;
  int _days = 2;
  int _people = 2;
  double _budgetVnd = 2500000;
  String _transport = 'motorcycle';
  String _pace = 'balanced';
  final Set<String> _interests = {'sinh thái', 'ẩm thực', 'chụp ảnh'};

  // Manual place selection
  List<V9Place> _catalogPlaces = const [];
  bool _loadingCatalog = false;
  final Set<String> _selectedPlaceIds = {};
  String _placeSearch = '';

  // Generated V9 output
  V9PlanResponse? _planResponse;
  V9ItineraryObject? _itinerary;
  List<V9Place> _recommendations = const [];
  bool _generating = false;
  bool _recommending = false;
  bool _saving = false;
  String? _error;

  // Saved itineraries tab
  List<ItineraryListItem> _savedItineraries = const [];
  bool _loadingSaved = false;
  int _lastItineraryTick = 0;

  @override
  void initState() {
    super.initState();
    _lastItineraryTick = widget.appState.itinerariesRefreshTick;
    widget.appState.addListener(_onAppStateChanged);
    _loadCatalogPlaces();
    if (widget.appState.user != null) {
      _loadSavedItineraries();
    }
  }

  @override
  void dispose() {
    widget.appState.removeListener(_onAppStateChanged);
    _titleCtrl.dispose();
    _goalCtrl.dispose();
    _startPlaceCtrl.dispose();
    super.dispose();
  }

  void _onAppStateChanged() {
    if (widget.appState.itinerariesRefreshTick != _lastItineraryTick) {
      _lastItineraryTick = widget.appState.itinerariesRefreshTick;
      if (widget.appState.user != null) {
        _loadSavedItineraries();
      }
    }
  }

  Future<void> _loadCatalogPlaces() async {
    setState(() => _loadingCatalog = true);
    try {
      final res = await ApiClient.instance.getTripPlannerPlaces();
      if (!mounted) return;
      setState(() {
        _catalogPlaces = res.places;
        _loadingCatalog = false;
      });
    } catch (_) {
      try {
        final dests = await ApiClient.instance.getDestinations(limit: 50);
        if (!mounted) return;
        setState(() {
          _catalogPlaces = dests.items
              .map(
                (d) => V9Place(
                  id: d.id,
                  name: d.name,
                  role: d.category == 'food' ? 'restaurant' : 'attraction',
                  tags: d.tags,
                  visitDurationMinutes: d.estimatedVisitDuration?.minutes ?? 90,
                  summary: d.summary,
                  slug: d.slug,
                  area: d.area,
                  category: d.category,
                  imageUrl: d.imageUrl,
                ),
              )
              .toList();
          _loadingCatalog = false;
        });
      } catch (_) {
        if (mounted) setState(() => _loadingCatalog = false);
      }
    }
  }

  Future<void> _loadSavedItineraries() async {
    if (widget.appState.user == null) return;
    setState(() => _loadingSaved = true);
    try {
      final items = await ApiClient.instance.getMyItineraries();
      if (!mounted) return;
      setState(() {
        _savedItineraries = items;
        _loadingSaved = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loadingSaved = false);
    }
  }

  Map<String, dynamic> _buildPayload() {
    return {
      'mode': _mode,
      'goal': _goalCtrl.text.trim().isNotEmpty
          ? _goalCtrl.text.trim()
          : 'Khám phá Đồng Tháp',
      'days': _days,
      'people': _people,
      'budget_vnd': _budgetVnd.round(),
      'mode_of_transport': _transport,
      'start_place': _startPlaceCtrl.text.trim().isNotEmpty
          ? _startPlaceCtrl.text.trim()
          : 'TP. Cao Lãnh, Đồng Tháp',
      'start_date': _startDate,
      'interests': _interests.toList(),
      'pace': _pace,
      'include_breakfast': true,
      if (_mode == 'manual') 'selected_ids': _selectedPlaceIds.toList(),
    };
  }

  Future<void> _handleGenerateItinerary() async {
    if (_mode == 'manual' && _selectedPlaceIds.isEmpty) {
      setState(() {
        _error = 'Vui lòng chọn ít nhất 1 địa điểm khi ở chế độ Tự chọn.';
      });
      return;
    }

    setState(() {
      _generating = true;
      _error = null;
    });

    try {
      final result = await ApiClient.instance.generateV9Plan(
        _buildPayload(),
        availablePlaces: _catalogPlaces,
      );
      if (!mounted) return;
      setState(() {
        _planResponse = result;
        _itinerary = result.itinerary;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _generating = false);
    }
  }

  Future<void> _handleRecommendPlaces() async {
    setState(() {
      _recommending = true;
      _error = null;
    });

    try {
      final res = await ApiClient.instance.recommendV9Places(
        _buildPayload(),
        availablePlaces: _catalogPlaces,
      );
      if (!mounted) return;
      setState(() {
        _recommendations = res.primaryPlaces;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _recommending = false);
    }
  }

  Future<void> _handleSaveItinerary() async {
    final current = _itinerary;
    if (current == null) return;

    if (widget.appState.user == null) {
      await Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => AuthProfileScreen(appState: widget.appState),
        ),
      );
      if (widget.appState.user == null) return;
    }

    setState(() {
      _saving = true;
      _error = null;
    });

    try {
      final title = _titleCtrl.text.trim().isNotEmpty
          ? _titleCtrl.text.trim()
          : 'Hành trình Đồng Tháp $_days ngày (${_mode == 'ai' ? 'AI V9' : 'Tự chọn'})';
      final saved = await ApiClient.instance.saveV9Itinerary(
        title: title,
        v9Itinerary: current,
        v9Response: _planResponse,
      );
      widget.appState.notifyItinerariesUpdated();
      await _loadSavedItineraries();
      if (!mounted) return;
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => ItineraryDetailScreen(
            itineraryId: saved.id,
            appState: widget.appState,
            initialItinerary: saved,
          ),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _pickStartDate() async {
    final initial = DateTime.tryParse(_startDate) ?? DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime.now().subtract(const Duration(days: 7)),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (picked != null) {
      setState(() {
        _startDate = picked.toIso8601String().split('T').first;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: widget.appState,
      builder: (context, _) {
        return Column(
          children: [
            // Sub-tab header
            Container(
              color: Colors.white,
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
              child: Container(
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
                            color: _activeTab == 0 ? AppColors.leaf600 : Colors.transparent,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          alignment: Alignment.center,
                          child: Text(
                            '🤖 Lập lịch AI V9',
                            style: TextStyle(
                              fontWeight: FontWeight.w800,
                              fontSize: 13,
                              color: _activeTab == 0 ? Colors.white : AppColors.river700,
                            ),
                          ),
                        ),
                      ),
                    ),
                    Expanded(
                      child: GestureDetector(
                        onTap: () {
                          setState(() => _activeTab = 1);
                          if (widget.appState.user != null) {
                            _loadSavedItineraries();
                          }
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          decoration: BoxDecoration(
                            color: _activeTab == 1 ? AppColors.leaf600 : Colors.transparent,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          alignment: Alignment.center,
                          child: Text(
                            '📂 Đã lưu (${_savedItineraries.length})',
                            style: TextStyle(
                              fontWeight: FontWeight.w800,
                              fontSize: 13,
                              color: _activeTab == 1 ? Colors.white : AppColors.river700,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            Expanded(
              child: _activeTab == 0 ? _buildPlannerView() : _buildSavedItinerariesView(),
            ),
          ],
        );
      },
    );
  }

  Widget _buildPlannerView() {
    final filteredCatalog = _catalogPlaces.where((p) {
      if (_placeSearch.trim().isEmpty) return true;
      final q = _placeSearch.toLowerCase();
      return p.name.toLowerCase().contains(q) ||
          (p.category?.toLowerCase().contains(q) ?? false) ||
          p.role.toLowerCase().contains(q);
    }).toList();

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 36),
      children: [
        // Hero Banner
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            gradient: AppColors.heroGradient,
            borderRadius: BorderRadius.circular(22),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.16),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Text(
                  '✨ Trip Planner V9 + Valhalla Routing',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const SizedBox(height: 10),
              const Text(
                'Thiết kế hành trình thông minh & Điều chỉnh thực địa (Live Replan)',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  height: 1.25,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'AI tự động phân bổ 5 nhóm ngân sách, tối ưu thứ tự di chuyển và hỗ trợ cập nhật giờ thực tế 2 bước (Đã đến / Bắt đầu đi).',
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

        // Mode Switcher: AI vs Manual
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: AppColors.sand200),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: _ModeOptionButton(
                      selected: _mode == 'ai',
                      icon: '🤖',
                      title: 'AI Tự động chọn',
                      subtitle: 'Gợi ý tối ưu theo mục tiêu',
                      onTap: () => setState(() => _mode = 'ai'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _ModeOptionButton(
                      selected: _mode == 'manual',
                      icon: '✍️',
                      title: 'Tự chọn điểm đến',
                      subtitle: 'AI xếp giờ & tính đường đi',
                      onTap: () => setState(() => _mode = 'manual'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              TextField(
                controller: _titleCtrl,
                decoration: const InputDecoration(
                  labelText: 'Tên lịch trình (tùy chọn)',
                  hintText: 'VD: Khám phá Tràm Chim & Làng hoa Sa Đéc 2N1Đ',
                  prefixIcon: Icon(Icons.bookmark_border_rounded),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _goalCtrl,
                decoration: const InputDecoration(
                  labelText: 'Mục tiêu chuyến đi',
                  hintText: 'VD: nghỉ dưỡng nhẹ nhàng, chụp ảnh, ăn đặc sản',
                  prefixIcon: Icon(Icons.flag_outlined),
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    flex: 3,
                    child: TextField(
                      controller: _startPlaceCtrl,
                      decoration: const InputDecoration(
                        labelText: 'Điểm xuất phát',
                        prefixIcon: Icon(Icons.location_on_outlined),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    flex: 2,
                    child: InkWell(
                      onTap: _pickStartDate,
                      borderRadius: BorderRadius.circular(14),
                      child: InputDecorator(
                        decoration: const InputDecoration(
                          labelText: 'Ngày đi',
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              AppFormatters.formatDateVi(_startDate),
                              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
                            ),
                            const Icon(Icons.calendar_today_rounded, size: 15, color: AppColors.leaf700),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),

              // Days & People steppers
              Row(
                children: [
                  Expanded(
                    child: _CounterBox(
                      label: 'Số ngày đi',
                      value: '$_days ngày',
                      onDecrease: _days > 1 ? () => setState(() => _days--) : null,
                      onIncrease: _days < 5 ? () => setState(() => _days++) : null,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _CounterBox(
                      label: 'Số người',
                      value: '$_people người',
                      onDecrease: _people > 1 ? () => setState(() => _people--) : null,
                      onIncrease: _people < 20 ? () => setState(() => _people++) : null,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),

              // Budget VND + Presets
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Tổng ngân sách dự kiến:',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.river600),
                  ),
                  Text(
                    AppFormatters.formatVnd(_budgetVnd),
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      color: AppColors.leaf700,
                    ),
                  ),
                ],
              ),
              Slider(
                value: _budgetVnd.clamp(500000, 15000000),
                min: 500000,
                max: 15000000,
                divisions: 29,
                activeColor: AppColors.leaf600,
                onChanged: (v) => setState(() => _budgetVnd = v),
              ),
              Wrap(
                spacing: 8,
                runSpacing: 6,
                children: [1000000.0, 2000000.0, 3000000.0, 5000000.0, 8000000.0].map((preset) {
                  final active = (_budgetVnd - preset).abs() < 50000;
                  return ActionChip(
                    onPressed: () => setState(() => _budgetVnd = preset),
                    backgroundColor: active ? AppColors.leaf600 : AppColors.sand100,
                    side: BorderSide(color: active ? AppColors.leaf600 : AppColors.sand200),
                    label: Text(
                      AppFormatters.formatVndShort(preset),
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: active ? Colors.white : AppColors.river700,
                      ),
                    ),
                  );
                }).toList(),
              ),
              const SizedBox(height: 14),

              // Transport & Pace
              Row(
                children: [
                  Expanded(
                    child: DropdownButtonFormField<String>(
                      isExpanded: true,
                      initialValue: _transport,
                      decoration: const InputDecoration(labelText: 'Phương tiện'),
                      items: const [
                        DropdownMenuItem(value: 'motorcycle', child: Text('🛵 Xe máy')),
                        DropdownMenuItem(value: 'car', child: Text('🚗 Ô tô / Taxi')),
                      ],
                      onChanged: (v) {
                        if (v != null) setState(() => _transport = v);
                      },
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: DropdownButtonFormField<String>(
                      isExpanded: true,
                      initialValue: _pace,
                      decoration: const InputDecoration(labelText: 'Nhịp độ'),
                      items: const [
                        DropdownMenuItem(value: 'relaxed', child: Text('🌿 Thư thả')),
                        DropdownMenuItem(value: 'balanced', child: Text('⚖️ Cân bằng')),
                        DropdownMenuItem(value: 'busy', child: Text('⚡ Khám phá nhiều')),
                      ],
                      onChanged: (v) {
                        if (v != null) setState(() => _pace = v);
                      },
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),

              // Interests
              const Text(
                'Sở thích ưu tiên:',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.river600),
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 6,
                children: _interestPresets.map((tag) {
                  final selected = _interests.contains(tag);
                  return FilterChip(
                    selected: selected,
                    onSelected: (val) {
                      setState(() {
                        if (val) {
                          _interests.add(tag);
                        } else {
                          _interests.remove(tag);
                        }
                      });
                    },
                    label: Text(tag),
                    selectedColor: AppColors.leaf100,
                    checkmarkColor: AppColors.leaf700,
                    visualDensity: VisualDensity.compact,
                  );
                }).toList(),
              ),

              // Manual place selector
              if (_mode == 'manual') ...[
                const Divider(height: 28),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Chọn địa điểm muốn đi (${_selectedPlaceIds.length})',
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                        color: AppColors.river900,
                      ),
                    ),
                    if (_selectedPlaceIds.isNotEmpty)
                      TextButton(
                        onPressed: () => setState(() => _selectedPlaceIds.clear()),
                        child: const Text('Bỏ chọn hết'),
                      ),
                  ],
                ),
                const SizedBox(height: 8),
                TextField(
                  onChanged: (v) => setState(() => _placeSearch = v),
                  decoration: const InputDecoration(
                    hintText: 'Tìm địa điểm trong danh mục...',
                    prefixIcon: Icon(Icons.search_rounded),
                  ),
                ),
                const SizedBox(height: 10),
                if (_loadingCatalog)
                  const Center(child: Padding(padding: EdgeInsets.all(16), child: CircularProgressIndicator()))
                else
                  Container(
                    constraints: const BoxConstraints(maxHeight: 240),
                    decoration: BoxDecoration(
                      color: AppColors.sand50,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: AppColors.sand200),
                    ),
                    child: ListView.separated(
                      shrinkWrap: true,
                      itemCount: filteredCatalog.length,
                      separatorBuilder: (_, _) => const Divider(height: 1),
                      itemBuilder: (context, idx) {
                        final p = filteredCatalog[idx];
                        final checked = _selectedPlaceIds.contains(p.id);
                        final roleMeta = AppCatalog.roleMeta(p.role);
                        return CheckboxListTile(
                          value: checked,
                          dense: true,
                          activeColor: AppColors.leaf600,
                          onChanged: (val) {
                            setState(() {
                              if (val == true) {
                                _selectedPlaceIds.add(p.id);
                              } else {
                                _selectedPlaceIds.remove(p.id);
                              }
                            });
                          },
                          title: Text(
                            p.name,
                            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                          ),
                          subtitle: Text(
                            '${roleMeta.shortLabel} • ~${p.visitDurationMinutes ?? 90}p${p.googleRating != null ? ' • ★ ${p.googleRating}' : ''}',
                            style: const TextStyle(fontSize: 11, color: AppColors.river500),
                          ),
                        );
                      },
                    ),
                  ),
              ],

              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    flex: 3,
                    child: ElevatedButton.icon(
                      onPressed: _generating ? null : _handleGenerateItinerary,
                      icon: _generating
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                            )
                          : const Icon(Icons.auto_awesome_rounded),
                      label: Text(_generating ? 'Đang lập lịch V9...' : 'Lập lịch trình AI ngay'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    flex: 2,
                    child: OutlinedButton.icon(
                      onPressed: _recommending ? null : _handleRecommendPlaces,
                      icon: const Icon(Icons.lightbulb_outline_rounded, size: 17),
                      label: Text(
                        _recommending ? 'Đang lọc...' : 'Gợi ý điểm',
                        style: const TextStyle(fontSize: 12),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),

        if (_error != null) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.red.shade50,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: Colors.red.shade200),
            ),
            child: Text(
              _error!,
              style: TextStyle(color: Colors.red.shade800, fontSize: 12, fontWeight: FontWeight.w600),
            ),
          ),
        ],

        // Recommendations list
        if (_recommendations.isNotEmpty) ...[
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: AppColors.sand200),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      '🎯 Top địa điểm AI gợi ý cho bạn',
                      style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
                    ),
                    TextButton(
                      onPressed: () => setState(() => _recommendations = const []),
                      child: const Text('Ẩn'),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                ..._recommendations.map((rec) {
                  final inSelected = _selectedPlaceIds.contains(rec.id);
                  final roleMeta = AppCatalog.roleMeta(rec.role);
                  return Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppColors.sand50,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.sand200),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                rec.name,
                                style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                '${roleMeta.shortLabel} • ~${rec.visitDurationMinutes ?? 90}p${rec.rankingReasonText != null ? ' • ${rec.rankingReasonText}' : ''}',
                                style: const TextStyle(fontSize: 11, color: AppColors.river600),
                              ),
                            ],
                          ),
                        ),
                        TextButton.icon(
                          onPressed: () {
                            setState(() {
                              _mode = 'manual';
                              if (inSelected) {
                                _selectedPlaceIds.remove(rec.id);
                              } else {
                                _selectedPlaceIds.add(rec.id);
                              }
                            });
                          },
                          icon: Icon(
                            inSelected ? Icons.check_circle_rounded : Icons.add_circle_outline_rounded,
                            size: 16,
                          ),
                          label: Text(inSelected ? 'Đã chọn' : 'Chọn'),
                        ),
                      ],
                    ),
                  );
                }),
              ],
            ),
          ),
        ],

        // Generated V9 Itinerary View
        if (_itinerary != null) ...[
          const SizedBox(height: 18),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.leaf50,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.leaf200),
            ),
            child: Row(
              children: [
                const Icon(Icons.verified_rounded, color: AppColors.leaf700),
                const SizedBox(width: 10),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Lịch trình V9 đã sẵn sàng!',
                        style: TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 13,
                          color: AppColors.leaf900,
                        ),
                      ),
                      Text(
                        'Lưu vào tài khoản để bật Live Replan 2 bước (Đã đến / Bắt đầu đi) ngoài thực địa.',
                        style: TextStyle(fontSize: 11, color: AppColors.leaf800),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                ElevatedButton.icon(
                  onPressed: _saving ? null : _handleSaveItinerary,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.leaf700,
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  ),
                  icon: const Icon(Icons.save_rounded, size: 16),
                  label: Text(
                    _saving ? 'Đang lưu...' : 'Lưu lịch trình',
                    style: const TextStyle(fontSize: 12),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          V9ItineraryViewWidget(
            itinerary: _itinerary!,
            primaryPlaces: _planResponse?.primaryPlaces ?? const [],
            enableLiveReplan: false,
            onUpdateItinerary: (updated) async {
              setState(() => _itinerary = updated);
            },
          ),
        ],
      ],
    );
  }

  Widget _buildSavedItinerariesView() {
    if (widget.appState.user == null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(22),
              border: Border.all(color: AppColors.sand200),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.lock_person_outlined, size: 48, color: AppColors.leaf600),
                const SizedBox(height: 12),
                const Text(
                  'Đăng nhập để quản lý Lịch trình đã lưu',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 6),
                const Text(
                  'Bạn vẫn có thể tạo lịch trình AI V9 ở tab bên cạnh mà không cần đăng nhập. Khi muốn lưu lại để dùng Live Replan ngoài thực địa, hãy đăng nhập tài khoản.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 13, color: AppColors.river600, height: 1.4),
                ),
                const SizedBox(height: 16),
                ElevatedButton.icon(
                  onPressed: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => AuthProfileScreen(appState: widget.appState),
                      ),
                    );
                  },
                  icon: const Icon(Icons.login_rounded),
                  label: const Text('Đăng nhập / Đăng ký ngay'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    if (_loadingSaved) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_savedItineraries.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.map_outlined, size: 48, color: AppColors.leaf600),
              const SizedBox(height: 12),
              const Text(
                'Chưa có lịch trình nào được lưu',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 6),
              const Text(
                'Hãy tạo lịch trình bằng AI V9 và nhấn "Lưu lịch trình" để đồng bộ cùng tài khoản.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 13, color: AppColors.river600),
              ),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                onPressed: () => setState(() => _activeTab = 0),
                icon: const Icon(Icons.auto_awesome_rounded),
                label: const Text('Tạo lịch trình AI ngay'),
              ),
            ],
          ),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadSavedItineraries,
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 36),
        itemCount: _savedItineraries.length,
        itemBuilder: (context, idx) {
          final item = _savedItineraries[idx];
          return Card(
            margin: const EdgeInsets.only(bottom: 12),
            child: InkWell(
              borderRadius: BorderRadius.circular(20),
              onTap: () async {
                await Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => ItineraryDetailScreen(
                      itineraryId: item.id,
                      appState: widget.appState,
                    ),
                  ),
                );
                _loadSavedItineraries();
              },
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                          decoration: BoxDecoration(
                            color: item.mode == 'manual' ? AppColors.river50 : AppColors.leaf50,
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(
                            item.mode == 'manual' ? '✍️ Tự chọn' : '🤖 AI V9',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                              color: item.mode == 'manual' ? AppColors.river700 : AppColors.leaf700,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                          decoration: BoxDecoration(
                            color: AppColors.teal50,
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(
                            '🔄 Phiên bản v${item.itineraryVersion}',
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                              color: AppColors.teal800,
                            ),
                          ),
                        ),
                        const Spacer(),
                        const Icon(Icons.chevron_right_rounded, color: AppColors.river500),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Text(
                      item.title,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        color: AppColors.river900,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: 12,
                      runSpacing: 4,
                      children: [
                        Text(
                          '📅 ${item.numberOfDays} ngày',
                          style: const TextStyle(fontSize: 12, color: AppColors.river600),
                        ),
                        Text(
                          '📍 ${item.destinationCount} điểm dừng',
                          style: const TextStyle(fontSize: 12, color: AppColors.river600),
                        ),
                        if (item.budgetVnd != null)
                          Text(
                            '💰 ${AppFormatters.formatVnd(item.budgetVnd)}',
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: AppColors.leaf700,
                            ),
                          ),
                        if (item.startDate != null && item.startDate!.isNotEmpty)
                          Text(
                            'Khởi hành: ${AppFormatters.formatDateVi(item.startDate)}',
                            style: const TextStyle(fontSize: 12, color: AppColors.river500),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _ModeOptionButton extends StatelessWidget {
  final bool selected;
  final String icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  const _ModeOptionButton({
    required this.selected,
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: selected ? AppColors.leaf50 : AppColors.sand50,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: selected ? AppColors.leaf600 : AppColors.sand200,
            width: selected ? 1.5 : 1,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(icon, style: const TextStyle(fontSize: 18)),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    title,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                      color: selected ? AppColors.leaf800 : AppColors.river800,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              subtitle,
              style: const TextStyle(fontSize: 11, color: AppColors.river600),
            ),
          ],
        ),
      ),
    );
  }
}

class _CounterBox extends StatelessWidget {
  final String label;
  final String value;
  final VoidCallback? onDecrease;
  final VoidCallback? onIncrease;

  const _CounterBox({
    required this.label,
    required this.value,
    this.onDecrease,
    this.onIncrease,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.sand50,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.sand200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(fontSize: 11, color: AppColors.river500, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 4),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              InkWell(
                onTap: onDecrease,
                child: Icon(
                  Icons.remove_circle_outline_rounded,
                  size: 20,
                  color: onDecrease != null ? AppColors.leaf700 : AppColors.river400,
                ),
              ),
              Text(
                value,
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800),
              ),
              InkWell(
                onTap: onIncrease,
                child: Icon(
                  Icons.add_circle_outline_rounded,
                  size: 20,
                  color: onIncrease != null ? AppColors.leaf700 : AppColors.river400,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
