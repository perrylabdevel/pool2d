// Settings manager with local storage persistence
import { CONFIG } from '../config';

export interface GameSettings {
  aimAssist: boolean;
  call8Ball: boolean;
  showFPS: boolean;
}

export interface UIColors {
  tableColor: string;
  railColor: string;
  activePlayerColor: string;
  turnIndicatorColor: string;
}

export interface PhysicsSettings {
  BALL_ROTATION_MULTIPLIER_3D: number;
  BALL_RESTITUTION: number;
  BALL_BALL_FRICTION: number;
  CUSHION_RESTITUTION: number;
  CUE_POWER_MAX: number;
  CUE_POWER_MULTIPLIER: number;
  ROLLING_FRICTION: number;
  SLIDING_FRICTION: number;
  SOLVER_ITERATIONS: number;
  VELOCITY_EPSILON: number;
}

const STORAGE_KEYS = {
  GAME_SETTINGS: 'pool2d_game_settings',
  UI_COLORS: 'pool2d_ui_colors',
  PHYSICS_SETTINGS: 'pool2d_physics_settings',
};

const DEFAULT_GAME_SETTINGS: GameSettings = {
  aimAssist: true,
  call8Ball: false,
  showFPS: true,
};

const DEFAULT_UI_COLORS: UIColors = {
  tableColor: '#146B4A', // --felt
  railColor: '#4A2C17', // --rail
  activePlayerColor: '#38BDF8', // --cyan-400
  turnIndicatorColor: '#F0B429', // --gold-500
};

const DEFAULT_PHYSICS_SETTINGS: PhysicsSettings = {
  BALL_ROTATION_MULTIPLIER_3D: 1.0,
  BALL_RESTITUTION: 0.93,
  BALL_BALL_FRICTION: 0.05,
  CUSHION_RESTITUTION: 0.88,
  CUE_POWER_MAX: 25.0,
  CUE_POWER_MULTIPLIER: 10.0,
  ROLLING_FRICTION: 0.50,
  SLIDING_FRICTION: 0.65,
  SOLVER_ITERATIONS: 15,
  VELOCITY_EPSILON: 0.2,
};

export class SettingsManager {
  private gameSettings: GameSettings;
  private uiColors: UIColors;
  private physicsSettings: PhysicsSettings;

  constructor() {
    this.gameSettings = this.loadGameSettings();
    this.uiColors = this.loadUIColors();
    this.physicsSettings = this.loadPhysicsSettings();
    
    // Apply loaded settings
    this.applyPhysicsSettings();
    this.applyUIColors();
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
  }

  getGameSettings(): GameSettings {
    return { ...this.gameSettings };
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
    CONFIG.RAIL_COLOR = this.uiColors.railColor;

    // Re-point the design tokens themselves rather than styling elements
    // inline, so every consumer downstream keeps resolving through a token.
    const root = document.documentElement;
    root.style.setProperty('--felt', this.uiColors.tableColor);
    root.style.setProperty('--rail', this.uiColors.railColor);
    root.style.setProperty('--cyan-400', this.uiColors.activePlayerColor);
    root.style.setProperty('--gold-500', this.uiColors.turnIndicatorColor);

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

  private applyPhysicsSettings() {
    // Update CONFIG with loaded physics settings
    Object.entries(this.physicsSettings).forEach(([key, value]) => {
      (CONFIG as unknown as Record<string, number>)[key] = value;
    });
  }

  // Clear all settings
  clearAll() {
    try {
      localStorage.removeItem(STORAGE_KEYS.GAME_SETTINGS);
      localStorage.removeItem(STORAGE_KEYS.UI_COLORS);
      localStorage.removeItem(STORAGE_KEYS.PHYSICS_SETTINGS);
      
      this.gameSettings = { ...DEFAULT_GAME_SETTINGS };
      this.uiColors = { ...DEFAULT_UI_COLORS };
      this.physicsSettings = { ...DEFAULT_PHYSICS_SETTINGS };
      
      this.applyPhysicsSettings();
      this.applyUIColors();
    } catch (e) {
      console.warn('Failed to clear settings:', e);
    }
  }
}
