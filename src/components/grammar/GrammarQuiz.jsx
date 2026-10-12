import { useState } from 'react';
import {
  ChevronRight, ChevronLeft, Bookmark, BookmarkCheck,
  ChevronDown, ChevronUp, CheckCircle2, XCircle,
  Book, BarChart2, ArrowRight, RotateCcw, PlusCircle
} from 'lucide-react';

const OPTION_KEYS = ['A', 'B', 'C', 'D'];

/**
 * GrammarQuiz — renders questions one by one with explanation reveal.
 * Props:
 *   questions        {object[]}   — normalized question array
 *   config           {object}     — { count, difficulty, topic }
 *   isQuestionSaved  {Function}   — (sentence) => boolean
 *   onSave           {Function}   — (question) => 'saved'|'duplicate'
 *   onUnsave         {Function}   — (savedId) => void (we don't have savedId here, use sentence)
 *   savedQuestions   {object[]}   — to find savedId
 *   onFinish         {Function}   — ({ correct, total, topic, difficulty }) => void
 *   onAddToVocab     {Function}   — (word) => void
 */
export default function GrammarQuiz({
  questions,
  config,
  isQuestionSaved,
  onSave,
  onUnsave,
  savedQuestions,
  onFinish,
  onAddToVocab,
}) {
  const [current,      setCurrent]      = useState(0);
  const [answers,      setAnswers]      = useState({}); // { [index]: 'A'|'B'|'C'|'D' }
  const [showDetail,   setShowDetail]   = useState({});
  const [saveNotice,   setSaveNotice]   = useState({});
  const [vocabNotice,  setVocabNotice]  = useState({});
  const [finished,     setFinished]     = useState(false);

  const q = questions[current];
  const answered = answers[current] !== undefined;
  const userAnswer = answers[current];
  const isCorrect  = answered && userAnswer === q.answer;

  const correctCount = Object.entries(answers).filter(([i, a]) => questions[i]?.answer === a).length;
  const totalAnswered = Object.keys(answers).length;

  // ── Save/Unsave ──────────────────────────────────────────────────────────
  function getSavedId(sentence) {
    return savedQuestions.find(s => s.sentence?.trim() === sentence?.trim())?.savedId;
  }

  function handleToggleSave() {
    const saved = isQuestionSaved(q.sentence);
    if (saved) {
      const sid = getSavedId(q.sentence);
      if (sid) onUnsave(sid);
      setSaveNotice(p => ({ ...p, [current]: 'unsaved' }));
    } else {
      const result = onSave({ ...q });
      setSaveNotice(p => ({ ...p, [current]: result }));
    }
    setTimeout(() => setSaveNotice(p => { const n = {...p}; delete n[current]; return n; }), 2000);
  }

  // ── Answer ───────────────────────────────────────────────────────────────
  function handleAnswer(option) {
    if (answered) return;
    setAnswers(prev => ({ ...prev, [current]: option }));
  }

  // ── Navigation ───────────────────────────────────────────────────────────
  function goNext() {
    if (current < questions.length - 1) {
      setCurrent(c => c + 1);
    } else {
      handleFinish();
    }
  }
  function goPrev() {
    if (current > 0) setCurrent(c => c - 1);
  }

  function handleFinish() {
    onFinish({
      correct: correctCount,
      total:   questions.length,
      topic:   config.topic,
      difficulty: config.difficulty,
    });
    setFinished(true);
  }

  // ── Add word to Vocab ────────────────────────────────────────────────────
  function handleAddVocab(word, idx) {
    const result = onAddToVocab({ english: word.word, vietnamese: word.meaning, wordType: word.type || 'Phrase' });
    setVocabNotice(p => ({ ...p, [`${current}_${idx}`]: result === false ? 'duplicate' : 'added' }));
    setTimeout(() => setVocabNotice(p => { const n={...p}; delete n[`${current}_${idx}`]; return n; }), 2000);
  }

  // ── Finished Screen ──────────────────────────────────────────────────────
  if (finished) {
    const pct = Math.round((correctCount / questions.length) * 100);
    return (
      <div className="flex flex-col items-center justify-center py-12 animate-fade-in space-y-6">
        <div className={`w-24 h-24 rounded-full flex items-center justify-center text-3xl font-black shadow-2xl ${
          pct >= 80 ? 'bg-gradient-to-br from-emerald-500 to-green-600 shadow-emerald-500/30'
          : pct >= 60 ? 'bg-gradient-to-br from-amber-500 to-yellow-600 shadow-amber-500/30'
          : 'bg-gradient-to-br from-rose-500 to-red-600 shadow-rose-500/30'
        }`}>
          {pct}%
        </div>
        <div className="text-center">
          <h3 className="text-2xl font-bold text-white mb-1">
            {pct >= 80 ? '🎉 Xuất sắc!' : pct >= 60 ? '👍 Tốt lắm!' : '📚 Cần ôn thêm!'}
          </h3>
          <p className="text-slate-400">
            Đúng <span className="text-white font-bold">{correctCount}</span> / {questions.length} câu
            &nbsp;·&nbsp; Chủ đề: <span className="text-purple-400">{config.topic}</span>
            &nbsp;·&nbsp; Độ khó: <span className="text-indigo-400">{config.difficulty}</span>
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => { setFinished(false); setCurrent(0); setAnswers({}); setShowDetail({}); }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-all duration-200"
          >
            <RotateCcw size={16} /> Làm lại
          </button>
          <button
            onClick={() => onFinish({ correct: correctCount, total: questions.length, topic: config.topic, difficulty: config.difficulty, goBack: true })}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-500/20 transition-all duration-200"
          >
            <ArrowRight size={16} /> Tạo bộ câu mới
          </button>
        </div>

        {/* Quick review of wrong answers */}
        {correctCount < questions.length && (
          <div className="w-full max-w-2xl">
            <h4 className="text-slate-400 text-sm font-medium mb-3">Câu trả lời sai:</h4>
            <div className="space-y-2">
              {questions.map((q2, i) => {
                const ua = answers[i];
                if (ua === q2.answer) return null;
                return (
                  <div key={i} className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-3 text-sm">
                    <p className="text-slate-300 mb-1">{q2.sentence.replace('_____', `[${q2.options[q2.answer]}]`)}</p>
                    <p className="text-rose-400">Bạn chọn: {ua ? `${ua}. ${q2.options[ua]}` : 'Chưa trả lời'} &nbsp;→&nbsp;
                      <span className="text-emerald-400">Đáp án: {q2.answer}. {q2.options[q2.answer]}</span>
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Question render ──────────────────────────────────────────────────────
  const isSaved = isQuestionSaved(q.sentence);
  const notice  = saveNotice[current];
  const detail  = q.detailedExplanation;

  // Format sentence with styled blank
  const parts = q.sentence.split('_____');

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <span className="text-slate-400 text-sm shrink-0">{current + 1} / {questions.length}</span>
        <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-600 to-indigo-500 rounded-full progress-fill"
            style={{ width: `${((current + 1) / questions.length) * 100}%` }}
          />
        </div>
        <span className="text-slate-400 text-sm shrink-0">
          {correctCount}/{totalAnswered} đúng
        </span>
      </div>

      {/* Question card */}
      <div className="bg-slate-900/80 border border-slate-700/50 rounded-2xl p-6 space-y-5">
        {/* Meta */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-purple-600/20 text-purple-300 text-xs font-semibold border border-purple-500/20">
              {q.topic}
            </span>
            <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${
              q.difficulty === 'Easy'   ? 'bg-emerald-600/15 text-emerald-300 border-emerald-500/20'
              : q.difficulty === 'Hard' ? 'bg-rose-600/15 text-rose-300 border-rose-500/20'
              : 'bg-amber-600/15 text-amber-300 border-amber-500/20'
            }`}>
              {q.difficulty === 'Easy' ? 'Dễ' : q.difficulty === 'Hard' ? 'Khó' : 'Vừa'}
            </span>
          </div>
          {/* Bookmark */}
          <button
            onClick={handleToggleSave}
            title={isSaved ? 'Bỏ lưu' : 'Lưu câu hỏi này'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
              isSaved
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'bg-slate-800 text-slate-400 hover:text-amber-300 hover:bg-amber-500/10 border border-transparent hover:border-amber-500/20'
            }`}
          >
            {isSaved ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
            {notice === 'saved'     ? 'Đã lưu!'
             : notice === 'duplicate' ? 'Đã có!'
             : notice === 'unsaved'   ? 'Đã xoá!'
             : isSaved ? 'Đã lưu' : 'Lưu'}
          </button>
        </div>

        {/* Sentence */}
        <div className="text-lg text-white leading-relaxed font-medium">
          {parts[0]}
          <span className="inline-block px-3 py-0.5 mx-1 rounded-lg bg-purple-600/20 border border-purple-500/40 text-purple-300 font-bold min-w-[80px] text-center">
            {answered ? q.options[q.answer] : '_____'}
          </span>
          {parts[1]}
        </div>

        {/* Vietnamese */}
        <p className="text-slate-400 text-sm italic border-l-2 border-slate-700 pl-3">
          {q.vietnameseSentence}
        </p>

        {/* Options */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {OPTION_KEYS.map(key => {
            let cls = 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white';
            if (answered) {
              if (key === q.answer) cls = 'bg-emerald-600/15 border-emerald-500 text-emerald-300';
              else if (key === userAnswer && key !== q.answer) cls = 'bg-rose-600/15 border-rose-500 text-rose-300';
              else cls = 'bg-slate-800 border-slate-700/30 text-slate-500 opacity-60';
            } else if (userAnswer === key) {
              cls = 'bg-purple-600/15 border-purple-500 text-purple-300';
            }

            return (
              <button
                key={key}
                onClick={() => handleAnswer(key)}
                disabled={answered}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium text-left transition-all duration-200 ${cls}`}
              >
                <span className="w-6 h-6 rounded-full bg-slate-700 text-xs font-bold flex items-center justify-center shrink-0">
                  {key}
                </span>
                {q.options[key]}
                {answered && key === q.answer && <CheckCircle2 size={16} className="ml-auto text-emerald-400" />}
                {answered && key === userAnswer && key !== q.answer && <XCircle size={16} className="ml-auto text-rose-400" />}
              </button>
            );
          })}
        </div>

        {/* Explanation (shown after answer) */}
        {answered && (
          <div className={`rounded-xl border p-4 space-y-3 animate-fade-in ${
            isCorrect
              ? 'bg-emerald-500/5 border-emerald-500/25'
              : 'bg-rose-500/5 border-rose-500/25'
          }`}>
            <div className="flex items-center gap-2">
              {isCorrect
                ? <CheckCircle2 size={18} className="text-emerald-400" />
                : <XCircle size={18} className="text-rose-400" />}
              <span className={`font-semibold text-sm ${isCorrect ? 'text-emerald-300' : 'text-rose-300'}`}>
                {isCorrect ? 'Chính xác! 🎉' : `Sai rồi. Đáp án đúng: ${q.answer}. ${q.options[q.answer]}`}
              </span>
            </div>

            {/* Short explanation */}
            <p className="text-slate-300 text-sm leading-relaxed">{q.shortExplanation}</p>

            {/* View Details toggle */}
            {detail && (
              <div>
                <button
                  onClick={() => setShowDetail(p => ({ ...p, [current]: !p[current] }))}
                  className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 text-xs font-semibold transition-colors"
                >
                  {showDetail[current] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  {showDetail[current] ? 'Ẩn chi tiết' : 'Xem chi tiết giải thích'}
                </button>

                {showDetail[current] && (
                  <div className="mt-3 space-y-3 animate-fade-in">
                    {/* Why correct */}
                    <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-3">
                      <p className="text-emerald-400 text-xs font-semibold mb-1.5">✅ Tại sao {q.answer} đúng</p>
                      <p className="text-slate-300 text-sm">{detail.whyCorrect}</p>
                    </div>

                    {/* Why wrong */}
                    <div className="space-y-2">
                      {OPTION_KEYS.filter(k => k !== q.answer).map(k => (
                        <div key={k} className="bg-rose-500/5 border border-rose-500/10 rounded-xl p-3">
                          <p className="text-rose-400 text-xs font-semibold mb-1">❌ {k} — {q.options[k]}</p>
                          <p className="text-slate-400 text-sm">{detail[`whyWrong${k}`] || '—'}</p>
                        </div>
                      ))}
                    </div>

                    {/* Grammar rules */}
                    {Array.isArray(detail.grammarRules) && detail.grammarRules.length > 0 && (
                      <div className="bg-indigo-500/5 border border-indigo-500/15 rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Book size={14} className="text-indigo-400" />
                          <p className="text-indigo-400 text-xs font-semibold">Quy tắc ngữ pháp</p>
                        </div>
                        <ul className="space-y-1">
                          {detail.grammarRules.map((r, i) => (
                            <li key={i} className="text-slate-300 text-sm flex items-start gap-2">
                              <span className="text-indigo-400 shrink-0">▸</span>{r}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Key vocabulary */}
                    {Array.isArray(detail.keyVocabulary) && detail.keyVocabulary.length > 0 && (
                      <div className="bg-purple-500/5 border border-purple-500/15 rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <BarChart2 size={14} className="text-purple-400" />
                          <p className="text-purple-400 text-xs font-semibold">Từ vựng quan trọng</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {detail.keyVocabulary.map((w, idx) => {
                            const vn = vocabNotice[`${current}_${idx}`];
                            return (
                              <div key={idx} className="flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-1.5">
                                <span className="text-white text-sm font-medium">{w.word}</span>
                                <span className="text-slate-400 text-xs">—</span>
                                <span className="text-slate-300 text-xs">{w.meaning}</span>
                                {w.type && <span className="text-purple-400 text-xs">({w.type})</span>}
                                <button
                                  onClick={() => handleAddVocab(w, idx)}
                                  title="Thêm vào Vocabulary"
                                  className={`ml-1 flex items-center gap-1 text-xs px-2 py-0.5 rounded-md transition-all duration-200 ${
                                    vn === 'added'     ? 'bg-emerald-600/20 text-emerald-400'
                                    : vn === 'duplicate' ? 'bg-amber-600/20 text-amber-400'
                                    : 'bg-slate-700 text-slate-400 hover:text-purple-300 hover:bg-purple-600/20'
                                  }`}
                                >
                                  <PlusCircle size={12} />
                                  {vn === 'added' ? 'Đã thêm' : vn === 'duplicate' ? 'Có rồi' : 'Vocab'}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={goPrev}
          disabled={current === 0}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={16} /> Câu trước
        </button>

        {/* Question dots */}
        <div className="flex gap-1.5 flex-wrap justify-center max-w-xs">
          {questions.map((_, i) => {
            const a = answers[i];
            const c = a === questions[i]?.answer;
            return (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`w-6 h-6 rounded-full text-xs font-bold transition-all duration-200 ${
                  i === current ? 'ring-2 ring-purple-500 scale-110' : ''
                } ${
                  a === undefined ? 'bg-slate-700 text-slate-400'
                  : c ? 'bg-emerald-600 text-white'
                  : 'bg-rose-600 text-white'
                }`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>

        <button
          onClick={goNext}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
            current === questions.length - 1
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/20'
              : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-500/20'
          }`}
        >
          {current === questions.length - 1 ? 'Kết thúc' : 'Câu tiếp'}
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
