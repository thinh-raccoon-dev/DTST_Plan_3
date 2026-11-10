import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../state/app_state.dart';
import '../theme/app_theme.dart';
import 'qr_landing_screen.dart';

class QrScanScreen extends StatefulWidget {
  final AppState appState;

  const QrScanScreen({super.key, required this.appState});

  @override
  State<QrScanScreen> createState() => _QrScanScreenState();
}

class _QrScanScreenState extends State<QrScanScreen> {
  final TextEditingController _codeController = TextEditingController();
  MobileScannerController? _cameraController;
  bool _scanning = false;
  bool _navigating = false;
  String? _errorText;

  static const List<({String code, String title, String area, bool active})> _pilotQrCodes = [
    (
      code: 'TRAMCHIM-01',
      title: 'Vườn quốc gia Tràm Chim',
      area: 'Tam Nông · Sinh thái',
      active: true,
    ),
    (
      code: 'HTL-01',
      title: 'Khu di tích Nguyễn Sinh Sắc',
      area: 'Cao Lãnh · Lịch sử',
      active: true,
    ),
    (
      code: 'GOTHAP-01',
      title: 'Khu di tích Gò Tháp',
      area: 'Tháp Mười · Văn hóa – Lịch sử',
      active: true,
    ),
    (
      code: 'SADEC-HOA',
      title: 'Làng hoa Sa Đéc (Thử mã tạm tắt)',
      area: 'Sa Đéc · Trải nghiệm',
      active: false,
    ),
  ];

  @override
  void dispose() {
    _codeController.dispose();
    _cameraController?.dispose();
    super.dispose();
  }

  void _startCamera() {
    _cameraController?.dispose();
    _cameraController = MobileScannerController(
      detectionSpeed: DetectionSpeed.noDuplicates,
      facing: CameraFacing.back,
    );
    setState(() {
      _scanning = true;
      _errorText = null;
    });
  }

  void _stopCamera() {
    _cameraController?.stop();
    _cameraController?.dispose();
    _cameraController = null;
    if (mounted) {
      setState(() => _scanning = false);
    }
  }

  Future<void> _openCode(String rawInput) async {
    if (_navigating) return;
    final code = AppFormatters.extractQrCode(rawInput);
    if (code == null) {
      setState(() {
        _errorText = 'Mã "$rawInput" không đúng định dạng Hộ chiếu Đồng Tháp (chỉ gồm A–Z, 0–9, dấu gạch ngang).';
      });
      return;
    }

    setState(() {
      _errorText = null;
      _navigating = true;
    });

    if (_scanning) {
      _stopCamera();
    }

    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => QrLandingScreen(
          code: code,
          appState: widget.appState,
        ),
      ),
    );

    if (mounted) {
      setState(() => _navigating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 36),
      children: [
        // Hero Banner
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            gradient: AppColors.darkForestGradient,
            borderRadius: BorderRadius.circular(24),
            boxShadow: [
              BoxShadow(
                color: AppColors.river900.withValues(alpha: 0.16),
                blurRadius: 20,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.qr_code_scanner_rounded, size: 15, color: AppColors.teal300),
                    SizedBox(width: 6),
                    Text(
                      'Trạm tương tác thực địa',
                      style: TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w700,
                        color: AppColors.teal200,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 10),
              const Text(
                'Quét mã QR tại điểm đến',
                style: TextStyle(
                  fontSize: 23,
                  fontWeight: FontWeight.w800,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                'Quét bảng mã QR đặt tại điểm du lịch thí điểm để mở câu chuyện bản địa, check-in nhận dấu mộc (+10 điểm) và tham gia thử thách văn hóa.',
                style: TextStyle(
                  fontSize: 13.5,
                  color: AppColors.sand200,
                  height: 1.45,
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 16),

        // Khung Camera Quét QR
        Card(
          clipBehavior: Clip.antiAlias,
          child: Column(
            children: [
              SizedBox(
                height: 290,
                width: double.infinity,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    if (_scanning && _cameraController != null)
                      MobileScanner(
                        controller: _cameraController!,
                        onDetect: (capture) {
                          for (final barcode in capture.barcodes) {
                            final raw = barcode.rawValue;
                            if (raw != null && raw.isNotEmpty) {
                              _openCode(raw);
                              break;
                            }
                          }
                        },
                      )
                    else
                      Container(
                        color: AppColors.river950,
                        padding: const EdgeInsets.all(24),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Container(
                              width: 64,
                              height: 64,
                              decoration: BoxDecoration(
                                color: AppColors.teal500.withValues(alpha: 0.16),
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(
                                  color: AppColors.teal400.withValues(alpha: 0.4),
                                ),
                              ),
                              child: const Icon(
                                Icons.qr_code_scanner_rounded,
                                color: AppColors.teal300,
                                size: 34,
                              ),
                            ),
                            const SizedBox(height: 14),
                            const Text(
                              'Xử lý trực tiếp trên thiết bị, không lưu hay gửi ảnh camera lên máy chủ.',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                color: AppColors.sand200,
                                fontSize: 13,
                              ),
                            ),
                            const SizedBox(height: 16),
                            ElevatedButton.icon(
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppColors.teal600,
                                foregroundColor: Colors.white,
                                padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 14),
                              ),
                              onPressed: _startCamera,
                              icon: const Icon(Icons.camera_alt_rounded),
                              label: const Text('Bật Camera để quét QR'),
                            ),
                          ],
                        ),
                      ),

                    // Viewfinder brackets
                    IgnorePointer(
                      child: Center(
                        child: Container(
                          width: 190,
                          height: 190,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(22),
                            border: Border.all(
                              color: AppColors.teal400.withValues(alpha: _scanning ? 0.85 : 0.35),
                              width: 2.5,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              if (_scanning)
                Container(
                  color: AppColors.sand50,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  child: Row(
                    children: [
                      const Icon(Icons.my_location_rounded, size: 16, color: AppColors.leaf600),
                      const SizedBox(width: 8),
                      const Expanded(
                        child: Text(
                          'Đưa mã QR vào khung ngắm...',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: AppColors.river800,
                          ),
                        ),
                      ),
                      TextButton.icon(
                        onPressed: _stopCamera,
                        icon: const Icon(Icons.videocam_off_outlined, size: 18),
                        label: const Text('Tắt camera'),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),

        if (_errorText != null) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(13),
            decoration: BoxDecoration(
              color: AppColors.lotus50,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.lotus200),
            ),
            child: Row(
              children: [
                const Icon(Icons.warning_amber_rounded, color: AppColors.lotus700),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    _errorText!,
                    style: const TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w600,
                      color: AppColors.lotus700,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],

        const SizedBox(height: 16),

        // Nhập mã thủ công
        Card(
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(9),
                      decoration: BoxDecoration(
                        color: AppColors.leaf50,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(Icons.keyboard_alt_outlined, color: AppColors.leaf700, size: 20),
                    ),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Nhập mã định danh QR thủ công',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w800,
                              color: AppColors.river900,
                            ),
                          ),
                          SizedBox(height: 2),
                          Text(
                            'Nhập mã in bên dưới bảng QR tại điểm đến (VD: TRAMCHIM-01)',
                            style: TextStyle(fontSize: 12.5, color: AppColors.river600),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _codeController,
                        textCapitalization: TextCapitalization.characters,
                        decoration: const InputDecoration(
                          hintText: 'VD: TRAMCHIM-01, HTL-01...',
                          prefixIcon: Icon(Icons.qr_code_rounded),
                        ),
                        onSubmitted: _openCode,
                      ),
                    ),
                    const SizedBox(width: 10),
                    ElevatedButton(
                      onPressed: () => _openCode(_codeController.text),
                      child: const Text('Mở mã'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),

        const SizedBox(height: 16),

        // Danh sách Trạm QR Thí điểm chọn nhanh (rất tiện để test trên máy ảo Android Studio!)
        Card(
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    Icon(Icons.bolt_rounded, color: AppColors.teal600, size: 22),
                    SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        'Trạm QR thí điểm (Chạm để mở nhanh)',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          color: AppColors.river900,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                const Text(
                  'Dùng khi trải nghiệm trên máy ảo Android Studio hoặc không có camera:',
                  style: TextStyle(fontSize: 12.5, color: AppColors.river600),
                ),
                const SizedBox(height: 12),
                ..._pilotQrCodes.map(
                  (item) => Container(
                    margin: const EdgeInsets.only(bottom: 10),
                    decoration: BoxDecoration(
                      color: AppColors.sand50,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppColors.sand200),
                    ),
                    child: Material(
                      color: Colors.transparent,
                      child: ListTile(
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                        onTap: () => _openCode(item.code),
                        leading: Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: item.active ? AppColors.leaf100 : AppColors.sand200,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Icon(
                            Icons.qr_code_2_rounded,
                            color: item.active ? AppColors.leaf700 : AppColors.river500,
                          ),
                        ),
                        title: Text(
                          item.title,
                          style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 14,
                            color: AppColors.river900,
                          ),
                        ),
                        subtitle: Text(
                          '${item.code} · ${item.area}',
                          style: const TextStyle(fontSize: 12, color: AppColors.river600),
                        ),
                        trailing: const Icon(Icons.chevron_right_rounded, color: AppColors.leaf600),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
