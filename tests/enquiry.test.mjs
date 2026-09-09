// Unit tests for the pure enquiry logic (validation + email composition).
// Run: npx esbuild src/lib/enquiry.ts --bundle --format=esm --outfile=/tmp/enquiry.mjs && node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validatePayload,
  emailSubject,
  emailBody,
} from '../node_modules/.cache/enquiry.mjs';

const b64 = (n) => Buffer.alloc(n, 1).toString('base64'); // ~n bytes decoded
const dataUrl = (n) => `data:image/jpeg;base64,${b64(n)}`;

function validDesign(overrides = {}) {
  return {
    kind: 'design',
    name: 'Jane Smith',
    email: 'jane@example.com',
    pieceType: 'Ring',
    metals: ['Solid gold'],
    brief: 'An engagement ring for our tenth anniversary — something simple with a small stone.',
    contactPref: 'Email',
    consent: true,
    ...overrides,
  };
}

test('valid design enquiry passes', () => {
  const r = validatePayload(validDesign(), 'design');
  assert.equal(r.ok, true);
  assert.equal(r.data.photos.length, 0);
  assert.equal(r.data.kind, 'design');
});

test('missing name/email → 400-class errors', () => {
  for (const o of [{ name: '' }, { email: 'nope' }, { name: 'J' }, { email: '' }]) {
    const r = validatePayload(validDesign(o), 'design');
    assert.equal(r.ok, false, JSON.stringify(o));
    assert.ok(r.errors.length > 0);
  }
});

test('"Other" piece type requires detail', () => {
  assert.equal(validatePayload(validDesign({ pieceType: 'Other' }), 'design').ok, false);
  assert.equal(validatePayload(validDesign({ pieceType: 'Other', pieceTypeOther: 'Lizard brooch' }), 'design').ok, true);
});

test('metals must be ≥1 and known', () => {
  assert.equal(validatePayload(validDesign({ metals: [] }), 'design').ok, false);
  assert.equal(validatePayload(validDesign({ metals: ['Tungsten'] }), 'design').ok, false);
  assert.equal(validatePayload(validDesign({ metals: ['925 sterling silver', 'Solid gold'] }), 'design').ok, true);
});

test('brief min 40 chars enforced', () => {
  assert.equal(validatePayload(validDesign({ brief: 'too short' }), 'design').ok, false);
});

test('consent and contactPref required', () => {
  assert.equal(validatePayload(validDesign({ consent: false }), 'design').ok, false);
  assert.equal(validatePayload(validDesign({ contactPref: 'Pigeon' }), 'design').ok, false);
});

test('budget validated when present', () => {
  assert.equal(validatePayload(validDesign({ budget: 'Not sure yet' }), 'design').ok, true);
  assert.equal(validatePayload(validDesign({ budget: '$2' }), 'design').ok, false);
});

test('photos: max 3, types, size ≤5MB', () => {
  assert.equal(validatePayload(validDesign({ photos: [dataUrl(1000), dataUrl(1000), dataUrl(1000), dataUrl(1000)] }), 'design').ok, false);
  assert.equal(validatePayload(validDesign({ photos: [dataUrl(1000), dataUrl(1000)] }), 'design').ok, true);
  assert.equal(validatePayload(validDesign({ photos: ['data:image/gif;base64,xx'] }), 'design').ok, false);
  assert.equal(validatePayload(validDesign({ photos: [`data:image/jpeg;base64,${b64(6 * 1024 * 1024)}`] }), 'design').ok, false);
});

test('unknown kind defaults to design', () => {
  assert.equal(validatePayload(validDesign(), 'nonsense').ok, false); // typed but runtime-tolerant
});

test('contact form validation', () => {
  const good = { kind: 'contact', name: 'Sam', email: 'sam@example.com', subject: 'Repairs', message: 'Chain snapped, is it fixable?' };
  assert.equal(validatePayload(good, 'contact').ok, true);
  for (const o of [{ subject: 'Foo' }, { message: '' }, { email: 'x' }, { name: 'S' }]) {
    assert.equal(validatePayload({ ...good, ...o }, 'contact').ok, false);
  }
});

test('email subject follows T1 spec', () => {
  const r = validatePayload(validDesign(), 'design');
  assert.equal(emailSubject(r.data), 'New custom design enquiry — Jane Smith — Ring');
  const other = validatePayload(validDesign({ pieceType: 'Other', pieceTypeOther: 'Lizard brooch' }), 'design');
  assert.equal(emailSubject(other.data), 'New custom design enquiry — Jane Smith — Lizard brooch');
  const c = validatePayload({ kind: 'contact', name: 'Sam', email: 's@e.com', subject: 'Repairs', message: 'Hi there, hello world' }, 'contact');
  assert.equal(emailSubject(c.data), 'New Repairs message — Sam');
});

test('email body is one line per field, in order', () => {
  const r = validatePayload(validDesign({ gemstones: 'sapphire', budget: 'Under $500', photos: [dataUrl(1000)] }), 'design');
  const body = emailBody(r.data);
  const lines = body.split('\n');
  assert.ok(lines[0].startsWith('Name: Jane Smith'));
  assert.ok(lines[1].startsWith('Email: jane@example.com'));
  assert.ok(lines.includes('Piece type: Ring'));
  assert.ok(lines.includes('Metals: Solid gold'));
  assert.ok(lines.includes('Gemstones / details: sapphire'));
  assert.ok(lines.includes('Budget: Under $500'));
  assert.ok(lines.includes('Brief:'));
});
