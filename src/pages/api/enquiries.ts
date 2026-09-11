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
import {
  RATE_LIMIT_PER_WINDOW,
  RATE_WINDOW_MS,
  rateWindowStartMs,
  decideRateLimit,
  type RateDecision,
} from '@/lib/ratelimit';

// Server-only endpoint (the single online feature). Order of operations:
// rate-limit -> validate -> write KV (durable, 30-day TTL) -> send email (best effort).
// The form never writes to a permanent database; KV is an expiring archive.
//
// `env` (the worker's bindings object: KV namespace + secrets) comes from
// `cloudflare:workers` — the v14 adapter does not surface object bindings on
// Astro.locals, only string vars (via getEnv()).
export const prerender = false;

// No CORS: the enquiry forms are same-origin and need no cross-origin access.
// Cross-origin scripted JSON posts fail the preflight (there is no OPTIONS
// handler), and curl-style abuse is throttled by the worker-side rate limit.

const KV_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days (T3 handoff: PII not stored permanently)
const RL_TTL_SECONDS = RATE_WINDOW_MS / 1000; // rate-limit counter lives one window

function json(data: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra },
  });
}

/**
 * Worker-side per-client-IP rate limit (free tier: zone-level rate-limiting
 * rules are a paid feature, Constitution I). One short-lived KV counter per
 * client IP + 5-minute window; a throttle (or KV failure) never touches the
 * enquiry archive. KV failures fail open — logged, request proceeds
 * (Constitution V: optional hardening never breaks the durable write path).
 */
async function rateLimitPass(decision: RateDecision, ip: string): Promise<boolean> {
  try {
    const key = `ratelimit/${ip}/${decision.windowStart}`;
    await env.emfines_enquiries.put(key, String(decision.nextCount), {
      expirationTtl: RL_TTL_SECONDS,
    });
    return decision.allowed;
  } catch (err) {
    console.error('[enquiry] rate-limit counter unavailable — failing open', err);
    return true;
  }
}

function clientIp(request: Request): string {
  // Workers injects the visitor IP into `request.cf` on all plans.
  const cf = (request as unknown as { cf?: { ip?: string } }).cf;
  return cf?.ip ?? 'unknown';
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
 * Send the enquiry email. Primary path: Brevo API (free tier: 300 emails/day,
 * no monthly cap) — enabled by setting the BREVO_API_KEY worker secret.
 * Fallback: Cloudflare Email Service via node:mail (requires a Workers Paid
 * account; on free plans the lazy import fails and we degrade to
 * archive-only). Sender policy (harden-site-security): a VERIFIED sender
 * address (BREVO_FROM / ENQUIRY_FROM) is required — when unconfigured the
 * channel is skipped (archive-only) rather than defaulting to the
 * .workers.dev hostname (account-name disclosure). Either way: returns
 * false (never throws) when unconfigured or on failure — the brief is
 * already durably in KV, so nothing is lost.
 */
function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

async function sendViaBrevo(q: Enquiry, to: string, apiKey: string, from: string): Promise<boolean> {
  const bodyText = emailBody(q);
  const payload: Record<string, unknown> = {
    sender: {
      name: 'EM Fine Studio',
      // BREVO_FROM lets us send from a verified domain (e.g. after adding the
      // SPF/DKIM records for emfinestudio.com in Brevo); ENQUIRY_FROM is the
      // Cloudflare Email Service verified sender.
      email: from,
    },
    to: [{ email: to }],
    subject: emailSubject(q),
    textContent: bodyText,
    html: `<pre style="font-family:monospace;white-space:pre-wrap;">${escapeHtml(bodyText)}</pre>`,
  };
  if (q.kind === 'design' && q.photos.length > 0) {
    payload.attachments = q.photos.map(
      (p) => ({ filename: p.filename, content: p.data, mimeType: p.type }),
    );
  }
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Brevo API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  return true;
}

async function sendEnquiryEmail(q: Enquiry): Promise<boolean> {
  const to = env.ENQUIRY_TO;
  if (!to) return false; // not configured yet (OQ-1) — archive-only mode
  const verifiedFrom = env.BREVO_FROM ?? env.ENQUIRY_FROM;
  if (!verifiedFrom) {
    console.log('[enquiry] no verified sender configured (ENQUIRY_FROM/BREVO_FROM) — archive-only');
    return false;
  }
  if (env.BREVO_API_KEY) {
    try {
      return await sendViaBrevo(q, to, env.BREVO_API_KEY, verifiedFrom);
    } catch (err) {
      console.error('[enquiry] brevo send failed', err);
      return false;
    }
  }
  try {
    const { Mail, Attachment } = await import('node:mail');
    const mail = new Mail({
      from: verifiedFrom,
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
  } catch (err) {
    console.error('[enquiry] email send failed', err);
    return false;
  }
}

export async function POST({ request }: APIContext): Promise<Response> {
  // 1) rate limit (before parsing the body — the cheapest rejection).
  //    Every in-window POST bumps the counter; over-limit requests get 429
  //    and are neither archived nor emailed.
  const ip = clientIp(request);
  const nowMs = Date.now();
  // Read this window's counter; a KV read failure fails open (treat the window
  // as empty) and is logged — never 5xx the write path (Constitution V).
  let rawCount = 0;
  try {
    rawCount = Number(await env.emfines_enquiries.get(`ratelimit/${ip}/${rateWindowStartMs(nowMs)}`)) || 0;
  } catch (err) {
    console.error('[enquiry] rate-limit counter read failed — failing open', err);
  }
  const decision = decideRateLimit(rawCount, nowMs, RATE_LIMIT_PER_WINDOW);
  if (!decision.allowed) {
    await rateLimitPass(decision, ip);
    return json(
      { error: 'Too many requests — please try again later' },
      429,
      { 'Retry-After': String(decision.retryAfterSec) },
    );
  }
  await rateLimitPass(decision, ip);

  // 2) validate
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

  // 3) durable archive
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

  // 4) email (best effort)
  const emailDelivered = await sendEnquiryEmail(result.data);
  return json({ ok: true, emailDelivered });
}

// Non-POST methods answer 405 "method not allowed" with NO Access-Control-*
// headers: the forms are same-origin and this endpoint deliberately supports no
// CORS preflight, so a cross-origin OPTIONS preflight fails while the same-origin
// form's POST still works. GET and a CORS-free OPTIONS handler both return 405
// (site-security acceptance: "OPTIONS -> 405, no CORS headers").
export async function GET(): Promise<Response> {
  return json({ error: 'Method not allowed' }, 405);
}

export async function OPTIONS(): Promise<Response> {
  return json({ error: 'Method not allowed' }, 405);
}
