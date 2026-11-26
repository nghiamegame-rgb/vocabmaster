import { useState } from 'react';
import {
  READING_ITEM_LABELS, validateReadingItem, getReadingDestinations, buildReadingDraft,
} from '../../utils/grammarReadingItems';

function ReadingItem({ item, question, onQuickAdd }) {
  const [form, setForm] = useState(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  function open(destination) {
    setForm({ destination, draft: buildReadingDraft(item, question, destination) });
    setError(''); setNotice('');
  }
  function change(key, value) {
    setForm(prev => ({ ...prev, draft: { ...prev.draft, [key]: value } }));
    setError('');
  }
  async function submit(event) {
    event.preventDefault();
    try {
      const result = await onQuickAdd(form.destination, form.draft);
      if (!result?.ok) { setError(result?.error || 'Chưa thêm được. Vui lòng thử lại.'); return; }
      setNotice(form.destination === 'vocab' ? 'Đã thêm vào Vocabulary.' : 'Đã thêm vào Grammar Structures.');
      setForm(null); setError('');
    } catch {
      setError('Chưa thêm được. Nội dung biểu mẫu được giữ để bạn thử lại.');
    }
  }
  return <li className="bg-[var(--sb-paper-card)] border-2 border-[var(--sb-ink-border)] rounded-xl p-3 space-y-2 text-[var(--sb-ink)]">
    <p className="text-xs font-semibold text-[var(--sb-terracotta-text)]">{READING_ITEM_LABELS[item.category]}</p>
    <p className="text-[var(--sb-ink)] font-bold">{item.text}</p>
    <p>{item.explanation}</p>
    {item.meaning && <p className="text-[var(--sb-ink-soft)]">Nghĩa: {item.meaning}</p>}
    {item.pattern && <p className="text-[var(--sb-plum-text)] font-medium">Mẫu: {item.pattern}</p>}
    {item.usefulness && <p className="text-[var(--sb-ink-soft)]">Ứng dụng đọc hiểu: {item.usefulness}</p>}
    {onQuickAdd && <div className="flex flex-wrap gap-2">{getReadingDestinations(item).map(destination => <button type="button" key={destination}
      aria-label={`Thêm ${item.text} vào ${destination === 'vocab' ? 'Vocabulary' : 'Grammar Structures'}`}
      onClick={() => open(destination)} className="px-3 py-1.5 rounded-lg bg-[var(--sb-terracotta-soft)] border border-[var(--sb-ink)] text-[var(--sb-terracotta-text)] hover:bg-[var(--sb-ochre-soft)] text-xs font-semibold">
      {destination === 'vocab' ? '+ Vocab' : '+ Structure'}
    </button>)}</div>}
    {form && <form onSubmit={submit} className="border-t border-[var(--sb-ink-border)] pt-3 space-y-3">
      <p className="font-semibold text-[var(--sb-plum-text)]">{form.destination === 'vocab' ? 'Thêm vào Vocabulary' : 'Thêm vào Grammar Structures'}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block text-xs font-semibold text-[var(--sb-ink-soft)]">{form.destination === 'vocab' ? 'Từ / cụm từ tiếng Anh' : 'Cấu trúc / mẫu tiếng Anh'}
          <input required value={form.draft.english} onChange={e => change('english', e.target.value)} className="field mt-1" />
        </label>
        <label className="block text-xs font-semibold text-[var(--sb-ink-soft)]">{form.destination === 'structure' ? 'Nghĩa tiếng Việt của cả cụm / mẫu' : 'Nghĩa / giải thích tiếng Việt'}
          <textarea required rows={2} value={form.draft.vietnamese} onChange={e => change('vietnamese', e.target.value)} className="field mt-1 resize-y" />
        </label>
      </div>
      {form.destination === 'structure' && <>
        {!item.meaning && <p className="text-[var(--sb-ochre-text)] text-xs font-medium">Mục này chưa có gợi ý nghĩa. Hãy nhập nghĩa của cả cụm / mẫu trước khi lưu; giải thích ngữ pháp nằm trong ghi chú.</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block text-xs font-semibold text-[var(--sb-ink-soft)]">Câu ví dụ
            <textarea rows={2} value={form.draft.example} onChange={e => change('example', e.target.value)} className="field mt-1 resize-y" />
          </label>
          <label className="block text-xs font-semibold text-[var(--sb-ink-soft)]">Chủ đề
            <input value={form.draft.topic} onChange={e => change('topic', e.target.value)} className="field mt-1" />
          </label>
        </div>
      </>}
      <label className="block text-xs font-semibold text-[var(--sb-ink-soft)]">Ghi chú
        <textarea rows={2} value={form.destination === 'vocab' ? form.draft.annotation : form.draft.notes}
          onChange={e => change(form.destination === 'vocab' ? 'annotation' : 'notes', e.target.value)} className="field mt-1 resize-y" />
      </label>
      {form.destination === 'vocab' && <label className="block text-xs font-semibold text-[var(--sb-ink-soft)]">Loại mục
        <select value={form.draft.wordType} onChange={e => change('wordType', e.target.value)} className="field mt-1">
          <option value="Word">Từ</option><option value="Phrase">Cụm từ</option><option value="Preposition">Giới từ</option>
        </select>
      </label>}
      {error && <p role="alert" className="text-[var(--sb-berry-text)] text-xs font-semibold">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" className="vm-btn vm-btn-primary px-4 py-2 rounded-lg text-xs font-semibold">Lưu mục mới</button>
        <button type="button" onClick={() => { setForm(null); setError(''); }} className="px-3 py-2 rounded-lg bg-[var(--sb-paper-deep)] border border-[var(--sb-ink-border)] text-[var(--sb-ink)] hover:bg-[var(--sb-paper-warm)] text-xs font-medium">Hủy</button>
      </div>
    </form>}
    {notice && <p role="status" className="text-[var(--sb-forest-text)] text-xs font-semibold">{notice}</p>}
  </li>;
}

export default function GrammarReadingNotes({ question, onQuickAdd }) {
  const items = Array.isArray(question.readingItems)
    ? question.readingItems.filter(item => !validateReadingItem(item, question.sentence)) : [];
  const notes = Array.isArray(question.readingNotes) ? question.readingNotes.filter(s => typeof s === 'string') : [];
  if (!items.length && !notes.length) return null;
  return <section className="space-y-3">
    <h4 className="text-[var(--sb-plum-text)] font-semibold">Lưu ý đọc hiểu</h4>
    {items.length > 0 && <ul className="space-y-3">{items.map((item, i) => <ReadingItem key={i} item={item} question={question} onQuickAdd={onQuickAdd} />)}</ul>}
    {notes.length > 0 && <ul className="list-disc pl-5 space-y-1">{notes.map((note, i) => <li key={i}>{note}</li>)}</ul>}
  </section>;
}
