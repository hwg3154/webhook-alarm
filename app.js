/**
 * Webhook Alarm - Client-side application
 * Polls server for webhooks and plays alarm.wav when received
 */

class WebhookAlarm {
    constructor() {
        this.audio = null;
        this.isPlaying = false;
        this.pollTimer = null;
        this.lastMessageTime = 0;

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

        // Start polling
        this.startPolling();

        // Log startup
        this.log('Alarm system initialized and ready');
        this.log('Polling for webhooks...');
    }

    startPolling() {
        this.log('📡 Starting webhook polling...');
        this.poll();
    }

    poll() {
        const url = `${window.location.protocol}//${window.location.host}/poll?lastMessage=${this.lastMessageTime}`;

        fetch(url)
            .then(response => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.json();
            })
            .then(data => {
                this.log('📡 Poll response received');

                if (data.messages && data.messages.length > 0) {
                    for (const msg of data.messages) {
                        this.lastMessageTime = msg.timestamp;
                        this.triggerAlarm(msg.message);
                    }
                }

                // Continue polling
                this.scheduleNextPoll();
            })
            .catch(err => {
                this.log(`❌ Poll error: ${err.message}`);
                this.scheduleNextPoll();
            });
    }

    scheduleNextPoll() {
        if (this.pollTimer) clearTimeout(this.pollTimer);
        this.pollTimer = setTimeout(() => this.poll(), 2000);
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