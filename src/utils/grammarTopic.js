import { TOPIC_LABELS, getTopicLabel } from './grammarPrompt.js';
import { isGrammarDueForReview } from './grammarStorage.js';

export const GRAMMAR_TOPIC_PRIORITY = [
  'Tenses',
  'Word Forms',
  'Subject-Verb Agreement',
  'Prepositions',
  'Passive Voice',
  'Conditionals',
  'Relative Clauses',
  'Modal Verbs',
  'Gerunds & Infinitives',
  'Comparatives & Superlatives',
  'Conjunctions',
  'Articles & Determiners',
  'Reported Speech',
  'Sentence Structure & Word Order',
  'Adverbial Clauses',
  'Pronouns & Quantifiers',
  'Noun Clauses',
  'Participles & Reduced Clauses',
];

export const GRAMMAR_TOPIC_GROUPS = [
  'Trọng tâm (1–6)',
  'Quan trọng (7–12)',
  'Bổ sung (13–18)',
  'Khác',
];

const PRIORITY_SET = new Set(GRAMMAR_TOPIC_PRIORITY);

function formatTopicOptionLabel(base, count, dueCount) {
  return `${base} — ${count} câu${dueCount > 0 ? ` · ${dueCount} đến hạn` : ''}`;
}

export function buildTopicOptions(savedQuestions = [], reviewProgress = {}, starredOnly = false) {
  const list = Array.isArray(savedQuestions) ? savedQuestions : [];
  const progress = reviewProgress && typeof reviewProgress === 'object' ? reviewProgress : {};
  const counts = new Map();
  const dueCounts = new Map();
  const unknownTopics = new Set();
  let totalCount = 0;
  let totalDue = 0;

  for (const q of list) {
    const topic = typeof q?.topic === 'string' ? q.topic : '';
    if (topic && topic !== 'All' && topic !== 'Mixed' && !PRIORITY_SET.has(topic)) {
      unknownTopics.add(topic);
    }
    if (starredOnly && !q?.hardMarked) continue;
    totalCount += 1;
    const due = isGrammarDueForReview(progress[q?.savedId]);
    if (due) totalDue += 1;
    if (topic) {
      counts.set(topic, (counts.get(topic) || 0) + 1);
      if (due) dueCounts.set(topic, (dueCounts.get(topic) || 0) + 1);
    }
  }

  const mixedCount = counts.get('Mixed') || 0;
  const mixedDue = dueCounts.get('Mixed') || 0;
  const options = [
    {
      value: 'All',
      label: formatTopicOptionLabel('Tất cả chủ đề', totalCount, totalDue),
      count: totalCount,
      dueCount: totalDue,
      group: null,
      disabled: false,
    },
    {
      value: 'Mixed',
      label: formatTopicOptionLabel(getSentenceTopicLabel({ topic: 'Mixed' }), mixedCount, mixedDue),
      count: mixedCount,
      dueCount: mixedDue,
      group: null,
      disabled: mixedCount === 0,
    },
  ];

  GRAMMAR_TOPIC_PRIORITY.forEach((key, index) => {
    const rank = index + 1;
    const count = counts.get(key) || 0;
    const dueCount = dueCounts.get(key) || 0;
    const group = rank <= 6
      ? GRAMMAR_TOPIC_GROUPS[0]
      : rank <= 12
        ? GRAMMAR_TOPIC_GROUPS[1]
        : GRAMMAR_TOPIC_GROUPS[2];
    options.push({
      value: key,
      label: formatTopicOptionLabel(`${rank}. ${getSentenceTopicLabel({ topic: key })}`, count, dueCount),
      count,
      dueCount,
      group,
      disabled: count === 0,
    });
  });

  const sortedUnknown = [...unknownTopics].sort((a, b) => a.localeCompare(b));
  sortedUnknown.forEach((key, index) => {
    const rank = GRAMMAR_TOPIC_PRIORITY.length + index + 1;
    const count = counts.get(key) || 0;
    const dueCount = dueCounts.get(key) || 0;
    const name = Object.hasOwn(TOPIC_LABELS, key) ? getSentenceTopicLabel({ topic: key }) : key;
    options.push({
      value: key,
      label: formatTopicOptionLabel(`${rank}. ${name}`, count, dueCount),
      count,
      dueCount,
      group: GRAMMAR_TOPIC_GROUPS[3],
      disabled: count === 0,
    });
  });

  return options;
}

// Saved Sentences classifies by the sentence's topic, not the selected batch or
// analysisTopic (which only controls explanation focus). Never infer a topic.
export function getSentenceTopicLabel(question) {
  const topic = question?.topic;
  return typeof topic === 'string' && Object.hasOwn(TOPIC_LABELS, topic)
    ? getTopicLabel(topic)
    : 'Chưa phân loại';
}
