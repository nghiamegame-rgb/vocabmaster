import { useState, useRef, useEffect } from 'react';
import {
  Brain, ChevronRight, CheckCircle, XCircle,
  RotateCcw, AlertCircle, Trophy, Zap,
  Copy, Check, ClipboardPaste, BookOpen, Volume2,
  Headphones, Type, Send,
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
    label:'TOEIC Part 5 (English)',
    desc: 'Authentic English TOEIC Part 5 sentence with a [_____] blank — choose or type the correct word',
  },
];

const ANSWER_MODES = [
  {
    id:    'mc',
    label: 'Multiple Choice',
    desc:  'Select from 4 options (A / B / C / D)',
    icon:  'mc',
  },
  {
    id:    'dictation',
    label: 'Listening & Typing',
    desc:  'Listen to the word and type your answer',
    icon:  'dictation',
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
  const wordList = words
    .slice(0, 40)
    .map(w => `"${w.english}" (${w.vietnamese})`)
    .join(', ');

  /* ── TOEIC mode: real English Part 5 sentences ─────────────────────── */
  if (mode === 'toeic') {
    const diffNote = {
      Easy:   'Use simple office/travel contexts. Distractors should be clearly wrong.',
      Medium: 'Use realistic business/corporate contexts. Distractors should be plausible but wrong.',
      Hard:   'Use advanced contexts (finance, logistics, HR, legal). Distractors must be very close in meaning or form — near-synonyms, same word-family, or common confusables.',
    }[difficulty] || '';

    return `You are a TOEIC exam expert. Generate exactly ${count} TOEIC Part 5 fill-in-the-blank questions in English.
Difficulty: ${difficulty}. ${diffNote}

=== MANDATORY RULES FOR TOEIC PART 5 FORMAT ===

Field "question":
  - MUST be a complete, grammatically correct ENGLISH sentence.
  - MUST contain exactly one blank represented as [_____].
  - The sentence MUST reflect a realistic TOEIC business scenario: corporate email, HR announcement, airline/hotel notice, contract clause, product advertisement, financial report, or business news.
  - Seamlessly weave in common TOEIC collocations and phrases (e.g., "in accordance with", "prior to", "on behalf of", "subject to", "in conjunction with", "as a result of", "take effect", "comply with", "reach an agreement", "place an order", etc.) naturally into the sentence.
  - Vary sentence structure: active voice, passive voice, conditional clauses, relative clauses, participial phrases.
  - NEVER start more than 2 sentences with the same subject.
  - NEVER write a definition question like "Which word means...?".
  - NEVER reveal the target word inside the question sentence.
  - Write ONLY in English (except the [_____] marker).

Field "options":
  - Exactly 4 ENGLISH words or short phrases.
  - Exactly 1 correct answer; the 3 distractors must be the same part of speech to create genuine difficulty.

Field "explanation":
  - Write in VIETNAMESE.
  - Briefly explain why the correct answer fits the context and why distractors are wrong.

Field "wordEnglish":
  - The exact English word being tested (the correct answer).

Vocabulary to use: ${wordList}

=== OUTPUT RULES ===
- Return ONLY a valid JSON array. NO prose, NO markdown, NO code fences.
- Each element has exactly 5 fields: "question", "options", "answerIndex", "explanation", "wordEnglish".
- "answerIndex": 0-based index of the correct answer in "options" (0=A, 1=B, 2=C, 3=D).

SAMPLE OUTPUT (note the variety of contexts and structures):
[
  {
    "question": "All employees are required to [_____] the new data-privacy policy prior to accessing the updated client database.",
    "options": ["acknowledge", "accumulate", "allocate", "accelerate"],
    "answerIndex": 0,
    "explanation": "'Acknowledge' (xác nhận) phù hợp với ngữ cảnh nhân viên cần xác nhận đã đọc chính sách. Các lựa chọn còn lại không hợp nghĩa trong bối cảnh này.",
    "wordEnglish": "acknowledge"
  },
  {
    "question": "The quarterly financial report must be [_____] to the board of directors no later than Friday afternoon.",
    "options": ["submitted", "promoted", "allocated", "suspended"],
    "answerIndex": 0,
    "explanation": "'Submitted' (nộp/trình) phù hợp với ngữ cảnh nộp báo cáo đúng hạn. Các lựa chọn còn lại không đi với hành động nộp tài liệu.",
    "wordEnglish": "submit"
  }
]

Now generate exactly ${count} questions following the format above, ensuring EVERY sentence has a DIFFERENT context and structure:`;
  }

  /* ── Vietnamese (VN) mode ───────────────────────────────────────────── */
  const diffNote = {
    Easy:   'Dùng ngữ cảnh đơn giản, từ vựng phổ thông, các lựa chọn sai rõ ràng.',
    Medium: 'Dùng ngữ cảnh văn phòng/kinh doanh thực tế, các lựa chọn sai có liên quan.',
    Hard:   'Dùng ngữ cảnh chuyên sâu (tài chính, logistics, HR), các lựa chọn sai rất gần nghĩa, dễ nhầm lẫn.',
  }[difficulty] || '';

  return `Bạn là chuyên gia tạo đề thi TOEIC. Nhiệm vụ: tạo chính xác ${count} câu hỏi điền vào chỗ trống.
Độ khó: ${difficulty}. ${diffNote}
Tạo câu mô tả ngữ cảnh sử dụng từ đó trong tiếng Việt, có chỗ trống [_____].

=== QUY TAC TAO CAU — DAY LA PHAN QUAN TRONG NHAT ===

  YEU CAU BAT BUOC:
  1. BOI CANH TOEIC: Cau PHAI mo phong tinh huong thuc te trong TOEIC. Chon ngau nhien
     cac boi canh nhu: email cong ty, thong bao noi bo HR, phan hoi dich vu khach hang,
     thong bao san bay/nha ga, dam phan hop dong, quang cao san pham, hoac tin tuc kinh doanh.
  2. DA DANG: KHONG dung cau truc cau lap di lap lai. Dung cau bi dong, cau dieu kien,
     hoac menh de phuc hop khi phu hop.
  3. NGON NGU TU NHIEN: Ban dich tieng Viet phai nghe chuyen nghiep va tu nhien.
  4. GOI Y NGU CANH: Ngu canh phai cung cap du manh moi logic de suy ra tu can dien.

=== QUY TAC BAT BUOC VE CAU TRUC JSON ===

Truong "question":
  - PHAI la mot cau van TIENG VIET hoan chinh voi cho trong [_____].
  - MOI cau PHAI co boi canh KHAC NHAU.
  - TUYET DOI KHONG viet kieu "Tu nao co nghia la...?".
  - TUYET DOI KHONG de lo tu can dien trong phan cau hoi.
  - KHONG dung tieng Anh trong cau hoi (tru ky hieu [_____]).

Truong "options": 4 tu/cum tu TIENG ANH; chi 1 dap an dung.
Truong "explanation": TIENG VIET, giai thich ngan gon.
Truong "wordEnglish": tu tieng Anh chinh xac la dap an dung.

Tu vung can dung: ${wordList}

=== QUY TAC DAU RA ===
- Chi tra ve mot mang JSON hop le. KHONG them van xuoi, KHONG dung markdown, KHONG dung code block.
- Moi phan tu co dung 5 truong: "question", "options", "answerIndex", "explanation", "wordEnglish".
- "answerIndex": chi so 0 cua dap an dung trong mang "options" (0=A, 1=B, 2=C, 3=D).

VI DU MAU:
[
  {
    "question": "Hanh khach duoc thong bao rang chuyen bay se khoi hanh theo dung [_____] da dinh.",
    "options": ["schedule", "advantage", "gauge", "competent"],
    "answerIndex": 0,
    "explanation": "'Schedule' (lich trinh) la dap an chinh xac trong boi canh thong bao san bay.",
    "wordEnglish": "schedule"
  }
]

Bay gio hay tao chinh xac ${count} cau hoi, dam bao MOI cau co boi canh va cau truc KHAC NHAU:`;
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
  const [count,      setCount]      = useState(10);
  const [diff,       setDiff]       = useState('Medium');
  const [priority,   setPriority]   = useState('all');
  const [mode,       setMode]       = useState('vn');
  const [answerMode, setAnswerMode] = useState('mc');

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
      onStart(questions.slice(0, count), answerMode);
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
        <Section title="Question Format">
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

        {/* Answer Mode */}
        <Section title="Answer Mode">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ANSWER_MODES.map(am => (
              <button
                key={am.id}
                id={`answer-mode-${am.id}`}
                onClick={() => setAnswerMode(am.id)}
                className={`text-left p-4 rounded-xl border transition-all duration-200 ${
                  answerMode === am.id
                    ? 'bg-purple-600/20 border-purple-500 text-white'
                    : 'bg-slate-700/30 border-slate-600 text-slate-400 hover:border-slate-500 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {am.id === 'mc'
                    ? <Type size={14} className={answerMode === am.id ? 'text-purple-400' : 'text-slate-500'} />
                    : <Headphones size={14} className={answerMode === am.id ? 'text-purple-400' : 'text-slate-500'} />}
                  <p className="font-semibold text-sm">{am.label}</p>
                </div>
                <p className="text-xs opacity-70">{am.desc}</p>
              </button>
            ))}
          </div>
        </Section>

        {/* Info banner */}
        <div className="flex items-start gap-3 bg-sky-500/10 border border-sky-500/20 rounded-xl p-4">
          <span className="text-xl shrink-0">{mode === 'toeic' ? '🎯' : '✍️'}</span>
          <p className="text-sky-300 text-xs leading-relaxed">
            {mode === 'toeic' ? (
              <><strong className="text-sky-200">TOEIC Part 5 (English):</strong> The AI generates
              authentic English sentences with a <strong>[_____] blank</strong>, common TOEIC collocations,
              and 4 English word choices. Explanation is in Vietnamese.</>
            ) : (
              <><strong className="text-sky-200">Vietnamese → English:</strong> The AI writes a Vietnamese
              context sentence with a <strong>[_____] blank</strong> and 4 English word choices.</>
            )}
            {answerMode === 'dictation' && (
              <span className="block mt-1 text-purple-300">
                🎧 <strong className="text-purple-200">Listening & Typing mode:</strong> You'll hear
                the word and type your answer. A hint appears after 4 audio plays.
              </span>
            )}
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

function QuizGame({ questions, words, onFinish, updateWordLevel, answerMode }) {
  // Pre-shuffle all questions once so correct answer is never always at position A
  const [shuffledQuestions] = useState(() => questions.map(shuffleOptions));

  const [current,    setCurrent]    = useState(0);
  const [selected,   setSelected]   = useState(null);
  const [results,    setResults]    = useState([]);

  // Dictation mode state
  const [typedAnswer,  setTypedAnswer]  = useState('');
  const [dictAnswered, setDictAnswered] = useState(false); // true after user submits
  const [dictCorrect,  setDictCorrect]  = useState(false);
  const [playCount,    setPlayCount]    = useState(0);
  const inputRef = useRef(null);

  const isDictation = answerMode === 'dictation';

  const q        = shuffledQuestions[current];
  const answered = isDictation ? dictAnswered : selected !== null;
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

  // Reset dictation state when question changes
  useEffect(() => {
    setTypedAnswer('');
    setDictAnswered(false);
    setDictCorrect(false);
    setPlayCount(0);
    if (isDictation) {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [current, isDictation]);

  function advanceAfterDelay(newResults) {
    setTimeout(() => {
      if (current + 1 >= shuffledQuestions.length) {
        onFinish(newResults);
      } else {
        setCurrent(c => c + 1);
        setSelected(null);
      }
    }, 1800);
  }

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
    advanceAfterDelay(newResults);
  }

  // Dictation: play audio and count plays
  function handleDictationPlay() {
    if (q.wordEnglish) {
      playWordAudio(q.wordEnglish);
      setPlayCount(c => c + 1);
    }
  }

  // Dictation: submit typed answer
  function handleDictationSubmit() {
    if (!typedAnswer.trim() || dictAnswered) return;
    const isCorrect =
      typedAnswer.trim().toLowerCase() === (q.wordEnglish || '').toLowerCase();
    setDictCorrect(isCorrect);
    setDictAnswered(true);
    const newResults = [...results, { correct: isCorrect, wordEnglish: q.wordEnglish }];
    setResults(newResults);
    if (q.wordEnglish) updateWordLevel(q.wordEnglish, isCorrect);
    advanceAfterDelay(newResults);
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

      {/* ── Multiple-Choice Options ── */}
      {!isDictation && (
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
      )}

      {/* ── Dictation / Listening & Typing Mode ── */}
      {isDictation && (
        <div className="mb-4 space-y-3 animate-fade-in">
          {/* Audio play button + play count */}
          <div className="flex items-center gap-3">
            <button
              id="dictation-play-btn"
              onClick={handleDictationPlay}
              disabled={dictAnswered}
              className="flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-semibold text-sm transition-all duration-200 shadow-lg shadow-indigo-500/20"
            >
              <Headphones size={17} />
              {playCount === 0 ? 'Play Word' : `Play Again (×${playCount})`}
            </button>
            {playCount > 0 && !dictAnswered && (
              <span className="text-slate-500 text-xs">
                {playCount < 4
                  ? `${4 - playCount} play${4 - playCount === 1 ? '' : 's'} until hint`
                  : 'Hint available ↓'}
              </span>
            )}
          </div>

          {/* Hint: shown after 4+ plays */}
          {playCount >= 4 && !dictAnswered && (
            <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2 animate-fade-in">
              <AlertCircle size={14} className="text-amber-400 shrink-0" />
              <span className="text-amber-300 text-sm">
                Hint: <strong className="text-amber-200">{q.wordEnglish}</strong>
              </span>
            </div>
          )}

          {/* Text input */}
          <div className="flex gap-2">
            <input
              id="dictation-input"
              ref={inputRef}
              type="text"
              value={typedAnswer}
              onChange={e => setTypedAnswer(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleDictationSubmit(); }}
              disabled={dictAnswered}
              placeholder="Type the English word here…"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              className={`flex-1 bg-slate-900/60 border rounded-xl px-4 py-3 text-white text-sm font-mono placeholder-slate-600
                focus:outline-none transition-colors
                ${
                  dictAnswered
                    ? dictCorrect
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-rose-500 bg-rose-500/10'
                    : 'border-slate-600 focus:border-purple-500'
                }`}
            />
            <button
              id="dictation-submit-btn"
              onClick={handleDictationSubmit}
              disabled={!typedAnswer.trim() || dictAnswered}
              className="flex items-center gap-1.5 px-5 py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-semibold text-sm transition-all duration-200"
            >
              <Send size={15} /> Submit
            </button>
          </div>

          {/* Feedback after submit */}
          {dictAnswered && (
            <div className={`flex items-center gap-2 rounded-xl px-4 py-3 animate-fade-in ${
              dictCorrect
                ? 'bg-emerald-500/15 border border-emerald-500/30'
                : 'bg-rose-500/15 border border-rose-500/30'
            }`}>
              {dictCorrect
                ? <CheckCircle size={16} className="text-emerald-400 shrink-0" />
                : <XCircle    size={16} className="text-rose-400 shrink-0" />}
              <span className={`text-sm font-medium ${
                dictCorrect ? 'text-emerald-300' : 'text-rose-300'
              }`}>
                {dictCorrect
                  ? 'Correct! 🎉'
                  : <>Wrong. The answer is <strong className="text-white">{q.wordEnglish}</strong></>}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Auto-advancing spinner */}
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
  const [phase,      setPhase]      = useState('config');
  const [questions,  setQuestions]  = useState([]);
  const [results,    setResults]    = useState([]);
  const [answerMode, setAnswerMode] = useState('mc');

  function handleStart(qs, am) {
    setQuestions(qs);
    setAnswerMode(am || 'mc');
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
  if (phase === 'game')    return <QuizGame   questions={questions} words={words} onFinish={handleFinish} updateWordLevel={updateWordLevel} answerMode={answerMode} />;
  if (phase === 'results') return <QuizResults results={results} onRestart={handleRestart} />;
  return null;
}
