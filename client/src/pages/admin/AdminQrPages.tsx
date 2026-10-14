import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Copy, Download, ExternalLink, Plus, Power, Printer, QrCode, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { AdminPageHeader } from '../../components/layout/AdminLayout';
import { StatusBadge } from '../../components/ui/Badge';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Card, StatCard } from '../../components/ui/Card';
import { FormField, Input, Select, Textarea } from '../../components/ui/Field';
import { ConfirmDialog } from '../../components/ui/Modal';
import { Pagination, SearchBar } from '../../components/ui/Navigation';
import { EmptyState, ErrorState, Notice, PageLoader, Skeleton } from '../../components/ui/States';
import { useApiQuery } from '../../hooks/useApiQuery';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { api, applyFieldErrors, toApiError } from '../../lib/api';
import { PUBLICATION_LABELS } from '../../lib/catalog';
import { formatDateTime, formatNumber } from '../../lib/format';
import { toast } from '../../stores/toastStore';
import type { AdminChallenge, AdminDestination, AdminQr, Paginated } from '../../types/api';

const STATUS_LABELS = { active: 'Đang hoạt động', inactive: 'Đã tắt' } as const;

async function fetchQrBlob(id: string, format: 'png' | 'svg') {
  const res = await api.get<Blob>(`/admin/qr/${id}/image`, { params: { format }, responseType: 'blob' });
  return res.data;
}

async function downloadQr(qr: AdminQr, format: 'png' | 'svg') {
  try {
    const url = URL.createObjectURL(await fetchQrBlob(qr.id, format));
    const a = document.createElement('a');
    a.href = url;
    a.download = `qr-${qr.code}.${format}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    toast.error('Không tải được ảnh QR', toApiError(error).message);
  }
}

async function printQr(qr: AdminQr) {
  const win = window.open('', '_blank', 'width=600,height=760');
  if (!win) {
    toast.error('Trình duyệt đã chặn cửa sổ in', 'Hãy cho phép cửa sổ bật lên rồi thử lại, hoặc tải PNG để in.');
    return;
  }
  try {
    const svg = await (await fetchQrBlob(qr.id, 'svg')).text();
    const doc = win.document;
    doc.title = `QR ${qr.code}`;
    const style = doc.createElement('style');
    style.textContent =
      'body{font-family:system-ui,sans-serif;text-align:center;padding:24px;color:#10242b}svg{width:320px;height:320px}h1{font-size:20px;margin:16px 0 4px}p{margin:4px 0;font-size:14px}code{font-size:18px;letter-spacing:2px}';
    doc.head.appendChild(style);
    const wrap = doc.createElement('div');
    wrap.innerHTML = svg;
    const title = doc.createElement('h1');
    title.textContent = qr.label;
    const code = doc.createElement('p');
    code.innerHTML = '<code></code>';
    code.querySelector('code')!.textContent = qr.code;
    const hint = doc.createElement('p');
    hint.textContent = 'Quét mã để mở thông tin và thử thách tại điểm đến';
    doc.body.append(wrap, title, code, hint);
    win.focus();
    win.print();
  } catch (error) {
    win.close();
    toast.error('Không chuẩn bị được bản in', toApiError(error).message);
  }
}

function useQrImage(id: string | undefined, version: string | null | undefined) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!id) return;
    let url: string | null = null;
    let cancelled = false;
    setFailed(false);
    fetchQrBlob(id, 'png')
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setSrc(url);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id, version]);
  return { src, failed };
}

function copyUrl(url: string) {
  navigator.clipboard
    .writeText(url)
    .then(() => toast.success('Đã sao chép liên kết'))
    .catch(() => toast.error('Không sao chép được', url));
}

function TargetSummary({ qr }: { qr: AdminQr }) {
  const t = qr.target;
  return (
    <span className="text-xs text-river-500">
      {qr.targetType === 'destination' ? 'Địa điểm' : 'Thử thách'}: <span className="font-medium text-river-700">{t.label}</span>
      {qr.targetType === 'challenge' && t.destinationName && ` (${t.destinationName})`}
      {!t.exists && <span className="ml-1 font-semibold text-red-700">· đích không tồn tại</span>}
      {t.publicationStatus && t.publicationStatus !== 'published' && <span className="ml-1 font-semibold text-teal-700">· địa điểm {PUBLICATION_LABELS[t.publicationStatus].toLowerCase()}</span>}
      {t.challengeStatus === 'inactive' && <span className="ml-1 font-semibold text-teal-700">· thử thách đang tắt</span>}
    </span>
  );
}

export function AdminQrListPage() {
  useDocumentTitle('Quản lý mã QR');
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const status = params.get('status') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toDisable, setToDisable] = useState<AdminQr | null>(null);
  const query = useApiQuery(
    (signal) =>
      api.get<Paginated<AdminQr>>('/admin/qr', { params: { q: q || undefined, status: status || undefined, page }, signal }).then((r) => r.data),
    [q, status, page],
  );
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: key !== 'page' });
  };

  const setStatus = async (qr: AdminQr, next: 'active' | 'inactive') => {
    setBusyId(qr.id);
    try {
      await api.patch(`/admin/qr/${qr.id}`, { status: next });
      toast.success(next === 'active' ? `Đã bật mã ${qr.code}` : `Đã tắt mã ${qr.code}`);
      setToDisable(null);
      query.reload();
    } catch (error) {
      toast.error('Không cập nhật được', toApiError(error).message);
    } finally {
      setBusyId(null);
    }
  };

  const data = query.data;
  return (
    <>
      <AdminPageHeader
        title="Mã QR"
        description="Mỗi mã QR là một mã ổn định trỏ tới địa điểm hoặc thử thách. Có thể đổi nội dung đích mà không cần in lại."
        actions={<ButtonLink to="/admin/qr/new" icon={<Plus className="size-4" aria-hidden />}>Tạo mã QR</ButtonLink>}
      />
      <Card className="mb-4 grid gap-3 p-4 md:grid-cols-[1fr_220px]">
        <SearchBar value={q} onSearch={(v) => update('q', v)} placeholder="Tìm theo mã hoặc nhãn…" label="Tìm mã QR" />
        <Select aria-label="Lọc theo trạng thái" value={status} onChange={(e) => update('status', e.target.value)}>
          <option value="">Tất cả trạng thái</option>
          <option value="active">{STATUS_LABELS.active}</option>
          <option value="inactive">{STATUS_LABELS.inactive}</option>
        </Select>
      </Card>

      {query.loading && !data ? (
        <PageLoader />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={query.reload} />
      ) : data && data.items.length === 0 ? (
        <EmptyState icon={<QrCode className="size-6" aria-hidden />} title="Chưa có mã QR phù hợp" action={<ButtonLink to="/admin/qr/new">Tạo mã QR</ButtonLink>} />
      ) : data ? (
        <>
          <ul className="space-y-3" aria-busy={query.loading}>
            {data.items.map((qr) => (
              <li key={qr.id}>
                <Card className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link to={`/admin/qr/${qr.id}`} className="font-mono font-semibold text-river-900 hover:text-leaf-700">{qr.code}</Link>
                      <StatusBadge status={qr.status} label={STATUS_LABELS[qr.status]} />
                      <span className="text-sm text-river-700">{qr.label}</span>
                    </div>
                    <div className="mt-1"><TargetSummary qr={qr} /></div>
                    <p className="mt-1 text-xs text-river-500">
                      {formatNumber(qr.landingViews)} lượt mở trang từ QR · lần gần nhất {qr.lastLandingAt ? formatDateTime(qr.lastLandingAt) : '—'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <ButtonLink to={`/admin/qr/${qr.id}`} size="sm" variant="secondary">Chi tiết</ButtonLink>
                    <a href={`/qr/${qr.code}?preview=1`} target="_blank" rel="noopener" className="inline-flex min-h-9 items-center gap-1 rounded-control px-3 text-sm font-medium text-river-700 hover:bg-sand-100">
                      <ExternalLink className="size-4" aria-hidden /> Xem trước
                    </a>
                    <Button size="sm" variant="ghost" icon={<Download className="size-4" aria-hidden />} onClick={() => downloadQr(qr, 'png')}>PNG</Button>
                    {qr.status === 'active' ? (
                      <Button size="sm" variant="ghost" icon={<Power className="size-4" aria-hidden />} onClick={() => setToDisable(qr)} loading={busyId === qr.id}>Tắt</Button>
                    ) : (
                      <Button size="sm" variant="ghost" icon={<Power className="size-4" aria-hidden />} onClick={() => setStatus(qr, 'active')} loading={busyId === qr.id}>Bật</Button>
                    )}
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
        open={Boolean(toDisable)}
        title={`Tắt mã ${toDisable?.code ?? ''}?`}
        message="Du khách quét mã sẽ thấy thông báo “mã tạm ngừng” thay vì nội dung. Bạn có thể bật lại bất cứ lúc nào."
        confirmLabel="Tắt mã"
        loading={Boolean(toDisable && busyId === toDisable.id)}
        onConfirm={() => toDisable && setStatus(toDisable, 'inactive')}
        onCancel={() => setToDisable(null)}
      />
    </>
  );
}

const qrFormSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === '' || /^[A-Z0-9-]{4,32}$/.test(v), 'Chỉ gồm chữ in hoa, số và dấu gạch ngang (4–32 ký tự)'),
  label: z.string().trim().min(2, 'Nhãn cần ít nhất 2 ký tự').max(120),
  targetType: z.enum(['destination', 'challenge']),
  targetId: z.string().min(1, 'Chọn nội dung đích'),
  status: z.enum(['active', 'inactive']),
  notes: z.string().trim().max(500),
});
type QrFormValues = z.infer<typeof qrFormSchema>;

function useTargetOptions() {
  return useApiQuery(
    async (signal) => {
      const [destinations, challenges] = await Promise.all([
        api.get<Paginated<AdminDestination>>('/admin/destinations', { params: { limit: 100 }, signal }),
        api.get<Paginated<AdminChallenge>>('/admin/challenges', { params: { limit: 100 }, signal }),
      ]);
      return { destinations: destinations.data.items, challenges: challenges.data.items };
    },
    [],
  );
}

function QrForm({ initial, onSaved }: { initial?: AdminQr; onSaved: (qr: AdminQr) => void }) {
  const targets = useTargetOptions();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<QrFormValues>({
    resolver: zodResolver(qrFormSchema),
    defaultValues: initial
      ? { code: initial.code, label: initial.label, targetType: initial.targetType, targetId: initial.targetId, status: initial.status, notes: initial.notes ?? '' }
      : { code: '', label: '', targetType: 'destination', targetId: '', status: 'active', notes: '' },
  });
  const targetType = form.watch('targetType');
  const { errors, isSubmitting, isDirty } = form.formState;

  const onSubmit = async (v: QrFormValues) => {
    setFormError(null);
    const body = { label: v.label, targetType: v.targetType, targetId: v.targetId, status: v.status, notes: v.notes };
    try {
      const res = initial
        ? await api.patch<{ qr: AdminQr }>(`/admin/qr/${initial.id}`, body)
        : await api.post<{ qr: AdminQr }>('/admin/qr', { ...body, code: v.code });
      form.reset({ ...v, code: res.data.qr.code });
      onSaved(res.data.qr);
    } catch (error) {
      const apiError = toApiError(error);
      if (apiError.code === 'QR_CODE_TAKEN') form.setError('code', { message: apiError.message });
      else {
        const unplaced = applyFieldErrors(apiError, form.setError, ['code', 'label', 'targetType', 'targetId', 'status', 'notes']);
        if (apiError.fieldIssues.length === 0 || unplaced.length) setFormError(apiError.message);
      }
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
      {formError && <Notice tone="warning">{formError}</Notice>}
      {initial ? (
        <FormField label="Mã" hint="Mã không thể thay đổi sau khi tạo để tránh làm hỏng QR đã in.">
          <Input value={initial.code} readOnly disabled className="font-mono" />
        </FormField>
      ) : (
        <FormField label="Mã (tùy chọn)" hint="Để trống để tạo mã ngẫu nhiên dạng DT-XXXXXX." error={errors.code?.message}>
          <Input className="font-mono uppercase" {...form.register('code')} placeholder="VD: TRAMCHIM-02" />
        </FormField>
      )}
      <FormField label="Nhãn" required hint="Tên nội bộ, ví dụ vị trí đặt bảng QR." error={errors.label?.message}>
        <Input {...form.register('label')} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Loại nội dung đích" required error={errors.targetType?.message}>
          <Select
            {...form.register('targetType', {
              onChange: () => form.setValue('targetId', '', { shouldDirty: true }),
            })}
          >
            <option value="destination">Địa điểm</option>
            <option value="challenge">Thử thách</option>
          </Select>
        </FormField>
        <FormField label="Nội dung đích" required error={errors.targetId?.message ?? (targets.error ? 'Không tải được danh sách' : undefined)}>
          <Select {...form.register('targetId')} disabled={targets.loading}>
            <option value="">{targets.loading ? 'Đang tải…' : '— Chọn —'}</option>
            {targetType === 'destination'
              ? targets.data?.destinations.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                    {d.publicationStatus !== 'published' ? ` (${PUBLICATION_LABELS[d.publicationStatus].toLowerCase()})` : ''}
                  </option>
                ))
              : targets.data?.challenges.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                    {c.destination ? ` — ${c.destination.name}` : ''}
                    {c.status === 'inactive' ? ' (đang tắt)' : ''}
                  </option>
                ))}
          </Select>
        </FormField>
      </div>
      <FormField label="Trạng thái" error={errors.status?.message}>
        <Select {...form.register('status')}>
          <option value="active">{STATUS_LABELS.active}</option>
          <option value="inactive">{STATUS_LABELS.inactive}</option>
        </Select>
      </FormField>
      <FormField label="Ghi chú nội bộ" error={errors.notes?.message}>
        <Textarea rows={3} {...form.register('notes')} />
      </FormField>
      <div className="flex justify-end">
        <Button type="submit" loading={isSubmitting} disabled={Boolean(initial) && !isDirty} icon={<Save className="size-4" aria-hidden />}>
          {initial ? 'Lưu thay đổi' : 'Tạo mã QR'}
        </Button>
      </div>
    </form>
  );
}

export function AdminQrNewPage() {
  useDocumentTitle('Tạo mã QR');
  const navigate = useNavigate();
  return (
    <>
      <Link to="/admin/qr" className="mb-3 inline-flex items-center gap-1 text-sm text-river-600 hover:text-leaf-700">
        <ArrowLeft className="size-4" aria-hidden /> Danh sách mã QR
      </Link>
      <AdminPageHeader title="Tạo mã QR" />
      <Card className="max-w-2xl p-5 sm:p-6">
        <QrForm
          onSaved={(qr) => {
            toast.success(`Đã tạo mã ${qr.code}`);
            navigate(`/admin/qr/${qr.id}`, { replace: true });
          }}
        />
      </Card>
    </>
  );
}

interface QrDetailResponse {
  qr: AdminQr;
  stats: { landingViewsLast30Days: number; checkIns: number; challengeCompletions: number };
}

export function AdminQrDetailPage() {
  const { id } = useParams();
  const query = useApiQuery((signal) => api.get<QrDetailResponse>(`/admin/qr/${id}`, { signal }).then((r) => r.data), [id]);
  useDocumentTitle(query.data ? `QR ${query.data.qr.code}` : 'Mã QR');
  const image = useQrImage(id, query.data?.qr.code);

  if (query.loading && !query.data) return <PageLoader />;
  if (query.error || !query.data) return <ErrorState error={query.error} onRetry={query.reload} />;
  const { qr, stats } = query.data;

  return (
    <>
      <Link to="/admin/qr" className="mb-3 inline-flex items-center gap-1 text-sm text-river-600 hover:text-leaf-700">
        <ArrowLeft className="size-4" aria-hidden /> Danh sách mã QR
      </Link>
      <AdminPageHeader
        title={`Mã ${qr.code}`}
        description={qr.label}
        actions={<StatusBadge status={qr.status} label={STATUS_LABELS[qr.status]} />}
      />
      {(!qr.target.exists || (qr.target.publicationStatus && qr.target.publicationStatus !== 'published') || qr.target.challengeStatus === 'inactive') && (
        <div className="mb-4">
          <Notice tone="warning" title="Du khách quét mã này sẽ không xem được nội dung">
            Nội dung đích không tồn tại, chưa xuất bản hoặc đang tắt. Hãy đổi nội dung đích hoặc xuất bản nội dung.
          </Notice>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          <Card className="p-5 text-center">
            <div className="mx-auto aspect-square w-full max-w-64 overflow-hidden rounded-control border border-sand-200 bg-white">
              {image.src ? (
                <img src={image.src} alt={`Mã QR ${qr.code}`} className="size-full" />
              ) : image.failed ? (
                <p className="flex size-full items-center justify-center p-4 text-sm text-river-500">Không tải được ảnh QR.</p>
              ) : (
                <Skeleton className="size-full" />
              )}
            </div>
            <p className="mt-3 break-all text-xs text-river-500">{qr.url}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button size="sm" variant="secondary" icon={<Download className="size-4" aria-hidden />} onClick={() => downloadQr(qr, 'png')}>PNG</Button>
              <Button size="sm" variant="secondary" icon={<Download className="size-4" aria-hidden />} onClick={() => downloadQr(qr, 'svg')}>SVG</Button>
              <Button size="sm" variant="secondary" icon={<Printer className="size-4" aria-hidden />} onClick={() => printQr(qr)}>In</Button>
              <Button size="sm" variant="secondary" icon={<Copy className="size-4" aria-hidden />} onClick={() => copyUrl(qr.url)}>Sao chép</Button>
            </div>
            <a
              href={`/qr/${qr.code}?preview=1`}
              target="_blank"
              rel="noopener"
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-leaf-700 hover:underline"
            >
              Xem trước (không ghi nhận lượt quét) <ExternalLink className="size-4" aria-hidden />
            </a>
          </Card>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            <StatCard label="Lượt mở trang từ QR (tổng)" value={formatNumber(qr.landingViews)} hint={`Gần nhất: ${qr.lastLandingAt ? formatDateTime(qr.lastLandingAt) : '—'}`} />
            <StatCard label="Lượt mở 30 ngày qua" value={formatNumber(stats.landingViewsLast30Days)} />
            <StatCard label="Check-in qua mã này" value={formatNumber(stats.checkIns)} />
            <StatCard label="Hoàn thành thử thách qua mã này" value={formatNumber(stats.challengeCompletions)} />
          </div>
        </div>
        <Card className="p-5 sm:p-6">
          <h2 className="text-lg">Cấu hình</h2>
          <p className="mb-4 mt-1 text-sm text-river-600">
            Đổi nội dung đích sẽ có hiệu lực ngay với mã đã in. Hiện trỏ tới: <TargetSummary qr={qr} />
          </p>
          <QrForm
            key={qr.updatedAt ?? qr.id}
            initial={qr}
            onSaved={() => {
              toast.success('Đã lưu mã QR');
              query.reload();
            }}
          />
        </Card>
      </div>
    </>
  );
}
