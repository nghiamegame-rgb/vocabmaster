/**
 * sentenceUnderline.js — Underline markup for Grammar sentences.
 *
 * Data model: each underline is { start, end, color }
 *   - start/end: Unicode codepoint offsets into the sentence string (≥0, start < end)
 *   - color: one of UNDERLINE_COLORS keys ('yellow'|'blue'|'green'|'pink'|'white'), or null to erase
 *
 * Storage: via grammarStorage.js (LS_GRAMMAR_UNDERLINES = 'vocabmaster_grammar_underlines')
 *   Stored as { [sentenceKey: string]: Segment[] }
 *
 * Sentence key strategy:
 *   - Saved sentences (in library): savedId  e.g. "gq_1234_abc"
 *   - Unsaved practice sentences:   "text:" + sentence.trim()
 *   When a practice sentence is saved, grammarStorage.migrateUnderlineKey() moves marks
 *   from text-key to savedId-key. All three screens (Practice/Saved/Review) then use the
 *   same savedId-key, so marks are shared and consistent.
 *
 * Unicode: positions count Unicode codepoints (Array.from length), not UTF-16 code units.
 * This means emoji and supplementary characters count as 1 position each.
 *
 * Overlap rules: new segment replaces existing colour in its range only; parts outside
 * the new range keep their existing colour. Adjacent same-colour segments are merged.
 * Null colour erases the range.
 *
 * If stored positions fall outside the current sentence length (e.g. sentence was edited),
 * validateSegment returns null and the segment is silently skipped in rendering.
 */

export const UNDERLINE_COLORS = {
  yellow: { hex: '#FACC15', label: 'Vàng' },
  blue:   { hex: '#38BDF8', label: 'Xanh da trời' },
  green:  { hex: '#4ADE80', label: 'Xanh lá' },
  pink:   { hex: '#F472B6', label: 'Hồng' },
  white:  { hex: '#FFFFFF', label: 'Trắng — Đánh dấu chung' },
};

// ── Key helpers ───────────────────────────────────────────────────────────────

/** Build the underline storage key for an unsaved practice sentence. */
export function textKey(sentence) {
  return 'text:' + (sentence || '').trim();
}

// ── Codepoint helpers ────────────────────────────────────────────────────────

/** Convert string to codepoint array. */
export function toCodepoints(str) {
  return Array.from(str || '');
}

/** Length in codepoints. */
export function cpLength(str) {
  return toCodepoints(str).length;
}

// ── Segment validation & normalization ────────────────────────────────────────

/**
 * @typedef {{ start: number, end: number, color: string }} Segment
 */

/**
 * Validate and clamp a segment against the sentence codepoint length.
 * Returns null if segment is invalid, empty, or completely out of range.
 */
export function validateSegment(seg, sentenceLen) {
  if (!seg || typeof seg.start !== 'number' || typeof seg.end !== 'number') return null;
  if (!seg.color || !UNDERLINE_COLORS[seg.color]) return null;
  const start = Math.max(0, Math.min(Math.floor(seg.start), sentenceLen));
  const end   = Math.max(0, Math.min(Math.floor(seg.end),   sentenceLen));
  if (start >= end) return null;
  return { start, end, color: seg.color };
}

/**
 * Sort, clamp, drop invalid/empty, and merge adjacent same-colour segments.
 * @param {Segment[]} segments
 * @param {number}    sentenceLen — codepoint length of the sentence
 * @returns {Segment[]}
 */
export function normalize(segments, sentenceLen) {
  const valid = segments
    .map(s => validateSegment(s, sentenceLen))
    .filter(Boolean)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const merged = [];
  for (const seg of valid) {
    const prev = merged[merged.length - 1];
    if (prev && prev.color === seg.color && prev.end >= seg.start) {
      prev.end = Math.max(prev.end, seg.end);
    } else {
      merged.push({ ...seg });
    }
  }
  return merged;
}

/** Remove the [start, end) range from all existing segments (splitting where needed). */
function eraseRange(segments, start, end) {
  const result = [];
  for (const seg of segments) {
    if (seg.end <= start || seg.start >= end) {
      result.push(seg);
    } else {
      if (seg.start < start) result.push({ ...seg, end: start });
      if (seg.end > end)     result.push({ ...seg, start: end });
    }
  }
  return result;
}

/**
 * Apply an underline operation to the existing segment list.
 * @param {Segment[]}   existing    — current normalised underlines
 * @param {number}      start       — codepoint start (inclusive)
 * @param {number}      end         — codepoint end (exclusive)
 * @param {string|null} color       — colour key, or null to erase
 * @param {number}      sentenceLen — codepoint length for normalisation
 * @returns {Segment[]}             — new normalised segment list
 */
export function applyUnderline(existing, start, end, color, sentenceLen) {
  const erased = eraseRange(existing, start, end);
  const next   = color ? [...erased, { start, end, color }] : erased;
  return normalize(next, sentenceLen);
}

/**
 * Merge two segment arrays (used when migrating text-key → savedId-key).
 * Segments from `b` overwrite `a` where they overlap.
 */
export function mergeSegments(a, b, sentenceLen) {
  let result = [...a];
  for (const seg of b) {
    result = applyUnderline(result, seg.start, seg.end, seg.color, sentenceLen ?? Infinity);
  }
  return result;
}

// ── Render helpers ────────────────────────────────────────────────────────────

/**
 * Split the sentence into display spans: [{ text, color }].
 * color is the hex value string for underlined spans, or null for plain text.
 *
 * @param {string}    sentence
 * @param {Segment[]} segments — normalised underline segments
 * @returns {{ text: string, color: string|null }[]}
 */
export function buildSpans(sentence, segments) {
  const cps = toCodepoints(sentence);
  const len = cps.length;
  if (!segments || segments.length === 0) {
    return [{ text: sentence, color: null }];
  }

  const valid = segments
    .map(s => validateSegment(s, len))
    .filter(Boolean)
    .sort((a, b) => a.start - b.start);

  const spans = [];
  let pos = 0;
  for (const seg of valid) {
    if (seg.start > pos) {
      spans.push({ text: cps.slice(pos, seg.start).join(''), color: null });
    }
    if (seg.start < seg.end) {
      spans.push({ text: cps.slice(seg.start, seg.end).join(''), color: UNDERLINE_COLORS[seg.color]?.hex || null });
    }
    pos = seg.end;
  }
  if (pos < len) {
    spans.push({ text: cps.slice(pos).join(''), color: null });
  }
  return spans;
}

// ── Selection → codepoint range ───────────────────────────────────────────────

/**
 * Convert a UTF-16 offset inside a string to a codepoint offset.
 * For BMP characters (≤U+FFFF) both offsets are identical.
 * For supplementary characters the UTF-16 offset advances by 2 per codepoint.
 */
function utf16ToCpOffset(str, utf16Offset) {
  let cpCount = 0;
  let u16 = 0;
  for (const ch of str) {            // iterates by codepoint
    if (u16 >= utf16Offset) break;
    const isSurrogate = ch.codePointAt(0) > 0xFFFF;
    u16 += isSurrogate ? 2 : 1;
    cpCount++;
  }
  return cpCount;
}

/**
 * Walk all text nodes inside `container` to find the codepoint offset of
 * the given (targetNode, domOffset) pair within the sentence.
 *
 * domOffset is a UTF-16 offset within the text node's content.
 * We count codepoints across nodes in document order.
 *
 * Returns null if targetNode is not found inside container.
 */
function domOffsetToCp(container, targetNode, domOffset) {
  let cpPos = 0;
  let result = null;

  function walk(node) {
    if (result !== null) return;
    if (node.nodeType === Node.TEXT_NODE) {
      const nodeText = node.textContent || '';
      if (node === targetNode) {
        result = cpPos + utf16ToCpOffset(nodeText, domOffset);
        return;
      }
      cpPos += toCodepoints(nodeText).length;
    } else {
      for (const child of node.childNodes) walk(child);
    }
  }
  walk(container);
  return result;
}

/**
 * Convert a browser Selection to a [start, end) codepoint range inside the sentence.
 *
 * Returns null when:
 * - selection is collapsed / empty
 * - selection is entirely whitespace
 * - selection extends outside the container element
 * - selection crosses into a different sentence element
 *
 * @param {Selection} sel       — window.getSelection()
 * @param {Element}   container — the DOM element wrapping the sentence text
 * @param {string}    sentence  — the sentence string (used for clamping)
 * @returns {{ start: number, end: number } | null}
 */
export function selectionToRange(sel, container, sentence) {
  if (!sel || sel.isCollapsed || !container) return null;

  // Both anchor and focus must be inside the same container
  if (!container.contains(sel.anchorNode) || !container.contains(sel.focusNode)) return null;

  const range = sel.getRangeAt(0);
  if (range.collapsed) return null;

  const cpStart = domOffsetToCp(container, range.startContainer, range.startOffset);
  const cpEnd   = domOffsetToCp(container, range.endContainer,   range.endOffset);

  if (cpStart === null || cpEnd === null) return null;

  const sentenceLen = toCodepoints(sentence).length;
  const start = Math.min(Math.max(0, cpStart), sentenceLen);
  const end   = Math.min(Math.max(0, cpEnd),   sentenceLen);
  const lo = Math.min(start, end);
  const hi = Math.max(start, end);

  if (lo >= hi) return null;

  // Skip whitespace-only selections
  const cps = toCodepoints(sentence);
  const selectedText = cps.slice(lo, hi).join('').trim();
  if (!selectedText) return null;

  return { start: lo, end: hi };
}
