import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Play, Square, RotateCcw, Repeat, ChevronLeft, ChevronRight, Bookmark, BookmarkCheck,
  Eye, EyeOff, Volume2, Send, Eraser, Lightbulb, Keyboard, Languages, Gauge,
} from 'lucide-react';
import { onSpeechInterrupt, speakWithSettings } from '../../utils/voiceSpeech';
import { compareDictation, matchedWordIndexes, normalizeWord, tokenizeSentence } from '../../utils/dictationCheck';
import { lessonProgress } from '../../utils/dictationModel';
import { readDictationPrefs, writeDictationPrefs } from '../../utils/dictationStorage';
import { readListeningAutofocus, writeListeningAutofocus, safeLocalStorage } from '../../utils/listeningPrefs';

const SPEEDS = [0.75, 1, 1.25]; // multipliers of the speed chosen in the voice settings
const ANSWER_ID = 'dictation-answer';

const DICTATION_SHORTCUTS = [
  ['Enter', 'Nộp câu (nộp rồi: sang câu sau)'],
  ['Ctrl + Enter', 'Nghe lại từ đầu'],
  ['Shift + Enter', 'Phát / dừng'],
  ['Ctrl + ↑', 'Câu trước'],
  ['Ctrl + ↓', 'Câu sau'],
  ['Ctrl + /', 'Gợi ý từ kế tiếp'],
];

function Switch({ id, checked, onChange, label, icon: Icon }) {
  return (
    <label htmlFor={id} className="flex items-center justify-between gap-3 cursor-pointer select-none min-w-0">
      <span className="flex items-center gap-2 text-xs font-semibold text-[var(--sb-ink)] min-w-0">
        {Icon && <Icon size={14} className="text-[var(--sb-terracotta-text)] shrink-0" />}
        <span className="truncate">{label}</span>
      </span>
      <button
        id={id} type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 ${checked ? 'bg-[var(--sb-terracotta-strong)]' : 'bg-[var(--sb-ink-soft)]'}`}
      >
        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200 ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </button>
    </label>
  );
}

const STATUS_CELL = {
  current: 'bg-[var(--sb-terracotta-strong)] text-white border-[var(--sb-ink)] ring-2 ring-[var(--sb-plum)]',
  correct: 'bg-[var(--sb-forest-soft)] text-[var(--sb-forest-text)] border-[var(--sb-forest)]',
  wrong: 'bg-[var(--sb-berry-soft)] text-[var(--sb-berry-text)] border-[var(--sb-berry)]',
  todo: 'bg-[var(--sb-paper-card)] text-[var(--sb-ink)] border-[var(--sb-ink-border)] hover:bg-[var(--sb-paper-deep)]',
};

export default function DictationPractice({ store, lesson, lessons, onSelectLesson, onOpenLibrary }) {
  const sentences = useMemo(() => lesson?.sentences || [], [lesson]);
  const [index, setIndex] = useState(0);
  const sentence = sentences[Math.min(index, Math.max(0, sentences.length - 1))] || null;
  const tokens = useMemo(() => tokenizeSentence(sentence?.english), [sentence]);
  // Exam mode: replays and word chips of one sentence share its voice.
  const voiceItem = sentence ? `sentence:${sentence.id}` : '';

  const [typed, setTyped] = useState('');
  const [revealed, setRevealed] = useState(() => new Set());
  const [result, setResult] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [prefs, setPrefs] = useState(() => readDictationPrefs());
  const [autoFocusInput, setAutoFocusInput] = useState(() => readListeningAutofocus(safeLocalStorage()));
  const [isPlaying, setIsPlaying] = useState(false);
  const [notice, setNotice] = useState('');

  const inputRef = useRef(null);
  const handleRef = useRef(null);
  const loopTimerRef = useRef(null);
  const playingIdRef = useRef(null);
  const prefsRef = useRef(prefs);
  const actionsRef = useRef({});
  useEffect(() => { prefsRef.current = prefs; }, [prefs]);

  // Start each lesson at its first sentence not done yet.
  const lessonId = lesson?.id;
  useEffect(() => {
    const first = sentences.findIndex(s => !s.lastResult);
    setIndex(first === -1 ? 0 : first);
    // Only when the lesson changes, not when a result is recorded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  const stop = useCallback(() => {
    clearTimeout(loopTimerRef.current);
    playingIdRef.current = null;
    try { handleRef.current?.cancel(); } catch { /* ignore */ }
    handleRef.current = null;
    setIsPlaying(false);
  }, []);

  const speak = useCallback((text, itemKey) => {
    clearTimeout(loopTimerRef.current);
    try { handleRef.current?.cancel(); } catch { /* ignore */ }
    const token = Symbol('play');
    playingIdRef.current = token;
    setIsPlaying(true);
    handleRef.current = speakWithSettings(text, {
      itemKey,
      speed: prefsRef.current.speed,
      onEnd: () => {
        if (playingIdRef.current !== token) return;
        if (prefsRef.current.loop) {
          loopTimerRef.current = setTimeout(() => { if (playingIdRef.current === token) speak(text, itemKey); }, 800);
        } else {
          playingIdRef.current = null;
          setIsPlaying(false);
        }
      },
    });
  }, []);

  const sentenceId = sentence?.id;
  // New sentence: reset the attempt, optionally auto-play and focus the input.
  useEffect(() => {
    setTyped(''); setRevealed(new Set()); setResult(null); setShowAll(false); setNotice('');
    if (!sentence) return undefined;
    stop();
    const timers = [];
    if (prefsRef.current.autoplay) timers.push(setTimeout(() => speak(sentence.english, `sentence:${sentence.id}`), 350));
    if (autoFocusInput) timers.push(setTimeout(() => inputRef.current?.focus(), 60));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sentenceId]);

  useEffect(() => () => stop(), [stop]);
  // "Nghe thử" in the voice settings stops a running loop first.
  useEffect(() => onSpeechInterrupt(stop), [stop]);

  const updatePrefs = patch => setPrefs(prev => {
    const next = { ...prev, ...patch };
    prefsRef.current = next;
    writeDictationPrefs(next);
    return next;
  });

  function goTo(nextIndex) {
    if (!sentences.length) return;
    setIndex(Math.max(0, Math.min(sentences.length - 1, nextIndex)));
  }

  function onType(value) {
    setTyped(value);
    if (result || !sentence) return;
    const matched = matchedWordIndexes(sentence.english, value);
    if (matched.some(i => !revealed.has(i))) setRevealed(prev => new Set([...prev, ...matched]));
  }

  function submit() {
    if (!sentence) return;
    if (result) { goTo(index + 1); return; }
    if (!typed.trim()) { setNotice('Hãy gõ câu bạn nghe được trước khi nộp.'); return; }
    const graded = compareDictation(sentence.english, typed);
    setResult(graded);
    setNotice('');
    if (!store.recordSentenceResult(sentence.id, graded.isCorrect)) setNotice('Chưa lưu được kết quả trên thiết bị.');
  }

  function hint() {
    if (!sentence || result) return;
    const next = tokens.findIndex((_, i) => !revealed.has(i));
    if (next !== -1) setRevealed(prev => new Set([...prev, next]));
  }

  function togglePlay() {
    if (!sentence) return;
    if (isPlaying) stop(); else speak(sentence.english, voiceItem);
  }

  // Clicking a word chip must not take the cursor out of the answer box.
  const keepTyping = event => { if (document.activeElement?.id === ANSWER_ID) event.preventDefault(); };

  function setAutoFocus(next) {
    setAutoFocusInput(next);
    writeListeningAutofocus(safeLocalStorage(), next);
    if (next) inputRef.current?.focus(); else inputRef.current?.blur();
  }

  actionsRef.current = { submit, hint, togglePlay, replay: () => sentence && speak(sentence.english, voiceItem), prev: () => goTo(index - 1), next: () => goTo(index + 1) };

  // Shortcuts: only modifier combos (no plain letters), ignored inside other fields.
  useEffect(() => {
    const onKey = event => {
      if (event.isComposing || event.altKey || event.metaKey) return;
      const target = event.target;
      const tag = target?.tagName;
      const otherField = (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) && target.id !== ANSWER_ID;
      if (otherField) return;
      const a = actionsRef.current;
      let action = null;
      if (event.ctrlKey && !event.shiftKey) {
        if (event.key === 'Enter') action = a.replay;
        else if (event.key === 'ArrowUp') action = a.prev;
        else if (event.key === 'ArrowDown') action = a.next;
        else if (event.key === '/' || event.code === 'Slash') action = a.hint;
      } else if (event.shiftKey && !event.ctrlKey && event.key === 'Enter') action = a.togglePlay;
      if (action) { event.preventDefault(); action(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!lesson) {
    return (
      <div className="vm-panel rounded-2xl p-6 text-center space-y-3">
        <p className="text-[var(--sb-ink)] font-bold">Chưa có bài nào để luyện.</p>
        <p className="text-[var(--sb-ink-soft)] text-sm">Vào “Thư viện bài”, dán văn bản (mỗi dòng một câu) để tạo bài đầu tiên.</p>
        <button type="button" onClick={onOpenLibrary} className="vm-btn vm-btn-primary px-4 py-2 rounded-xl text-sm font-semibold">Mở Thư viện bài</button>
      </div>
    );
  }

  const progress = lessonProgress(lesson);
  const liveMatched = sentence && !result ? matchedWordIndexes(sentence.english, typed).length : (result?.correct ?? 0);
  const hasTranslation = Boolean(sentence?.vietnamese);

  return (
    <div className="space-y-4">
      {/* Lesson picker + keyboard toggle */}
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="dictation-lesson" className="text-xs font-semibold uppercase tracking-wider text-[var(--sb-ink-soft)]">Bài</label>
        <select
          id="dictation-lesson" value={lesson.id} onChange={e => onSelectLesson(e.target.value)}
          className="vm-input rounded-xl px-3 py-1.5 text-sm min-w-0 max-w-full flex-1 sm:flex-none sm:max-w-xs"
        >
          {lessons.map(l => <option key={l.id} value={l.id}>{l.title} ({l.sentences.length} câu)</option>)}
        </select>
        <button
          id="dictation-autofocus-toggle" type="button" onClick={() => setAutoFocus(!autoFocusInput)} aria-pressed={autoFocusInput}
          title={autoFocusInput ? 'Đang bật: sang câu mới con trỏ tự vào ô gõ (điện thoại sẽ tự bật bàn phím). Bấm để tắt.' : 'Đang tắt: sang câu mới bàn phím không tự bật. Bấm để bật.'}
          className={`vm-btn flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border max-w-full ${autoFocusInput
            ? 'bg-[var(--sb-terracotta-soft)] border-[var(--sb-ink)] text-[var(--sb-terracotta-text)] hover:bg-[var(--sb-ochre-soft)]'
            : 'bg-[var(--sb-paper-card)] border-[var(--sb-ink-border)] text-[var(--sb-ink)] hover:bg-[var(--sb-paper-deep)]'}`}
        >
          <Keyboard size={14} className="shrink-0" /><span>Tự mở bàn phím: {autoFocusInput ? 'Bật' : 'Tắt'}</span>
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        {/* ── Listen card ── */}
        <section className="vm-card rounded-2xl p-4 sm:p-5 space-y-4 lg:col-start-1 min-w-0" aria-labelledby="dictation-listen-title">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 id="dictation-listen-title" className="text-xs font-bold uppercase tracking-wider text-[var(--sb-terracotta-text)]">Nghe và chép lại câu</h2>
            <span id="dictation-counter" className="text-sm font-bold text-[var(--sb-ink)] tabular-nums">Câu {index + 1}/{sentences.length}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              id="dictation-play" type="button" onClick={togglePlay} aria-label={isPlaying ? 'Dừng' : 'Phát'}
              className="vm-btn w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br from-[var(--sb-terracotta-strong)] via-[var(--sb-terracotta)] to-[var(--sb-ochre)] border-2 border-[var(--sb-ink)] shadow-[var(--sb-shadow-sm)] text-white"
            >
              {isPlaying ? <Square size={18} /> : <Play size={20} className="ml-0.5" />}
            </button>
            <button id="dictation-replay" type="button" onClick={() => speak(sentence.english, voiceItem)} className="vm-btn flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold bg-[var(--sb-paper-card)] hover:bg-[var(--sb-paper-deep)] border-2 border-[var(--sb-ink-border)] text-[var(--sb-ink)]">
              <RotateCcw size={15} /> Nghe lại
            </button>
            <button
              id="dictation-loop" type="button" onClick={() => updatePrefs({ loop: !prefs.loop })} aria-pressed={prefs.loop}
              title="Lặp lại câu liên tục cho tới khi dừng"
              className={`vm-btn flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border-2 ${prefs.loop ? 'bg-[var(--sb-terracotta-soft)] border-[var(--sb-ink)] text-[var(--sb-terracotta-text)]' : 'bg-[var(--sb-paper-card)] border-[var(--sb-ink-border)] text-[var(--sb-ink)] hover:bg-[var(--sb-paper-deep)]'}`}
            >
              <Repeat size={15} /> Lặp
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Tốc độ đọc">
            <Gauge size={14} className="text-[var(--sb-terracotta-text)]" />
            <span className="text-xs font-semibold text-[var(--sb-ink-soft)]">Tốc độ</span>
            {SPEEDS.map(speed => (
              <button
                key={speed} id={`dictation-speed-${String(speed).replace('.', '')}`} type="button" aria-pressed={prefs.speed === speed}
                onClick={() => updatePrefs({ speed })}
                className={`vm-btn px-3 py-1 rounded-full text-xs font-semibold border ${prefs.speed === speed ? 'vm-btn-primary border-[var(--sb-ink)]' : 'bg-[var(--sb-paper-card)] text-[var(--sb-ink)] border-[var(--sb-ink-border)] hover:bg-[var(--sb-paper-deep)]'}`}
              >{speed}×</button>
            ))}
          </div>
          <div className="space-y-2.5">
            <Switch id="dictation-autoplay" checked={prefs.autoplay} onChange={v => updatePrefs({ autoplay: v })} label="Tự phát khi chuyển câu" icon={Volume2} />
            {hasTranslation && (
              <Switch id="dictation-translation-toggle" checked={prefs.showTranslation} onChange={v => updatePrefs({ showTranslation: v })} label="Hiện bản dịch tiếng Việt" icon={Languages} />
            )}
            {hasTranslation && prefs.showTranslation && (
              <p id="dictation-translation" className="text-sm text-[var(--sb-ink)] bg-[var(--sb-sky-soft)] border border-[var(--sb-sky)]/45 rounded-xl px-3 py-2">{sentence.vietnamese}</p>
            )}
          </div>
          <div className="flex items-center justify-between gap-2">
            <button id="dictation-prev" type="button" onClick={() => goTo(index - 1)} disabled={index === 0} className="vm-btn flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-semibold bg-[var(--sb-paper-card)] hover:bg-[var(--sb-paper-deep)] border-2 border-[var(--sb-ink-border)] text-[var(--sb-ink)] disabled:opacity-40">
              <ChevronLeft size={16} /> Câu trước
            </button>
            <button id="dictation-next" type="button" onClick={() => goTo(index + 1)} disabled={index >= sentences.length - 1} className="vm-btn flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-semibold bg-[var(--sb-paper-card)] hover:bg-[var(--sb-paper-deep)] border-2 border-[var(--sb-ink-border)] text-[var(--sb-ink)] disabled:opacity-40">
              Câu sau <ChevronRight size={16} />
            </button>
          </div>
        </section>

        {/* ── Answer card ── */}
        <section className="vm-card rounded-2xl p-4 sm:p-5 space-y-3 lg:col-start-2 lg:row-start-1 lg:row-span-2 min-w-0" aria-labelledby="dictation-answer-title">
          <div className="flex items-center justify-between gap-2">
            <h2 id="dictation-answer-title" className="text-xs font-bold uppercase tracking-wider text-[var(--sb-terracotta-text)]">Câu bạn nghe được</h2>
            <button type="button" onClick={() => sentence && speak(sentence.english, voiceItem)} aria-label="Nghe câu" className="vm-btn p-2 rounded-xl text-[var(--sb-terracotta-text)] hover:bg-[var(--sb-paper-deep)]">
              <Volume2 size={16} />
            </button>
          </div>
          <textarea
            id={ANSWER_ID} ref={inputRef} value={typed} rows={3}
            onChange={e => onType(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); }
            }}
            readOnly={Boolean(result)}
            placeholder="Gõ câu bạn nghe được…" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
            className="w-full vm-input rounded-xl px-3 py-2.5 text-base sm:text-sm resize-y min-h-[84px]"
          />
          <div>
            <div className="flex items-center justify-between text-xs text-[var(--sb-ink-soft)] mb-1">
              <span id="dictation-progress">{liveMatched}/{tokens.length} từ đúng</span>
              {notice && <span role="status" className="text-[var(--sb-ochre-text)] font-medium text-right">{notice}</span>}
            </div>
            <div className="h-1.5 rounded-full bg-[var(--sb-paper-deep)] overflow-hidden" aria-hidden="true">
              <div className="h-full bg-[var(--sb-forest-btn)] transition-[width] duration-200" style={{ width: `${tokens.length ? (liveMatched / tokens.length) * 100 : 0}%` }} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button id="dictation-submit" type="button" onClick={submit} className="vm-btn flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-[var(--sb-forest-btn)] hover:bg-[var(--sb-forest-hover)] border-2 border-[var(--sb-ink)] shadow-[var(--sb-shadow-sm)]">
              <Send size={15} /> {result ? 'Câu tiếp (Enter)' : 'Nộp (Enter)'}
            </button>
            <button id="dictation-clear" type="button" onClick={() => { setTyped(''); setResult(null); inputRef.current?.focus(); }} className="vm-btn flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold bg-[var(--sb-paper-card)] hover:bg-[var(--sb-paper-deep)] border-2 border-[var(--sb-ink-border)] text-[var(--sb-ink)]">
              <Eraser size={15} /> Xoá hết
            </button>
            <button id="dictation-hint" type="button" onClick={hint} disabled={Boolean(result)} className="vm-btn flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold bg-[var(--sb-ochre-soft)] hover:bg-[var(--sb-paper-deep)] border-2 border-[var(--sb-ink)] text-[var(--sb-ochre-text)] disabled:opacity-40">
              <Lightbulb size={15} /> Gợi ý từ
            </button>
          </div>

          {result && (
            <div id="dictation-result" className="vm-feedback-in space-y-2 pt-1" role="status">
              <p className={`text-sm font-bold ${result.isCorrect ? 'text-[var(--sb-forest-text)]' : 'text-[var(--sb-berry-text)]'}`}>
                {result.isCorrect ? 'Chính xác! Cả câu đúng.' : `Đúng ${result.correct}/${result.total} từ.`}
              </p>
              <p className="flex flex-wrap gap-1.5 text-sm leading-relaxed" aria-label="So sánh từng từ">
                {result.items.map((item, i) => {
                  if (item.type === 'correct') return <span key={i} className="px-1.5 rounded-md bg-[var(--sb-forest-soft)] text-[var(--sb-forest-text)] font-medium">{item.typed}</span>;
                  if (item.type === 'wrong') return <span key={i} className="px-1.5 rounded-md bg-[var(--sb-berry-soft)]"><s className="text-[var(--sb-berry-text)]">{item.typed}</s> <span className="text-[var(--sb-forest-text)] font-semibold">{item.expected}</span></span>;
                  if (item.type === 'missing') return <span key={i} className="px-1.5 rounded-md border border-dashed border-[var(--sb-ochre-text)] bg-[var(--sb-ochre-soft)] text-[var(--sb-ochre-text)] font-medium" title="Thiếu">{item.expected} <small className="text-[10px] uppercase">thiếu</small></span>;
                  return <span key={i} className="px-1.5 rounded-md bg-[var(--sb-paper-deep)]" title="Thừa"><s className="text-[var(--sb-ink)]">{item.typed}</s> <small className="text-[10px] uppercase text-[var(--sb-ink-soft)]">thừa</small></span>;
                })}
              </p>
              <p className="text-sm text-[var(--sb-ink)]"><span className="text-[var(--sb-ink-soft)] font-semibold text-xs">Câu đúng: </span><span id="dictation-correct-sentence" className="font-semibold">{sentence.english}</span></p>
              {hasTranslation && <p className="text-sm text-[var(--sb-ink)]"><span className="text-[var(--sb-ink-soft)] font-semibold text-xs">Bản dịch: </span>{sentence.vietnamese}</p>}
            </div>
          )}
        </section>

        {/* ── Word chips ── */}
        <section className="vm-panel rounded-2xl p-4 sm:p-5 space-y-3 lg:col-start-1 min-w-0" aria-labelledby="dictation-words-title">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 id="dictation-words-title" className="text-xs font-bold uppercase tracking-wider text-[var(--sb-terracotta-text)]">Gõ đúng để mở từ</h2>
            <button id="dictation-toggle-all" type="button" onClick={() => setShowAll(v => !v)} className="vm-btn flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[var(--sb-paper-card)] border border-[var(--sb-ink-border)] text-[var(--sb-ink)] hover:bg-[var(--sb-paper-deep)]">
              {showAll ? <EyeOff size={13} /> : <Eye size={13} />} {showAll ? 'Ẩn tất cả' : 'Hiện tất cả'}
            </button>
          </div>
          <ul className="flex flex-wrap gap-1.5" aria-label="Các từ trong câu">
            {tokens.map((token, i) => {
              const open = showAll || Boolean(result) || revealed.has(i);
              if (!open) {
                return (
                  <li key={i} data-chip-state="hidden" className="px-2 py-1 rounded-lg bg-[var(--sb-paper-deep)] border border-[var(--sb-ink-border)] text-[var(--sb-ink-soft)] text-sm tracking-widest select-none" aria-label={`Từ ẩn, ${token.key.length} ký tự`}>
                    {'•'.repeat(Math.min(token.key.length, 14))}
                  </li>
                );
              }
              const saved = store.isWordSaved(token.text);
              return (
                <li key={i} data-chip-state="open" data-saved={saved ? 'true' : 'false'} className={`vm-scale-in flex items-center rounded-lg border text-sm font-medium ${saved ? 'bg-[var(--sb-plum-soft)] border-[var(--sb-plum)] text-[var(--sb-plum-text)]' : 'bg-[var(--sb-paper-card)] border-[var(--sb-ink-border)] text-[var(--sb-ink)]'}`}>
                  <button type="button" onMouseDown={keepTyping} onClick={() => speak(token.text, voiceItem)} className="px-2 py-1 hover:text-[var(--sb-terracotta-text)]" title="Nghe từ này">{token.text}</button>
                  <button
                    type="button" onMouseDown={keepTyping} onClick={() => {
                      const status = store.toggleWord(token.text);
                      if (status === 'error') setNotice('Chưa lưu được từ trên thiết bị.');
                    }}
                    aria-pressed={saved} aria-label={saved ? `Bỏ lưu từ ${normalizeWord(token.text)}` : `Lưu từ ${normalizeWord(token.text)}`}
                    data-word={normalizeWord(token.text)}
                    className={`pr-1.5 pl-0.5 py-1 ${saved ? 'text-[var(--sb-plum-text)]' : 'text-[var(--sb-ink-soft)] hover:text-[var(--sb-plum-text)]'}`}
                  >
                    {saved ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        {/* ── Sentence list ── */}
        <section className="vm-panel rounded-2xl p-4 sm:p-5 space-y-3 lg:col-start-1 min-w-0" aria-labelledby="dictation-list-title">
          <h2 id="dictation-list-title" className="text-xs font-bold uppercase tracking-wider text-[var(--sb-terracotta-text)]">Danh sách câu</h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(2.5rem,1fr))] gap-1.5">
            {sentences.map((s, i) => {
              const status = i === index ? 'current' : s.lastResult || 'todo';
              return (
                <button
                  key={s.id} type="button" onClick={() => goTo(i)} data-status={status} id={`dictation-cell-${i + 1}`}
                  aria-label={`Câu ${i + 1}: ${status === 'correct' ? 'đúng' : status === 'wrong' ? 'sai' : status === 'current' ? 'đang làm' : 'chưa làm'}`}
                  aria-current={i === index ? 'true' : undefined}
                  className={`vm-btn h-9 rounded-lg border text-xs font-bold tabular-nums ${STATUS_CELL[status]}`}
                >{i + 1}</button>
              );
            })}
          </div>
          <p id="dictation-legend" className="text-xs text-[var(--sb-ink-soft)]">
            <span className="text-[var(--sb-forest-text)] font-semibold">Đúng {progress.correct}</span> · <span className="text-[var(--sb-berry-text)] font-semibold">Sai {progress.wrong}</span> · <span>Chưa làm {progress.todo}</span>
          </p>
        </section>

        {/* ── Shortcuts ── */}
        <section className="vm-panel rounded-2xl p-4 sm:p-5 lg:col-start-2 lg:row-start-3 min-w-0" aria-labelledby="dictation-keys-title">
          <h2 id="dictation-keys-title" className="text-xs font-bold uppercase tracking-wider text-[var(--sb-terracotta-text)] mb-2">Phím tắt</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
            {DICTATION_SHORTCUTS.map(([keys, label]) => (
              <div key={keys} className="contents">
                <dt><kbd className="px-1.5 py-0.5 rounded-md bg-[var(--sb-paper-deep)] border border-[var(--sb-ink-border)] text-[var(--sb-ink)] font-semibold font-mono whitespace-nowrap">{keys}</kbd></dt>
                <dd className="text-[var(--sb-ink)]">{label}</dd>
              </div>
            ))}
          </dl>
          <p className="text-[11px] text-[var(--sb-ink-soft)] mt-2">Phím tắt không chạy khi bạn đang gõ ở ô khác (tìm kiếm, thư viện).</p>
        </section>
      </div>
    </div>
  );
}
