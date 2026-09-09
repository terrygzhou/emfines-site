# Proposal: add-header-logo

## Why
The site currently identifies the studio only via the serif "EM Fine Studio"
wordmark; the owner's `logo.png` (1254x1254, `public/assets/logo.png`) is
unused. The owner wants the studio logo shown in the sticky header next to the
wordmark, on both desktop and mobile.

## What Changes
- Header (desktop + mobile) shows `logo.png` to the left of the "EM Fine
  Studio" wordmark, inside the home link; a fixed 54x54 box -> no layout
  shift; the image degrades to wordmark-only if the file is absent
  (build-time availability flag).
- Because `public/assets/` is the gallery's data source and any disk file
  missing from `_manifest.csv` renders as an `uncategorised` orphan, the brand
  asset must be excluded from the gallery. A declarative `UI_ASSETS` set
  (initially `logo.png`) is added to the generator: these files are served
  statically but are never gallery items and are not reported as drift.
- The generated manifest additionally reports which `UI_ASSETS` are present
  (`uiAssets`), which the header uses as its render flag.

## Non-goals
No logo in the footer or elsewhere; no logo upload/swap UI; no image pipeline
or per-breakpoint variants (see design Risks).

## Capabilities

### New Capabilities
- `site-brand`: the studio logo is displayed in the sticky header next to the
  wordmark (desktop + mobile), no layout shift, degrading gracefully when the
  file is absent.

### Modified Capabilities
- `asset-gallery`: adds a requirement that site brand/UI assets present in
  `public/assets` are excluded from the gallery (neither items nor orphan
  drift), while genuine workshop photos added to `public/assets` still appear.

## Impact
- `src/lib/gallery.ts` (`UI_ASSETS`, `buildManifest` exclusion + `uiAssets`,
  `BuildResult.uiAssets`), `tests/gallery.test.mjs`
- `scripts/generate-manifest.mjs` (pass exclusion, emit `uiAssets`),
  `src/generated/assets-manifest.ts` (regenerated, gitignored)
- `src/components/Header.astro` (logo render + home link)
- `public/assets/logo.png` (owner brand asset; gitignored with the rest of
  `public/assets/`)
- No new endpoints, dependencies, KVs, or paid tooling; free-tier static only.
