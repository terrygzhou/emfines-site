# Spec delta: web-analytics (MODIFIED capability)

## ADDED Requirements

### Requirement: Third-party analytics embeds are integrity-protected
When a provider's embed is emitted, its external `<script>` tag SHALL carry
a Subresource-Integrity `integrity` attribute (sha384) plus
`crossorigin="anonymous"`. A provider whose configured integrity value is
missing or a placeholder SHALL be treated as not configured and no embed
SHALL be emitted for it. A mismatch between the served script and the
configured hash SHALL result in the browser refusing to execute the script,
and the page (including the durable enquiry flow and its conversion
no-op-safe events) SHALL remain fully functional without it.

#### Scenario: Umami embed carries SRI attributes
- **WHEN** the public build ships with Umami enabled and a real integrity
  hash configured
- **THEN** the emitted Umami `<script>` tag includes
  `integrity="sha384-…"` and `crossorigin="anonymous"`

#### Scenario: Missing/placeholder integrity suppresses the embed
- **WHEN** Umami is enabled but its integrity value is empty or a
  placeholder (e.g. `YOUR_UMAMI_INTEGRITY`)
- **THEN** no Umami `<script>` tag is emitted and the page makes no request
  to the Umami host

#### Scenario: Host serves a mismatched script
- **WHEN** the Umami host serves a `script.js` whose content does not match
  the configured sha384 hash
- **THEN** the browser refuses to execute the script and the page, its
  enquiry forms, and their no-op-safe conversion events work unchanged
