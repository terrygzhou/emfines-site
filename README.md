# emfines-site

Official website of **EM Fine Studio** — a static Astro site plus one server
enquiry endpoint, deployed to Cloudflare Workers (stable URL, free tier).

## Tech stack

| Concern | Choice |
|---|---|
| Framework | [Astro 7](https://astro.build), `output: 'server'` (5 prerendered pages + 1 server endpoint) |
| Runtime | Cloudflare Workers via [`@astrojs/cloudflare`](https://docs.astro.build/en/guides/integrations-guide/cloudflare/) (v14), free tier |
| Styling | [Tailwind CSS v4](https://tailwindcss.com) (`@tailwindcss/vite`, theme tokens in `src/styles/global.css`) |
| Language | TypeScript |
| Enquiry sink | Cloudflare KV `emfines_enquiries`, 30-day TTL per key (expiring archive, no permanent PII) |
| Email | [Cloudflare Email Service](https://developers.cloudflare.com/email-service/) (free 10k/mo) via `node:mail` |

Design language: `examples/01-classic-luxe` (quiet-luxury, serif display, one accent).
Feature spec: `plan/EMF-2-T1-Site-Feature-Spec.md`.

## Routes

`/` · `/design` (custom-design enquiry form) · `/repairs` · `/pieces` · `/contact`
Server endpoint: `POST /api/enquiries` (the single online feature).

## Development

```bash
npm install
npm run dev        # astro dev (pages + endpoint)
npm test           # unit tests for the pure logic: enquiry validation + analytics embeds
npm run check      # astro check (type + template diagnostics)
```

### Runtime smoke test (local, prod-parity)

```bash
npm run build      # emits dist/ + the deploy-time wrangler config (dist/server/wrangler.json)
npm run preview    # wrangler dev against the built worker (local KV + assets, email no-ops)
```

Then exercise the endpoint — e.g.:

```bash
curl -s -X POST http://localhost:8787/api/enquiries \
  -H 'Content-Type: application/json' \
  -d '{"kind":"design","name":"Jane","email":"jane@example.com","pieceType":"Ring","metals":["Solid gold"],"brief":"At least forty characters of brief here, yes, it continues.","contactPref":"Email","consent":true}'
# -> 200 {"ok":true,"emailDelivered":false}   (archived to KV; email skips when unconfigured)
```

## Deploy

```bash
npm run deploy     # build + wrangler deploy (uses the adapter-generated dist/server/wrangler.json)
```

Deploys to the stable URL `https://emfines-site.terry-g-zhou.workers.dev` (free tier).
**Only deploy on explicit request.**

## Configuration

- **KV namespace** `emfines_enquiries` (id in `wrangler.jsonc`). Each enquiry is written with a
  30-day TTL — it is an expiring archive, not a permanent store.
- **Email secrets** (Cloudflare Email Service) — set per account, **never committed**:

  ```bash
  wrangler secret put ENQUIRY_TO    # studio inbox address
  wrangler secret put ENQUIRY_FROM  # verified Email Service sender (optional)
  wrangler secret put BREVO_API_KEY # optional: Brevo SMTP (free 300 emails/day)
  wrangler secret put BREVO_FROM    # optional: verified Brevo sender domain
  ```

  Until `ENQUIRY_TO` is set the endpoint runs in **archive-only mode**: the brief is still
  written to KV, it returns `emailDelivered: false`, and the form shows a fallback "email us
  directly" message. Missing `node:mail` in a runtime degrades the same way (never a 500).

- **Site values** (`src/config.ts`) — still on owner placeholders (open question OQ-1):
  `studio@emfines.com.au` + "Box Hill South, VIC". Replace with the studio's real details
  when supplied. Logos are out of scope (the site uses the "EM Fine Studio" serif wordmark).

## Web analytics (Umami + PostHog + Matomo)

The site ships an optional, config-driven analytics layer
(`src/components/Analytics.astro` → `src/lib/analytics.ts`, config in
`src/config.ts`). Three providers are supported, each independently on/off:

| Provider | What it does | Enable when |
|---|---|---|
| **Umami** | Lightweight, cookieless, GDPR-friendly page analytics | you want minimal, privacy-first pageviews |
| **PostHog** | Pageviews + custom event capture (incl. enquiry submissions) | you want funnels/event product analytics |
| **Matomo** | Self-hosted (Docker) page + event analytics; a fully local dashboard | you want a self-hosted, LAN-local analytics view |

**Default is off.** With the placeholder config, the build emits no analytics
pings. To activate a provider you set its real key in `src/config.ts` and flip
`enabled` to `true`:

```ts
export const ANALYTICS = {
  umami:   { enabled: true, websiteId: '<Umami Website ID>', host: 'https://cloud.umami.is' },
  posthog: { enabled: true, apiKey: 'phc_<project api key>', host: 'https://us.posthog.com' },
  matomo:  { enabled: true, siteId: '<Matomo site ID>', host: 'http://matomo.local:8080' }, // LAN-only
};
```

- **Umami:** create/verify your site in [Umami](https://umami.is) (Cloud, or
  self-host — set `host` to your instance URL) → copy the **Website ID** →
  paste into `umami.websiteId`. The embed sets `data-do-not-track` so it skips
  visitors who send Do Not Track.
- **PostHog:** create a project in [PostHog](https://posthog.com) → copy the
  **Project API key** (`phc_…`) → paste into `posthog.apiKey`. Keep `host`
  matching the project's data region (`https://us.posthog.com` or
  `https://eu.posthog.com`).
- **Matomo:** run the local box with `docker compose` in `docker/matomo/`
  (self-hosted, LAN-only) → note the **website ID** (Administration →
  Websites) → paste into `matomo.siteId`; set `matomo.host` to the box base
  URL (no trailing slash). Matomo only ships in a LAN build
  (`MATOMO_LAN=1`), so the public site never pings the local box.

Neither value is a secret (both are public, client-side keys), so they live in
the committed config — no wrangler secret needed. No PII is sent: only page
paths, referrers, and the anonymous `design_enquiry_submitted` /
`contact_enquiry_submitted` events fired from the enquiry-form success
handlers.

## Security posture

Security hardening from the `harden-site-security` change (the dated audit
snapshot is `reports/security-review.md`).

- **Bounded input** — every enquiry field has a server-side maximum
  (`src/lib/enquiry.ts`); over-long values are rejected with a per-field error.
  The form `maxlength`s mirror the same numbers for UX only — the server is the
  authority (never trust the client).
- **Photo content validation** — photo attachments must be genuine base64 whose
  decoded bytes carry the declared type's magic bytes (JPEG / PNG / WebP), not
  just any base64 blob under the 5 MB cap.
- **Rate limiting (worker-side)** — one short-lived KV counter per client IP
  per 5-minute window; more than 10 requests get `429` + `Retry-After` and are
  neither archived nor emailed. Zone-level rate-limit rules are a paid feature,
  so the limiter lives in the worker (free-tier only); a KV failure fails open
  (logged) and never breaks the durable write path.
- **No CORS** — the enquiry forms are same-origin; there is no CORS preflight
  (`OPTIONS` answers 405), so cross-origin scripted JSON posts fail the
  preflight rather than hitting the endpoint.
- **Email sender hygiene** — email is sent only from a verified sender
  (`BREVO_FROM` / `ENQUIRY_FROM`). When neither is set the channel is skipped
  (**archive-only** — the brief is still written to KV) instead of defaulting to
  the `.workers.dev` hostname, which would disclose the account name.
- **Umami subresource integrity** — the Umami `<script>` ships with
  `integrity` + `crossorigin`; when no real SRI hash is configured the embed is
  suppressed, so an un-pinned third-party script is never loaded. Recompute the
  hash with `node scripts/umami-integrity.mjs` after any Umami upgrade.
- **Response headers (Cloudflare zone, not code)** — the zone should serve
  `X-Content-Type-Options: nosniff`, `Referrer-Policy:
  strict-origin-when-cross-origin`, `X-Frame-Options: DENY`,
  `Permissions-Policy: camera=(), geolocation=(), microphone=()`, and HSTS
  (`max-age=63072000; includeSubDomains`). These are Transform Rules + SSL/TLS
  settings (owner console steps, tasks 7.1–7.2), verified on `GET /`.

**Secrets never in git** (Constitution: free-tier / no committed secrets). The
email credentials are wrangler secrets, set out-of-band:

```bash
wrangler secret put ENQUIRY_TO    # studio inbox address
wrangler secret put ENQUIRY_FROM  # verified Email Service sender
wrangler secret put BREVO_API_KEY # optional Brevo SMTP
wrangler secret put BREVO_FROM    # optional verified Brevo sender domain
```

## Repo layout

- `src/pages/` — the 5 routes + `api/enquiries.ts` (server endpoint, `prerender = false`)
- `src/components/`, `src/layouts/` — shared shell + the enquiry form
- `src/lib/enquiry.ts` — pure validation + email composition (unit-tested in `tests/`)
- `src/lib/analytics.ts` — pure analytics helpers (embed tags + conversion events, unit-tested in `tests/analytics.test.mjs`)
- `docker/matomo/` — self-hosted Matomo in Docker (LAN-local analytics box; see its README)
- `src/scripts/` — client form behaviour (client-side validation mirrors the server rules)
- `public/assets/` — original imagery (gitignored; referenced as `/assets/<name>`)
- `examples/`, `plan/` — design samples and the working spec docs
