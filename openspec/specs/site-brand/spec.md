# site-brand Specification

## Purpose
The studio's brand logo is displayed in the sticky site header, next to the
"EM Fine Studio" wordmark, on desktop and mobile — with no layout shift and
never a broken image.

## Requirements

### Requirement: Header logo next to the wordmark
The sticky header shows the studio logo immediately to the left of the
"EM Fine Studio" wordmark; the logo and wordmark form a single home link on
both the desktop nav and the mobile menu.
#### Scenario: Desktop header shows logo + wordmark
- **WHEN** a visitor opens any page on desktop
- **THEN** the header shows the logo to the left of the "EM Fine Studio"
  wordmark
#### Scenario: Mobile header shows the logo
- **WHEN** the header is viewed in a phone viewport
- **THEN** the logo is still shown next to the wordmark without horizontal
  overflow

### Requirement: Logo is a home link
The logo (with the wordmark) is part of the home link.
#### Scenario: Logo navigates home
- **WHEN** a visitor on an inner page clicks the logo
- **THEN** the browser navigates to `/`

### Requirement: No layout shift
The header logo reserves a fixed box so it never shifts the header height or
its neighbours.
#### Scenario: Stable header height
- **WHEN** the header HTML is inspected after a build
- **THEN** the logo <img> has explicit width and height attributes and the
  header height is unchanged whether or not the image has finished loading

### Requirement: Graceful degradation when the file is absent
The header decides at build time whether the logo file is present and renders
the image only in that case; when it is absent the header shows the wordmark
only and the build succeeds.
#### Scenario: Missing logo -> wordmark only
- **WHEN** `logo.png` is not present in `public/assets/` and the site is
  built
- **THEN** the header renders the wordmark with no logo and no broken image,
  and the build succeeds
