export interface WebSocketBridgeCallbacks {
    onConnectionChange?: (connected: boolean) => void;
}

export interface CuePushConfig {
    skin: { 
        name: string; 
        subtitle?: string;
        image: string;
        tipOffsetPx: number;
        lengthScale: number;
        thicknessScale: number;
        ppi: number;
        power?: number;
        accuracy?: number;
        spin?: number;
        aim?: number;
    } | null;
}

const WS_PORT = 8080;
const MIN_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;

export class WebSocketBridge {
    private ws: WebSocket | null = null;
    private isConnected: boolean = false;
    private callbacks: WebSocketBridgeCallbacks = {};
    private reconnectDelay: number = MIN_RECONNECT_DELAY;
    private reconnectTimer: number | null = null;

    constructor(callbacks?: WebSocketBridgeCallbacks) {
        if (callbacks) {
            this.callbacks = callbacks;
        }
    }

    setCallbacks(callbacks: WebSocketBridgeCallbacks): void {
        this.callbacks = callbacks;
    }

    connect(): void {
        const wsUrl = `ws://${window.location.hostname}:${WS_PORT}`;
        try {
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                this.isConnected = true;
                this.reconnectDelay = MIN_RECONNECT_DELAY;
                this.updateConnectionStatus(true);
            };

            this.ws.onmessage = async (event) => {
                let data: unknown = event.data;
                if (data instanceof Blob) data = await data.text();
                // Currently cue editor doesn't handle incoming messages other than handshake implicitly
            };

            this.ws.onclose = () => {
                this.isConnected = false;
                this.updateConnectionStatus(false);
                this.scheduleReconnect();
            };

            this.ws.onerror = () => {
                // Error will trigger onclose
            };
        } catch {
            this.scheduleReconnect();
        }
    }

    private scheduleReconnect(): void {
        if (this.reconnectTimer !== null) {
            clearTimeout(this.reconnectTimer);
        }

        this.reconnectTimer = window.setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
        }, this.reconnectDelay);

        this.reconnectDelay = Math.min(this.reconnectDelay * 2, MAX_RECONNECT_DELAY);
    }

    private updateConnectionStatus(connected: boolean): void {
        const dot = document.getElementById('status-dot');
        const text = document.getElementById('status-text');
        if (dot) dot.classList.toggle('connected', connected);
        if (text) text.textContent = connected ? 'Connected' : 'Disconnected';
        this.callbacks.onConnectionChange?.(connected);
    }

    pushToGame(mode: 'live' | 'persist', config: CuePushConfig): boolean {
        if (!this.ws || !this.isConnected) {
            alert('Not connected to game. Start `npm run dev` (relay on :8080).');
            return false;
        }

        this.ws.send(
            JSON.stringify({
                type: 'cue-editor:push-config',
                config: {
                    mode,
                    skin: config.skin,
                },
            })
        );
        return true;
    }
}
