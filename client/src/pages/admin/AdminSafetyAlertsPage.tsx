import clsx from 'clsx';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  MapPin,
  Plus,
  Radio,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { AdminPageHeader } from '../../components/layout/AdminLayout';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, StatCard } from '../../components/ui/Card';
import { Input, Select, Textarea } from '../../components/ui/Field';
import { ConfirmDialog, Modal } from '../../components/ui/Modal';
import { EmptyState, ErrorState, PageLoader } from '../../components/ui/States';
import { useApiQuery } from '../../hooks/useApiQuery';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { api, toApiError } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { toast } from '../../stores/toastStore';

interface AdminSafetyAlertItem {
  id: string;
  type: 'accident' | 'landslide' | 'flood' | 'storm' | 'road_closed';
  severity: 'advisory' | 'warning' | 'critical';
  title: string;
  description: string;
  areaLabel: string;
  coordinates: { lat: number; lng: number };
  radiusKm: number;
  terrainImpact: 'mountain' | 'coastal_river' | 'road_corridor' | 'outdoor' | 'all';
  source: 'admin' | 'partner' | 'weather_engine' | 'demo_simulation';
  isActive: boolean;
  isLive: boolean;
  isExpired: boolean;
  expiresAt: string | null;
  createdAt: string;
  destination: { id: string; name: string; slug: string; area: string } | null;
  createdBy: { id: string; displayName: string; email: string; role: string } | null;
}

interface AdminAlertsResponse {
  success: boolean;
  stats: {
    total: number;
    activeCount: number;
    partnerActiveCount: number;
    adminActiveCount: number;
  };
  items: AdminSafetyAlertItem[];
}

const AREA_PRESETS = [
  { label: 'TP. Cao Lãnh (Trung tâm Đồng Tháp)', lat: 10.4592, lng: 105.6325 },
  { label: 'TP. Sa Đéc (Làng Hoa & Nhà Cổ)', lat: 10.2925, lng: 105.7586 },
  { label: 'Tam Nông (VQG Tràm Chim)', lat: 10.7252, lng: 105.5184 },
  { label: 'Tháp Mười (Đồng Sen & Gò Tháp)', lat: 10.5762, lng: 105.8256 },
  { label: 'Lai Vung (Vườn Quýt Hồng)', lat: 10.289, lng: 105.654 },
  { label: 'TP. Hồng Ngự (Biên giới & Làng dệt)', lat: 10.808, lng: 105.344 },
  { label: 'TP. Mỹ Tho (Sông Tiền & Cù lao Thới Sơn)', lat: 10.354, lng: 106.364 },
  { label: 'Cái Bè (Chợ nổi & Làng cổ Đông Hòa Hiệp)', lat: 10.334, lng: 106.034 },
];

const TYPE_LABELS: Record<AdminSafetyAlertItem['type'], string> = {
  flood: '🌊 Triều cường / Ngập lụt',
  storm: '⛈️ Bão / Mưa giông diện rộng',
  road_closed: '🚧 Sửa đường / Cấm lưu thông',
  landslide: '⚠️ Sạt lở bờ sông / Đường bộ',
  accident: '🚨 Tai nạn giao thông / Sự cố khẩn',
};

const SEVERITY_META: Record<
  AdminSafetyAlertItem['severity'],
  { label: string; tone: 'teal' | 'lotus' | 'red' }
> = {
  advisory: { label: 'Khuyến nghị', tone: 'teal' },
  warning: { label: 'Cảnh báo', tone: 'lotus' },
  critical: { label: 'Khẩn cấp', tone: 'red' },
};

export function AdminSafetyAlertsPage() {
  useDocumentTitle('Trung tâm Cảnh báo An toàn Toàn tỉnh');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');
  const [modalOpen, setModalOpen] = useState(false);

  // Create form state
  const [type, setType] = useState<AdminSafetyAlertItem['type']>('storm');
  const [severity, setSeverity] = useState<AdminSafetyAlertItem['severity']>('warning');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [areaLabel, setAreaLabel] = useState(AREA_PRESETS[0]!.label);
  const [lat, setLat] = useState(AREA_PRESETS[0]!.lat);
  const [lng, setLng] = useState(AREA_PRESETS[0]!.lng);
  const [radiusKm, setRadiusKm] = useState(25);
  const [terrainImpact, setTerrainImpact] = useState<AdminSafetyAlertItem['terrainImpact']>('all');
  const [hoursValid, setHoursValid] = useState(24);
  const [submitting, setSubmitting] = useState(false);

  const [deactivateTarget, setDeactivateTarget] = useState<AdminSafetyAlertItem | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  const query = useApiQuery<AdminAlertsResponse>(
    (signal) =>
      api
        .get<AdminAlertsResponse>('/admin/safety-alerts', {
          params: {
            source: sourceFilter !== 'all' ? sourceFilter : undefined,
            status: statusFilter !== 'all' ? statusFilter : undefined,
          },
          signal,
        })
        .then((r) => r.data),
    [sourceFilter, statusFilter],
  );

  const stats = query.data?.stats;
  const items = query.data?.items || [];

  const handlePresetChange = (label: string) => {
    setAreaLabel(label);
    const match = AREA_PRESETS.find((p) => p.label === label);
    if (match) {
      setLat(match.lat);
      setLng(match.lng);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/safety/alerts', {
        type,
        severity,
        title: title.trim(),
        description: description.trim(),
        areaLabel: areaLabel.trim(),
        coordinates: { lat: Number(lat), lng: Number(lng) },
        radiusKm: Number(radiusKm) || 25,
        terrainImpact,
        hoursValid: Number(hoursValid) || 24,
      });
      toast.success('Đã phát cảnh báo an toàn cấp tỉnh lên Bản đồ 3D & Safety Guardian!');
      setModalOpen(false);
      setTitle('');
      setDescription('');
      query.reload();
    } catch (err) {
      toast.error('Không thể phát cảnh báo', toApiError(err).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async () => {
    if (!deactivateTarget) return;
    setDeactivating(true);
    try {
      await api.delete(`/safety/alerts/${deactivateTarget.id}`);
      toast.success('Đã gỡ cảnh báo an toàn khỏi bản đồ du khách!');
      setDeactivateTarget(null);
      query.reload();
    } catch (err) {
      toast.error('Không thể gỡ cảnh báo', toApiError(err).message);
    } finally {
      setDeactivating(false);
    }
  };

  return (
    <>
      <AdminPageHeader
        title="Trung tâm Cảnh báo An toàn Toàn tỉnh"
        description="Phát cảnh báo thiên tai, bão lũ, sạt lở diện rộng (tối đa 150km) đồng bộ tức thì vào AI Trip Planner V9 Safety Guardian & giám sát cảnh báo do các KDL phát."
        actions={
          <Button variant="danger" onClick={() => setModalOpen(true)} icon={<Plus className="size-4" />}>
            Phát cảnh báo cấp tỉnh
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Đang phát sóng toàn tỉnh"
          value={stats?.activeCount ?? '—'}
          icon={<Radio className="size-5 text-red-600" />}
        />
        <StatCard
          label="Cảnh báo Sở VHTTDL"
          value={stats?.adminActiveCount ?? '—'}
          hint="Phạm vi diện rộng cấp tỉnh"
          icon={<ShieldAlert className="size-5 text-lotus-600" />}
        />
        <StatCard
          label="Cảnh báo Đối tác KDL"
          value={stats?.partnerActiveCount ?? '—'}
          hint="Cảnh báo thực địa bán kính ≤15km"
          icon={<AlertTriangle className="size-5 text-amber-600" />}
        />
        <StatCard
          label="Tổng bản ghi hiển thị"
          value={stats?.total ?? '—'}
          icon={<CheckCircle2 className="size-5 text-leaf-700" />}
        />
      </div>

      <Card className="mt-6 p-4 flex flex-wrap items-center gap-3">
        <div className="w-52">
          <Select aria-label="Lọc trạng thái" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="active">Đang phát sóng</option>
            <option value="inactive">Đã gỡ / Hết hạn</option>
            <option value="all">Tất cả trạng thái</option>
          </Select>
        </div>
        <div className="w-52">
          <Select aria-label="Lọc nguồn phát" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
            <option value="all">Tất cả nguồn phát</option>
            <option value="admin">Sở VHTTDL (Admin)</option>
            <option value="partner">Đối tác KDL (Partner)</option>
          </Select>
        </div>
      </Card>

      <div className="mt-5">
        {query.loading && !query.data ? (
          <PageLoader />
        ) : query.error ? (
          <ErrorState error={query.error} onRetry={query.reload} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="size-7 text-leaf-600" />}
            title="Không có cảnh báo nào khớp bộ lọc"
            description="Tình hình du lịch toàn tỉnh hiện đang ổn định và an toàn."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {items.map((a) => {
              const sev = SEVERITY_META[a.severity] || SEVERITY_META.warning;
              return (
                <Card
                  key={a.id}
                  className={clsx(
                    'p-4 space-y-3',
                    a.isLive
                      ? a.severity === 'critical'
                        ? 'border-red-300 bg-red-50/40'
                        : 'border-amber-300 bg-amber-50/30'
                      : 'opacity-75 bg-sand-50/60',
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone={a.isLive ? sev.tone : 'neutral'}>
                        {a.isLive ? sev.label : a.isExpired ? 'Đã hết hạn' : 'Đã gỡ'}
                      </Badge>
                      <Badge tone={a.source === 'partner' ? 'teal' : 'leaf'}>
                        {a.source === 'partner' ? 'Đối tác KDL phát' : 'Sở VHTTDL phát'}
                      </Badge>
                      <span className="text-xs font-semibold text-river-700">{TYPE_LABELS[a.type]}</span>
                    </div>
                    <span className="font-mono text-xs font-bold text-river-600">{a.radiusKm}km</span>
                  </div>

                  <div>
                    <h3 className="font-bold text-sm text-river-900">{a.title}</h3>
                    <p className="mt-1 text-xs text-river-700 leading-relaxed">{a.description}</p>
                  </div>

                  <div className="text-[11px] text-river-500 space-y-1 pt-2 border-t border-sand-200">
                    <p className="flex items-center gap-1">
                      <MapPin className="size-3.5 text-leaf-700 shrink-0" />
                      {a.areaLabel} ({a.coordinates.lat.toFixed(4)}, {a.coordinates.lng.toFixed(4)})
                    </p>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        {a.expiresAt ? `Hết hạn: ${formatDateTime(a.expiresAt)}` : `Tạo: ${formatDateTime(a.createdAt)}`}
                        {a.createdBy && ` · Bởi: ${a.createdBy.displayName}`}
                      </span>
                      {a.isLive && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setDeactivateTarget(a)}
                          icon={<Trash2 className="size-3.5 text-red-600" />}
                        >
                          Gỡ cảnh báo
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Provincial Alert Modal */}
      <Modal
        open={modalOpen}
        size="lg"
        title="Phát Cảnh Báo An Toàn Cấp Tỉnh (Đồng bộ Bản đồ 3D & AI V9)"
        onClose={() => setModalOpen(false)}
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold uppercase text-river-700 mb-1">Loại sự cố *</label>
              <Select value={type} onChange={(e) => setType(e.target.value as AdminSafetyAlertItem['type'])}>
                {Object.entries(TYPE_LABELS).map(([k, lbl]) => (
                  <option key={k} value={k}>
                    {lbl}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-river-700 mb-1">Mức độ *</label>
              <Select value={severity} onChange={(e) => setSeverity(e.target.value as AdminSafetyAlertItem['severity'])}>
                <option value="advisory">ℹ️ Khuyến nghị</option>
                <option value="warning">⚠️ Cảnh báo</option>
                <option value="critical">🚨 Khẩn cấp (AI tự đề xuất đổi điểm)</option>
              </Select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-river-700 mb-1">Khu vực ảnh hưởng (chọn nhanh hoặc chỉnh tọa độ)</label>
            <Select value={areaLabel} onChange={(e) => handlePresetChange(e.target.value)}>
              {AREA_PRESETS.map((p) => (
                <option key={p.label} value={p.label}>
                  {p.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <label className="block text-xs font-bold uppercase text-river-700 mb-1">Vĩ độ (Lat) *</label>
              <Input type="number" step="0.0001" value={lat} onChange={(e) => setLat(Number(e.target.value))} required />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-river-700 mb-1">Kinh độ (Lng) *</label>
              <Input type="number" step="0.0001" value={lng} onChange={(e) => setLng(Number(e.target.value))} required />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-river-700 mb-1">Bán kính (0.5–150km)</label>
              <Input type="number" min={0.5} max={150} step="0.5" value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value))} required />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-river-700 mb-1">Hiệu lực (giờ)</label>
              <Select value={String(hoursValid)} onChange={(e) => setHoursValid(Number(e.target.value))}>
                <option value="6">6 giờ</option>
                <option value="12">12 giờ</option>
                <option value="24">24 giờ</option>
                <option value="48">48 giờ</option>
                <option value="72">72 giờ</option>
                <option value="168">7 ngày</option>
              </Select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-river-700 mb-1">Tiêu đề cảnh báo *</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VD: Cảnh báo mưa giông lớn & triều cường khu vực sông Tiền" required />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-river-700 mb-1">Hướng dẫn an toàn cho du khách *</label>
            <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Nêu rõ phạm vi ảnh hưởng và khuyến nghị chuyển sang các điểm tham quan trong nhà..." required />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-river-700 mb-1">Địa hình chịu tác động</label>
            <Select value={terrainImpact} onChange={(e) => setTerrainImpact(e.target.value as AdminSafetyAlertItem['terrainImpact'])}>
              <option value="all">Toàn bộ khu vực</option>
              <option value="outdoor">Hoạt động ngoài trời</option>
              <option value="coastal_river">Sông nước / Kênh rạch / Bến tàu</option>
              <option value="road_corridor">Tuyến đường giao thông</option>
              <option value="mountain">Khu vực đồi núi / Cầu cao</option>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-sand-200">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
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
        title="Gỡ cảnh báo an toàn?"
        message={
          <p>
            Xác nhận gỡ cảnh báo <strong>{deactivateTarget?.title}</strong> khỏi hệ thống Bản đồ 3D & Safety Guardian?
          </p>
        }
        confirmLabel="Xác nhận gỡ"
        tone="danger"
        loading={deactivating}
        onConfirm={handleDeactivate}
        onCancel={() => setDeactivateTarget(null)}
      />
    </>
  );
}
