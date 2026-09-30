import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Headphones, RotateCcw, Eye, EyeOff, Volume2,
  ChevronRight, Trophy, AlertCircle, CheckCircle2, XCircle,
} from 'lucide-react';
import { playAudio } from '../utils/audio';

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
];

/** Level badge background colours for the image card overlay */
const LEVEL_BG = {
  1: 'bg-rose-500/80',
  2: 'bg-orange-500/80',
  3: 'bg-amber-500/80',
  4: 'bg-teal-500/80',
  5: 'bg-emerald-500/80',
};

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

/** Fisher-Yates in-place shuffle, returns new array */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Pick the most "due" word from the pool.
 * Priority: lowest level first, then lowest streak first.
 * Excludes previousId to prevent back-to-back repetition.
 */
function pickDueWord(pool, previousId) {
  // Exclude the word that was just shown
  const candidates = previousId
    ? pool.filter(w => w.id !== previousId)
    : pool;

  if (candidates.length === 0) return pool[0] ?? null; // fallback: only 1 word in pool

  return [...candidates].sort((a, b) => {
    if (a.level !== b.level) return a.level - b.level;
    return (a.currentStreak ?? 0) - (b.currentStreak ?? 0);
  })[0];
}

/**
 * Build one round from the filtered pool.
 * Returns { correct, cards } or null if pool is too small.
 */
function buildRound(pool, previousId) {
  if (pool.length < 4) return null;

  const correct = pickDueWord(pool, previousId);
  const others  = shuffle(pool.filter(w => w.id !== correct.id)).slice(0, 3);
  const cards   = shuffle([correct, ...others]);

  return { correct, cards };
}

/** Resolve image URL for a word */
function getImageUrl(word) {
  if (word.imageUrl && word.imageUrl.trim()) return word.imageUrl.trim();
  return `https://source.unsplash.com/featured/400x300/?${encodeURIComponent(word.english)}`;
}

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
              flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium
              transition-all duration-200
              ${isActive
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white border border-slate-700'
              }
            `}
          >
            {opt.icon && <span className="text-xs">{opt.icon}</span>}
            <span>{opt.label}</span>
            <span className="ml-0.5 text-xs opacity-60">({count})</span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ImageCard                                                            */
/* ------------------------------------------------------------------ */
function ImageCard({ word, state, onClick, showMeaning, onToggleMeaning, index }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError,  setImgError]  = useState(false);

  const borderClass =
    state === 'correct'  ? 'border-emerald-400 shadow-emerald-500/40 shadow-xl' :
    state === 'wrong'    ? 'border-rose-400    shadow-rose-500/40    shadow-xl'  :
    state === 'idle'     ? 'border-slate-700/60 hover:border-indigo-400/70 hover:shadow-indigo-500/20 hover:shadow-lg' :
    /* disabled */         'border-slate-700/40 opacity-50';

  const ringOverlay =
    state === 'correct' ? 'ring-4 ring-emerald-400/40' :
    state === 'wrong'   ? 'ring-4 ring-rose-400/40'    : '';

  return (
    <div
      className={`
        relative rounded-2xl overflow-hidden border-2 transition-all duration-300
        ${borderClass} ${ringOverlay}
        ${state === 'idle' ? 'cursor-pointer active:scale-95' : 'cursor-default'}
      `}
      onClick={() => state === 'idle' && onClick(word)}
      id={`listening-card-${index}`}
      role="button"
      tabIndex={state === 'idle' ? 0 : -1}
      onKeyDown={e => e.key === 'Enter' && state === 'idle' && onClick(word)}
      aria-label={`Choose ${word.english}`}
    >
      {/* Image area */}
      <div className="relative w-full aspect-[4/3] bg-slate-800">
        {!imgError ? (
          <img
            src={getImageUrl(word)}
            alt={word.english}
            className={`w-full h-full object-cover transition-opacity duration-500 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setImgLoaded(true)}
            onError={() => { setImgError(true); setImgLoaded(true); }}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-800/80 text-slate-500">
            <span className="text-4xl mb-2">📷</span>
            <span className="text-xs text-center px-2">{word.english}</span>
          </div>
        )}

        {/* Skeleton shimmer */}
        {!imgLoaded && !imgError && (
          <div className="absolute inset-0 bg-slate-700 animate-pulse" />
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/10 to-transparent" />

        {/* Level badge */}
        <span className={`
          absolute top-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white
          ${LEVEL_BG[word.level] ?? 'bg-slate-600/80'}
        `}>
          L{word.level}
        </span>

        {/* Result overlay icon */}
        {state === 'correct' && (
          <div className="absolute inset-0 flex items-center justify-center bg-emerald-500/20">
            <CheckCircle2 size={56} className="text-emerald-400 drop-shadow-lg" />
          </div>
        )}
        {state === 'wrong' && (
          <div className="absolute inset-0 flex items-center justify-center bg-rose-500/20">
            <XCircle size={56} className="text-rose-400 drop-shadow-lg" />
          </div>
        )}
      </div>

      {/* Bottom bar: meaning toggle */}
      <div className="bg-slate-900/95 px-3 py-2 flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          {showMeaning ? (
            <p className="text-indigo-300 text-xs font-medium truncate animate-fade-in">
              {word.vietnamese}
            </p>
          ) : (
            <p className="text-slate-600 text-xs select-none">• • • • •</p>
          )}
        </div>
        <button
          id={`toggle-meaning-${index}`}
          className="shrink-0 p-1 rounded-lg text-slate-500 hover:text-indigo-400 transition-colors"
          onClick={e => { e.stopPropagation(); onToggleMeaning(); }}
          aria-label={showMeaning ? 'Hide meaning' : 'Show Vietnamese meaning'}
          title={showMeaning ? 'Hide meaning' : 'Show Vietnamese meaning'}
        >
          {showMeaning ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Session stats bar                                                     */
/* ------------------------------------------------------------------ */
function StatsBar({ score, total }) {
  const pct = total === 0 ? 0 : Math.round((score / total) * 100);
  return (
    <div className="flex items-center gap-4 text-sm">
      <div className="flex items-center gap-1.5">
        <CheckCircle2 size={14} className="text-emerald-400" />
        <span className="text-white font-semibold">{score}</span>
        <span className="text-slate-500">correct</span>
      </div>
      <div className="h-4 w-px bg-slate-700" />
      <div className="flex items-center gap-1.5">
        <Trophy size={14} className="text-indigo-400" />
        <span className="text-indigo-400 font-semibold">{pct}%</span>
      </div>
      <div className="h-4 w-px bg-slate-700" />
      <span className="text-slate-500">{total} played</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main Component                                                       */
/* ------------------------------------------------------------------ */
export default function ListeningReview({ words, updateWordLevel }) {

  /* ── Filter state ── */
  const [levelFilter, setLevelFilter] = useState(null);    // null = All Levels
  const [typeFilter,  setTypeFilter]  = useState('All');   // 'All' | 'Word' | 'Phrase' | 'Family'

  /* ── Game state ── */
  const [round,         setRound]         = useState(null);
  const [previousId,    setPreviousId]    = useState(null); // tracks last correct word to avoid repetition
  const [answered,      setAnswered]      = useState(false);
  const [selectedWord,  setSelectedWord]  = useState(null);
  const [showMeanings,  setShowMeanings]  = useState([false, false, false, false]);
  const [score,         setScore]         = useState(0);
  const [totalPlayed,   setTotalPlayed]   = useState(0);
  const [isPlaying,     setIsPlaying]     = useState(false);

  const audioRef = useRef(null);

  /* ── Derived: filtered vocabulary pool ── */
  const filteredPool = (() => {
    let pool = levelFilter !== null
      ? words.filter(w => w.level === levelFilter)
      : words;
    if (typeFilter !== 'All') {
      pool = pool.filter(w => (w.wordType || 'Word') === typeFilter);
    }
    return pool;
  })();

  const hasEnoughWords = filteredPool.length >= 4;

  /* ── Build a new round from the current filteredPool ── */
  const startNewRound = useCallback((pool, prevId) => {
    if (pool.length < 4) return;
    const r = buildRound(pool, prevId);
    if (!r) return;

    setRound(r);
    setAnswered(false);
    setSelectedWord(null);
    setShowMeanings([false, false, false, false]);
  }, []);

  /* ── Start first round when component mounts or filter changes ── */
  // Reset game state and build a fresh round whenever the pool changes.
  useEffect(() => {
    if (hasEnoughWords) {
      // Reset previousId when the pool changes so we don't carry over stale IDs
      setPreviousId(null);
      startNewRound(filteredPool, null);
    } else {
      setRound(null);
    }
    // We deliberately only react to pool identity (length + filters), not every words update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelFilter, typeFilter, hasEnoughWords]);

  /* ── Auto-play audio when a new round's correct word changes ── */
  useEffect(() => {
    if (!round || answered) return;
    const timer = setTimeout(() => triggerAudio(round.correct.english), 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round?.correct?.id]);

  /* ── Audio trigger ── */
  function triggerAudio(word) {
    // Cancel whatever is playing (handle works for both Web Speech & Audio element)
    if (audioRef.current) {
      try { audioRef.current.cancel(); } catch { /* ignore */ }
    }
    setIsPlaying(true);
    audioRef.current = playAudio(word);
    setTimeout(() => setIsPlaying(false), 2000);
  }

  /* ── Handle card click ── */
  function handleCardClick(word) {
    if (answered || !round) return;

    const isCorrect = word.id === round.correct.id;
    setSelectedWord(word);
    setAnswered(true);
    setTotalPlayed(t => t + 1);
    if (isCorrect) setScore(s => s + 1);

    // SRS update — same API as Quiz.jsx
    updateWordLevel(round.correct.english, isCorrect);

    // Store this round's correct word id; used by next buildRound to avoid repetition
    const justPlayedId = round.correct.id;
    setPreviousId(justPlayedId);

    // Auto-advance after 1.5 s
    setTimeout(() => startNewRound(filteredPool, justPlayedId), 1500);
  }

  /* ── Skip / Next handler ── */
  function handleNext() {
    const justPlayedId = round?.correct?.id ?? null;
    setPreviousId(justPlayedId);
    startNewRound(filteredPool, justPlayedId);
  }

  /* ── Card state classifier ── */
  function cardState(word) {
    if (!answered) return 'idle';
    if (word.id === round.correct.id) return 'correct';
    if (selectedWord?.id === word.id) return 'wrong';
    return 'disabled';
  }

  /* ── Toggle one meaning hint ── */
  function toggleMeaning(idx) {
    setShowMeanings(prev => prev.map((v, i) => (i === idx ? !v : v)));
  }

  /* ── Count helpers for pills ── */
  function levelCount(val) {
    const base = val !== null ? words.filter(w => w.level === val) : words;
    return typeFilter === 'All'
      ? base.length
      : base.filter(w => (w.wordType || 'Word') === typeFilter).length;
  }

  function typeCount(val) {
    const base = levelFilter !== null
      ? words.filter(w => w.level === levelFilter)
      : words;
    return val === 'All'
      ? base.length
      : base.filter(w => (w.wordType || 'Word') === val).length;
  }

  /* ── Derived answer state ── */
  const isCorrectAnswer = answered && selectedWord?.id === round?.correct?.id;

  /* ---------------------------------------------------------------- */
  /* Render                                                             */
  /* ---------------------------------------------------------------- */
  return (
    <div className="animate-fade-in max-w-2xl mx-auto">

      {/* ── Page header ── */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-1 flex items-center gap-3">
          <Headphones size={28} className="text-indigo-400" />
          Listening Review
        </h1>
        <p className="text-slate-400 text-sm">
          Listen to the word and tap the matching image.
        </p>
      </div>

      {/* ── Stats bar ── */}
      <div className="mb-5">
        <StatsBar score={score} total={totalPlayed} />
      </div>

      {/* ── Filter panel ── */}
      <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4 mb-6 space-y-3">
        {/* Level filter */}
        <div>
          <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
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
          <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
            Type
          </p>
          {/* Segmented tab style matching Vocabulary.jsx */}
          <div className="flex items-center gap-1 bg-slate-800/60 border border-slate-700/40 rounded-xl p-1 w-fit">
            {TYPE_FILTER_OPTIONS.map(opt => (
              <button
                key={opt.value}
                id={`lr-type-${opt.value.toLowerCase()}`}
                onClick={() => setTypeFilter(opt.value)}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                  transition-all duration-200
                  ${typeFilter === opt.value
                    ? 'bg-slate-700 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                  }
                `}
              >
                <span>{opt.icon}</span>
                <span className="hidden sm:inline">{opt.label.split('(')[0].trim()}</span>
                <span className="text-xs opacity-60">({typeCount(opt.value)})</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Not enough words for current filters ── */}
      {!hasEnoughWords ? (
        <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5">
          <AlertCircle size={20} className="text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-300 font-semibold mb-1">Not enough words match these filters</p>
            <p className="text-amber-400/70 text-sm">
              Please select a category with at least <strong>4 words</strong> to play.
              Currently <strong>{filteredPool.length}</strong> word{filteredPool.length !== 1 ? 's' : ''} match.
            </p>
          </div>
        </div>
      ) : !round ? (
        /* ── Loading spinner ── */
        <div className="flex items-center justify-center py-20 text-slate-500">
          <div className="animate-spin mr-3 w-5 h-5 border-2 border-slate-600 border-t-indigo-500 rounded-full" />
          Loading…
        </div>
      ) : (
        <>
          {/* ── Audio control card ── */}
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5 mb-5 flex flex-col sm:flex-row items-center gap-4">

            {/* Animated speaker */}
            <div className={`
              relative w-16 h-16 rounded-2xl flex items-center justify-center shrink-0
              bg-gradient-to-br from-indigo-600 to-purple-700 shadow-lg shadow-indigo-500/30
              transition-transform duration-150
              ${isPlaying ? 'scale-110 shadow-indigo-500/60' : ''}
            `}>
              <Volume2
                size={28}
                className={`text-white transition-all duration-300 ${isPlaying ? 'opacity-100' : 'opacity-70'}`}
              />
              {isPlaying && (
                <span className="absolute w-16 h-16 rounded-2xl border-2 border-indigo-400/40 animate-ping" />
              )}
            </div>

            <div className="flex-1 text-center sm:text-left">
              <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold mb-1">
                Which image matches…
              </p>
              <p className="text-white text-lg font-bold">
                {isPlaying
                  ? <span className="text-indigo-400 animate-pulse">♫ Playing audio…</span>
                  : <span className="text-slate-400 italic text-base">Tap Replay to hear again</span>
                }
              </p>
            </div>

            {/* Replay button */}
            <button
              id="replay-audio-btn"
              onClick={() => triggerAudio(round.correct.english)}
              className="
                flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm
                bg-indigo-600 hover:bg-indigo-500 active:scale-95
                text-white transition-all duration-200 shadow-md shadow-indigo-500/30 shrink-0
              "
            >
              <Volume2 size={16} />
              Replay
            </button>
          </div>

          {/* ── Feedback banner ── */}
          {answered && (
            <div className={`
              animate-fade-in mb-5 flex items-center gap-3 px-5 py-3.5 rounded-2xl
              font-semibold text-sm
              ${isCorrectAnswer
                ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-300'
                : 'bg-rose-500/15    border border-rose-500/40    text-rose-300'
              }
            `}>
              {isCorrectAnswer
                ? <><CheckCircle2 size={18} className="shrink-0" /> Excellent! +1 streak for <span className="underline underline-offset-2 ml-1">{round.correct.english}</span></>
                : <><XCircle size={18} className="shrink-0" /> Wrong — streak reset. The answer was <span className="font-bold ml-1">{round.correct.english}</span></>
              }
            </div>
          )}

          {/* ── 2×2 Image Grid ── */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6">
            {round.cards.map((word, idx) => (
              <ImageCard
                key={word.id}
                word={word}
                state={cardState(word)}
                onClick={handleCardClick}
                showMeaning={showMeanings[idx]}
                onToggleMeaning={() => toggleMeaning(idx)}
                index={idx}
              />
            ))}
          </div>

          {/* ── Action bar ── */}
          <div className="flex items-center justify-between gap-3">
            <button
              id="listening-next-btn"
              onClick={handleNext}
              className="
                flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold
                bg-slate-700 hover:bg-slate-600 active:scale-95
                text-white transition-all duration-200
              "
            >
              {answered
                ? <><ChevronRight size={16} /> Next Word</>
                : <><RotateCcw   size={16} /> Skip</>
              }
            </button>

            {/* Target level hint */}
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>Target:</span>
              <span className={`px-2 py-0.5 rounded-full font-bold text-white text-[11px] ${LEVEL_BG[round.correct.level] ?? 'bg-slate-600'}`}>
                L{round.correct.level}
              </span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-500">{filteredPool.length} in pool</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
