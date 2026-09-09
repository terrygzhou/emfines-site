# Design: add-header-logo

## Context
`public/assets/` holds the 87 workshop images + `_manifest.csv` and, since
this change, `logo.png` (1254x1254 PNG, ~1 MB). The gallery generator
(`scripts/generate-manifest.mjs` -> `src/lib/gallery.ts::buildManifest`) turns
every disk file lacking a manifest row into an `uncategorised` orphan item, so
`logo.png` would otherwise render in the gallery. The header
(`src/components/Header.astro`) today renders only the serif wordmark link.
`astro.config.mjs` uses `imageService: 'passthrough'` (originals served
verbatim, no resize pipeline).

## Goals / Non-Goals
**Goals:** logo in the header next to the wordmark (desktop + mobile); no CLS;
graceful degradation; brand asset kept out of the gallery.
**Non-Goals:** a footer logo, a logo upload/swap UI, an image pipeline,
per-breakpoint logo variants (see Risks).

## Decisions
- **Logo left of the wordmark, both inside the home link**
  (`<a href="/"><img …> <span>EM Fine Studio</span></a>`). Keeps the existing
  single-link home affordance and the quiet-luxury header (constitution III:
  reuses tokens, one accent, no new fonts). The logo is decorative because
  the wordmark supplies the accessible name -> `alt=""` (avoids
  double-announcing the brand to screen readers).
- **Fixed 54x54 display box with explicit width/height** (`h-[54px] w-[54px]`) -> no
  layout shift, matching the gallery's no-CLS discipline.
- **Build-time availability flag -> conditional render.** The generator
  already knows which files exist, so it emits `uiAssets: string[]` (the
  UI-asset files actually on disk). The header renders the `<img>` only when
  `uiAssets` includes `logo.png`; otherwise wordmark only. Upholds constitution
  V (never ship a broken `<img>`).
  - *Rejected:* always render the `<img>` — a missing file becomes a broken
    image, violating V.
- **Declarative `UI_ASSETS` exclusion (initially `['logo.png']`).** Passed
  into `buildManifest` so UI assets are dropped from `items` and from
  `drift.orphans` (they are expected UI files, not drift). Genuine workshop
  photos added to `public/assets` are untouched (completeness NFR preserved).
  Keeps all images in one canonical directory.
  - *Rejected:* moving `logo.png` to a separate `public/logo/` dir — adds a
    second assets root and breaks the "all my images live in public/assets"
    mental model.
  - *Rejected:* a name/extension heuristic (e.g. "files starting with logo")
    — fragile and implicit.
- **One source of truth, testable.** The exclusion and the `uiAssets` flag
  come from the same `buildManifest` call consumed by the generator and the
  esbuild-bundled unit tests (constitution VI).

## Risks / Trade-offs
- `logo.png` is ~1 MB / 1254x1254 but displayed at 54x54 -> wasteful
  transfer. Follow-up (with the OQ-6-1 thumbnail pipeline): serve a small logo
  variant. Out of scope here (passthrough retained).
- `public/assets/` is fully gitignored, so the owner's `logo.png` is not in
  git (consistent with the other 87 assets); availability is detected at
  build time, so a fresh checkout without the file ships wordmark-only.
- Build/deploy run escalated on the isolated `emfines-site-preview` worker
  (constitution VII); production `emfines-site` is never touched by previews.
