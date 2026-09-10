# web-analytics Specification

## Purpose
Optional, config-driven web analytics (Umami + PostHog) that let the studio
measure page engagement and enquiry conversion — off by default,
self-hostable, privacy-first, and never able to fail the durable enquiry
write path.

## Requirements

### Requirement: Analytics is off by default
The site SHALL ship with no third-party analytics pings unless a provider is
explicitly enabled AND has a real (non-placeholder) credential. A provider
that is enabled but still carries a placeholder credential SHALL be treated
as not configured.
#### Scenario: Default placeholder build emits nothing
- **WHEN** the site is built with the default config (providers disabled,
  placeholder credentials)
- **THEN** no analytics <script> tag is emitted and the built pages make no
  network requests to Umami or PostHog
#### Scenario: Enabled but placeholder still emits nothing
- **WHEN** a provider has `enabled: true` but its credential is a placeholder
  (e.g. `YOUR_UMAMI_WEBSITE_ID`)
- **THEN** that provider's embed is not emitted and no ping is sent

### Requirement: Providers are independently optional
Umami and PostHog SHALL each be enableable or disableable independently;
enabling one SHALL NOT require the other, and only configured providers'
embeds are rendered.
#### Scenario: Only Umami active
- **WHEN** Umami is enabled with a real credential and PostHog is disabled
- **THEN** only the Umami embed is present in the page <head>
#### Scenario: Both disabled
- **WHEN** neither provider is enabled
- **THEN** neither provider's embed is present in the page <head>

### Requirement: Self-hosted / custom analytics host
Each provider SHALL target an owner-supplied base URL so a self-hosted
deployment (for example a Pop!_OS instance) can be used instead of the vendor
cloud; when no host is supplied the vendor-cloud default SHALL apply.
#### Scenario: Umami points at a self-hosted instance
- **WHEN** the Umami host is set to a self-hosted base URL and enabled
- **THEN** the emitted Umami embed loads its script from that base URL
#### Scenario: PostHog points at a self-hosted / EU instance
- **WHEN** the PostHog host is set to a self-hosted or EU base URL and enabled
- **THEN** PostHog is initialised against that host

### Requirement: No PII and Do-Not-Track respected
Analytics SHALL send no personally-identifiable information — only page
paths, referrers, and anonymous event names/properties — and the Umami embed
SHALL skip tracking when the browser sends a Do-Not-Track signal.
#### Scenario: Pageview carries no PII
- **WHEN** a visitor views a page while analytics are active
- **THEN** the pageview event contains only the page path and referrer, with
  no names, email addresses, or form values
#### Scenario: Do-Not-Track visitor is not tracked by Umami
- **WHEN** a visitor's browser sends a Do-Not-Track signal and Umami is
  active
- **THEN** Umami does not record that visitor's pageview

### Requirement: Conversion events fire only on durable success
The system SHALL fire a conversion event only after the enquiry is durably
stored by the server (design and contact forms), not on submit or
client-side validation alone; a server rejection or transport failure SHALL
not fire a conversion event.
#### Scenario: Design enquiry stored
- **WHEN** a design enquiry is accepted and durably stored by the server
- **THEN** a `design_enquiry_submitted` event is fired exactly once
#### Scenario: Contact message stored
- **WHEN** a contact message is accepted and durably stored by the server
- **THEN** a `contact_enquiry_submitted` event is fired
#### Scenario: Failed submit fires no conversion
- **WHEN** the enquiry is rejected by the server or the request fails
- **THEN** no conversion event is fired

### Requirement: Analytics never blocks the durable write path
Firing analytics events SHALL be no-op-safe: a missing or not-yet-loaded
provider SDK SHALL neither throw nor prevent the enquiry from being stored
and its success state shown to the visitor.
#### Scenario: SDK absent at fire time
- **WHEN** a conversion event is fired while a provider's SDK is absent or
  late
- **THEN** the call is a safe no-op, the enquiry is still stored, and the
  visitor still sees the success message
### Requirement: Analytics features are not duplicated across providers
When both Umami and PostHog are enabled, each signal SHALL have a single owner so
the same engagement is not counted in two dashboards: pageview analytics SHALL be
owned by Umami (PostHog pageview / page-leave capture SHALL be off), and a
conversion event SHALL be fired to a single provider (PostHog preferred, Umami as
the fallback only in a Umami-only deployment). A conversion event SHALL NOT be
captured by both providers.
#### Scenario: Both active, no double-counted pageviews
- **WHEN** Umami and PostHog are both enabled
- **THEN** pageviews are recorded only by Umami and PostHog captures no pageview
  or page-leave events
#### Scenario: Conversion captured by one provider only
- **WHEN** both providers are active and an enquiry is durably stored
- **THEN** the conversion event is fired to PostHog only and is NOT also fired to Umami
#### Scenario: Umami-only deployment still records conversions
- **WHEN** Umami is enabled and PostHog is not
- **THEN** the conversion event falls back to Umami (no loss, no duplication)

### Requirement: PostHog is LAN-gated because the self-hosted instance is not public
The self-hosted PostHog instance is reachable only on the owner's LAN, so the
default/public build SHALL NOT emit any PostHog embed (no public visitor pings
an unreachable host; Umami owns all public signals). PostHog SHALL be emitted
only in an explicitly-requested LAN/local build. Umami SHALL remain active in
both flavors so pageviews are always captured, and in the LAN flavor PostHog
SHALL keep pageview / page-leave capture off so it does not duplicate Umami's
pageviews.
#### Scenario: Public build emits no PostHog
- **WHEN** the site is built for the public deployment (no LAN flag)
- **THEN** no PostHog embed / `ph.init` is present in any page, and the Umami
  embed is still present
#### Scenario: LAN build emits both providers
- **WHEN** the site is built for the LAN/local flavor
- **THEN** every page contains both the Umami and the PostHog embed, and PostHog
  captures no pageview or page-leave (no duplication)
