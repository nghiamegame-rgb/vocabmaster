import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, PlayCircle, Download, Upload, FileSpreadsheet, Copy } from 'lucide-react';
import { parseLessonInput, MAX_TITLE_CHARS } from '../../utils/dictationParse';
import { lessonProgress } from '../../utils/dictationModel';
import { downloadDictationWorkbook } from '../../utils/dictationExport';
import {
  DICTATION_LEVELS,
  buildDictationAiPrompt,
  readDictationPromptLevel,
  writeDictationPromptLevel,
} from '../../utils/dictationAiPrompt';

export default function DictationLibrary({ store, onPractice }) {
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [message, setMessage] = useState('');
  const [confirmId, setConfirmId] = useState(null);
  const fileRef = useRef(null);
  const parsed = useMemo(() => parseLessonInput(text), [text]);
  // Result of "Sao chép prompt cho AI": null, { copied: true } or { copied: false } (copy by hand).
  const [promptLevel, setPromptLevel] = useState(() => readDictationPromptLevel());
  const currentPrompt = useMemo(() => buildDictationAiPrompt(promptLevel), [promptLevel]);
  const [promptCopy, setPromptCopy] = useState(null);
  const promptRef = useRef(null);

  useEffect(() => {
    if (!promptCopy || promptCopy.copied) return;
    promptRef.current?.focus();
    promptRef.current?.setSelectionRange(0, promptRef.current.value.length);
  }, [promptCopy]);

  function selectPromptLevel(levelId) {
    const saved = writeDictationPromptLevel(levelId);
    setPromptLevel(saved);
    setPromptCopy(prev => (prev?.copied ? null : prev));
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(currentPrompt);
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
        <h2 id="dictation-new-title" className="text-xs font-bold uppercase tracking-wider text-[var(--sb-terracotta-text)]">Nạp bài mới</h2>
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
          <span id="dictation-parse-preview" className="text-xs text-[var(--sb-ink-soft)]">
            {parsed.items.length ? `Sẽ tạo ${parsed.items.length} câu${parsed.items.some(i => i.vietnamese) ? `, ${parsed.items.filter(i => i.vietnamese).length} câu có bản dịch` : ''}.` : 'Chưa có câu nào.'}
          </span>
        </div>
        {parsed.errors.length > 0 && <ul className="text-xs font-medium text-[var(--sb-ochre-text)] list-disc pl-5">{parsed.errors.slice(0, 3).map(e => <li key={e}>{e}</li>)}</ul>}
        {parsed.items.length > 0 && (
          <ol className="text-xs text-[var(--sb-ink)] list-decimal pl-5 space-y-0.5 max-h-32 overflow-auto">
            {parsed.items.slice(0, 5).map((item, i) => <li key={i} className="break-words">{item.english}{item.vietnamese && <span className="text-[var(--sb-ink-soft)]"> — {item.vietnamese}</span>}</li>)}
            {parsed.items.length > 5 && <li className="list-none text-[var(--sb-ink-soft)]">… và {parsed.items.length - 5} câu nữa</li>}
          </ol>
        )}
        {message && <p role="status" className="text-sm font-semibold text-[var(--sb-forest-text)]">{message}</p>}
      </section>

      <section className="space-y-2" aria-labelledby="dictation-lessons-title">
        <h2 id="dictation-lessons-title" className="text-xs font-bold uppercase tracking-wider text-[var(--sb-terracotta-text)]">Các bài đã nạp ({store.lessons.length})</h2>
        {store.lessons.length === 0 && <p className="text-sm text-[var(--sb-ink-soft)]">Chưa có bài nào.</p>}
        <ul className="space-y-2">
          {store.lessons.map(lesson => {
            const p = lessonProgress(lesson);
            return (
              <li key={lesson.id} className="vm-card rounded-2xl px-4 py-3 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[10rem]">
                  <p className="text-[var(--sb-ink)] font-bold break-words">{lesson.title}</p>
                  <p className="text-xs text-[var(--sb-ink-soft)]">{lesson.sentences.length} câu · <span className="text-[var(--sb-forest-text)] font-semibold">đúng {p.correct}</span> · <span className="text-[var(--sb-berry-text)] font-semibold">sai {p.wrong}</span> · chưa làm {p.todo}</p>
                </div>
                <button type="button" onClick={() => onPractice(lesson.id)} className="vm-btn flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--sb-terracotta-soft)] border border-[var(--sb-ink)] text-[var(--sb-terracotta-text)] hover:bg-[var(--sb-ochre-soft)]">
                  <PlayCircle size={14} /> Luyện
                </button>
                {confirmId === lesson.id ? (
                  <span className="flex items-center gap-2">
                    <button type="button" onClick={() => { store.deleteLesson(lesson.id); setConfirmId(null); }} className="vm-btn px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--sb-berry-btn)] hover:bg-[var(--sb-berry-hover)] text-white border border-[var(--sb-ink)]">Xoá bài</button>
                    <button type="button" onClick={() => setConfirmId(null)} className="vm-btn px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--sb-paper-card)] border border-[var(--sb-ink-border)] text-[var(--sb-ink)] hover:bg-[var(--sb-paper-deep)]">Huỷ</button>
                  </span>
                ) : (
                  <button type="button" onClick={() => setConfirmId(lesson.id)} aria-label={`Xoá bài ${lesson.title}`} className="vm-btn p-2 rounded-xl text-[var(--sb-berry-text)] hover:bg-[var(--sb-berry-soft)]"><Trash2 size={15} /></button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="vm-panel rounded-2xl p-4 sm:p-5 space-y-2" aria-labelledby="dictation-backup-title">
        <h2 id="dictation-backup-title" className="text-xs font-bold uppercase tracking-wider text-[var(--sb-terracotta-text)]">Sao lưu</h2>
        <p className="text-xs text-[var(--sb-ink-soft)]">Bản sao .json gồm mọi bài và từ đã lưu (kể cả mục đã xoá). Nhập lại chỉ GỘP thêm, không xoá dữ liệu hiện có. File Excel chỉ chứa các câu tiếng Anh, mỗi dòng một câu.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={store.exportBackup} className="vm-btn flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--sb-paper-card)] border-2 border-[var(--sb-ink-border)] text-[var(--sb-ink)] hover:bg-[var(--sb-paper-deep)]">
            <Download size={14} /> Xuất bản sao (.json)
          </button>
          <label className="vm-btn flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--sb-paper-card)] border-2 border-[var(--sb-ink-border)] text-[var(--sb-ink)] hover:bg-[var(--sb-paper-deep)] cursor-pointer">
            <Upload size={14} /> Nhập bản sao
            <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" onChange={e => importFile(e.target.files?.[0])} />
          </label>
          <button id="dictation-export-xlsx" type="button" onClick={async () => {
            try { const r = await downloadDictationWorkbook(store.data); setMessage(r.sentences ? `Đã xuất Excel: ${r.sentences} câu.` : 'Chưa có câu nào để xuất.'); }
            catch { setMessage('Chưa xuất được file Excel.'); }
          }} className="vm-btn flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--sb-forest-btn)] border-2 border-[var(--sb-ink)] text-white shadow-[var(--sb-shadow-sm)] hover:bg-[var(--sb-forest-hover)]">
            <FileSpreadsheet size={14} /> Xuất Excel (.xlsx)
          </button>
          <div className="inline-flex flex-wrap items-center gap-1.5 rounded-xl bg-[var(--sb-paper-deep)] border border-[var(--sb-ink-border)] px-2 py-1" role="group" aria-label="Độ khó prompt cho AI">
            <span className="text-[11px] font-semibold text-[var(--sb-ink-soft)]">Độ khó</span>
            <div className="inline-flex items-center gap-0.5">
              {DICTATION_LEVELS.map(level => {
                const active = promptLevel === level.id;
                return (
                  <button
                    key={level.id}
                    id={`dictation-prompt-level-${level.id}`}
                    type="button"
                    aria-pressed={active}
                    aria-label={`Chọn độ khó ${level.label}`}
                    title={level.description}
                    onClick={() => selectPromptLevel(level.id)}
                    className={`vm-btn px-2 py-0.5 rounded-lg text-xs font-semibold ${
                      active
                        ? 'bg-[var(--sb-plum-soft)] border border-[var(--sb-ink)] text-[var(--sb-plum-text)]'
                        : 'border border-transparent text-[var(--sb-ink)] hover:bg-[var(--sb-paper-card)]'
                    }`}
                  >
                    {level.label}
                  </button>
                );
              })}
            </div>
          </div>
          <button id="dictation-copy-prompt" type="button" onClick={copyPrompt} className="vm-btn flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--sb-terracotta-soft)] border border-[var(--sb-ink)] text-[var(--sb-terracotta-text)] hover:bg-[var(--sb-ochre-soft)]">
            <Copy size={14} /> Sao chép prompt cho AI
          </button>
        </div>
        <p className="text-[11px] text-[var(--sb-ink-soft)]">Xuất Excel → gửi file kèm prompt này cho chatbot → dán kết quả vào ô Nạp bài mới.</p>
        {promptCopy?.copied && <p id="dictation-prompt-copied" role="status" className="text-sm font-semibold text-[var(--sb-forest-text)]">Đã sao chép prompt.</p>}
        {promptCopy && !promptCopy.copied && (
          <label className="block space-y-1">
            <span role="status" className="block text-xs font-medium text-[var(--sb-ochre-text)]">Trình duyệt không cho sao chép tự động. Prompt dưới đây đã được chọn sẵn, bạn hãy tự sao chép (Ctrl+C, hoặc nhấn giữ rồi chọn Sao chép).</span>
            <textarea
              id="dictation-ai-prompt" ref={promptRef} readOnly rows={10} value={currentPrompt}
              className="w-full vm-input rounded-xl px-3 py-2 text-xs resize-y"
            />
          </label>
        )}
      </section>
    </div>
  );
}
