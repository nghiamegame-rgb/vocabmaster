import { useMemo, useState } from 'react';
import { Zap, Bookmark, Brain, BarChart2, Cloud, Layers } from 'lucide-react';
import GrammarPractice     from './grammar/GrammarPractice';
import GrammarQuiz         from './grammar/GrammarQuiz';
import GrammarSaved        from './grammar/GrammarSaved';
import GrammarReview       from './grammar/GrammarReview';
import GrammarStats        from './grammar/GrammarStats';
import GrammarCloudSettings from './grammar/GrammarCloudSettings';
import GrammarStructures from './grammar/GrammarStructures';
import { saveReadingDraft } from '../utils/grammarReadingItems';
import { createGrammarBatch } from '../utils/grammarBatch';
import { buildGrammarCorpus } from '../utils/grammarCorpus';
import { buildGrammarExportSource } from '../utils/grammarExport';

const SUB_TABS = [
  { id: 'practice',  label: 'Luyện tập',         Icon: Zap       },
  { id: 'saved',     label: 'Câu đã lưu',   Icon: Bookmark  },
  { id: 'review',    label: 'Ôn tập',            Icon: Brain     },
  { id: 'stats',     label: 'Thống kê',        Icon: BarChart2 },
  { id: 'structures', label: 'Structures',        Icon: Layers },
];

/**
 * Grammar — Top-level Grammar module component.
 * Manages sub-tab routing and bridges the grammar store with child components.
 * @param {{ grammarStore: object, addWord: Function }} props — grammarStore is created in App.jsx
 *   (useGrammarStore); addWord comes from the Vocabulary store for word integration.
 */
export default function Grammar({ grammarStore, addWord, words = [], vocabSyncStatus = 'idle', vocabDataLoadError = '', structureStore }) {
  const [subTab,      setSubTab]      = useState('practice');
  const [session,     setSession]     = useState(null); // { questions, config } when quiz is active
  const [showCloud,   setShowCloud]   = useState(false);

  const {
    savedQuestions,
    dataLoadError,
    storageError,
    reviewProgress,
    grammarStats,
    underlines,
    sentenceNotes,
    updateSentenceNote,
    syncStatus,
    hasPending,
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
    updateUnderlines,
    syncFromCloud,
  } = grammarStore; // created in App.jsx
  // Unsaved imports remain available across subtabs, until leaving this module.
  const [practiceQuestions, setPracticeQuestions] = useState([]);
  const corpus = useMemo(() => buildGrammarCorpus(words, [...savedQuestions, ...practiceQuestions]), [words, savedQuestions, practiceQuestions]);
  const [promptBatch, setPromptBatch] = useState(() => createGrammarBatch(corpus.data));
  const [promptSettings, setPromptSettings] = useState({ count: 10, topic: 'Mixed' });
  const exportSource = useMemo(() => buildGrammarExportSource(words, savedQuestions, promptSettings), [words, savedQuestions, promptSettings]);
  const [exportPackage, setExportPackage] = useState(null);
  const stale = JSON.stringify(promptBatch.data) !== JSON.stringify(corpus.data);

  function newPromptBatch() {
    setPromptBatch(createGrammarBatch(corpus.data));
  }

  function handleStartSession(sess) {
    setPracticeQuestions(previous => [...previous, ...sess.questions]);
    setSession(sess);
  }

  function handleFinishSession(result) {
    if (!result.goBack) recordGrammarSession(result);
    if (result.goBack) {
      newPromptBatch();
      setSession(null);
    }
    // Stay in quiz view showing the results screen (GrammarQuiz handles it internally)
    // Only go back to practice if user explicitly clicks "Create new set"
  }

  function handleQuickAdd(destination, draft) {
    return saveReadingDraft(destination, draft, {
      words, structures: structureStore?.structures || [],
      addWord, addStructure: structureStore?.addStructure,
    });
  }

  return (
    <div className="space-y-6 vm-page-enter">
      {/* Module header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[var(--sb-plum)] to-[var(--sb-terracotta-strong)] border-2 border-[var(--sb-ink)] shadow-[var(--sb-shadow-sm)] flex items-center justify-center">
            <span className="text-white font-black text-lg">G</span>
          </div>
          <div>
            <h1 className="sb-heading text-2xl font-black tracking-tight text-[var(--sb-ink)]">
              Grammar <span className="text-[var(--sb-plum-text)]">VSTEP B1</span>
            </h1>
            <p className="text-[var(--sb-ink-soft)] text-sm">Nhận diện ngữ pháp · Phân tích cấu trúc câu</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {syncStatus === 'error' ? (
            <button onClick={syncFromCloud} className="vm-btn text-xs font-semibold text-[var(--sb-berry-text)] hover:text-[var(--sb-berry-hover)] underline underline-offset-2" title="Dữ liệu cục bộ được giữ nguyên">
              Lỗi đồng bộ · Thử lại
            </button>
          ) : (
            <span className="text-xs text-[var(--sb-ink-soft)]" role="status">
              {syncStatus === 'syncing' || syncStatus === 'conflict'
                ? 'Đang đồng bộ…'
                : hasPending ? 'Chờ đồng bộ' : syncStatus === 'ok' ? 'Đã đồng bộ' : ''}
            </span>
          )}
          {/* Local-only badge */}
          {!cloudConfigured && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--sb-ochre-soft)] border border-[var(--sb-ochre-text)]/35 text-[var(--sb-ochre-text)] text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--sb-ochre-text)] vm-pulse-soft" />
              Local Only
            </div>
          )}
          {/* Cloud settings button */}
          <button
            onClick={() => setShowCloud(v => !v)}
            className={`vm-btn flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border relative ${
              showCloud
                ? 'bg-[var(--sb-terracotta-soft)] text-[var(--sb-terracotta-text)] border-[var(--sb-ink)]'
                : 'bg-[var(--sb-paper-card)] text-[var(--sb-ink)] hover:bg-[var(--sb-paper-deep)] border-[var(--sb-ink-border)]'
            }`}
          >
            <Cloud size={13} />
            Cloud
            {hasPending && cloudConfigured && (
              <span className="w-2 h-2 rounded-full bg-[var(--sb-ochre)] animate-ping absolute -top-0.5 -right-0.5" />
            )}
          </button>
        </div>
      </div>

      {storageError && <p role="alert" className="text-[var(--sb-ochre-text)] font-semibold text-sm">{storageError}</p>}

      {/* Cloud settings panel */}
      {showCloud && (
        <GrammarCloudSettings
          onClose={() => setShowCloud(false)}
          onConfigChanged={() => { setCloudConfigured(); structureStore?.syncFromCloud(); }}
          syncStatus={syncStatus}
          hasPending={hasPending}
          onSync={syncFromCloud}
        />
      )}

      {/* Sub-tabs */}
      <div className="vm-panel flex gap-1 p-1.5 rounded-2xl">
        {SUB_TABS.map(({ id, label, Icon }) => {
          const badge = id === 'review' ? dueForReview.length : 0;
          return (
            <button
              key={id}
              id={`grammar-tab-${id}`}
              onClick={() => { setSubTab(id); setSession(null); }}
              className={`vm-btn flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold relative ${
                subTab === id
                  ? 'vm-btn-violet text-white'
                  : 'text-[var(--sb-ink-soft)] hover:text-[var(--sb-ink)] hover:bg-[var(--sb-paper-deep)]'
              }`}
            >
              <Icon size={15} />
              <span className="hidden sm:block">{label}</span>
              {badge > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-[var(--sb-berry-btn)] ring-2 ring-[var(--sb-paper)] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
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
                onQuickAdd={handleQuickAdd}
                onUnderlineChange={updateUnderlines}
                underlines={underlines}
                sentenceNotes={sentenceNotes} onNoteChange={updateSentenceNote}
              />
            : <GrammarPractice onStartSession={handleStartSession} batch={promptBatch} onNewBatch={newPromptBatch}
                settings={promptSettings} onSettingsChange={setPromptSettings}
                corpus={corpus} stale={stale} syncStatuses={[vocabSyncStatus, syncStatus]}
                exportSource={exportSource} exportPackage={exportPackage} onExportPrepared={setExportPackage}
                exportLoadError={[vocabDataLoadError, dataLoadError].filter(Boolean).join(' ')} />
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
            onQuickAdd={handleQuickAdd}
            onUnderlineChange={updateUnderlines}
            underlines={underlines}
            sentenceNotes={sentenceNotes} onNoteChange={updateSentenceNote}
          />
        )}

        {/* Review tab */}
        {subTab === 'review' && (
          <GrammarReview
            savedQuestions={savedQuestions}
            reviewProgress={reviewProgress}
            onRecordReview={recordReview}
            onQuickAdd={handleQuickAdd}
            onToggleHard={toggleHardMark}
            onUnderlineChange={updateUnderlines}
            underlines={underlines}
            sentenceNotes={sentenceNotes} onNoteChange={updateSentenceNote}
          />
        )}

        {/* Stats tab */}
        {subTab === 'stats' && (
          <GrammarStats
            grammarStats={grammarStats}
            reviewProgress={reviewProgress}
            savedQuestions={savedQuestions}
            dueForReview={dueForReview}
            wrongQuestions={wrongQuestions}
          />
        )}

        {subTab === 'structures' && structureStore && (
          <GrammarStructures
            structures={structureStore.structures}
            syncStatus={structureStore.syncStatus}
            onSync={structureStore.syncFromCloud}
            onAdd={structureStore.addStructure}
            onUpdate={structureStore.updateStructure}
            onDelete={structureStore.deleteStructure}
            onImport={structureStore.importStructures}
          />
        )}
      </div>
    </div>
  );
}
