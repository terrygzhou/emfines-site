// EM Fine Studio — pure gallery logic (EMF-6 / add-asset-gallery).
//
// The public/assets manifest (public/assets/_manifest.csv) is the source of
// truth for image metadata; the files on disk are authoritative for the set
// of images shown. These pure functions are shared by:
//   - scripts/generate-manifest.mjs (build-time, via the esbuild bundle)
//   - tests/gallery.test.mjs (unit tests)
// No DOM/Workers APIs here (constitution VI — pure + unit-tested).

/** One row of public/assets/_manifest.csv (new_name is the served filename). */
export interface ManifestRow {
  group?: string;
  oldName?: string;
  /** Served filename — /assets/<name>. Rows without this are skipped. */
  name: string;
  category?: string;
  design?: string;
  description?: string;
  width?: number;
  height?: number;
  bytes?: number;
}

/** An image to render in the gallery. */
export interface AssetItem {
  /** Served filename. */
  name: string;
  /** Served URL, e.g. /assets/ring-opal-halo-01.jpg. */
  src: string;
  category: string;
  design?: string;
  /** Visible caption + <img alt>. */
  description: string;
  width?: number;
  height?: number;
  bytes?: number;
  /** false = the image has no manifest row (fallback metadata). */
  fromManifest: boolean;
}

export interface ManifestDrift {
  /** Manifest rows whose file is absent on disk (excluded from the gallery). */
  missingFiles: string[];
  /** Disk files with no manifest row (included with fallback metadata). */
  orphans: string[];
}

export const UNCATEGORIZED = 'uncategorised';

/**
 * Files in public/assets that are site brand/UI assets rather than gallery
 * content (served statically, e.g. the header logo). Excluded from the gallery
 * items and from drift.orphans; see buildManifest.
 */
export const UI_ASSETS: ReadonlySet<string> = new Set(['logo.png']);

const HEADER_COLUMNS = [
  'group',
  'old_name',
  'new_name',
  'category',
  'design',
  'description',
  'width',
  'height',
  'bytes',
] as const;

/**
 * Split one CSV line into fields, honoring RFC 4180 quoting
 * (double-quoted fields may contain commas; "" is an escaped quote).
 */
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

function toNumber(v: string | undefined): number | undefined {
  if (v === undefined) return undefined;
  const t = v.trim();
  if (t === '') return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Parse public/assets/_manifest.csv. Columns are mapped by header name
 * (not position); the header row and blank lines are skipped; rows without a
 * new_name are skipped. Quoted fields may contain commas.
 */
export function parseManifestCsv(text: string): ManifestRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length === 0) return [];

  const col = new Map<string, number>();
  HEADER_COLUMNS.forEach((c, i) => col.set(c, i));
  const header = splitCsvLine(lines[0]);
  const first = header[0]?.trim();
  const start = first === 'group' || first === 'new_name' ? 1 : 0;

  const rows: ManifestRow[] = [];
  for (let i = start; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const get = (c: string): string | undefined => {
      const idx = col.get(c);
      const v = idx === undefined ? undefined : cells[idx]?.trim();
      return v === undefined || v === '' ? undefined : v;
    };
    const name = get('new_name');
    if (!name) continue;
    rows.push({
      group: get('group'),
      oldName: get('old_name'),
      name,
      category: get('category'),
      design: get('design'),
      description: get('description'),
      width: toNumber(cells[col.get('width') ?? -1]),
      height: toNumber(cells[col.get('height') ?? -1]),
      bytes: toNumber(cells[col.get('bytes') ?? -1]),
    });
  }
  return rows;
}

/** Human-readable caption for a filename: 'ring-opal-halo-01.jpg' → 'Ring Opal Halo 01'. */
export function humanizeName(name: string): string {
  return name
    .replace(/\.[a-z0-9]+$/i, '')
    .split(/[-_\s]+/)
    .filter((w) => w !== '')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

export interface BuildResult {
  items: AssetItem[];
  drift: ManifestDrift;
  /** Excluded UI/brand assets that are present on disk (e.g. `logo.png`). */
  uiAssets: string[];
}

/**
 * Cross-check manifest rows against the files on disk.
 * - One item per disk file (completeness: the set of images is the disk set).
 * - Disk files with a manifest row get its metadata (first row wins).
 * - Orphan disk files get fallback metadata (category UNCATEGORIZED,
 *   humanized caption) so completeness still holds.
 * - Manifest rows without a file are reported in drift.missingFiles and are
 *   excluded (never a broken <img>).
 */
export function buildManifest(
  rows: ManifestRow[],
  diskFiles: string[],
  excluded: Iterable<string> = UI_ASSETS,
): BuildResult {
  const rowByFile = new Map<string, ManifestRow>();
  for (const r of rows) if (!rowByFile.has(r.name)) rowByFile.set(r.name, r);
  const diskSet = new Set(diskFiles);
  const rowNames = new Set(rows.map((r) => r.name));
  const excludedSet = new Set(excluded);

  // UI/brand assets (e.g. logo.png) live in public/assets but are not gallery
  // content: drop them from the gallery items and from drift.orphans, and report
  // which are present on disk (uiAssets) so the header renders the logo only
  // when the file actually exists (constitution V).
  const galleryFiles = diskFiles.filter((f) => !excludedSet.has(f));

  const items: AssetItem[] = galleryFiles.map((file) => {
    const row = rowByFile.get(file);
    if (row) {
      return {
        name: file,
        src: `/assets/${file}`,
        category: row.category ?? UNCATEGORIZED,
        design: row.design,
        description: row.description ?? humanizeName(file),
        width: row.width,
        height: row.height,
        bytes: row.bytes,
        fromManifest: true,
      };
    }
    return {
      name: file,
      src: `/assets/${file}`,
      category: UNCATEGORIZED,
      description: humanizeName(file),
      fromManifest: false,
    };
  });
  items.sort((a, b) => (a.category === b.category ? a.name.localeCompare(b.name) : a.category.localeCompare(b.category)));

  return {
    items,
    drift: {
      missingFiles: [...rowByFile.keys()].filter((n) => !diskSet.has(n) && !excludedSet.has(n)),
      orphans: galleryFiles.filter((f) => !rowNames.has(f)),
    },
    uiAssets: [...excludedSet].filter((f) => diskSet.has(f)).sort(),
  };
}

export interface CategoryGroup {
  category: string;
  items: AssetItem[];
}

/** Group items by category; categories sorted by name; item order preserved. */
export function groupByCategory(items: AssetItem[]): CategoryGroup[] {
  const map = new Map<string, AssetItem[]>();
  for (const item of items) {
    const list = map.get(item.category);
    if (list) list.push(item);
    else map.set(item.category, [item]);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([category, groupItems]) => ({ category, items: groupItems }));
}

/** Filter to one category; 'all' (or empty) returns everything; unknown → []. */
export function filterByCategory(items: AssetItem[], category: string): AssetItem[] {
  if (category === 'all' || category === '') return items;
  return items.filter((i) => i.category === category);
}

export interface CategoryCount {
  name: string;
  count: number;
}

/** Per-category counts, sorted by category name. */
export function categoryCounts(items: AssetItem[]): CategoryCount[] {
  const map = new Map<string, number>();
  for (const i of items) map.set(i.category, (map.get(i.category) ?? 0) + 1);
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, count]) => ({ name, count }));
}
