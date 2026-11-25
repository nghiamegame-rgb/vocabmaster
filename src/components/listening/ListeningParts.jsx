// Visual pieces shared by Listening Review and Dictation → "Từ đã lưu".
import {
  Volume2, ChevronRight, RotateCcw, Trophy, CheckCircle2, XCircle, Keyboard,
} from 'lucide-react';

/** Session stats: correct · percentage · played. */
export function StatsBar({ score, total }) {
  const pct = total === 0 ? 0 : Math.round((score / total) * 100);
  return (
    <div className="vm-panel inline-flex items-center gap-4 text-sm flex-wrap px-4 py-2.5 rounded-2xl">
      <div className="flex items-center gap-1.5">
        <CheckCircle2 size={14} className="text-emerald-400" />
        <span className="text-white font-semibold tabular-nums">{score}</span>
        <span className="text-slate-300">correct</span>
      </div>
      <div className="h-4 w-px bg-slate-400/20" />
      <div className="flex items-center gap-1.5">
        <Trophy size={14} className="text-indigo-400" />
        <span className="text-indigo-300 font-semibold tabular-nums">{pct}%</span>
      </div>
      <div className="h-4 w-px bg-slate-400/20" />
      <span className="text-slate-300">{total} played</span>
    </div>
  );
}

export function AutoFocusToggle({ id, enabled, onToggle }) {
  return (
    <button
      id={id}
      type="button"
      onClick={onToggle}
      aria-pressed={enabled}
      title={enabled
        ? 'Đang bật: mỗi từ mới con trỏ tự vào ô gõ (điện thoại sẽ tự bật bàn phím). Bấm để tắt.'
        : 'Đang tắt: sang từ mới bàn phím không tự bật; chạm vào ô gõ nếu muốn gõ. Bấm để bật.'}
      className={`
        vm-btn flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border max-w-full
        ${enabled
          ? 'bg-indigo-500/20 border-indigo-400/50 text-indigo-200 hover:bg-indigo-500/30'
          : 'bg-slate-900/75 border-slate-400/20 text-slate-300 hover:text-white hover:border-slate-400/35'}
      `}
    >
      <Keyboard size={14} className="shrink-0" />
      <span>Tự mở bàn phím: {enabled ? 'Bật' : 'Tắt'}</span>
    </button>
  );
}

/**
 * Audio card: speaker, prompt (or the hint after 4 replays), Replay button and the
 * typing input (hidden once answered).
 */
export function PromptCard({
  label, hint, isPlaying, listenCount, answered, replayId, onReplay, inputId, inputRef, value, onChange,
}) {
  return (
    <div className="vm-card rounded-2xl p-5 mb-5 flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row items-center gap-4">

        {/* Animated speaker */}
        <div className={`
          relative w-16 h-16 rounded-2xl flex items-center justify-center shrink-0
          bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-700 shadow-lg shadow-indigo-500/30 ring-1 ring-white/15
          transition-transform duration-200
          ${isPlaying ? 'scale-105 shadow-indigo-500/55' : ''}
        `}>
          <Volume2
            size={28}
            className={`text-white transition-opacity duration-200 ${isPlaying ? 'opacity-100' : 'opacity-80'}`}
          />
          {isPlaying && (
            <span className="absolute w-16 h-16 rounded-2xl border-2 border-indigo-300/45 animate-ping" />
          )}
        </div>

        <div className="flex-1 text-center sm:text-left">
          <p className="text-slate-300 text-xs uppercase tracking-wider font-semibold mb-1">
            {label}
          </p>
          {/* Show the word as a hint after 4 listens */}
          {listenCount > 4 && !answered ? (
            <p className="text-amber-300 font-bold text-lg animate-fade-in">
              💡 Hint: <span className="underline underline-offset-4">
                {hint}
              </span>
            </p>
          ) : (
            <p className="text-white text-lg font-bold">
              {isPlaying
                ? <span className="text-indigo-300 vm-pulse-soft">♫ Playing audio…</span>
                : <span className="text-slate-300 italic text-base">Tap Replay to hear again{listenCount > 0 ? ` (×${listenCount})` : ''}</span>
              }
            </p>
          )}
        </div>

        {/* Replay button */}
        <button
          id={replayId}
          onClick={onReplay}
          disabled={answered}
          className="
            vm-btn vm-btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm
            disabled:opacity-50 shrink-0
          "
        >
          <Volume2 size={16} />
          Replay
        </button>
      </div>

      {/* ── Typing input ── */}
      {!answered && (
        <div className="flex items-center gap-2 min-w-0">
          <input
            id={inputId}
            ref={inputRef}
            type="text"
            value={value}
            onChange={onChange}
            placeholder="Or type the word here…"
            autoComplete="off"
            spellCheck={false}
            className="flex-1 min-w-0 vm-input rounded-xl px-4 py-2.5 text-sm"
          />
          <span className="text-slate-400 text-xs whitespace-nowrap shrink-0">auto-submits</span>
        </div>
      )}
    </div>
  );
}

/** Right / wrong banner; `children` is the text. */
export function AnswerFeedback({ isCorrect, children }) {
  return (
    <div className={`
      animate-fade-in mb-5 flex items-center gap-3 px-5 py-3.5 rounded-2xl
      font-semibold text-sm
      ${isCorrect
        ? 'bg-emerald-500/15 border border-emerald-400/40 text-emerald-200'
        : 'bg-rose-500/15    border border-rose-400/40    text-rose-200'
      }
    `}>
      {isCorrect
        ? <><CheckCircle2 size={18} className="shrink-0" /> {children}</>
        : <><XCircle size={18} className="shrink-0" /> {children}</>
      }
    </div>
  );
}

/** The 2-column answer grid. */
export function AnswerGrid({ children }) {
  return <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6">{children}</div>;
}

export function SkipButton({ id, answered, onClick }) {
  return (
    <button
      id={id}
      onClick={onClick}
      className="
        vm-btn flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold
        bg-slate-800 hover:bg-slate-700 border border-slate-400/20
        text-white
      "
    >
      {answered
        ? <><ChevronRight size={16} /> Next Word</>
        : <><RotateCcw   size={16} /> Skip</>
      }
    </button>
  );
}
