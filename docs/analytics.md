# Web analytics (Umami)

All sites feed ONE shared, locally-hosted Umami dashboard.

## Hosts
- **LAN dashboard (source of truth):** `http://pop-os:3102` — LAN-only, http-only,
  not internet-reachable. Used by `POSTHOG_LAN=1` builds.
- **Public endpoint per site:** an HTTPS URL (e.g. a Cloudflare tunnel) that real
  visitors can reach. A plain LAN `http://` URL can't serve internet visitors
  (mixed-content block + hostname unresolvable off-LAN), so public builds always
  use a reachable HTTPS host.

## Per-site config (`src/config.ts` → `ANALYTICS.umami`)
- **`host` is build-flavored:**
  - public build (default)  → the site's public HTTPS endpoint
  - LAN build (`POSTHOG_LAN=1`) → `http://pop-os:3102`
- **`websiteId` is PER SITE.** Each site has its own "Website" in the shared Umami
  instance so traffic never mixes. Create it in Umami
  (`Websites → New Website`, set the site's domain) and paste the UUID here.
  **If it's not listed at `http://pop-os:3102/websites`, the ID here is from a
  different/older instance — create it in `:3102` and use that instance's ID.**
- **`enabled: true`** only once the Website exists in `:3102`.

## Verify
Open `http://pop-os:3102/websites` and confirm the site is there; pageviews appear
after a `POSTHOG_LAN=1` build and a local page view.
