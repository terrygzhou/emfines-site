# Spec delta: asset-gallery

## Purpose
Extend the gallery so site brand/UI assets that live in `public/assets` are
served statically but never appear as gallery content.

## ADDED Requirements

### Requirement: UI and brand assets are excluded from the gallery
Files in a declarative UI-asset list (initially `logo.png`) that live in
`public/assets` are served as static assets but are not gallery items and are
not reported as orphan drift.
#### Scenario: Brand logo is not a gallery item
- **WHEN** `public/assets/logo.png` is on disk without a `_manifest.csv` row
  and the site is built
- **THEN** the built /gallery page does not include logo.png and the build
  reports no orphan for it
#### Scenario: Workshop photos are unaffected
- **WHEN** a new workshop photo (not in the UI-asset list) is added to
  `public/assets/` without a manifest row
- **THEN** it still appears in the gallery (fallback metadata) and is
  reported as an orphan, preserving the completeness NFR
