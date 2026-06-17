#!/usr/bin/env python3
"""
Webhook Alarm Server
A simple Flask server that accepts webhook calls and broadcasts them to connected clients via SSE.
"""

from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import json
import time
import uuid
import threading
import os
import logging

# Enable detailed logging for debugging
logging.basicConfig(level=logging.DEBUG)
log = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Log all registered routes at startup
def log_routes():
    log.info("=== Registered Routes ===")
    for rule in app.url_map.iter_rules():
        log.info(f"  {rule.methods} {rule.rule} -> {rule.endpoint}")
    log.info("========================")

# Log routes after app initialization
log_routes()

# Store connected clients for SSE
clients = {}
clients_lock = threading.Lock()


def event_stream(client_id):
    """Generate SSE events for a specific client."""
    while True:
        with clients_lock:
            if client_id not in clients:
                break
        time.sleep(0.1)


@app.route('/')
def index():
    """Serve the main HTML page."""
    index_path = os.path.join(os.path.dirname(__file__), 'index.html')
    with open(index_path, 'r') as f:
        return f.read()


@app.route('/app.js')
def app_js():
    """Serve the JavaScript file."""
    js_path = os.path.join(os.path.dirname(__file__), 'app.js')
    with open(js_path, 'r') as f:
        return f.read(), 200, {'Content-Type': 'application/javascript'}


@app.route('/alarm.wav')
def alarm_wav():
    """Serve the alarm audio file."""
    log.info("Serving alarm.wav")
    wav_path = os.path.join(os.path.dirname(__file__), 'alarm.wav')
    with open(wav_path, 'rb') as f:
        return f.read(), 200, {'Content-Type': 'audio/wav'}


@app.route('/webhook', methods=['POST'])
def webhook():
    """Receive webhook calls and broadcast to all connected clients."""
    log.info(f"=== WEBHOOK REQUEST ===")
    log.info(f"Headers: {dict(request.headers)}")
    log.info(f"Raw data: {request.get_data()}")

    try:
        data = request.get_json(silent=True) or {}
        log.info(f"Parsed JSON: {data}")
        message = data.get('message', 'Webhook received!')

        log.info(f"Webhook received: {message}")
        log.info(f"Connected clients: {len(clients)}")

        # Broadcast to all connected clients
        dead_clients = []
        with clients_lock:
            for client_id, queue in list(clients.items()):
                try:
                    queue.put_nowait({
                        'message': message,
                        'timestamp': time.time()
                    })
                    log.info(f"Sent message to client {client_id[:8]}")
                except Exception as e:
                    log.warning(f"Failed to send to client {client_id[:8]}: {e}")
                    dead_clients.append(client_id)

            # Clean up dead clients
            for client_id in dead_clients:
                del clients[client_id]
                log.info(f"Removed dead client {client_id[:8]}")

        result = jsonify({'status': 'success', 'message': 'Alarm triggered', 'clients_notified': len(clients)})
        log.info(f"Webhook response sent")
        return result, 200

    except Exception as e:
        log.error(f"Webhook error: {e}", exc_info=True)
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/sse')
def sse():
    """Server-Sent Events endpoint for real-time updates."""
    from flask import stream_with_context

    client_id = str(uuid.uuid4())
    import queue
    msg_queue = queue.Queue()

    log.info(f"New SSE client connecting: {client_id[:8]}")

    with clients_lock:
        clients[client_id] = msg_queue
        log.info(f"Client {client_id[:8]} registered. Total clients: {len(clients)}")

    def generate():
        try:
            # Send initial connection event
            yield ": connected\n\n"

            while True:
                try:
                    data = msg_queue.get(timeout=15)
                    log.info(f"Sending message to client {client_id[:8]}")
                    yield f"data: {json.dumps(data)}\n\n"
                except queue.Empty:
                    # Send ping to keep connection alive
                    yield f"data: {json.dumps({'ping': True})}\n\n"
        except GeneratorExit:
            log.info(f"SSE client disconnected: {client_id[:8]}")
            with clients_lock:
                if client_id in clients:
                    del clients[client_id]
                    log.info(f"Client {client_id[:8]} removed. Total clients: {len(clients)}")

    return Response(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache, no-store, must-revalidate, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
            'Content-Type': 'text/event-stream',
            'Transfer-Encoding': 'chunked',
            'Pragma': 'no-cache',
            'Expires': '0',
            'X-Content-Type-Options': 'nosniff',
        }
    )


if __name__ == '__main__':
    import os
    port = int(os.environ.get('PORT', 2292))
    print(f"Starting Webhook Alarm server on http://localhost:{port}")
    print(f"Webhook endpoint: http://localhost:{port}/webhook")
    print(f"SSE endpoint: http://localhost:{port}/sse")

    # Disable debug mode for production (behind Cloudflare tunnel)
    # Debug mode can cause SSE connection issues
    debug_mode = os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'

    app.run(host='0.0.0.0', port=port, debug=debug_mode, threaded=True)
