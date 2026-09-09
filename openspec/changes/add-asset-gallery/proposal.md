# Proposal: add-asset-gallery

## Why
The studio's 87 piece photos live in `public/assets/` with a `_manifest.csv`
describing each, but **none are displayed anywhere on the site**. The owner
wants every image shown in a public, grouped, filterable, captioned gallery —
with the set staying complete as photos are added over time.

## What Changes
- New public page `/gallery`: all images grouped by category, client-side
  category filter, visible captions, no-layout-shift lazy loading.
- Build-time generator (`scripts/generate-manifest.mjs`, run via `prebuild`
  and `predev`) reads `public/assets/_manifest.csv`, cross-checks the files on
  disk, and emits a typed `src/generated/assets-manifest.ts` (gitignored);
  drift (missing-file rows, orphan files) is reported at build time.
- Pure helper module `src/lib/gallery.ts` (CSV parse, cross-check, grouping,
  filtering) shared by the generator and unit tests via the existing
  esbuild-bundle harness.
- Nav link (Header) + a "Browse the gallery" link from `/pieces`.
- Non-goals: upload/edit UI, per-image detail pages, a CMS, an image
  resize/thumbnail pipeline (follow-up), search beyond the category filter.

## Capabilities

### New Capabilities
- `asset-gallery`: public, complete, category-grouped gallery of every image
  in `public/assets`, generated at build time from the manifest + disk
  cross-check.

### Modified Capabilities
- None (T1's "photos are swap-in slots" decision applied to hero/pieces
  sections; a dedicated gallery page does not contradict it).

## Impact
- `package.json` (`prebuild`/`predev`/`pretest` wiring), `.gitignore` (+`src/generated/`)
- `src/lib/gallery.ts` (new, pure), `scripts/generate-manifest.mjs` (new)
- `src/pages/gallery.astro` (new), `src/scripts/gallery-filter.ts` (new)
- `src/components/Header.astro` (nav link), `src/pages/pieces.astro` (link)
- No new endpoints, dependencies, KVs, or paid tooling; free-tier static only.
