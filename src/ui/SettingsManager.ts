// Settings manager with local storage persistence
import { CONFIG } from '../config';
import { RenderLayerSettings, defaultRenderLayerSettings } from '../render/RenderLayers';
import type { ModernPocketGeometry } from '../geometry/ModernGeometry';

export interface GameSettings {
  aimAssist: boolean;
  call8Ball: boolean;
  showFPS: boolean;
  aiDifficulty?: 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT';
}

export interface UIColors {
  tableColor: string;
  frameColor: string;
  railColor: string;
  railFillColor: string;
  activePlayerColor: string;
  turnIndicatorColor: string;
  cueStickColor: string;
  cueTipColor: string;
}

export interface AudioSettings {
  master: number;
  music: number;
  background: number;
  cueHits: number;
  ballCollisions: number;
  railHits: number;
  pocketDrops: number;
  uiSounds: number;
  dampening: number;
  compression: number;
  muteMaster?: boolean;
  muteMusic?: boolean;
  muteBackground?: boolean;
  muteCueHits?: boolean;
  muteBallCollisions?: boolean;
  muteRailHits?: boolean;
  mutePocketDrops?: boolean;
  muteUISounds?: boolean;
}

export interface GameStats {
  gamesPlayed: number;
  wins: number;
  losses: number;
  ballsPotted: number;
  winStreak: number;
  maxWinStreak: number;
}

export interface PhysicsSettings {
  BALL_RESTITUTION: number;
  BALL_BALL_FRICTION: number;
  CUSHION_RESTITUTION: number;
  CUE_POWER_MAX: number;
  CUE_POWER_MULTIPLIER: number;
  ROLLING_FRICTION: number;
  SLIDING_FRICTION: number;
  SOLVER_ITERATIONS: number;
  VELOCITY_EPSILON: number;
  AIM_LINE_OFFSET: number;
  GHOST_BALL_OFFSET: number;
  OBJECT_PATH_PERCENTAGE: number;
  AIM_INFO_SCALE: number;
  POCKET_ANIMATION_DROP_DURATION_MS: number;
  POCKET_ANIMATION_ROLL_DURATION_MS: number;
  POCKET_ANIMATION_DROP_DEPTH: number;
  POCKET_ANIMATION_SHRINK_FACTOR: number;
  POCKET_ANIMATION_UNDERFELT_PX: number;
  POCKET_ANIMATION_FADE_START: number;
  POCKET_ANIMATION_CLIP_RADIUS_SCALE: number;
}

export interface GeometrySettings {
  FRAME_OFFSET_IN: number;
  FRAME_CORNER_RADIUS_IN: number;
  SIDE_FRAME_OFFSET_IN: number;
  SIDE_POCKET_OUTWARD_OFFSET_IN: number;
  CORNER_FRAME_OFFSET_IN: number;
  SIDE_STRAIGHT_Y_IN: number;
  SIDE_INNER_Y_IN: number;
  CORNER_STRAIGHT_X_IN: number;
  CORNER_TARGET_Y_IN: number;
  SIDE_JAW_OUTER_OVERRIDE_IN: number | null;
  SIDE_JAW_INNER_OVERRIDE_IN: number | null;
  CORNER_JAW_X_OVERRIDE_IN: number | null;
  CORNER_JAW_Y_OVERRIDE_IN: number | null;
  SIDE_THROAT_WIDTH_IN: number | null;
  CORNER_THROAT_WIDTH_IN: number | null;
  JAW_REF_RADIUS_IN: number;
  CORNER_JAW_REF_RADIUS_IN: number;
  CORNER_POCKET_CAPTURE_RADIUS_IN: number;
  SIDE_POCKET_CAPTURE_RADIUS_IN: number;
  CORNER_POCKET_VISUAL_RADIUS_IN: number;
  SIDE_POCKET_VISUAL_RADIUS_IN: number;
  CORNER_POCKET_OUTWARD_OFFSET_IN: number;
  POCKET_SHELF_DEPTH_IN: number;
  POCKET_SHELF_DEPTH_SIDE_IN?: number;
  JAW_CURVE_BLEND: number;
  CORNER_CUT_ANGLE_DEG: number;
  SIDE_CUT_ANGLE_DEG: number;
  RAIL_THICKNESS_INNER: number;
  RAIL_THICKNESS_OUTER: number;
}

export interface RenderSettings extends RenderLayerSettings {
  canvasScale: number;
  ballScale: number;
  ambientIntensity: number;
  directionalIntensity: number;
  accentIntensity: number;
  railHighlightIntensity: number;
  railShadowIntensity: number;
  railShadowSpread: number;
  railShadowSoftness: number;
  railShadowBaseGray: number;
  railHighlightColor: string;
  railHighlightSpread: number;
  pocketShadowIntensity: number;
  pocketHighlightIntensity: number;
  // Pocket groove appearance controls
  grooveInnerBase: number;            // base inner radius factor (of visualRadius)
  grooveInnerDepthScale: number;      // how much inner radius grows with depthFactor
  grooveThicknessFactor: number;      // groove thickness factor (of visualRadius)
  grooveOpacityBase: number;          // base groove opacity
  grooveOpacityDepthScale: number;    // opacity increase with depthFactor
  grooveRimThicknessFactor: number;   // rim thickness factor (of visualRadius)
  grooveRimOuterOpacity: number;      // outer rim opacity
  grooveRimInnerOpacity: number;      // inner rim opacity
  // Groove/pocket colors
  grooveColor: string;
  rimColor: string;
  pocketBottomColor: string;
  pocketGradientCenterColor: string;
  pocketGradientEdgeColor: string;
  pocketWallColor: string;
  // Pocket gradient overall strength (alpha multiplier 0..1)
  pocketGradientStrength: number;
}

const STORAGE_KEYS = {
  GAME_SETTINGS: 'pool2d_game_settings',
  UI_COLORS: 'pool2d_ui_colors',
  PHYSICS_SETTINGS: 'pool2d_physics_settings',
  GEOMETRY_SETTINGS: 'pool2d_geometry_settings',
  RENDER_SETTINGS: 'pool2d_render_settings',
  MODERN_GEOMETRY_SETTINGS: 'pool2d_modern_geometry_settings',
  AUDIO_SETTINGS: 'pool2d_audio_settings',
  GAME_STATS: 'pool2d_game_stats',
};

const DEFAULT_GAME_SETTINGS: GameSettings = {
  aimAssist: true,
  call8Ball: false,
  showFPS: true,
  aiDifficulty: 'MEDIUM',
};

const DEFAULT_UI_COLORS: UIColors = {
  tableColor: '#0a5f0a',
  frameColor: '#3d2413',
  railColor: '#2d1810',
  railFillColor: '#000000',
  activePlayerColor: '#4CAF50',
  turnIndicatorColor: '#FFC107',
  cueStickColor: '#8B4513', // Brown wood
  cueTipColor: '#4A90E2', // Blue chalk
};

const DEFAULT_PHYSICS_SETTINGS: PhysicsSettings = {
  BALL_RESTITUTION: CONFIG.BALL_RESTITUTION ?? 0.93,
  BALL_BALL_FRICTION: CONFIG.BALL_BALL_FRICTION ?? 0.05,
  CUSHION_RESTITUTION: CONFIG.CUSHION_RESTITUTION ?? 0.88,
  CUE_POWER_MAX: CONFIG.CUE_POWER_MAX ?? 25.0,
  CUE_POWER_MULTIPLIER: CONFIG.CUE_POWER_MULTIPLIER ?? 10.0,
  ROLLING_FRICTION: CONFIG.ROLLING_FRICTION ?? 0.5,
  SLIDING_FRICTION: CONFIG.SLIDING_FRICTION ?? 0.65,
  SOLVER_ITERATIONS: CONFIG.SOLVER_ITERATIONS ?? 15,
  VELOCITY_EPSILON: CONFIG.VELOCITY_EPSILON ?? 0.2,
  AIM_LINE_OFFSET: CONFIG.AIM_LINE_OFFSET ?? 0.2,
  GHOST_BALL_OFFSET: CONFIG.GHOST_BALL_OFFSET ?? 0.0,
  OBJECT_PATH_PERCENTAGE: CONFIG.OBJECT_PATH_PERCENTAGE ?? 1.0,
  AIM_INFO_SCALE: CONFIG.AIM_INFO_SCALE ?? 1.0,
  POCKET_ANIMATION_DROP_DURATION_MS: CONFIG.POCKET_ANIMATION_DROP_DURATION_MS ?? 300,
  POCKET_ANIMATION_ROLL_DURATION_MS: CONFIG.POCKET_ANIMATION_ROLL_DURATION_MS ?? 500,
  POCKET_ANIMATION_DROP_DEPTH: CONFIG.POCKET_ANIMATION_DROP_DEPTH ?? 0.35,
  POCKET_ANIMATION_SHRINK_FACTOR: (CONFIG as any).POCKET_ANIMATION_SHRINK_FACTOR ?? 0.2,
  POCKET_ANIMATION_UNDERFELT_PX: (CONFIG as any).POCKET_ANIMATION_UNDERFELT_PX ?? 10,
  POCKET_ANIMATION_FADE_START: CONFIG.POCKET_ANIMATION_FADE_START ?? 0.9,
  POCKET_ANIMATION_CLIP_RADIUS_SCALE: CONFIG.POCKET_ANIMATION_CLIP_RADIUS_SCALE ?? 1.4,
};

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  master: 0.85,
  music: 0.65,
  background: 0.5,
  cueHits: 0.75,
  ballCollisions: 0.85,
  railHits: 0.65,
  pocketDrops: 0.95,
  uiSounds: 0.7,
  dampening: 0.65,
  compression: 0.55,
  muteMaster: false,
  muteMusic: false,
  muteBackground: false,
  muteCueHits: false,
  muteBallCollisions: false,
  muteRailHits: false,
  mutePocketDrops: false,
  muteUISounds: false,
};

export const DEFAULT_GAME_STATS: GameStats = {
  gamesPlayed: 0,
  wins: 0,
  losses: 0,
  ballsPotted: 0,
  winStreak: 0,
  maxWinStreak: 0,
};

export class SettingsManager {
  private gameSettings: GameSettings;
  private uiColors: UIColors;
  private physicsSettings: PhysicsSettings;
  private geometrySettings: GeometrySettings;
  private renderSettings: RenderSettings;
  private modernGeometrySettings: ModernPocketGeometry | null;
  private audioSettings: AudioSettings;
  private gameStats: GameStats;

  constructor() {
    this.gameSettings = this.loadGameSettings();
    this.uiColors = this.loadUIColors();
    this.physicsSettings = this.loadPhysicsSettings();
    this.geometrySettings = this.loadGeometrySettings();
    this.renderSettings = this.loadRenderSettings();
    this.modernGeometrySettings = this.loadModernGeometrySettings();
    this.audioSettings = this.loadAudioSettings();
    this.gameStats = this.loadGameStats();
    
    // Apply loaded settings
    this.applyPhysicsSettings();
    this.applyUIColors();
    this.applyGeometrySettings();
    this.applyRenderSettings();
  }

  // Game Settings
  loadGameSettings(): GameSettings {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.GAME_SETTINGS);
      if (stored) {
        return { ...DEFAULT_GAME_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('Failed to load game settings:', e);
    }
    return { ...DEFAULT_GAME_SETTINGS };
  }

  saveGameSettings(settings: Partial<GameSettings>) {
    this.gameSettings = { ...this.gameSettings, ...settings };
    try {
      localStorage.setItem(STORAGE_KEYS.GAME_SETTINGS, JSON.stringify(this.gameSettings));
    } catch (e) {
      console.warn('Failed to save game settings:', e);
    }
    window.dispatchEvent(new CustomEvent('settings:game-changed', { detail: { settings: this.getGameSettings() } }));
  }

  getGameSettings(): GameSettings {
    return { ...this.gameSettings };
  }

  private clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
  }

  private sanitizeAudioSettings(partial: Partial<AudioSettings>): AudioSettings {
    const merged: AudioSettings = {
      ...DEFAULT_AUDIO_SETTINGS,
      ...partial,
    } as AudioSettings;
    const clamp = this.clamp.bind(this);
    merged.master = clamp(merged.master ?? DEFAULT_AUDIO_SETTINGS.master, 0, 1);
    merged.music = clamp(merged.music ?? DEFAULT_AUDIO_SETTINGS.music, 0, 1);
    merged.background = clamp(merged.background ?? DEFAULT_AUDIO_SETTINGS.background, 0, 1);
    merged.cueHits = clamp(merged.cueHits ?? DEFAULT_AUDIO_SETTINGS.cueHits, 0, 1);
    merged.ballCollisions = clamp(merged.ballCollisions ?? DEFAULT_AUDIO_SETTINGS.ballCollisions, 0, 1);
    merged.railHits = clamp(merged.railHits ?? DEFAULT_AUDIO_SETTINGS.railHits, 0, 1);
    merged.pocketDrops = clamp(merged.pocketDrops ?? DEFAULT_AUDIO_SETTINGS.pocketDrops, 0, 1);
    merged.uiSounds = clamp(merged.uiSounds ?? DEFAULT_AUDIO_SETTINGS.uiSounds, 0, 1);
    merged.dampening = clamp(merged.dampening ?? DEFAULT_AUDIO_SETTINGS.dampening, 0, 1);
    merged.compression = clamp(merged.compression ?? DEFAULT_AUDIO_SETTINGS.compression, 0, 1);
    merged.muteMaster = Boolean(merged.muteMaster);
    merged.muteMusic = Boolean(merged.muteMusic);
    merged.muteBackground = Boolean(merged.muteBackground);
    merged.muteCueHits = Boolean(merged.muteCueHits);
    merged.muteBallCollisions = Boolean(merged.muteBallCollisions);
    merged.muteRailHits = Boolean(merged.muteRailHits);
    merged.mutePocketDrops = Boolean(merged.mutePocketDrops);
    merged.muteUISounds = Boolean(merged.muteUISounds);
    return merged;
  }

  loadAudioSettings(): AudioSettings {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.AUDIO_SETTINGS);
      if (stored) {
        return this.sanitizeAudioSettings(JSON.parse(stored));
      }
    } catch (e) {
      console.warn('Failed to load audio settings:', e);
    }
    return { ...DEFAULT_AUDIO_SETTINGS };
  }

  saveAudioSettings(settings: Partial<AudioSettings>) {
    this.audioSettings = this.sanitizeAudioSettings({
      ...this.audioSettings,
      ...settings,
    });
    try {
      localStorage.setItem(STORAGE_KEYS.AUDIO_SETTINGS, JSON.stringify(this.audioSettings));
    } catch (e) {
      console.warn('Failed to save audio settings:', e);
    }
    window.dispatchEvent(new CustomEvent('settings:audio-changed', { detail: { settings: this.getAudioSettings() } }));
  }

  getAudioSettings(): AudioSettings {
    return { ...this.audioSettings };
  }

  resetAudioSettings() {
    this.audioSettings = { ...DEFAULT_AUDIO_SETTINGS };
    try {
      localStorage.setItem(STORAGE_KEYS.AUDIO_SETTINGS, JSON.stringify(this.audioSettings));
    } catch (e) {
      console.warn('Failed to reset audio settings:', e);
    }
    window.dispatchEvent(new CustomEvent('settings:audio-changed', { detail: { settings: this.getAudioSettings() } }));
  }

  // Game Stats
  loadGameStats(): GameStats {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.GAME_STATS);
      if (stored) {
        return { ...DEFAULT_GAME_STATS, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('Failed to load game stats:', e);
    }
    return { ...DEFAULT_GAME_STATS };
  }

  saveGameStats(stats: Partial<GameStats>) {
    this.gameStats = { ...this.gameStats, ...stats };
    try {
      localStorage.setItem(STORAGE_KEYS.GAME_STATS, JSON.stringify(this.gameStats));
    } catch (e) {
      console.warn('Failed to save game stats:', e);
    }
  }

  getGameStats(): GameStats {
    return { ...this.gameStats };
  }

  resetGameStats() {
    this.gameStats = { ...DEFAULT_GAME_STATS };
    try {
      localStorage.setItem(STORAGE_KEYS.GAME_STATS, JSON.stringify(this.gameStats));
    } catch (e) {
      console.warn('Failed to reset game stats:', e);
    }
  }

  // UI Colors
  loadUIColors(): UIColors {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.UI_COLORS);
      if (stored) {
        return { ...DEFAULT_UI_COLORS, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('Failed to load UI colors:', e);
    }
    return { ...DEFAULT_UI_COLORS };
  }

  saveUIColors(colors: Partial<UIColors>) {
    this.uiColors = { ...this.uiColors, ...colors };
    try {
      localStorage.setItem(STORAGE_KEYS.UI_COLORS, JSON.stringify(this.uiColors));
      this.applyUIColors();
    } catch (e) {
      console.warn('Failed to save UI colors:', e);
    }
  }

  getUIColors(): UIColors {
    return { ...this.uiColors };
  }

  resetUIColors() {
    this.uiColors = { ...DEFAULT_UI_COLORS };
    try {
      localStorage.setItem(STORAGE_KEYS.UI_COLORS, JSON.stringify(this.uiColors));
      this.applyUIColors();
    } catch (e) {
      console.warn('Failed to reset UI colors:', e);
    }
  }

  private applyUIColors() {
    // Update CONFIG for rendering
    CONFIG.TABLE_COLOR = this.uiColors.tableColor;
    CONFIG.FRAME_COLOR = this.uiColors.frameColor;
    CONFIG.RAIL_COLOR = this.uiColors.railColor;
    CONFIG.RAIL_FILL_COLOR = this.uiColors.railFillColor;
    (CONFIG as any).CUE_STICK_COLOR = this.uiColors.cueStickColor;
    (CONFIG as any).CUE_TIP_COLOR = this.uiColors.cueTipColor;

    // Update CSS variables for UI elements
    const root = document.documentElement;
    root.style.setProperty('--active-player-color', this.uiColors.activePlayerColor);
    root.style.setProperty('--turn-indicator-color', this.uiColors.turnIndicatorColor);

    // Update mode indicator color
    const modeIndicator = document.getElementById('mode-indicator');
    if (modeIndicator) {
      modeIndicator.style.color = this.uiColors.activePlayerColor;
    }

    // Update turn indicator color
    const turnIndicator = document.getElementById('turn-indicator');
    if (turnIndicator) {
      turnIndicator.style.color = this.uiColors.turnIndicatorColor;
    }

    // Trigger re-render event
    window.dispatchEvent(new CustomEvent('settings:colors-changed'));
  }

  // Physics Settings
  loadPhysicsSettings(): PhysicsSettings {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.PHYSICS_SETTINGS);
      if (stored) {
        return { ...DEFAULT_PHYSICS_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('Failed to load physics settings:', e);
    }
    return { ...DEFAULT_PHYSICS_SETTINGS };
  }

  savePhysicsSettings(settings: Partial<PhysicsSettings>) {
    this.physicsSettings = { ...this.physicsSettings, ...settings };
    try {
      localStorage.setItem(STORAGE_KEYS.PHYSICS_SETTINGS, JSON.stringify(this.physicsSettings));
      this.applyPhysicsSettings();
    } catch (e) {
      console.warn('Failed to save physics settings:', e);
    }
  }

  getPhysicsSettings(): PhysicsSettings {
    return { ...this.physicsSettings };
  }

  resetPhysicsSettings() {
    this.physicsSettings = { ...DEFAULT_PHYSICS_SETTINGS };
    try {
      localStorage.setItem(STORAGE_KEYS.PHYSICS_SETTINGS, JSON.stringify(this.physicsSettings));
      this.applyPhysicsSettings();
    } catch (e) {
      console.warn('Failed to reset physics settings:', e);
    }
  }

  // Geometry Settings
  loadGeometrySettings(): GeometrySettings {
    const defaults: GeometrySettings = {
      FRAME_OFFSET_IN: CONFIG.FRAME_OFFSET_IN,
      FRAME_CORNER_RADIUS_IN: CONFIG.FRAME_CORNER_RADIUS_IN,
      SIDE_FRAME_OFFSET_IN: CONFIG.SIDE_FRAME_OFFSET_IN,
      SIDE_POCKET_OUTWARD_OFFSET_IN: CONFIG.SIDE_POCKET_OUTWARD_OFFSET_IN,
      CORNER_FRAME_OFFSET_IN: CONFIG.CORNER_FRAME_OFFSET_IN,
      SIDE_STRAIGHT_Y_IN: CONFIG.SIDE_STRAIGHT_Y_IN,
      SIDE_INNER_Y_IN: CONFIG.SIDE_INNER_Y_IN,
      CORNER_STRAIGHT_X_IN: CONFIG.CORNER_STRAIGHT_X_IN,
      CORNER_TARGET_Y_IN: CONFIG.CORNER_TARGET_Y_IN,
      SIDE_JAW_OUTER_OVERRIDE_IN: CONFIG.SIDE_JAW_OUTER_OVERRIDE_IN,
      SIDE_JAW_INNER_OVERRIDE_IN: CONFIG.SIDE_JAW_INNER_OVERRIDE_IN,
      CORNER_JAW_X_OVERRIDE_IN: CONFIG.CORNER_JAW_X_OVERRIDE_IN,
      CORNER_JAW_Y_OVERRIDE_IN: CONFIG.CORNER_JAW_Y_OVERRIDE_IN,
      SIDE_THROAT_WIDTH_IN: CONFIG.SIDE_THROAT_WIDTH_IN,
      CORNER_THROAT_WIDTH_IN: CONFIG.CORNER_THROAT_WIDTH_IN,
      JAW_REF_RADIUS_IN: CONFIG.JAW_REF_RADIUS_IN,
      CORNER_JAW_REF_RADIUS_IN: CONFIG.CORNER_JAW_REF_RADIUS_IN,
      CORNER_POCKET_CAPTURE_RADIUS_IN: CONFIG.POCKET_CAPTURE_RADIUS_CORNER,
      SIDE_POCKET_CAPTURE_RADIUS_IN: CONFIG.POCKET_CAPTURE_RADIUS_SIDE,
      CORNER_POCKET_VISUAL_RADIUS_IN: CONFIG.POCKET_VISUAL_RADIUS_CORNER,
      SIDE_POCKET_VISUAL_RADIUS_IN: CONFIG.POCKET_VISUAL_RADIUS_SIDE,
      CORNER_POCKET_OUTWARD_OFFSET_IN: CONFIG.CORNER_POCKET_OUTWARD_OFFSET_IN ?? 0,
      POCKET_SHELF_DEPTH_IN: CONFIG.POCKET_SHELF_DEPTH_IN,
      POCKET_SHELF_DEPTH_SIDE_IN: (CONFIG as any).POCKET_SHELF_DEPTH_SIDE_IN ?? 0.25,
      JAW_CURVE_BLEND: CONFIG.JAW_CURVE_BLEND,
      CORNER_CUT_ANGLE_DEG: CONFIG.CORNER_CUT_ANGLE_DEG,
      SIDE_CUT_ANGLE_DEG: CONFIG.SIDE_CUT_ANGLE_DEG,
      RAIL_THICKNESS_INNER: CONFIG.RAIL_THICKNESS_INNER,
      RAIL_THICKNESS_OUTER: CONFIG.RAIL_THICKNESS_OUTER,
    };
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.GEOMETRY_SETTINGS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.RAIL_THICKNESS !== undefined) {
          parsed.RAIL_THICKNESS_INNER = parsed.RAIL_THICKNESS_INNER ?? parsed.RAIL_THICKNESS;
          parsed.RAIL_THICKNESS_OUTER = parsed.RAIL_THICKNESS_OUTER ?? parsed.RAIL_THICKNESS;
          delete parsed.RAIL_THICKNESS;
        }
        return { ...defaults, ...parsed };
      }
    } catch (e) {
      console.warn('Failed to load geometry settings:', e);
    }
    return { ...defaults };
  }

  loadRenderSettings(): RenderSettings {
    const defaults: RenderSettings = {
      ...defaultRenderLayerSettings,
      canvasScale: CONFIG.CANVAS_SCALE_MULTIPLIER ?? 1,
      ballScale: CONFIG.BALL_SCALE ?? 1,
      ambientIntensity: CONFIG.AMBIENT_INTENSITY ?? 1.1,
      directionalIntensity: CONFIG.DIRECTIONAL_INTENSITY ?? 1.6,
      accentIntensity: CONFIG.ACCENT_INTENSITY ?? 0.5,
      railHighlightIntensity: CONFIG.RAIL_HIGHLIGHT_INTENSITY ?? 0.6,
      railShadowIntensity: CONFIG.RAIL_SHADOW_INTENSITY ?? 0.25,
      railShadowSpread: 1.0,
      railShadowSoftness: 1.8,
      railShadowBaseGray: 170,
      railHighlightColor: '#ffffff',
      railHighlightSpread: 1.0,
      pocketShadowIntensity: CONFIG.POCKET_SHADOW_INTENSITY ?? 0.45,
      pocketHighlightIntensity: CONFIG.POCKET_HIGHLIGHT_INTENSITY ?? 0.55,
      // Groove defaults match current visuals
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
    };
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.RENDER_SETTINGS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.ballVisualScale !== undefined && parsed.ballScale === undefined) {
          parsed.ballScale = parsed.ballVisualScale;
          delete parsed.ballVisualScale;
        }
        parsed.ambientIntensity = parsed.ambientIntensity ?? defaults.ambientIntensity;
        parsed.directionalIntensity = parsed.directionalIntensity ?? defaults.directionalIntensity;
        parsed.accentIntensity = parsed.accentIntensity ?? defaults.accentIntensity;
        parsed.railHighlightIntensity = parsed.railHighlightIntensity ?? defaults.railHighlightIntensity;
        parsed.pocketShadowIntensity = parsed.pocketShadowIntensity ?? defaults.pocketShadowIntensity;
        parsed.pocketHighlightIntensity =
          parsed.pocketHighlightIntensity ?? defaults.pocketHighlightIntensity;
        return { ...defaults, ...parsed };
      }
    } catch (e) {
      console.warn('Failed to load render settings:', e);
    }
    return { ...defaults };
  }

  saveGeometrySettings(settings: Partial<GeometrySettings>) {
    this.geometrySettings = { ...this.geometrySettings, ...settings };
    try {
      localStorage.setItem(STORAGE_KEYS.GEOMETRY_SETTINGS, JSON.stringify(this.geometrySettings));
      this.applyGeometrySettings();
    } catch (e) {
      console.warn('Failed to save geometry settings:', e);
    }
  }

  saveRenderSettings(settings: Partial<RenderSettings>) {
    this.renderSettings = { ...this.renderSettings, ...settings };
    try {
      localStorage.setItem(STORAGE_KEYS.RENDER_SETTINGS, JSON.stringify(this.renderSettings));
      this.applyRenderSettings();
    } catch (e) {
      console.warn('Failed to save render settings:', e);
    }
  }

  getGeometrySettings(): GeometrySettings {
    return { ...this.geometrySettings };
  }

  getRenderSettings(): RenderSettings {
    return { ...this.renderSettings };
  }

  private loadModernGeometrySettings(): ModernPocketGeometry | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.MODERN_GEOMETRY_SETTINGS);
      if (stored) {
        return JSON.parse(stored) as ModernPocketGeometry;
      }
    } catch (e) {
      console.warn('Failed to load modern geometry settings:', e);
    }
    return null;
  }

  getModernGeometrySettings(): ModernPocketGeometry | null {
    if (!this.modernGeometrySettings) return null;
    return JSON.parse(JSON.stringify(this.modernGeometrySettings));
  }

  saveModernGeometrySettings(settings: ModernPocketGeometry) {
    this.modernGeometrySettings = JSON.parse(JSON.stringify(settings));
    try {
      localStorage.setItem(
        STORAGE_KEYS.MODERN_GEOMETRY_SETTINGS,
        JSON.stringify(this.modernGeometrySettings)
      );
    } catch (e) {
      console.warn('Failed to save modern geometry settings:', e);
    }
  }

  resetGeometrySettings() {
    this.geometrySettings = {
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
      POCKET_SHELF_DEPTH_IN: 0.5,
      POCKET_SHELF_DEPTH_SIDE_IN: 0.25,
      JAW_CURVE_BLEND: 0.0,
      CORNER_CUT_ANGLE_DEG: 0.0,
      SIDE_CUT_ANGLE_DEG: 0.0,
      RAIL_THICKNESS_INNER: 0.2,
      RAIL_THICKNESS_OUTER: 0.2,
    };
    try {
      localStorage.setItem(STORAGE_KEYS.GEOMETRY_SETTINGS, JSON.stringify(this.geometrySettings));
      this.applyGeometrySettings();
    } catch (e) {
      console.warn('Failed to reset geometry settings:', e);
    }
  }

  resetRenderSettings() {
    this.renderSettings = {
      ...defaultRenderLayerSettings,
      canvasScale: 1,
      ballScale: 1,
      ambientIntensity: CONFIG.AMBIENT_INTENSITY ?? 1.1,
      directionalIntensity: CONFIG.DIRECTIONAL_INTENSITY ?? 1.6,
      accentIntensity: CONFIG.ACCENT_INTENSITY ?? 0.5,
      railHighlightIntensity: CONFIG.RAIL_HIGHLIGHT_INTENSITY ?? 0.6,
      railShadowIntensity: CONFIG.RAIL_SHADOW_INTENSITY ?? 0.25,
      railShadowSpread: 1.0,
      railShadowSoftness: 1.8,
      railShadowBaseGray: 170,
      railHighlightColor: '#ffffff',
      railHighlightSpread: 1.0,
      pocketShadowIntensity: CONFIG.POCKET_SHADOW_INTENSITY ?? 0.45,
      pocketHighlightIntensity: CONFIG.POCKET_HIGHLIGHT_INTENSITY ?? 0.55,
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
    };
    try {
      localStorage.setItem(STORAGE_KEYS.RENDER_SETTINGS, JSON.stringify(this.renderSettings));
      this.applyRenderSettings();
    } catch (e) {
      console.warn('Failed to reset render settings:', e);
    }
  }

  private applyGeometrySettings() {
    CONFIG.FRAME_OFFSET_IN = this.geometrySettings.FRAME_OFFSET_IN;
    CONFIG.FRAME_CORNER_RADIUS_IN = this.geometrySettings.FRAME_CORNER_RADIUS_IN;
    CONFIG.SIDE_FRAME_OFFSET_IN = this.geometrySettings.SIDE_FRAME_OFFSET_IN;
    CONFIG.SIDE_POCKET_OUTWARD_OFFSET_IN = this.geometrySettings.SIDE_POCKET_OUTWARD_OFFSET_IN;
    CONFIG.CORNER_FRAME_OFFSET_IN = this.geometrySettings.CORNER_FRAME_OFFSET_IN;
    CONFIG.SIDE_STRAIGHT_Y_IN = this.geometrySettings.SIDE_STRAIGHT_Y_IN;
    CONFIG.SIDE_INNER_Y_IN = this.geometrySettings.SIDE_INNER_Y_IN;
    CONFIG.CORNER_STRAIGHT_X_IN = this.geometrySettings.CORNER_STRAIGHT_X_IN;
    CONFIG.CORNER_TARGET_Y_IN = this.geometrySettings.CORNER_TARGET_Y_IN;
    CONFIG.SIDE_JAW_OUTER_OVERRIDE_IN = this.geometrySettings.SIDE_JAW_OUTER_OVERRIDE_IN;
    CONFIG.SIDE_JAW_INNER_OVERRIDE_IN = this.geometrySettings.SIDE_JAW_INNER_OVERRIDE_IN;
    CONFIG.CORNER_JAW_X_OVERRIDE_IN = this.geometrySettings.CORNER_JAW_X_OVERRIDE_IN;
    CONFIG.CORNER_JAW_Y_OVERRIDE_IN = this.geometrySettings.CORNER_JAW_Y_OVERRIDE_IN;
    CONFIG.SIDE_THROAT_WIDTH_IN = this.geometrySettings.SIDE_THROAT_WIDTH_IN;
    CONFIG.CORNER_THROAT_WIDTH_IN = this.geometrySettings.CORNER_THROAT_WIDTH_IN;
    CONFIG.JAW_REF_RADIUS_IN = this.geometrySettings.JAW_REF_RADIUS_IN;
    CONFIG.CORNER_JAW_REF_RADIUS_IN = this.geometrySettings.CORNER_JAW_REF_RADIUS_IN;
    CONFIG.POCKET_CAPTURE_RADIUS_CORNER = this.geometrySettings.CORNER_POCKET_CAPTURE_RADIUS_IN;
    CONFIG.POCKET_CAPTURE_RADIUS_SIDE = this.geometrySettings.SIDE_POCKET_CAPTURE_RADIUS_IN;
    CONFIG.POCKET_VISUAL_RADIUS_CORNER = this.geometrySettings.CORNER_POCKET_VISUAL_RADIUS_IN;
    CONFIG.POCKET_VISUAL_RADIUS_SIDE = this.geometrySettings.SIDE_POCKET_VISUAL_RADIUS_IN;
    CONFIG.CORNER_POCKET_OUTWARD_OFFSET_IN = this.geometrySettings.CORNER_POCKET_OUTWARD_OFFSET_IN;
    CONFIG.POCKET_SHELF_DEPTH_IN = this.geometrySettings.POCKET_SHELF_DEPTH_IN;
    (CONFIG as any).POCKET_SHELF_DEPTH_SIDE_IN = this.geometrySettings.POCKET_SHELF_DEPTH_SIDE_IN ?? (CONFIG as any).POCKET_SHELF_DEPTH_SIDE_IN ?? 0.25;
    CONFIG.JAW_CURVE_BLEND = this.geometrySettings.JAW_CURVE_BLEND;
    CONFIG.CORNER_CUT_ANGLE_DEG = this.geometrySettings.CORNER_CUT_ANGLE_DEG;
    CONFIG.SIDE_CUT_ANGLE_DEG = this.geometrySettings.SIDE_CUT_ANGLE_DEG;
    CONFIG.RAIL_THICKNESS_INNER = this.geometrySettings.RAIL_THICKNESS_INNER;
    CONFIG.RAIL_THICKNESS_OUTER = this.geometrySettings.RAIL_THICKNESS_OUTER;
    // Signal that geometry parameters changed (requires rebuild)
    try {
      console.info('[Settings] Geometry updated', this.geometrySettings);
    } catch {}
    window.dispatchEvent(new CustomEvent('settings:geometry-changed'));
  }

  private applyPhysicsSettings() {
    // Update CONFIG with loaded physics settings
    Object.entries(this.physicsSettings).forEach(([key, value]) => {
      (CONFIG as any)[key] = value;
    });
  }

  // Clear all settings
  clearAll() {
    try {
      localStorage.removeItem(STORAGE_KEYS.GAME_SETTINGS);
      localStorage.removeItem(STORAGE_KEYS.UI_COLORS);
      localStorage.removeItem(STORAGE_KEYS.PHYSICS_SETTINGS);
      localStorage.removeItem(STORAGE_KEYS.RENDER_SETTINGS);
      localStorage.removeItem(STORAGE_KEYS.GEOMETRY_SETTINGS);
      localStorage.removeItem(STORAGE_KEYS.MODERN_GEOMETRY_SETTINGS);
      localStorage.removeItem(STORAGE_KEYS.GAME_STATS);
      
      this.gameSettings = { ...DEFAULT_GAME_SETTINGS };
      this.uiColors = { ...DEFAULT_UI_COLORS };
      this.physicsSettings = { ...DEFAULT_PHYSICS_SETTINGS };
      this.geometrySettings = this.loadGeometrySettings();
      this.modernGeometrySettings = null;
      this.gameStats = { ...DEFAULT_GAME_STATS };
      this.renderSettings = {
        ...defaultRenderLayerSettings,
        canvasScale: 1,
        ballScale: 1,
        ambientIntensity: CONFIG.AMBIENT_INTENSITY ?? 1.1,
        directionalIntensity: CONFIG.DIRECTIONAL_INTENSITY ?? 1.6,
        accentIntensity: CONFIG.ACCENT_INTENSITY ?? 0.5,
        railHighlightIntensity: CONFIG.RAIL_HIGHLIGHT_INTENSITY ?? 0.6,
        railShadowIntensity: CONFIG.RAIL_SHADOW_INTENSITY ?? 0.25,
        railShadowSpread: 1.0,
        railShadowSoftness: 1.8,
        railShadowBaseGray: 170,
        railHighlightColor: '#ffffff',
        railHighlightSpread: 1.0,
        pocketShadowIntensity: CONFIG.POCKET_SHADOW_INTENSITY ?? 0.45,
        pocketHighlightIntensity: CONFIG.POCKET_HIGHLIGHT_INTENSITY ?? 0.55,
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
      };
      
      this.applyPhysicsSettings();
      this.applyUIColors();
      this.applyGeometrySettings();
      this.applyRenderSettings();
    } catch (e) {
      console.warn('Failed to clear settings:', e);
    }
  }

  private applyRenderSettings() {
    CONFIG.CANVAS_SCALE_MULTIPLIER = this.renderSettings.canvasScale ?? 1;
    const scale = this.renderSettings.ballScale ?? 1;
    CONFIG.BALL_SCALE = scale;
    CONFIG.BALL_RADIUS = (CONFIG.BALL_BASE_RADIUS ?? CONFIG.BALL_RADIUS) * scale;
    CONFIG.AMBIENT_INTENSITY = this.renderSettings.ambientIntensity ?? CONFIG.AMBIENT_INTENSITY;
    CONFIG.DIRECTIONAL_INTENSITY = this.renderSettings.directionalIntensity ?? CONFIG.DIRECTIONAL_INTENSITY;
    CONFIG.ACCENT_INTENSITY = this.renderSettings.accentIntensity ?? CONFIG.ACCENT_INTENSITY;
    CONFIG.RAIL_HIGHLIGHT_INTENSITY = this.renderSettings.railHighlightIntensity ?? CONFIG.RAIL_HIGHLIGHT_INTENSITY;
    CONFIG.RAIL_SHADOW_INTENSITY = this.renderSettings.railShadowIntensity ?? CONFIG.RAIL_SHADOW_INTENSITY;
    CONFIG.POCKET_SHADOW_INTENSITY =
      this.renderSettings.pocketShadowIntensity ?? CONFIG.POCKET_SHADOW_INTENSITY;
    CONFIG.POCKET_HIGHLIGHT_INTENSITY =
      this.renderSettings.pocketHighlightIntensity ?? CONFIG.POCKET_HIGHLIGHT_INTENSITY;
    window.dispatchEvent(
      new CustomEvent('settings:render-changed', { detail: { settings: this.renderSettings } })
    );
  }
}
