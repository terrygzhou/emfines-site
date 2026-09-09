# Project Constitution — EM Fine Studio site (emfines-site)

One-time principles every spec/plan/tasks must obey. A spec that conflicts with a
principle is a defect; record the conflict as an open question, do not silently
override.

- **I. Static-first, free-tier-safe.** The site ships as an Astro static build on
  Cloudflare Workers (`@astrojs/cloudflare`). No paid tooling, no CMS, no permanent
  database. Only expiring KV + free Email Service are in scope.
- **II. PII is studio-inbox-only.** Design briefs contain PII (name, email, phone,
  brief, photos). They are an *expiring archive* (30-day TTL), never a permanent
  store. Only authenticated studio owner access may read them; the public site
  must never expose PII.
- **III. Quiet-luxury design language.** 01-classic-luxe tokens: white bg, charcoal
  ink, single accent, system font stacks, no webfont loading. One accent, restrained.
- **IV. Never trust the client.** Every user-supplied field is re-validated
  server-side before persistence or display.
- **V. Degrade gracefully.** Optional integrations (email) must never fail the
  durable write path; the core store must always complete first.
- **VI. Test before/alongside.** Pure logic (validation, auth, composition) is
  unit-tested. Runtime (worker + KV) is smoke-tested live.
- **VII. Stable deploy, isolated previews.** Production deploys to `emfines-site`;
  previews go to a separate worker that never touches the stable URL.

## Amendment
Principles change only via a documented, dated amendment recorded in this file.
