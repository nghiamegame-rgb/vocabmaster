import { TOPIC_LABELS, getTopicLabel } from './grammarPrompt.js';

// Saved Sentences classifies by the sentence's topic, not the selected batch or
// analysisTopic (which only controls explanation focus). Never infer a topic.
export function getSentenceTopicLabel(question) {
  const topic = question?.topic;
  return typeof topic === 'string' && Object.hasOwn(TOPIC_LABELS, topic)
    ? getTopicLabel(topic)
    : 'Chưa phân loại';
}
