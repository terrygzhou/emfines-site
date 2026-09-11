// Unit tests for the pure worker-side rate-limit decision logic. Run via
// `npm test` (pretest esbuild-bundles src/lib/ratelimit.ts to
// node_modules/.cache/ratelimit.mjs, matching the enquiry/gallery/analytics
// harness). Scenario: *Burst beyond the limit is throttled*.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RATE_LIMIT_PER_WINDOW,
  RATE_WINDOW_MS,
  rateWindowStartMs,
  decideRateLimit,
} from '../node_modules/.cache/ratelimit.mjs';

// --- constants -----------------------------------------------------------
test('window is 5 minutes and the limit is 10 requests per window', () => {
  assert.equal(RATE_WINDOW_MS, 300_000);
  assert.equal(RATE_LIMIT_PER_WINDOW, 10);
});

// --- rateWindowStartMs ---------------------------------------------------
test('window buckets are aligned to absolute 5-minute boundaries', () => {
  assert.equal(rateWindowStartMs(0), 0);
  assert.equal(rateWindowStartMs(299_999), 0); // just before the first rollover
  assert.equal(rateWindowStartMs(300_000), 300_000); // the rollover instant
  assert.equal(rateWindowStartMs(540_000), 300_000); // 4 min into the 2nd window
  assert.equal(rateWindowStartMs(600_000), 600_000); // a fresh, later window
});

// --- decideRateLimit: burst throttling ----------------------------------
test('the 10th request in a window is still allowed (limit is 10)', () => {
  // nowMs is 4 minutes into the window that started at 300000.
  const d = decideRateLimit(9, 540_000, RATE_LIMIT_PER_WINDOW);
  assert.equal(d.allowed, true);
  assert.equal(d.nextCount, 10); // the counter this request will write
  assert.equal(d.windowStart, 300_000);
  assert.ok(d.retryAfterSec >= 1);
});

test('the 11th request is denied with a retry-after hint', () => {
  // 4 minutes into the window -> 60 seconds of the window remain.
  const d = decideRateLimit(10, 540_000, RATE_LIMIT_PER_WINDOW);
  assert.equal(d.allowed, false);
  assert.equal(d.nextCount, 11); // attempts are still counted
  assert.equal(d.windowStart, 300_000);
  assert.equal(d.retryAfterSec, 60); // ceil(60_000ms / 1000)
});

test('retry-after is clamped to at least one second near the rollover', () => {
  // 1 millisecond before the window ends -> ceil(1 / 1000) would be 0, clamp to 1.
  const d = decideRateLimit(10, 599_999, RATE_LIMIT_PER_WINDOW);
  assert.equal(d.allowed, false);
  assert.equal(d.retryAfterSec, 1);
});

// --- window rollover resets --------------------------------------------
test('a fresh window with an empty counter is allowed again', () => {
  // Now we are at the start of the window that began at 600000; its counter is
  // zero (the previous window's 11+ requests were stored under a different KV
  // key and have not carried over).
  const d = decideRateLimit(0, 600_000, RATE_LIMIT_PER_WINDOW);
  assert.equal(d.allowed, true);
  assert.equal(d.nextCount, 1);
  assert.equal(d.windowStart, 600_000);
  assert.equal(d.retryAfterSec, 300); // a whole fresh window remains
});

// --- defaults + non-finite guards ---------------------------------------
test('limit defaults to RATE_LIMIT_PER_WINDOW when omitted', () => {
  assert.equal(decideRateLimit(5, 540_000).allowed, true); // 5 < 10
  assert.equal(decideRateLimit(10, 540_000).allowed, false); // 10 >= 10
});

test('a non-finite counter is treated as zero (never denies a fresh window)', () => {
  const d = decideRateLimit(NaN, 540_000, RATE_LIMIT_PER_WINDOW);
  assert.equal(d.allowed, true);
  assert.equal(d.nextCount, 1);
});
