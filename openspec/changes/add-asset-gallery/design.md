# Design: add-asset-gallery

## Context
`public/assets/` holds 87 images (65 jpg + 22 png) plus `_manifest.csv`
(87 rows: `group,old_name,new_name,category,design,description,width,height,
bytes`) and `_rename_map.json`. The directory is fully gitignored and no
image is displayed in `src/` today. `astro.config.mjs` sets
`imageService: 'passthrough'` — originals are served verbatim, no image
pipeline (OQ-6-1: resize is a recorded follow-up). Categories: ring (19),
pendant (16), necklace (15), earring (12), brooch (10), display (8), jade
(3), set (2), studio (2). Originals are large (up to ~10 MB).

## Goals / Non-Goals
**Goals:** every image visible; category grouping + filter; captions; no CLS;
completeness preserved as assets grow; free-tier/static only.
**Non-Goals:** upload/edit UI, per-image pages, a CMS, a thumbnail/resize
pipeline, search beyond category.

## Decisions
- **Build-time generated typed manifest** (`src/generated/assets-manifest.ts`
  emitted by `scripts/generate-manifest.mjs` from the CSV + a disk scan)
  rather than runtime-fetched CSV: the page is fully server-rendered
  (completeness, a11y, CLS, works with JS off — constitution V), and the
  generator is the single drift checkpoint (NFR-3).
  - *Rejected:* runtime fetch of the public CSV — client-side only, no
    completeness guarantee at build time, and a11y/SEO weaker.
- **Cross-check semantics (OQ-6-3):** orphan files (no row) are included
  with fallback metadata (`category: 'uncategorised'`, humanized description,
  `fromManifest: false`) so completeness against disk (FR-1/AC-1) always
  holds; missing-file rows are dropped + reported so no `<img>` can 404.
  Upholds V (degrade, never a broken page) and NFR-3.
- **Pure shared logic in `src/lib/gallery.ts`** (CSV parse, `buildManifest`,
  `groupByCategory`, `filterByCategory`, `humanizeName`), consumed by the
  generator via the esbuild-bundled cache and by `tests/gallery.test.mjs` —
  same pattern as the enquiry harness (constitution VI).
- **Client filter only hides/shows server-rendered sections** (constitution
  IV: the rendered HTML is the single source of truth; no client-side data
  invention).
- **Orphans with unknown dimensions** render in a fixed aspect-ratio wrapper
  so the no-CLS guarantee (AC-4) holds even for fallback items.
- **Design language** reuses Base.astro/Header/Tailwind tokens; no new
  fonts or accent (constitution III).

## Risks / Trade-offs
- CSV descriptions contain commas → parser must handle RFC 4180 quoting
  (unit-tested with a quoted-comma fixture).
- Stale generated file → `prebuild`/`predev`/`pretest` always regenerate;
  `src/generated/` is gitignored so it can never go stale in the repo; a
  missing `public/assets/` warns and emits an empty manifest instead of
  failing.
- 87 large originals on one page → lazy-loading bounds first-paint cost;
  large-transfer concern is solved by the follow-up thumbnail pipeline
  (OQ-6-1), out of scope here.
- Build/deploy commands write outside cwd → run escalated, on the isolated
  `emfines-site-preview` worker (constitution VII).
