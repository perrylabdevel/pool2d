// Settings manager with local storage persistence
import { CONFIG } from '../config';
import { RenderLayerSettings, defaultRenderLayerSettings } from '../render/RenderLayers';
import type { ModernPocketGeometry } from '../geometry/ModernGeometry';
import { resetTableGeometryCache } from '../geometry/Geometry';
import { Capacitor } from '@capacitor/core';
import iosSettings from '../config/ios-settings.json';
import { TableAppearance, DEFAULT_TABLE_APPEARANCE, TABLE_THEMES } from '../textures/TableAppearance';

export type { TableAppearance };
export { DEFAULT_TABLE_APPEARANCE, TABLE_THEMES };

export interface GameSettings {
  aimAssist: boolean;
  call8Ball: boolean;
  showFPS: boolean;
  aiDifficulty?: 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT';
  sidebarDialSide: 'left' | 'right';
  touchAimMode: boolean;
  BREAK_SPEED_THRESHOLD: number;
  BALL_IN_HAND_ANYWHERE: boolean;
  SHOW_AIM_INFO: boolean;
}

export interface DebugSettings {
  DEBUG_BIH_LOG: boolean;
  DEBUG_DRAW_NORMALS: boolean;
  DEBUG_DRAW_VELOCITIES: boolean;
  DEBUG_DRAW_AABB: boolean;
  DEBUG_DRAW_CONTACTS: boolean;
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
  PHYSICS_DT: number;
  MAX_SUBSTEPS: number;
  CUE_POWER_MIN: number;
  CUE_DRAG_SCALE: number;
  AIM_LINE_LENGTH: number;
  GHOST_LINE_LENGTH: number;
  FINE_AIM_SENSITIVITY: number;
  MICRO_AIM_MAX_DEGREES: number;
  DISTANCE_AIM_SCALING_ENABLED: boolean;
  DISTANCE_AIM_MIN_DISTANCE: number;
  DISTANCE_AIM_MAX_DISTANCE: number;
  DISTANCE_AIM_MIN_SENSITIVITY: number;
  BALL_IN_HAND_POCKET_MARGIN_IN: number;
  BALL_IN_HAND_ITERATIONS: number;
  POCKET_CAPTURE_SPEED_THRESHOLD: number;
  POCKET_CAPTURE_DAMPING: number;
  POCKET_CAPTURE_PULL_DISTANCE: number;
  POCKET_CAPTURE_GRAVITY: number;
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
  skinOpacity: number;
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
  HUD_BALL_CHIP_SIZE_PX: number;
  CUE_LENGTH_IN: number;
  CUE_VISUAL_PADDING_IN: number;
  MIN_WORLD_PADDING_IN: number;
  CUE_BALL_MEASLE_RADIUS_RATIO: number;
  CUE_BALL_MEASLE_COLOR: string;
}

export interface TextureSettings {
  // Felt
  feltNoiseScale: number;
  feltNoiseIntensity: number;
  feltWeaveScale: number;
  feltWeaveIntensity: number;
  feltColorVariation: number;
  // Frame
  frameStyle: 'wood' | 'metal' | 'matte';
  frameGrainScaleX: number;
  frameGrainScaleY: number;
  frameGrainIntensity: number;
  frameTurbulence: number;
  frameBaseColorMix: number;
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
  DEBUG_SETTINGS: 'pool2d_debug_settings',
  TEXTURE_SETTINGS: 'pool2d_texture_settings',
  TABLE_APPEARANCE: 'pool2d_table_appearance',
};

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  aimAssist: true,
  call8Ball: false,
  showFPS: true,
  aiDifficulty: 'MEDIUM',
  sidebarDialSide: CONFIG.SIDEBAR_DIAL_SIDE ?? 'left',
  touchAimMode: CONFIG.TOUCH_AIM_MODE ?? false,
  BREAK_SPEED_THRESHOLD: CONFIG.BREAK_SPEED_THRESHOLD ?? 5.0,
  BALL_IN_HAND_ANYWHERE: CONFIG.BALL_IN_HAND_ANYWHERE ?? false,
  SHOW_AIM_INFO: CONFIG.SHOW_AIM_INFO ?? true,
};

export const DEFAULT_UI_COLORS: UIColors = {
  tableColor: CONFIG.TABLE_COLOR ?? '#0a5f0a',
  frameColor: CONFIG.FRAME_COLOR ?? '#3d2413',
  railColor: CONFIG.RAIL_COLOR ?? '#2d1810',
  railFillColor: CONFIG.RAIL_FILL_COLOR ?? '#000000',
  activePlayerColor: '#4CAF50',
  turnIndicatorColor: '#FFC107',
  cueStickColor: '#8B4513', // Brown wood
  cueTipColor: '#4A90E2', // Blue chalk
};

export const DEFAULT_PHYSICS_SETTINGS: PhysicsSettings = {
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
  PHYSICS_DT: CONFIG.PHYSICS_DT ?? 1 / 120,
  MAX_SUBSTEPS: CONFIG.MAX_SUBSTEPS ?? 10,
  CUE_POWER_MIN: CONFIG.CUE_POWER_MIN ?? 0.5,
  CUE_DRAG_SCALE: CONFIG.CUE_DRAG_SCALE ?? 0.08,
  AIM_LINE_LENGTH: CONFIG.AIM_LINE_LENGTH ?? 20,
  GHOST_LINE_LENGTH: CONFIG.GHOST_LINE_LENGTH ?? 30,
  FINE_AIM_SENSITIVITY: CONFIG.FINE_AIM_SENSITIVITY ?? 0.1,
  MICRO_AIM_MAX_DEGREES: CONFIG.MICRO_AIM_MAX_DEGREES ?? 2.5,
  DISTANCE_AIM_SCALING_ENABLED: CONFIG.DISTANCE_AIM_SCALING_ENABLED ?? true,
  DISTANCE_AIM_MIN_DISTANCE: CONFIG.DISTANCE_AIM_MIN_DISTANCE ?? 15,
  DISTANCE_AIM_MAX_DISTANCE: CONFIG.DISTANCE_AIM_MAX_DISTANCE ?? 60,
  DISTANCE_AIM_MIN_SENSITIVITY: CONFIG.DISTANCE_AIM_MIN_SENSITIVITY ?? 0.35,
  BALL_IN_HAND_POCKET_MARGIN_IN: CONFIG.BALL_IN_HAND_POCKET_MARGIN_IN ?? 0.1,
  BALL_IN_HAND_ITERATIONS: CONFIG.BALL_IN_HAND_ITERATIONS ?? 7,
  POCKET_CAPTURE_SPEED_THRESHOLD: CONFIG.POCKET_CAPTURE_SPEED_THRESHOLD ?? 45,
  POCKET_CAPTURE_DAMPING: CONFIG.POCKET_CAPTURE_DAMPING ?? 0.25,
  POCKET_CAPTURE_PULL_DISTANCE: CONFIG.POCKET_CAPTURE_PULL_DISTANCE ?? 0.8,
  POCKET_CAPTURE_GRAVITY: CONFIG.POCKET_CAPTURE_GRAVITY ?? 60,
};

export const DEFAULT_DEBUG_SETTINGS: DebugSettings = {
  DEBUG_BIH_LOG: CONFIG.DEBUG_BIH_LOG ?? false,
  DEBUG_DRAW_NORMALS: CONFIG.DEBUG_DRAW_NORMALS ?? true,
  DEBUG_DRAW_VELOCITIES: CONFIG.DEBUG_DRAW_VELOCITIES ?? true,
  DEBUG_DRAW_AABB: CONFIG.DEBUG_DRAW_AABB ?? true,
  DEBUG_DRAW_CONTACTS: CONFIG.DEBUG_DRAW_CONTACTS ?? true,
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

export const DEFAULT_TEXTURE_SETTINGS: TextureSettings = {
  // Felt
  feltNoiseScale: 15,
  feltNoiseIntensity: 15,
  feltWeaveScale: 2,
  feltWeaveIntensity: 0.03,
  feltColorVariation: 0,
  // Frame
  frameStyle: 'wood',
  frameGrainScaleX: 1,
  frameGrainScaleY: 10,
  frameGrainIntensity: 40,
  frameTurbulence: 0.02,
  frameBaseColorMix: 0.5,
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
  private debugSettings: DebugSettings;
  private textureSettings: TextureSettings;
  private gameStats: GameStats;
  private tableAppearance: TableAppearance;

  constructor() {
    this.gameSettings = this.loadGameSettings();
    this.uiColors = this.loadUIColors();
    this.physicsSettings = this.loadPhysicsSettings();
    this.geometrySettings = this.loadGeometrySettings();
    this.renderSettings = this.loadRenderSettings();
    this.modernGeometrySettings = this.loadModernGeometrySettings();
    this.audioSettings = this.loadAudioSettings();
    this.debugSettings = this.loadDebugSettings();
    this.textureSettings = this.loadTextureSettings();
    this.gameStats = this.loadGameStats();
    this.tableAppearance = this.loadTableAppearance();

    // Apply loaded settings
    this.applyGameSettings();
    this.applyPhysicsSettings();
    this.applyUIColors();
    this.applyGeometrySettings();
    this.applyRenderSettings();
    this.applyDebugSettings();

    this.applyPlatformOverrides();
  }

  private applyPlatformOverrides() {
    if (Capacitor.getPlatform() === 'ios') {
      console.log('[SettingsManager] Applying iOS overrides');

      if (iosSettings.physics) {
        this.physicsSettings = { ...this.physicsSettings, ...iosSettings.physics };
        this.applyPhysicsSettings();
      }

      if (iosSettings.render) {
        // Cast to any to allow partial updates if types don't perfectly match JSON
        this.renderSettings = { ...this.renderSettings, ...iosSettings.render } as RenderSettings;
        this.applyRenderSettings();
      }

      if ((iosSettings as any).geometry) {
        this.geometrySettings = { ...this.geometrySettings, ...(iosSettings as any).geometry };
        this.applyGeometrySettings();
      }

      if ((iosSettings as any).game) {
        this.gameSettings = { ...this.gameSettings, ...(iosSettings as any).game };
        this.applyGameSettings();
      }

      if ((iosSettings as any).colors) {
        const colors = (iosSettings as any).colors;
        this.uiColors = { ...this.uiColors, ...colors };
        this.applyUIColors();

        // Sync to TableAppearance for texture generation
        if (colors.tableColor) this.tableAppearance.felt.color = colors.tableColor;
        if (colors.frameColor) this.tableAppearance.frame.color = colors.frameColor;
        if (colors.railFillColor) this.tableAppearance.cushion.color = colors.railFillColor;
        
        // Dispatch appearance change to trigger texture update
        window.dispatchEvent(
          new CustomEvent('settings:appearance-changed', { detail: { appearance: this.tableAppearance } })
        );
      }

      // Add other sections as needed (game, audio, etc.)
    }
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
    this.applyGameSettings();
    window.dispatchEvent(new CustomEvent('settings:game-changed', { detail: { settings: this.getGameSettings() } }));
  }

  private applyGameSettings() {
    CONFIG.BREAK_SPEED_THRESHOLD = this.gameSettings.BREAK_SPEED_THRESHOLD;
    CONFIG.BALL_IN_HAND_ANYWHERE = this.gameSettings.BALL_IN_HAND_ANYWHERE;
    CONFIG.SHOW_AIM_INFO = this.gameSettings.SHOW_AIM_INFO;
    CONFIG.SIDEBAR_DIAL_SIDE = this.gameSettings.sidebarDialSide ?? 'left';
    CONFIG.TOUCH_AIM_MODE = this.gameSettings.touchAimMode ?? false;
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

  // Debug Settings
  loadDebugSettings(): DebugSettings {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.DEBUG_SETTINGS);
      if (stored) {
        return { ...DEFAULT_DEBUG_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('Failed to load debug settings:', e);
    }
    return { ...DEFAULT_DEBUG_SETTINGS };
  }

  saveDebugSettings(settings: Partial<DebugSettings>) {
    this.debugSettings = { ...this.debugSettings, ...settings };
    try {
      localStorage.setItem(STORAGE_KEYS.DEBUG_SETTINGS, JSON.stringify(this.debugSettings));
    } catch (e) {
      console.warn('Failed to save debug settings:', e);
    }
    this.applyDebugSettings();
    window.dispatchEvent(new CustomEvent('settings:debug-changed', { detail: { settings: this.getDebugSettings() } }));
  }

  getDebugSettings(): DebugSettings {
    return { ...this.debugSettings };
  }

  resetDebugSettings() {
    this.debugSettings = { ...DEFAULT_DEBUG_SETTINGS };
    try {
      localStorage.setItem(STORAGE_KEYS.DEBUG_SETTINGS, JSON.stringify(this.debugSettings));
    } catch (e) {
      console.warn('Failed to reset debug settings:', e);
    }
    this.applyDebugSettings();
    window.dispatchEvent(new CustomEvent('settings:debug-changed', { detail: { settings: this.getDebugSettings() } }));
  }

  private applyDebugSettings() {
    CONFIG.DEBUG_BIH_LOG = this.debugSettings.DEBUG_BIH_LOG;
    CONFIG.DEBUG_DRAW_NORMALS = this.debugSettings.DEBUG_DRAW_NORMALS;
    CONFIG.DEBUG_DRAW_VELOCITIES = this.debugSettings.DEBUG_DRAW_VELOCITIES;
    CONFIG.DEBUG_DRAW_AABB = this.debugSettings.DEBUG_DRAW_AABB;
    CONFIG.DEBUG_DRAW_CONTACTS = this.debugSettings.DEBUG_DRAW_CONTACTS;
    CONFIG.DEBUG_DRAW_CONTACTS = this.debugSettings.DEBUG_DRAW_CONTACTS;
  }

  // Texture Settings
  loadTextureSettings(): TextureSettings {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.TEXTURE_SETTINGS);
      if (stored) {
        return { ...DEFAULT_TEXTURE_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('Failed to load texture settings:', e);
    }
    return { ...DEFAULT_TEXTURE_SETTINGS };
  }

  saveTextureSettings(settings: Partial<TextureSettings>) {
    this.textureSettings = { ...this.textureSettings, ...settings };
    try {
      localStorage.setItem(STORAGE_KEYS.TEXTURE_SETTINGS, JSON.stringify(this.textureSettings));
    } catch (e) {
      console.warn('Failed to save texture settings:', e);
    }
    window.dispatchEvent(new CustomEvent('settings:texture-changed', { detail: { settings: this.getTextureSettings() } }));
  }

  getTextureSettings(): TextureSettings {
    return { ...this.textureSettings };
  }

  resetTextureSettings() {
    this.textureSettings = { ...DEFAULT_TEXTURE_SETTINGS };
    try {
      localStorage.setItem(STORAGE_KEYS.TEXTURE_SETTINGS, JSON.stringify(this.textureSettings));
    } catch (e) {
      console.warn('Failed to reset texture settings:', e);
    }
    window.dispatchEvent(new CustomEvent('settings:texture-changed', { detail: { settings: this.getTextureSettings() } }));
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

    // Sync to TableAppearance
    let appearanceChanged = false;
    if (colors.tableColor) {
      this.tableAppearance.felt.color = colors.tableColor;
      appearanceChanged = true;
    }
    if (colors.frameColor) {
      this.tableAppearance.frame.color = colors.frameColor;
      appearanceChanged = true;
    }
    if (colors.railFillColor) {
      this.tableAppearance.cushion.color = colors.railFillColor;
      appearanceChanged = true;
    }

    try {
      localStorage.setItem(STORAGE_KEYS.UI_COLORS, JSON.stringify(this.uiColors));
      this.applyUIColors();
      window.dispatchEvent(new CustomEvent('settings:ui-colors-changed', { detail: { settings: this.getUIColors() } }));

      if (appearanceChanged) {
        localStorage.setItem(STORAGE_KEYS.TABLE_APPEARANCE, JSON.stringify(this.tableAppearance));
        // Dispatch event so DevTools (RemoteBridge) gets the update
        window.dispatchEvent(
          new CustomEvent('settings:appearance-changed', { detail: { appearance: this.tableAppearance } })
        );
      }
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
      window.dispatchEvent(new CustomEvent('settings:ui-colors-changed', { detail: { settings: this.getUIColors() } }));
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
    window.dispatchEvent(new CustomEvent('settings:physics-changed', { detail: { settings: this.getPhysicsSettings() } }));
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
    window.dispatchEvent(new CustomEvent('settings:physics-changed', { detail: { settings: this.getPhysicsSettings() } }));
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

  private loadRenderSettings(): RenderSettings {
    const defaults: RenderSettings = {
      ...defaultRenderLayerSettings,
      canvasScale: 1,
      ballScale: 1,
      skinOpacity: 1.0,
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
      pocketShadowIntensity: 0,
      pocketHighlightIntensity: 0.65,
      grooveInnerBase: 0.37,
      grooveInnerDepthScale: 0.46,
      grooveThicknessFactor: 0.165,
      grooveOpacityBase: 1,
      grooveOpacityDepthScale: 1,
      grooveRimThicknessFactor: 0.08,
      grooveRimOuterOpacity: 0.4,
      grooveRimInnerOpacity: 0.36,
      grooveColor: '#000000',
      rimColor: '#ffffff',
      pocketBottomColor: '#000000',
      pocketGradientCenterColor: '#ffffff',
      pocketGradientEdgeColor: '#141414',
      pocketWallColor: '#0a0a0a',
      pocketGradientStrength: 0.4,
      HUD_BALL_CHIP_SIZE_PX: CONFIG.HUD_BALL_CHIP_SIZE_PX ?? 42,
      CUE_LENGTH_IN: CONFIG.CUE_LENGTH_IN ?? 58,
      CUE_VISUAL_PADDING_IN: CONFIG.CUE_VISUAL_PADDING_IN ?? 20,
      MIN_WORLD_PADDING_IN: CONFIG.MIN_WORLD_PADDING_IN ?? 6,
      CUE_BALL_MEASLE_RADIUS_RATIO: CONFIG.CUE_BALL_MEASLE_RADIUS_RATIO ?? 0.12,
      CUE_BALL_MEASLE_COLOR: CONFIG.CUE_BALL_MEASLE_COLOR ?? '#c62828',
    };

    try {
      const stored = localStorage.getItem(STORAGE_KEYS.RENDER_SETTINGS);
      if (stored) {
        const parsed = JSON.parse(stored);
        console.log('[SettingsManager] Loaded Render Settings from Storage:', parsed);
        if (parsed.ballVisualScale !== undefined && parsed.ballScale === undefined) {
          parsed.ballScale = parsed.ballVisualScale;
          delete parsed.ballVisualScale;
        }
        return { ...defaults, ...parsed };
      }
    } catch (e) {
      console.warn('Failed to load render settings:', e);
    }
    return defaults;
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
    window.dispatchEvent(new CustomEvent('settings:modern-geometry-changed', { detail: { settings: this.modernGeometrySettings } }));
  }

  resetGeometrySettings() {
    this.geometrySettings = {
      FRAME_OFFSET_IN: 4.0,
      FRAME_CORNER_RADIUS_IN: 4.0,
      SIDE_FRAME_OFFSET_IN: 2.0,
      SIDE_POCKET_OUTWARD_OFFSET_IN: -1.3,
      CORNER_FRAME_OFFSET_IN: 4.0,
      SIDE_STRAIGHT_Y_IN: 23.75,
      SIDE_INNER_Y_IN: 26.2,
      CORNER_STRAIGHT_X_IN: 48.75,
      CORNER_TARGET_Y_IN: 23.75,
      SIDE_JAW_OUTER_OVERRIDE_IN: 2.5,
      SIDE_JAW_INNER_OVERRIDE_IN: 2.025,
      CORNER_JAW_X_OVERRIDE_IN: 45.15,
      CORNER_JAW_Y_OVERRIDE_IN: 20.15,
      SIDE_THROAT_WIDTH_IN: null,
      CORNER_THROAT_WIDTH_IN: 3,
      JAW_REF_RADIUS_IN: 4.0,
      CORNER_JAW_REF_RADIUS_IN: 4.0,
      CORNER_POCKET_CAPTURE_RADIUS_IN: 2.8,
      SIDE_POCKET_CAPTURE_RADIUS_IN: 3.3,
      CORNER_POCKET_VISUAL_RADIUS_IN: 2.55,
      SIDE_POCKET_VISUAL_RADIUS_IN: 2.1,
      CORNER_POCKET_OUTWARD_OFFSET_IN: -1.0,
      POCKET_SHELF_DEPTH_IN: 1.5,
      POCKET_SHELF_DEPTH_SIDE_IN: 0.25,
      JAW_CURVE_BLEND: 0.0,
      CORNER_CUT_ANGLE_DEG: 0.0,
      SIDE_CUT_ANGLE_DEG: 0.0,
      RAIL_THICKNESS_INNER: 0.15,
      RAIL_THICKNESS_OUTER: 0.15,
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
      skinOpacity: 1.0,
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
      pocketShadowIntensity: 0,
      pocketHighlightIntensity: 0.65,
      grooveInnerBase: 0.37,
      grooveInnerDepthScale: 0.46,
      grooveThicknessFactor: 0.165,
      grooveOpacityBase: 1,
      grooveOpacityDepthScale: 1,
      grooveRimThicknessFactor: 0.08,
      grooveRimOuterOpacity: 0.4,
      grooveRimInnerOpacity: 0.36,
      grooveColor: '#000000',
      rimColor: '#ffffff',
      pocketBottomColor: '#000000',
      pocketGradientCenterColor: '#ffffff',
      pocketGradientEdgeColor: '#141414',
      pocketWallColor: '#0a0a0a',
      pocketGradientStrength: 0.4,
      HUD_BALL_CHIP_SIZE_PX: CONFIG.HUD_BALL_CHIP_SIZE_PX ?? 42,
      CUE_LENGTH_IN: CONFIG.CUE_LENGTH_IN ?? 58,
      CUE_VISUAL_PADDING_IN: CONFIG.CUE_VISUAL_PADDING_IN ?? 20,
      MIN_WORLD_PADDING_IN: CONFIG.MIN_WORLD_PADDING_IN ?? 6,
      CUE_BALL_MEASLE_RADIUS_RATIO: CONFIG.CUE_BALL_MEASLE_RADIUS_RATIO ?? 0.12,
      CUE_BALL_MEASLE_COLOR: CONFIG.CUE_BALL_MEASLE_COLOR ?? '#c62828',
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
    resetTableGeometryCache();
    try {
      console.info('[Settings] Geometry updated', this.geometrySettings);
    } catch { }
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
      this.debugSettings = { ...DEFAULT_DEBUG_SETTINGS };
      this.gameStats = { ...DEFAULT_GAME_STATS };
      this.renderSettings = this.loadRenderSettings();

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
    console.log(`[SettingsManager] Applied Render Settings: scale=${scale} radius=${CONFIG.BALL_RADIUS} base=${CONFIG.BALL_BASE_RADIUS}`);
    window.dispatchEvent(
      new CustomEvent('settings:render-changed', { detail: { settings: this.renderSettings } })
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Table Appearance (New unified texture system)
  // ─────────────────────────────────────────────────────────────

  loadTableAppearance(): TableAppearance {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.TABLE_APPEARANCE);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Deep merge with defaults to handle missing properties
        return {
          felt: { ...DEFAULT_TABLE_APPEARANCE.felt, ...parsed.felt },
          frame: { ...DEFAULT_TABLE_APPEARANCE.frame, ...parsed.frame },
          cushion: { ...DEFAULT_TABLE_APPEARANCE.cushion, ...parsed.cushion },
          pocket: { ...DEFAULT_TABLE_APPEARANCE.pocket, ...parsed.pocket },
        };
      }
    } catch (e) {
      console.warn('Failed to load table appearance:', e);
    }
    return { ...DEFAULT_TABLE_APPEARANCE };
  }

  saveTableAppearance(appearance: Partial<TableAppearance>): void {
    // Deep merge
    this.tableAppearance = {
      felt: { ...this.tableAppearance.felt, ...appearance.felt },
      frame: { ...this.tableAppearance.frame, ...appearance.frame },
      cushion: { ...this.tableAppearance.cushion, ...appearance.cushion },
      pocket: { ...this.tableAppearance.pocket, ...appearance.pocket },
    };

    // Sync to UIColors
    let colorsChanged = false;
    if (appearance.felt?.color) {
      this.uiColors.tableColor = appearance.felt.color;
      colorsChanged = true;
    }
    if (appearance.frame?.color) {
      this.uiColors.frameColor = appearance.frame.color;
      colorsChanged = true;
    }
    if (appearance.cushion?.color) {
      this.uiColors.railFillColor = appearance.cushion.color;
      colorsChanged = true;
    }

    try {
      localStorage.setItem(STORAGE_KEYS.TABLE_APPEARANCE, JSON.stringify(this.tableAppearance));

      if (colorsChanged) {
        localStorage.setItem(STORAGE_KEYS.UI_COLORS, JSON.stringify(this.uiColors));
        this.applyUIColors(); // Updates CONFIG and CSS vars
        window.dispatchEvent(new CustomEvent('settings:ui-colors-changed', { detail: { settings: this.getUIColors() } }));
      }
    } catch (e) {
      console.warn('Failed to save table appearance:', e);
    }
    window.dispatchEvent(
      new CustomEvent('settings:appearance-changed', { detail: { appearance: this.tableAppearance } })
    );
  }

  getTableAppearance(): TableAppearance {
    return {
      felt: { ...this.tableAppearance.felt },
      frame: { ...this.tableAppearance.frame },
      cushion: { ...this.tableAppearance.cushion },
      pocket: { ...this.tableAppearance.pocket },
    };
  }

  applyTheme(themeKey: string): void {
    const theme = TABLE_THEMES[themeKey];
    if (theme) {
      this.saveTableAppearance(theme.appearance);
    } else {
      console.warn(`Unknown theme: ${themeKey}`);
    }
  }

  resetTableAppearance(): void {
    this.tableAppearance = { ...DEFAULT_TABLE_APPEARANCE };
    try {
      localStorage.setItem(STORAGE_KEYS.TABLE_APPEARANCE, JSON.stringify(this.tableAppearance));
    } catch (e) {
      console.warn('Failed to reset table appearance:', e);
    }
    window.dispatchEvent(
      new CustomEvent('settings:appearance-changed', { detail: { appearance: this.tableAppearance } })
    );
  }
}
