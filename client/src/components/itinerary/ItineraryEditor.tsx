import { AlertCircle, ArrowDown, ArrowUp, CalendarPlus, Clock, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApiQuery } from '../../hooks/useApiQuery';
import { api } from '../../lib/api';
import { DEFAULT_VISIT_MINUTES, areaLabel, categoryLabel } from '../../lib/catalog';
import { formatMinutes } from '../../lib/format';
import {
  MAX_DAYS,
  addDay,
  addItem,
  containsDestination,
  dayTotals,
  moveItem,
  moveItemToDay,
  removeDay,
  removeItem,
  tripTotal,
  type DraftDay,
} from '../../lib/itineraryOps';
import type { DestinationSummary, Paginated, PlannedItem } from '../../types/api';
import { CategoryIcon } from '../destination/CategoryIcon';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Modal } from '../ui/Modal';
import { SearchBar } from '../ui/Navigation';
import { ErrorState, Skeleton } from '../ui/States';

function toPlannedItem(d: DestinationSummary): PlannedItem {
  return {
    destinationId: d.id,
    slug: d.slug,
    name: d.name,
    category: d.category,
    area: d.area,
    durationMinutes: d.estimatedVisitDuration?.minutes ?? DEFAULT_VISIT_MINUTES,
    durationIsEstimate: true,
    durationIsDefault: !d.estimatedVisitDuration,
    reasons: ['Bạn tự thêm'],
    available: true,
  };
}

function AddDestinationModal({
  open,
  dayNumber,
  days,
  onClose,
  onAdd,
}: {
  open: boolean;
  dayNumber: number;
  days: DraftDay[];
  onClose: () => void;
  onAdd: (item: PlannedItem) => void;
}) {
  const [q, setQ] = useState('');
  const results = useApiQuery(
    (signal) =>
      open
        ? api.get<Paginated<DestinationSummary>>('/destinations', { params: { q: q || undefined, limit: 20 }, signal }).then((r) => r.data.items)
        : Promise.resolve([]),
    [q, open],
  );
  return (
    <Modal open={open} onClose={onClose} title={`Thêm địa điểm vào ngày ${dayNumber}`} size="lg">
      <SearchBar value={q} onSearch={setQ} label="Tìm địa điểm để thêm" />
      <div className="mt-4">
        {results.loading ? (
          <div className="space-y-2">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        ) : results.error ? (
          <ErrorState error={results.error} onRetry={results.reload} />
        ) : results.data?.length === 0 ? (
          <p className="py-6 text-center text-sm text-river-600">Không có địa điểm phù hợp.</p>
        ) : (
          <ul className="divide-y divide-sand-200">
            {results.data?.map((d) => {
              const added = containsDestination(days, d.id);
              const unavailable = d.operationalStatus !== 'active';
              return (
                <li key={d.id} className="flex items-center gap-3 py-3">
                  <CategoryIcon category={d.category} className="size-5 shrink-0 text-leaf-600" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-river-900">{d.name}</p>
                    <p className="text-xs text-river-500">
                      {areaLabel(d.area)} · {d.estimatedVisitDuration ? formatMinutes(d.estimatedVisitDuration.minutes) : 'chưa có thời lượng'}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={added ? 'ghost' : 'secondary'}
                    disabled={added || unavailable}
                    onClick={() => onAdd(toPlannedItem(d))}
                  >
                    {added ? 'Đã có' : unavailable ? 'Không hoạt động' : 'Thêm'}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}

export function ItineraryEditor({ days, onChange, dailyLimitMinutes }: { days: DraftDay[]; onChange: (days: DraftDay[]) => void; dailyLimitMinutes?: number }) {
  const [addingTo, setAddingTo] = useState<number | null>(null);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-river-700">
          Tổng thời lượng dự kiến: <strong className="text-river-900">{formatMinutes(tripTotal(days))}</strong>
          <span className="text-river-500"> (gồm 30 phút dự phòng giữa các điểm, chưa phải thời gian di chuyển thực tế)</span>
        </p>
        <Button variant="secondary" size="sm" onClick={() => onChange(addDay(days))} disabled={days.length >= MAX_DAYS} icon={<CalendarPlus className="size-4" aria-hidden />}>
          Thêm ngày
        </Button>
      </div>

      {days.map((day, dayIndex) => {
        const totals = dayTotals(day.items);
        const over = dailyLimitMinutes !== undefined && totals.total > dailyLimitMinutes;
        return (
          <Card key={dayIndex} className="p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sand-200 pb-3">
              <h3 className="text-lg">Ngày {dayIndex + 1}</h3>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 text-sm ${over ? 'font-semibold text-lotus-700' : 'text-river-600'}`}>
                  <Clock className="size-4" aria-hidden />
                  {formatMinutes(totals.total)}
                  {over && ' · vượt giới hạn ngày'}
                </span>
                {days.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onChange(removeDay(days, dayIndex))}
                    aria-label={`Xóa ngày ${dayIndex + 1} (các điểm được chuyển sang ngày bên cạnh)`}
                    title="Xóa ngày (các điểm được chuyển sang ngày bên cạnh)"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                )}
              </div>
            </div>

            {day.items.length === 0 ? (
              <p className="py-5 text-sm text-river-500">Chưa có địa điểm cho ngày này.</p>
            ) : (
              <ol className="divide-y divide-sand-200">
                {day.items.map((item, itemIndex) => (
                  <li key={item.destinationId} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-leaf-50 text-sm font-bold text-leaf-700">
                      {itemIndex + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {item.available === false ? (
                          <span className="font-semibold text-river-500 line-through">{item.name}</span>
                        ) : (
                          <Link to={`/destinations/${item.slug}`} className="font-semibold text-river-900 hover:text-leaf-700 hover:underline">
                            {item.name}
                          </Link>
                        )}
                        {item.category && <Badge>{categoryLabel(item.category)}</Badge>}
                      </div>
                      <p className="mt-1 text-sm text-river-600">
                        {formatMinutes(item.durationMinutes)}
                        {item.durationIsDefault ? ' · thời lượng mặc định (chưa có dữ liệu)' : ' · ước tính'}
                      </p>
                      {item.available === false && (
                        <p className="mt-1 inline-flex items-center gap-1 text-sm text-lotus-700">
                          <AlertCircle className="size-4" aria-hidden />
                          {item.unavailableReason ?? 'Địa điểm không còn khả dụng'}
                        </p>
                      )}
                      {item.reasons && item.reasons.length > 0 && (
                        <ul className="mt-1.5 flex flex-wrap gap-1.5">
                          {item.reasons.map((reason) => (
                            <li key={reason} className="rounded-full bg-sand-100 px-2 py-0.5 text-xs text-river-600">
                              {reason}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1 sm:justify-end">
                      <Button variant="ghost" size="sm" onClick={() => onChange(moveItem(days, dayIndex, itemIndex, -1))} disabled={itemIndex === 0} aria-label={`Đưa ${item.name} lên trước`}>
                        <ArrowUp className="size-4" aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onChange(moveItem(days, dayIndex, itemIndex, 1))}
                        disabled={itemIndex === day.items.length - 1}
                        aria-label={`Đưa ${item.name} xuống sau`}
                      >
                        <ArrowDown className="size-4" aria-hidden />
                      </Button>
                      {days.length > 1 && (
                        <select
                          aria-label={`Chuyển ${item.name} sang ngày khác`}
                          value={dayIndex}
                          onChange={(event) => onChange(moveItemToDay(days, dayIndex, itemIndex, Number(event.target.value)))}
                          className="min-h-9 rounded-control border border-sand-300 bg-white px-2 text-sm"
                        >
                          {days.map((_, i) => (
                            <option key={i} value={i}>
                              Ngày {i + 1}
                            </option>
                          ))}
                        </select>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => onChange(removeItem(days, dayIndex, itemIndex))} aria-label={`Xóa ${item.name} khỏi lịch trình`}>
                        <Trash2 className="size-4 text-red-600" aria-hidden />
                      </Button>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            <Button variant="secondary" size="sm" className="mt-2" onClick={() => setAddingTo(dayIndex)} icon={<Plus className="size-4" aria-hidden />}>
              Thêm địa điểm
            </Button>
          </Card>
        );
      })}

      <AddDestinationModal
        open={addingTo !== null}
        dayNumber={(addingTo ?? 0) + 1}
        days={days}
        onClose={() => setAddingTo(null)}
        onAdd={(item) => {
          if (addingTo === null) return;
          onChange(addItem(days, addingTo, item));
          setAddingTo(null);
        }}
      />
    </div>
  );
}

export function toSaveBody(title: string, days: DraftDay[], preferences?: { areas?: string[]; interests?: string[]; hoursPerDay?: number }) {
  return {
    title,
    preferences: preferences ?? {},
    days: days.map((day) => ({ items: day.items.map((item) => ({ destinationId: item.destinationId })) })),
  };
}
