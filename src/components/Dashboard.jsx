import { useState } from 'react';
import {
  BookOpen, CheckCircle, HelpCircle, TrendingUp, Star, Volume2,
} from 'lucide-react';

const LEVEL_META = [
  { level: 1, label: 'L1 — New',        color: 'bg-rose-500',     dot: 'bg-rose-400'     },
  { level: 2, label: 'L2 — Familiar',   color: 'bg-orange-500',   dot: 'bg-orange-400'   },
  { level: 3, label: 'L3 — Learning',   color: 'bg-amber-500',    dot: 'bg-amber-400'    },
  { level: 4, label: 'L4 — Proficient', color: 'bg-teal-500',     dot: 'bg-teal-400'     },
  { level: 5, label: 'L5 — Mastered',   color: 'bg-emerald-500',  dot: 'bg-emerald-400'  },
];

function StatCard({ icon: Icon, label, value, gradient, suffix = '' }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl p-5 sm:p-6 ${gradient} border border-white/15 shadow-[0_12px_28px_-10px_rgba(2,6,23,0.75)] vm-card-interactive transition-all duration-200`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-white/80 text-xs sm:text-sm font-medium mb-1.5">{label}</p>
          <p className="text-white text-3xl font-extrabold tracking-tight">
            {value}<span className="text-lg font-medium opacity-85">{suffix}</span>
          </p>
        </div>
        <div className="w-11 h-11 rounded-xl bg-white/15 ring-1 ring-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
          <Icon size={21} className="text-white" />
        </div>
      </div>
    </div>
  );
}

function MasteryBar({ level, label, count, total, color, onClick }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <button
      id={`mastery-level-${level}`}
      onClick={onClick}
      className="w-full text-left group p-4 rounded-xl vm-card vm-card-interactive"
    >
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2.5">
          <div className={`w-2.5 h-2.5 rounded-full ring-4 ring-white/5 ${color}`} />
          <span className="text-slate-100 font-semibold text-sm">{label}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-slate-300 text-xs">{count} words</span>
          <span className="text-white font-bold text-sm tabular-nums">{pct}%</span>
        </div>
      </div>
      <div className="w-full h-2.5 bg-slate-900/90 rounded-full overflow-hidden ring-1 ring-white/5">
        <div
          className={`h-full rounded-full progress-fill ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-slate-400 text-xs mt-2 group-hover:text-indigo-300 transition-colors">
        Click to filter vocabulary →
      </p>
    </button>
  );
}

export default function Dashboard({ words, hasReadableWords = true, stats, setActiveTab, setVocabFilter }) {
  const totalWords = words.length;
  const accuracy   = stats.totalQuestions > 0
    ? Math.round((stats.correctAnswers / stats.totalQuestions) * 100)
    : 0;

  const masteredCount = words.filter(w => w.level === 5).length;
  const level1Count   = words.filter(w => w.level === 1).length;

  function handleMasteryClick(level) {
    setVocabFilter(level);
    setActiveTab('vocabulary');
  }

  return (
    <div className="vm-page-enter">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-white mb-1.5">Dashboard</h1>
        <p className="text-slate-300 text-sm sm:text-base">Track your vocabulary learning progress</p>
        <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-indigo-400/25 bg-indigo-500/10 backdrop-blur-sm px-4 py-3 text-sm text-indigo-100 shadow-sm sm:items-center">
          <Volume2 size={16} className="mt-0.5 shrink-0 text-indigo-300 sm:mt-0" aria-hidden="true" />
          <p>🔊 Mẹo học tập: Hãy đọc thành tiếng mỗi từ vựng, sau đó nghe phát âm chuẩn để ghi nhớ tốt hơn và cải thiện kỹ năng Nghe VSTEP!</p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={BookOpen}
          label="Total Words"
          value={hasReadableWords ? totalWords : '—'}
          gradient="bg-gradient-to-br from-indigo-600/95 via-indigo-700/90 to-violet-800/95"
        />
        <StatCard
          icon={Star}
          label="Mastered (L5)"
          value={hasReadableWords ? masteredCount : '—'}
          gradient="bg-gradient-to-br from-emerald-600/95 via-emerald-700/90 to-teal-800/95"
        />
        <StatCard
          icon={CheckCircle}
          label="Quiz Accuracy"
          value={accuracy}
          suffix="%"
          gradient="bg-gradient-to-br from-sky-600/95 via-blue-700/90 to-indigo-800/95"
        />
        <StatCard
          icon={HelpCircle}
          label="Questions Answered"
          value={stats.totalQuestions}
          gradient="bg-gradient-to-br from-amber-600/95 via-orange-700/90 to-rose-800/90"
        />
      </div>

      {/* Mastery Levels */}
      <div className="vm-panel rounded-2xl p-5 sm:p-6">
        <div className="flex items-center gap-2.5 mb-5">
          <TrendingUp size={20} className="text-indigo-400" />
          <h2 className="text-white font-bold tracking-tight text-lg">Mastery Levels</h2>
        </div>

        {totalWords === 0 ? (
          <div className="text-center py-10">
            <BookOpen size={48} className="text-slate-500 mx-auto mb-3" />
            <p className="text-slate-300 font-medium">No words yet</p>
            <p className="text-slate-400 text-sm mt-1">Add words in the Vocabulary tab to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {LEVEL_META.map(({ level, label, color }) => (
              <MasteryBar
                key={level}
                level={level}
                label={label}
                count={words.filter(w => w.level === level).length}
                total={totalWords}
                color={color}
                onClick={() => handleMasteryClick(level)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Quick Tips */}
      {totalWords > 0 && (
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="vm-panel border-indigo-400/25 rounded-2xl p-4 sm:p-5">
            <p className="text-indigo-300 text-sm font-semibold">💡 Spaced Repetition</p>
            <p className="text-slate-300 text-xs mt-1.5 leading-relaxed">
              Answer correctly 2×, 4×, 8×, 15× in a row to advance through L1→L2→L3→L4→L5.
            </p>
          </div>
          <div className="vm-panel border-emerald-400/25 rounded-2xl p-4 sm:p-5">
            <p className="text-emerald-300 text-sm font-semibold">🎯 Current focus</p>
            <p className="text-slate-300 text-xs mt-1.5 leading-relaxed">
              You have <strong className="text-white">{level1Count}</strong> new / struggling words to review.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
