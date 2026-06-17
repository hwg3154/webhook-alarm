/**
 * Cloudflare Worker for SSE passthrough
 * This prevents Cloudflare from buffering SSE responses
 *
 * Deploy with:
 * 1. Install Wrangler: npm install -g wrangler
 * 2. Login: wrangler login
 * 3. Deploy: wrangler deploy
 *
 * Or add this logic to an existing Worker that routes to your tunnel
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Handle SSE endpoint specially
    if (url.pathname === '/sse') {
      return handleSSE(request, env.ORIGIN_URL);
    }

    // Forward all other requests normally
    const origin = env.ORIGIN_URL || 'http://localhost:5000';
    const newUrl = new URL(url.pathname + url.search, origin);
    const newRequest = new Request(newUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });

    return fetch(newRequest);
  }
};

async function handleSSE(request, originUrl) {
  const url = new URL(request.url);
  const origin = originUrl || 'http://localhost:5000';
  const newUrl = new URL('/sse' + url.search, origin);

  const newRequest = new Request(newUrl, {
    method: 'GET',
    headers: request.headers,
  });

  try {
    const response = await fetch(newRequest, {
      headers: {
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

    // Return with headers that prevent buffering
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-store, must-revalidate, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        'Transfer-Encoding': 'chunked',
        'Pragma': 'no-cache',
        'Expires': '0',
        // Critical for Cloudflare: disable their automatic buffering
        'CDN-Cache-Control': 'no-store',
        'Cloudflare-CDN-Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'SSE connection failed', details: error.message }),
      {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}