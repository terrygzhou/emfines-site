// Unit tests for the pure web-analytics helpers (embed tags + conversion
// firing). Run via `npm test` (pretest esbuild-bundles src/lib/analytics.ts to
// node_modules/.cache/analytics.mjs, matching the enquiry/gallery harness).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isConfigured,
  umamiScriptTag,
  postHogScriptTag,
  matomoScriptTag,
  trackConversion,
  anyAnalyticsActive,
} from '../node_modules/.cache/analytics.mjs';

// --- isConfigured -------------------------------------------------------
test('empty / undefined values are not configured', () => {
  assert.equal(isConfigured(''), false);
  assert.equal(isConfigured('   '), false);
  assert.equal(isConfigured(undefined), false);
});

test('placeholder markers are not configured', () => {
  assert.equal(isConfigured('YOUR_UMAMI_WEBSITE_ID'), false);
  assert.equal(isConfigured('phc_REPLACE_ME'), false);
  assert.equal(isConfigured('<apiKey>'), false);
});

test('real values are configured', () => {
  assert.equal(isConfigured('2f0c1e9a-1111-4abc-8def-0123456789ab'), true);
  assert.equal(isConfigured('phc_4r2xT1yZ9aBcDeFg'), true); // a plausible real key
});

// --- umamiScriptTag ------------------------------------------------------
test('disabled or placeholder umami emits nothing', () => {
  assert.equal(umamiScriptTag(undefined), null);
  assert.equal(umamiScriptTag({ enabled: false, websiteId: 'x', host: 'h' }), null);
  assert.equal(
    umamiScriptTag({ enabled: true, websiteId: 'YOUR_UMAMI_WEBSITE_ID', host: 'h' }),
    null,
  );
});

test('configured umami emits a deferred embed with do-not-track', () => {
  const t = umamiScriptTag({
    enabled: true,
    websiteId: '  2f0c1e9a ',
    host: 'https://analytics.example.com/',
    integrity: 'sha384-AbCdEf0123',
  });
  assert.match(t, /<script defer src="https:\/\/analytics.example.com\/script\.js"/);
  assert.match(t, /data-website-id="2f0c1e9a"/); // trimmed
  assert.match(t, /data-do-not-track/);
});

test('umami defaults to cloud host when host is empty', () => {
  const t = umamiScriptTag({ enabled: true, websiteId: 'abc', host: '', integrity: 'sha384-AbCdEf0123' });
  assert.match(t, /https:\/\/cloud\.umami\.is\/script\.js/);
});

// --- umami subresource integrity (harden-site-security) -----------------
test('umami embed carries SRI attributes when integrity is configured', () => {
  const t = umamiScriptTag({
    enabled: true,
    websiteId: '2f0c1e9a',
    host: 'https://analytics.example.com',
    integrity: 'sha384-AbCdEf0123',
  });
  assert.match(t, /integrity="sha384-AbCdEf0123"/);
  assert.match(t, /crossorigin="anonymous"/);
  // SRI requires the crossorigin attribute to be present for the check to apply.
  assert.match(t, /crossorigin="anonymous"/);
});

test('missing integrity suppresses the umami embed (no unverified script)', () => {
  // enabled + real websiteId, but no SRI hash -> we do NOT ship the script.
  assert.equal(umamiScriptTag({ enabled: true, websiteId: 'abc', host: 'h' }), null);
});

test('placeholder integrity suppresses the umami embed', () => {
  assert.equal(
    umamiScriptTag({
      enabled: true,
      websiteId: 'abc',
      host: 'h',
      integrity: 'YOUR_UMAMI_INTEGRITY',
    }),
    null,
  );
});

// --- postHogScriptTag ----------------------------------------------------
test('disabled or placeholder posthog emits nothing', () => {
  assert.equal(postHogScriptTag(undefined), null);
  assert.equal(postHogScriptTag({ enabled: false, apiKey: 'x', host: 'h' }), null);
  assert.equal(
    postHogScriptTag({ enabled: true, apiKey: 'YOUR_POSTHOG_API_KEY', host: 'h' }),
    null,
  );
});

test('configured posthog emits static.js loader + deferred init', () => {
  const t = postHogScriptTag({
    enabled: true,
    apiKey: 'phc_4r2xT1yZ9aBcDeFg',
    host: 'https://eu.posthog.com',
    capturePageview: true,
    capturePageLeave: false,
  });
  assert.match(t, /defer src="https:\/\/cdn\.posthog\.com\/static\.js"/);
  assert.match(t, /window\.ph\.init\(/);
  assert.match(t, /"phc_4r2xT1yZ9aBcDeFg"/);
  assert.match(t, /"https:\/\/eu\.posthog\.com"/);
  assert.match(t, /capturePageview: true/);
  assert.match(t, /capturePageLeave: false/);
});

test('posthog defaults to events-only so it does not duplicate Umami pageviews', () => {
  // When both providers are active, Umami owns pageviews; PostHog must NOT
  // also capture pageviews / page-leaves, or the same engagement is counted twice.
  const t = postHogScriptTag({ enabled: true, apiKey: 'phc_real', host: 'https://posthog.example.com' });
  assert.match(t, /capturePageview: false/);
  assert.match(t, /capturePageLeave: false/);
  assert.match(t, /"https:\/\/posthog\.example\.com"/);
});

test('posthog pageview capture can be re-enabled for a PostHog-only deployment', () => {
  const t = postHogScriptTag({ enabled: true, apiKey: 'phc_real', host: '', capturePageview: true });
  assert.match(t, /capturePageview: true/);
});

// --- matomoScriptTag -----------------------------------------------------
test('disabled or placeholder matomo emits nothing', () => {
  assert.equal(matomoScriptTag(undefined), null);
  assert.equal(
    matomoScriptTag({ enabled: false, siteId: '1', host: 'http://matomo.local' }),
    null,
  );
  assert.equal(
    matomoScriptTag({
      enabled: true,
      siteId: 'YOUR_MATOMO_SITE_ID',
      host: 'http://matomo.local',
    }),
    null,
  );
  // Matomo is always self-hosted: an empty host suppresses the embed entirely
  // (no broken pings to an unreachable / unset host).
  assert.equal(matomoScriptTag({ enabled: true, siteId: '1', host: '' }), null);
});

test('configured matomo emits the self-hosted classic embed (no external CDN)', () => {
  const t = matomoScriptTag({
    enabled: true,
    siteId: '  3 ',
    host: 'http://matomo.local/',
  });
  assert.match(t, /window\._paq = window\._paq \|\| \[\]/);
  assert.match(t, /'setTrackerUrl', u \+ 'matomo\.php'/);
  assert.match(t, /"3"/); // trimmed siteId
  assert.match(t, /"http:\/\/matomo\.local\/";/); // host normalised to exactly one slash
  assert.match(t, /'enableLinkTracking'/);
  assert.match(t, /'matomo\.js'/);
  // No external Matomo CDN reference — the tracker loads from the owner's box.
  assert.ok(!/cdn\./ .test(t), 'must not reference an external CDN');
});

// --- trackConversion ----------------------------------------------------- -----------------------------------------------------
// Feature split: PostHog owns conversion events, Umami owns pageviews. A
// conversion is captured by AT MOST ONE provider (PostHog preferred, Umami as
// the fallback for a Umami-only deployment) \u2014 never both \u2014 so enabling both
// does not double-count the same signals.
function snapGlobals() {
  return {
    umami: 'umami' in globalThis ? globalThis.umami : undefined,
    ph: 'ph' in globalThis ? globalThis.ph : undefined,
    _paq: '_paq' in globalThis ? globalThis._paq : undefined,
  };
}
function setGlobals(g) {
  delete globalThis.umami;
  delete globalThis.ph;
  delete globalThis._paq;
  if (g.umami) globalThis.umami = g.umami;
  if (g.ph) globalThis.ph = g.ph;
  if (g._paq) globalThis._paq = g._paq;
}
function restoreGlobals(s) {
  delete globalThis.umami;
  delete globalThis.ph;
  delete globalThis._paq;
  if (s.umami !== undefined) globalThis.umami = s.umami;
  if (s.ph !== undefined) globalThis.ph = s.ph;
  if (s._paq !== undefined) globalThis._paq = s._paq;
}

test('trackConversion is a safe no-op when no SDK is present', () => {
  const s = snapGlobals();
  setGlobals({});
  try {
    assert.doesNotThrow(() => trackConversion('design_enquiry_submitted', { kind: 'design' }));
  } finally {
    restoreGlobals(s);
  }
});

test('PostHog absent + Umami present \u2192 conversion falls back to Umami', () => {
  const s = snapGlobals();
  const calls = [];
  setGlobals({ umami: { track: (ev, p) => calls.push(['umami', ev, p]) } });
  try {
    trackConversion('contact_enquiry_submitted', { kind: 'contact' });
    assert.deepEqual(calls, [['umami', 'contact_enquiry_submitted', { kind: 'contact' }]]);
  } finally {
    restoreGlobals(s);
  }
});

test('Umami absent + PostHog present \u2192 conversion goes to PostHog', () => {
  const s = snapGlobals();
  const calls = [];
  setGlobals({ ph: { capture: (ev, p) => calls.push(['ph', ev, p]) } });
  try {
    trackConversion('design_enquiry_submitted');
    assert.deepEqual(calls, [['ph', 'design_enquiry_submitted', undefined]]);
  } finally {
    restoreGlobals(s);
  }
});

test('both SDKs present \u2192 conversion fires to PostHog ONLY (never duplicated)', () => {
  const s = snapGlobals();
  const calls = [];
  setGlobals({
    umami: { track: (ev, p) => calls.push(['umami', ev, p]) },
    ph: { capture: (ev, p) => calls.push(['ph', ev, p]) },
  });
  try {
    trackConversion('design_enquiry_submitted', { kind: 'design' });
    assert.deepEqual(calls, [['ph', 'design_enquiry_submitted', { kind: 'design' }]]);
    assert.ok(!calls.some((c) => c[0] === 'umami'), 'must not also fire to Umami when PostHog is active');
  } finally {
    restoreGlobals(s);
  }
});

test('Umami + Matomo present, no PostHog → conversion goes to Matomo ONLY', () => {
  const s = snapGlobals();
  const calls = [];
  const paq = [];
  paq.push = (x) => { calls.push(['matomo', x]); }; // capture pushed events
  setGlobals({
    umami: { track: (ev, p) => calls.push(['umami', ev, p]) },
    _paq: paq,
  });
  try {
    trackConversion('design_enquiry_submitted', { kind: 'design' });
    assert.ok(calls.some((c) => c[0] === 'matomo'), 'conversion must fire to Matomo');
    assert.ok(
      !calls.some((c) => c[0] === 'umami'),
      'must NOT also fire to Umami when Matomo is active (no duplication)',
    );
    const push = calls.find((c) => c[0] === 'matomo');
    assert.deepEqual(
      push[1],
      ['trackEvent', 'enquiry', 'design_enquiry_submitted', JSON.stringify({ kind: 'design' }), 1],
    );
  } finally {
    restoreGlobals(s);
  }
});

test('PostHog + Matomo + Umami present → conversion goes to PostHog ONLY', () => {
  const s = snapGlobals();
  const calls = [];
  const paq = [];
  paq.push = (x) => { calls.push(['matomo', x]); };
  setGlobals({
    umami: { track: (ev, p) => calls.push(['umami', ev, p]) },
    ph: { capture: (ev, p) => calls.push(['ph', ev, p]) },
    _paq: paq,
  });
  try {
    trackConversion('contact_enquiry_submitted', { kind: 'contact' });
    assert.deepEqual(
      calls,
      [['ph', 'contact_enquiry_submitted', { kind: 'contact' }]],
    );
    assert.ok(
      !calls.some((c) => c[0] === 'matomo') && !calls.some((c) => c[0] === 'umami'),
      'PostHog owns the event; Matomo and Umami must not also fire it',
    );
  } finally {
    restoreGlobals(s);
  }
});

// --- anyAnalyticsActive -------------------------------------------------- --------------------------------------------------
test('anyAnalyticsActive reflects enabled providers only', () => {
  assert.equal(
    anyAnalyticsActive({
      umami: { enabled: false, websiteId: 'abc', host: 'h' },
      posthog: { enabled: false, apiKey: 'phc_x', host: 'h' },
      matomo: { enabled: false, siteId: '1', host: 'http://matomo.local' },
    }),
    false,
  );
  assert.equal(
    anyAnalyticsActive({
      umami: { enabled: true, websiteId: 'abc', host: 'h', integrity: 'sha384-AbCdEf0123' },
    }),
    true,
  );
  assert.equal(
    anyAnalyticsActive({
      matomo: { enabled: true, siteId: '1', host: 'http://matomo.local' },
    }),
    true,
  );
  assert.equal(
    anyAnalyticsActive({
      matomo: { enabled: false, siteId: '1', host: 'http://matomo.local' },
    }),
    false,
  );
});
