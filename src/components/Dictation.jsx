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
        <h1 className="sb-heading text-3xl font-extrabold text-[var(--sb-ink)] mb-1 flex items-center gap-3">
          <PenLine size={28} className="text-[var(--sb-terracotta-strong)]" /> Dictation
        </h1>
        <p className="text-[var(--sb-ink-soft)] text-sm">Nghe câu tiếng Anh và chép lại. Gõ đúng từ nào thì từ đó được mở.</p>
      </div>

      {store.storageError && <p role="alert" className="px-4 py-3 rounded-xl bg-[var(--sb-ochre-soft)] border-2 border-[var(--sb-ochre)] text-[var(--sb-ochre-text)] font-medium text-sm">{store.storageError}</p>}
      <DictationSyncStatus store={store} />

      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Mục Dictation" className="flex items-center gap-1 bg-[var(--sb-paper-deep)] border border-[var(--sb-ink-border)] rounded-xl p-1 w-fit max-w-full flex-wrap">
          {SECTIONS.map(({ id, label, Icon }) => (
            <button
              key={id} id={`dictation-section-${id}`} role="tab" type="button" aria-selected={section === id} onClick={() => setSection(id)}
              className={`vm-btn flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold ${section === id ? 'bg-[var(--sb-paper-card)] text-[var(--sb-ink)] border border-[var(--sb-ink)] shadow-sm' : 'text-[var(--sb-ink-soft)] hover:text-[var(--sb-ink)] hover:bg-[var(--sb-paper-card)]/60'}`}
            >
              <Icon size={14} /> {label}
              {id === 'words' && <span className="text-xs">({store.words.length})</span>}
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
