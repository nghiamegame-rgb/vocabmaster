import { useState } from 'react';
import { Zap, Bookmark, Brain, BarChart2, Cloud } from 'lucide-react';
import { useGrammarStore } from '../hooks/useGrammarStore';
import GrammarPractice     from './grammar/GrammarPractice';
import GrammarQuiz         from './grammar/GrammarQuiz';
import GrammarSaved        from './grammar/GrammarSaved';
import GrammarReview       from './grammar/GrammarReview';
import GrammarStats        from './grammar/GrammarStats';
import GrammarCloudSettings from './grammar/GrammarCloudSettings';

const SUB_TABS = [
  { id: 'practice',  label: 'Practice',         Icon: Zap       },
  { id: 'saved',     label: 'Saved Questions',   Icon: Bookmark  },
  { id: 'review',    label: 'Review',            Icon: Brain     },
  { id: 'stats',     label: 'Statistics',        Icon: BarChart2 },
];

/**
 * Grammar — Top-level Grammar module component.
 * Manages sub-tab routing and bridges the grammar store with child components.
 * @param {{ addWord: Function }} props — addWord from the Vocabulary store for word integration.
 */
export default function Grammar({ addWord }) {
  const [subTab,      setSubTab]      = useState('practice');
  const [session,     setSession]     = useState(null); // { questions, config } when quiz is active
  const [showCloud,   setShowCloud]   = useState(false);

  const {
    savedQuestions,
    reviewProgress,
    grammarStats,
    syncStatus,
    cloudConfigured,
    setCloudConfigured,
    dueForReview,
    wrongQuestions,
    saveQuestion,
    unsaveQuestion,
    isQuestionSaved,
    toggleHardMark,
    updateNotes,
    recordReview,
    recordGrammarSession,
    syncFromCloud,
  } = useGrammarStore();

  // ── Session lifecycle ─────────────────────────────────────────────────────
  function handleStartSession(sess) {
    setSession(sess);
  }

  function handleFinishSession(result) {
    recordGrammarSession(result);
    if (result.goBack) {
      setSession(null);
    }
    // Stay in quiz view showing the results screen (GrammarQuiz handles it internally)
    // Only go back to practice if user explicitly clicks "Create new set"
  }

  // ── Add word to Vocabulary ────────────────────────────────────────────────
  function handleAddToVocab(wordObj) {
    if (!addWord) return false;
    return addWord(wordObj);
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Module header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 via-indigo-600 to-blue-600 flex items-center justify-center shadow-xl shadow-purple-500/25">
            <span className="text-white font-black text-lg">G</span>
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">
              Grammar <span className="text-purple-400">TOEIC</span>
            </h1>
            <p className="text-slate-400 text-sm">Part 5 · Sentence Completion · AI-powered</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Local-only badge */}
          {!cloudConfigured && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Local Only
            </div>
          )}
          {/* Cloud settings button */}
          <button
            onClick={() => setShowCloud(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 border ${
              showCloud
                ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/30'
                : 'bg-slate-800 text-slate-400 hover:text-white border-slate-700'
            }`}
          >
            <Cloud size={13} />
            Cloud
          </button>
        </div>
      </div>

      {/* Cloud settings panel */}
      {showCloud && (
        <GrammarCloudSettings
          onClose={() => setShowCloud(false)}
          onConfigChanged={setCloudConfigured}
          syncStatus={syncStatus}
          onSync={syncFromCloud}
        />
      )}

      {/* Sub-tabs */}
      <div className="flex gap-1 p-1 bg-slate-900/60 border border-slate-700/50 rounded-2xl">
        {SUB_TABS.map(({ id, label, Icon }) => {
          const badge = id === 'review' ? dueForReview.length : 0;
          return (
            <button
              key={id}
              id={`grammar-tab-${id}`}
              onClick={() => { setSubTab(id); setSession(null); }}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 relative ${
                subTab === id
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Icon size={15} />
              <span className="hidden sm:block">{label}</span>
              {badge > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div>
        {/* Practice tab */}
        {subTab === 'practice' && (
          session
            ? <GrammarQuiz
                questions={session.questions}
                config={session.config}
                isQuestionSaved={isQuestionSaved}
                onSave={saveQuestion}
                onUnsave={unsaveQuestion}
                savedQuestions={savedQuestions}
                onFinish={(result) => {
                  handleFinishSession(result);
                  if (result.goBack) setSession(null);
                }}
                onAddToVocab={handleAddToVocab}
              />
            : <GrammarPractice onStartSession={handleStartSession} />
        )}

        {/* Saved tab */}
        {subTab === 'saved' && (
          <GrammarSaved
            savedQuestions={savedQuestions}
            reviewProgress={reviewProgress}
            cloudConfigured={cloudConfigured}
            onUnsave={unsaveQuestion}
            onToggleHard={toggleHardMark}
            onUpdateNotes={updateNotes}
          />
        )}

        {/* Review tab */}
        {subTab === 'review' && (
          <GrammarReview
            savedQuestions={savedQuestions}
            reviewProgress={reviewProgress}
            onRecordReview={recordReview}
          />
        )}

        {/* Stats tab */}
        {subTab === 'stats' && (
          <GrammarStats
            grammarStats={grammarStats}
            savedQuestions={savedQuestions}
            dueForReview={dueForReview}
            wrongQuestions={wrongQuestions}
          />
        )}
      </div>
    </div>
  );
}
