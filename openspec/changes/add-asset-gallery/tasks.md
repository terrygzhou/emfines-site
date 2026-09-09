# Tasks: add-asset-gallery

## 1. Data foundation (generator + pure logic)
- [x] 1.1 TDD `src/lib/gallery.ts` (`tests/gallery.test.mjs`): `AssetItem` type, `parseManifestCsv` (quoted fields), `buildManifest(rows, diskFiles)` cross-check (missing-file rows dropped + reported; orphans included with fallback metadata), `groupByCategory`, `filterByCategory` ('all' passthrough), `categoryCounts`, `humanizeName` — "An unlisted image still appears" / "Filter to a category" / "Manifest row missing its file"
- [x] 1.2 `scripts/generate-manifest.mjs` (Node builtins only): read `public/assets/_manifest.csv` + scan the directory, import the bundled `node_modules/.cache/gallery.mjs`, write `src/generated/assets-manifest.ts`, print the drift report; warn-and-continue when `public/assets/` is absent. Wire `package.json` `prebuild`/`predev` (bundle + generate) and `pretest` (bundle); `.gitignore += src/generated/`. Verify: `npm run build` (escalated) emits the manifest, zero drift at authoring time, AC count = 87 — "All images render" / "Clean build"

## 2. Page & navigation
- [x] 2.1 `src/pages/gallery.astro` (`export const prerender = true`): per-category sections (title + count); each item a <figure> with <img src="/assets/<name>" width height loading="lazy" decoding="async" alt="<description>"> + <figcaption>; orphan items in a fixed aspect-ratio wrapper; responsive CSS grid (2 → 3–4 columns) — "Captions" / "No-layout-shift rendering" / "Mobile layout"
- [x] 2.2 TDD-free `src/scripts/gallery-filter.ts` (`initGalleryFilter()`, imported from the page like contact-form.ts): "All" + per-category buttons (labels with counts), aria-pressed, toggle section visibility, no reload/refetch; keyboard-focusable; full gallery still visible with JS off — "Filter to a category" / "Gallery works with JavaScript disabled"
- [x] 2.3 `Header.astro`: add { href: '/gallery', label: 'Gallery' } (desktop + mobile navs); `pieces.astro`: add a "Browse the gallery" link to /gallery — "Nav + pieces link"

## 3. Verify & deploy (isolated preview)
- [x] 3.1 Maintainability round-trip (NFR): add a temp image + manifest row and an orphan file to public/assets/ → `npm run build` → both appear (orphan under "uncategorised"), drift report lists the orphan → remove them, rebuild, clean zero-drift — "Add an image"
- [x] 3.2 `npm run build` (escalated): drift report zero; /gallery HTML has exactly as many <img> as on-disk image files, each with width/height + loading="lazy", alt = description; `npx astro check` 0 issues; `npm test` green — "All images render" / "Caption and alt match the manifest" / "No-layout-shift rendering"
- [x] 3.3 `npx wrangler deploy --config dist/server/wrangler.json --name emfines-site-preview` (escalated); live-verify on emfines-site-preview.terry-g-zhou.workers.dev: browse / filter / captions, mobile viewport, all /assets/ URLs 200, no CLS on 4G (Chrome DevTools) — "Mobile layout" / "Public, PII-free"
