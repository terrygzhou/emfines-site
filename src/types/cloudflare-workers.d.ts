// Ambient declaration for the Cloudflare-provided `cloudflare:workers` module.
//
// In @astrojs/cloudflare v14 (Astro 6+), object bindings (KV namespaces, R2,
// secrets) are NOT surfaced on Astro.locals — the adapter only feeds *string*
// vars into Astro's getEnv() (see the "Astro.locals.runtime.env removed in
// v6" error the adapter throws). Object bindings are read directly from this
// module, exactly as the adapter's own server entry does.
declare module 'cloudflare:workers' {
  export const env: import('../env').EnquiryBindings;
  export const ctx: unknown;
}
