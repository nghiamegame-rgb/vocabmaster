import {
  BookOpen, CheckCircle, HelpCircle, TrendingUp, Star, Volume2,
  Layers, Brain, Headphones, BookOpenCheck, PenLine, MapPin, ArrowRight,
} from 'lucide-react';
import { CompassBadge, EmptyTrailScene, JourneyMapSvg } from './storybook/StorybookArt';

const LEVEL_META = [
  {
    level: 1,
    label: 'L1 — New',
    stage: 'Trại khởi hành',
    bar: 'bg-[var(--sb-lvl1)]',
    pill: 'bg-[var(--sb-lvl1-soft)] text-[var(--sb-lvl1-text)] border-[var(--sb-lvl1-border)]',
  },
  {
    level: 2,
    label: 'L2 — Familiar',
    stage: 'Đồi làm quen',
    bar: 'bg-[var(--sb-lvl2)]',
    pill: 'bg-[var(--sb-lvl2-soft)] text-[var(--sb-lvl2-text)] border-[var(--sb-lvl2-border)]',
  },
  {
    level: 3,
    label: 'L3 — Learning',
    stage: 'Rừng đang học',
    bar: 'bg-[var(--sb-lvl3)]',
    pill: 'bg-[var(--sb-lvl3-soft)] text-[var(--sb-lvl3-text)] border-[var(--sb-lvl3-border)]',
  },
  {
    level: 4,
    label: 'L4 — Proficient',
    stage: 'Cầu thành thạo',
    bar: 'bg-[var(--sb-lvl4)]',
    pill: 'bg-[var(--sb-lvl4-soft)] text-[var(--sb-lvl4-text)] border-[var(--sb-lvl4-border)]',
  },
  {
    level: 5,
    label: 'L5 — Mastered',
    stage: 'Đỉnh tinh thông',
    bar: 'bg-[var(--sb-lvl5)]',
    pill: 'bg-[var(--sb-lvl5-soft)] text-[var(--sb-lvl5-text)] border-[var(--sb-lvl5-border)]',
  },
];

const REGION_LINKS = [
  { tab: 'vocabulary', region: 'Làng từ vựng',       name: 'Vocabulary', Icon: BookOpen,      badge: 'bg-[var(--sb-warm-soft)] text-[var(--sb-warm-text)]' },
  { tab: 'flashcard',  region: 'Trạm thẻ',           name: 'Flashcard',  Icon: Layers,        badge: 'bg-[var(--sb-amber-soft)] text-[var(--sb-amber-text)]' },
  { tab: 'quiz',       region: 'Thử thách',          name: 'Smart Quiz', Icon: Brain,         badge: 'bg-[var(--sb-primary-soft)] text-[var(--sb-primary-text)]' },
  { tab: 'listening',  region: 'Đài nghe hải đăng',  name: 'Listening',  Icon: Headphones,    badge: 'bg-[var(--sb-starlight-soft)] text-[var(--sb-starlight)]' },
  { tab: 'grammar',    region: 'Tháp cấu trúc',      name: 'Grammar',    Icon: BookOpenCheck, badge: 'bg-[var(--sb-secondary-soft)] text-[var(--sb-secondary-text)]' },
  { tab: 'dictation',  region: 'Xưởng chép chính tả', name: 'Dictation', Icon: PenLine,       badge: 'bg-[var(--sb-success-soft)] text-[var(--sb-success-text)]' },
];

function StatCard({ icon: Icon, label, value, strip, badgeBg, suffix = '' }) {
  return (
    <div className="relative overflow-hidden sb-card sb-card-interactive p-5 sm:p-6">
      <div className={`absolute top-0 left-0 right-0 h-1.5 ${strip}`} aria-hidden="true" />
      <div className="flex items-start justify-between gap-3 pt-1">
        <div>
          <p className="text-[var(--sb-text-muted)] text-xs sm:text-sm font-bold mb-1.5">{label}</p>
          <p className="sb-font-display text-[var(--sb-text)] text-3xl font-extrabold tracking-tight tabular-nums">
            {value}<span className="text-lg font-bold opacity-85">{suffix}</span>
          </p>
        </div>
        <div className={`w-11 h-11 rounded-xl sb-sticker ${badgeBg} flex items-center justify-center shrink-0`}>
          <Icon size={21} aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

function MasteryBar({ level, label, stage, count, total, bar, pill, isFoxHere, onClick }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <button
      id={`mastery-level-${level}`}
      onClick={onClick}
      className="w-full text-left group p-4 sb-card sb-card-interactive"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-lg border text-xs font-extrabold ${pill}`}>
            L{level}
          </span>
          <span className="text-[var(--sb-text)] font-bold text-sm">{label}</span>
          <span className="text-xs font-semibold text-[var(--sb-text-muted)]">· {stage}</span>
          {isFoxHere && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--sb-amber-soft)] text-[var(--sb-amber-text)] border border-[var(--sb-border-amber)] text-[11px] font-bold">
              <MapPin size={11} aria-hidden="true" /> Cáo đang dừng chân
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[var(--sb-text-muted)] font-semibold text-xs">{count} words</span>
          <span className="text-[var(--sb-text)] font-extrabold text-sm tabular-nums">{pct}%</span>
        </div>
      </div>
      <div className="w-full h-3 bg-[var(--sb-surface-deep)] rounded-full overflow-hidden border border-[var(--sb-border)]">
        <div
          className={`h-full rounded-full progress-fill ${bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[var(--sb-text-muted)] text-xs font-semibold mt-2 group-hover:text-[var(--sb-amber-text)] transition-colors">
        Click to filter vocabulary →
      </p>
    </button>
  );
}

export default function Dashboard({ words, hasReadableWords = true, stats, setActiveTab, setVocabFilter }) {
  const totalWords = words.length;
  const accuracy = stats.totalQuestions > 0
    ? Math.round((stats.correctAnswers / stats.totalQuestions) * 100)
    : 0;

  const masteredCount = words.filter(w => w.level === 5).length;
  const level1Count   = words.filter(w => w.level === 1).length;

  const levelCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const w of words) {
    if (levelCounts[w.level] !== undefined) levelCounts[w.level] += 1;
  }

  let foxLevel = 1;
  let maxCount = 0;
  for (const level of [1, 2, 3, 4, 5]) {
    if (levelCounts[level] > 0 && levelCounts[level] >= maxCount) {
      maxCount = levelCounts[level];
      foxLevel = level;
    }
  }
  const activeStageMeta = LEVEL_META.find(m => m.level === foxLevel) || LEVEL_META[0];

  function handleMasteryClick(level) {
    setVocabFilter(level);
    setActiveTab('vocabulary');
  }

  return (
    <div className="vm-page-enter space-y-7">
      {/* Hero Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--sb-surface)] border border-[var(--sb-border-amber)] shadow-[var(--sb-glow-sm)] text-xs font-extrabold text-[var(--sb-amber-text)] mb-3">
          <CompassBadge className="w-5 h-5" />
          <span>Hành trình đến VSTEP · Bản đồ hành trình</span>
        </div>

        <h1 className="sb-font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--sb-text)] mb-1.5">
          Dashboard
        </h1>
        <p className="text-[var(--sb-text-muted)] font-semibold text-sm sm:text-base">
          Track your vocabulary learning progress
        </p>

        <div className="mt-4 sb-paper-note flex items-start gap-2.5 px-4 py-3 text-sm text-[var(--sb-text)] sm:items-center">
          <Volume2 size={17} className="mt-0.5 shrink-0 text-[var(--sb-amber)] sm:mt-0" aria-hidden="true" />
          <p className="font-medium leading-relaxed">
            🔊 Mẹo học tập: Hãy đọc thành tiếng mỗi từ vựng, sau đó nghe phát âm chuẩn để ghi nhớ tốt hơn và cải thiện kỹ năng Nghe VSTEP!
          </p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={BookOpen}
          label="Total Words"
          value={hasReadableWords ? totalWords : '—'}
          strip="bg-[var(--sb-primary)]"
          badgeBg="bg-[var(--sb-primary-soft)] text-[var(--sb-primary-text)]"
        />
        <StatCard
          icon={Star}
          label="Mastered (L5)"
          value={hasReadableWords ? masteredCount : '—'}
          strip="bg-[var(--sb-success)]"
          badgeBg="bg-[var(--sb-success-soft)] text-[var(--sb-success-text)]"
        />
        <StatCard
          icon={CheckCircle}
          label="Quiz Accuracy"
          value={accuracy}
          suffix="%"
          strip="bg-[var(--sb-starlight)]"
          badgeBg="bg-[var(--sb-starlight-soft)] text-[var(--sb-starlight)]"
        />
        <StatCard
          icon={HelpCircle}
          label="Questions Answered"
          value={stats.totalQuestions}
          strip="bg-[var(--sb-amber)]"
          badgeBg="bg-[var(--sb-amber-soft)] text-[var(--sb-amber-text)]"
        />
      </div>

      {/* Mastery Levels — Journey Map */}
      <div className="sb-panel p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl sb-sticker bg-[var(--sb-warm-soft)] text-[var(--sb-warm-text)] flex items-center justify-center shrink-0">
              <TrendingUp size={19} aria-hidden="true" />
            </div>
            <div>
              <h2 className="sb-font-display text-[var(--sb-text)] font-extrabold tracking-tight text-xl leading-tight">
                Mastery Levels
              </h2>
              <p className="text-xs font-semibold text-[var(--sb-text-muted)]">
                5 chặng trên con đường chinh phục VSTEP
              </p>
            </div>
          </div>

          {totalWords > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--sb-amber-soft)] border border-[var(--sb-border-amber)] text-xs font-bold text-[var(--sb-amber-text)] shadow-[var(--sb-glow-sm)]">
              <MapPin size={13} className="text-[var(--sb-amber)]" aria-hidden="true" />
              Cáo nhỏ đang ở: {activeStageMeta.stage} (L{foxLevel})
            </span>
          )}
        </div>

        {totalWords === 0 ? (
          <div className="sb-card p-6 sm:p-8 text-center space-y-3">
            <EmptyTrailScene />
            <p className="sb-font-display text-lg font-extrabold text-[var(--sb-text)]">
              Cáo nhỏ đã gói ghém hành trang, sẵn sàng cùng bạn mở chặng đầu tiên!
            </p>
            <div>
              <p className="text-[var(--sb-text)] font-bold">No words yet</p>
              <p className="text-[var(--sb-text-muted)] text-sm mt-1">
                Add words in the Vocabulary tab to get started
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setActiveTab('vocabulary')}
                className="sb-btn-ink inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--sb-primary-btn)] hover:bg-[var(--sb-primary)] text-white text-sm font-bold"
              >
                Đến Làng từ vựng
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Illustrated Trail Map */}
            <div className="rounded-2xl border border-[var(--sb-border)] bg-[var(--sb-surface-deep)] p-2 sm:p-3 shadow-[var(--sb-glow-sm)] overflow-hidden">
              <JourneyMapSvg levelCounts={levelCounts} foxLevel={foxLevel} />
            </div>

            {/* 5 Interactive Stage Cards */}
            <div className="space-y-3">
              {LEVEL_META.map(({ level, label, stage, bar, pill }) => (
                <MasteryBar
                  key={level}
                  level={level}
                  label={label}
                  stage={stage}
                  count={levelCounts[level]}
                  total={totalWords}
                  bar={bar}
                  pill={pill}
                  isFoxHere={foxLevel === level}
                  onClick={() => handleMasteryClick(level)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Map Regions (Quick Signposts) */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="sb-font-display text-lg font-extrabold text-[var(--sb-text)]">
            Các vùng đất trên bản đồ
          </h2>
          <span className="text-xs font-semibold text-[var(--sb-text-muted)]">Chọn điểm đến để luyện tập</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {REGION_LINKS.map(({ tab, region, name, Icon, badge }) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className="sb-card sb-card-interactive p-3.5 text-left flex flex-col justify-between gap-2.5"
            >
              <div className={`w-9 h-9 rounded-xl sb-sticker ${badge} flex items-center justify-center`}>
                <Icon size={17} aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-extrabold text-[var(--sb-text)] leading-snug">{region}</p>
                <p className="text-xs font-semibold text-[var(--sb-text-muted)]">{name}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Quick Tips */}
      {totalWords > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sb-card p-4 sm:p-5">
            <p className="text-[var(--sb-amber-text)] text-sm font-extrabold">💡 Spaced Repetition</p>
            <p className="text-[var(--sb-text-muted)] text-xs sm:text-sm font-medium mt-1.5 leading-relaxed">
              Answer correctly 2×, 4×, 8×, 15× in a row to advance through L1→L2→L3→L4→L5.
            </p>
          </div>
          <div className="sb-card p-4 sm:p-5">
            <p className="text-[var(--sb-success-text)] text-sm font-extrabold">🎯 Current focus</p>
            <p className="text-[var(--sb-text-muted)] text-xs sm:text-sm font-medium mt-1.5 leading-relaxed">
              You have <strong className="text-[var(--sb-text)] font-extrabold">{level1Count}</strong> new / struggling words to review.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
