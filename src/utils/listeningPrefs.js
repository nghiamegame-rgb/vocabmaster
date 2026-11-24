// Per-device Listening preference: auto-focus the typing input on each new word.
// Stored only in this browser's LocalStorage. It is NOT part of the words/stats
// stores, is never synced to the cloud and is never included in backups.

export const LISTENING_AUTOFOCUS_KEY = 'vocabmaster_listening_autofocus';

/** Touch screens default to OFF (the keyboard would cover half the screen); desktops to ON. */
export function defaultListeningAutofocus(win = globalThis.window) {
  try {
    if (win && typeof win.matchMedia === 'function' && win.matchMedia('(pointer: coarse)').matches) return false;
  } catch { /* matchMedia unavailable or broken: treat as desktop */ }
  return true;
}

/** 'on' → true, 'off' → false, anything else (missing/garbage) → null. */
export function parseListeningAutofocus(raw) {
  if (raw === 'on') return true;
  if (raw === 'off') return false;
  return null;
}

/** LocalStorage, or null when the browser blocks access (private mode, sandbox…). */
export function safeLocalStorage(win = globalThis.window) {
  try { return win?.localStorage ?? null; } catch { return null; }
}

/** The saved choice wins; otherwise (nothing saved, garbage, storage error) the device default. */
export function readListeningAutofocus(storage, win = globalThis.window) {
  let saved = null;
  try { saved = parseListeningAutofocus(storage?.getItem(LISTENING_AUTOFOCUS_KEY)); } catch { saved = null; }
  return saved ?? defaultListeningAutofocus(win);
}

/** Returns false (without throwing) when the value could not be saved, e.g. storage full. */
export function writeListeningAutofocus(storage, enabled) {
  try {
    if (!storage) return false;
    storage.setItem(LISTENING_AUTOFOCUS_KEY, enabled ? 'on' : 'off');
    return true;
  } catch { return false; }
}
