import { LayoutDashboard, BookOpen, Brain, Headphones, RefreshCw, Layers, BookOpenCheck, CloudOff, CloudUpload, PenLine } from 'lucide-react';

const tabs = [
  { id: 'dashboard',  label: 'Dashboard',  Icon: LayoutDashboard },
  { id: 'vocabulary', label: 'Vocabulary', Icon: BookOpen },
  { id: 'flashcard',  label: 'Flashcard',  Icon: Layers },
  { id: 'quiz',       label: 'Smart Quiz', Icon: Brain },
  { id: 'listening',  label: 'Listening',  Icon: Headphones },
  { id: 'grammar',    label: 'Grammar',    Icon: BookOpenCheck },
  { id: 'dictation',  label: 'Dictation',  Icon: PenLine },
];

/** Sync button visual state for the current Vocabulary sync status. */
function useSyncVisual(syncStatus) {
  const MAP = {
    idle:     { label: 'Sync',     cls: 'bg-[#fbf7ee] text-[var(--sb-ink)] hover:bg-[#ece1cc] border-[#2b2a33] shadow-[2px_2px_0_#2b2a33]', spin: false, Icon: RefreshCw },
    syncing:  { label: 'Syncing…', cls: 'text-indigo-900 bg-indigo-100 border-indigo-700 shadow-[2px_2px_0_#2b2a33] cursor-wait',     spin: false, Icon: RefreshCw },
    ok:       { label: 'Synced!',  cls: 'text-emerald-900 bg-emerald-100 border-emerald-700 shadow-[2px_2px_0_#2b2a33]',              spin: false, Icon: RefreshCw },
    error:    { label: 'Failed',   cls: 'text-rose-900 bg-rose-100 border-rose-700 shadow-[2px_2px_0_#2b2a33]',                       spin: false, Icon: RefreshCw },
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
    pushing:   { label: 'Saving…',     cls: 'text-sky-900     bg-sky-100     border-sky-700',     Icon: CloudUpload, animate: 'vm-pulse-soft' },
    ok:        { label: 'Saved ✓',     cls: 'text-emerald-900 bg-emerald-100 border-emerald-700', Icon: CloudUpload, animate: '' },
    error:     { label: 'Save failed!',cls: 'text-rose-900    bg-rose-100    border-rose-700',    Icon: CloudOff,    animate: '' },
  };

  const config = MAP[pushStatus];
  if (!config) return null;

  const { label, cls, Icon, animate } = config;

  return (
      <div
        className={`
          vm-scale-in flex items-center gap-1.5 px-1 min-[360px]:px-1.5 sm:px-2.5 py-0.5 rounded-xl text-xs font-bold
          border-2 transition-colors duration-200 shrink-0
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
  syncing:    { text: '☁️ Fetching fresh data from Google Sheets…', cls: 'text-indigo-900 bg-indigo-100 border-indigo-700' },
  ok:         { text: '✅ Vocabulary synced successfully!',          cls: 'text-emerald-900 bg-emerald-100 border-emerald-700' },
  error:      { text: '❌ Vocabulary gặp lỗi — xem chi tiết bên dưới.', cls: 'text-rose-900 bg-rose-100 border-rose-700' },
  push_error: { text: '⚠️ Vocabulary chưa lưu/đồng bộ xong — xem chi tiết bên dưới.', cls: 'text-rose-900 bg-rose-100 border-rose-700' },
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
          className={`vm-scale-in block max-w-full truncate md:mx-1.5 px-2.5 py-0.5 rounded-xl border-2 text-xs font-bold leading-4 ${message.cls}`}
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
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#fbf7ee]/95 backdrop-blur-sm border-b-2 border-[#2b2a33] shadow-[0_3px_0_rgba(43,42,51,0.12)]">
        <div className="max-w-7xl mx-auto px-1.5 min-[360px]:px-2 sm:px-4">
          <div className="flex items-center h-16">
            {/* Logo */}
            <div className="flex items-center gap-2.5 mr-1.5 min-[360px]:mr-2 sm:mr-5 xl:mr-6 shrink-0">
              <div className="w-8 h-8 rounded-xl bg-[#d9603b] border-2 border-[#2b2a33] shadow-[2px_2px_0_#2b2a33] flex items-center justify-center transition-transform duration-200 hover:scale-105">
                <span className="sb-font-display text-white font-black text-sm">V</span>
              </div>
              <span className="sb-font-display text-[var(--sb-ink)] font-extrabold text-lg tracking-tight hidden xl:block">
                Vocab<span className="text-[#a83b1c]">Master</span>
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
                    vm-btn flex items-center gap-1.5 px-0.5 min-[360px]:px-1.5 sm:px-2.5 xl:px-2.5 py-1.5 rounded-xl text-sm font-bold border-2 shrink-0 whitespace-nowrap
                    ${activeTab === id
                      ? 'bg-[#c44d2a] text-white border-[#2b2a33] shadow-[2px_2px_0_#2b2a33]'
                      : 'border-transparent text-[var(--sb-ink)] hover:bg-[#ece1cc] hover:border-[#2b2a33]/35'}
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
                vm-btn flex items-center gap-1.5 px-1.5 min-[360px]:px-2 sm:px-3 py-1.5 rounded-xl text-xs font-bold
                border-2 ml-1 sm:ml-2 shrink-0
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
