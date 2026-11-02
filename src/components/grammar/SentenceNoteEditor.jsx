import { useLayoutEffect, useRef, useState } from 'react';

export default function SentenceNoteEditor({ anchor, text, existing, error, onChange, onClose, onDelete }) {
  const box = useRef(null), input = useRef(null);
  const [position, setPosition] = useState({ left: 8, top: 8, width: 240, maxHeight: 300 });
  useLayoutEffect(() => {
    const textarea = input.current;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, Math.max(60, window.innerHeight - 130))}px`;
    const update = () => {
      const rect = anchor();
      if (!rect) { onClose(); return; }
      const view = window.visualViewport;
      const leftEdge = view?.offsetLeft || 0, topEdge = view?.offsetTop || 0;
      const width = Math.min(320, Math.max(180, rect.width), (view?.width || window.innerWidth) - 16);
      const height = Math.min(box.current.getBoundingClientRect().height, (view?.height || window.innerHeight) - 16);
      const bottom = topEdge + (view?.height || window.innerHeight);
      const top = rect.bottom + 8 + height <= bottom - 8 ? rect.bottom + 8 : Math.max(topEdge + 8, rect.top - height - 8);
      const next = { left: Math.max(leftEdge + 8, Math.min(rect.left, leftEdge + (view?.width || window.innerWidth) - width - 8)), top,
        width, maxHeight: (view?.height || window.innerHeight) - 16 };
      setPosition(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    };
    update();
    const outside = event => { if (!box.current?.contains(event.target)) onClose(); };
    const escape = event => { if (event.key === 'Escape') { event.stopPropagation(); onClose(); } };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', escape, true);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    window.visualViewport?.addEventListener('resize', update);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('keydown', escape, true);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      window.visualViewport?.removeEventListener('resize', update);
    };
  }, [anchor, text, onClose, position.width]);
  useLayoutEffect(() => { input.current.focus(); }, []);
  return <div ref={box} role="dialog" aria-label="Ghi chú đoạn văn bản" style={{ position: 'fixed', ...position, overflow: 'auto', zIndex: 10000 }}
    className="rounded-xl border border-indigo-400/50 bg-slate-900 p-3 shadow-xl space-y-2">
    <textarea ref={input} aria-label="Nội dung ghi chú" value={text} onChange={event => onChange(event.target.value)} rows={2}
      placeholder="Nghĩa, từ loại hoặc giải thích…" className="w-full resize-none rounded-lg bg-slate-800 p-2 text-sm leading-relaxed text-slate-100 outline-none focus:ring-1 focus:ring-indigo-400" />
    {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={onClose} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs text-white">Xong</button>
      {existing && <button type="button" onClick={onDelete} className="rounded-lg px-2 py-1.5 text-xs text-rose-300 hover:bg-slate-800">Xóa ghi chú</button>}
    </div>
  </div>;
}
