/** Durable Structures cache, including review events and deletion tombstones. */
export const LS_STRUCTURES = 'vocabmaster_grammar_structures';

export const STRUCTURE_REVIEW_INTERVALS = { 1: 1, 2: 3, 3: 7, 4: 14, 5: 30 };
export const STRUCTURE_LEVEL_UP_THRESHOLD = { 1: 2, 2: 4, 3: 8, 4: 15 };

export function getStructures() {
  try {
    const data = JSON.parse(localStorage.getItem(LS_STRUCTURES) || '[]');
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export function saveStructures(structures) {
  localStorage.setItem(LS_STRUCTURES, JSON.stringify(structures));
}

export function isStructureDue(structure) {
  return !structure?.nextReviewAt || Date.now() >= structure.nextReviewAt;
}

export function calcStructureNextReviewAt(level) {
  const days = STRUCTURE_REVIEW_INTERVALS[level] ?? 1;
  return Date.now() + days * 24 * 60 * 60 * 1000;
}

/** Weighted pool: L1/L2, wrong, and due structures are preferred. */
export function selectStructures(structures, count) {
  const unique = [...new Map(structures.filter(item => !item.deletedAt).map(item => [item.id, item])).values()];
  const due = unique.filter(isStructureDue);
  // Avoid recently practiced structures while enough due items remain.
  const candidates = due.length >= count ? due : unique;
  const pool = candidates.map(item => {
    const levelWeight = item.level <= 2 ? 7 : item.level <= 4 ? 3 : 1;
    const wrongWeight = (item.wrongCount || 0) > 0 ? 5 : 0;
    const dueWeight = isStructureDue(item) ? 6 : 0;
    return { item, weight: levelWeight + wrongWeight + dueWeight + Math.random() * 2 };
  });
  const selected = [];
  while (pool.length && selected.length < count) {
    const total = pool.reduce((sum, entry) => sum + entry.weight, 0);
    let cursor = Math.random() * total;
    const index = pool.findIndex(entry => {
      cursor -= entry.weight;
      return cursor <= 0;
    });
    const [entry] = pool.splice(index < 0 ? pool.length - 1 : index, 1);
    selected.push(entry.item);
  }
  return selected;
}
