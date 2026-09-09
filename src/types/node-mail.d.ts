// node:mail — supported on Cloudflare Workers (nodejs_compat) for Cloudflare
// Email Service. Ambient declaration keeps `astro check` clean without
// @types/node; send() failures degrade to KV-only storage (emailDelivered: false).
declare module 'node:mail' {
  export class Attachment {
    constructor(opts: {
      filename?: string;
      content: string | Uint8Array;
      contentType?: string;
      contentEncoding?: 'base64' | 'binary';
    });
  }
  export class Mail {
    constructor(opts: { from: string; to: string | string[]; subject?: string });
    text?: string;
    html?: string;
    attachments?: Attachment[];
    send(): Promise<void>;
  }
}
