import { RotateCcw } from 'lucide-react';
import { AREA_OPTIONS, CATEGORY_OPTIONS } from '../../lib/catalog';
import type { Area, Category } from '../../types/api';
import { ChipToggle } from '../ui/Field';
import { CategoryIcon } from './CategoryIcon';

export interface DestinationFilters {
  category: Category[];
  area: Area[];
  hasActivity: boolean;
}

function toggle<T>(list: T[], value: T, on: boolean): T[] {
  return on ? [...new Set([...list, value])] : list.filter((v) => v !== value);
}

export function FilterPanel({ value, onChange }: { value: DestinationFilters; onChange: (next: DestinationFilters) => void }) {
  const active = value.category.length + value.area.length + (value.hasActivity ? 1 : 0);
  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-river-800">Loại hình / sở thích</legend>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_OPTIONS.map((option) => (
            <ChipToggle
              key={option.value}
              checked={value.category.includes(option.value)}
              onChange={(on) => onChange({ ...value, category: toggle(value.category, option.value, on) })}
              icon={<CategoryIcon category={option.value} className="size-4" />}
            >
              {option.label}
            </ChipToggle>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-river-800">Khu vực</legend>
        <div className="flex flex-wrap gap-2">
          {AREA_OPTIONS.map((option) => (
            <ChipToggle
              key={option.value}
              checked={value.area.includes(option.value)}
              onChange={(on) => onChange({ ...value, area: toggle(value.area, option.value, on) })}
            >
              {option.label}
            </ChipToggle>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ChipToggle checked={value.hasActivity} onChange={(on) => onChange({ ...value, hasActivity: on })}>
          Chỉ điểm có QR / thử thách
        </ChipToggle>
        {active > 0 && (
          <button
            type="button"
            onClick={() => onChange({ category: [], area: [], hasActivity: false })}
            className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-river-600 hover:text-leaf-700"
          >
            <RotateCcw className="size-4" aria-hidden />
            Xóa bộ lọc ({active})
          </button>
        )}
      </div>
    </div>
  );
}
