#!/usr/bin/env node
// Compute the Subresource-Integrity hash for the Umami embed script
// (harden-site-security, task 6.3).
//
// The Umami <script> tag ships `integrity="sha384-..." crossorigin="anonymous"`,
// so a tampered, moved, or stale script is refused by the browser. The hash
// changes whenever the script changes, so RECOMPUTE THIS after every Umami
// upgrade and paste the printed value into ANALYTICS.umami.integrity in
// src/config.ts. Until that value is set, the embed is deliberately suppressed
// (no un-pinned third-party script is ever shipped).
//
// Usage:
//   node scripts/umami-integrity.mjs                          # public host
//   node scripts/umami-integrity.mjs https://umami.eywalink.org
//   UMAMI_HOST=http://pop-os:3102 node scripts/umami-integrity.mjs   # LAN build
import { createHash } from 'node:crypto';

const DEFAULT_HOST = 'https://umami.eywalink.org';
const host = (process.argv[2] || process.env.UMAMI_HOST || DEFAULT_HOST).replace(/\/+$/, '');
const url = `${host}/script.js`;

try {
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) {
    console.error(`[umami-integrity] ${url} -> HTTP ${res.status} (cannot compute a hash)`);
    process.exit(1);
  }
  const script = Buffer.from(await res.arrayBuffer());
  const digest = createHash('sha384').update(script).digest();
  const sri = `sha384-${digest.toString('base64')}`;
  console.log(`Umami embed script: ${url} (${script.length} bytes)`);
  console.log(`sha384 hex:     ${digest.toString('hex')}`);
  console.log('');
  console.log('Paste this line into ANALYTICS.umami in src/config.ts:');
  console.log(`  integrity: '${sri}',`);
  console.log('');
  console.log('Recompute after every Umami upgrade - a stale hash makes the');
  console.log('browser refuse to load the embed script.');
} catch (err) {
  console.error(`[umami-integrity] failed to fetch ${url}: ${err.message}`);
  console.error('Run this where the Umami host is reachable (networked); the');
  console.error('embed stays suppressed until the hash is set in src/config.ts.');
  process.exit(1);
}
