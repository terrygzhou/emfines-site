/// <reference types="astro/client" />

// Minimal Cloudflare Workers binding types (kept local so we don't pull
// @cloudflare/workers-types globally into the DOM-heavy Astro codebase).
export interface KVNamespaceLite {
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  get(key: string): Promise<string | null>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string }): Promise<{ keys: Array<{ name: string; expiration?: number }>; cursor: string; listComplete: boolean }>;
}

export interface EnquiryBindings {
  emfines_enquiries: KVNamespaceLite;
  /** Studio inbox that enquiries land in (Cloudflare Email Service free tier). */
  ENQUIRY_TO?: string;
  /** Verified Cloudflare Email Service sender route; defaults to the worker's .workers.dev hostname. */
  ENQUIRY_FROM?: string;
}
