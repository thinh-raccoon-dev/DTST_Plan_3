import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models/api_models.dart';
import '../theme/app_theme.dart';
import 'common_widgets.dart';

class V9ItineraryViewWidget extends StatefulWidget {
  final V9ItineraryObject itinerary;
  final List<V9Place> primaryPlaces;
  /// placeId -> ảnh điểm đến (lấy từ danh mục địa điểm đã gắn ảnh trên server).
  final Map<String, String> placeImages;
  final int? itineraryVersion;
  final bool enableLiveReplan;
  final String? replanningStopId;
  final Future<void> Function({
    required String stopId,
    required String event,
    required String occurredAt,
  })? onReplan;
  final Future<void> Function(V9ItineraryObject updated)? onUpdateItinerary;

  const V9ItineraryViewWidget({
    super.key,
    required this.itinerary,
    this.primaryPlaces = const [],
    this.placeImages = const {},
    this.itineraryVersion,
    this.enableLiveReplan = false,
    this.replanningStopId,
    this.onReplan,
    this.onUpdateItinerary,
  });

  @override
  State<V9ItineraryViewWidget> createState() => _V9ItineraryViewWidgetState();
}

class _V9ItineraryViewWidgetState extends State<V9ItineraryViewWidget> {
  int _selectedDayIndex = 0; // -1 = Xem tất cả ngày

  Future<void> _openGoogleMaps({
    double? lat,
    double? lon,
    required String placeName,
  }) async {
    try {
      final Uri uri;
      if (lat != null && lon != null) {
        uri = Uri.parse('https://www.google.com/maps/dir/?api=1&destination=$lat,$lon');
      } else {
        uri = Uri.parse(
          'https://www.google.com/maps/search/?api=1&query=${Uri.encodeComponent('$placeName Đồng Tháp')}',
        );
      }
      if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
        await launchUrl(uri);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Không thể mở ứng dụng bản đồ: $e')),
        );
      }
    }
  }

  Future<void> _moveStop(int dayNumber, String stopId, int delta) async {
    if (widget.onUpdateItinerary == null) return;
    final map = jsonDecode(jsonEncode(widget.itinerary.toJson())) as Map<String, dynamic>;
    final days = (map['days'] as List?)?.whereType<Map<String, dynamic>>().toList() ?? [];
    final targetDay = days.firstWhere((d) => d['day'] == dayNumber, orElse: () => <String, dynamic>{});
    if (targetDay.isEmpty) return;

    final activities = (targetDay['activities'] as List?)?.whereType<Map<String, dynamic>>().toList() ?? [];
    final stopIndices = <int>[];
    for (int i = 0; i < activities.length; i++) {
      if (activities[i]['stop_id'] != null) stopIndices.add(i);
    }

    final currentPosInStops = stopIndices.indexWhere((idx) => activities[idx]['stop_id'] == stopId);
    if (currentPosInStops == -1) return;
    final swapPosInStops = currentPosInStops + delta;
    if (swapPosInStops < 0 || swapPosInStops >= stopIndices.length) return;

    final idxA = stopIndices[currentPosInStops];
    final idxB = stopIndices[swapPosInStops];
    final actA = activities[idxA];
    final actB = activities[idxB];

    final tmpStart = actA['start'];
    final tmpEnd = actA['end'];
    actA['start'] = actB['start'];
    actA['end'] = actB['end'];
    actB['start'] = tmpStart;
    actB['end'] = tmpEnd;

    activities[idxA] = actB;
    activities[idxB] = actA;
    targetDay['activities'] = activities;

    await widget.onUpdateItinerary!(V9ItineraryObject.fromJson(map));
  }

  Future<void> _removeStop(int dayNumber, String stopId) async {
    if (widget.onUpdateItinerary == null) return;
    final map = jsonDecode(jsonEncode(widget.itinerary.toJson())) as Map<String, dynamic>;
    final days = (map['days'] as List?)?.whereType<Map<String, dynamic>>().toList() ?? [];
    final targetDay = days.firstWhere((d) => d['day'] == dayNumber, orElse: () => <String, dynamic>{});
    if (targetDay.isEmpty) return;

    final activities = (targetDay['activities'] as List?)?.whereType<Map<String, dynamic>>().toList() ?? [];
    activities.removeWhere((a) => a['stop_id'] == stopId);
    targetDay['activities'] = activities;

    await widget.onUpdateItinerary!(V9ItineraryObject.fromJson(map));
  }

  Future<void> _triggerQuickSituation(
    V9Day day,
    V9ActivityStep step,
    String situation,
  ) async {
    if (step.stopId == null) return;
    final now = DateTime.now();

    if (situation == 'skip_stop') {
      if (widget.onReplan != null && step.status == 'arrived') {
        final hhmm = '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}';
        await widget.onReplan!(
          stopId: step.stopId!,
          event: 'departed',
          occurredAt: '${day.date}T$hhmm:00+07:00',
        );
      } else {
        await _removeStop(day.day, step.stopId!);
      }
      return;
    }

    if (widget.onReplan == null) return;

    int addMins = 0;
    if (situation == 'traffic_30m') addMins = 30;
    if (situation == 'rain_delay_45m') addMins = 45;

    final targetDt = now.add(Duration(minutes: addMins));
    final hhmm = '${targetDt.hour.toString().padLeft(2, '0')}:${targetDt.minute.toString().padLeft(2, '0')}';
    final eventType = (situation == 'leave_now' || step.status == 'arrived') ? 'departed' : 'arrived';

    await widget.onReplan!(
      stopId: step.stopId!,
      event: eventType,
      occurredAt: '${day.date}T$hhmm:00+07:00',
    );
  }

  @override
  Widget build(BuildContext context) {
    final it = widget.itinerary;
    final budget = (it.input['budget_vnd'] as num?) ?? 2000000;
    final people = (it.input['people'] as num?)?.toInt() ?? 2;
    final transport = it.input['mode_of_transport']?.toString() == 'motorcycle' ? 'Xe máy' : 'Ô tô';

    int totalStops = 0;
    int completedStops = 0;
    V9ActivityStep? highlightedNextStop;

    for (final d in it.days) {
      if (d.nextStop != null && highlightedNextStop == null) {
        highlightedNextStop = d.nextStop;
      }
      for (final s in d.activities) {
        if (s.stopId != null) {
          totalStops++;
          if (s.status == 'completed') completedStops++;
        }
      }
    }

    final safeIndex = _selectedDayIndex >= it.days.length ? 0 : _selectedDayIndex;
    final daysToShow = safeIndex == -1
        ? it.days
        : (it.days.isNotEmpty ? [it.days[safeIndex]] : const <V9Day>[]);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // 1. Header Tổng quan Lịch trình V9
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            gradient: AppColors.heroGradient,
            borderRadius: BorderRadius.circular(24),
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
                      color: Colors.white.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.auto_awesome_rounded, size: 14, color: AppColors.teal200),
                        SizedBox(width: 5),
                        Text(
                          'Trip Planner V9 · Valhalla Routing',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            color: Colors.white,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (widget.itineraryVersion != null)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppColors.teal400.withValues(alpha: 0.25),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        'Phiên bản v${widget.itineraryVersion}',
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          color: AppColors.teal100,
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 10),
              const Text(
                'Hành trình trải nghiệm Đồng Tháp',
                style: TextStyle(
                  fontSize: 21,
                  fontWeight: FontWeight.w800,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                '${it.days.length} ngày · $people khách · Phương tiện: $transport',
                style: const TextStyle(fontSize: 13, color: AppColors.leaf100),
              ),
              const SizedBox(height: 14),
              GridView.count(
                crossAxisCount: 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: 8,
                crossAxisSpacing: 8,
                childAspectRatio: 2.15,
                children: [
                  _statTile(
                    Icons.place_outlined,
                    'Điểm chính',
                    '${it.scheduledPrimaryIds.length} điểm',
                  ),
                  _statTile(
                    Icons.route_outlined,
                    'Quãng đường',
                    '${it.roadDistanceKm.toStringAsFixed(1)} km',
                  ),
                  _statTile(
                    Icons.account_balance_wallet_outlined,
                    'Chi phí đã biết',
                    AppFormatters.formatVndShort(it.knownSubtotalVnd),
                  ),
                  _statTile(
                    Icons.savings_outlined,
                    'Ngân sách nhóm',
                    AppFormatters.formatVndShort(budget),
                  ),
                ],
              ),
              if (widget.enableLiveReplan && totalStops > 0) ...[
                const SizedBox(height: 14),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Tiến độ thực địa',
                      style: TextStyle(fontSize: 12, color: AppColors.leaf100),
                    ),
                    Text(
                      '$completedStops / $totalStops điểm dừng',
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                        color: Colors.white,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                ClipRRect(
                  borderRadius: BorderRadius.circular(999),
                  child: LinearProgressIndicator(
                    value: completedStops / totalStops,
                    minHeight: 8,
                    backgroundColor: Colors.white.withValues(alpha: 0.16),
                    valueColor: const AlwaysStoppedAnimation<Color>(AppColors.teal300),
                  ),
                ),
              ],
            ],
          ),
        ),

        // 2. Thẻ Next Stop (Điểm tiếp theo) sau khi Live Replan
        if (highlightedNextStop != null) ...[
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.leaf50,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: AppColors.leaf500, width: 1.6),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: const BoxDecoration(
                        color: AppColors.leaf600,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.flag_rounded, color: Colors.white, size: 18),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'ĐIỂM ĐẾN TIẾP THEO (NEXT STOP)',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                              color: AppColors.leaf700,
                            ),
                          ),
                          Text(
                            highlightedNextStop.name,
                            style: const TextStyle(
                              fontSize: 16.5,
                              fontWeight: FontWeight.w800,
                              color: AppColors.river900,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  'Dự kiến đến: ${AppFormatters.formatIsoClock(highlightedNextStop.estimatedArrivalAt).isNotEmpty ? AppFormatters.formatIsoClock(highlightedNextStop.estimatedArrivalAt) : highlightedNextStop.start} · Khung giờ: ${AppFormatters.formatIsoClock(highlightedNextStop.plannedStartAt).isNotEmpty ? AppFormatters.formatIsoClock(highlightedNextStop.plannedStartAt) : highlightedNextStop.start} – ${AppFormatters.formatIsoClock(highlightedNextStop.plannedEndAt).isNotEmpty ? AppFormatters.formatIsoClock(highlightedNextStop.plannedEndAt) : highlightedNextStop.end}',
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.river700,
                  ),
                ),
                const SizedBox(height: 10),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: () => _openGoogleMaps(
                      lat: highlightedNextStop!.latitude,
                      lon: highlightedNextStop.longitude,
                      placeName: highlightedNextStop.name,
                    ),
                    icon: const Icon(Icons.directions_rounded, size: 18),
                    label: const Text('Mở Google Maps chỉ đường tới Next Stop'),
                  ),
                ),
              ],
            ),
          ),
        ],

        // 3. Phân bổ ngân sách cả nhóm
        if (it.wholeGroupAllocation.isNotEmpty) ...[
          const SizedBox(height: 14),
          _buildBudgetAllocationCard(it.wholeGroupAllocation, budget),
        ],

        const SizedBox(height: 16),

        // 4. Chọn ngày (Day Tabs)
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              ...List.generate(it.days.length, (idx) {
                final d = it.days[idx];
                final selected = safeIndex == idx;
                final fullDate = AppFormatters.formatDateVi(d.date);
                final shortDate = fullDate.length >= 5 ? fullDate.substring(0, 5) : fullDate;
                final dateLabel = shortDate.isNotEmpty ? ' ($shortDate)' : '';
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    selected: selected,
                    selectedColor: AppColors.leaf600,
                    backgroundColor: Colors.white,
                    labelStyle: TextStyle(
                      color: selected ? Colors.white : AppColors.river800,
                      fontWeight: FontWeight.w700,
                    ),
                    label: Text('Ngày ${d.day}$dateLabel'),
                    onSelected: (_) => setState(() => _selectedDayIndex = idx),
                  ),
                );
              }),
              if (it.days.length > 1)
                ChoiceChip(
                  selected: safeIndex == -1,
                  selectedColor: AppColors.leaf600,
                  backgroundColor: Colors.white,
                  labelStyle: TextStyle(
                    color: safeIndex == -1 ? Colors.white : AppColors.river800,
                    fontWeight: FontWeight.w700,
                  ),
                  label: const Text('Xem tất cả'),
                  onSelected: (_) => setState(() => _selectedDayIndex = -1),
                ),
            ],
          ),
        ),

        const SizedBox(height: 12),

        // 5. Timeline chi tiết từng ngày
        ...daysToShow.map((day) => Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: _buildDayCard(day),
            )),
      ],
    );
  }

  Widget _statTile(IconData icon, String label, String value) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white.withValues(alpha: 0.18)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Row(
            children: [
              Icon(icon, size: 14, color: AppColors.teal200),
              const SizedBox(width: 5),
              Expanded(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 11, color: AppColors.leaf100),
                ),
              ),
            ],
          ),
          const SizedBox(height: 3),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 15.5,
              fontWeight: FontWeight.w800,
              color: Colors.white,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBudgetAllocationCard(Map<String, num> alloc, num totalBudget) {
    final items = [
      (key: 'food', label: 'Ăn uống', color: AppColors.teal500),
      (key: 'stay', label: 'Lưu trú', color: AppColors.lotus500),
      (key: 'transport', label: 'Di chuyển', color: AppColors.river600),
      (key: 'activities', label: 'Hoạt động', color: AppColors.leaf600),
      (key: 'reserve', label: 'Dự phòng', color: AppColors.sand300),
    ];

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Phân bổ ngân sách nhóm',
                  style: TextStyle(fontSize: 15.5, fontWeight: FontWeight.w800),
                ),
                Text(
                  AppFormatters.formatVnd(totalBudget),
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: AppColors.leaf700,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 10,
              runSpacing: 8,
              children: items.map((m) {
                final val = alloc[m.key] ?? 0;
                if (val <= 0) return const SizedBox.shrink();
                return Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppColors.sand50,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.sand200),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(color: m.color, shape: BoxShape.circle),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        '${m.label}: ',
                        style: const TextStyle(fontSize: 12, color: AppColors.river600),
                      ),
                      Text(
                        AppFormatters.formatVndShort(val),
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                          color: AppColors.river900,
                        ),
                      ),
                    ],
                  ),
                );
              }).toList(),
            ),
          ],
        ),
      ),
    );
  }

  String? _imageFor(String placeId) {
    final fromMap = widget.placeImages[placeId];
    if (fromMap != null && fromMap.trim().isNotEmpty) return fromMap;
    for (final p in widget.primaryPlaces) {
      if (p.id == placeId && p.imageUrl != null && p.imageUrl!.trim().isNotEmpty) {
        return p.imageUrl;
      }
    }
    return null;
  }

  Widget _buildDayCard(V9Day day) {
    final stops = day.activities.where((s) => s.stopId != null).toList();
    final firstIncompleteStopId = stops
        .cast<V9ActivityStep?>()
        .firstWhere((s) => s != null && s.status != 'completed', orElse: () => null)
        ?.stopId;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Day Header
            Row(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    gradient: AppColors.heroGradient,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  alignment: Alignment.center,
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Text(
                        'NGÀY',
                        style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: AppColors.leaf100),
                      ),
                      Text(
                        '${day.day}',
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w900,
                          color: Colors.white,
                          height: 1.0,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Ngày ${day.day} · ${AppFormatters.formatDateVi(day.date)}',
                        style: const TextStyle(
                          fontSize: 16.5,
                          fontWeight: FontWeight.w800,
                          color: AppColors.river900,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${day.visitCount} điểm tham quan${day.estimatedDayEndAt != null ? ' · Dự kiến xong ${AppFormatters.formatIsoClock(day.estimatedDayEndAt)}' : ''}',
                        style: const TextStyle(fontSize: 12.5, color: AppColors.river500),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const Divider(height: 24, color: AppColors.sand200),

            // Activities list
            ...List.generate(day.activities.length, (idx) {
              final step = day.activities[idx];

              if (step.type == 'travel') {
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 6),
                  child: Row(
                    children: [
                      const Icon(Icons.directions_car_filled_outlined, size: 16, color: AppColors.river400),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          '${step.start} – ${step.end} · ${step.distanceKm != null ? '${step.distanceKm!.toStringAsFixed(1)} km · ' : ''}${step.routeDurationMinutes != null ? '${step.routeDurationMinutes!.round()} phút · ' : ''}${step.name}',
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppColors.river500,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                );
              }

              if (step.type == 'free_time' || step.type == 'checkout') {
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 6),
                  child: Row(
                    children: [
                      const Icon(Icons.hourglass_bottom_rounded, size: 16, color: AppColors.river400),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          '${step.start} – ${step.end} · ${step.type == 'checkout' ? 'Trả phòng khách sạn' : 'Thời gian tự do / nghỉ ngơi'}',
                          style: const TextStyle(
                            fontSize: 12,
                            fontStyle: FontStyle.italic,
                            color: AppColors.river500,
                          ),
                        ),
                      ),
                    ],
                  ),
                );
              }

              final isStop = step.stopId != null;
              final posInStops = stops.indexWhere((s) => s.stopId == step.stopId);
              final canMoveUp = widget.onUpdateItinerary != null && posInStops > 0;
              final canMoveDown = widget.onUpdateItinerary != null &&
                  posInStops != -1 &&
                  posInStops < stops.length - 1;
              final isActionable = widget.enableLiveReplan &&
                  isStop &&
                  step.stopId == firstIncompleteStopId;
              final isBusy = widget.replanningStopId != null &&
                  widget.replanningStopId == step.stopId;

              final isMeal = step.type.startsWith('meal');
              final plannedStart = AppFormatters.formatIsoClock(step.plannedStartAt);
              final plannedEnd = AppFormatters.formatIsoClock(step.plannedEndAt);
              final displayTime = (plannedStart.isNotEmpty && plannedEnd.isNotEmpty)
                  ? '$plannedStart – $plannedEnd'
                  : '${step.start} – ${step.end}';

              return Container(
                margin: const EdgeInsets.symmetric(vertical: 6),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: step.status == 'completed'
                      ? AppColors.leaf50.withValues(alpha: 0.45)
                      : (isActionable ? AppColors.leaf50.withValues(alpha: 0.85) : Colors.white),
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(
                    color: step.status == 'arrived' || isActionable
                        ? AppColors.leaf500
                        : AppColors.sand200,
                    width: (step.status == 'arrived' || isActionable) ? 1.6 : 1.0,
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Time & Status badges + Move/Delete buttons
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                          decoration: BoxDecoration(
                            color: AppColors.river900,
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            displayTime,
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: Colors.white,
                            ),
                          ),
                        ),
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                          decoration: BoxDecoration(
                            color: isMeal ? AppColors.teal50 : AppColors.leaf100,
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            isMeal ? 'Ăn uống' : 'Tham quan',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: isMeal ? AppColors.teal800 : AppColors.leaf800,
                            ),
                          ),
                        ),
                        if (step.status != 'pending') ...[
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: step.status == 'completed' ? AppColors.leaf600 : AppColors.teal600,
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: Text(
                              step.status == 'completed' ? 'Đã xong' : 'Đang ở điểm',
                              style: const TextStyle(
                                fontSize: 10.5,
                                fontWeight: FontWeight.w700,
                                color: Colors.white,
                              ),
                            ),
                          ),
                        ],
                        const Spacer(),
                        if (widget.onUpdateItinerary != null && isStop) ...[
                          IconButton(
                            visualDensity: VisualDensity.compact,
                            iconSize: 18,
                            onPressed: canMoveUp ? () => _moveStop(day.day, step.stopId!, -1) : null,
                            icon: const Icon(Icons.arrow_upward_rounded),
                            tooltip: 'Lên trước',
                          ),
                          IconButton(
                            visualDensity: VisualDensity.compact,
                            iconSize: 18,
                            onPressed: canMoveDown ? () => _moveStop(day.day, step.stopId!, 1) : null,
                            icon: const Icon(Icons.arrow_downward_rounded),
                            tooltip: 'Xuống sau',
                          ),
                          IconButton(
                            visualDensity: VisualDensity.compact,
                            iconSize: 18,
                            color: Colors.red.shade400,
                            onPressed: () => _removeStop(day.day, step.stopId!),
                            icon: const Icon(Icons.delete_outline_rounded),
                            tooltip: 'Bỏ điểm này',
                          ),
                        ],
                      ],
                    ),

                    // Ảnh điểm đến (nếu có)
                    if (step.placeId != null && _imageFor(step.placeId!) != null) ...[
                      const SizedBox(height: 10),
                      DestinationImageView(
                        imageUrl: _imageFor(step.placeId!),
                        category: isMeal ? 'food' : 'nature',
                        name: step.name,
                        height: 140,
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ],

                    const SizedBox(height: 8),

                    // Title
                    Text(
                      step.name,
                      style: TextStyle(
                        fontSize: 15.5,
                        fontWeight: FontWeight.w800,
                        color: AppColors.river900,
                        decoration: step.status == 'completed' ? TextDecoration.lineThrough : null,
                      ),
                    ),

                    const SizedBox(height: 6),

                    // Rating, Duration, Cost, Map link
                    Wrap(
                      spacing: 12,
                      runSpacing: 6,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        if (step.durationMinutes != null && step.durationMinutes! > 0)
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(Icons.timer_outlined, size: 14, color: AppColors.river500),
                              const SizedBox(width: 3),
                              Text(
                                AppFormatters.formatMinutes(step.durationMinutes),
                                style: const TextStyle(fontSize: 12, color: AppColors.river600),
                              ),
                            ],
                          ),
                        if (step.googleRating != null)
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(Icons.star_rounded, size: 15, color: Colors.amber),
                              const SizedBox(width: 3),
                              Text(
                                '${step.googleRating} (${step.googleReviewCount ?? 0})',
                                style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.river800,
                                ),
                              ),
                            ],
                          ),
                        if (step.estimatedGroupCostVnd != null || step.spendingTargetGroupVnd != null)
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(Icons.payments_outlined, size: 14, color: AppColors.teal700),
                              const SizedBox(width: 3),
                              Text(
                                AppFormatters.formatVnd(
                                  step.estimatedGroupCostVnd ?? step.spendingTargetGroupVnd,
                                ),
                                style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.river700,
                                ),
                              ),
                            ],
                          ),
                        InkWell(
                          onTap: () => _openGoogleMaps(
                            lat: step.latitude,
                            lon: step.longitude,
                            placeName: step.name,
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.map_outlined, size: 14, color: AppColors.leaf700),
                              SizedBox(width: 3),
                              Text(
                                'Bản đồ',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w800,
                                  color: AppColors.leaf700,
                                  decoration: TextDecoration.underline,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),

                    if (step.activityNames.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: step.activityNames.take(4).map((act) {
                          return Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: AppColors.leaf50,
                              borderRadius: BorderRadius.circular(999),
                              border: Border.all(color: AppColors.leaf200),
                            ),
                            child: Text(
                              act,
                              style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: AppColors.leaf800,
                              ),
                            ),
                          );
                        }).toList(),
                      ),
                    ],

                    // Live Replan Controls (Khi mở trong Lịch trình đã lưu)
                    if (widget.enableLiveReplan && isStop && step.status != 'completed') ...[
                      const SizedBox(height: 12),
                      const Divider(height: 1, color: AppColors.sand200),
                      const SizedBox(height: 10),
                      if (isActionable) ...[
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: step.status == 'pending'
                                  ? AppColors.leaf600
                                  : AppColors.teal600,
                              padding: const EdgeInsets.symmetric(vertical: 12),
                            ),
                            onPressed: isBusy
                                ? null
                                : () => _triggerQuickSituation(
                                      day,
                                      step,
                                      step.status == 'pending' ? 'checkin_now' : 'leave_now',
                                    ),
                            icon: isBusy
                                ? const SizedBox(
                                    width: 16,
                                    height: 16,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: Colors.white,
                                    ),
                                  )
                                : Icon(
                                    step.status == 'pending'
                                        ? Icons.play_circle_fill_rounded
                                        : Icons.check_circle_rounded,
                                    size: 18,
                                  ),
                            label: Text(
                              step.status == 'pending'
                                  ? 'Bước 1: Tôi đã đến nơi (Arrived)'
                                  : 'Bước 2: Hoàn thành & đi tiếp (Departed)',
                            ),
                          ),
                        ),
                        const SizedBox(height: 8),
                      ],
                      Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          const Text(
                            'Tình huống nhanh:',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: AppColors.river500,
                            ),
                          ),
                          _situationChip(
                            label: '🚗 Kẹt xe (+30p)',
                            bg: const Color(0xFFFEF3C7),
                            fg: const Color(0xFF92400E),
                            onTap: isBusy ? null : () => _triggerQuickSituation(day, step, 'traffic_30m'),
                          ),
                          _situationChip(
                            label: '🌧️ Mưa to (+45p)',
                            bg: AppColors.teal50,
                            fg: AppColors.teal800,
                            onTap: isBusy ? null : () => _triggerQuickSituation(day, step, 'rain_delay_45m'),
                          ),
                          _situationChip(
                            label: '⏭️ Bỏ qua',
                            bg: AppColors.lotus50,
                            fg: AppColors.lotus700,
                            onTap: isBusy ? null : () => _triggerQuickSituation(day, step, 'skip_stop'),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              );
            }),

            // Overnight Stay
            if (day.overnightStay != null) ...[
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(13),
                decoration: BoxDecoration(
                  color: AppColors.lotus50.withValues(alpha: 0.7),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.lotus200),
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: AppColors.lotus600,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(Icons.nights_stay_rounded, color: Colors.white, size: 18),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Nghỉ đêm · ${day.overnightStay!['name'] ?? 'Khách sạn'}',
                            style: const TextStyle(
                              fontWeight: FontWeight.w800,
                              fontSize: 13.5,
                              color: AppColors.river900,
                            ),
                          ),
                          Text(
                            'Nhận phòng dự kiến: ${day.overnightStay!['planned_arrival'] ?? '20:30'} · Trả phòng trước ${day.overnightStay!['checkout_deadline'] ?? '12:00'}',
                            style: const TextStyle(fontSize: 12, color: AppColors.river600),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _situationChip({
    required String label,
    required Color bg,
    required Color fg,
    VoidCallback? onTap,
  }) {
    return InkWell(
      borderRadius: BorderRadius.circular(999),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            color: fg,
          ),
        ),
      ),
    );
  }
}
