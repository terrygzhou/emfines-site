#!/usr/bin/env node
// EMF-42: ensure gallery images are <=1600px wide JPEG q85, in-place.
// Only re-encodes files that are wider than 1600px; files already at
// target width or smaller are left alone (they were already optimised
// and re-encoding at q85 would increase file size).
import sharp from 'sharp';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const dir = new URL('../public/assets/', import.meta.url).pathname;
const MAX_WIDTH = 1600;
const QUALITY = 85;

const files = readdirSync(dir).filter((f) => /\.(jpe?g)$/i.test(f));

let processed = 0, skipped = 0, bytesSaved = 0;
const failures = [];

for (const f of files) {
  const p = path.join(dir, f);
  try {
    const meta = await sharp(p).metadata();
    if (meta.width && meta.width <= MAX_WIDTH) {
      skipped++;
      continue;
    }
    const before = statSync(p).size;
    await sharp(p)
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: QUALITY })
      .toFile(p);
    const after = statSync(p).size;
    bytesSaved += before - after;
    processed++;
    console.log(`resized ${f}: ${meta.width}x${meta.height} ${before} -> ${after} B`);
  } catch (err) {
    failures.push({ f, err: String(err) });
  }
}

console.log(`\nTotal JPEG files: ${files.length}`);
console.log(`Resized: ${processed}`);
console.log(`Skipped (already <= ${MAX_WIDTH}px, left untouched): ${skipped}`);
console.log(`Bytes saved: ${bytesSaved}`);
if (failures.length) {
  console.log('Failures:');
  for (const x of failures) console.log(`  ${x.f}: ${x.err}`);
  process.exit(1);
}
