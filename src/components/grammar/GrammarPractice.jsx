import { useState } from 'react';
import { Copy, Check, Zap, ChevronDown, ChevronUp, AlertCircle, Upload, RefreshCw } from 'lucide-react';
import {
  GRAMMAR_TOPICS,
  GRAMMAR_COUNTS,
  getTopicLabel,
  buildGrammarPrompt,
  validateGrammarJSON,
  normalizeQuestions,
} from '../../utils/grammarPrompt';

/**
 * GrammarPractice — Step 1: Configure → Copy prompt → Paste JSON → Start quiz.
 */
export default function GrammarPractice({ onStartSession }) {
  const [count,      setCount]      = useState(10);
  const [topic,      setTopic]      = useState('Mixed');
  const [copied,     setCopied]     = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [jsonInput,  setJsonInput]  = useState('');
  const [error,      setError]      = useState(null);
  const [validating, setValidating] = useState(false);

  const prompt = buildGrammarPrompt({ count, topic });

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
    }
  }

  function handleImport() {
    setError(null);
    setValidating(true);
    setTimeout(() => {
      try {
        const raw = jsonInput.trim();
        if (!raw) { setError(['Vui lòng dán JSON từ AI vào ô bên trên.']); setValidating(false); return; }

        // Strip markdown code fences if user accidentally included them
        const cleaned = raw
          .replace(/^```(?:json)?\s*/i, '')
          .replace(/\s*```$/, '')
          .trim();

        const parsed = JSON.parse(cleaned);
        const { valid, errors } = validateGrammarJSON(parsed);

        if (!valid) { setError(errors); setValidating(false); return; }

        const questions = normalizeQuestions(parsed);
        onStartSession({ questions, config: { count, topic } });
      } catch (e) {
        setError([`JSON không hợp lệ: ${e.message}`, 'Hãy đảm bảo bạn copy toàn bộ JSON từ AI, không thiếu "[" hoặc "]".']);
      }
      setValidating(false);
    }, 300);
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
          <Zap size={20} className="text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Grammar Practice</h2>
          <p className="text-slate-400 text-sm">TOEIC Part 5 — Sentence Completion</p>
        </div>
      </div>

      {/* Step 1: Configure */}
      <div className="bg-slate-900/80 border border-slate-700/50 rounded-2xl p-5 space-y-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-6 h-6 rounded-full bg-purple-600 text-white text-xs font-bold flex items-center justify-center">1</span>
          <h3 className="text-white font-semibold">Cấu hình bài luyện</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Count */}
          <div>
            <label className="block text-slate-400 text-xs font-medium mb-2">Số câu hỏi</label>
            <div className="flex gap-2 flex-wrap">
              {GRAMMAR_COUNTS.map(n => (
                <button
                  key={n}
                  onClick={() => setCount(n)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                    count === n
                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30'
                      : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Topic */}
          <div>
            <label className="block text-slate-400 text-xs font-medium mb-2">Chủ đề ngữ pháp</label>
            <select
              value={topic}
              onChange={e => setTopic(e.target.value)}
              className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500 transition-colors"
            >
              {GRAMMAR_TOPICS.map(t => (
                <option key={t} value={t}>{getTopicLabel(t)}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Step 2: Copy prompt */}
      <div className="bg-slate-900/80 border border-slate-700/50 rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-purple-600 text-white text-xs font-bold flex items-center justify-center">2</span>
          <h3 className="text-white font-semibold">Copy prompt → Dán vào ChatGPT / Gemini</h3>
        </div>

        <p className="text-slate-400 text-sm">
          Copy prompt bên dưới, dán vào <span className="text-purple-400 font-medium">ChatGPT</span> hoặc <span className="text-blue-400 font-medium">Gemini</span>, sau đó copy toàn bộ JSON kết quả trả về.
        </p>

        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
              copied
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/30'
                : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-500/20'
            }`}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? 'Đã copy!' : 'Copy Prompt'}
          </button>
          <button
            onClick={() => setPromptOpen(v => !v)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-all duration-200"
          >
            {promptOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            {promptOpen ? 'Ẩn prompt' : 'Xem prompt'}
          </button>
        </div>

        {promptOpen && (
          <div className="bg-slate-950 border border-slate-700 rounded-xl p-4 max-h-64 overflow-y-auto">
            <pre className="text-slate-300 text-xs whitespace-pre-wrap font-mono leading-relaxed">{prompt}</pre>
          </div>
        )}
      </div>

      {/* Step 3: Paste JSON */}
      <div className="bg-slate-900/80 border border-slate-700/50 rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-purple-600 text-white text-xs font-bold flex items-center justify-center">3</span>
          <h3 className="text-white font-semibold">Dán JSON từ AI vào đây</h3>
        </div>

        <textarea
          value={jsonInput}
          onChange={e => { setJsonInput(e.target.value); setError(null); }}
          placeholder={`Dán toàn bộ JSON từ ChatGPT/Gemini vào đây...\n\nVí dụ:\n[\n  {\n    "id": "q1",\n    "sentence": "The report will be _____ to the board...",\n    ...\n  }\n]`}
          rows={10}
          className="w-full bg-slate-950 border border-slate-600 text-slate-200 rounded-xl px-4 py-3 text-sm font-mono placeholder-slate-600 focus:outline-none focus:border-purple-500 transition-colors resize-y"
        />

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle size={16} className="text-rose-400" />
              <span className="text-rose-400 text-sm font-semibold">Lỗi validation JSON</span>
            </div>
            <ul className="space-y-1">
              {error.map((e, i) => (
                <li key={i} className="text-rose-300 text-sm">• {e}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center justify-between">
          <p className="text-slate-500 text-xs">
            JSON sẽ được validate tự động trước khi bắt đầu.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => { setJsonInput(''); setError(null); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-all duration-200"
            >
              <RefreshCw size={14} />
              Xoá
            </button>
            <button
              onClick={handleImport}
              disabled={validating || !jsonInput.trim()}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-500/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload size={16} />
              {validating ? 'Đang kiểm tra…' : 'Bắt đầu luyện tập'}
            </button>
          </div>
        </div>
      </div>

      {/* Tips */}
      <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-2xl p-4">
        <h4 className="text-indigo-400 font-semibold text-sm mb-2">💡 Mẹo sử dụng</h4>
        <ul className="space-y-1 text-slate-400 text-sm">
          <li>• Với <span className="text-white">ChatGPT-4o</span> hoặc <span className="text-white">Gemini Pro</span> cho kết quả tốt nhất.</li>
          <li>• Nếu AI không trả về JSON đúng định dạng, thêm: <span className="text-purple-300 font-mono text-xs">"Return ONLY the JSON array, starting with [ and ending with ]"</span></li>
          <li>• Bạn có thể lưu các câu hỏi hay bằng nút bookmark ⭐ trong khi luyện.</li>
          <li>• Câu hỏi đã lưu sẽ xuất hiện trong tab <span className="text-white">Saved Questions</span> và <span className="text-white">Review</span>.</li>
        </ul>
      </div>
    </div>
  );
}
