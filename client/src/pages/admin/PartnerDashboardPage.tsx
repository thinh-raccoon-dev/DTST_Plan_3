import clsx from 'clsx';
import {
  AlertCircle,
  Award,
  BarChart3,
  Building2,
  CheckCircle2,
  Clock,
  Compass,
  Download,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  Footprints,
  Gift,
  Globe,
  Heart,
  Layers,
  Lightbulb,
  MapPin,
  Medal,
  Megaphone,
  MessageSquare,
  PauseCircle,
  PenLine,
  Phone,
  PieChart as PieIcon,
  PlayCircle,
  Plus,
  Printer,
  QrCode,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  Tag,
  Ticket,
  Trash2,
  TrendingUp,
  Trophy,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AdminPageHeader } from '../../components/layout/AdminLayout';
import { PartnerAlertsTab } from '../../components/partner/PartnerAlertsTab';
import { PartnerAuditLogsTab } from '../../components/partner/PartnerAuditLogsTab';
import { PartnerBannersTab } from '../../components/partner/PartnerBannersTab';
import {
  PartnerChallengeModal,
  type EditablePartnerChallenge,
} from '../../components/partner/PartnerChallengeModal';
import { PartnerInquiriesTab } from '../../components/partner/PartnerInquiriesTab';
import {
  PartnerQuickReplyModal,
  type PartnerQuickReplyReview,
} from '../../components/partner/PartnerQuickReplyModal';
import { PartnerServicesTab } from '../../components/partner/PartnerServicesTab';
import {
  PartnerStandeeModal,
  type StandeeQrTarget,
} from '../../components/partner/PartnerStandeeModal';
import { PartnerVouchersTab } from '../../components/partner/PartnerVouchersTab';
import { Badge } from '../../components/ui/Badge';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Card, StatCard } from '../../components/ui/Card';
import { Input, Select } from '../../components/ui/Field';
import { ConfirmDialog, Modal } from '../../components/ui/Modal';
import { ErrorState, PageLoader } from '../../components/ui/States';
import { useApiQuery } from '../../hooks/useApiQuery';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { api, toApiError } from '../../lib/api';
import { areaLabel, categoryLabel } from '../../lib/catalog';
import { formatDate, formatDateTime } from '../../lib/format';
import { useAuthStore } from '../../stores/authStore';
import { toast } from '../../stores/toastStore';
import type { PartnerOverviewResponse } from '../../types/api';

const badgeIconsList = [
  { value: 'trophy', label: '🏆 Cúp vàng vinh danh' },
  { value: 'medal', label: '🥇 Huy chương danh dự' },
  { value: 'star', label: '⭐ Ngôi sao tinh hoa' },
  { value: 'award', label: '🎖️ Bằng khen trải nghiệm' },
  { value: 'footprints', label: '👣 Dấu chân khám phá' },
  { value: 'compass', label: '🧭 La bàn người mở đường' },
  { value: 'lightbulb', label: '💡 Nhà thông thái văn hóa' },
  { value: 'heart', label: '❤️ Trái tim yêu mến KDL' },
  { value: 'sparkles', label: '✨ Trải nghiệm lấp lánh' },
];

function renderPartnerBadgeIcon(icon: string) {
  switch (icon) {
    case 'medal':
      return <Medal className="size-5 text-amber-500" />;
    case 'star':
      return <Star className="size-5 text-amber-400 fill-amber-400" />;
    case 'award':
      return <Award className="size-5 text-lotus-600" />;
    case 'footprints':
      return <Footprints className="size-5 text-emerald-600" />;
    case 'compass':
      return <Compass className="size-5 text-teal-600" />;
    case 'lightbulb':
      return <Lightbulb className="size-5 text-amber-500" />;
    case 'heart':
      return <Heart className="size-5 text-rose-500 fill-rose-500" />;
    case 'sparkles':
      return <Sparkles className="size-5 text-indigo-500" />;
    default:
      return <Trophy className="size-5 text-amber-500" />;
  }
}

type PartnerTab =
  | 'summary'
  | 'overview'
  | 'vouchers'
  | 'services'
  | 'inquiries'
  | 'banners'
  | 'challenges'
  | 'qr'
  | 'badges'
  | 'alerts'
  | 'audit'
  | 'operations';

type ConfirmDeleteState =
  | { kind: 'challenge'; id: string; title: string; completions: number }
  | { kind: 'qr'; id: string; label: string; code: string }
  | { kind: 'badge'; id: string; name: string }
  | null;

export function PartnerDashboardPage() {
  useDocumentTitle('Trung Tâm Điều Hành Khu Du Lịch (Partner Hub)');
  const currentUser = useAuthStore((s) => s.user);
  const [searchParams] = useSearchParams();

  // Scope & Time window
  const [selectedDestId, setSelectedDestId] = useState<string>(() => searchParams.get('destinationId') ?? '');
  const [daysWindow, setDaysWindow] = useState<7 | 30 | 90>(7);
  const [exportingCsv, setExportingCsv] = useState(false);

  // Active Tab
  const [activeTab, setActiveTab] = useState<PartnerTab>('summary');

  // Operational toggle modal / state
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [operationalStatus, setOperationalStatus] = useState<'active' | 'temporarily_closed'>('active');
  const [specialNotice, setSpecialNotice] = useState('');
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);

  // Challenge modal (create / edit)
  const [isChallengeModalOpen, setIsChallengeModalOpen] = useState(false);
  const [editingChallenge, setEditingChallenge] = useState<EditablePartnerChallenge | null>(null);

  // QR modal (create / edit)
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [editingQr, setEditingQr] = useState<{ id: string; label: string; code: string } | null>(null);
  const [qrLabel, setQrLabel] = useState('');
  const [qrTargetType, setQrTargetType] = useState<'destination' | 'challenge'>('destination');
  const [qrChallengeId, setQrChallengeId] = useState('');
  const [isSubmittingQr, setIsSubmittingQr] = useState(false);

  // Standee HD Modal
  const [standeeQr, setStandeeQr] = useState<StandeeQrTarget | null>(null);

  // Badge modal (create / edit)
  const [isBadgeModalOpen, setIsBadgeModalOpen] = useState(false);
  const [editingBadgeId, setEditingBadgeId] = useState<string | null>(null);
  const [badgeName, setBadgeName] = useState('');
  const [badgeDescription, setBadgeDescription] = useState('');
  const [badgeIcon, setBadgeIcon] = useState('trophy');
  const [badgeCriteriaType, setBadgeCriteriaType] = useState<'checkin_count' | 'challenge_count'>('checkin_count');
  const [badgeTargetCount, setBadgeTargetCount] = useState(1);
  const [badgeRewardPoints, setBadgeRewardPoints] = useState(50);
  const [isSubmittingBadge, setIsSubmittingBadge] = useState(false);

  // Inline Quick Review Reply Modal
  const [replyReview, setReplyReview] = useState<PartnerQuickReplyReview | null>(null);

  // Confirm delete dialog
  const [confirmDelete, setConfirmDelete] = useState<ConfirmDeleteState>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Fetch data
  const { data, loading, error, reload } = useApiQuery<PartnerOverviewResponse>(
    (signal) =>
      api
        .get<PartnerOverviewResponse>('/admin/partner/overview', {
          params: {
            destinationId: selectedDestId || undefined,
            days: daysWindow,
          },
          signal,
        })
        .then((r) => r.data),
    [selectedDestId, daysWindow],
  );

  const destination = data?.destination;
  const metrics = data?.metrics;
  const managedDestinations = data?.managedDestinations || [];
  const profileHealth = data?.profileHealth;
  const activeBadgesCount = (data?.badges || []).filter((b) => b.status === 'active').length;
  const activeAlertsCount = metrics?.activeAlertsCount ?? data?.activeAlerts?.length ?? 0;
  const activeVouchersCount = metrics?.activeVouchersCount ?? 0;
  const servicesCount = metrics?.servicesCount ?? 0;
  const newInquiriesCount = metrics?.newInquiriesCount ?? 0;
  const pendingBannersCount = metrics?.pendingBannersCount ?? 0;

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleExportCsv = async () => {
    if (!destination) return;
    setExportingCsv(true);
    try {
      const res = await api.get<Blob>('/admin/partner/export', {
        params: { destinationId: destination.id, days: daysWindow },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bao-cao-${destination.slug}-${daysWindow}ngay.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Đã xuất báo cáo CSV (${daysWindow} ngày, ẩn danh theo NĐ 13/2023/NĐ-CP)!`);
    } catch (err) {
      toast.error(toApiError(err).message);
    } finally {
      setExportingCsv(false);
    }
  };

  const handleOpenStatusModal = () => {
    if (!destination) return;
    setOperationalStatus(
      destination.operationalStatus === 'temporarily_closed' ? 'temporarily_closed' : 'active',
    );
    setSpecialNotice(destination.partnerNotice || '');
    setIsStatusModalOpen(true);
  };

  const handleSaveOperationalStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destination) return;
    setIsUpdatingStatus(true);
    try {
      await api.patch('/admin/partner/destination/status', {
        destinationId: destination.id,
        operationalStatus,
        specialNotice: specialNotice.trim(),
      });
      toast.success('Đã cập nhật trạng thái vận hành & thông báo công khai!');
      setIsStatusModalOpen(false);
      reload();
    } catch (err) {
      toast.error(toApiError(err).message);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Challenge quick toggle
  const handleToggleChallengeStatus = async (id: string, currentStatus: string) => {
    setTogglingId(id);
    try {
      const next = currentStatus === 'active' ? 'inactive' : 'active';
      await api.patch(`/admin/partner/challenges/${id}`, { status: next });
      toast.success(next === 'active' ? 'Đã mở lại thử thách!' : 'Đã tạm dừng thử thách.');
      reload();
    } catch (err) {
      toast.error(toApiError(err).message);
    } finally {
      setTogglingId(null);
    }
  };

  // QR create/edit
  const handleOpenCreateQr = () => {
    setEditingQr(null);
    setQrLabel('');
    setQrTargetType('destination');
    setQrChallengeId('');
    setIsQrModalOpen(true);
  };

  const handleOpenEditQr = (qr: { id: string; label: string; code: string }) => {
    setEditingQr(qr);
    setQrLabel(qr.label);
    setIsQrModalOpen(true);
  };

  const handleSaveQr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destination) return;
    if (qrLabel.trim().length < 3) {
      toast.error('Tên nhãn vị trí đặt mã QR cần tối thiểu 3 ký tự.');
      return;
    }

    setIsSubmittingQr(true);
    try {
      if (editingQr) {
        await api.patch(`/admin/partner/qr/${editingQr.id}`, {
          label: qrLabel.trim(),
        });
        toast.success('Đã cập nhật nhãn mã QR thành công!');
      } else {
        await api.post('/admin/partner/qr', {
          destinationId: destination.id,
          label: qrLabel.trim(),
          targetType: qrTargetType,
          challengeId: qrTargetType === 'challenge' ? qrChallengeId : undefined,
        });
        toast.success('Đã phát hành mã QR mới thành công!');
      }
      setIsQrModalOpen(false);
      setQrLabel('');
      setEditingQr(null);
      reload();
    } catch (err) {
      toast.error(toApiError(err).message);
    } finally {
      setIsSubmittingQr(false);
    }
  };

  const handleToggleQrStatus = async (id: string, currentStatus: string) => {
    setTogglingId(id);
    try {
      const next = currentStatus === 'active' ? 'inactive' : 'active';
      await api.patch(`/admin/partner/qr/${id}`, { status: next });
      toast.success(next === 'active' ? 'Đã kích hoạt lại mã QR!' : 'Đã tạm khóa mã QR.');
      reload();
    } catch (err) {
      toast.error(toApiError(err).message);
    } finally {
      setTogglingId(null);
    }
  };

  // Badge create/edit
  const handleOpenCreateBadge = () => {
    setEditingBadgeId(null);
    setBadgeName('');
    setBadgeDescription('');
    setBadgeIcon('trophy');
    setBadgeCriteriaType('checkin_count');
    setBadgeTargetCount(1);
    setBadgeRewardPoints(50);
    setIsBadgeModalOpen(true);
  };

  const handleOpenEditBadge = (b: NonNullable<PartnerOverviewResponse['badges']>[number]) => {
    setEditingBadgeId(b.id);
    setBadgeName(b.name);
    setBadgeDescription(b.description);
    setBadgeIcon(b.icon || 'trophy');
    setBadgeCriteriaType(b.criteriaType === 'challenge_count' ? 'challenge_count' : 'checkin_count');
    setBadgeTargetCount(b.targetCount || 1);
    setBadgeRewardPoints(b.rewardPoints || 50);
    setIsBadgeModalOpen(true);
  };

  const handleSaveBadge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destination) return;
    if (badgeName.trim().length < 2) {
      toast.error('Tên huy hiệu cần ít nhất 2 ký tự.');
      return;
    }
    if (badgeDescription.trim().length < 5) {
      toast.error('Mô tả huy hiệu cần ít nhất 5 ký tự.');
      return;
    }

    setIsSubmittingBadge(true);
    try {
      const payload = {
        destinationId: destination.id,
        name: badgeName.trim(),
        description: badgeDescription.trim(),
        icon: badgeIcon,
        criteriaType: badgeCriteriaType,
        targetCount: Number(badgeTargetCount) || 1,
        rewardPoints: Number(badgeRewardPoints) || 50,
      };

      if (editingBadgeId) {
        await api.patch(`/admin/partner/badges/${editingBadgeId}`, payload);
        toast.success('Đã cập nhật Huy hiệu thành công!');
      } else {
        await api.post('/admin/partner/badges', payload);
        toast.success('Đã phát hành Huy hiệu đặc quyền KDL thành công!');
      }
      setIsBadgeModalOpen(false);
      setEditingBadgeId(null);
      reload();
    } catch (err) {
      toast.error(toApiError(err).message);
    } finally {
      setIsSubmittingBadge(false);
    }
  };

  const handleToggleBadgeStatus = async (id: string, currentStatus: string) => {
    setTogglingId(id);
    try {
      const next = currentStatus === 'active' ? 'inactive' : 'active';
      await api.patch(`/admin/partner/badges/${id}`, { status: next });
      toast.success(next === 'active' ? 'Đã kích hoạt lại huy hiệu!' : 'Đã tạm dừng huy hiệu.');
      reload();
    } catch (err) {
      toast.error(toApiError(err).message);
    } finally {
      setTogglingId(null);
    }
  };

  // Unified Safe Delete Confirm
  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    setIsDeleting(true);
    try {
      if (confirmDelete.kind === 'challenge') {
        const res = await api.delete<{ message?: string }>(`/admin/partner/challenges/${confirmDelete.id}`);
        toast.success(res.data?.message || 'Đã xử lý thử thách thành công!');
      } else if (confirmDelete.kind === 'qr') {
        const res = await api.delete<{ message?: string }>(`/admin/partner/qr/${confirmDelete.id}`);
        toast.success(res.data?.message || 'Đã xử lý mã QR thành công!');
      } else if (confirmDelete.kind === 'badge') {
        const res = await api.delete<{ message?: string }>(`/admin/partner/badges/${confirmDelete.id}`);
        toast.success(res.data?.message || 'Đã xóa huy hiệu thành công!');
      }
      setConfirmDelete(null);
      reload();
    } catch (err) {
      toast.error(toApiError(err).message);
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  if (!data?.hasDestination || !destination) {
    return (
      <Card className="p-8 text-center max-w-xl mx-auto my-12 border-dashed border-2">
        <Sparkles className="size-12 mx-auto text-amber-500 mb-3" />
        <h2 className="text-xl font-bold text-river-900">Chưa được gán Khu Du Lịch</h2>
        <p className="mt-2 text-sm text-river-600">
          Tài khoản đối tác của bạn ({currentUser?.email}) hiện chưa được liên kết với điểm đến du lịch nào. Vui lòng liên hệ Quản trị viên Sở VHTTDL để phân quyền điểm đến.
        </p>
      </Card>
    );
  }

  const primaryImage =
    destination.images?.[0]?.url ||
    'https://images.unsplash.com/photo-1596401057633-54a8fe8ef647?auto=format&fit=crop&w=1200&q=80';
  const isOpen = destination.operationalStatus === 'active';

  const tabItems: Array<{
    id: PartnerTab;
    label: string;
    icon: React.ReactNode;
    badge?: number;
    alert?: boolean;
  }> = [
    { id: 'summary', label: 'Biểu đồ & Tổng hợp', icon: <BarChart3 className="size-4" /> },
    { id: 'overview', label: 'Dòng khách & Đánh giá', icon: <Sparkles className="size-4" /> },
    {
      id: 'vouchers',
      label: 'Voucher & Quầy đối soát',
      icon: <Gift className="size-4" />,
      badge: activeVouchersCount > 0 ? activeVouchersCount : undefined,
    },
    {
      id: 'services',
      label: `Bảng giá & Combo (${servicesCount})`,
      icon: <Tag className="size-4" />,
    },
    {
      id: 'inquiries',
      label: 'Đặt đoàn & Tư vấn',
      icon: <Users className="size-4" />,
      badge: newInquiriesCount > 0 ? newInquiriesCount : undefined,
      alert: newInquiriesCount > 0,
    },
    {
      id: 'banners',
      label: 'Banner mùa vụ',
      icon: <Megaphone className="size-4" />,
      badge: pendingBannersCount > 0 ? pendingBannersCount : undefined,
    },
    {
      id: 'challenges',
      label: `Thử thách (${data?.challenges?.length || 0})`,
      icon: <Trophy className="size-4" />,
    },
    {
      id: 'qr',
      label: `Mã QR & Standee (${data?.qrs?.length || 0})`,
      icon: <QrCode className="size-4" />,
    },
    {
      id: 'badges',
      label: `Huy hiệu (${activeBadgesCount}/5)`,
      icon: <Award className="size-4" />,
    },
    {
      id: 'alerts',
      label: 'Cảnh báo Thực địa',
      icon: <ShieldAlert className="size-4" />,
      badge: activeAlertsCount > 0 ? activeAlertsCount : undefined,
      alert: activeAlertsCount > 0,
    },
    { id: 'audit', label: 'Nhật ký vận hành', icon: <Shield className="size-4" /> },
    { id: 'operations', label: 'Thông tin KDL', icon: <Clock className="size-4" /> },
  ];

  return (
    <>
      <AdminPageHeader
        title="Trung Tâm Điều Hành Khu Du Lịch"
        description="Vận hành thời gian thực, phân tích lưu lượng, phát hành mã QR/Standee, thử thách văn hóa, cảnh báo an toàn và chăm sóc du khách."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Multi-destination Switcher */}
            {managedDestinations.length > 1 && (
              <div className="flex items-center gap-1.5 rounded-control border border-sand-300 bg-white px-2.5 h-10">
                <Building2 className="size-4 text-leaf-700 shrink-0" />
                <select
                  aria-label="Chọn khu du lịch đang điều hành"
                  value={destination.id}
                  onChange={(e) => setSelectedDestId(e.target.value)}
                  className="bg-transparent text-xs font-bold text-river-900 focus:outline-none max-w-[190px] sm:max-w-[230px] truncate"
                >
                  {managedDestinations.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <Button
              variant={isOpen ? 'primary' : 'danger'}
              size="sm"
              onClick={handleOpenStatusModal}
              icon={<Clock className="size-4" />}
            >
              {isOpen ? '🟢 Đang đón khách' : '🟠 Đang tạm nghỉ'}
            </Button>

            <Button
              variant="secondary"
              size="sm"
              loading={exportingCsv}
              onClick={handleExportCsv}
              icon={<Download className="size-4" />}
            >
              Xuất CSV ({daysWindow}N)
            </Button>

            <ButtonLink
              to={`/destinations/${destination.slug}`}
              target="_blank"
              variant="secondary"
              size="sm"
              icon={<ExternalLink className="size-4" />}
            >
              Xem trang khách
            </ButtonLink>
          </div>
        }
      />

      {/* Hero Banner KDL */}
      <div className="relative overflow-hidden rounded-2xl border border-sand-300 bg-river-950 text-white shadow-md">
        <div className="absolute inset-0 z-0 opacity-25">
          <img src={primaryImage} alt={destination.name} className="size-full object-cover" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-river-950 via-river-950/85 to-transparent z-0" />

        <div className="relative z-10 p-5 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-leaf-500/20 px-3 py-1 text-xs font-semibold text-leaf-300 ring-1 ring-leaf-400/40">
                {categoryLabel(destination.category as never)}
              </span>
              <span className="rounded-full bg-sand-200/20 px-3 py-1 text-xs font-medium text-sand-200">
                📍 {areaLabel(destination.area as never)}
              </span>
              <span
                className={clsx(
                  'rounded-full px-3 py-1 text-xs font-bold ring-1',
                  isOpen
                    ? 'bg-emerald-500/20 text-emerald-300 ring-emerald-400/50'
                    : 'bg-amber-500/20 text-amber-300 ring-amber-400/50',
                )}
              >
                {isOpen ? '✓ Đang hoạt động bình thường' : '⚠️ Tạm đóng cửa / Bảo trì'}
              </span>
              {currentUser?.role === 'admin' && (
                <span className="rounded-full bg-indigo-500/25 px-2.5 py-1 text-[11px] font-bold text-indigo-200 ring-1 ring-indigo-400/40">
                  Chế độ Admin xem KDL
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-3xl font-black tracking-tight text-white break-words">
              {destination.name}
            </h1>
            <p className="text-sm text-sand-200 line-clamp-2 leading-relaxed">
              {destination.summary || destination.description}
            </p>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 text-xs text-sand-300">
              {destination.address && (
                <span className="flex items-center gap-1">
                  <MapPin className="size-3.5 text-leaf-400 shrink-0" />
                  <span className="break-words">{destination.address}</span>
                </span>
              )}
              {destination.openingHours && (
                <span className="flex items-center gap-1">
                  <Clock className="size-3.5 text-teal-400 shrink-0" />
                  {destination.openingHours}
                </span>
              )}
              {destination.contactInfo?.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="size-3.5 text-amber-400 shrink-0" />
                  {destination.contactInfo.phone}
                </span>
              )}
            </div>

            {/* Official Public Partner Notice (shown on tourist page) */}
            {destination.partnerNotice && (
              <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-500/20 px-3.5 py-2 text-xs text-amber-100 ring-1 ring-amber-400/40">
                <AlertCircle className="size-4 shrink-0 text-amber-300 mt-0.5" />
                <div className="space-y-0.5 min-w-0">
                  <p>
                    <strong>Thông báo công khai trên trang du khách:</strong> {destination.partnerNotice}
                  </p>
                  {destination.partnerNoticeUpdatedAt && (
                    <p className="text-[11px] text-amber-200/80">
                      Cập nhật: {formatDateTime(destination.partnerNoticeUpdatedAt)}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Separate Internal Admin Review Note (NOT public) */}
            {destination.reviewNote && (
              <div className="mt-2 inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-[11px] text-sand-200 ring-1 ring-white/15">
                <Shield className="size-3.5 shrink-0 text-teal-300" />
                <span>
                  <strong>Ghi chú kiểm duyệt nội bộ (Sở VHTTDL):</strong> {destination.reviewNote}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 shrink-0 w-full md:w-auto">
            <ButtonLink
              to={`/admin/destinations/${destination.id}/edit`}
              variant="accent"
              size="sm"
              icon={<PenLine className="size-4" />}
            >
              Chỉnh sửa hồ sơ KDL
            </ButtonLink>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const qr = data?.qrs?.find((q) => q.status === 'active') || data?.qrs?.[0];
                if (qr) setStandeeQr(qr);
                else {
                  setActiveTab('qr');
                  toast.info('Chưa có mã QR nào. Hãy bấm "Tạo mã QR mới"!');
                }
              }}
              icon={<Printer className="size-4" />}
            >
              In Standee quầy vé (HD)
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setActiveTab('alerts')}
              icon={<ShieldAlert className="size-4 text-red-600" />}
            >
              {activeAlertsCount > 0 ? `Cảnh báo (${activeAlertsCount} đang phát)` : 'Phát cảnh báo thực địa'}
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Lượt du khách quan tâm"
          value={(metrics?.totalViews ?? 0).toLocaleString()}
          hint="Tổng lượt xem trang KDL & quét QR"
          icon={<Eye className="size-5 text-leaf-600" />}
        />
        <StatCard
          label="Lượt Check-in thực địa"
          value={(metrics?.totalCheckIns ?? 0).toLocaleString()}
          hint="Đã quét QR hoặc Check-in GPS tại KDL"
          icon={<MapPin className="size-5 text-teal-600" />}
        />
        <StatCard
          label="Đánh giá & Hài lòng (CSAT)"
          value={`${metrics?.averageRating ?? 5.0} / 5.0`}
          hint={`${metrics?.totalReviews ?? 0} đánh giá · ${metrics?.respondedReviews ?? 0} đã phản hồi`}
          icon={<Star className="size-5 fill-amber-400 text-amber-500" />}
        />
        <StatCard
          label="Thử thách hoàn thành"
          value={(metrics?.totalCompletedChallenges ?? 0).toLocaleString()}
          hint={`${metrics?.totalChallenges ?? 0} thử thách · ${activeAlertsCount} cảnh báo`}
          icon={<Trophy className="size-5 text-lotus-600" />}
        />
      </div>

      {/* Scrollable Mobile-First Navigation Tabs */}
      <div className="mt-7 -mx-1 px-1 overflow-x-auto no-scrollbar border-b border-sand-300">
        <div className="flex items-center gap-1.5 min-w-max pb-2" role="tablist" aria-label="Các mục điều hành KDL">
          {tabItems.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  'inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-t-lg px-3.5 py-2.5 text-xs sm:text-sm font-semibold transition-colors',
                  active
                    ? 'border-b-2 border-leaf-600 bg-white text-leaf-800 shadow-xs'
                    : 'text-river-600 hover:text-river-900 hover:bg-sand-100/70',
                )}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span
                    className={clsx(
                      'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                      tab.alert ? 'bg-red-600 text-white' : 'bg-leaf-100 text-leaf-800',
                    )}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          TAB 0: BIỂU ĐỒ, ĐIỂM SỨC KHỎE HỒ SƠ & BẢNG TỔNG HỢP
         ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'summary' && (
        <div className="mt-6 space-y-6">
          {/* Profile Health Score Card */}
          {profileHealth && (
            <Card className="p-5 sm:p-6 border border-sand-300 bg-gradient-to-br from-white via-sand-50/40 to-leaf-50/40">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-sand-200 pb-4">
                <div className="flex items-center gap-4">
                  <div
                    className={clsx(
                      'flex size-16 shrink-0 flex-col items-center justify-center rounded-2xl border-2 font-black shadow-xs',
                      profileHealth.score >= 90
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                        : profileHealth.score >= 70
                          ? 'border-leaf-500 bg-leaf-50 text-leaf-800'
                          : 'border-amber-500 bg-amber-50 text-amber-800',
                    )}
                  >
                    <span className="text-2xl leading-none">{profileHealth.score}</span>
                    <span className="text-[10px] font-semibold uppercase opacity-75">/100</span>
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-base text-river-900">
                        Điểm Chất Lượng Hồ Sơ Điểm Đến
                      </h3>
                      <Badge
                        tone={
                          profileHealth.score >= 90
                            ? 'leaf'
                            : profileHealth.score >= 70
                              ? 'teal'
                              : 'lotus'
                        }
                      >
                        {profileHealth.tier}
                      </Badge>
                    </div>
                    <p className="text-xs text-river-600 mt-0.5">
                      Hồ sơ đạt từ 90/100 trở lên được AI Trip Planner V9 ưu tiên đề xuất và tăng tỷ lệ du khách check-in thực địa.
                    </p>
                  </div>
                </div>

                {/* Time Window Selector + Export */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex rounded-lg border border-sand-300 bg-white p-1">
                    {([7, 30, 90] as const).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDaysWindow(d)}
                        className={clsx(
                          'rounded-md px-2.5 py-1 text-xs font-bold transition',
                          daysWindow === d
                            ? 'bg-leaf-700 text-white shadow-xs'
                            : 'text-river-600 hover:bg-sand-100',
                        )}
                      >
                        {d} ngày
                      </button>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={exportingCsv}
                    onClick={handleExportCsv}
                    icon={<Download className="size-3.5" />}
                  >
                    Tải CSV
                  </Button>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-sand-200">
                <div
                  className={clsx(
                    'h-full rounded-full transition-all duration-500',
                    profileHealth.score >= 90
                      ? 'bg-emerald-600'
                      : profileHealth.score >= 70
                        ? 'bg-leaf-600'
                        : 'bg-amber-500',
                  )}
                  style={{ width: `${profileHealth.score}%` }}
                />
              </div>

              <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {profileHealth.checks.map((item) => (
                  <div
                    key={item.key}
                    className={clsx(
                      'rounded-xl border p-3 text-xs flex items-start gap-2.5',
                      item.passed
                        ? 'border-emerald-200 bg-white/80 text-river-800'
                        : 'border-amber-200 bg-amber-50/70 text-amber-950',
                    )}
                  >
                    {item.passed ? (
                      <CheckCircle2 className="size-4 shrink-0 text-emerald-600 mt-0.5" />
                    ) : (
                      <AlertCircle className="size-4 shrink-0 text-amber-600 mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold leading-snug">
                        {item.label}{' '}
                        <span className="font-mono text-[10px] opacity-70">(+{item.weight}đ)</span>
                      </p>
                      {!item.passed && <p className="mt-0.5 text-[11px] opacity-80">{item.hint}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Chart 1: Xu Hướng Lưu Lượng & Check-in */}
          <Card className="p-5 sm:p-6 shadow-sm border border-sand-300">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sand-200 pb-3">
              <div>
                <h3 className="font-bold text-base text-river-900 flex items-center gap-2">
                  <TrendingUp className="size-5 text-leaf-700" />
                  Xu hướng Lưu lượng Quan tâm & Du khách Check-in ({daysWindow} ngày qua)
                </h3>
                <p className="text-xs text-river-600">
                  Dữ liệu thực tế theo múi giờ Việt Nam (UTC+7), đối chiếu giữa lượt xem trang và check-in tại điểm
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 font-medium text-river-700">
                  <span className="size-3 rounded-full bg-leaf-600" /> Lượt xem trang KDL
                </span>
                <span className="flex items-center gap-1.5 font-medium text-river-700">
                  <span className="size-3 rounded-full bg-teal-600" /> Check-in thực địa
                </span>
              </div>
            </div>

            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={data?.chartAnalytics?.dailyTrend || []}
                  margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="viewsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#15803d" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#15803d" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="checkInGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0d9488" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#0d9488" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1ece1" />
                  <XAxis dataKey="label" fontSize={11} stroke="#64748b" />
                  <YAxis allowDecimals={false} fontSize={11} stroke="#64748b" />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
                    }}
                    formatter={(val, name) => [
                      `${val} lượt`,
                      name === 'views' ? 'Lượt xem trang KDL' : 'Check-in thực địa',
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="views"
                    name="views"
                    stroke="#15803d"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#viewsGrad)"
                  />
                  <Area
                    type="monotone"
                    dataKey="checkIns"
                    name="checkIns"
                    stroke="#0d9488"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#checkInGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Row 2: CSAT & Check-in Sources */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="p-5 sm:p-6 shadow-sm border border-sand-300 flex flex-col justify-between">
              <div className="border-b border-sand-200 pb-3">
                <h3 className="font-bold text-base text-river-900 flex items-center gap-2">
                  <Star className="size-5 fill-amber-400 text-amber-500" />
                  Chỉ Số Hài Lòng Du Khách (CSAT) & Phân Bổ Sao
                </h3>
                <p className="text-xs text-river-600">
                  Thống kê xếp hạng thực tế từ các đánh giá du khách đã duyệt
                </p>
              </div>

              <div className="mt-4 flex flex-col sm:flex-row items-center gap-5">
                <div className="text-center shrink-0">
                  <div className="text-4xl font-black text-amber-600">
                    {metrics?.averageRating ?? 5.0}
                  </div>
                  <div className="mt-1 flex justify-center text-amber-400">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} className="size-4 fill-amber-400 text-amber-500" />
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-river-500">{metrics?.totalReviews ?? 0} đánh giá</p>
                </div>

                <div className="w-full flex-1 space-y-2">
                  {(data?.chartAnalytics?.ratingDistribution || []).map((r) => (
                    <div key={r.stars} className="flex items-center gap-2 text-xs">
                      <span className="w-10 font-semibold text-river-700">{r.stars} ★</span>
                      <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-sand-200">
                        <div
                          className="h-full rounded-full bg-amber-500 transition-all duration-500"
                          style={{ width: `${r.percentage}%` }}
                        />
                      </div>
                      <span className="w-8 text-right font-mono text-river-500">{r.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 rounded-lg bg-sand-50 p-3 text-xs text-river-600 flex items-center justify-between">
                <span>Tỷ lệ đánh giá tích cực (4–5★):</span>
                <strong className="text-leaf-800 text-sm">
                  {metrics?.totalReviews
                    ? Math.round(
                        (((data?.chartAnalytics?.ratingDistribution || [])
                          .filter((r) => r.stars >= 4)
                          .reduce((sum, r) => sum + r.count, 0)) /
                          metrics.totalReviews) *
                          100,
                      )
                    : 0}
                  %
                </strong>
              </div>
            </Card>

            <Card className="p-5 sm:p-6 shadow-sm border border-sand-300">
              <div className="border-b border-sand-200 pb-3">
                <h3 className="font-bold text-base text-river-900 flex items-center gap-2">
                  <PieIcon className="size-5 text-teal-600" />
                  Cơ Cấu Phương Thức Du Khách Check-in ({daysWindow} ngày)
                </h3>
                <p className="text-xs text-river-600">
                  Tỷ lệ tương tác thực địa qua GPS vệ tinh và trạm quét mã QR
                </p>
              </div>

              <div className="mt-4 h-56 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data?.chartAnalytics?.checkInSources || []}
                      innerRadius={52}
                      outerRadius={78}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {(data?.chartAnalytics?.checkInSources || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val) => [`${val} lượt`, '']}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* Row 3: Hourly Peak Times & Challenge Completions */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="p-5 sm:p-6 shadow-sm border border-sand-300">
              <div className="border-b border-sand-200 pb-3">
                <h3 className="font-bold text-base text-river-900 flex items-center gap-2">
                  <Clock className="size-5 text-indigo-600" />
                  Khung Giờ Check-in Thực Tế ({daysWindow} ngày)
                </h3>
                <p className="text-xs text-river-600">
                  Số lượt check-in thực tế theo khung giờ giúp KDL bố trí nhân lực đón tiếp chuẩn xác
                </p>
              </div>

              <div className="mt-4 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data?.chartAnalytics?.hourlyTraffic || []}
                    margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1ece1" vertical={false} />
                    <XAxis dataKey="period" fontSize={11} stroke="#64748b" />
                    <YAxis allowDecimals={false} fontSize={11} stroke="#64748b" />
                    <Tooltip
                      formatter={(val) => [`${val} lượt thực tế`, 'Lưu lượng']}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                    />
                    <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-5 sm:p-6 shadow-sm border border-sand-300">
              <div className="border-b border-sand-200 pb-3">
                <h3 className="font-bold text-base text-river-900 flex items-center gap-2">
                  <Trophy className="size-5 text-lotus-600" />
                  Hiệu Suất Hoàn Thành Thử Thách Văn Hóa
                </h3>
                <p className="text-xs text-river-600">
                  Đo lường mức độ tương tác và giải đúng câu đố của du khách
                </p>
              </div>

              <div className="mt-4 h-56">
                {data?.chartAnalytics?.challengesPerformance &&
                data.chartAnalytics.challengesPerformance.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.chartAnalytics.challengesPerformance}
                      layout="vertical"
                      margin={{ top: 10, right: 20, left: 10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1ece1" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} fontSize={11} stroke="#64748b" />
                      <YAxis
                        type="category"
                        dataKey="title"
                        width={110}
                        fontSize={11}
                        stroke="#64748b"
                        tickFormatter={(v: string) => (v.length > 14 ? `${v.slice(0, 13)}…` : v)}
                      />
                      <Tooltip
                        formatter={(val) => [`${val} lượt giải đúng`, 'Kết quả']}
                        contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                      />
                      <Bar dataKey="completions" fill="#db2777" radius={[0, 4, 4, 0]} maxBarSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center text-center text-river-400">
                    <Trophy className="size-8 mb-1 opacity-50" />
                    <p className="text-xs">Chưa có thử thách nào được tạo</p>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Comprehensive Data Table */}
          <Card className="overflow-hidden border border-sand-300 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-sand-200 bg-gradient-to-r from-leaf-900 via-leaf-800 to-river-900 px-5 sm:px-6 py-4 text-white">
              <div className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-teal-300 shadow-inner">
                  <FileSpreadsheet className="size-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Bảng Tổng Hợp Thông Số Vận Hành & Chỉ Số KDL
                  </h3>
                  <p className="text-xs text-sand-200">
                    Báo cáo toàn cảnh thông số vận hành, tiếp đón và tương tác số của {destination.name}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <ButtonLink
                  to={`/admin/destinations/${destination.id}/edit`}
                  variant="accent"
                  size="sm"
                  icon={<PenLine className="size-4" />}
                >
                  Chỉnh sửa hồ sơ
                </ButtonLink>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-sand-200 bg-sand-100/70 text-xs font-bold uppercase tracking-wider text-river-700">
                    <th className="py-3 px-4 w-1/4">Danh mục thông số</th>
                    <th className="py-3 px-4 w-2/5">Dữ liệu thực tế</th>
                    <th className="py-3 px-4 w-1/5">Tình trạng</th>
                    <th className="py-3 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand-200 text-river-900">
                  <tr className="bg-sand-50/50 font-bold text-xs uppercase text-river-500">
                    <td colSpan={4} className="py-2.5 px-4">
                      <span className="inline-flex items-center gap-1.5">
                        <Layers className="size-3.5 text-leaf-600" /> 1. Hồ sơ định danh & Vị trí
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-medium text-river-600">Tên điểm du lịch</td>
                    <td className="py-3 px-4 font-bold">{destination.name}</td>
                    <td className="py-3 px-4">
                      <Badge tone="leaf">{categoryLabel(destination.category as never)}</Badge>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs text-river-500">
                      {destination.slug}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-medium text-river-600">Tọa độ vệ tinh GPS</td>
                    <td className="py-3 px-4 font-mono text-xs">
                      {destination.coordinates ? (
                        <span className="font-semibold text-leaf-800">
                          {destination.coordinates.lat}, {destination.coordinates.lng}
                        </span>
                      ) : (
                        <span className="italic text-amber-600">Chưa chấm điểm trên bản đồ</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {destination.coordinates ? (
                        <span className="inline-flex items-center gap-1 text-xs text-teal-700 font-medium">
                          <CheckCircle2 className="size-3.5" /> Geofence GPS sẵn sàng
                        </span>
                      ) : (
                        <span className="text-xs text-amber-700 font-medium">Cần bổ sung</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <ButtonLink to={`/admin/destinations/${destination.id}/edit`} variant="ghost" size="sm">
                        Cập nhật
                      </ButtonLink>
                    </td>
                  </tr>

                  <tr className="bg-sand-50/50 font-bold text-xs uppercase text-river-500">
                    <td colSpan={4} className="py-2.5 px-4">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="size-3.5 text-teal-600" /> 2. Vận hành & Minh bạch dịch vụ
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-medium text-river-600">Trạng thái đón khách</td>
                    <td className="py-3 px-4">
                      <Badge tone={isOpen ? 'leaf' : 'lotus'}>
                        {isOpen ? 'Đang mở cửa đón khách' : 'Tạm ngưng / Bảo trì'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-xs text-river-600">Cập nhật tức thì</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={handleOpenStatusModal}
                        className="text-xs font-semibold text-leaf-700 hover:underline"
                      >
                        Đổi trạng thái
                      </button>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-medium text-river-600">Thông báo công khai BQL</td>
                    <td className="py-3 px-4 text-xs text-river-800">
                      {destination.partnerNotice || (
                        <span className="italic text-river-400">Chưa đặt thông báo nóng</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-river-600">Hiển thị trên trang khách</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={handleOpenStatusModal}
                        className="text-xs font-semibold text-leaf-700 hover:underline"
                      >
                        Sửa thông báo
                      </button>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-medium text-river-600">Giờ mở cửa & Giá vé niêm yết</td>
                    <td className="py-3 px-4 text-xs">
                      <span className="font-semibold">{destination.openingHours || 'Chưa rõ giờ'}</span>
                      {' · '}
                      <span>{destination.referencePrice || 'Miễn phí vé cổng'}</span>
                    </td>
                    <td className="py-3 px-4 text-xs text-river-600">Chuẩn Luật Du lịch</td>
                    <td className="py-3 px-4 text-right">
                      <ButtonLink to={`/admin/destinations/${destination.id}/edit`} variant="ghost" size="sm">
                        Cập nhật
                      </ButtonLink>
                    </td>
                  </tr>

                  <tr className="bg-sand-50/50 font-bold text-xs uppercase text-river-500">
                    <td colSpan={4} className="py-2.5 px-4">
                      <span className="inline-flex items-center gap-1.5">
                        <Globe className="size-3.5 text-blue-600" /> 3. Tương tác số & Kiểm toán
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-medium text-river-600">Mã QR & Thử thách & Huy hiệu</td>
                    <td className="py-3 px-4 text-xs font-semibold">
                      {data?.qrs?.length || 0} QR · {data?.challenges?.length || 0} Thử thách · {activeBadgesCount}/5 Huy hiệu
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 text-xs text-leaf-700 font-medium">
                        <ShieldCheck className="size-3.5" /> Lưu Audit Log đầy đủ
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setActiveTab('audit')}
                        className="text-xs font-semibold text-leaf-700 hover:underline"
                      >
                        Xem nhật ký
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          TAB 1: DÒNG KHÁCH (NĐ 13/2023) & ĐÁNH GIÁ + AI TRẢ LỜI NHANH
         ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* Recent Check-ins */}
          <Card className="p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sand-200 pb-3">
              <h3 className="font-bold text-river-900 flex items-center gap-2">
                <MapPin className="size-4 text-leaf-600" />
                Khách du lịch vừa Check-in tại KDL
              </h3>
              <Badge tone="leaf">{data?.recentCheckIns?.length || 0} lượt gần nhất</Badge>
            </div>

            <div className="mt-3 rounded-lg bg-leaf-50/70 border border-leaf-200 px-3 py-2 text-[11px] text-leaf-900 flex items-center gap-2">
              <ShieldCheck className="size-4 shrink-0 text-leaf-700" />
              <span>
                <strong>Bảo vệ dữ liệu cá nhân (NĐ 13/2023/NĐ-CP):</strong> Hệ thống chỉ hiển thị tên hiển thị công khai, tuyệt đối không tiết lộ email/SĐT cá nhân của du khách.
              </span>
            </div>

            {data?.recentCheckIns && data.recentCheckIns.length > 0 ? (
              <ul className="mt-4 divide-y divide-sand-200">
                {data.recentCheckIns.map((item) => (
                  <li key={item.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-leaf-50 text-leaf-700 font-bold text-xs ring-1 ring-leaf-200">
                        {item.visitorName.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-river-900 truncate">{item.visitorName}</p>
                        <p className="text-xs text-river-500">
                          {item.source === 'gps' ? '📍 Check-in GPS Thực địa' : '📱 Quét QR tại Điểm'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-bold text-leaf-700">+{item.scoreAwarded} EXP</span>
                      <p className="text-[11px] text-river-400">{formatDateTime(item.completedAt)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-6 text-sm text-river-500 italic text-center py-6">
                Chưa có lượt check-in nào trong thời gian gần đây.
              </p>
            )}
          </Card>

          {/* Recent Reviews with Inline AI Quick Reply */}
          <Card className="p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sand-200 pb-3">
              <h3 className="font-bold text-river-900 flex items-center gap-2">
                <MessageSquare className="size-4 text-amber-500" />
                Đánh giá mới nhất & Trả lời nhanh (AI CSKH)
              </h3>
              <ButtonLink
                to="/admin/reviews"
                size="sm"
                variant="secondary"
                icon={<ExternalLink className="size-3.5" />}
              >
                Xem tất cả ({metrics?.totalReviews ?? 0})
              </ButtonLink>
            </div>

            {data?.recentReviews && data.recentReviews.length > 0 ? (
              <div className="mt-4 space-y-3">
                {data.recentReviews.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-xl border border-sand-200 bg-sand-50/50 p-3.5 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm text-river-900 truncate">{r.authorName}</span>
                      <div className="flex items-center gap-0.5 shrink-0">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={clsx(
                              'size-3.5',
                              star <= r.rating
                                ? 'fill-amber-400 text-amber-500'
                                : 'fill-sand-200 text-sand-300',
                            )}
                          />
                        ))}
                      </div>
                    </div>

                    <p className="text-xs text-river-700 leading-relaxed italic">"{r.content}"</p>

                    {r.hasResponse && r.response?.content && (
                      <div className="rounded-lg bg-leaf-50/80 border border-leaf-200/80 p-2.5 text-xs text-leaf-950">
                        <span className="font-bold text-leaf-800">
                          ✓ {r.response.responderName || `Ban Quản lý ${destination.name}`}:
                        </span>{' '}
                        {r.response.content}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] pt-1.5 border-t border-sand-200/70">
                      <span className="text-river-400">{formatDate(r.createdAt)}</span>
                      <button
                        type="button"
                        onClick={() => setReplyReview(r)}
                        className="inline-flex items-center gap-1 rounded-md bg-white border border-leaf-300 px-2.5 py-1 font-semibold text-leaf-800 hover:bg-leaf-50 transition"
                      >
                        <Sparkles className="size-3 text-lotus-600" />
                        {r.hasResponse ? 'Sửa phản hồi' : 'Trả lời + AI Gợi ý'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-6 text-sm text-river-500 italic text-center py-6">
                Chưa có đánh giá nào cho điểm đến này.
              </p>
            )}
          </Card>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          ĐỢT 2 TABS: VOUCHER & QUẦY ĐỐI SOÁT, BẢNG GIÁ COMBO, ĐẶT ĐOÀN, BANNER
         ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'vouchers' && (
        <PartnerVouchersTab
          destinationId={destination.id}
          destinationName={destination.name}
          onChanged={reload}
        />
      )}

      {activeTab === 'services' && (
        <PartnerServicesTab
          destinationId={destination.id}
          destinationName={destination.name}
          onChanged={reload}
        />
      )}

      {activeTab === 'inquiries' && (
        <PartnerInquiriesTab
          destinationId={destination.id}
          destinationName={destination.name}
          onChanged={reload}
        />
      )}

      {activeTab === 'banners' && (
        <PartnerBannersTab
          destinationId={destination.id}
          destinationName={destination.name}
          onChanged={reload}
        />
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          TAB 2: FULL SCOPED CHALLENGES CRUD + AI DRAFT
         ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'challenges' && (
        <Card className="mt-6 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sand-200 pb-4">
            <div>
              <h3 className="font-bold text-lg text-river-900">Thử thách & Trò chơi Văn hóa KDL</h3>
              <p className="text-xs text-river-600">
                Hỗ trợ tạo bộ 1–5 câu hỏi trắc nghiệm, câu chuyện thuyết minh văn hóa và Trợ lý AI soạn nháp cho {destination.name}.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setEditingChallenge(null);
                setIsChallengeModalOpen(true);
              }}
              icon={<Plus className="size-4" />}
            >
              Tạo thử thách mới
            </Button>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data?.challenges && data.challenges.length > 0 ? (
              data.challenges.map((c) => {
                const isActive = c.status === 'active';
                return (
                  <div
                    key={c.id}
                    className={clsx(
                      'rounded-xl border p-4 flex flex-col justify-between gap-3 shadow-xs transition',
                      isActive ? 'border-sand-200 bg-white' : 'border-sand-200 bg-sand-50/70 opacity-80',
                    )}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <span className="flex size-9 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                          <Trophy className="size-5" />
                        </span>
                        <Badge tone={isActive ? 'leaf' : 'neutral'}>
                          {isActive ? 'Đang mở' : 'Tạm dừng'}
                        </Badge>
                      </div>
                      <div>
                        <h4 className="font-bold text-river-900">{c.title}</h4>
                        {c.description && (
                          <p className="mt-1 text-xs text-river-600 line-clamp-2">{c.description}</p>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-xs text-river-500 pt-2 border-t border-sand-200">
                        <span>{c.questionCount} câu hỏi</span>
                        <span className="font-bold text-teal-700">+{c.rewardPoints} EXP</span>
                        <span>{c.completions} lượt đạt</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-sand-200">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setEditingChallenge(c);
                          setIsChallengeModalOpen(true);
                        }}
                        icon={<PenLine className="size-3.5" />}
                      >
                        Sửa
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={togglingId === c.id}
                        onClick={() => handleToggleChallengeStatus(c.id, c.status)}
                        icon={
                          isActive ? (
                            <PauseCircle className="size-3.5 text-amber-600" />
                          ) : (
                            <PlayCircle className="size-3.5 text-leaf-700" />
                          )
                        }
                      >
                        {isActive ? 'Tạm dừng' : 'Mở lại'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setConfirmDelete({
                            kind: 'challenge',
                            id: c.id,
                            title: c.title,
                            completions: c.completions,
                          })
                        }
                        icon={<Trash2 className="size-3.5 text-red-600" />}
                      >
                        Xóa
                      </Button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-full py-10 text-center border border-dashed rounded-xl border-sand-300">
                <Trophy className="size-10 mx-auto text-river-400 mb-2" />
                <p className="text-sm font-semibold text-river-700">Chưa có thử thách văn hóa nào</p>
                <p className="text-xs text-river-500 mt-1">
                  Bấm "Tạo thử thách mới" và dùng Trợ lý AI để soạn nhanh bộ câu đố chuẩn cho KDL!
                </p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          TAB 3: FULL SCOPED QR CRUD + LOCAL HD STANDEE
         ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'qr' && (
        <Card className="mt-6 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sand-200 pb-4">
            <div>
              <h3 className="font-bold text-lg text-river-900">Mã QR & Bộ Standee Trưng Bày HD</h3>
              <p className="text-xs text-river-600">
                Tạo mã QR bảo mật ngẫu nhiên (CSPRNG), xem lượt quét từng trạm và tải/in Standee HD (100% nội bộ, không phụ thuộc bên thứ ba).
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenCreateQr}
              icon={<Plus className="size-4" />}
            >
              Tạo mã QR mới
            </Button>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data?.qrs && data.qrs.length > 0 ? (
              data.qrs.map((qr) => {
                const isActive = qr.status === 'active';
                return (
                  <div
                    key={qr.id}
                    className={clsx(
                      'rounded-xl border p-4 flex flex-col justify-between gap-3 shadow-xs transition',
                      isActive ? 'border-sand-200 bg-white' : 'border-sand-200 bg-sand-50/70 opacity-75',
                    )}
                  >
                    <div className="space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <span className="font-mono font-bold text-sm bg-sand-100 text-river-900 px-2 py-0.5 rounded">
                          {qr.code}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <Badge tone={qr.targetType === 'destination' ? 'leaf' : 'lotus'}>
                            {qr.targetType === 'destination' ? 'Check-in KDL' : 'Thử thách'}
                          </Badge>
                          <Badge tone={isActive ? 'leaf' : 'neutral'}>
                            {isActive ? 'Hoạt động' : 'Đã khóa'}
                          </Badge>
                        </div>
                      </div>

                      <h4 className="font-bold text-river-900 text-sm">{qr.label}</h4>

                      <div className="flex items-center justify-between text-xs text-river-500">
                        <span>👁️ {(qr.landingViews ?? 0).toLocaleString()} lượt quét</span>
                        <span>{formatDate(qr.createdAt)}</span>
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-sand-200 flex flex-wrap items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => setStandeeQr(qr)}
                        icon={<Printer className="size-3.5" />}
                      >
                        Standee HD
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleOpenEditQr({ id: qr.id, label: qr.label, code: qr.code })}
                        icon={<PenLine className="size-3.5" />}
                      >
                        Sửa
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={togglingId === qr.id}
                        onClick={() => handleToggleQrStatus(qr.id, qr.status)}
                      >
                        {isActive ? 'Khóa' : 'Mở'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setConfirmDelete({
                            kind: 'qr',
                            id: qr.id,
                            label: qr.label,
                            code: qr.code,
                          })
                        }
                        icon={<Trash2 className="size-3.5 text-red-600" />}
                      >
                        Xóa
                      </Button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-full py-10 text-center border border-dashed rounded-xl border-sand-300">
                <QrCode className="size-10 mx-auto text-river-400 mb-2" />
                <p className="text-sm font-semibold text-river-700">Chưa có mã QR nào</p>
                <p className="text-xs text-river-500 mt-1">
                  Hãy bấm "Tạo mã QR mới" để tạo Standee đặt quầy vé cho du khách check-in!
                </p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          TAB 4: FULL SCOPED BADGES CRUD
         ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'badges' && (
        <Card className="mt-6 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sand-200 pb-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-bold text-lg text-river-900">Huy Hiệu & Thành Tựu Đặc Quyền KDL</h3>
                <span className="rounded-full bg-leaf-100 px-2.5 py-0.5 text-xs font-semibold text-leaf-800">
                  {activeBadgesCount}/5 đang hoạt động
                </span>
              </div>
              <p className="text-xs text-river-600 mt-0.5">
                Tạo và quản lý tối đa 5 huy hiệu độc quyền đang hoạt động gắn với {destination.name}.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              disabled={activeBadgesCount >= 5}
              onClick={handleOpenCreateBadge}
              icon={<Plus className="size-4" />}
            >
              Tạo Huy hiệu mới
            </Button>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data?.badges && data.badges.length > 0 ? (
              data.badges.map((b) => {
                const isActive = b.status === 'active';
                return (
                  <div
                    key={b.id || b.key}
                    className={clsx(
                      'rounded-2xl border p-5 shadow-xs flex flex-col justify-between gap-4 transition',
                      isActive ? 'border-sand-200 bg-white' : 'border-sand-200 bg-sand-50/70 opacity-75',
                    )}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex size-11 items-center justify-center rounded-xl bg-amber-50 border border-amber-200">
                          {renderPartnerBadgeIcon(b.icon)}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Badge tone="leaf">+{b.rewardPoints} EXP</Badge>
                          <Badge tone={isActive ? 'leaf' : 'neutral'}>
                            {isActive ? 'Đang mở' : 'Tạm dừng'}
                          </Badge>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-bold text-river-900 text-base">{b.name}</h4>
                        <p className="text-xs text-river-600 mt-1 leading-relaxed">{b.description}</p>
                      </div>

                      <p className="text-xs text-river-500 font-medium">
                        🎯{' '}
                        {b.criteriaType === 'checkin_count'
                          ? `Check-in ${b.targetCount} lần tại KDL`
                          : `Hoàn thành ${b.targetCount || 1} thử thách tại KDL`}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-sand-200/80 flex flex-wrap items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleOpenEditBadge(b)}
                        icon={<PenLine className="size-3.5" />}
                      >
                        Sửa
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={togglingId === b.id}
                        onClick={() => handleToggleBadgeStatus(b.id, b.status)}
                      >
                        {isActive ? 'Tạm dừng' : 'Kích hoạt'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setConfirmDelete({ kind: 'badge', id: b.id, name: b.name })
                        }
                        icon={<Trash2 className="size-3.5 text-red-600" />}
                      >
                        Xóa
                      </Button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-full py-10 text-center border border-dashed rounded-2xl border-sand-300 bg-sand-50/50">
                <Award className="size-10 mx-auto text-amber-500/60 mb-2" />
                <p className="text-sm font-semibold text-river-800">Chưa có Huy hiệu đặc quyền nào</p>
                <p className="text-xs text-river-500 mt-1 max-w-md mx-auto">
                  Hãy tạo huy hiệu đầu tiên cho {destination.name} để khích lệ du khách quay lại!
                </p>
                <Button
                  className="mt-4"
                  variant="primary"
                  size="sm"
                  onClick={handleOpenCreateBadge}
                  icon={<Plus className="size-4" />}
                >
                  Tạo Huy hiệu mới ngay
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          TAB 5: CẢNH BÁO AN TOÀN THỰC ĐỊA (SYNCED WITH TRIP PLANNER V9 & 3D MAP)
         ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'alerts' && (
        <PartnerAlertsTab
          destinationId={destination.id}
          destinationName={destination.name}
          hasCoordinates={Boolean(destination.coordinates?.lat && destination.coordinates?.lng)}
          onChanged={reload}
        />
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          TAB 6: NHẬT KÝ VẬN HÀNH & KIỂM TOÁN BẤT BIẾN
         ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'audit' && (
        <PartnerAuditLogsTab destinationId={destination.id} destinationName={destination.name} />
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          TAB 7: THÔNG TIN VẬN HÀNH
         ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'operations' && (
        <Card className="mt-6 p-5 sm:p-6 space-y-6">
          <div className="border-b border-sand-200 pb-4">
            <h3 className="font-bold text-lg text-river-900">Thông tin Vận hành & Pháp lý Cơ sở</h3>
            <p className="text-xs text-river-600">
              Đảm bảo thông tin giờ mở cửa, giá vé niêm yết và đường dây nóng luôn cập nhật chính xác theo Luật Du lịch.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-sand-200 p-4 bg-sand-50/50 space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-river-500 flex items-center gap-1.5">
                <Clock className="size-4 text-leaf-600" /> Giờ đón khách
              </span>
              <p className="text-sm font-semibold text-river-900">
                {destination.openingHours || 'Chưa cập nhật'}
              </p>
            </div>

            <div className="rounded-xl border border-sand-200 p-4 bg-sand-50/50 space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-river-500 flex items-center gap-1.5">
                <Ticket className="size-4 text-amber-500" /> Giá vé tham quan niêm yết
              </span>
              <p className="text-sm font-semibold text-river-900">
                {destination.referencePrice || 'Miễn phí vé vào cổng'}
              </p>
            </div>

            <div className="rounded-xl border border-sand-200 p-4 bg-sand-50/50 space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-river-500 flex items-center gap-1.5">
                <Phone className="size-4 text-teal-600" /> Hotline liên hệ
              </span>
              <p className="text-sm font-semibold text-river-900">
                {destination.contactInfo?.phone || 'Chưa cập nhật'}
              </p>
            </div>

            <div className="rounded-xl border border-sand-200 p-4 bg-sand-50/50 space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-river-500 flex items-center gap-1.5">
                <MapPin className="size-4 text-lotus-600" /> Tọa độ GPS thực địa
              </span>
              <p className="text-sm font-mono text-river-900">
                {destination.coordinates
                  ? `${destination.coordinates.lat}, ${destination.coordinates.lng}`
                  : 'Chưa định vị'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={handleOpenStatusModal} icon={<Clock className="size-4" />}>
              Cập nhật trạng thái / Thông báo nóng
            </Button>
            <ButtonLink
              to={`/admin/destinations/${destination.id}/edit`}
              variant="primary"
              icon={<PenLine className="size-4" />}
            >
              Chỉnh sửa hồ sơ chi tiết
            </ButtonLink>
          </div>
        </Card>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          MODALS
         ════════════════════════════════════════════════════════════════════════ */}

      {/* Modal 1: Operational Status & Public Partner Notice */}
      <Modal
        open={isStatusModalOpen}
        title="Trạng thái Đón khách & Thông báo Công khai"
        onClose={() => setIsStatusModalOpen(false)}
      >
        <form onSubmit={handleSaveOperationalStatus} className="space-y-4">
          <p className="text-xs text-river-600">
            Thay đổi trạng thái đón khách và thông báo chính thức của <strong>{destination.name}</strong> có hiệu lực ngay lập tức trên trang du khách (tách biệt hoàn toàn với ghi chú kiểm duyệt nội bộ của Sở VHTTDL).
          </p>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-river-600 mb-2">
              Trạng thái đón khách thực tế *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                className={clsx(
                  'flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-all',
                  operationalStatus === 'active'
                    ? 'border-leaf-600 bg-leaf-50/50 ring-2 ring-leaf-400'
                    : 'border-sand-200 bg-white',
                )}
              >
                <input
                  type="radio"
                  name="op-status"
                  checked={operationalStatus === 'active'}
                  onChange={() => setOperationalStatus('active')}
                  className="accent-leaf-600"
                />
                <div>
                  <p className="text-sm font-bold text-river-900">🟢 Đang mở cửa</p>
                  <p className="text-xs text-river-500">Đón khách bình thường</p>
                </div>
              </label>

              <label
                className={clsx(
                  'flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-all',
                  operationalStatus === 'temporarily_closed'
                    ? 'border-amber-600 bg-amber-50/50 ring-2 ring-amber-400'
                    : 'border-sand-200 bg-white',
                )}
              >
                <input
                  type="radio"
                  name="op-status"
                  checked={operationalStatus === 'temporarily_closed'}
                  onChange={() => setOperationalStatus('temporarily_closed')}
                  className="accent-amber-600"
                />
                <div>
                  <p className="text-sm font-bold text-river-900">🟠 Tạm đóng cửa</p>
                  <p className="text-xs text-river-500">Bảo trì / Tạm nghỉ</p>
                </div>
              </label>
            </div>
          </div>

          <div>
            <label
              htmlFor="special-notice"
              className="block text-xs font-semibold uppercase tracking-wider text-river-600"
            >
              Thông báo công khai gửi du khách (tối đa 500 ký tự — bỏ trống để xóa)
            </label>
            <textarea
              id="special-notice"
              rows={3}
              maxLength={500}
              value={specialNotice}
              onChange={(e) => setSpecialNotice(e.target.value)}
              placeholder="VD: Vườn sen đang vào mùa nở rộ đẹp nhất từ 06h–09h sáng; miễn phí vé trẻ em dưới 1m2..."
              className="mt-1 block w-full rounded-control border border-sand-300 bg-white p-3 text-sm text-river-800 placeholder:text-river-400 focus:border-leaf-600 focus:outline-none focus:ring-1 focus:ring-leaf-600"
            />
            <p className="mt-1 text-right text-[11px] text-river-400">{specialNotice.length}/500</p>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-sand-200">
            <Button type="button" variant="secondary" onClick={() => setIsStatusModalOpen(false)}>
              Hủy
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={isUpdatingStatus}
              icon={<CheckCircle2 className="size-4" />}
            >
              Lưu & Công bố ngay
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal 2: Create / Edit Challenge + Multi-Question + AI Draft */}
      <PartnerChallengeModal
        open={isChallengeModalOpen}
        destinationId={destination.id}
        destinationName={destination.name}
        editingChallenge={editingChallenge}
        onClose={() => {
          setIsChallengeModalOpen(false);
          setEditingChallenge(null);
        }}
        onSaved={reload}
      />

      {/* Modal 3: Create / Edit QR */}
      <Modal
        open={isQrModalOpen}
        title={editingQr ? `Sửa nhãn Mã QR (${editingQr.code})` : 'Phát hành Mã QR Check-in Điểm Đến'}
        onClose={() => {
          setIsQrModalOpen(false);
          setEditingQr(null);
        }}
      >
        <form onSubmit={handleSaveQr} className="space-y-4">
          <div>
            <label htmlFor="qr-label" className="block text-xs font-semibold uppercase tracking-wider text-river-600">
              Tên nhãn vị trí đặt QR *
            </label>
            <Input
              id="qr-label"
              type="text"
              value={qrLabel}
              onChange={(e) => setQrLabel(e.target.value)}
              placeholder="VD: Cổng chính quầy vé, Cầu ngắm sen, Bến xuồng..."
              className="mt-1"
              required
            />
          </div>

          {!editingQr && (
            <>
              <div>
                <label htmlFor="qr-type" className="block text-xs font-semibold uppercase tracking-wider text-river-600">
                  Mục tiêu khi du khách quét *
                </label>
                <Select
                  id="qr-type"
                  value={qrTargetType}
                  onChange={(e) => setQrTargetType(e.target.value as 'destination' | 'challenge')}
                  className="mt-1"
                >
                  <option value="destination">📍 Điểm danh Check-in nhận điểm Hộ chiếu</option>
                  <option value="challenge">🏆 Mở trực tiếp Thử thách văn hóa</option>
                </Select>
              </div>

              {qrTargetType === 'challenge' && (
                <div>
                  <label htmlFor="qr-ch-id" className="block text-xs font-semibold uppercase tracking-wider text-river-600">
                    Chọn thử thách liên kết *
                  </label>
                  <Select
                    id="qr-ch-id"
                    value={qrChallengeId}
                    onChange={(e) => setQrChallengeId(e.target.value)}
                    className="mt-1"
                    required
                  >
                    <option value="">-- Chọn thử thách --</option>
                    {data?.challenges?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title} (+{c.rewardPoints} EXP)
                      </option>
                    ))}
                  </Select>
                </div>
              )}
            </>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-sand-200">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsQrModalOpen(false);
                setEditingQr(null);
              }}
            >
              Hủy
            </Button>
            <Button type="submit" variant="primary" loading={isSubmittingQr} icon={<QrCode className="size-4" />}>
              {editingQr ? 'Lưu nhãn mới' : 'Tạo mã QR'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal 4: Offline Local HD Standee Modal */}
      <PartnerStandeeModal
        qr={standeeQr}
        destinationName={destination.name}
        onClose={() => setStandeeQr(null)}
      />

      {/* Modal 5: Create / Edit Partner Badge */}
      <Modal
        open={isBadgeModalOpen}
        title={
          editingBadgeId
            ? 'Chỉnh sửa Huy Hiệu Đặc Quyền KDL'
            : 'Tạo Huy Hiệu & Thành Tựu Đặc Quyền KDL'
        }
        onClose={() => {
          setIsBadgeModalOpen(false);
          setEditingBadgeId(null);
        }}
      >
        <form onSubmit={handleSaveBadge} className="space-y-4">
          <p className="text-xs text-river-600 bg-sand-50 p-3 rounded-lg border border-sand-200">
            Huy hiệu gắn trực tiếp với <strong>{destination.name}</strong>. Tối đa 5 huy hiệu đang hoạt động cùng lúc.
          </p>

          <div>
            <label className="block text-xs font-bold text-river-800 uppercase tracking-wider mb-1">
              Tên Huy Hiệu *
            </label>
            <Input
              value={badgeName}
              onChange={(e) => setBadgeName(e.target.value)}
              placeholder="VD: Nhà Khám Phá Hoa Sa Đéc, Bậc Thầy Tràm Chim..."
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-river-800 uppercase tracking-wider mb-1">
              Mô Tả Huy Hiệu *
            </label>
            <textarea
              className="w-full rounded-xl border border-sand-300 p-3 text-sm focus:border-leaf-600 focus:outline-none"
              rows={2}
              value={badgeDescription}
              onChange={(e) => setBadgeDescription(e.target.value)}
              placeholder="VD: Dành cho du khách check-in tại điểm đến và trải nghiệm văn hóa địa phương."
              required
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-river-800 uppercase tracking-wider mb-1">
                Biểu Tượng (Icon)
              </label>
              <Select value={badgeIcon} onChange={(e) => setBadgeIcon(e.target.value)}>
                {badgeIconsList.map((i) => (
                  <option key={i.value} value={i.value}>
                    {i.label}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-xs font-bold text-river-800 uppercase tracking-wider mb-1">
                Điểm Thưởng (EXP: 10 - 150)
              </label>
              <Input
                type="number"
                min={10}
                max={150}
                value={badgeRewardPoints}
                onChange={(e) => setBadgeRewardPoints(Number(e.target.value))}
                required
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-river-800 uppercase tracking-wider mb-1">
                Điều Kiện Mở Khóa
              </label>
              <Select
                value={badgeCriteriaType}
                onChange={(e) => setBadgeCriteriaType(e.target.value as 'checkin_count' | 'challenge_count')}
              >
                <option value="checkin_count">Số lần Check-in tại KDL</option>
                <option value="challenge_count">Số thử thách hoàn thành tại KDL</option>
              </Select>
            </div>

            <div>
              <label className="block text-xs font-bold text-river-800 uppercase tracking-wider mb-1">
                Số Lượng Mục Tiêu (1–50)
              </label>
              <Input
                type="number"
                min={1}
                max={50}
                value={badgeTargetCount}
                onChange={(e) => setBadgeTargetCount(Number(e.target.value))}
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-sand-200">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsBadgeModalOpen(false);
                setEditingBadgeId(null);
              }}
            >
              Hủy
            </Button>
            <Button type="submit" variant="primary" loading={isSubmittingBadge}>
              {editingBadgeId ? 'Lưu cập nhật' : 'Phát hành Huy hiệu'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal 6: Quick Reply with AI Suggestions */}
      <PartnerQuickReplyModal
        review={replyReview}
        destinationName={destination.name}
        onClose={() => setReplyReview(null)}
        onSaved={reload}
      />

      {/* Confirm Safe Delete Dialog */}
      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title={
          confirmDelete?.kind === 'challenge'
            ? 'Xác nhận xóa thử thách?'
            : confirmDelete?.kind === 'qr'
              ? 'Xác nhận xóa mã QR?'
              : 'Xác nhận xóa huy hiệu?'
        }
        message={
          confirmDelete?.kind === 'challenge' ? (
            <p>
              Bạn muốn xóa thử thách <strong>{confirmDelete.title}</strong>?{' '}
              {confirmDelete.completions > 0
                ? `Thử thách này đã có ${confirmDelete.completions} lượt du khách hoàn thành nên hệ thống sẽ tự động chuyển sang Tạm dừng để bảo toàn điểm Hộ chiếu của du khách.`
                : 'Thử thách chưa có lượt hoàn thành nên sẽ được xóa vĩnh viễn.'}
            </p>
          ) : confirmDelete?.kind === 'qr' ? (
            <p>
              Bạn muốn xóa mã QR <strong>{confirmDelete.code}</strong> ({confirmDelete.label})? Nếu mã này đã từng có lượt quét, hệ thống sẽ tự động vô hiệu hóa để bảo toàn lịch sử thống kê.
            </p>
          ) : confirmDelete?.kind === 'badge' ? (
            <p>
              Bạn có chắc muốn xóa huy hiệu <strong>{confirmDelete.name}</strong> khỏi danh sách của KDL?
            </p>
          ) : null
        }
        confirmLabel="Xác nhận"
        tone="danger"
        loading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </>
  );
}
