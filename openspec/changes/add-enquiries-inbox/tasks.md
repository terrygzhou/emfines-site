# Tasks: add-enquiries-inbox

## 1. Data & auth foundation
- [ ] 1.1 Add `emfines_briefs_status` to `wrangler.jsonc` `kv_namespaces`; extend `EnquiryBindings` in `src/env.d.ts` with `emfines_briefs_status: KVNamespaceLite`, `ADMIN_PASSCODE?: string`, `SESSION_SECRET?: string`; `npx astro check` clean
- [ ] 1.2 TDD `src/lib/admin-auth.ts` (`tests/admin-auth.test.mjs`): constant-time `verifyPasscode`; `signSession`/`verifySession` (HMAC-SHA256, Web Crypto); `requireAuth` helper — "Valid passcode mints a session" / "Invalid or missing passcode is rejected"
- [ ] 1.3 TDD `src/lib/brief-status.ts` (`tests/brief-status.test.mjs`): `BriefStatus`, `statusKey`, `markStatus`, `readStatus` (missing → 'new') — "Missing status degrades to new"

## 2. Auth-gated admin API
- [ ] 2.1 `src/pages/api/admin/briefs.ts` GET: KV `list({prefix:'enquiries/'})`, fetch + project to {id,kind,summary,receivedAt,status} (no photos), sort by receivedAt desc, `?status=&cursor=&limit=`, auth-gated — "Unauthenticated list request is rejected" / "Authenticated owner gets a projected list"
- [ ] 2.2 `src/pages/api/admin/briefs/[id].ts` GET: fetch record, re-validate id shape, include photos + status; 404 unknown — "Known brief id returns the full record" / "Unknown id is a 404"
- [ ] 2.3 POST on the same route: body {status} in new|handled, re-fetch record (400/404), `markStatus` — "Mark a brief handled" / "Invalid status value is rejected"
- [ ] 2.4 `POST /api/admin/login` (passcode → Set-Cookie HttpOnly, SameSite=Strict, ~12h) and `POST /api/admin/logout` (clears); 401 on bad passcode

## 3. Owner UI
- [ ] 3.1 `src/pages/inbox.astro` (gate + list, newest-first, status filter) + `src/pages/inbox/[id].astro` (detail + photos + mark handled) reusing Base.astro + Tailwind tokens; `src/scripts/inbox.ts` (fetch/render/act, attribute-free script block) — "Signed-out owner sees the gate"
- [ ] 3.2 States: empty ("No new briefs"), not-found, error/401 → redirect to gate; a11y labels/keyboard

## 4. Verify & deploy (isolated preview)
- [ ] 4.1 Seed 2–3 sample briefs (one with photos) into local KV; `npm run preview`; walk sign-in → list → detail → mark-handled end-to-end; verify signed-out requests reach no PII
- [ ] 4.2 `npx astro check` 0 issues; `npm test` green
- [ ] 4.3 `npx wrangler deploy --config dist/server/wrangler.json --name emfines-site-preview` (escalated); set `ADMIN_PASSCODE`/`SESSION_SECRET` secrets on the preview worker; live smoke on the preview URL (production `emfines-site` untouched)
