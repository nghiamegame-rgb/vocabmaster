import { useMemo, useState } from 'react';
import { Search, Volume2, Trash2, BookmarkCheck } from 'lucide-react';
import { playAudio } from '../../utils/audio';
import { listenTotals } from '../../utils/dictationSyncMerge';

export default function DictationWords({ store }) {
  const [query, setQuery] = useState('');
  const words = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...store.words].sort((a, b) => b.savedAt - a.savedAt);
    return q ? list.filter(w => w.word.toLowerCase().includes(q) || w.sentence.toLowerCase().includes(q) || w.lessonTitle.toLowerCase().includes(q)) : list;
  }, [store.words, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[12rem] max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            id="dictation-word-search" type="search" value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Tìm từ, câu gốc hoặc tên bài…" aria-label="Tìm từ đã lưu"
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
        <ul className="space-y-2" aria-label="Từ đã lưu">
          {words.map(w => {
            const totals = listenTotals(w);
            return (
              <li key={w.id} id={`dictation-word-${w.id}`} className="vm-card rounded-2xl px-4 py-3 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-bold">{w.word}</span>
                    <span className="text-[11px] text-slate-400">nghe đúng {totals.correct} · sai {totals.wrong}</span>
                  </p>
                  {w.sentence && <p className="text-sm text-slate-300 mt-0.5 break-words">“{w.sentence}”</p>}
                  {w.lessonTitle && <p className="text-[11px] text-slate-500 mt-0.5">Bài: {w.lessonTitle}</p>}
                </div>
                <button type="button" onClick={() => playAudio(w.word)} aria-label={`Nghe từ ${w.word}`} className="vm-btn p-2 rounded-xl text-indigo-200 hover:text-white hover:bg-slate-800/80 shrink-0">
                  <Volume2 size={16} />
                </button>
                <button type="button" onClick={() => store.unsaveWord(w.id)} aria-label={`Xoá từ ${w.word}`} className="vm-btn p-2 rounded-xl text-rose-300 hover:text-rose-200 hover:bg-rose-500/15 shrink-0">
                  <Trash2 size={16} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
