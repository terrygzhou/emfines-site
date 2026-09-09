// Unit tests for the pure gallery logic (CSV parse, manifest cross-check,
// grouping/filtering). Run: npm test (pretest esbuild-bundles src/lib/gallery.ts
// to node_modules/.cache/gallery.mjs, matching the enquiry harness).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseManifestCsv,
  buildManifest,
  groupByCategory,
  filterByCategory,
  categoryCounts,
  humanizeName,
} from '../node_modules/.cache/gallery.mjs';

// --- parseManifestCsv -------------------------------------------------

const CSV = `group,old_name,new_name,category,design,description,width,height,bytes
hash,088ee4d2.jpg,ring-opal-halo-01.jpg,ring,opal-halo,"gold ring, large round white stone, teal velvet box",5472,3648,2858361
hash,11111111.png,brooch-butterfly-01.png,brooch,butterfly,"enamel brooch, ""fleur"" detail",2000,1500,999
hash,22222222.jpg,necklace-plain-01.jpg,necklace,,simple chain,800,600
`;

test('parseManifestCsv: maps header columns and parses quoted fields with commas', () => {
  const rows = parseManifestCsv(CSV);
  assert.equal(rows.length, 3);
  const [a, b, c] = rows;
  assert.equal(a.name, 'ring-opal-halo-01.jpg');
  assert.equal(a.category, 'ring');
  assert.equal(a.design, 'opal-halo');
  assert.equal(a.description, 'gold ring, large round white stone, teal velvet box');
  assert.equal(a.width, 5472);
  assert.equal(a.height, 3648);
  assert.equal(a.bytes, 2858361);
  assert.equal(a.oldName, '088ee4d2.jpg');
  assert.equal(b.description, 'enamel brooch, "fleur" detail'); // escaped quotes
  assert.equal(c.design, undefined); // empty cell
  assert.equal(c.width, 800);
});

test('parseManifestCsv: handles CRLF line endings and blank lines', () => {
  const rows = parseManifestCsv('group,old_name,new_name,category,design,description,width,height,bytes\r\n\r\nx,old.jpg,a.jpg,ring,r,d,desc,1,2\r\n\r\n');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, 'a.jpg');
});

test('parseManifestCsv: rows without a new_name are skipped; missing numeric fields are undefined', () => {
  const rows = parseManifestCsv('group,old_name,new_name,category,design,description,width,height,bytes\nx,old.jpg,,ring,r,d,1,2,3\n');
  assert.deepEqual(rows, []);
});

test('parseManifestCsv: empty input gives empty result', () => {
  assert.deepEqual(parseManifestCsv(''), []);
  assert.deepEqual(parseManifestCsv('group,old_name,new_name\n'), []);
});

// --- buildManifest ----------------------------------------------------

const disk = ['a.jpg', 'c.jpg', 'd.png'];
const rowsForFixtures = [
  { name: 'a.jpg', category: 'ring', description: 'ring A', width: 100, height: 50, design: 'x', bytes: 1 },
  { name: 'b.jpg', category: 'ring', description: 'missing file', width: 1, height: 1 },
  { name: 'c.jpg', category: 'brooch', description: 'brooch C', width: 10, height: 10 },
  { name: 'a.jpg', category: 'dupe', description: 'duplicate row' }, // first row must win
];

test('buildManifest: one item per disk file; manifest metadata applied; first row wins duplicates', () => {
  const { items } = buildManifest(rowsForFixtures, disk);
  assert.equal(items.length, 3);
  const byName = Object.fromEntries(items.map((i) => [i.name, i]));
  assert.equal(byName['a.jpg'].category, 'ring'); // not 'dupe'
  assert.equal(byName['a.jpg'].fromManifest, true);
  assert.equal(byName['c.jpg'].fromManifest, true);
  assert.equal(byName['d.png'].fromManifest, false); // orphan
  assert.equal(byName['d.png'].src, '/assets/d.png');
});

test('buildManifest: orphans get fallback metadata (uncategorised + humanized caption)', () => {
  const { items } = buildManifest(rowsForFixtures, disk);
  const d = items.find((i) => i.name === 'd.png');
  assert.equal(d.category, 'uncategorised');
  assert.equal(d.description, humanizeName('d.png'));
  assert.equal(d.width, undefined);
});

test('buildManifest: drift lists missing-file rows and orphan files, both reported', () => {
  const { drift } = buildManifest(rowsForFixtures, disk);
  assert.deepEqual(drift.missingFiles, ['b.jpg']);
  assert.deepEqual(drift.orphans, ['d.png']);
});

test('buildManifest: clean state (rows match disk) has empty drift and no orphans', () => {
  const result = buildManifest(
    [
      { name: 'a.jpg', category: 'ring', description: 'ring A' },
      { name: 'd.png', category: 'brooch', description: 'brooch D' },
    ],
    ['a.jpg', 'd.png'],
  );
  assert.equal(result.items.length, 2);
  assert.deepEqual(result.drift, { missingFiles: [], orphans: [] });
});

test('buildManifest: empty inputs give empty items and drift', () => {
  assert.deepEqual(buildManifest([], []), { items: [], uiAssets: [], drift: { missingFiles: [], orphans: [] } });
});

test('buildManifest: items are sorted by category then name (deterministic render order)', () => {
  const { items } = buildManifest(rowsForFixtures, ['zz.jpg', 'aa.jpg']);
  assert.deepEqual(
    items.map((i) => i.name),
    ['aa.jpg', 'zz.jpg'],
  );
  const { items: mixed } = buildManifest(
    [
      { name: 'b2.jpg', category: 'ring', description: 'x' },
      { name: 'a2.jpg', category: 'brooch', description: 'x' },
    ],
    ['b2.jpg', 'a2.jpg'],
  );
  assert.deepEqual(
    mixed.map((i) => i.name),
    ['a2.jpg', 'b2.jpg'], // brooch < ring
  );
});

// --- groupByCategory / filterByCategory / categoryCounts ---------------

function fixtureItems() {
  return buildManifest(
    [
      { name: 'r1.jpg', category: 'ring', description: 'r1' },
      { name: 'r2.jpg', category: 'ring', description: 'r2' },
      { name: 'b1.jpg', category: 'brooch', description: 'b1' },
      { name: 'o.png', description: 'orphan' },
    ],
    ['r1.jpg', 'r2.jpg', 'b1.jpg', 'o.png'],
  ).items;
}

test('groupByCategory: groups by category, categories sorted, items keep order', () => {
  const groups = groupByCategory(fixtureItems());
  assert.deepEqual(
    groups.map((g) => [g.category, g.items.map((i) => i.name)]),
    [
      ['brooch', ['b1.jpg']],
      ['ring', ['r1.jpg', 'r2.jpg']],
      ['uncategorised', ['o.png']],
    ],
  );
});

test('filterByCategory: returns one category, "all" returns everything, unknown gives empty', () => {
  const items = fixtureItems();
  assert.deepEqual(
    filterByCategory(items, 'ring').map((i) => i.name),
    ['r1.jpg', 'r2.jpg'],
  );
  assert.equal(filterByCategory(items, 'all').length, 4);
  assert.deepEqual(filterByCategory(items, 'nope'), []);
});

test('categoryCounts: counts per category sorted by name', () => {
  const counts = categoryCounts(fixtureItems());
  assert.deepEqual(counts, [
    { name: 'brooch', count: 1 },
    { name: 'ring', count: 2 },
    { name: 'uncategorised', count: 1 },
  ]);
});

// --- humanizeName -------------------------------------------------------

test('humanizeName: strips extension, dashes/underscores to spaces, title-cased', () => {
  assert.equal(humanizeName('ring-opal-halo-01.jpg'), 'Ring Opal Halo 01');
  assert.equal(humanizeName('brooch_butterfly_01.png'), 'Brooch Butterfly 01');
  assert.equal(humanizeName('jade'), 'Jade');
});

// --- UI_ASSETS exclusion (add-header-logo) ----------------------------

test('buildManifest: UI-asset logo.png on disk is excluded from items and orphans, listed in uiAssets', () => {
  const { items, drift, uiAssets } = buildManifest([], ['logo.png', 'ring-x.jpg'], ['logo.png']);
  assert.deepEqual(items.map((i) => i.name), ['ring-x.jpg']); // logo not an item
  assert.deepEqual(drift.orphans, ['ring-x.jpg']); // logo not an orphan
  assert.equal(items.find((i) => i.name === 'ring-x.jpg').category, 'uncategorised');
  assert.deepEqual(uiAssets, ['logo.png']);
});

test('buildManifest: a workshop photo not in the UI list still appears as an orphan (completeness preserved)', () => {
  const { items, drift } = buildManifest([], ['logo.png', 'ring-x.jpg'], ['logo.png']);
  assert.deepEqual(drift.orphans, ['ring-x.jpg']);
  const x = items.find((i) => i.name === 'ring-x.jpg');
  assert.equal(x.fromManifest, false);
  assert.equal(x.category, 'uncategorised');
});

test('buildManifest: default excluded set excludes logo.png (no explicit arg)', () => {
  const { items, drift, uiAssets } = buildManifest([], ['logo.png', 'a.jpg']);
  assert.deepEqual(items.map((i) => i.name), ['a.jpg']);
  assert.deepEqual(drift.orphans, ['a.jpg']); // logo dropped, not drift
  assert.deepEqual(uiAssets, ['logo.png']);
});

test('buildManifest: absent logo -> uiAssets is empty', () => {
  const { uiAssets } = buildManifest([], ['a.jpg']);
  assert.deepEqual(uiAssets, []);
});

test('buildManifest: uiAssets lists only the excluded files actually on disk', () => {
  const { uiAssets } = buildManifest([], ['a.jpg'], ['logo.png', 'other.png']);
  assert.deepEqual(uiAssets, []); // neither excluded file is present
});
