import { getSentenceTopicLabel } from '../../utils/grammarTopic';

export default function GrammarTopicBadge({ question }) {
  const label = getSentenceTopicLabel(question);
  const colors = label === 'Chưa phân loại'
    ? 'bg-slate-700/50 text-slate-400 border-slate-600/50'
    : 'bg-purple-600/20 text-purple-300 border-purple-500/20';
  return <span data-grammar-topic="" aria-label="Chủ đề ngữ pháp"
    className={`min-w-0 max-w-full whitespace-normal break-words px-2 py-0.5 rounded-md text-xs font-medium border ${colors}`}>
    {label}
  </span>;
}
