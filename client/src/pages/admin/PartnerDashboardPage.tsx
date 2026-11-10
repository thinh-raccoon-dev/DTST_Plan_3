import clsx from 'clsx';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  Globe,
  Layers,
  MapPin,
  MessageSquare,
  PenLine,
  Phone,
  Plus,
  Printer,
  QrCode,
  ShieldCheck,
  Sparkles,
  Star,
  Ticket,
  Trophy,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminPageHeader } from '../../components/layout/AdminLayout';
import { Badge } from '../../components/ui/Badge';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Card, StatCard } from '../../components/ui/Card';
import { Input, Select } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { ErrorState, PageLoader } from '../../components/ui/States';
import { useApiQuery } from '../../hooks/useApiQuery';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { api } from '../../lib/api';
import { areaLabel, categoryLabel } from '../../lib/catalog';
import { formatDate, formatDateTime } from '../../lib/format';
import { useAuthStore } from '../../stores/authStore';
import { toast } from '../../stores/toastStore';
import type { PartnerOverviewResponse } from '../../types/api';

export function PartnerDashboardPage() {
  useDocumentTitle('Bảng Điều Hành Khu Du Lịch (Partner Hub)');
  const currentUser = useAuthStore((s) => s.user);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'summary' | 'overview' | 'challenges' | 'qr' | 'operations'>('summary');

  // Operational toggle modal / state
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [operationalStatus, setOperationalStatus] = useState<'active' | 'temporarily_closed'>('active');
  const [specialNotice, setSpecialNotice] = useState('');
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);

  // Create challenge modal
  const [isChallengeModalOpen, setIsChallengeModalOpen] = useState(false);
  const [challengeTitle, setChallengeTitle] = useState('');
  const [challengeDescription, setChallengeDescription] = useState('');
  const [challengePoints, setChallengePoints] = useState(50);
  const [questionPrompt, setQuestionPrompt] = useState('');
  const [options, setOptions] = useState(['', '', '', '']);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [questionExplanation, setQuestionExplanation] = useState('');
  const [isSubmittingChallenge, setIsSubmittingChallenge] = useState(false);

  // Create QR modal
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrLabel, setQrLabel] = useState('');
  const [qrTargetType, setQrTargetType] = useState<'destination' | 'challenge'>('destination');
  const [qrChallengeId, setQrChallengeId] = useState('');
  const [isSubmittingQr, setIsSubmittingQr] = useState(false);

  // Standee Print preview modal
  const [standeeQr, setStandeeQr] = useState<{ code: string; label: string; targetType: string } | null>(null);

  // Fetch data
  const { data, loading, error, reload } = useApiQuery<PartnerOverviewResponse>(
    (signal) => api.get<PartnerOverviewResponse>('/admin/partner/overview', { signal }).then((r) => r.data),
    [],
  );

  const destination = data?.destination;
  const metrics = data?.metrics;

  const handleOpenStatusModal = () => {
    if (!destination) return;
    setOperationalStatus(destination.operationalStatus === 'temporarily_closed' ? 'temporarily_closed' : 'active');
    setSpecialNotice(destination.reviewNote || '');
    setIsStatusModalOpen(true);
  };

  const handleSaveOperationalStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingStatus(true);
    try {
      await api.patch('/admin/partner/destination/status', {
        operationalStatus,
        specialNotice: specialNotice.trim(),
      });
      toast.success('Đã cập nhật trạng thái vận hành KDL thành công!');
      setIsStatusModalOpen(false);
      reload();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Không thể cập nhật trạng thái vận hành.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleCreateChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    const validOptions = options.map((o) => o.trim()).filter(Boolean);
    if (validOptions.length < 2) {
      toast.error('Vui lòng nhập ít nhất 2 phương án trả lời.');
      return;
    }
    if (!questionPrompt.trim()) {
      toast.error('Vui lòng nhập câu hỏi trắc nghiệm.');
      return;
    }

    setIsSubmittingChallenge(true);
    try {
      await api.post('/admin/partner/challenges', {
        title: challengeTitle.trim(),
        description: challengeDescription.trim() || undefined,
        rewardPoints: challengePoints,
        questions: [
          {
            prompt: questionPrompt.trim(),
            options: validOptions,
            correctOptionIndex: correctIndex,
            explanation: questionExplanation.trim() || undefined,
          },
        ],
      });
      toast.success('Đã tạo thử thách văn hóa cho KDL thành công!');
      setIsChallengeModalOpen(false);
      setChallengeTitle('');
      setChallengeDescription('');
      setQuestionPrompt('');
      setOptions(['', '', '', '']);
      setQuestionExplanation('');
      reload();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Không thể tạo thử thách.');
    } finally {
      setIsSubmittingChallenge(false);
    }
  };

  const handleCreateQr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qrLabel.trim()) {
      toast.error('Vui lòng nhập tên nhãn vị trí đặt mã QR.');
      return;
    }

    setIsSubmittingQr(true);
    try {
      await api.post('/admin/partner/qr', {
        label: qrLabel.trim(),
        targetType: qrTargetType,
        challengeId: qrTargetType === 'challenge' ? qrChallengeId : undefined,
      });
      toast.success('Đã tạo mã QR mới cho KDL thành công!');
      setIsQrModalOpen(false);
      setQrLabel('');
      reload();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Không thể tạo mã QR.');
    } finally {
      setIsSubmittingQr(false);
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

  const primaryImage = destination.images?.[0]?.url || 'https://images.unsplash.com/photo-1596401057633-54a8fe8ef647?auto=format&fit=crop&w=1200&q=80';
  const isOpen = destination.operationalStatus === 'active';

  return (
    <>
      <AdminPageHeader
        title="Trung Tâm Điều Hành Khu Du Lịch"
        description="Toàn quyền quản lý trải nghiệm, vận hành, câu đố văn hóa, mã QR và chăm sóc khách hàng của điểm đến."
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant={isOpen ? 'primary' : 'danger'}
              size="sm"
              onClick={handleOpenStatusModal}
              icon={<Clock className="size-4" />}
            >
              {isOpen ? '🟢 Đang đón khách (Bấm đổi)' : '🟠 Đang tạm nghỉ (Bấm mở)'}
            </Button>
            <ButtonLink
              to={`/destinations/${destination.slug}`}
              target="_blank"
              variant="secondary"
              size="sm"
              icon={<ExternalLink className="size-4" />}
            >
              Xem trang du khách
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

        <div className="relative z-10 p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
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
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">{destination.name}</h1>
            <p className="text-sm text-sand-200 line-clamp-2 leading-relaxed">
              {destination.summary || destination.description}
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-sand-300">
              {destination.address && (
                <span className="flex items-center gap-1">
                  <MapPin className="size-3.5 text-leaf-400" />
                  {destination.address}
                </span>
              )}
              {destination.openingHours && (
                <span className="flex items-center gap-1">
                  <Clock className="size-3.5 text-teal-400" />
                  {destination.openingHours}
                </span>
              )}
              {destination.contactInfo?.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="size-3.5 text-amber-400" />
                  {destination.contactInfo.phone}
                </span>
              )}
            </div>

            {destination.reviewNote && (
              <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-amber-500/20 px-3.5 py-1.5 text-xs text-amber-200 ring-1 ring-amber-400/30">
                <AlertCircle className="size-4 shrink-0 text-amber-400" />
                <span>
                  <strong>Thông báo Ban Quản lý:</strong> {destination.reviewNote}
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
                const qr = data?.qrs?.[0];
                if (qr) setStandeeQr(qr);
                else toast.info('Chưa có mã QR nào. Bạn hãy bấm tab "Mã QR" để tạo mới!');
              }}
              icon={<Printer className="size-4" />}
            >
              In Standee quầy vé
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Lượt du khách quan tâm"
          value={metrics?.totalViews ?? 0}
          hint="Tổng số lượt xem trang KDL"
          icon={<Eye className="size-5 text-leaf-600" />}
        />
        <StatCard
          label="Lượt Check-in thực địa"
          value={metrics?.totalCheckIns ?? 0}
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
          value={metrics?.totalCompletedChallenges ?? 0}
          hint={`${metrics?.totalChallenges ?? 0} thử thách văn hóa đang mở`}
          icon={<Trophy className="size-5 text-lotus-600" />}
        />
      </div>

      {/* Navigation Tabs */}
      <div className="mt-8 flex flex-wrap items-center gap-2 border-b border-sand-300 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('summary')}
          className={clsx(
            'flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-semibold transition-colors',
            activeTab === 'summary'
              ? 'border-b-2 border-leaf-600 bg-white text-leaf-800 shadow-xs'
              : 'text-river-600 hover:text-river-900',
          )}
        >
          <FileSpreadsheet className="size-4" />
          Bảng tổng hợp dữ liệu KDL
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={clsx(
            'flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-semibold transition-colors',
            activeTab === 'overview'
              ? 'border-b-2 border-leaf-600 bg-white text-leaf-800 shadow-xs'
              : 'text-river-600 hover:text-river-900',
          )}
        >
          <Sparkles className="size-4" />
          Dòng khách & Đánh giá gần đây
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('challenges')}
          className={clsx(
            'flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-semibold transition-colors',
            activeTab === 'challenges'
              ? 'border-b-2 border-leaf-600 bg-white text-leaf-800 shadow-xs'
              : 'text-river-600 hover:text-river-900',
          )}
        >
          <Trophy className="size-4" />
          Thử thách & Trò chơi KDL ({data?.challenges?.length || 0})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('qr')}
          className={clsx(
            'flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-semibold transition-colors',
            activeTab === 'qr'
              ? 'border-b-2 border-leaf-600 bg-white text-leaf-800 shadow-xs'
              : 'text-river-600 hover:text-river-900',
          )}
        >
          <QrCode className="size-4" />
          Mã QR & Bộ In Standee ({data?.qrs?.length || 0})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('operations')}
          className={clsx(
            'flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-semibold transition-colors',
            activeTab === 'operations'
              ? 'border-b-2 border-leaf-600 bg-white text-leaf-800 shadow-xs'
              : 'text-river-600 hover:text-river-900',
          )}
        >
          <Clock className="size-4" />
          Thông tin Vận hành & Dịch vụ
        </button>
      </div>

      {/* Tab 0: Bảng tổng hợp dữ liệu tổng quát của địa điểm đối tác */}
      {activeTab === 'summary' && (
        <div className="mt-6 space-y-6">
          <Card className="overflow-hidden border border-sand-300 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-sand-200 bg-gradient-to-r from-leaf-900 via-leaf-800 to-river-900 px-6 py-4 text-white">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-white/10 text-teal-300 shadow-inner">
                  <FileSpreadsheet className="size-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Bảng Tổng Hợp Dữ Liệu & Chỉ Số Tổng Quát Địa Điểm
                  </h3>
                  <p className="text-xs text-sand-200">
                    Báo cáo toàn cảnh các thông số vận hành, tiếp đón và tương tác số của {destination.name}
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
                <ButtonLink
                  to={`/destinations/${destination.slug}`}
                  target="_blank"
                  variant="secondary"
                  size="sm"
                  icon={<ExternalLink className="size-4" />}
                >
                  Xem trang du khách
                </ButtonLink>
              </div>
            </div>

            {/* Comprehensive Data Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-sand-200 bg-sand-100/70 text-xs font-bold uppercase tracking-wider text-river-700">
                    <th className="py-3 px-4 w-1/4">Danh mục thông số</th>
                    <th className="py-3 px-4 w-2/5">Dữ liệu thực tế</th>
                    <th className="py-3 px-4 w-1/5">Tình trạng / Đánh giá</th>
                    <th className="py-3 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand-200 text-river-900">
                  {/* Nhóm 1: Thông tin định danh */}
                  <tr className="bg-sand-50/50 font-bold text-xs uppercase text-river-500">
                    <td colSpan={4} className="py-2.5 px-4 flex items-center gap-1.5">
                      <Layers className="size-3.5 text-leaf-600" /> 1. Hồ sơ định danh & Vị trí thực địa
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-medium text-river-600">Tên điểm du lịch</td>
                    <td className="py-3 px-4 font-bold text-river-900">{destination.name}</td>
                    <td className="py-3 px-4">
                      <Badge tone="leaf">{categoryLabel(destination.category as never)}</Badge>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-xs text-river-500 font-mono">slug: {destination.slug}</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-medium text-river-600">Địa bàn hành chính</td>
                    <td className="py-3 px-4">{areaLabel(destination.area as never)}, Tỉnh Đồng Tháp</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 text-xs text-river-600">
                        <CheckCircle2 className="size-3.5 text-leaf-600" /> Thuộc bản đồ số DTST
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <ButtonLink to={`/admin/destinations/${destination.id}/edit`} variant="ghost" size="sm">
                        Đổi khu vực
                      </ButtonLink>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-medium text-river-600">Địa chỉ thực tế</td>
                    <td className="py-3 px-4">{destination.address || <span className="italic text-river-400">Chưa cập nhật địa chỉ</span>}</td>
                    <td className="py-3 px-4">
                      {destination.address ? (
                        <span className="inline-flex items-center gap-1 text-xs text-leaf-700 font-medium">
                          <CheckCircle2 className="size-3.5" /> Có địa chỉ
                        </span>
                      ) : (
                        <span className="text-xs text-amber-600">Cần bổ sung</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <ButtonLink to={`/admin/destinations/${destination.id}/edit`} variant="ghost" size="sm">
                        Sửa
                      </ButtonLink>
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
                          <CheckCircle2 className="size-3.5" /> Bán kính Geofence 500m
                        </span>
                      ) : (
                        <span className="text-xs text-amber-700 font-medium">Không thể check-in GPS</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {destination.coordinates ? (
                        <a
                          href={`https://maps.google.com/?q=${destination.coordinates.lat},${destination.coordinates.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-semibold text-leaf-700 hover:underline inline-flex items-center gap-1"
                        >
                          <ExternalLink className="size-3" /> Mở Map
                        </a>
                      ) : (
                        <ButtonLink to={`/admin/destinations/${destination.id}/edit`} variant="ghost" size="sm">
                          Chấm map
                        </ButtonLink>
                      )}
                    </td>
                  </tr>

                  {/* Nhóm 2: Vận hành & Dịch vụ */}
                  <tr className="bg-sand-50/50 font-bold text-xs uppercase text-river-500">
                    <td colSpan={4} className="py-2.5 px-4 flex items-center gap-1.5">
                      <Clock className="size-3.5 text-teal-600" /> 2. Tình trạng Vận hành & Dịch vụ đón khách
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-medium text-river-600">Trạng thái đón khách</td>
                    <td className="py-3 px-4">
                      <span
                        className={clsx(
                          'inline-flex items-center gap-1.5 rounded-pill px-2.5 py-0.5 text-xs font-bold',
                          isOpen ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800',
                        )}
                      >
                        <span className={clsx('size-2 rounded-full', isOpen ? 'bg-emerald-500' : 'bg-amber-500')} />
                        {isOpen ? 'Đang mở cửa đón khách' : 'Tạm ngưng đón khách / Bảo trì'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs text-river-600">Thời gian thực (Realtime)</span>
                    </td>
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
                    <td className="py-3 px-4 font-medium text-river-600">Giờ mở cửa đón khách</td>
                    <td className="py-3 px-4">{destination.openingHours || <span className="italic text-river-400">Chưa thiết lập</span>}</td>
                    <td className="py-3 px-4">
                      <span className="text-xs text-river-600">Khung giờ tiếp khách</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <ButtonLink to={`/admin/destinations/${destination.id}/edit`} variant="ghost" size="sm">
                        Cập nhật
                      </ButtonLink>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-medium text-river-600">Giá vé tham khảo niêm yết</td>
                    <td className="py-3 px-4">{destination.referencePrice || <span className="italic text-river-400">Miễn phí vé vào cổng</span>}</td>
                    <td className="py-3 px-4">
                      <span className="text-xs text-river-600">Đã công khai trên app</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <ButtonLink to={`/admin/destinations/${destination.id}/edit`} variant="ghost" size="sm">
                        Sửa giá
                      </ButtonLink>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-medium text-river-600">Thời lượng tham quan khuyến nghị</td>
                    <td className="py-3 px-4">
                      {destination.durationMinutes ? `${destination.durationMinutes} phút` : <span className="italic text-river-400">120 phút (Mặc định)</span>}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs text-river-600">AI Trip Planner V9 tối ưu</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <ButtonLink to={`/admin/destinations/${destination.id}/edit`} variant="ghost" size="sm">
                        Chỉnh sửa
                      </ButtonLink>
                    </td>
                  </tr>
                  {destination.reviewNote && (
                    <tr className="bg-amber-50/60">
                      <td className="py-3 px-4 font-medium text-amber-800">Thông báo đặc biệt của BQL</td>
                      <td className="py-3 px-4 text-amber-900 font-medium" colSpan={2}>
                        {destination.reviewNote}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={handleOpenStatusModal}
                          className="text-xs font-semibold text-amber-800 hover:underline"
                        >
                          Sửa thông báo
                        </button>
                      </td>
                    </tr>
                  )}

                  {/* Nhóm 3: Kênh Liên Lạc & Tài Nguyên */}
                  <tr className="bg-sand-50/50 font-bold text-xs uppercase text-river-500">
                    <td colSpan={4} className="py-2.5 px-4 flex items-center gap-1.5">
                      <Globe className="size-3.5 text-blue-600" /> 3. Kênh Liên Lạc & Tài Nguyên Số
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-medium text-river-600">Hotline hỗ trợ du khách</td>
                    <td className="py-3 px-4 font-mono">{destination.contactInfo?.phone || <span className="italic text-river-400">Chưa có SĐT</span>}</td>
                    <td className="py-3 px-4">
                      {destination.contactInfo?.phone ? (
                        <span className="inline-flex items-center gap-1 text-xs text-leaf-700">
                          <CheckCircle2 className="size-3.5" /> Hoạt động
                        </span>
                      ) : (
                        <span className="text-xs text-amber-600">Chưa điền</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <ButtonLink to={`/admin/destinations/${destination.id}/edit`} variant="ghost" size="sm">
                        Sửa
                      </ButtonLink>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-medium text-river-600">Hòm thư điện tử (Email)</td>
                    <td className="py-3 px-4 font-mono text-xs">{destination.contactInfo?.email || <span className="italic text-river-400">Chưa có email</span>}</td>
                    <td className="py-3 px-4">
                      <span className="text-xs text-river-600">Tiếp nhận khiếu nại</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <ButtonLink to={`/admin/destinations/${destination.id}/edit`} variant="ghost" size="sm">
                        Sửa
                      </ButtonLink>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-medium text-river-600">Thư viện hình ảnh thực tế</td>
                    <td className="py-3 px-4 font-bold text-river-900">
                      {destination.images?.length || 0} ảnh chất lượng cao
                    </td>
                    <td className="py-3 px-4">
                      {(destination.images?.length || 0) >= 3 ? (
                        <span className="inline-flex items-center gap-1 text-xs text-leaf-700 font-medium">
                          <CheckCircle2 className="size-3.5" /> Đạt chuẩn hiển thị
                        </span>
                      ) : (
                        <span className="text-xs text-amber-700 font-medium">Nên tải thêm ảnh</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <ButtonLink to={`/admin/destinations/${destination.id}/edit`} variant="ghost" size="sm">
                        Tải ảnh lên
                      </ButtonLink>
                    </td>
                  </tr>

                  {/* Nhóm 4: Hiệu Suất Tương Tác Số */}
                  <tr className="bg-sand-50/50 font-bold text-xs uppercase text-river-500">
                    <td colSpan={4} className="py-2.5 px-4 flex items-center gap-1.5">
                      <ShieldCheck className="size-3.5 text-lotus-600" /> 4. Chỉ Số Hiệu Suất Tương Tác Số (KPIs & CSAT)
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-medium text-river-600">Lượt xem trang du khách</td>
                    <td className="py-3 px-4 font-bold text-base text-leaf-700">
                      {(metrics?.totalViews ?? 0).toLocaleString()} lượt
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs text-river-600">Tương tác trực tuyến</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <ButtonLink to={`/destinations/${destination.slug}`} target="_blank" variant="ghost" size="sm">
                        Xem trang
                      </ButtonLink>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-medium text-river-600">Lượt khách Check-in thực tế</td>
                    <td className="py-3 px-4 font-bold text-base text-teal-700">
                      {(metrics?.totalCheckIns ?? 0).toLocaleString()} lượt check-in
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs text-teal-700 font-semibold">Khách thực địa tại KDL</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setActiveTab('overview')}
                        className="text-xs font-semibold text-leaf-700 hover:underline"
                      >
                        Xem dòng khách
                      </button>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-medium text-river-600">Mức độ hài lòng du khách (CSAT)</td>
                    <td className="py-3 px-4 font-bold text-base text-amber-600">
                      ★ {metrics?.averageRating ?? 5.0} / 5.0
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs text-river-600">
                        {metrics?.totalReviews ?? 0} đánh giá ({metrics?.respondedReviews ?? 0} đã phản hồi)
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <ButtonLink to="/admin/reviews" variant="ghost" size="sm">
                        Quản trị đánh giá
                      </ButtonLink>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-medium text-river-600">Trạm mã QR & Standee</td>
                    <td className="py-3 px-4 font-bold text-river-900">
                      {data?.qrs?.length || 0} mã QR đang hoạt động
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs text-river-600">Đặt tại quầy vé & tiểu cảnh</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setActiveTab('qr')}
                        className="text-xs font-semibold text-leaf-700 hover:underline"
                      >
                        Quản lý QR
                      </button>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-medium text-river-600">Thử thách & Trò chơi văn hóa</td>
                    <td className="py-3 px-4 font-bold text-river-900">
                      {data?.challenges?.length || 0} thử thách ({metrics?.totalCompletedChallenges ?? 0} lượt giải đúng)
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs text-teal-700 font-medium">Gamification tương tác</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setActiveTab('challenges')}
                        className="text-xs font-semibold text-leaf-700 hover:underline"
                      >
                        Quản lý thử thách
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Tab 1: Overview & Visitors */}
      {activeTab === 'overview' && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* Recent Check-ins */}
          <Card className="p-5 sm:p-6">
            <div className="flex items-center justify-between border-b border-sand-200 pb-3">
              <h3 className="font-bold text-river-900 flex items-center gap-2">
                <MapPin className="size-4 text-leaf-600" />
                Khách du lịch vừa Check-in tại KDL
              </h3>
              <Badge tone="leaf">{data?.recentCheckIns?.length || 0} lượt gần nhất</Badge>
            </div>

            {data?.recentCheckIns && data.recentCheckIns.length > 0 ? (
              <ul className="mt-4 divide-y divide-sand-200">
                {data.recentCheckIns.map((item) => (
                  <li key={item.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 items-center justify-center rounded-full bg-leaf-50 text-leaf-700 font-bold text-xs ring-1 ring-leaf-200">
                        {item.visitorName.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-river-900">{item.visitorName}</p>
                        <p className="text-xs text-river-500">
                          {item.source === 'gps' ? '📍 Check-in GPS Thực tế' : '📱 Quét QR tại Điểm'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-leaf-700">+{item.scoreAwarded} EXP</span>
                      <p className="text-[11px] text-river-400">{formatDateTime(item.completedAt)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-river-500 italic">Chưa có lượt check-in nào trong thời gian gần đây.</p>
            )}
          </Card>

          {/* Recent Reviews */}
          <Card className="p-5 sm:p-6">
            <div className="flex items-center justify-between border-b border-sand-200 pb-3">
              <h3 className="font-bold text-river-900 flex items-center gap-2">
                <MessageSquare className="size-4 text-amber-500" />
                Đánh giá mới nhất từ du khách
              </h3>
              <ButtonLink to="/admin/reviews" size="sm" variant="secondary" icon={<ExternalLink className="size-3.5" />}>
                Xem tất cả ({metrics?.totalReviews})
              </ButtonLink>
            </div>

            {data?.recentReviews && data.recentReviews.length > 0 ? (
              <div className="mt-4 space-y-3">
                {data.recentReviews.map((r) => (
                  <div key={r.id} className="rounded-lg border border-sand-200 bg-sand-50/50 p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm text-river-900">{r.authorName}</span>
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={clsx(
                              'size-3',
                              star <= r.rating ? 'fill-amber-400 text-amber-500' : 'fill-sand-200 text-sand-300',
                            )}
                          />
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-river-700 line-clamp-2 italic">"{r.content}"</p>
                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-sand-200/60">
                      <span className="text-river-400">{formatDate(r.createdAt)}</span>
                      {r.hasResponse ? (
                        <span className="text-teal-700 font-medium">✓ Đã phản hồi</span>
                      ) : (
                        <Link to="/admin/reviews" className="text-leaf-700 font-semibold hover:underline">
                          + Trả lời ngay
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-river-500 italic">Chưa có đánh giá nào cho điểm đến này.</p>
            )}
          </Card>
        </div>
      )}

      {/* Tab 2: Challenges Management */}
      {activeTab === 'challenges' && (
        <Card className="mt-6 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sand-200 pb-4">
            <div>
              <h3 className="font-bold text-lg text-river-900">Thử thách & Trò chơi văn hóa tại KDL</h3>
              <p className="text-xs text-river-600">
                Tạo các câu đố văn hóa, lịch sử và nét độc đáo của {destination.name} để du khách tham gia nhận thưởng khi đến tham quan.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsChallengeModalOpen(true)}
              icon={<Plus className="size-4" />}
            >
              Tạo thử thách mới
            </Button>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data?.challenges && data.challenges.length > 0 ? (
              data.challenges.map((c) => (
                <div key={c.id} className="rounded-xl border border-sand-200 bg-white p-4 space-y-3 shadow-xs">
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                      <Trophy className="size-5" />
                    </span>
                    <Badge tone={c.status === 'active' ? 'leaf' : 'neutral'}>
                      {c.status === 'active' ? 'Đang mở' : 'Tạm dừng'}
                    </Badge>
                  </div>
                  <div>
                    <h4 className="font-bold text-river-900">{c.title}</h4>
                    {c.description && <p className="mt-1 text-xs text-river-600 line-clamp-2">{c.description}</p>}
                  </div>
                  <div className="flex items-center justify-between text-xs text-river-500 pt-2 border-t border-sand-200">
                    <span>{c.questionCount} câu hỏi</span>
                    <span className="font-bold text-teal-700">+{c.rewardPoints} EXP</span>
                    <span>{c.completions} lượt giải đúng</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full py-8 text-center border border-dashed rounded-xl border-sand-300">
                <Trophy className="size-10 mx-auto text-river-400 mb-2" />
                <p className="text-sm font-semibold text-river-700">Chưa có thử thách nào</p>
                <p className="text-xs text-river-500 mt-1">
                  Hãy bấm "Tạo thử thách mới" để tạo trò chơi trắc nghiệm văn hóa cho du khách ghé thăm!
                </p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Tab 3: QR Codes & Standee Print Kit */}
      {activeTab === 'qr' && (
        <Card className="mt-6 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sand-200 pb-4">
            <div>
              <h3 className="font-bold text-lg text-river-900">Mã QR & Bộ Standee In Ấn Trưng Bày</h3>
              <p className="text-xs text-river-600">
                Tạo mã QR và in Standee chất lượng cao chuẩn A4/A5 để đặt tại cổng vé, quầy lễ tân hoặc các khu tiểu cảnh.
              </p>
            </div>
            <Button variant="primary" size="sm" onClick={() => setIsQrModalOpen(true)} icon={<Plus className="size-4" />}>
              Tạo mã QR mới
            </Button>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data?.qrs && data.qrs.length > 0 ? (
              data.qrs.map((qr) => (
                <div key={qr.id} className="rounded-xl border border-sand-200 bg-white p-4 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-sm bg-sand-100 text-river-900 px-2 py-0.5 rounded">
                      {qr.code}
                    </span>
                    <Badge tone="leaf">{qr.targetType === 'destination' ? 'Điểm danh KDL' : 'Thử thách'}</Badge>
                  </div>
                  <h4 className="font-bold text-river-900 text-sm">{qr.label}</h4>
                  <div className="pt-2 border-t border-sand-200 flex items-center justify-between">
                    <span className="text-xs text-river-400">{formatDate(qr.createdAt)}</span>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setStandeeQr(qr)}
                      icon={<Printer className="size-3.5" />}
                    >
                      In Standee
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full py-8 text-center border border-dashed rounded-xl border-sand-300">
                <QrCode className="size-10 mx-auto text-river-400 mb-2" />
                <p className="text-sm font-semibold text-river-700">Chưa có mã QR nào</p>
                <p className="text-xs text-river-500 mt-1">
                  Hãy bấm "Tạo mã QR mới" để tạo mã check-in nhận điểm cho du khách!
                </p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Tab 4: Operational Settings */}
      {activeTab === 'operations' && (
        <Card className="mt-6 p-5 sm:p-6 space-y-6">
          <div className="border-b border-sand-200 pb-4">
            <h3 className="font-bold text-lg text-river-900">Thông tin Vận hành & Dịch vụ KDL</h3>
            <p className="text-xs text-river-600">
              Kiểm tra và quản lý các thông tin thực tế của điểm đến do bạn phụ trách.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-sand-200 p-4 bg-sand-50/50 space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-river-500 flex items-center gap-1.5">
                <Clock className="size-4 text-leaf-600" /> Giờ đón khách
              </span>
              <p className="text-sm font-semibold text-river-900">{destination.openingHours || 'Chưa cập nhật'}</p>
            </div>

            <div className="rounded-xl border border-sand-200 p-4 bg-sand-50/50 space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-river-500 flex items-center gap-1.5">
                <Ticket className="size-4 text-amber-500" /> Giá vé tham quan
              </span>
              <p className="text-sm font-semibold text-river-900">{destination.referencePrice || 'Miễn phí vé vào cổng'}</p>
            </div>

            <div className="rounded-xl border border-sand-200 p-4 bg-sand-50/50 space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-river-500 flex items-center gap-1.5">
                <Phone className="size-4 text-teal-600" /> Hotline liên hệ
              </span>
              <p className="text-sm font-semibold text-river-900">{destination.contactInfo?.phone || 'Chưa cập nhật'}</p>
            </div>

            <div className="rounded-xl border border-sand-200 p-4 bg-sand-50/50 space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-river-500 flex items-center gap-1.5">
                <MapPin className="size-4 text-lotus-600" /> Tọa độ GPS thực địa
              </span>
              <p className="text-sm font-mono text-river-900">
                {destination.coordinates ? `${destination.coordinates.lat}, ${destination.coordinates.lng}` : 'Chưa định vị'}
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <ButtonLink
              to={`/admin/destinations/${destination.id}/edit`}
              variant="primary"
              icon={<PenLine className="size-4" />}
            >
              Chỉnh sửa thông tin chi tiết
            </ButtonLink>
          </div>
        </Card>
      )}

      {/* Modal 1: Bật/Tắt đón khách & Thông báo khẩn */}
      <Modal
        open={isStatusModalOpen}
        title="Quản lý Trạng thái Vận hành & Đón khách"
        onClose={() => setIsStatusModalOpen(false)}
      >
        <form onSubmit={handleSaveOperationalStatus} className="p-5 space-y-4">
          <p className="text-xs text-river-600">
            Bạn có toàn quyền thay đổi trạng thái mở cửa của {destination.name} ngay lập tức mà không cần chờ Admin phê duyệt.
          </p>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-river-600 mb-2">
              Trạng thái đón khách thực tế *
            </label>
            <div className="grid grid-cols-2 gap-3">
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
                  name="status"
                  checked={operationalStatus === 'active'}
                  onChange={() => setOperationalStatus('active')}
                  className="text-leaf-600 focus:ring-leaf-500"
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
                  name="status"
                  checked={operationalStatus === 'temporarily_closed'}
                  onChange={() => setOperationalStatus('temporarily_closed')}
                  className="text-amber-600 focus:ring-amber-500"
                />
                <div>
                  <p className="text-sm font-bold text-river-900">🟠 Tạm đóng cửa</p>
                  <p className="text-xs text-river-500">Bảo trì / Tạm nghỉ</p>
                </div>
              </label>
            </div>
          </div>

          <div>
            <label htmlFor="special-notice" className="block text-xs font-semibold uppercase tracking-wider text-river-600">
              Thông báo nóng từ Ban Quản lý (Hiện trên trang du khách)
            </label>
            <textarea
              id="special-notice"
              rows={3}
              value={specialNotice}
              onChange={(e) => setSpecialNotice(e.target.value)}
              placeholder="Ví dụ: KDL đang vào mùa hoa nở rộ đẹp nhất, có ưu đãi 20% cho đoàn khách trên 10 người..."
              className="mt-1 block w-full rounded-control border border-sand-200 bg-white p-3 text-sm text-river-800 placeholder:text-river-400 focus:border-leaf-600 focus:outline-none focus:ring-1 focus:ring-leaf-600"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-sand-200">
            <Button type="button" variant="secondary" onClick={() => setIsStatusModalOpen(false)}>
              Hủy
            </Button>
            <Button type="submit" variant="primary" loading={isUpdatingStatus} icon={<CheckCircle2 className="size-4" />}>
              Lưu & Áp dụng ngay
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal 2: Tạo thử thách mới */}
      <Modal
        open={isChallengeModalOpen}
        title="Tạo Thử Thách & Câu Đố Văn Hóa KDL"
        onClose={() => setIsChallengeModalOpen(false)}
      >
        <form onSubmit={handleCreateChallenge} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          <div>
            <label htmlFor="ch-title" className="block text-xs font-semibold uppercase tracking-wider text-river-600">
              Tiêu đề thử thách *
            </label>
            <Input
              id="ch-title"
              type="text"
              value={challengeTitle}
              onChange={(e) => setChallengeTitle(e.target.value)}
              placeholder="Ví dụ: Giải đố bí mật Làng hoa trăm năm Sa Đéc"
              className="mt-1"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="ch-points" className="block text-xs font-semibold uppercase tracking-wider text-river-600">
                Điểm thưởng EXP *
              </label>
              <Input
                id="ch-points"
                type="number"
                min={10}
                max={200}
                value={challengePoints}
                onChange={(e) => setChallengePoints(Number(e.target.value))}
                className="mt-1"
                required
              />
            </div>
            <div>
              <label htmlFor="ch-desc" className="block text-xs font-semibold uppercase tracking-wider text-river-600">
                Mô tả ngắn
              </label>
              <Input
                id="ch-desc"
                type="text"
                value={challengeDescription}
                onChange={(e) => setChallengeDescription(e.target.value)}
                placeholder="Khám phá các loài hoa quý..."
                className="mt-1"
              />
            </div>
          </div>

          <div className="rounded-xl border border-sand-300 p-4 bg-sand-50 space-y-3">
            <h4 className="font-bold text-sm text-river-900">Câu hỏi trắc nghiệm</h4>
            <div>
              <label htmlFor="q-prompt" className="block text-xs font-semibold text-river-700">
                Nội dung câu hỏi *
              </label>
              <textarea
                id="q-prompt"
                rows={2}
                value={questionPrompt}
                onChange={(e) => setQuestionPrompt(e.target.value)}
                placeholder="Làng hoa Sa Đéc có truyền thống trồng hoa trên giàn cao bắt đầu từ đặc điểm tự nhiên nào?"
                className="mt-1 block w-full rounded-control border border-sand-200 bg-white p-2.5 text-xs text-river-800 focus:border-leaf-600 focus:outline-none"
                required
              />
            </div>

            <div className="space-y-2">
              <span className="block text-xs font-semibold text-river-700">Các phương án lựa chọn (Chọn đáp án đúng):</span>
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="correct-opt"
                    checked={correctIndex === i}
                    onChange={() => setCorrectIndex(i)}
                    className="text-leaf-600 focus:ring-leaf-500"
                    title={`Chọn phương án ${i + 1} là đáp án đúng`}
                  />
                  <Input
                    type="text"
                    value={opt}
                    onChange={(e) => {
                      const next = [...options];
                      next[i] = e.target.value;
                      setOptions(next);
                    }}
                    placeholder={`Phương án ${String.fromCharCode(65 + i)}`}
                    className="flex-1 text-xs"
                    required={i < 2}
                  />
                </div>
              ))}
            </div>

            <div>
              <label htmlFor="q-expl" className="block text-xs font-semibold text-river-700">
                Lời giải thích lịch sử sau khi trả lời
              </label>
              <Input
                id="q-expl"
                type="text"
                value={questionExplanation}
                onChange={(e) => setQuestionExplanation(e.target.value)}
                placeholder="Người dân trồng hoa trên giàn để tránh mùa nước lũ dâng ngập..."
                className="mt-1 text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-sand-200">
            <Button type="button" variant="secondary" onClick={() => setIsChallengeModalOpen(false)}>
              Hủy
            </Button>
            <Button type="submit" variant="primary" loading={isSubmittingChallenge} icon={<Plus className="size-4" />}>
              Tạo thử thách
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal 3: Tạo mã QR mới */}
      <Modal open={isQrModalOpen} title="Tạo Mã QR Check-in Điểm Đến" onClose={() => setIsQrModalOpen(false)}>
        <form onSubmit={handleCreateQr} className="p-5 space-y-4">
          <div>
            <label htmlFor="qr-label" className="block text-xs font-semibold uppercase tracking-wider text-river-600">
              Tên nhãn vị trí đặt QR *
            </label>
            <Input
              id="qr-label"
              type="text"
              value={qrLabel}
              onChange={(e) => setQrLabel(e.target.value)}
              placeholder="Ví dụ: Cổng chính quầy vé, Khu vườn hoa mẫu đơn, Cầu ngắm hoa..."
              className="mt-1"
              required
            />
          </div>

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
              <option value="destination">📍 Điểm danh Check-in nhận điểm thẻ du khách</option>
              <option value="challenge">🏆 Mở câu đố thử thách văn hóa</option>
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

          <div className="flex justify-end gap-2 pt-2 border-t border-sand-200">
            <Button type="button" variant="secondary" onClick={() => setIsQrModalOpen(false)}>
              Hủy
            </Button>
            <Button type="submit" variant="primary" loading={isSubmittingQr} icon={<QrCode className="size-4" />}>
              Tạo mã QR
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal 4: BỘ STANDEE IN ẤN ĐẶT QUẦY VÉ CHUẨN A4/A5 */}
      <Modal open={Boolean(standeeQr)} title="Bản Thiết Kế Standee Trưng Bày Đất Sen Hồng" onClose={() => setStandeeQr(null)}>
        {standeeQr && (
          <div className="p-5 space-y-4">
            <p className="text-xs text-river-600">
              Bản thiết kế chuẩn để in ra giấy A4/A5 hoặc ép mica đặt tại quầy vé, cổng chào để du khách quét mã.
            </p>

            {/* Print Container with printable layout */}
            <div
              id="standee-printable"
              className="mx-auto w-full max-w-sm rounded-2xl border-4 border-leaf-700 bg-gradient-to-b from-white via-sand-50/50 to-leaf-50/30 p-6 text-center shadow-lg relative overflow-hidden"
            >
              {/* Lotus Watermark */}
              <div className="absolute -top-12 -right-12 size-36 rounded-full bg-lotus-500/10 pointer-events-none blur-2xl" />
              <div className="absolute -bottom-12 -left-12 size-36 rounded-full bg-leaf-500/10 pointer-events-none blur-2xl" />

              {/* Header Header */}
              <div className="space-y-1 border-b-2 border-leaf-600/30 pb-3">
                <span className="text-[10px] font-bold tracking-widest text-leaf-800 uppercase">
                  SỞ VĂN HÓA, THỂ THAO & DU LỊCH ĐỒNG THÁP
                </span>
                <h3 className="text-base font-black tracking-tight text-river-900 uppercase">
                  ĐỒNG THÁP SMART TRAVEL
                </h3>
              </div>

              {/* Destination badge */}
              <div className="my-3">
                <span className="inline-block rounded-full bg-leaf-700 px-4 py-1 text-xs font-bold text-white shadow-xs">
                  🌸 {destination.name}
                </span>
              </div>

              {/* Title & Call to action */}
              <h4 className="text-sm font-black text-river-900 uppercase tracking-tight">
                QUÉT MÃ ĐIỂM DANH & NHẬN ĐIỂM
              </h4>
              <p className="text-[11px] text-river-600 mt-0.5">
                Vị trí: <strong>{standeeQr.label}</strong>
              </p>

              {/* Big High-res QR Image */}
              <div className="my-4 inline-block rounded-2xl border-2 border-dashed border-leaf-600 bg-white p-3 shadow-inner">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                    `${window.location.origin}/qr/${standeeQr.code}`,
                  )}`}
                  alt={`Mã QR ${standeeQr.code}`}
                  className="size-44 object-contain mx-auto"
                />
              </div>

              <div className="font-mono text-sm font-black text-leaf-900 tracking-wider">
                {standeeQr.code}
              </div>

              {/* 3 Step Guide */}
              <div className="mt-4 rounded-xl bg-white/80 p-2.5 text-left text-[11px] space-y-1.5 border border-sand-200">
                <div className="flex items-center gap-2 text-river-800">
                  <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-leaf-700 text-white font-bold text-[9px]">
                    1
                  </span>
                  <span>Mở Zalo hoặc Camera điện thoại quét mã</span>
                </div>
                <div className="flex items-center gap-2 text-river-800">
                  <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-leaf-700 text-white font-bold text-[9px]">
                    2
                  </span>
                  <span>Điểm danh thực địa nhận điểm Hộ chiếu Sen Hồng</span>
                </div>
                <div className="flex items-center gap-2 text-river-800">
                  <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-leaf-700 text-white font-bold text-[9px]">
                    3
                  </span>
                  <span>Tham gia câu đố văn hóa nhận quà du lịch</span>
                </div>
              </div>

              <p className="mt-3 text-[9px] text-river-400 font-medium">
                © Bản quyền Hệ thống Du lịch Thông minh Tỉnh Đồng Tháp
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-sand-200">
              <Button variant="secondary" onClick={() => setStandeeQr(null)}>
                Đóng
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  window.print();
                }}
                icon={<Printer className="size-4" />}
              >
                In Standee ngay
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
