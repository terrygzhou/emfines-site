# EM Fine Studio (emfines-site) — Security Review

- **Date:** 2026-09-11
- **Repo:** `emfines-site` @ `d7f64af` (main), clean tree
- **Scope:** Static review of the deployed application — Astro 7 (`output: 'server'`)
  site + one server endpoint `POST /api/enquiries` on Cloudflare Workers, KV
  archive (`emfines_enquiries`, 30-day TTL), Brevo / Cloudflare-Email email
  path, client form scripts, analytics embeds, deploy config (`wrangler.jsonc`,
  `astro.config.mjs`), and committed docs. No live scanning / dependency
  audit (`npm audit` not run — noted in §7).
- **Method:** Read every request-handling source file: `src/pages/api/enquiries.ts`,
  `src/lib/enquiry.ts`, `src/scripts/*.ts`, `src/lib/analytics.ts`,
  `src/components/Analytics.astro`, `src/layouts/Base.astro`,
  `src/config.ts`, `public/robots.txt`, `scripts/guard-deploy-assets.mjs`,
  plus config files and openspec design docs.

---

## 1. Executive summary

The application is small and largely well-built: every input is re-validated
server-side against whitelists, photo uploads are type- and size-capped with
server-generated filenames (no path traversal), the email recipient is a
server-side secret (no open relay), all client DOM updates use `textContent`
(no reflected DOM XSS), and no credentials are committed. The main gaps are
**abuse resistance** (no rate limiting or bot protection on the public
enquiry API, unbounded text fields) and **browser hardening** (no CSP /
nosniff / referrer / framing headers; a public page loads a script from a
self-hosted third host without SRI).

| # | Finding | Severity |
|---|---------|----------|
| M-1 | No rate limiting / bot protection on `POST /api/enquiries`; CORS `*` enables scripted cross-origin spam | Medium |
| M-2 | Unbounded text fields (brief/message/gemstones/phone/name) → storage + email volume abuse | Medium |
| M-3 | Public pages load a script from a self-hosted host (`umami.eywalink.org`) without SRI — supply-chain & privacy surface | Medium |
| L-1 | No security response headers (CSP, `X-Content-Type-Options`, `Referrer-Policy`, framing, HSTS not verified on) | Low |
| L-2 | `workers_dev: true` + `preview_urls: true` → prod also reachable at a zone-independent `.workers.dev` URL; previews public | Low |
| L-3 | Default email sender falls back to `*.workers.dev` address (account-name disclosure) | Low |
| L-4 | Client-side analytics keys / IDs committed (PostHog `phc_…`, Umami websiteId, KV namespace id) — acceptable by design, see note | Info |
| L-5 | Photo base64 payloads not validated as real base64 / image content | Low |
| I-1 | Visitor data (paths, referrers) sent to a third-operated Umami host; no privacy notice | Info |

## 2. Details

### M-1 — Public enquiry API: no rate limit or bot protection (Medium)

`src/pages/api/enquiries.ts`:
- Any authenticated-free `POST /api/enquiries` is accepted from any IP.
  There is no CAPTCHA, no per-IP/per-key rate limit, and no token/proof-of-work.
- `Access-Control-Allow-Origin: *` is set on the route. Because the form's
  `Content-Type: application/json` fetch triggers a **preflight**, the wildcard
  CORS is actually what allows a *browser-based* spammer on another origin to
  script submissions (remove the CORS headers and preflight fails, blocking
  cross-origin JSON posts from browsers entirely; `curl`-style spam still
  needs a rate limit).
- Impact per abused request: a 30-day PII record (name, email, phone, up to
  ~20 MB of base64 photos) lands in KV, and — when `BREVO_API_KEY` is set —
  an email is sent to the studio inbox. The Brevo free tier (300
  emails/day) is exposable to exhaustion; the KV free tier (1 GB) to
  fill-up with junk.

**Fix (in priority order):**
1. Add a Cloudflare **Rate Limiting Rule** on `emfinestudio.com/api/enquiries`
   (e.g. 10 POSTs / 5 min per IP → 429), and one on the `.workers.dev` URL
   if it stays enabled (L-2).
2. Optionally add **Cloudflare Turnstile** (invisible challenge) to the
   endpoint — native Workers support; keeps humans friction-free.
3. Drop the wildcard CORS (the form is same-origin and needs no CORS
   headers at all); keep `OPTIONS`/`Content-Type` handling only if a
   specific origin ever becomes legitimate.

### M-2 — Unbounded text fields (Medium)

`src/lib/enquiry.ts` enforces *minimum* lengths but no *maximum* on
`name`, `phone`, `gemstones`, `brief`, `message` (and `pieceTypeOther`).
A client can submit arbitrarily long strings (bounded only by the Worker
request-body limit and the 25 MB KV value cap), so one request can:
- store up to ~25 MB of junk in KV (× thousands of requests before KV fills),
- ship an unbounded email body to the inbox.

**Fix:** add max lengths in `validatePayload` (mirror on the client's
`clientValidate`/form attributes) — e.g. `name` ≤ 100, `phone` ≤ 40,
`gemstones` ≤ 500, `brief` ≤ 4000, `message` ≤ 4000, `pieceTypeOther` ≤ 100.
Also consider capping the decoded photo total (3 × 5 MB is fine; just
documented).

### M-3 — Third-party script from a self-hosted host, no SRI (Medium)

`src/config.ts` (public build): every page embeds
`<script defer src="https://umami.eywalink.org/script.js">` — a **self-hosted
Umami box exposed through a cloudflared tunnel**, operated outside the
studio's Cloudflare zone.
- **Supply chain:** whoever controls that host (or the tunnel endpoint, which
  is DNS/CDN-redirectable) can execute arbitrary JS *in the
  `emfinestudio.com` origin* on every visitor's browser, and can serve
  malicious tracker code to the studio's domain. There is no
  `integrity`/`crossorigin` (SRI) attribute on the tag, so nothing
  pin-downs the payload.
- **Availability:** the page's analytics (and the `umami.track`
  conversion fallback that the form success handlers rely on —
  `src/lib/analytics.ts`) depends on that tunnel staying up.
- **Privacy:** visitor page paths + referrers are POSTed to
  `umami.eywalink.org` — data disclosure to a host that is not the studio's
  Cloudflare account (I-1).

**Fix:**
1. Add SRI (`integrity="sha384-…" crossorigin="anonymous"`) to the Umami
   script tag in `umamiScriptTag()` — regenerate the hash whenever the Umami
   build changes; a hash mismatch then loudly fails instead of silently
   executing attacker code.
2. Document the analytics third-party disclosure (footer/privacy blurb) and
   keep the existing `data-do-not-track` opt-out (good, keep it).
3. Long-term: consider hosting Umami behind the same Cloudflare account
   (a second zone, or a workers.dev subdomain) so the key material and the
   tunnel are under one operator's control.

### L-1 — No security response headers (Low)

No middleware/hook sets headers; Cloudflare serves the worker responses with
no CSP. Recommended via **Cloudflare Transform Rules (response
modification)** — no code changes needed:

| Header | Value |
|---|---|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains` (enable HSTS in the zone SSL/TLS settings; add `; preload` only after checking `preload.report` eligibility) |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `X-Frame-Options` | `DENY` (marketing site; no legitimate iframe use) — or CSP `frame-ancestors 'none'` |
| `Permissions-Policy` | `geolocation=(), camera=(), microphone=()` |

A full CSP is optional: a reasonable starting point would be
`default-src 'self'; script-src 'self' https://umami.eywalink.org
https://cdn.posthog.com 'unsafe-inline'` (the `'unsafe-inline'` is forced by
the inline `ph.init` loader in LAN builds and the JSON-LD block — prefer a
build-time nonce/hash if you want a strict CSP; the LAN-only PostHog tag
also means the public build only needs `'self'` + the Umami host).

### L-2 — Extra public entry points (Low)

`wrangler.jsonc`: `workers_dev: true` and `preview_urls: true`.
- Production is *also* served at `emfines-site.terry-g-zhou.workers.dev`
  with the same KV/secret bindings. Rules you configure on the
  `emfinestudio.com` zone (rate limiting, WAF, bot management) **do not
  apply** to that host — an attacker who knows one URL bypasses the other's
  protections. It also discloses the account slug.
- Every preview deploy gets a public URL, including the enquiry API.

**Fix:** leave `workers_dev` only if you actually use the URL (the email
fallback in L-3 currently *does*); otherwise restrict the worker to the
zone (Workers `restricted_to` / remove the workers.dev binding) and set
`preview_urls: false` unless previews are needed.

### L-3 — Default email sender reveals account (Low)

`enquiries.ts`: `from` falls back to
`emfines-site.terry-g-zhou.workers.dev` when `ENQUIRY_FROM`/`BREVO_FROM`
are unset. Recipients of every enquiry email see the account name and the
workers.dev hostname. **Fix:** set `ENQUIRY_FROM` / `BREVO_FROM` secrets to a
verified `emfinestudio.com` address and make the code refuse (or warn)
rather than default to a workers.dev sender.

### L-4 — Committed keys / IDs (Info)

- PostHog `phc_kimp…` project key (`src/config.ts`): public client-side key
  by PostHog design, and self-hosted; only ships in LAN builds. Acceptable,
  but rotate if the LAN box is ever exposed.
- Umami `websiteId` UUID and the KV namespace id (`wrangler.jsonc`):
  public values, not credentials. Note the KV id *combined with* account
  API access would let an attacker's Cloudflare credentials read the
  archive — keep the Cloudflare account (and `WRANGLER` tokens) locked
  down; that's the real control.
- Verified: `ENQUIRY_TO`/`ENQUIRY_FROM`/`BREVO_API_KEY` are wrangler
  secrets, not in git (see README §Email). Git history was *not* scanned
  for accidentally-committed secrets — worth a one-off
  `git log -p | grep` / gitleaks pass.

### L-5 — Photo payloads not content-validated (Low)

`parsePhoto` checks the declared MIME type (allow-listed) and decoded byte
size, but not that `data` is actually base64 or that the bytes are a real
image. Garbage gets archived in KV and attached to emails. Cheap hardening:
validate the base64 alphabet (strip `=`/whitespace, `^[A-Za-z0-9+/]+$`)
and sniff magic bytes after decoding (`FFD8FF` / `89504E47` /
`RIFF…WEBP`).

### I-1 — Visitor data leaves the studio's control (Info)

The Umami embed sends page paths + referrers to
`umami.eywalink.org` (no cookies, DNT honoured — good). For GDPR/privacy
hygiene (AU privacy law is contextually relevant), add a one-line
analytics disclosure near the footer or in the contact form's consent
text. The design form already collects explicit consent for the enquiry
data itself (`consent === true` required server-side — good).

## 3. What's done well (no action)

- **Server-side re-validation of everything** (`src/lib/enquiry.ts`):
  enum whitelists for pieceType/metals/budget/contactPref/subject; trimmed
  strings; photos allow-listed by MIME with 3×5 MB caps and
  server-generated filenames (`photo-N`) — no path traversal.
- **No open mail relay:** recipient is the `ENQUIRY_TO` secret; user input
  never becomes a `to:`/`From:` field.
- **No XSS sinks:** email HTML is entity-escaped (`escapeHtml`); client
  code updates the DOM only via `textContent`; JSON-LD via
  `JSON.stringify` (no `innerHTML` with user data).
- **Ephemeral PII by design:** 30-day KV TTL at write time; no permanent
  database; explicit consent checkbox; `robots.txt` keeps `/api/` out of
  the index.
- **No open redirects / user-controlled URLs** anywhere in the markup.
- **Secrets handled correctly** (wrangler secrets; `.wrangler/`,
  `analytics/`, `dist/` gitignored).
- Deploy-time asset guard (`scripts/guard-deploy-assets.mjs`) prevents a
  class of availability incident (live asset wipe) — availability is
  security; keep it.

## 4. Suggested remediation order

1. **Now (config-only, no code):** Cloudflare rate-limit rule on
   `/api/enquiries` (both hostnames if workers.dev stays on) + Transform
   Rules headers from L-1 + enable HSTS in the zone.
2. **Small code change:** field max-lengths (M-2) + drop wildcard CORS +
   base64/magic-byte photo validation (L-5) — all in `src/lib/enquiry.ts`,
   covered by the existing unit tests (`npm test`).
3. **Credentials:** set `ENQUIRY_FROM`/`BREVO_FROM` to verified domain
   senders (L-3); one-off gitleaks over git history (L-4).
4. **Analytics hardening:** SRI on the Umami tag + privacy blurb (M-3/I-1);
   decide on `preview_urls`/`workers_dev` posture (L-2).
5. Optional: Turnstile invisible challenge on the endpoint.

## 5. Open items / out of scope

- **No GitHub Actions workflows exist** (per AGENTS.md) — no CI gate to
  review; add `npm audit` / gitleaks to a future pipeline.
- `npm audit` / dependency CVE scan not run in this review (network-restricted);
  dependency set is small (`astro`, `tailwindcss`, `wrangler` — all
  actively maintained majors).
- The *planned* enquiries inbox (openspec: `add-enquiries-inbox`,
  `ADMIN_PASSCODE` + `SESSION_SECRET` HMAC sessions) is not implemented;
  when it lands, re-review: passcode compare must be constant-time
  (already designed as such — `HMAC-SHA256` session token) and the
  session TTL (~12 h) should be re-checked against the "30-day PII"
  posture.
- Cloudflare zone-level controls (WAF managed rules, Bot Management
  plan features, log retention) were not inspected — no zone access in
  this review; verify HSTS/WAF state in the dashboard as part of step 1.
