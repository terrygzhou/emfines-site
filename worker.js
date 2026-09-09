// EM Fine Studio — static site + enquiry endpoint on Cloudflare Workers (free tier)
// Vertical slice (day 8) + day-14 checkpoint: durable enquiry sink (Cloudflare KV).
//
// Day-14 checkpoint cut-scope decisions ("cut scope, not quality"):
//   KEEP (quality): briefs are validated and durably stored in Cloudflare KV so
//                   customer enquiries do not vanish with ephemeral Workers logs.
//   CUT (scope): real-time email/notification push to the owner. No free-tier,
//                no-credentials email channel fits the "no paid tooling" budget,
//                so delivery is deferred post-30-day. Owner retrieves briefs
//                from the durable store (wrangler kv key list/get).
//
// Response contract for POST /v1/enquiries is unchanged from the day-8 slice
// ({ ok, received }) so the live demo path QA is running stays stable.
export const ASSETS = {};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const KV_BINDING = "emfines_enquiries";

// Day-14 checkpoint: persist the brief durably instead of only logging it.
async function storeEnquiry(env, enquiry) {
  const store = env[KV_BINDING];
  if (!store) {
    // No KV binding (local/dev): degrade gracefully to logging.
    console.log("[enquiry:unstored]", JSON.stringify(enquiry));
    return false;
  }
  const safeTs = enquiry.receivedAt.replace(/[:.]/g, "-");
  const key = "enquiries/" + safeTs + "-" + crypto.randomUUID();
  await store.put(key, JSON.stringify(enquiry));
  return true;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Enquiry endpoint (the one online feature)
    if (url.pathname === "/v1/enquiries") {
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
      }
      if (request.method !== "POST") {
        return jsonResponse({ error: "Method not allowed" }, 405);
      }
      let body;
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ error: "Invalid JSON body" }, 400);
      }
      const name = String(body.name ?? "").trim();
      const email = String(body.email ?? "").trim();
      const interest = String(body.interest ?? "").trim();
      if (!name || !email || !interest || !EMAIL_RE.test(email)) {
        return jsonResponse({ error: "name, valid email, and interest are required" }, 400);
      }
      const enquiry = {
        name,
        email,
        interest,
        budget: body.budget ? String(body.budget).trim() : undefined,
        brief: body.brief ? String(body.brief).trim() : undefined,
        wantsPhoto: Boolean(body.photos), // form checkbox field is `photos`
        receivedAt: new Date().toISOString(),
      };
      try {
        const stored = await storeEnquiry(env, enquiry);
        if (!stored) console.log("[enquiry]", JSON.stringify(enquiry));
        return jsonResponse({ ok: true, received: true }, 200);
      } catch (err) {
        // Durable store unavailable: surface it rather than claim a store we did not make.
        console.error("[enquiry:store-failed]", err && err.message ? err.message : String(err));
        return jsonResponse({ error: "Could not store your brief, please try again" }, 500);
      }
    }

    // Static site
    const response = await ASSETS.fetch(request);
    return response;
  },
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
