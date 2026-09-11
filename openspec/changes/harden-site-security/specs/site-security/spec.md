# Spec delta: site-security (NEW capability)

## Purpose

Observable security behaviour of the deployed site: the public enquiry
endpoint must resist abuse and data poisoning (bounded, content-validated
inputs; no cross-origin read access; rate limiting), and every public
response must carry defensive browser headers. Tracks `reports/security-review.md`
findings M-1, M-2, L-1, L-3, L-5.

## ADDED Requirements

### Requirement: Enquiry text fields are bounded
The `/api/enquiries` endpoint SHALL reject any design-enquiry or contact field
longer than its maximum length: `name` ≤ 100, `phone` ≤ 40, `pieceTypeOther`
≤ 100, `gemstones` ≤ 500, `brief` ≤ 4 000, `message` ≤ 4 000 characters
(measured after trimming). A rejected request SHALL return HTTP 400 with a
JSON `error` string naming the violating field; a request within every limit
and otherwise valid SHALL be stored and accepted exactly as before.

#### Scenario: Over-long brief is rejected
- **WHEN** a design enquiry is POSTed whose trimmed `brief` is 4 001
  characters and all other fields are valid
- **THEN** the response is 400, the JSON body's `error` names `brief`, and
  nothing is written to the KV archive

#### Scenario: Over-long contact message is rejected
- **WHEN** a contact enquiry is POSTed whose trimmed `message` is 4 001
  characters and all other fields are valid
- **THEN** the response is 400 and the JSON body's `error` names `message`

#### Scenario: Bounded valid request still accepted
- **WHEN** a design enquiry at exactly the maximum lengths (e.g. `brief` of
  4 000 characters, all other rules satisfied) is POSTed
- **THEN** the response is 200 `{ "ok": true, … }` and the enquiry is stored

### Requirement: Photo payloads must be real base64 images
For each accepted design-enquiry photo data URL, the base64 payload SHALL be
restricted to the base64 alphabet (plus padding), and the decoded bytes SHALL
begin with the magic bytes of the declared MIME type — JPEG `FF D8 FF`,
PNG `89 50 4E 47`, WebP `RIFF … WEBP`. A photo that violates either check
SHALL be rejected with a per-photo `photos[i]` error and HTTP 400; no
partially-accepted request SHALL be written to the KV archive.

#### Scenario: Non-base64 payload rejected
- **WHEN** a design enquiry is POSTed with `photos[0]` of a valid size but
  containing characters outside the base64 alphabet
- **THEN** the response is 400 and the `error` string contains `photos[0]`

#### Scenario: Magic bytes must match the declared type
- **WHEN** a design enquiry is POSTed with `photos[0]` declared
  `image/jpeg` whose decoded bytes do not begin `FF D8 FF`
- **THEN** the response is 400 and the `error` string contains `photos[0]`

#### Scenario: Valid photo still accepted
- **WHEN** a design enquiry is POSTed whose photo bytes decode to a genuine
  JPEG/PNG/WebP matching the declared type (within 5 MB, ≤ 3 photos)
- **THEN** the request is accepted (200) and the photo is stored as before

### Requirement: No wildcard CORS on the public API
Responses from `/api/enquiries` SHALL NOT carry `Access-Control-Allow-Origin: *`
(or any other `Access-Control-Allow-*` header). The same-origin form flow
SHALL continue to work unchanged, and non-POST requests to the route SHALL be
answered with 405.

#### Scenario: No CORS headers on acceptance
- **WHEN** a valid same-origin POST is accepted by `/api/enquiries`
- **THEN** the 200 response contains no `Access-Control-Allow-Origin` header

#### Scenario: Same-origin form still works
- **WHEN** the /design or /contact page's form submits via its `fetch` to
  `/api/enquiries` on the same origin
- **THEN** the request succeeds (no preflight is issued; the endpoint accepts
  it)

#### Scenario: OPTIONS is no longer a supported method
- **WHEN** an OPTIONS request is sent to `/api/enquiries`
- **THEN** the response is 405 with no CORS headers

### Requirement: The endpoint is rate-limited per client
The `/api/enquiries` endpoint SHALL enforce a per-client-IP rate limit
implemented in the worker (free-tier, no paid zone features): no more than
10 accepted POSTs per 5-minute window per client IP. A request over the limit
SHALL receive HTTP 429 with a plain-text/JSON "slow down" hint and SHALL be
neither archived nor emailed; a client within the limit SHALL be served
exactly as before.

#### Scenario: Burst beyond the limit is throttled
- **WHEN** the 11th POST from the same client IP arrives within 5 minutes
- **THEN** the response is 429, nothing is written to KV, and no email is
  sent for that request

#### Scenario: Normal use is unaffected
- **WHEN** a visitor submits one valid enquiry per day
- **THEN** the rate limiter never engages and the request is processed
  normally

### Requirement: Defensive security headers on all responses
Every HTTPS response served from `emfinestudio.com` (and www) SHALL carry:
`X-Content-Type-Options: nosniff`, `Referrer-Policy:
strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, and
`Permissions-Policy: camera=(), geolocation=(), microphone=()`; and SHALL
carry `Strict-Transport-Security` with `includeSubDomains` and
`max-age` ≥ 1 year.

#### Scenario: Page responses carry the header set
- **WHEN** `GET https://emfinestudio.com/` is fetched
- **THEN** the response headers include all four headers above plus
  `Strict-Transport-Security`

#### Scenario: API and static-asset responses carry the header set
- **WHEN** `POST /api/enquiries` and `GET /assets/<any committed image>`
  are fetched over HTTPS
- **THEN** the same header set is present

### Requirement: Enquiry emails never send from an unconfigured workers.dev address
When a verified sender address is not configured (`ENQUIRY_FROM` /
`BREVO_FROM` secrets both unset or empty), the email channel SHALL be
skipped entirely (archive-only mode, `emailDelivered: false`, a server log
line, and no fallback sender), and when one IS configured the enquiry email
SHALL be sent from that configured address.

#### Scenario: No sender configured → archive-only
- **WHEN** a valid enquiry is stored while neither `ENQUIRY_FROM` nor
  `BREVO_FROM` is set
- **THEN** the response is 200 with `emailDelivered: false`, no email is
  sent from any `.workers.dev` address, and the brief remains durably in KV

#### Scenario: Configured sender is used
- **WHEN** `ENQUIRY_FROM` (or `BREVO_FROM`) is set to a verified
  `emfinestudio.com` address and a valid enquiry is stored
- **THEN** the delivered enquiry email's From address is that configured
  address
