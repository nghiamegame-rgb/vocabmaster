import { ChevronLeft, ChevronRight } from 'lucide-react';

export const PAGE_SIZE = 24;

export default function Pagination({
  page,
  pageCount,
  onChange,
  position,
  label = 'Vocabulary pages',
  selectLabel,
}) {
  const navLabel = position ? `${label} (${position})` : label;
  const pageSelectLabel = selectLabel || (label === 'Vocabulary pages' ? 'Vocabulary page' : label);

  return (
    <nav aria-label={navLabel} className="flex items-center justify-end gap-2 text-sm">
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        aria-label="Previous page"
        className="vm-btn p-2 bg-[var(--sb-paper-card)] border-2 border-[var(--sb-ink)] text-[var(--sb-ink)] rounded-xl disabled:opacity-45 disabled:cursor-not-allowed hover:bg-[var(--sb-paper-deep)] shadow-[var(--sb-shadow-sm)]"
      >
        <ChevronLeft size={16} />
      </button>
      <label className="flex items-center gap-2 text-[var(--sb-ink-soft)] font-semibold">
        Page
        <select
          aria-label={pageSelectLabel}
          value={page}
          onChange={e => onChange(Number(e.target.value))}
          className="vm-input rounded-xl px-2.5 py-1.5 text-[var(--sb-ink)] font-bold"
        >
          {Array.from({ length: pageCount }, (_, i) => (
            <option key={i + 1} value={i + 1}>{i + 1}</option>
          ))}
        </select>
        / {pageCount}
      </label>
      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page === pageCount}
        aria-label="Next page"
        className="vm-btn p-2 bg-[var(--sb-paper-card)] border-2 border-[var(--sb-ink)] text-[var(--sb-ink)] rounded-xl disabled:opacity-45 disabled:cursor-not-allowed hover:bg-[var(--sb-paper-deep)] shadow-[var(--sb-shadow-sm)]"
      >
        <ChevronRight size={16} />
      </button>
    </nav>
  );
}
