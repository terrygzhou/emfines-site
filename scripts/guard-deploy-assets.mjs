#!/usr/bin/env node
// guard-deploy-assets.mjs (EMF-33)
//
// Refuse to `wrangler deploy` when the client asset tree is empty/missing
// (no /assets/* images).
//
// Root cause this protects against: `public/assets/` (the source of every
// /assets/* image) is gitignored and NOT tracked, so a build/deploy from a
// clean or CI checkout — or any state where the images weren't present —
// produces a dist/client with only index.html and page HTMLs, no images.
// Cloudflare *replaces the entire static-asset set* on each deploy, so such
// a deploy silently WIPES the live Worker's /assets/* set (observed live
// 404s in EMF-29/EMF-33: "only /index.html uploaded"). Failing fast here
// means a no-image deploy can never take down the live assets.
//
// Runs as part of `npm run deploy` (after `build`, before `wrangler deploy`).
// Exits 0 only when the build produced a deployable, image-bearing tree.

import { existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const clientDir = join(root, 'dist', 'client');
const assetsDir = join(clientDir, 'assets');
const IMG_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif']);

function countImages(dir) {
  if (!existsSync(dir)) return 0;
  let n = 0;
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (!ent.isFile()) continue;
    const ext = ent.name.slice(ent.name.lastIndexOf('.')).toLowerCase();
    if (IMG_EXTS.has(ext)) n += 1;
  }
  return n;
}

const hasIndex = existsSync(join(clientDir, 'index.html'));
const n = countImages(assetsDir);

if (!hasIndex) {
  console.error('[guard-deploy-assets] FAIL: dist/client/index.html not found.');
  console.error('  Build first (`npm run build`) so dist/client is populated.');
  process.exit(1);
}
if (n === 0) {
  console.error('[guard-deploy-assets] FAIL: no image files under dist/client/assets/.');
  console.error('  public/assets/ is gitignored — a clean/CI build has no gallery/studio images,');
  console.error('  and deploying now would WIPE the live Worker\'s /assets/* set (EMF-33).');
  console.error('  Populate public/assets/ (owner workspace) and re-run `npm run build`.');
  process.exit(1);
}

console.log(
  `[guard-deploy-assets] OK: dist/client/index.html present; ${n} image(s) in dist/client/assets/ — safe to deploy.`,
);
process.exit(0);
