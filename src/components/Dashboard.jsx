import { useState } from 'react';
import {
  BookOpen, CheckCircle, HelpCircle, TrendingUp, Star,
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
    <div className={`relative overflow-hidden rounded-2xl p-6 ${gradient} shadow-lg`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-white/70 text-sm font-medium mb-1">{label}</p>
          <p className="text-white text-3xl font-bold">
            {value}<span className="text-lg font-medium opacity-80">{suffix}</span>
          </p>
        </div>
        <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
          <Icon size={22} className="text-white" />
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
      className="w-full text-left group p-4 rounded-xl bg-slate-800/50 hover:bg-slate-700/50 transition-all duration-200 border border-slate-700/50 hover:border-slate-600"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
          <span className="text-white font-medium text-sm">{label}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-slate-400 text-xs">{count} words</span>
          <span className="text-white font-bold text-sm">{pct}%</span>
        </div>
      </div>
      <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full progress-fill ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-slate-500 text-xs mt-2 group-hover:text-slate-400 transition-colors">
        Click to filter vocabulary →
      </p>
    </button>
  );
}

export default function Dashboard({ words, stats, setActiveTab, setVocabFilter }) {
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
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
        <p className="text-slate-400">Track your vocabulary learning progress</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={BookOpen}
          label="Total Words"
          value={totalWords}
          gradient="bg-gradient-to-br from-indigo-600 to-purple-700"
        />
        <StatCard
          icon={Star}
          label="Mastered (L5)"
          value={masteredCount}
          gradient="bg-gradient-to-br from-emerald-600 to-teal-700"
        />
        <StatCard
          icon={CheckCircle}
          label="Quiz Accuracy"
          value={accuracy}
          suffix="%"
          gradient="bg-gradient-to-br from-sky-600 to-blue-700"
        />
        <StatCard
          icon={HelpCircle}
          label="Questions Answered"
          value={stats.totalQuestions}
          gradient="bg-gradient-to-br from-amber-600 to-orange-700"
        />
      </div>

      {/* Mastery Levels */}
      <div className="bg-slate-800/30 rounded-2xl p-6 border border-slate-700/50">
        <div className="flex items-center gap-2 mb-5">
          <TrendingUp size={20} className="text-indigo-400" />
          <h2 className="text-white font-semibold text-lg">Mastery Levels</h2>
        </div>

        {totalWords === 0 ? (
          <div className="text-center py-10">
            <BookOpen size={48} className="text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 font-medium">No words yet</p>
            <p className="text-slate-500 text-sm mt-1">Add words in the Vocabulary tab to get started</p>
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
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4">
            <p className="text-indigo-300 text-sm font-medium">💡 Spaced Repetition</p>
            <p className="text-slate-400 text-xs mt-1">
              Answer correctly 2×, 4×, 8×, 15× in a row to advance through L1→L2→L3→L4→L5.
            </p>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
            <p className="text-emerald-300 text-sm font-medium">🎯 Current focus</p>
            <p className="text-slate-400 text-xs mt-1">
              You have <strong className="text-white">{level1Count}</strong> new / struggling words to review.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
