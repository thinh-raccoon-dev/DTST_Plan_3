import { Camera, CameraOff, Keyboard, QrCode, ScanLine, ShieldCheck } from 'lucide-react';
import type QrScannerType from 'qr-scanner';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageContainer } from '../components/layout/PublicLayout';
import { ManualCodeForm } from '../components/qr/ManualCodeForm';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Notice } from '../components/ui/States';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { extractQrCode } from '../lib/qr';

type CameraState = 'idle' | 'starting' | 'scanning' | 'denied' | 'unavailable' | 'insecure';

function describeCameraError(error: unknown): CameraState {
  const name = error instanceof DOMException || error instanceof Error ? error.name : String(error);
  if (/NotAllowed|Permission|denied/i.test(name)) return 'denied';
  return 'unavailable';
}

export function ScanPage() {
  useDocumentTitle('Quét mã QR');
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScannerType | null>(null);
  const [state, setState] = useState<CameraState>('idle');
  const [invalidScan, setInvalidScan] = useState(false);

  useEffect(() => {
    return () => {
      scannerRef.current?.destroy();
      scannerRef.current = null;
    };
  }, []);

  const start = async () => {
    if (!window.isSecureContext) {
      setState('insecure');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setState('unavailable');
      return;
    }
    setState('starting');
    try {
      const { default: QrScanner } = await import('qr-scanner');
      if (!(await QrScanner.hasCamera())) {
        setState('unavailable');
        return;
      }
      if (!videoRef.current) return;
      scannerRef.current?.destroy();
      const scanner = new QrScanner(
        videoRef.current,
        (result) => {
          const code = extractQrCode(result.data);
          if (code) {
            scanner.stop();
            navigate(`/qr/${code}`);
          } else {
            setInvalidScan(true);
          }
        },
        { preferredCamera: 'environment', highlightScanRegion: true, highlightCodeOutline: true, returnDetailedScanResult: true },
      );
      scannerRef.current = scanner;
      await scanner.start();
      setState('scanning');
    } catch (error) {
      setState(describeCameraError(error));
    }
  };

  const stop = () => {
    scannerRef.current?.stop();
    setState('idle');
  };

  return (
    <PageContainer width="medium">
      <div className="tp-fade-up rounded-panel border border-sand-200 bg-gradient-to-br from-leaf-950 via-leaf-900 to-river-900 p-6 text-white shadow-raised sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-pill bg-white/10 px-3 py-1 text-xs font-semibold text-teal-300 ring-1 ring-white/15">
              <QrCode className="size-3.5" aria-hidden /> Trạm tương tác tại điểm đến
            </span>
            <h1 className="mt-2.5 text-2xl font-bold text-white sm:text-3xl">Quét mã QR</h1>
            <p className="mt-1 max-w-xl text-sm text-sand-200">
              Quét mã QR đặt tại điểm đến thí điểm để mở câu chuyện bản địa, check-in nhận dấu mộc và tham gia thử thách.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-pill bg-white/10 px-3 py-1.5 text-xs text-sand-200">
            <ShieldCheck className="size-4 text-teal-300" aria-hidden /> Xử lý trực tiếp trên thiết bị
          </span>
        </div>
      </div>

      <Card className="mt-6 overflow-hidden border-sand-300 shadow-raised">
        <div className="relative aspect-square max-h-[68vh] w-full bg-river-950 sm:aspect-video">
          <video ref={videoRef} className={`h-full w-full object-cover ${state === 'scanning' ? '' : 'invisible'}`} muted playsInline />

          {/* Viewfinder corner brackets */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8">
            <div className="relative size-56 max-w-full sm:size-64">
              <span className="absolute left-0 top-0 size-7 rounded-tl-xl border-l-4 border-t-4 border-teal-400/80" />
              <span className="absolute right-0 top-0 size-7 rounded-tr-xl border-r-4 border-t-4 border-teal-400/80" />
              <span className="absolute bottom-0 left-0 size-7 rounded-bl-xl border-b-4 border-l-4 border-teal-400/80" />
              <span className="absolute bottom-0 right-0 size-7 rounded-br-xl border-b-4 border-r-4 border-teal-400/80" />
              {state === 'scanning' && (
                <div className="tp-shimmer absolute inset-x-3 top-1/2 h-0.5 -translate-y-1/2 bg-gradient-to-r from-transparent via-teal-300 to-transparent shadow-[0_0_12px_#2dd4bf]" />
              )}
            </div>
          </div>

          {state !== 'scanning' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-river-950/80 p-6 text-center text-river-100 backdrop-blur-[2px]">
              <div className="tp-float flex size-16 items-center justify-center rounded-2xl bg-teal-500/15 text-teal-300 ring-1 ring-teal-400/30">
                <ScanLine className="size-9" aria-hidden />
              </div>
              <p className="max-w-sm text-sm text-sand-200">
                Hệ thống chỉ dùng camera để đọc mã QR ngay trên thiết bị của bạn, không ghi hình hay gửi hình ảnh đi.
              </p>
              <Button
                variant="accent"
                size="lg"
                onClick={start}
                loading={state === 'starting'}
                className="tp-pulse-ring"
                icon={<Camera className="size-5" aria-hidden />}
              >
                Bật camera để quét
              </Button>
            </div>
          )}
        </div>
        {state === 'scanning' && (
          <div className="flex items-center justify-between gap-3 bg-sand-50 px-5 py-3.5">
            <p className="inline-flex items-center gap-2 text-sm font-medium text-river-700">
              <span className="size-2.5 animate-ping rounded-full bg-teal-500" aria-hidden />
              Đưa mã QR vào khung hình…
            </p>
            <Button variant="secondary" size="sm" onClick={stop} icon={<CameraOff className="size-4" aria-hidden />}>
              Tắt camera
            </Button>
          </div>
        )}
      </Card>

      <div className="mt-4 space-y-3" aria-live="polite">
        {invalidScan && <Notice tone="warning">Mã vừa quét không thuộc hệ thống Hộ chiếu Đồng Tháp. Hãy quét mã QR tại điểm đến thí điểm.</Notice>}
        {state === 'denied' && (
          <Notice tone="warning" title="Chưa có quyền dùng camera">
            Hãy cho phép trình duyệt truy cập camera (biểu tượng ổ khóa cạnh thanh địa chỉ → Quyền camera), rồi thử lại. Hoặc nhập mã bên dưới.
          </Notice>
        )}
        {state === 'unavailable' && (
          <Notice tone="warning" title="Không tìm thấy camera">
            Thiết bị hoặc trình duyệt không hỗ trợ camera. Bạn có thể dùng ứng dụng camera của điện thoại để quét, hoặc nhập mã bên dưới.
          </Notice>
        )}
        {state === 'insecure' && (
          <Notice tone="warning" title="Cần kết nối HTTPS">
            Trình duyệt chỉ cho phép dùng camera trên trang HTTPS. Hãy dùng ứng dụng camera của điện thoại để quét mã, hoặc nhập mã bên dưới.
          </Notice>
        )}
      </div>

      <Card className="mt-6 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-leaf-50 text-leaf-700 ring-1 ring-leaf-200/70">
            <Keyboard className="size-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-lg">Không quét được bằng camera?</h2>
            <p className="mt-0.5 text-sm text-river-600">Nhập mã định danh in ngay bên dưới bảng mã QR tại điểm đến.</p>
          </div>
        </div>
        <div className="mt-4">
          <ManualCodeForm />
        </div>
      </Card>
    </PageContainer>
  );
}
