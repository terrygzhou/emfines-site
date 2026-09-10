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
  wrangler secret put ENQUIRY_FROM  # verified Email Service sender (optional; defaults to the worker hostname)
  ```

  Until `ENQUIRY_TO` is set the endpoint runs in **archive-only mode**: the brief is still
  written to KV, it returns `emailDelivered: false`, and the form shows a fallback "email us
  directly" message. Missing `node:mail` in a runtime degrades the same way (never a 500).

- **Site values** (`src/config.ts`) — still on owner placeholders (open question OQ-1):
  `studio@emfines.com.au` + "Box Hill South, VIC". Replace with the studio's real details
  when supplied. Logos are out of scope (the site uses the "EM Fine Studio" serif wordmark).

## Web analytics (Umami + PostHog)

The site ships an optional, config-driven analytics layer
(`src/components/Analytics.astro` → `src/lib/analytics.ts`, config in
`src/config.ts`). Two providers are supported, each independently on/off:

| Provider | What it does | Enable when |
|---|---|---|
| **Umami** | Lightweight, cookieless, GDPR-friendly page analytics | you want minimal, privacy-first pageviews |
| **PostHog** | Pageviews + custom event capture (incl. enquiry submissions) | you want funnels/event product analytics |

**Default is off.** With the placeholder config, the build emits no analytics
pings. To activate a provider you set its real key in `src/config.ts` and flip
`enabled` to `true`:

```ts
export const ANALYTICS = {
  umami:   { enabled: true, websiteId: '<Umami Website ID>', host: 'https://cloud.umami.is' },
  posthog: { enabled: true, apiKey: 'phc_<project api key>', host: 'https://us.posthog.com' },
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

Neither value is a secret (both are public, client-side keys), so they live in
the committed config — no wrangler secret needed. No PII is sent: only page
paths, referrers, and the anonymous `design_enquiry_submitted` /
`contact_enquiry_submitted` events fired from the enquiry-form success
handlers.

## Repo layout

- `src/pages/` — the 5 routes + `api/enquiries.ts` (server endpoint, `prerender = false`)
- `src/components/`, `src/layouts/` — shared shell + the enquiry form
- `src/lib/enquiry.ts` — pure validation + email composition (unit-tested in `tests/`)
- `src/lib/analytics.ts` — pure analytics helpers (embed tags + conversion events, unit-tested in `tests/analytics.test.mjs`)
- `src/scripts/` — client form behaviour (client-side validation mirrors the server rules)
- `public/assets/` — original imagery (gitignored; referenced as `/assets/<name>`)
- `examples/`, `plan/` — design samples and the working spec docs
