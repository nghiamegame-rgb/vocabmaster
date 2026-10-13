import { useState, useMemo } from 'react';
import {
  Brain, CheckCircle2, XCircle, ChevronRight,
  RotateCcw, Star, Zap, Clock, ChevronDown, ChevronUp, Book, BarChart2
} from 'lucide-react';
import { isGrammarDueForReview } from '../../utils/grammarStorage';
import { getTopicLabel } from '../../utils/grammarPrompt';

const OPTION_KEYS = ['A', 'B', 'C', 'D'];

/**
 * GrammarReview — Spaced repetition review for saved questions.
 * Answers are hidden until user selects an option.
 * Tracks review level independently (L1–L5, separate from Vocabulary levels).
 */
export default function GrammarReview({
  savedQuestions,
  reviewProgress,
  onRecordReview,
}) {
  const [mode,        setMode]        = useState('select'); // 'select'|'session'|'done'
  const [reviewMode,  setReviewMode]  = useState('due');    // 'due'|'wrong'|'all'
  const [queue,       setQueue]       = useState([]);
  const [current,     setCurrent]     = useState(0);
  const [answers,     setAnswers]     = useState({});
  const [showAnswer,  setShowAnswer]  = useState({});
  const [showDetail,  setShowDetail]  = useState({});       // { [idx]: bool }
  const [sessionResult, setSessionResult] = useState(null);

  // ── Compute available questions ───────────────────────────────────────────
  const dueQuestions   = useMemo(() =>
    savedQuestions.filter(q => isGrammarDueForReview(reviewProgress[q.savedId])),
    [savedQuestions, reviewProgress]
  );
  const wrongQuestions = useMemo(() =>
    savedQuestions.filter(q => (reviewProgress[q.savedId]?.wrongCount ?? 0) > 0),
    [savedQuestions, reviewProgress]
  );

  function getQueue() {
    if (reviewMode === 'due')   return dueQuestions;
    if (reviewMode === 'wrong') return wrongQuestions;
    return savedQuestions;
  }

  function startSession() {
    const q = getQueue();
    if (q.length === 0) return;
    // Shuffle
    const shuffled = [...q].sort(() => Math.random() - 0.5);
    setQueue(shuffled);
    setCurrent(0);
    setAnswers({});
    setShowAnswer({});
    setShowDetail({});
    setSessionResult(null);
    setMode('session');
  }

  // ── Answer ────────────────────────────────────────────────────────────────
  function handleAnswer(idx, option) {
    if (answers[idx] !== undefined) return;
    const q = queue[idx];
    const correct = option === q.answer;
    setAnswers(prev => ({ ...prev, [idx]: option }));
    setShowAnswer(prev => ({ ...prev, [idx]: true }));
    onRecordReview(q.savedId, correct);
  }

  function finishSession() {
    const correct = Object.entries(answers).filter(([i, a]) => queue[i]?.answer === a).length;
    setSessionResult({ correct, total: queue.length });
    setMode('done');
  }

  // ── Review level label ────────────────────────────────────────────────────
  function getLevelBadge(savedId) {
    const rec = reviewProgress[savedId];
    const l = rec?.level ?? 1;
    const colors = ['', 'bg-rose-600/20 text-rose-300', 'bg-amber-600/20 text-amber-300',
      'bg-yellow-600/20 text-yellow-300', 'bg-emerald-600/20 text-emerald-300', 'bg-indigo-600/20 text-indigo-300'];
    return (
      <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${colors[l] || colors[1]}`}>
        Review L{l}
      </span>
    );
  }

  // ── Mode: Select ──────────────────────────────────────────────────────────
  if (mode === 'select') {
    const stats = [
      { label: '⚡ Đến hạn ôn',      count: dueQuestions.length,   key: 'due',   color: 'from-purple-600 to-indigo-600' },
      { label: '❌ Đã sai',           count: wrongQuestions.length, key: 'wrong', color: 'from-rose-600 to-pink-600' },
      { label: '📚 Tất cả đã lưu',   count: savedQuestions.length, key: 'all',   color: 'from-slate-600 to-slate-700' },
    ];

    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-lg shadow-rose-500/20">
            <Brain size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Grammar Review</h2>
            <p className="text-slate-400 text-sm">Spaced repetition — ôn tập thông minh</p>
          </div>
        </div>

        {savedQuestions.length === 0 ? (
          <div className="text-center py-16">
            <Brain size={48} className="text-slate-700 mx-auto mb-4" />
            <h3 className="text-slate-400 font-medium mb-2">Chưa có câu hỏi nào để ôn</h3>
            <p className="text-slate-600 text-sm">Lưu câu hỏi trong khi luyện tập để tạo danh sách ôn tập.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              {stats.map(s => (
                <button
                  key={s.key}
                  onClick={() => setReviewMode(s.key)}
                  className={`p-4 rounded-2xl border-2 text-left transition-all duration-200 ${
                    reviewMode === s.key
                      ? 'border-purple-500 bg-purple-500/10'
                      : 'border-slate-700 bg-slate-900/60 hover:border-slate-600'
                  }`}
                >
                  <div className={`text-2xl font-black bg-gradient-to-br ${s.color} bg-clip-text text-transparent`}>
                    {s.count}
                  </div>
                  <div className="text-slate-400 text-xs mt-1">{s.label}</div>
                </button>
              ))}
            </div>

            {/* SRS explanation */}
            <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-2xl p-4">
              <h4 className="text-indigo-400 font-semibold text-sm mb-2 flex items-center gap-2">
                <Clock size={14} /> Spaced Repetition — Lặp lại ngắt quãng
              </h4>
              <p className="text-slate-400 text-sm mb-2">
                Mỗi câu hỏi có <strong className="text-white">Level Ôn</strong> riêng (L1→L5), độc lập với Vocabulary.
              </p>
              <div className="grid grid-cols-5 gap-2 text-center">
                {[1,2,3,4,5].map(l => {
                  const intervals = {1:1,2:3,3:7,4:14,5:30};
                  return (
                    <div key={l} className="bg-slate-800 rounded-lg p-2">
                      <div className="text-white font-bold text-sm">L{l}</div>
                      <div className="text-slate-400 text-xs">{intervals[l]}n</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              onClick={startSession}
              disabled={getQueue().length === 0}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl text-base font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-500/20 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Zap size={18} />
              Bắt đầu ôn tập ({getQueue().length} câu)
            </button>
          </>
        )}
      </div>
    );
  }

  // ── Mode: Done ────────────────────────────────────────────────────────────
  if (mode === 'done') {
    const pct = sessionResult ? Math.round((sessionResult.correct / sessionResult.total) * 100) : 0;
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-6 animate-fade-in">
        <div className={`w-24 h-24 rounded-full flex items-center justify-center text-3xl font-black shadow-2xl ${
          pct >= 80 ? 'bg-gradient-to-br from-emerald-500 to-green-600 shadow-emerald-500/30'
          : pct >= 60 ? 'bg-gradient-to-br from-amber-500 to-yellow-600 shadow-amber-500/30'
          : 'bg-gradient-to-br from-rose-500 to-red-600 shadow-rose-500/30'
        }`}>
          {pct}%
        </div>
        <div className="text-center">
          <h3 className="text-2xl font-bold text-white mb-1">
            {pct >= 80 ? '🎉 Ôn tập tốt!' : pct >= 60 ? '👍 Khá tốt!' : '📖 Cần ôn thêm!'}
          </h3>
          <p className="text-slate-400">
            Đúng <span className="text-white font-bold">{sessionResult?.correct}</span> / {sessionResult?.total} câu
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setMode('select')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-all duration-200"
          >
            <RotateCcw size={16} /> Chọn lại
          </button>
          <button
            onClick={startSession}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-500/20 transition-all duration-200"
          >
            <Zap size={16} /> Ôn tiếp
          </button>
        </div>
      </div>
    );
  }

  // ── Mode: Session ─────────────────────────────────────────────────────────
  const q = queue[current];
  const isAnswered = answers[current] !== undefined;
  const userAnswer = answers[current];
  const isCorrect  = isAnswered && userAnswer === q.answer;
  const correctCount = Object.entries(answers).filter(([i, a]) => queue[i]?.answer === a).length;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Progress */}
      <div className="flex items-center gap-3">
        <span className="text-slate-400 text-sm shrink-0">{current + 1} / {queue.length}</span>
        <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-rose-600 to-pink-500 rounded-full progress-fill"
            style={{ width: `${((current + 1) / queue.length) * 100}%` }}
          />
        </div>
        <span className="text-slate-400 text-sm shrink-0">{correctCount}/{Object.keys(answers).length} đúng</span>
      </div>

      {/* Card */}
      <div className="bg-slate-900/80 border border-slate-700/50 rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-lg bg-purple-600/20 text-purple-300 text-xs font-semibold border border-purple-500/20">
            {getTopicLabel(q.topic)}
          </span>
          {getLevelBadge(q.savedId)}
          {q.hardMarked && <Star size={14} className="text-amber-400" fill="currentColor" />}
        </div>

        {/* Sentence */}
        <div className="text-lg text-white leading-relaxed font-medium">
          {q.sentence.replace('_____', showAnswer[current]
            ? `[${q.options[q.answer]}]`
            : '_____'
          )}
        </div>

        {/* Options */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {OPTION_KEYS.map(key => {
            let cls = 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white';
            if (isAnswered) {
              if (key === q.answer) cls = 'bg-emerald-600/15 border-emerald-500 text-emerald-300';
              else if (key === userAnswer) cls = 'bg-rose-600/15 border-rose-500 text-rose-300';
              else cls = 'bg-slate-800 border-slate-700/30 text-slate-500 opacity-50';
            }
            return (
              <button
                key={key}
                onClick={() => handleAnswer(current, key)}
                disabled={isAnswered}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium text-left transition-all duration-200 ${cls}`}
              >
                <span className="w-6 h-6 rounded-full bg-slate-700 text-xs font-bold flex items-center justify-center shrink-0">{key}</span>
                <span className="flex-1">{q.options[key]}</span>
                {q.optionLabels?.[key] && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-slate-700/70 text-slate-400 font-mono shrink-0">
                    {q.optionLabels[key]}
                  </span>
                )}
                {isAnswered && key === q.answer && <CheckCircle2 size={16} className="ml-auto text-emerald-400 shrink-0" />}
                {isAnswered && key === userAnswer && key !== q.answer && <XCircle size={16} className="ml-auto text-rose-400 shrink-0" />}
              </button>
            );
          })}
        </div>

        {/* Explanation after answer */}
        {isAnswered && (
          <div className={`rounded-xl border p-4 space-y-3 animate-fade-in ${
            isCorrect ? 'bg-emerald-500/5 border-emerald-500/25' : 'bg-rose-500/5 border-rose-500/25'
          }`}>
            <div className="flex items-center gap-2">
              {isCorrect ? <CheckCircle2 size={16} className="text-emerald-400" /> : <XCircle size={16} className="text-rose-400" />}
              <span className={`text-sm font-semibold ${isCorrect ? 'text-emerald-300' : 'text-rose-300'}`}>
                {isCorrect ? 'Chính xác! 🎉' : `Sai — Đáp án: ${q.answer}. ${q.options[q.answer]}`}
              </span>
            </div>

            {/* Short explanation */}
            <p className="text-slate-300 text-sm leading-relaxed">{q.shortExplanation}</p>

            {q.vietnameseSentence && (
              <p className="text-slate-500 text-xs italic border-l-2 border-slate-700 pl-3">{q.vietnameseSentence}</p>
            )}

            {/* Expandable detailed explanation */}
            {q.detailedExplanation && (
              <div>
                <button
                  onClick={() => setShowDetail(p => ({ ...p, [current]: !p[current] }))}
                  className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 text-xs font-semibold transition-colors"
                >
                  {showDetail[current] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  {showDetail[current] ? 'Ẩn giải thích chi tiết' : 'Xem giải thích chi tiết'}
                </button>

                {showDetail[current] && (
                  <div className="mt-3 space-y-3 animate-fade-in">
                    {/* Why correct */}
                    <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-3">
                      <p className="text-emerald-400 text-xs font-semibold mb-1.5">✅ Tại sao {q.answer} đúng</p>
                      <p className="text-slate-300 text-sm">{q.detailedExplanation.whyCorrect}</p>
                    </div>

                    {/* Why wrong */}
                    <div className="space-y-2">
                      {OPTION_KEYS.filter(k => k !== q.answer).map(k => (
                        <div key={k} className="bg-rose-500/5 border border-rose-500/10 rounded-xl p-3">
                          <p className="text-rose-400 text-xs font-semibold mb-1">❌ {k} — {q.options[k]}</p>
                          <p className="text-slate-400 text-sm">{q.detailedExplanation[`whyWrong${k}`] || '—'}</p>
                        </div>
                      ))}
                    </div>

                    {/* Grammar rules */}
                    {Array.isArray(q.detailedExplanation.grammarRules) && q.detailedExplanation.grammarRules.length > 0 && (
                      <div className="bg-indigo-500/5 border border-indigo-500/15 rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Book size={14} className="text-indigo-400" />
                          <p className="text-indigo-400 text-xs font-semibold">Quy tắc ngữ pháp</p>
                        </div>
                        <ul className="space-y-1">
                          {q.detailedExplanation.grammarRules.map((r, i) => (
                            <li key={i} className="text-slate-300 text-sm flex items-start gap-2">
                              <span className="text-indigo-400 shrink-0">▸</span>{r}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Key vocabulary */}
                    {Array.isArray(q.detailedExplanation.keyVocabulary) && q.detailedExplanation.keyVocabulary.length > 0 && (
                      <div className="bg-purple-500/5 border border-purple-500/15 rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <BarChart2 size={14} className="text-purple-400" />
                          <p className="text-purple-400 text-xs font-semibold">Từ vựng quan trọng</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {q.detailedExplanation.keyVocabulary.map((w, idx) => (
                            <div key={idx} className="flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-1.5">
                              <span className="text-white text-sm font-medium">{w.word}</span>
                              <span className="text-slate-400 text-xs">—</span>
                              <span className="text-slate-300 text-xs">{w.meaning}</span>
                              {w.type && <span className="text-purple-400 text-xs">({w.type})</span>}
                            </div>
                          ))}
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
          onClick={() => setCurrent(c => Math.max(0, c - 1))}
          disabled={current === 0}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ← Trước
        </button>

        {current < queue.length - 1 ? (
          <button
            onClick={() => setCurrent(c => c + 1)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white shadow-lg shadow-rose-500/20 transition-all duration-200"
          >
            Tiếp <ChevronRight size={16} />
          </button>
        ) : (
          <button
            onClick={finishSession}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/20 transition-all duration-200"
          >
            Kết thúc <ChevronRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
