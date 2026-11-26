import { BarChart2, Target, TrendingUp, Bookmark, XCircle, Clock, CheckCircle2 } from 'lucide-react';
import { getTopicLabel } from '../../utils/grammarPrompt';

/**
 * GrammarStats — Grammar performance statistics dashboard.
 */
function LegacyGrammarStats({
  grammarStats,
  savedQuestions,
  dueForReview,
  wrongQuestions,
}) {
  const { totalAnswered, correctAnswers, byTopic, byDifficulty, sessions = [] } = grammarStats;

  const accuracy = totalAnswered > 0
    ? Math.round((correctAnswers / totalAnswered) * 100)
    : 0;

  // Top topics (by total answered)
  const topicEntries = Object.entries(byTopic || {})
    .map(([topic, s]) => ({
      topic,
      answered: s.answered,
      correct:  s.correct,
      pct:      s.answered > 0 ? Math.round((s.correct / s.answered) * 100) : 0,
    }))
    .sort((a, b) => b.answered - a.answered);

  const difficultyEntries = Object.entries(byDifficulty || {})
    .map(([d, s]) => ({
      diff: d,
      answered: s.answered,
      correct:  s.correct,
      pct:      s.answered > 0 ? Math.round((s.correct / s.answered) * 100) : 0,
    }));

  const recentSessions = sessions.slice(0, 10);

  function diffColor(pct) {
    if (pct >= 80) return 'from-[var(--sb-forest)] to-[var(--sb-forest-btn)]';
    if (pct >= 60) return 'from-[var(--sb-ochre)] to-[var(--sb-clay)]';
    return 'from-[var(--sb-berry)] to-[var(--sb-berry-btn)]';
  }

  function diffTextColor(pct) {
    if (pct >= 80) return 'text-[var(--sb-forest-text)]';
    if (pct >= 60) return 'text-[var(--sb-ochre-text)]';
    return 'text-[var(--sb-berry-text)]';
  }

  function diffBadgeColor(pct) {
    if (pct >= 80) return 'bg-[var(--sb-forest-btn)] text-white';
    if (pct >= 60) return 'bg-[var(--sb-ochre-text)] text-white';
    return 'bg-[var(--sb-berry-btn)] text-white';
  }

  function diffLabel(d) {
    return d === 'Easy' ? 'Dễ' : d === 'Medium' ? 'Vừa' : d === 'Hard' ? 'Khó' : '';
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--sb-lagoon)] to-[var(--sb-sky-strong)] border-2 border-[var(--sb-ink)] shadow-[var(--sb-shadow-sm)] flex items-center justify-center">
          <BarChart2 size={20} className="text-white" />
        </div>
        <div>
          <h2 className="sb-heading text-xl font-bold text-[var(--sb-ink)]">Thống kê Grammar</h2>
          <p className="text-[var(--sb-ink-soft)] text-sm">Tổng quan kết quả luyện tập ngữ pháp VSTEP B1–B2</p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Đã trả lời', value: totalAnswered, Icon: Target, color: 'bg-[var(--sb-plum)]', sub: 'câu' },
          { label: 'Độ chính xác', value: `${accuracy}%`, Icon: CheckCircle2, color: accuracy >= 80 ? 'bg-[var(--sb-forest-btn)]' : accuracy >= 60 ? 'bg-[var(--sb-ochre-text)]' : 'bg-[var(--sb-berry-btn)]', sub: `${correctAnswers} đúng` },
          { label: 'Đã lưu', value: savedQuestions.length, Icon: Bookmark, color: 'bg-[var(--sb-clay-text)]', sub: 'câu hỏi' },
          { label: 'Cần ôn hôm nay', value: dueForReview.length, Icon: Clock, color: dueForReview.length > 0 ? 'bg-[var(--sb-berry-btn)]' : 'bg-[var(--sb-ink-soft)]', sub: 'câu đến hạn' },
          { label: 'Câu sai', value: wrongQuestions.length, Icon: XCircle, color: 'bg-[var(--sb-berry-btn)]', sub: 'cần xem lại' },
          { label: 'Phiên luyện', value: sessions.length, Icon: TrendingUp, color: 'bg-[var(--sb-lagoon)]', sub: 'tổng số' },
        ].map(({ label, value, Icon, color, sub }) => (
          <div key={label} className="vm-card rounded-2xl p-4 text-center">
            <div className={`w-9 h-9 rounded-xl ${color} border-2 border-[var(--sb-ink)] flex items-center justify-center mx-auto mb-2 shadow-[var(--sb-shadow-sm)]`}>
              <Icon size={16} className="text-white" />
            </div>
            <div className="text-2xl font-black text-[var(--sb-ink)]">{value}</div>
            <div className="text-[var(--sb-ink-soft)] text-xs font-medium mt-0.5">{label}</div>
            <div className="text-[var(--sb-ink-soft)] text-xs">{sub}</div>
          </div>
        ))}
      </div>

      {totalAnswered === 0 ? (
        <div className="text-center py-12">
          <BarChart2 size={48} className="text-[var(--sb-ink-soft)] mx-auto mb-4" />
          <h3 className="text-[var(--sb-ink)] font-semibold mb-2">Chưa có dữ liệu thống kê</h3>
          <p className="text-[var(--sb-ink-soft)] text-sm">Bắt đầu luyện tập Grammar để xem thống kê tại đây.</p>
        </div>
      ) : (
        <>
          {/* Performance by topic */}
          {topicEntries.length > 0 && (
            <div className="vm-panel rounded-2xl p-5">
              <h3 className="text-[var(--sb-ink)] font-bold mb-4 flex items-center gap-2">
                <BarChart2 size={16} className="text-[var(--sb-plum-text)]" />
                Hiệu suất theo chủ đề
              </h3>
              <div className="space-y-3">
                {topicEntries.map(({ topic, answered, correct, pct }) => (
                  <div key={topic}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[var(--sb-ink)] text-sm font-medium">{getTopicLabel(topic)}</span>
                      <span className="text-[var(--sb-ink-soft)] text-xs font-semibold">{correct}/{answered} ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-[var(--sb-paper-deep)] rounded-full overflow-hidden">
                      <div
                        className={`h-full bg-gradient-to-r ${diffColor(pct)} rounded-full progress-fill`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Performance by difficulty */}
          {difficultyEntries.length > 0 && (
            <div className="vm-panel rounded-2xl p-5">
              <h3 className="text-[var(--sb-ink)] font-bold mb-4 flex items-center gap-2">
                <Target size={16} className="text-[var(--sb-terracotta-strong)]" />
                Hiệu suất theo độ khó
              </h3>
              <div className="grid grid-cols-3 gap-4">
                {difficultyEntries.map(({ diff, answered, correct, pct }) => (
                  <div key={diff} className="text-center">
                    <div className={`text-2xl font-black ${diffTextColor(pct)}`}>
                      {pct}%
                    </div>
                    <div className="text-[var(--sb-ink)] font-semibold text-sm">{diffLabel(diff)}</div>
                    <div className="text-[var(--sb-ink-soft)] text-xs">{correct}/{answered} câu</div>
                    <div className="h-1.5 bg-[var(--sb-paper-deep)] rounded-full overflow-hidden mt-2">
                      <div
                        className={`h-full bg-gradient-to-r ${diffColor(pct)} rounded-full`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent sessions */}
          {recentSessions.length > 0 && (
            <div className="vm-panel rounded-2xl p-5">
              <h3 className="text-[var(--sb-ink)] font-bold mb-4 flex items-center gap-2">
                <Clock size={16} className="text-[var(--sb-lagoon-text)]" />
                Lịch sử luyện tập gần đây
              </h3>
              <div className="space-y-2">
                {recentSessions.map((s, i) => {
                  const pct = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
                  return (
                    <div key={i} className="flex items-center gap-3 p-3 bg-[var(--sb-paper-card)] border border-[var(--sb-ink-border)] rounded-xl">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${diffBadgeColor(pct)}`}>
                        {pct}%
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[var(--sb-ink)] text-sm font-medium truncate">
                          {getTopicLabel(s.topic)}{s.difficulty ? ` · ${diffLabel(s.difficulty)}` : ''}
                        </p>
                        <p className="text-[var(--sb-ink-soft)] text-xs">{s.correct}/{s.total} đúng</p>
                      </div>
                      <span className="text-[var(--sb-ink-soft)] text-xs shrink-0">
                        {new Date(s.date).toLocaleDateString('vi-VN')}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function GrammarStats(props) {
  const { grammarStats, savedQuestions, dueForReview, reviewProgress = {} } = props;
  const activity = grammarStats.sentenceActivity || {};
  const reviewed = activity.reviewed || 0;
  const understood = activity.understood || 0;
  return <div className="space-y-6 vm-page-enter">
    <h2 className="sb-heading text-xl text-[var(--sb-ink)] font-bold tracking-tight">Thống kê phân tích và ôn câu</h2>
    <p className="text-[var(--sb-ink-soft)] text-sm">Mức hiểu do bạn tự đánh giá sau khi xem phân tích. Thống kê được lưu trên thiết bị này.</p>
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {[
        ['Đã xem phân tích', activity.analyzed || 0], ['Lượt ôn', reviewed],
        ['Đã hiểu', understood], ['Cần ôn lại', reviewed - understood],
        ['Câu đã lưu', savedQuestions.length], ['Đến hạn ôn', dueForReview.length],
      ].map(([label, value]) => <div key={label} className="vm-card vm-card-interactive rounded-2xl p-4 text-center">
        <p className="text-2xl text-[var(--sb-ink)] font-extrabold tabular-nums">{value}</p><p className="text-[var(--sb-ink-soft)] text-sm mt-0.5">{label}</p>
      </div>)}
    </div>
    <div className="vm-panel rounded-2xl p-5 space-y-3">
      <h3 className="text-[var(--sb-ink)] font-bold">Tiến độ câu đã lưu</h3>
      <div className="flex flex-wrap gap-2.5">{[1, 2, 3, 4, 5].map(level => <span key={level} className="text-[var(--sb-sky-text)] text-sm font-semibold bg-[var(--sb-sky-soft)] border border-[var(--sb-sky)]/35 px-3 py-1.5 rounded-xl tabular-nums">
        L{level}: {savedQuestions.filter(q => (reviewProgress[q.savedId]?.level ?? 1) === level).length}
      </span>)}</div>
    </div>
    {Object.keys(activity.byTopic || {}).length > 0 && <div className="vm-panel rounded-2xl p-5 space-y-3">
      <h3 className="text-[var(--sb-ink)] font-bold">Hoạt động theo chủ đề</h3>
      {Object.entries(activity.byTopic).map(([topic, s]) => <div key={topic} className="flex flex-wrap justify-between gap-2 text-sm py-1 border-b border-[var(--sb-ink-border)] last:border-b-0">
        <span className="text-[var(--sb-plum-text)] font-semibold">{getTopicLabel(topic)}</span>
        <span className="text-[var(--sb-ink)]">{s.analyzed || 0} phân tích · {s.reviewed || 0} lượt ôn · {s.understood || 0} đã hiểu</span>
      </div>)}
    </div>}
    {activity.sessions?.length > 0 && <div className="vm-panel rounded-2xl p-5 space-y-3">
      <h3 className="text-[var(--sb-ink)] font-bold">Hoạt động gần đây</h3>
      {activity.sessions.slice(0, 10).map((s, i) => <div key={i} className="text-sm text-[var(--sb-ink)] flex flex-wrap justify-between gap-2 py-1 border-b border-[var(--sb-ink-border)] last:border-b-0">
        <span>{getTopicLabel(s.topic)} · {s.activity === 'review' ? `${s.total} lượt ôn, ${s.understood || 0} đã hiểu` : `${s.total} câu đã phân tích`}</span>
        <span className="text-[var(--sb-ink-soft)] tabular-nums">{new Date(s.date).toLocaleDateString('vi-VN')}</span>
      </div>)}
    </div>}
    {grammarStats.totalAnswered > 0 && <details className="vm-panel rounded-2xl p-4">
      <summary className="text-[var(--sb-ink)] font-semibold cursor-pointer hover:text-[var(--sb-terracotta-text)] transition-colors">Lịch sử trắc nghiệm TOEIC cũ (giữ nguyên)</summary>
      <div className="mt-4"><LegacyGrammarStats {...props} /></div>
    </details>}
  </div>;
}
