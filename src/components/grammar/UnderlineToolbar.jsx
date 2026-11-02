/**
 * UnderlineToolbar.jsx — Floating color picker for sentence underlines.
 *
 * Renders near the user's text selection; does not steal focus.
 * Props:
 *   position   { top, left } — viewport coordinates (rendered through a portal)
 *   onColor(color)           — user picked a color key or null (erase)
 *   onClose()                — close without action
 */
import { useEffect, useRef } from 'react';
import { UNDERLINE_COLORS } from '../../utils/sentenceUnderline';

const COLOR_KEYS = Object.keys(UNDERLINE_COLORS);

export default function UnderlineToolbar({ position, onColor, onClose, onNote }) {
  const ref = useRef(null);

  // Close on Escape
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Close on outside click — but NOT when clicking inside the toolbar itself
  useEffect(() => {
    function onDown(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    // Use capture so we see the event before React processes it
    document.addEventListener('mousedown', onDown, true);
    return () => document.removeEventListener('mousedown', onDown, true);
  }, [onClose]);

  // Clamp position so toolbar stays within viewport
  const style = {
    position: 'fixed',
    zIndex: 9999,
    top: Math.max(8, Math.min(position.top, window.innerHeight - 64)),
    left: Math.max(8, Math.min(position.left, window.innerWidth - (onNote ? 300 : 220))),
    maxWidth: window.innerWidth - 16,
  };

  return (
    <div
      ref={ref}
      style={style}
      role="toolbar"
      aria-label="Gạch chân màu"
      className="flex flex-wrap items-center gap-1 px-2 py-1.5 rounded-xl bg-slate-800 border border-slate-600/80 shadow-2xl shadow-black/60"
      // Prevent mousedown from clearing selection
      onMouseDown={e => e.preventDefault()}
    >
      {COLOR_KEYS.map(key => (
        <button
          key={key}
          type="button"
          title={UNDERLINE_COLORS[key].label}
          aria-label={UNDERLINE_COLORS[key].label}
          onClick={() => onColor(key)}
          className={`w-6 h-6 rounded-full border-2 ${key === 'white' ? 'border-slate-300/60' : 'border-transparent'} hover:border-white/60 transition-all duration-150 focus:outline-none focus:border-white`}
          style={{ backgroundColor: UNDERLINE_COLORS[key].hex }}
        />
      ))}
      <div className="w-px h-4 bg-slate-600 mx-0.5" aria-hidden="true" />
      {onNote && <button type="button" onClick={onNote} className="px-2 py-0.5 rounded-lg text-xs font-semibold text-indigo-200 hover:bg-slate-700">Ghi chú</button>}
      <button
        type="button"
        title="Bỏ gạch chân"
        aria-label="Bỏ gạch chân"
        onClick={() => onColor(null)}
        className="px-2 py-0.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-700 transition-colors focus:outline-none focus:bg-slate-700"
      >
        Bỏ
      </button>
    </div>
  );
}

