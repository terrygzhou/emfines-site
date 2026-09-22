# Matomo — web analytics (self-hosted, public via tunnel)

> **Superseded for emfinestudio.com** — the site now ships its Matomo embed in
> **every build** (public + LAN), pointed at the running Matomo box in
> `/home/terry/projects/matomo-src` (project `matomo-src`, Docker container
> `matomo`, image `matomo-local:5.13.0`, PHP 8.2 FPM + nginx, Matomo 5.13.0,
> published `0.0.0.0:3104->80`), exposed publicly via the Cloudflare tunnel
> `matomo.eywalink.org` (the same public-tunnel pattern as Umami).
>
> The site for emfinestudio.com is **site 3** (created 2026-09-20):
> `https://emfinestudio.com`, timezone `Australia/Melbourne`, currency AUD.
> Existing sites in that box: 1 = eywalink.org, 2 = terrygzhou.github.io.
>
> `src/config.ts` → `matomo.enabled: true`, `siteId: '3'`,
> `host: 'https://matomo.eywalink.org'`. Matomo ships in every build; the
> `MATOMO_LAN` build flag only switches the Umami host to the LAN box.
>
> This compose stack is kept for reference / standalone local testing —
> it is **not** the stack the site talks to.

## What it does

- Records pageviews + conversion events (`enquiry_submitted`, funnel steps)
  in a Matomo dashboard.
- Sits next to Umami: Umami owns the cookieless pageview/conversion signal
  (its strength, DNT-friendly); Matomo is a self-hosted second stream the
  owner can read locally and publicly.
- No PII: the embed sends only page paths, referrers, and anonymous event
  names — same privacy contract as Umami.

## Quick start (standalone / reference)

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
2. Build any flavor:
   ```bash
   npm run build          # Matomo ships in every build
   npm run build:lan      # LAN flavor: Umami targets the local box
   ```
3. Local parity preview (local KV + assets, email no-ops):
   ```bash
   npm run preview
   ```
   The page's Matomo embed points at the public tunnel; open the Matomo
   dashboard to watch pageviews + enquiry conversions land.

## Data & lifecycle

- Data lives in the `matomo-data` and `db-data` named volumes (persist across
  `docker compose up`/`down`; remove with `docker compose down -v`).
- No PII is retained; Matomo's data can be purged from the dashboard under
  Administration → Logs / Reports on demand.
