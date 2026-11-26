import { useState, useRef, useEffect } from 'react';
import {
  Brain, ChevronRight, CheckCircle, XCircle,
  RotateCcw, AlertCircle, Trophy, Zap,
  Copy, Check, ClipboardPaste, BookOpen, Volume2,
  Headphones, Type, Send, FastForward, Star, Image as ImageIcon
} from 'lucide-react';
import { playAudio } from '../utils/audio';
import { selectStructures } from '../utils/structureStorage';
import { buildStructurePrompt, validateStructureQuestions } from '../utils/structureQuiz';
import { parseResponse, quizCountIssue } from '../utils/quizParse';
import { evaluateFeedbackAdvance, getFeedbackNowMs } from '../utils/quizFeedback';
import { shuffle } from '../utils/wordSelection';
import WordInitialTile from './WordInitialTile';

/* ------------------------------------------------------------------ */
/* Constants                                                            */
/* ------------------------------------------------------------------ */
const FEEDBACK_MIN_MS   = 1800;
const FEEDBACK_IMAGE_MS = 1000;
const FEEDBACK_MAX_MS   = 4000;

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
const WORD_TYPE_FILTERS = [
  { id: 'All',    label: 'All Types',    icon: '🔤' },
  { id: 'Word',   label: 'Single Words', icon: '📝' },
  { id: 'Phrase', label: 'Phrases',      icon: '💬' },
  { id: 'Family', label: 'Word Families',icon: '🌳' },
  { id: 'Preposition', label: 'Prepositions', icon: '🔗' },
];
const QUIZ_MODES = [
  {
    id:   'vn',
    label:'Vietnamese → English',
    desc: 'Câu tiếng Việt có [_____], chọn từ tiếng Anh phù hợp với ngữ cảnh',
  },
  {
    id:   'vstep',
    label:'VSTEP B1–B2 (English)',
    desc: 'English sentence at VSTEP B1–B2 level with a [_____] blank — choose or type the correct word',
  },
];

QUIZ_MODES.push({
  id: 'structure',
  label: 'Grammar Structures',
  desc: 'Câu VSTEP B1–B2 dựa trên các Structures đã lưu, có liên kết ID để cập nhật tiến độ',
});

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

/** Check whether a word matches the selected level priority */
function matchesPriority(word, priority) {
  if (priority === 'l1')   return word.level === 1;
  if (priority === 'l1l2') return word.level <= 2;
  if (priority === 'l3l4') return word.level === 3 || word.level === 4;
  if (priority === 'l5')   return word.level === 5;
  return true;
}

/** Shuffle & filter word pool by selected priority (strict intersection, no fallback to unfiltered words) */
function buildPool(words, priority, count) {
  const pool = words.filter(w => matchesPriority(w, priority));
  return shuffle(pool).slice(0, Math.max(count * 2, 20));
}

/**
 * Build the structured prompt the user will paste into any AI chat.
 * Generates VSTEP B1–B2 fill-in-the-blank sentences:
 *   - "question" is a familiar everyday/study/work context with a [_____] blank
 *   - "options" are exactly 4 English words
 *   - "explanation" is in Vietnamese explaining why the answer fits
 */
function buildPrompt(words, count, difficulty, mode) {
  const wordList = words
    .slice(0, 40)
    .map(w => `"${w.english}" (${w.vietnamese})`)
    .join(', ');

  /* ── VSTEP B1–B2 mode: English fill-in-the-blank sentences ────────── */
  if (mode === 'vstep') {
    const diffNote = {
      Easy:   'Use simple, familiar B1 contexts (daily life, family, school, shopping, travel). Distractors should be clearly wrong.',
      Medium: 'Use realistic B1–B2 contexts (study, work, health, technology, community). Distractors should be plausible but wrong.',
      Hard:   'Use B2 contexts (environment, education, media, society). Distractors must be very close in meaning or form — near-synonyms, same word-family, or common confusables — but never go above B2.',
    }[difficulty] || '';

    return `You are an English teacher preparing Vietnamese learners for the VSTEP exam (VSTEP B1–B2). Generate exactly ${count} fill-in-the-blank vocabulary questions in English.
Difficulty: ${difficulty}. ${diffNote}

=== MANDATORY RULES (VSTEP B1–B2) ===

Field "question":
  - MUST be a complete, grammatically correct ENGLISH sentence at B1–B2 level (never above B2).
  - MUST contain exactly one blank represented as [_____].
  - The sentence MUST reflect a familiar VSTEP-style context: daily life, study, work, travel, health, environment, technology, culture or community life.
  - Use common, useful B1–B2 collocations and phrases (e.g., "take part in", "pay attention to", "make a decision", "have an effect on", "deal with", "be responsible for") naturally in the sentence.
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
    "question": "Doing regular exercise can [_____] your mood and help you sleep better at night.",
    "options": ["improve", "increase", "provide", "prevent"],
    "answerIndex": 0,
    "explanation": "'Improve' (cải thiện) đi với 'your mood' và phù hợp ý nghĩa tích cực của câu. Các lựa chọn còn lại không hợp nghĩa hoặc không đi với 'mood'.",
    "wordEnglish": "improve"
  },
  {
    "question": "If more people used public transport, there would be less [_____] in big cities.",
    "options": ["pollution", "population", "production", "promotion"],
    "answerIndex": 0,
    "explanation": "'Pollution' (ô nhiễm) phù hợp với ý giảm xe cá nhân trong thành phố. Các từ còn lại có hình thức gần giống nhưng sai nghĩa.",
    "wordEnglish": "pollution"
  }
]

Now generate exactly ${count} questions following the format above, ensuring EVERY sentence has a DIFFERENT context and structure:`;
  }

  /* ── Vietnamese (VN) mode ───────────────────────────────────────────── */
  const diffNote = {
    Easy:   'Dùng ngữ cảnh đơn giản, từ vựng phổ thông, các lựa chọn sai rõ ràng.',
    Medium: 'Dùng ngữ cảnh học tập/công việc/đời sống quen thuộc (B1–B2), các lựa chọn sai có liên quan.',
    Hard:   'Dùng ngữ cảnh B2 (môi trường, giáo dục, công nghệ, xã hội), các lựa chọn sai rất gần nghĩa, dễ nhầm lẫn; không vượt quá B2.',
  }[difficulty] || '';

  return `Bạn là giáo viên tiếng Anh luyện thi VSTEP B1–B2. Nhiệm vụ: tạo chính xác ${count} câu hỏi điền vào chỗ trống.
Độ khó: ${difficulty}. ${diffNote}
Tạo câu mô tả ngữ cảnh sử dụng từ đó trong tiếng Việt, có chỗ trống [_____].

=== QUY TAC TAO CAU — DAY LA PHAN QUAN TRONG NHAT ===

  YEU CAU BAT BUOC:
  1. BOI CANH VSTEP B1-B2: Cau PHAI mo phong tinh huong quen thuoc trong de VSTEP. Chon ngau nhien
     cac boi canh nhu: hoc tap, cong viec, du lich, suc khoe, moi truong, cong nghe,
     gia dinh, mua sam, hoac doi song cong dong. Do kho khong vuot qua B2.
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

/* ------------------------------------------------------------------ */
/* Shared: Pill selector                                                */
/* ------------------------------------------------------------------ */
function Pill({ id, label, selected, onClick }) {
  return (
    <button
      id={id}
      onClick={onClick}
      className={`vm-btn px-4 py-2 rounded-xl text-sm font-bold border-2 ${
        selected
          ? 'vm-btn-primary'
          : 'bg-[var(--sb-paper-card)] text-[var(--sb-ink)] border-[var(--sb-ink-border)] hover:bg-[var(--sb-paper-deep)] hover:border-[var(--sb-ink)]'
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
    <div className="vm-panel rounded-2xl p-5">
      <h3 className="text-[var(--sb-ink-soft)] text-xs font-extrabold uppercase tracking-wider mb-3">
        {title}
      </h3>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Quiz Config + Prompt Screen                                          */
/* ------------------------------------------------------------------ */
function QuizConfig({ words, structures = [], onStart }) {
  const [count,          setCount]          = useState(10);
  const [diff,           setDiff]           = useState('Medium');
  const [priority,       setPriority]       = useState('all');
  const [mode,           setMode]           = useState('vn');
  const [answerMode,     setAnswerMode]     = useState('mc');
  const [wordTypeFilter, setWordTypeFilter] = useState('All'); // 'All'|'Word'|'Phrase'|'Family'|'Preposition'
  const [hardOnly,       setHardOnly]       = useState(false);
  const [selectedStructureIds, setSelectedStructureIds] = useState(() => new Set(structures.map(item => item.id)));

  const [copied,     setCopied]     = useState(false);
  const [jsonPaste,  setJsonPaste]  = useState('');
  const [parseError, setParseError] = useState('');

  const textareaRef = useRef(null);
  const promptIdsRef = useRef(null);
  // Paste text whose short question count the user already acknowledged.
  const shortConfirmedRef = useRef(null);
  const knownStructureIdsRef = useRef(new Set(structures.map(item => item.id)));

  // Strict intersection across hardOnly, wordTypeFilter, and priority
  const eligibleWords = words.filter(w =>
    (!hardOnly || Boolean(w.hardMarked)) &&
    (wordTypeFilter === 'All' || (w.wordType || 'Word') === wordTypeFilter) &&
    matchesPriority(w, priority)
  );
  const hardCount = words.filter(w =>
    Boolean(w.hardMarked) &&
    (wordTypeFilter === 'All' || (w.wordType || 'Word') === wordTypeFilter) &&
    matchesPriority(w, priority)
  ).length;
  const hasWords = eligibleWords.length >= 4;
  const selectedStructures = structures.filter(item => selectedStructureIds.has(item.id));
  const hasSource = mode === 'structure' ? selectedStructures.length > 0 : hasWords;

  useEffect(() => {
    const previousIds = knownStructureIdsRef.current;
    knownStructureIdsRef.current = new Set(structures.map(item => item.id));
    setSelectedStructureIds(prev => {
      return new Set(structures.filter(item => prev.has(item.id) || !previousIds.has(item.id)).map(item => item.id));
    });
  }, [structures]);

  useEffect(() => {
    if (mode === 'structure') setAnswerMode('mc');
  }, [mode]);

  /* Copy prompt to clipboard */
  function handleCopy() {
    if (!hasSource) return;
    const pool = mode === 'structure' ? selectStructures(selectedStructures, count) : [];
    promptIdsRef.current = mode === 'structure' ? pool.map(item => item.id) : null;
    const prompt = mode === 'structure'
      ? buildStructurePrompt(pool, count, diff)
      : buildPrompt(buildPool(eligibleWords, priority, count), count, diff, mode);

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
    if (!hasSource) {
      setParseError(
        mode === 'structure'
          ? 'Chưa có cấu trúc được chọn.'
          : `Cần ít nhất 4 từ khớp bộ lọc hiện tại để tạo và bắt đầu bài tập (hiện có ${eligibleWords.length} từ khớp).`
      );
      return;
    }
    try {
      const questions = parseResponse(jsonPaste);
      const activeQuestions = questions.slice(0, count);
      if (mode === 'structure') {
        validateStructureQuestions(questions, promptIdsRef.current || selectedStructures.map(item => item.id), structures, count);
      } else if (hardOnly) {
        const eligibleSet = new Set(eligibleWords.map(w => w.english.trim().toLowerCase()));
        const mismatch = activeQuestions.find(q => !eligibleSet.has((q.wordEnglish || '').trim().toLowerCase()));
        if (mismatch) {
          throw new Error(
            'Bộ đề JSON đã dán chứa từ không thuộc danh sách "Chỉ từ khó ⭐" (hoặc bộ lọc hiện tại). Bộ lọc "Chỉ từ khó ⭐" dùng để tạo AI Prompt mới — hãy bấm "Copy AI Prompt" để tạo đề mới hoặc tắt bộ lọc này.'
          );
        }
      }
      const shortIssue = mode === 'structure' ? null : quizCountIssue(activeQuestions.length, count);
      if (shortIssue && shortConfirmedRef.current !== jsonPaste) {
        shortConfirmedRef.current = jsonPaste;
        setParseError(shortIssue);
        return;
      }
      onStart(activeQuestions, mode === 'structure' ? 'mc' : answerMode, mode);
    } catch (err) {
      setParseError(err.message || 'Failed to parse JSON.');
      textareaRef.current?.focus();
    }
  }

  return (
    <div className="vm-page-enter max-w-2xl mx-auto">
      {/* Page header */}
      <div className="mb-7">
        <h1 className="sb-font-display text-3xl font-extrabold tracking-tight text-[var(--sb-ink)] mb-1">Smart Quiz</h1>
        <p className="text-[var(--sb-ink-soft)] font-semibold text-sm">
          Configure your quiz, copy the AI prompt, then paste the response to start.
        </p>
      </div>

      {/* Insufficient words warning */}
      {!hasSource && (
        <div className="flex items-start gap-3 bg-[var(--sb-ochre-soft)] border-2 border-[var(--sb-ink)] shadow-[var(--sb-shadow-sm)] rounded-2xl p-4 mb-5 animate-fade-in">
          <AlertCircle size={17} className="text-[var(--sb-ochre-text)] shrink-0 mt-0.5" />
          <p className="text-[var(--sb-ink)] text-sm font-medium leading-relaxed">
            {mode === 'structure'
              ? <>Chưa có cấu trúc được chọn. Hãy thêm cấu trúc trong tab <strong>Grammar → Structures</strong>.</>
              : hardOnly
                ? <>Chưa đủ từ khó ⭐ khớp bộ lọc để tạo prompt (cần ít nhất <strong>4 từ</strong>, hiện có <strong>{eligibleWords.length}</strong> từ khớp). Hãy đánh dấu ⭐ thêm từ trong <strong>Vocabulary</strong> hoặc nới bộ lọc.</>
                : priority !== 'all' && priority !== 'custom'
                  ? <>Không đủ từ khớp bộ lọc hiện tại (cần ≥ <strong>4 từ</strong>, hiện có <strong>{eligibleWords.length}</strong> từ). Hãy thử đổi <strong>Level Priority</strong> hoặc <strong>Vocabulary Type</strong>.</>
                  : wordTypeFilter === 'All'
                    ? <>You need at least <strong>4 vocabulary words</strong> to generate a quiz (currently <strong>{eligibleWords.length}</strong>). Add words in the <strong>Vocabulary</strong> tab first.</>
                    : <>Not enough <strong>{wordTypeFilter}</strong> words (need ≥ 4, currently <strong>{eligibleWords.length}</strong>). Try <strong>All Types</strong> or add more words of this type.</>
            }
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
                onClick={() => { setCount(n); setCopied(false); }}
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
                onClick={() => { setDiff(d); setCopied(false); }}
              />
            ))}
          </div>
        </Section>

        {/* Level Priority */}
        {mode !== 'structure' && <Section title="Level Priority">
          <div className="flex flex-wrap gap-2">
            {LEVEL_PRIORITIES.map(lp => {
              const cnt = words.filter(w =>
                (!hardOnly || Boolean(w.hardMarked)) &&
                (wordTypeFilter === 'All' || (w.wordType || 'Word') === wordTypeFilter) &&
                matchesPriority(w, lp.id)
              ).length;
              return (
                <Pill
                  key={lp.id}
                  id={`priority-${lp.id}`}
                  label={`${lp.label} (${cnt})`}
                  selected={priority === lp.id}
                  onClick={() => { setPriority(lp.id); setCopied(false); }}
                />
              );
            })}
          </div>
        </Section>}

        {/* Vocabulary Type */}
        {mode !== 'structure' && <Section title="Vocabulary Type">
          <div className="flex flex-wrap gap-2">
            {WORD_TYPE_FILTERS.map(wt => {
              const cnt = words.filter(w =>
                (!hardOnly || Boolean(w.hardMarked)) &&
                matchesPriority(w, priority) &&
                (wt.id === 'All' || (w.wordType || 'Word') === wt.id)
              ).length;
              return (
                <button
                  key={wt.id}
                  id={`wtype-${wt.id.toLowerCase()}`}
                  onClick={() => { setWordTypeFilter(wt.id); setCopied(false); }}
                  className={`vm-btn flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold border-2 ${
                    wordTypeFilter === wt.id
                      ? 'vm-btn-primary'
                      : 'bg-[var(--sb-paper-card)] text-[var(--sb-ink)] border-[var(--sb-ink-border)] hover:bg-[var(--sb-paper-deep)] hover:border-[var(--sb-ink)]'
                  }`}
                >
                  <span>{wt.icon}</span>
                  {wt.label}
                  <span className="text-xs opacity-80">({cnt})</span>
                </button>
              );
            })}
          </div>
        </Section>}

        {/* Difficult Words Filter */}
        {mode !== 'structure' && (
          <Section title="Từ khó (Difficult Words)">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <button
                  id="quiz-hard-toggle"
                  type="button"
                  onClick={() => { setHardOnly(v => !v); setCopied(false); }}
                  aria-pressed={hardOnly}
                  className={`vm-btn flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border-2 ${
                    hardOnly
                      ? 'bg-[var(--sb-ochre-soft)] text-[var(--sb-ochre-text)] border-[var(--sb-ink)] shadow-[var(--sb-shadow-sm)]'
                      : 'bg-[var(--sb-paper-card)] text-[var(--sb-ink)] border-[var(--sb-ink-border)] hover:border-[var(--sb-ink)] hover:bg-[var(--sb-ochre-soft)] hover:text-[var(--sb-ochre-text)]'
                  }`}
                >
                  <Star size={15} className={hardOnly ? 'fill-[var(--sb-ochre)] text-[var(--sb-ochre-text)]' : 'text-[var(--sb-ochre-text)]'} />
                  <span>Chỉ từ khó ⭐</span>
                  <span className="text-xs opacity-85">({hardCount})</span>
                </button>
                <p className="text-[var(--sb-ink-soft)] text-xs font-medium mt-2">
                  Áp dụng cho nguồn từ Vocabulary khi tạo AI Prompt mới (hiện có <strong className="text-[var(--sb-ink)]">{eligibleWords.length}</strong> từ khớp bộ lọc, cần tối thiểu 4 từ).
                </p>
              </div>
            </div>
          </Section>
        )}

        {mode === 'structure' && (
          <Section title="Structures to practice">
            <div className="flex items-center justify-between mb-3 text-xs text-[var(--sb-ink-soft)] font-semibold">
              <span>{selectedStructures.length}/{structures.length} cấu trúc được chọn</span>
              <div className="flex gap-3">
                <button type="button" onClick={() => setSelectedStructureIds(new Set(structures.map(item => item.id)))} className="text-[var(--sb-terracotta-text)] hover:underline font-bold">Chọn tất cả</button>
                <button type="button" onClick={() => setSelectedStructureIds(new Set())} className="text-[var(--sb-ink-soft)] hover:text-[var(--sb-ink)] font-bold">Bỏ chọn</button>
              </div>
            </div>
            <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
              {structures.map(item => <label key={item.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-[var(--sb-paper-deep)] cursor-pointer"><input type="checkbox" checked={selectedStructureIds.has(item.id)} onChange={e => setSelectedStructureIds(prev => { const next = new Set(prev); e.target.checked ? next.add(item.id) : next.delete(item.id); return next; })} className="accent-[var(--sb-terracotta-strong)]" /><span className="text-sm font-semibold text-[var(--sb-ink)]">{item.english}</span><span className="text-xs font-bold text-[var(--sb-ink-soft)]">L{item.level}</span></label>)}
            </div>
          </Section>
        )}

        {/* Quiz Mode */}
        <Section title="Question Format">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {QUIZ_MODES.map(qm => (
              <button
                key={qm.id}
                id={`mode-${qm.id}`}
                onClick={() => { setMode(qm.id); setCopied(false); }}
                className={`vm-btn text-left p-4 rounded-xl border-2 ${
                  mode === qm.id
                    ? 'bg-[var(--sb-terracotta-soft)] border-[var(--sb-ink)] text-[var(--sb-ink)] shadow-[var(--sb-shadow-sm)]'
                    : 'bg-[var(--sb-paper-card)] border-[var(--sb-ink-border)] text-[var(--sb-ink)] hover:border-[var(--sb-ink)] hover:bg-[var(--sb-paper-deep)]'
                }`}
              >
                <p className="font-extrabold text-sm">{qm.label}</p>
                <p className="text-xs mt-1 text-[var(--sb-ink-soft)] font-medium">{qm.desc}</p>
              </button>
            ))}
          </div>
        </Section>

        {/* Answer Mode */}
        <Section title="Answer Mode">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ANSWER_MODES.filter(am => mode !== 'structure' || am.id === 'mc').map(am => (
              <button
                key={am.id}
                id={`answer-mode-${am.id}`}
                onClick={() => setAnswerMode(am.id)}
                className={`vm-btn text-left p-4 rounded-xl border-2 ${
                  answerMode === am.id
                    ? 'bg-[var(--sb-plum-soft)] border-[var(--sb-ink)] text-[var(--sb-ink)] shadow-[var(--sb-shadow-sm)]'
                    : 'bg-[var(--sb-paper-card)] border-[var(--sb-ink-border)] text-[var(--sb-ink)] hover:border-[var(--sb-ink)] hover:bg-[var(--sb-paper-deep)]'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {am.id === 'mc'
                    ? <Type size={14} className={answerMode === am.id ? 'text-[var(--sb-plum-text)]' : 'text-[var(--sb-ink-soft)]'} />
                    : <Headphones size={14} className={answerMode === am.id ? 'text-[var(--sb-plum-text)]' : 'text-[var(--sb-ink-soft)]'} />}
                  <p className="font-extrabold text-sm">{am.label}</p>
                </div>
                <p className="text-xs text-[var(--sb-ink-soft)] font-medium">{am.desc}</p>
              </button>
            ))}
          </div>
        </Section>

        {/* Info banner */}
        <div className="flex items-start gap-3 bg-[var(--sb-sky-soft)] border-2 border-[var(--sb-ink)] shadow-[var(--sb-shadow-sm)] rounded-2xl p-4">
          <span className="text-xl shrink-0">{mode === 'vstep' ? '🎯' : '✍️'}</span>
          <p className="text-[var(--sb-ink)] text-xs font-medium leading-relaxed">
            {mode === 'vstep' ? (
              <><strong className="text-[var(--sb-sky-text)]">VSTEP B1–B2 (English):</strong> The AI generates
              English sentences at VSTEP B1–B2 level with a <strong>[_____] blank</strong>, common collocations,
              and 4 English word choices. Explanation is in Vietnamese.</>
            ) : mode === 'structure' ? (
              <><strong className="text-[var(--sb-sky-text)]">Cấu trúc ngữ pháp:</strong> AI tạo câu VSTEP B1–B2 dựa trên cấu trúc đã chọn, có 4 đáp án và điểm bẫy.</>
            ) : (
              <><strong className="text-[var(--sb-sky-text)]">Vietnamese → English:</strong> The AI writes a Vietnamese
              context sentence with a <strong>[_____] blank</strong> and 4 English word choices.</>
            )}
            {answerMode === 'dictation' && (
              <span className="block mt-1 text-[var(--sb-plum-text)] font-semibold">
                🎧 <strong>Listening & Typing mode:</strong> You'll hear
                the word, see the answer immediately, and type it manually.
              </span>
            )}
          </p>
        </div>

        {/* ── Step 1: Copy Prompt ─────────────────────────────────────── */}
        <div className="vm-panel rounded-2xl p-5">
          <div className="flex items-center gap-2.5 mb-1">
            <span className="w-6 h-6 rounded-full bg-[var(--sb-terracotta-soft)] border border-[var(--sb-ink)] text-[var(--sb-terracotta-text)] text-xs font-extrabold flex items-center justify-center shrink-0">
              1
            </span>
            <h3 className="sb-font-body text-[var(--sb-ink)] font-bold text-base">Copy the AI Prompt</h3>
          </div>
          <p className="text-[var(--sb-ink-soft)] text-xs font-medium ml-8 mb-4">
            Paste it into{' '}
            <a
              href="https://gemini.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--sb-terracotta-text)] hover:text-[var(--sb-terracotta-hover)] font-bold underline"
            >
              Gemini
            </a>
            ,{' '}
            <a
              href="https://chat.openai.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--sb-terracotta-text)] hover:text-[var(--sb-terracotta-hover)] font-bold underline"
            >
              ChatGPT
            </a>
            , or any AI assistant — then copy the JSON it returns.
          </p>

          <button
            id="copy-prompt-btn"
            onClick={handleCopy}
            disabled={!hasSource}
            className={`vm-btn w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm ${
              copied
                ? 'bg-[var(--sb-forest-btn)] text-white border-2 border-[var(--sb-ink)] shadow-[var(--sb-shadow-sm)]'
                : 'vm-btn-primary disabled:opacity-45 disabled:cursor-not-allowed'
            }`}
          >
            {copied
              ? <><Check size={16} /> Prompt Copied to Clipboard!</>
              : <><Copy size={16} /> 📋 Copy AI Prompt</>
            }
          </button>
        </div>

        {/* ── Step 2: Paste JSON & Start ──────────────────────────────── */}
        <div className="vm-panel rounded-2xl p-5">
          <div className="flex items-center gap-2.5 mb-1">
            <span className="w-6 h-6 rounded-full bg-[var(--sb-terracotta-soft)] border border-[var(--sb-ink)] text-[var(--sb-terracotta-text)] text-xs font-extrabold flex items-center justify-center shrink-0">
              2
            </span>
            <h3 className="sb-font-body text-[var(--sb-ink)] font-bold text-base">Paste AI Response (JSON)</h3>
          </div>
          <p className="text-[var(--sb-ink-soft)] text-xs font-medium ml-8 mb-3">
            Paste the full AI reply here. Markdown code fences (` ```json … ``` `) are stripped automatically.
          </p>

          <textarea
            id="json-paste-textarea"
            ref={textareaRef}
            value={jsonPaste}
            onChange={e => { setJsonPaste(e.target.value); setParseError(''); }}
            rows={9}
            placeholder={`Paste the AI response here, e.g.:\n[\n  {\n    "question": "Từ nào có nghĩa là 'nộp chính thức'?",\n    "options": ["submit", "dismiss", "acquire", "negotiate"],\n    "answerIndex": 0,\n    "explanation": "'Submit' means to hand something in officially.",\n    "wordEnglish": "submit"\n  }\n]`}
            className="w-full vm-input rounded-xl px-4 py-3 text-xs font-mono resize-y min-h-[160px]"
          />

          {/* Parse error */}
          {parseError && (
            <div role="alert" className="flex items-start gap-2 mt-3 bg-[var(--sb-berry-soft)] border-2 border-[var(--sb-berry)] rounded-xl px-4 py-3 animate-fade-in">
              <AlertCircle size={14} className="text-[var(--sb-berry-text)] shrink-0 mt-0.5" />
              <p className="text-[var(--sb-berry-text)] text-xs font-semibold leading-relaxed">{parseError}</p>
            </div>
          )}

          {/* Start button */}
          <button
            id="start-quiz-btn"
            onClick={handleStart}
            disabled={!jsonPaste.trim()}
            className="vm-btn vm-btn-violet mt-4 w-full flex items-center justify-center gap-2 py-4 disabled:opacity-45 disabled:cursor-not-allowed rounded-2xl font-bold text-base"
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
  if (!answered)              return 'bg-[var(--sb-paper-card)] border-[var(--sb-ink)] text-[var(--sb-ink)] hover:bg-[var(--sb-paper-warm)] shadow-[var(--sb-shadow-sm)]';
  if (idx === correctIndex)   return 'bg-[var(--sb-forest-soft)] border-[var(--sb-forest)] text-[var(--sb-forest-text)] shadow-[var(--sb-shadow-sm)]';
  if (idx === selected)       return 'bg-[var(--sb-berry-soft)] border-[var(--sb-berry)] text-[var(--sb-berry-text)] shadow-[var(--sb-shadow-sm)]';
  return 'bg-[var(--sb-disabled-bg)] border-[var(--sb-disabled-border)] text-[var(--sb-disabled-text)] cursor-not-allowed opacity-75';
}

/** Look up display-only notes without changing option or answer text. */
function QuizAnnotation({ english, words, onDark = false }) {
  const annotation = words.find(
    w => w.english.trim().toLowerCase() === (english || '').trim().toLowerCase()
  )?.annotation;

  return annotation?.trim() ? (
    <span className={onDark
      ? 'sb-font-body ml-1 text-xs font-medium text-white/95'
      : 'sb-font-body ml-1.5 text-sm font-medium text-[var(--sb-ink-soft)]'}>
      ({annotation.trim()})
    </span>
  ) : null;
}

/**
 * Play pronunciation using the shared audio utility (Web Speech API → Google TTS).
 * Named wrapper kept so existing call-sites in QuizGame don't need renaming.
 */
function playWordAudio(wordEnglish, options) {
  return playAudio(wordEnglish, options);
}

function QuizGame({ questions, words, onFinish, updateWordLevel, answerMode, mode, recordStructureResult }) {
  /**
   * Live question queue — starts as all shuffled questions.
   * Re-test items for warned words are appended near the end transparently.
   * `queueIndex` is the cursor into this array.
   */
  const [questionQueue, setQuestionQueue] = useState(
    () => questions.map(shuffleOptions)
  );
  const [queueIndex, setQueueIndex] = useState(0);

  /**
   * Hidden warning tracker (NOT stored in global word objects).
   * Maps wordEnglish (lowercase) → true when that word is under a
   * first-wrong grace period. Invisible to the user.
   */
  const warningSetRef = useRef(new Set());

  /**
   * Mirror refs: always hold the live value of the corresponding state.
   * Used inside setTimeout callbacks to avoid stale-closure bugs.
   */
  const queueRef   = useRef(null);  // mirrors questionQueue
  const idxRef     = useRef(0);     // mirrors queueIndex
  const resultsRef = useRef([]);    // mirrors results

  const [selected,   setSelected]   = useState(null);
  const [results,    setResults]    = useState([]);
  const [feedbackImageReady, setFeedbackImageReady] = useState(false);
  const [feedbackImgError,   setFeedbackImgError]   = useState(false);

  // Dictation mode state
  const [typedAnswer,  setTypedAnswer]  = useState('');
  const [dictAnswered, setDictAnswered] = useState(false);
  const [dictCorrect,  setDictCorrect]  = useState(false);
  const [playCount,    setPlayCount]    = useState(0);
  const inputRef = useRef(null);
  const repeatingAudioRef = useRef(null);
  const repeatTimerRef = useRef(null);
  const repeatGenerationRef = useRef(0);
  const advanceTimerRef = useRef(null);
  const feedbackAudioRef = useRef(null);
  const feedbackSessionRef = useRef(0);
  const loadedImagesRef = useRef(new Set());
  const answeredRef = useRef(false);

  const isDictation = answerMode === 'dictation';

  const q        = questionQueue[queueIndex];
  const answered = isDictation ? dictAnswered : selected !== null;

  // Progress is based on original question count (re-tests don't inflate %)
  const originalCount = questions.length;
  const progress = (Math.min(queueIndex, originalCount) / originalCount) * 100;

  // Find the word object for the current question
  const wordObj = mode === 'structure' ? null : words.find(
    w => w.english.toLowerCase() === (q.wordEnglish || '').toLowerCase()
  );

  // Stored imageUrl, otherwise a local initial-letter tile (no image service).
  const imageUrl = wordObj?.imageUrl?.trim() || null;
  const showVisual = mode !== 'structure' && Boolean(q.wordEnglish);

  function stopRepeatingPlayback() {
    repeatGenerationRef.current += 1;
    if (repeatTimerRef.current) {
      clearTimeout(repeatTimerRef.current);
      repeatTimerRef.current = null;
    }
    repeatingAudioRef.current?.cancel();
    repeatingAudioRef.current = null;
  }

  function startRepeatingPlayback(wordEnglish) {
    stopRepeatingPlayback();
    if (!isDictation || dictAnswered || !wordEnglish) return;
    const generation = repeatGenerationRef.current;
    const playNext = () => {
      if (generation !== repeatGenerationRef.current || dictAnswered || !isDictation) return;
      repeatingAudioRef.current = playWordAudio(wordEnglish, {
        onEnd: () => {
          if (generation !== repeatGenerationRef.current || dictAnswered || !isDictation) return;
          repeatTimerRef.current = setTimeout(playNext, 2000);
        }
      });
    };
    playNext();
  }

  // Start a fresh, non-overlapping pronunciation loop for each question.
  useEffect(() => {
    startRepeatingPlayback(q?.wordEnglish);
    return stopRepeatingPlayback;
  }, [queueIndex, isDictation, dictAnswered, q?.wordEnglish]);

  // Preload current question's word image in Multiple Choice so it is instant on answer click.
  useEffect(() => {
    if (isDictation || !showVisual || !imageUrl) return;
    if (loadedImagesRef.current.has(imageUrl)) return;
    let active = true;
    const img = new Image();
    img.onload = () => {
      if (active) loadedImagesRef.current.add(imageUrl);
    };
    img.onerror = () => {
      if (active) loadedImagesRef.current.delete(imageUrl);
    };
    img.src = imageUrl;
    if (img.complete && img.naturalWidth > 0) {
      loadedImagesRef.current.add(imageUrl);
    }
    return () => { active = false; };
  }, [isDictation, showVisual, imageUrl]);

  function stopFeedback() {
    feedbackSessionRef.current += 1;
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
    feedbackAudioRef.current?.cancel();
    feedbackAudioRef.current = null;
  }

  // Nothing from the current question may continue after the quiz unmounts.
  useEffect(() => () => {
    stopRepeatingPlayback();
    stopFeedback();
  }, []);

  // Reset dictation state when question advances
  useEffect(() => {
    answeredRef.current = false;
    setTypedAnswer('');
    setDictAnswered(false);
    setDictCorrect(false);
    setPlayCount(0);
    if (isDictation) {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [queueIndex, isDictation]);

  // Keep refs in sync with state on every render so setTimeout callbacks
  // always see the latest values regardless of when they fire.
  queueRef.current   = questionQueue;
  idxRef.current     = queueIndex;
  resultsRef.current = results;

  /**
   * Core grading logic — called once per answer.
   * Takes explicit arguments instead of closing over state to avoid
   * stale-closure bugs when called from event handlers.
   *
   * STRICT WARNING-STATE ALGORITHM:
   *
   *   Branch 1 — First wrong (no flag):
   *     • Add warning flag for this word.
   *     • Splice a re-test copy into the live queue (mutates queueRef + state).
   *     • Record wrong in tally.
   *     • *** DO NOT call updateWordLevel — word level is UNCHANGED. ***
   *
   *   Branch 2a — Re-test correct (forgiven):
   *     • Clear flag.
   *     • Call updateWordLevel(word, true) — streak increment, no demotion.
   *     • Retroactively fix tally entry.
   *
   *   Branch 2b — Re-test wrong (confirmed mistake):
   *     • Clear flag.
   *     • Call updateWordLevel(word, false) — level −1.
   *
   *   Branch 3 — Normal correct (no flag):
   *     • Call updateWordLevel(word, true) — streak/level up.
   *
   * updateWordLevel(word, false) is called ONLY in Branch 2b. Nowhere else.
   */
  function grade(isCorrect, currentQ, currentResults) {
    if (mode === 'structure') {
      recordStructureResult?.(currentQ.structureId, isCorrect);
      const newResults = [...currentResults, { correct: isCorrect, structureId: currentQ.structureId }];
      resultsRef.current = newResults;
      setResults(newResults);
      return;
    }
    const key      = (currentQ.wordEnglish || '').toLowerCase();
    const isWarned = warningSetRef.current.has(key);

    // ── Branch 1: First wrong ──────────────────────────────────────────────
    if (!isCorrect && !isWarned) {
      warningSetRef.current.add(key);

      // Re-shuffle options so the re-test feels fresh
      const retestQ   = shuffleOptions({ ...currentQ });
      const liveQueue = queueRef.current;
      const liveIdx   = idxRef.current;
      const insertAt  = Math.max(liveQueue.length - 2, liveIdx + 2);
      const nextQueue = [...liveQueue];
      nextQueue.splice(insertAt, 0, retestQ);

      // Write to ref immediately so advanceAfterDelay sees updated length
      queueRef.current = nextQueue;
      setQuestionQueue(nextQueue);

      // Tally: record wrong — store is NOT touched
      const newResults = [...currentResults, { correct: false, wordEnglish: currentQ.wordEnglish }];
      resultsRef.current = newResults;
      setResults(newResults);
      return; // ← explicit early return; no updateWordLevel call
    }

    // ── Branch 2a: Re-test correct (forgiven) ────────────────────────────
    if (isWarned && isCorrect) {
      warningSetRef.current.delete(key);
      if (currentQ.wordEnglish) updateWordLevel(currentQ.wordEnglish, true);

      // Retroactively flip the earliest wrong entry for this word in the tally
      const copy = [...currentResults];
      for (let i = copy.length - 1; i >= 0; i--) {
        if ((copy[i].wordEnglish || '').toLowerCase() === key && !copy[i].correct) {
          copy[i] = { ...copy[i], correct: true };
          break;
        }
      }
      resultsRef.current = copy;
      setResults(copy);
      return;
    }

    // ── Branch 2b: Re-test wrong (confirmed mistake) ──────────────────────
    if (isWarned && !isCorrect) {
      warningSetRef.current.delete(key);
      if (currentQ.wordEnglish) updateWordLevel(currentQ.wordEnglish, false); // level −1
      const newResults = [...currentResults, { correct: false, wordEnglish: currentQ.wordEnglish }];
      resultsRef.current = newResults;
      setResults(newResults);
      return;
    }

    // ── Branch 3: Normal correct ──────────────────────────────────────────
    if (currentQ.wordEnglish) updateWordLevel(currentQ.wordEnglish, true);
    const newResults = [...currentResults, { correct: true, wordEnglish: currentQ.wordEnglish }];
    resultsRef.current = newResults;
    setResults(newResults);
  }

  /**
   * Advance immediately to the next question (or finish the quiz).
   * Reads only from live refs — immune to stale-closure bugs.
   */
  function advanceNow() {
    stopFeedback();
    const liveQueue   = queueRef.current;
    const liveIdx     = idxRef.current;
    const liveResults = resultsRef.current;
    const isLast      = liveIdx + 1 >= liveQueue.length;

    if (isLast) {
      onFinish(liveResults);
    } else {
      const nextIdx  = liveIdx + 1;
      idxRef.current = nextIdx;
      setQueueIndex(nextIdx);
      setSelected(null);
      setFeedbackImageReady(false);
      setFeedbackImgError(false);
    }
  }

  /**
   * Advance to the next question after the fixed feedback delay
   * (used by Dictation and Structure modes).
   */
  function advanceAfterDelay() {
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    advanceTimerRef.current = setTimeout(() => {
      advanceTimerRef.current = null;
      advanceNow();
    }, FEEDBACK_MIN_MS);
  }

  /**
   * Multiple Choice vocabulary feedback: speak the target word immediately
   * inside the click gesture and advance only once minimum delay, audio end,
   * and minimum image visibility are all satisfied (capped at FEEDBACK_MAX_MS).
   */
  function startMcFeedback(wordEnglish) {
    stopFeedback();
    const sessionId = feedbackSessionRef.current;
    const startedAt = getFeedbackNowMs();
    const imageShownAt = startedAt;
    let audioEnded = false;

    const scheduleAdvanceCheck = () => {
      if (sessionId !== feedbackSessionRef.current) return;
      const evaluation = evaluateFeedbackAdvance({
        nowMs: getFeedbackNowMs(),
        startedAtMs: startedAt,
        imageShownAtMs: imageShownAt,
        audioEnded,
        minMs: FEEDBACK_MIN_MS,
        imageMs: FEEDBACK_IMAGE_MS,
        maxMs: FEEDBACK_MAX_MS,
      });
      if (evaluation.shouldAdvance) {
        advanceNow();
        return;
      }
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = setTimeout(() => {
        advanceTimerRef.current = null;
        scheduleAdvanceCheck();
      }, evaluation.waitMs);
    };

    feedbackAudioRef.current = playWordAudio(wordEnglish, {
      onEnd: () => {
        if (sessionId !== feedbackSessionRef.current) return;
        audioEnded = true;
        scheduleAdvanceCheck();
      },
    });

    scheduleAdvanceCheck();
  }

  function handleSelect(idx) {
    if (answered || answeredRef.current) return;
    answeredRef.current = true;
    setSelected(idx);
    const isCorrect = idx === q.correctIndex;
    grade(isCorrect, q, resultsRef.current);
    if (!isDictation && showVisual) {
      setFeedbackImageReady(Boolean(imageUrl && loadedImagesRef.current.has(imageUrl)));
      setFeedbackImgError(false);
      startMcFeedback(q.wordEnglish);
    } else {
      advanceAfterDelay();
    }
  }

  // Dictation: play audio and count plays
  function handleDictationPlay() {
    if (q.wordEnglish) {
      startRepeatingPlayback(q.wordEnglish);
      setPlayCount(c => c + 1);
    }
  }

  // Dictation: submit typed answer
  function handleDictationSubmit() {
    if (!typedAnswer.trim() || dictAnswered || answeredRef.current) return;
    answeredRef.current = true;
    stopRepeatingPlayback();
    const isCorrect =
      typedAnswer.trim().toLowerCase() === (q.wordEnglish || '').toLowerCase();
    setDictCorrect(isCorrect);
    setDictAnswered(true);
    grade(isCorrect, q, resultsRef.current);
    advanceAfterDelay();
  }

  // Dictation: I Know It (auto-skip)
  function handleIKnowIt() {
    if (dictAnswered || answeredRef.current) return;
    answeredRef.current = true;
    stopRepeatingPlayback();
    setTypedAnswer(q.wordEnglish || '');
    setDictCorrect(true);
    setDictAnswered(true);
    grade(true, q, resultsRef.current);
    advanceAfterDelay();
  }

  return (
    <div className="vm-page-enter max-w-2xl mx-auto">
      {/* Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm text-[var(--sb-ink-soft)] mb-2">
          <span className="font-bold text-[var(--sb-ink)] tabular-nums">
            Question {Math.min(queueIndex + 1, originalCount)}{' '}
            <span className="text-[var(--sb-ink-soft)]">/ {originalCount}</span>
          </span>
          <span className="tabular-nums font-semibold">{Math.round(progress)}% done</span>
        </div>
        <div className="w-full h-3 bg-[var(--sb-paper-deep)] rounded-full overflow-hidden border-2 border-[var(--sb-ink)]">
          <div
            className="h-full bg-gradient-to-r from-[var(--sb-terracotta)] via-[var(--sb-ochre)] to-[var(--sb-forest)] progress-fill rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Question card — Listening & Typing shows the image immediately; MC reserves a fixed right slot */}
      <div className="vm-card rounded-2xl p-6 mb-5">
        <div className={`flex ${isDictation && showVisual ? 'flex-col sm:flex-row gap-5' : !isDictation && showVisual ? 'items-start gap-3 sm:gap-5' : 'gap-5'}`}>

          {/* Left: question text + explanation */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-3">
              <Brain size={15} className="text-[var(--sb-terracotta-strong)]" />
              <span className="text-[var(--sb-terracotta-text)] text-xs font-extrabold uppercase tracking-wider">Question</span>
            </div>
            <p className="sb-font-body text-[var(--sb-ink)] text-xl font-bold leading-relaxed">{q.question}</p>

            {/* Explanation appears below the question on the left */}
            {answered && q.explanation && (
              <div className="mt-4 bg-[var(--sb-paper-warm)] border-2 border-[var(--sb-ink)] rounded-xl px-4 py-3 animate-fade-in">
                <p className="sb-font-body text-[var(--sb-ink)] text-base font-medium leading-relaxed">
                  <span className="text-[var(--sb-terracotta-text)] font-bold">💡 </span>
                  {q.explanation}
                  {mode === 'structure' && q.trapPoint && (
                    <span className="block mt-2 text-[var(--sb-ochre-text)]"><strong>Điểm bẫy: </strong>{q.trapPoint}</span>
                  )}
                </p>
              </div>
            )}
          </div>

          {/* Right: vocabulary image — visible immediately in Listening & Typing */}
          {isDictation && showVisual && (
            <div className="animate-fade-in sm:w-56 sm:shrink-0 rounded-2xl overflow-hidden border-2 border-[var(--sb-ink)] shadow-[var(--sb-shadow-sm)] relative">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={q.wordEnglish}
                  className="w-full h-48 sm:h-full object-cover"
                  onError={e => { e.target.style.display = 'none'; }}
                />
              ) : (
                <WordInitialTile word={q.wordEnglish} className="w-full h-48 sm:h-full" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[var(--sb-ink)]/80 via-transparent to-transparent" />
              <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
                <Volume2 size={13} className="text-white/90" />
                <span className="text-white font-bold text-sm drop-shadow">
                  {q.wordEnglish}
                  <QuizAnnotation english={q.wordEnglish} words={words} onDark />
                </span>
              </div>
            </div>
          )}

          {/* Right: reserved square image slot for Multiple Choice vocabulary (no answer leaked before click) */}
          {!isDictation && showVisual && (
            <div
              id="quiz-mc-image-slot"
              aria-live="polite"
              className="w-[72px] h-[72px] min-[360px]:w-24 min-[360px]:h-24 sm:w-[176px] sm:h-[176px] shrink-0 self-start rounded-2xl overflow-hidden border-2 border-[var(--sb-ink)] bg-[var(--sb-paper-warm)] shadow-[var(--sb-shadow-sm)] relative"
            >
              {answered ? (
                <div className="vm-feedback-in relative w-full h-full">
                  {imageUrl && feedbackImageReady && !feedbackImgError ? (
                    <img
                      src={imageUrl}
                      alt={q.wordEnglish}
                      className="w-full h-full object-cover"
                      onError={() => setFeedbackImgError(true)}
                    />
                  ) : (
                    <WordInitialTile word={q.wordEnglish} className="w-full h-full" />
                  )}
                  <div className="hidden sm:block absolute inset-0 bg-gradient-to-t from-[var(--sb-ink)]/85 via-[var(--sb-ink)]/25 to-transparent pointer-events-none" />
                  <div className="hidden sm:flex absolute bottom-2.5 left-2.5 right-2.5 items-center gap-1.5">
                    <Volume2 size={13} className="text-[var(--sb-ochre-soft)] shrink-0" />
                    <span className="text-white font-bold text-sm drop-shadow truncate">
                      {q.wordEnglish}
                      <QuizAnnotation english={q.wordEnglish} words={words} onDark />
                    </span>
                  </div>
                </div>
              ) : (
                <div
                  aria-hidden="true"
                  className="w-full h-full flex items-center justify-center bg-[var(--sb-paper-deep)]"
                >
                  <ImageIcon size={24} className="text-[var(--sb-ink-soft)]/70 sm:w-8 sm:h-8" />
                </div>
              )}
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
              className={`vm-btn w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left
                ${optionClass(idx, answered, q.correctIndex, selected)}`}
            >
              <span className="shrink-0 w-8 h-8 rounded-lg bg-[var(--sb-paper-deep)] border border-[var(--sb-ink)] text-[var(--sb-ink)] flex items-center justify-center font-extrabold text-sm">
                {OPTION_LABELS[idx]}
              </span>
              <span className="font-bold flex-1">
                {opt}
                <QuizAnnotation english={opt} words={words} />
              </span>
              {answered && idx === q.correctIndex && (
                <CheckCircle size={18} className="ml-auto text-[var(--sb-forest-text)] shrink-0 vm-scale-in" />
              )}
              {answered && idx === selected && idx !== q.correctIndex && (
                <XCircle size={18} className="ml-auto text-[var(--sb-berry-text)] shrink-0 vm-scale-in" />
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
              className="vm-btn vm-btn-primary flex items-center gap-2 px-5 py-3 disabled:opacity-45 disabled:cursor-not-allowed rounded-xl font-bold text-sm"
            >
              <Headphones size={17} />
              {playCount === 0 ? 'Play Word' : `Play Again (×${playCount})`}
            </button>
            {!dictAnswered && (
              <span className="text-[var(--sb-ink-soft)] font-medium text-xs">
                Audio repeats automatically; Play Again replays immediately.
              </span>
            )}
          </div>
          {/* The answer is visible immediately so learners can listen and type it. */}
          {!dictAnswered && (
            <div className="flex items-center gap-2 bg-[var(--sb-ochre-soft)] border-2 border-[var(--sb-ochre-text)] rounded-xl px-4 py-2.5 animate-fade-in">
              <AlertCircle size={14} className="text-[var(--sb-ochre-text)] shrink-0" />
              <span className="text-[var(--sb-ink)] text-sm font-medium">
                Answer: <strong className="text-[var(--sb-ochre-text)]">
                  {q.wordEnglish}
                  <QuizAnnotation english={q.wordEnglish} words={words} />
                </strong>
              </span>
            </div>
          )}

          {/* Text input */}
          <div className="flex gap-2 flex-wrap">
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
              className={`flex-1 min-w-0 vm-input rounded-xl px-4 py-3 text-sm font-mono
                ${
                  dictAnswered
                    ? dictCorrect
                      ? 'border-[var(--sb-forest)] bg-[var(--sb-forest-soft)] text-[var(--sb-forest-text)]'
                      : 'border-[var(--sb-berry)] bg-[var(--sb-berry-soft)] text-[var(--sb-berry-text)]'
                    : ''
                }`}
            />
            <button
              id="dictation-submit-btn"
              onClick={handleDictationSubmit}
              disabled={!typedAnswer.trim() || dictAnswered}
              className="vm-btn vm-btn-violet flex items-center gap-1.5 px-5 py-3 disabled:opacity-45 disabled:cursor-not-allowed rounded-xl font-bold text-sm"
            >
              <Send size={15} /> Submit
            </button>
            <button
              id="dictation-iknowit-btn"
              onClick={handleIKnowIt}
              disabled={dictAnswered}
              className="vm-btn flex items-center gap-1.5 px-5 py-3 bg-[var(--sb-paper-card)] border-2 border-[var(--sb-ink)] hover:bg-[var(--sb-paper-deep)] disabled:opacity-45 disabled:cursor-not-allowed text-[var(--sb-ink)] rounded-xl font-bold text-sm shadow-[var(--sb-shadow-sm)]"
              title="Auto-skip and mark as correct"
            >
              <FastForward size={15} /> I Know It
            </button>
          </div>

          {/* Feedback after submit */}
          {dictAnswered && (
            <div className={`flex items-center gap-2 rounded-xl px-4 py-3 border-2 animate-fade-in ${
              dictCorrect
                ? 'bg-[var(--sb-forest-soft)] border-[var(--sb-forest)]'
                : 'bg-[var(--sb-berry-soft)] border-[var(--sb-berry)]'
            }`}>
              {dictCorrect
                ? <CheckCircle size={16} className="text-[var(--sb-forest-text)] shrink-0" />
                : <XCircle    size={16} className="text-[var(--sb-berry-text)] shrink-0" />}
              <span className={`text-sm font-bold ${
                dictCorrect ? 'text-[var(--sb-forest-text)]' : 'text-[var(--sb-berry-text)]'
              }`}>
                {dictCorrect
                  ? 'Correct! 🎉'
                  : <>Wrong. The answer is <strong className="text-[var(--sb-ink)]">
                      {q.wordEnglish}
                      <QuizAnnotation english={q.wordEnglish} words={words} />
                    </strong></>}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Auto-advancing spinner */}
      {answered && (
        <div className="animate-fade-in flex items-center justify-center gap-2 py-2 text-[var(--sb-ink-soft)] font-semibold text-sm">
          <div className="w-4 h-4 border-2 border-[var(--sb-paper-deep)] border-t-[var(--sb-terracotta-strong)] rounded-full animate-spin" />
          {queueIndex + 1 >= questionQueue.length
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
function QuizResults({ results, onRestart, mode }) {
  const total   = results.length;
  const correct = results.filter(r => r.correct).length;
  const pct     = Math.round((correct / total) * 100);

  const grade =
    pct >= 90 ? { label: 'Excellent!',  color: 'text-[var(--sb-forest-text)]',     emoji: '🏆' } :
    pct >= 70 ? { label: 'Good Job!',   color: 'text-[var(--sb-terracotta-text)]', emoji: '👏' } :
    pct >= 50 ? { label: 'Keep Going!', color: 'text-[var(--sb-ochre-text)]',      emoji: '💪' } :
               { label: 'Try Again!',   color: 'text-[var(--sb-berry-text)]',      emoji: '📚' };

  return (
    <div className="vm-page-enter max-w-lg mx-auto text-center">
      <div className="vm-card rounded-3xl p-8 mb-6 vm-scale-in">
        <div className="text-6xl mb-4">{grade.emoji}</div>
        <h2 className={`sb-font-display text-3xl font-extrabold tracking-tight mb-2 ${grade.color}`}>{grade.label}</h2>
        <p className="text-[var(--sb-ink-soft)] font-semibold mb-6">Quiz complete! Here's how you did:</p>

        <div className="flex items-center justify-center gap-8 mb-6">
          <div>
            <p className="sb-font-display text-4xl font-black text-[var(--sb-ink)] tabular-nums">{correct}/{total}</p>
            <p className="text-[var(--sb-ink-soft)] font-semibold text-sm mt-1">Correct</p>
          </div>
          <div className="w-px h-12 bg-[var(--sb-ink-border)]" />
          <div>
            <p className={`sb-font-display text-4xl font-black tabular-nums ${grade.color}`}>{pct}%</p>
            <p className="text-[var(--sb-ink-soft)] font-semibold text-sm mt-1">Accuracy</p>
          </div>
        </div>

        <div className="bg-[var(--sb-paper-warm)] border-2 border-[var(--sb-ink)] rounded-xl p-3.5 text-sm font-medium text-[var(--sb-ink)]">
          <Zap size={14} className="inline text-[var(--sb-terracotta-strong)] mr-1.5" />
          {mode === 'structure' ? 'Tiến độ L1–L5 của cấu trúc được cập nhật theo câu trả lời.' : 'Word mastery levels & streaks updated based on your answers.'}
        </div>
      </div>

      <button
        id="restart-quiz-btn"
        onClick={onRestart}
        className="vm-btn vm-btn-primary flex items-center justify-center gap-2 mx-auto px-8 py-3.5 rounded-2xl font-bold"
      >
        <RotateCcw size={16} /> Take Another Quiz
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Root                                                                 */
/* ------------------------------------------------------------------ */
export default function Quiz({ words, structures = [], updateWordLevel, recordQuizResult, recordStructureResult }) {
  const [phase,      setPhase]      = useState('config');
  const [questions,  setQuestions]  = useState([]);
  const [results,    setResults]    = useState([]);
  const [answerMode, setAnswerMode] = useState('mc');
  const [quizMode, setQuizMode] = useState('vn');

  function handleStart(qs, am, selectedMode) {
    setQuestions(qs);
    setAnswerMode(am || 'mc');
    setQuizMode(selectedMode || 'vn');
    setPhase('game');
  }

  function handleFinish(res) {
    setResults(res);
    if (quizMode !== 'structure') {
      recordQuizResult(res.filter(r => r.correct).length, res.length);
    }
    setPhase('results');
  }

  function handleRestart() {
    setPhase('config');
    setQuestions([]);
    setResults([]);
  }

  if (phase === 'config')  return <QuizConfig words={words} structures={structures} onStart={handleStart} />;
  if (phase === 'game')    return <QuizGame   questions={questions} words={words} onFinish={handleFinish} updateWordLevel={updateWordLevel} answerMode={answerMode} mode={quizMode} recordStructureResult={recordStructureResult} />;
  if (phase === 'results') return <QuizResults results={results} onRestart={handleRestart} mode={quizMode} />;
  return null;
}
