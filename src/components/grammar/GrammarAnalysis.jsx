import { useState } from 'react';
import { getTopicLabel } from '../../utils/grammarPrompt';
import { getGrammarSentence, isSentenceAnalysis } from '../../utils/grammarSentence';
import GrammarReadingNotes from './GrammarReadingNotes';

export function GrammarAnalysis({ question: q, onQuickAdd }) {
  const detail = q.detailedExplanation;
  const structureCategory = 'Sentence Structure & Word Order';
  const structurePoints = isSentenceAnalysis(q) ? q.grammarPoints.filter(point => point.category === structureCategory) : [];
  return <div className="space-y-4 text-sm text-slate-300 leading-relaxed break-words">
    <p className="text-slate-400 italic">{q.vietnameseSentence}</p>
    {structurePoints.length > 0 && <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-3 space-y-1">
      <p className="text-indigo-300 font-semibold">{getTopicLabel(structureCategory)}</p>
      {structurePoints.map((point, i) => <div key={i} className="space-y-1">
        <p className="text-white font-medium">“{point.phrase}”</p>
        <p>{point.explanation}</p>
      </div>)}
    </div>}
    <p className="text-purple-300">Chủ đề chính: {getTopicLabel(q.topic)}</p>
    {isSentenceAnalysis(q) ? <>
      {q.grammarPoints.filter(point => point.category !== structureCategory).map((point, i) => <div key={i} className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-3 space-y-1">
        <p className="text-indigo-300 font-semibold">{getTopicLabel(point.category)}</p>
        <p className="text-white font-medium">“{point.phrase}”</p>
        <p>{point.explanation}</p>
      </div>)}
      {q.structures?.length > 0 && <div>
        <p className="text-purple-300 font-semibold mb-1">Cấu trúc quan trọng</p>
        <ul className="list-disc pl-5 space-y-1">{q.structures.map((s, i) => <li key={i}>{s}</li>)}</ul>
      </div>}
      <GrammarReadingNotes question={q} onQuickAdd={onQuickAdd} />
    </> : <>
      <p className="text-amber-300 text-xs">Bản ghi TOEIC cũ · giữ nguyên dữ liệu gốc</p>
      <p>{q.shortExplanation}</p>
      {detail?.whyCorrect && <p>{detail.whyCorrect}</p>}
      {q.options && <div className="space-y-2">{['A', 'B', 'C', 'D'].map(k => <div key={k}>
        <p className={k === q.answer ? 'text-emerald-300' : 'text-slate-400'}>{k}. {q.options[k]}{k === q.answer ? ' ✓' : ''}</p>
        {detail?.[`whyWrong${k}`] && <p>{detail[`whyWrong${k}`]}</p>}
      </div>)}</div>}
      {detail?.grammarRules?.map((r, i) => <p key={i}>• {r}</p>)}
      {detail?.keyVocabulary?.map((w, i) => <p key={i}>{w.word} — {w.meaning}</p>)}
    </>}
  </div>;
}

// Mount with a key per sentence/navigation to reset the reveal state.
export default function GrammarSentenceCard({ question, onReveal, onAssess, assessed, onQuickAdd }) {
  const [shown, setShown] = useState(false);
  return <div className="bg-slate-900/80 border border-slate-700/50 rounded-2xl p-4 sm:p-6 space-y-4">
    <p className="text-lg text-white leading-relaxed break-words">{getGrammarSentence(question)}</p>
    <button type="button" aria-expanded={shown} onClick={() => {
      if (!shown) onReveal?.();
      setShown(v => !v);
    }} className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold">
      {shown ? 'Ẩn phân tích' : 'Hiện phân tích'}
    </button>
    {shown && <>
      <GrammarAnalysis question={question} onQuickAdd={onQuickAdd} />
      {question.userNotes && <p className="text-amber-200 text-sm whitespace-pre-wrap break-words">Ghi chú: {question.userNotes}</p>}
      {onAssess && <div className="flex flex-wrap gap-2">
        {[true, false].map(understood => <button key={String(understood)} type="button" disabled={assessed !== undefined}
          onClick={() => onAssess(understood)}
          className={`px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 ${understood ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500'} text-white`}>
          {understood ? 'Đã hiểu' : 'Cần ôn lại'}{assessed === understood ? ' ✓' : ''}
        </button>)}
      </div>}
    </>}
  </div>;
}
