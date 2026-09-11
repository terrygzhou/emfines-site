// Pure, unit-testable worker-side rate-limit decision logic.
//
// The endpoint (src/pages/api/enquiries.ts) stores one short-lived KV counter
// per (client IP, 5-minute window). The KV get gives a raw count; the two
// functions here are the ONLY rate-limit logic and are pure so they can be
// unit-tested without a KV binding (Constitution VI). The counter write, TTL
// and fail-open handling live in the endpoint.

/** Maximum number of enquiries a single client IP may submit per window. */
export const RATE_LIMIT_PER_WINDOW = 10;

/** Rate-limit window length: 5 minutes. */
export const RATE_WINDOW_MS = 300_000;

export interface RateDecision {
  /** True when the request is within the budget for this window. */
  allowed: boolean;
  /** The counter value to write back to KV for this window (previous + 1). */
  nextCount: number;
  /** Absolute epoch-ms start of the current window (used as the KV key part). */
  windowStart: number;
  /**
   * Whole seconds until the current window rolls over — the value to put in a
   * `Retry-After` header for a denied request (always >= 1).
   */
  retryAfterSec: number;
}

/**
 * The start (epoch ms) of the 5-minute window containing `nowMs`. Windows are
 * aligned to absolute multiples of the window length, so a client that bursts
 * across a boundary automatically gets a fresh budget in the new window.
 */
export function rateWindowStartMs(nowMs: number): number {
  return Math.floor(nowMs / RATE_WINDOW_MS) * RATE_WINDOW_MS;
}

/**
 * Decide whether a request may proceed, given the number of requests already
 * counted in the current window (`counter`). The decision is pure: it does no
 * I/O and returns the value the caller must write back (`nextCount`) plus the
 * header hint for the throttled case.
 */
export function decideRateLimit(
  counter: number,
  nowMs: number,
  limit: number = RATE_LIMIT_PER_WINDOW,
): RateDecision {
  const c = Number.isFinite(counter) ? Math.max(0, Math.floor(counter)) : 0;
  const windowStart = rateWindowStartMs(nowMs);
  const allowed = c < limit;
  const nextCount = c + 1; // denied attempts are counted too, so a burst can't "slide"
  const msRemaining = windowStart + RATE_WINDOW_MS - nowMs;
  const retryAfterSec = Math.max(1, Math.ceil(msRemaining / 1000));
  return { allowed, nextCount, windowStart, retryAfterSec };
}
