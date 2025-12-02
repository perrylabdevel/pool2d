import { SettingsManager } from '../ui/SettingsManager';
import { Renderer3D } from '../render/Renderer3D';

export class RemoteBridge {
    private ws!: WebSocket;
    private settingsManager: SettingsManager;
    private renderer: Renderer3D;
    private reconnectInterval: number = 1000;

    constructor(settingsManager: SettingsManager, renderer: Renderer3D) {
        this.settingsManager = settingsManager;
        this.renderer = renderer;
        this.connect();
        this.setupListeners();
    }

    private connect() {
        this.ws = new WebSocket('ws://localhost:8080');

        this.ws.onopen = () => {
            console.log('[RemoteBridge] Connected to relay server');
            this.broadcastState();
        };

        this.ws.onmessage = async (event) => {
            try {
                let data = event.data;
                if (data instanceof Blob) {
                    data = await data.text();
                }
                const message = JSON.parse(data);
                this.handleMessage(message);
            } catch (e) {
                console.error('[RemoteBridge] Failed to parse message', e);
            }
        };

        this.ws.onclose = () => {
            console.log('[RemoteBridge] Disconnected from relay server');
            setTimeout(() => this.connect(), this.reconnectInterval);
        };
    }

    private sendMessage(message: any) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }

    private setupListeners() {
        // Listen for local changes and broadcast them
        window.addEventListener('settings:geometry-changed', () => {
            this.sendMessage({
                type: 'settings:geometry-changed',
                payload: this.settingsManager.getGeometrySettings()
            });
        });

        window.addEventListener('settings:render-changed', () => {
            this.sendMessage({
                type: 'settings:render-changed',
                payload: this.settingsManager.getRenderSettings()
            });
        });

        window.addEventListener('settings:modern-geometry-changed', () => {
            this.sendMessage({
                type: 'settings:modern-geometry-changed',
                payload: this.settingsManager.getModernGeometrySettings()
            });
        });

        window.addEventListener('settings:audio-changed', () => {
            this.sendMessage({
                type: 'settings:audio-changed',
                payload: this.settingsManager.getAudioSettings()
            });
        });

        window.addEventListener('settings:game-changed', () => {
            this.sendMessage({
                type: 'settings:game-changed',
                payload: this.settingsManager.getGameSettings()
            });
        });

        window.addEventListener('settings:ui-colors-changed', () => {
            this.sendMessage({
                type: 'settings:ui-colors-changed',
                payload: this.settingsManager.getUIColors()
            });
        });

        window.addEventListener('settings:appearance-changed', () => {
            this.sendMessage({
                type: 'settings:appearance-changed',
                payload: this.settingsManager.getTableAppearance()
            });
        });

        this.sendMessage({
            type: 'settings:appearance-changed',
            payload: this.settingsManager.getTableAppearance()
        });

        window.addEventListener('settings:physics-changed', () => {
            this.sendMessage({
                type: 'settings:physics-changed',
                payload: this.settingsManager.getPhysicsSettings()
            });
        });
    }

    private broadcastState() {
        this.sendMessage({
            type: 'state',
            payload: {
                geometry: this.settingsManager.getGeometrySettings(),
                render: this.settingsManager.getRenderSettings(),
                modernGeometry: this.settingsManager.getModernGeometrySettings(),
                audio: this.settingsManager.getAudioSettings(),
                game: this.settingsManager.getGameSettings(),
                uiColors: this.settingsManager.getUIColors(),
                tableAppearance: this.settingsManager.getTableAppearance(),
                physics: this.settingsManager.getPhysicsSettings()
            }
        });
    }

    private handleMessage(message: any) {
        switch (message.type) {
            case 'requestState':
                this.broadcastState();
                break;
            case 'updateGeometry':
                console.log('[RemoteBridge] Received geometry update', message.payload);
                this.settingsManager.saveGeometrySettings(message.payload);
                // Trigger table rebuild for remote geometry changes
                window.dispatchEvent(new CustomEvent('settings:geometry-apply'));
                break;
            case 'updateRender':
                console.log('[RemoteBridge] Received render update', message.payload);
                this.settingsManager.saveRenderSettings(message.payload);
                break;
            case 'updateModernGeometry':
                console.log('[RemoteBridge] Received modern geometry update', message.payload);
                this.settingsManager.saveModernGeometrySettings(message.payload);
                // Trigger table rebuild for remote geometry changes
                window.dispatchEvent(new CustomEvent('settings:geometry-apply'));
                break;
            case 'updateAudio':
                console.log('[RemoteBridge] Received audio update', message.payload);
                this.settingsManager.saveAudioSettings(message.payload);
                break;
            case 'updateGame':
                console.log('[RemoteBridge] Received game update', message.payload);
                this.settingsManager.saveGameSettings(message.payload);
                break;
            case 'updateUIColors':
                console.log('[RemoteBridge] Received UI colors update', message.payload);
                this.settingsManager.saveUIColors(message.payload);
                break;
            case 'updateTableAppearance':
                console.log('[RemoteBridge] Received table appearance update', message.payload);
                this.settingsManager.saveTableAppearance(message.payload);
                break;
            case 'updatePhysics':
                console.log('[RemoteBridge] Received physics update', message.payload);
                this.settingsManager.savePhysicsSettings(message.payload);
                break;
            case 'command':
                this.handleCommand(message.command, message.payload);
                break;
        }
    }

    private handleCommand(command: string, payload?: any) {
        console.log('[RemoteBridge] Received command', command, payload);
        switch (command) {
            case 'resetGeometry':
                this.settingsManager.resetGeometrySettings();
                // Trigger table rebuild for remote geometry reset
                window.dispatchEvent(new CustomEvent('settings:geometry-apply'));
                break;
            case 'resetRender':
                this.settingsManager.resetRenderSettings();
                break;
            case 'resetAudio':
                this.settingsManager.resetAudioSettings();
                break;
            case 'resetUIColors':
                this.settingsManager.resetUIColors();
                break;
            case 'resetTableAppearance':
                this.settingsManager.resetTableAppearance();
                break;
            case 'resetPhysics':
                this.settingsManager.resetPhysicsSettings();
                break;
            case 'regenerateTextures':
                if (this.renderer && this.renderer.tableRenderer) {
                    this.renderer.tableRenderer.regenerateTextures();
                }
                break;
        }
    }
}
