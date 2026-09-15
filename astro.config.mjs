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
    // Web analytics (EMF-24) — build-time flavor. The self-hosted PostHog box
    // (posthog.local) and the self-hosted Matomo box (matomo.local / local
    // Docker) are reachable only on the owner's LAN, so each is enabled ONLY in
    // the matching LAN/local build. We compute each flavor here (astro.config
    // runs in real Node with the real process.env) and bake it into every bundle
    // as a Vite `define` literal, so the compiled config.ts always sees a
    // deterministic value — no reliance on process.env surviving Vite's
    // client/SSR env shims (which would otherwise always read `{}`).
    //   public (default): npm run build                      -> both LAN flags false
    //   LAN / local:      POSTHOG_LAN=1 MATOMO_LAN=1 build   -> both LAN flags true
    //   (independent: set either/both to taste; `npm run build:lan` sets both)
    define: {
      __POSTHOG_LAN__: JSON.stringify(
        process.env.POSTHOG_LAN === '1' || process.env.POSTHOG_LAN === 'true',
      ),
      __MATOMO_LAN__: JSON.stringify(
        process.env.MATOMO_LAN === '1' || process.env.MATOMO_LAN === 'true',
      ),
    },
  },
});
