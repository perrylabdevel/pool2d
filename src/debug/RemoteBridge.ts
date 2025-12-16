import { SettingsManager } from '../ui/SettingsManager';
import { Renderer3D } from '../render/Renderer3D';
import { setPhysicsJsonOverride } from '../geometry/Geometry';

export class RemoteBridge {
    private ws!: WebSocket;
    private settingsManager: SettingsManager;
    private renderer: Renderer3D;
    private reconnectInterval: number = 1000;
    private isProcessingRemoteCommand: boolean = false;

    constructor(settingsManager: SettingsManager, renderer: Renderer3D) {
        this.settingsManager = settingsManager;
        this.renderer = renderer;
        this.loadPendingSkinFromStorage();
        this.connect();
        this.setupListeners();
        // Note: TableRenderer now loads pending skin directly from localStorage on init,
        // so we don't need to apply it here anymore
    }

    private connect() {
        const host = window.location.hostname || 'localhost';
        this.ws = new WebSocket(`ws://${host}:8080`);

        this.ws.onopen = () => {
            console.log('[RemoteBridge] Connected to relay server');
            this.broadcastState();

            // Check for saved recording from previous session/crash
            try {
                const savedRecording = localStorage.getItem('latest_recording');
                if (savedRecording) {
                    console.log('[RemoteBridge] Found saved recording, syncing to devtools...');
                    const data = JSON.parse(savedRecording);
                    this.sendMessage({
                        type: 'match:recorded',
                        payload: {
                            timestamp: Date.now(),
                            data: data
                        }
                    });
                    // Optional: Clear it after sending? 
                    // Better to keep it until overwritten to ensure it's available if devtools wasn't open yet.
                    // Or maybe clear it to avoid sending old data repeatedly?
                    // Let's keep it for now, devtools can handle duplicates or user can ignore.
                }
            } catch (e) {
                console.error('[RemoteBridge] Failed to sync saved recording', e);
            }
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
            // console.debug('[RemoteBridge] Disconnected from relay server');
            setTimeout(() => this.connect(), this.reconnectInterval);
        };
    }

    private sendMessage(message: any) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }

    private setupListeners() {
        // Listen for game restart - TableRenderer now loads pending skin directly from localStorage,
        // so we just need to clear tracking to allow future pushes
        window.addEventListener('game:restarted', () => {
            this.lastAppliedSkinName = null;
        });

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

        // Listen for match recordings and send to devtools
        window.addEventListener('match:recorded', (e: any) => {
            if (e.detail) {
                this.sendMessage({ type: 'match:recorded', payload: e.detail });
            }
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
            case 'table-editor:push-config':
                console.log('[RemoteBridge] Received table editor config', message.config);
                this.handleTableEditorPush(message.config);
                break;
        }
    }

    private pendingSkin: { name: string; image: string } | null = null;
    private lastAppliedSkinName: string | null = null;
    private applySkinTimer: number | null = null;
    private static readonly PENDING_SKIN_STORAGE_KEY = 'table-editor-pending-skin';

    private loadPendingSkinFromStorage() {
        try {
            const raw = localStorage.getItem(RemoteBridge.PENDING_SKIN_STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed?.image) {
                    this.pendingSkin = parsed;
                } else {
                    localStorage.removeItem(RemoteBridge.PENDING_SKIN_STORAGE_KEY);
                }
            }
        } catch (e) {
            console.warn('[RemoteBridge] Failed to load pending skin from storage', e);
        }
    }

    private handleTableEditorPush(config: any) {
        console.log('[RemoteBridge] handleTableEditorPush called with:', {
            hasOffsets: !!config.offsets,
            hasSkin: !!config.skin,
            skinName: config.skin?.name,
            hasImage: !!config.skin?.image,
            hasPhysicsJson: !!config.physicsJson,
            mode: config.mode,
        });

        // Store skin to apply after restart (if geometry changes trigger one)
        if (config.skin?.image) {
            this.pendingSkin = {
                name: config.skin.name,
                image: config.skin.image,
            };
            // Clear last applied so the new skin can be applied even if same name
            this.lastAppliedSkinName = null;
            try {
                localStorage.setItem(RemoteBridge.PENDING_SKIN_STORAGE_KEY, JSON.stringify(this.pendingSkin));
            } catch (e) {
                console.warn('[RemoteBridge] Failed to persist pending skin', e);
            }
        }

        const mode = config.mode === 'persist' ? 'persist' : 'live';
        const hasGeometryChange = Object.prototype.hasOwnProperty.call(config, 'physicsJson') || !!config.offsets;

        // Apply full physics.json override from table editor (null clears override)
        if (Object.prototype.hasOwnProperty.call(config, 'physicsJson')) {
            try {
                setPhysicsJsonOverride(config.physicsJson, { persist: mode === 'persist' });
                window.dispatchEvent(new CustomEvent('settings:geometry-apply'));
                console.log('[RemoteBridge] Applied physics.json override from table editor, triggering rebuild');
            } catch (err) {
                console.error('[RemoteBridge] Failed to apply physics.json override:', err);
            }
            // If no restart happens (e.g., live push), still apply skin immediately
            if (this.pendingSkin && (mode === 'live' || !config.physicsJson)) {
                setTimeout(() => this.applyPendingSkin(), 50);
            }
            return;
        }

        // Back-compat: Apply pocket offsets from table editor (X/Y for corner and side)
        if (config.offsets) {
            const currentGeom = this.settingsManager.getGeometrySettings();
            
            // Corner pocket offsets
            if (config.offsets.cornerX !== undefined) {
                currentGeom.CORNER_POCKET_OFFSET_X_IN = config.offsets.cornerX;
            }
            if (config.offsets.cornerY !== undefined) {
                currentGeom.CORNER_POCKET_OFFSET_Y_IN = config.offsets.cornerY;
            }
            
            // Side pocket offsets
            if (config.offsets.sideX !== undefined) {
                currentGeom.SIDE_POCKET_OFFSET_X_IN = config.offsets.sideX;
            }
            if (config.offsets.sideY !== undefined) {
                currentGeom.SIDE_POCKET_OFFSET_Y_IN = config.offsets.sideY;
            }
            
            this.settingsManager.saveGeometrySettings(currentGeom);
            
            // Trigger geometry rebuild - this will cause restart
            window.dispatchEvent(new CustomEvent('settings:geometry-apply'));
            console.log('[RemoteBridge] Applied table editor X/Y offsets, triggering rebuild');
        }

        // If we have a skin and no geometry changes (or live mode), apply immediately.
        // Also apply in persist mode to update current session, while still keeping pending for restart.
        if (this.pendingSkin && (!hasGeometryChange || mode === 'live')) {
            // Apply right away to avoid showing the old skin
            this.applyPendingSkinDebounced(0);
            // Quick retry to ensure texture swap after load
            this.applyPendingSkinDebounced(100);
        }

        // Failsafe: if a pending skin exists, attempt to apply again shortly after any push.
        if (this.pendingSkin) {
            this.applyPendingSkinDebounced(500);
        }
    }

    /**
     * Apply the pending skin to the table renderer and clear storage.
     */
    private applyPendingSkinDebounced(delayMs: number) {
        if (delayMs <= 0) {
            this.applyPendingSkin();
            return;
        }
        window.setTimeout(() => this.applyPendingSkin(), delayMs);
    }

    private applyPendingSkin() {
        if (!this.pendingSkin) return;
        // Skip if we already applied this exact skin (by name) to prevent layering
        if (this.lastAppliedSkinName === this.pendingSkin.name) {
            console.log('[RemoteBridge] Skin already applied, skipping:', this.pendingSkin.name);
            return;
        }

        console.log('[RemoteBridge] Applying pending skin:', this.pendingSkin.name);
        console.log('[RemoteBridge] Skin image data length:', this.pendingSkin.image?.length || 0);

        this.lastAppliedSkinName = this.pendingSkin.name;

        window.dispatchEvent(new CustomEvent('table-editor:apply-skin', {
            detail: this.pendingSkin
        }));
    }
}
