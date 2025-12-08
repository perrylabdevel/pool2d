import {
    GeometrySettings,
    RenderSettings,
    AudioSettings,
    GameSettings,
    UIColors,
    TableAppearance,
    DEFAULT_AUDIO_SETTINGS,
    DEFAULT_GAME_SETTINGS,
    DEFAULT_UI_COLORS,
    DEFAULT_TABLE_APPEARANCE,
    PhysicsSettings,
    DEFAULT_PHYSICS_SETTINGS
} from '../src/ui/SettingsManager';
import { defaultRenderLayerSettings } from '../src/render/RenderLayers';
import { ModernPocketGeometry } from '../src/geometry/ModernGeometry';

export class RemoteSettingsManager extends EventTarget {
    private ws!: WebSocket;
    private isProcessingRemoteCommand: boolean = false;
    private matchRecordings: Array<{ timestamp: number, data: any }> = [];
    private geometrySettings: GeometrySettings = {
        FRAME_OFFSET_IN: 4.0,
        FRAME_CORNER_RADIUS_IN: 0.0,
        SIDE_FRAME_OFFSET_IN: 2.0,
        SIDE_POCKET_OUTWARD_OFFSET_IN: 0.25,
        CORNER_FRAME_OFFSET_IN: 4.0,
        SIDE_STRAIGHT_Y_IN: 23.5,
        SIDE_INNER_Y_IN: 24.6,
        CORNER_STRAIGHT_X_IN: 48.5,
        CORNER_TARGET_Y_IN: 21.0,
        SIDE_JAW_OUTER_OVERRIDE_IN: null,
        SIDE_JAW_INNER_OVERRIDE_IN: null,
        CORNER_JAW_X_OVERRIDE_IN: null,
        CORNER_JAW_Y_OVERRIDE_IN: null,
        SIDE_THROAT_WIDTH_IN: null,
        CORNER_THROAT_WIDTH_IN: null,
        JAW_REF_RADIUS_IN: 4.0,
        CORNER_JAW_REF_RADIUS_IN: 4.0,
        CORNER_POCKET_CAPTURE_RADIUS_IN: 2.5,
        SIDE_POCKET_CAPTURE_RADIUS_IN: 2.5,
        CORNER_POCKET_VISUAL_RADIUS_IN: 2.5,
        SIDE_POCKET_VISUAL_RADIUS_IN: 2.5,
        CORNER_POCKET_OUTWARD_OFFSET_IN: 0.0,
        POCKET_SHELF_DEPTH_IN: 1.5,
        POCKET_SHELF_DEPTH_SIDE_IN: 0.75,
        JAW_CURVE_BLEND: 0.0,
        CORNER_CUT_ANGLE_DEG: 0.0,
        SIDE_CUT_ANGLE_DEG: 0.0,
        RAIL_THICKNESS_INNER: 0.2,
        RAIL_THICKNESS_OUTER: 0.2,
    };
    private renderSettings: RenderSettings = {
        ...defaultRenderLayerSettings,
        canvasScale: 1,
        ballScale: 1,
        ambientIntensity: 1.1,
        directionalIntensity: 1.6,
        accentIntensity: 0.5,
        railHighlightIntensity: 0.6,
        railShadowIntensity: 0.25,
        railShadowSpread: 1.0,
        railShadowSoftness: 1.8,
        railShadowBaseGray: 170,
        railHighlightColor: '#ffffff',
        railHighlightSpread: 1.0,
        pocketShadowIntensity: 0.45,
        pocketHighlightIntensity: 0.55,
        grooveInnerBase: 0.18,
        grooveInnerDepthScale: 0.22,
        grooveThicknessFactor: 0.08,
        grooveOpacityBase: 0.18,
        grooveOpacityDepthScale: 0.36,
        grooveRimThicknessFactor: 0.02,
        grooveRimOuterOpacity: 0.10,
        grooveRimInnerOpacity: 0.08,
        grooveColor: '#000000',
        rimColor: '#ffffff',
        pocketBottomColor: '#000000',
        pocketGradientCenterColor: '#000000',
        pocketGradientEdgeColor: '#141414',
        pocketWallColor: '#0a0a0a',
        pocketGradientStrength: 1.0,
        HUD_BALL_CHIP_SIZE_PX: 42,
        CUE_LENGTH_IN: 58,
        CUE_VISUAL_PADDING_IN: 20,
        MIN_WORLD_PADDING_IN: 6,
        CUE_BALL_MEASLE_RADIUS_RATIO: 0.12,
        CUE_BALL_MEASLE_COLOR: '#c62828',
    };
    private modernGeometrySettings: ModernPocketGeometry | null = null;
    private audioSettings: AudioSettings = { ...DEFAULT_AUDIO_SETTINGS };
    private gameSettings: GameSettings = { ...DEFAULT_GAME_SETTINGS };
    private uiColors: UIColors = { ...DEFAULT_UI_COLORS };
    private tableAppearance: TableAppearance = { ...DEFAULT_TABLE_APPEARANCE };
    private physicsSettings: PhysicsSettings = { ...DEFAULT_PHYSICS_SETTINGS };

    constructor() {
        super();
        this.connect();
        this.setupPlaybackListeners();
    }

    private setupPlaybackListeners() {
        // Only send commands if not from remote to prevent loops
        window.addEventListener('playback:play', () => { if (!this.isProcessingRemoteCommand) this.sendCommand('playback:play'); });
        window.addEventListener('playback:pause', () => { if (!this.isProcessingRemoteCommand) this.sendCommand('playback:pause'); });
        window.addEventListener('playback:toggle', () => { if (!this.isProcessingRemoteCommand) this.sendCommand('playback:toggle'); });
        window.addEventListener('playback:seek', (e: any) => { if (!this.isProcessingRemoteCommand) this.sendCommand('playback:seek', e.detail); });
        window.addEventListener('playback:nextShot', () => { if (!this.isProcessingRemoteCommand) this.sendCommand('playback:nextShot'); });
        window.addEventListener('playback:prevShot', () => { if (!this.isProcessingRemoteCommand) this.sendCommand('playback:prevShot'); });
        window.addEventListener('playback:speed', (e: any) => { if (!this.isProcessingRemoteCommand) this.sendCommand('playback:speed', e.detail); });
    }

    private connect() {
        this.ws = new WebSocket('ws://localhost:8080');

        this.ws.onopen = () => {
            console.log('Connected to relay server');
            this.dispatchEvent(new Event('connected'));
            // Request initial state
            this.sendMessage({ type: 'requestState' });
        };

        this.ws.onmessage = async (event) => {
            let data = event.data;
            if (data instanceof Blob) {
                data = await data.text();
            }
            try {
                const message = JSON.parse(data);
                this.handleMessage(message);
            } catch (e) {
                console.error('Failed to parse message:', e);
            }
        };

        this.ws.onclose = () => {
            console.log('Disconnected from relay server');
            this.dispatchEvent(new Event('disconnected'));
            setTimeout(() => this.connect(), 1000); // Reconnect
        };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private sendMessage(message: any) {
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }

    sendCommand(command: string, payload?: unknown) {
        this.sendMessage({ type: 'command', command, payload });
    }

    getFullState() {
        return {
            geometry: this.geometrySettings,
            render: this.renderSettings,
            modernGeometry: this.modernGeometrySettings,
            audio: this.audioSettings,
            game: this.gameSettings,
            uiColors: this.uiColors,
            tableAppearance: this.tableAppearance,
            physics: this.physicsSettings,
        };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private handleMessage(message: any) {
        switch (message.type) {
            case 'state':
                this.geometrySettings = message.payload.geometry;
                this.renderSettings = message.payload.render;
                this.modernGeometrySettings = message.payload.modernGeometry;
                this.audioSettings = message.payload.audio;
                this.gameSettings = message.payload.game;
                this.uiColors = message.payload.uiColors;
                this.tableAppearance = message.payload.tableAppearance;
                this.physicsSettings = message.payload.physics;
                this.dispatchUpdates();
                break;
            case 'settings:geometry-changed':
                this.geometrySettings = { ...this.geometrySettings, ...message.payload };
                window.dispatchEvent(new CustomEvent('settings:geometry-changed', { detail: { settings: this.geometrySettings } }));
                this.dispatchEvent(new Event('state-updated'));
                break;
            case 'settings:render-changed':
                this.renderSettings = { ...this.renderSettings, ...message.payload };
                window.dispatchEvent(new CustomEvent('settings:render-changed', { detail: { settings: this.renderSettings } }));
                this.dispatchEvent(new Event('state-updated'));
                break;
            case 'settings:modern-geometry-changed':
                this.modernGeometrySettings = message.payload;
                window.dispatchEvent(new CustomEvent('settings:modern-geometry-changed', { detail: { settings: this.modernGeometrySettings } }));
                this.dispatchEvent(new Event('state-updated'));
                break;
            case 'settings:audio-changed':
                this.audioSettings = { ...this.audioSettings, ...message.payload };
                window.dispatchEvent(new CustomEvent('settings:audio-changed', { detail: { settings: this.audioSettings } }));
                this.dispatchEvent(new Event('state-updated'));
                break;
            case 'settings:game-changed':
                this.gameSettings = { ...this.gameSettings, ...message.payload };
                window.dispatchEvent(new CustomEvent('settings:game-changed', { detail: { settings: this.gameSettings } }));
                this.dispatchEvent(new Event('state-updated'));
                break;
            case 'settings:ui-colors-changed':
                this.uiColors = { ...this.uiColors, ...message.payload };
                window.dispatchEvent(new CustomEvent('settings:ui-colors-changed', { detail: { settings: this.uiColors } }));
                this.dispatchEvent(new Event('state-updated'));
                break;
            case 'settings:appearance-changed':
                // Deep merge for appearance updates
                this.tableAppearance = {
                    felt: { ...this.tableAppearance.felt, ...message.payload.felt },
                    frame: { ...this.tableAppearance.frame, ...message.payload.frame },
                    cushion: { ...this.tableAppearance.cushion, ...message.payload.cushion },
                    pocket: { ...this.tableAppearance.pocket, ...message.payload.pocket },
                };
                this.dispatchEvent(new Event('state-updated'));
                break;
            case 'settings:physics-changed':
                this.physicsSettings = { ...this.physicsSettings, ...message.payload };
                window.dispatchEvent(new CustomEvent('settings:physics-changed', { detail: { settings: this.physicsSettings } }));
                this.dispatchEvent(new Event('state-updated'));
                break;
            case 'build:ios:status':
                this.dispatchEvent(new CustomEvent('build:ios:status', { detail: message }));
                break;
            case 'playbackUpdate':
                window.dispatchEvent(new CustomEvent(`playback:${message.kind}Update`, { detail: message.value }));
                break;
            case 'command':
                // Echo playback commands back to window for UI sync
                if (message.command.startsWith('playback:')) {
                    this.isProcessingRemoteCommand = true;
                    try {
                        window.dispatchEvent(new CustomEvent(message.command, { detail: message.payload }));
                    } finally {
                        this.isProcessingRemoteCommand = false;
                    }
                }
                break;
            case 'match:recorded':
                this.matchRecordings.push(message.payload);
                window.dispatchEvent(new CustomEvent('recording:added', { detail: message.payload }));
                console.log('📼 Match recording saved:', {
                    count: this.matchRecordings.length,
                    duration: message.payload.data.duration
                });
                break;
        }
    }

    getMatchRecordings() {
        return this.matchRecordings;
    }

    deleteMatchRecording(timestamp: number) {
        this.matchRecordings = this.matchRecordings.filter(r => r.timestamp !== timestamp);
        window.dispatchEvent(new CustomEvent('recording:deleted', { detail: { timestamp } }));
    }

    private dispatchUpdates() {
        // Dispatch all window events so panels update when full state arrives
        window.dispatchEvent(new CustomEvent('settings:geometry-changed', { detail: { settings: this.geometrySettings } }));
        window.dispatchEvent(new CustomEvent('settings:render-changed', { detail: { settings: this.renderSettings } }));
        window.dispatchEvent(new CustomEvent('settings:modern-geometry-changed', { detail: { settings: this.modernGeometrySettings } }));
        window.dispatchEvent(new CustomEvent('settings:audio-changed', { detail: { settings: this.audioSettings } }));
        window.dispatchEvent(new CustomEvent('settings:game-changed', { detail: { settings: this.gameSettings } }));
        window.dispatchEvent(new CustomEvent('settings:ui-colors-changed', { detail: { settings: this.uiColors } }));
        window.dispatchEvent(new CustomEvent('settings:physics-changed', { detail: { settings: this.physicsSettings } }));
        this.dispatchEvent(new Event('state-updated'));
    }

    // Interface implementation for Panels

    getGeometrySettings(): GeometrySettings {
        return this.geometrySettings;
    }

    saveGeometrySettings(settings: Partial<GeometrySettings>) {
        this.geometrySettings = { ...this.geometrySettings, ...settings };
        this.sendMessage({ type: 'updateGeometry', payload: settings });
    }

    resetGeometrySettings() {
        this.sendMessage({ type: 'command', command: 'resetGeometry' });
    }

    getRenderSettings(): RenderSettings {
        return this.renderSettings;
    }

    saveRenderSettings(settings: Partial<RenderSettings>) {
        this.renderSettings = { ...this.renderSettings, ...settings };
        this.sendMessage({ type: 'updateRender', payload: settings });
    }

    resetRenderSettings() {
        this.sendMessage({ type: 'command', command: 'resetRender' });
    }

    getModernGeometrySettings(): ModernPocketGeometry | null {
        return this.modernGeometrySettings;
    }

    saveModernGeometrySettings(settings: ModernPocketGeometry) {
        this.modernGeometrySettings = settings;
        this.sendMessage({ type: 'updateModernGeometry', payload: settings });
    }

    getAudioSettings(): AudioSettings {
        return this.audioSettings;
    }

    saveAudioSettings(settings: Partial<AudioSettings>) {
        this.audioSettings = { ...this.audioSettings, ...settings };
        this.sendMessage({ type: 'updateAudio', payload: settings });
    }

    resetAudioSettings() {
        this.sendMessage({ type: 'command', command: 'resetAudio' });
    }

    getGameSettings(): GameSettings {
        return this.gameSettings;
    }

    saveGameSettings(settings: Partial<GameSettings>) {
        this.gameSettings = { ...this.gameSettings, ...settings };
        this.sendMessage({ type: 'updateGame', payload: settings });
    }

    getUIColors(): UIColors {
        return this.uiColors;
    }

    saveUIColors(colors: Partial<UIColors>) {
        this.uiColors = { ...this.uiColors, ...colors };
        this.sendMessage({ type: 'updateUIColors', payload: colors });
    }

    resetUIColors() {
        this.sendMessage({ type: 'command', command: 'resetUIColors' });
    }

    getTableAppearance(): TableAppearance {
        return this.tableAppearance;
    }

    saveTableAppearance(appearance: Partial<TableAppearance>) {
        // Deep merge for local state update
        this.tableAppearance = {
            felt: { ...this.tableAppearance.felt, ...appearance.felt },
            frame: { ...this.tableAppearance.frame, ...appearance.frame },
            cushion: { ...this.tableAppearance.cushion, ...appearance.cushion },
            pocket: { ...this.tableAppearance.pocket, ...appearance.pocket },
        };
        this.sendMessage({ type: 'updateTableAppearance', payload: appearance });
    }

    resetTableAppearance() {
        this.sendMessage({ type: 'command', command: 'resetTableAppearance' });
    }

    getPhysicsSettings(): PhysicsSettings {
        return this.physicsSettings;
    }

    savePhysicsSettings(settings: Partial<PhysicsSettings>) {
        this.physicsSettings = { ...this.physicsSettings, ...settings };
        this.sendMessage({ type: 'updatePhysics', payload: settings });
    }

    resetPhysicsSettings() {
        this.sendMessage({ type: 'command', command: 'resetPhysics' });
    }
}
