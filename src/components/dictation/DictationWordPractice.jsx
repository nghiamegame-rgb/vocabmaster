import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Bookmark, CheckCircle2, XCircle } from 'lucide-react';
import VoiceSettings from '../VoiceSettings';
import { useListeningGame } from '../listening/useListeningGame';
import { useAutoFocusPref } from '../listening/useAutoFocusPref';
import {
  StatsBar, AutoFocusToggle, PromptCard, AnswerFeedback, AnswerGrid, SkipButton,
} from '../listening/ListeningParts';
import {
  ALL_LESSONS, buildWordRound, createWordPicker, filterPracticeWords, isTypedWord, practiceFilterOptions,
} from '../../utils/dictationPractice';

/** Long words get smaller text so they rarely have to break on narrow phones. */
const choiceSize = text => (text.length > 14 ? 'text-sm sm:text-xl' : text.length > 9 ? 'text-base sm:text-2xl' : 'text-xl sm:text-3xl');

/** Answer choice without a picture: just the word, large and easy to tap. */
function WordChoice({ word, state, onClick, index }) {
  return (
    <button
      type="button" id={`dictation-card-${index}`} data-state={state} aria-label={`Choose ${word.word}`}
      onClick={() => onClick(word)} disabled={state !== 'idle'}
      className={`vm-card relative overflow-hidden rounded-2xl border-2 min-h-[96px] sm:min-h-[128px] px-2 sm:px-3 py-7 flex items-center justify-center text-center min-w-0
        ${state === 'idle' ? 'vm-card-interactive cursor-pointer active:scale-95' : 'cursor-default'}
        ${state === 'disabled' ? 'opacity-50' : ''}`}
    >
      {(state === 'correct' || state === 'wrong') && (
        <span aria-hidden="true" className={`absolute inset-0 rounded-[inherit] border-2 vm-scale-in ${state === 'correct'
          ? 'border-emerald-400 bg-emerald-500/20' : 'border-rose-400 bg-rose-500/20'}`} />
      )}
      <span lang="en" className={`relative min-w-0 font-bold text-white hyphens-auto [overflow-wrap:anywhere] ${choiceSize(word.word)}`}>{word.word}</span>
      {state === 'correct' && <CheckCircle2 size={22} aria-hidden="true" className="absolute top-2 right-2 text-emerald-300" />}
      {state === 'wrong' && <XCircle size={22} aria-hidden="true" className="absolute top-2 right-2 text-rose-300" />}
    </button>
  );
}

function FilterSwitch({ id, label, count, checked, onToggle }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 flex-wrap min-w-0">
        <span className="text-slate-200 text-xs font-semibold">{label}</span>
        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-400/35">{count} từ</span>
      </span>
      <button
        id={id} type="button" onClick={onToggle} aria-pressed={checked} aria-label={label}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 ${checked ? 'bg-amber-500 shadow-sm shadow-amber-500/40' : 'bg-slate-600'}`}
      >
        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200 ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}

/**
 * Dictation → "Từ đã lưu" → "Luyện nghe": the Listening Review layout with the saved
 * Dictation words as text cards. Answers only change the word's listen counters
 * (store.recordWordListen, saved and synced like every other Dictation change).
 */
export default function DictationWordPractice({ store }) {
  const words = store.words;
  const [lessonFilter, setLessonFilter] = useState(ALL_LESSONS);
  const [wrongOnly, setWrongOnly] = useState(false);
  const [newOnly, setNewOnly] = useState(false);
  const [picker] = useState(() => createWordPicker());
  const [autoFocusInput, toggleAutoFocus] = useAutoFocusPref();
  const inputRef = useRef(null);

  const options = practiceFilterOptions(words);
  // A lesson that no longer has saved words falls back to "every lesson".
  const lesson = options.lessons.some(o => o.value === lessonFilter) ? lessonFilter : ALL_LESSONS;
  const pool = filterPracticeWords(words, { lesson, wrongOnly, newOnly });
  // Offered while it has something to select, and kept while switched on so it can be switched off.
  const showWrong = options.wrongCount > 0 || wrongOnly;
  const showNew = options.newCount > 0 || newOnly;

  const game = useListeningGame({
    pool,
    minPool: 1,
    resetKey: JSON.stringify([lesson, wrongOnly, newOnly]),
    holdFeedback: true,
    buildRound: (current, previousId) => buildWordRound({ pool: current, words, previousId, picker }),
    textOf: word => word.word,
    isTypedMatch: isTypedWord,
    voiceKey: 'dictword-list',
    onAnswer: (word, isCorrect) => store.recordWordListen(word.id, isCorrect),
    autoFocusInput,
    inputRef,
  });
  const { round, answered } = game;

  // A word on screen was removed (e.g. by sync from another device): new question.
  const liveIds = words.map(w => w.id).join('|');
  useEffect(() => {
    if (round && !answered && round.cards.some(card => !words.some(w => w.id === card.id))) game.handleNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveIds]);

  if (words.length === 0) {
    return (
      <p id="dictation-practice-empty" className="vm-panel rounded-2xl p-5 text-sm text-slate-300">
        Chưa có từ nào đã lưu. Trong Luyện nghe, khi một từ mở, bấm biểu tượng lưu <Bookmark size={14} className="inline text-violet-300" aria-hidden="true" />.
      </p>
    );
  }

  return (
    <div>
      {/* ── Stats bar + auto-open keyboard + voice ── */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <StatsBar score={game.score} total={game.totalPlayed} />
        <AutoFocusToggle id="dictation-words-autofocus-toggle" enabled={autoFocusInput} onToggle={() => toggleAutoFocus(inputRef.current)} />
        <VoiceSettings />
      </div>

      {/* ── Filters (only those the saved words can use) ── */}
      {(options.lessons.length > 0 || showWrong || showNew) && (
        <div id="dictation-practice-filters" className="vm-panel rounded-2xl p-4 sm:p-5 mb-6 space-y-3.5">
          {options.lessons.length > 0 && (
            <label className="block">
              <span className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">Tên bài</span>
              <select
                id="dictation-practice-lesson" value={lesson} onChange={e => setLessonFilter(e.target.value)}
                className="w-full vm-input rounded-xl px-3 py-2 text-base sm:text-sm"
              >
                <option value={ALL_LESSONS}>Tất cả bài ({words.length})</option>
                {options.lessons.map(o => <option key={o.value} value={o.value}>{o.label} ({o.count})</option>)}
              </select>
            </label>
          )}
          {showWrong && <FilterSwitch id="dictation-practice-wrong" label="Chỉ từ hay nghe sai" count={options.wrongCount} checked={wrongOnly} onToggle={() => setWrongOnly(v => !v)} />}
          {showNew && <FilterSwitch id="dictation-practice-new" label="Chưa luyện" count={options.newCount} checked={newOnly} onToggle={() => setNewOnly(v => !v)} />}
        </div>
      )}

      {!round ? (
        game.hasEnough ? (
          <div className="flex items-center justify-center py-20 text-slate-300">
            <div className="animate-spin mr-3 w-5 h-5 border-2 border-slate-600 border-t-indigo-400 rounded-full" />
            Loading…
          </div>
        ) : (
          <div id="dictation-practice-nomatch" className="flex items-start gap-3 bg-amber-500/12 border border-amber-400/35 rounded-2xl p-5 animate-fade-in">
            <AlertCircle size={20} className="text-amber-300 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="text-amber-200 text-sm">Không còn từ nào khớp bộ lọc.</p>
              <button
                id="dictation-practice-clear" type="button"
                onClick={() => { setLessonFilter(ALL_LESSONS); setWrongOnly(false); setNewOnly(false); }}
                className="vm-btn px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 border border-slate-400/20 text-white hover:bg-slate-700"
              >Bỏ bộ lọc</button>
            </div>
          </div>
        )
      ) : (
        <>
          <PromptCard
            label="Which word do you hear…"
            hint={round.correct.word}
            isPlaying={game.isPlaying}
            listenCount={game.listenCount}
            answered={answered}
            replayId="dictation-practice-replay"
            onReplay={game.handleReplay}
            inputId="dictation-practice-input"
            inputRef={inputRef}
            value={game.typingInput}
            onChange={game.handleTypingChange}
          />

          {answered && (
            <div id="dictation-practice-feedback" role="status">
              <AnswerFeedback isCorrect={game.isCorrectAnswer}>
                {game.isCorrectAnswer
                  ? <>Excellent! You heard <span className="underline underline-offset-2 ml-1">{round.correct.word}</span></>
                  : <>Wrong. The answer was <span className="font-bold ml-1">{round.correct.word}</span></>}
              </AnswerFeedback>
            </div>
          )}

          <AnswerGrid>
            {round.cards.map((word, idx) => (
              <WordChoice key={word.id} word={word} state={game.cardState(word)} onClick={game.handleCardClick} index={idx} />
            ))}
          </AnswerGrid>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <SkipButton id="dictation-practice-next" answered={answered} onClick={game.handleNext} />
            <span className="text-xs text-slate-300">{pool.length} in pool</span>
          </div>
        </>
      )}
    </div>
  );
}
