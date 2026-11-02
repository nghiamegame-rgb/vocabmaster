import { useState, useRef, useCallback, useLayoutEffect, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { buildSpans, selectionToRange, toCodepoints } from '../../utils/sentenceUnderline';
import { measureSentenceLines, packSentenceNotes, sentenceRangeRect } from '../../utils/sentenceGeometry';
import UnderlineToolbar from './UnderlineToolbar';
import SentenceNoteEditor from './SentenceNoteEditor';

const EMPTY = [];
const noteClass = 'rounded px-0.5 text-center text-[12px] leading-4 text-slate-300 whitespace-pre-wrap hover:bg-slate-800/70 focus-visible:bg-slate-800/70 focus-visible:outline focus-visible:outline-1 focus-visible:outline-indigo-400';

/** English text alone lives in containerRef; note labels/editor are siblings. */
export default function UnderlinedSentence({ sentence, segments, onUnderlineChange, className = '', readOnly = false,
  notes = EMPTY, onNoteChange, hideNotesInitially = false, sentenceKey }) {
  const containerRef = useRef(null), hostRef = useRef(null), measureRef = useRef(null);
  const labelsRef = useRef(new Map()), pendingRange = useRef(null);
  const [toolbar, setToolbar] = useState(null);
  const toolbarOpen = toolbar !== null;
  const [editor, setEditor] = useState(null);
  const [notesShown, setNotesShown] = useState(!hideNotesInitially);
  const [lines, setLines] = useState([{ start: 0, end: toCodepoints(sentence).length, height: 28 }]);
  const [layout, setLayout] = useState({ items: [], padding: [] });
  const identity = `${sentenceKey || ''}\u0000${sentence}`;
  const previousIdentity = useRef(identity);
  useLayoutEffect(() => {
    if (previousIdentity.current !== identity) {
      previousIdentity.current = identity;
      setEditor(null); setToolbar(null); setNotesShown(!hideNotesInitially);
    }
  }, [identity, hideNotesInitially]);

  useLayoutEffect(() => {
    const update = () => {
      const host = hostRef.current, measure = measureRef.current;
      if (!host || !measure) return;
      const measured = measureSentenceLines(measure, sentence);
      setLines(previous => JSON.stringify(previous) === JSON.stringify(measured) ? previous : measured);
      const bounds = host.getBoundingClientRect();
      const textTop = containerRef.current.getBoundingClientRect().top - bounds.top;
      const layoutLines = measured.map((line, index) => {
        const rect = sentenceRangeRect(containerRef.current, line.start, line.end);
        const lineBox = containerRef.current.children[index]?.getBoundingClientRect();
        return { ...line, contentBottom: rect && lineBox ? Math.min(line.height, Math.max(0, rect.bottom - lineBox.top)) : line.height };
      });
      const items = notesShown ? notes.flatMap(note => {
        const rect = sentenceRangeRect(containerRef.current, note.start, note.end);
        const label = labelsRef.current.get(note.id)?.getBoundingClientRect();
        return rect && label ? [{ ...note, left: rect.left + rect.width / 2 - bounds.left - label.width / 2,
          width: label.width, height: label.height }] : [];
      }) : [];
      const next = packSentenceNotes(layoutLines, items, bounds.width);
      next.items = next.items.map(item => ({ ...item, top: item.top + textTop }));
      setLayout(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(hostRef.current);
    for (const label of labelsRef.current.values()) observer.observe(label);
    window.addEventListener('resize', update);
    document.fonts?.addEventListener('loadingdone', update);
    return () => {
      observer.disconnect(); window.removeEventListener('resize', update);
      document.fonts?.removeEventListener('loadingdone', update);
    };
  }, [sentence, className, notes, notesShown, lines]);

  const closeEditor = useCallback(() => setEditor(null), []);
  const editorAnchor = () => editor ? sentenceRangeRect(containerRef.current, editor.start, editor.end) : null;
  const closeToolbar = useCallback(() => { setToolbar(null); pendingRange.current = null; }, []);
  const handleSelection = useCallback(() => {
    if (readOnly && !onNoteChange) return;
    const range = selectionToRange(window.getSelection(), containerRef.current, sentence);
    const rect = range && sentenceRangeRect(containerRef.current, range.start, range.end);
    if (!rect) { closeToolbar(); return; }
    pendingRange.current = range;
    setToolbar({ top: rect.top - 44, left: rect.left });
  }, [readOnly, onNoteChange, sentence, closeToolbar]);
  useEffect(() => {
    if (!toolbarOpen) return;
    const update = () => {
      const range = pendingRange.current;
      const rect = range && sentenceRangeRect(containerRef.current, range.start, range.end);
      if (!rect) closeToolbar();
      else setToolbar({ top: rect.top - 44, left: rect.left });
    };
    window.addEventListener('scroll', update, true); window.addEventListener('resize', update);
    return () => { window.removeEventListener('scroll', update, true); window.removeEventListener('resize', update); };
  }, [toolbarOpen, closeToolbar]);

  function openNote(range) {
    if (!onNoteChange || !range) return;
    const existing = notes.find(note => note.start === range.start && note.end === range.end);
    setNotesShown(true);
    setEditor({ ...range, id: existing?.id || crypto.randomUUID(), text: existing?.text || '', error: '' });
    closeToolbar(); window.getSelection()?.removeAllRanges();
  }
  function changeNote(text) {
    const result = onNoteChange({ id: editor.id, start: editor.start, end: editor.end, text });
    setEditor(previous => previous && ({ ...previous, text, error: result?.ok === false ? 'Chưa lưu được trên máy. Hãy kiểm tra dung lượng lưu trữ.' : '' }));
  }
  const chars = toCodepoints(sentence);
  return <div ref={hostRef} className="relative min-w-0" data-sentence-area="">
    {notes.length > 0 && <div data-sentence-controls="" className="mb-1 flex flex-wrap items-center justify-end gap-1">
      <button type="button" aria-expanded={notesShown} onClick={() => setNotesShown(value => !value)}
        className="max-w-full rounded px-1 text-xs text-indigo-300 hover:bg-slate-800/70 hover:text-indigo-200 focus-visible:outline focus-visible:outline-1 focus-visible:outline-indigo-400">
        {notesShown ? 'Ẩn ghi chú' : 'Hiện ghi chú'} ({notes.length})
      </button>
    </div>}
    <div ref={measureRef} aria-hidden="true" className={className}
      style={{ position: 'absolute', width: '100%', visibility: 'hidden', pointerEvents: 'none', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{sentence}</div>
    <p ref={containerRef} data-sentence-text="" className={className} onMouseUp={handleSelection} onTouchEnd={handleSelection}
      style={{ userSelect: 'text', cursor: readOnly ? undefined : 'text' }}>
      {lines.map((line, index) => <span key={line.start} style={{ display: 'block', whiteSpace: 'pre', lineHeight: `${line.height}px`, paddingBottom: layout.padding[index] || 0 }}>
        {buildSpans(chars.slice(line.start, line.end).join(''), (segments || []).map(segment => ({ ...segment,
          start: segment.start - line.start, end: segment.end - line.start }))).map((span, i) => <span key={i}
          style={span.color ? { textDecorationLine: 'underline', textDecorationColor: span.color, textDecorationThickness: '2.5px', textUnderlineOffset: '4px' } : undefined}>{span.text}</span>)}
      </span>)}
    </p>
    {notesShown && notes.map(note => {
      const placed = layout.items.find(item => item.id === note.id);
      return <button type="button" key={note.id} ref={element => { if (element) labelsRef.current.set(note.id, element); else labelsRef.current.delete(note.id); }}
        data-sentence-note={note.id} title={`Ghi chú cho “${note.quote}”`} aria-label={`Sửa ghi chú: ${note.quote}`}
        onClick={() => openNote(note)} className={noteClass}
        style={{ position: 'absolute', top: placed?.top || 0, left: placed?.left || 0, width: 'max-content', maxWidth: 'min(320px, 100%)', overflowWrap: 'anywhere', visibility: placed ? 'visible' : 'hidden' }}>
        {note.text}
      </button>;
    })}
    {toolbar && createPortal(<UnderlineToolbar position={toolbar} onClose={closeToolbar}
      onNote={onNoteChange ? () => openNote(pendingRange.current) : undefined}
      onColor={color => {
        const range = pendingRange.current;
        closeToolbar(); window.getSelection()?.removeAllRanges();
        if (range) onUnderlineChange?.(range.start, range.end, color);
      }} />, document.body)}
    {editor && createPortal(<SentenceNoteEditor anchor={editorAnchor} text={editor.text} error={editor.error}
      existing={notes.some(note => note.id === editor.id)} onChange={changeNote} onClose={closeEditor}
      onDelete={() => { const result = onNoteChange({ ...editor, text: '' }); if (result?.ok !== false) closeEditor(); }} />, document.body)}
  </div>;
}
