import type { UmamiAnalytics, PostHogAnalytics } from '@/lib/analytics';

// Site-wide config. Owner-supplied values land here (T1 open questions OQ-1/OQ-2).
// TODO(OQ-1): replace email + suburb with the studio's real details when supplied.
export const SITE = {
  name: 'EM Fine Studio',
  tagline: 'EM Fine Studio — Australian design, crafted with experience and care.',
  // OQ-1 default: email-only contact block + suburb placeholder. No phone, no socials.
  email: 'studio@emfines.com.au',
  suburb: 'Box Hill South, VIC',
  // OQ-2 default: no social links.
  social: null as null | string,
} as const;

// Web analytics (EMF-24) — Umami + PostHog. Both are OPTIONAL and only activate
// when `enabled` is true AND the key is a real value (not a `YOUR_…` placeholder).
// Until then the site builds and ships with no analytics pings at all.
//
// To enable Umami:   create/verify your Umami site → copy its Website ID → set
//                    umami.websiteId + umami.enabled=true (host only if self-hosted).
// To enable PostHog: create a PostHog project → copy the Project API key (phc_…) →
//                    set posthog.apiKey + posthog.enabled=true. Keep the host
//                    matching your project's data region (US default, EU optional).
export const ANALYTICS: { umami: UmamiAnalytics; posthog: PostHogAnalytics } = {
  umami: {
    enabled: false,
    websiteId: 'YOUR_UMAMI_WEBSITE_ID',
    host: 'https://cloud.umami.is',
  },
  posthog: {
    enabled: false,
    apiKey: 'YOUR_POSTHOG_API_KEY',
    host: 'https://us.posthog.com',
    capturePageLeave: true,
  },
};
