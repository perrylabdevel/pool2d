import { BannerConfig, DEFAULT_BANNER_CONFIG } from '../types';

export class BannerStore {
  private config: BannerConfig;
  private listeners: Set<(config: BannerConfig) => void> = new Set();
  
  constructor() {
    this.config = structuredClone(DEFAULT_BANNER_CONFIG);
    this.loadFromStorage();
  }

  get(): BannerConfig {
    return this.config;
  }

  set(config: BannerConfig) {
    this.config = config;
    this.notify();
    this.saveToStorage();
  }

  update(patch: Partial<BannerConfig>) {
    this.config = { ...this.config, ...patch };
    this.notify();
    this.saveToStorage();
  }

  updateNested<K extends keyof BannerConfig>(key: K, patch: Partial<BannerConfig[K]>) {
    const current = this.config[key];
    if (typeof current === 'object' && current !== null) {
      this.config = {
        ...this.config,
        [key]: { ...(current as object), ...(patch as object) }
      };
    }
    this.notify();
    this.saveToStorage();
  }

  subscribe(listener: (config: BannerConfig) => void): () => void {
    this.listeners.add(listener);
    // Immediate callback
    listener(this.config);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(l => l(this.config));
  }

  private saveToStorage() {
    try {
      localStorage.setItem('banner-editor-active-config', JSON.stringify(this.config));
    } catch (e) {
      console.warn('Failed to save banner config', e);
    }
  }

  private loadFromStorage() {
    try {
      // First try to load editor's working state
      let stored = localStorage.getItem('banner-editor-active-config');

      // If no editor state, try loading what the game is using
      if (!stored) {
        stored = localStorage.getItem('RailRush_banner_editor_config');
      }

      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge with default to ensure new fields are present
        this.config = { ...DEFAULT_BANNER_CONFIG, ...parsed };
      }
    } catch (e) {
      console.warn('Failed to load banner config', e);
    }
  }

  reset() {
    this.config = structuredClone(DEFAULT_BANNER_CONFIG);
    this.notify();
    this.saveToStorage();
  }
}
