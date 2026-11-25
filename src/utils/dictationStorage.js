// LocalStorage for the Dictation module. Separate keys (vocabmaster_dictation_*);
// never touches the Vocabulary, Grammar or Structures stores.
import { validateDictationData, mergeDictationData } from './dictationSyncMerge.js';
import { emptyDictationData } from './dictationModel.js';

export const LS_DICTATION_DATA = 'vocabmaster_dictation_data';
export const LS_DICTATION_DEVICE = 'vocabmaster_dictation_device';
export const LS_DICTATION_PREFS = 'vocabmaster_dictation_prefs';

/** @returns {{ data: { sentences: object[], words: object[] }, error: string }} */
export function readDictationData(storage = globalThis.localStorage) {
  let raw = null;
  try { raw = storage?.getItem(LS_DICTATION_DATA) ?? null; } catch {
    return { data: emptyDictationData(), error: 'Trình duyệt chặn bộ nhớ nên chưa đọc/lưu được dữ liệu chép chính tả.' };
  }
  if (!raw) return { data: emptyDictationData(), error: '' };
  try {
    const parsed = JSON.parse(raw);
    const problem = validateDictationData(parsed);
    if (problem) throw new Error(problem);
    // Normalise through the merge so every record has the canonical shape.
    return { data: mergeDictationData(parsed, emptyDictationData()), error: '' };
  } catch {
    // Keep the damaged value untouched: writing now could erase recoverable data.
    return { data: emptyDictationData(), error: 'Dữ liệu chép chính tả trên thiết bị bị hỏng nên tạm khoá ghi để không mất dữ liệu. Hãy xuất bản sao và báo người hỗ trợ.' };
  }
}

/** Throws on failure (quota, blocked storage); callers keep the previous state. */
export function writeDictationData(data, storage = globalThis.localStorage) {
  storage.setItem(LS_DICTATION_DATA, JSON.stringify({ schema: 1, sentences: data.sentences, words: data.words }));
}

export function getDictationDeviceId(storage = globalThis.localStorage) {
  try {
    let id = storage.getItem(LS_DICTATION_DEVICE);
    if (!id || !/^[\w-]{6,64}$/.test(id)) {
      id = `dev_${(globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random()}`).replace(/[^\w-]/g, '').slice(0, 40)}`;
      storage.setItem(LS_DICTATION_DEVICE, id);
    }
    return id;
  } catch {
    return 'dev_unsaved';
  }
}

const DEFAULT_PREFS = { speed: 1, autoplay: true, loop: false, showTranslation: false };

export function readDictationPrefs(storage = globalThis.localStorage) {
  try {
    const saved = JSON.parse(storage?.getItem(LS_DICTATION_PREFS) || '{}');
    return {
      speed: [0.75, 1, 1.25].includes(saved.speed) ? saved.speed : DEFAULT_PREFS.speed,
      autoplay: typeof saved.autoplay === 'boolean' ? saved.autoplay : DEFAULT_PREFS.autoplay,
      loop: typeof saved.loop === 'boolean' ? saved.loop : DEFAULT_PREFS.loop,
      showTranslation: typeof saved.showTranslation === 'boolean' ? saved.showTranslation : DEFAULT_PREFS.showTranslation,
    };
  } catch { return { ...DEFAULT_PREFS }; }
}

export function writeDictationPrefs(prefs, storage = globalThis.localStorage) {
  try { storage.setItem(LS_DICTATION_PREFS, JSON.stringify(prefs)); return true; } catch { return false; }
}
