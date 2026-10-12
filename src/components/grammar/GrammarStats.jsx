import { BarChart2, Target, TrendingUp, Bookmark, XCircle, Clock, CheckCircle2 } from 'lucide-react';
import { getTopicLabel } from '../../utils/grammarPrompt';

/**
 * GrammarStats — Grammar performance statistics dashboard.
 */
export default function GrammarStats({
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
    if (pct >= 80) return 'from-emerald-500 to-green-500';
    if (pct >= 60) return 'from-amber-500 to-yellow-500';
    return 'from-rose-500 to-red-500';
  }

  function diffLabel(d) {
    return d === 'Easy' ? 'Dễ' : d === 'Medium' ? 'Vừa' : d === 'Hard' ? 'Khó' : '';
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-teal-500/20">
          <BarChart2 size={20} className="text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Thống kê Grammar</h2>
          <p className="text-slate-400 text-sm">Tổng quan kết quả luyện tập ngữ pháp TOEIC</p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Đã trả lời', value: totalAnswered, Icon: Target, color: 'from-purple-500 to-indigo-500', sub: 'câu' },
          { label: 'Độ chính xác', value: `${accuracy}%`, Icon: CheckCircle2, color: accuracy >= 80 ? 'from-emerald-500 to-green-500' : accuracy >= 60 ? 'from-amber-500 to-yellow-500' : 'from-rose-500 to-red-500', sub: `${correctAnswers} đúng` },
          { label: 'Đã lưu', value: savedQuestions.length, Icon: Bookmark, color: 'from-amber-500 to-orange-500', sub: 'câu hỏi' },
          { label: 'Cần ôn hôm nay', value: dueForReview.length, Icon: Clock, color: dueForReview.length > 0 ? 'from-rose-500 to-pink-500' : 'from-slate-500 to-slate-600', sub: 'câu đến hạn' },
          { label: 'Câu sai', value: wrongQuestions.length, Icon: XCircle, color: 'from-rose-500 to-red-500', sub: 'cần xem lại' },
          { label: 'Phiên luyện', value: sessions.length, Icon: TrendingUp, color: 'from-teal-500 to-cyan-500', sub: 'tổng số' },
        ].map(({ label, value, Icon, color, sub }) => (
          <div key={label} className="bg-slate-900/80 border border-slate-700/50 rounded-2xl p-4 text-center">
            <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center mx-auto mb-2 shadow-lg`}>
              <Icon size={16} className="text-white" />
            </div>
            <div className="text-2xl font-black text-white">{value}</div>
            <div className="text-slate-400 text-xs mt-0.5">{label}</div>
            <div className="text-slate-600 text-xs">{sub}</div>
          </div>
        ))}
      </div>

      {totalAnswered === 0 ? (
        <div className="text-center py-12">
          <BarChart2 size={48} className="text-slate-700 mx-auto mb-4" />
          <h3 className="text-slate-400 font-medium mb-2">Chưa có dữ liệu thống kê</h3>
          <p className="text-slate-600 text-sm">Bắt đầu luyện tập Grammar để xem thống kê tại đây.</p>
        </div>
      ) : (
        <>
          {/* Performance by topic */}
          {topicEntries.length > 0 && (
            <div className="bg-slate-900/80 border border-slate-700/50 rounded-2xl p-5">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <BarChart2 size={16} className="text-purple-400" />
                Hiệu suất theo chủ đề
              </h3>
              <div className="space-y-3">
                {topicEntries.map(({ topic, answered, correct, pct }) => (
                  <div key={topic}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-slate-300 text-sm">{getTopicLabel(topic)}</span>
                      <span className="text-slate-400 text-xs">{correct}/{answered} ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
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
            <div className="bg-slate-900/80 border border-slate-700/50 rounded-2xl p-5">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <Target size={16} className="text-indigo-400" />
                Hiệu suất theo độ khó
              </h3>
              <div className="grid grid-cols-3 gap-4">
                {difficultyEntries.map(({ diff, answered, correct, pct }) => (
                  <div key={diff} className="text-center">
                    <div className={`text-2xl font-black bg-gradient-to-br ${diffColor(pct)} bg-clip-text text-transparent`}>
                      {pct}%
                    </div>
                    <div className="text-white font-medium text-sm">{diffLabel(diff)}</div>
                    <div className="text-slate-500 text-xs">{correct}/{answered} câu</div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mt-2">
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
            <div className="bg-slate-900/80 border border-slate-700/50 rounded-2xl p-5">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <Clock size={16} className="text-teal-400" />
                Lịch sử luyện tập gần đây
              </h3>
              <div className="space-y-2">
                {recentSessions.map((s, i) => {
                  const pct = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
                  return (
                    <div key={i} className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold bg-gradient-to-br ${diffColor(pct)}`}>
                        {pct}%
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-300 text-sm truncate">
                          {getTopicLabel(s.topic)}{s.difficulty ? ` · ${diffLabel(s.difficulty)}` : ''}
                        </p>
                        <p className="text-slate-500 text-xs">{s.correct}/{s.total} đúng</p>
                      </div>
                      <span className="text-slate-600 text-xs shrink-0">
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
