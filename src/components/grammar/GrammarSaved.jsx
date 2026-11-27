import { useState, useMemo, useRef } from 'react';
import {
  Bookmark, Search, Filter, Star, StarOff,
  ChevronDown, ChevronUp, Trash2, StickyNote, X, Cloud, HardDrive
} from 'lucide-react';
import { getAvailableTopics } from '../../utils/grammarPrompt';

import { GrammarAnalysis } from './GrammarAnalysis';
import { getGrammarSentence } from '../../utils/grammarSentence';
import UnderlinedSentence from './UnderlinedSentence';
import { notesForSentence } from '../../utils/sentenceNotes';
import GrammarTopicBadge from './GrammarTopicBadge';
import { getSentenceTopicLabel } from '../../utils/grammarTopic';
import Pagination from '../Pagination';

const PAGE_SIZE = 10;

/**
 * GrammarSaved — Saved Questions library with search, filter, review progress.
 */
export default function GrammarSaved({
  savedQuestions,
  reviewProgress,
  cloudConfigured,
  onUnsave,
  onToggleHard,
  onUpdateNotes,
  onQuickAdd,
  onUnderlineChange,
  underlines = {},
  sentenceNotes, onNoteChange,
}) {
  const [search,      setSearch]      = useState('');
  const [topicFilter, setTopicFilter] = useState('All');
  const [hardOnly,    setHardOnly]    = useState(false);
  const [page,        setPage]        = useState(1);
  const [expanded,    setExpanded]    = useState({}); // { [savedId]: bool }
  const [editingNote, setEditingNote] = useState(null); // savedId
  const [noteText,    setNoteText]    = useState('');
  const listRef = useRef(null);

  // Precompute lowercase searchable text per saved question so typing does not re-stringify everything.
  const searchIndex = useMemo(() => {
    const map = new Map();
    for (const q of savedQuestions) {
      const optionValues = Object.values(q.options || {})
        .filter(v => typeof v === 'string')
        .join('\n');
      const haystack = [
        q.sentence || '',
        typeof q.topic === 'string' ? q.topic : '',
        q.shortExplanation || '',
        q.vietnameseSentence || '',
        q.userNotes || '',
        getSentenceTopicLabel(q),
        JSON.stringify(q.grammarPoints || []),
        JSON.stringify(q.readingItems || []),
        JSON.stringify([q.structures, q.readingNotes]),
        optionValues,
      ].join('\n').toLowerCase();
      map.set(q, haystack);
    }
    return map;
  }, [savedQuestions]);

  // ── Filter & search ───────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return savedQuestions.filter(q => {
      if (hardOnly && !q.hardMarked) return false;
      if (topicFilter !== 'All' && q.topic !== topicFilter) return false;
      if (s && !searchIndex.get(q)?.includes(s)) return false;
      return true;
    });
  }, [savedQuestions, searchIndex, search, topicFilter, hardOnly]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  // Deleting the last question on the last page steps back instead of showing an empty page.
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const visibleQuestions = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  function changePage(nextPage) {
    setPage(Math.max(1, Math.min(nextPage, pageCount)));
    setExpanded({});
    setEditingNote(null);
    listRef.current?.scrollIntoView({ block: 'start' });
  }

  // ── Note editing ──────────────────────────────────────────────────────────
  function startEditNote(q) {
    setEditingNote(q.savedId);
    setNoteText(q.userNotes || '');
  }
  function saveNote(savedId) {
    onUpdateNotes(savedId, noteText);
    setEditingNote(null);
  }

  // ── Review level display ──────────────────────────────────────────────────
  function getReviewLevel(savedId) {
    return reviewProgress[savedId]?.level ?? 1;
  }
  function getWrongCount(savedId) {
    return reviewProgress[savedId]?.wrongCount ?? 0;
  }
  function getNextReview(savedId) {
    const at = reviewProgress[savedId]?.nextReviewAt;
    if (!at) return 'Chưa ôn';
    const diff = at - Date.now();
    if (diff <= 0) return '⚡ Đến hạn hôm nay';
    const days = Math.ceil(diff / 86400000);
    return `${days} ngày nữa`;
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--sb-ochre)] to-[var(--sb-terracotta-strong)] border-2 border-[var(--sb-ink)] shadow-[var(--sb-shadow-sm)] flex items-center justify-center">
            <Bookmark size={20} className="text-white" />
          </div>
          <div>
            <h2 className="sb-heading text-xl font-bold tracking-tight text-[var(--sb-ink)]">Câu đã lưu</h2>
            <p className="text-[var(--sb-ink-soft)] text-sm">{savedQuestions.length} câu đã lưu</p>
          </div>
        </div>
        {/* Cloud / Local badge */}
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border ${
          cloudConfigured
            ? 'bg-[var(--sb-forest-soft)] text-[var(--sb-forest-text)] border-[var(--sb-forest)]'
            : 'bg-[var(--sb-paper-card)] text-[var(--sb-ink)] border-[var(--sb-ink-border)]'
        }`}>
          {cloudConfigured ? <Cloud size={13} /> : <HardDrive size={13} />}
          {cloudConfigured ? 'Cloud Sync' : 'Lưu cục bộ'}
        </div>
      </div>

      {/* Filters */}
      <div className="vm-panel rounded-2xl p-4 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--sb-ink-soft)] pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Tìm kiếm câu hỏi, từ khoá, chủ đề..."
            className="w-full vm-input rounded-xl pl-9 pr-9 py-2.5 text-sm"
          />
          {search && (
            <button onClick={() => { setSearch(''); setPage(1); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--sb-ink-soft)] hover:text-[var(--sb-ink)] transition-colors">
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <Filter size={14} className="text-[var(--sb-ink-soft)] shrink-0" />

          {/* Topic filter */}
          <select
            value={topicFilter}
            onChange={e => { setTopicFilter(e.target.value); setPage(1); }}
            className="vm-input rounded-xl px-3 py-1.5 text-xs"
          >
            <option value="All">Tất cả chủ đề</option>
            {getAvailableTopics(savedQuestions.filter(q => typeof q.topic === 'string')).map(t => (
              <option key={t} value={t}>{getSentenceTopicLabel({ topic: t })}</option>
            ))}
          </select>

          {/* Hard only toggle */}
          <button
            onClick={() => { setHardOnly(v => !v); setPage(1); }}
            className={`vm-btn flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border ${
              hardOnly
                ? 'bg-[var(--sb-ochre-soft)] text-[var(--sb-ochre-text)] border-[var(--sb-ink)] shadow-[var(--sb-shadow-sm)]'
                : 'bg-[var(--sb-paper-card)] text-[var(--sb-ink)] hover:bg-[var(--sb-paper-deep)] border-[var(--sb-ink-border)]'
            }`}
          >
            {hardOnly ? <Star size={12} /> : <StarOff size={12} />}
            Khó (⭐)
          </button>

          <span className="ml-auto text-[var(--sb-ink-soft)] text-xs font-medium">
            {filtered.length > 0
              ? `${filtered.length} kết quả (hiển thị ${pageStart + 1}–${Math.min(pageStart + PAGE_SIZE, filtered.length)})`
              : '0 kết quả'}
          </span>
        </div>
      </div>

      {/* Empty state */}
      {savedQuestions.length === 0 && (
        <div className="text-center py-16">
          <Bookmark size={48} className="text-[var(--sb-ink-soft)] mx-auto mb-4" />
          <h3 className="text-[var(--sb-ink)] font-semibold mb-2">Chưa có câu hỏi nào được lưu</h3>
          <p className="text-[var(--sb-ink-soft)] text-sm">Trong khi luyện tập, nhấn nút ⭐ để lưu câu hỏi hay hoặc khó.</p>
        </div>
      )}

      {filtered.length === 0 && savedQuestions.length > 0 && (
        <div className="text-center py-10">
          <Search size={36} className="text-[var(--sb-ink-soft)] mx-auto mb-3" />
          <p className="text-[var(--sb-ink-soft)] text-sm">Không tìm thấy câu hỏi phù hợp với bộ lọc.</p>
        </div>
      )}

      {/* Question cards */}
      {filtered.length > 0 && (
        <div ref={listRef} className="scroll-mt-24 space-y-3">
          {pageCount > 1 && (
            <Pagination
              page={currentPage}
              pageCount={pageCount}
              onChange={changePage}
              position="top"
              label="Saved sentence pages"
              selectLabel="Saved sentence page"
            />
          )}

          <div className="space-y-3">
            {visibleQuestions.map(q => {
          const open   = expanded[q.savedId];
          const level  = getReviewLevel(q.savedId);
          const wrongs = getWrongCount(q.savedId);
          const segments = underlines[q.savedId] || [];

          return (
            <div
              key={q.savedId}
              data-grammar-sentence-card=""
              className={`vm-panel rounded-2xl overflow-hidden transition-colors duration-200 ${
                q.hardMarked ? 'border-[var(--sb-ochre)]' : ''
              }`}
            >
              {/* Card header */}
              <div className="p-4">
                <div className="flex items-start gap-3">
                  {/* Hard mark */}
                  <button
                    onClick={() => onToggleHard(q.savedId)}
                    title={q.hardMarked ? 'Bỏ đánh dấu khó' : 'Đánh dấu là khó'}
                    className={`mt-0.5 shrink-0 transition-colors duration-200 ${
                      q.hardMarked ? 'text-[var(--sb-ochre-text)]' : 'text-[var(--sb-ink-soft)] hover:text-[var(--sb-ochre-text)]'
                    }`}
                  >
                    <Star size={16} fill={q.hardMarked ? 'currentColor' : 'none'} />
                  </button>

                  <div className="flex-1 min-w-0">
                    {/* Meta badges */}
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      <GrammarTopicBadge question={q} />
                      {/* Review level */}
                      <span className="px-2 py-0.5 rounded-md bg-[var(--sb-sky-soft)] text-[var(--sb-sky-text)] text-xs font-semibold border border-[var(--sb-sky)]/35">
                        Ôn L{level}
                      </span>
                      {wrongs > 0 && (
                        <span className="px-2 py-0.5 rounded-md bg-[var(--sb-berry-soft)] text-[var(--sb-berry-text)] text-xs font-semibold border border-[var(--sb-berry)]/35">
                          Cần ôn lại / sai {wrongs}×
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded-md bg-[var(--sb-paper-deep)] text-[var(--sb-ink-soft)] text-xs border border-[var(--sb-ink-border)]">
                        {getNextReview(q.savedId)}
                      </span>
                    </div>

                    {/* Sentence with underlines */}
                    <UnderlinedSentence
                      sentence={getGrammarSentence(q)}
                      segments={segments}
                      onUnderlineChange={onUnderlineChange
                        ? (start, end, color) => onUnderlineChange(q.savedId, start, end, color)
                        : undefined}
                      className="text-[var(--sb-ink)] font-medium text-sm leading-relaxed break-words"
                      readOnly={!onUnderlineChange}
                      sentenceKey={q.savedId} notes={notesForSentence(sentenceNotes, q.savedId, getGrammarSentence(q))}
                      onNoteChange={onNoteChange ? draft => onNoteChange(q.savedId, getGrammarSentence(q), draft) : undefined}
                    />

                    <button type="button" aria-expanded={Boolean(open)} onClick={() => setExpanded(p => ({ ...p, [q.savedId]: !p[q.savedId] }))}
                      className="text-[var(--sb-terracotta-text)] text-sm font-semibold mt-2 hover:text-[var(--sb-terracotta-hover)] transition-colors">
                      {open ? 'Ẩn phân tích' : 'Hiện phân tích'}
                    </button>

                    {/* Saved date */}
                    <p className="text-[var(--sb-ink-soft)] text-xs mt-1">
                      Đã lưu: {new Date(q.savedAt).toLocaleDateString('vi-VN')}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {/* Expand */}
                    <button
                      aria-label={open ? 'Ẩn phân tích' : 'Hiện phân tích'}
                      aria-expanded={Boolean(open)}
                      onClick={() => setExpanded(p => ({ ...p, [q.savedId]: !p[q.savedId] }))}
                      className="vm-btn p-1.5 rounded-lg text-[var(--sb-ink-soft)] hover:text-[var(--sb-ink)] hover:bg-[var(--sb-paper-deep)]"
                    >
                      {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    {/* Delete */}
                    <button
                      onClick={() => onUnsave(q.savedId)}
                      className="vm-btn p-1.5 rounded-lg text-[var(--sb-ink-soft)] hover:text-[var(--sb-berry-text)] hover:bg-[var(--sb-berry-soft)]"
                      title="Xoá khỏi thư viện"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Expanded details */}
              {open && (
                <div className="border-t border-[var(--sb-ink-border)] bg-[var(--sb-paper-warm)] p-4 space-y-3 animate-fade-in">
                  <GrammarAnalysis question={q} onQuickAdd={onQuickAdd} analysisTopic={topicFilter === 'All' ? undefined : topicFilter} />

                  {/* User notes */}
                  <div className="border-t border-[var(--sb-ink-border)] pt-3">
                    {editingNote === q.savedId ? (
                      <div className="space-y-2">
                        <textarea
                          value={noteText}
                          onChange={e => setNoteText(e.target.value)}
                          placeholder="Ghi chú của bạn..."
                          rows={3}
                          className="w-full vm-input rounded-xl px-3 py-2 text-sm resize-none"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => saveNote(q.savedId)}
                            className="vm-btn vm-btn-violet px-3.5 py-1.5 rounded-lg text-xs font-semibold"
                          >
                            Lưu ghi chú
                          </button>
                          <button
                            onClick={() => setEditingNote(null)}
                            className="vm-btn px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[var(--sb-paper-card)] border-2 border-[var(--sb-ink-border)] text-[var(--sb-ink)] hover:bg-[var(--sb-paper-deep)]"
                          >
                            Huỷ
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEditNote(q)}
                        className="flex items-center gap-1.5 text-[var(--sb-ink-soft)] hover:text-[var(--sb-ink)] font-medium text-xs transition-colors"
                      >
                        <StickyNote size={13} />
                        {q.userNotes ? q.userNotes : 'Thêm ghi chú...'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
          </div>

          {pageCount > 1 && (
            <Pagination
              page={currentPage}
              pageCount={pageCount}
              onChange={changePage}
              position="bottom"
              label="Saved sentence pages"
              selectLabel="Saved sentence page"
            />
          )}
        </div>
      )}
    </div>
  );
}
