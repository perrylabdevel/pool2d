/**
 * Settings Import/Export utility
 * Handles comprehensive save/load of all application settings
 */

import { SettingsManager, PhysicsSettings, GameSettings, UIColors, GeometrySettings, RenderSettings, DebugSettings } from './SettingsManager';
import { CONFIG } from '../config';

export interface CompleteSettings {
  version: string;
  timestamp: string;
  physics: Partial<PhysicsSettings>;
  game: Partial<GameSettings>;
  colors: Partial<UIColors>;
  geometry: Partial<GeometrySettings>;
  render: Partial<RenderSettings>;
  debug: Partial<DebugSettings>;
}

/**
 * SettingsIO handles importing and exporting settings to/from JSON
 */
export class SettingsIO {
  constructor(private settingsManager: SettingsManager) { }

  /**
   * Export all current settings to a JSON object
   */
  exportAll(): CompleteSettings {
    return {
      version: '1.0',
      timestamp: new Date().toISOString(),
      physics: this.settingsManager.getPhysicsSettings(),
      game: this.settingsManager.getGameSettings(),
      colors: this.settingsManager.getUIColors(),
      geometry: this.settingsManager.getGeometrySettings(),

      render: this.settingsManager.getRenderSettings(),
      debug: this.settingsManager.getDebugSettings(),
    };
  }

  /**
   * Export settings as JSON string
   */
  exportToJSON(pretty: boolean = true): string {
    return JSON.stringify(this.exportAll(), null, pretty ? 2 : 0);
  }

  /**
   * Copy settings JSON to clipboard
   */
  async copyToClipboard(): Promise<boolean> {
    try {
      const json = this.exportToJSON();
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(json);
        console.log('✅ Settings copied to clipboard');
        return true;
      } else {
        console.warn('❌ Clipboard API not available');
        console.log('📋 Settings JSON:', json);
        return false;
      }
    } catch (error) {
      console.error('❌ Failed to copy to clipboard:', error);
      return false;
    }
  }

  /**
   * Download settings as a JSON file
   */
  downloadAsFile(filename?: string): void {
    const json = this.exportToJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const defaultFilename = `pool2d-settings-${timestamp}.json`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename || defaultFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log(`✅ Settings downloaded as ${a.download}`);
  }

  /**
   * Import settings from a JSON object
   */
  importAll(settings: CompleteSettings, options: { merge?: boolean; skipGeometry?: boolean } = {}): void {
    const { merge = false, skipGeometry = false } = options;

    // If not merging, reset to defaults first
    if (!merge) {
      this.settingsManager.resetPhysicsSettings();
      this.settingsManager.resetUIColors();
      // Note: No resetGameSettings - always merge game state
    }

    // Import each category
    if (settings.physics) {
      this.settingsManager.savePhysicsSettings(settings.physics);
    }

    if (settings.game) {
      this.settingsManager.saveGameSettings(settings.game);
    }

    if (settings.colors) {
      this.settingsManager.saveUIColors(settings.colors);
    }

    if (settings.render) {
      this.settingsManager.saveRenderSettings(settings.render);
    }

    if (settings.debug) {
      this.settingsManager.saveDebugSettings(settings.debug);
    }

    if (settings.geometry && !skipGeometry) {
      this.settingsManager.saveGeometrySettings(settings.geometry);
    }

    console.log(`✅ Settings imported (${merge ? 'merged' : 'replaced'})`);

    // Dispatch events to notify UI components
    window.dispatchEvent(new CustomEvent('settings:imported', { detail: settings }));
  }

  /**
   * Import settings from JSON string
   */
  importFromJSON(json: string, options?: { merge?: boolean; skipGeometry?: boolean }): boolean {
    try {
      const settings = JSON.parse(json) as CompleteSettings;
      this.importAll(settings, options);
      return true;
    } catch (error) {
      console.error('❌ Failed to parse settings JSON:', error);
      return false;
    }
  }

  /**
   * Import settings from clipboard
   */
  async importFromClipboard(options?: { merge?: boolean; skipGeometry?: boolean }): Promise<boolean> {
    try {
      if (!navigator.clipboard) {
        console.warn('❌ Clipboard API not available');
        return false;
      }

      const text = await navigator.clipboard.readText();
      const success = this.importFromJSON(text, options);

      if (success) {
        console.log('✅ Settings imported from clipboard');
      }

      return success;
    } catch (error) {
      console.error('❌ Failed to read from clipboard:', error);
      return false;
    }
  }

  /**
   * Import settings from a file
   */
  importFromFile(): Promise<boolean> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';

      input.onchange = async (event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) {
          resolve(false);
          return;
        }

        try {
          const text = await file.text();
          const success = this.importFromJSON(text);

          if (success) {
            console.log(`✅ Settings imported from ${file.name}`);
          }

          resolve(success);
        } catch (error) {
          console.error('❌ Failed to read file:', error);
          resolve(false);
        }
      };

      input.oncancel = () => {
        resolve(false);
      };

      document.body.appendChild(input);
      input.click();
      document.body.removeChild(input);
    });
  }

  /**
   * Validate settings JSON structure
   */
  static validate(settings: any): settings is CompleteSettings {
    if (!settings || typeof settings !== 'object') {
      return false;
    }

    // Basic structure check
    return (
      'version' in settings &&
      ('physics' in settings || 'game' in settings || 'colors' in settings || 'geometry' in settings || 'render' in settings || 'debug' in settings)
    );
  }
}
