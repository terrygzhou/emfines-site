import type { APIContext } from 'astro';
import { env } from 'cloudflare:workers';
import {
  validatePayload,
  emailSubject,
  emailBody,
  type Enquiry,
  type PhotoRef,
  type Kind,
} from '@/lib/enquiry';

// Server-only endpoint (the single online feature). Order of operations:
// validate -> write KV (durable, 30-day TTL) -> send email (best effort).
// The form never writes to a permanent database; KV is an expiring archive.
//
// `env` (the worker's bindings object: KV namespace + secrets) comes from
// `cloudflare:workers` — the v14 adapter does not surface object bindings on
// Astro.locals, only string vars (via getEnv()).
export const prerender = false;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const KV_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days (T3 handoff: PII not stored permanently)

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

async function storeEnquiry(q: Enquiry): Promise<void> {
  const key = `enquiries/${Date.now()}-${crypto.randomUUID()}`;
  const photos: Array<{ filename: string; type: string; base64: string }> =
    q.kind === 'design'
      ? q.photos.map((p: PhotoRef) => ({ filename: p.filename, type: p.type, base64: p.data }))
      : [];
  await env.emfines_enquiries.put(
    key,
    JSON.stringify({ ...q, photos, receivedAt: new Date().toISOString() }),
    { expirationTtl: KV_TTL_SECONDS },
  );
}

/**
 * Send via Cloudflare Email Service (free tier, 10k emails/mo) using node:mail.
 * node:mail is a Cloudflare-runtime module; it is imported lazily so a runtime
 * without it degrades to archive-only (emailDelivered: false) instead of failing
 * to load the worker chunk. Returns false (never throws) when unconfigured or
 * on failure — the brief is already durably in KV, so nothing is lost.
 */
async function sendEnquiryEmail(q: Enquiry): Promise<boolean> {
  const to = env.ENQUIRY_TO;
  if (!to) return false; // not configured yet (OQ-1) — archive-only mode
  try {
    const { Mail, Attachment } = await import('node:mail');
    const mail = new Mail({
      from: env.ENQUIRY_FROM ?? 'emfines-site.terry-g-zhou.workers.dev',
      to,
      subject: emailSubject(q),
    });
    mail.text = emailBody(q);
    if (q.kind === 'design' && q.photos.length > 0) {
      mail.attachments = q.photos.map(
        (p) =>
          new Attachment({
            filename: p.filename,
            content: p.data,
            contentType: p.type,
            contentEncoding: 'base64',
          }),
      );
    }
    await mail.send();
    return true;
  } catch {
    return false;
  }
}

export async function POST({ request }: APIContext): Promise<Response> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const kind: Kind = payload && (payload as Record<string, unknown>).kind === 'contact' ? 'contact' : 'design';
  const result = validatePayload(payload, kind);
  if (!result.ok || !result.data) {
    return json({ error: (result.errors ?? []).join('; ') }, 400);
  }

  let stored = false;
  try {
    await storeEnquiry(result.data);
    stored = true;
  } catch (err) {
    console.error('[enquiry] KV write failed', err);
  }
  if (!stored) {
    return json({ error: 'Could not store your enquiry — please email us directly' }, 502);
  }

  const emailDelivered = await sendEnquiryEmail(result.data);
  return json({ ok: true, emailDelivered });
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

// Anything else on this route: method not allowed.
export async function GET(): Promise<Response> {
  return json({ error: 'Method not allowed' }, 405);
}
