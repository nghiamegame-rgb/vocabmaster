import { useEffect, useState } from 'react';
import { LayoutDashboard, BookOpen, Brain, Headphones, RefreshCw, Trash2 } from 'lucide-react';

const tabs = [
  { id: 'dashboard',  label: 'Dashboard', Icon: LayoutDashboard },
  { id: 'vocabulary', label: 'Vocabulary', Icon: BookOpen },
  { id: 'quiz',       label: 'Smart Quiz', Icon: Brain },
  { id: 'listening',  label: 'Listening',  Icon: Headphones },
];

/**
 * Sync button visual states.
 * syncMode='hard' + status='syncing' shows a distinct amber "Clearing…" phase
 * before the normal indigo "Syncing…" indicator.
 */
function useSyncVisual(syncStatus, syncMode) {
  // Track an internal phase so we can show "Clearing…" briefly before "Syncing…"
  const [phase, setPhase] = useState('idle');

  useEffect(() => {
    if (syncStatus === 'syncing' && syncMode === 'hard') {
      // First paint: "Clearing" phase
      setPhase('clearing');
      // After the 120ms yield in _doFetch the fetch starts; keep clearing for a
      // little longer so users definitely see it, then switch to "syncing".
      const t = setTimeout(() => setPhase('syncing'), 600);
      return () => clearTimeout(t);
    }
    if (syncStatus === 'syncing' && syncMode === 'soft') {
      setPhase('syncing');
      return;
    }
    setPhase(syncStatus); // 'idle' | 'ok' | 'error'
  }, [syncStatus, syncMode]);

  const MAP = {
    idle:     { label: 'Sync',      cls: 'text-slate-400 hover:text-white hover:bg-slate-800',  spin: false, Icon: RefreshCw },
    clearing: { label: 'Clearing…', cls: 'text-amber-400  bg-amber-500/15  cursor-wait',         spin: true,  Icon: Trash2    },
    syncing:  { label: 'Syncing…',  cls: 'text-indigo-400 bg-indigo-600/15 cursor-wait',         spin: false, Icon: RefreshCw },
    ok:       { label: 'Synced!',   cls: 'text-emerald-400 bg-emerald-500/15',                   spin: false, Icon: RefreshCw },
    error:    { label: 'Failed',    cls: 'text-rose-400   bg-rose-500/15',                       spin: false, Icon: RefreshCw },
  };

  return MAP[phase] ?? MAP.idle;
}

/* ── Toast banner ── */
function SyncToast({ syncStatus, syncMode, show }) {
  if (!show) return null;

  const messages = {
    clearing: { text: '🗑 Clearing local cache…',                   cls: 'bg-amber-500/90  text-white' },
    syncing:  { text: '☁️ Fetching fresh data from Google Sheets…', cls: 'bg-indigo-600/90 text-white' },
    ok:       { text: '✅ Vocabulary synced successfully!',          cls: 'bg-emerald-600/90 text-white' },
    error:    { text: '❌ Sync failed — check your webhook URL.',    cls: 'bg-rose-600/90   text-white' },
  };

  // Derive the display key: during hard syncing show 'clearing' first
  const key =
    syncStatus === 'syncing' && syncMode === 'hard' ? 'clearing' :
    syncStatus === 'syncing'                         ? 'syncing'  :
    syncStatus;

  const msg = messages[key];
  if (!msg) return null;

  return (
    <div
      className={`
        fixed top-[68px] left-1/2 -translate-x-1/2 z-50
        px-5 py-2.5 rounded-xl shadow-2xl text-sm font-semibold
        animate-fade-in whitespace-nowrap
        ${msg.cls}
      `}
      role="status"
      aria-live="polite"
    >
      {msg.text}
    </div>
  );
}

export default function Navbar({ activeTab, setActiveTab, syncStatus, syncMode = 'soft', onSync }) {
  const sync = useSyncVisual(syncStatus, syncMode);
  const SyncIcon = sync.Icon;

  // Show toast whenever actively syncing or just finished (ok/error)
  const showToast = syncStatus !== 'idle';

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center h-16">
            {/* Logo */}
            <div className="flex items-center gap-2 mr-8">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <span className="text-white font-black text-sm">V</span>
              </div>
              <span className="text-white font-bold text-lg hidden sm:block">
                Vocab<span className="text-indigo-400">Master</span>
              </span>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 flex-1">
              {tabs.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  id={`nav-tab-${id}`}
                  onClick={() => setActiveTab(id)}
                  className={`
                    flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200
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

            {/* Sync button */}
            <button
              id="nav-sync-btn"
              onClick={onSync}
              disabled={syncStatus === 'syncing'}
              title="Clear local cache and pull fresh vocabulary from Google Sheets"
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                border border-transparent transition-all duration-200 ml-2 shrink-0
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
      <SyncToast syncStatus={syncStatus} syncMode={syncMode} show={showToast} />
    </>
  );
}
