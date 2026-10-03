import { useState, useRef } from 'react';
import {
  Plus, Trash2, Pencil, Volume2, Download, Upload, X, Check,
  BookOpen, AlertCircle, Image as ImageIcon, CheckSquare, Square,
  ChevronDown, Tag, Layers, Search,
} from 'lucide-react';
import { playAudio } from '../utils/audio';
import { isDueForReview } from '../hooks/useVocabStore';

/* ------------------------------------------------------------------ */
/* Constants                                                            */
/* ------------------------------------------------------------------ */
const LEVEL_COLORS = {
  1: { badge: 'bg-rose-500/20    text-rose-400    border-rose-500/30',    dot: 'bg-rose-400',    label: 'New'       },
  2: { badge: 'bg-orange-500/20  text-orange-400  border-orange-500/30',  dot: 'bg-orange-400',  label: 'Familiar'  },
  3: { badge: 'bg-amber-500/20   text-amber-400   border-amber-500/30',   dot: 'bg-amber-400',   label: 'Learning'  },
  4: { badge: 'bg-teal-500/20    text-teal-400    border-teal-500/30',    dot: 'bg-teal-400',    label: 'Proficient'},
  5: { badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-400', label: 'Mastered'  },
};

const WORD_TYPES = [
  { value: 'Word',   label: 'Từ đơn (Word)'      },
  { value: 'Phrase', label: 'Cụm từ (Phrase)'     },
  { value: 'Family', label: 'Gia đình từ (Family)'},
];

const TYPE_META = {
  Word:   { color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',  icon: '📝' },
  Phrase: { color: 'bg-purple-500/20 text-purple-300 border-purple-500/30',  icon: '💬' },
  Family: { color: 'bg-sky-500/20    text-sky-300    border-sky-500/30',     icon: '🌳' },
};

/* ------------------------------------------------------------------ */
/* WordCard                                                             */
/* ------------------------------------------------------------------ */
function WordCard({ word, onDelete, onUpdate, selected, onToggleSelect }) {
  const [editing,    setEditing]    = useState(false);
  const [editFields, setEditFields] = useState({
    english:    word.english,
    vietnamese: word.vietnamese,
    imageUrl:   word.imageUrl || '',
    wordType:   word.wordType || 'Word',
  });
  const [imgError, setImgError] = useState(false);

  const level    = LEVEL_COLORS[word.level] || LEVEL_COLORS[1];
  const typeMeta = TYPE_META[word.wordType] || TYPE_META.Word;
  const streak   = word.currentStreak ?? 0;
  const isDue    = isDueForReview(word);

  function speak() {
    playAudio(word.english);
  }

  function saveEdit() {
    if (!editFields.english.trim() || !editFields.vietnamese.trim()) return;
    onUpdate(word.id, {
      english:    editFields.english.trim(),
      vietnamese: editFields.vietnamese.trim(),
      imageUrl:   editFields.imageUrl.trim(),
      wordType:   editFields.wordType,
    });
    setEditing(false);
    setImgError(false);
  }

  function cancelEdit() {
    setEditFields({
      english:    word.english,
      vietnamese: word.vietnamese,
      imageUrl:   word.imageUrl || '',
      wordType:   word.wordType || 'Word',
    });
    setEditing(false);
  }

  return (
    <div className={`bg-slate-800/60 border rounded-2xl overflow-hidden shadow-lg hover:shadow-indigo-500/5 transition-all duration-200 group animate-fade-in ${
      selected ? 'border-indigo-500 ring-2 ring-indigo-500/30' : 'border-slate-700/50 hover:border-slate-600'
    }`}>
      {/* Select checkbox row */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <button
          id={`select-${word.id}`}
          onClick={() => onToggleSelect(word.id)}
          className="text-slate-500 hover:text-indigo-400 transition-colors"
          title={selected ? 'Deselect' : 'Select'}
        >
          {selected ? <CheckSquare size={16} className="text-indigo-400" /> : <Square size={16} />}
        </button>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${typeMeta.color}`}>
          {typeMeta.icon} {word.wordType || 'Word'}
        </span>
      </div>

      {/* Image */}
      {word.imageUrl && !imgError ? (
        <div className="relative w-full h-32 bg-slate-900">
          <img
            src={word.imageUrl}
            alt={word.english}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-800/60 to-transparent" />
        </div>
      ) : word.imageUrl && imgError ? (
        <div className="w-full h-20 bg-slate-900/50 flex items-center justify-center">
          <div className="flex flex-col items-center gap-1">
            <ImageIcon size={20} className="text-slate-600" />
            <span className="text-slate-600 text-xs">Image unavailable</span>
          </div>
        </div>
      ) : null}

      <div className="p-4 pt-2">
        {editing ? (
          <div className="space-y-2">
            <input
              id={`edit-english-${word.id}`}
              value={editFields.english}
              onChange={e => setEditFields(f => ({ ...f, english: e.target.value }))}
              placeholder="English word"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
            />
            <input
              id={`edit-vietnamese-${word.id}`}
              value={editFields.vietnamese}
              onChange={e => setEditFields(f => ({ ...f, vietnamese: e.target.value }))}
              placeholder="Vietnamese meaning"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
            />
            <input
              id={`edit-imageurl-${word.id}`}
              value={editFields.imageUrl}
              onChange={e => setEditFields(f => ({ ...f, imageUrl: e.target.value }))}
              placeholder="Image URL (optional)"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
            />
            <select
              id={`edit-type-${word.id}`}
              value={editFields.wordType}
              onChange={e => setEditFields(f => ({ ...f, wordType: e.target.value }))}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
            >
              {WORD_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <div className="flex gap-2 pt-1">
              <button
                id={`save-edit-${word.id}`}
                onClick={saveEdit}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-colors"
              >
                <Check size={12} /> Save
              </button>
              <button
                id={`cancel-edit-${word.id}`}
                onClick={cancelEdit}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-medium transition-colors"
              >
                <X size={12} /> Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-2 mb-1">
              <h3 className="text-white font-bold text-lg leading-tight">{word.english}</h3>
              <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium border ${level.badge}`}>
                L{word.level} {level.label}
              </span>
            </div>
            <p className="text-slate-400 text-sm mb-1">{word.vietnamese}</p>
            {/* Streak + Due indicator */}
            <p className="text-slate-600 text-xs mb-3 flex items-center gap-2 flex-wrap">
              <span>🔥 Streak: <span className="text-slate-400 font-medium">{streak}</span></span>
              {isDue && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  ⏰ Due
                </span>
              )}
            </p>

            <div className="flex items-center gap-1">
              <button
                id={`speak-${word.id}`}
                onClick={speak}
                title="Pronounce"
                className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 rounded-lg text-xs font-medium transition-colors"
              >
                <Volume2 size={13} /> Speak
              </button>
              <button
                id={`edit-${word.id}`}
                onClick={() => setEditing(true)}
                title="Edit"
                className="flex items-center justify-center p-1.5 bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                <Pencil size={13} />
              </button>
              <button
                id={`delete-${word.id}`}
                onClick={() => onDelete(word.id)}
                title="Delete"
                className="flex items-center justify-center p-1.5 bg-slate-700 hover:bg-rose-600 text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main Vocabulary Component                                           */
/* ------------------------------------------------------------------ */
export default function Vocabulary({
  words, addWord, deleteWord, updateWord, bulkUpdateLevel,
  vocabFilter, setVocabFilter,
}) {
  const [english,     setEnglish]     = useState('');
  const [vietnamese,  setVietnamese]  = useState('');
  const [imageUrl,    setImageUrl]    = useState('');
  const [wordType,    setWordType]    = useState('Word');
  const [error,       setError]       = useState('');
  const [success,     setSuccess]     = useState('');
  const [typeFilter,  setTypeFilter]  = useState('All'); // All | Word | Phrase | Family
  const [selected,    setSelected]    = useState(new Set());
  const [bulkLevel,   setBulkLevel]   = useState('');
  const [showBulkDd,  setShowBulkDd]  = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef(null);

  // Apply level filter, then type filter, then search query
  const afterLevel = vocabFilter ? words.filter(w => w.level === vocabFilter) : words;
  const afterType  = typeFilter === 'All'
    ? afterLevel
    : afterLevel.filter(w => (w.wordType || 'Word') === typeFilter);
  const filtered   = searchQuery.trim()
    ? afterType.filter(w => {
        const q = searchQuery.trim().toLowerCase();
        return w.english.toLowerCase().includes(q) || w.vietnamese.toLowerCase().includes(q);
      })
    : afterType;

  /* ── Selection helpers ── */
  function toggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === filtered.length && filtered.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(w => w.id)));
    }
  }

  function handleBulkChangeLevel(level) {
    if (!level) return;
    bulkUpdateLevel(selected, Number(level));
    setSelected(new Set());
    setBulkLevel('');
    setShowBulkDd(false);
    setSuccess(`Updated ${selected.size} word(s) to L${level}!`);
    setTimeout(() => setSuccess(''), 2000);
  }

  /* ── Add word ── */
  function handleAdd(e) {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!english.trim() || !vietnamese.trim()) {
      setError('English word and Vietnamese meaning are required.');
      return;
    }
    const ok = addWord({ english, vietnamese, imageUrl, wordType });
    if (!ok) {
      setError(`"${english.trim()}" already exists in your vocabulary.`);
      return;
    }
    setEnglish(''); setVietnamese(''); setImageUrl(''); setWordType('Word');
    setSuccess('Word added successfully!');
    setTimeout(() => setSuccess(''), 2000);
  }

  /* ── Export / Import ── */
  function handleExport() {
    const blob = new Blob([JSON.stringify(words, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'vocabmaster-words.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!Array.isArray(data)) throw new Error('Invalid format');
        data.forEach(w => {
          if (!w.english || !w.vietnamese) throw new Error('Missing fields');
          if (!w.id)            w.id            = Date.now().toString() + Math.random();
          if (!w.level)         w.level         = 1;
          if (!w.wordType)      w.wordType      = 'Word';
          if (w.currentStreak == null) w.currentStreak = 0;
        });
        const existingEnglish = new Set(words.map(w => w.english.toLowerCase()));
        const newWords = data.filter(w => !existingEnglish.has(w.english.toLowerCase()));
        newWords.forEach(w => addWord(w));
        setSuccess(`Imported ${newWords.length} new word(s)!`);
        setTimeout(() => setSuccess(''), 3000);
      } catch {
        setError('Invalid JSON file. Make sure you are importing a VocabMaster export.');
        setTimeout(() => setError(''), 3000);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  /* ── Filter options ── */
  const levelFilterOptions = [
    { value: null, label: 'All Levels' },
    { value: 1,    label: 'L1 New' },
    { value: 2,    label: 'L2 Familiar' },
    { value: 3,    label: 'L3 Learning' },
    { value: 4,    label: 'L4 Proficient' },
    { value: 5,    label: 'L5 Mastered' },
  ];

  const typeFilterOptions = [
    { value: 'All',    label: 'All Types',              icon: '🔤' },
    { value: 'Word',   label: 'Từ đơn (Word)',          icon: '📝' },
    { value: 'Phrase', label: 'Cụm từ (Phrase)',        icon: '💬' },
    { value: 'Family', label: 'Gia đình từ (Family)',   icon: '🌳' },
  ];

  const allSelected = filtered.length > 0 && selected.size === filtered.length;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Vocabulary</h1>
          <p className="text-slate-400">{words.length} word{words.length !== 1 ? 's' : ''} in your collection</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImport}
            id="import-file-input"
          />
          <button
            id="import-btn"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm font-medium transition-colors border border-slate-600"
          >
            <Upload size={15} /> Import
          </button>
          <button
            id="export-btn"
            onClick={handleExport}
            disabled={words.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-colors"
          >
            <Download size={15} /> Export
          </button>
        </div>
      </div>

      {/* Add Word Form */}
      <form
        onSubmit={handleAdd}
        id="add-word-form"
        className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5 mb-6"
      >
        <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
          <Plus size={18} className="text-indigo-400" /> Add New Word
        </h2>
        {error && (
          <div className="flex items-center gap-2 text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3 mb-3 text-sm">
            <AlertCircle size={15} /> {error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 mb-3 text-sm">
            <Check size={15} /> {success}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <input
            id="input-english"
            value={english}
            onChange={e => setEnglish(e.target.value)}
            placeholder="English word / phrase *"
            className="bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors"
          />
          <input
            id="input-vietnamese"
            value={vietnamese}
            onChange={e => setVietnamese(e.target.value)}
            placeholder="Nghĩa tiếng Việt *"
            className="bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors"
          />
          <input
            id="input-image-url"
            value={imageUrl}
            onChange={e => setImageUrl(e.target.value)}
            placeholder="Image URL (optional)"
            className="bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors"
          />
          <select
            id="input-word-type"
            value={wordType}
            onChange={e => setWordType(e.target.value)}
            className="bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
          >
            {WORD_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <button
          id="add-word-btn"
          type="submit"
          className="mt-3 flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-indigo-500/20"
        >
          <Plus size={16} /> Add Word
        </button>
      </form>

      {/* Search Bar */}
      <div className="relative mb-4">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
        <input
          id="vocab-search"
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search by English word or Vietnamese meaning…"
          autoComplete="off"
          spellCheck={false}
          className="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl pl-10 pr-10 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
        />
        {searchQuery && (
          <button
            id="vocab-search-clear"
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
            title="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Level Filter Pills */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {levelFilterOptions.map(opt => (
          <button
            key={String(opt.value)}
            id={`filter-level-${opt.value ?? 'all'}`}
            onClick={() => setVocabFilter(opt.value)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
              vocabFilter === opt.value
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white border border-slate-700'
            }`}
          >
            {opt.label}
            <span className="ml-1.5 text-xs opacity-70">
              ({opt.value === null ? words.length : words.filter(w => w.level === opt.value).length})
            </span>
          </button>
        ))}
      </div>

      {/* Type Filter Sub-Tabs */}
      <div className="flex items-center gap-1 mb-5 bg-slate-800/40 border border-slate-700/40 rounded-xl p-1 w-fit">
        {typeFilterOptions.map(opt => (
          <button
            key={opt.value}
            id={`filter-type-${opt.value.toLowerCase()}`}
            onClick={() => setTypeFilter(opt.value)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
              typeFilter === opt.value
                ? 'bg-slate-700 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>{opt.icon}</span>
            <span className="hidden sm:inline">{opt.label.split('(')[0].trim()}</span>
            <span className="text-xs opacity-60">
              ({opt.value === 'All'
                ? afterLevel.length
                : afterLevel.filter(w => (w.wordType || 'Word') === opt.value).length})
            </span>
          </button>
        ))}
      </div>

      {/* Bulk Action Bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-4 px-4 py-3 bg-indigo-600/10 border border-indigo-500/30 rounded-xl animate-fade-in">
          <Layers size={16} className="text-indigo-400 shrink-0" />
          <span className="text-indigo-300 text-sm font-medium">
            {selected.size} word{selected.size !== 1 ? 's' : ''} selected
          </span>
          <div className="relative ml-auto">
            <button
              id="bulk-level-btn"
              onClick={() => setShowBulkDd(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-colors"
            >
              Change Level <ChevronDown size={13} />
            </button>
            {showBulkDd && (
              <div className="absolute right-0 top-full mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-20 overflow-hidden min-w-[140px]">
                {[1, 2, 3, 4, 5].map(l => (
                  <button
                    key={l}
                    id={`bulk-set-level-${l}`}
                    onClick={() => handleBulkChangeLevel(l)}
                    className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                  >
                    L{l} — {LEVEL_COLORS[l].label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            id="bulk-clear-btn"
            onClick={() => setSelected(new Set())}
            className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-xs font-medium transition-colors"
          >
            <X size={13} /> Clear
          </button>
        </div>
      )}

      {/* Select-All row */}
      {filtered.length > 0 && (
        <div className="flex items-center gap-2 mb-3 px-1">
          <button
            id="select-all-btn"
            onClick={toggleSelectAll}
            className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors"
          >
            {allSelected
              ? <CheckSquare size={16} className="text-indigo-400" />
              : <Square size={16} />
            }
            {allSelected ? 'Deselect All' : 'Select All'}
          </button>
          <span className="text-slate-600 text-xs">({filtered.length} shown)</span>
        </div>
      )}

      {/* Word Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <BookOpen size={56} className="text-slate-700 mx-auto mb-4" />
          <p className="text-slate-400 font-medium text-lg">
            {vocabFilter || typeFilter !== 'All' || searchQuery
              ? 'No words match this filter'
              : 'No words yet'}
          </p>
          <p className="text-slate-500 text-sm mt-2">
            {vocabFilter || typeFilter !== 'All' || searchQuery
              ? 'Try a different filter or search term.'
              : 'Add your first word using the form above!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(word => (
            <WordCard
              key={word.id}
              word={word}
              onDelete={deleteWord}
              onUpdate={updateWord}
              selected={selected.has(word.id)}
              onToggleSelect={toggleSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}
