import { useState, useRef, lazy, Suspense } from 'react';
import {
  Headphones, Eye, EyeOff, AlertCircle, CheckCircle2, XCircle, Clock, Star,
} from 'lucide-react';
import VoiceSettings from './VoiceSettings';
import { useListeningGame } from './listening/useListeningGame';
import { useAutoFocusPref } from './listening/useAutoFocusPref';
import {
  StatsBar, AutoFocusToggle, PromptCard, AnswerFeedback, AnswerGrid, SkipButton,
} from './listening/ListeningParts';
import { isDueForReview } from '../hooks/useVocabStore';
import { buildListeningRound } from '../utils/wordSelection';
import WordInitialTile from './WordInitialTile';
// Loaded only when the learner picks the Dictation source (keeps the main bundle small).
const DictationWordListening = lazy(() => import('./DictationWordListening'));

/* ------------------------------------------------------------------ */
/* Constants — mirrored from Vocabulary.jsx                             */
/* ------------------------------------------------------------------ */

const LEVEL_FILTER_OPTIONS = [
  { value: null, label: 'All Levels' },
  { value: 1,    label: 'L1 New'       },
  { value: 2,    label: 'L2 Familiar'  },
  { value: 3,    label: 'L3 Learning'  },
  { value: 4,    label: 'L4 Proficient'},
  { value: 5,    label: 'L5 Mastered'  },
];

const TYPE_FILTER_OPTIONS = [
  { value: 'All',    label: 'All Types',             icon: '🔤' },
  { value: 'Word',   label: 'Từ đơn (Word)',         icon: '📝' },
  { value: 'Phrase', label: 'Cụm từ (Phrase)',       icon: '💬' },
  { value: 'Family', label: 'Gia đình từ (Family)',  icon: '🌳' },
  { value: 'Preposition', label: 'Giới từ (Preposition)', icon: '🔗' },
];

/** Level badge background colours for the image card overlay */
const LEVEL_BG = {
  1: 'bg-[var(--sb-berry-btn)]',
  2: 'bg-[var(--sb-clay-text)]',
  3: 'bg-[var(--sb-ochre-text)]',
  4: 'bg-[var(--sb-lagoon)]',
  5: 'bg-[var(--sb-forest-btn)]',
};

/* ------------------------------------------------------------------ */
/* FilterPills — shared pill-button row                                 */
/* ------------------------------------------------------------------ */
function FilterPills({ options, active, onSelect, countFn, idPrefix }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {options.map(opt => {
        const count = countFn(opt.value);
        const isActive = active === opt.value;
        return (
          <button
            key={String(opt.value)}
            id={`${idPrefix}-${opt.value ?? 'all'}`}
            onClick={() => onSelect(opt.value)}
            className={`
              vm-btn flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium border
              ${isActive
                ? 'vm-btn-primary border-[var(--sb-ink)]'
                : 'bg-[var(--sb-paper-card)] text-[var(--sb-ink)] hover:bg-[var(--sb-paper-deep)] border-[var(--sb-ink-border)]'
              }
            `}
          >
            {opt.icon && <span className="text-xs">{opt.icon}</span>}
            <span>{opt.label}</span>
            <span className="ml-0.5 text-xs">({count})</span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ImageCard                                                            */
/* ------------------------------------------------------------------ */
function ImageCard({ word, state, onClick, showMeaning, onToggleMeaning, index, isGlobal }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError,  setImgError]  = useState(false);
  // Words without an image show a local initial-letter tile (no image service).
  const imageUrl = word.imageUrl?.trim() || '';

  const borderClass =
    state === 'correct'  ? 'border-[var(--sb-forest)] shadow-[var(--sb-shadow-md)]' :
    state === 'wrong'    ? 'border-[var(--sb-berry)]  shadow-[var(--sb-shadow-md)]' :
    state === 'idle'     ? 'border-[var(--sb-ink)] hover:border-[var(--sb-terracotta-strong)]' :
    /* disabled */         'border-[var(--sb-ink-border)] opacity-55';

  const ringOverlay =
    state === 'correct' ? 'ring-4 ring-[var(--sb-forest)]/30' :
    state === 'wrong'   ? 'ring-4 ring-[var(--sb-berry)]/30'  : '';

  return (
    <div
      className={`
        vm-card relative rounded-2xl overflow-hidden border-2
        ${borderClass} ${ringOverlay}
        ${state === 'idle' ? 'vm-card-interactive cursor-pointer active:scale-95' : 'cursor-default'}
      `}
      onClick={() => state === 'idle' && onClick(word)}
      id={`listening-card-${index}`}
      role="button"
      tabIndex={state === 'idle' ? 0 : -1}
      onKeyDown={e => e.key === 'Enter' && state === 'idle' && onClick(word)}
      aria-label={`Choose ${word.english}`}
    >
      {/* Image area */}
      <div className="relative w-full aspect-[4/3] bg-[var(--sb-paper-deep)]">
        {!imageUrl ? (
          <WordInitialTile word={word.english} className="absolute inset-0" />
        ) : !imgError ? (
          <img
            src={imageUrl}
            alt={word.english}
            className={`w-full h-full object-cover transition-opacity duration-300 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setImgLoaded(true)}
            onError={() => { setImgError(true); setImgLoaded(true); }}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--sb-paper-deep)] text-[var(--sb-ink)]">
            <span className="text-4xl mb-2">📷</span>
            <span className="text-xs text-center px-2 font-semibold">
              {word.english}
              {word.annotation?.trim() && (
                <span className="ml-1 text-[10px] font-normal text-[var(--sb-ink-soft)]">({word.annotation.trim()})</span>
              )}
            </span>
          </div>
        )}

        {/* Skeleton shimmer */}
        {imageUrl && !imgLoaded && !imgError && (
          <div className="absolute inset-0 vm-skeleton" />
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--sb-ink)]/25 via-transparent to-transparent pointer-events-none" />

        {/* Level badge */}
        <span className={`
          absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full text-white border border-[var(--sb-ink)]/30 shadow-sm
          ${LEVEL_BG[word.level] ?? 'bg-[var(--sb-ink-soft)]'}
        `}>
          L{word.level}
        </span>

        {/* Result overlay icon */}
        {state === 'correct' && (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--sb-forest)]/25 vm-scale-in">
            <span className="p-2.5 rounded-full bg-[var(--sb-forest-btn)] border-2 border-[var(--sb-ink)] shadow-[var(--sb-shadow-sm)] text-white">
              <CheckCircle2 size={40} />
            </span>
          </div>
        )}
        {state === 'wrong' && (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--sb-berry)]/25 vm-scale-in">
            <span className="p-2.5 rounded-full bg-[var(--sb-berry-btn)] border-2 border-[var(--sb-ink)] shadow-[var(--sb-shadow-sm)] text-white">
              <XCircle size={40} />
            </span>
          </div>
        )}
      </div>

      {/* Bottom bar: meaning toggle */}
      <div className="bg-[var(--sb-paper-card)] px-3 py-2 flex items-center justify-between gap-2 border-t-2 border-[var(--sb-ink)]">
        <div className="flex-1 min-w-0">
          {showMeaning ? (
            <p className="sb-font-body text-[var(--sb-ink)] text-base font-semibold leading-snug truncate animate-fade-in">
              {word.vietnamese}
            </p>
          ) : (
            <p className="text-[var(--sb-ink-soft)] text-xs select-none">• • • • •</p>
          )}
        </div>
        <button
          id={`toggle-meaning-${index}`}
          className={`shrink-0 p-1 rounded-lg transition-colors ${
            showMeaning
              ? 'text-[var(--sb-terracotta-text)] hover:text-[var(--sb-terracotta-hover)]'
              : 'text-[var(--sb-ink-soft)] hover:text-[var(--sb-terracotta-text)]'
          }`}
          onClick={e => { e.stopPropagation(); onToggleMeaning(); }}
          aria-label={showMeaning ? 'Hide all meanings' : 'Show all Vietnamese meanings'}
          title={showMeaning ? 'Hide all meanings' : 'Show all meanings'}
        >
          {showMeaning ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main Component                                                       */
/* ------------------------------------------------------------------ */
export default function ListeningReview({ words, updateWordLevel, dictationStore = null }) {

  /* ── Word source: main Vocabulary (unchanged behaviour) or saved Dictation words ── */
  const [source, setSource] = useState('main'); // 'main' | 'dictation'
  const [dictWrongOnly, setDictWrongOnly] = useState(false);
  const [dictScore, setDictScore] = useState(0);
  const [dictPlayed, setDictPlayed] = useState(0);
  const dictInputRef = useRef(null);
  const dictWordCount = dictationStore?.words.length ?? 0;

  /* ── Filter state ── */
  const [levelFilter, setLevelFilter] = useState(null);    // null = All Levels
  const [typeFilter,  setTypeFilter]  = useState('All');   // 'All' | 'Word' | 'Phrase' | 'Family' | 'Preposition'
  const [dueOnly,     setDueOnly]     = useState(false);   // spaced-repetition "due today" filter
  const [hardOnly,    setHardOnly]    = useState(false);   // difficult-word star filter

  const [isMeaningRevealed, setIsMeaningRevealed] = useState(false); // global, persists across questions
  // Per-device: auto-focus the typing input (opens the phone keyboard) on each new word.
  const [autoFocusInput, saveAutoFocus] = useAutoFocusPref();
  const inputRef = useRef(null); // ref for the typing input — keeps focus between rounds

  /* ── Derived: filtered vocabulary pool (strict intersection, no silent fallback) ── */
  const filteredPool = (() => {
    let pool = words;
    if (hardOnly) pool = pool.filter(w => Boolean(w.hardMarked));
    if (levelFilter !== null) pool = pool.filter(w => w.level === levelFilter);
    if (typeFilter !== 'All') pool = pool.filter(w => (w.wordType || 'Word') === typeFilter);
    if (dueOnly) pool = pool.filter(isDueForReview);
    return pool;
  })();

  /* ── Round engine (shared with Dictation → "Từ đã lưu") ── */
  // NOTE: isMeaningRevealed is intentionally NOT reset between rounds.
  const game = useListeningGame({
    pool: filteredPool,
    minPool: 4,
    resetKey: JSON.stringify([levelFilter, typeFilter, dueOnly, hardOnly]),
    buildRound: buildListeningRound,
    textOf: word => word.english,
    isTypedMatch: (typed, word) => typed.trim().toLowerCase() === word.english.toLowerCase(),
    voiceKey: 'listen',
    // SRS update — same API as Quiz.jsx
    onAnswer: (word, isCorrect) => updateWordLevel(word.english, isCorrect),
    autoFocusInput,
    inputRef,
  });
  const { round, answered, hasEnough: hasEnoughWords, isCorrectAnswer } = game;

  /* ── Toggle "auto-open keyboard" (saved on this device only) ── */
  function toggleAutoFocus() {
    saveAutoFocus(source === 'dictation' ? dictInputRef.current : inputRef.current);
  }

  function chooseSource(next) {
    if (next === source) return;
    // Stop the main round's pending advance/audio so it cannot play over the other mode.
    game.stop();
    setSource(next);
  }

  /* ── Toggle global meaning visibility (persists across questions) ── */
  function toggleMeaning() {
    setIsMeaningRevealed(v => !v);
  }

  /* ── Count helpers for pills (strict intersection with active filters) ── */
  function levelCount(val) {
    return words.filter(w =>
      (!hardOnly || Boolean(w.hardMarked)) &&
      (typeFilter === 'All' || (w.wordType || 'Word') === typeFilter) &&
      (!dueOnly || isDueForReview(w)) &&
      (val === null || w.level === val)
    ).length;
  }

  function typeCount(val) {
    return words.filter(w =>
      (!hardOnly || Boolean(w.hardMarked)) &&
      (levelFilter === null || w.level === levelFilter) &&
      (!dueOnly || isDueForReview(w)) &&
      (val === 'All' || (w.wordType || 'Word') === val)
    ).length;
  }

  /** How many words in the current level+type(+hard) pool are due for review */
  const dueCount = words.filter(w =>
    (!hardOnly || Boolean(w.hardMarked)) &&
    (levelFilter === null || w.level === levelFilter) &&
    (typeFilter === 'All' || (w.wordType || 'Word') === typeFilter) &&
    isDueForReview(w)
  ).length;

  /** How many words in the current level+type(+due) pool are starred as difficult */
  const hardCount = words.filter(w =>
    Boolean(w.hardMarked) &&
    (levelFilter === null || w.level === levelFilter) &&
    (typeFilter === 'All' || (w.wordType || 'Word') === typeFilter) &&
    (!dueOnly || isDueForReview(w))
  ).length;

  /* ---------------------------------------------------------------- */
  /* Render                                                             */
  /* ---------------------------------------------------------------- */
  return (
    <div className="vm-page-enter max-w-2xl mx-auto">

      {/* ── Page header ── */}
      <div className="mb-6">
        <h1 className="sb-font-display text-3xl font-extrabold tracking-tight text-[var(--sb-ink)] mb-1 flex items-center gap-3">
          <Headphones size={28} className="text-[var(--sb-terracotta-strong)]" />
          Listening Review
        </h1>
        <p className="text-[var(--sb-ink-soft)] text-sm">
          Listen to the word and tap the matching image.
        </p>
      </div>

      {/* ── Source picker (only when the Dictation store is available) ── */}
      {dictationStore && (
        <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Nguồn từ">
          <span className="text-[var(--sb-ink-soft)] text-xs font-semibold uppercase tracking-wider">Nguồn</span>
          <div className="flex items-center gap-1 bg-[var(--sb-paper-deep)] border border-[var(--sb-ink-border)] rounded-xl p-1 max-w-full flex-wrap">
            {[['main', 'Từ vựng chính'], ['dictation', `Từ chép chính tả (${dictWordCount})`]].map(([value, label]) => (
              <button
                key={value} id={`lr-source-${value}`} type="button" aria-pressed={source === value} onClick={() => chooseSource(value)}
                className={`vm-btn px-3 py-1.5 rounded-lg text-xs font-semibold ${source === value
                  ? 'bg-[var(--sb-paper-card)] text-[var(--sb-ink)] border border-[var(--sb-ink)] shadow-sm'
                  : 'text-[var(--sb-ink-soft)] hover:text-[var(--sb-ink)] hover:bg-[var(--sb-paper-card)]/60'}`}
              >{label}</button>
            ))}
          </div>
        </div>
      )}

      {/* ── Stats bar + auto-open keyboard toggle ── */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        {source === 'dictation'
          ? <StatsBar score={dictScore} total={dictPlayed} />
          : <StatsBar score={game.score} total={game.totalPlayed} />}
        <AutoFocusToggle id="lr-autofocus-toggle" enabled={autoFocusInput} onToggle={toggleAutoFocus} />
        <VoiceSettings />
      </div>

      {source === 'dictation' && dictationStore ? (
        <>
          {/* Dictation words: Level/Type/Hard/Due filters do not apply */}
          <div className="vm-panel rounded-2xl p-4 sm:p-5 mb-6 flex items-center justify-between gap-3">
            <span className="text-[var(--sb-ink)] text-xs font-semibold">Chỉ từ hay sai (đã từng nghe sai)</span>
            <button
              id="lr-dictation-wrong-toggle" type="button" onClick={() => setDictWrongOnly(v => !v)} aria-pressed={dictWrongOnly}
              aria-label="Chỉ từ hay sai"
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 ${dictWrongOnly ? 'bg-[var(--sb-berry-btn)]' : 'bg-[var(--sb-ink-soft)]'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200 ${dictWrongOnly ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
          </div>
          <Suspense fallback={<p className="text-[var(--sb-ink-soft)] text-sm" role="status">Đang tải…</p>}>
          <DictationWordListening
            store={dictationStore} wrongOnly={dictWrongOnly} autoFocusInput={autoFocusInput} inputRef={dictInputRef}
            onResult={ok => { setDictPlayed(t => t + 1); if (ok) setDictScore(v => v + 1); }}
          />
          </Suspense>
        </>
      ) : (<>
      {/* ── Filter panel ── */}
      <div className="vm-panel rounded-2xl p-4 sm:p-5 mb-6 space-y-3.5">
        {/* Level filter */}
        <div>
          <p className="text-[var(--sb-ink-soft)] text-xs font-semibold uppercase tracking-wider mb-2">
            Level
          </p>
          <FilterPills
            options={LEVEL_FILTER_OPTIONS}
            active={levelFilter}
            onSelect={val => { setLevelFilter(val); }}
            countFn={levelCount}
            idPrefix="lr-level"
          />
        </div>

        {/* Type filter */}
        <div>
          <p className="text-[var(--sb-ink-soft)] text-xs font-semibold uppercase tracking-wider mb-2">
            Type
          </p>
          {/* Segmented tab style matching Vocabulary.jsx */}
          <div className="flex items-center gap-1 bg-[var(--sb-paper-deep)] border border-[var(--sb-ink-border)] rounded-xl p-1 w-fit max-w-full flex-wrap">
            {TYPE_FILTER_OPTIONS.map(opt => (
              <button
                key={opt.value}
                id={`lr-type-${opt.value.toLowerCase()}`}
                onClick={() => setTypeFilter(opt.value)}
                className={`
                  vm-btn flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                  ${typeFilter === opt.value
                    ? 'bg-[var(--sb-paper-card)] text-[var(--sb-ink)] border border-[var(--sb-ink)] shadow-sm'
                    : 'text-[var(--sb-ink-soft)] hover:text-[var(--sb-ink)] hover:bg-[var(--sb-paper-card)]/60'
                  }
                `}
              >
                <span>{opt.icon}</span>
                <span className="hidden sm:inline">{opt.label.split('(')[0].trim()}</span>
                <span className="text-xs">({typeCount(opt.value)})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Difficult Words only toggle */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Star size={14} className={hardOnly ? 'fill-[var(--sb-ochre)] text-[var(--sb-ochre-text)]' : 'text-[var(--sb-ochre-text)]'} />
            <span className="text-[var(--sb-ink)] text-xs font-semibold">Chỉ từ khó ⭐</span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[var(--sb-ochre-soft)] text-[var(--sb-ochre-text)] border border-[var(--sb-ochre-text)]/35">
              {hardCount} từ khó
            </span>
          </div>
          <button
            id="lr-hard-toggle"
            type="button"
            onClick={() => setHardOnly(v => !v)}
            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 ${
              hardOnly ? 'bg-[var(--sb-ochre-text)]' : 'bg-[var(--sb-ink-soft)]'
            }`}
            title={hardOnly ? 'Hiện tất cả từ' : 'Chỉ luyện các từ đã đánh dấu sao khó'}
            aria-label="Chỉ từ khó ⭐"
            aria-pressed={hardOnly}
          >
            <span
              className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200 ${
                hardOnly ? 'translate-x-4' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        {/* Due Today toggle */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Clock size={14} className="text-[var(--sb-ochre-text)]" />
            <span className="text-[var(--sb-ink-soft)] text-xs font-semibold uppercase tracking-wider">Due for Review</span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[var(--sb-ochre-soft)] text-[var(--sb-ochre-text)] border border-[var(--sb-ochre-text)]/35">
              {dueCount} due
            </span>
          </div>
          <button
            id="lr-due-toggle"
            type="button"
            onClick={() => setDueOnly(v => !v)}
            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 ${
              dueOnly ? 'bg-[var(--sb-ochre-text)]' : 'bg-[var(--sb-ink-soft)]'
            }`}
            title={dueOnly ? 'Show all words' : 'Show only words due for review'}
            aria-pressed={dueOnly}
          >
            <span
              className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200 ${
                dueOnly ? 'translate-x-4' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      {/* ── Not enough words for current filters ── */}
      {!hasEnoughWords ? (
        <div className="flex items-start gap-3 bg-[var(--sb-ochre-soft)] border-2 border-[var(--sb-ink)] rounded-2xl p-5 animate-fade-in">
          <AlertCircle size={20} className="text-[var(--sb-ochre-text)] shrink-0 mt-0.5" />
          <div>
            <p className="text-[var(--sb-ink)] font-bold mb-1">
              {hardOnly
                ? 'Chưa đủ từ khó ⭐ khớp bộ lọc hiện tại'
                : 'Not enough words match these filters'}
            </p>
            <p className="text-[var(--sb-ink-soft)] text-sm leading-relaxed">
              Cần ít nhất <strong>4 từ</strong> khớp bộ lọc để tạo câu hỏi nghe 4 lựa chọn.
              Hiện có <strong>{filteredPool.length}</strong> từ khớp{hardOnly ? ' (đang bật "Chỉ từ khó ⭐")' : ''}.
              Please select a category with at least <strong>4 words</strong> to play.
            </p>
          </div>
        </div>
      ) : !round ? (
        /* ── Loading spinner ── */
        <div className="flex items-center justify-center py-20 text-[var(--sb-ink-soft)]">
          <div className="animate-spin mr-3 w-5 h-5 border-2 border-[var(--sb-ink-border)] border-t-[var(--sb-terracotta-strong)] rounded-full" />
          Loading…
        </div>
      ) : (
        <>
          {/* ── Audio control card ── */}
          <PromptCard
            label="Which image matches…"
            hint={<>
              {round.correct.english}
              {round.correct.annotation?.trim() && (
                <span className="sb-font-body ml-1.5 text-sm font-medium text-[var(--sb-ink-soft)]">({round.correct.annotation.trim()})</span>
              )}
            </>}
            isPlaying={game.isPlaying}
            listenCount={game.listenCount}
            answered={answered}
            replayId="replay-audio-btn"
            onReplay={game.handleReplay}
            inputId="listening-type-answer"
            inputRef={inputRef}
            value={game.typingInput}
            onChange={game.handleTypingChange}
          />

          {/* ── Feedback banner ── */}
          {answered && (
            <AnswerFeedback isCorrect={isCorrectAnswer}>
              {isCorrectAnswer
                ? <>Excellent! +1 streak for <span className="underline underline-offset-2 ml-1">
                    {round.correct.english}
                    {round.correct.annotation?.trim() && (
                      <span className="sb-font-body ml-1.5 text-sm font-medium text-[var(--sb-ink-soft)]">({round.correct.annotation.trim()})</span>
                    )}
                  </span></>
                : <>Wrong — streak reset. The answer was <span className="font-bold ml-1">
                    {round.correct.english}
                    {round.correct.annotation?.trim() && (
                      <span className="sb-font-body ml-1.5 text-sm font-medium text-[var(--sb-ink-soft)]">({round.correct.annotation.trim()})</span>
                    )}
                  </span></>
              }
            </AnswerFeedback>
          )}

          {/* ── 2×2 Image Grid ── */}
          <AnswerGrid>
            {round.cards.map((word, idx) => (
              <ImageCard
                key={word.id}
                word={word}
                state={game.cardState(word)}
                onClick={game.handleCardClick}
                showMeaning={isMeaningRevealed}
                onToggleMeaning={toggleMeaning}
                index={idx}
              />
            ))}
          </AnswerGrid>

          {/* ── Action bar ── */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <SkipButton id="listening-next-btn" answered={answered} onClick={game.handleNext} />

            {/* Global meaning toggle */}
            <button
              id="toggle-all-meanings-btn"
              onClick={toggleMeaning}
              title={isMeaningRevealed ? 'Hide Vietnamese meanings' : 'Show Vietnamese meanings for all cards'}
              className={`
                vm-btn flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border
                ${
                  isMeaningRevealed
                    ? 'bg-[var(--sb-terracotta-soft)] border-[var(--sb-ink)] text-[var(--sb-terracotta-text)] hover:bg-[var(--sb-ochre-soft)]'
                    : 'bg-[var(--sb-paper-card)] border-[var(--sb-ink-border)] text-[var(--sb-ink)] hover:bg-[var(--sb-paper-deep)]'
                }
              `}
            >
              {isMeaningRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
              <span>{isMeaningRevealed ? 'Hide' : 'Meanings'}</span>
            </button>

            {/* Target level hint */}
            <div className="flex items-center gap-2 text-xs text-[var(--sb-ink-soft)]">
              <span>Target:</span>
              <span className={`px-2 py-0.5 rounded-full font-bold text-white text-[11px] ${LEVEL_BG[round.correct.level] ?? 'bg-[var(--sb-ink-soft)]'}`}>
                L{round.correct.level}
              </span>
              <span className="text-[var(--sb-ink-soft)]">·</span>
              <span className="text-[var(--sb-ink-soft)]">{filteredPool.length} in pool</span>
            </div>
          </div>
        </>
      )}
      </>)}
    </div>
  );
}
