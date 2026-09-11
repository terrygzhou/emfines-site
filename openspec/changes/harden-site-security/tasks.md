# Tasks — harden-site-security

Conventions: pure-logic work is test-first (write/extend the failing test in
`tests/*.test.mjs` first, run `npm test`, then implement). Every task cites
the acceptance scenario(s) it satisfies, by scenario name.

## Phase 1 — Bounded enquiry input (spec: site-security)

- [x] 1.1 **Test first:** extend `tests/enquiry.test.mjs` — over-long
      `brief` (4001) → 400-style error naming `brief`; over-long `message`
      (4001) → error naming `message`; at-limit request (brief exactly 4000,
      all other rules valid) → accepted. Scenarios: *Over-long brief is
      rejected*, *Over-long contact message is rejected*, *Bounded valid
      request still accepted*.
- [x] 1.2 Implement `MAX_NAME=100`, `MAX_PHONE=40`, `MAX_PIECE_TYPE_OTHER=100`,
      `MAX_GEMSTONES=500`, `MAX_BRIEF=4000`, `MAX_MESSAGE=4000` in
      `src/lib/enquiry.ts` (exported constants; checked after `asString()`
      trim; per-field errors mirroring the existing phrasing) until 1.1
      passes.
- [x] 1.3 Mirror the limits client-side for inline UX: `maxlength`
      attributes on the /design and /contact form fields (same numbers), so
      valid visitors never round-trip for a limit. No scenario gate — UX
      mirror of 1.2 (Constitution IV: server remains the authority).

## Phase 2 — Photo content validation (spec: site-security)

- [x] 2.1 **Test first:** in `tests/enquiry.test.mjs`, replace the
      synthetic photo fixtures (`Buffer.alloc(n, 1)` bytes are not valid
      image magic bytes and would fail the new check) with realistic
      fixtures: `Buffer.concat([Buffer.from([0xFF,0xD8,0xFF,0xE0]),
      Buffer.alloc(n, 1)])` for JPEG, `89 50 4E 47 0D 0A 1A 0A` for PNG,
      `RIFF + size + WEBP` for WebP. Add cases: base64 payload containing
      non-alphabet characters (`abc!!!…`) → `photos[0]` error; valid
      base64 with mismatched magic (JPEG header declared PNG) → `photos[0]`
      error; genuine JPEG bytes → accepted. Scenarios: *Non-base64 payload
      rejected*, *Magic bytes must match the declared type*, *Valid photo
      still accepted*.
- [x] 2.2 Implement in `src/lib/enquiry.ts` `parsePhoto`: base64-alphabet
      check on the stripped segment, `Buffer.from(data, 'base64')` decode
      (`nodejs_compat` already enabled; in the unit harness Node has
      `Buffer` natively), magic-byte compare for JPEG/PNG/WebP — only after
      the existing size check, errors in the existing `photos[i]` shape.

## Phase 3 — CORS removal (spec: site-security)

- [x] 3.1 Remove `CORS_HEADERS` and the `OPTIONS` export from
      `src/pages/api/enquiries.ts` (OPTIONS then answers 405 like other
      non-POST methods; keep the existing `GET` 405). Scenarios: *No CORS
      headers on acceptance*, *Same-origin form still works*, *OPTIONS is
      no longer a supported method*.
- [x] 3.2 Verify same-origin form flow end-to-end in `wrangler dev`
      preview (3.3): `curl -H 'Content-Type: application/json' -d '<valid
      contact payload>'` → 200, and assert the response carries no
      `Access-Control-Allow-*` headers.
      **Verified (2026-09-11):** valid contact POST → 200 `{"ok":true}`;
      `OPTIONS` → 405 with **no** `Access-Control-*` headers (CORS-free, same
      -origin form still posts); `GET` → 405.

## Phase 4 — Worker-side rate limiting (spec: site-security; design D4)

- [x] 4.1 **Test first:** new `tests/ratelimit.test.mjs` for a new pure
      `src/lib/ratelimit.ts` — window-bucket decision function
      `decideRateLimit(counter, limit, nowMs)` → `{ allowed, nextCount,
      windowStart, retryAfterSec }` over a 5-min window: 10th request
      allowed, 11th denied with retry-after; window rollover resets.
      Scenario: *Burst beyond the limit is throttled*.
- [x] 4.2 Implement `src/lib/ratelimit.ts` (constants: LIMIT=10,
      WINDOW_MS=300000; pure + unit-tested, Constitution VI).
- [x] 4.3 Wire into `POST` in `src/pages/api/enquiries.ts` BEFORE
      validation/storage: `request.cf.ip` → KV key
      `ratelimit/${ip}/${windowStart}` (300 s TTL) → get/decide/put; a
      denied request returns 429 `{ "error": "Too many requests — please
      try again later" }` + `Retry-After: 60` and neither archives nor
      emails (the throttle check must run before `storeEnquiry` and email;
      a KV failure is caught + logged → fail-open, never 5xx the write
      path, Constitution V). Scenario: *Normal use is unaffected*.

## Phase 5 — Email sender hygiene (spec: site-security)

- [x] 5.1 Remove the `'emfines-site.terry-g-zhou.workers.dev'` sender
      fallbacks in `src/pages/api/enquiries.ts`: when neither
      `ENQUIRY_FROM` nor `BREVO_FROM` is set, the email channel is skipped
      with a `[enquiry] no verified sender configured — archive-only` log
      and `emailDelivered: false` (KV store unchanged). Scenarios: *No
      sender configured → archive-only*, *Configured sender is used*.
- [ ] 5.2 Owner action (escalated/networked): `wrangler secret put
      ENQUIRY_FROM` (verified studio address; `BREVO_FROM` too when the
      Brevo sender domain is verified) — never committed. Scenario:
      *Configured sender is used* (verify on next real enquiry's From
      header).

## Phase 6 — Umami SRI (spec: web-analytics; design D7)

- [x] 6.1 **Test first:** extend `tests/analytics.test.mjs` —
      `umamiScriptTag({enabled, websiteId, host, integrity:'sha384-…'})`
      emits `integrity="sha384-…"` + `crossorigin="anonymous"`; missing or
      placeholder `integrity` (e.g. `YOUR_UMAMI_INTEGRITY`) → `null` (no
      tag). Scenarios: *Umami embed carries SRI attributes*, *Missing/
      placeholder integrity suppresses the embed*.
- [x] 6.2 Implement: `integrity?: string` on `UmamiAnalytics`
      (`src/lib/analytics.ts`), `isConfigured()` gate inside
      `umamiScriptTag()`, emit both attributes when configured.
- [x] 6.3 Add `scripts/umami-integrity.mjs`: fetch
      `${ANALYTICS.umami.host}/script.js`, print the `sha384` hex hash and
      the copy-paste `integrity:` config line; document next to
      `src/config.ts` that the hash must be recomputed on every Umami
      upgrade. Scenario: *Host serves a mismatched script* (owner
      verifies: bump the hash to a wrong value in a LAN build → browser
      console shows the SRI refusal; page + forms unaffected).
- [x] 6.4 Owner action (networked): run `node scripts/umami-integrity.mjs`
      and store the printed value in `ANALYTICS.umami.integrity` in
      `src/config.ts` (this line is the only committed change from that
      step).

## Phase 7 — Cloudflare console hardening (no code; owner/escalated)

- [ ] 7.1 Transform Rules (response headers, both hosts
      `emfinestudio.com/*` + `www.emfinestudio.com/*`):
      `X-Content-Type-Options: nosniff`,
      `Referrer-Policy: strict-origin-when-cross-origin`,
      `X-Frame-Options: DENY`,
      `Permissions-Policy: camera=(), geolocation=(), microphone=()`.
      Scenario: *Page responses carry the header set*, *API and
      static-asset responses carry the header set*.
- [ ] 7.2 Zone SSL/TLS: enable HSTS (`max-age=63072000;
      includeSubDomains`; skip `preload` for now). Same scenarios as 7.1
      (verify the `Strict-Transport-Security` header on `GET /`).
- [ ] 7.3 Verify all of 7.1/7.2 with `curl -sI https://emfinestudio.com/`
      (escalated). Record that zone-level *rate-limiting rules* were
      deliberately NOT used (paid feature; worker-side limiter D4 covers
      every entry point — Constitution I) and that the workers.dev URL is
      intentionally retained (Constitution VII) — a one-line note in
      `README.md`.
- [ ] 7.4 Optional follow-up (not blocking): Turnstile invisible challenge
      on `/api/enquiries` (free, zone-level) — second bot layer above D4.

## Phase 8 — Docs + validation

- [x] 8.1 `README.md`: new "Security posture" section summarising the
      header set, rate limit, SRI, archive-only fallback, and the
      `wrangler secret put` commands (secrets never in git — Constitution
      I). No new scenario.
- [ ] 8.2 `openspec sync` the two delta specs into main specs after
      archive (archive step handles it) — keep `reports/security-review.md`
      as a dated snapshot; do not edit it.
- [x] 8.3 **Full validation (all must pass):**
      `npm run check` → `npm test` → `npm run build` (public flavor) →
      `npm run preview` (`wrangler dev`): `GET /` 200; valid contact POST
      200 (local KV/email no-ops); the emitted page HTML contains the Umami
      tag with `integrity=` + `crossorigin=`; the /design form happy path
      still shows the success branch. Also confirm `POSTHOG_LAN=1`
      `npm run build` still emits PostHog unchanged.
      **Result (2026-09-11, all green):** check 0 errors; test 4/4; public
      build exits 0 (PostHog absent, Umami SRI present on all 6 pages);
      `POSTHOG_LAN=1` build exits 0 (PostHog emitted, Umami SRI present);
      `wrangler dev` smoke test: GET / 200, valid contact POST 200,
      OPTIONS 405 (no CORS), 11th rapid POST → 429 + `Retry-After`.
      **Dev-only note:** a rapid-burst 12th+ request intermittently returns
      500 `Error: Network connection lost.` — this is an `Error inside
      ProxyWorker` in the miniflare local KV transport (log: "the dev
      server continues"), NOT the worker's write path (every KV op in
      `enquiries.ts` is wrapped fail-open per Constitution V). It does not
      reproduce against production managed KV; no code change required.
