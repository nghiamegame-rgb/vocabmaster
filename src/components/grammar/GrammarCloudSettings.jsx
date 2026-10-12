import { useState } from 'react';
import { Cloud, Save, RefreshCw, HardDrive, ExternalLink, Check, AlertCircle } from 'lucide-react';
import { getGrammarCloudUrl, saveGrammarCloudUrl } from '../../utils/grammarStorage';
import { isGrammarCloudConfigured } from '../../utils/grammarCloud';

/**
 * GrammarCloudSettings — Embedded panel for configuring Grammar cloud sync.
 * Shows inside the Grammar tab (not in main settings).
 */
export default function GrammarCloudSettings({ onClose, onConfigChanged, syncStatus, onSync }) {
  const [url,     setUrl]     = useState(() => getGrammarCloudUrl());
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState('');

  const configured = isGrammarCloudConfigured();

  function handleSave() {
    setError('');
    const trimmed = url.trim();
    if (trimmed && !trimmed.startsWith('https://script.google.com/macros/s/')) {
      setError('URL phải bắt đầu bằng https://script.google.com/macros/s/');
      return;
    }
    saveGrammarCloudUrl(trimmed);
    onConfigChanged(trimmed.length > 0);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="bg-slate-900/90 border border-slate-700/50 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <Cloud size={18} className="text-indigo-400" />
          Cài đặt Grammar Cloud Sync
        </h3>
        {onClose && (
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors text-sm">✕</button>
        )}
      </div>

      {/* Status badge */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm ${
        configured
          ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
          : 'bg-slate-800/50 border-slate-700 text-slate-400'
      }`}>
        {configured ? <Cloud size={14} /> : <HardDrive size={14} />}
        {configured
          ? '✅ Grammar đang được sync với Google Sheets'
          : '⚠️ Chưa kết nối — dữ liệu chỉ lưu cục bộ (local-only)'}
      </div>

      {/* URL input */}
      <div>
        <label className="block text-slate-400 text-xs font-medium mb-1.5">
          Grammar Apps Script Webhook URL
        </label>
        <input
          type="url"
          value={url}
          onChange={e => { setUrl(e.target.value); setError(''); }}
          placeholder="https://script.google.com/macros/s/...../exec"
          className="w-full bg-slate-800 border border-slate-600 text-white rounded-xl px-4 py-2.5 text-sm placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors font-mono"
        />
        {error && (
          <p className="text-rose-400 text-xs mt-1.5 flex items-center gap-1">
            <AlertCircle size={12} /> {error}
          </p>
        )}
        <p className="text-slate-500 text-xs mt-1.5">
          Đây là URL riêng cho Grammar Backend — KHÔNG phải URL Vocabulary đang dùng.
        </p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
            saved
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
              : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-500/20'
          }`}
        >
          {saved ? <Check size={14} /> : <Save size={14} />}
          {saved ? 'Đã lưu!' : 'Lưu URL'}
        </button>

        {configured && (
          <button
            onClick={onSync}
            disabled={syncStatus === 'syncing'}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
              syncStatus === 'syncing'
                ? 'bg-indigo-600/50 text-indigo-300 cursor-wait'
                : syncStatus === 'ok'
                ? 'bg-emerald-600/20 text-emerald-400'
                : syncStatus === 'error'
                ? 'bg-rose-600/20 text-rose-400'
                : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
            }`}
          >
            <RefreshCw size={14} className={syncStatus === 'syncing' ? 'animate-spin' : ''} />
            {syncStatus === 'syncing' ? 'Đang sync…' : syncStatus === 'ok' ? 'Synced!' : syncStatus === 'error' ? 'Thất bại' : 'Sync ngay'}
          </button>
        )}

        <button
          onClick={() => { setUrl(''); saveGrammarCloudUrl(''); onConfigChanged(false); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-slate-800 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all duration-200"
        >
          Xoá URL
        </button>
      </div>

      {/* Instructions link */}
      <div className="border-t border-slate-700/40 pt-3">
        <p className="text-slate-500 text-xs">
          Chưa có Apps Script URL? Xem hướng dẫn deploy trong file{' '}
          <span className="text-purple-400 font-mono">grammar-apps-script.js</span>{' '}
          tại thư mục gốc của project.
        </p>
      </div>
    </div>
  );
}
