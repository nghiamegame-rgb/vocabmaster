/**
 * UnderlinedSentence.jsx — Renders a Grammar sentence with colored underlines.
 *
 * Features:
 * - Renders multi-span sentence with underline decoration.
 * - Detects mouse-up inside the sentence container and shows the color toolbar.
 * - Calls onUnderlineChange(start, end, color) when user picks a color.
 * - Toolbar floats near selection, does not steal focus, closes on Escape/outside-click.
 * - Only selection inside THIS element is processed (not cross-sentence).
 *
 * Props:
 *   sentence          {string}    — the English sentence text
 *   segments          {Segment[]} — [{start, end, color}] underline data
 *   onUnderlineChange {fn}        — (start, end, color) => void; color=null to erase
 *   className         {string?}   — extra classes for the <p> wrapper
 *   readOnly          {boolean?}  — if true, disable toolbar (display only)
 */
import { useState, useRef, useCallback } from 'react';
import { buildSpans, selectionToRange } from '../../utils/sentenceUnderline';
import UnderlineToolbar from './UnderlineToolbar';

export default function UnderlinedSentence({ sentence, segments, onUnderlineChange, className = '', readOnly = false }) {
  const containerRef = useRef(null);
  const [toolbar, setToolbar] = useState(null); // { top, left, start, end } | null
  // Store selection range so we can apply it after toolbar renders
  const pendingRange = useRef(null);

  const handleMouseUp = useCallback(() => {
    if (readOnly) return;
    const sel = window.getSelection();
    const range = selectionToRange(sel, containerRef.current, sentence);
    if (!range) {
      setToolbar(null);
      return;
    }

    // Compute toolbar position near selection
    const domRange = sel.getRangeAt(0);
    const rect = domRange.getBoundingClientRect();
    // Place toolbar just above the selection, centered
    const toolbarWidth = 200;
    const top  = rect.top + window.scrollY - 44; // ~44px above
    const left = rect.left + window.scrollX + rect.width / 2 - toolbarWidth / 2;

    pendingRange.current = range;
    setToolbar({ top: Math.max(4, top), left, start: range.start, end: range.end });
  }, [readOnly, sentence]);

  const handleColor = useCallback((color) => {
    const range = pendingRange.current;
    if (!range) { setToolbar(null); return; }
    setToolbar(null);
    pendingRange.current = null;
    // Clear browser selection so underline result is visible
    try { window.getSelection()?.removeAllRanges(); } catch { /* ignore */ }
    onUnderlineChange(range.start, range.end, color);
  }, [onUnderlineChange]);

  const handleClose = useCallback(() => {
    setToolbar(null);
    pendingRange.current = null;
  }, []);

  const spans = buildSpans(sentence, segments);

  return (
    <>
      <p
        ref={containerRef}
        className={className}
        onMouseUp={handleMouseUp}
        // Touch support: fire on touchend
        onTouchEnd={handleMouseUp}
        style={{ userSelect: readOnly ? undefined : 'text', cursor: readOnly ? undefined : 'text' }}
      >
        {spans.map((span, i) =>
          span.color ? (
            <span
              key={i}
              style={{
                textDecorationLine: 'underline',
                textDecorationColor: span.color,
                textDecorationThickness: '2.5px',
                textUnderlineOffset: '4px',
              }}
            >
              {span.text}
            </span>
          ) : (
            <span key={i}>{span.text}</span>
          )
        )}
      </p>
      {toolbar && !readOnly && (
        <UnderlineToolbar
          position={{ top: toolbar.top, left: toolbar.left }}
          onColor={handleColor}
          onClose={handleClose}
        />
      )}
    </>
  );
}

