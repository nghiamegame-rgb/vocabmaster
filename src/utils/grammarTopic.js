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

export const GRAMMAR_TOPIC_TARGET_MIN = 20;
export const GRAMMAR_TOPIC_TARGET_MAX = 40;

const PRIORITY_SET = new Set(GRAMMAR_TOPIC_PRIORITY);

function formatTopicOptionLabel(base, count, dueCount) {
  return `${base} — ${count} câu${dueCount > 0 ? ` · ${dueCount} đến hạn` : ''}`;
}

function getTargetStatus(count) {
  if (count < GRAMMAR_TOPIC_TARGET_MIN) {
    return { status: 'short', suffix: ` · thiếu ${GRAMMAR_TOPIC_TARGET_MIN - count}` };
  }
  if (count > GRAMMAR_TOPIC_TARGET_MAX) {
    return { status: 'excess', suffix: ` · thừa ${count - GRAMMAR_TOPIC_TARGET_MAX}` };
  }
  return { status: 'enough', suffix: ' · đủ' };
}

function collectTopicEntries(savedQuestions = [], reviewProgress = {}, starredOnly = false) {
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

  const entries = [
    {
      value: 'Mixed',
      name: getSentenceTopicLabel({ topic: 'Mixed' }),
      rank: null,
      group: null,
      count: counts.get('Mixed') || 0,
      dueCount: dueCounts.get('Mixed') || 0,
    },
  ];

  GRAMMAR_TOPIC_PRIORITY.forEach((key, index) => {
    const rank = index + 1;
    const group = rank <= 6
      ? GRAMMAR_TOPIC_GROUPS[0]
      : rank <= 12
        ? GRAMMAR_TOPIC_GROUPS[1]
        : GRAMMAR_TOPIC_GROUPS[2];
    entries.push({
      value: key,
      name: getSentenceTopicLabel({ topic: key }),
      rank,
      group,
      count: counts.get(key) || 0,
      dueCount: dueCounts.get(key) || 0,
    });
  });

  const sortedUnknown = [...unknownTopics].sort((a, b) => a.localeCompare(b));
  sortedUnknown.forEach((key, index) => {
    entries.push({
      value: key,
      name: Object.hasOwn(TOPIC_LABELS, key) ? getSentenceTopicLabel({ topic: key }) : key,
      rank: GRAMMAR_TOPIC_PRIORITY.length + index + 1,
      group: GRAMMAR_TOPIC_GROUPS[3],
      count: counts.get(key) || 0,
      dueCount: dueCounts.get(key) || 0,
    });
  });

  return { totalCount, totalDue, entries };
}

export function groupTopicOptions(options = []) {
  const top = [];
  const groups = new Map();
  for (const opt of options) {
    if (!opt.group) {
      top.push(opt);
    } else {
      if (!groups.has(opt.group)) groups.set(opt.group, []);
      groups.get(opt.group).push(opt);
    }
  }
  return { top, groups: [...groups.entries()] };
}

export function buildTopicOptions(savedQuestions = [], reviewProgress = {}, starredOnly = false) {
  const { totalCount, totalDue, entries } = collectTopicEntries(savedQuestions, reviewProgress, starredOnly);
  return [
    {
      value: 'All',
      label: formatTopicOptionLabel('Tất cả chủ đề', totalCount, totalDue),
      count: totalCount,
      dueCount: totalDue,
      group: null,
      disabled: false,
    },
    ...entries.map(entry => ({
      value: entry.value,
      label: formatTopicOptionLabel(entry.rank ? `${entry.rank}. ${entry.name}` : entry.name, entry.count, entry.dueCount),
      count: entry.count,
      dueCount: entry.dueCount,
      group: entry.group,
      disabled: entry.count === 0,
    })),
  ];
}

export function buildGenerationTopicOptions(savedQuestions = []) {
  const { entries } = collectTopicEntries(savedQuestions, {}, false);
  return entries.map(entry => {
    const base = entry.rank ? `${entry.rank}. ${entry.name}` : entry.name;
    if (!entry.rank) {
      return {
        value: entry.value,
        label: `${base} — ${entry.count} câu`,
        count: entry.count,
        status: null,
        group: entry.group,
        disabled: false,
      };
    }
    const { status, suffix } = getTargetStatus(entry.count);
    return {
      value: entry.value,
      label: `${base} — ${entry.count} câu${suffix}`,
      count: entry.count,
      status,
      group: entry.group,
      disabled: false,
    };
  });
}

// Saved Sentences classifies by the sentence's topic, not the selected batch or
// analysisTopic (which only controls explanation focus). Never infer a topic.
export function getSentenceTopicLabel(question) {
  const topic = question?.topic;
  return typeof topic === 'string' && Object.hasOwn(TOPIC_LABELS, topic)
    ? getTopicLabel(topic)
    : 'Chưa phân loại';
}
