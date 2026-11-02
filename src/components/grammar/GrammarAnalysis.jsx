import { useState, useCallback } from 'react';
import { getTopicLabel } from '../../utils/grammarPrompt';
import { getGrammarSentence, getQuickGrammarPoints, isSentenceAnalysis } from '../../utils/grammarSentence';
import { getUnderlinesForKey, saveUnderlinesForKey } from '../../utils/grammarStorage';
import { applyUnderline, textKey } from '../../utils/sentenceUnderline';
import GrammarReadingNotes from './GrammarReadingNotes';
import UnderlinedSentence from './UnderlinedSentence';

export function GrammarAnalysis({ question: q, onQuickAdd, analysisTopic }) {
  const detail = q.detailedExplanation;
  const points = isSentenceAnalysis(q) ? getQuickGrammarPoints(q, analysisTopic) : [];
  return <div className="space-y-4 text-sm text-slate-300 leading-relaxed break-words">
    <p className="text-slate-400 italic">{q.vietnameseSentence}</p>
    {isSentenceAnalysis(q) ? <>
      <section className="space-y-2">
        <h4 className="text-purple-300 font-semibold">Giải thích nhanh</h4>
        {points.length ? <ul className="list-disc pl-5 space-y-2">
          {points.map((point, i) => <li key={i}><span className="text-white font-medium">"{point.phrase}"</span>: {point.explanation}</li>)}
        </ul> : <p className="text-slate-400">Bản ghi này chưa có giải thích phù hợp với chủ đề đang chọn.</p>}
      </section>
      <GrammarReadingNotes question={q} onQuickAdd={onQuickAdd} />
    </> : <>
      <p className="text-purple-300">Chủ đề chính: {getTopicLabel(q.topic)}</p>
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

/**
 * GrammarSentenceCard — sentence display with underline support.
 *
 * underlineKey: stable key for this sentence's underlines.
 *   - savedId when the sentence is in the saved library
 *   - textKey(sentence) for unsaved practice sentences
 * onUnderlineChange: (key, start, end, color) => void — from useGrammarStore
 */
// Mount with a key per sentence/navigation to reset the reveal state.
export default function GrammarSentenceCard({
  question, onReveal, onAssess, assessed, onQuickAdd, onNext, nextLabel = 'Câu tiếp', analysisTopic,
  underlineKey, onUnderlineChange,
}) {
  const [shown, setShown] = useState(false);

  // Load underline segments for this key (re-reads on each render, which is fine
  // since saves are synchronous localStorage ops and component re-renders after change).
  const segments = underlineKey ? getUnderlinesForKey(underlineKey) : [];

  const handleUnderlineChange = useCallback((start, end, color) => {
    if (!underlineKey || !onUnderlineChange) return;
    onUnderlineChange(underlineKey, start, end, color);
  }, [underlineKey, onUnderlineChange]);

  const sentence = getGrammarSentence(question);

  return <div className="bg-slate-900/80 border border-slate-700/50 rounded-2xl p-4 sm:p-6 space-y-4">
    <UnderlinedSentence
      sentence={sentence}
      segments={segments}
      onUnderlineChange={handleUnderlineChange}
      className="text-lg text-white leading-relaxed break-words"
      readOnly={!underlineKey || !onUnderlineChange}
    />
    {(onAssess || onNext) && <div className="flex flex-wrap gap-2">
      {onAssess && [true, false].map(understood => <button key={String(understood)} type="button" disabled={assessed !== undefined}
        onClick={() => onAssess(understood)}
        className={`px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 ${understood ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500'} text-white`}>
        {understood ? 'Đã hiểu' : 'Cần ôn lại'}{assessed === understood ? ' ✓' : ''}
      </button>)}
      {onNext && <button type="button" onClick={onNext} className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold">{nextLabel}</button>}
    </div>}
    <button type="button" aria-expanded={shown} onClick={() => {
      if (!shown) onReveal?.();
      setShown(v => !v);
    }} className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold">
      {shown ? 'Ẩn phân tích' : 'Hiện phân tích'}
    </button>
    {shown && <>
      <GrammarAnalysis question={question} onQuickAdd={onQuickAdd} analysisTopic={analysisTopic} />
      {question.userNotes && <p className="text-amber-200 text-sm whitespace-pre-wrap break-words">Ghi chú: {question.userNotes}</p>}
    </>}
  </div>;
}
