// Web analytics (EMF-24) — pure, unit-testable helpers that render the
// provider embed scripts and fire conversion events.
//
// Two providers are supported, each independently on/off:
//   - Umami:  lightweight, cookieless, GDPR-friendly page analytics.
//   - Matomo: self-hosted, Docker-deployed page + event analytics (LAN/local).
//
// Both/each gate on `enabled` AND a real (non-placeholder) credential, so the
// repo builds green and ships no broken/analytics pings until the owner pastes
// in credentials and flips `enabled` to true.
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
  /**
   * Subresource-integrity hash of `${host}/script.js` (e.g. `sha384-...`,
   * produced by `scripts/umami-integrity.mjs`). The embed is ONLY emitted when
   * this is a real, non-placeholder value, so we never ship the Umami script
   * without pinning it (harden-site-security). Recompute on every Umami
   * upgrade - a stale hash makes the browser refuse to load the script.
   */
  integrity?: string;
}

export interface MatomoAnalytics {
  /** Owner toggles this once a self-hosted Matomo box (local Docker) is reachable. */
  enabled: boolean;
  /** Matomo → Administration → Websites → "Website ID" (a numeric ID, e.g. `1`). */
  siteId: string;
  /** Self-hosted Matomo base URL (no trailing slash), e.g. `http://matomo.local`. */
  host: string;
}

export interface AnalyticsConfig {
  umami?: UmamiAnalytics;
  matomo?: MatomoAnalytics;
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
  // Ship the script ONLY with a real Subresource-Integrity pin, so an
  // unverified third-party script is never loaded (missing/placeholder
  // integrity -> no tag, per harden-site-security).
  if (!cfg?.enabled || !isConfigured(cfg.websiteId) || !isConfigured(cfg.integrity)) return null;
  const host = (cfg.host || 'https://cloud.umami.is').replace(/\/+$/, '');
  return `<script defer src="${host}/script.js" data-website-id="${cfg.websiteId.trim()}" data-do-not-track integrity="${cfg.integrity!.trim()}" crossorigin="anonymous"></script>`;
}

/**
 * Active self-hosted Matomo embed `<script>` tag, or `null` when not
 * configured. Uses Matomo's classic self-hosted `matomo.js` tracker (fetched
 * from the owner's Matomo box, never an external CDN) so a LAN/local deploy
 * works offline. The tracker auto-records the initial pageview on load and
 * exposes `window._paq` for custom events (fired from the success handlers
 * below via `trackEvent` / `trackConversion`).
 *
 * Like Umami, the embed is only emitted when every credential is a real,
 * non-placeholder value — Matomo always needs a self-hosted `host`, so an
 * empty host suppresses the tag (no broken pings to an unreachable host).
 */
export function matomoScriptTag(cfg: MatomoAnalytics | undefined): string | null {
  if (!cfg?.enabled || !isConfigured(cfg.siteId) || !isConfigured(cfg.host)) return null;
  const base = (cfg.host || '').replace(/\/+$/, '');
  const root = base.replace(/\/+$/, '');
  return [
    `<script>`,
    `  window._paq = window._paq || [];`,
    `  (function () {`,
    `    var u = ${JSON.stringify(`${root}/`)};`,
    `    window._paq.push(['setTrackerUrl', u + 'matomo.php']);`,
    `    window._paq.push(['setSiteId', ${JSON.stringify(cfg.siteId.trim())}]);`,
    `    window._paq.push(['enableLinkTracking']);`,
    `    var d = document, g = d.createElement('script'), s = d.getElementsByTagName('script')[0];`,
    `    g.async = true; g.type = 'text/javascript';`,
    `    g.src = u + 'matomo.js';`,
    `    s.parentNode.insertBefore(g, s);`,
    `  })();`,
    `</script>`,
  ].join('\n');
}

/**
 * Fire a conversion event on exactly ONE provider so enabling several never
 * double-counts a conversion. Deterministic single-owner priority:
 *   Matomo -> Umami.
 * Matomo (self-hosted, live on every build) is the preferred event tool;
 * Umami is the owner for a Umami-only deploy.
 * No-op-safe: never throws when the SDK is absent or late. Call from form
 * success handlers.
 */
export function trackConversion(event: string, properties?: Record<string, unknown>): void {
  const g = globalThis as unknown as {
    umami?: { track?: (ev: string, p?: Record<string, unknown>) => void };
    _paq?: unknown[];
  };
  // Single-owner priority: Matomo preferred, then Umami — the
  // first present provider owns the event so the same conversion is never
  // captured twice.
  if (Array.isArray(g._paq)) {
    g._paq!.push(['trackEvent', 'enquiry', event, JSON.stringify(properties ?? {}), 1]);
    return; // single-owner: never also fire to Umami (no duplication)
  }
  g.umami?.track?.(event, properties); // fallback for a Umami-only deployment
}

/**
 * Fire a named custom event on the active provider (Matomo > Umami).
 * Use this for funnel mid-steps — e.g. form scroll-into-view, budget selected —
 * so a dashboard's funnel report (type="funnel") can track the journey.
 * No-op-safe, same single-owner contract as trackConversion.
 */
export function trackEvent(name: string, properties?: Record<string, unknown>): void {
  trackConversion(name, properties);
}

/** Whether at least one provider would actually emit (used for guardrails). */
export function anyAnalyticsActive(cfg: AnalyticsConfig = {}): boolean {
  return (
    umamiScriptTag(cfg.umami) !== null ||
    matomoScriptTag(cfg.matomo) !== null
  );
}
