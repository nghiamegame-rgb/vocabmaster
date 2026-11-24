import { useMemo, useRef, useState } from 'react';
import { Download, Edit3, Plus, Search, Trash2, Upload, X } from 'lucide-react';

const EMPTY_FORM = { english: '', vietnamese: '', example: '', notes: '', topic: '' };

function LevelPill({ level }) {
  return <span className="px-2 py-0.5 rounded-md bg-indigo-500/15 border border-indigo-500/25 text-indigo-300 text-xs font-semibold">L{level}</span>;
}

export default function GrammarStructures({ structures, syncStatus, onSync, onAdd, onUpdate, onDelete, onImport }) {
  const [query, setQuery] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return structures;
    return structures.filter(item => [item.english, item.vietnamese, item.example, item.notes, item.topic].some(value => String(value || '').toLowerCase().includes(needle)));
  }, [query, structures]);

  function resetForm() { setForm(EMPTY_FORM); setEditingId(null); setError(''); }
  function submit(event) {
    event.preventDefault();
    const result = editingId ? onUpdate(editingId, form) : onAdd(form);
    if (!result.ok) { setError(result.error); return; }
    resetForm();
  }
  function startEdit(item) {
    setEditingId(item.id);
    setForm({ english: item.english, vietnamese: item.vietnamese, example: item.example, notes: item.notes, topic: item.topic });
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function exportJson() {
    const blob = new Blob([JSON.stringify(structures, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = 'vocabmaster-structures.json'; link.click(); URL.revokeObjectURL(url);
  }
  function importJson(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { try { const result = onImport(JSON.parse(reader.result)); if (!result.ok) setError(result.error); else setError(''); } catch { setError('Tệp JSON không hợp lệ.'); } };
    reader.readAsText(file); event.target.value = '';
  }

  return (
    <div className="space-y-5 vm-page-enter">
      <div className="vm-panel flex flex-wrap items-center justify-between gap-2 rounded-2xl p-3.5 text-sm">
        <span className={syncStatus === 'error' ? 'text-amber-300' : 'text-slate-200'}>
          {syncStatus === 'ok' ? 'Structures: đã đồng bộ Google Sheets.'
            : syncStatus === 'syncing' ? 'Structures: đang đồng bộ…'
            : syncStatus === 'unconfigured' ? 'Thiết lập URL trong Grammar Cloud để đồng bộ Structures.'
            : syncStatus === 'error' ? 'Chưa đồng bộ. Dữ liệu vẫn lưu trên máy; kiểm tra mạng và cập nhật Apps Script hỗ trợ Structures.'
            : 'Có thay đổi trên máy đang chờ đồng bộ.'}
        </span>
        <button onClick={onSync} disabled={syncStatus === 'syncing'} className="vm-btn text-indigo-300 hover:text-indigo-200 font-medium underline underline-offset-2 disabled:opacity-50">Sync Structures</button>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div><h2 className="text-xl font-bold tracking-tight text-white">Structures</h2><p className="text-slate-300 text-sm">Lưu cấu trúc và tự ôn theo mức L1–L5.</p></div>
        <div className="flex gap-2">
          <button onClick={exportJson} className="vm-btn flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800/85 border border-slate-400/20 text-slate-200 hover:text-white hover:bg-slate-700 text-xs font-medium"><Download size={14} /> Xuất JSON</button>
          <button onClick={() => fileRef.current?.click()} className="vm-btn flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800/85 border border-slate-400/20 text-slate-200 hover:text-white hover:bg-slate-700 text-xs font-medium"><Upload size={14} /> Nhập JSON</button>
          <input ref={fileRef} type="file" accept="application/json" onChange={importJson} className="hidden" />
        </div>
      </div>

      <form onSubmit={submit} className="vm-panel rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between"><h3 className="text-white font-semibold">{editingId ? 'Sửa cấu trúc' : 'Thêm cấu trúc'}</h3>{editingId && <button type="button" onClick={resetForm} className="text-slate-300 hover:text-white"><X size={17} /></button>}</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input required value={form.english} onChange={e => setForm({ ...form, english: e.target.value })} placeholder="Cấu trúc tiếng Anh *" className="field" />
          <input required value={form.vietnamese} onChange={e => setForm({ ...form, vietnamese: e.target.value })} placeholder="Nghĩa tiếng Việt *" className="field" />
          <input value={form.example} onChange={e => setForm({ ...form, example: e.target.value })} placeholder="Ví dụ (không bắt buộc)" className="field" />
          <input value={form.topic} onChange={e => setForm({ ...form, topic: e.target.value })} placeholder="Chủ đề (không bắt buộc)" className="field" />
        </div>
        <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Ghi chú (không bắt buộc)" rows={2} className="field resize-y" />
        {error && <p className="text-rose-300 text-sm animate-fade-in">{error}</p>}
        <button className="vm-btn vm-btn-primary flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"><Plus size={16} /> {editingId ? 'Lưu thay đổi' : 'Thêm cấu trúc'}</button>
      </form>

      <div className="relative"><Search size={16} className="absolute left-3 top-3 text-slate-400 pointer-events-none" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm cấu trúc, nghĩa, ví dụ, ghi chú…" className="field pl-9" /></div>
      {filtered.length === 0 ? <div className="text-center py-10 text-slate-400">{structures.length ? 'Không tìm thấy cấu trúc phù hợp.' : 'Chưa có cấu trúc nào. Hãy thêm cấu trúc đầu tiên.'}</div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filtered.map(item => <article key={item.id} className="vm-card vm-card-interactive rounded-2xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-3"><div><h3 className="text-white font-bold tracking-tight">{item.english}</h3><p className="text-indigo-300 text-sm mt-1">{item.vietnamese}</p></div><LevelPill level={item.level} /></div>
            {item.topic && <span className="inline-block text-xs text-slate-300 bg-slate-800/80 border border-slate-400/15 rounded-lg px-2.5 py-1">{item.topic}</span>}
            {item.example && <p className="text-slate-200 text-sm italic border-l-2 border-indigo-400/40 pl-3">{item.example}</p>}
            {item.notes && <p className="text-slate-300 text-xs leading-relaxed">{item.notes}</p>}
            <div className="flex items-center justify-between pt-1"><span className="text-xs text-slate-400">{item.totalReviews || 0} lần ôn{item.wrongCount ? ` · sai ${item.wrongCount}` : ''}</span><div className="flex gap-1"><button onClick={() => startEdit(item)} className="vm-btn p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800" title="Sửa"><Edit3 size={14} /></button><button onClick={() => { if (window.confirm('Xóa cấu trúc này?')) onDelete(item.id); }} className="vm-btn p-2 rounded-lg text-slate-300 hover:text-rose-300 hover:bg-rose-500/15" title="Xóa"><Trash2 size={14} /></button></div></div>
          </article>)}
        </div>
      )}
    </div>
  );
}
