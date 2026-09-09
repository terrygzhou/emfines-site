# Design: add-enquiries-inbox

## Context
The brief archive already exists: `src/pages/api/enquiries.ts` writes JSON
records to KV `emfines_enquiries` under keys `enquiries/<ms>-<uuid>` (30-day
TTL). `src/env.d.ts` `KVNamespaceLite` exposes `list({prefix})`. Env bindings
come from `cloudflare:workers`, not `Astro.locals`. No admin surface exists
today (constitution II requires owner-gated PII access).

## Goals / Non-Goals
**Goals:** owner can list/open/handle briefs from the browser; status survives
across sessions; brief PII stays out of public routes; free-tier only.
**Non-Goals:** per-user identity or audit, multi-user accounts, permanent
brief storage, public read access.

## Decisions
- **Auth: passcode + short-lived signed session cookie** (chosen). Constant-time
  passcode compare; session = `HMAC-SHA256(SESSION_SECRET, "id|exp")`, ~12h,
  HttpOnly + SameSite=Strict. Upholds I (free tier, no new services) and VI
  (pure crypto, unit-testable).
  - *Rejected:* Cloudflare Access (per-identity + audit, free 100-user Zero
    Trust) — separate service, not unit-testable in-repo; recorded as the
    upgrade path if per-user identity/audit becomes needed.
- **Status in a second KV namespace `emfines_briefs_status`** (not the
  archive): the archive stays immutable (constitution II); status is a tiny
  expiring record with the same 30-day TTL; missing status degrades to 'new'
  (constitution V).
- **Server re-validates everything** (id shape, status value, session):
  constitution IV; ids come from the KV list, never from client state.
- **List projects without photos** (payload size; NFR): photos only on detail.

## Risks / Trade-offs
- KV `list` is lexicographic — sort by `receivedAt` in-app (key prefix has ms
  timestamp, so natural order is right; sort anyway for safety).
- Passcode leak → rotate the secret (sessions stay valid until expiry —
  acceptable for a solo studio; Access is the documented fix).
- Status/archive TTL drift → both 30d; a vanished status record degrades to
  'new' instead of erroring.
- Types: extend `EnquiryBindings` in `src/env.d.ts`; `astro check` must stay
  clean.
