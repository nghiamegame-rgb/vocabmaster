import { useState, useEffect, useMemo, useRef } from 'react';
import { Volume2, CheckCircle, XCircle, RefreshCw, Filter, Star } from 'lucide-react';
import { playAudio } from '../utils/audio';
import { pickNextWord } from '../utils/wordSelection';

// ── Filter constants (mirroring Vocabulary.jsx) ──────────────────────────────
const LEVEL_OPTS = [
  { value: null, label: 'All Levels' },
  { value: 1,    label: 'L1 — New' },
  { value: 2,    label: 'L2 — Familiar' },
  { value: 3,    label: 'L3 — Learning' },
  { value: 4,    label: 'L4 — Proficient' },
  { value: 5,    label: 'L5 — Mastered' },
];

const TYPE_OPTS = [
  { value: 'All',    label: 'All Types', icon: '🔤' },
  { value: 'Word',   label: 'Words',     icon: '📝' },
  { value: 'Phrase', label: 'Phrases',   icon: '💬' },
  { value: 'Family', label: 'Families',  icon: '🌳' },
  { value: 'Preposition', label: 'Prepositions', icon: '🔗' },
];

/**
 * How many recently-seen word IDs to remember per session.
 * Words in this window are excluded from being picked next, as long as
 * other candidates remain in the pool.
 *
 * Window = min(pool.length - 1, RECENT_WINDOW) so the session never deadlocks
 * when the pool is small.
 */
const RECENT_WINDOW = 8;

/**
 * Advance the recentIds set by adding `newId` and evicting the oldest entry
 * when the window would exceed `maxSize`.
 *
 * We use an array (in insertion order) as the backing store and convert to Set
 * for O(1) lookups in pickNextWord.
 *
 * @param {string[]} recentArr  - ordered array of recent IDs (oldest first)
 * @param {string}   newId      - ID of the word just shown
 * @param {number}   maxSize    - maximum window size
 * @returns {string[]}          - new recentArr (original is not mutated)
 */
function advanceRecent(recentArr, newId, maxSize) {
  const next = [...recentArr, newId];
  return next.length > maxSize ? next.slice(next.length - maxSize) : next;
}

export default function Flashcard({ words, updateWordLevel }) {
  const [mode,        setMode]        = useState('eng-vie'); // 'eng-vie' | 'vie-eng'
  const [levelFilter, setLevelFilter] = useState(null);      // null = all
  const [typeFilter,  setTypeFilter]  = useState('All');
  const [hardOnly,    setHardOnly]    = useState(false);

  // ── Current card state ───────────────────────────────────────────────────
  const [currentWord,  setCurrentWord]  = useState(null);
  const [isFlipped,    setIsFlipped]    = useState(false);
  const [finished,     setFinished]     = useState(false);

  // Session counter (how many cards shown this session)
  const [sessionCount, setSessionCount] = useState(0);

  /**
   * recentArr: IDs of recently-shown words, oldest-first.
   * Stored as an array so we can evict the oldest entry in O(n).
   * Converted to a Set when passed to pickNextWord for O(1) lookup.
   *
   * We use a ref instead of state because updating it should NOT trigger a
   * re-render — it's internal bookkeeping for the selection algorithm.
   */
  const recentArrRef       = useRef([]);
  const advanceTimerRef    = useRef(null);
  const isTransitioningRef = useRef(false);
  const filteredWordsRef   = useRef([]);

  // ── Filtered word pool ───────────────────────────────────────────────────
  const filteredWords = useMemo(() => {
    let result = words;
    if (hardOnly)           result = result.filter(w => Boolean(w.hardMarked));
    if (levelFilter !== null) result = result.filter(w => w.level === levelFilter);
    if (typeFilter  !== 'All') result = result.filter(w => (w.wordType || 'Word') === typeFilter);
    return result;
  }, [words, hardOnly, levelFilter, typeFilter]);

  useEffect(() => {
    filteredWordsRef.current = filteredWords;
  }, [filteredWords]);

  const hardCount = useMemo(() => {
    return words.filter(w =>
      Boolean(w.hardMarked) &&
      (levelFilter === null || w.level === levelFilter) &&
      (typeFilter === 'All' || (w.wordType || 'Word') === typeFilter),
    ).length;
  }, [words, levelFilter, typeFilter]);

  // ── Pick the next card ───────────────────────────────────────────────────
  /**
   * Selects the next word using pickNextWord and updates recentArrRef.
   * Called on initial mount, after each answer, and on restart.
   *
   * @param {object[]} pool    - current filtered pool (use latest, not stale)
   * @param {string[]} recent  - current recentArr contents
   */
  function advanceToNext(pool, recent) {
    if (pool.length === 0) {
      setCurrentWord(null);
      setFinished(true);
      return;
    }

    const windowSize = Math.min(pool.length - 1, RECENT_WINDOW);
    const recentSet  = new Set(recent.slice(-windowSize)); // use only the relevant tail
    const next       = pickNextWord(pool, recentSet);

    if (!next) {
      setCurrentWord(null);
      setFinished(true);
      return;
    }

    // Advance the window
    recentArrRef.current = advanceRecent(recent, next.id, windowSize);
    setCurrentWord(next);
    setIsFlipped(false);
  }

  // ── Reset session when filters or mode change ─────────────────────────────
  //
  // CRITICAL FIX: we deliberately do NOT include `filteredWords` directly in
  // the dependency array — if we did, every updateWordLevel call (which changes
  // `words` → `filteredWords`) would reset the session mid-card.
  //
  // Instead we depend only on the filter *parameters* (levelFilter, typeFilter,
  // mode). The pool is read fresh from `filteredWords` inside the effect so it
  // uses the latest state without being a dependency.
  //
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
    isTransitioningRef.current = false;
    // Reset session state
    recentArrRef.current = [];
    setSessionCount(0);
    setFinished(false);
    // Use the current filteredWords (captured via closure; stale-safe because
    // filteredWords updates synchronously with levelFilter/typeFilter/hardOnly changes)
    advanceToNext(filteredWords, []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelFilter, typeFilter, hardOnly, mode]);

  useEffect(() => () => {
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────
  function handleLevelFilter(val) {
    setLevelFilter(val);
    setFinished(false);
  }

  function handleTypeFilter(val) {
    setTypeFilter(val);
    setFinished(false);
  }

  function handleHardFilter() {
    setHardOnly(v => !v);
    setFinished(false);
  }

  function restartSession() {
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
    isTransitioningRef.current = false;
    recentArrRef.current = [];
    setSessionCount(0);
    setFinished(false);
    advanceToNext(filteredWords, []);
  }

  /**
   * Advance to the next card.
   * `remembered` — true = user marked as remembered; false = needs review.
   */
  const handleNext = (remembered) => {
    if (!currentWord || isTransitioningRef.current) return;
    isTransitioningRef.current = true;

    // SRS update
    if (updateWordLevel) {
      updateWordLevel(currentWord.english, remembered);
    }

    setSessionCount(c => c + 1);
    setIsFlipped(false);

    // Small delay to let the flip animation settle before switching words
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    advanceTimerRef.current = setTimeout(() => {
      advanceTimerRef.current = null;
      isTransitioningRef.current = false;
      advanceToNext(filteredWordsRef.current, recentArrRef.current);
    }, 200);
  };

  const playPronunciation = (e) => {
    e.stopPropagation();
    // TTS reads only the clean english word, not the annotation
    if (currentWord) playAudio(currentWord.english);
  };

  // ── Filter bar (always rendered) ─────────────────────────────────────────
  const filterBar = (
    <div className="w-full space-y-3 mb-6">
      {/* Level filter pills + difficult-word toggle */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={13} className="text-[var(--sb-ink-soft)] shrink-0" />
        {LEVEL_OPTS.map(opt => {
          const base = words.filter(w =>
            (!hardOnly || Boolean(w.hardMarked)) &&
            (typeFilter === 'All' || (w.wordType || 'Word') === typeFilter),
          );
          const count = opt.value === null
            ? base.length
            : base.filter(w => w.level === opt.value).length;
          return (
            <button
              key={String(opt.value)}
              id={`flashcard-level-${opt.value ?? 'all'}`}
              onClick={() => handleLevelFilter(opt.value)}
              className={`vm-btn px-3 py-1.5 rounded-full text-xs font-bold border-2 ${
                levelFilter === opt.value
                  ? 'vm-btn-primary'
                  : 'bg-[var(--sb-paper-card)] text-[var(--sb-ink)] hover:bg-[var(--sb-paper-deep)] border-[var(--sb-ink-border)]'
              }`}
            >
              {opt.label}
              <span className="ml-1">({count})</span>
            </button>
          );
        })}
        <button
          id="flashcard-hard-toggle"
          type="button"
          onClick={handleHardFilter}
          aria-pressed={hardOnly}
          title={hardOnly ? 'Hiện tất cả từ' : 'Chỉ luyện các từ đã đánh dấu sao khó'}
          className={`vm-btn flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border-2 ${
            hardOnly
              ? 'bg-[var(--sb-ochre-soft)] text-[var(--sb-ochre-text)] border-[var(--sb-ink)] shadow-[var(--sb-shadow-sm)]'
              : 'bg-[var(--sb-paper-card)] text-[var(--sb-ink)] hover:bg-[var(--sb-ochre-soft)] hover:text-[var(--sb-ochre-text)] border-[var(--sb-ink-border)]'
          }`}
        >
          <Star size={12} className={hardOnly ? 'fill-[var(--sb-ochre)] text-[var(--sb-ochre-text)]' : 'text-[var(--sb-ochre-text)]'} />
          <span>Chỉ từ khó ⭐</span>
          <span>({hardCount})</span>
        </button>
      </div>

      {/* Type filter tab bar */}
      <div className="vm-panel flex items-center gap-1 rounded-xl p-1 w-fit max-w-full flex-wrap">
        {TYPE_OPTS.map(opt => {
          const pool = words.filter(w =>
            (!hardOnly || Boolean(w.hardMarked)) &&
            (levelFilter === null || w.level === levelFilter),
          );
          const count = opt.value === 'All'
            ? pool.length
            : pool.filter(w => (w.wordType || 'Word') === opt.value).length;
          return (
            <button
              key={opt.value}
              id={`flashcard-type-${opt.value.toLowerCase()}`}
              onClick={() => handleTypeFilter(opt.value)}
              className={`vm-btn flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border ${
                typeFilter === opt.value
                  ? 'bg-[var(--sb-terracotta-strong)] text-white border-[var(--sb-ink)] shadow-[var(--sb-shadow-sm)]'
                  : 'border-transparent text-[var(--sb-ink)] hover:bg-[var(--sb-paper-deep)]'
              }`}
            >
              <span>{opt.icon}</span>
              <span>{opt.label}</span>
              <span>({count})</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  // ── Empty state ───────────────────────────────────────────────────────────
  if (words.length === 0) {
    return (
      <div className="vm-page-enter flex flex-col items-center justify-center py-16">
        <div className="sb-card px-6 py-8 text-center">
          <p className="text-[var(--sb-ink-soft)] font-semibold">No vocabulary words available. Add some in the Vocabulary tab.</p>
        </div>
      </div>
    );
  }

  if (filteredWords.length === 0) {
    return (
      <div className="max-w-2xl mx-auto vm-page-enter flex flex-col items-center">
        <div className="w-full mb-6">
          <h1 className="sb-font-display text-3xl font-extrabold text-[var(--sb-ink)] mb-1">Flashcard Mode</h1>
          <p className="text-[var(--sb-ink-soft)] font-semibold text-sm">Filter by mastery level and vocabulary type.</p>
        </div>
        {filterBar}
        <div className="sb-card w-full text-center py-12 px-6">
          <div className="w-16 h-16 rounded-2xl sb-sticker bg-[var(--sb-paper-warm)] flex items-center justify-center mx-auto mb-4">
            <Filter size={28} className="text-[var(--sb-ink-soft)]" />
          </div>
          <h3 className="sb-font-body text-[var(--sb-ink)] font-bold text-lg mb-2">
            {hardOnly ? 'Không có từ khó ⭐ nào khớp bộ lọc này' : 'Không có từ nào khớp bộ lọc này'}
          </h3>
          <p className="text-[var(--sb-ink-soft)] text-sm">
            {hardOnly
              ? 'Hãy đánh dấu ⭐ cho từ khó trong tab Vocabulary hoặc tắt bộ lọc "Chỉ từ khó ⭐".'
              : 'Thử bộ lọc khác hoặc thêm từ mới trong tab Vocabulary.'}
          </p>
        </div>
      </div>
    );
  }

  // ── Finished / no word selected yet ──────────────────────────────────────
  if (finished || !currentWord) {
    return (
      <div className="max-w-2xl mx-auto vm-page-enter flex flex-col items-center">
        <div className="w-full mb-6">
          <h1 className="sb-font-display text-3xl font-extrabold text-[var(--sb-ink)] mb-1">Flashcard Mode</h1>
          <p className="text-[var(--sb-ink-soft)] font-semibold text-sm">Filter by mastery level and vocabulary type.</p>
        </div>
        {filterBar}
        <div className="sb-card w-full flex flex-col items-center space-y-5 py-10 px-6 vm-scale-in">
          <div className="w-24 h-24 rounded-full bg-[var(--sb-forest-soft)] border-2 border-[var(--sb-ink)] shadow-[var(--sb-shadow-sm)] flex items-center justify-center">
            <CheckCircle size={48} className="text-[var(--sb-forest-text)]" />
          </div>
          <h2 className="sb-font-display text-2xl font-extrabold text-[var(--sb-ink)]">Session Complete!</h2>
          <p className="text-[var(--sb-ink-soft)] font-semibold text-sm">{sessionCount} card{sessionCount !== 1 ? 's' : ''} reviewed</p>
          <button
            onClick={restartSession}
            className="vm-btn vm-btn-primary px-6 py-3 rounded-xl font-bold flex items-center gap-2"
          >
            <RefreshCw size={20} /> Review Again
          </button>
        </div>
      </div>
    );
  }

  // ── Card content ──────────────────────────────────────────────────────────
  const frontContent = mode === 'eng-vie' ? (
    <div className="flex flex-col items-center justify-center h-full w-full max-w-full p-6 sm:p-8">
      <h2 className="sb-font-display text-3xl sm:text-4xl md:text-5xl font-extrabold leading-tight text-[var(--sb-ink)] mb-2 text-center break-words max-w-full">
        {currentWord.english}
      </h2>
      {currentWord.annotation?.trim() && (
        <p data-testid="flashcard-annotation" className="sb-vocab-annotation mt-1.5 max-w-full sm:max-w-prose text-center break-words">
          ({currentWord.annotation.trim()})
        </p>
      )}
      <button
        onClick={playPronunciation}
        aria-label="Pronounce word"
        className="vm-btn mt-6 p-4 rounded-full bg-[var(--sb-terracotta-soft)] text-[var(--sb-terracotta-text)] hover:bg-[var(--sb-terracotta-strong)] hover:text-white border-2 border-[var(--sb-ink)] shadow-[var(--sb-shadow-sm)]"
      >
        <Volume2 size={32} />
      </button>
    </div>
  ) : (
    <div className="flex flex-col items-center justify-center h-full w-full max-w-full p-6 sm:p-8">
      <h2 className="sb-font-body text-2xl sm:text-3xl md:text-4xl font-extrabold text-[var(--sb-ink)] mb-8 text-center leading-snug break-words max-w-full">{currentWord.vietnamese}</h2>
      <button
        onClick={playPronunciation}
        aria-label="Pronounce word"
        className="vm-btn p-4 rounded-full bg-[var(--sb-terracotta-soft)] text-[var(--sb-terracotta-text)] hover:bg-[var(--sb-terracotta-strong)] hover:text-white border-2 border-[var(--sb-ink)] shadow-[var(--sb-shadow-sm)]"
      >
        <Volume2 size={32} />
      </button>
    </div>
  );

  const backContent = mode === 'eng-vie' ? (
    <div className="flex flex-col items-center justify-center h-full w-full max-w-full p-6">
      {currentWord.imageUrl && (
        <img
          src={currentWord.imageUrl}
          alt={currentWord.english}
          className="w-full max-h-56 object-cover rounded-2xl mb-6 shadow-[var(--sb-shadow-sm)] border-2 border-[var(--sb-ink)]"
        />
      )}
      <h2 className="sb-font-body text-2xl sm:text-3xl md:text-4xl font-extrabold text-[var(--sb-forest-text)] text-center leading-snug mb-3 break-words max-w-full">{currentWord.vietnamese}</h2>
      <p className="text-[var(--sb-ink)] text-sm font-bold px-3.5 py-1 bg-[var(--sb-paper-card)] rounded-full border-2 border-[var(--sb-ink)]">{currentWord.wordType}</p>
    </div>
  ) : (
    <div className="flex flex-col items-center justify-center h-full w-full max-w-full p-6">
      {currentWord.imageUrl && (
        <img
          src={currentWord.imageUrl}
          alt={currentWord.english}
          className="w-full max-h-56 object-cover rounded-2xl mb-6 shadow-[var(--sb-shadow-sm)] border-2 border-[var(--sb-ink)]"
        />
      )}
      {/* Show english + annotation on the back in vie-eng mode */}
      <h2 className="sb-font-display text-3xl sm:text-4xl md:text-5xl font-extrabold leading-tight text-[var(--sb-terracotta-text)] text-center mb-2 break-words max-w-full">
        {currentWord.english}
      </h2>
      {currentWord.annotation?.trim() && (
        <p data-testid="flashcard-annotation" className="sb-vocab-annotation mb-2 max-w-full sm:max-w-prose text-center break-words">
          ({currentWord.annotation.trim()})
        </p>
      )}
      <p className="text-[var(--sb-ink)] text-sm font-bold px-3.5 py-1 bg-[var(--sb-paper-card)] rounded-full border-2 border-[var(--sb-ink)]">{currentWord.wordType}</p>
    </div>
  );

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto vm-page-enter flex flex-col items-center">

      <div className="w-full mb-4">
        <h1 className="sb-font-display text-3xl font-extrabold text-[var(--sb-ink)] mb-1">Flashcard Mode</h1>
        <p className="text-[var(--sb-ink-soft)] font-semibold text-sm">
          Click the card to flip it. Review your vocabulary with active recall.
        </p>
      </div>

      {/* Filters */}
      {filterBar}

      {/* Header controls — session counter + mode toggle */}
      <div className="vm-panel w-full flex justify-between items-center mb-6 p-3 rounded-2xl">
        <div className="text-[var(--sb-ink)] font-semibold px-3">
          <span className="text-[var(--sb-ink)] font-extrabold tabular-nums">{sessionCount + 1}</span>
          <span className="text-[var(--sb-ink-soft)] text-xs ml-2">({filteredWords.length} in pool)</span>
        </div>

        {/* Mode Toggle */}
        <div className="flex bg-[var(--sb-paper-deep)] rounded-xl p-1 border-2 border-[var(--sb-ink)] gap-1">
          <button
            onClick={() => setMode('eng-vie')}
            className={`vm-btn px-4 py-2 rounded-lg text-sm font-bold ${
              mode === 'eng-vie' ? 'vm-btn-primary text-white' : 'text-[var(--sb-ink)] hover:bg-[var(--sb-paper-card)]'
            }`}
          >
            Eng → Vie
          </button>
          <button
            onClick={() => setMode('vie-eng')}
            className={`vm-btn px-4 py-2 rounded-lg text-sm font-bold ${
              mode === 'vie-eng' ? 'vm-btn-primary text-white' : 'text-[var(--sb-ink)] hover:bg-[var(--sb-paper-card)]'
            }`}
          >
            Vie → Eng
          </button>
        </div>
      </div>

      {/* The Flashcard */}
      <div
        className="flashcard-container w-full h-[450px] md:h-[500px] mb-8 cursor-pointer perspective-1000"
        onClick={() => setIsFlipped(f => !f)}
      >
        <div className={`flashcard-inner vm-flip-inner w-full h-full relative preserve-3d ${isFlipped ? 'rotate-y-180' : ''}`}>

          {/* Front */}
          <div className="flashcard-front absolute w-full h-full backface-hidden rounded-3xl bg-[var(--sb-paper-card)] border-2 border-[var(--sb-ink)] shadow-[var(--sb-shadow-lg)] overflow-hidden hover:border-[var(--sb-terracotta-strong)] transition-colors duration-200">
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--sb-paper-card)] via-[var(--sb-paper-card)] to-[var(--sb-paper-warm)] pointer-events-none" />
            <div className="relative h-full flex items-center justify-center">
              {frontContent}
              <div className="absolute bottom-6 w-full text-center text-[var(--sb-ink-soft)] text-sm vm-pulse-soft font-bold">
                Click to flip
              </div>
            </div>
          </div>

          {/* Back */}
          <div className="flashcard-back absolute w-full h-full backface-hidden rounded-3xl bg-[var(--sb-paper-warm)] border-2 border-[var(--sb-ink)] shadow-[var(--sb-shadow-lg)] rotate-y-180 overflow-hidden hover:border-[var(--sb-forest)] transition-colors duration-200">
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--sb-paper-warm)] via-[var(--sb-paper-card)] to-[var(--sb-paper-deep)] pointer-events-none" />
            <div className="relative h-full flex items-center justify-center">
              {backContent}
            </div>
          </div>

        </div>
      </div>

      {/* Navigation Controls */}
      <div className={`w-full grid grid-cols-2 gap-4 transition-opacity duration-200 ${isFlipped ? 'opacity-100' : 'opacity-55 pointer-events-none'}`}>
        <button
          onClick={(e) => { e.stopPropagation(); handleNext(false); }}
          className="vm-btn py-4 rounded-2xl font-bold flex items-center justify-center gap-2 bg-[var(--sb-berry-soft)] text-[var(--sb-berry-text)] border-2 border-[var(--sb-ink)] hover:bg-[var(--sb-berry-btn)] hover:text-white shadow-[var(--sb-shadow-sm)]"
        >
          <XCircle size={22} /> Need Review
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleNext(true); }}
          className="vm-btn py-4 rounded-2xl font-bold flex items-center justify-center gap-2 bg-[var(--sb-forest-soft)] text-[var(--sb-forest-text)] border-2 border-[var(--sb-ink)] hover:bg-[var(--sb-forest-btn)] hover:text-white shadow-[var(--sb-shadow-sm)]"
        >
          <CheckCircle size={22} /> Remembered
        </button>
      </div>

    </div>
  );
}
