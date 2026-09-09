# Tasks: add-header-logo

## 1. Pure logic (test-first)
- [x] 1.1 `src/lib/gallery.ts`: export `UI_ASSETS` (Set, initially `logo.png`);
  `buildManifest(rows, diskFiles, excluded = UI_ASSETS)` drops excluded files
  from `items` and from `drift.orphans`; add `uiAssets: string[]` to
  `BuildResult` (the excluded files actually on disk). Extend
  `tests/gallery.test.mjs` (esbuild-bundled): "logo excluded from items +
  orphans, present in uiAssets" / "a workshop photo not in the UI list is
  still an orphan + uncategorised item" / "absent logo -> uiAssets empty"
  — "Brand logo is not a gallery item" / "Workshop photos are unaffected" /
  "Missing logo -> wordmark only"

## 2. Generator + header
- [x] 2.1 `scripts/generate-manifest.mjs`: pass `UI_ASSETS` into
  `buildManifest`; stop warning on UI-asset "orphans"; emit `uiAssets` into
  `src/generated/assets-manifest.ts`. Verify `npm run build` (escalated) shows
  no unexpected drift and the generated module exposes `uiAssets` — "UI and
  brand assets are excluded from the gallery"
- [x] 2.2 `src/components/Header.astro`: import the generated `uiAssets`; in
  the `/` link render the logo `<img src="/assets/logo.png" width height
  (54x54) alt="" class="h-[54px] w-[54px] shrink-0" loading="eager">` to the left of the
  wordmark, desktop + mobile, only when `uiAssets` includes `logo.png` —
  "Desktop header shows logo + wordmark" / "Mobile header shows the logo" /
  "Logo navigates home" / "Stable header height"

## 3. Verify & deploy (isolated preview)
- [x] 3.1 `npm test` green (new + existing); `npx astro check` 0 issues
- [x] 3.2 `npm run build` (escalated): /gallery HTML excludes logo.png;
  header HTML contains the logo <img> with width/height + alt="";
  `/assets/logo.png` returns 200 in dist — "Stable header height" / "Brand
  logo is not a gallery item"
- [x] 3.3 `npx wrangler deploy --config dist/server/wrangler.json --name
  emfines-site-preview` (escalated); live-verify on
  emfines-site-preview.terry-g-zhou.workers.dev: header logo on desktop +
  mobile viewport, logo 200, /gallery has no logo, and wordmark-only when the
  file is absent (spot-check by temporarily moving it aside) — "Mobile header
  shows the logo" / "Missing logo -> wordmark only"
