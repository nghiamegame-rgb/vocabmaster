/**
 * Pure timing logic for Smart Quiz Multiple-Choice audio + visual feedback.
 *
 * Advances to the next question only when ALL conditions hold:
 *   1. At least `minMs` (default 1800 ms) have elapsed since answering.
 *   2. Audio playback has finished (`audioEnded === true`).
 *   3. The feedback image has been visible for at least `imageMs` (default 1000 ms).
 *
 * Safety ceiling: if `maxMs` (default 4000 ms) have elapsed since answering,
 * advance unconditionally even without `onEnd` so practice never stalls.
 */

export const DEFAULT_FEEDBACK_MIN_MS = 1800;
export const DEFAULT_FEEDBACK_IMAGE_MS = 1000;
export const DEFAULT_FEEDBACK_MAX_MS = 4000;

export function getFeedbackNowMs() {
  return Date.now();
}

/**
 * Evaluate whether the quiz should advance now or how many ms to wait next.
 *
 * @param {object} params
 * @param {number} params.nowMs          Current timestamp in ms
 * @param {number} params.startedAtMs    Timestamp when the user selected an option
 * @param {number} [params.imageShownAtMs] Timestamp when the image overlay appeared (defaults to startedAtMs)
 * @param {boolean} [params.audioEnded]  Whether `playWordAudio`'s `onEnd` has fired
 * @param {number} [params.minMs]        Minimum total delay from answer click
 * @param {number} [params.imageMs]      Minimum visible duration for the image
 * @param {number} [params.maxMs]        Hard upper ceiling so practice never stalls
 * @returns {{ shouldAdvance: boolean, waitMs: number, reason: string }}
 */
export function evaluateFeedbackAdvance({
  nowMs,
  startedAtMs,
  imageShownAtMs = startedAtMs,
  audioEnded = false,
  minMs = DEFAULT_FEEDBACK_MIN_MS,
  imageMs = DEFAULT_FEEDBACK_IMAGE_MS,
  maxMs = DEFAULT_FEEDBACK_MAX_MS,
}) {
  const safeMin = Math.max(0, Number.isFinite(minMs) ? minMs : DEFAULT_FEEDBACK_MIN_MS);
  const safeImage = Math.max(0, Number.isFinite(imageMs) ? imageMs : DEFAULT_FEEDBACK_IMAGE_MS);
  const safeMax = Math.max(0, Number.isFinite(maxMs) ? maxMs : DEFAULT_FEEDBACK_MAX_MS);
  const safeStart = Number.isFinite(startedAtMs) ? startedAtMs : 0;
  const safeNow = Number.isFinite(nowMs) ? Math.max(safeStart, nowMs) : safeStart;
  const safeImageStart = Number.isFinite(imageShownAtMs) ? Math.max(safeStart, imageShownAtMs) : safeStart;

  const minTarget = safeStart + safeMin;
  const imageTarget = safeImageStart + safeImage;
  const maxTarget = safeStart + safeMax;

  if (safeNow >= maxTarget) {
    return { shouldAdvance: true, waitMs: 0, reason: 'max-timeout' };
  }

  if (audioEnded) {
    const readyAt = Math.min(maxTarget, Math.max(minTarget, imageTarget));
    if (safeNow >= readyAt) {
      return { shouldAdvance: true, waitMs: 0, reason: 'ready' };
    }
    return { shouldAdvance: false, waitMs: readyAt - safeNow, reason: 'waiting-min-or-image' };
  }

  return { shouldAdvance: false, waitMs: maxTarget - safeNow, reason: 'waiting-audio' };
}
