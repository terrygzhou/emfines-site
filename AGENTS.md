# AGENTS.md

EM Fine Studio website — Astro 7 (`output: 'server'`, 6 prerendered pages + 1
server endpoint `POST /api/enquiries`) on Cloudflare Workers, deployed via
`wrangler` to the `emfines-site` worker (routes: emfinestudio.com). npm +
`package-lock.json`.

## CI/CD monitoring — after every `git push`

After any push to this repo, monitor the resulting pipeline run. Do not just
say "pushed — check CI yourself":

1. Wait ~20s, find the new run:
   ```bash
   gh run list --branch main --limit 1
   ```
   (commit message should match what you just pushed)
2. Watch it to completion:
   ```bash
   gh run watch <run-id> --exit-status
   ```
3. **Success** → report run ID + link; note that a `Deploy to production`
   job may stay *pending* until someone approves the `prod` environment in
   GitHub.
4. **Failure** → get logs, fix, re-push, and repeat from step 1 until the
   CI job passes:
   ```bash
   gh run view <run-id> --log-failed
   ```
   - `Install dependencies` failure → npm issue (repo uses npm +
     `package-lock.json`; keep the lockfile in sync with `package.json`)
   - `Check`/`Lint & typecheck` failure → `npm run check` (`astro check`);
     fix the type/template diagnostics
   - `Build` failure → `npm run build` (`astro build`); check the Astro
     errors — remember `prebuild` also runs esbuild bundling +
     `scripts/generate-manifest.mjs`, so a failed build can be a manifest
     or bundle error, not just a page error
   - `Deploy` failure → `wrangler deploy --config dist/server/wrangler.json`;
     check Cloudflare auth/network (KV namespace + zone routes must be
     reachable)

Notes:
- **This repo currently has no GitHub Actions workflows** (`gh workflow list`
  is empty). If `gh run list` returns nothing, there is nothing to monitor —
  verify the push landed (`git log origin/main -1`) and deploy locally
  instead (below). If a pipeline is added later, this section applies.
- `gh` and other network commands may need sandbox escalation — use
  `require_escalated` rather than giving up.
- A *pending* deploy job (prod approval gate) is expected, not a failure.
- Deploying locally: `npm run deploy` (build + `wrangler deploy` to the
  `emfines-site` worker; zone routes point emfinestudio.com / www at the
  script, not a service).

## Validation — before pushing / before claiming done

Run these in order; all must pass:

1. `npm run check` — `astro check`: type + template diagnostics.
2. `npm test` — `node --test` unit tests for the pure enquiry logic
   (validation + email composition). Run via `npm test`, never
   `node --test` directly: `pretest` bundles `src/lib/enquiry.ts` and
   `src/lib/gallery.ts` with esbuild first.
3. `npm run build` — full build; must succeed and regenerate `dist/`
   (`dist/` is a gitignored local build output — do NOT commit it; commit
   the source change and ensure the build passes before deploy).
4. Runtime smoke test (optional, prod-parity):
   ```bash
   npm run preview   # wrangler dev against dist/server (local KV + assets, email no-ops)
   ```
   - `GET /` returns 200; `POST /api/enquiries` validates (local KV +
     email are no-ops in preview).
   - `wrangler dev` may need sandbox escalation (binds local network
     interfaces).

## Project notes

- Never edit `dist/` by hand — it is generated (and gitignored). Edit source,
  rebuild, and commit the source change. `dist/` and `src/generated/`
  are gitignored local outputs (do NOT commit them); but `public/assets/`
  (gallery images + `_manifest.csv` + logo) **is** committed (EMF-36) so
  any clean/CI checkout can build and deploy a full, image-bearing site —
  Cloudflare replaces the whole /assets/* set on each `wrangler deploy`,
  so the images must be reachable in git (an image-less deploy wipes the
  live /assets/* set; the EMF-33 `scripts/guard-deploy-assets.mjs` guard
  still runs on `npm run deploy` as defense-in-depth).
- `ENQUIRY_TO` / `ENQUIRY_FROM` are wrangler secrets (Cloudflare Email
  Service) — never commit them; set via `wrangler secret put`.
- Enquiries land in KV namespace `emfines_enquiries` with a 30-day TTL per
  key; keep that TTL at write time.
