import { useState } from 'react';
import GrammarSentenceCard from './GrammarAnalysis';

export default function GrammarQuiz({ questions, config, isQuestionSaved, onSave, onUnsave, savedQuestions, onFinish }) {
  const [current, setCurrent] = useState(0);
  const [visit, setVisit] = useState(0);
  const [seen, setSeen] = useState({});
  const [finished, setFinished] = useState(false);
  const q = questions[current];
  const total = Object.keys(seen).length;

  function navigate(index) {
    setCurrent(index);
    setVisit(v => v + 1);
  }
  function finish() {
    if (finished) return;
    onFinish({ mode: 'sentence-analysis', activity: 'practice', total, topic: config.topic });
    setFinished(true);
  }
  if (finished) return <div className="text-center py-12 space-y-4">
    <h3 className="text-2xl text-white font-bold">Đã kết thúc luyện tập</h3>
    <p className="text-slate-400">Đã xem phân tích {total}/{questions.length} câu.</p>
    <button onClick={() => onFinish({ goBack: true })} className="px-5 py-3 bg-purple-600 text-white rounded-xl">Tạo bộ câu mới</button>
  </div>;
  const saved = isQuestionSaved(q.sentence);
  return <div className="space-y-4">
    <div className="flex items-center justify-between gap-3 text-slate-400 text-sm">
      <span>Câu {current + 1}/{questions.length} · Đã phân tích {total}</span>
      <button className="px-3 py-2 rounded-lg bg-slate-800 text-amber-300" onClick={() => {
        if (saved) {
          const record = savedQuestions.find(s => s.sentence?.trim().toLowerCase() === q.sentence.trim().toLowerCase());
          if (record) onUnsave(record.savedId);
        } else onSave(q);
      }}>{saved ? 'Bỏ lưu' : 'Lưu câu'}</button>
    </div>
    <GrammarSentenceCard key={visit} question={q} onReveal={() => setSeen(prev => ({ ...prev, [current]: true }))} />
    <div className="flex justify-between gap-3">
      <button disabled={current === 0} onClick={() => navigate(current - 1)} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 disabled:opacity-30">Câu trước</button>
      <button onClick={() => current < questions.length - 1 ? navigate(current + 1) : finish()} className="px-4 py-2 rounded-xl bg-purple-600 text-white">{current < questions.length - 1 ? 'Câu tiếp' : 'Kết thúc'}</button>
    </div>
    <div className="flex flex-wrap justify-center gap-2">{questions.map((_, i) => <button key={i} onClick={() => navigate(i)} aria-label={`Đến câu ${i + 1}`} aria-current={i === current ? 'step' : undefined}
      className={`w-8 h-8 rounded-full text-xs text-white ${seen[i] ? 'bg-indigo-600' : 'bg-slate-700'} ${i === current ? 'ring-2 ring-purple-400' : ''}`}>{i + 1}</button>)}</div>
  </div>;
}
