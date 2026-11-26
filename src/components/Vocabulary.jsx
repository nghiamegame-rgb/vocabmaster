import { memo, useCallback, useMemo, useState, useRef } from 'react';
import {
  Plus, Trash2, Pencil, Volume2, Download, Upload, X, Check,
  BookOpen, AlertCircle, Image as ImageIcon, CheckSquare, Square,
  ChevronDown, ChevronLeft, ChevronRight, Tag, Layers, Search, Star,
} from 'lucide-react';
import { playAudio } from '../utils/audio';
import { isDueForReview } from '../hooks/useVocabStore';
import { normalizeWordInput } from '../utils/vocabWord';

/* ------------------------------------------------------------------ */
/* Constants                                                            */
/* ------------------------------------------------------------------ */
const LEVEL_COLORS = {
  1: { badge: 'bg-[var(--sb-berry-soft)]  text-[var(--sb-berry-text)]  border-[var(--sb-berry)]',  dot: 'bg-[var(--sb-berry)]',  label: 'New'       },
  2: { badge: 'bg-[var(--sb-clay-soft)]   text-[var(--sb-clay-text)]   border-[var(--sb-clay)]',   dot: 'bg-[var(--sb-clay)]',   label: 'Familiar'  },
  3: { badge: 'bg-[var(--sb-ochre-soft)]  text-[var(--sb-ochre-text)]  border-[var(--sb-ochre)]',  dot: 'bg-[var(--sb-ochre)]',  label: 'Learning'  },
  4: { badge: 'bg-[var(--sb-lagoon-soft)] text-[var(--sb-lagoon-text)] border-[var(--sb-lagoon)]', dot: 'bg-[var(--sb-lagoon)]', label: 'Proficient'},
  5: { badge: 'bg-[var(--sb-forest-soft)] text-[var(--sb-forest-text)] border-[var(--sb-forest)]', dot: 'bg-[var(--sb-forest)]', label: 'Mastered'  },
};

const WORD_TYPES = [
  { value: 'Word',   label: 'Từ đơn (Word)'      },
  { value: 'Phrase', label: 'Cụm từ (Phrase)'     },
  { value: 'Family', label: 'Gia đình từ (Family)'},
  { value: 'Preposition', label: 'Giới từ (Preposition)' },
];

const TYPE_META = {
  Word:        { color: 'bg-[var(--sb-terracotta-soft)] text-[var(--sb-terracotta-text)] border-[var(--sb-terracotta)]', icon: '📝' },
  Phrase:      { color: 'bg-[var(--sb-plum-soft)]       text-[var(--sb-plum-text)]       border-[var(--sb-plum)]',       icon: '💬' },
  Family:      { color: 'bg-[var(--sb-sky-soft)]        text-[var(--sb-sky-text)]        border-[var(--sb-sky)]',        icon: '🌳' },
  Preposition: { color: 'bg-[var(--sb-lagoon-soft)]     text-[var(--sb-lagoon-text)]     border-[var(--sb-lagoon)]',     icon: '🔗' },
};

const PAGE_SIZE = 24;

function Pagination({ page, pageCount, onChange, position }) {
  return (
    <nav aria-label={`Vocabulary pages (${position})`} className="flex items-center justify-end gap-2 text-sm">
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        aria-label="Previous page"
        className="vm-btn p-2 bg-[var(--sb-paper-card)] border-2 border-[var(--sb-ink)] text-[var(--sb-ink)] rounded-xl disabled:opacity-45 disabled:cursor-not-allowed hover:bg-[var(--sb-paper-deep)] shadow-[var(--sb-shadow-sm)]"
      >
        <ChevronLeft size={16} />
      </button>
      <label className="flex items-center gap-2 text-[var(--sb-ink-soft)] font-semibold">
        Page
        <select
          aria-label="Vocabulary page"
          value={page}
          onChange={e => onChange(Number(e.target.value))}
          className="vm-input rounded-xl px-2.5 py-1.5 text-[var(--sb-ink)] font-bold"
        >
          {Array.from({ length: pageCount }, (_, i) => (
            <option key={i + 1} value={i + 1}>{i + 1}</option>
          ))}
        </select>
        / {pageCount}
      </label>
      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page === pageCount}
        aria-label="Next page"
        className="vm-btn p-2 bg-[var(--sb-paper-card)] border-2 border-[var(--sb-ink)] text-[var(--sb-ink)] rounded-xl disabled:opacity-45 disabled:cursor-not-allowed hover:bg-[var(--sb-paper-deep)] shadow-[var(--sb-shadow-sm)]"
      >
        <ChevronRight size={16} />
      </button>
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* WordCard                                                             */
/* ------------------------------------------------------------------ */
const WordCard = memo(function WordCard({ word, onDelete, onUpdate, onToggleHard, selected, onToggleSelect }) {
  const [editing,    setEditing]    = useState(false);
  const [editFields, setEditFields] = useState({
    english:    word.english,
    annotation: word.annotation || '',
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
    // TTS reads only the clean english word, not the annotation
    playAudio(word.english);
  }

  async function saveEdit() {
    if (!editFields.english.trim() || !editFields.vietnamese.trim()) return;
    const saved = await onUpdate(word.id, {
      english:    editFields.english.trim(),
      annotation: editFields.annotation.trim(),
      vietnamese: editFields.vietnamese.trim(),
      imageUrl:   editFields.imageUrl.trim(),
      wordType:   editFields.wordType,
    });
    if (saved !== false) setEditing(false);
    setImgError(false);
  }

  function cancelEdit() {
    setEditFields({
      english:    word.english,
      annotation: word.annotation || '',
      vietnamese: word.vietnamese,
      imageUrl:   word.imageUrl || '',
      wordType:   word.wordType || 'Word',
    });
    setEditing(false);
  }

  return (
    <div className={`vm-card vm-card-interactive rounded-2xl overflow-hidden group animate-fade-in ${
      selected
        ? 'border-[var(--sb-terracotta-strong)] ring-2 ring-[var(--sb-terracotta)]/40'
        : word.hardMarked
          ? 'border-[var(--sb-ochre-text)]'
          : ''
    }`}>
      {/* Select checkbox + difficult-word star row */}
      <div className="flex items-center justify-between px-4 pt-3.5 pb-1">
        <div className="flex items-center gap-1.5">
          <button
            id={`select-${word.id}`}
            type="button"
            onClick={() => onToggleSelect(word.id)}
            className="vm-btn p-1 rounded-lg text-[var(--sb-ink-soft)] hover:text-[var(--sb-terracotta-text)] hover:bg-[var(--sb-paper-deep)]"
            title={selected ? 'Deselect' : 'Select'}
          >
            {selected ? <CheckSquare size={16} className="text-[var(--sb-terracotta-strong)]" /> : <Square size={16} />}
          </button>
          <button
            id={`star-${word.id}`}
            type="button"
            onClick={e => {
              e.stopPropagation();
              onToggleHard?.(word.id);
            }}
            aria-label={word.hardMarked ? 'Bỏ đánh dấu từ khó' : 'Đánh dấu từ khó'}
            aria-pressed={Boolean(word.hardMarked)}
            title={word.hardMarked ? 'Bỏ đánh dấu từ khó' : 'Đánh dấu từ khó'}
            className={`vm-btn p-1 rounded-lg ${
              word.hardMarked
                ? 'text-[var(--sb-ochre-text)] bg-[var(--sb-ochre-soft)] hover:bg-[var(--sb-ochre)]/30'
                : 'text-[var(--sb-ink-soft)] hover:text-[var(--sb-ochre-text)] hover:bg-[var(--sb-paper-deep)]'
            }`}
          >
            <Star size={15} className={word.hardMarked ? 'fill-[var(--sb-ochre)] text-[var(--sb-ochre-text)]' : ''} />
          </button>
        </div>
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${typeMeta.color}`}>
          {typeMeta.icon} {word.wordType || 'Word'}
        </span>
      </div>

      {/* Image */}
      {word.imageUrl && !imgError ? (
        <div className="relative w-full h-32 bg-[var(--sb-paper-deep)] border-y border-[var(--sb-ink-faint)]">
          <img
            src={word.imageUrl}
            alt={word.english}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--sb-ink)]/30 to-transparent" />
        </div>
      ) : word.imageUrl && imgError ? (
        <div className="w-full h-20 bg-[var(--sb-paper-deep)] border-y border-[var(--sb-ink-faint)] flex items-center justify-center">
          <div className="flex flex-col items-center gap-1">
            <ImageIcon size={20} className="text-[var(--sb-ink-soft)]" />
            <span className="text-[var(--sb-ink-soft)] text-xs font-medium">Image unavailable</span>
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
              className="w-full vm-input rounded-lg px-3 py-2 text-sm font-semibold"
            />
            <input
              id={`edit-annotation-${word.id}`}
              value={editFields.annotation}
              onChange={e => setEditFields(f => ({ ...f, annotation: e.target.value }))}
              placeholder="Từ loại / Ghi chú (adj, v - n, adv…)"
              className="w-full vm-input rounded-lg px-3 py-2 text-xs"
            />
            <input
              id={`edit-vietnamese-${word.id}`}
              value={editFields.vietnamese}
              onChange={e => setEditFields(f => ({ ...f, vietnamese: e.target.value }))}
              placeholder="Vietnamese meaning"
              className="w-full vm-input rounded-lg px-3 py-2 text-sm"
            />
            <input
              id={`edit-imageurl-${word.id}`}
              value={editFields.imageUrl}
              onChange={e => setEditFields(f => ({ ...f, imageUrl: e.target.value }))}
              placeholder="Image URL (optional)"
              className="w-full vm-input rounded-lg px-3 py-2 text-sm"
            />
            <select
              id={`edit-type-${word.id}`}
              value={editFields.wordType}
              onChange={e => setEditFields(f => ({ ...f, wordType: e.target.value }))}
              className="w-full vm-input rounded-lg px-3 py-2 text-sm"
            >
              {WORD_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <div className="flex gap-2 pt-1">
              <button
                id={`save-edit-${word.id}`}
                onClick={saveEdit}
                className="vm-btn vm-btn-primary flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-bold"
              >
                <Check size={12} /> Save
              </button>
              <button
                id={`cancel-edit-${word.id}`}
                onClick={cancelEdit}
                className="vm-btn flex-1 flex items-center justify-center gap-1 py-1.5 bg-[var(--sb-paper-warm)] hover:bg-[var(--sb-paper-deep)] border-2 border-[var(--sb-ink)] text-[var(--sb-ink)] rounded-lg text-xs font-bold"
              >
                <X size={12} /> Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="flex-1 min-w-0">
                <h3 className="sb-font-display text-[var(--sb-ink)] font-bold text-lg leading-tight tracking-tight">{word.english}</h3>
                {word.annotation && (
                  <span className="text-[var(--sb-ink-soft)] text-xs font-semibold">({word.annotation})</span>
                )}
              </div>
              <span className={`shrink-0 px-2.5 py-0.5 rounded-full text-xs font-bold border ${level.badge}`}>
                L{word.level} {level.label}
              </span>
            </div>
            <p className="text-[var(--sb-ink-soft)] font-medium text-sm mb-1.5 leading-snug">{word.vietnamese}</p>
            {/* Streak + Due indicator */}
            <p className="text-[var(--sb-ink-soft)] text-xs mb-3.5 flex items-center gap-2 flex-wrap">
              <span>🔥 Streak: <span className="text-[var(--sb-ink)] font-bold tabular-nums">{streak}</span></span>
              {isDue && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[var(--sb-ochre-soft)] text-[var(--sb-ochre-text)] border border-[var(--sb-ochre-text)]/40">
                  ⏰ Due
                </span>
              )}
            </p>

            <div className="flex items-center gap-1.5">
              <button
                id={`speak-${word.id}`}
                onClick={speak}
                title="Pronounce"
                className="vm-btn flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-[var(--sb-terracotta-soft)] hover:bg-[var(--sb-terracotta-strong)] border-2 border-[var(--sb-ink)] text-[var(--sb-terracotta-text)] hover:text-white rounded-xl text-xs font-bold"
              >
                <Volume2 size={13} /> Speak
              </button>
              <button
                id={`edit-${word.id}`}
                onClick={() => setEditing(true)}
                title="Edit"
                className="vm-btn flex items-center justify-center p-2 bg-[var(--sb-paper-warm)] hover:bg-[var(--sb-paper-deep)] border-2 border-[var(--sb-ink)] text-[var(--sb-ink)] rounded-xl"
              >
                <Pencil size={13} />
              </button>
              <button
                id={`delete-${word.id}`}
                onClick={() => onDelete(word.id)}
                title="Delete"
                className="vm-btn flex items-center justify-center p-2 bg-[var(--sb-paper-warm)] hover:bg-[var(--sb-berry-btn)] border-2 border-[var(--sb-ink)] text-[var(--sb-berry-text)] hover:text-white rounded-xl"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
});

/* ------------------------------------------------------------------ */
/* Main Vocabulary Component                                           */
/* ------------------------------------------------------------------ */
export default memo(function Vocabulary({
  words, addWord, deleteWord, updateWord, toggleWordHard, bulkUpdateLevel,
  vocabFilter, setVocabFilter,
}) {
  const [english,     setEnglish]     = useState('');
  const [annotation,  setAnnotation]  = useState('');
  const [vietnamese,  setVietnamese]  = useState('');
  const [imageUrl,    setImageUrl]    = useState('');
  const [wordType,    setWordType]    = useState('Word');
  const [error,       setError]       = useState('');
  const [success,     setSuccess]     = useState('');
  const [typeFilter,  setTypeFilter]  = useState('All'); // All | Word | Phrase | Family | Preposition
  const [hardOnly,    setHardOnly]    = useState(false);
  const [selected,    setSelected]    = useState(new Set());
  const [bulkLevel,   setBulkLevel]   = useState('');
  const [showBulkDd,  setShowBulkDd]  = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const fileInputRef = useRef(null);
  const listRef = useRef(null);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const poolForLevelCounts = useMemo(() => {
    return words.filter(w =>
      (!hardOnly || Boolean(w.hardMarked)) &&
      (typeFilter === 'All' || (w.wordType || 'Word') === typeFilter) &&
      (!normalizedQuery || (
        w.english.toLowerCase().includes(normalizedQuery) ||
        w.vietnamese.toLowerCase().includes(normalizedQuery) ||
        (w.annotation || '').toLowerCase().includes(normalizedQuery)
      )),
    );
  }, [words, hardOnly, typeFilter, normalizedQuery]);

  const levelCounts = useMemo(() => {
    const counts = {};
    for (const word of poolForLevelCounts) counts[word.level] = (counts[word.level] || 0) + 1;
    return counts;
  }, [poolForLevelCounts]);

  const afterLevel = useMemo(
    () => vocabFilter ? words.filter(w => w.level === vocabFilter) : words,
    [words, vocabFilter],
  );

  const poolForTypeCounts = useMemo(() => {
    return afterLevel.filter(w =>
      (!hardOnly || Boolean(w.hardMarked)) &&
      (!normalizedQuery || (
        w.english.toLowerCase().includes(normalizedQuery) ||
        w.vietnamese.toLowerCase().includes(normalizedQuery) ||
        (w.annotation || '').toLowerCase().includes(normalizedQuery)
      )),
    );
  }, [afterLevel, hardOnly, normalizedQuery]);

  const typeCounts = useMemo(() => {
    const counts = {};
    for (const word of poolForTypeCounts) {
      const type = word.wordType || 'Word';
      counts[type] = (counts[type] || 0) + 1;
    }
    return counts;
  }, [poolForTypeCounts]);

  const hardCount = useMemo(() => {
    return afterLevel.filter(w =>
      Boolean(w.hardMarked) &&
      (typeFilter === 'All' || (w.wordType || 'Word') === typeFilter) &&
      (!normalizedQuery || (
        w.english.toLowerCase().includes(normalizedQuery) ||
        w.vietnamese.toLowerCase().includes(normalizedQuery) ||
        (w.annotation || '').toLowerCase().includes(normalizedQuery)
      )),
    ).length;
  }, [afterLevel, typeFilter, normalizedQuery]);

  // Filtering and select-all cover the entire collection, before pagination.
  const filtered = useMemo(() => {
    return poolForTypeCounts.filter(w =>
      typeFilter === 'All' || (w.wordType || 'Word') === typeFilter,
    );
  }, [poolForTypeCounts, typeFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  // Deleting or moving the last word on a page must not leave an empty page.
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const visibleWords = filtered.slice(pageStart, pageStart + PAGE_SIZE);
  const allSelected = filtered.length > 0 && filtered.every(w => selected.has(w.id));

  function changePage(nextPage) {
    setPage(Math.max(1, Math.min(nextPage, pageCount)));
    listRef.current?.scrollIntoView({ block: 'start' });
  }

  /* ── Selection helpers ── */
  const toggleSelect = useCallback((id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  function toggleSelectAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(w => w.id)));
    }
  }

  async function handleBulkChangeLevel(level) {
    if (!level) return;
    if (!await bulkUpdateLevel(selected, Number(level))) return;
    setSelected(new Set());
    setBulkLevel('');
    setShowBulkDd(false);
    setSuccess(`Updated ${selected.size} word(s) to L${level}!`);
    setTimeout(() => setSuccess(''), 2000);
  }

  /* ── Add word ── */
  async function handleAdd(e) {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!english.trim() || !vietnamese.trim()) {
      setError('English word and Vietnamese meaning are required.');
      return;
    }
    const ok = await addWord({ english, annotation, vietnamese, imageUrl, wordType });
    if (!ok) {
      setError('Chưa thêm được từ: từ đã có hoặc chưa lưu được. Xem thông báo Vocabulary và thử Sync; nội dung nhập vẫn được giữ.');
      return;
    }
    setEnglish(''); setAnnotation(''); setVietnamese(''); setImageUrl(''); setWordType('Word');
    setPage(1);
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
    reader.onload = async ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!Array.isArray(data)) throw new Error('Invalid format');
        // Normalise to the backend constraints (level 1–5, string fields, streak ≥ 0).
        const normalized = data.map(w => {
          const result = normalizeWordInput(w);
          if (!result || !result.word.vietnamese) throw new Error('Missing fields');
          return result;
        });
        const existingEnglish = new Set(words.map(w => w.english.toLowerCase()));
        const fresh = normalized.filter(({ word }) => !existingEnglish.has(word.english.toLowerCase()));
        let added = 0, adjustedCount = 0;
        for (const { word, adjusted } of fresh) {
          if (await addWord(word)) {
            added++;
            if (adjusted.length) adjustedCount++;
          }
        }
        if (added !== fresh.length) setError('Một số từ chưa lưu được. Xem thông báo Vocabulary và thử lại.');
        setSuccess(`Imported ${added} new word(s)!` + (adjustedCount
          ? ` Đã chỉnh ${adjustedCount} mục có giá trị không hợp lệ về giá trị hợp lệ gần nhất.` : ''));
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
    { value: 'Preposition', label: 'Giới từ (Preposition)', icon: '🔗' },
  ];

  return (
    <div className="vm-page-enter">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="sb-font-display text-3xl font-extrabold tracking-tight text-[var(--sb-ink)] mb-1">Vocabulary</h1>
          <p className="text-[var(--sb-ink-soft)] font-semibold text-sm sm:text-base">{words.length} word{words.length !== 1 ? 's' : ''} in your collection</p>
        </div>
        <div className="flex items-center gap-2.5">
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
            className="vm-btn flex items-center gap-2 px-4 py-2 bg-[var(--sb-paper-card)] hover:bg-[var(--sb-paper-deep)] text-[var(--sb-ink)] rounded-xl text-sm font-bold border-2 border-[var(--sb-ink)] shadow-[var(--sb-shadow-sm)]"
          >
            <Upload size={15} /> Import
          </button>
          <button
            id="export-btn"
            onClick={handleExport}
            disabled={words.length === 0}
            className="vm-btn vm-btn-primary flex items-center gap-2 px-4 py-2 disabled:opacity-45 disabled:cursor-not-allowed rounded-xl text-sm font-bold"
          >
            <Download size={15} /> Export
          </button>
        </div>
      </div>

      {/* Add Word Form */}
      <form
        onSubmit={handleAdd}
        id="add-word-form"
        className="vm-panel rounded-2xl p-5 mb-6"
      >
        <h2 className="sb-font-display text-[var(--sb-ink)] font-bold mb-4 flex items-center gap-2">
          <Plus size={18} className="text-[var(--sb-terracotta-strong)]" /> Add New Word
        </h2>
        {error && (
          <div role="alert" className="flex items-center gap-2 text-[var(--sb-berry-text)] bg-[var(--sb-berry-soft)] border-2 border-[var(--sb-berry)] rounded-xl px-4 py-3 mb-3 text-sm font-semibold animate-fade-in">
            <AlertCircle size={15} /> {error}
          </div>
        )}
        {success && (
          <div role="status" className="flex items-center gap-2 text-[var(--sb-forest-text)] bg-[var(--sb-forest-soft)] border-2 border-[var(--sb-forest)] rounded-xl px-4 py-3 mb-3 text-sm font-semibold animate-fade-in">
            <Check size={15} /> {success}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Row 1: English + Annotation */}
          <div className="flex gap-2 sm:col-span-2 lg:col-span-2 min-w-0">
            <input
              id="input-english"
              value={english}
              onChange={e => setEnglish(e.target.value)}
              placeholder="English word / phrase *"
              className="flex-1 min-w-0 vm-input rounded-xl px-4 py-2.5 text-sm"
            />
            <input
              id="input-annotation"
              value={annotation}
              onChange={e => setAnnotation(e.target.value)}
              placeholder="Từ loại (adj, v…)"
              title="Từ loại / Ghi chú"
              className="w-28 sm:w-36 shrink-0 vm-input rounded-xl px-3 py-2.5 text-xs"
            />
          </div>
          <input
            id="input-vietnamese"
            value={vietnamese}
            onChange={e => setVietnamese(e.target.value)}
            placeholder="Nghĩa tiếng Việt *"
            className="vm-input rounded-xl px-4 py-2.5 text-sm"
          />
          <input
            id="input-image-url"
            value={imageUrl}
            onChange={e => setImageUrl(e.target.value)}
            placeholder="Image URL (optional)"
            className="vm-input rounded-xl px-4 py-2.5 text-sm"
          />
          <select
            id="input-word-type"
            value={wordType}
            onChange={e => setWordType(e.target.value)}
            className="vm-input rounded-xl px-4 py-2.5 text-sm font-medium"
          >
            {WORD_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <button
          id="add-word-btn"
          type="submit"
          className="vm-btn vm-btn-primary mt-3.5 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold"
        >
          <Plus size={16} /> Add Word
        </button>
      </form>

      {/* Search Bar */}
      <div className="relative mb-4">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--sb-ink-soft)] pointer-events-none" />
        <input
          id="vocab-search"
          type="text"
          value={searchQuery}
          onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
          placeholder="Search by English word or Vietnamese meaning…"
          autoComplete="off"
          spellCheck={false}
          className="w-full vm-input rounded-xl pl-10 pr-10 py-2.5 text-sm"
        />
        {searchQuery && (
          <button
            id="vocab-search-clear"
            onClick={() => { setSearchQuery(''); setPage(1); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--sb-ink-soft)] hover:text-[var(--sb-ink)] transition-colors"
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
            onClick={() => { setVocabFilter(opt.value); setPage(1); }}
            className={`vm-btn px-4 py-1.5 rounded-full text-sm font-bold border-2 ${
              vocabFilter === opt.value
                ? 'vm-btn-primary'
                : 'bg-[var(--sb-paper-card)] text-[var(--sb-ink)] hover:bg-[var(--sb-paper-deep)] border-[var(--sb-ink-border)]'
            }`}
          >
            {opt.label}
            <span className="ml-1.5 text-xs opacity-80">
              ({opt.value === null ? poolForLevelCounts.length : levelCounts[opt.value] || 0})
            </span>
          </button>
        ))}
        <button
          id="filter-hard-only"
          type="button"
          onClick={() => { setHardOnly(v => !v); setPage(1); }}
          aria-pressed={hardOnly}
          title={hardOnly ? 'Hiện tất cả từ' : 'Chỉ hiện từ khó đã đánh dấu sao'}
          className={`vm-btn flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-bold border-2 ${
            hardOnly
              ? 'bg-[var(--sb-ochre-soft)] text-[var(--sb-ochre-text)] border-[var(--sb-ink)] shadow-[var(--sb-shadow-sm)]'
              : 'bg-[var(--sb-paper-card)] text-[var(--sb-ink)] hover:bg-[var(--sb-ochre-soft)] hover:text-[var(--sb-ochre-text)] border-[var(--sb-ink-border)]'
          }`}
        >
          <Star size={14} className={hardOnly ? 'fill-[var(--sb-ochre)] text-[var(--sb-ochre-text)]' : 'text-[var(--sb-ochre-text)]'} />
          <span>Khó ⭐</span>
          <span className="ml-0.5 text-xs opacity-85">({hardCount})</span>
        </button>
      </div>

      {/* Type Filter Sub-Tabs */}
      <div className="vm-panel flex items-center gap-1 mb-5 rounded-xl p-1 w-fit max-w-full flex-wrap">
        {typeFilterOptions.map(opt => (
          <button
            key={opt.value}
            id={`filter-type-${opt.value.toLowerCase()}`}
            onClick={() => { setTypeFilter(opt.value); setPage(1); }}
            className={`vm-btn flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border ${
              typeFilter === opt.value
                ? 'bg-[var(--sb-terracotta-strong)] text-white border-[var(--sb-ink)] shadow-[var(--sb-shadow-sm)]'
                : 'border-transparent text-[var(--sb-ink)] hover:bg-[var(--sb-paper-deep)]'
            }`}
          >
            <span>{opt.icon}</span>
            <span className="hidden sm:inline">{opt.label.split('(')[0].trim()}</span>
            <span className="text-xs opacity-80">
              ({opt.value === 'All'
                ? poolForTypeCounts.length
                : typeCounts[opt.value] || 0})
            </span>
          </button>
        ))}
      </div>

      {/* Bulk Action Bar */}
      {selected.size > 0 && (
        <div className="relative z-10 sb-paper-note flex items-center gap-3 mb-4 px-4 py-3 animate-fade-in">
          <Layers size={16} className="text-[var(--sb-terracotta-strong)] shrink-0" />
          <span className="text-[var(--sb-ink)] text-sm font-bold">
            {selected.size} word{selected.size !== 1 ? 's' : ''} selected
          </span>
          <div className="relative ml-auto">
            <button
              id="bulk-level-btn"
              onClick={() => setShowBulkDd(v => !v)}
              className="vm-btn vm-btn-primary flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold"
            >
              Change Level <ChevronDown size={13} />
            </button>
            {showBulkDd && (
              <div className="absolute right-0 top-full mt-1.5 bg-[var(--sb-paper-card)] border-2 border-[var(--sb-ink)] rounded-xl shadow-[var(--sb-shadow-md)] z-50 min-w-[160px] overflow-visible vm-scale-in">
                {[1, 2, 3, 4, 5].map(l => (
                  <button
                    key={l}
                    id={`bulk-set-level-${l}`}
                    onClick={() => handleBulkChangeLevel(l)}
                    className="w-full text-left px-4 py-2.5 text-sm font-semibold text-[var(--sb-ink)] hover:bg-[var(--sb-paper-deep)] transition-colors first:rounded-t-[10px] last:rounded-b-[10px]"
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
            className="vm-btn flex items-center gap-1 px-3 py-1.5 bg-[var(--sb-paper-warm)] hover:bg-[var(--sb-paper-deep)] border-2 border-[var(--sb-ink)] text-[var(--sb-ink)] rounded-lg text-xs font-bold"
          >
            <X size={13} /> Clear
          </button>
        </div>
      )}

      {/* Select-All row */}
      {filtered.length > 0 && (
        <div ref={listRef} className="flex items-center justify-between gap-3 mb-3 px-1 flex-wrap scroll-mt-24">
          <div className="flex items-center gap-2">
            <button
              id="select-all-btn"
              onClick={toggleSelectAll}
              className="flex items-center gap-2 text-[var(--sb-ink)] hover:text-[var(--sb-terracotta-text)] text-sm font-bold transition-colors"
            >
              {allSelected
                ? <CheckSquare size={16} className="text-[var(--sb-terracotta-strong)]" />
                : <Square size={16} />
              }
              {allSelected ? 'Deselect All' : 'Select All'}
            </button>
            <span className="text-[var(--sb-ink-soft)] font-semibold text-xs">
              ({filtered.length} matching; {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filtered.length)} shown)
            </span>
          </div>
          {pageCount > 1 && (
            <Pagination page={currentPage} pageCount={pageCount} onChange={changePage} position="top" />
          )}
        </div>
      )}

      {/* Word Grid */}
      {filtered.length === 0 ? (
        <div className="sb-card text-center py-14 px-6">
          <BookOpen size={52} className="text-[var(--sb-ink-soft)] mx-auto mb-4" />
          <p className="sb-font-display text-[var(--sb-ink)] font-bold text-lg">
            {hardOnly
              ? 'Chưa có từ khó ⭐ nào khớp bộ lọc hiện tại'
              : vocabFilter || typeFilter !== 'All' || searchQuery
                ? 'No words match this filter'
                : 'No words yet'}
          </p>
          <p className="text-[var(--sb-ink-soft)] text-sm mt-2">
            {hardOnly
              ? 'Hãy đánh dấu ⭐ cho từ khó trong danh sách hoặc tắt bộ lọc "Khó ⭐".'
              : vocabFilter || typeFilter !== 'All' || searchQuery
                ? 'Try a different filter or search term.'
                : 'Add your first word using the form above!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {visibleWords.map(word => (
            <WordCard
              key={word.id}
              word={word}
              onDelete={deleteWord}
              onUpdate={updateWord}
              onToggleHard={toggleWordHard}
              selected={selected.has(word.id)}
              onToggleSelect={toggleSelect}
            />
          ))}
        </div>
      )}
      {pageCount > 1 && (
        <div className="mt-4">
          <Pagination page={currentPage} pageCount={pageCount} onChange={changePage} position="bottom" />
        </div>
      )}
    </div>
  );
});
