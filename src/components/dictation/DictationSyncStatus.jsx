import { Cloud, CloudOff, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';

const LOOK = {
  idle:         { Icon: Cloud,         cls: 'text-slate-300',   text: 'Chưa đồng bộ trong lần mở này.' },
  syncing:      { Icon: RefreshCw,     cls: 'text-indigo-200',  text: 'Đang đồng bộ với Google Sheet…' },
  pending:      { Icon: Cloud,         cls: 'text-sky-200',     text: 'Có thay đổi đang chờ gửi lên Google Sheet…' },
  ok:           { Icon: CheckCircle2,  cls: 'text-emerald-200', text: 'Đã đồng bộ với Google Sheet.' },
  unconfigured: { Icon: CloudOff,      cls: 'text-amber-200',   text: '' },
  error:        { Icon: AlertTriangle, cls: 'text-rose-200',    text: '' },
  locked:       { Icon: AlertTriangle, cls: 'text-rose-200',    text: 'Đồng bộ đang khoá vì dữ liệu trên thiết bị bị hỏng.' },
};

/** Dictation sync status — shown only inside the Dictation tab (not in the navbar). */
export default function DictationSyncStatus({ store }) {
  const look = LOOK[store.syncStatus] || LOOK.idle;
  const { Icon } = look;
  const time = store.lastSyncedAt ? new Date(store.lastSyncedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '';
  return (
    <div id="dictation-sync-status" data-status={store.syncStatus} role="status" aria-live="polite"
      className="vm-panel rounded-2xl px-4 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs sm:text-sm">
      <span className={`flex items-center gap-2 min-w-0 ${look.cls}`}>
        <Icon size={15} className={`shrink-0 ${store.syncStatus === 'syncing' ? 'vm-pulse-soft' : ''}`} />
        <span className="break-words">{store.syncMessage || look.text}{store.syncStatus === 'ok' && time ? ` (lúc ${time})` : ''}</span>
      </span>
      {store.syncStatus !== 'locked' && (
        <button id="dictation-sync-now" type="button" onClick={store.syncNow} disabled={store.syncStatus === 'syncing'}
          className="vm-btn ml-auto flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-900/75 border border-slate-400/20 text-slate-200 hover:text-white disabled:opacity-50">
          <RefreshCw size={13} /> Đồng bộ ngay
        </button>
      )}
    </div>
  );
}
