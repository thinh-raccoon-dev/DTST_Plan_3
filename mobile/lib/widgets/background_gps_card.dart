import 'package:flutter/material.dart';

import '../state/app_state.dart';
import '../theme/app_theme.dart';

class BackgroundGpsCard extends StatelessWidget {
  final AppState appState;

  const BackgroundGpsCard({
    super.key,
    required this.appState,
  });

  @override
  Widget build(BuildContext context) {
    final tracker = appState.gpsTracker;

    return ListenableBuilder(
      listenable: tracker,
      builder: (context, _) {
        final isRecording = tracker.isRecording;
        final ownerKey = appState.user != null ? 'user:${appState.user!.id}' : 'guest';

        return Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(22),
            border: Border.all(
              color: isRecording
                  ? Colors.red.shade300
                  : AppColors.leaf200,
              width: isRecording ? 1.5 : 1,
            ),
            boxShadow: [
              BoxShadow(
                color: (isRecording ? Colors.red : AppColors.leaf900).withValues(alpha: 0.08),
                blurRadius: 14,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: isRecording ? Colors.red.shade50 : AppColors.leaf50,
                      borderRadius: BorderRadius.circular(13),
                    ),
                    child: Icon(
                      isRecording ? Icons.gps_fixed_rounded : Icons.route_rounded,
                      color: isRecording ? Colors.red.shade600 : AppColors.leaf700,
                      size: 21,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Flexible(
                              child: Text(
                                'Ghi Dấu chân GPS chạy ngầm',
                                style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w800,
                                  color: AppColors.river900,
                                ),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                              decoration: BoxDecoration(
                                color: isRecording ? Colors.red.shade600 : AppColors.leaf100,
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Text(
                                isRecording ? 'ĐANG GHI' : 'CHẠY NGẦM',
                                style: TextStyle(
                                  fontSize: 9.5,
                                  fontWeight: FontWeight.w800,
                                  color: isRecording ? Colors.white : AppColors.leaf800,
                                  letterSpacing: 0.4,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 2),
                        Text(
                          isRecording
                              ? 'Foreground Service đang giữ GPS ngay cả khi khóa màn hình'
                              : 'Lưu hành trình đường dài (Cần Thơ – Sài Gòn) ngay cả khi tắt màn hình',
                          style: const TextStyle(
                            fontSize: 11.5,
                            color: AppColors.river600,
                            height: 1.3,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              if (isRecording) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                    color: Colors.red.shade50.withValues(alpha: 0.7),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: Colors.red.shade100),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      _MetricCell(
                        label: 'Quãng đường',
                        value: '${tracker.liveDistanceKm.toStringAsFixed(2)} km',
                      ),
                      _MetricCell(
                        label: 'Tọa độ',
                        value: '${tracker.pointCount} điểm',
                      ),
                      _MetricCell(
                        label: 'Thời lượng',
                        value: tracker.formattedElapsed,
                      ),
                    ],
                  ),
                ),
              ],
              if (tracker.errorMessage != null) ...[
                const SizedBox(height: 10),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.amber.shade50,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.amber.shade200),
                  ),
                  child: Text(
                    tracker.errorMessage!,
                    style: TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w600,
                      color: Colors.amber.shade900,
                    ),
                  ),
                ),
              ] else if (tracker.statusMessage != null) ...[
                const SizedBox(height: 10),
                Text(
                  tracker.statusMessage!,
                  style: const TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w600,
                    color: AppColors.leaf700,
                  ),
                ),
              ],
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: tracker.isSyncing
                          ? null
                          : () async {
                              if (isRecording) {
                                await tracker.stopAndSave();
                              } else {
                                await tracker.startRecording(ownerKey: ownerKey);
                              }
                            },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: isRecording ? Colors.red.shade600 : AppColors.leaf700,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 11, horizontal: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                      icon: Icon(
                        isRecording ? Icons.stop_circle_rounded : Icons.play_circle_fill_rounded,
                        size: 18,
                      ),
                      label: Text(
                        tracker.isSyncing
                            ? 'Đang đồng bộ Cloud...'
                            : isRecording
                                ? 'Dừng & Lưu hành trình'
                                : 'Bắt đầu ghi GPS chạy ngầm',
                        style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800),
                      ),
                    ),
                  ),
                  if (tracker.pendingSyncCount > 0 && !isRecording) ...[
                    const SizedBox(width: 8),
                    OutlinedButton.icon(
                      onPressed: tracker.isSyncing ? null : () => tracker.syncPendingTracks(),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.leaf800,
                        side: const BorderSide(color: AppColors.leaf200),
                        padding: const EdgeInsets.symmetric(vertical: 11, horizontal: 10),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                      icon: const Icon(Icons.cloud_upload_outlined, size: 16),
                      label: Text(
                        'Đồng bộ (${tracker.pendingSyncCount})',
                        style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800),
                      ),
                    ),
                  ],
                ],
              ),
              if (isRecording && !tracker.hasAlwaysPermission) ...[
                const SizedBox(height: 8),
                InkWell(
                  borderRadius: BorderRadius.circular(10),
                  onTap: () => tracker.openAppLocationSettings(),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Row(
                      children: [
                        Icon(Icons.settings_outlined, size: 14, color: AppColors.leaf700),
                        const SizedBox(width: 5),
                        const Expanded(
                          child: Text(
                            'Mở Cài đặt → Quyền Vị trí → Chọn "Luôn cho phép" để chạy ngầm tốt nhất',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: AppColors.leaf700,
                              decoration: TextDecoration.underline,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ],
          ),
        );
      },
    );
  }
}

class _MetricCell extends StatelessWidget {
  final String label;
  final String value;

  const _MetricCell({
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 10.5,
            fontWeight: FontWeight.w600,
            color: AppColors.river600,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          style: TextStyle(
            fontSize: 13.5,
            fontWeight: FontWeight.w900,
            color: Colors.red.shade700,
          ),
        ),
      ],
    );
  }
}
