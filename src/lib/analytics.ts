// Web analytics (EMF-24) — pure, unit-testable helpers that render the
// provider embed scripts and fire conversion events.
//
// Two providers are supported, each independently on/off:
//   - Umami:  lightweight, cookieless, GDPR-friendly page analytics.
//   - PostHog: product analytics with event capture (pageviews + custom events).
//
// Both gate on `enabled` AND a real (non-placeholder) key, so the repo builds
// green and ships no broken/analytics pings until the owner pastes in
// credentials and flips `enabled` to true.
//
// Privacy: Umami embeds use `data-do-not-track` (skip when the browser sends
// Do Not Track); no PII is ever sent — only page paths, referrers, and
// anonymous conversion events fired from the enquiry-form success handlers.

export interface UmamiAnalytics {
  /** Owner toggles this once `websiteId` is set to a real value. */
  enabled: boolean;
  /** Umami → Settings → Sites → copy the "Website ID" (a UUID). */
  websiteId: string;
  /** Umami Cloud default; or your self-hosted Umami base URL (no trailing slash). */
  host: string;
}

export interface PostHogAnalytics {
  /** Owner toggles this once `apiKey` is set to a real value. */
  enabled: boolean;
  /** PostHog → Settings → Project → "Project API key" (starts with `phc_`). */
  apiKey: string;
  /** US default; use `https://eu.posthog.com` for EU data residency. */
  host: string;
  /**
   * PostHog's role here is *conversion/event* capture. Pageviews are owned by
   * Umami, so pageview capture defaults OFF to avoid double-counting the same
   * engagement. A PostHog-only deployment can set this to true.
   */
  capturePageview?: boolean;
  /** Page-leave pings are page engagement too — owned by Umami — so default OFF. */
  capturePageLeave?: boolean;
}

export interface AnalyticsConfig {
  umami?: UmamiAnalytics;
  posthog?: PostHogAnalytics;
}

/** Markers that mean "the owner hasn't filled this in yet". */
const PLACEHOLDER_MARKERS = ['YOUR_', 'REPLACE', 'CHANGEME', 'TODO', '<', '>'];

/**
 * True when the value is a real, filled-in credential (not empty and not an
 * obvious placeholder like `YOUR_UMAMI_WEBSITE_ID` / `phc_REPLACE_ME`).
 */
export function isConfigured(value: string | undefined): boolean {
  const v = (value ?? '').trim();
  if (!v) return false;
  const upper = v.toUpperCase();
  return !PLACEHOLDER_MARKERS.some((m) => upper.includes(m.toUpperCase()));
}

/** Active Umami embed `<script>` tag, or `null` when not configured. */
export function umamiScriptTag(cfg: UmamiAnalytics | undefined): string | null {
  if (!cfg?.enabled || !isConfigured(cfg.websiteId)) return null;
  const host = (cfg.host || 'https://cloud.umami.is').replace(/\/+$/, '');
  return `<script defer src="${host}/script.js" data-website-id="${cfg.websiteId.trim()}" data-do-not-track></script>`;
}

/**
 * Active PostHog loader + init, or `null` when not configured.
 * Uses PostHog's lightweight `static.js` (deferred) and defers `ph.init`
 * to the window `load` event so the CDN script is guaranteed to have run.
 */
export function postHogScriptTag(cfg: PostHogAnalytics | undefined): string | null {
  if (!cfg?.enabled || !isConfigured(cfg.apiKey)) return null;
  const host = (cfg.host || 'https://us.posthog.com').replace(/\/+$/, '');
  // Events-only by default: Umami owns pageviews, so PostHog does not capture
  // them (or page-leaves) — otherwise enabling both double-counts engagement.
  const capturePageview = cfg.capturePageview ?? false;
  const capturePageLeave = cfg.capturePageLeave ?? false;
  return [
    `<script defer src="https://cdn.posthog.com/static.js"></script>`,
    `<script>`,
    `  window.addEventListener('load', function () {`,
    `    if (typeof window.ph === 'undefined') return;`,
    `    window.ph.init({`,
    `      apiKey: ${JSON.stringify(cfg.apiKey.trim())},`,
    `      apiHost: ${JSON.stringify(host)},`,
    `      capturePageview: ${capturePageview},`,
    `      capturePageLeave: ${capturePageLeave},`,
    `    });`,
    `  });`,
    `</script>`,
  ].join('\n');
}

/**
 * Fire a conversion event on exactly ONE provider so enabling both Umami and
 * PostHog never double-counts a conversion. PostHog is the event tool and the
 * preferred owner; Umami is the fallback only when no PostHog SDK is present
 * (a Umami-only deployment). No-op-safe: never throws when the SDK is absent
 * or late. Call from form success handlers.
 */
export function trackConversion(event: string, properties?: Record<string, unknown>): void {
  const g = globalThis as unknown as {
    umami?: { track?: (ev: string, p?: Record<string, unknown>) => void };
    ph?: { capture?: (ev: string, p?: Record<string, unknown>) => void };
  };
  if (typeof g.ph?.capture === 'function') {
    g.ph!.capture!(event, properties);
    return; // single-owner: never also fire to Umami (no duplication)
  }
  g.umami?.track?.(event, properties); // fallback for a Umami-only deployment
}

/**
 * Fire a named custom event on Umami (or PostHog if present). Use this for
 * funnel mid-steps — e.g. form scroll-into-view, budget selected — so Umami's
 * funnel report (type="funnel", step.type="event") can track the journey.
 * No-op-safe, same contract as trackConversion.
 */
export function trackEvent(name: string, properties?: Record<string, unknown>): void {
  trackConversion(name, properties);
}

/** Whether at least one provider would actually emit (used for guardrails). */
export function anyAnalyticsActive(cfg: AnalyticsConfig = {}): boolean {
  return umamiScriptTag(cfg.umami) !== null || postHogScriptTag(cfg.posthog) !== null;
}
