import { Camera, CameraOff, ScanLine } from 'lucide-react';
import type QrScannerType from 'qr-scanner';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageContainer } from '../components/layout/PublicLayout';
import { ManualCodeForm } from '../components/qr/ManualCodeForm';
import { Button } from '../components/ui/Button';
import { Card, SectionHeading } from '../components/ui/Card';
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
      <SectionHeading as="h1" title="Quét mã QR" description="Quét mã QR đặt tại điểm đến thí điểm để mở câu chuyện, check-in và tham gia thử thách." />

      <Card className="mt-6 overflow-hidden">
        <div className="relative aspect-square max-h-[70vh] w-full bg-river-950 sm:aspect-video">
          <video ref={videoRef} className={`h-full w-full object-cover ${state === 'scanning' ? '' : 'invisible'}`} muted playsInline />
          {state !== 'scanning' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center text-river-100">
              <ScanLine className="size-14 text-leaf-300" aria-hidden />
              <p className="max-w-sm text-sm">Hệ thống chỉ dùng camera để đọc mã QR ngay trên thiết bị của bạn, không ghi hình hay gửi hình ảnh đi.</p>
              <Button variant="accent" size="lg" onClick={start} loading={state === 'starting'} icon={<Camera className="size-5" aria-hidden />}>
                Bật camera để quét
              </Button>
            </div>
          )}
        </div>
        {state === 'scanning' && (
          <div className="flex items-center justify-between gap-3 p-4">
            <p className="text-sm text-river-600">Đưa mã QR vào khung hình…</p>
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

      <Card className="mt-6 p-5">
        <h2 className="text-lg">Không quét được?</h2>
        <p className="mt-1 text-sm text-river-600">Nhập mã in bên dưới mã QR tại điểm đến.</p>
        <div className="mt-4">
          <ManualCodeForm />
        </div>
      </Card>
    </PageContainer>
  );
}
