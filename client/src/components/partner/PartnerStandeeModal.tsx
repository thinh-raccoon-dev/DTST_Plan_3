import { Check, Copy, Download, Loader2, Printer, QrCode } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, toApiError } from '../../lib/api';
import { printStandeeImageIsolated, renderStandeePngDataUrl } from '../../lib/partnerStandee';
import { toast } from '../../stores/toastStore';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

export interface StandeeQrTarget {
  id: string;
  code: string;
  label: string;
  targetType: string;
  url?: string;
}

interface PartnerStandeeModalProps {
  qr: StandeeQrTarget | null;
  destinationName: string;
  onClose: () => void;
}

export function PartnerStandeeModal({ qr, destinationName, onClose }: PartnerStandeeModalProps) {
  const [loading, setLoading] = useState(false);
  const [standeePng, setStandeePng] = useState<string | null>(null);
  const [qrPublicUrl, setQrPublicUrl] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!qr) {
      setStandeePng(null);
      setErrorMsg(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setErrorMsg(null);
    setStandeePng(null);

    (async () => {
      try {
        const res = await api.get<{
          success: boolean;
          code: string;
          url: string;
          dataUrl: string;
        }>(`/admin/partner/qr/${qr.id}/image`);
        if (cancelled) return;
        setQrPublicUrl(res.data.url || qr.url || `${window.location.origin}/qr/${qr.code}`);

        const composedPng = await renderStandeePngDataUrl({
          destinationName,
          qrLabel: qr.label,
          qrCode: qr.code,
          qrImageDataUrl: res.data.dataUrl,
          targetType: qr.targetType,
        });
        if (!cancelled) {
          setStandeePng(composedPng);
        }
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(toApiError(err).message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [qr, destinationName]);

  const handleDownloadPng = () => {
    if (!standeePng || !qr) return;
    const a = document.createElement('a');
    a.href = standeePng;
    const slug = qr.code.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
    a.download = `standee-dtst-${slug}.png`;
    a.click();
    toast.success('Đã tải ảnh Standee chất lượng in HD (1240×1754)!');
  };

  const handlePrintIsolated = () => {
    if (!standeePng || !qr) return;
    printStandeeImageIsolated(standeePng, `${destinationName}-${qr.code}`);
  };

  const handleCopyUrl = async () => {
    if (!qrPublicUrl) return;
    try {
      await navigator.clipboard.writeText(qrPublicUrl);
      setCopied(true);
      toast.success('Đã sao chép đường dẫn mã QR!');
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error('Không thể sao chép vào bộ nhớ tạm.');
    }
  };

  return (
    <Modal
      open={Boolean(qr)}
      size="md"
      title="Bộ Standee Trưng Bày Quầy Vé Chuẩn In Ấn (HD)"
      onClose={onClose}
    >
      {qr && (
        <div className="space-y-4">
          <div className="rounded-xl bg-leaf-50 border border-leaf-200 px-3.5 py-2.5 text-xs text-leaf-900">
            <strong>100% tạo nội bộ (Offline-safe):</strong> Mã QR được sinh trực tiếp từ máy chủ Đồng Tháp Smart Travel (không qua dịch vụ bên thứ ba), chuẩn kích thước <strong>1240×1754px (A5/A4 150-300 DPI)</strong> sẵn sàng in ép mica đặt tại quầy vé.
          </div>

          <div className="flex flex-col items-center justify-center rounded-2xl border border-sand-300 bg-sand-50/70 p-4 min-h-[340px]">
            {loading && (
              <div className="flex flex-col items-center gap-2 text-river-600 py-12">
                <Loader2 className="size-8 animate-spin text-leaf-600" />
                <span className="text-xs font-medium">Đang kết xuất Standee độ phân giải cao...</span>
              </div>
            )}

            {!loading && errorMsg && (
              <div className="text-center space-y-2 py-8">
                <QrCode className="size-10 mx-auto text-red-400" />
                <p className="text-sm font-semibold text-red-700">{errorMsg}</p>
              </div>
            )}

            {!loading && standeePng && (
              <img
                src={standeePng}
                alt={`Standee QR ${qr.code}`}
                className="max-h-[420px] w-auto rounded-xl border border-sand-300 shadow-lg"
              />
            )}
          </div>

          {qrPublicUrl && (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-sand-200 bg-white px-3 py-2 text-xs">
              <span className="truncate font-mono text-river-700">{qrPublicUrl}</span>
              <button
                type="button"
                onClick={handleCopyUrl}
                className="inline-flex shrink-0 items-center gap-1 rounded-md bg-sand-100 px-2.5 py-1 font-semibold text-river-800 hover:bg-sand-200"
              >
                {copied ? <Check className="size-3.5 text-leaf-700" /> : <Copy className="size-3.5" />}
                {copied ? 'Đã chép' : 'Sao chép'}
              </button>
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-sand-200">
            <Button type="button" variant="secondary" onClick={onClose}>
              Đóng
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={!standeePng}
              onClick={handleDownloadPng}
              icon={<Download className="size-4" />}
            >
              Tải ảnh PNG (HD)
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={!standeePng}
              onClick={handlePrintIsolated}
              icon={<Printer className="size-4" />}
            >
              In Standee (Trang sạch)
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
