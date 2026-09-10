# Design: add-web-analytics

## Context
The site already ships a config-driven analytics layer (shipped in `386aa47`):
`src/lib/analytics.ts` (pure helpers), `src/config.ts` `ANALYTICS` block,
`src/components/Analytics.astro` rendered into `<head>` via `Base.astro`, and
conversion firing from the two form success handlers. This change contracts
that behaviour as a testable requirement and records the intended deployment:
the owner will run **Umami + PostHog self-hosted on Pop!_OS** and point the
site at them. No new code path is introduced — the design fixes *how* the
requirement is met and where the open owner-input lands.

## Goals / Non-Goals
**Goals:** default-off; independent providers; owner-supplied (self-hosted)
host; no PII + DNT; conversion-on-durable-success; no-op-safe; free-tier /
static-only.
**Non-Goals:** server-side event pipeline, a reporting / funnel UI, PII
capture, or any permanent analytics DB (constitution I/II).

## Decisions
- **Pure, config-gated helpers in `src/lib/analytics.ts`, unit-tested via the
  esbuild-bundle harness** — embed builders return `null` unless
  `enabled` AND the credential is real (non-placeholder). Keeps the build a
  clean no-op until the owner enables a provider (constitution VI test-first;
  V degrade gracefully).
- **Render only configured providers** from `Analytics.astro` into `<head>` —
  with the default config, literally no analytics bytes ship (constitution I
  static-first; II PII-free).
- **Owner-supplied `host` per provider** (Umami + PostHog), with the vendor
  cloud as the fallback default. This is what makes a self-hosted Pop!_OS
  deployment first-class: the owner sets `umami.host` / `posthog.host` to the
  Pop!_OS base URLs and flips `enabled`.
- **No-PII + Umami `data-do-not-track`** — pageviews carry path + referrer
  only; the design / contact conversion events carry an anonymous `kind`
  (and `emailDelivered` boolean, not the address). Upholds constitution II.
- **Conversion fired only after durable server success**, and
  `trackConversion` is **no-op-safe** (optional-chained, never throws when a
  SDK is absent/late). Analytics can't break the enquiry write path —
  constitution V.
- **Single-owner feature split (no duplication):** when both providers are
  active, Umami owns cookieless pageviews and PostHog owns conversion events
  only — PostHog `capturePageview`/`capturePageLeave` default OFF, and
  `trackConversion` fires to at most one provider (PostHog preferred, Umami as
  the Umami-only fallback). This stops the same engagement being counted in two
  dashboards (spec: "Analytics features are not duplicated across providers").
- **Keys are public client-side identifiers, held in committed config**, not
  wrangler secrets — matches how these providers are designed; no secret
  round-trip (constitution I free-tier; keeps deploy simple).
  - *Rejected:* storing keys as wrangler secrets — they are public
    client-side keys, so a secret adds no protection and complicates the
    owner's enablement.
  - *Rejected:* hard-coding the vendor cloud host — would block the owner's
    intended self-hosted Pop!_OS deployment.
- **PostHog is LAN-gated via a build-time flavor, not a runtime env read.**
  The self-hosted PostHog instance (`posthog.local`, self-signed TLS, no public
  DNS) is unreachable from public visitors, so the public build must ship no
  PostHog embed. `astro.config.mjs` (which runs in real Node) reads
  `process.env.POSTHOG_LAN` and bakes it into every bundle as a Vite `define`
  literal `__POSTHOG_LAN__`; `src/config.ts` sets `posthog.enabled =
  __POSTHOG_LAN__`. `npm run build` (public) → false; `POSTHOG_LAN=1 npm run
  build` / `npm run build:lan` (LAN) → true. This keeps Umami active in both
  flavors (pageviews always captured) and turns PostHog on only for LAN.
  - *Rejected:* reading `process.env.POSTHOG_LAN` directly inside
    `src/config.ts` — Vite compiles that module and shims `process`/
    `process.env` to `{}` in the client/SSR targets, so the read is unreliable
    and a `POSTHOG_LAN=1` build did NOT emit the embed. Baking the value in
    `astro.config.mjs` via `define` is deterministic.

## Risks / Trade-offs
- [Self-hosted instances go down / misconfigured] → analytics is optional and
  no-op-safe; the site + durable enquiry path are unaffected (V).
- [Placeholder detection is heuristic] → a real credential that literally
  contains a marker (`YOUR_`, `TODO`, `< >`, …) would be treated as unset;
  accepted because website IDs / API keys don't contain those.
- [Both providers enabled] → pageviews + conversions would be double-counted;
  mitigated by the single-owner split (Umami=pageviews, PostHog=conversions;
  PostHog pageview capture OFF; a conversion fires to one provider only).
  Operators must still not compare raw pageview totals to conversion totals.
  - [LAN flavor accidentally deployed to the public worker] → the PostHog embed
    would ship publicly and ping the unreachable LAN host. Mitigated by the
    default public build always baking `__POSTHOG_LAN__ = false`; only the
    explicit `build:lan` flavor enables it, and `dist/` is never committed.
- [Cross-border data (cloud)] → the owner's self-hosted Pop!_OS deployment
  keeps data on their own infra; for EU traffic prefer the EU PostHog host or
  self-hosted (residency).

## Migration Plan
Config-only, no migration: owner supplies the Pop!_OS base URLs, sets
`umami.enabled` / `posthog.enabled` true, `npm run build` (escalated) +
`wrangler deploy`. Rollback = set `enabled` false (rebuild). Nothing durable
changes.

## Open Questions
- **Pop!_OS instance base URLs for Umami and PostHog** (e.g.
  `https://umami.<host>` / `https://posthog.<host>`) — owner-supplied; do not
  block the spec, only the owner's enablement step. Recorded in tasks as an
  open config task.
