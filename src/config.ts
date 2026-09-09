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
