import clsx from 'clsx';
import {
  ArrowRight,
  BookMarked,
  CalendarDays,
  CheckCircle2,
  Clock,
  History,
  MapPin,
  PlayCircle,
  Plus,
  Route,
  Save,
  Sparkles,
  Trash2,
  Wallet,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ItineraryEditor, toSaveBody } from '../components/itinerary/ItineraryEditor';
import { V9ItineraryView } from '../components/itinerary/V9ItineraryView';
import { formatVndShort } from '../components/itinerary/v9Meta';
import { PageContainer } from '../components/layout/PublicLayout';
import { Badge } from '../components/ui/Badge';
import { Button, ButtonLink } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
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
import type {
  ItineraryListItem,
  SavedItinerary,
  V9Place,
  V9ReplanResponse,
} from '../types/api';

function makeEventId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `evt_${crypto.randomUUID()}`;
  }
  return `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function MyItinerariesPage() {
  useDocumentTitle('Lịch trình đã lưu');
  const list = useApiQuery(
    (signal) =>
      api.get<{ items: ItineraryListItem[] }>('/itineraries/my', { signal }).then((r) => r.data.items),
    [],
  );

  const items = list.data ?? [];
  const v9Count = items.filter((i) => i.plannerVersion === 'v9').length;
  const totalDays = items.reduce((sum, i) => sum + (i.numberOfDays || 0), 0);

  return (
    <PageContainer>
      {/* Hero Banner */}
      <section className="tp-fade-up relative overflow-hidden rounded-panel bg-gradient-to-br from-leaf-900 via-leaf-800 to-leaf-600 p-6 text-white shadow-raised sm:p-8">
        <div className="pointer-events-none absolute -right-12 -top-16 size-64 rounded-full bg-lotus-300/20 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-16 left-12 size-64 rounded-full bg-leaf-300/20 blur-3xl" aria-hidden />
        <div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold ring-1 ring-white/20">
              <BookMarked className="size-3.5 text-teal-200" aria-hidden />
              Bộ sưu tập hành trình
            </span>
            <h1 className="mt-3 text-3xl text-white sm:text-4xl">Lịch trình đã lưu</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-leaf-100 sm:text-base">
              Quản lý các chuyến đi của bạn, mở lịch trình Trip Planner V9 để bấm xác nhận giờ đến/giờ rời thực tế và nhận chỉ đường tới điểm tiếp theo.
            </p>
          </div>
          <ButtonLink to="/itinerary/create" variant="inverted" size="lg" icon={<Plus className="size-5" aria-hidden />}>
            Tạo lịch trình mới
          </ButtonLink>
        </div>

        {items.length > 0 && (
          <div className="relative mt-6 grid grid-cols-3 gap-3 sm:max-w-lg">
            <div className="rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/15 backdrop-blur-sm">
              <p className="text-xs text-leaf-100">Đã lưu</p>
              <p className="mt-0.5 text-xl font-extrabold text-white">{items.length} chuyến</p>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/15 backdrop-blur-sm">
              <p className="text-xs text-leaf-100">Trip Planner V9</p>
              <p className="mt-0.5 text-xl font-extrabold text-white">{v9Count} lịch</p>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/15 backdrop-blur-sm">
              <p className="text-xs text-leaf-100">Tổng thời lượng</p>
              <p className="mt-0.5 text-xl font-extrabold text-white">{totalDays} ngày</p>
            </div>
          </div>
        )}
      </section>

      <div className="mt-8">
        {list.loading ? (
          <CardGridSkeleton count={3} />
        ) : list.error ? (
          <ErrorState error={list.error} onRetry={list.reload} />
        ) : items.length > 0 ? (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((it, idx) => (
              <li key={it.id} className="tp-fade-up" style={{ animationDelay: `${idx * 60}ms` }}>
                <Link
                  to={`/itinerary/${it.id}`}
                  className="group relative flex h-full flex-col overflow-hidden rounded-card bg-white p-5 shadow-card ring-1 ring-sand-200 transition-all duration-300 hover:-translate-y-1 hover:shadow-raised hover:ring-leaf-300"
                >
                  <span
                    className={clsx(
                      'absolute inset-x-0 top-0 h-1.5',
                      it.plannerVersion === 'v9'
                        ? 'bg-gradient-to-r from-leaf-600 via-teal-400 to-leaf-500'
                        : 'bg-sand-200',
                    )}
                    aria-hidden
                  />
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {it.plannerVersion === 'v9' && (
                      <Badge tone="teal" icon={<Sparkles className="size-3" aria-hidden />}>
                        Trip Planner V9 · v{it.itineraryVersion ?? 1}
                      </Badge>
                    )}
                    {it.status && (
                      <Badge tone={it.status === 'needs_revision' ? 'lotus' : 'leaf'}>
                        {it.status === 'needs_revision' ? 'Cần xem lại' : 'Khả thi'}
                      </Badge>
                    )}
                  </div>

                  <h2 className="mt-3 text-lg font-bold text-river-900 transition-colors group-hover:text-leaf-700">
                    {it.title}
                  </h2>

                  <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-sand-50 p-3 text-xs text-river-600">
                    <span className="flex items-center gap-1.5">
                      <CalendarDays className="size-3.5 text-leaf-600" aria-hidden />
                      <strong className="text-river-900">{it.numberOfDays} ngày</strong>
                      {it.startDate ? ` (${it.startDate.slice(8, 10)}/${it.startDate.slice(5, 7)})` : ''}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MapPin className="size-3.5 text-leaf-600" aria-hidden />
                      <strong className="text-river-900">{it.destinationCount}</strong> lượt ghé
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="size-3.5 text-river-400" aria-hidden />
                      {formatMinutes(it.estimatedDurationMinutes)}
                    </span>
                    {it.budgetVnd ? (
                      <span className="flex items-center gap-1.5">
                        <Wallet className="size-3.5 text-teal-600" aria-hidden />
                        {formatVndShort(it.budgetVnd)}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-auto flex items-center justify-between border-t border-sand-100 pt-4 text-xs">
                    <span className="text-river-500">Cập nhật {formatDateTime(it.updatedAt)}</span>
                    <span className="inline-flex items-center gap-1 font-semibold text-leaf-700 transition-transform duration-200 group-hover:translate-x-1">
                      Mở lịch trình
                      <ArrowRight className="size-3.5" aria-hidden />
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={<BookMarked className="size-6" aria-hidden />}
            title="Bạn chưa lưu lịch trình nào"
            description="Tạo lịch trình theo sở thích hoặc chọn tay rồi bấm “Lưu lịch trình”."
            action={<ButtonLink to="/itinerary/create">Lập lịch trình ngay</ButtonLink>}
          />
        )}
      </div>
    </PageContainer>
  );
}

export function ItineraryDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const query = useApiQuery(
    (signal) =>
      api.get<{ itinerary: SavedItinerary }>(`/itineraries/${id}`, { signal }).then((r) => r.data.itinerary),
    [id],
  );
  const placesQuery = useApiQuery(
    (signal) =>
      api
        .get<{ places: V9Place[]; serviceOnline: boolean }>('/trip-planner/places', { signal })
        .then((r) => r.data.places),
    [],
  );

  const placesById = useMemo(
    () => new Map((placesQuery.data ?? []).map((p) => [p.id, p])),
    [placesQuery.data],
  );

  const [title, setTitle] = useState('');
  const [days, setDays] = useState<DraftDay[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [replanningStopId, setReplanningStopId] = useState<string | null>(null);

  const pendingEventIdsRef = useRef<Map<string, string>>(new Map());

  useDocumentTitle(query.data?.title ?? 'Lịch trình');

  useEffect(() => {
    if (!query.data) return;
    setTitle(query.data.title);
    setDays(query.data.days.map((d) => ({ items: d.items })));
    setDirty(false);
  }, [query.data]);

  if (query.loading) {
    return (
      <PageContainer>
        <PageLoader />
      </PageContainer>
    );
  }
  if (query.error || !query.data) {
    return (
      <PageContainer>
        {query.error?.status === 404 ? (
          <EmptyState
            title="Không tìm thấy lịch trình"
            description="Lịch trình không tồn tại hoặc không thuộc tài khoản của bạn."
            action={<ButtonLink to="/my-itineraries">Về danh sách</ButtonLink>}
          />
        ) : (
          <ErrorState error={query.error} onRetry={query.reload} />
        )}
      </PageContainer>
    );
  }

  const itinerary = query.data;
  const isV9 = itinerary.plannerVersion === 'v9' || Boolean(itinerary.v9Itinerary);
  const unavailableCount = days.flatMap((d) => d.items).filter((i) => i.available === false).length;

  const save = async () => {
    setSaving(true);
    try {
      const body = isV9
        ? { title: title.trim() }
        : toSaveBody(title, days, itinerary.preferences);
      const res = await api.patch<{ itinerary: SavedItinerary }>(`/itineraries/${id}`, body);
      query.setData(() => res.data.itinerary);
      setDirty(false);
      toast.success('Đã cập nhật lịch trình');
    } catch (error) {
      toast.error('Không lưu được thay đổi', toApiError(error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleReplan = async (params: {
    stopId: string;
    event: 'arrived' | 'departed';
    occurredAt: string;
  }) => {
    const dedupeKey = `${params.stopId}:${params.event}:${params.occurredAt}`;
    let eventId = pendingEventIdsRef.current.get(dedupeKey);
    if (!eventId) {
      eventId = makeEventId();
      pendingEventIdsRef.current.set(dedupeKey, eventId);
    }

    setReplanningStopId(params.stopId);
    try {
      const res = await api.post<{
        replan: V9ReplanResponse;
        itinerary: SavedItinerary;
        idempotentReplay: boolean;
      }>(`/itineraries/${id}/replan`, {
        itinerary_version: itinerary.itineraryVersion ?? 1,
        event_id: eventId,
        stop_id: params.stopId,
        event: params.event,
        occurred_at: params.occurredAt,
      });

      pendingEventIdsRef.current.delete(dedupeKey);
      query.setData(() => res.data.itinerary);

      if (params.event === 'arrived') {
        toast.success(
          'Đã xác nhận đến nơi (arrived)',
          res.data.replan.issues.length > 0
            ? 'Lưu ý: có một số chặng tiếp theo gặp vướng mắc khung giờ.'
            : 'Đã tính giờ rời dự kiến và cập nhật các lượt tiếp theo.',
        );
      } else {
        toast.success(
          'Đã hoàn thành lượt ghé (departed)',
          res.data.replan.next_stop
            ? `Điểm tiếp theo: ${res.data.replan.next_stop.name}`
            : 'Đã cập nhật lịch trình còn lại trong ngày.',
        );
      }
    } catch (error) {
      const apiErr = toApiError(error);
      toast.error('Không cập nhật được tiến độ', apiErr.message);
      if (apiErr.code === 'ITINERARY_VERSION_MISMATCH') {
        query.reload();
      }
    } finally {
      setReplanningStopId(null);
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
      <Breadcrumb
        items={[{ label: 'Lịch trình đã lưu', to: '/my-itineraries' }, { label: itinerary.title }]}
      />

      <Card className="tp-fade-up mt-4 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="w-full max-w-lg">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {isV9 && (
                <Badge tone="teal" icon={<Sparkles className="size-3" aria-hidden />}>
                  Trip Planner V9 · Phiên bản v{itinerary.itineraryVersion ?? 1}
                </Badge>
              )}
              <span className="text-xs text-river-500">
                Cập nhật {formatDateTime(itinerary.updatedAt)}
              </span>
            </div>
            <FormField
              label="Tên lịch trình"
              error={title.trim().length < 2 ? 'Tên cần ít nhất 2 ký tự' : undefined}
            >
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
            <ButtonLink
              to="/itinerary/create"
              variant="secondary"
              size="sm"
              icon={<Route className="size-4" aria-hidden />}
            >
              Lập lịch mới
            </ButtonLink>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmDelete(true)}
              icon={<Trash2 className="size-4 text-red-600" aria-hidden />}
            >
              Xóa
            </Button>
            <Button
              size="sm"
              onClick={save}
              loading={saving}
              disabled={
                !dirty ||
                title.trim().length < 2 ||
                (!isV9 && !days.some((d) => d.items.length))
              }
              icon={<Save className="size-4" aria-hidden />}
            >
              Lưu tên lịch trình
            </Button>
          </div>
        </div>
      </Card>

      {isV9 && itinerary.v9Itinerary ? (
        <div className="mt-6 space-y-6">
          {/* Interactive 2-step Live Replan Guide */}
          <div className="tp-fade-up grid gap-3 rounded-card border border-leaf-200 bg-gradient-to-r from-leaf-50 via-white to-teal-50/40 p-4 sm:grid-cols-2 sm:p-5">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-leaf-600 text-white shadow-cta">
                <PlayCircle className="size-5" aria-hidden />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-leaf-700">Bước 1 · Khi tới điểm dừng</p>
                <p className="mt-0.5 text-sm font-semibold text-river-900">Bấm “Tôi đã đến nơi” (arrived)</p>
                <p className="mt-0.5 text-xs text-river-600">
                  Hệ thống ghi nhận giờ đến thực tế và tính giờ rời dự kiến cho điểm hiện tại.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-teal-500 text-white shadow-card">
                <CheckCircle2 className="size-5" aria-hidden />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-teal-700">Bước 2 · Khi chuẩn bị rời điểm</p>
                <p className="mt-0.5 text-sm font-semibold text-river-900">Bấm “Hoàn thành và đi tiếp” (departed)</p>
                <p className="mt-0.5 text-xs text-river-600">
                  Tự động tính lại tuyến Valhalla, cập nhật các điểm còn lại và mở chỉ đường tới Next Stop.
                </p>
              </div>
            </div>
          </div>

          <V9ItineraryView
            itinerary={itinerary.v9Itinerary}
            primaryPlaces={itinerary.v9Meta?.primary_places ?? []}
            itineraryVersion={itinerary.itineraryVersion ?? 1}
            placesById={placesById}
            onReplan={handleReplan}
            replanningStopId={replanningStopId}
          />

          {/* Replan History Log */}
          {itinerary.replanHistory && itinerary.replanHistory.length > 0 && (
            <Card className="tp-fade-up p-5 sm:p-6">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="grid size-9 place-items-center rounded-xl bg-leaf-50 text-leaf-700 ring-1 ring-leaf-100">
                    <History className="size-5" aria-hidden />
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-river-900">
                      Nhật ký cập nhật tiến độ ({itinerary.replanHistory.length} sự kiện)
                    </h3>
                    <p className="text-xs text-river-500">Mỗi sự kiện tạo một phiên bản lịch trình mới và chống gửi trùng bằng event_id.</p>
                  </div>
                </div>
                <Badge tone="teal">Hiện tại: v{itinerary.itineraryVersion ?? 1}</Badge>
              </div>
              <ol className="relative mt-4 space-y-2.5 before:absolute before:bottom-3 before:left-4 before:top-3 before:w-0.5 before:bg-sand-200">
                {itinerary.replanHistory.map((evt) => (
                  <li
                    key={evt.eventId}
                    className="relative flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-sand-50/80 py-2.5 pl-10 pr-4 text-xs text-river-700 ring-1 ring-sand-200/80"
                  >
                    <span
                      className={clsx(
                        'absolute left-2.5 grid size-3.5 place-items-center rounded-full ring-4 ring-white',
                        evt.event === 'arrived' ? 'bg-teal-500' : 'bg-leaf-600',
                      )}
                      aria-hidden
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={evt.event === 'arrived' ? 'teal' : 'leaf'}>
                        {evt.event === 'arrived' ? 'Tôi đã đến nơi (arrived)' : 'Hoàn thành & đi tiếp (departed)'}
                      </Badge>
                      <span className="font-semibold text-river-900">
                        Giờ thực tế: {evt.occurredAt}
                      </span>
                      <span className="text-river-400">
                        (stop: {evt.stopId.slice(0, 8)}…)
                      </span>
                    </div>
                    <span className="rounded-full bg-leaf-100 px-2.5 py-0.5 font-bold text-leaf-800">
                      → v{evt.itineraryVersion}
                    </span>
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </div>
      ) : (
        <>
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
              dailyLimitMinutes={
                itinerary.preferences.hoursPerDay
                  ? itinerary.preferences.hoursPerDay * 60
                  : undefined
              }
              onChange={(next) => {
                setDays(next);
                setDirty(true);
              }}
            />
          </Card>
        </>
      )}

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
