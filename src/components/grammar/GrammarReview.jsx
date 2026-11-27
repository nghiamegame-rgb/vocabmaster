import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Volume2 } from 'lucide-react';
import { isGrammarDueForReview } from '../../utils/grammarStorage';
import { buildTopicOptions } from '../../utils/grammarTopic';
import { getGrammarSentence } from '../../utils/grammarSentence';
import { speakWithSettings } from '../../utils/voiceSpeech';
import VoiceSettings from '../VoiceSettings';
import GrammarSentenceCard from './GrammarAnalysis';

export default function GrammarReview({ savedQuestions, reviewProgress, onRecordReview, onToggleHard, onQuickAdd, onUnderlineChange, underlines = {}, sentenceNotes, onNoteChange }) {
  const [mode, setMode] = useState('select');
  const [reviewMode, setReviewMode] = useState('due');
  const [topic, setTopic] = useState('All');
  const [starredOnly, setStarredOnly] = useState(false);
  const [queue, setQueue] = useState([]);
  const [current, setCurrent] = useState(0);
  const [assessments, setAssessments] = useState({});
  const [stars, setStars] = useState({});
  const [notesShown, setNotesShown] = useState(false);
  const assessedIds = useRef(new Set());
  const speechRef = useRef(null);
  const [reviewError, setReviewError] = useState('');

  const stopSpeech = useCallback(() => {
    try { speechRef.current?.cancel(); } catch { /* ignore */ }
    speechRef.current = null;
  }, []);

  useEffect(() => () => stopSpeech(), [stopSpeech]);
  const topicOptions = useMemo(
    () => buildTopicOptions(savedQuestions, reviewProgress, starredOnly),
    [savedQuestions, reviewProgress, starredOnly]
  );
  const groupedTopicOptions = useMemo(() => {
    const top = [];
    const groups = new Map();
    for (const opt of topicOptions) {
      if (!opt.group) {
        top.push(opt);
      } else {
        if (!groups.has(opt.group)) groups.set(opt.group, []);
        groups.get(opt.group).push(opt);
      }
    }
    return { top, groups: [...groups.entries()] };
  }, [topicOptions]);
  const effectiveTopic = useMemo(() => {
    if (topic === 'All') return 'All';
    const selected = topicOptions.find(opt => opt.value === topic);
    return selected && !selected.disabled ? topic : 'All';
  }, [topic, topicOptions]);
  function handleStarredOnlyChange(checked) {
    setStarredOnly(checked);
    if (topic !== 'All') {
      const nextOptions = buildTopicOptions(savedQuestions, reviewProgress, checked);
      const selected = nextOptions.find(opt => opt.value === topic);
      if (!selected || selected.disabled) setTopic('All');
    }
  }
  const filtered = savedQuestions.filter(q => (effectiveTopic === 'All' || q.topic === effectiveTopic) && (!starredOnly || q.hardMarked));
  const subsets = {
    due: filtered.filter(q => isGrammarDueForReview(reviewProgress[q.savedId])),
    wrong: filtered.filter(q => (reviewProgress[q.savedId]?.wrongCount ?? 0) > 0),
    all: filtered,
  };
  const understood = Object.values(assessments).filter(Boolean).length;
  function start() {
    stopSpeech();
    assessedIds.current = new Set(); setReviewError('');
    setQueue([...subsets[reviewMode]].sort(() => Math.random() - 0.5));
    setCurrent(0); setAssessments({}); setStars({}); setNotesShown(false); setMode('session');
  }
  function assess(value) {
    const q = queue[current];
    if (assessedIds.current.has(q.savedId)) return;
    // Lock synchronously, including multiple events before React renders.
    assessedIds.current.add(q.savedId);
    setReviewError('');
    try {
      const result = onRecordReview(q.savedId, value);
      if (!result?.ok) {
        assessedIds.current.delete(q.savedId);
        const details = result?.diagnostics || [];
        const quota = ['QuotaExceededError', 'NS_ERROR_DOM_QUOTA_REACHED'].includes(details[0]?.errorType);
        setReviewError(result?.message || `Chưa lưu được đánh giá trên thiết bị. ${quota ? 'LocalStorage đã hết dung lượng.' : 'Thao tác lưu thất bại; chưa xác định là lỗi dung lượng.'} ${details.map(d => `${d.operation} · ${d.key} · ${d.errorType}`).join('; ')}${details.length > 1 ? ' Hoàn nguyên chưa hoàn tất. Giữ trang này mở và thử lại để tránh cộng trùng thống kê.' : ' Vui lòng thử lại.'}`);
        return;
      }
      setAssessments(prev => ({ ...prev, [current]: value }));
    } catch {
      assessedIds.current.delete(q.savedId);
      setReviewError('Chưa lưu được đánh giá: lỗi xử lý không xác định. Vui lòng thử lại.');
    }
  }
  function finish() {
    stopSpeech();
    setMode('done');
  }
  if (mode === 'select') return <div className="space-y-5 vm-page-enter">
    <h2 className="sb-heading text-xl text-[var(--sb-ink)] font-bold tracking-tight">Ôn tập cấu trúc câu</h2>
    <p className="text-sm text-[var(--sb-ink-soft)] leading-relaxed">Tự nhận diện cấu trúc và đánh giá mức hiểu; xem phân tích khi cần. Đã hiểu tăng một cấp; cần ôn lại giảm một cấp (L1–L5). Chuyển câu khi chưa đánh giá sẽ giữ nguyên tiến độ.</p>
    <div className="flex flex-wrap items-center gap-3">
      <select aria-label="Lọc chủ đề ôn tập" value={effectiveTopic} onChange={e => setTopic(e.target.value)} className="max-w-full vm-input rounded-xl px-3 py-2 text-sm">
        {groupedTopicOptions.top.map(opt => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled} className={opt.disabled ? 'text-[var(--sb-ink-soft)] opacity-60' : undefined}>
            {opt.label}
          </option>
        ))}
        {groupedTopicOptions.groups.map(([groupLabel, options]) => (
          <optgroup key={groupLabel} label={groupLabel}>
            {options.map(opt => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled} className={opt.disabled ? 'text-[var(--sb-ink-soft)] opacity-60' : undefined}>
                {opt.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <label className="text-[var(--sb-ink)] font-medium text-sm flex gap-2 items-center cursor-pointer"><input type="checkbox" checked={starredOnly} onChange={e => handleStarredOnlyChange(e.target.checked)} className="accent-[var(--sb-ochre-text)]" />Chỉ câu đánh dấu sao ⭐</label>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{[['due', 'Đến hạn ôn'], ['wrong', 'Từng cần ôn lại / sai'], ['all', 'Tất cả']].map(([key, label]) => <button key={key} onClick={() => setReviewMode(key)}
      className={`vm-btn p-4 rounded-2xl font-semibold border-2 ${reviewMode === key ? 'bg-[var(--sb-plum-soft)] border-[var(--sb-ink)] text-[var(--sb-plum-text)] shadow-[var(--sb-shadow-sm)]' : 'vm-panel text-[var(--sb-ink)] hover:bg-[var(--sb-paper-deep)]'}`}>{label} ({subsets[key].length})</button>)}</div>
    {!subsets[reviewMode].length && <p className="text-[var(--sb-ink-soft)] text-sm">Không có câu phù hợp với bộ lọc này.</p>}
    <button disabled={!subsets[reviewMode].length} onClick={start} className="vm-btn vm-btn-violet px-6 py-3 rounded-xl font-semibold disabled:opacity-40">Bắt đầu ôn tập</button>
  </div>;
  if (mode === 'done') return <div className="text-center py-12 space-y-4 vm-scale-in">
    <h3 className="sb-heading text-xl font-bold text-[var(--sb-ink)]">Đã kết thúc ôn tập</h3>
    <p className="text-[var(--sb-ink)]">Đã hiểu: {understood} · Cần ôn lại: {Object.keys(assessments).length - understood} · Đã ôn: {Object.keys(assessments).length}/{queue.length}</p>
    <button onClick={() => setMode('select')} className="vm-btn vm-btn-violet px-5 py-2.5 rounded-xl font-semibold">Chọn bộ ôn</button>
  </div>;
  const q = queue[current];
  const starred = stars[q.savedId] ?? q.hardMarked;
  const sentenceText = getGrammarSentence(q).trim();
  function speakSentence() {
    if (!sentenceText) return;
    stopSpeech();
    speechRef.current = speakWithSettings(sentenceText, { itemKey: `grammar-review:${q.savedId}` });
  }
  return <div className="space-y-4">
    <div className="flex items-center justify-between gap-3 text-sm text-[var(--sb-ink-soft)]">
      <span className="font-semibold tabular-nums">Câu {current + 1}/{queue.length} · Ôn L{reviewProgress[q.savedId]?.level ?? 1}</span>
      <button aria-pressed={Boolean(starred)} className="vm-btn px-3.5 py-2 rounded-xl bg-[var(--sb-ochre-soft)] border-2 border-[var(--sb-ink)] hover:bg-[var(--sb-paper-deep)] text-[var(--sb-ochre-text)] font-semibold" onClick={() => {
        onToggleHard?.(q.savedId); setStars(prev => ({ ...prev, [q.savedId]: !starred }));
      }}>{starred ? '★ Bỏ sao' : '☆ Đánh dấu sao'}</button>
    </div>
    <div className="flex flex-wrap items-center gap-3">
      {sentenceText && (
        <button
          id="grammar-review-speak"
          type="button"
          aria-label="Nghe câu"
          onClick={speakSentence}
          className="vm-btn flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border bg-[var(--sb-terracotta-soft)] border-[var(--sb-ink)] text-[var(--sb-terracotta-text)] hover:bg-[var(--sb-ochre-soft)]"
        >
          <Volume2 size={14} className="shrink-0" />
          <span>Nghe câu</span>
        </button>
      )}
      <VoiceSettings />
    </div>
    <GrammarSentenceCard key={current} question={q} onAssess={assess} assessed={assessments[current]} onQuickAdd={onQuickAdd}
      analysisTopic={effectiveTopic === 'All' ? undefined : effectiveTopic}
      onNext={() => {
        stopSpeech();
        setReviewError('');
        if (current + 1 < queue.length) setCurrent(c => c + 1);
        else finish();
      }}
      nextLabel={current + 1 < queue.length ? 'Câu tiếp' : 'Hoàn tất'}
      underlineKey={q.savedId}
      onUnderlineChange={onUnderlineChange}
      underlines={underlines}
      sentenceNotes={sentenceNotes} onNoteChange={onNoteChange}
      hideNotesInitially={!notesShown} onNotesShownChange={setNotesShown}
    />
    {reviewError && <p role="alert" className="text-[var(--sb-berry-text)] font-semibold text-sm animate-fade-in">{reviewError}</p>}
    <div className="flex justify-between gap-3">
      <button onClick={finish} className="vm-btn px-4 py-2 bg-[var(--sb-paper-card)] border-2 border-[var(--sb-ink-border)] hover:bg-[var(--sb-paper-deep)] text-[var(--sb-ink)] rounded-xl font-semibold">Kết thúc phiên</button>
    </div>
  </div>;
}
