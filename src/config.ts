import type { UmamiAnalytics, MatomoAnalytics } from '@/lib/analytics';

// Site-wide config. Owner-supplied values land here (T1 open questions OQ-1/OQ-2).
// TODO(OQ-1): replace email + suburb with the studio's real details when supplied.
export const SITE = {
  name: 'EM Fine Studio',
  tagline: 'EM Fine Studio — Australian design, crafted with experience and care.',
  email: 'info@emfinestudio.com',
  phone: '1300 317 906',
  web: 'www.emfinestudio.com',
  address: 'Suite 1006, 250 Pitt Street, Sydney NSW 2000',
  // OQ-2 default: no social links.
  social: null as null | string,
} as const;

// Web analytics (EMF-24) — Umami + Matomo.
//
// Feature split so enabling several never duplicates a signal:
//   Umami   -> cookieless pageviews (its strength, DNT-friendly).
//   Matomo  -> self-hosted page + event analytics, LIVE on every build. The box
//              is publicly reachable via the Cloudflare tunnel
//              matomo.eywalink.org (like the Umami tunnel), so the tracker
//              ships to public visitors and LAN builds alike.
//
// Build-time gate (LAN-only Umami host):
//   The local Umami box is reachable ONLY on the owner's LAN, so the LAN
//   flavor (MATOMO_LAN=1 build) points Umami at the LAN host instead of the
//   public tunnel. `build:lan` sets MATOMO_LAN=1.
//   Umami owns all pageview signals in every build; Matomo adds a
//   self-hosted second pageview/event stream in every build (accepted: two
//   providers, both reading the same visits — no conversion duplication,
//   because conversions are single-owner via trackConversion).
//
//   Each flavor is a Vite `define` literal (`__MATOMO_LAN__`)
//   baked in at build time: astro.config.mjs reads the real `process.env`
//   (it runs in Node) and Vite inlines the result into every bundle. This is
//   deterministic and does NOT depend on process.env surviving Vite's
//   client/SSR env shims. `declare const` is only for the type-checker; Vite
//   replaces the identifier with the build-time literal in the emitted code.
declare const __MATOMO_LAN__: boolean;
const matomoLan = __MATOMO_LAN__;
// A "local build" is one where the LAN flavor is on. In a local build the
// page is viewed over http on the LAN, so Umami targets the LAN host (no mixed
// content) and the self-hosted providers are reachable.
const localBuild = matomoLan;

export const ANALYTICS: {
  umami: UmamiAnalytics;
  matomo: MatomoAnalytics;
} = {
  umami: {
    // LIVE (task 4.1): self-hosted Umami on the Pop!_OS box, exposed publicly via
    // the cloudflared tunnel umami.eywalink.org -> nginx gateway :3080 (analytics
    // surface only: /script.js + /api/send). Emits the cookieless pageview embed.
    // Owns pageviews on every build, and conversions when Matomo is absent.
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
    //   LAN build (localBuild)  -> the local Umami on the office box directly.
    //       LAN viewing is http-only, so no mixed-content issue, and `pop-os`
    //       resolves on the office network.
    host: localBuild ? 'http://pop-os:3102' : 'https://umami.eywalink.org',
    // Subresource-Integrity pin for `${host}/script.js` (harden-site-security). Computed
    // with `node scripts/umami-integrity.mjs` (public host, 2026-09-11). Until set to a
    // real value the embed is suppressed (never ship an un-pinned script). Recompute on
    // every Umami upgrade; for the LAN build recompute with UMAMI_HOST=http://pop-os:3102
    // if that host serves a different script.
    integrity: 'sha384-FeSgFWhRpNmUWqmtRLZpDSRTuxgovbVqlyM0OaJpq2IanhF2u3xjYziXsyXR9Kg/',
  },
  matomo: {
    // LIVE on every build: self-hosted Matomo 5.13.0 box (project
    // `matomo-src`, Docker `matomo` container, PHP 8.2 FPM + nginx) exposed
    // publicly via the Cloudflare tunnel `matomo.eywalink.org` → container
    // port 3104 — the same public-tunnel pattern as Umami. `enabled` is true
    // unconditionally. No mixed-content issue: the tunnel is HTTPS.
    enabled: true,
    // Matomo site ID (Administration → Websites) for emfinestudio.com.
    // Site 3, created 2026-09-20 in the running box (sites 1 = eywalink.org,
    // 2 = terrygzhou.github.io).
    siteId: '3',
    // Public base URL of the Matomo box (no trailing slash). The embed script
    // is fetched from `${host}/matomo.js` by the visitor's browser, so it
    // MUST be reachable from where the page is viewed — the Cloudflare tunnel
    // is the public HTTPS endpoint (like Umami's umami.eywalink.org).
    host: 'https://matomo.eywalink.org',
  },
};

// Convenience export so a build script / worker can assert the flavor.
export const ANALYTICS_FLAVOR: 'public' | 'lan' = localBuild ? 'lan' : 'public';
