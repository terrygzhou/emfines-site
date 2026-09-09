# EMF-11 — Design Research & HTML Samples

Five design-exploration options built from a research pass over seven
jewellery brand websites (Michael Hill AU, Tiffany & Co. AU, Pandora AU,
Sarah & Sebastian, by charlotte, EVRYJEWELS, Swarovski AU).

Open any `*.html` directly in a browser — each is a self-contained,
responsive sample (zero external assets; images are CSS gradient
placeholders).

For client review, open `compare.html` — a single self-contained
selection page with all five options embedded as live previews (via
`srcdoc` iframes), palette swatches, and a click-to-select UI
(persisted in localStorage). No network or sibling files required —
it works by double-clicking the one file, anywhere.

Previews are snapshots of the sample files at generation time. After
editing any `0N-*.html` sample, regenerate with:

    python3 make-compare.py

("Open sample file ↗" links in the page always point at the live
sample files when the folder is available.)

| File | Purpose |
|---|---|
| `compare.html` | Client selection page — all five options in one file |

| Sample | Aesthetic | Research inspiration |
|---|---|---|
| `01-classic-luxe.html` | Heritage house-jewel: ivory + deep blue, serif display, quiet luxury | Tiffany & Co. AU (Blue Book campaigns, "Icons" merchandising, gifting services) |
| `02-editorial-soft.html` | Warm boutique: soft neutrals, story-driven keepsake framing, rounded imagery | by charlotte ("Your Lotus Story", Bridal Journey), Sarah & Sebastian (warm light-grey canvas, Calibre/Spyre type) |
| `03-dark-gem.html` | Gemstone-led dark mode: near-black canvas, gold accent, sale urgency + advisory content | Michael Hill AU (#0d0d0f/#131313 palette, "30% off selected", advisor/finance blocks) |
| `04-minimal-canvas.html` | Bright catalogue: white canvas, pink pops, pill buttons, promo energy | Pandora AU (sale-forward homepage, EXTRA20 code banner, Disney collabs, best-sellers) |
| `05-avant-garde.html` | Fashion-forward: monochrome + signature red, oversized uppercase type, full-bleed cinematic media | Swarovski AU + EVRYJEWELS (campaign-driven, bold type, Inter/system stacks, statement scale) |

## Shared design observations across all seven brands

- **Jewellery sites are image-first.** Every researched site leads with a
  full-bleed or near-full-bleed hero campaign and merchandises by
  collection, not by category.
- **Two clear design camps:** (1) heritage/quiet-luxury (Tiffany, Michael
  Hill, Sarah & Sebastian — dark text, restraint, serif display, white or
  near-white canvas) and (2) campaign/pulse (Pandora, EVRY, Swarovski —
  bright canvas, high-contrast accent, promotional urgency).
- **Trust and service blocks** (virtual advisors, flexible finance,
  reserve-now, gifting/concierge) are standard mid-page content across all
  seven — they deserve a fixed slot, not an ad-hoc banner.
- **Type systems:** luxury houses pair a display serif (Didot/Canela/BST
  Spyre-class) with a humanist sans body; campaign-led brands use all-sans
  stacks (Inter/Montserrat-class) with heavy weights and wide tracking for
  brand/eyebrow text.
- **Accent discipline:** each house leans on exactly one signature accent
  (Tiffany blue, Pandora pink/red, Swarovski red). The five samples below
  keep that discipline — one accent per option.

## Suggested next step

Board to pick one direction (or blend of directions); a second issue can
then build the canonical theme (tokens, components) for the emfines-site
Astro project against it.

## Fixes applied during review (2026-09-09)

- Hero copy was rendering un-substituted template placeholders
  (`{theme["hero_h1"]}` / `{theme["hero_sub"]}`) in all five samples —
  replaced with per-option copy.
- Options 03/04/05 had option-specific CSS overrides written as
  `selector{{...}}` (doubled braces), which browsers silently discard as
  invalid nesting — corrected to `selector{...}` so the announce-bar,
  pill-button and cinematic-hero overrides now apply.
