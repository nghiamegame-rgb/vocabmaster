import { getSentenceTopicLabel } from '../../utils/grammarTopic';

export default function GrammarTopicBadge({ question }) {
  const label = getSentenceTopicLabel(question);
  const colors = label === 'Chưa phân loại'
    ? 'bg-[var(--sb-paper-deep)] text-[var(--sb-ink-soft)] border-[var(--sb-ink-border)]'
    : 'bg-[var(--sb-plum-soft)] text-[var(--sb-plum-text)] border-[var(--sb-plum)]/35';
  return <span data-grammar-topic="" aria-label="Chủ đề ngữ pháp"
    className={`min-w-0 max-w-full whitespace-normal break-words px-2 py-0.5 rounded-md text-xs font-medium border ${colors}`}>
    {label}
  </span>;
}
