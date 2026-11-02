import { useState } from 'react';
import { Copy, Check, Zap, ChevronDown, ChevronUp, AlertCircle, Upload, RefreshCw } from 'lucide-react';
import {
  GRAMMAR_TOPICS,
  GRAMMAR_COUNTS,
  getTopicLabel,
  buildGrammarPrompt,
} from '../../utils/grammarPrompt';
import { prepareGrammarImport, completeGrammarImport, formatGrammarIssue } from '../../utils/grammarImport';
import { getRecentGrammarSentences } from '../../utils/grammarBatch';

/**
 * GrammarPractice — Step 1: Configure → Copy prompt → Paste JSON → Start quiz.
 */
export default function GrammarPractice({ onStartSession, batch, onNewBatch, settings = { count: 10, topic: 'Mixed' }, onSettingsChange }) {
  const { count, topic } = settings;
  const [copied,     setCopied]     = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [jsonInput,  setJsonInput]  = useState('');
  const [error,      setError]      = useState(null);
  const [importReview, setImportReview] = useState(null);
  const [excludedItems, setExcludedItems] = useState([]);
  const [allowDuplicates, setAllowDuplicates] = useState(false);

  const prompt = buildGrammarPrompt({ count, topic, batchId: batch?.id, recentSentences: batch?.recentSentences });

  function resetImportReview() {
    setError(null); setImportReview(null); setExcludedItems([]); setAllowDuplicates(false);
  }

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
    resetImportReview();
    const result = prepareGrammarImport(jsonInput, { count, topic, recentSentences: getRecentGrammarSentences(batch?.recentSentences || []) });
    if (result.errors.length) { setError(result.errors.map(formatGrammarIssue)); return; }
    if (result.optionalIssues.length || result.duplicates.length) { setImportReview(result); return; }
    startImport(result);
  }

  function startImport(result, choices = {}) {
    const check = completeGrammarImport(result, choices);
    if (!check.valid) { setError(check.errors); return; }
    onStartSession({ questions: check.questions, config: { count, topic } });
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
          <p className="text-slate-400 text-sm">VSTEP B1 · Nhận diện ngữ pháp và phân tích câu</p>
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
            <label className="block text-slate-400 text-xs font-medium mb-2">Số câu</label>
            <div className="flex gap-2 flex-wrap">
              {GRAMMAR_COUNTS.map(n => (
                <button
                  key={n}
                  onClick={() => { onSettingsChange?.({ count: n, topic }); resetImportReview(); }}
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
              onChange={e => { onSettingsChange?.({ count, topic: e.target.value }); resetImportReview(); }}
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
          <h3 className="text-white font-semibold">Copy prompt → Dán vào AI bạn dùng</h3>
        </div>

        <p className="text-slate-400 text-sm">
          Dán prompt vào ChatGPT, Gemini, Claude hoặc AI khác, sau đó copy toàn bộ JSON kết quả trả về.
        </p>
        <p className="text-slate-500 text-xs break-all">Bộ gợi ý: {batch?.id || 'preview'} · Giữ nguyên cho đến khi tạo bộ mới.</p>

        <div className="flex flex-wrap gap-2">
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
          <button onClick={() => { onNewBatch?.(); setCopied(false); resetImportReview(); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700">
            <RefreshCw size={16} /> Tạo prompt mới
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
          onChange={e => { setJsonInput(e.target.value); resetImportReview(); }}
          placeholder="Dán JSON từ AI vào đây. Có thể dán cả khối code JSON; ứng dụng sẽ kiểm tra trước khi bắt đầu."
          rows={10}
          className="w-full bg-slate-950 border border-slate-600 text-slate-200 rounded-xl px-4 py-3 text-sm font-mono placeholder-slate-600 focus:outline-none focus:border-purple-500 transition-colors resize-y"
        />

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle size={16} className="text-rose-400" />
              <span className="text-rose-400 text-sm font-semibold">Cần sửa nội dung sau</span>
            </div>
            <ul className="space-y-1">
              {error.map((e, i) => (
                <li key={i} className="text-rose-300 text-sm">• {e}</li>
              ))}
            </ul>
          </div>
        )}

        {importReview && <div className="bg-amber-500/5 border border-amber-500/30 rounded-xl p-4 space-y-3 text-sm">
          <p className="text-amber-200 font-semibold">Kiểm tra trước khi bắt đầu</p>
          {importReview.normalizations.length > 0 && <p className="text-slate-300">Đã tự khớp {importReview.normalizations.length} trích dẫn về đúng chữ trong câu; câu tiếng Anh và lời giải được giữ nguyên.</p>}
          {importReview.optionalIssues.length > 0 && <>
            <p className="text-slate-300">Các mục đọc hiểu dưới đây chưa hợp lệ. Bạn có thể sửa JSON, hoặc đánh dấu từng mục để chỉ loại mục đó khỏi bộ câu sắp luyện.</p>
            {importReview.optionalIssues.map(issue => <label key={issue.key} className="flex items-start gap-2 text-amber-100 break-words">
              <input type="checkbox" checked={excludedItems.includes(issue.key)} onChange={e => setExcludedItems(prev => e.target.checked ? [...prev, issue.key] : prev.filter(key => key !== issue.key))} className="mt-1 shrink-0" />
              <span>Bỏ mục này — {formatGrammarIssue(issue)}</span>
            </label>)}
          </>}
          {importReview.duplicates.length > 0 && <>
            <p className="text-slate-300">Đã gặp gần đây:</p>
            <ul className="list-disc pl-5 text-amber-100">{importReview.duplicates.map(item => <li key={item.sentence}>Câu {item.sentence}: {item.text}</li>)}</ul>
            <label className="flex items-start gap-2 text-slate-300"><input type="checkbox" checked={allowDuplicates} onChange={e => setAllowDuplicates(e.target.checked)} className="mt-1" />Tôi vẫn muốn luyện các câu trùng được liệt kê.</label>
            <p className="text-slate-400 text-xs">Bạn cũng có thể tạo prompt mới để yêu cầu AI sinh bộ khác.</p>
          </>}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => startImport(importReview, { excludedItems, allowDuplicates })}
              disabled={importReview.optionalIssues.some(issue => !excludedItems.includes(issue.key)) || (importReview.duplicates.length > 0 && !allowDuplicates)}
              className="px-4 py-2 rounded-xl bg-purple-600 text-white font-semibold disabled:opacity-40">Xác nhận và bắt đầu</button>
            <button onClick={resetImportReview} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300">Quay lại sửa JSON</button>
          </div>
        </div>}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-slate-500 text-xs">
            JSON sẽ được validate tự động trước khi bắt đầu.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => { setJsonInput(''); resetImportReview(); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-all duration-200"
            >
              <RefreshCw size={14} />
              Xoá
            </button>
            <button
              onClick={handleImport}
              disabled={!jsonInput.trim()}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-500/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload size={16} />
              Kiểm tra & bắt đầu
            </button>
          </div>
        </div>
      </div>

      {/* Tips */}
      <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-2xl p-4">
        <h4 className="text-indigo-400 font-semibold text-sm mb-2">💡 Mẹo sử dụng</h4>
        <ul className="space-y-1 text-slate-400 text-sm">
          <li>• Các chủ đề là nhóm tự học, không phải đề cương VSTEP chính thức.</li>
          <li>• Nếu AI không trả về JSON đúng định dạng, thêm: <span className="text-purple-300 font-mono text-xs">"Return ONLY the JSON array, starting with [ and ending with ]"</span></li>
          <li>• Bạn có thể lưu các câu hỏi hay bằng nút bookmark ⭐ trong khi luyện.</li>
          <li>• Câu hỏi đã lưu sẽ xuất hiện trong tab <span className="text-white">Saved Questions</span> và <span className="text-white">Review</span>.</li>
        </ul>
      </div>
    </div>
  );
}
