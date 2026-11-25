import { LayoutDashboard, BookOpen, Brain, Headphones, RefreshCw, Layers, BookOpenCheck, CloudOff, CloudUpload, PenLine } from 'lucide-react';

const tabs = [
  { id: 'dashboard',  label: 'Dashboard', Icon: LayoutDashboard },
  { id: 'vocabulary', label: 'Vocabulary', Icon: BookOpen },
  { id: 'flashcard',  label: 'Flashcard', Icon: Layers },
  { id: 'quiz',       label: 'Smart Quiz', Icon: Brain },
  { id: 'listening',  label: 'Listening',  Icon: Headphones },
  { id: 'grammar',    label: 'Grammar',    Icon: BookOpenCheck },
  { id: 'dictation',  label: 'Dictation',  Icon: PenLine },
];

/** Sync button visual state for the current Vocabulary sync status. */
function useSyncVisual(syncStatus) {
  const MAP = {
    idle:     { label: 'Sync',      cls: 'text-slate-300 hover:text-white hover:bg-slate-800/80 border-slate-400/15 hover:border-slate-400/30',  spin: false, Icon: RefreshCw },
    syncing:  { label: 'Syncing…',  cls: 'text-indigo-300 bg-indigo-500/15 border-indigo-400/30 cursor-wait',         spin: false, Icon: RefreshCw },
    ok:       { label: 'Synced!',   cls: 'text-emerald-300 bg-emerald-500/15 border-emerald-400/30',                   spin: false, Icon: RefreshCw },
    error:    { label: 'Failed',    cls: 'text-rose-300 bg-rose-500/15 border-rose-400/30',                       spin: false, Icon: RefreshCw },
  };

  return MAP[syncStatus] ?? MAP.idle;
}

/**
 * Push indicator — shows the status of the background debounced push to cloud.
 * This is separate from the manual Sync button, which only fetches FROM cloud.
 *
 * pushStatus: 'idle'|'pushing'|'ok'|'error'
 */
function PushIndicator({ pushStatus }) {
  if (pushStatus === 'idle') return null;

  const MAP = {
    pushing:   { label: 'Saving…',   cls: 'text-sky-300     bg-sky-500/15     border-sky-400/30',     Icon: CloudUpload, animate: 'vm-pulse-soft' },
    ok:        { label: 'Saved ✓',   cls: 'text-emerald-300 bg-emerald-500/15 border-emerald-400/30', Icon: CloudUpload, animate: '' },
    error:     { label: 'Save failed!',cls:'text-rose-300   bg-rose-500/15    border-rose-400/30',    Icon: CloudOff,    animate: '' },
  };

  const config = MAP[pushStatus];
  if (!config) return null;

  const { label, cls, Icon, animate } = config;

  return (
    <div
      className={`
        vm-scale-in flex items-center gap-1.5 px-1.5 sm:px-2.5 py-1 rounded-xl text-xs font-semibold
        border transition-colors duration-200 shrink-0
        ${cls}
      `}
      title={
        pushStatus === 'error'
          ? 'Vocabulary chưa lưu/đồng bộ xong. Xem thông báo lỗi cụ thể bên dưới.'
          : pushStatus === 'ok'
          ? 'Your vocabulary was saved to Google Sheets.'
          : 'Saving your vocabulary to Google Sheets…'
      }
    >
      <Icon size={12} className={animate} />
      <span className="hidden sm:inline">{label}</span>
    </div>
  );
}

/* ── Sync status message (same rules and texts as the former floating toast) ── */
const SYNC_MESSAGES = {
  syncing:    { text: '☁️ Fetching fresh data from Google Sheets…', cls: 'text-indigo-200 bg-indigo-500/15 border-indigo-400/35' },
  ok:         { text: '✅ Vocabulary synced successfully!',          cls: 'text-emerald-200 bg-emerald-500/15 border-emerald-400/35' },
  error:      { text: '❌ Vocabulary gặp lỗi — xem chi tiết bên dưới.', cls: 'text-rose-200 bg-rose-500/15 border-rose-400/35' },
  push_error: { text: '⚠️ Vocabulary chưa lưu/đồng bộ xong — xem chi tiết bên dưới.', cls: 'text-rose-200 bg-rose-500/15 border-rose-400/35' },
};

/** Which message to show: push errors take priority over the sync state. */
function syncStatusMessage(syncStatus, pushStatus, show) {
  if (pushStatus === 'error') return { key: 'push_error', ...SYNC_MESSAGES.push_error };
  if (!show) return null;
  const msg = SYNC_MESSAGES[syncStatus];
  return msg ? { key: syncStatus, ...msg } : null;
}

/**
 * Small status chip inside the navbar row, left of the push indicator / Sync button.
 * From md (768 px) it is visible; below md there is no room, so the same element stays
 * screen-reader only (still a polite live region). Never covers the page content.
 */
function SyncStatusChip({ message }) {
  return (
    <div
      id="nav-sync-status"
      role="status"
      aria-live="polite"
      className="sr-only md:not-sr-only md:flex md:min-w-0 md:shrink md:justify-end"
    >
      {message && (
        <span
          key={message.key}
          data-sync-chip={message.key}
          title={message.text}
          className={`vm-scale-in block max-w-full truncate md:mx-1.5 px-2.5 py-1 rounded-xl border text-xs font-semibold leading-4 ${message.cls}`}
        >
          {message.text}
        </span>
      )}
    </div>
  );
}

export default function Navbar({ activeTab, setActiveTab, syncStatus, pushStatus = 'idle', onSync }) {
  const sync = useSyncVisual(syncStatus);
  const SyncIcon = sync.Icon;

  // Show the status message whenever actively syncing, just finished (ok/error), or push failed
  const showToast = syncStatus !== 'idle' || pushStatus === 'error';
  const statusMessage = syncStatusMessage(syncStatus, pushStatus, showToast);
  const syncTitle = 'Đọc Vocabulary mới nhất và thử gửi thay đổi đang chờ; không xóa cache';

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a101f]/85 backdrop-blur-xl border-b border-slate-400/15 shadow-[0_8px_30px_rgba(2,6,23,0.55)]">
        <div className="max-w-7xl mx-auto px-2 sm:px-4">
          <div className="flex items-center h-16">
            {/* Logo */}
            <div className="flex items-center gap-2.5 mr-2 sm:mr-8">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 ring-1 ring-white/15 transition-transform duration-200 hover:scale-105">
                <span className="text-white font-black text-sm">V</span>
              </div>
              <span className="text-white font-bold text-lg tracking-tight hidden xl:block">
                Vocab<span className="text-indigo-400">Master</span>
              </span>
            </div>

            {/* Tabs (labels from xl: with 7 tabs they do not fit beside the sync controls below 1280px) */}
            <div className="flex items-center gap-0.5 sm:gap-1 flex-1">
              {tabs.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  id={`nav-tab-${id}`}
                  aria-label={label}
                  onClick={() => setActiveTab(id)}
                  className={`
                    vm-btn flex items-center gap-2 px-1 min-[360px]:px-1.5 sm:px-3 py-2 rounded-xl text-sm font-medium shrink-0 whitespace-nowrap
                    ${activeTab === id
                      ? 'vm-btn-primary text-white'
                      : 'text-slate-300/85 hover:text-white hover:bg-slate-800/75'}
                  `}
                >
                  <Icon size={16} />
                  <span className="hidden xl:block">{label}</span>
                </button>
              ))}
            </div>

            {/* Sync status chip (md+ visible, screen-reader only on phones) */}
            <SyncStatusChip message={statusMessage} />

            {/* Push indicator (auto-save status) */}
            <PushIndicator pushStatus={pushStatus} />

            {/* Sync button (manual fetch from cloud) */}
            <button
              id="nav-sync-btn"
              onClick={onSync}
              disabled={syncStatus === 'syncing'}
              title={statusMessage ? `${statusMessage.text} — ${syncTitle}` : syncTitle}
              className={`
                vm-btn flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-xl text-xs font-semibold
                border ml-1 sm:ml-2 shrink-0
                disabled:cursor-wait
                ${sync.cls}
              `}
            >
              <SyncIcon
                size={13}
                className={sync.spin ? 'animate-spin' : sync.label === 'Syncing…' ? 'vm-pulse-soft' : ''}
              />
              <span className="hidden sm:inline">{sync.label}</span>
            </button>
          </div>
        </div>
      </nav>
    </>
  );
}
