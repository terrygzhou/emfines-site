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
    capturePageLeave: false,
  });
  assert.match(t, /defer src="https:\/\/cdn\.posthog\.com\/static\.js"/);
  assert.match(t, /window\.ph\.init\(/);
  assert.match(t, /"phc_4r2xT1yZ9aBcDeFg"/);
  assert.match(t, /"https:\/\/eu\.posthog\.com"/);
  assert.match(t, /capturePageLeave: false/);
  assert.match(t, /capturePageview: true/);
});

test('posthog captures page-leave by default', () => {
  const t = postHogScriptTag({ enabled: true, apiKey: 'phc_real', host: '' });
  assert.match(t, /capturePageLeave: true/);
  assert.match(t, /"https:\/\/us\.posthog\.com"/); // default US host
});

// --- trackConversion -----------------------------------------------------
test('trackConversion is no-op-safe when no SDK is present', () => {
  // No globalThis.umami / .ph in the test env → must not throw.
  assert.doesNotThrow(() => trackConversion('design_enquiry_submitted', { kind: 'design' }));
});

test('trackConversion forwards to umami.track when present', () => {
  const calls = [];
  const prevUmami = globalThis.umami;
  globalThis.umami = { track: (ev, p) => calls.push(['umami', ev, p]) };
  try {
    trackConversion('contact_enquiry_submitted', { kind: 'contact' });
  } finally {
    if (prevUmami === undefined) delete globalThis.umami;
    else globalThis.umami = prevUmami;
  }
  assert.deepEqual(calls, [['umami', 'contact_enquiry_submitted', { kind: 'contact' }]]);
});

test('trackConversion forwards to ph.capture when present', () => {
  const calls = [];
  const prevPh = globalThis.ph;
  globalThis.ph = { capture: (ev, p) => calls.push(['ph', ev, p]) };
  try {
    trackConversion('design_enquiry_submitted');
  } finally {
    if (prevPh === undefined) delete globalThis.ph;
    else globalThis.ph = prevPh;
  }
  assert.deepEqual(calls, [['ph', 'design_enquiry_submitted', undefined]]);
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
