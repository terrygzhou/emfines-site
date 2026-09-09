---
tags: [emfines, site, spec, T1]
source: paperclip EMF-2 (issue cc68eb3b-02e5-403f-99f3-1212e7ec8551), spec doc rev current
paperclip_issue: EMF-2
migrated: 2026-09-09
---

# EM Fine Studio — T1 Site & Feature Spec (Days 1–5)

Owner: Product Scout · Status: final for T2 · Consumer: Full-stack Builder (day 6, zero follow-up questions expected)
Source context: accepted plan on EMF-1 (rev 4) + company description. Anything not settled here is a blocker to T2 — the Builder treats this document as the single source of truth.

## 1. Hero-service decision

**Decision: custom jewellery design is the hero.**

- Reason: it's the flagship of "one of a kind" and the only service with a true differentiation story against any jeweller; repairs is commoditised and components is a support offering.
- The plan's open question had no owner answer by T1, so the stated default applies: "If no preference, T1 defaults to custom design."
- Repairs and components remain first-class services on the site (section 4); they are demoted to secondary, not cut.
- This decision changes nothing in T2's scope — the online feature (section 7) serves custom design.

## 2. One-line value proposition (use verbatim in hero)

**"One-of-a-kind jewellery, designed and crafted by an Australian studio with 20+ years of experience — solid gold and sterling silver, made to your story."**

Supporting subline: Australian design, crafted with experience and care.

## 3. Site spec (4 pages, mobile-first, static)

### Page map
| Page | Path | Purpose |
|---|---|---|
| Home | `/` | Hero + value prop + 3 service teasers + 1 proof point + CTA to Custom Design |
| Custom Design | `/design` | Flagship service page: how it works, what you get, CTA to the online feature |
| Repairs | `/repairs` | Secondary service: what we fix, process, book/ask CTA (contact form) |
| Components & Crafted Pieces | `/pieces` | Gold/silver components & crafted pieces; contact CTA |
| Contact | `/contact` | Contact form + email/phone/location; linked in footer of every page |

No blog, no gallery grid of stock photos, no footer beyond: logo, nav links, email, "Australian design, crafted with experience and care."

### Home — sections in order
1. **Hero** — value proposition above, one CTA button: "Start your custom design" → `/design`. No stock hero image requirement: solid colour block with studio name + tagline is acceptable on day 6; image swap is a T2 iteration, not a blocker.
2. **The studio** — 60–80 word block: Australian studio, 20+ years, solid gold & sterling silver, craftsmanship/quality/attention to detail. (Draft copy in section 5.)
3. **Three services** — one card each: Custom Design (primary, "most requested" marker), Repairs, Pieces & Components. Each card: title + 2-line description + link.
4. **Why us** — 3 bullets: 20+ years hands-on experience; solid gold & sterling silver only; one design per person, never templated.
5. **CTA band** — "Have a piece in mind?" → /design.

### Custom Design — sections in order
1. Page title: "Custom jewellery design" + one line: from your idea (or your treasured heirloom) to a finished piece.
2. **How it works** — 4 numbered steps:
   1. Send us your brief, photos and budget (online, 5 minutes).
   2. We design: sketches/options, materials (gold purity or 925 silver), stone choices.
   3. You review and approve before anything is made.
   4. The piece is crafted, finished and delivered.
3. **What you can commission** — rings, engagement rings, pendants, earrings, bracelets, heirloom redesigns, one-off pieces.
4. **Materials** — solid gold (we ask, you choose: we work in solid gold; the Builder should NOT invent purity percentages — use "gold" and "925 sterling silver" only).
5. **Start yours** — embedded feature form (section 7).

### Repairs — content
- What we do: stone replacements, prong work, soldering/brazing, chain repair, resizing, polishing/restoring, ring/bracelet repairs, heirloom piece restoration.
- Process: send photos + description → we quote → you approve → repaired and returned. (No online form in 30 days — CTA goes to /contact.)
- One reassurance line: "Treasured items handled with care and attention to detail."

### Pieces & Components — content
- Carefully crafted solid gold and sterling silver pieces.
- Quality gold & silver jewellery components available for makers and studios.
- CTA: "Ask what's available" → /contact.

### Contact — content
- Form: name, email, subject (select: Custom design / Repairs / Pieces & components / Other), message. Required: name, email, message.
- Show email and phone placeholders in the contact block ONLY if the owner supplies real ones; otherwise omit phone and use email only. **Owner question OQ-1 (section 9): supply email + phone + suburb for the contact page; if unanswered by day 7, Builder ships with email-only + "Box Hill South, VIC" placeholder and flags it.**
- No social links unless the owner supplies them (OQ-2, same default: omit).

### Global (every page)
- Sticky header: "EM Fine Studio" wordmark + nav (Design / Repairs / Pieces / Contact). Mobile: hamburger.
- Footer: wordmark, nav, email, tagline.
- Copy tone rules: Australian English, plain, confident, no hype. Never "luxury", "premium", "unparalleled". Say "solid gold", "925 sterling silver", "one of a kind", "20+ years". Never lorem ipsum — if a slot has no copy, cut the slot.

## 4. Feature: Custom Design Enquiry (the single online feature, end-to-end)

**Decision: the online feature is a custom-design enquiry/quote request form — NOT a repairs booking flow.**
Rationale: repairs is secondary; the enquiry form is structurally simpler (no booking calendar, no scheduling state) and it converts straight into custom-design leads — the hero service. A repairs booking flow is explicitly deferred past day 30.

### Form (on /design, embedded in "Start yours" section)
| Field | Type | Required | Validation / notes |
|---|---|---|---|
| Name | text | yes | min 2 chars |
| Email | email | yes | valid email; this is where the request lands |
| Phone | tel | no | free text, AU format assumed |
| Piece type | select | yes | Ring / Engagement ring / Pendant / Earrings / Bracelet / Heirloom redesign / Other (show text input if Other) |
| Metals | checkbox group | yes (≥1) | Solid gold / 925 sterling silver / Not sure — advise me |
| Gemstones / details | text | no | free text |
| Budget range | select | no | Under $500 / $500–$1,000 / $1,000–$3,000 / $3,000+ / Not sure yet |
| Your story / brief | textarea | yes | min 40 chars; prompt text: "What's the piece? Who's it for? Any photos help — you can attach up to 3." |
| Photos | file upload | no | up to 3 images, JPG/PNG/WebP, ≤ 5 MB each |
| Preferred contact | select | yes | Email / Phone / Either |
| Consents checkbox | checkbox | yes | "I agree to be contacted about this enquiry." |

Client-side: validate on submit; inline error text under the failing field; disable submit while sending.
Server-side: re-run every required/validity rule — never trust the client.

### Where the request lands
- **One destination: the studio's email inbox**, via a transactional mailer (e.g. a free-tier service — Resend/SMTP free tier/whatever the Builder picks within free tier). No CRM, no database requirement, no admin UI in 30 days.
- Email subject: `New custom design enquiry — {name} — {piece type}`.
- Email body (plain text): one line per field in the table order; photos attached (or, if the mailer can't attach, hosted URLs).
- The form itself does NOT store anything in a database. If a database is used transiently for uploads, it holds nothing permanent and is out of demo scope.
- On success: replace the form with a confirmation state: "Thanks {first name} — we'll reply to {email} within 2 business days." No redirect, no separate thank-you page (simpler).
- On failure (mailer error): show "Something went wrong — please email us directly at {email}." and do NOT clear the form.

### Empty states / edge cases
- Submitting "Other" piece type with empty detail → error on the detail field.
- Zero photos → fine, never required.
- Resubmit while sending → double-submit guard (button disabled + in-flight flag).

### Demo path for T3 (must exist on the live URL)
Open `/design` → scroll to form → fill 3 required fields → pick piece type + metal + consent → submit → confirmation screen appears → check the studio inbox for the email with correct subject line and all field values.

## 5. Copy brief — real draft copy (no lorem ipsum)

The Builder wires these strings in as-is; the owner may polish wording later, but the structure is final.

**Hero H1:** "Your story, crafted in solid gold." (or use the value prop from section 2 if the owner prefers one block over H1+sub.)
**Hero sub:** Australian design, crafted with experience and care. Two decades of custom jewellery, repairs and fine pieces.
**CTA button:** Start your custom design

**The studio block:**
"EM Fine Studio is an Australian jewellery design studio with more than 20 years in the trade. We work in solid gold and 925 sterling silver — designing one-of-a-kind pieces, restoring treasured items, and crafting quality components. Two decades of hands-on work means every piece leaves the bench with the same standard: craftsmanship, quality, and attention to detail."

**Service cards:**
- Custom Design — "One of a kind. From your idea, sketch or treasured heirloom, we design and craft a piece that's yours alone."
- Repairs — "Chain broken? Stone lost? We repair and restore the pieces that matter, so they keep their story."
- Pieces & Components — "Carefully crafted solid gold and sterling silver pieces, plus quality components for makers."

**Why us bullets (final wording):**
- 20+ years of hands-on jewellery experience
- Solid gold and 925 sterling silver only
- Every design is made for one person — never templated

**Custom Design "How it works" microcopy:**
1. "Send your brief, photos and budget — takes five minutes."
2. "We design: sketches, materials and stone options for your approval."
3. "You approve before anything is made."
4. "Your piece is crafted, finished and delivered."

**Repairs page title line:** "Bring your treasured piece back."

**Form helper text:**
- Brief textarea prompt: "Tell us what the piece is, who it's for, and anything that matters to it. Photos help — attach up to 3."
- Success state: "Thanks, {first name}. Your enquiry is in — we'll reply to {email} within 2 business days."

**Tagline (footer):** "EM Fine Studio — Australian design, crafted with experience and care."

## 6. Build constraints for T2 (restating the boundaries, so the Builder doesn't have to re-read the plan)
- Free-tier hosting only; one stable URL from day 8; never move it mid-build.
- No e-commerce/checkout, no CMS, no multi-language, no paid marketing, no photo retouching pipeline.
- Mobile-first; test the demo path on a phone before day 19.
- Day-14 checkpoint: cut scope, not quality.
- Real copy only — every string from section 5 must ship.
- The mailer must be free-tier or the Builder picks the cheapest stable option and notes it in a comment; it's an implementation detail, not a scope change.

## 7. Open questions (each has a default — none of these block day 6)
- **OQ-1:** Contact details (email, phone, suburb/city to show publicly). Default if unanswered by day 7: email-only contact block + "Box Hill South, VIC" placeholder. Owner action: reply on this issue with the details.
- **OQ-2:** Social links to include in footer. Default: omit entirely.
- **OQ-3:** Studio imagery. Default: solid-colour hero and CSS-only visuals; any owner-supplied photos get swapped in during T2/T3 iteration without scope change.
- **OQ-4:** Brand colours (if the studio has established colours). Default: Builder picks a restrained palette — deep charcoal (#1a1a1a) text on off-white (#faf8f5), gold accent (#b8860b family) used sparingly.

## 8. Acceptance criteria for T1 (what the Builder should verify before building)
- [ ] Hero-service decision stated (section 1). ✔
- [ ] Every page has sections, order and copy slots defined. ✔
- [ ] The single feature is defined: fields, validation, destination, success/failure states, demo path. ✔
- [ ] All copy strings exist as drafts in the studio's voice. ✔
- [ ] Every open question carries a default that keeps day 6 unblocked. ✔
