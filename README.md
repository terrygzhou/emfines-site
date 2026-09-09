# emfines-site

Official website of Emfines (EM Fine Studio) - static site + one online feature,
deployed as a single Cloudflare Workers vertical slice on the free tier.

## Stack
- Static site in `public/` (no framework, no build step) served by Workers Assets.
- `worker.js` handles `POST /v1/enquiries` (the custom-design / repair brief flow).
- `wrangler.jsonc` binds the Assets directory and a Cloudflare KV namespace
  (`emfines_enquiries`) for durable enquiry storage.

## Enquiry flow (the one online feature)
1. Contact form (`public/js/enquiry.js`) POSTs JSON to same-origin `/v1/enquiries`.
2. Worker validates `name` + valid `email` + `interest` (budget / brief / photo flag optional).
3. Valid briefs are persisted to the `emfines_enquiries` KV namespace so they do
   not vanish with ephemeral Workers logs.
4. Invalid / malformed input -> 400; non-POST -> 405; store failure -> 500.

## Day-14 checkpoint decisions (cut scope, not quality)
- KEEP (quality): durable KV storage for briefs; validated, structured, timestamped.
- CUT (scope): real-time email / notification push to the owner. No free-tier,
  no-credentials email channel fits the "no paid tooling" budget, so delivery is
  deferred past day 30. The owner retrieves briefs from the durable store:
    wrangler kv key list --binding emfines_enquiries
    wrangler kv key get <key> --binding emfines_enquiries

## Deploy
    npx wrangler deploy
Stable free-tier URL: https://emfines-site.terry-g-zhou.workers.dev
