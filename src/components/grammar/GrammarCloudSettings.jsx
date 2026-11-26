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
        <h3 className="text-[var(--sb-ink)] font-bold flex items-center gap-2">
          <Cloud size={18} className="text-[var(--sb-terracotta-strong)]" />
          Cài đặt Grammar Cloud Sync (Bảo mật & CAS)
        </h3>
        {onClose && (
          <button onClick={onClose} className="text-[var(--sb-ink-soft)] hover:text-[var(--sb-ink)] transition-colors text-sm p-1 rounded-lg">✕</button>
        )}
      </div>

      {/* Status badge */}
      <div className={`flex flex-col gap-1 px-3.5 py-2.5 rounded-xl border-2 text-sm ${
        configured
          ? (syncStatus === 'error' || hasPending
              ? 'bg-[var(--sb-ochre-soft)] border-[var(--sb-ochre)] text-[var(--sb-ochre-text)]'
              : 'bg-[var(--sb-forest-soft)] border-[var(--sb-forest)] text-[var(--sb-forest-text)]')
          : 'bg-[var(--sb-paper-deep)] border-[var(--sb-ink-border)] text-[var(--sb-ink)]'
      }`}>
        <div className="flex items-center gap-2 font-semibold">
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
          <p className="text-xs text-[var(--sb-ink-soft)] pl-6">
            Bảo vệ bằng Compare-and-Swap (CAS) & LockService: Chống ghi đè khi nhiều thiết bị cùng dùng.
          </p>
        )}
      </div>

      {/* URL input */}
      <div>
        <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
          <label className="text-[var(--sb-ink-soft)] text-xs font-semibold">
            Grammar Sync Endpoint URL
          </label>
          <button
            type="button"
            onClick={handleUseProxy}
            className="text-xs text-[var(--sb-terracotta-text)] hover:text-[var(--sb-terracotta-hover)] transition-colors flex items-center gap-1 font-semibold"
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
          <p className="text-[var(--sb-berry-text)] font-semibold text-xs mt-1.5 flex items-center gap-1">
            <AlertCircle size={12} /> {error}
          </p>
        )}
        <p className="text-[var(--sb-ink-soft)] text-xs mt-1.5">
          Khuyên dùng <code className="text-[var(--sb-terracotta-text)] font-semibold font-mono">/api/grammar-sync</code> khi deploy trên Vercel để bảo mật token bí mật hoàn toàn trên server.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => handleSave()}
          className={`vm-btn flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold ${
            saved
              ? 'bg-[var(--sb-forest-btn)] text-white border-2 border-[var(--sb-ink)] shadow-[var(--sb-shadow-sm)]'
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
            className={`vm-btn flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border-2 ${
              syncStatus === 'syncing'
                ? 'bg-[var(--sb-terracotta-soft)] border-[var(--sb-ink)] text-[var(--sb-terracotta-text)] cursor-wait'
                : syncStatus === 'ok'
                ? 'bg-[var(--sb-forest-soft)] border-[var(--sb-forest)] text-[var(--sb-forest-text)]'
                : syncStatus === 'conflict'
                ? 'bg-[var(--sb-ochre-soft)] border-[var(--sb-ochre)] text-[var(--sb-ochre-text)]'
                : syncStatus === 'error'
                ? 'bg-[var(--sb-berry-soft)] border-[var(--sb-berry)] text-[var(--sb-berry-text)]'
                : 'bg-[var(--sb-paper-card)] border-[var(--sb-ink-border)] text-[var(--sb-ink)] hover:bg-[var(--sb-paper-deep)]'
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
          className="vm-btn flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-[var(--sb-paper-card)] border-2 border-[var(--sb-ink-border)] text-[var(--sb-ink)] hover:text-[var(--sb-berry-text)] hover:bg-[var(--sb-berry-soft)]"
        >
          Dùng mặc định
        </button>
      </div>

      {/* Security notice */}
      <div className="border-t border-[var(--sb-ink-border)] pt-3 text-[var(--sb-ink-soft)] text-xs space-y-1">
        <p className="text-[var(--sb-ink)] font-semibold flex items-center gap-1.5">
          <ShieldCheck size={14} className="text-[var(--sb-forest-text)]" /> Cơ chế bảo mật & toàn vẹn dữ liệu:
        </p>
        <p>• <strong>Strict CAS</strong>: Máy chủ chỉ chấp nhận ghi khi revision khớp chính xác.</p>
        <p>• <strong>Smart Merge</strong>: Không bao giờ xóa đè mất câu hỏi khi có xung đột thiết bị.</p>
        <p>• <strong>Auto Backup</strong>: Google Sheets tự động sao lưu sheet Backup trước mỗi lần ghi.</p>
      </div>
    </div>
  );
}
