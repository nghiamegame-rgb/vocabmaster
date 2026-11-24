import { useState } from 'react';
import { Cloud, Save, RefreshCw, HardDrive, Check, AlertCircle, ShieldCheck } from 'lucide-react';
import { getGrammarCloudUrl, saveGrammarCloudUrl } from '../../utils/grammarStorage';
import { isGrammarCloudConfigured } from '../../utils/grammarCloud';

/**
 * GrammarCloudSettings — Embedded panel for configuring Grammar cloud sync.
 * Supports Vercel Serverless Function Proxy (/api/grammar-sync) or direct Google Apps Script.
 */
export default function GrammarCloudSettings({ onClose, onConfigChanged, syncStatus, hasPending, onSync }) {
  const [url,     setUrl]     = useState(() => getGrammarCloudUrl());
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState('');

  const configured = isGrammarCloudConfigured();

  function handleSave(targetUrl) {
    setError('');
    const trimmed = (targetUrl !== undefined ? targetUrl : url).trim();
    if (trimmed &&
        !trimmed.startsWith('/api/') &&
        !trimmed.startsWith('https://script.google.com/macros/s/') &&
        !trimmed.startsWith('http://') &&
        !trimmed.startsWith('https://')) {
      setError('URL phải là Vercel Proxy (/api/grammar-sync) hoặc Google Apps Script URL (https://script.google.com/macros/s/...)');
      return;
    }
    saveGrammarCloudUrl(trimmed);
    setUrl(getGrammarCloudUrl());
    onConfigChanged();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function handleUseProxy() {
    handleSave('/api/grammar-sync');
  }

  return (
    <div className="vm-panel rounded-2xl p-5 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <Cloud size={18} className="text-indigo-400" />
          Cài đặt Grammar Cloud Sync (Bảo mật & CAS)
        </h3>
        {onClose && (
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors text-sm p-1 rounded-lg">✕</button>
        )}
      </div>

      {/* Status badge */}
      <div className={`flex flex-col gap-1 px-3.5 py-2.5 rounded-xl border text-sm ${
        configured
          ? (syncStatus === 'error' || hasPending
              ? 'bg-amber-500/12 border-amber-400/30 text-amber-200'
              : 'bg-emerald-500/12 border-emerald-400/30 text-emerald-200')
          : 'bg-slate-900/60 border-slate-400/20 text-slate-300'
      }`}>
        <div className="flex items-center gap-2 font-medium">
          {configured ? <Cloud size={15} /> : <HardDrive size={15} />}
          {configured
            ? (syncStatus === 'error'
                ? '⚠️ Đồng bộ thất bại — giữ dữ liệu trên máy. Bấm Thử lại.'
                : syncStatus === 'syncing' || syncStatus === 'conflict'
                ? 'Đang đồng bộ với Cloud…'
                : hasPending
                ? '⚠️ Có thay đổi cục bộ chưa lưu lên Cloud'
                : syncStatus === 'ok'
                ? '✅ Đã đồng bộ Cloud'
                : 'Sẵn sàng kết nối Cloud')
            : '⚠️ Chưa kết nối — Dữ liệu chỉ lưu cục bộ trên trình duyệt (Local Only)'}
        </div>
        {configured && (
          <p className="text-xs text-slate-300 pl-6">
            Bảo vệ bằng Compare-and-Swap (CAS) & LockService: Chống ghi đè khi nhiều thiết bị cùng dùng.
          </p>
        )}
      </div>

      {/* URL input */}
      <div>
        <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
          <label className="text-slate-300 text-xs font-medium">
            Grammar Sync Endpoint URL
          </label>
          <button
            type="button"
            onClick={handleUseProxy}
            className="text-xs text-indigo-300 hover:text-indigo-200 transition-colors flex items-center gap-1 font-medium"
          >
            <ShieldCheck size={13} /> Dùng Vercel Proxy (/api/grammar-sync)
          </button>
        </div>
        <input
          type="text"
          value={url}
          onChange={e => { setUrl(e.target.value); setError(''); }}
          placeholder="/api/grammar-sync hoặc https://script.google.com/macros/s/.../exec"
          className="w-full vm-input rounded-xl px-4 py-2.5 text-sm font-mono"
        />
        {error && (
          <p className="text-rose-300 text-xs mt-1.5 flex items-center gap-1">
            <AlertCircle size={12} /> {error}
          </p>
        )}
        <p className="text-slate-400 text-xs mt-1.5">
          Khuyên dùng <code className="text-indigo-300 font-mono">/api/grammar-sync</code> khi deploy trên Vercel để bảo mật token bí mật hoàn toàn trên server.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => handleSave()}
          className={`vm-btn flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold ${
            saved
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/25'
              : 'vm-btn-violet'
          }`}
        >
          {saved ? <Check size={14} /> : <Save size={14} />}
          {saved ? 'Đã lưu!' : 'Lưu Endpoint'}
        </button>

        {configured && (
          <button
            onClick={onSync}
            disabled={syncStatus === 'syncing'}
            className={`vm-btn flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border ${
              syncStatus === 'syncing'
                ? 'bg-indigo-600/40 border-indigo-400/30 text-indigo-200 cursor-wait'
                : syncStatus === 'ok'
                ? 'bg-emerald-500/18 border-emerald-400/30 text-emerald-300'
                : syncStatus === 'conflict'
                ? 'bg-amber-500/18 border-amber-400/30 text-amber-300'
                : syncStatus === 'error'
                ? 'bg-rose-500/18 border-rose-400/30 text-rose-300'
                : 'bg-slate-800/85 border-slate-400/20 text-slate-200 hover:text-white hover:bg-slate-700'
            }`}
          >
            <RefreshCw size={14} className={syncStatus === 'syncing' ? 'animate-spin' : ''} />
            {syncStatus === 'syncing' ? 'Đang sync…'
              : syncStatus === 'ok' ? 'Đã đồng bộ!'
              : syncStatus === 'conflict' ? 'Đang giải quyết xung đột…'
              : syncStatus === 'error' ? 'Thử lại'
              : 'Sync ngay'}
          </button>
        )}

        <button
          onClick={() => handleSave('')}
          className="vm-btn flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-slate-800/85 border border-slate-400/20 text-slate-300 hover:text-rose-300 hover:bg-rose-500/15"
        >
          Dùng mặc định
        </button>
      </div>

      {/* Security notice */}
      <div className="border-t border-slate-400/15 pt-3 text-slate-300 text-xs space-y-1">
        <p className="text-slate-200 font-medium flex items-center gap-1.5">
          <ShieldCheck size={14} className="text-emerald-400" /> Cơ chế bảo mật & toàn vẹn dữ liệu:
        </p>
        <p>• <strong>Strict CAS</strong>: Máy chủ chỉ chấp nhận ghi khi revision khớp chính xác.</p>
        <p>• <strong>Smart Merge</strong>: Không bao giờ xóa đè mất câu hỏi khi có xung đột thiết bị.</p>
        <p>• <strong>Auto Backup</strong>: Google Sheets tự động sao lưu sheet Backup trước mỗi lần ghi.</p>
      </div>
    </div>
  );
}
