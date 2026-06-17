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

# Log all registered routes for debugging
@app.before_first_request
def log_routes():
    log.info("=== Registered Routes ===")
    for rule in app.url_map.iter_rules():
        log.info(f"  {rule.methods} {rule.rule} -> {rule.endpoint}")
    log.info("========================")

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
    wav_path = os.path.join(os.path.dirname(__file__), 'alarm.wav')
    with open(wav_path, 'rb') as f:
        return f.read(), 200, {'Content-Type': 'audio/wav'}


@app.route('/webhook', methods=['POST'])
def webhook():
    """Receive webhook calls and broadcast to all connected clients."""
    try:
        data = request.get_json(silent=True) or {}
        message = data.get('message', 'Webhook received!')

        # Broadcast to all connected clients
        dead_clients = []
        with clients_lock:
            for client_id, queue in list(clients.items()):
                try:
                    queue.put_nowait({
                        'message': message,
                        'timestamp': time.time()
                    })
                except:
                    dead_clients.append(client_id)

            # Clean up dead clients
            for client_id in dead_clients:
                del clients[client_id]

        return jsonify({'status': 'success', 'message': 'Alarm triggered', 'clients_notified': len(clients)}), 200

    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/sse')
def sse():
    """Server-Sent Events endpoint for real-time updates."""
    client_id = str(uuid.uuid4())
    import queue
    msg_queue = queue.Queue()

    with clients_lock:
        clients[client_id] = msg_queue

    def generate():
        try:
            while True:
                try:
                    data = msg_queue.get(timeout=15)
                    yield f"data: {json.dumps(data)}\n\n"
                except queue.Empty:
                    # Send ping more frequently to keep connection alive through proxies
                    yield f"data: {json.dumps({'ping': True})}\n\n"
        except GeneratorExit:
            with clients_lock:
                if client_id in clients:
                    del clients[client_id]

    return Response(
        generate(),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache, no-store, must-revalidate, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
            'Content-Type': 'text/event-stream',
            'Transfer-Encoding': 'chunked',
            'Pragma': 'no-cache',
            'Expires': '0',
        }
    )


if __name__ == '__main__':
    import os
    port = int(os.environ.get('PORT', 5000))
    print(f"Starting Webhook Alarm server on http://localhost:{port}")
    print(f"Webhook endpoint: http://localhost:{port}/webhook")
    print(f"SSE endpoint: http://localhost:{port}/sse")

    # Disable debug mode for production (behind Cloudflare tunnel)
    # Debug mode can cause SSE connection issues
    debug_mode = os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'

    app.run(host='0.0.0.0', port=port, debug=debug_mode, threaded=True)
