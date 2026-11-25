import { useEffect, useMemo, useState } from 'react';
import { getLastSpeechEngine, listSystemVoices, subscribeSpeechEngine, subscribeVoices } from '../utils/audio';
import { listEnglishVoices } from '../utils/voiceSelection';

// Voices load asynchronously and some browsers never announce them, so look again.
const RETRY_MS = [250, 1000, 2500];

/**
 * English voices of this device.
 * status: 'loading' (list still empty) | 'ready' | 'unavailable' (no English voice)
 * googleFallback: the app is (or was last) speaking with the Google fallback.
 */
export function useVoices() {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const [voices, setVoices] = useState(listSystemVoices);
  const [settled, setSettled] = useState(false);
  const [engine, setEngine] = useState(getLastSpeechEngine);

  useEffect(() => {
    const refresh = () => setVoices(listSystemVoices());
    const stopVoices = subscribeVoices(refresh);
    const stopEngine = subscribeSpeechEngine(setEngine);
    const timers = RETRY_MS.map(ms => setTimeout(refresh, ms));
    timers.push(setTimeout(() => setSettled(true), RETRY_MS[RETRY_MS.length - 1]));
    timers.push(setTimeout(refresh, 0));
    return () => {
      stopVoices();
      stopEngine();
      timers.forEach(clearTimeout);
    };
  }, []);

  const english = useMemo(() => listEnglishVoices(voices), [voices]);
  const status = english.length ? 'ready' : (supported && !settled ? 'loading' : 'unavailable');
  return { voices, english, status, googleFallback: status === 'unavailable' || engine === 'google' };
}
