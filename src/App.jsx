import { useState } from 'react';
import Navbar          from './components/Navbar';
import Dashboard       from './components/Dashboard';
import Vocabulary      from './components/Vocabulary';
import Quiz            from './components/Quiz';
import ListeningReview from './components/ListeningReview';
import { useVocabStore } from './hooks/useVocabStore';

export default function App() {
  const [activeTab,   setActiveTab]   = useState('dashboard');
  const [vocabFilter, setVocabFilter] = useState(null); // null = show all levels

  const {
    words,
    stats,
    addWord,
    deleteWord,
    updateWord,
    updateWordLevel,
    bulkUpdateLevel,
    recordQuizResult,
    syncStatus,
    syncFromCloud,
  } = useVocabStore();

  function handleSetActiveTab(tab) {
    setActiveTab(tab);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Navbar
        activeTab={activeTab}
        setActiveTab={handleSetActiveTab}
        syncStatus={syncStatus}
        onSync={syncFromCloud}
      />

      <main className="max-w-7xl mx-auto px-4 pt-24 pb-12">
        {activeTab === 'dashboard' && (
          <Dashboard
            words={words}
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
            bulkUpdateLevel={bulkUpdateLevel}
            vocabFilter={vocabFilter}
            setVocabFilter={setVocabFilter}
          />
        )}
        {activeTab === 'quiz' && (
          <Quiz
            words={words}
            updateWordLevel={updateWordLevel}
            recordQuizResult={recordQuizResult}
          />
        )}
        {activeTab === 'listening' && (
          <ListeningReview
            words={words}
            updateWordLevel={updateWordLevel}
          />
        )}
      </main>
    </div>
  );
}
