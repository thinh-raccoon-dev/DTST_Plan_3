import { Eye, EyeOff, ExternalLink, LayoutDashboard, MapPinned, Pencil, Plus, Send, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { IllustrativeBadge, VerificationStatusBadge } from '../../components/destination/DataBadges';
import { AdminPageHeader } from '../../components/layout/AdminLayout';
import { StatusBadge } from '../../components/ui/Badge';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Select, Textarea } from '../../components/ui/Field';
import { ConfirmDialog, Modal } from '../../components/ui/Modal';
import { Pagination, SearchBar } from '../../components/ui/Navigation';
import { EmptyState, ErrorState, PageLoader } from '../../components/ui/States';
import { useApiQuery } from '../../hooks/useApiQuery';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { api, toApiError } from '../../lib/api';
import { AREA_OPTIONS, CATEGORY_OPTIONS, OPERATIONAL_LABELS, PUBLICATION_LABELS, areaLabel, categoryLabel } from '../../lib/catalog';
import { formatDateTime } from '../../lib/format';
import { useAuthStore } from '../../stores/authStore';
import { toast } from '../../stores/toastStore';
import type { AdminDestination, Paginated, PublicationStatus } from '../../types/api';

export function AdminDestinationsPage() {
  useDocumentTitle('Quản lý địa điểm');
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const category = params.get('category') ?? '';
  const area = params.get('area') ?? '';
  const verificationStatus = params.get('verificationStatus') ?? '';
  const assignment = params.get('assignment') ?? '';
  const status = params.get('status') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<AdminDestination | null>(null);
  const [returnTarget, setReturnTarget] = useState<AdminDestination | null>(null);
  const [returnNote, setReturnNote] = useState('');
  const isPartner = useAuthStore((s) => s.user?.role === 'partner');

  const query = useApiQuery(
    (signal) =>
      api
        .get<Paginated<AdminDestination>>('/admin/destinations', {
          params: {
            q: q || undefined,
            category: category || undefined,
            area: area || undefined,
            verificationStatus: verificationStatus || undefined,
            assignment: assignment || undefined,
            publicationStatus: status || undefined,
            page,
            limit: 20,
          },
          signal,
        })
        .then((r) => r.data),
    [q, category, area, verificationStatus, assignment, status, page],
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
      if (publicationStatus === 'published') toast.success(`Đã duyệt và xuất bản “${d.name}”`);
      else if (publicationStatus === 'pending_review') toast.success(`Đã gửi duyệt “${d.name}”`);
      else if (publicationStatus === 'draft') toast.success(`Đã chuyển “${d.name}” về bản nháp`);
      else toast.success(`Đã ẩn “${d.name}”`);
      query.reload();
    } catch (error) {
      toast.error('Không cập nhật được', toApiError(error).message);
    } finally {
      setBusyId(null);
    }
  };

  const handleReturnDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnTarget) return;
    setBusyId(returnTarget.id);
    try {
      const res = await api.patch<{ message?: string }>(`/admin/destinations/${returnTarget.id}/review`, {
        decision: 'return_draft',
        reviewNote: returnNote.trim(),
      });
      toast.success(res.data?.message || `Đã trả hồ sơ “${returnTarget.name}” về bản nháp.`);
      setReturnTarget(null);
      setReturnNote('');
      query.reload();
    } catch (error) {
      toast.error('Không thể trả về sửa', toApiError(error).message);
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
            ? 'Cập nhật nội dung địa điểm bạn quản lý. Chọn "Gửi duyệt" để Quản trị viên duyệt xuất bản.'
            : 'Tạo, chỉnh sửa, duyệt, xuất bản hoặc ẩn địa điểm. Địa điểm đang gắn QR/thử thách nên được ẩn thay vì xóa.'
        }
        actions={<ButtonLink to="/admin/destinations/new" icon={<Plus className="size-4" aria-hidden />}>Thêm địa điểm</ButtonLink>}
      />
      <Card className="mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <SearchBar value={q} onSearch={(v) => update('q', v)} placeholder="Tìm theo tên, tag, khu vực…" label="Tìm địa điểm" />
        <Select aria-label="Lọc theo loại hình" value={category} onChange={(e) => update('category', e.target.value)}>
          <option value="">Tất cả loại hình</option>
          {CATEGORY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>
        <Select aria-label="Lọc theo khu vực" value={area} onChange={(e) => update('area', e.target.value)}>
          <option value="">Tất cả địa bàn</option>
          {AREA_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>
        <Select aria-label="Lọc theo trạng thái" value={status} onChange={(e) => update('status', e.target.value)}>
          <option value="">Tất cả xuất bản</option>
          {Object.entries(PUBLICATION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </Select>
        {!isPartner ? (
          <Select
            aria-label="Lọc theo xác minh / đối tác"
            value={verificationStatus ? `v:${verificationStatus}` : assignment ? `a:${assignment}` : ''}
            onChange={(e) => {
              const val = e.target.value;
              const next = new URLSearchParams(params);
              next.delete('verificationStatus');
              next.delete('assignment');
              next.delete('page');
              if (val.startsWith('v:')) next.set('verificationStatus', val.slice(2));
              if (val.startsWith('a:')) next.set('assignment', val.slice(2));
              setParams(next, { replace: true });
            }}
          >
            <option value="">Tất cả xác minh & Đối tác</option>
            <option value="v:verified">✓ Đã xác minh đầy đủ</option>
            <option value="v:partially_verified">◐ Xác minh một phần</option>
            <option value="v:unverified">○ Chưa xác minh</option>
            <option value="a:assigned">🏢 Đã gán Đối tác KDL</option>
            <option value="a:unassigned">⚠️ Chưa gán Đối tác</option>
          </Select>
        ) : (
          <Select aria-label="Lọc theo xác minh" value={verificationStatus} onChange={(e) => update('verificationStatus', e.target.value)}>
            <option value="">Tất cả mức xác minh</option>
            <option value="verified">Đã xác minh</option>
            <option value="partially_verified">Xác minh một phần</option>
            <option value="unverified">Chưa xác minh</option>
          </Select>
        )}
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
                      {d.managedByName && <span className="ml-2 font-medium text-teal-700">· Phụ trách: {d.managedByName}</span>}
                    </p>
                    {d.reviewNote && (
                      <p className="mt-1 rounded-control bg-sand-100 px-2 py-0.5 text-xs text-river-700">
                        💬 Ghi chú duyệt: {d.reviewNote}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <ButtonLink to={`/admin/destinations/${d.id}/edit`} size="sm" variant="secondary" icon={<Pencil className="size-4" aria-hidden />}>
                      Sửa
                    </ButtonLink>
                    {!isPartner && (
                      <ButtonLink
                        to={`/admin/partner?destinationId=${d.id}`}
                        size="sm"
                        variant="ghost"
                        icon={<LayoutDashboard className="size-4 text-leaf-700" aria-hidden />}
                      >
                        Partner Hub
                      </ButtonLink>
                    )}
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
                    ) : d.publicationStatus === 'pending_review' ? (
                      !isPartner ? (
                        <>
                          <Button size="sm" variant="accent" icon={<Send className="size-4" aria-hidden />} loading={busyId === d.id} onClick={() => setPublication(d, 'published')}>
                            Duyệt xuất bản
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={<Pencil className="size-4" aria-hidden />}
                            onClick={() => {
                              setReturnTarget(d);
                              setReturnNote(d.reviewNote || '');
                            }}
                          >
                            Yêu cầu sửa
                          </Button>
                        </>
                      ) : (
                        <span className="inline-flex items-center rounded-control bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800">
                          Chờ Admin duyệt
                        </span>
                      )
                    ) : (
                      isPartner ? (
                        <Button size="sm" variant="secondary" icon={<Send className="size-4" aria-hidden />} loading={busyId === d.id} onClick={() => setPublication(d, 'pending_review')}>
                          Gửi duyệt
                        </Button>
                      ) : (
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

      <Modal
        open={Boolean(returnTarget)}
        size="sm"
        title="Trả hồ sơ Địa điểm về Bản nháp"
        onClose={() => setReturnTarget(null)}
      >
        {returnTarget && (
          <form onSubmit={handleReturnDraft} className="space-y-4">
            <p className="text-sm text-river-700">
              Ghi rõ nội dung cần chỉnh sửa cho <strong>{returnTarget.name}</strong> (tối thiểu 5 ký tự):
            </p>
            <Textarea
              rows={3}
              value={returnNote}
              onChange={(e) => setReturnNote(e.target.value)}
              placeholder="VD: Vui lòng bổ sung ảnh thực tế, tọa độ GPS chuẩn và nguồn xác minh..."
              required
            />
            <div className="flex justify-end gap-2 pt-2 border-t border-sand-200">
              <Button type="button" variant="secondary" onClick={() => setReturnTarget(null)}>
                Hủy
              </Button>
              <Button type="submit" variant="danger" loading={busyId === returnTarget.id}>
                Trả về bản nháp
              </Button>
            </div>
          </form>
        )}
      </Modal>

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
