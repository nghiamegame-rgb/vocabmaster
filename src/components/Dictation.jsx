import { useState } from 'react';
import { PenLine, Headphones, BookmarkCheck, Library } from 'lucide-react';
import DictationPractice from './dictation/DictationPractice';
import DictationWords from './dictation/DictationWords';
import DictationLibrary from './dictation/DictationLibrary';
import DictationSyncStatus from './dictation/DictationSyncStatus';
import VoiceSettings from './VoiceSettings';

const SECTIONS = [
  { id: 'practice', label: 'Luyện nghe', Icon: Headphones },
  { id: 'words', label: 'Từ đã lưu', Icon: BookmarkCheck },
  { id: 'library', label: 'Thư viện bài', Icon: Library },
];

/** Tab "Dictation" — luyện nghe chép chính tả. Store comes from App (useDictationStore). */
export default function Dictation({ store }) {
  const [section, setSection] = useState(() => (store.lessons.length ? 'practice' : 'library'));
  const [lessonId, setLessonId] = useState(null);
  const lesson = store.lessons.find(l => l.id === lessonId) || store.lessons[store.lessons.length - 1] || null;

  return (
    <div className="vm-page-enter max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white mb-1 flex items-center gap-3">
          <PenLine size={28} className="text-indigo-400" /> Dictation
        </h1>
        <p className="text-slate-300 text-sm">Nghe câu tiếng Anh và chép lại. Gõ đúng từ nào thì từ đó được mở.</p>
      </div>

      {store.storageError && <p role="alert" className="px-4 py-3 rounded-xl bg-amber-500/12 border border-amber-400/30 text-amber-200 text-sm">{store.storageError}</p>}
      <DictationSyncStatus store={store} />

      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Mục Dictation" className="flex items-center gap-1 bg-slate-950/60 border border-slate-400/15 rounded-xl p-1 w-fit max-w-full flex-wrap">
          {SECTIONS.map(({ id, label, Icon }) => (
            <button
              key={id} id={`dictation-section-${id}`} role="tab" type="button" aria-selected={section === id} onClick={() => setSection(id)}
              className={`vm-btn flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium ${section === id ? 'bg-slate-700/90 text-white shadow-sm ring-1 ring-white/10' : 'text-slate-300 hover:text-white hover:bg-slate-800/60'}`}
            >
              <Icon size={14} /> {label}
              {id === 'words' && <span className="text-xs opacity-70">({store.words.length})</span>}
            </button>
          ))}
        </div>
        {/* "Từ đã lưu" places its own voice button. */}
        {section !== 'words' && <VoiceSettings />}
      </div>

      {section === 'practice' && (
        <DictationPractice
          store={store} lesson={lesson} lessons={store.lessons}
          onSelectLesson={setLessonId} onOpenLibrary={() => setSection('library')}
        />
      )}
      {section === 'words' && <DictationWords store={store} />}
      {section === 'library' && (
        <DictationLibrary
          store={store}
          onPractice={id => { setLessonId(id); setSection('practice'); }}
        />
      )}
    </div>
  );
}
