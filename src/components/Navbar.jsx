import { LayoutDashboard, BookOpen, Brain, Headphones, RefreshCw, Layers, BookOpenCheck, CloudOff, CloudUpload } from 'lucide-react';

const tabs = [
  { id: 'dashboard',  label: 'Dashboard', Icon: LayoutDashboard },
  { id: 'vocabulary', label: 'Vocabulary', Icon: BookOpen },
  { id: 'flashcard',  label: 'Flashcard', Icon: Layers },
  { id: 'quiz',       label: 'Smart Quiz', Icon: Brain },
  { id: 'listening',  label: 'Listening',  Icon: Headphones },
  { id: 'grammar',    label: 'Grammar',    Icon: BookOpenCheck },
];

/** Sync button visual state for the current Vocabulary sync status. */
function useSyncVisual(syncStatus) {
  const MAP = {
    idle:     { label: 'Sync',      cls: 'text-slate-400 hover:text-white hover:bg-slate-800',  spin: false, Icon: RefreshCw },
    syncing:  { label: 'Syncing…',  cls: 'text-indigo-400 bg-indigo-600/15 cursor-wait',         spin: false, Icon: RefreshCw },
    ok:       { label: 'Synced!',   cls: 'text-emerald-400 bg-emerald-500/15',                   spin: false, Icon: RefreshCw },
    error:    { label: 'Failed',    cls: 'text-rose-400   bg-rose-500/15',                       spin: false, Icon: RefreshCw },
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
    pushing:   { label: 'Saving…',   cls: 'text-sky-400    bg-sky-500/10    border-sky-500/20',     Icon: CloudUpload, animate: 'animate-pulse' },
    ok:        { label: 'Saved ✓',   cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',Icon: CloudUpload, animate: '' },
    error:     { label: 'Save failed!',cls:'text-rose-400  bg-rose-500/10   border-rose-500/20',    Icon: CloudOff,    animate: '' },
  };

  const config = MAP[pushStatus];
  if (!config) return null;

  const { label, cls, Icon, animate } = config;

  return (
    <div
      className={`
        flex items-center gap-1.5 px-1.5 sm:px-2.5 py-1 rounded-lg text-xs font-semibold
        border transition-all duration-300 shrink-0
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

/* ── Toast banner ── */
function SyncToast({ syncStatus, pushStatus, show }) {
  // Compute which message to show
  // Push errors take priority over sync state for the toast
  const pushErrorActive = pushStatus === 'error';

  const messages = {
    syncing:    { text: '☁️ Fetching fresh data from Google Sheets…', cls: 'bg-indigo-600/90 text-white' },
    ok:         { text: '✅ Vocabulary synced successfully!',          cls: 'bg-emerald-600/90 text-white' },
    error:      { text: '❌ Vocabulary gặp lỗi — xem chi tiết bên dưới.', cls: 'bg-rose-600/90 text-white' },
    push_error: { text: '⚠️ Vocabulary chưa lưu/đồng bộ xong — xem chi tiết bên dưới.', cls: 'bg-rose-600/90 text-white' },
  };

  // Derive the display key
  let key;
  if (pushErrorActive) {
    key = 'push_error';
  } else if (!show) {
    return null;
  } else {
    key = syncStatus;
  }

  const msg = messages[key];
  if (!msg) return null;

  return (
    <div
      className={`
        fixed top-[68px] left-1/2 -translate-x-1/2 z-50
        px-5 py-2.5 rounded-xl shadow-2xl text-sm font-semibold
        animate-fade-in max-w-[calc(100vw-2rem)] whitespace-normal sm:whitespace-nowrap
        ${msg.cls}
      `}
      role="status"
      aria-live="polite"
    >
      {msg.text}
    </div>
  );
}

export default function Navbar({ activeTab, setActiveTab, syncStatus, pushStatus = 'idle', onSync }) {
  const sync = useSyncVisual(syncStatus);
  const SyncIcon = sync.Icon;

  // Show toast whenever actively syncing, just finished (ok/error), or push failed
  const showToast = syncStatus !== 'idle' || pushStatus === 'error';

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-2 sm:px-4">
          <div className="flex items-center h-16">
            {/* Logo */}
            <div className="flex items-center gap-2 mr-2 sm:mr-8">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <span className="text-white font-black text-sm">V</span>
              </div>
              <span className="text-white font-bold text-lg hidden sm:block">
                Vocab<span className="text-indigo-400">Master</span>
              </span>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-0 sm:gap-1 flex-1">
              {tabs.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  id={`nav-tab-${id}`}
                  aria-label={label}
                  onClick={() => setActiveTab(id)}
                  className={`
                    flex items-center gap-2 px-1.5 sm:px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200
                    ${activeTab === id
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'}
                  `}
                >
                  <Icon size={16} />
                  <span className="hidden sm:block">{label}</span>
                </button>
              ))}
            </div>

            {/* Push indicator (auto-save status) */}
            <PushIndicator pushStatus={pushStatus} />

            {/* Sync button (manual fetch from cloud) */}
            <button
              id="nav-sync-btn"
              onClick={onSync}
              disabled={syncStatus === 'syncing'}
              title="Đọc Vocabulary mới nhất và thử gửi thay đổi đang chờ; không xóa cache"
              className={`
                flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-semibold
                border border-transparent transition-all duration-200 ml-1 sm:ml-2 shrink-0
                disabled:cursor-wait
                ${sync.cls}
              `}
            >
              <SyncIcon
                size={13}
                className={sync.spin ? 'animate-spin' : sync.label === 'Syncing…' ? 'animate-pulse' : ''}
              />
              <span className="hidden sm:inline">{sync.label}</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Toast notification — rendered outside the nav so it sits below it */}
      <SyncToast syncStatus={syncStatus} pushStatus={pushStatus} show={showToast} />
    </>
  );
}
