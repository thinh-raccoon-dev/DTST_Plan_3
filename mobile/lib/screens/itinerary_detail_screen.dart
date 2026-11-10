import 'package:flutter/material.dart';

import '../models/api_models.dart';
import '../services/api_client.dart';
import '../state/app_state.dart';
import '../theme/app_theme.dart';
import '../widgets/v9_itinerary_view.dart';
import 'destination_detail_screen.dart';

class ItineraryDetailScreen extends StatefulWidget {
  final String itineraryId;
  final AppState appState;
  final SavedItinerary? initialItinerary;

  const ItineraryDetailScreen({
    super.key,
    required this.itineraryId,
    required this.appState,
    this.initialItinerary,
  });

  @override
  State<ItineraryDetailScreen> createState() => _ItineraryDetailScreenState();
}

class _ItineraryDetailScreenState extends State<ItineraryDetailScreen> {
  SavedItinerary? _item;
  bool _loading = true;
  bool _savingTitle = false;
  String? _replanningStopId;
  String? _error;
  String? _statusMsg;

  @override
  void initState() {
    super.initState();
    if (widget.initialItinerary != null) {
      _item = widget.initialItinerary;
      _loading = false;
    }
    _loadItinerary();
  }

  Future<void> _loadItinerary() async {
    if (_item == null) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final res = await ApiClient.instance.getItineraryDetail(widget.itineraryId);
      if (!mounted) return;
      setState(() {
        _item = res;
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

  Future<void> _handleLiveReplan({
    required String stopId,
    required String event,
    required String occurredAt,
  }) async {
    final current = _item;
    if (current == null) return;

    setState(() {
      _replanningStopId = stopId;
      _error = null;
      _statusMsg = null;
    });

    try {
      final updated = await ApiClient.instance.replanItinerary(
        currentItinerary: current,
        stopId: stopId,
        event: event,
        occurredAt: occurredAt,
      );
      if (!mounted) return;
      setState(() {
        _item = updated;
        _statusMsg = event == 'arrived'
            ? 'Đã ghi nhận đến điểm dừng ($occurredAt) và cập nhật lộ trình v${updated.itineraryVersion}!'
            : 'Đã ghi nhận rời điểm dừng ($occurredAt) và tính lại lộ trình v${updated.itineraryVersion}!';
      });
      widget.appState.notifyItinerariesUpdated();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(_statusMsg!),
          backgroundColor: AppColors.leaf600,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) {
        setState(() => _replanningStopId = null);
      }
    }
  }

  Future<void> _handleUpdateV9Itinerary(V9ItineraryObject updatedV9) async {
    final current = _item;
    if (current == null) return;

    setState(() {
      _error = null;
      _statusMsg = null;
    });

    try {
      final saved = await ApiClient.instance.updateItinerary(
        id: current.id,
        title: current.title,
        v9Itinerary: updatedV9,
      );
      if (!mounted) return;
      setState(() {
        _item = saved;
        _statusMsg = 'Đã cập nhật thứ tự điểm dừng thành công!';
      });
      widget.appState.notifyItinerariesUpdated();
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    }
  }

  Future<void> _editTitleDialog() async {
    final current = _item;
    if (current == null) return;
    final ctrl = TextEditingController(text: current.title);
    final newTitle = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Đổi tên lịch trình', style: TextStyle(fontWeight: FontWeight.w800)),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          decoration: const InputDecoration(
            labelText: 'Tên lịch trình',
            hintText: 'Nhập tên lịch trình mới...',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Hủy'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(ctx).pop(ctrl.text.trim()),
            child: const Text('Lưu tên'),
          ),
        ],
      ),
    );

    if (newTitle == null || newTitle.isEmpty || newTitle == current.title) return;

    setState(() => _savingTitle = true);
    try {
      final updated = await ApiClient.instance.updateItinerary(
        id: current.id,
        title: newTitle,
      );
      if (!mounted) return;
      setState(() => _item = updated);
      widget.appState.notifyItinerariesUpdated();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString())),
      );
    } finally {
      if (mounted) setState(() => _savingTitle = false);
    }
  }

  Future<void> _confirmDelete() async {
    final current = _item;
    if (current == null) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Xóa lịch trình?', style: TextStyle(fontWeight: FontWeight.w800)),
        content: Text('Bạn có chắc muốn xóa lịch trình "${current.title}" khỏi tài khoản?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Hủy'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red.shade600),
            child: const Text('Xóa lịch trình'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    try {
      await ApiClient.instance.deleteItinerary(current.id);
      widget.appState.notifyItinerariesUpdated();
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString())),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final item = _item;

    return Scaffold(
      appBar: AppBar(
        title: Text(item?.title ?? 'Chi tiết lịch trình'),
        actions: [
          if (item != null) ...[
            IconButton(
              onPressed: _savingTitle ? null : _editTitleDialog,
              icon: const Icon(Icons.edit_outlined),
              tooltip: 'Đổi tên lịch trình',
            ),
            IconButton(
              onPressed: _confirmDelete,
              icon: Icon(Icons.delete_outline_rounded, color: Colors.red.shade700),
              tooltip: 'Xóa lịch trình',
            ),
          ],
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : item == null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.error_outline_rounded, size: 48, color: Colors.red.shade400),
                        const SizedBox(height: 12),
                        Text(
                          _error ?? 'Không tìm thấy lịch trình.',
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 12),
                        ElevatedButton(
                          onPressed: _loadItinerary,
                          child: const Text('Thử lại'),
                        ),
                      ],
                    ),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _loadItinerary,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 36),
                    children: [
                      // Header Card
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          gradient: AppColors.heroGradient,
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
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
                                    item.plannerVersion == 'v9'
                                        ? '🤖 Lịch trình AI V9 + Valhalla'
                                        : '🗺️ Lịch trình truyền thống',
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
                                    color: AppColors.teal400.withValues(alpha: 0.25),
                                    borderRadius: BorderRadius.circular(20),
                                  ),
                                  child: Text(
                                    '🔄 Phiên bản v${item.itineraryVersion}',
                                    style: const TextStyle(
                                      color: AppColors.teal100,
                                      fontSize: 11,
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 10),
                            Text(
                              item.title,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 19,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              '${item.numberOfDays} ngày • Cập nhật: ${AppFormatters.formatDateTime(item.updatedAt)}',
                              style: TextStyle(
                                color: Colors.white.withValues(alpha: 0.85),
                                fontSize: 12,
                              ),
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
                            style: TextStyle(
                              color: Colors.red.shade800,
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],

                      if (_statusMsg != null) ...[
                        const SizedBox(height: 12),
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: AppColors.leaf50,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: AppColors.leaf200),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.check_circle_rounded, color: AppColors.leaf700, size: 18),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  _statusMsg!,
                                  style: const TextStyle(
                                    color: AppColors.leaf800,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],

                      const SizedBox(height: 16),

                      if (item.v9Itinerary != null)
                        V9ItineraryViewWidget(
                          itinerary: item.v9Itinerary!,
                          primaryPlaces: item.primaryPlaces,
                          itineraryVersion: item.itineraryVersion,
                          enableLiveReplan: true,
                          replanningStopId: _replanningStopId,
                          onReplan: _handleLiveReplan,
                          onUpdateItinerary: _handleUpdateV9Itinerary,
                        )
                      else if (item.legacyDays.isNotEmpty)
                        ...item.legacyDays.map((day) {
                          return Container(
                            margin: const EdgeInsets.only(bottom: 12),
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(18),
                              border: Border.all(color: AppColors.sand200),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Ngày ${day.dayNumber}',
                                  style: const TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w800,
                                    color: AppColors.river900,
                                  ),
                                ),
                                const SizedBox(height: 10),
                                ...day.items.map((stop) {
                                  return ListTile(
                                    contentPadding: EdgeInsets.zero,
                                    leading: const Icon(Icons.place_rounded, color: AppColors.leaf600),
                                    title: Text(
                                      stop.name,
                                      style: const TextStyle(fontWeight: FontWeight.w700),
                                    ),
                                    subtitle: Text(
                                      '${AppCatalog.areaLabel(stop.area)} • ${AppFormatters.formatMinutes(stop.durationMinutes)}',
                                    ),
                                    onTap: () {
                                      Navigator.of(context).push(
                                        MaterialPageRoute(
                                          builder: (_) => DestinationDetailScreen(
                                            slug: stop.slug,
                                            appState: widget.appState,
                                          ),
                                        ),
                                      );
                                    },
                                  );
                                }),
                              ],
                            ),
                          );
                        })
                      else
                        Container(
                          padding: const EdgeInsets.all(20),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(18),
                            border: Border.all(color: AppColors.sand200),
                          ),
                          child: const Text(
                            'Không có dữ liệu điểm dừng trong lịch trình này.',
                            style: TextStyle(color: AppColors.river600),
                          ),
                        ),

                      // Replan History Section
                      if (item.replanHistory.isNotEmpty) ...[
                        const SizedBox(height: 20),
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
                                  const Row(
                                    children: [
                                      Icon(Icons.history_rounded, size: 18, color: AppColors.leaf700),
                                      SizedBox(width: 6),
                                      Text(
                                        'Lịch sử điều chỉnh thực địa (Replan)',
                                        style: TextStyle(
                                          fontWeight: FontWeight.w800,
                                          fontSize: 14,
                                          color: AppColors.river900,
                                        ),
                                      ),
                                    ],
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                    decoration: BoxDecoration(
                                      color: AppColors.leaf50,
                                      borderRadius: BorderRadius.circular(20),
                                    ),
                                    child: Text(
                                      '${item.replanHistory.length} sự kiện',
                                      style: const TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w700,
                                        color: AppColors.leaf700,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 12),
                              ...item.replanHistory.reversed.map((entry) {
                                final isArrived = entry.event == 'arrived';
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
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                        decoration: BoxDecoration(
                                          color: AppColors.leaf700,
                                          borderRadius: BorderRadius.circular(8),
                                        ),
                                        child: Text(
                                          'v${entry.itineraryVersion}',
                                          style: const TextStyle(
                                            color: Colors.white,
                                            fontSize: 11,
                                            fontWeight: FontWeight.w800,
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 10),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              isArrived
                                                  ? '📍 Đã đến điểm dừng (${entry.stopId})'
                                                  : '🚗 Bắt đầu đi tiếp từ (${entry.stopId})',
                                              style: const TextStyle(
                                                fontSize: 12,
                                                fontWeight: FontWeight.w700,
                                                color: AppColors.river800,
                                              ),
                                            ),
                                            const SizedBox(height: 2),
                                            Text(
                                              'Giờ thực tế: ${AppFormatters.formatIsoClock(entry.occurredAt)} • Cập nhật: ${AppFormatters.formatDateTime(entry.createdAt)}',
                                              style: const TextStyle(
                                                fontSize: 11,
                                                color: AppColors.river500,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),
                                );
                              }),
                            ],
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
    );
  }
}
