/**
 * Webhook Alarm - Client-side application
 * Connects to SSE endpoint and plays alarm.wav when webhook is received
 */

class WebhookAlarm {
    constructor() {
        this.audio = null;
        this.isPlaying = false;
        this.eventSource = null;

        this.init();
    }

    init() {
        // Calculate webhook URL based on current host
        const webhookUrl = `${window.location.protocol}//${window.location.host}/webhook`;
        document.getElementById('webhookUrl').textContent = `POST ${webhookUrl}`;

        // Event listeners
        document.getElementById('testBtn').addEventListener('click', () => this.triggerAlarm('Test alarm!'));
        document.getElementById('stopBtn').addEventListener('click', () => this.stopAlarm());
        document.getElementById('volume').addEventListener('input', (e) => {
            const volume = e.target.value;
            document.getElementById('volumeValue').textContent = `${volume}%`;
            if (this.audio) {
                this.audio.volume = volume / 100;
            }
        });

        // Connect to SSE
        this.connectSSE();

        // Log startup
        this.log('Alarm system initialized and ready');
        this.log('Connect to SSE and listening for webhooks...');
    }

    connectSSE() {
        const sseUrl = `${window.location.protocol}//${window.location.host}/sse`;

        // Create EventSource with credentials for cross-origin scenarios
        this.eventSource = new EventSource(sseUrl, {
            withCredentials: false
        });

        this.eventSource.onopen = () => {
            this.log('✅ SSE connection established');
            this.log(`Connection state: OPEN (${this.eventSource.readyState})`);
        };

        this.eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.ping) return; // Ignore ping messages

            this.triggerAlarm(data.message || 'Webhook received!');
        };

        this.eventSource.onerror = (err) => {
            const state = this.eventSource.readyState;
            let stateText = state === 0 ? 'CONNECTING' : state === 1 ? 'OPEN' : state === 2 ? 'CLOSED' : 'UNKNOWN';
            this.log(`❌ SSE error: ${err.type} (readyState: ${stateText})`);

            // Don't retry if permanently closed
            if (state === 2) {
                this.log('Connection permanently closed, restarting...');
                setTimeout(() => this.connectSSE(), 3000);
            } else {
                this.log('Temporary error, will retry...');
            }
        };
    }

    playAlarm() {
        // Create audio element for alarm.wav
        this.audio = new Audio('alarm.wav');
        this.audio.loop = true;

        // Set volume from slider
        const volumeSlider = document.getElementById('volume');
        this.audio.volume = volumeSlider ? volumeSlider.value / 100 : 1.0;

        // Play the alarm
        this.audio.play().catch(err => {
            console.error('Failed to play alarm:', err);
            this.log('Error playing alarm - check browser permissions');
        });
    }

    triggerAlarm(message) {
        if (this.isPlaying) return;

        this.isPlaying = true;
        this.log(`🚨 ALARM TRIGGERED: ${message}`);

        // Update UI
        document.body.classList.add('alarm-active');
        const status = document.getElementById('status');
        status.textContent = `⚠️ ALARM ACTIVE: ${message}`;
        status.classList.remove('listening');
        status.classList.add('alarm');

        // Play alarm sound
        this.playAlarm();
    }

    stopAlarm() {
        this.isPlaying = false;

        // Update UI
        document.body.classList.remove('alarm-active');
        const status = document.getElementById('status');
        status.textContent = '⏳ Waiting for webhook...';
        status.classList.remove('alarm');
        status.classList.add('listening');

        // Stop alarm sound
        if (this.audio) {
            this.audio.pause();
            this.audio.currentTime = 0;
            this.audio = null;
        }

        this.log('Alarm stopped');
    }

    log(message) {
        const log = document.getElementById('log');
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        log.insertBefore(entry, log.firstChild);

        // Keep only last 50 entries
        while (log.children.length > 50) {
            log.removeChild(log.lastChild);
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.alarm = new WebhookAlarm();
});