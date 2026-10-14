import { Eye, EyeOff, ExternalLink, MapPinned, Pencil, Plus, Send, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { IllustrativeBadge, VerificationStatusBadge } from '../../components/destination/DataBadges';
import { AdminPageHeader } from '../../components/layout/AdminLayout';
import { StatusBadge } from '../../components/ui/Badge';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Select } from '../../components/ui/Field';
import { ConfirmDialog } from '../../components/ui/Modal';
import { Pagination, SearchBar } from '../../components/ui/Navigation';
import { EmptyState, ErrorState, PageLoader } from '../../components/ui/States';
import { useApiQuery } from '../../hooks/useApiQuery';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { api, toApiError } from '../../lib/api';
import { CATEGORY_OPTIONS, OPERATIONAL_LABELS, PUBLICATION_LABELS, areaLabel, categoryLabel } from '../../lib/catalog';
import { formatDateTime } from '../../lib/format';
import { useAuthStore } from '../../stores/authStore';
import { toast } from '../../stores/toastStore';
import type { AdminDestination, Paginated, PublicationStatus } from '../../types/api';

export function AdminDestinationsPage() {
  useDocumentTitle('Quản lý địa điểm');
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const category = params.get('category') ?? '';
  const status = params.get('status') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<AdminDestination | null>(null);
  const isPartner = useAuthStore((s) => s.user?.role === 'partner');

  const query = useApiQuery(
    (signal) =>
      api
        .get<Paginated<AdminDestination>>('/admin/destinations', {
          params: { q: q || undefined, category: category || undefined, publicationStatus: status || undefined, page, limit: 20 },
          signal,
        })
        .then((r) => r.data),
    [q, category, status, page],
  );

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: key !== 'page' });
  };

  const setPublication = async (d: AdminDestination, publicationStatus: PublicationStatus) => {
    setBusyId(d.id);
    try {
      await api.patch(`/admin/destinations/${d.id}`, { publicationStatus });
      toast.success(publicationStatus === 'published' ? `Đã xuất bản “${d.name}”` : `Đã ẩn “${d.name}”`);
      query.reload();
    } catch (error) {
      toast.error('Không cập nhật được', toApiError(error).message);
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setBusyId(toDelete.id);
    try {
      await api.delete(`/admin/destinations/${toDelete.id}`);
      toast.success(`Đã xóa “${toDelete.name}”`);
      setToDelete(null);
      query.reload();
    } catch (error) {
      toast.error('Không xóa được', toApiError(error).message);
      setToDelete(null);
    } finally {
      setBusyId(null);
    }
  };

  const data = query.data;
  return (
    <>
      <AdminPageHeader
        title="Địa điểm"
        description={
          isPartner
            ? 'Cập nhật nội dung địa điểm bạn quản lý. Xuất bản do quản trị viên duyệt.'
            : 'Tạo, chỉnh sửa, xuất bản hoặc ẩn địa điểm. Địa điểm đang gắn QR/thử thách nên được ẩn thay vì xóa.'
        }
        actions={<ButtonLink to="/admin/destinations/new" icon={<Plus className="size-4" aria-hidden />}>Thêm địa điểm</ButtonLink>}
      />
      <Card className="mb-4 grid gap-3 p-4 md:grid-cols-[1fr_200px_200px]">
        <SearchBar value={q} onSearch={(v) => update('q', v)} placeholder="Tìm theo tên, tag, khu vực…" label="Tìm địa điểm" />
        <Select aria-label="Lọc theo loại hình" value={category} onChange={(e) => update('category', e.target.value)}>
          <option value="">Tất cả loại hình</option>
          {CATEGORY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>
        <Select aria-label="Lọc theo trạng thái" value={status} onChange={(e) => update('status', e.target.value)}>
          <option value="">Tất cả trạng thái</option>
          {Object.entries(PUBLICATION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </Select>
      </Card>

      {query.loading && !data ? (
        <PageLoader />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={query.reload} />
      ) : data && data.items.length === 0 ? (
        <EmptyState
          icon={<MapPinned className="size-6" aria-hidden />}
          title={q || category || status ? 'Không có địa điểm phù hợp bộ lọc' : 'Chưa có địa điểm nào'}
          action={<ButtonLink to="/admin/destinations/new">Thêm địa điểm</ButtonLink>}
        />
      ) : data ? (
        <>
          <p className="mb-2 text-sm text-river-600" aria-live="polite">{data.total} địa điểm</p>
          <ul className="space-y-3" aria-busy={query.loading}>
            {data.items.map((d) => (
              <li key={d.id}>
                <Card className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link to={`/admin/destinations/${d.id}/edit`} className="font-semibold text-river-900 hover:text-leaf-700">
                        {d.name}
                      </Link>
                      <StatusBadge status={d.publicationStatus} label={PUBLICATION_LABELS[d.publicationStatus]} />
                      {d.operationalStatus !== 'active' && <StatusBadge status={d.operationalStatus} label={OPERATIONAL_LABELS[d.operationalStatus]} />}
                      <VerificationStatusBadge status={d.verificationStatus} />
                      {d.isIllustrative && <IllustrativeBadge />}
                    </div>
                    <p className="mt-1 text-xs text-river-500">
                      {categoryLabel(d.category)} · {areaLabel(d.area)} · /{d.slug} · cập nhật {formatDateTime(d.updatedAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <ButtonLink to={`/admin/destinations/${d.id}/edit`} size="sm" variant="secondary" icon={<Pencil className="size-4" aria-hidden />}>
                      Sửa
                    </ButtonLink>
                    {d.publicationStatus === 'published' ? (
                      <>
                        <a href={`/destinations/${d.slug}`} target="_blank" rel="noopener" className="inline-flex min-h-9 items-center gap-1 rounded-control px-3 text-sm font-medium text-river-700 hover:bg-sand-100">
                          <ExternalLink className="size-4" aria-hidden /> Xem
                        </a>
                        {!isPartner && (
                          <Button size="sm" variant="ghost" icon={<EyeOff className="size-4" aria-hidden />} loading={busyId === d.id} onClick={() => setPublication(d, 'hidden')}>
                            Ẩn
                          </Button>
                        )}
                      </>
                    ) : (
                      !isPartner && (
                        <Button size="sm" variant="ghost" icon={d.publicationStatus === 'draft' ? <Send className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />} loading={busyId === d.id} onClick={() => setPublication(d, 'published')}>
                          Xuất bản
                        </Button>
                      )
                    )}
                    {!isPartner && (
                      <Button size="sm" variant="ghost" className="text-red-700 hover:bg-red-50" icon={<Trash2 className="size-4" aria-hidden />} onClick={() => setToDelete(d)} aria-label={`Xóa ${d.name}`}>
                        Xóa
                      </Button>
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
        open={Boolean(toDelete)}
        title="Xóa địa điểm?"
        message={
          <>
            Bạn sắp xóa vĩnh viễn <strong>{toDelete?.name}</strong>. Hành động không thể hoàn tác. Nếu địa điểm đang gắn với mã QR hoặc thử
            thách, hệ thống sẽ từ chối; khi đó hãy chọn “Ẩn”.
          </>
        }
        confirmLabel="Xóa vĩnh viễn"
        loading={Boolean(toDelete && busyId === toDelete.id)}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}
