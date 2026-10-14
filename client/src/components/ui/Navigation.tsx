import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from './Button';

export function Breadcrumb({ items }: { items: Array<{ label: string; to?: string }> }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-river-500">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1">
            {index > 0 && <ChevronRight className="size-3.5 shrink-0" aria-hidden />}
            {item.to ? (
              <Link to={item.to} className="hover:text-leaf-700 hover:underline">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="truncate font-medium text-river-800">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (page: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <nav className="flex items-center justify-center gap-3" aria-label="Phân trang">
      <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)} icon={<ChevronLeft className="size-4" aria-hidden />}>
        Trước
      </Button>
      <span className="text-sm text-river-600">
        Trang <strong className="text-river-900">{page}</strong> / {totalPages}
      </span>
      <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
        Sau
        <ChevronRight className="size-4" aria-hidden />
      </Button>
    </nav>
  );
}

/** Search input that reports its value on submit and after a short typing pause. */
export function SearchBar({
  value,
  onSearch,
  placeholder = 'Tìm địa điểm, ví dụ: Tràm Chim, nhà cổ…',
  label = 'Tìm kiếm địa điểm',
  debounceMs = 350,
  size = 'md',
}: {
  value: string;
  onSearch: (value: string) => void;
  placeholder?: string;
  label?: string;
  debounceMs?: number;
  size?: 'md' | 'lg';
}) {
  const inputId = useId();
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  useEffect(() => {
    if (debounceMs <= 0 || draft.trim() === value) return;
    const handle = window.setTimeout(() => onSearch(draft.trim()), debounceMs);
    return () => window.clearTimeout(handle);
  }, [draft, value, debounceMs, onSearch]);

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        onSearch(draft.trim());
      }}
      className="relative w-full"
    >
      <label className="sr-only" htmlFor={inputId}>
        {label}
      </label>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-river-400" aria-hidden />
      <input
        id={inputId}
        type="search"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={placeholder}
        maxLength={100}
        className={`w-full rounded-full border border-sand-300 bg-white pl-11 pr-28 text-river-950 shadow-card placeholder:text-river-400 focus:border-leaf-500 focus:outline-none focus:ring-2 focus:ring-leaf-100 ${size === 'lg' ? 'min-h-14 text-base' : 'min-h-12 text-sm'}`}
      />
      <Button type="submit" size="sm" className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full">
        Tìm kiếm
      </Button>
    </form>
  );
}
