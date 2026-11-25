import { useCallback, useEffect, useRef, useState } from 'react';
import { speakWithSettings } from '../../utils/voiceSpeech';

/**
 * Round engine shared by Listening Review (Vocabulary) and Dictation → "Từ đã lưu":
 * builds a round, speaks its word, scores the answer, moves on after 1.5 s and
 * submits by itself when the exact word is typed.
 *
 * @param {object}   options
 * @param {object[]} options.pool          words matching the screen's filters
 * @param {number}   options.minPool       fewest words that make a round
 * @param {string}   options.resetKey      changes when the filters change
 * @param {boolean}  [options.holdFeedback] keep an answered round on screen when that
 *                                          answer emptied the pool (until auto-advance)
 * @param {(pool: object[], previousId: string|null) => ({correct: object, cards: object[], key?: unknown}|null)} options.buildRound
 *        Rounds are told apart by `key`, or by the correct word's id when there is none.
 * @param {(word: object) => string} options.textOf          what is read aloud
 * @param {(typed: string, word: object) => boolean} options.isTypedMatch
 * @param {string}   options.voiceKey      exam mode: one voice per round, kept on replay
 * @param {(word: object, isCorrect: boolean) => void} options.onAnswer
 * @param {boolean}  options.autoFocusInput
 * @param {{current: HTMLInputElement|null}} options.inputRef
 */
export function useListeningGame({
  pool, minPool, resetKey, holdFeedback = false, buildRound, textOf, isTypedMatch,
  voiceKey, onAnswer, autoFocusInput, inputRef,
}) {
  const [round,         setRound]         = useState(null);
  const [answered,      setAnswered]      = useState(false);
  const [selectedWord,  setSelectedWord]  = useState(null);
  const [score,         setScore]         = useState(0);
  const [totalPlayed,   setTotalPlayed]   = useState(0);
  const [isPlaying,     setIsPlaying]     = useState(false);
  const [listenCount,   setListenCount]   = useState(0);   // how many times Replay was clicked
  const [typingInput,   setTypingInput]   = useState('');  // user's typed answer

  const audioRef        = useRef(null);
  const advanceTimerRef = useRef(null);
  const answeredRef     = useRef(false);
  const poolRef         = useRef([]);
  const buildRef        = useRef(buildRound);
  const roundSeqRef     = useRef(0);
  const resetKeyRef     = useRef(resetKey);

  useEffect(() => {
    poolRef.current = pool;
    buildRef.current = buildRound;
  });

  const hasEnough = pool.length >= minPool;

  function clearAdvanceTimer() {
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  }

  function stopCurrentAudio() {
    if (audioRef.current) {
      try { audioRef.current.cancel(); } catch { /* ignore */ }
      audioRef.current = null;
    }
    setIsPlaying(false);
  }

  /* ── Build a new round from the current pool ── */
  const startNewRound = useCallback((words, prevId) => {
    clearAdvanceTimer();
    if (words.length < minPool) {
      answeredRef.current = false;
      setRound(null);
      setAnswered(false);
      setSelectedWord(null);
      setTypingInput('');
      return;
    }
    const r = buildRef.current(words, prevId);
    if (!r) return;
    roundSeqRef.current += 1;

    answeredRef.current = false;
    setRound(r);
    setAnswered(false);
    setSelectedWord(null);
    setListenCount(0);   // reset hint counter
    setTypingInput('');  // clear typing field
  }, [minPool]);

  /* ── Start first round when the screen mounts or the filters change ── */
  // Reset game state and build a fresh round whenever the pool changes.
  useEffect(() => {
    const filtersChanged = resetKeyRef.current !== resetKey;
    resetKeyRef.current = resetKey;
    if (holdFeedback && !filtersChanged && !hasEnough && answeredRef.current) return;
    clearAdvanceTimer();
    stopCurrentAudio();
    if (hasEnough) {
      // No previous id: do not carry over stale ids into a new pool
      startNewRound(pool, null);
    } else {
      answeredRef.current = false;
      setAnswered(false);
      setSelectedWord(null);
      setTypingInput('');
      setRound(null);
    }
    // We deliberately only react to the filters and "enough words", not every words update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, hasEnough]);

  useEffect(() => () => {
    clearAdvanceTimer();
    stopCurrentAudio();
  }, []);

  const roundKey = round?.key ?? round?.correct?.id;

  /* ── Auto-play audio when a new round starts ── */
  useEffect(() => {
    if (!round || answered) return;
    const timer = setTimeout(() => triggerAudio(textOf(round.correct)), 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundKey]);

  /* ── Re-focus the typing input whenever a fresh round begins (only if enabled) ── */
  useEffect(() => {
    if (!round || answered || !autoFocusInput) return;
    // Small delay so the DOM has rendered the input before we focus
    const timer = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundKey]);

  /* ── Audio trigger ── */
  function triggerAudio(text) {
    // Cancel whatever is playing (handle works for both Web Speech & Audio element)
    if (audioRef.current) {
      try { audioRef.current.cancel(); } catch { /* ignore */ }
    }
    setIsPlaying(true);
    audioRef.current = speakWithSettings(text, { itemKey: `${voiceKey}:${roundSeqRef.current}` });
    setTimeout(() => setIsPlaying(false), 2000);
  }

  /* ── Handle Replay button click (increment listen counter) ── */
  function handleReplay() {
    setListenCount(c => c + 1);
    triggerAudio(textOf(round.correct));
  }

  /* ── Handle typing input change ── */
  function handleTypingChange(e) {
    const val = e.target.value;
    setTypingInput(val);
    // Auto-advance when user types the exact correct word (case-insensitive)
    if (round && !answered && isTypedMatch(val, round.correct)) {
      handleCardClick(round.correct);
    }
  }

  /* ── Handle card click ── */
  function handleCardClick(word) {
    if (answeredRef.current || answered || !round) return;
    answeredRef.current = true;

    const isCorrect = word.id === round.correct.id;
    setSelectedWord(word);
    setAnswered(true);
    setTotalPlayed(t => t + 1);
    if (isCorrect) setScore(s => s + 1);

    onAnswer(round.correct, isCorrect);

    // The next round avoids repeating this word
    const justPlayedId = round.correct.id;

    // Auto-advance after 1.5 s
    clearAdvanceTimer();
    advanceTimerRef.current = setTimeout(() => {
      advanceTimerRef.current = null;
      startNewRound(poolRef.current, justPlayedId);
    }, 1500);
  }

  /* ── Skip / Next handler ── */
  function handleNext() {
    clearAdvanceTimer();
    stopCurrentAudio();
    startNewRound(poolRef.current, round?.correct?.id ?? null);
  }

  /* ── Card state classifier ── */
  function cardState(word) {
    if (!answered) return 'idle';
    if (word.id === round.correct.id) return 'correct';
    if (selectedWord?.id === word.id) return 'wrong';
    return 'disabled';
  }

  /** Cancel the pending auto-advance and the voice (e.g. the screen switches mode). */
  function stop() {
    clearAdvanceTimer();
    stopCurrentAudio();
  }

  return {
    round, answered, score, totalPlayed, isPlaying, listenCount, typingInput, hasEnough,
    isCorrectAnswer: answered && selectedWord?.id === round?.correct?.id,
    handleReplay, handleTypingChange, handleCardClick, handleNext, cardState, stop,
  };
}
