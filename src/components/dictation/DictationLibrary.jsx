import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, PlayCircle, Download, Upload, FileSpreadsheet, Copy } from 'lucide-react';
import { parseLessonInput, MAX_TITLE_CHARS } from '../../utils/dictationParse';
import { lessonProgress } from '../../utils/dictationModel';
import { downloadDictationWorkbook } from '../../utils/dictationExport';
import { DICTATION_AI_PROMPT } from '../../utils/dictationAiPrompt';

export default function DictationLibrary({ store, onPractice }) {
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [message, setMessage] = useState('');
  const [confirmId, setConfirmId] = useState(null);
  const fileRef = useRef(null);
  const parsed = useMemo(() => parseLessonInput(text), [text]);
  // Result of "Sao chép prompt cho AI": null, { copied: true } or { copied: false } (copy by hand).
  const [promptCopy, setPromptCopy] = useState(null);
  const promptRef = useRef(null);

  useEffect(() => {
    if (!promptCopy || promptCopy.copied) return;
    promptRef.current?.focus();
    promptRef.current?.setSelectionRange(0, promptRef.current.value.length);
  }, [promptCopy]);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(DICTATION_AI_PROMPT);
      setPromptCopy({ copied: true });
    } catch {
      setPromptCopy({ copied: false }); // no clipboard access: show it, already selected
    }
  }

  function addLesson() {
    if (!parsed.items.length) { setMessage('Hãy dán ít nhất một câu.'); return; }
    if (parsed.errors.length) { setMessage(parsed.errors[0]); return; }
    const result = store.addLesson(title, parsed.items);
    if (!result.ok) { setMessage(result.error); return; }
    setMessage(`Đã tạo bài “${result.title}” với ${result.count} câu.`);
    setTitle(''); setText('');
  }

  async function importFile(file) {
    if (!file) return;
    const result = store.importBackup(await file.text());
    setMessage(result.ok ? `Đã gộp bản sao: ${result.sentences} câu, ${result.words} từ (không xoá gì).` : result.error);
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <div className="space-y-5">
      <section className="vm-card rounded-2xl p-4 sm:p-5 space-y-3" aria-labelledby="dictation-new-title">
        <h2 id="dictation-new-title" className="text-xs font-bold uppercase tracking-wider text-indigo-200">Nạp bài mới</h2>
        <input
          id="dictation-lesson-title" value={title} onChange={e => setTitle(e.target.value)} maxLength={MAX_TITLE_CHARS}
          placeholder="Tên bài (ví dụ: VSTEP Listening Part 1)" aria-label="Tên bài"
          className="w-full vm-input rounded-xl px-3 py-2 text-sm"
        />
        <textarea
          id="dictation-lesson-text" value={text} onChange={e => setText(e.target.value)} rows={7}
          placeholder={'Mỗi dòng một câu. Có thể kèm bản dịch: English | Tiếng Việt\nHoặc dán cả đoạn văn, app tự tách câu ở . ? !'}
          aria-label="Nội dung bài"
          className="w-full vm-input rounded-xl px-3 py-2 text-sm resize-y"
        />
        <div className="flex flex-wrap items-center gap-3">
          <button id="dictation-add-lesson" type="button" onClick={addLesson} disabled={!parsed.items.length} className="vm-btn vm-btn-primary flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50">
            <Plus size={15} /> Thêm bài
          </button>
          <span id="dictation-parse-preview" className="text-xs text-slate-300">
            {parsed.items.length ? `Sẽ tạo ${parsed.items.length} câu${parsed.items.some(i => i.vietnamese) ? `, ${parsed.items.filter(i => i.vietnamese).length} câu có bản dịch` : ''}.` : 'Chưa có câu nào.'}
          </span>
        </div>
        {parsed.errors.length > 0 && <ul className="text-xs text-amber-300 list-disc pl-5">{parsed.errors.slice(0, 3).map(e => <li key={e}>{e}</li>)}</ul>}
        {parsed.items.length > 0 && (
          <ol className="text-xs text-slate-400 list-decimal pl-5 space-y-0.5 max-h-32 overflow-auto">
            {parsed.items.slice(0, 5).map((item, i) => <li key={i} className="break-words">{item.english}{item.vietnamese && <span className="text-slate-500"> — {item.vietnamese}</span>}</li>)}
            {parsed.items.length > 5 && <li className="list-none text-slate-500">… và {parsed.items.length - 5} câu nữa</li>}
          </ol>
        )}
        {message && <p role="status" className="text-sm text-emerald-300">{message}</p>}
      </section>

      <section className="space-y-2" aria-labelledby="dictation-lessons-title">
        <h2 id="dictation-lessons-title" className="text-xs font-bold uppercase tracking-wider text-indigo-200">Các bài đã nạp ({store.lessons.length})</h2>
        {store.lessons.length === 0 && <p className="text-sm text-slate-400">Chưa có bài nào.</p>}
        <ul className="space-y-2">
          {store.lessons.map(lesson => {
            const p = lessonProgress(lesson);
            return (
              <li key={lesson.id} className="vm-card rounded-2xl px-4 py-3 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[10rem]">
                  <p className="text-white font-semibold break-words">{lesson.title}</p>
                  <p className="text-xs text-slate-400">{lesson.sentences.length} câu · <span className="text-emerald-300">đúng {p.correct}</span> · <span className="text-rose-300">sai {p.wrong}</span> · chưa làm {p.todo}</p>
                </div>
                <button type="button" onClick={() => onPractice(lesson.id)} className="vm-btn flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-500/20 border border-indigo-400/40 text-indigo-200 hover:bg-indigo-500/30">
                  <PlayCircle size={14} /> Luyện
                </button>
                {confirmId === lesson.id ? (
                  <span className="flex items-center gap-2">
                    <button type="button" onClick={() => { store.deleteLesson(lesson.id); setConfirmId(null); }} className="vm-btn px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-600 text-white">Xoá bài</button>
                    <button type="button" onClick={() => setConfirmId(null)} className="vm-btn px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 text-slate-200">Huỷ</button>
                  </span>
                ) : (
                  <button type="button" onClick={() => setConfirmId(lesson.id)} aria-label={`Xoá bài ${lesson.title}`} className="vm-btn p-2 rounded-xl text-rose-300 hover:bg-rose-500/15"><Trash2 size={15} /></button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="vm-panel rounded-2xl p-4 sm:p-5 space-y-2" aria-labelledby="dictation-backup-title">
        <h2 id="dictation-backup-title" className="text-xs font-bold uppercase tracking-wider text-indigo-200">Sao lưu</h2>
        <p className="text-xs text-slate-400">Bản sao .json gồm mọi bài và từ đã lưu (kể cả mục đã xoá). Nhập lại chỉ GỘP thêm, không xoá dữ liệu hiện có. File Excel chỉ chứa các câu tiếng Anh, mỗi dòng một câu.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={store.exportBackup} className="vm-btn flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 border border-slate-400/20 text-white hover:bg-slate-700">
            <Download size={14} /> Xuất bản sao (.json)
          </button>
          <label className="vm-btn flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 border border-slate-400/20 text-white hover:bg-slate-700 cursor-pointer">
            <Upload size={14} /> Nhập bản sao
            <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" onChange={e => importFile(e.target.files?.[0])} />
          </label>
          <button id="dictation-export-xlsx" type="button" onClick={async () => {
            try { const r = await downloadDictationWorkbook(store.data); setMessage(r.sentences ? `Đã xuất Excel: ${r.sentences} câu.` : 'Chưa có câu nào để xuất.'); }
            catch { setMessage('Chưa xuất được file Excel.'); }
          }} className="vm-btn flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600/80 border border-emerald-400/40 text-white hover:bg-emerald-500">
            <FileSpreadsheet size={14} /> Xuất Excel (.xlsx)
          </button>
          <button id="dictation-copy-prompt" type="button" onClick={copyPrompt} className="vm-btn flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-500/20 border border-indigo-400/40 text-indigo-200 hover:bg-indigo-500/30">
            <Copy size={14} /> Sao chép prompt cho AI
          </button>
        </div>
        <p className="text-[11px] text-slate-400">Xuất Excel → gửi file kèm prompt này cho chatbot → dán kết quả vào ô Nạp bài mới.</p>
        {promptCopy?.copied && <p id="dictation-prompt-copied" role="status" className="text-sm text-emerald-300">Đã sao chép prompt.</p>}
        {promptCopy && !promptCopy.copied && (
          <label className="block space-y-1">
            <span role="status" className="block text-xs text-amber-300">Trình duyệt không cho sao chép tự động. Prompt dưới đây đã được chọn sẵn, bạn hãy tự sao chép (Ctrl+C, hoặc nhấn giữ rồi chọn Sao chép).</span>
            <textarea
              id="dictation-ai-prompt" ref={promptRef} readOnly rows={10} value={DICTATION_AI_PROMPT}
              className="w-full vm-input rounded-xl px-3 py-2 text-xs resize-y"
            />
          </label>
        )}
      </section>
    </div>
  );
}
