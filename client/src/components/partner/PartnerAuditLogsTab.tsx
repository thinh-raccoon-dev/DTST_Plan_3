import { Clock, Shield } from 'lucide-react';
import { useApiQuery } from '../../hooks/useApiQuery';
import { api } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { ErrorState, PageLoader } from '../ui/States';

interface PartnerAuditItem {
  id: string;
  actorName: string;
  actorRole: 'admin' | 'partner' | 'tourist' | 'system';
  action: string;
  targetType: string;
  targetName: string;
  details: Record<string, unknown>;
  createdAt: string;
}

const ACTION_LABELS: Record<string, { label: string; tone: 'leaf' | 'teal' | 'lotus' | 'red' | 'neutral' }> = {
  'destination.operational_status.toggle': { label: 'Cập nhật trạng thái mở cửa / thông báo', tone: 'teal' },
  'destination.update': { label: 'Chỉnh sửa hồ sơ điểm đến', tone: 'leaf' },
  'challenge.create': { label: 'Tạo thử thách văn hóa', tone: 'leaf' },
  'challenge.update': { label: 'Cập nhật thử thách văn hóa', tone: 'neutral' },
  'challenge.archive': { label: 'Tạm dừng thử thách (bảo toàn lịch sử)', tone: 'lotus' },
  'challenge.delete': { label: 'Xóa thử thách', tone: 'red' },
  'qr.create': { label: 'Phát hành mã QR mới', tone: 'leaf' },
  'qr.update': { label: 'Cập nhật mã QR', tone: 'neutral' },
  'qr.disable': { label: 'Vô hiệu hóa mã QR (có lịch sử quét)', tone: 'lotus' },
  'qr.delete': { label: 'Xóa mã QR', tone: 'red' },
  'badge.create': { label: 'Phát hành huy hiệu KDL', tone: 'leaf' },
  'badge.update': { label: 'Cập nhật huy hiệu KDL', tone: 'neutral' },
  'badge.delete': { label: 'Xóa huy hiệu KDL', tone: 'red' },
  'safety_alert.create': { label: 'Phát cảnh báo an toàn thực địa', tone: 'red' },
  'safety_alert.deactivate': { label: 'Gỡ cảnh báo an toàn thực địa', tone: 'leaf' },
  'partner.report.export': { label: 'Xuất báo cáo CSV (ẩn danh NĐ 13)', tone: 'teal' },
  'review.respond': { label: 'Phản hồi đánh giá du khách', tone: 'leaf' },
  'voucher.create': { label: 'Phát hành Voucher ưu đãi mới', tone: 'leaf' },
  'voucher.update': { label: 'Cập nhật Voucher ưu đãi', tone: 'neutral' },
  'voucher.pause': { label: 'Tạm ngừng phát hành Voucher (bảo toàn mã đã đổi)', tone: 'lotus' },
  'voucher.delete': { label: 'Xóa Voucher ưu đãi', tone: 'red' },
  'voucher.redeem': { label: 'Đối soát gạch mã Voucher tại quầy', tone: 'teal' },
  'service.create': { label: 'Niêm yết dịch vụ / Combo mới', tone: 'leaf' },
  'service.update': { label: 'Cập nhật bảng giá dịch vụ', tone: 'neutral' },
  'service.delete': { label: 'Gỡ dịch vụ khỏi bảng giá', tone: 'red' },
  'inquiry.update': { label: 'Cập nhật xử lý yêu cầu đặt đoàn', tone: 'teal' },
  'banner.submit': { label: 'Gửi duyệt Banner mùa vụ lên Sở VHTTDL', tone: 'teal' },
  'banner.approve': { label: 'Sở VHTTDL phê duyệt Banner', tone: 'leaf' },
  'banner.reject': { label: 'Sở VHTTDL từ chối Banner', tone: 'red' },
  'banner.pause': { label: 'Tạm ngừng hiển thị Banner', tone: 'lotus' },
  'banner.withdraw': { label: 'Rút hồ sơ Banner', tone: 'neutral' },
};

export function PartnerAuditLogsTab({
  destinationId,
  destinationName,
}: {
  destinationId: string;
  destinationName: string;
}) {
  const query = useApiQuery<{ success: boolean; items: PartnerAuditItem[] }>(
    (signal) =>
      api
        .get('/admin/partner/audit-logs', { params: { destinationId }, signal })
        .then((r) => r.data),
    [destinationId],
  );

  const items = query.data?.items || [];

  return (
    <Card className="mt-6 p-5 sm:p-6 space-y-4">
      <div className="border-b border-sand-200 pb-4">
        <h3 className="font-bold text-lg text-river-900 flex items-center gap-2">
          <Shield className="size-5 text-leaf-700" />
          Nhật ký Vận hành & Kiểm toán — {destinationName}
        </h3>
        <p className="text-xs text-river-600 mt-1">
          Mọi thao tác thay đổi trạng thái đón khách, thử thách, mã QR, huy hiệu, cảnh báo thực địa và xuất báo cáo đều được ghi nhận bất biến để đảm bảo minh bạch và tuân thủ pháp luật.
        </p>
      </div>

      {query.loading ? (
        <PageLoader />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={query.reload} />
      ) : items.length === 0 ? (
        <p className="py-8 text-center text-sm text-river-500 italic">
          Chưa có nhật ký hoạt động nào được ghi nhận cho điểm đến này.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-sand-200 bg-sand-50 text-[11px] font-bold uppercase tracking-wider text-river-600">
                <th className="py-2.5 px-3">Thời điểm</th>
                <th className="py-2.5 px-3">Người thực hiện</th>
                <th className="py-2.5 px-3">Hành động</th>
                <th className="py-2.5 px-3">Đối tượng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-200">
              {items.map((log) => {
                const meta = ACTION_LABELS[log.action] || { label: log.action, tone: 'neutral' as const };
                return (
                  <tr key={log.id} className="hover:bg-sand-50/60">
                    <td className="py-3 px-3 whitespace-nowrap text-river-500 font-mono">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3" />
                        {formatDateTime(log.createdAt)}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-semibold text-river-900">{log.actorName}</span>
                      <span className="ml-1.5 rounded bg-sand-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-river-600">
                        {log.actorRole === 'admin' ? 'Sở VHTTDL' : 'Đối tác'}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                    </td>
                    <td className="py-3 px-3 font-medium text-river-800 max-w-xs truncate" title={log.targetName}>
                      {log.targetName || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
