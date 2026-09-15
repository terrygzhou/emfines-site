# Matomo — local web analytics (self-hosted in Docker)

A LAN-only analytics box that runs alongside the public **Umami** provider.
The site ships its Matomo embed **only in a LAN build** (`MATOMO_LAN=1`), so
public visitors never send pings to this host — it is not reachable from the
internet by design.

## What it does

- Records pageviews + conversion events (`enquiry_submitted`, funnel steps)
  in a local Matomo dashboard.
- Sits next to Umami: Umami owns the **public** build's pageviews/conversions;
  this box is a complete **local** view you read on the owner's machine.
- No PII: the embed sends only page paths, referrers, and anonymous event
  names — same privacy contract as Umami.

## Quick start

```bash
cd docker/matomo
cp .env.example .env       # edit passwords / base URL
docker compose up -d
```

On first boot:
- Open `http://matomo.local:8080/install.php` — the database step is
  pre-filled from the compose env, so you only create the super-admin and add
  the `emfinestudio` website (the `matomo/core` image has no admin
  auto-bootstrap; record the credentials you choose in `.env`).
- Confirm the **website ID** (Administration → Websites → "ID"). The first
  website is usually `1`.

`matomo.local` must resolve to the Docker host — add it to `/etc/hosts`
(e.g. `192.168.1.20 matomo.local`) or point `MATOMO_APP_BASEURL` at the box's
real LAN IP/FQDN.

## Wiring it into the site

1. `src/config.ts` → `matomo.siteId` = the website's numeric ID (string).
   `matomo.host` = the box base URL, no trailing slash (default
   `http://matomo.local:8080`; update to match `.env`).
2. Build the LAN flavor (both local providers on):
   ```bash
   npm run build:lan        # = POSTHOG_LAN=1 MATOMO_LAN=1 astro build
   # or just Matomo:        MATOMO_LAN=1 npm run build
   ```
3. Local parity preview (local KV + assets, email no-ops):
   ```bash
   npm run preview
   ```
   The page's Matomo embed points at your local box; open the Matomo
   dashboard to watch pageviews + enquiry conversions land.

> The **public** build (`npm run build`) leaves Matomo (and PostHog) off —
> Umami owns every public signal, and no tag ships to a host the public
> internet cannot reach.

## Data & lifecycle

- Data lives in the `matomo-data` and `db-data` named volumes (persist across
  `docker compose up`/`down`; remove with `docker compose down -v`).
- No PII is retained; Matomo's data can be purged from the dashboard under
  Administration → Logs / Reports on demand.
