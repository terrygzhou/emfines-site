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
    // Web analytics (EMF-24) — build-time flavor. The self-hosted Umami box
    // (pop-os:3102) is reachable only on the owner's LAN, so the LAN flavor
    // (MATOMO_LAN=1 build) points Umami at the LAN host instead of the public
    // tunnel; Matomo (matomo.eywalink.org, Cloudflare tunnel) is public and
    // enabled in every build.
    // We compute the flavor here (astro.config runs in real Node with the
    // real process.env) and bake it into every bundle as a Vite `define`
    // literal, so the compiled config.ts always sees a deterministic value —
    // no reliance on process.env surviving Vite's client/SSR env shims
    // (which would otherwise always read `{}`).
    //   public (default): npm run build        -> Umami tunnel host
    //   LAN / local:      MATOMO_LAN=1 build   -> Umami LAN host
    define: {
      __MATOMO_LAN__: JSON.stringify(
        process.env.MATOMO_LAN === '1' || process.env.MATOMO_LAN === 'true',
      ),
    },
  },
});
