import { toCodepoints } from './sentenceUnderline.js';

/** Rects from text nodes only: never include annotation labels or editor contents. */
export function sentenceRangeRect(container, start, end) {
  if (!container) return null;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const rects = [];
  let offset = 0;
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const chars = toCodepoints(node.textContent);
    const lo = Math.max(0, start - offset), hi = Math.min(chars.length, end - offset);
    if (lo < hi) {
      const range = document.createRange();
      range.setStart(node, chars.slice(0, lo).join('').length);
      range.setEnd(node, chars.slice(0, hi).join('').length);
      rects.push(...[...range.getClientRects()].filter(rect => rect.width > 0 && rect.height > 0));
    }
    offset += chars.length;
  }
  if (!rects.length) return null;
  const top = Math.max(...rects.map(rect => rect.top));
  const finalLine = rects.filter(rect => Math.abs(rect.top - top) < 2);
  const left = Math.min(...finalLine.map(rect => rect.left));
  const right = Math.max(...finalLine.map(rect => rect.right));
  return { left, right, top, bottom: Math.max(...finalLine.map(rect => rect.bottom)), width: right - left };
}

/** Measure line breaks using a hidden, identically styled plain-text element. */
export function measureSentenceLines(element, sentence) {
  const chars = toCodepoints(sentence), node = element.firstChild;
  const height = parseFloat(getComputedStyle(element).lineHeight) || 28;
  if (!node || !chars.length) return [{ start: 0, end: chars.length, height }];
  const lines = [];
  let utf16 = 0;
  chars.forEach((char, index) => {
    const range = document.createRange();
    range.setStart(node, utf16); utf16 += char.length; range.setEnd(node, utf16);
    const rect = range.getBoundingClientRect();
    const previous = lines.at(-1);
    if (!previous || Math.abs(rect.top - previous.top) > 2) lines.push({ start: index, end: index + 1, top: rect.top, height });
    else previous.end = index + 1;
  });
  return lines.map(({ start, end, height: lineHeight }) => ({ start, end, height: lineHeight }));
}

/** First-fit annotation lanes per final text line; each lane reserves its height. */
export function packSentenceNotes(lines, items, width) {
  const result = [], padding = lines.map(() => 0);
  let top = 0;
  lines.forEach((line, index) => {
    const lanes = [];
    const anchored = items.filter(item => item.end > line.start && item.end <= line.end)
      .sort((a, b) => a.left - b.left || a.start - b.start || a.id.localeCompare(b.id));
    for (const item of anchored) {
      const noteWidth = Math.max(1, Math.min(width, item.width));
      const left = Math.max(0, Math.min(item.left, width - noteWidth));
      let lane = lanes.findIndex(row => row.items.every(other => left + noteWidth + 8 <= other.left || left >= other.left + other.width + 8));
      if (lane < 0) { lane = lanes.length; lanes.push({ height: 0, items: [] }); }
      const placed = { ...item, left, width: noteWidth, lane };
      lanes[lane].items.push(placed);
      lanes[lane].height = Math.max(lanes[lane].height, item.height);
    }
    let extra = 0;
    for (const lane of lanes) {
      for (const item of lane.items) result.push({ ...item, top: top + line.height + 6 + extra });
      extra += lane.height + 6;
    }
    padding[index] = extra ? extra + 6 : 0;
    top += line.height + padding[index];
  });
  return { items: result, padding };
}
