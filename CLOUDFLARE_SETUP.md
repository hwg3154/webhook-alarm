# Cloudflare Tunnel + SSE Setup

## Problem

Server-Sent Events (SSE) connections are dropping when running behind a Cloudflare tunnel. This is caused by:

1. **Cloudflare timeout limits** - Free tier has 100 second timeout for HTTP responses without data
2. **Intermediate buffering** - Cloudflare or the tunnel may buffer responses
3. **Connection keep-alive** - SSE needs periodic data to stay alive

## Solution Options

### Option 1: Quick Fix (Already Applied)

The server code has been updated with:
- More frequent ping intervals (15 seconds instead of 30)
- Additional no-cache headers
- `Transfer-Encoding: chunked` header
- `no-transform` directive to prevent compression

**Update your server and restart.** This alone may solve the issue.

### Option 2: Cloudflare Worker (Recommended for Production)

Deploy the included `cloudflare-worker.js` to handle SSE properly:

```bash
# Install Wrangler CLI
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Create worker project if needed
wrangler init sse-worker
# Copy cloudflare-worker.js content to worker-src in wrangler.toml or use the file directly

# Deploy
wrangler deploy
```

In your `wrangler.toml`:
```toml
name = "sse-worker"
main = "cloudflare-worker.js"
compatibility_date = "2024-01-01"

[vars]
ORIGIN_URL = "http://localhost:5000"  # Your tunnel URL
```

### Option 3: Alternative - Use WebSockets

If SSE continues to have issues, consider switching to WebSockets which handle reconnection more gracefully through proxies. This would require rewriting `server.py` and `app.js`.

## Debugging Tips

1. **Check browser console** - Look at the SSE connection state in DevTools Network tab
2. **Test direct connection** - Bypass Cloudflare temporarily to verify the server works
3. **Monitor ping frequency** - The client should receive pings every 15 seconds
4. **Check Cloudflare dashboard** - Look at analytics for connection patterns

## Testing the Connection

Open your browser's DevTools Console and run:

```javascript
const es = new EventSource('/sse');
es.onopen = () => console.log('Connected');
es.onmessage = (e) => console.log('Message:', e.data);
es.onerror = (e) => console.log('Error:', e);
```

If you see repeated open/close cycles, the connection is timing out.