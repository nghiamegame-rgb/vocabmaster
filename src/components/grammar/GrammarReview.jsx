import { useState } from 'react';
import { isGrammarDueForReview } from '../../utils/grammarStorage';
import { getAvailableTopics, getTopicLabel } from '../../utils/grammarPrompt';
import GrammarSentenceCard from './GrammarAnalysis';

export default function GrammarReview({ savedQuestions, reviewProgress, onRecordReview, onToggleHard, onQuickAdd }) {
  const [mode, setMode] = useState('select');
  const [reviewMode, setReviewMode] = useState('due');
  const [topic, setTopic] = useState('All');
  const [starredOnly, setStarredOnly] = useState(false);
  const [queue, setQueue] = useState([]);
  const [current, setCurrent] = useState(0);
  const [assessments, setAssessments] = useState({});
  const [stars, setStars] = useState({});
  const filtered = savedQuestions.filter(q => (topic === 'All' || q.topic === topic) && (!starredOnly || q.hardMarked));
  const subsets = {
    due: filtered.filter(q => isGrammarDueForReview(reviewProgress[q.savedId])),
    wrong: filtered.filter(q => (reviewProgress[q.savedId]?.wrongCount ?? 0) > 0),
    all: filtered,
  };
  const understood = Object.values(assessments).filter(Boolean).length;
  function start() {
    setQueue([...subsets[reviewMode]].sort(() => Math.random() - 0.5));
    setCurrent(0); setAssessments({}); setStars({}); setMode('session');
  }
  function assess(value) {
    if (assessments[current] !== undefined) return;
    const q = queue[current];
    onRecordReview(q.savedId, value);
    setAssessments(prev => ({ ...prev, [current]: value }));
  }
  function finish() {
    setMode('done');
  }
  if (mode === 'select') return <div className="space-y-5">
    <h2 className="text-xl text-white font-bold">Ôn tập cấu trúc câu</h2>
    <p className="text-sm text-slate-400">Tự nhận diện cấu trúc và đánh giá mức hiểu; xem phân tích khi cần. Đã hiểu tăng một cấp; cần ôn lại giảm một cấp (L1–L5). Chuyển câu khi chưa đánh giá sẽ giữ nguyên tiến độ.</p>
    <div className="flex flex-wrap items-center gap-3">
      <select aria-label="Lọc chủ đề ôn tập" value={topic} onChange={e => setTopic(e.target.value)} className="max-w-full bg-slate-800 border border-slate-600 rounded-lg p-2 text-slate-300 text-sm">
        <option value="All">Tất cả chủ đề</option>
        {getAvailableTopics(savedQuestions).map(t => <option key={t} value={t}>{getTopicLabel(t)}</option>)}
      </select>
      <label className="text-slate-300 text-sm flex gap-2 items-center"><input type="checkbox" checked={starredOnly} onChange={e => setStarredOnly(e.target.checked)} />Chỉ câu đánh dấu sao ⭐</label>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{[['due', 'Đến hạn ôn'], ['wrong', 'Từng cần ôn lại / sai'], ['all', 'Tất cả']].map(([key, label]) => <button key={key} onClick={() => setReviewMode(key)}
      className={`p-4 rounded-xl text-slate-200 border ${reviewMode === key ? 'bg-purple-600/20 border-purple-500' : 'bg-slate-900 border-slate-700'}`}>{label} ({subsets[key].length})</button>)}</div>
    {!subsets[reviewMode].length && <p className="text-slate-400 text-sm">Không có câu phù hợp với bộ lọc này.</p>}
    <button disabled={!subsets[reviewMode].length} onClick={start} className="px-5 py-3 bg-purple-600 text-white rounded-xl disabled:opacity-40">Bắt đầu ôn tập</button>
  </div>;
  if (mode === 'done') return <div className="text-center py-12 space-y-4">
    <h3 className="text-xl font-bold text-white">Đã kết thúc ôn tập</h3>
    <p className="text-slate-300">Đã hiểu: {understood} · Cần ôn lại: {Object.keys(assessments).length - understood} · Đã ôn: {Object.keys(assessments).length}/{queue.length}</p>
    <button onClick={() => setMode('select')} className="px-5 py-2 rounded-xl bg-purple-600 text-white">Chọn bộ ôn</button>
  </div>;
  const q = queue[current];
  const starred = stars[q.savedId] ?? q.hardMarked;
  return <div className="space-y-4">
    <div className="flex items-center justify-between gap-3 text-sm text-slate-400">
      <span>Câu {current + 1}/{queue.length} · Ôn L{reviewProgress[q.savedId]?.level ?? 1}</span>
      <button aria-pressed={Boolean(starred)} className="px-3 py-2 rounded-lg bg-slate-800 text-amber-300" onClick={() => {
        onToggleHard?.(q.savedId); setStars(prev => ({ ...prev, [q.savedId]: !starred }));
      }}>{starred ? '★ Bỏ sao' : '☆ Đánh dấu sao'}</button>
    </div>
    <GrammarSentenceCard key={current} question={q} onAssess={assess} assessed={assessments[current]} onQuickAdd={onQuickAdd}
      onNext={() => current + 1 < queue.length ? setCurrent(c => c + 1) : finish()}
      nextLabel={current + 1 < queue.length ? 'Câu tiếp' : 'Hoàn tất'} />
    <div className="flex justify-between gap-3">
      <button onClick={finish} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl">Kết thúc phiên</button>
    </div>
  </div>;
}
