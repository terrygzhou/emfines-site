# Tasks: add-web-analytics

> The analytics layer shipped in `386aa47`; this change formalises it as a
> requirement. Groups 1–3 + 5 are complete / verified against the requirements.
> Group 4 (owner enablement) is now active: **Umami is live** (a new
> `emfinestudio.com` website was created in the self-hosted Umami and the public
> host `https://umami.eywalink.org` is wired in). **PostHog is now a real,
> LAN-gated provider**: a project was created in the self-hosted Pop!_OS
> PostHog and a `phc_` key is wired in, but PostHog is emitted **only in the
> LAN build** (`POSTHOG_LAN=1 npm run build` / `npm run build:lan`) because
> `posthog.local` is unreachable from public visitors (group 6). The public
> build still ships no PostHog embed, so no public ping and no duplication.

## 1. Core analytics layer (pure helpers + config)
- [x] 1.1 TDD `src/lib/analytics.ts` (placeholder detection `isConfigured`, `umamiScriptTag`, `postHogScriptTag`, no-op-safe `trackConversion`) in `tests/analytics.test.mjs` — "Default placeholder build emits nothing" / "Umami points at a self-hosted instance" / "PostHog points at a self-hosted / EU instance" — verify: `npm test` green
- [x] 1.2 `src/config.ts` `ANALYTICS` (Umami + PostHog, default off) + `src/components/Analytics.astro` renders only configured providers into `Base.astro` `<head>` — "Default placeholder build emits nothing" / "Only Umami active" — verify: `npm run build` (escalated) emits no analytics `<script>` tag under default config

## 2. Conversion events on durable success
- [x] 2.1 Design form fires `design_enquiry_submitted` exactly once after the server durably stores the enquiry; none on rejection/failure — "Design enquiry stored" / "Failed submit fires no conversion" — verify: `src/scripts/enquiry-form.ts` fires in the success branch only
- [x] 2.2 Contact form fires `contact_enquiry_submitted` on durable success — "Contact message stored" — verify: `src/scripts/contact-form.ts` fires after `res.ok`
- [x] 2.3 `trackConversion` is no-op-safe (never throws when a provider SDK is absent/late) — "SDK absent at fire time" — verify: unit test "trackConversion is no-op-safe when no SDK is present"

## 3. Verify & deploy (isolated preview)
- [x] 3.1 `npm run check` (0 errors) + `npm test` (green) + `npm run build` (escalated, success); dist HTML contains no Umami/PostHog embed tags under the default config — "Default placeholder build emits nothing"
- [x] 3.2 `npx wrangler deploy --config dist/server/wrangler.json --name emfines-site-preview` (escalated); live-verify no third-party analytics requests fire on the default config — "Default placeholder build emits nothing"
  > **done 2026-09-10**: preview now returns **200** (was 404 because an in-sandbox `npm run build` cannot run the Cloudflare prerenderer — `uv_interface_addresses` — so `dist/client` had no HTML). A full/escalated build emits all 6 prerendered pages. Zero analytics pings: no `<script src=…umami|posthog>`, no `data-website-id`, no `window.ph.init`; the only "Umami/PostHog" text is the doc comment at `Base.astro:86`.

## 4. Owner enablement — self-hosted Pop!_OS (config-only, open)
- [x] 4.1 Supply the Pop!_OS base URLs for Umami + PostHog; set `umami.host` / `posthog.host` in `src/config.ts` and flip `enabled: true` once real credentials are in place — "Umami points at a self-hosted instance" / "PostHog points at a self-hosted / EU instance" — verify: `npm run build` + deploy; the emitted embeds load from the Pop!_OS hosts
  > **Superseded by group 6 (2026-09-11):** PostHog is no longer a placeholder — see 6.1/6.2 for the LAN-gated wiring.
> **done 2026-09-10 (Umami live; PostHog no-op on purpose at the time):** `umami.host='https://umami.eywalink.org'` (cloudflared tunnel `umami-eywalink` → nginx gateway :3080, analytics surface only) + a new Umami website `emfinestudio.com` (id `0995457f-98e2-45dc-ae74-c7011543bdee`, created as a direct `website` row since the app admin API needs the owner's password). Escalated build now emits the Umami embed with that id + host; public `/api/send` accepts a synthetic event (200). `posthog.host='https://posthog.local'` is set, but **`apiKey` is left a placeholder deliberately**: the Pop!_OS PostHog is local-only (Caddy `posthog.local`, self-signed TLS, no public DNS, no project). A real key would make public visitors load a PostHog SDK pointing at an unreachable host and would *disable* the Umami conversion fallback (PostHog is the preferred conversion owner). Keep it no-op until PostHog is exposed publicly; then paste a `phc_` key.
- [x] 4.2 Post-enable privacy check: no PII sent, Umami honours DNT — "No PII and Do-Not-Track respected" — verify: inspect emitted events on the self-hosted dashboards
  > **done 2026-09-10 (site-side):** the embed carries `data-do-not-track`; the sent payload and Umami's `website_event` schema contain only path / title / referrer — no PII columns. Public `POST /api/send` accepted a synthetic event (200 `{"beep":"boop"}`) and Umami recognized the site (Redis now caches `website:0995457f-…`). **Caveat (owner backend, not site code):** the raw `website_event`/`event_data` rows had not flushed to Postgres at check time — that flush is the Umami ingestion worker's job. Confirm on the Umami dashboard; if it stays empty, check the `umami-umami-1` worker / `umami-analytics-api`.

## 5. No-duplication feature split (single owner per signal)
- [x] 5.1 TDD: `trackConversion` fires to at most ONE provider (PostHog preferred, Umami fallback, never both) + PostHog `capturePageview`/`capturePageLeave` default off — "Both active, no double-counted pageviews" / "Conversion captured by one provider only" / "Umami-only deployment still records conversions" — verify: `npm test` green
- [x] 5.2 `src/config.ts` `ANALYTICS` PostHog events-only (`capturePageview: false`, `capturePageLeave: false`) + feature-split comment; `enabled: true` pre-armed (no-op until real keys, per "Enabled but placeholder still emits nothing")
- [x] 5.3 Spec + design record the requirement "Analytics features are not duplicated across providers" (delta + main spec + design decision)


## 6. PostHog LAN-gated enablement + no-duplication (self-hosted Pop!_OS)
- [x] 6.1 **No.1 — create the PostHog project + key.** Created org "EM Fine Studio", project id 1, team id 1 in the self-hosted `posthog-hobby` stack via its own Django ORM (`docker exec posthog-hobby-web-1 … python create_ph.py`); Project API key `phc_kimp…WWxJA` (stored with the `phc_` prefix in this build). Ingestion verified end-to-end via the OTLP analytics endpoint `POST /i/v1/analytics/events` (Bearer + `PostHog-Sdk-Info`/`-Attempt`/`-Request-Id`/`-Request-Timestamp` headers + batch envelope → 200; row confirmed in `posthog-hobby-clickhouse-1`). Note: the classic `/e/` page-snippet ingest is absent in this build.
- [x] 6.2 **No.2 — wire the site to PostHog, LAN-only, no duplication.** `posthog.host='https://posthog.local'` + real `apiKey`; `posthog.enabled` is a build-time flavor (`__POSTHOG_LAN__` Vite `define` from `astro.config.mjs`, `npm run build:lan`). Umami stays `enabled:true` in both flavors; PostHog keeps `capturePageview`/`capturePageLeave` false. Verify: clean public build → `dist/client/*.html` have Umami in all 6 pages, **zero** PostHog markers; clean `POSTHOG_LAN=1` build → all 6 pages have **both** Umami + PostHog (`static.js` + `ph.init` with the `phc_` key + `apiHost:"https://posthog.local"`). `npm run check` 0 errors; `npm test` green.
  > **done 2026-09-11:** verified both clean builds. Residual caveat to surface to the owner: this build's classic `/e/` page ingest is absent and `/static.js` is login-gated, so the public-CDN PostHog page SDK's ingest into THIS specific instance should be confirmed in a browser on the LAN before relying on it.
