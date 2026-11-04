import clsx from 'clsx';
import {
  Award,
  CheckCircle2,
  Clock,
  Compass,
  Footprints,
  Heart,
  Landmark,
  Lightbulb,
  Medal,
  Pencil,
  Plus,
  Power,
  RotateCcw,
  Sparkles,
  Star,
  Trash2,
  Trophy,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AdminPageHeader } from '../../components/layout/AdminLayout';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, StatCard } from '../../components/ui/Card';
import { FormField, Input, Select } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { EmptyState, ErrorState, PageLoader } from '../../components/ui/States';
import { useApiQuery } from '../../hooks/useApiQuery';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { api, toApiError } from '../../lib/api';
import { formatDateTime, formatNumber } from '../../lib/format';
import { toast } from '../../stores/toastStore';
import type { AdminBadge, BadgeAnalyticsReport, BadgeCriteriaType, BadgeIcon } from '../../types/api';

const BADGE_ICONS: Record<BadgeIcon, typeof Trophy> = {
  footprints: Footprints,
  compass: Compass,
  lightbulb: Lightbulb,
  trophy: Trophy,
  landmark: Landmark,
  star: Star,
  medal: Medal,
  award: Award,
  heart: Heart,
  sparkles: Sparkles,
};

const CRITERIA_LABELS: Record<BadgeCriteriaType, string> = {
  checkin_count: 'Số điểm đến check-in',
  challenge_count: 'Số thử thách hoàn thành',
  heritage_challenge_count: 'Thử thách văn hóa / lịch sử',
  points_threshold: 'Điểm tích lũy tối thiểu',
  itinerary_created: 'Số lịch trình đã tạo & lưu',
};

function describeCriteria(type: BadgeCriteriaType, count: number): string {
  switch (type) {
    case 'checkin_count':
      return `Check-in tại ít nhất ${count} điểm đến`;
    case 'challenge_count':
      return `Hoàn thành ít nhất ${count} thử thách`;
    case 'heritage_challenge_count':
      return `Hoàn thành thử thách tại ${count} điểm văn hóa / lịch sử`;
    case 'points_threshold':
      return `Tích lũy tối thiểu ${count} điểm trong hộ chiếu`;
    case 'itinerary_created':
      return `Tạo và lưu ít nhất ${count} lịch trình AI`;
    default:
      return `${CRITERIA_LABELS[type] ?? type}: ${count}`;
  }
}

interface BadgeFormData {
  key: string;
  name: string;
  description: string;
  icon: BadgeIcon;
  criteriaType: BadgeCriteriaType;
  targetCount: number;
  rewardPoints: number;
  status: 'active' | 'inactive';
}

const defaultForm: BadgeFormData = {
  key: '',
  name: '',
  description: '',
  icon: 'trophy',
  criteriaType: 'checkin_count',
  targetCount: 1,
  rewardPoints: 20,
  status: 'active',
};

export function AdminBadgesPage() {
  useDocumentTitle('Quản lý Huy hiệu & Thành tựu');

  const [activeTab, setActiveTab] = useState<'badges' | 'analytics'>('badges');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBadge, setEditingBadge] = useState<AdminBadge | null>(null);
  const [form, setForm] = useState<BadgeFormData>(defaultForm);
  const [submitting, setSubmitting] = useState(false);

  const query = useApiQuery((signal) => api.get<{ items: AdminBadge[] }>('/admin/badges', { signal }).then((r) => r.data), []);
  const analyticsQuery = useApiQuery(
    (signal) => api.get<BadgeAnalyticsReport>('/admin/badges/analytics', { signal }).then((r) => r.data),
    [],
  );

  const openCreate = () => {
    setEditingBadge(null);
    setForm(defaultForm);
    setModalOpen(true);
  };

  const openEdit = (b: AdminBadge) => {
    setEditingBadge(b);
    setForm({
      key: b.key,
      name: b.name,
      description: b.description,
      icon: b.icon,
      criteriaType: b.criteriaType,
      targetCount: b.targetCount,
      rewardPoints: b.rewardPoints,
      status: b.status,
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingBadge) {
        await api.patch(`/admin/badges/${editingBadge._id || editingBadge.id}`, {
          name: form.name,
          description: form.description,
          icon: form.icon,
          criteriaType: form.criteriaType,
          targetCount: form.targetCount,
          rewardPoints: form.rewardPoints,
          status: form.status,
        });
        toast.success(`Đã cập nhật huy hiệu “${form.name}”`);
      } else {
        await api.post('/admin/badges', form);
        toast.success(`Đã tạo huy hiệu “${form.name}”`);
      }
      setModalOpen(false);
      query.reload();
      analyticsQuery.reload();
    } catch (err) {
      toast.error('Lỗi lưu huy hiệu', toApiError(err).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (b: AdminBadge) => {
    const nextStatus = b.status === 'active' ? 'inactive' : 'active';
    try {
      await api.patch(`/admin/badges/${b._id || b.id}`, { status: nextStatus });
      toast.success(nextStatus === 'active' ? `Đã kích hoạt “${b.name}”` : `Đã tạm dừng “${b.name}”`);
      query.reload();
      analyticsQuery.reload();
    } catch (err) {
      toast.error('Không đổi được trạng thái', toApiError(err).message);
    }
  };

  const handleDelete = async (b: AdminBadge) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa hoặc tạm dừng huy hiệu “${b.name}”?`)) return;
    try {
      const res = await api.delete(`/admin/badges/${b._id || b.id}`);
      if (res.data?.message) {
        toast.info(res.data.message);
      } else {
        toast.success(`Đã xóa huy hiệu “${b.name}”`);
      }
      query.reload();
      analyticsQuery.reload();
    } catch (err) {
      toast.error('Không thể xóa huy hiệu', toApiError(err).message);
    }
  };

  if (query.loading && !query.data) return <PageLoader />;
  if (query.error) return <ErrorState error={query.error} onRetry={query.reload} />;

  const badges = query.data?.items ?? [];
  const analytics = analyticsQuery.data;

  return (
    <>
      <AdminPageHeader
        title="Quản lý Huy hiệu & Thành tựu"
        description="Định cấu hình các danh hiệu du lịch số, quản lý điều kiện mở khóa và theo dõi mức độ gắn kết của du khách."
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => { query.reload(); analyticsQuery.reload(); }} icon={<RotateCcw className="size-4" />}>
              Làm mới
            </Button>
            <Button variant="primary" onClick={openCreate} icon={<Plus className="size-4" />}>
              Thêm huy hiệu mới
            </Button>
          </div>
        }
      />

      {/* Top Stat Cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Tổng số huy hiệu" value={badges.length} icon={<Trophy className="size-5" />} />
        <StatCard
          label="Đang kích hoạt"
          value={badges.filter((b) => b.status === 'active').length}
          hint={`${badges.filter((b) => b.status === 'inactive').length} đang tạm dừng`}
          icon={<CheckCircle2 className="size-5" />}
        />
        <StatCard
          label="Lượt trao huy hiệu"
          value={formatNumber(analytics?.summary.totalAwards ?? 0)}
          hint="Đã ghi vào hộ chiếu số"
          icon={<Award className="size-5" />}
        />
        <StatCard
          label="Du khách có tài khoản"
          value={formatNumber(analytics?.summary.totalUsers ?? 0)}
          hint="Đối tượng nhận thành tựu"
          icon={<Users className="size-5" />}
        />
      </div>

      {/* Tab Switcher */}
      <div className="mb-6 flex gap-2 border-b border-sand-200 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('badges')}
          className={clsx(
            'flex items-center gap-2 rounded-control px-4 py-2 text-sm font-semibold transition-colors',
            activeTab === 'badges' ? 'bg-leaf-600 text-white shadow-xs' : 'text-river-700 hover:bg-sand-100',
          )}
        >
          <Award className="size-4" />
          Danh mục huy hiệu ({badges.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('analytics')}
          className={clsx(
            'flex items-center gap-2 rounded-control px-4 py-2 text-sm font-semibold transition-colors',
            activeTab === 'analytics' ? 'bg-leaf-600 text-white shadow-xs' : 'text-river-700 hover:bg-sand-100',
          )}
        >
          <Trophy className="size-4" />
          Phân tích & Nhật ký mở khóa
        </button>
      </div>

      {activeTab === 'badges' ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {badges.map((b) => {
            const Icon = BADGE_ICONS[b.icon] ?? Trophy;
            const isActive = b.status === 'active';
            return (
              <Card
                key={b._id || b.key}
                className={clsx(
                  'relative flex flex-col p-5 transition-all hover:shadow-md',
                  !isActive && 'opacity-65 grayscale-[30%]',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={clsx(
                        'flex size-12 shrink-0 items-center justify-center rounded-2xl shadow-xs',
                        isActive
                          ? 'bg-gradient-to-br from-teal-400 to-leaf-600 text-white ring-2 ring-teal-200'
                          : 'bg-sand-200 text-river-600',
                      )}
                    >
                      <Icon className="size-6" aria-hidden />
                    </span>
                    <div>
                      <h2 className="text-base font-bold text-river-900">{b.name}</h2>
                      <p className="font-mono text-xs text-river-500">key: {b.key}</p>
                    </div>
                  </div>
                  <Badge tone={isActive ? 'leaf' : 'neutral'}>{isActive ? 'Hoạt động' : 'Tạm dừng'}</Badge>
                </div>

                <p className="mt-3 text-sm text-river-700">{b.description}</p>

                <div className="mt-4 rounded-control border border-sand-200 bg-sand-50/70 p-3 text-xs space-y-1">
                  <p className="font-semibold text-river-800">
                    🎯 Điều kiện: <span className="font-normal text-river-600">{describeCriteria(b.criteriaType, b.targetCount)}</span>
                  </p>
                  <p className="font-semibold text-river-800">
                    🎁 Thưởng thêm: <span className="font-bold text-leaf-700">+{b.rewardPoints} điểm</span>
                  </p>
                  <p className="font-semibold text-river-800">
                    ⭐ Đã trao: <span className="font-bold text-teal-700">{b.awardedCount ?? 0} lượt</span>
                  </p>
                </div>

                <div className="mt-auto flex items-center justify-between border-t border-sand-200 pt-3 text-xs">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleToggleStatus(b)}
                    icon={<Power className="size-3.5" />}
                  >
                    {isActive ? 'Tạm dừng' : 'Kích hoạt'}
                  </Button>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="secondary" onClick={() => openEdit(b)} icon={<Pencil className="size-3.5" />}>
                      Sửa
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(b)} icon={<Trash2 className="size-3.5 text-red-600" />}>
                      Xóa
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Chart Section */}
          <Card className="p-5">
            <h2 className="text-base font-bold text-river-900">Tỷ lệ mở khóa theo từng huy hiệu (%)</h2>
            <p className="mt-0.5 text-xs text-river-500">
              Tỷ lệ phần trăm du khách có tài khoản đã đạt được từng danh hiệu.
            </p>
            {analytics?.badgeStats && analytics.badgeStats.length > 0 ? (
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.badgeStats} margin={{ top: 8, right: 16, left: 0, bottom: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e9e4d6" />
                    <XAxis
                      dataKey="name"
                      interval={0}
                      tick={({ x, y, payload }) => (
                        <g transform={`translate(${x},${y})`}>
                          <text
                            x={0}
                            y={0}
                            dy={14}
                            textAnchor="middle"
                            fill="#475569"
                            fontSize={11}
                            transform="rotate(-15)"
                          >
                            {payload.value.length > 16 ? `${payload.value.slice(0, 15)}…` : payload.value}
                          </text>
                        </g>
                      )}
                    />
                    <YAxis unit="%" domain={[0, 100]} fontSize={12} width={36} />
                    <Tooltip formatter={(v) => [`${v}%`, 'Tỷ lệ đạt']} />
                    <Bar dataKey="unlockRate" fill="#176b50" radius={[4, 4, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState title="Chưa có dữ liệu phân tích" description="Chưa có lượt cấp huy hiệu nào được ghi nhận." />
            )}
          </Card>

          {/* Recent Awards Feed */}
          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-base font-bold text-river-900">
              <Clock className="size-4 text-leaf-600" />
              Nhật ký cấp phát huy hiệu gần đây
            </h2>
            <p className="mt-0.5 text-xs text-river-500">Các thành tựu vừa được du khách mở khóa theo thời gian thực.</p>

            {analytics?.recentAwards && analytics.recentAwards.length > 0 ? (
              <div className="mt-4 divide-y divide-sand-200">
                {analytics.recentAwards.map((item) => {
                  const Icon = BADGE_ICONS[item.badgeIcon as BadgeIcon] ?? Trophy;
                  return (
                    <div key={item.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 ring-1 ring-teal-200">
                          <Icon className="size-5" />
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-river-900">{item.userDisplayName}</p>
                          <p className="text-xs text-river-500">
                            Đạt danh hiệu <strong>{item.badgeName}</strong> ({item.badgeKey})
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="inline-block rounded-pill bg-leaf-50 px-2.5 py-0.5 text-xs font-bold text-leaf-800">
                          +{item.scoreAwarded} điểm
                        </span>
                        <p className="mt-0.5 text-xs text-river-400">{formatDateTime(item.completedAt)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-4 text-sm text-river-500">Chưa có lượt cấp phát nào gần đây.</p>
            )}
          </Card>
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingBadge ? `Chỉnh sửa: ${editingBadge.name}` : 'Thêm huy hiệu mới'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          {!editingBadge && (
            <FormField label="Mã định danh (Key)" required hint="Dùng để đối chiếu và không thể đổi sau khi tạo (vd: eco-master)">
              <Input
                value={form.key}
                onChange={(e) => setForm({ ...form, key: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                placeholder="vd: eco-master"
                required
              />
            </FormField>
          )}

          <FormField label="Tên huy hiệu" required>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="vd: Bậc thầy sinh thái"
              required
            />
          </FormField>

          <FormField label="Mô tả danh hiệu" required>
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="vd: Khám phá đủ 4 điểm du lịch sinh thái tại Đồng Tháp"
              required
            />
          </FormField>

          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Biểu tượng">
              <Select
                value={form.icon}
                onChange={(e) => setForm({ ...form, icon: e.target.value as BadgeIcon })}
              >
                {Object.keys(BADGE_ICONS).map((iconName) => (
                  <option key={iconName} value={iconName}>
                    {iconName}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Trạng thái">
              <Select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as 'active' | 'inactive' })}
              >
                <option value="active">Hoạt động (Active)</option>
                <option value="inactive">Tạm dừng (Inactive)</option>
              </Select>
            </FormField>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Loại tiêu chí mở khóa" required>
              <Select
                value={form.criteriaType}
                onChange={(e) => setForm({ ...form, criteriaType: e.target.value as BadgeCriteriaType })}
              >
                {Object.entries(CRITERIA_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Chỉ tiêu số lượng (Target)" required hint="Số lần check-in, số thử thách, hoặc điểm cần đạt">
              <Input
                type="number"
                min={1}
                value={form.targetCount}
                onChange={(e) => setForm({ ...form, targetCount: Number(e.target.value) })}
                required
              />
            </FormField>
          </div>

          <FormField label="Điểm thưởng khi nhận huy hiệu" hint="Cộng thêm vào tổng điểm hộ chiếu của du khách">
            <Input
              type="number"
              min={0}
              step={10}
              value={form.rewardPoints}
              onChange={(e) => setForm({ ...form, rewardPoints: Number(e.target.value) })}
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-3">
            <Button variant="secondary" onClick={() => setModalOpen(false)} type="button">
              Hủy
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              {editingBadge ? 'Lưu thay đổi' : 'Tạo huy hiệu'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
