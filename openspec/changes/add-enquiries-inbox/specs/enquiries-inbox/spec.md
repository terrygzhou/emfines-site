# Spec delta: enquiries-inbox

## Purpose
Auth-gated owner inbox that reads the immutable design-brief archive, tracks a
short-lived per-brief status, and lets the studio owner work through new briefs
without exposing any brief PII to anonymous visitors.

## ADDED Requirements

### Requirement: Owner sign-in
The owner signs in with a passcode; a valid passcode mints a short-lived
(HttpOnly, SameSite=Strict, ~12h) HMAC-signed session cookie.
#### Scenario: Valid passcode mints a session
- **WHEN** the owner POSTs the correct passcode to /api/admin/login
- **THEN** the response is 200 with a Set-Cookie session cookie
#### Scenario: Invalid or missing passcode is rejected
- **WHEN** the owner POSTs an incorrect or missing passcode
- **THEN** the response is 401 and no session cookie is set

### Requirement: Auth-gated brief list
The owner lists archived briefs newest-first, optionally filtered by status;
list items never include photos.
#### Scenario: Unauthenticated list request is rejected
- **WHEN** an anonymous or expired-session client GETs /api/admin/briefs
- **THEN** the response is 401 and no brief data is returned
#### Scenario: Authenticated owner gets a projected list
- **WHEN** an authenticated owner GETs /api/admin/briefs?status=new
- **THEN** the response is 200 with items {id, kind, summary, receivedAt,
  status} ordered by receivedAt desc, without photo payloads

### Requirement: Brief detail
The owner opens one brief with its full fields, photos, and current status.
#### Scenario: Known brief id returns the full record
- **WHEN** an authenticated owner GETs /api/admin/briefs/:id for an archived
  brief
- **THEN** the response is 200 with the full brief record, photos, and status
#### Scenario: Unknown id is a 404
- **WHEN** the owner GETs an id that does not exist in the archive
- **THEN** the response is 404

### Requirement: Status write
The owner marks a brief new or handled; the status is stored in its own
expiring namespace and aligns to the archive's 30-day TTL.
#### Scenario: Mark a brief handled
- **WHEN** an authenticated owner POSTs {"status":"handled"} for a valid brief
- **THEN** the response is 200 and a subsequent list/detail shows handled
#### Scenario: Invalid status value is rejected
- **WHEN** the owner POSTs a status value outside new|handled
- **THEN** the response is 400 and no status record is written
#### Scenario: Missing status degrades to new
- **WHEN** a brief's status record is absent (e.g. expired)
- **THEN** the brief is treated as new, and the UI/API never 500

### Requirement: Owner inbox UI
The owner works through briefs in the browser: sign-in gate, list with
filter, detail with photos, mark-handled, and empty states.
#### Scenario: Signed-out owner sees the gate
- **WHEN** an anonymous visitor opens /inbox
- **THEN** the sign-in gate is shown and no brief data is rendered
#### Scenario: No new briefs
- **WHEN** an authenticated owner opens /inbox with no new briefs
- **THEN** an empty state is shown instead of an empty list

### Requirement: PII isolation
Brief PII (name, email, phone, brief text, photos) is reachable only by the
authenticated owner; public routes never expose it.
#### Scenario: Signed-out requests reach no PII
- **WHEN** any anonymous request is made to /inbox* or /api/admin/*
- **THEN** no brief PII is returned or rendered
