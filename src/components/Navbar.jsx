import { LayoutDashboard, BookOpen, Brain, Headphones, RefreshCw } from 'lucide-react';

const tabs = [
  { id: 'dashboard',  label: 'Dashboard', Icon: LayoutDashboard },
  { id: 'vocabulary', label: 'Vocabulary', Icon: BookOpen },
  { id: 'quiz',       label: 'Smart Quiz', Icon: Brain },
  { id: 'listening',  label: 'Listening',  Icon: Headphones },
];

/** Map syncStatus → button visual state */
const SYNC_STATES = {
  idle:    { label: 'Sync',    cls: 'text-slate-400 hover:text-white hover:bg-slate-800', spin: false },
  syncing: { label: 'Syncing', cls: 'text-indigo-400 bg-indigo-600/15 cursor-wait',       spin: true  },
  ok:      { label: 'Synced!', cls: 'text-emerald-400 bg-emerald-500/15',                 spin: false },
  error:   { label: 'Failed',  cls: 'text-rose-400 bg-rose-500/15',                       spin: false },
};

export default function Navbar({ activeTab, setActiveTab, syncStatus, onSync }) {
  const sync = SYNC_STATES[syncStatus] ?? SYNC_STATES.idle;

  return (
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
            title="Pull latest vocabulary from the cloud"
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
              border border-transparent transition-all duration-200 ml-2 shrink-0
              disabled:cursor-wait
              ${sync.cls}
            `}
          >
            <RefreshCw
              size={13}
              className={sync.spin ? 'animate-spin' : ''}
            />
            <span className="hidden sm:inline">{sync.label}</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
