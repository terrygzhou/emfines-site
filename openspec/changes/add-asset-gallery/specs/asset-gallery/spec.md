# Spec delta: asset-gallery

## Purpose
A public page that displays every image in `public/assets` — complete against
the files on disk, grouped by category, filterable, captioned, and
no-layout-shift — so studio work is visible without any upload or CMS.

## ADDED Requirements

### Requirement: Completeness against disk
The gallery displays every image file present in `public/assets`; the
rendered image count equals the on-disk image count, never a hardcoded subset.
#### Scenario: All images render
- **WHEN** the built /gallery page is loaded with 87 image files on disk
- **THEN** exactly 87 <img> elements point at /assets/ files that return 200
#### Scenario: An unlisted image still appears
- **WHEN** an image file exists on disk without a manifest row and the site is
  rebuilt
- **THEN** the image appears in the gallery (fallback metadata, e.g. category
  "uncategorised") and the build reports it as an orphan

### Requirement: Category grouping and filtering
Images are grouped by manifest category; a client-side filter shows one
category (or all) with no page reload.
#### Scenario: Filter to a category
- **WHEN** the visitor selects "ring" in the filter
- **THEN** only ring-category items are visible without a page reload, and
  "All" restores everything
#### Scenario: Gallery works with JavaScript disabled
- **WHEN** /gallery is loaded with JS disabled
- **THEN** the full gallery is still visible (all sections server-rendered)

### Requirement: Captions
Each image shows its manifest description as a visible caption and as the
image alt text.
#### Scenario: Caption and alt match the manifest
- **WHEN** an image with description D is rendered
- **THEN** its <figcaption> shows D and its <img alt> equals D

### Requirement: No-layout-shift rendering
Every image declares explicit width/height and lazy/async loading.
#### Scenario: Attributes present on every image
- **WHEN** /gallery HTML is inspected after a build
- **THEN** every <img> has width/height attributes and loading="lazy" and
  decoding="async" (unknown-dimension orphans render in a fixed aspect-ratio
  wrapper)

### Requirement: Discoverability
The gallery is reachable from the site navigation and from /pieces, and is
usable on phone and desktop.
#### Scenario: Nav + pieces link
- **WHEN** a visitor is on the header nav or the /pieces page
- **THEN** a Gallery link leads to /gallery
#### Scenario: Mobile layout
- **WHEN** /gallery is viewed on a phone viewport
- **THEN** the grid is navigable and images lazy-load without horizontal
  overflow

### Requirement: Build-time drift report
The build cross-checks the manifest against the files on disk and reports
drift instead of failing silently.
#### Scenario: Manifest row missing its file
- **WHEN** a manifest row names a file that is absent and the site is built
- **THEN** the build output reports the missing file, the image is excluded
  from the gallery (no broken <img>), and the build succeeds
#### Scenario: Clean build
- **WHEN** the manifest and disk agree
- **THEN** the build reports zero drift

### Requirement: Maintainer round-trip
Adding a new image plus a manifest row shows it in the gallery on the next
build with no code change.
#### Scenario: Add an image
- **WHEN** a new image file and its manifest row are added to public/assets/
  and the site is rebuilt
- **THEN** the image appears in the correct category with its caption, and
  removing them restores the previous state

### Requirement: Public, PII-free
The gallery is public and contains no PII.
#### Scenario: No auth, no PII
- **WHEN** an anonymous visitor opens /gallery
- **THEN** it renders without authentication and shows no brief PII
