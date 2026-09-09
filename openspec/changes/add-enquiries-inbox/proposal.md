# Proposal: add-enquiries-inbox

## Why
Custom-design briefs currently land only as email in the studio inbox. The owner
needs a durable, queryable owner-side inbox — list, detail with photos, and
"handled" tracking — without a CMS or permanent database, and without exposing
brief PII on the public site.

## What Changes
- New expiring KV namespace `emfines_briefs_status` (per-brief status records,
  30-day TTL aligned to the brief archive).
- New owner UI: `/inbox` (sign-in gate + list) and `/inbox/[id]` (detail,
  photos, mark handled).
- New auth-gated admin API under `/api/admin/` (login, logout, briefs list,
  brief detail, status write) with a passcode + short-lived signed session
  cookie.
- Pure, unit-tested logic modules for auth and status; new Worker secrets
  (`ADMIN_PASSCODE`, `SESSION_SECRET` — set per environment, never in git).
- Non-goals: per-user identity/audit, multi-user accounts, a permanent brief
  store, public exposure of brief data, CMS.

## Capabilities

### New Capabilities
- `enquiries-inbox`: auth-gated owner inbox over the immutable brief archive
  (list / detail / mark-handled / sign-in) with expiring status records.

### Modified Capabilities
- None (the public enquiry endpoint and its archive behaviour are unchanged).

## Impact
- `wrangler.jsonc` (+`emfines_briefs_status` KV binding; secrets set per env)
- `src/lib/admin-auth.ts`, `src/lib/brief-status.ts` (new, pure)
- `src/pages/api/admin/{login,logout,briefs,briefs/[id]}.ts` (new server routes)
- `src/pages/inbox.astro`, `src/pages/inbox/[id].astro`, `src/scripts/inbox.ts`
- `src/env.d.ts` (extend `EnquiryBindings`)
- No public-route changes; constitution principles II (PII isolation) and IV
  (server re-validation) are enforced by the new API layer.
