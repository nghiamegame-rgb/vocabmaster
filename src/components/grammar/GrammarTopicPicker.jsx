import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown, Lock } from 'lucide-react';

/**
 * GrammarTopicPicker — dropdown chọn chủ đề cho prompt tạo câu, mỗi chủ đề có ô tick tay.
 * Chủ đề đã tick: dòng đổi sang màu xanh và bị khóa (không chọn được để tạo prompt).
 * Ô tick vẫn bấm được để bỏ tick. "Tổng hợp" (không có ô tick) luôn chọn được.
 *
 * Props:
 *  - options: [{ value, label, group }] từ buildGenerationTopicOptions
 *  - value: chủ đề đang chọn
 *  - doneTopics: mảng các chủ đề đã tick
 *  - onChange(value), onToggleDone(value, done)
 */
export default function GrammarTopicPicker({ options = [], value, doneTopics = [], onChange, onToggleDone }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const listId = useId();
  const done = new Set(doneTopics);
  const selected = options.find(opt => opt.value === value);

  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    }
    function onKeyDown(event) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function renderRow(opt) {
    const tickable = opt.value !== 'Mixed' && opt.group !== null;
    const isDone = tickable && done.has(opt.value);
    const isSelected = opt.value === value;
    return (
      <li
        key={opt.value}
        role="option"
        aria-selected={isSelected}
        aria-disabled={isDone || undefined}
        data-topic={opt.value}
        data-done={isDone ? 'true' : 'false'}
        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border ${
          isDone
            ? 'bg-[var(--sb-forest-soft)] border-[var(--sb-forest)] text-[var(--sb-forest-text)]'
            : isSelected
              ? 'bg-[var(--sb-plum-soft)] border-[var(--sb-plum)]/50 text-[var(--sb-ink)]'
              : 'bg-transparent border-transparent text-[var(--sb-ink)] hover:bg-[var(--sb-paper-deep)]'
        }`}
      >
        {tickable ? (
          <input
            type="checkbox"
            checked={isDone}
            onChange={e => onToggleDone?.(opt.value, e.target.checked)}
            aria-label={`Đã đủ câu: ${opt.label}`}
            className="shrink-0 w-4 h-4 cursor-pointer accent-[var(--sb-forest)]"
          />
        ) : (
          <span className="shrink-0 w-4 h-4" aria-hidden="true" />
        )}
        <button
          type="button"
          disabled={isDone}
          onClick={() => { onChange?.(opt.value); setOpen(false); }}
          title={isDone ? 'Đã tick đủ câu — bỏ tick để tạo prompt cho chủ đề này' : undefined}
          className={`flex-1 min-w-0 text-left text-sm py-0.5 ${isDone ? 'cursor-not-allowed font-semibold' : 'cursor-pointer'}`}
        >
          <span className={isDone ? 'line-through decoration-[var(--sb-forest)]/60' : ''}>{opt.label}</span>
        </button>
        {isDone && <Lock size={14} className="shrink-0" aria-hidden="true" />}
      </li>
    );
  }

  // Giữ thứ tự: mục không nhóm (Tổng hợp) trước, rồi lần lượt từng nhóm.
  const top = options.filter(opt => !opt.group);
  const groups = [];
  for (const opt of options) {
    if (!opt.group) continue;
    let g = groups.find(item => item[0] === opt.group);
    if (!g) { g = [opt.group, []]; groups.push(g); }
    g[1].push(opt);
  }

  const selectedDone = selected && selected.group !== null && done.has(selected.value);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        id="grammar-topic-picker"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen(v => !v)}
        className={`w-full vm-input rounded-xl px-3 py-2 text-sm flex items-center justify-between gap-2 text-left ${
          selectedDone ? '!bg-[var(--sb-forest-soft)] !border-[var(--sb-forest)] text-[var(--sb-forest-text)]' : ''
        }`}
      >
        <span className="truncate">{selected?.label || 'Chọn chủ đề'}</span>
        {selectedDone ? <Lock size={14} className="shrink-0" /> : <ChevronDown size={16} className="shrink-0" />}
      </button>

      {open && (
        <div
          id={listId}
          role="listbox"
          aria-label="Chủ đề ngữ pháp"
          className="absolute z-30 left-0 right-0 sm:right-auto sm:min-w-[22rem] mt-1 max-h-80 overflow-y-auto rounded-xl border-2 border-[var(--sb-ink)] bg-[var(--sb-paper-card)] shadow-[var(--sb-shadow-md)] p-1.5"
        >
          <p className="px-2 pt-1 pb-1.5 text-xs text-[var(--sb-ink-soft)] flex items-center gap-1">
            <Check size={12} aria-hidden="true" /> Tick khi chủ đề đã đủ câu — dòng đó sẽ khóa, không tạo prompt được.
          </p>
          <ul className="space-y-0.5">
            {top.map(renderRow)}
            {groups.map(([groupLabel, groupOptions]) => (
              <li key={groupLabel} role="presentation">
                <p className="px-2 pt-2 pb-1 text-xs font-bold text-[var(--sb-ink)]">{groupLabel}</p>
                <ul className="space-y-0.5">{groupOptions.map(renderRow)}</ul>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
