import { lazy, Suspense, useState } from 'react';
import Navbar          from './components/Navbar';
import Dashboard       from './components/Dashboard';
import Vocabulary      from './components/Vocabulary';
import Quiz            from './components/Quiz';
import ListeningReview from './components/ListeningReview';
import Flashcard       from './components/Flashcard';
import Grammar         from './components/Grammar';
import { useVocabStore } from './hooks/useVocabStore';
import { useStructuresStore } from './hooks/useStructuresStore';
import { useGrammarStore } from './hooks/useGrammarStore';
import { useDictationStore } from './hooks/useDictationStore';

// Loaded on first open so the main bundle does not grow.
const Dictation = lazy(() => import('./components/Dictation'));

const LEGACY_TABS = new Set(['flashcard', 'quiz', 'listening', 'grammar', 'dictation']);

export default function App() {
  const [activeTab,   setActiveTab]   = useState('dashboard');
  const [vocabFilter, setVocabFilter] = useState(null); // null = show all levels

  const {
    words,
    hasReadableWords,
    dataLoadError: vocabDataLoadError,
    cloudReadStatus: vocabCloudReadStatus,
    stats,
    addWord,
    deleteWord,
    updateWord,
    toggleWordHard,
    updateWordLevel,
    bulkUpdateLevel,
    recordQuizResult,
    syncStatus,
    pushStatus,
    syncFromCloud,
    syncNotice, syncPaused, pauseSync, resumeSync, exportSyncBackup,
  } = useVocabStore();
  const structureStore = useStructuresStore();
  // Lives at App level (like Structures) so Grammar sync also runs while the Grammar tab is closed.
  const grammarStore = useGrammarStore();
  // Dictation (chép chính tả): separate store; Listening uses its saved words.
  const dictationStore = useDictationStore();

  function handleSetActiveTab(tab) {
    setActiveTab(tab);
  }

  return (
    <div className="vm-app-shell">
      <Navbar
        activeTab={activeTab}
        setActiveTab={handleSetActiveTab}
        syncStatus={syncStatus}
        pushStatus={pushStatus}
        onSync={syncFromCloud}
      />

      <main className="max-w-7xl mx-auto px-4 pt-24 pb-12">
        <div data-testid="vocab-sync-controls" className="sb-paper-note mb-5 px-4 py-3 text-sm text-[#2b2a33] flex flex-wrap gap-x-4 gap-y-2 items-center" role="status">
          <span className="font-medium">Vocabulary: {syncPaused || syncStatus === 'paused' ? 'đang tạm dừng ghi cloud' : 'đồng bộ đã bật trên thiết bị'}</span>
          <button className="vm-btn text-[#a83b1c] hover:text-[#7c270f] underline underline-offset-4 font-semibold" onClick={syncPaused ? resumeSync : pauseSync}>{syncPaused ? 'Bật đồng bộ thiết bị' : 'Tạm dừng đồng bộ'}</button>
          <button className="vm-btn text-[#a83b1c] hover:text-[#7c270f] underline underline-offset-4 font-semibold" onClick={exportSyncBackup}>Xuất bản sao Vocabulary</button>
          {syncNotice && <p className="w-full text-[#7d5608] font-medium text-xs sm:text-sm leading-relaxed">{syncNotice}</p>}
        </div>
        {vocabDataLoadError && <p role="alert" className="mb-4 px-4 py-3 rounded-xl bg-[#f8ecd0] border-2 border-[#7d5608] text-[#5c3d04] font-medium text-sm shadow-[3px_3px_0_#2b2a33] animate-fade-in">{vocabDataLoadError}</p>}
        {activeTab === 'dashboard' && (
          <Dashboard
            words={words}
            hasReadableWords={hasReadableWords}
            stats={stats}
            setActiveTab={handleSetActiveTab}
            setVocabFilter={(level) => {
              setVocabFilter(level);
              setActiveTab('vocabulary');
            }}
          />
        )}
        {activeTab === 'vocabulary' && (
          <Vocabulary
            words={words}
            addWord={addWord}
            deleteWord={deleteWord}
            updateWord={updateWord}
            toggleWordHard={toggleWordHard}
            bulkUpdateLevel={bulkUpdateLevel}
            vocabFilter={vocabFilter}
            setVocabFilter={setVocabFilter}
          />
        )}
        {LEGACY_TABS.has(activeTab) && (
          <div className="sb-legacy p-4 sm:p-6">
            {activeTab === 'quiz' && (
              <Quiz
                words={words}
                structures={structureStore.structures}
                updateWordLevel={updateWordLevel}
                recordQuizResult={recordQuizResult}
                recordStructureResult={structureStore.recordStructureResult}
              />
            )}
            {activeTab === 'listening' && (
              <ListeningReview
                words={words}
                updateWordLevel={updateWordLevel}
                dictationStore={dictationStore}
              />
            )}
            {activeTab === 'flashcard' && (
              <Flashcard
                words={words}
                updateWordLevel={updateWordLevel}
              />
            )}
            {activeTab === 'grammar' && (
              <Grammar
                grammarStore={grammarStore}
                addWord={addWord}
                words={words}
                structureStore={structureStore}
                vocabSyncStatus={vocabCloudReadStatus}
                vocabDataLoadError={vocabDataLoadError}
              />
            )}
            {activeTab === 'dictation' && (
              <Suspense fallback={<p className="text-slate-300 text-sm" role="status">Đang tải Dictation…</p>}>
                <Dictation store={dictationStore} />
              </Suspense>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
