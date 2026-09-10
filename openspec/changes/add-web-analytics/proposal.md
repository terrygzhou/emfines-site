# Proposal: add-web-analytics

## Why
The studio has no way to know which pages visitors read or how many design /
contact enquiries convert. The owner wants lightweight, privacy-first web
analytics — **Umami** for cookieless pageviews and **PostHog** for event /
conversion capture — and intends to run both **self-hosted** (owner's
Pop!_OS instances) rather than relying only on the vendor clouds. This
formalises the requirement so the behaviour is a testable contract.

## What Changes
- A new optional, **config-driven analytics capability** with two
  independently-enabled providers: Umami and PostHog.
- **Off by default:** with placeholder / unset credentials the build ships
  **no analytics pings at all** — the site stays clean and no broken embeds
  are emitted.
- **Self-hosted / custom-host support:** each provider targets an
  owner-supplied base URL (a self-hosted deployment, e.g. a Pop!_OS box)
  instead of being hard-wired to the vendor cloud.
- **LAN-gated PostHog (no duplication):** Umami is active in every build
  (cookieless pageviews + public conversions). PostHog — which owns conversion
  events — is emitted **only in an explicitly-requested LAN/local build**
  (`POSTHOG_LAN=1 npm run build` / `npm run build:lan`), because the
  self-hosted PostHog instance (`posthog.local`) is reachable only on the
  owner's LAN. The public build ships no PostHog embed, so no visitor pings an
  unreachable host and no signal is double-counted across the two dashboards.
- **Privacy-first:** no PII is ever sent — only page paths, referrers, and
  anonymous conversion events; the Umami embed honours Do-Not-Track.
- **Conversion events fire only after the enquiry is durably stored**
  (design + contact forms), and firing is no-op-safe — analytics can never
  fail or block the durable write path.
- Provider keys are public client-side identifiers, held in committed config,
  not as wrangler secrets.

**Non-goals:** no paid analytics tooling / no data warehouse, no server-side
event pipeline, no A/B or funnel *reporting* UI, no PII capture, no change to
the enquiry storage model (constitution I/II).

## Capabilities

### New Capabilities
- `web-analytics`: optional, config-driven Umami + PostHog page + conversion
  analytics; default-off, self-hostable (owner-supplied host), privacy-first,
  and never blocks the durable enquiry write path.

### Modified Capabilities
- None. (No existing spec-level requirement changes; the enquiry /
  gallery / brand behaviours are untouched.)

## Impact
- `src/lib/analytics.ts` (pure helpers: embed builders, placeholder detection,
  no-op-safe `trackConversion`) — already shipped in `386aa47`, now
  requirement-contracted by this spec.
- `astro.config.mjs` — bakes the LAN flavor in as a Vite `define` literal
  (`__POSTHOG_LAN__` read from `process.env.POSTHOG_LAN` at build time);
  `package.json` gains a `build:lan` script.
- `src/config.ts` — `ANALYTICS` block (Umami + PostHog, default off).
- `src/components/Analytics.astro` + `src/layouts/Base.astro` — renders only
  configured providers into `<head>`.
- `src/scripts/enquiry-form.ts`, `src/scripts/contact-form.ts` — fire
  conversion events on durable-success.
- `tests/analytics.test.mjs` + `package.json` `pretest` — unit-test the pure
  helpers.
- No new endpoint, dependency, KV, or paid tooling; free-tier / static only
  (constitution I). Owner action to activate: supply self-hosted Pop!_OS base
  URLs + flip `enabled` (config-only, no code change).
