import { useState, useRef, useEffect } from 'react';
import {
  Brain, ChevronRight, CheckCircle, XCircle,
  RotateCcw, AlertCircle, Trophy, Zap,
  Copy, Check, ClipboardPaste, BookOpen, Volume2,
} from 'lucide-react';
import { playAudio } from '../utils/audio';

/* ------------------------------------------------------------------ */
/* Constants                                                            */
/* ------------------------------------------------------------------ */
const QUESTION_COUNTS = [5, 10, 15, 20];
const DIFFICULTIES    = ['Easy', 'Medium', 'Hard'];
const LEVEL_PRIORITIES = [
  { id: 'all',    label: 'All Levels'       },
  { id: 'l1',     label: 'L1 Only'          },
  { id: 'l1l2',   label: 'L1 & L2'          },
  { id: 'l3l4',   label: 'L3 & L4'          },
  { id: 'l5',     label: 'L5 Mastered'      },
  { id: 'custom', label: 'Custom (Random)'  },
];
const QUIZ_MODES = [
  {
    id:   'vn',
    label:'Vietnamese → English',
    desc: 'Câu tiếng Việt có [_____], chọn từ tiếng Anh phù hợp với ngữ cảnh',
  },
  {
    id:   'toeic',
    label:'TOEIC Fill-in-the-Blank',
    desc: 'Câu văn phong TOEIC thực tế bằng tiếng Việt, điền từ tiếng Anh vào chỗ [_____]',
  },
];

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

/**
 * Shuffle the 4 options of a question while keeping correctIndex in sync.
 * Returns a new question object with shuffled options + updated correctIndex.
 */
function shuffleOptions(q) {
  const correctAnswer = q.options[q.correctIndex];
  // Fisher-Yates shuffle on a copy
  const shuffled = [...q.options];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return {
    ...q,
    options:      shuffled,
    correctIndex: shuffled.indexOf(correctAnswer),
  };
}

/** Shuffle & filter word pool by selected priority */
function buildPool(words, priority, count) {
  let pool = [...words];
  if (priority === 'l1')   pool = words.filter(w => w.level === 1);
  if (priority === 'l1l2') pool = words.filter(w => w.level <= 2);
  if (priority === 'l3l4') pool = words.filter(w => w.level === 3 || w.level === 4);
  if (priority === 'l5')   pool = words.filter(w => w.level === 5);
  if (pool.length < 4)     pool = [...words]; // always fallback to all
  return pool.sort(() => Math.random() - 0.5).slice(0, Math.max(count * 2, 20));
}

/**
 * Build the structured prompt the user will paste into any AI chat.
 * Generates authentic TOEIC fill-in-the-blank sentences:
 *   - "question" is a realistic Vietnamese business/office scenario with [_____] blank
 *   - "options" are exactly 4 English words
 *   - "explanation" is in Vietnamese explaining why the answer fits
 */
function buildPrompt(words, count, difficulty, mode) {
  const diffNote = {
    Easy:   'Dùng ngữ cảnh đơn giản, từ vựng phổ thông, các lựa chọn sai rõ ràng.',
    Medium: 'Dùng ngữ cảnh văn phòng/kinh doanh thực tế, các lựa chọn sai có liên quan.',
    Hard:   'Dùng ngữ cảnh chuyên sâu (tài chính, logistics, HR), các lựa chọn sai rất gần nghĩa, dễ nhầm lẫn.',
  }[difficulty] || '';

  const wordList = words
    .slice(0, 40)
    .map(w => `"${w.english}" (${w.vietnamese})`)
    .join(', ');

  const modeNote = mode === 'toeic'
    ? 'Ưu tiên tạo câu theo đúng cấu trúc đề thi TOEIC Part 5/6 (câu hoàn chỉnh với chỗ trống).'
    : 'Tạo câu mô tả ngữ cảnh sử dụng từ đó trong tiếng Việt, có chỗ trống [_____].';

  return `Bạn là chuyên gia tạo đề thi TOEIC. Nhiệm vụ: tạo chính xác ${count} câu hỏi điền vào chỗ trống.
Độ khó: ${difficulty}. ${diffNote}
${modeNote}

=== QUY TAC TAO CAU — DAY LA PHAN QUAN TRONG NHAT ===

Voi MOI tu vung duoc giao, hay ap dung mau sau de tao cau hoi:
  Ban la chuyen gia tao de thi TOEIC. Nhiem vu cua ban la tao ra MOT cau tieng Viet tu nhien,
  co cho trong [_____] phu hop hoan toan voi tu tieng Anh: '{word}' (Nghia: '{meaning}').

  YEU CAU BAT BUOC:
  1. BOI CANH TOEIC: Cau PHAI mo phong tinh huong thuc te trong TOEIC. Chon ngau nhien
     cac boi canh nhu: email cong ty, thong bao noi bo HR, phan hoi dich vu khach hang,
     thong bao san bay/nha ga, dam phan hop dong, quang cao san pham, hoac tin tuc kinh doanh.
  2. DA DANG: KHONG dung cau truc cau lap di lap lai (vi du: tranh bat dau moi cau bang
     'Cong ty da...' hay 'Nhan vien can...'). Dung cau bi dong, cau dieu kien, hoac menh de
     phuc hop khi phu hop.
  3. NGON NGU TU NHIEN: Ban dich tieng Viet phai nghe chuyen nghiep va tu nhien, giong nhu
     tai lieu kinh doanh thuc su hoac van phong ban ngu.
  4. GOI Y NGU CANH: Ngu canh phai cung cap du manh moi logic de suy ra tu can dien ma
     khong qua don gian.

=== QUY TAC BAT BUOC VE CAU TRUC JSON ===

Truong "question":
  - PHAI la mot cau van TIENG VIET hoan chinh, ap dung dung cac quy tac tao cau phia tren.
  - PHAI chua dung mot cho trong ky hieu la [_____] (nam gach duoi trong ngoac vuong).
  - MOI cau PHAI co boi canh KHAC NHAU (email, thong bao, quang cao, hop dong, v.v.).
  - Dung da dang cau truc cau: chu dong, bi dong, dieu kien, phuc hop.
  - TUYET DOI KHONG bat dau qua 2 cau bang cung mot chu ngu (Cong ty, Nhan vien, v.v.).
  - TUYET DOI KHONG viet kieu "Tu nao co nghia la...?" hoac dang cau hoi dinh nghia.
  - TUYET DOI KHONG de lo tu can dien trong phan cau hoi.
  - KHONG dung tieng Anh trong cau hoi (tru ky hieu [_____]).

Truong "options":
  - Dung 4 tu/cum tu TIENG ANH.
  - Chi 1 dap an dung; 3 con lai phai thuoc cung nhom tu loai de tao suc gay nham.

Truong "explanation":
  - Viet bang TIENG VIET.
  - Giai thich ngan gon tai sao tu dung phu hop voi ngu canh cau.

Truong "wordEnglish":
  - Tu tieng Anh chinh xac duoc kiem tra (dap an dung).

Tu vung can dung: ${wordList}

=== QUY TAC DAU RA ===
- Chi tra ve mot mang JSON hop le. KHONG them van xuoi, KHONG dung markdown, KHONG dung code block.
- Moi phan tu co dung 5 truong: "question", "options", "answerIndex", "explanation", "wordEnglish".
- "answerIndex": chi so 0 cua dap an dung trong mang "options" (0=A, 1=B, 2=C, 3=D).

VI DU MAU — chu y su DA DANG ve boi canh va cau truc cau:
[
  {
    "question": "Hanh khach duoc thong bao rang chuyen bay se khoi hanh theo dung [_____] da dinh.",
    "options": ["schedule", "advantage", "gauge", "competent"],
    "answerIndex": 0,
    "explanation": "'Schedule' (lich trinh) la dap an chinh xac trong boi canh thong bao san bay. Cac lua chon con lai khong phu hop.",
    "wordEnglish": "schedule"
  },
  {
    "question": "Neu bao cao tai chinh quy nay khong duoc [_____] truoc thu Sau, hoi dong quan tri se hoan cuoc hop.",
    "options": ["submitted", "promoted", "allocated", "suspended"],
    "answerIndex": 0,
    "explanation": "'Submitted' (nop/trinh) phu hop voi ngu canh bao cao can duoc nop dung han. Cac lua chon con lai khong di voi hanh dong nop tai lieu.",
    "wordEnglish": "submit"
  }
]

Bay gio hay tao chinh xac ${count} cau hoi theo dung dinh dang tren, dam bao MOI cau co boi canh va cau truc KHAC NHAU:`;
}

/**
 * Parse the AI response — handles:
 *  • Raw JSON arrays
 *  • Markdown fenced blocks (```json … ``` or ``` … ```)
 * Normalises answerIndex / correctIndex → correctIndex used by the quiz engine.
 */
function parseResponse(text) {
  if (!text || !text.trim()) throw new Error('The paste area is empty.');

  let src = text.trim();

  // Strip markdown fences if present
  const fenced = src.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) src = fenced[1].trim();

  // Find the outermost JSON array
  const arrayMatch = src.match(/\[[\s\S]*\]/);
  if (!arrayMatch) {
    throw new Error('No JSON array found. Copy the full AI response and try again.');
  }

  let raw;
  try {
    raw = JSON.parse(arrayMatch[0]);
  } catch {
    throw new Error('JSON is malformed — missing comma, bracket, or quote. Fix and retry.');
  }

  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error('Parsed result is not a valid array of questions.');
  }

  return raw.map((q, i) => {
    if (!q.question) throw new Error(`Question #${i + 1} is missing the "question" field.`);
    if (!Array.isArray(q.options) || q.options.length < 2) {
      throw new Error(`Question #${i + 1} needs an "options" array with at least 2 items.`);
    }
    const correctIndex =
      typeof q.answerIndex  === 'number' ? q.answerIndex  :
      typeof q.correctIndex === 'number' ? q.correctIndex : 0;
    return {
      question:    q.question,
      options:     q.options,
      correctIndex,
      explanation: q.explanation || '',
      wordEnglish: q.wordEnglish || q.options[correctIndex] || '',
    };
  });
}

/* ------------------------------------------------------------------ */
/* Shared: Pill selector                                                */
/* ------------------------------------------------------------------ */
function Pill({ id, label, selected, onClick }) {
  return (
    <button
      id={id}
      onClick={onClick}
      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 border ${
        selected
          ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-500/20'
          : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500 hover:text-white'
      }`}
    >
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Section wrapper                                                      */
/* ------------------------------------------------------------------ */
function Section({ title, children }) {
  return (
    <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5">
      <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">
        {title}
      </h3>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Quiz Config + Prompt Screen                                          */
/* ------------------------------------------------------------------ */
function QuizConfig({ words, onStart }) {
  const [count,    setCount]    = useState(10);
  const [diff,     setDiff]     = useState('Medium');
  const [priority, setPriority] = useState('all');
  const [mode,     setMode]     = useState('vn');

  const [copied,     setCopied]     = useState(false);
  const [jsonPaste,  setJsonPaste]  = useState('');
  const [parseError, setParseError] = useState('');

  const textareaRef = useRef(null);
  const hasWords    = words.length >= 4;

  /* Copy prompt to clipboard */
  function handleCopy() {
    if (!hasWords) return;
    const pool   = buildPool(words, priority, count);
    const prompt = buildPrompt(pool, count, diff, mode);

    const write = () => {
      setCopied(true);
      setParseError('');
      setTimeout(() => setCopied(false), 2500);
    };

    if (navigator.clipboard) {
      navigator.clipboard.writeText(prompt).then(write).catch(() => fallbackCopy(prompt, write));
    } else {
      fallbackCopy(prompt, write);
    }
  }

  function fallbackCopy(text, cb) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity  = '0';
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    try { document.execCommand('copy'); } catch { /* silent */ }
    document.body.removeChild(ta);
    cb();
  }

  /* Parse pasted JSON and start quiz */
  function handleStart() {
    setParseError('');
    try {
      const questions = parseResponse(jsonPaste);
      onStart(questions.slice(0, count));
    } catch (err) {
      setParseError(err.message || 'Failed to parse JSON.');
      textareaRef.current?.focus();
    }
  }

  return (
    <div className="animate-fade-in max-w-2xl mx-auto">
      {/* Page header */}
      <div className="mb-7">
        <h1 className="text-3xl font-bold text-white mb-1">Smart Quiz</h1>
        <p className="text-slate-400 text-sm">
          Configure your quiz, copy the AI prompt, then paste the response to start.
        </p>
      </div>

      {/* Insufficient words warning */}
      {!hasWords && (
        <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-5">
          <AlertCircle size={17} className="text-amber-400 shrink-0 mt-0.5" />
          <p className="text-amber-300 text-sm">
            You need at least <strong>4 vocabulary words</strong> to generate a quiz.
            Add words in the <strong>Vocabulary</strong> tab first.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {/* Number of Questions */}
        <Section title="Number of Questions">
          <div className="flex flex-wrap gap-2">
            {QUESTION_COUNTS.map(n => (
              <Pill
                key={n}
                id={`count-${n}`}
                label={String(n)}
                selected={count === n}
                onClick={() => setCount(n)}
              />
            ))}
          </div>
        </Section>

        {/* Difficulty */}
        <Section title="Difficulty">
          <div className="flex flex-wrap gap-2">
            {DIFFICULTIES.map(d => (
              <Pill
                key={d}
                id={`diff-${d.toLowerCase()}`}
                label={d}
                selected={diff === d}
                onClick={() => setDiff(d)}
              />
            ))}
          </div>
        </Section>

        {/* Level Priority */}
        <Section title="Level Priority">
          <div className="flex flex-wrap gap-2">
            {LEVEL_PRIORITIES.map(lp => (
              <Pill
                key={lp.id}
                id={`priority-${lp.id}`}
                label={lp.label}
                selected={priority === lp.id}
                onClick={() => setPriority(lp.id)}
              />
            ))}
          </div>
        </Section>

        {/* Quiz Mode */}
        <Section title="Quiz Mode">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {QUIZ_MODES.map(qm => (
              <button
                key={qm.id}
                id={`mode-${qm.id}`}
                onClick={() => setMode(qm.id)}
                className={`text-left p-4 rounded-xl border transition-all duration-200 ${
                  mode === qm.id
                    ? 'bg-indigo-600/20 border-indigo-500 text-white'
                    : 'bg-slate-700/30 border-slate-600 text-slate-400 hover:border-slate-500 hover:text-white'
                }`}
              >
                <p className="font-semibold text-sm">{qm.label}</p>
                <p className="text-xs mt-1 opacity-70">{qm.desc}</p>
              </button>
            ))}
          </div>
        </Section>

        {/* ── TOEIC format reminder ──────────────────────────────────── */}
        <div className="flex items-start gap-3 bg-sky-500/10 border border-sky-500/20 rounded-xl p-4">
          <span className="text-xl shrink-0">✍️</span>
          <p className="text-sky-300 text-xs leading-relaxed">
            <strong className="text-sky-200">TOEIC Fill-in-the-Blank Format:</strong> The prompt
            instructs the AI to write a <strong>realistic Vietnamese scenario sentence</strong> with
            a <strong>[_____] blank</strong>, and exactly <strong>4 English word choices</strong>.
            The explanation is in Vietnamese. No dictionary-style questions.
          </p>
        </div>

        {/* ── Step 1: Copy Prompt ─────────────────────────────────────── */}
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-6 h-6 rounded-full bg-indigo-600/30 text-indigo-400 text-xs font-bold flex items-center justify-center shrink-0">
              1
            </span>
            <h3 className="text-white font-semibold text-sm">Copy the AI Prompt</h3>
          </div>
          <p className="text-slate-500 text-xs ml-8 mb-4">
            Paste it into{' '}
            <a
              href="https://gemini.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 hover:text-indigo-300 underline"
            >
              Gemini
            </a>
            ,{' '}
            <a
              href="https://chat.openai.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 hover:text-indigo-300 underline"
            >
              ChatGPT
            </a>
            , or any AI assistant — then copy the JSON it returns.
          </p>

          <button
            id="copy-prompt-btn"
            onClick={handleCopy}
            disabled={!hasWords}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${
              copied
                ? 'bg-emerald-600 text-white'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 disabled:cursor-not-allowed'
            }`}
          >
            {copied
              ? <><Check size={16} /> Prompt Copied to Clipboard!</>
              : <><Copy size={16} /> 📋 Copy AI Prompt</>
            }
          </button>
        </div>

        {/* ── Step 2: Paste JSON & Start ──────────────────────────────── */}
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-6 h-6 rounded-full bg-indigo-600/30 text-indigo-400 text-xs font-bold flex items-center justify-center shrink-0">
              2
            </span>
            <h3 className="text-white font-semibold text-sm">Paste AI Response (JSON)</h3>
          </div>
          <p className="text-slate-500 text-xs ml-8 mb-3">
            Paste the full AI reply here. Markdown code fences (` ```json … ``` `) are stripped automatically.
          </p>

          <textarea
            id="json-paste-textarea"
            ref={textareaRef}
            value={jsonPaste}
            onChange={e => { setJsonPaste(e.target.value); setParseError(''); }}
            rows={9}
            placeholder={`Paste the AI response here, e.g.:\n[\n  {\n    "question": "Từ nào có nghĩa là 'nộp chính thức'?",\n    "options": ["submit", "dismiss", "acquire", "negotiate"],\n    "answerIndex": 0,\n    "explanation": "'Submit' means to hand something in officially.",\n    "wordEnglish": "submit"\n  }\n]`}
            className="w-full bg-slate-900/60 border border-slate-600 rounded-xl px-4 py-3 text-white text-xs font-mono placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors resize-y min-h-[160px]"
          />

          {/* Parse error */}
          {parseError && (
            <div className="flex items-start gap-2 mt-3 bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-3">
              <AlertCircle size={14} className="text-rose-400 shrink-0 mt-0.5" />
              <p className="text-rose-300 text-xs leading-relaxed">{parseError}</p>
            </div>
          )}

          {/* Start button */}
          <button
            id="start-quiz-btn"
            onClick={handleStart}
            disabled={!jsonPaste.trim()}
            className="mt-4 w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-2xl font-bold text-base transition-all duration-200 shadow-xl shadow-indigo-500/20"
          >
            <ClipboardPaste size={20} /> 🚀 Start Quiz
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Quiz Gameplay                                                        */
/* ------------------------------------------------------------------ */
const OPTION_LABELS = ['A', 'B', 'C', 'D'];

function optionClass(idx, answered, correctIndex, selected) {
  if (!answered)              return 'bg-slate-700/60 border-slate-600 text-white hover:border-indigo-500 hover:bg-slate-700';
  if (idx === correctIndex)   return 'bg-emerald-500/20 border-emerald-500 text-emerald-300';
  if (idx === selected)       return 'bg-rose-500/20    border-rose-500    text-rose-300';
  return 'bg-slate-700/30 border-slate-700 text-slate-500 cursor-not-allowed';
}

/**
 * Play pronunciation using the shared audio utility (Web Speech API → Google TTS).
 * Named wrapper kept so existing call-sites in QuizGame don't need renaming.
 */
function playWordAudio(wordEnglish) {
  playAudio(wordEnglish);
}

function QuizGame({ questions, words, onFinish, updateWordLevel }) {
  // Pre-shuffle all questions once so correct answer is never always at position A
  const [shuffledQuestions] = useState(() => questions.map(shuffleOptions));

  const [current,  setCurrent]  = useState(0);
  const [selected, setSelected] = useState(null);
  const [results,  setResults]  = useState([]);

  const q        = shuffledQuestions[current];
  const answered = selected !== null;
  const progress = (current / shuffledQuestions.length) * 100;

  // Find the word object for the current question
  const wordObj = words.find(
    w => w.english.toLowerCase() === (q.wordEnglish || '').toLowerCase()
  );

  // Determine image URL: use stored imageUrl or Unsplash fallback
  const imageUrl = wordObj?.imageUrl
    ? wordObj.imageUrl
    : q.wordEnglish
      ? `https://source.unsplash.com/featured/300x200/?${encodeURIComponent(q.wordEnglish)}`
      : null;

  // Auto-play audio when answer is revealed
  useEffect(() => {
    if (answered && q.wordEnglish) {
      playWordAudio(q.wordEnglish);
    }
  }, [answered, q.wordEnglish]);

  function handleNext() {
    if (current + 1 >= shuffledQuestions.length) {
      onFinish(results);
    } else {
      setCurrent(c => c + 1);
      setSelected(null);
    }
  }

  function handleSelect(idx) {
    if (answered) return;
    setSelected(idx);
    const isCorrect = idx === q.correctIndex;
    const newResults = [...results, { correct: isCorrect, wordEnglish: q.wordEnglish }];
    setResults(newResults);
    if (q.wordEnglish) updateWordLevel(q.wordEnglish, isCorrect);

    // Auto-advance after 1.8 s — show feedback briefly then move on
    setTimeout(() => {
      if (current + 1 >= shuffledQuestions.length) {
        onFinish(newResults);
      } else {
        setCurrent(c => c + 1);
        setSelected(null);
      }
    }, 1800);
  }

  return (
    <div className="animate-fade-in max-w-2xl mx-auto">
      {/* Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm text-slate-400 mb-2">
          <span className="font-medium text-white">
            Question {current + 1} <span className="text-slate-500">/ {questions.length}</span>
          </span>
          <span>{Math.round(progress)}% done</span>
        </div>
        <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Question card — image on the right when answered */}
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6 mb-5 shadow-xl">
        <div className={`flex gap-5 ${answered && imageUrl ? 'flex-col sm:flex-row' : ''}`}>

          {/* Left: question text + explanation */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-3">
              <Brain size={15} className="text-indigo-400" />
              <span className="text-indigo-400 text-xs font-semibold uppercase tracking-wider">Question</span>
            </div>
            <p className="text-white text-xl font-semibold leading-relaxed">{q.question}</p>

            {/* Explanation appears below the question on the left */}
            {answered && q.explanation && (
              <div className="mt-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-4 py-3 animate-fade-in">
                <p className="text-slate-300 text-sm leading-relaxed">
                  <span className="text-indigo-400 font-semibold">💡 </span>
                  {q.explanation}
                </p>
              </div>
            )}
          </div>

          {/* Right: vocabulary image — only visible after answering */}
          {answered && imageUrl && (
            <div className="animate-fade-in sm:w-56 sm:shrink-0 rounded-2xl overflow-hidden border border-slate-700/50 shadow-lg relative">
              <img
                src={imageUrl}
                alt={q.wordEnglish}
                className="w-full h-48 sm:h-full object-cover"
                onError={e => { e.target.style.display = 'none'; }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-transparent to-transparent" />
              <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
                <Volume2 size={13} className="text-white/80" />
                <span className="text-white font-bold text-sm drop-shadow">{q.wordEnglish}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Options */}
      <div className="space-y-3 mb-4">
        {q.options.map((opt, idx) => (
          <button
            key={idx}
            id={`option-${idx}`}
            onClick={() => handleSelect(idx)}
            disabled={answered}
            className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200 text-left
              ${optionClass(idx, answered, q.correctIndex, selected)}`}
          >
            <span className="shrink-0 w-8 h-8 rounded-lg bg-black/20 flex items-center justify-center font-bold text-sm">
              {OPTION_LABELS[idx]}
            </span>
            <span className="font-medium flex-1">{opt}</span>
            {answered && idx === q.correctIndex && (
              <CheckCircle size={18} className="ml-auto text-emerald-400 shrink-0" />
            )}
            {answered && idx === selected && idx !== q.correctIndex && (
              <XCircle size={18} className="ml-auto text-rose-400 shrink-0" />
            )}
          </button>
        ))}
      </div>

      {/* Auto-advancing — show a subtle progress indicator */}
      {answered && (
        <div className="animate-fade-in flex items-center justify-center gap-2 py-2 text-slate-400 text-sm">
          <div className="w-4 h-4 border-2 border-slate-600 border-t-indigo-400 rounded-full animate-spin" />
          {current + 1 >= shuffledQuestions.length
            ? 'Finishing quiz…'
            : 'Next question in a moment…'
          }
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Results Screen                                                       */
/* ------------------------------------------------------------------ */
function QuizResults({ results, onRestart }) {
  const total   = results.length;
  const correct = results.filter(r => r.correct).length;
  const pct     = Math.round((correct / total) * 100);

  const grade =
    pct >= 90 ? { label: 'Excellent!',  color: 'text-emerald-400', emoji: '🏆' } :
    pct >= 70 ? { label: 'Good Job!',   color: 'text-indigo-400',  emoji: '👏' } :
    pct >= 50 ? { label: 'Keep Going!', color: 'text-amber-400',   emoji: '💪' } :
               { label: 'Try Again!',   color: 'text-rose-400',    emoji: '📚' };

  return (
    <div className="animate-fade-in max-w-lg mx-auto text-center">
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-8 mb-6">
        <div className="text-6xl mb-4">{grade.emoji}</div>
        <h2 className={`text-3xl font-bold mb-2 ${grade.color}`}>{grade.label}</h2>
        <p className="text-slate-400 mb-6">Quiz complete! Here's how you did:</p>

        <div className="flex items-center justify-center gap-8 mb-6">
          <div>
            <p className="text-4xl font-black text-white">{correct}/{total}</p>
            <p className="text-slate-400 text-sm mt-1">Correct</p>
          </div>
          <div className="w-px h-12 bg-slate-700" />
          <div>
            <p className={`text-4xl font-black ${grade.color}`}>{pct}%</p>
            <p className="text-slate-400 text-sm mt-1">Accuracy</p>
          </div>
        </div>

        <div className="bg-slate-700/40 rounded-xl p-3 text-sm text-slate-400">
          <Zap size={14} className="inline text-indigo-400 mr-1.5" />
          Word mastery levels &amp; streaks updated based on your answers.
        </div>
      </div>

      <button
        id="restart-quiz-btn"
        onClick={onRestart}
        className="flex items-center justify-center gap-2 mx-auto px-8 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-semibold transition-colors shadow-lg shadow-indigo-500/20"
      >
        <RotateCcw size={16} /> Take Another Quiz
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Root                                                                 */
/* ------------------------------------------------------------------ */
export default function Quiz({ words, updateWordLevel, recordQuizResult }) {
  const [phase,     setPhase]     = useState('config');
  const [questions, setQuestions] = useState([]);
  const [results,   setResults]   = useState([]);

  function handleStart(qs) {
    setQuestions(qs);
    setPhase('game');
  }

  function handleFinish(res) {
    setResults(res);
    recordQuizResult(res.filter(r => r.correct).length, res.length);
    setPhase('results');
  }

  function handleRestart() {
    setPhase('config');
    setQuestions([]);
    setResults([]);
  }

  if (phase === 'config')  return <QuizConfig words={words} onStart={handleStart} />;
  if (phase === 'game')    return <QuizGame   questions={questions} words={words} onFinish={handleFinish} updateWordLevel={updateWordLevel} />;
  if (phase === 'results') return <QuizResults results={results} onRestart={handleRestart} />;
  return null;
}
