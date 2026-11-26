import { useState } from 'react';
import { Copy, Check, Zap, ChevronDown, ChevronUp, AlertCircle, Upload, RefreshCw } from 'lucide-react';
import {
  GRAMMAR_TOPICS,
  GRAMMAR_COUNTS,
  getTopicLabel,
  buildGrammarPrompt,
} from '../../utils/grammarPrompt';
import { prepareGrammarImport, completeGrammarImport, formatGrammarIssue } from '../../utils/grammarImport';
import GrammarExportPanel from './GrammarExportPanel';

/**
 * GrammarPractice — Step 1: Configure → Copy prompt → Paste JSON → Start quiz.
 */
export default function GrammarPractice({ onStartSession, batch, onNewBatch, settings = { count: 10, topic: 'Mixed' }, onSettingsChange, corpus = { data: { vocab: [], grammar: [] }, unresolved: 0, invalidWords: 0 }, stale = false, syncStatuses = [], exportSource, exportPackage, onExportPrepared, exportLoadError }) {
  const { count, topic } = settings;
  const [copiedPrompt, setCopied] = useState('');
  const [promptOpen, setPromptOpen] = useState(false);
  const [jsonInput,  setJsonInput]  = useState('');
  const [error,      setError]      = useState(null);
  const [importReview, setImportReview] = useState(null);
  const [excludedItems, setExcludedItems] = useState([]);
  const [allowDuplicates, setAllowDuplicates] = useState(false);

  const prompt = buildGrammarPrompt({ count, topic, batchId: batch?.id, data: batch?.data });
  const copied = copiedPrompt === prompt && !stale;
  const incomplete = corpus.unresolved > 0 || corpus.invalidWords > 0;
  const [copyError, setCopyError] = useState('');

  function resetImportReview() {
    setError(null); setImportReview(null); setExcludedItems([]); setAllowDuplicates(false);
  }

  async function handleCopy() {
    setCopyError('');
    setCopied('');
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(prompt);
      setTimeout(() => setCopied(''), 2500);
    } catch {
      setCopyError('Không thể copy toàn bộ prompt vào clipboard. Hãy mở Xem prompt và sao chép thủ công; dữ liệu không bị cắt.');
    }
  }

  function handleImport() {
    resetImportReview();
    const result = prepareGrammarImport(jsonInput, { count, topic, recentSentences: corpus.data.grammar });
    if (result.errors.length) { setError(result.errors.map(formatGrammarIssue)); return; }
    if (result.optionalIssues.length || result.duplicates.length) { setImportReview(result); return; }
    startImport(result);
  }

  function startImport(result, choices = {}) {
    // Revalidate against the current corpus even after the confirmation panel was opened.
    const latest = prepareGrammarImport(jsonInput, { count, topic, recentSentences: corpus.data.grammar });
    if (latest.errors.length) { setError(latest.errors.map(formatGrammarIssue)); return; }
    if (JSON.stringify(latest.duplicates) !== JSON.stringify(result.duplicates)) {
      setImportReview(latest); setAllowDuplicates(false);
      setError(['Kho Grammar vừa thay đổi. Hãy kiểm tra lại danh sách câu trùng trước khi xác nhận.']);
      return;
    }
    const check = completeGrammarImport(latest, choices);
    if (!check.valid) { setError(check.errors); return; }
    onStartSession({ questions: check.questions, config: { count, topic } });
  }

  return (
    <div className="space-y-6 vm-page-enter">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--sb-plum)] to-[var(--sb-terracotta-strong)] border-2 border-[var(--sb-ink)] shadow-[var(--sb-shadow-sm)] flex items-center justify-center">
          <Zap size={20} className="text-white" />
        </div>
        <div>
          <h2 className="sb-heading text-xl font-bold tracking-tight text-[var(--sb-ink)]">Grammar Practice</h2>
          <p className="text-[var(--sb-ink-soft)] text-sm">VSTEP B1 · Nhận diện ngữ pháp và phân tích câu</p>
        </div>
      </div>

      {/* Step 1: Configure */}
      <div className="vm-panel rounded-2xl p-5 space-y-5">
        <div className="flex items-center gap-2.5 mb-1">
          <span className="w-6 h-6 rounded-full bg-[var(--sb-plum-soft)] border border-[var(--sb-plum)]/40 text-[var(--sb-plum-text)] text-xs font-bold flex items-center justify-center">1</span>
          <h3 className="text-[var(--sb-ink)] font-bold">Cấu hình bài luyện</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Count */}
          <div>
            <label className="block text-[var(--sb-ink-soft)] text-xs font-semibold mb-2">Số câu</label>
            <div className="flex gap-2 flex-wrap">
              {GRAMMAR_COUNTS.map(n => (
                <button
                  key={n}
                  onClick={() => { onSettingsChange?.({ count: n, topic }); resetImportReview(); }}
                  className={`vm-btn px-4 py-2 rounded-xl text-sm font-semibold border ${
                    count === n
                      ? 'vm-btn-violet border-[var(--sb-ink)]'
                      : 'bg-[var(--sb-paper-card)] text-[var(--sb-ink)] hover:bg-[var(--sb-paper-deep)] border-[var(--sb-ink-border)]'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Topic */}
          <div>
            <label className="block text-[var(--sb-ink-soft)] text-xs font-semibold mb-2">Chủ đề ngữ pháp</label>
            <select
              value={topic}
              onChange={e => { onSettingsChange?.({ count, topic: e.target.value }); resetImportReview(); }}
              className="w-full vm-input rounded-xl px-3 py-2 text-sm"
            >
              {GRAMMAR_TOPICS.map(t => (
                <option key={t} value={t}>{getTopicLabel(t)}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Step 2: Copy prompt */}
      <div className="vm-panel rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2.5">
          <span className="w-6 h-6 rounded-full bg-[var(--sb-plum-soft)] border border-[var(--sb-plum)]/40 text-[var(--sb-plum-text)] text-xs font-bold flex items-center justify-center">2</span>
          <h3 className="text-[var(--sb-ink)] font-bold">Copy prompt → Dán vào AI bạn dùng</h3>
        </div>

        <p className="text-[var(--sb-ink)] text-sm">
          Dán prompt vào ChatGPT, Gemini, Claude hoặc AI khác, sau đó copy toàn bộ JSON kết quả trả về.
        </p>
        <p className="text-[var(--sb-ink-soft)] text-xs break-all">Bộ prompt: {batch?.id || 'preview'} · Dữ liệu giữ nguyên đến khi tạo prompt mới; số câu/chủ đề theo lựa chọn hiện tại.</p>

        <div className="text-xs text-[var(--sb-ink)] space-y-1.5" role="status">
          <p>{batch?.data.vocab.length || 0} mục Vocabulary · {batch?.data.grammar.length || 0} câu Grammar riêng biệt · {prompt.length.toLocaleString('vi-VN')} ký tự. Gửi đầy đủ, không cắt danh sách.</p>
          <p className="text-[var(--sb-ink-soft)]">Đếm khớp từ/cụm từ; không tự gộp purchase/purchased, go/went hoặc từ cùng họ. Không gửi nghĩa, ghi chú hay tiến độ học.</p>
          <p className="text-[var(--sb-ink-soft)]">Câu chưa lưu được đối chiếu trong lần mở Grammar này. Lưu câu để dùng tiếp sau khi rời module/tải lại.</p>
          {!batch?.data.vocab.length && <p>Kho Vocabulary trống: tạo câu theo chủ đề, không có danh sách từ mục tiêu.</p>}
          {!batch?.data.grammar.length && <p>Chưa có câu Grammar hoàn chỉnh để đối chiếu.</p>}
          {syncStatuses.some(status => status === 'syncing' || status === 'conflict') && <p className="text-[var(--sb-ochre-text)] font-medium">Đang đồng bộ: snapshot chỉ gồm dữ liệu đã tải trên thiết bị. Tạo prompt mới sau khi đồng bộ để cập nhật.</p>}
          {syncStatuses.some(status => status === 'error' || status === 'idle') && <p className="text-[var(--sb-ochre-text)] font-medium">Đồng bộ chưa được xác nhận: đang dùng dữ liệu trên thiết bị, chưa xác minh toàn bộ cloud.</p>}
          {stale && <p className="text-[var(--sb-ochre-text)] font-semibold">Dữ liệu đã thay đổi. Bấm Tạo prompt mới để cập nhật số đếm và danh sách câu trước khi copy.</p>}
          {incomplete && <p className="text-[var(--sb-berry-text)] font-semibold">Chưa thể tạo/copy prompt đầy đủ: {corpus.unresolved} bản ghi Grammar thiếu câu hoàn chỉnh/đáp án khôi phục, {corpus.invalidWords} mục Vocabulary thiếu tiếng Anh. Hãy kiểm tra dữ liệu nguồn; ứng dụng không đoán hoặc âm thầm bỏ mục.</p>}
          {copyError && <p className="text-[var(--sb-berry-text)] font-semibold" role="alert">{copyError}</p>}
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            onClick={handleCopy}
            disabled={incomplete || stale}
            className={`vm-btn flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed ${
              copied
                ? 'bg-[var(--sb-forest-btn)] text-white border-2 border-[var(--sb-ink)] shadow-[var(--sb-shadow-sm)]'
                : 'vm-btn-violet'
            }`}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? 'Đã copy!' : 'Copy Prompt'}
          </button>
          <button disabled={incomplete} onClick={() => { onNewBatch?.(); setCopied(''); setCopyError(''); resetImportReview(); }}
            className="vm-btn flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[var(--sb-paper-card)] border-2 border-[var(--sb-ink-border)] text-[var(--sb-ink)] hover:bg-[var(--sb-paper-deep)] disabled:opacity-40">
            <RefreshCw size={16} /> Tạo prompt mới
          </button>
          <button
            onClick={() => setPromptOpen(v => !v)}
            className="vm-btn flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[var(--sb-paper-card)] border-2 border-[var(--sb-ink-border)] text-[var(--sb-ink)] hover:bg-[var(--sb-paper-deep)]"
          >
            {promptOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            {promptOpen ? 'Ẩn prompt' : 'Xem prompt'}
          </button>
        </div>

        {promptOpen && (
          <div className="bg-[var(--sb-paper-warm)] border-2 border-[var(--sb-ink-border)] rounded-xl p-4 max-h-64 overflow-y-auto animate-fade-in">
            <pre className="text-[var(--sb-ink)] text-xs whitespace-pre-wrap font-mono leading-relaxed">{prompt}</pre>
          </div>
        )}
      </div>

      {/* Step 3: Paste JSON */}
      {exportSource && <GrammarExportPanel source={exportSource} prepared={exportPackage} onPrepared={onExportPrepared} syncStatuses={syncStatuses} loadError={exportLoadError} />}

      <div className="vm-panel rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2.5">
          <span className="w-6 h-6 rounded-full bg-[var(--sb-plum-soft)] border border-[var(--sb-plum)]/40 text-[var(--sb-plum-text)] text-xs font-bold flex items-center justify-center">3</span>
          <h3 className="text-[var(--sb-ink)] font-bold">Dán JSON từ AI vào đây</h3>
        </div>

        <textarea
          value={jsonInput}
          onChange={e => { setJsonInput(e.target.value); resetImportReview(); }}
          placeholder="Dán JSON từ AI vào đây. Có thể dán cả khối code JSON; ứng dụng sẽ kiểm tra trước khi bắt đầu."
          rows={10}
          className="w-full vm-input rounded-xl px-4 py-3 text-sm font-mono resize-y"
        />

        {error && (
          <div className="bg-[var(--sb-berry-soft)] border-2 border-[var(--sb-berry)] rounded-xl p-4 animate-fade-in">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle size={16} className="text-[var(--sb-berry-text)]" />
              <span className="text-[var(--sb-berry-text)] text-sm font-bold">Cần sửa nội dung sau</span>
            </div>
            <ul className="space-y-1">
              {error.map((e, i) => (
                <li key={i} className="text-[var(--sb-berry-text)] text-sm">• {e}</li>
              ))}
            </ul>
          </div>
        )}

        {importReview && <div className="bg-[var(--sb-ochre-soft)] border-2 border-[var(--sb-ochre)] rounded-xl p-4 space-y-3 text-sm animate-fade-in">
          <p className="text-[var(--sb-ochre-text)] font-bold">Kiểm tra trước khi bắt đầu</p>
          {importReview.normalizations.length > 0 && <p className="text-[var(--sb-ink)]">Đã tự khớp {importReview.normalizations.length} trích dẫn về đúng chữ trong câu; câu tiếng Anh và lời giải được giữ nguyên.</p>}
          {importReview.optionalIssues.length > 0 && <>
            <p className="text-[var(--sb-ink)]">Các mục đọc hiểu dưới đây chưa hợp lệ. Bạn có thể sửa JSON, hoặc đánh dấu từng mục để chỉ loại mục đó khỏi bộ câu sắp luyện.</p>
            {importReview.optionalIssues.map(issue => <label key={issue.key} className="flex items-start gap-2 text-[var(--sb-ink)] break-words">
              <input type="checkbox" checked={excludedItems.includes(issue.key)} onChange={e => setExcludedItems(prev => e.target.checked ? [...prev, issue.key] : prev.filter(key => key !== issue.key))} className="mt-1 shrink-0 accent-[var(--sb-plum)]" />
              <span>Bỏ mục này — {formatGrammarIssue(issue)}</span>
            </label>)}
          </>}
          {importReview.duplicates.length > 0 && <>
            <p className="text-[var(--sb-ink)] font-semibold">Câu trùng với kho Grammar hiện tại:</p>
            <ul className="list-disc pl-5 text-[var(--sb-ink)]">{importReview.duplicates.map(item => <li key={item.sentence}>Câu {item.sentence}: {item.text}</li>)}</ul>
            <label className="flex items-start gap-2 text-[var(--sb-ink)]"><input type="checkbox" checked={allowDuplicates} onChange={e => setAllowDuplicates(e.target.checked)} className="mt-1 accent-[var(--sb-plum)]" />Tôi vẫn muốn luyện các câu trùng được liệt kê.</label>
            <p className="text-[var(--sb-ink-soft)] text-xs">Bạn cũng có thể tạo prompt mới để yêu cầu AI sinh bộ khác.</p>
          </>}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => startImport(importReview, { excludedItems, allowDuplicates })}
              disabled={importReview.optionalIssues.some(issue => !excludedItems.includes(issue.key)) || (importReview.duplicates.length > 0 && !allowDuplicates)}
              className="vm-btn vm-btn-violet px-4 py-2 rounded-xl font-semibold disabled:opacity-40">Xác nhận và bắt đầu</button>
            <button onClick={resetImportReview} className="vm-btn px-4 py-2 rounded-xl bg-[var(--sb-paper-card)] border-2 border-[var(--sb-ink-border)] text-[var(--sb-ink)] hover:bg-[var(--sb-paper-deep)]">Quay lại sửa JSON</button>
          </div>
        </div>}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[var(--sb-ink-soft)] text-xs">
            JSON sẽ được validate tự động trước khi bắt đầu.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => { setJsonInput(''); resetImportReview(); }}
              className="vm-btn flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-[var(--sb-paper-card)] border-2 border-[var(--sb-ink-border)] text-[var(--sb-ink)] hover:bg-[var(--sb-paper-deep)]"
            >
              <RefreshCw size={14} />
              Xoá
            </button>
            <button
              onClick={handleImport}
              disabled={!jsonInput.trim()}
              className="vm-btn vm-btn-violet flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload size={16} />
              Kiểm tra & bắt đầu
            </button>
          </div>
        </div>
      </div>

      {/* Tips */}
      <div className="vm-panel border-[var(--sb-terracotta)]/40 rounded-2xl p-4 sm:p-5">
        <h4 className="text-[var(--sb-terracotta-text)] font-bold text-sm mb-2">💡 Mẹo sử dụng</h4>
        <ul className="space-y-1.5 text-[var(--sb-ink)] text-sm">
          <li>• Các chủ đề là nhóm tự học, không phải đề cương VSTEP chính thức.</li>
          <li>• Nếu AI không trả về JSON đúng định dạng, thêm: <span className="text-[var(--sb-plum-text)] font-semibold font-mono text-xs">"Return ONLY the JSON array, starting with [ and ending with ]"</span></li>
          <li>• Bạn có thể lưu các câu hỏi hay bằng nút bookmark ⭐ trong khi luyện.</li>
          <li>• Câu hỏi đã lưu sẽ xuất hiện trong tab <span className="text-[var(--sb-ink)] font-semibold">Saved Questions</span> và <span className="text-[var(--sb-ink)] font-semibold">Review</span>.</li>
        </ul>
      </div>
    </div>
  );
}
