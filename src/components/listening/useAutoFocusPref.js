import { useState } from 'react';
import { readListeningAutofocus, writeListeningAutofocus, safeLocalStorage } from '../../utils/listeningPrefs';

/**
 * Per-device "open the keyboard by itself" setting: auto-focus the typing input on
 * each new word. `toggle(input)` saves it and focuses/blurs the given input now.
 */
export function useAutoFocusPref() {
  const [enabled, setEnabled] = useState(() => readListeningAutofocus(safeLocalStorage()));

  function toggle(input) {
    const next = !enabled;
    setEnabled(next);
    writeListeningAutofocus(safeLocalStorage(), next);
    if (next) input?.focus();
    else input?.blur(); // close the on-screen keyboard if it is open
  }

  return [enabled, toggle];
}
