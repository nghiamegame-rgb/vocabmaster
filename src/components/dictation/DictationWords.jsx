import { useMemo, useState } from 'react';
import { Search, Volume2, Trash2, BookmarkCheck, Headphones, List } from 'lucide-react';
import { speakWithSettings } from '../../utils/voiceSpeech';
import VoiceSettings from '../VoiceSettings';
import DictationWordPractice from './DictationWordPractice';

const VIEWS = [
  { id: 'listen', label: 'Luyện nghe', Icon: Headphones },
  { id: 'list', label: 'Danh sách', Icon: List },
];

/** "Từ đã lưu": listening practice (default) or the searchable word grid. */
export default function DictationWords({ store }) {
  const [view, setView] = useState('listen');

  return (
    <div className={view === 'listen' ? 'max-w-2xl mx-auto space-y-5' : 'space-y-4'}>
      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Cách xem từ đã lưu" className="flex items-center gap-1 bg-slate-950/60 border border-slate-400/15 rounded-xl p-1 w-fit max-w-full flex-wrap">
          {VIEWS.map(({ id, label, Icon }) => (
            <button
              key={id} id={`dictation-words-view-${id}`} role="tab" type="button" aria-selected={view === id} onClick={() => setView(id)}
              className={`vm-btn flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${view === id ? 'bg-slate-700/90 text-white shadow-sm ring-1 ring-white/10' : 'text-slate-300 hover:text-white hover:bg-slate-800/60'}`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
        {/* In practice the voice button sits in the stats row, like Listening Review. */}
        {view === 'list' && <VoiceSettings />}
      </div>
      {view === 'listen' ? <DictationWordPractice store={store} /> : <DictationWordList store={store} />}
    </div>
  );
}

function DictationWordList({ store }) {
  const [query, setQuery] = useState('');
  const words = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...store.words].sort((a, b) => b.savedAt - a.savedAt);
    return q ? list.filter(w => w.word.toLowerCase().includes(q)) : list;
  }, [store.words, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[12rem] max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            id="dictation-word-search" type="search" value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Tìm từ…" aria-label="Tìm từ đã lưu"
            className="w-full vm-input rounded-xl pl-9 pr-3 py-2 text-sm"
          />
        </div>
        <span className="text-xs text-slate-300">{store.words.length} từ đã lưu</span>
      </div>

      {store.words.length === 0 ? (
        <p className="vm-panel rounded-2xl p-5 text-sm text-slate-300">
          Chưa có từ nào. Trong “Luyện nghe”, khi một từ đã mở, bấm biểu tượng <BookmarkCheck size={14} className="inline text-violet-300" /> để lưu.
        </p>
      ) : words.length === 0 ? (
        <p className="text-sm text-slate-400">Không có từ khớp “{query}”.</p>
      ) : (
        <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3" aria-label="Từ đã lưu">
          {words.map(w => (
            <li key={w.id} id={`dictation-word-${w.id}`} className="vm-card vm-card-interactive rounded-2xl p-4 flex flex-col justify-between gap-3 min-w-0">
              <p lang="en" className="text-white font-bold text-base sm:text-lg leading-snug break-words">{w.word}</p>
              <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-400/15">
                <button type="button" onClick={() => speakWithSettings(w.word, { itemKey: `word:${w.id}` })} aria-label={`Nghe từ ${w.word}`} className="vm-btn p-2 rounded-xl text-indigo-200 hover:text-white hover:bg-slate-800/80 shrink-0">
                  <Volume2 size={16} />
                </button>
                <button type="button" onClick={() => store.unsaveWord(w.id)} aria-label={`Xoá từ ${w.word}`} className="vm-btn p-2 rounded-xl text-rose-300 hover:text-rose-200 hover:bg-rose-500/15 shrink-0">
                  <Trash2 size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
