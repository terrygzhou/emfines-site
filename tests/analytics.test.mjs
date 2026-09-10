// Unit tests for the pure web-analytics helpers (embed tags + conversion
// firing). Run via `npm test` (pretest esbuild-bundles src/lib/analytics.ts to
// node_modules/.cache/analytics.mjs, matching the enquiry/gallery harness).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isConfigured,
  umamiScriptTag,
  postHogScriptTag,
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
  });
  assert.match(t, /<script defer src="https:\/\/analytics.example.com\/script\.js"/);
  assert.match(t, /data-website-id="2f0c1e9a"/); // trimmed
  assert.match(t, /data-do-not-track/);
});

test('umami defaults to cloud host when host is empty', () => {
  const t = umamiScriptTag({ enabled: true, websiteId: 'abc', host: '' });
  assert.match(t, /https:\/\/cloud\.umami\.is\/script\.js/);
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

// --- trackConversion -----------------------------------------------------
// Feature split: PostHog owns conversion events, Umami owns pageviews. A
// conversion is captured by AT MOST ONE provider (PostHog preferred, Umami as
// the fallback for a Umami-only deployment) \u2014 never both \u2014 so enabling both
// does not double-count the same signals.
function snapGlobals() {
  return {
    umami: 'umami' in globalThis ? globalThis.umami : undefined,
    ph: 'ph' in globalThis ? globalThis.ph : undefined,
  };
}
function setGlobals(g) {
  delete globalThis.umami;
  delete globalThis.ph;
  if (g.umami) globalThis.umami = g.umami;
  if (g.ph) globalThis.ph = g.ph;
}
function restoreGlobals(s) {
  delete globalThis.umami;
  delete globalThis.ph;
  if (s.umami !== undefined) globalThis.umami = s.umami;
  if (s.ph !== undefined) globalThis.ph = s.ph;
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

// --- anyAnalyticsActive --------------------------------------------------
test('anyAnalyticsActive reflects enabled providers only', () => {
  assert.equal(
    anyAnalyticsActive({
      umami: { enabled: false, websiteId: 'abc', host: 'h' },
      posthog: { enabled: false, apiKey: 'phc_x', host: 'h' },
    }),
    false,
  );
  assert.equal(
    anyAnalyticsActive({
      umami: { enabled: true, websiteId: 'abc', host: 'h' },
    }),
    true,
  );
});
