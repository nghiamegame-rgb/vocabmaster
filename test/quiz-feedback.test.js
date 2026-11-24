import assert from 'node:assert/strict';
import {
  DEFAULT_FEEDBACK_MIN_MS,
  DEFAULT_FEEDBACK_IMAGE_MS,
  DEFAULT_FEEDBACK_MAX_MS,
  evaluateFeedbackAdvance,
} from '../src/utils/quizFeedback.js';

// 1. Default constants match specification
assert.equal(DEFAULT_FEEDBACK_MIN_MS, 1800);
assert.equal(DEFAULT_FEEDBACK_IMAGE_MS, 1000);
assert.equal(DEFAULT_FEEDBACK_MAX_MS, 4000);

// 2. Audio ends very quickly (600 ms): must still wait until 1800 ms (remaining 1200 ms)
{
  const res = evaluateFeedbackAdvance({
    startedAtMs: 1000,
    imageShownAtMs: 1000,
    nowMs: 1600,
    audioEnded: true,
  });
  assert.deepEqual(res, { shouldAdvance: false, waitMs: 1200, reason: 'waiting-min-or-image' });
}

// 3. Audio ended and 1800 ms reached with image shown since t=0: advance immediately
{
  const res = evaluateFeedbackAdvance({
    startedAtMs: 1000,
    imageShownAtMs: 1000,
    nowMs: 2800,
    audioEnded: true,
  });
  assert.deepEqual(res, { shouldAdvance: true, waitMs: 0, reason: 'ready' });
}

// 4. Audio still playing at 1800 ms: must NOT advance yet, waits up to safety ceiling (4000 ms)
{
  const res = evaluateFeedbackAdvance({
    startedAtMs: 1000,
    imageShownAtMs: 1000,
    nowMs: 2800,
    audioEnded: false,
  });
  assert.deepEqual(res, { shouldAdvance: false, waitMs: 2200, reason: 'waiting-audio' });
}

// 5. Audio finishes late (2600 ms > 1800 ms, image shown 2600 ms >= 1000 ms): advance immediately
{
  const res = evaluateFeedbackAdvance({
    startedAtMs: 1000,
    imageShownAtMs: 1000,
    nowMs: 3600,
    audioEnded: true,
  });
  assert.deepEqual(res, { shouldAdvance: true, waitMs: 0, reason: 'ready' });
}

// 6. Image shown later (e.g. t=1200 ms) and audio finishes at 1800 ms: must wait until image has been visible 1000 ms (t=2200 ms)
{
  const res = evaluateFeedbackAdvance({
    startedAtMs: 1000,
    imageShownAtMs: 2200,
    nowMs: 2800,
    audioEnded: true,
  });
  assert.deepEqual(res, { shouldAdvance: false, waitMs: 400, reason: 'waiting-min-or-image' });
}

// 7. Audio never ends: at 4000 ms safety ceiling, advance unconditionally
{
  const res = evaluateFeedbackAdvance({
    startedAtMs: 1000,
    imageShownAtMs: 1000,
    nowMs: 5000,
    audioEnded: false,
  });
  assert.deepEqual(res, { shouldAdvance: true, waitMs: 0, reason: 'max-timeout' });
}

// 8. Beyond safety ceiling even if imageMs would exceed maxMs: maxMs wins
{
  const res = evaluateFeedbackAdvance({
    startedAtMs: 1000,
    imageShownAtMs: 4500,
    nowMs: 5000,
    audioEnded: true,
    minMs: 1800,
    imageMs: 1000,
    maxMs: 4000,
  });
  assert.deepEqual(res, { shouldAdvance: true, waitMs: 0, reason: 'max-timeout' });
}

// 9. Custom constants are respected (e.g. imageMs > minMs)
{
  const res = evaluateFeedbackAdvance({
    startedAtMs: 0,
    imageShownAtMs: 0,
    nowMs: 1800,
    audioEnded: true,
    minMs: 1800,
    imageMs: 2500,
    maxMs: 5000,
  });
  assert.deepEqual(res, { shouldAdvance: false, waitMs: 700, reason: 'waiting-min-or-image' });
}

console.log('PASS: quizFeedback timing logic (9/9 assertions)');
