import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ArrowUpRight, Image as ImageIcon, Pencil, Plus, Power, Save, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { AdminPageHeader } from '../../components/layout/AdminLayout';
import { Badge, StatusBadge } from '../../components/ui/Badge';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { FormField, Input, Select, Textarea } from '../../components/ui/Field';
import { ConfirmDialog } from '../../components/ui/Modal';
import { Pagination } from '../../components/ui/Navigation';
import { EmptyState, ErrorState, Notice, PageLoader } from '../../components/ui/States';
import { useApiQuery } from '../../hooks/useApiQuery';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { api, applyFieldErrors, toApiError } from '../../lib/api';
import { formatDateTime, formatNumber } from '../../lib/format';
import { toast } from '../../stores/toastStore';
import type { AdminBanner, BannerKind, BannerTheme, Paginated } from '../../types/api';

const STATUS_LABELS = { active: 'Đang bật', inactive: 'Đã tắt' } as const;
const KIND_LABELS: Record<BannerKind, string> = { cover: 'Ảnh bìa', event: 'Sự kiện', promo: 'Quảng cáo' };
const THEME_LABELS: Record<BannerTheme, string> = { forest: 'Xanh rừng tràm', lotus: 'Hồng sen', cream: 'Sáng (kem)' };

function scheduleText(b: AdminBanner) {
  if (!b.startAt && !b.endAt) return 'Không giới hạn thời gian';
  const from = b.startAt ? formatDateTime(b.startAt) : '…';
  const to = b.endAt ? formatDateTime(b.endAt) : '…';
  return `${from} → ${to}`;
}

export function AdminBannersPage() {
  useDocumentTitle('Quản lý banner');
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<AdminBanner | null>(null);
  const query = useApiQuery(
    (signal) => api.get<Paginated<AdminBanner>>('/admin/banners', { params: { status: status || undefined, page, limit: 20 }, signal }).then((r) => r.data),
    [status, page],
  );
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: key !== 'page' });
  };

  const setStatus = async (b: AdminBanner, next: 'active' | 'inactive') => {
    setBusyId(b.id);
    try {
      await api.patch(`/admin/banners/${b.id}`, { status: next });
      toast.success(next === 'active' ? 'Đã bật banner' : 'Đã tắt banner');
      query.reload();
    } catch (error) {
      toast.error('Không cập nhật được', toApiError(error).message);
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (b: AdminBanner) => {
    setBusyId(b.id);
    try {
      await api.delete(`/admin/banners/${b.id}`);
      toast.success('Đã xóa banner');
      setToDelete(null);
      query.reload();
    } catch (error) {
      toast.error('Không xóa được', toApiError(error).message);
    } finally {
      setBusyId(null);
    }
  };

  const data = query.data;
  return (
    <>
      <AdminPageHeader
        title="Banner trang chủ"
        description="Ảnh bìa, sự kiện hoặc quảng cáo hiển thị ở đầu trang chủ. Banner quảng cáo luôn được gắn nhãn “Quảng cáo” và tên đơn vị tài trợ cho du khách."
        actions={<ButtonLink to="/admin/banners/new" icon={<Plus className="size-4" aria-hidden />}>Tạo banner</ButtonLink>}
      />
      <Card className="mb-4 grid gap-3 p-4 md:grid-cols-[220px_1fr] md:items-center">
        <Select aria-label="Lọc theo trạng thái" value={status} onChange={(e) => update('status', e.target.value)}>
          <option value="">Tất cả trạng thái</option>
          <option value="active">{STATUS_LABELS.active}</option>
          <option value="inactive">{STATUS_LABELS.inactive}</option>
        </Select>
        <p className="text-sm text-river-600">Banner hiển thị theo thứ tự tăng dần; tối đa 6 banner đang bật được đưa lên trang chủ.</p>
      </Card>

      {query.loading && !data ? (
        <PageLoader />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={query.reload} />
      ) : data && data.items.length === 0 ? (
        <EmptyState
          icon={<ImageIcon className="size-6" aria-hidden />}
          title="Chưa có banner nào"
          description="Khi chưa có banner đang bật, trang chủ sẽ bỏ qua khu vực này."
          action={<ButtonLink to="/admin/banners/new">Tạo banner</ButtonLink>}
        />
      ) : data ? (
        <>
          <ul className="space-y-3" aria-busy={query.loading}>
            {data.items.map((b) => (
              <li key={b.id}>
                <Card className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link to={`/admin/banners/${b.id}/edit`} className="font-semibold text-river-900 hover:text-leaf-700">
                        {b.title}
                      </Link>
                      <StatusBadge status={b.status} label={STATUS_LABELS[b.status]} />
                      <Badge tone={b.kind === 'promo' ? 'lotus' : 'neutral'}>{KIND_LABELS[b.kind]}</Badge>
                      {b.status === 'active' && !b.isLive && <Badge tone="teal">Ngoài lịch hiển thị</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-river-500">
                      Thứ tự {b.sortOrder} · {THEME_LABELS[b.theme]} · {scheduleText(b)}
                      {b.sponsorName && ` · Tài trợ: ${b.sponsorName}`}
                    </p>
                    <p className="mt-1 text-xs text-river-500">
                      {formatNumber(b.impressions)} lượt hiển thị · {formatNumber(b.clicks)} lượt nhấp
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <ButtonLink to={`/admin/banners/${b.id}/edit`} size="sm" variant="secondary" icon={<Pencil className="size-4" aria-hidden />}>
                      Sửa
                    </ButtonLink>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Power className="size-4" aria-hidden />}
                      loading={busyId === b.id}
                      onClick={() => setStatus(b, b.status === 'active' ? 'inactive' : 'active')}
                    >
                      {b.status === 'active' ? 'Tắt' : 'Bật'}
                    </Button>
                    <Button size="sm" variant="ghost" icon={<Trash2 className="size-4" aria-hidden />} onClick={() => setToDelete(b)}>
                      Xóa
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
          <div className="mt-6">
            <Pagination page={data.page} totalPages={data.totalPages} onChange={(p) => update('page', String(p))} />
          </div>
        </>
      ) : null}

      <ConfirmDialog
        open={Boolean(toDelete)}
        title={`Xóa banner “${toDelete?.title ?? ''}”?`}
        message="Banner sẽ bị gỡ khỏi trang chủ ngay lập tức và không thể khôi phục. Nếu chỉ muốn tạm ẩn, hãy dùng nút Tắt."
        confirmLabel="Xóa banner"
        tone="danger"
        loading={Boolean(toDelete && busyId === toDelete.id)}
        onConfirm={() => toDelete && remove(toDelete)}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}

const linkPattern = /^(https?:\/\/\S+|\/(?!\/)\S*)$/i;
const imagePattern = /^(https?:\/\/\S+|\/[a-zA-Z0-9/_.-]+)$/i;

const bannerFormShape = z
  .object({
    kind: z.enum(['cover', 'event', 'promo']),
    theme: z.enum(['forest', 'lotus', 'cream']),
    eyebrow: z.string().trim().max(60),
    title: z.string().trim().min(3, 'Tiêu đề cần ít nhất 3 ký tự').max(120),
    subtitle: z.string().trim().max(300),
    imageUrl: z.string().trim().max(500).refine((v) => v === '' || imagePattern.test(v), 'URL ảnh phải là http(s) hoặc đường dẫn bắt đầu bằng /'),
    imageAlt: z.string().trim().max(200),
    linkUrl: z.string().trim().max(500).refine((v) => v === '' || linkPattern.test(v), 'Liên kết phải là http(s) hoặc đường dẫn nội bộ bắt đầu bằng /'),
    linkLabel: z.string().trim().max(40),
    sponsorName: z.string().trim().max(120),
    status: z.enum(['active', 'inactive']),
    startAt: z.string(),
    endAt: z.string(),
    sortOrder: z.coerce.number().int().min(-1000).max(1000),
  });
const BANNER_FIELDS = Object.keys(bannerFormShape.shape) as Array<keyof z.infer<typeof bannerFormShape>>;
const bannerFormSchema = bannerFormShape
  .refine((v) => v.kind !== 'promo' || v.sponsorName.length > 0, { message: 'Banner quảng cáo cần ghi rõ đơn vị tài trợ', path: ['sponsorName'] })
  .refine((v) => !v.startAt || !v.endAt || new Date(v.startAt) <= new Date(v.endAt), { message: 'Ngày kết thúc phải sau ngày bắt đầu', path: ['endAt'] });
type BannerFormValues = z.infer<typeof bannerFormSchema>;

/** ISO string → value accepted by <input type="datetime-local"> in the viewer's local time. */
function toLocalInput(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toIsoOrNull(local: string) {
  return local ? new Date(local).toISOString() : null;
}

const PREVIEW_THEMES: Record<BannerTheme, string> = {
  forest: 'bg-leaf-800 text-white',
  lotus: 'bg-lotus-600 text-white',
  cream: 'bg-white text-river-900 ring-1 ring-sand-200',
};

function BannerPreview({ values }: { values: BannerFormValues }) {
  const isAd = values.kind === 'promo';
  return (
    <div className={`overflow-hidden rounded-card shadow-card ${PREVIEW_THEMES[values.theme]}`} aria-label="Xem trước banner">
      <div className="grid sm:grid-cols-[1.3fr_1fr]">
        <div className="p-5">
          <div className="flex flex-wrap items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.2em] opacity-80">
            {values.eyebrow && <span>{values.eyebrow}</span>}
            {isAd && <span className="rounded-full bg-white/15 px-2 py-0.5 ring-1 ring-white/20">Quảng cáo</span>}
          </div>
          <p className="mt-2 text-xl font-extrabold leading-tight">{values.title || 'Tiêu đề banner'}</p>
          {values.subtitle && <p className="mt-2 text-sm opacity-90">{values.subtitle}</p>}
          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
            {values.linkUrl && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-3 py-1.5 font-semibold text-river-900">
                {values.linkLabel || (isAd ? 'Tìm hiểu thêm' : 'Khám phá')} <ArrowUpRight className="size-3.5" aria-hidden />
              </span>
            )}
            {values.sponsorName && <span className="opacity-80">Tài trợ bởi {values.sponsorName}</span>}
          </div>
        </div>
        <div className="relative min-h-28 bg-black/10">
          {values.imageUrl && imagePattern.test(values.imageUrl) && <img src={values.imageUrl} alt="" className="absolute inset-0 size-full object-cover" />}
        </div>
      </div>
    </div>
  );
}

function BannerForm({ initial, onSaved }: { initial?: AdminBanner; onSaved: (b: AdminBanner) => void }) {
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<BannerFormValues>({
    resolver: zodResolver(bannerFormSchema),
    defaultValues: initial
      ? {
          kind: initial.kind,
          theme: initial.theme,
          eyebrow: initial.eyebrow ?? '',
          title: initial.title,
          subtitle: initial.subtitle ?? '',
          imageUrl: initial.imageUrl ?? '',
          imageAlt: initial.imageAlt ?? '',
          linkUrl: initial.linkUrl ?? '',
          linkLabel: initial.linkLabel ?? '',
          sponsorName: initial.sponsorName ?? '',
          status: initial.status,
          startAt: toLocalInput(initial.startAt),
          endAt: toLocalInput(initial.endAt),
          sortOrder: initial.sortOrder,
        }
      : {
          kind: 'cover',
          theme: 'forest',
          eyebrow: '',
          title: '',
          subtitle: '',
          imageUrl: '',
          imageAlt: '',
          linkUrl: '',
          linkLabel: '',
          sponsorName: '',
          status: 'inactive',
          startAt: '',
          endAt: '',
          sortOrder: 0,
        },
  });
  const values = form.watch();
  const { errors, isSubmitting, isDirty } = form.formState;

  const onSubmit = async (v: BannerFormValues) => {
    setFormError(null);
    const body = { ...v, startAt: toIsoOrNull(v.startAt), endAt: toIsoOrNull(v.endAt) };
    try {
      const res = initial
        ? await api.patch<{ banner: AdminBanner }>(`/admin/banners/${initial.id}`, body)
        : await api.post<{ banner: AdminBanner }>('/admin/banners', body);
      form.reset(v);
      onSaved(res.data.banner);
    } catch (error) {
      const apiError = toApiError(error);
      const unplaced = applyFieldErrors(apiError, form.setError, BANNER_FIELDS);
      if (apiError.fieldIssues.length === 0 || unplaced.length) setFormError(apiError.message);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-5">
      {formError && <Notice tone="warning">{formError}</Notice>}
      <BannerPreview values={values} />

      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Loại banner" required error={errors.kind?.message} hint="Quảng cáo luôn hiển thị nhãn cho du khách.">
          <Select {...form.register('kind')}>
            {(Object.keys(KIND_LABELS) as BannerKind[]).map((k) => (
              <option key={k} value={k}>{KIND_LABELS[k]}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Tông màu" error={errors.theme?.message}>
          <Select {...form.register('theme')}>
            {(Object.keys(THEME_LABELS) as BannerTheme[]).map((t) => (
              <option key={t} value={t}>{THEME_LABELS[t]}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Trạng thái" error={errors.status?.message}>
          <Select {...form.register('status')}>
            <option value="inactive">{STATUS_LABELS.inactive}</option>
            <option value="active">{STATUS_LABELS.active}</option>
          </Select>
        </FormField>
      </div>

      <FormField label="Dòng nhỏ phía trên (tùy chọn)" error={errors.eyebrow?.message} hint="Ví dụ: Mùa sen 2026, Sự kiện tháng 11.">
        <Input {...form.register('eyebrow')} />
      </FormField>
      <FormField label="Tiêu đề" required error={errors.title?.message}>
        <Input {...form.register('title')} />
      </FormField>
      <FormField label="Mô tả ngắn" error={errors.subtitle?.message}>
        <Textarea rows={2} {...form.register('subtitle')} />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="URL ảnh" error={errors.imageUrl?.message} hint="Để trống sẽ dùng nền màu theo tông đã chọn. Khuyến nghị ảnh ngang ≥ 1200×600.">
          <Input {...form.register('imageUrl')} placeholder="https://… hoặc /images/…" inputMode="url" />
        </FormField>
        <FormField label="Mô tả ảnh (alt)" error={errors.imageAlt?.message} hint="Hỗ trợ trình đọc màn hình.">
          <Input {...form.register('imageAlt')} />
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Liên kết khi nhấp" error={errors.linkUrl?.message} hint="http(s) mở tab mới; đường dẫn nội bộ như /destinations mở trong ứng dụng.">
          <Input {...form.register('linkUrl')} placeholder="https://… hoặc /destinations" inputMode="url" />
        </FormField>
        <FormField label="Nhãn nút" error={errors.linkLabel?.message}>
          <Input {...form.register('linkLabel')} placeholder="Xem ưu đãi" />
        </FormField>
      </div>

      <FormField label="Đơn vị tài trợ" required={values.kind === 'promo'} error={errors.sponsorName?.message} hint="Bắt buộc với banner quảng cáo; hiển thị “Tài trợ bởi …” cho du khách.">
        <Input {...form.register('sponsorName')} />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Bắt đầu hiển thị" error={errors.startAt?.message} hint="Để trống: hiển thị ngay khi bật.">
          <Input type="datetime-local" {...form.register('startAt')} />
        </FormField>
        <FormField label="Kết thúc hiển thị" error={errors.endAt?.message} hint="Để trống: không tự tắt.">
          <Input type="datetime-local" {...form.register('endAt')} />
        </FormField>
        <FormField label="Thứ tự" error={errors.sortOrder?.message} hint="Số nhỏ hiển thị trước.">
          <Input type="number" {...form.register('sortOrder')} />
        </FormField>
      </div>

      <div className="flex justify-end">
        <Button type="submit" loading={isSubmitting} disabled={Boolean(initial) && !isDirty} icon={<Save className="size-4" aria-hidden />}>
          {initial ? 'Lưu thay đổi' : 'Tạo banner'}
        </Button>
      </div>
    </form>
  );
}

export function AdminBannerFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const query = useApiQuery(
    (signal) => (id ? api.get<{ banner: AdminBanner }>(`/admin/banners/${id}`, { signal }).then((r) => r.data.banner) : Promise.resolve(undefined)),
    [id],
  );
  useDocumentTitle(isEdit ? 'Sửa banner' : 'Tạo banner');

  if (isEdit && query.loading && !query.data) return <PageLoader />;
  if (isEdit && (query.error || !query.data)) return <ErrorState error={query.error} onRetry={query.reload} />;

  return (
    <>
      <Link to="/admin/banners" className="mb-3 inline-flex items-center gap-1 text-sm text-river-600 hover:text-leaf-700">
        <ArrowLeft className="size-4" aria-hidden /> Danh sách banner
      </Link>
      <AdminPageHeader
        title={isEdit ? 'Sửa banner' : 'Tạo banner'}
        description={isEdit && query.data ? `${formatNumber(query.data.impressions)} lượt hiển thị · ${formatNumber(query.data.clicks)} lượt nhấp` : undefined}
      />
      <Card className="max-w-3xl p-5 sm:p-6">
        <BannerForm
          key={query.data?.updatedAt ?? id ?? 'new'}
          initial={query.data ?? undefined}
          onSaved={(b) => {
            toast.success(isEdit ? 'Đã lưu banner' : 'Đã tạo banner');
            if (isEdit) query.reload();
            else navigate(`/admin/banners/${b.id}/edit`, { replace: true });
          }}
        />
      </Card>
    </>
  );
}
