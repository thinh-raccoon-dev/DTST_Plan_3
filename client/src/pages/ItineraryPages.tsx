import { BookMarked, CalendarDays, Clock, MapPin, Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ItineraryEditor, toSaveBody } from '../components/itinerary/ItineraryEditor';
import { PageContainer } from '../components/layout/PublicLayout';
import { Button, ButtonLink } from '../components/ui/Button';
import { Card, SectionHeading } from '../components/ui/Card';
import { FormField, Input } from '../components/ui/Field';
import { ConfirmDialog } from '../components/ui/Modal';
import { Breadcrumb } from '../components/ui/Navigation';
import { CardGridSkeleton, EmptyState, ErrorState, Notice, PageLoader } from '../components/ui/States';
import { useApiQuery } from '../hooks/useApiQuery';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { api, toApiError } from '../lib/api';
import { formatDateTime, formatMinutes } from '../lib/format';
import type { DraftDay } from '../lib/itineraryOps';
import { toast } from '../stores/toastStore';
import type { ItineraryListItem, SavedItinerary } from '../types/api';

export function MyItinerariesPage() {
  useDocumentTitle('Lịch trình đã lưu');
  const list = useApiQuery((signal) => api.get<{ items: ItineraryListItem[] }>('/itineraries/my', { signal }).then((r) => r.data.items), []);
  return (
    <PageContainer>
      <SectionHeading
        as="h1"
        title="Lịch trình đã lưu"
        description="Các lịch trình được lưu trong tài khoản của bạn."
        action={<ButtonLink to="/itinerary/create">Tạo lịch trình mới</ButtonLink>}
      />
      <div className="mt-6">
        {list.loading ? (
          <CardGridSkeleton count={3} />
        ) : list.error ? (
          <ErrorState error={list.error} onRetry={list.reload} />
        ) : list.data && list.data.length > 0 ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.data.map((it) => (
              <li key={it.id}>
                <Link to={`/itinerary/${it.id}`} className="block h-full rounded-card border border-sand-200 bg-white p-5 shadow-card transition-colors hover:border-leaf-400">
                  <h2 className="text-lg">{it.title}</h2>
                  <ul className="mt-3 space-y-1.5 text-sm text-river-600">
                    <li className="flex items-center gap-2"><CalendarDays className="size-4" aria-hidden />{it.numberOfDays} ngày</li>
                    <li className="flex items-center gap-2"><MapPin className="size-4" aria-hidden />{it.destinationCount} địa điểm</li>
                    <li className="flex items-center gap-2"><Clock className="size-4" aria-hidden />{formatMinutes(it.estimatedDurationMinutes)}</li>
                  </ul>
                  <p className="mt-3 text-xs text-river-500">Cập nhật {formatDateTime(it.updatedAt)}</p>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={<BookMarked className="size-6" aria-hidden />}
            title="Bạn chưa lưu lịch trình nào"
            description="Tạo lịch trình theo sở thích rồi bấm “Lưu vào tài khoản”."
            action={<ButtonLink to="/itinerary/create">Lập lịch trình</ButtonLink>}
          />
        )}
      </div>
    </PageContainer>
  );
}

export function ItineraryDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const query = useApiQuery((signal) => api.get<{ itinerary: SavedItinerary }>(`/itineraries/${id}`, { signal }).then((r) => r.data.itinerary), [id]);
  const [title, setTitle] = useState('');
  const [days, setDays] = useState<DraftDay[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  useDocumentTitle(query.data?.title ?? 'Lịch trình');

  useEffect(() => {
    if (!query.data) return;
    setTitle(query.data.title);
    setDays(query.data.days.map((d) => ({ items: d.items })));
    setDirty(false);
  }, [query.data]);

  if (query.loading) return <PageContainer><PageLoader /></PageContainer>;
  if (query.error || !query.data) {
    return (
      <PageContainer>
        {query.error?.status === 404 ? (
          <EmptyState title="Không tìm thấy lịch trình" description="Lịch trình không tồn tại hoặc không thuộc tài khoản của bạn." action={<ButtonLink to="/my-itineraries">Về danh sách</ButtonLink>} />
        ) : (
          <ErrorState error={query.error} onRetry={query.reload} />
        )}
      </PageContainer>
    );
  }

  const itinerary = query.data;
  const unavailableCount = days.flatMap((d) => d.items).filter((i) => i.available === false).length;

  const save = async () => {
    setSaving(true);
    try {
      const res = await api.patch<{ itinerary: SavedItinerary }>(`/itineraries/${id}`, toSaveBody(title, days, itinerary.preferences));
      query.setData(() => res.data.itinerary);
      toast.success('Đã cập nhật lịch trình');
    } catch (error) {
      toast.error('Không lưu được thay đổi', toApiError(error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await api.delete(`/itineraries/${id}`);
      toast.success('Đã xóa lịch trình');
      navigate('/my-itineraries');
    } catch (error) {
      toast.error('Không xóa được lịch trình', toApiError(error).message);
      setDeleting(false);
    }
  };

  return (
    <PageContainer>
      <Breadcrumb items={[{ label: 'Lịch trình đã lưu', to: '/my-itineraries' }, { label: itinerary.title }]} />
      <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full max-w-md">
          <FormField label="Tên lịch trình" error={title.trim().length < 2 ? 'Tên cần ít nhất 2 ký tự' : undefined}>
            <Input
              value={title}
              maxLength={120}
              onChange={(e) => {
                setTitle(e.target.value);
                setDirty(true);
              }}
            />
          </FormField>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => setConfirmDelete(true)} icon={<Trash2 className="size-4 text-red-600" aria-hidden />}>
            Xóa
          </Button>
          <Button onClick={save} loading={saving} disabled={!dirty || title.trim().length < 2 || !days.some((d) => d.items.length)} icon={<Save className="size-4" aria-hidden />}>
            Lưu thay đổi
          </Button>
        </div>
      </div>
      <p className="mt-2 text-xs text-river-500">Đã lưu trong tài khoản · cập nhật {formatDateTime(itinerary.updatedAt)}</p>

      {unavailableCount > 0 && (
        <div className="mt-4">
          <Notice tone="warning" title={`${unavailableCount} địa điểm không còn khả dụng`}>
            Các điểm này đã bị ẩn, tạm ngưng hoặc xóa. Chúng vẫn được giữ trong lịch trình để bạn tham khảo, hãy xóa hoặc thay thế khi cần.
          </Notice>
        </div>
      )}
      <Card className="mt-6 border-none bg-transparent p-0 shadow-none">
        <ItineraryEditor
          days={days}
          dailyLimitMinutes={itinerary.preferences.hoursPerDay ? itinerary.preferences.hoursPerDay * 60 : undefined}
          onChange={(next) => {
            setDays(next);
            setDirty(true);
          }}
        />
      </Card>
      <ConfirmDialog
        open={confirmDelete}
        title="Xóa lịch trình này?"
        message={`Lịch trình “${itinerary.title}” sẽ bị xóa vĩnh viễn khỏi tài khoản.`}
        confirmLabel="Xóa lịch trình"
        loading={deleting}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={remove}
      />
    </PageContainer>
  );
}
