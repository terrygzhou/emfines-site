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

## Funnels (customer journey)

Two funnel reports live in the shared Umami instance (type `funnel`, 60-min step window):

| Report | ID | Steps |
|--------|----|-------|
| Design funnel | `7e85304f-…` | `/` → `/design` → event `design_enquiry_submitted` |
| Contact funnel | `b84d1870-…` | `/` → `/contact` → event `contact_enquiry_submitted` |

The conversion events fire from the form success handlers
(`src/scripts/enquiry-form.ts`, `src/scripts/contact-form.ts`) via
`trackConversion()` in `src/lib/analytics.ts` — single-owner rule: PostHog owns
events when present, Umami is the fallback. No PII is sent (only path + event name).

**View the live funnel:** `http://pop-os:3102/websites/<site-id>/reports` → pick
"Design funnel" or "Contact funnel". Each step shows visitors, drop-off, and
conversion rate for the selected date range.

**Create more funnels (API, local only):**
```bash
TOKEN=$(curl -s -X POST http://pop-os:3102/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"<umami-admin-password>"}' | jq -r .token)

curl -s -X POST http://pop-os:3102/api/reports \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"websiteId":"<site-id>","type":"funnel","name":"My funnel",
       "parameters":{"window":60,"steps":[
         {"type":"path","value":"/"},
         {"type":"path","value":"/design"},
         {"type":"event","value":"design_enquiry_submitted"}]}}'
```
Step `type` is `"path"` (URL path match) or `"event"` (custom-event name match);
window is the minutes allowed between successive steps. Query a report's data:
`POST /api/reports/funnel` with `{"websiteId","type":"funnel","filters":{},
"parameters":{"reportId","window":60,"steps":[…],"startDate","endDate"}}`.
