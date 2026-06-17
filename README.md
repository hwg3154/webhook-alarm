# Webhook Alarm

A simple web-based alarm system that plays a loud sound when it receives a webhook call. Perfect for waking up or getting notified when something important happens.

## Features

- 🚨 Plays `alarm.wav` when a webhook is received
- 🔊 Adjustable volume control
- 🔁 Loops the alarm until you stop it
- 📡 Real-time updates via Server-Sent Events (SSE)
- 🌐 Works from any device on your network

## Quickstart

### 1. Create a virtual environment

```bash
cd alarm2
python3 -m venv venv
```

### 2. Activate the virtual environment

**macOS/Linux:**
```bash
source venv/bin/activate
```

**Windows:**
```bash
venv\Scripts\activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Start the server

```bash
# Default port 5000
python server.py

# Or specify a custom port
PORT=1234 python server.py
```

### 5. Open in your browser

Navigate to `http://localhost:5000` (or your custom port).

### 6. Trigger the alarm

**Option A: Use the Test Alarm button**
Click "Test Alarm" on the web page.

**Option B: Send a webhook via curl**
```bash
curl -X POST http://localhost:5000/webhook \
  -H "Content-Type: application/json" \
  -d '{"message":"Wake up!"}'
```

**Option C: From another script**
```python
import requests

requests.post('http://localhost:5000/webhook', json={
    'message': 'Something happened!'
})
```

## Files

- `index.html` - Main web interface
- `app.js` - Client-side alarm logic
- `server.py` - Flask server with webhook and SSE endpoints
- `alarm.wav` - The alarm sound file (replace with your own!)
- `requirements.txt` - Python dependencies

## How it Works

1. The Flask server runs and listens for POST requests at `/webhook`
2. When a webhook is received, the server broadcasts it via SSE to all connected browsers
3. The browser receives the event and starts playing `alarm.wav` on loop
4. Click "Stop Alarm" to silence it

## Customization

### Change the alarm sound
Replace `alarm.wav` with any audio file you want. Update the filename in `app.js` if needed.

### Change the port
Set the `PORT` environment variable:
```bash
PORT=8080 python server.py
```

### Access from other devices
The server binds to `0.0.0.0` by default, so you can access it from other devices on your network at `http://YOUR_IP:5000`.

## License

MIT