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
        <CheckCircle2 size={14} className="text-[var(--sb-forest-text)]" />
        <span className="text-[var(--sb-ink)] font-bold tabular-nums">{score}</span>
        <span className="text-[var(--sb-ink-soft)]">correct</span>
      </div>
      <div className="h-4 w-px bg-[var(--sb-ink-border)]" />
      <div className="flex items-center gap-1.5">
        <Trophy size={14} className="text-[var(--sb-terracotta-text)]" />
        <span className="text-[var(--sb-terracotta-text)] font-bold tabular-nums">{pct}%</span>
      </div>
      <div className="h-4 w-px bg-[var(--sb-ink-border)]" />
      <span className="text-[var(--sb-ink-soft)]">{total} played</span>
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
          ? 'bg-[var(--sb-terracotta-soft)] border-[var(--sb-ink)] text-[var(--sb-terracotta-text)] hover:bg-[var(--sb-ochre-soft)]'
          : 'bg-[var(--sb-paper-card)] border-[var(--sb-ink-border)] text-[var(--sb-ink)] hover:bg-[var(--sb-paper-deep)]'}
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
          bg-gradient-to-br from-[var(--sb-terracotta-strong)] via-[var(--sb-terracotta)] to-[var(--sb-ochre)] border-2 border-[var(--sb-ink)] shadow-[var(--sb-shadow-sm)]
          transition-transform duration-200
          ${isPlaying ? 'scale-105' : ''}
        `}>
          <Volume2
            size={28}
            className={`text-white transition-opacity duration-200 ${isPlaying ? 'opacity-100' : 'opacity-90'}`}
          />
          {isPlaying && (
            <span className="absolute w-16 h-16 rounded-2xl border-2 border-[var(--sb-terracotta-strong)]/60 animate-ping" />
          )}
        </div>

        <div className="flex-1 text-center sm:text-left">
          <p className="text-[var(--sb-ink-soft)] text-xs uppercase tracking-wider font-semibold mb-1">
            {label}
          </p>
          {/* Show the word as a hint after 4 listens */}
          {listenCount > 4 && !answered ? (
            <p className="text-[var(--sb-ochre-text)] font-bold text-lg animate-fade-in">
              💡 Hint: <span className="underline underline-offset-4">
                {hint}
              </span>
            </p>
          ) : (
            <p className="text-[var(--sb-ink)] text-lg font-bold">
              {isPlaying
                ? <span className="text-[var(--sb-terracotta-text)] vm-pulse-soft">♫ Playing audio…</span>
                : <span className="text-[var(--sb-ink-soft)] italic text-base">Tap Replay to hear again{listenCount > 0 ? ` (×${listenCount})` : ''}</span>
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
          <span className="text-[var(--sb-ink-soft)] text-xs whitespace-nowrap shrink-0">auto-submits</span>
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
        ? 'bg-[var(--sb-forest-soft)] border-2 border-[var(--sb-forest)] text-[var(--sb-forest-text)]'
        : 'bg-[var(--sb-berry-soft)] border-2 border-[var(--sb-berry)] text-[var(--sb-berry-text)]'
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
        bg-[var(--sb-paper-card)] hover:bg-[var(--sb-paper-deep)] border-2 border-[var(--sb-ink)]
        text-[var(--sb-ink)] shadow-[var(--sb-shadow-sm)]
      "
    >
      {answered
        ? <><ChevronRight size={16} /> Next Word</>
        : <><RotateCcw   size={16} /> Skip</>
      }
    </button>
  );
}
