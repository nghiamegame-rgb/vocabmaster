import { useState } from 'react';
import { Download, Copy, RefreshCw } from 'lucide-react';
import { prepareGrammarExport, createGrammarWorkbook, downloadGrammarWorkbook } from '../../utils/grammarExport';

export default function GrammarExportPanel({ source, prepared, onPrepared, syncStatuses = [], loadError = '' }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copyMessage, setCopyMessage] = useState('');
  const [localAccepted, setLocalAccepted] = useState(false);
  const loading = syncStatuses.some(status => ['syncing', 'conflict'].includes(status));
  // Vocabulary returns to idle after a GET failure or a short success badge.
  // Idle cannot be interpreted as either loading or a confirmed empty cloud.
  const cloudUnavailable = syncStatuses.some(status => ['error', 'idle'].includes(status));
  const blocked = Boolean(loadError || source.error || loading || (cloudUnavailable && !localAccepted));
  const stale = prepared && prepared.key !== source.key;

  async function prepare() {
    setError(''); setCopyMessage(''); setBusy(true);
    try {
      const next = prepareGrammarExport(source);
      const blob = await createGrammarWorkbook(next);
      onPrepared({ ...next, blob });
      downloadGrammarWorkbook(blob, next.workbookName);
    } catch (failure) {
      setError(`Không tạo/tải được Excel: ${failure.message}. Bạn có thể thử lại; dữ liệu học được giữ nguyên.`);
    } finally { setBusy(false); }
  }

  async function copy() {
    setCopyMessage('');
    try {
      await navigator.clipboard.writeText(prepared.prompt);
      setCopyMessage('Đã copy prompt của gói Excel này.');
    } catch {
      setCopyMessage('Không thể copy tự động. Chọn toàn bộ nội dung trong ô Prompt Excel bên dưới và sao chép thủ công. Bạn vẫn có thể tải Excel.');
    }
  }

  return <div className="bg-slate-900/80 border border-emerald-700/50 rounded-2xl p-5 space-y-3 min-w-0" data-testid="grammar-export">
    <h3 className="text-white font-semibold">Excel + Prompt cá nhân hóa</h3>
    <p className="text-slate-300 text-sm">Đính kèm workbook đã tải vào cuộc trò chuyện AI, rồi dán prompt đi kèm. AI trả JSON để dán vào bước 3.</p>
    <p className="text-slate-400 text-xs">Một file .xlsx, đúng hai sheet Vocabulary (English) và Grammar (Sentence). Chỉ lấy toàn bộ từ/cụm từ và câu đã lưu trên thiết bị; không lấy câu luyện chưa lưu, ghi chú, bản dịch hay tiến độ. Đây là dữ liệu học cho AI, không phải bản sao lưu.</p>
    {loading && <p className="text-amber-300 text-sm" role="status">Đang tải/đồng bộ hai kho. Chờ hoàn tất trước khi chuẩn bị Excel để tránh xuất thiếu dữ liệu.</p>}
    {cloudUnavailable && <div className="text-amber-200 text-sm space-y-2">
      <p>Không xác minh được toàn bộ cloud. Bạn có thể xuất toàn bộ dữ liệu hiện có trên thiết bị; gói này có thể thiếu dữ liệu chỉ có trên cloud. Không thực hiện đồng bộ mới khi xuất.</p>
      <label className="flex items-start gap-2"><input type="checkbox" checked={localAccepted} onChange={e => setLocalAccepted(e.target.checked)} className="mt-1 shrink-0" />Dùng dữ liệu hiện có trên thiết bị</label>
    </div>}
    {(loadError || source.error) && <p className="text-rose-300 text-sm" role="alert">{loadError || source.error} Chưa thể xuất; hãy kiểm tra nguồn rồi tải lại ứng dụng.</p>}
    {source.snapshot && !loadError && !loading && <div className="text-slate-400 text-xs space-y-1">
      <p>{source.snapshot.data.vocab.length} mục Vocabulary · {source.snapshot.data.grammar.length} câu Grammar đã lưu riêng biệt.</p>
      {!source.snapshot.data.vocab.length && <p>Không có mục tiếng Anh Vocabulary hợp lệ trong dữ liệu thiết bị. Sheet Vocabulary chỉ có tiêu đề; AI sẽ tạo câu theo chủ đề.</p>}
      {!source.snapshot.data.grammar.length && <p>Chưa có câu Grammar đã lưu. Sheet Grammar chỉ có tiêu đề; mọi số đếm bằng 0.</p>}
    </div>}
    {stale && <p className="text-amber-300 text-sm" role="status">Gói Excel + Prompt đã lỗi thời vì dữ liệu hoặc cấu hình thay đổi. Tạo lại gói rồi đính kèm file mới cùng prompt mới.</p>}
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={prepare} disabled={blocked || busy} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-700 hover:bg-emerald-600 text-white disabled:opacity-40 disabled:cursor-not-allowed">
        {prepared ? <RefreshCw size={16} /> : <Download size={16} />}{busy ? 'Đang tạo Excel…' : prepared ? 'Tạo lại Excel + Prompt' : 'Xuất Excel + Prompt'}
      </button>
      {prepared && <>
        <button type="button" disabled={blocked || busy || stale} onClick={() => { try { downloadGrammarWorkbook(prepared.blob, prepared.workbookName); } catch (failure) { setError(`Không tải được Excel: ${failure.message}`); } }} className="px-4 py-2.5 rounded-xl text-sm bg-slate-800 text-slate-200 disabled:opacity-40">Tải lại Excel</button>
        <button type="button" disabled={blocked || busy || stale} onClick={copy} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm bg-slate-800 text-slate-200 disabled:opacity-40"><Copy size={16} />Copy Prompt Excel</button>
      </>}
    </div>
    {error && <p className="text-rose-300 text-sm" role="alert">{error}</p>}
    {prepared && <div className="space-y-2 min-w-0">
      <p className="text-slate-400 text-xs break-all">File đi kèm: {prepared.workbookName} · {prepared.prompt.length.toLocaleString('vi-VN')} ký tự prompt, không cắt danh sách. Chỉ dùng prompt này với đúng file trên.</p>
      <label className="block text-slate-300 text-sm" htmlFor="grammar-excel-prompt">Prompt Excel · xem và sao chép thủ công</label>
      <textarea id="grammar-excel-prompt" readOnly value={prepared.prompt} rows={9} onFocus={e => e.target.select()} className="w-full min-w-0 rounded-xl border border-slate-600 bg-slate-950 p-3 text-slate-300 text-xs font-mono resize-y" />
      {copyMessage && <p className="text-amber-200 text-sm" role="status">{copyMessage}</p>}
    </div>}
  </div>;
}
