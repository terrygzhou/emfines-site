import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';

// EM Fine Studio — Astro static site + one server API endpoint,
// deployed to Cloudflare Workers free tier (stable URL, never moved).
//
// The @astrojs/cloudflare adapter (v14, vite-based) generates the deploy-time
// wrangler config at `dist/server/wrangler.json` (main: entry.mjs,
// assets: ../client, no_bundle). The root wrangler.jsonc supplies name/compat/
// KV bindings; `main`/`assets` are managed by the adapter — do not set them
// here or in the root config (a build-time `main` hijacks the worker entry).
export default defineConfig({
  site: 'https://emfinestudio.com',
  output: 'server',
  adapter: cloudflare({
    // Serve original images from /assets verbatim — no image pipeline (plan §Images).
    imageService: 'passthrough',
  }),
  vite: {
    plugins: [tailwindcss()],
  },
});
