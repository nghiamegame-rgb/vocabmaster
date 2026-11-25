// Voice picking — pure functions over SpeechSynthesisVoice-like objects
// ({ name, lang, voiceURI }). No browser access here, so everything is testable in Node.

export const VOICE_RATE_MIN = 0.8;
export const VOICE_RATE_MAX = 1.1;
export const VOICE_RATE_DEFAULT = 0.9;
/** Exam mode varies the speed by at most this much around the chosen rate. */
export const EXAM_RATE_JITTER = 0.05;

// Accents preferred by exam mode, in display order.
const EXAM_REGIONS = ['US', 'GB', 'AU', 'CA', 'IN'];

const ACCENT_LABELS = {
  US: 'Mỹ', GB: 'Anh', AU: 'Úc', CA: 'Canada', IN: 'Ấn Độ', IE: 'Ireland', NZ: 'New Zealand',
  ZA: 'Nam Phi', SG: 'Singapore', PH: 'Philippines', HK: 'Hồng Kông', NG: 'Nigeria', KE: 'Kenya',
  TZ: 'Tanzania', SCOTLAND: 'Scotland',
};

// Apple "novelty" and Eloquence voices (singing, robot, character voices). They are
// real en-US entries on macOS/iOS but sound nothing like an exam recording.
const UNNATURAL_NAMES = new Set([
  'albert', 'bad news', 'bahh', 'bells', 'boing', 'bubbles', 'cellos', 'deranged', 'eddy', 'flo',
  'fred', 'good news', 'grandma', 'grandpa', 'hysterical', 'jester', 'junior', 'kathy', 'organ',
  'pipe organ', 'ralph', 'reed', 'rocko', 'sandy', 'shelley', 'superstar', 'trinoids', 'whisper',
  'wobble', 'zarvox',
]);

const normalizedLang = voice => String(voice?.lang ?? '').replace(/_/g, '-').toLowerCase();

export const voiceKey = voice => `${voice?.voiceURI ?? ''}\u0000${voice?.name ?? ''}`;

export function isEnglishVoice(voice) {
  return /^en(-|$)/.test(normalizedLang(voice));
}

/** Region part of the language tag ('US', 'GB', …), '' when there is none. */
export function voiceRegion(voice) {
  const parts = normalizedLang(voice).split('-').slice(1);
  if (parts.includes('scotland')) return 'SCOTLAND';
  return (parts.find(p => /^[a-z]{2}$/.test(p)) || '').toUpperCase();
}

/** Edge's high-quality voices carry "Natural" / "Online" in their name. */
export function isNaturalVoice(voice) {
  return /\b(natural|online)\b/i.test(voice?.name ?? '');
}

export function isUnnaturalVoice(voice) {
  const bare = String(voice?.name ?? '').replace(/\s*\(.*$/, '').trim().toLowerCase();
  return UNNATURAL_NAMES.has(bare);
}

const regionRank = voice => {
  const index = EXAM_REGIONS.indexOf(voiceRegion(voice));
  return index === -1 ? EXAM_REGIONS.length : index;
};

/**
 * English voices only, duplicates removed, best first:
 * natural voices, then ordinary ones, then novelty voices; inside each group
 * by accent (Mỹ, Anh, Úc, Canada, Ấn Độ, others) and name.
 */
export function listEnglishVoices(voices) {
  const seen = new Set();
  const english = [];
  for (const voice of voices || []) {
    if (!isEnglishVoice(voice) || seen.has(voiceKey(voice))) continue;
    seen.add(voiceKey(voice));
    english.push(voice);
  }
  const quality = v => (isUnnaturalVoice(v) ? 2 : isNaturalVoice(v) ? 0 : 1);
  return english.sort((a, b) => (quality(a) - quality(b)) || (regionRank(a) - regionRank(b))
    || String(a.name).localeCompare(String(b.name), 'en'));
}

/** "Microsoft Aria Online (Natural) - English (United States)" → "Microsoft Aria (Mỹ) · Natural". */
export function voiceLabel(voice) {
  const name = String(voice?.name ?? '')
    .replace(/\s+-\s+English\b.*$/i, '')        // Windows/Edge language suffix
    .replace(/\s*\(English[^()]*(\([^()]*\))?[^()]*\)\s*$/i, '') // Apple "(English (US))"
    .replace(/\s*\(Natural\)/i, '')
    .replace(/\s+Online\b/i, '')
    .trim() || 'Giọng tiếng Anh';
  const region = voiceRegion(voice);
  const accent = ACCENT_LABELS[region] || region || 'tiếng Anh';
  return `${name} (${accent})${isNaturalVoice(voice) ? ' · Natural' : ''}`;
}

/** Labels for a list; identical labels (common on Android) get " 2", " 3"… */
export function voiceLabels(voices) {
  const counts = new Map();
  return voices.map(voice => {
    const label = voiceLabel(voice);
    const n = (counts.get(label) || 0) + 1;
    counts.set(label, n);
    return n === 1 ? label : `${label} ${n}`;
  });
}

/** The app's default voice (unchanged rule): en-US, then en-GB, then any English. */
export function pickDefaultVoice(voices) {
  const list = voices || [];
  return list.find(v => v.lang === 'en-US')
    || list.find(v => v.lang === 'en-GB')
    || list.find(v => String(v.lang).startsWith('en'))
    || null;
}

/**
 * The saved voice if this device still has it (matched by voiceURI + name, then
 * either one), otherwise the default voice. Never changes the saved preference.
 */
export function findSavedVoice(voices, prefs) {
  const { voiceURI = '', name = '' } = prefs || {};
  if (!voiceURI && !name) return null;
  const english = (voices || []).filter(isEnglishVoice);
  return english.find(v => v.voiceURI === voiceURI && v.name === name)
    || (voiceURI && english.find(v => v.voiceURI === voiceURI))
    || (name && english.find(v => v.name === name))
    || null;
}

export function resolveSelectedVoice(voices, prefs) {
  return findSavedVoice(voices, prefs) || pickDefaultVoice(voices) || listEnglishVoices(voices)[0] || null;
}

/**
 * Voices exam mode draws from: US/GB/AU/CA/IN without novelty voices. When that
 * leaves fewer than two, every normal English voice (or every English one).
 */
export function examVoicePool(voices) {
  const english = listEnglishVoices(voices);
  const normal = english.filter(v => !isUnnaturalVoice(v));
  const preferred = normal.filter(v => EXAM_REGIONS.includes(voiceRegion(v)));
  if (preferred.length >= 2) return preferred;
  if (normal.length) return normal;
  return english;
}

export const clampRate = rate => Math.min(VOICE_RATE_MAX, Math.max(VOICE_RATE_MIN - EXAM_RATE_JITTER, rate));

/**
 * Exam-mode memory. `assign(itemKey, pool)`:
 *  - same itemKey as the last call (replay) → same voice and same speed offset;
 *  - a new item → random voice different from the previous item's (if ≥ 2 voices).
 */
export function createExamRotation(random = Math.random) {
  let current = null; // { itemKey, voiceKey, offset }
  return {
    assign(itemKey, pool) {
      if (!pool?.length) return null;
      if (current && itemKey !== undefined && itemKey !== null && current.itemKey === itemKey) {
        const kept = pool.find(v => voiceKey(v) === current.voiceKey);
        if (kept) return { voice: kept, offset: current.offset };
      }
      const others = current ? pool.filter(v => voiceKey(v) !== current.voiceKey) : pool;
      const candidates = others.length ? others : pool;
      const voice = candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))];
      const offset = Math.round((random() * 2 - 1) * EXAM_RATE_JITTER * 100) / 100;
      current = { itemKey, voiceKey: voiceKey(voice), offset };
      return { voice, offset };
    },
    reset() { current = null; },
  };
}

/**
 * What to say it with.
 * No English voice (Google fallback) → voice null, chosen rate, exam mode ignored.
 */
export function planSpeech({ voices, prefs, itemKey, rotation }) {
  const english = listEnglishVoices(voices);
  if (!english.length) return { voice: null, rate: prefs.rate, examApplied: false };
  if (prefs.examMode && rotation) {
    const { voice, offset } = rotation.assign(itemKey, examVoicePool(voices));
    return { voice, rate: Math.round(clampRate(prefs.rate + offset) * 100) / 100, examApplied: true };
  }
  return { voice: resolveSelectedVoice(voices, prefs), rate: prefs.rate, examApplied: false };
}
