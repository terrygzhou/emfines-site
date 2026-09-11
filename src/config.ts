import type { UmamiAnalytics, PostHogAnalytics } from '@/lib/analytics';

// Site-wide config. Owner-supplied values land here (T1 open questions OQ-1/OQ-2).
// TODO(OQ-1): replace email + suburb with the studio's real details when supplied.
export const SITE = {
  name: 'EM Fine Studio',
  tagline: 'EM Fine Studio — Australian design, crafted with experience and care.',
  // OQ-1 default: email-only contact block + suburb placeholder. No phone, no socials.
  email: 'studio@emfines.com.au',
  suburb: 'Box Hill South, VIC',
  // OQ-2 default: no social links.
  social: null as null | string,
} as const;

// Web analytics (EMF-24) — Umami + PostHog.
//
// Feature split so enabling BOTH never duplicates a signal:
//   Umami   -> cookieless pageviews (its strength, DNT-friendly) AND public conversions.
//   PostHog -> conversion events + pageviews in the LAN build (local dashboard =
//               complete local web-analytics view); public builds ship no PostHog tag.
//
// Build-time gate (LAN-only PostHog):
//   The self-hosted PostHog instance lives at posthog.local on the owner's LAN
//   (self-signed TLS) and is NOT reachable from public visitors. PostHog is
//   therefore enabled ONLY when a build is made with `POSTHOG_LAN=1`:
//       public (default): npm run build            -> posthog.enabled = false
//       LAN / local:      POSTHOG_LAN=1 npm run build -> posthog.enabled = true
//   The public build keeps Umami owning all signals, so there is no duplication and
//   no broken pings to an unreachable host.
//
//   The flavor is a Vite `define` literal (`__POSTHOG_LAN__`) baked in at build
//   time: astro.config.mjs reads the real `process.env.POSTHOG_LAN` (it runs in
//   Node) and Vite inlines the result into every bundle. This is deterministic
//   and does NOT depend on process.env surviving Vite's client/SSR env shims.
//   `declare const` is only for the type-checker; Vite replaces the identifier
//   with the build-time literal in the emitted code.
declare const __POSTHOG_LAN__: boolean;
const posthogLan = __POSTHOG_LAN__;

export const ANALYTICS: { umami: UmamiAnalytics; posthog: PostHogAnalytics } = {
  umami: {
    // LIVE (task 4.1): self-hosted Umami on the Pop!_OS box, exposed publicly via
    // the cloudflared tunnel umami.eywalink.org -> nginx gateway :3080 (analytics
    // surface only: /script.js + /api/send). Emits the cookieless pageview embed.
    // Owns pageviews on every build, and conversions on the public build (where
    // PostHog is off) — no signal is counted by two providers.
    enabled: true,
    // Website ID for emfinestudio.com in the local Umami (created 2026-09-10).
    websiteId: '0995457f-98e2-45dc-ae74-c7011543bdee',
    // Umami server base URL (no trailing slash). The embed script is fetched
    // from `${host}/script.js` by the visitor's browser, so it MUST be reachable
    // from where the page is viewed:
    //   public build (default)  -> the Cloudflare tunnel (HTTPS + internet-
    //       reachable). A plain `http://` LAN URL would be (a) blocked as mixed
    //       content on the HTTPS production page and (b) unresolvable off-LAN,
    //       silently killing analytics for real visitors.
    //   LAN build (POSTHOG_LAN=1) -> the local Umami on the office box directly.
    //       LAN viewing is http-only, so no mixed-content issue, and `pop-os`
    //       resolves on the office network.
    host: posthogLan ? 'http://pop-os:3102' : 'https://umami.eywalink.org',
    // Subresource-Integrity pin for `${host}/script.js` (harden-site-security). Computed
    // with `node scripts/umami-integrity.mjs` (public host, 2026-09-11). Until set to a
    // real value the embed is suppressed (never ship an un-pinned script). Recompute on
    // every Umami upgrade; for the LAN build recompute with UMAMI_HOST=http://pop-os:3102
    // if that host serves a different script.
    integrity: 'sha384-FeSgFWhRpNmUWqmtRLZpDSRTuxgovbVqlyM0OaJpq2IanhF2u3xjYziXsyXR9Kg/',
  },
  posthog: {
    // LAN-ONLY: enabled only for `POSTHOG_LAN=1` builds (see gate above). The
    // default/public build leaves this false, so no PostHog tag ships publicly
    // and Umami owns conversions there (no duplication).
    enabled: posthogLan,
    // Project API key for the self-hosted instance's "emfinestudio" project
    // (org "EM Fine Studio", project id 1, created 2026-09-10).
    // Self-hosted/LAN credential — only ever shipped in a LAN build (enabled),
    // never in the public build (enabled=false → no tag emitted).
    apiKey: 'phc_kimpZemZ3utpyBgUeze8VYH2GL3gZL2UG6xVr28WWxJA',
    // Base URL of the self-hosted PostHog instance (LAN only).
    host: 'https://posthog.local',
    // LAN flavor: pageviews ON, so the owner's local PostHog dashboard is a
    // complete local web-analytics view (pageviews + events). Public builds
    // ship no PostHog tag at all (enabled=false), so no public duplication.
    // Umami still records pageviews in both flavors for the shared funnels —
    // operators read one dashboard per signal, never both.
    capturePageview: posthogLan,
    capturePageLeave: false,
  },
};

// Convenience export so a build script / worker can assert the flavor.
export const ANALYTICS_FLAVOR: 'public' | 'lan' = posthogLan ? 'lan' : 'public';
