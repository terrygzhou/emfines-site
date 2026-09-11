// Unit tests for the pure enquiry logic (validation + email composition).
// Run: npx esbuild src/lib/enquiry.ts --bundle --format=esm --outfile=/tmp/enquiry.mjs && node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validatePayload,
  emailSubject,
  emailBody,
} from '../node_modules/.cache/enquiry.mjs';

// Photo fixtures with REAL magic bytes so content validation is exercised:
// JPEG  FF D8 FF ...   PNG  89 50 4E 47 0D 0A 1A 0A   WebP  RIFF ... WEBP
const MAGICS = {
  jpeg: [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00],
  png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  webp: [0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50],
};
const photoDataUrl = (n, type = 'image/jpeg') => {
  const key = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpeg';
  const magic = Buffer.from(MAGICS[key]);
  const body = Buffer.concat([magic, Buffer.alloc(Math.max(0, n - magic.length), 0xab)]);
  return `data:${type};base64,${body.toString('base64')}`;
};
const b64 = (n) => Buffer.alloc(n, 1).toString('base64'); // ~n bytes decoded
const dataUrl = (n) => photoDataUrl(n, 'image/jpeg');

function validDesign(overrides = {}) {
  return {
    kind: 'design',
    name: 'Jane Smith',
    email: 'jane@example.com',
    pieceType: 'Ring',
    metals: ['Fine gold'],
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
  assert.equal(validatePayload(validDesign({ metals: ['925 sterling silver', 'Fine gold'] }), 'design').ok, true);
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

test('field maximums: over-long fields rejected with named errors', () => {
  const longBrief = 'a'.repeat(4001);
  const r1 = validatePayload(validDesign({ brief: longBrief }), 'design');
  assert.equal(r1.ok, false);
  assert.ok(r1.errors.join('; ').includes('brief'), JSON.stringify(r1.errors));

  const r2 = validatePayload(validDesign({ name: 'x'.repeat(101) }), 'design');
  assert.equal(r2.ok, false);
  assert.ok(r2.errors.join('; ').includes('name'), JSON.stringify(r2.errors));

  const r3 = validatePayload(validDesign({ phone: '9'.repeat(41) }), 'design');
  assert.equal(r3.ok, false);
  assert.ok(r3.errors.join('; ').includes('phone'), JSON.stringify(r3.errors));

  const r4 = validatePayload(validDesign({ pieceType: 'Other', pieceTypeOther: 'z'.repeat(101) }), 'design');
  assert.equal(r4.ok, false);
  assert.ok(r4.errors.join('; ').includes('pieceTypeOther'), JSON.stringify(r4.errors));

  const r5 = validatePayload(validDesign({ gemstones: 'g'.repeat(501) }), 'design');
  assert.equal(r5.ok, false);
  assert.ok(r5.errors.join('; ').includes('gemstones'), JSON.stringify(r5.errors));

  const good = { kind: 'contact', name: 'Sam', email: 'sam@example.com', subject: 'Repairs', message: 'm'.repeat(4001) };
  const r6 = validatePayload(good, 'contact');
  assert.equal(r6.ok, false);
  assert.ok(r6.errors.join('; ').includes('message'), JSON.stringify(r6.errors));
});

test('field maximums: at-limit requests still accepted', () => {
  const r1 = validatePayload(validDesign({ brief: 'a'.repeat(4000), name: 'x'.repeat(100), phone: '9'.repeat(40) }), 'design');
  assert.equal(r1.ok, true, JSON.stringify(r1.errors));
  const good = { kind: 'contact', name: 'Sam', email: 'sam@example.com', subject: 'Repairs', message: 'm'.repeat(4000) };
  assert.equal(validatePayload(good, 'contact').ok, true);
});

test('photos: non-base64 payload rejected', () => {
  const r = validatePayload(validDesign({ photos: ['data:image/jpeg;base64,@@@!!!not-base64'] }), 'design');
  assert.equal(r.ok, false);
  assert.ok(r.errors.join('; ').includes('photos[0]'), JSON.stringify(r.errors));
});

test('photos: magic bytes must match the declared type', () => {
  const jpegDeclaredPng = validatePayload(validDesign({ photos: [photoDataUrl(1000, 'image/png').replace('data:image/png', 'data:image/jpeg')] }), 'design');
  assert.equal(jpegDeclaredPng.ok, false, 'PNG bytes declared as image/jpeg must be rejected');
  assert.ok(jpegDeclaredPng.errors.join('; ').includes('photos[0]'), JSON.stringify(jpegDeclaredPng.errors));
  const pngDeclaredJpeg = validatePayload(validDesign({ photos: [dataUrl(1000).replace('data:image/jpeg', 'data:image/png')] }), 'design');
  assert.equal(pngDeclaredJpeg.ok, false, 'JPEG bytes declared as image/png must be rejected');
});

test('photos: genuine PNG / WebP payloads accepted', () => {
  assert.equal(validatePayload(validDesign({ photos: [photoDataUrl(2000, 'image/png')] }), 'design').ok, true);
  assert.equal(validatePayload(validDesign({ photos: [photoDataUrl(2000, 'image/webp')] }), 'design').ok, true);
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
  assert.ok(lines.includes('Metals: Fine gold'));
  assert.ok(lines.includes('Gemstones / details: sapphire'));
  assert.ok(lines.includes('Budget: Under $500'));
  assert.ok(lines.includes('Brief:'));
});
