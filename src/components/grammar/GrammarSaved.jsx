import { useState, useMemo } from 'react';
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
  const [expanded,    setExpanded]    = useState({}); // { [savedId]: bool }
  const [editingNote, setEditingNote] = useState(null); // savedId
  const [noteText,    setNoteText]    = useState('');

  // ── Filter & search ───────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return savedQuestions.filter(q => {
      if (hardOnly && !q.hardMarked) return false;
      if (topicFilter !== 'All' && q.topic !== topicFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        const matches =
          q.sentence?.toLowerCase().includes(s) ||
          (typeof q.topic === 'string' && q.topic.toLowerCase().includes(s)) ||
          q.shortExplanation?.toLowerCase().includes(s) ||
          q.vietnameseSentence?.toLowerCase().includes(s) ||
          q.userNotes?.toLowerCase().includes(s) ||
          getSentenceTopicLabel(q).toLowerCase().includes(s) ||
          JSON.stringify(q.grammarPoints || []).toLowerCase().includes(s) ||
          JSON.stringify(q.readingItems || []).toLowerCase().includes(s) ||
          JSON.stringify([q.structures, q.readingNotes]).toLowerCase().includes(s) ||
          Object.values(q.options || {}).some(v => v.toLowerCase().includes(s));
        if (!matches) return false;
      }
      return true;
    });
  }, [savedQuestions, search, topicFilter, hardOnly]);

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
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/25 ring-1 ring-white/15">
            <Bookmark size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white">Câu đã lưu</h2>
            <p className="text-slate-300 text-sm">{savedQuestions.length} câu đã lưu</p>
          </div>
        </div>
        {/* Cloud / Local badge */}
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border ${
          cloudConfigured
            ? 'bg-emerald-500/12 text-emerald-300 border-emerald-400/30'
            : 'bg-slate-800/70 text-slate-300 border-slate-400/20'
        }`}>
          {cloudConfigured ? <Cloud size={13} /> : <HardDrive size={13} />}
          {cloudConfigured ? 'Cloud Sync' : 'Lưu cục bộ'}
        </div>
      </div>

      {/* Filters */}
      <div className="vm-panel rounded-2xl p-4 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tìm kiếm câu hỏi, từ khoá, chủ đề..."
            className="w-full vm-input rounded-xl pl-9 pr-9 py-2.5 text-sm"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors">
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <Filter size={14} className="text-slate-400 shrink-0" />

          {/* Topic filter */}
          <select
            value={topicFilter}
            onChange={e => setTopicFilter(e.target.value)}
            className="vm-input text-slate-200 rounded-xl px-3 py-1.5 text-xs"
          >
            <option value="All">Tất cả chủ đề</option>
            {getAvailableTopics(savedQuestions.filter(q => typeof q.topic === 'string')).map(t => (
              <option key={t} value={t}>{getSentenceTopicLabel({ topic: t })}</option>
            ))}
          </select>

          {/* Hard only toggle */}
          <button
            onClick={() => setHardOnly(v => !v)}
            className={`vm-btn flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border ${
              hardOnly
                ? 'bg-amber-500/20 text-amber-200 border-amber-400/45 shadow-sm shadow-amber-500/15'
                : 'bg-slate-900/75 text-slate-300 hover:text-white border-slate-400/20'
            }`}
          >
            {hardOnly ? <Star size={12} /> : <StarOff size={12} />}
            Khó (⭐)
          </button>

          <span className="ml-auto text-slate-300 text-xs">{filtered.length} kết quả</span>
        </div>
      </div>

      {/* Empty state */}
      {savedQuestions.length === 0 && (
        <div className="text-center py-16">
          <Bookmark size={48} className="text-slate-500 mx-auto mb-4" />
          <h3 className="text-slate-300 font-medium mb-2">Chưa có câu hỏi nào được lưu</h3>
          <p className="text-slate-400 text-sm">Trong khi luyện tập, nhấn nút ⭐ để lưu câu hỏi hay hoặc khó.</p>
        </div>
      )}

      {filtered.length === 0 && savedQuestions.length > 0 && (
        <div className="text-center py-10">
          <Search size={36} className="text-slate-500 mx-auto mb-3" />
          <p className="text-slate-300 text-sm">Không tìm thấy câu hỏi phù hợp với bộ lọc.</p>
        </div>
      )}

      {/* Question cards */}
      <div className="space-y-3">
        {filtered.map(q => {
          const open   = expanded[q.savedId];
          const level  = getReviewLevel(q.savedId);
          const wrongs = getWrongCount(q.savedId);
          const segments = underlines[q.savedId] || [];

          return (
            <div
              key={q.savedId}
              data-grammar-sentence-card=""
              className={`vm-panel rounded-2xl overflow-hidden transition-colors duration-200 ${
                q.hardMarked ? 'border-amber-400/45' : ''
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
                      q.hardMarked ? 'text-amber-400' : 'text-slate-400 hover:text-amber-300'
                    }`}
                  >
                    <Star size={16} fill={q.hardMarked ? 'currentColor' : 'none'} />
                  </button>

                  <div className="flex-1 min-w-0">
                    {/* Meta badges */}
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      <GrammarTopicBadge question={q} />
                      {/* Review level */}
                      <span className="px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300 text-xs font-medium border border-indigo-400/25">
                        Ôn L{level}
                      </span>
                      {wrongs > 0 && (
                        <span className="px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-300 text-xs font-medium border border-rose-400/25">
                          Cần ôn lại / sai {wrongs}×
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded-md bg-slate-800/80 text-slate-300 text-xs border border-slate-400/15">
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
                      className="text-white text-sm leading-relaxed break-words"
                      readOnly={!onUnderlineChange}
                      sentenceKey={q.savedId} notes={notesForSentence(sentenceNotes, q.savedId, getGrammarSentence(q))}
                      onNoteChange={onNoteChange ? draft => onNoteChange(q.savedId, getGrammarSentence(q), draft) : undefined}
                    />

                    <button type="button" aria-expanded={Boolean(open)} onClick={() => setExpanded(p => ({ ...p, [q.savedId]: !p[q.savedId] }))}
                      className="text-violet-300 text-sm font-medium mt-2 hover:text-violet-200 transition-colors">
                      {open ? 'Ẩn phân tích' : 'Hiện phân tích'}
                    </button>

                    {/* Saved date */}
                    <p className="text-slate-400 text-xs mt-1">
                      Đã lưu: {new Date(q.savedAt).toLocaleDateString('vi-VN')}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {/* Expand */}
                    <button
                      aria-label={open ? 'Ẩn phân tích' : 'Hiện phân tích'}
                      aria-expanded={Boolean(open)}
                      onClick={() => setExpanded(p => ({ ...p, [q.savedId]: !p[q.savedId] }))}
                      className="vm-btn p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800"
                    >
                      {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    {/* Delete */}
                    <button
                      onClick={() => onUnsave(q.savedId)}
                      className="vm-btn p-1.5 rounded-lg text-slate-300 hover:text-rose-300 hover:bg-rose-500/15"
                      title="Xoá khỏi thư viện"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Expanded details */}
              {open && (
                <div className="border-t border-slate-400/15 bg-slate-950/35 p-4 space-y-3 animate-fade-in">
                  <GrammarAnalysis question={q} onQuickAdd={onQuickAdd} analysisTopic={topicFilter === 'All' ? undefined : topicFilter} />

                  {/* User notes */}
                  <div className="border-t border-slate-400/15 pt-3">
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
                            className="vm-btn px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 border border-slate-400/20 text-slate-300 hover:text-white"
                          >
                            Huỷ
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEditNote(q)}
                        className="flex items-center gap-1.5 text-slate-300 hover:text-white text-xs transition-colors"
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
    </div>
  );
}
