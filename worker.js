// EM Fine Studio — static site + enquiry endpoint on Cloudflare Workers (free tier)
export const ASSETS = {};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// No paid backend: log the payload for now. T2 replaces this with a real sink
// (Cloudflare KV + D1 or a form service) once the day-8 checkpoint lands.
function logEnquiry(enquiry) {
  console.log('[enquiry]', JSON.stringify(enquiry));
  return true;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Enquiry endpoint (the one online feature)
    if (url.pathname === '/v1/enquiries') {
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
      }
      if (request.method !== 'POST') {
        return jsonResponse({ error: 'Method not allowed' }, 405);
      }
      let body;
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ error: 'Invalid JSON body' }, 400);
      }
      const name = String(body.name ?? '').trim();
      const email = String(body.email ?? '').trim();
      const interest = String(body.interest ?? '').trim();
      if (!name || !email || !interest || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return jsonResponse({ error: 'name, valid email, and interest are required' }, 400);
      }
      logEnquiry({ ...body, receivedAt: new Date().toISOString() });
      return jsonResponse({ ok: true, received: true }, 200);
    }

    // Static site
    const response = await ASSETS.fetch(request);
    return response;
  },
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
