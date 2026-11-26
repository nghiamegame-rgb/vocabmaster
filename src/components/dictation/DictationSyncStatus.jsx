import { Cloud, CloudOff, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';

const LOOK = {
  idle:         { Icon: Cloud,         cls: 'text-[var(--sb-ink-soft)]',            text: 'Chưa đồng bộ trong lần mở này.' },
  syncing:      { Icon: RefreshCw,     cls: 'text-[var(--sb-terracotta-text)] font-medium', text: 'Đang đồng bộ với Google Sheet…' },
  pending:      { Icon: Cloud,         cls: 'text-[var(--sb-sky-text)] font-medium',  text: 'Có thay đổi đang chờ gửi lên Google Sheet…' },
  ok:           { Icon: CheckCircle2,  cls: 'text-[var(--sb-forest-text)] font-semibold', text: 'Đã đồng bộ với Google Sheet.' },
  unconfigured: { Icon: CloudOff,      cls: 'text-[var(--sb-ochre-text)] font-medium', text: '' },
  error:        { Icon: AlertTriangle, cls: 'text-[var(--sb-berry-text)] font-semibold', text: '' },
  locked:       { Icon: AlertTriangle, cls: 'text-[var(--sb-berry-text)] font-semibold', text: 'Đồng bộ đang khoá vì dữ liệu trên thiết bị bị hỏng.' },
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
          className="vm-btn ml-auto flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[var(--sb-paper-card)] border border-[var(--sb-ink-border)] text-[var(--sb-ink)] hover:bg-[var(--sb-paper-deep)] disabled:opacity-50">
          <RefreshCw size={13} /> Đồng bộ ngay
        </button>
      )}
    </div>
  );
}
