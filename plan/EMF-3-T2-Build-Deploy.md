---
tags: [emfines, site, build, deploy, T2]
source: paperclip EMF-3 issue record + deployed Cloudflare Workers (emfines-site) + harness checkout repo. No dedicated Paperclip T2 document existed; this note is compiled from the shipped repo and the day-14 deploy record.
paperclip_issue: EMF-3
compiled: 2026-09-09
related:
  - "EMF-2-T1-Site-Feature-Spec.md" (T1 site & feature spec, source of truth)
  - "site/repo/" (point-in-time repo snapshot; see README snapshot policy)
---

# EM Fine Studio — T2 Build & Deploy (Days 6–19)

Owner: Full-stack Builder · Status: live on day 8 + day-14 checkpoint · Consumer: QA / Demo Prep (T3)
Stable free-tier URL: `https://emfines-site.terry-g-zhou.workers.dev` (never moved after day 8)

T2 delivers the T1 spec (see `EMF-2-T1-Site-Feature-Spec.md`) as **one vertical slice**: the static
site plus the single online feature, live on a stable URL by day 8, on Cloudflare Workers free tier,
with real copy and a mobile-first layout. Day-14 checkpoint: cut scope, not quality.

## 1. Objective & acceptance

Build and deploy the EM Fine Studio site plus the one online feature as a single vertical slice,
live on a stable URL by day 8. Free-tier hosting only. Mobile-friendly, real copy. Day-14
checkpoint: cut scope, not quality. No CMS, no e-commerce, no multi-language, no paid tooling.

## 2. The build

**Repo:** `emfines-site` (Cloudflare Workers). No framework, no build step.

| Piece | Path | Role |
|---|---|---|
| Static site | `public/` (`index.html`, `css/site.css`, `js/enquiry.js`) | Served via the `ASSETS` Workers Assets binding |
| Worker | `worker.js` | Serves the static site and implements `POST /v1/enquiries` |
| Deploy config | `wrangler.jsonc` | Binds Assets dir (`ASSETS`) + KV namespace `emfines_enquiries` |

**Pages / layout (single mobile-first page, `index.html`):** Header nav (Services / Our Work / Our
Story / Start a Design), hero with the T1 value proposition, stats band, services (Custom design —
hero, Repairs, Crafted pieces), Our Work, Our Story, and the Start a commission section holding the
enquiry form. Real copy from T1 spec §5 throughout.

### The one online feature — `POST /v1/enquiries`

- Form (`public/js/enquiry.js`) fetches **same-host relative** `/v1/enquiries` (no hardcoded external domain).
- Fields: `name` (required), `email` (required, format-checked), `interest` (required: custom-design / repair / component),
  plus optional `budget`, `brief`, and the `photos` checkbox (sent as `photos: true` → stored as `wantsPhoto`).
- Server-side validation (never trust the client): valid JSON, required fields, email regex → 400 on failure;
  non-POST → 405; malformed JSON → 400.
- Response contract (stable since day 8): `{ ok: true, received: true }` on 200; `{ error }` on 4xx/5xx.
- CORS: `Access-Control-Allow-Origin: *`, methods `POST, OPTIONS`.

## 3. The deploy (free tier)

- Provider: **Cloudflare Workers** free tier via `npx wrangler deploy` (`wrangler.jsonc`).
- Static site served by Workers **Assets** (`ASSETS` binding, `public/`).
- Day 8: slice live at the stable URL above; the enquiry endpoint initially logged briefs (`logEnquiry` stub).
- Day 14: durable enquiry sink landed (below). Deploy marker: Workers version `fa4628c8` (commit `330f74c`, pushed to `main`).

## 4. Enquiry sink — day 8 → day 14

- **Day 8:** valid briefs were logged (`console.log`) only — they vanished with ephemeral Workers logs.
- **Day-14 checkpoint:** briefs are **validated and durably stored** in the Cloudflare KV namespace
  `emfines_enquiries` (key `enquiries/<timestamp>-<uuid>`, full structured payload, timestamped).
  Owner retrieves briefs with:
    `wrangler kv key list --binding emfines_enquiries`
    `wrangler kv key get <key> --binding emfines_enquiries`

## 5. Day-14 checkpoint decisions (cut scope, not quality)

- **KEEP (quality):** durable, validated, structured, timestamped storage of briefs; response contract unchanged
  so the live demo path QA runs stays stable.
- **CUT (scope):** real-time email / notification push to the owner. No free-tier, no-credentials email channel
  fits the "no paid tooling" budget, so delivery is deferred past day 30; the owner pulls from the durable store instead.

## 6. Security guardrails

- Same-host relative fetch target; server-side validation; `Access-Control-Allow-Origin: *` on the one public endpoint.
- Never log or echo secrets. Enquiry payloads contain PII (name, email, brief, photo flag) and are treated
  as "studio inbox only."

## 7. Verification (recorded 2026-09-09)

- `https://emfines-site.terry-g-zhou.workers.dev/` → HTTP 200 (site live).
- `OPTIONS https://…/v1/enquiries` → HTTP 204 (feature reachable, CORS active).
- Deploy: Cloudflare Workers version `fa4628c8` (commit `330f74c` on `main`).

## 8. Known deviations & follow-ups (hand to T3)

- **PII retention vs T2 boundary.** The T2 boundary says "no persistent database; do not store PII
  permanently; one destination: the studio email inbox." The day-14 sink stores briefs **durably in
  Cloudflare KV with no TTL** and defers email delivery. Recommend T3 (a) add a KV TTL (e.g. 30 days)
  so PII is not stored permanently, and/or (b) route briefs to the studio inbox. Recorded here; not a blocker to the live slice.
- **Repo snapshot drift.** The on-disk working clone `/home/terry/projects/emfines-site` still shows the
  day-8 `logEnquiry` stub and predates the day-14 KV commit; the vault `site/repo/` snapshot should be re-copied
  after the next deploy (per the Emfines README snapshot policy).
- **Day-19 handoff.** T2 closes by handing the bug list to QA / Demo Prep for T3.
