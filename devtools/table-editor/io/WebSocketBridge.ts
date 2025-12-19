/**
 * WebSocketBridge - Handles communication between the table editor and the game
 *
 * Features:
 * - Auto-reconnection with exponential backoff
 * - Connection status events
 * - Geometry sync messaging
 * - Table push (live preview and persist)
 */

export interface WebSocketBridgeCallbacks {
  onConnectionChange?: (connected: boolean) => void;
  onPocketCaptureRadius?: (kind: 'corner' | 'side', value: number) => void;
}

export interface PushConfig {
  physicsJson: unknown;
  skin: { name: string; image: string } | null;
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
        this.reconnectDelay = MIN_RECONNECT_DELAY; // Reset on successful connect
        this.updateConnectionStatus(true);
        this.ws?.send(JSON.stringify({ type: 'requestState' }));
      };

      this.ws.onmessage = async (event) => {
        let data: unknown = event.data;
        if (data instanceof Blob) data = await data.text();
        try {
          const message = JSON.parse(data as string);
          this.handleMessage(message);
        } catch {
          // Ignore parse errors
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.updateConnectionStatus(false);
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        // Error will trigger onclose, which handles reconnection
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

    // Exponential backoff with max delay
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, MAX_RECONNECT_DELAY);
  }

  private handleMessage(message: unknown): void {
    if (!message || typeof message !== 'object') return;
    const msg = message as Record<string, unknown>;

    if (msg.type === 'state') {
      const payload = msg.payload as Record<string, unknown> | undefined;
      const geom = payload?.geometry as Record<string, unknown> | undefined;
      this.handleGeometryUpdate(geom);
      return;
    }

    if (msg.type === 'settings:geometry-changed') {
      const payload = msg.payload as Record<string, unknown> | undefined;
      this.handleGeometryUpdate(payload);
      return;
    }
  }

  private handleGeometryUpdate(geom: Record<string, unknown> | undefined): void {
    if (!geom) return;

    const corner = geom.CORNER_POCKET_CAPTURE_RADIUS_IN;
    const side = geom.SIDE_POCKET_CAPTURE_RADIUS_IN;

    if (typeof corner === 'number' && Number.isFinite(corner)) {
      this.callbacks.onPocketCaptureRadius?.('corner', corner);
    }
    if (typeof side === 'number' && Number.isFinite(side)) {
      this.callbacks.onPocketCaptureRadius?.('side', side);
    }
  }

  private updateConnectionStatus(connected: boolean): void {
    // Update DOM status indicators
    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text');
    if (dot) dot.classList.toggle('connected', connected);
    if (text) text.textContent = connected ? 'Connected' : 'Disconnected';

    // Notify callback
    this.callbacks.onConnectionChange?.(connected);
  }

  get connected(): boolean {
    return this.isConnected;
  }

  sendGeometryPatch(patch: Record<string, unknown>): boolean {
    if (!this.ws || !this.isConnected) {
      alert('Not connected to game. Start `npm run dev` (relay on :8080).');
      return false;
    }
    this.ws.send(JSON.stringify({ type: 'updateGeometry', payload: patch }));
    return true;
  }

  pushToGame(mode: 'live' | 'persist', config: PushConfig): boolean {
    if (!this.ws || !this.isConnected) {
      alert('Not connected to game. Start `npm run dev` (relay on :8080).');
      return false;
    }

    this.ws.send(
      JSON.stringify({
        type: 'table-editor:push-config',
        config: {
          mode,
          physicsJson: config.physicsJson,
          skin: config.skin,
        },
      })
    );
    return true;
  }

  disconnect(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      // Remove handlers to prevent reconnection on intentional close
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.close();
      this.ws = null;
    }

    this.isConnected = false;
    this.updateConnectionStatus(false);
  }
}
