# Design — harden-site-security

## Context

See proposal.md (Why) and `reports/security-review.md` (findings M-1…L-5/I-1).
Constraints that shape every decision: the constitution (`memory/constitution.md`) —
I static-first/free-tier (no paid tooling), II PII studio-inbox-only with 30-day
TTL, IV never trust the client, V optional integrations never fail the durable
write path, VI test-first (pure logic unit-tested via `npm test`), VII stable
deploy (`emfines-site.terry-g-zhou.workers.dev` is a constitution-protected
stable URL).

Current state: `src/lib/enquiry.ts` enforces minimums/whitelists but no
maximums and no photo content checks; `src/pages/api/enquiries.ts` sends
wildcard CORS headers and has no abuse resistance; no worker sets security
response headers; `umamiScriptTag()` (`src/lib/analytics.ts`) emits a bare
`<script src="…">`; the email path defaults an unconfigured sender to the
`.workers.dev` hostname.

## Goals / Non-Goals

Goals: close M-1, M-2, M-3, L-1, L-3, L-5 with the smallest free-tier
surface; keep every existing happy path (forms, KV archive, email,
analytics) behaviourally identical.
Non-Goals (design-level): strict nonce-CSP (deferred follow-up), a
paid-zone rate-limiting rule or WAF upgrade, the planned auth-gated
enquiries inbox (`add-enquiries-inbox`), dependency-audit tooling, and any
change to the 30-day KV TTL / consent model.

## Decisions

### D1 — Field maximums live in `src/lib/enquiry.ts` as exported constants
New exported `MAX_NAME = 100`, `MAX_PHONE = 40`, `MAX_PIECE_TYPE_OTHER = 100`,
`MAX_GEMSTONES = 500`, `MAX_BRIEF = 4000`, `MAX_MESSAGE = 4000`, checked
after the existing `asString()` trim, one error per violating field
(`brief too long (max 4000)` style, mirroring the existing error phrasing).
The client (`src/scripts/enquiry-form.ts`, `contact-form.ts`) mirrors the
same limits as inline validation only as a UX nicety; the server stays the
source of truth (Constitution IV).
*Rejected:* HTML `maxlength` attributes alone — they constrain the browser
form only, not the API; the API is the trust boundary.

### D2 — Photo content checks: base64 alphabet + MIME magic bytes, no image library
After the existing size check, validate the payload alphabet
(`^[A-Za-z0-9+/]*={0,2}$` on the whitespace-stripped segment), then decode
(`Buffer.from(data, 'base64')` — `nodejs_compat` flag is already on) and
compare the first bytes to the declared type's magic: JPEG `FF D8 FF`,
PNG `89 50 4E 47`, WebP `45 49 46 46 … 57 45 42 50` (RIFF container).
Errors reuse the existing `photos[i]` message shape.
*Rejected:* decoding + re-encoding to verify integrity (double work, no
observable gain beyond magic bytes); pulling an image library (Constitution
I: free-tier/static-first; a dependency for a marketing site is
disproportionate).

### D3 — Drop CORS entirely; OPTIONS falls to the default 405
Delete `CORS_HEADERS` from `src/pages/api/enquiries.ts` and the `OPTIONS`
export. The forms fetch same-origin with JSON, so the browser never issues
a preflight for them; removing the wildcard headers makes cross-origin JSON
posts fail preflight (browser-blocked) while `curl`-style spam is caught by
D4.
*Rejected:* restricting `Access-Control-Allow-Origin` to an allow-list —
there are zero legitimate cross-origin clients today; YAGNI, and an
allow-list is a maintenance surface nobody needs.

### D4 — Worker-side KV rate limiter (free-tier), not a zone rule
Cloudflare *zone* Rate Limiting Rules are a paid (Pro) feature — using one
would violate Constitution I. Instead: a per-client-IP sliding 5-minute
window implemented in the worker over the existing `emfines_enquiries` KV
namespace — one short-lived counter write per accepted-or-throttled POST
(key `ratelimit/${ip}/${windowStart}`, 300 s TTL, value = count). The
bucket logic (deciding accept vs. 429 from a counter + window) is pure in
a new `src/lib/ratelimit.ts` and unit-tested (Constitution VI); the KV
integration stays in the endpoint. Limit: 10 POSTs / 5 min / IP, 429 with
`{ "error": "Too many requests — please try again later" }` and
`Retry-After: 60`. A throttle or an over-limit hit writes nothing to the
enquiry archive (checked before `storeEnquiry`).
Client IP comes from `request.cf.ip` (Workers injects the visitor IP into
`cf` on all plans).
*Rejected:* a Durable Object limiter — more moving parts (DO + binding) for
a marketing site whose traffic is orders of magnitude under the
free-tier KV write budget (100 k writes/day); the counter writes are ~2 per
request worst case. If the account later pays for a zone, migrate to a
zone rule and delete the worker-side limiter (noted in tasks).
*Risk:* a burst of legitimate shared-egress visitors (one office NAT)
could hit the limit → Mitigation: generous 10/5min, 429 message tells
users to email directly (the forms already carry that fallback copy).

### D5 — Security headers via Cloudflare Transform Rules (response), HSTS in zone settings
All five headers ship as console config, not code (the Astro/worker build
has no header hook today; adding middleware for headers the edge already
sets is redundant): Transform Rules on `emfinestudio.com/*` +
`www.emfinestudio.com/*` add `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`,
`X-Frame-Options: DENY`, `Permissions-Policy: camera=(), geolocation=(),
microphone=()`; HSTS (`max-age=63072000; includeSubDomains`) is enabled in
the zone SSL/TLS panel (skip `preload` — eligibility unreviewed; add
later if desired). Transform Rules and HSTS are free on all plans
(Constitution I).
*Rejected:* a strict CSP now — the LAN-flavoured inline `ph.init` loader
and JSON-LD make a non-'unsafe-inline' CSP require nonces wired through
Astro + the analytics helper; cost outweighs benefit at this site size,
and SRI (D7) already removes the main script-injection channel. Follow-up
change if we ever add more dynamic content.

### D6 — No email sender fallback; archive-only when unconfigured
`src/pages/api/enquiries.ts`: replace the
`'emfines-site.terry-g-zhou.workers.dev'` default with *skip*: when neither
`ENQUIRY_FROM` nor `BREVO_FROM` yields a configured sender, log
`[enquiry] no verified sender configured — archive-only` and return
`emailDelivered: false`. Owner sets `wrangler secret put ENQUIRY_FROM`
(and optionally `BREVO_FROM`) to the verified studio address.
*Rejected:* keeping the workers.dev fallback — it discloses the account
slug on every outbound email and degrades deliverability (L-3).

### D7 — Umami embed gains SRI; missing hash = no embed
`src/lib/analytics.ts`: `UmamiAnalytics` gains optional
`integrity?: string` (a `sha384-…` value). `umamiScriptTag()` emits
`integrity="…" crossorigin="anonymous"` when `integrity` is a real
(non-placeholder) value — reusing `isConfigured()`; when enabled but the
integrity value is missing/placeholder it returns `null` (no tag, no ping),
consistent with the existing "placeholder = not configured" rule. A new
owner tool `scripts/umami-integrity.mjs` fetches
`${ANALYTICS.umami.host}/script.js` (owner-run, needs network),
prints the `sha384` hex hash + a copy-paste config line. `src/config.ts`
stores the computed value; it must be recomputed whenever the Umami build
is upgraded (documented next to the config).
*Rejected:* pinning by hosting the script in the repo (it is
version-coupled to the Umami server API — the self-hosted box *must* stay
the authority; SRI is the standard pin). Hosting Umami behind the studio's
own Cloudflare account (long-term follow-up, out of scope).

### D8 — Keep `workers_dev: true`; do not disable previews
Constitution VII protects the stable workers.dev URL, and previews deploy to
a separate `emfines-site-preview` worker the owner uses. We therefore do NOT
flip `preview_urls`/`workers_dev`; instead D4's worker-side limiter covers
every entry point (zone, www, workers.dev, previews) uniformly, and the
trade-off (zone-level rules don't apply off-zone) is recorded here.

## Risks / Trade-offs

- [KV limiter adds 1 KV write per POST + 1 read] → volume is negligible
  (a jewellery studio's traffic vs the 100 k/day free write budget); a KV
  failure degrades to "no limit" (caught, logged) — the write path still
  stores the enquiry (Constitution V).
- [Magic-byte check rejects unusual-but-valid encodings (e.g. a JPEG with a
  missing first marker byte is not really a JPEG)] → correct behaviour:
  real browsers' file pickers produce canonical files.
- [SRI hard-fails analytics silently when the Umami box is upgraded] →
  owner runs `node scripts/umami-integrity.mjs` after each Umami upgrade and
  redeploys; the page keeps working without analytics (Constitution V) —
  the failure mode is "no analytics", never "no site".
- [Transform Rules only cover the custom-domain zone] → the workers.dev
  URL lacks HSTS framing headers; accepted (D8) — the zone is the public
  face, and the worker-side limiter still applies.
- [Rate-limit counters share the enquiry KV namespace] → keys are
  namespaced (`ratelimit/…` vs `enquiries/…`), 300 s TTL; no interference.

## Migration Plan

1. Ship code (D1–D3, D6, D7) via the normal `npm run deploy` (guard
   intact). 2. Apply console config (D5) — idempotent, instant, no deploy.
3. Compute + set the Umami SRI hash (D7 task) and set `ENQUIRY_FROM`
   secrets (D6) — both independent of the code deploy. Rollback = revert
   commit + re-deploy; console rules can be toggled off in seconds. No data
   migration (KV keys additive only).

## Open Questions

- Exact rate-limit numbers (10/5 min) — tunable constant in
  `src/lib/ratelimit.ts`; verify against real traffic after a month and
  adjust; no spec change unless the *semantics* (per-IP windowed 429)
  change.
- Whether to add Turnstile (free, zone-level) as a second bot layer —
  optional follow-up task already listed; doesn't change this change's
  acceptance.
