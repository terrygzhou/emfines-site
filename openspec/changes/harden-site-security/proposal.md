## Why

The 2026-09-11 security review (`reports/security-review.md`) found that the public
`POST /api/enquiries` endpoint has no abuse resistance (no rate limiting, wildcard
CORS, unbounded text fields, unvalidated photo bytes), that no security response
headers are served, and that every public page loads the Umami analytics script
from a self-hosted third host without any integrity check. Each accepted request
stores up to ~20 MB of PII in KV for 30 days and can trigger a Brevo email, so
these gaps are concrete storage, inbox-spam, and supply-chain risks — not
theoretical ones.

## What Changes

- **Bounded input, server-side** (`src/lib/enquiry.ts`): maximum lengths for
  `name`, `phone`, `gemstones`, `brief`, `message`, `pieceTypeOther` (minimums
  stay); photos additionally validated as real base64 with image magic bytes
  (JPEG/PNG/WebP), matching the declared MIME type.
- **CORS restriction**: drop the wildcard `Access-Control-Allow-Origin` headers
  on `/api/enquiries` (the form is same-origin and needs no CORS at all);
  cross-origin scripted JSON posts fail preflight instead of round-tripping.
- **Rate limiting** (Cloudflare config, no code): a free-tier Rate Limiting
  Rule on `/api/enquiries` (both `emfinestudio.com` and the workers.dev URL)
  returns 429 to abusive clients; optionally an invisible Turnstile challenge.
- **Security response headers** (Cloudflare Transform Rules / zone settings,
  no code): `X-Content-Type-Options: nosniff`, `Referrer-Policy`,
  `X-Frame-Options: DENY`, `Permissions-Policy`, and HSTS enabled in the zone
  SSL/TLS settings.
- **Analytics integrity** (`src/lib/analytics.ts`): the emitted Umami
  `<script>` tag gains `integrity` (SRI) + `crossorigin="anonymous"` so a
  compromised/retargeted analytics host cannot silently serve arbitrary JS in
  the studio's origin; a mismatched hash hard-fails the script instead.
- **Sender hygiene** (secrets, no code): set `ENQUIRY_FROM` / `BREVO_FROM`
  worker secrets to a verified `emfinestudio.com` address so enquiry emails
  stop defaulting to the `.workers.dev` sender (account-name disclosure).
- **Entry-point posture** (wrangler config, decision recorded): keep
  `workers_dev` only if the workers.dev URL is actually used; set
  `preview_urls: false` unless previews are needed — every public preview URL
  is a second entry point zone rules don't cover.

Non-goals (explicit): no Turnstile code integration (config-only optional
item), no full strict CSP with nonces (a practical allow-list CSP is offered
as an optional follow-up), no change to the KV 30-day TTL or consent model,
no implementation of the planned auth-gated enquiries inbox
(`add-enquiries-inbox`), no dependency audit (separate `npm audit`
initiative), no UI changes to the forms.

## Capabilities

### New Capabilities
- `site-security`: observable security behaviour of the deployed site —
  bounded + content-validated enquiry inputs, no wildcard CORS on the public
  API, rate-limited endpoint, security response headers on all responses, and
  integrity-protected analytics script embedding.

### Modified Capabilities
- `web-analytics`: the Umami embed requirement changes — the emitted script
  tag SHALL carry `integrity`/`crossorigin` attributes (SRI); a hash
  mismatch means the script is refused, not silently executed.

## Impact

- `src/lib/enquiry.ts` (+ its unit tests under `tests/`): max-length rules,
  base64 alphabet + magic-byte photo validation (pure, test-first).
- `src/pages/api/enquiries.ts`: remove `CORS_HEADERS` (OPTIONS handler
  simplified or removed; same-origin POSTs unaffected).
- `src/lib/analytics.ts` (+ tests): `umamiScriptTag()` emits SRI attributes;
  hash computed by a build-time helper (documented in design.md).
- Cloudflare console (no repo code): Rate Limiting Rule, Transform Rules
  (response headers), zone HSTS, Turnstile (optional).
- `wrangler.jsonc`: `preview_urls` posture; secrets `ENQUIRY_FROM` /
  `BREVO_FROM` set via `wrangler secret put` (never committed).
- `reports/security-review.md` is the source of findings M-1…L-5/I-1; this
  change tracks them.
