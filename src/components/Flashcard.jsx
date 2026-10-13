import { useState, useEffect, useMemo } from 'react';
import { Volume2, CheckCircle, XCircle, RefreshCw, Filter } from 'lucide-react';
import { playAudio } from '../utils/audio';

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
];

export default function Flashcard({ words, updateWordLevel }) {
  const [mode,         setMode]         = useState('eng-vie'); // 'eng-vie' | 'vie-eng'
  const [levelFilter,  setLevelFilter]  = useState(null);      // null = all
  const [typeFilter,   setTypeFilter]   = useState('All');
  const [queue,        setQueue]        = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped,    setIsFlipped]    = useState(false);
  const [finished,     setFinished]     = useState(false);

  // ── Filtered word pool ───────────────────────────────────────────────────
  const filteredWords = useMemo(() => {
    let result = words;
    if (levelFilter !== null) result = result.filter(w => w.level === levelFilter);
    if (typeFilter  !== 'All') result = result.filter(w => (w.wordType || 'Word') === typeFilter);
    return result;
  }, [words, levelFilter, typeFilter]);

  // ── Rebuild queue whenever filters or mode change ──────────────────────
  useEffect(() => {
    const shuffled = [...filteredWords].sort(() => Math.random() - 0.5).slice(0, 50);
    setQueue(shuffled);
    setCurrentIndex(0);
    setIsFlipped(false);
    setFinished(false);
  }, [filteredWords, mode]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  function handleLevelFilter(val) {
    setLevelFilter(val);
    setFinished(false);
  }

  function handleTypeFilter(val) {
    setTypeFilter(val);
    setFinished(false);
  }

  function restartQueue() {
    const shuffled = [...filteredWords].sort(() => Math.random() - 0.5).slice(0, 50);
    setQueue(shuffled);
    setCurrentIndex(0);
    setIsFlipped(false);
    setFinished(false);
  }

  const handleNext = (remembered) => {
    if (updateWordLevel && queue[currentIndex]) {
      updateWordLevel(queue[currentIndex].english, remembered);
    }
    setIsFlipped(false);
    setTimeout(() => {
      if (currentIndex < queue.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        setFinished(true);
      }
    }, 200);
  };

  const playPronunciation = (e) => {
    e.stopPropagation();
    if (queue[currentIndex]) playAudio(queue[currentIndex].english);
  };

  // ── Filter bar (always rendered) ─────────────────────────────────────────
  const filterBar = (
    <div className="w-full space-y-3 mb-6">
      {/* Level filter pills */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={13} className="text-slate-500 shrink-0" />
        {LEVEL_OPTS.map(opt => {
          const count = opt.value === null
            ? words.length
            : words.filter(w => w.level === opt.value).length;
          return (
            <button
              key={String(opt.value)}
              onClick={() => handleLevelFilter(opt.value)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
                levelFilter === opt.value
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white border border-slate-700'
              }`}
            >
              {opt.label}
              <span className="ml-1 opacity-60">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Type filter tab bar */}
      <div className="flex items-center gap-1 bg-slate-800/40 border border-slate-700/40 rounded-xl p-1 w-fit">
        {TYPE_OPTS.map(opt => {
          const pool = levelFilter === null ? words : words.filter(w => w.level === levelFilter);
          const count = opt.value === 'All'
            ? pool.length
            : pool.filter(w => (w.wordType || 'Word') === opt.value).length;
          return (
            <button
              key={opt.value}
              onClick={() => handleTypeFilter(opt.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                typeFilter === opt.value
                  ? 'bg-slate-700 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>{opt.icon}</span>
              <span>{opt.label}</span>
              <span className="opacity-60">({count})</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  // ── Empty state ───────────────────────────────────────────────────────────
  if (words.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-slate-400 mb-4">No vocabulary words available. Add some in the Vocabulary tab.</p>
      </div>
    );
  }

  if (filteredWords.length === 0) {
    return (
      <div className="max-w-2xl mx-auto animate-fade-in flex flex-col items-center">
        <div className="w-full mb-6">
          <h1 className="text-3xl font-bold text-white mb-1">Flashcard Mode</h1>
          <p className="text-slate-400 text-sm">Filter by mastery level and vocabulary type.</p>
        </div>
        {filterBar}
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
            <Filter size={28} className="text-slate-600" />
          </div>
          <h3 className="text-slate-400 font-medium mb-2">Không có từ nào khớp bộ lọc này</h3>
          <p className="text-slate-600 text-sm">Thử bộ lọc khác hoặc thêm từ mới trong tab Vocabulary.</p>
        </div>
      </div>
    );
  }

  // ── Finished screen ───────────────────────────────────────────────────────
  if (finished || queue.length === 0) {
    return (
      <div className="max-w-2xl mx-auto animate-fade-in flex flex-col items-center">
        <div className="w-full mb-6">
          <h1 className="text-3xl font-bold text-white mb-1">Flashcard Mode</h1>
          <p className="text-slate-400 text-sm">Filter by mastery level and vocabulary type.</p>
        </div>
        {filterBar}
        <div className="flex flex-col items-center space-y-6 py-10 animate-fade-in">
          <div className="w-24 h-24 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <CheckCircle size={48} className="text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-white">Session Complete!</h2>
          <p className="text-slate-400 text-sm">{filteredWords.length} card{filteredWords.length !== 1 ? 's' : ''} in current filter</p>
          <button
            onClick={restartQueue}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold flex items-center gap-2 transition-colors shadow-lg shadow-indigo-500/20"
          >
            <RefreshCw size={20} /> Review Again
          </button>
        </div>
      </div>
    );
  }

  const currentWord = queue[currentIndex];

  // ── Card content ──────────────────────────────────────────────────────────
  const frontContent = mode === 'eng-vie' ? (
    <div className="flex flex-col items-center justify-center h-full p-8">
      <h2 className="text-4xl md:text-5xl font-bold text-white mb-8 text-center">{currentWord.english}</h2>
      <button
        onClick={playPronunciation}
        className="p-4 rounded-full bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white transition-colors border border-indigo-500/30 shadow-lg"
      >
        <Volume2 size={32} />
      </button>
    </div>
  ) : (
    <div className="flex flex-col items-center justify-center h-full p-8">
      <h2 className="text-3xl md:text-4xl font-bold text-white mb-8 text-center">{currentWord.vietnamese}</h2>
      <button
        onClick={playPronunciation}
        className="p-4 rounded-full bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white transition-colors border border-indigo-500/30 shadow-lg"
      >
        <Volume2 size={32} />
      </button>
    </div>
  );

  const backContent = mode === 'eng-vie' ? (
    <div className="flex flex-col items-center justify-center h-full p-6">
      {currentWord.imageUrl && (
        <img
          src={currentWord.imageUrl}
          alt={currentWord.english}
          className="w-full max-h-56 object-cover rounded-xl mb-6 shadow-lg border border-slate-700"
        />
      )}
      <h2 className="text-3xl md:text-4xl font-bold text-emerald-400 text-center mb-3">{currentWord.vietnamese}</h2>
      <p className="text-slate-400 text-sm font-medium px-3 py-1 bg-slate-900/50 rounded-lg border border-slate-700">{currentWord.wordType}</p>
    </div>
  ) : (
    <div className="flex flex-col items-center justify-center h-full p-6">
      {currentWord.imageUrl && (
        <img
          src={currentWord.imageUrl}
          alt={currentWord.english}
          className="w-full max-h-56 object-cover rounded-xl mb-6 shadow-lg border border-slate-700"
        />
      )}
      <h2 className="text-4xl md:text-5xl font-bold text-indigo-400 text-center mb-3">{currentWord.english}</h2>
      <p className="text-slate-400 text-sm font-medium px-3 py-1 bg-slate-900/50 rounded-lg border border-slate-700">{currentWord.wordType}</p>
    </div>
  );

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto animate-fade-in flex flex-col items-center">

      <div className="w-full mb-4">
        <h1 className="text-3xl font-bold text-white mb-1">Flashcard Mode</h1>
        <p className="text-slate-400 text-sm">
          Click the card to flip it. Review your vocabulary with active recall.
        </p>
      </div>

      {/* Filters */}
      {filterBar}

      {/* Header controls — card counter + mode toggle */}
      <div className="w-full flex justify-between items-center mb-6 bg-slate-800/40 p-3 rounded-2xl border border-slate-700/50">
        <div className="text-slate-400 font-medium px-3">
          Card <span className="text-white font-bold">{currentIndex + 1}</span> of {queue.length}
          {filteredWords.length > queue.length && (
            <span className="text-slate-600 text-xs ml-2">({filteredWords.length} total)</span>
          )}
        </div>

        {/* Mode Toggle */}
        <div className="flex bg-slate-900/80 rounded-xl p-1 border border-slate-700/50">
          <button
            onClick={() => setMode('eng-vie')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              mode === 'eng-vie' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Eng → Vie
          </button>
          <button
            onClick={() => setMode('vie-eng')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              mode === 'vie-eng' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'
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
        <div className={`flashcard-inner w-full h-full relative transition-transform duration-500 preserve-3d ${isFlipped ? 'rotate-y-180' : ''}`}>

          {/* Front */}
          <div className="flashcard-front absolute w-full h-full backface-hidden rounded-3xl bg-slate-800 border border-slate-700 shadow-xl overflow-hidden hover:border-indigo-500/50 transition-colors">
            <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900 pointer-events-none" />
            <div className="relative h-full flex items-center justify-center">
              {frontContent}
              <div className="absolute bottom-6 w-full text-center text-slate-500 text-sm animate-pulse font-medium">
                Click to flip
              </div>
            </div>
          </div>

          {/* Back */}
          <div className="flashcard-back absolute w-full h-full backface-hidden rounded-3xl bg-slate-800 border border-slate-700 shadow-xl rotate-y-180 overflow-hidden hover:border-indigo-500/50 transition-colors">
            <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900 pointer-events-none" />
            <div className="relative h-full flex items-center justify-center">
              {backContent}
            </div>
          </div>

        </div>
      </div>

      {/* Navigation Controls */}
      <div className={`w-full grid grid-cols-2 gap-4 transition-opacity duration-300 ${isFlipped ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
        <button
          onClick={(e) => { e.stopPropagation(); handleNext(false); }}
          className="py-4 rounded-2xl font-bold flex items-center justify-center gap-2 bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 hover:border-rose-500/50 transition-colors shadow-lg shadow-rose-500/5"
        >
          <XCircle size={22} /> Need Review
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleNext(true); }}
          className="py-4 rounded-2xl font-bold flex items-center justify-center gap-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 hover:border-emerald-500/50 transition-colors shadow-lg shadow-emerald-500/5"
        >
          <CheckCircle size={22} /> Remembered
        </button>
      </div>

    </div>
  );
}
