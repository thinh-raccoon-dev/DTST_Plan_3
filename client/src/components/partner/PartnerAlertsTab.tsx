import clsx from 'clsx';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  Radio,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { useApiQuery } from '../../hooks/useApiQuery';
import { api, toApiError } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { toast } from '../../stores/toastStore';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Input, Select } from '../ui/Field';
import { ConfirmDialog, Modal } from '../ui/Modal';
import { ErrorState, PageLoader } from '../ui/States';

interface PartnerAlertItem {
  id: string;
  type: 'accident' | 'landslide' | 'flood' | 'storm' | 'road_closed';
  severity: 'advisory' | 'warning' | 'critical';
  title: string;
  description: string;
  radiusKm: number;
  terrainImpact: 'mountain' | 'coastal_river' | 'road_corridor' | 'outdoor' | 'all';
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
}

const ALERT_TYPE_LABELS: Record<PartnerAlertItem['type'], string> = {
  flood: '🌊 Triều cường / Ngập úng',
  storm: '⛈️ Mưa giông / Gió lốc',
  road_closed: '🚧 Sửa đường / Cấm xe vào KDL',
  landslide: '⚠️ Sạt lở bờ sông / Đường mòn',
  accident: '🚨 Sự cố giao thông / Y tế gần điểm',
};

const SEVERITY_META: Record<
  PartnerAlertItem['severity'],
  { label: string; badge: 'teal' | 'neutral' | 'lotus' | 'red'; border: string }
> = {
  advisory: { label: 'Khuyến nghị', badge: 'teal', border: 'border-sand-300 bg-white' },
  warning: { label: 'Cảnh báo', badge: 'lotus', border: 'border-amber-300 bg-amber-50/40' },
  critical: { label: 'Khẩn cấp', badge: 'red', border: 'border-red-300 bg-red-50/50' },
};

const TERRAIN_LABELS: Record<PartnerAlertItem['terrainImpact'], string> = {
  outdoor: 'Hoạt động ngoài trời / Vườn sinh thái',
  coastal_river: 'Kênh rạch / Bến tàu / Sông nước',
  road_corridor: 'Tuyến đường vào khu du lịch',
  mountain: 'Khu đồi cao / Cầu ngắm cảnh',
  all: 'Toàn bộ khuôn viên điểm đến',
};

interface PartnerAlertsTabProps {
  destinationId: string;
  destinationName: string;
  hasCoordinates: boolean;
  onChanged: () => void;
}

export function PartnerAlertsTab({
  destinationId,
  destinationName,
  hasCoordinates,
  onChanged,
}: PartnerAlertsTabProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [type, setType] = useState<PartnerAlertItem['type']>('flood');
  const [severity, setSeverity] = useState<PartnerAlertItem['severity']>('warning');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [radiusKm, setRadiusKm] = useState(3);
  const [terrainImpact, setTerrainImpact] = useState<PartnerAlertItem['terrainImpact']>('outdoor');
  const [hoursValid, setHoursValid] = useState(24);
  const [submitting, setSubmitting] = useState(false);

  const [deactivateTarget, setDeactivateTarget] = useState<PartnerAlertItem | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  const query = useApiQuery<{ success: boolean; items: PartnerAlertItem[] }>(
    (signal) =>
      api
        .get('/admin/partner/alerts', { params: { destinationId }, signal })
        .then((r) => r.data),
    [destinationId],
  );

  const items = query.data?.items || [];
  const activeCount = items.filter((a) => a.isActive && (!a.expiresAt || new Date(a.expiresAt) > new Date())).length;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 5) {
      toast.error('Tiêu đề cảnh báo cần ít nhất 5 ký tự.');
      return;
    }
    if (description.trim().length < 10) {
      toast.error('Mô tả chi tiết và hướng dẫn an toàn cần ít nhất 10 ký tự.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/admin/partner/alerts', {
        destinationId,
        type,
        severity,
        title: title.trim(),
        description: description.trim(),
        radiusKm: Number(radiusKm) || 3,
        terrainImpact,
        hoursValid: Number(hoursValid) || 24,
      });
      toast.success('Đã phát cảnh báo thực địa lên Bản đồ 3D & Trợ lý An toàn!');
      setModalOpen(false);
      setTitle('');
      setDescription('');
      query.reload();
      onChanged();
    } catch (err) {
      toast.error(toApiError(err).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async () => {
    if (!deactivateTarget) return;
    setDeactivating(true);
    try {
      await api.delete(`/admin/partner/alerts/${deactivateTarget.id}`);
      toast.success('Đã gỡ cảnh báo thực địa thành công!');
      setDeactivateTarget(null);
      query.reload();
      onChanged();
    } catch (err) {
      toast.error(toApiError(err).message);
    } finally {
      setDeactivating(false);
    }
  };

  return (
    <Card className="mt-6 p-5 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-sand-200 pb-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-lg text-river-900 flex items-center gap-2">
              <ShieldAlert className="size-5 text-red-600" />
              Cảnh báo An toàn Thực địa (Safety Guardian & Bản đồ 3D)
            </h3>
            <Badge tone={activeCount > 0 ? 'lotus' : 'leaf'}>
              {activeCount > 0 ? `${activeCount} đang phát sóng` : 'An toàn bình thường'}
            </Badge>
          </div>
          <p className="text-xs text-river-600 max-w-2xl">
            Phát cảnh báo triều cường, mưa giông, sạt lở hoặc sửa đường ngay tại <strong>{destinationName}</strong>. Cảnh báo sẽ tự động đồng bộ vào hệ thống lập lịch trình AI Trip Planner V9 và bản đồ du khách (bán kính tối đa 15km, tự động hết hạn).
          </p>
        </div>

        <Button
          variant="danger"
          size="sm"
          disabled={!hasCoordinates}
          onClick={() => setModalOpen(true)}
          icon={<Plus className="size-4" />}
        >
          Phát cảnh báo mới
        </Button>
      </div>

      {!hasCoordinates && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-900 flex items-center gap-2">
          <AlertTriangle className="size-4 shrink-0 text-amber-600" />
          <span>
            Địa điểm này chưa có tọa độ GPS. Vui lòng vào mục <strong>Chỉnh sửa hồ sơ KDL</strong> để chấm tọa độ bản đồ trước khi phát cảnh báo thực địa.
          </span>
        </div>
      )}

      {query.loading ? (
        <PageLoader />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={query.reload} />
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-sand-300 bg-sand-50/60 py-10 text-center space-y-2">
          <CheckCircle2 className="size-10 mx-auto text-leaf-600/70" />
          <p className="text-sm font-bold text-river-800">Không có cảnh báo rủi ro nào tại {destinationName}</p>
          <p className="text-xs text-river-500 max-w-md mx-auto">
            Khi có triều cường dâng cao, mưa giông hoặc sửa chữa tuyến đường vào KDL, bạn hãy phát cảnh báo để du khách chủ động điều chỉnh lịch trình an toàn.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((alert) => {
            const isExpired = alert.expiresAt ? new Date(alert.expiresAt) <= new Date() : false;
            const live = alert.isActive && !isExpired;
            const meta = SEVERITY_META[alert.severity] || SEVERITY_META.warning;

            return (
              <div
                key={alert.id}
                className={clsx(
                  'rounded-2xl border p-4 space-y-3 transition',
                  live ? meta.border : 'border-sand-200 bg-sand-50/60 opacity-75',
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={live ? meta.badge : 'neutral'}>
                      {live ? (
                        <span className="inline-flex items-center gap-1">
                          <Radio className="size-3 animate-pulse" /> {meta.label}
                        </span>
                      ) : isExpired ? (
                        'Đã hết hạn'
                      ) : (
                        'Đã gỡ'
                      )}
                    </Badge>
                    <span className="text-xs font-semibold text-river-700">
                      {ALERT_TYPE_LABELS[alert.type]}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] font-semibold text-river-500">
                    Bán kính {alert.radiusKm}km
                  </span>
                </div>

                <div>
                  <h4 className="font-bold text-river-900 text-sm">{alert.title}</h4>
                  <p className="mt-1 text-xs text-river-700 leading-relaxed">{alert.description}</p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-sand-200/80 text-[11px] text-river-500">
                  <div className="space-y-0.5">
                    <p>Ảnh hưởng: {TERRAIN_LABELS[alert.terrainImpact] || alert.terrainImpact}</p>
                    <p className="flex items-center gap-1">
                      <Clock className="size-3" />
                      {alert.expiresAt ? `Hết hạn: ${formatDateTime(alert.expiresAt)}` : `Tạo lúc: ${formatDateTime(alert.createdAt)}`}
                    </p>
                  </div>
                  {live && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setDeactivateTarget(alert)}
                      icon={<Trash2 className="size-3.5 text-red-600" />}
                    >
                      Gỡ cảnh báo
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Alert Modal */}
      <Modal
        open={modalOpen}
        size="md"
        title={`Phát Cảnh Báo Thực Địa — ${destinationName}`}
        onClose={() => setModalOpen(false)}
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <strong>Trách nhiệm công bố thông tin (Luật Du lịch):</strong> Chỉ phát cảnh báo đúng tình hình thực tế tại điểm đến. Mọi hành động phát và gỡ cảnh báo đều được lưu vào Nhật ký kiểm toán.
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="pa-type" className="block text-xs font-bold uppercase tracking-wider text-river-700 mb-1">
                Loại sự cố *
              </label>
              <Select
                id="pa-type"
                value={type}
                onChange={(e) => setType(e.target.value as PartnerAlertItem['type'])}
              >
                {Object.entries(ALERT_TYPE_LABELS).map(([k, lbl]) => (
                  <option key={k} value={k}>
                    {lbl}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label htmlFor="pa-sev" className="block text-xs font-bold uppercase tracking-wider text-river-700 mb-1">
                Mức độ nghiêm trọng *
              </label>
              <Select
                id="pa-sev"
                value={severity}
                onChange={(e) => setSeverity(e.target.value as PartnerAlertItem['severity'])}
              >
                <option value="advisory">ℹ️ Khuyến nghị lưu ý</option>
                <option value="warning">⚠️ Cảnh báo (Cần chuẩn bị / Tránh giờ cao điểm)</option>
                <option value="critical">🚨 Khẩn cấp (Tạm tránh khu vực)</option>
              </Select>
            </div>
          </div>

          <div>
            <label htmlFor="pa-title" className="block text-xs font-bold uppercase tracking-wider text-river-700 mb-1">
              Tiêu đề cảnh báo *
            </label>
            <Input
              id="pa-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Triều cường dâng nhẹ lối vào bến xuồng từ 15h00 - 17h30"
              required
            />
          </div>

          <div>
            <label htmlFor="pa-desc" className="block text-xs font-bold uppercase tracking-wider text-river-700 mb-1">
              Mô tả chi tiết & Hướng dẫn an toàn cho du khách *
            </label>
            <textarea
              id="pa-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Nêu rõ khu vực ảnh hưởng, tuyến đường thay thế hoặc lời khuyên trang phục/thời gian di chuyển..."
              className="w-full rounded-control border border-sand-300 bg-white p-2.5 text-sm text-river-800 focus:border-leaf-600 focus:outline-none"
              required
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="pa-radius" className="block text-xs font-bold uppercase tracking-wider text-river-700 mb-1">
                Bán kính (0.5–15km)
              </label>
              <Input
                id="pa-radius"
                type="number"
                step="0.5"
                min={0.5}
                max={15}
                value={radiusKm}
                onChange={(e) => setRadiusKm(Number(e.target.value))}
                required
              />
            </div>

            <div>
              <label htmlFor="pa-hours" className="block text-xs font-bold uppercase tracking-wider text-river-700 mb-1">
                Hiệu lực tự tắt
              </label>
              <Select
                id="pa-hours"
                value={String(hoursValid)}
                onChange={(e) => setHoursValid(Number(e.target.value))}
              >
                <option value="6">6 giờ</option>
                <option value="12">12 giờ</option>
                <option value="24">24 giờ (1 ngày)</option>
                <option value="48">48 giờ (2 ngày)</option>
                <option value="72">72 giờ (3 ngày)</option>
                <option value="168">168 giờ (7 ngày)</option>
              </Select>
            </div>

            <div>
              <label htmlFor="pa-terrain" className="block text-xs font-bold uppercase tracking-wider text-river-700 mb-1">
                Khu vực chịu tác động
              </label>
              <Select
                id="pa-terrain"
                value={terrainImpact}
                onChange={(e) => setTerrainImpact(e.target.value as PartnerAlertItem['terrainImpact'])}
              >
                {Object.entries(TERRAIN_LABELS).map(([k, lbl]) => (
                  <option key={k} value={k}>
                    {lbl}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-sand-200">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)} disabled={submitting}>
              Hủy
            </Button>
            <Button type="submit" variant="danger" loading={submitting} icon={<ShieldAlert className="size-4" />}>
              Phát cảnh báo ngay
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deactivateTarget)}
        title="Gỡ cảnh báo thực địa?"
        message={
          <>
            Xác nhận tình huống tại <strong>{deactivateTarget?.title}</strong> đã an toàn trở lại và gỡ cảnh báo khỏi bản đồ du khách?
          </>
        }
        confirmLabel="Xác nhận gỡ"
        tone="primary"
        loading={deactivating}
        onConfirm={handleDeactivate}
        onCancel={() => setDeactivateTarget(null)}
      />
    </Card>
  );
}
