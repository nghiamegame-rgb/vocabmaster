import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Volume2, ChevronRight, RotateCcw, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { speakWithSettings } from '../utils/voiceSpeech';
import { normalizeWord } from '../utils/dictationCheck';
import { listenTotals } from '../utils/dictationSyncMerge';
import { shuffle } from '../utils/wordSelection';

/**
 * Listening → source "Từ chép chính tả": hear ONE saved Dictation word, type it.
 * Only the listen counters on the Dictation word record change
 * (store.recordWordListen); the main Vocabulary, L1–L5 and review dates are
 * never touched.
 */
export default function DictationWordListening({ store, wrongOnly, autoFocusInput, inputRef, onResult }) {
  const pool = useMemo(
    () => store.words.filter(w => !wrongOnly || listenTotals(w).wrong > 0),
    [store.words, wrongOnly],
  );
  const poolKey = pool.map(w => w.id).join('|');
  const [currentId, setCurrentId] = useState(null);
  const [round, setRound] = useState(0);
  const [typed, setTyped] = useState('');
  const [answer, setAnswer] = useState(null); // null | 'correct' | 'wrong'
  const [playCount, setPlayCount] = useState(0);
  const bagRef = useRef([]);
  const lastRef = useRef(null);
  const audioRef = useRef(null);
  const advanceRef = useRef(null);
  const current = pool.find(w => w.id === currentId) || null;
  // Exam mode: a new round gets another voice, replays within it keep it.
  const voiceItem = current ? `dictword:${round}:${current.id}` : '';

  const nextWord = useCallback(() => {
    clearTimeout(advanceRef.current);
    if (!pool.length) { setCurrentId(null); return; }
    const ids = pool.map(w => w.id);
    bagRef.current = bagRef.current.filter(id => ids.includes(id));
    if (!bagRef.current.length) {
      bagRef.current = shuffle(ids);
      // Avoid hearing the same word twice in a row when the bag refills.
      if (bagRef.current.length > 1 && bagRef.current[0] === lastRef.current) bagRef.current.push(bagRef.current.shift());
    }
    const id = bagRef.current.shift();
    lastRef.current = id;
    setCurrentId(id);
    setRound(r => r + 1);
    setTyped('');
    setAnswer(null);
    setPlayCount(0);
  }, [pool]);

  // New pool (filter changed, word saved/removed elsewhere): keep the current word if still there.
  useEffect(() => {
    if (!currentId || !pool.some(w => w.id === currentId)) nextWord();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolKey]);

  const speak = useCallback((word, itemKey) => {
    try { audioRef.current?.cancel(); } catch { /* ignore */ }
    audioRef.current = speakWithSettings(word, { itemKey });
    setPlayCount(c => c + 1);
  }, []);

  // Each new round: play the word, optionally focus the input.
  useEffect(() => {
    if (!current) return undefined;
    const timers = [setTimeout(() => speak(current.word, voiceItem), 350)];
    if (autoFocusInput) timers.push(setTimeout(() => inputRef.current?.focus(), 50));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  useEffect(() => () => {
    clearTimeout(advanceRef.current);
    try { audioRef.current?.cancel(); } catch { /* ignore */ }
  }, []);

  function check(value = typed) {
    if (!current || answer) return;
    if (!value.trim()) return;
    const ok = normalizeWord(value) === current.id;
    setAnswer(ok ? 'correct' : 'wrong');
    store.recordWordListen(current.id, ok);
    onResult(ok);
    if (ok) advanceRef.current = setTimeout(nextWord, 1500);
  }

  function onChange(value) {
    setTyped(value);
    // Same as the main Listening: typing the exact word submits by itself.
    if (current && !answer && normalizeWord(value) === current.id) check(value);
  }

  if (!pool.length) {
    return (
      <div className="flex items-start gap-3 bg-[var(--sb-ochre-soft)] border-2 border-[var(--sb-ink)] rounded-2xl p-5" id="lr-dictation-empty">
        <AlertCircle size={20} className="text-[var(--sb-ochre-text)] shrink-0 mt-0.5" />
        <p className="text-[var(--sb-ink)] text-sm leading-relaxed">
          {wrongOnly
            ? 'Chưa có từ nào bạn từng nghe sai. Tắt "Chỉ từ hay sai" để luyện tất cả từ đã lưu.'
            : 'Chưa có từ nào trong "Từ đã lưu" của Dictation. Vào tab Dictation, mở từ khi chép câu rồi bấm biểu tượng bookmark để lưu.'}
        </p>
      </div>
    );
  }
  if (!current) return null;
  const totals = listenTotals(current);

  return (
    <div className="space-y-4">
      <div className="vm-card rounded-2xl p-5 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 bg-gradient-to-br from-[var(--sb-terracotta-strong)] via-[var(--sb-terracotta)] to-[var(--sb-ochre)] border-2 border-[var(--sb-ink)] shadow-[var(--sb-shadow-sm)]">
            <Volume2 size={28} className="text-white" />
          </div>
          <div className="flex-1 text-center sm:text-left min-w-0">
            <p className="text-[var(--sb-ink-soft)] text-xs uppercase tracking-wider font-semibold mb-1">Nghe và gõ lại từ</p>
            <p className="text-[var(--sb-ink-soft)] italic text-sm">Bấm Nghe lại nếu chưa rõ{playCount > 1 ? ` (×${playCount - 1})` : ''}</p>
          </div>
          <button id="lr-dictation-replay" type="button" onClick={() => speak(current.word, voiceItem)} className="vm-btn vm-btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm shrink-0">
            <Volume2 size={16} /> Nghe lại
          </button>
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <input
            id="lr-dictation-input" ref={inputRef} type="text" value={typed}
            onChange={e => onChange(e.target.value)}
            onKeyDown={e => {
              if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
              e.preventDefault();
              if (answer) nextWord(); else check();
            }}
            readOnly={Boolean(answer)}
            placeholder="Gõ từ bạn nghe được…" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
            className="flex-1 min-w-0 vm-input rounded-xl px-4 py-2.5 text-base sm:text-sm"
          />
          <button id="lr-dictation-check" type="button" onClick={() => (answer ? nextWord() : check())} className="vm-btn shrink-0 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-[var(--sb-forest-btn)] hover:bg-[var(--sb-forest-hover)] border-2 border-[var(--sb-ink)] shadow-[var(--sb-shadow-sm)]">
            {answer ? 'Từ tiếp' : 'Kiểm tra'}
          </button>
        </div>
      </div>

      {answer && (
        <div id="lr-dictation-feedback" role="status" className={`vm-feedback-in flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3.5 rounded-2xl font-semibold text-sm ${answer === 'correct'
          ? 'bg-[var(--sb-forest-soft)] border-2 border-[var(--sb-forest)] text-[var(--sb-forest-text)]'
          : 'bg-[var(--sb-berry-soft)] border-2 border-[var(--sb-berry)] text-[var(--sb-berry-text)]'}`}>
          {answer === 'correct' ? <CheckCircle2 size={18} className="shrink-0" /> : <XCircle size={18} className="shrink-0" />}
          <span>{answer === 'correct' ? 'Chính xác!' : 'Chưa đúng — đáp án:'} <span className="underline underline-offset-2">{current.word}</span></span>
          {current.sentence && <span className="w-full text-xs font-normal text-[var(--sb-ink-soft)]">“{current.sentence}”</span>}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button id="lr-dictation-next" type="button" onClick={nextWord} className="vm-btn flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-[var(--sb-paper-card)] hover:bg-[var(--sb-paper-deep)] border-2 border-[var(--sb-ink)] text-[var(--sb-ink)] shadow-[var(--sb-shadow-sm)]">
          {answer ? <><ChevronRight size={16} /> Từ tiếp</> : <><RotateCcw size={16} /> Bỏ qua</>}
        </button>
        <span className="text-xs text-[var(--sb-ink-soft)]">
          Từ này: nghe đúng {totals.correct} · sai {totals.wrong} · <span className="text-[var(--sb-ink-soft)]">{pool.length} từ trong nhóm</span>
        </span>
      </div>
    </div>
  );
}
