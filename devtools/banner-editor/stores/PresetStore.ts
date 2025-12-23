import { BannerConfig, DEFAULT_BANNER_CONFIG } from '../types';

const DB_NAME = 'BannerEditorDB';
const DB_VERSION = 1;
const STORE_NAME = 'presets';

export interface BannerPreset {
  id: string;
  name: string;
  config: BannerConfig;
  createdAt: number;
  updatedAt: number;
  isBuiltIn?: boolean;
}

export class PresetStore {
  private db: IDBDatabase | null = null;
  private listeners: Set<() => void> = new Set();

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('name', 'name', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };
    });
  }

  async getAll(): Promise<BannerPreset[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const presets = request.result as BannerPreset[];
        // Sort by createdAt descending (newest first)
        presets.sort((a, b) => b.createdAt - a.createdAt);
        resolve(presets);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async get(id: string): Promise<BannerPreset | undefined> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async save(preset: BannerPreset): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(preset);

      request.onsuccess = () => {
        this.notify();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async delete(id: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => {
        this.notify();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async createFromConfig(name: string, config: BannerConfig): Promise<BannerPreset> {
    const preset: BannerPreset = {
      id: `preset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      config: structuredClone(config),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await this.save(preset);
    return preset;
  }

  async ensureBuiltInPresets(): Promise<void> {
    const existing = await this.getAll();
    const builtInIds = existing.filter(p => p.isBuiltIn).map(p => p.id);

    for (const preset of BUILT_IN_PRESETS) {
      if (!builtInIds.includes(preset.id)) {
        await this.save(preset);
      }
    }
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(l => l());
  }
}

// Built-in presets organized by notification type
const BUILT_IN_PRESETS: BannerPreset[] = [
  // SUCCESS - Green, celebratory
  {
    id: 'builtin_success',
    name: 'Success',
    isBuiltIn: true,
    createdAt: 0,
    updatedAt: 0,
    config: {
      ...DEFAULT_BANNER_CONFIG,
      id: 'success',
      name: 'Success',
      type: 'success',
      text: {
        ...DEFAULT_BANNER_CONFIG.text,
        content: 'SUCCESS!',
      },
      background: {
        type: 'gradient',
        color: '#166534',
        gradient: {
          type: 'linear',
          angle: 0,
          stops: [
            { offset: 0, color: '#16653400' },
            { offset: 0.2, color: '#166534CC' },
            { offset: 0.8, color: '#166534CC' },
            { offset: 1, color: '#16653400' },
          ],
        },
      },
      effects: {
        ...DEFAULT_BANNER_CONFIG.effects,
        shimmer: true,
        shimmerSpeed: 1.2,
      },
    },
  },
  // SUCCESS variant - Victory (blue/gold feel)
  {
    id: 'builtin_victory',
    name: 'Victory',
    isBuiltIn: true,
    createdAt: 0,
    updatedAt: 0,
    config: {
      ...DEFAULT_BANNER_CONFIG,
      id: 'victory',
      name: 'Victory',
      type: 'success',
      text: {
        ...DEFAULT_BANNER_CONFIG.text,
        content: 'VICTORY!',
        fontSize: 52,
      },
      background: {
        type: 'gradient',
        color: '#1e3a5f',
        gradient: {
          type: 'linear',
          angle: 0,
          stops: [
            { offset: 0, color: '#1e3a5f00' },
            { offset: 0.15, color: '#1e3a5fDD' },
            { offset: 0.5, color: '#2d4a6fEE' },
            { offset: 0.85, color: '#1e3a5fDD' },
            { offset: 1, color: '#1e3a5f00' },
          ],
        },
      },
      glow: {
        enabled: true,
        type: 'outer',
        blur: 15,
        color: '#fbbf24',
      },
      effects: {
        ...DEFAULT_BANNER_CONFIG.effects,
        shimmer: true,
        shimmerSpeed: 1.5,
      },
      animation: {
        entry: { type: 'scale', duration: 400, easing: 'ease-out-back', delay: 0 },
        hold: 3000,
        exit: { type: 'fade', duration: 300, easing: 'ease-in' },
      },
    },
  },
  // ERROR - Red, alarming
  {
    id: 'builtin_error',
    name: 'Error',
    isBuiltIn: true,
    createdAt: 0,
    updatedAt: 0,
    config: {
      ...DEFAULT_BANNER_CONFIG,
      id: 'error',
      name: 'Error',
      type: 'error',
      text: {
        ...DEFAULT_BANNER_CONFIG.text,
        content: 'ERROR',
      },
      background: {
        type: 'gradient',
        color: '#991b1b',
        gradient: {
          type: 'linear',
          angle: 0,
          stops: [
            { offset: 0, color: '#991b1b00' },
            { offset: 0.2, color: '#991b1bCC' },
            { offset: 0.8, color: '#991b1bCC' },
            { offset: 1, color: '#991b1b00' },
          ],
        },
      },
      animation: {
        entry: { type: 'slide-down', duration: 250, easing: 'ease-out', delay: 0 },
        hold: 2500,
        exit: { type: 'slide-up', duration: 200, easing: 'ease-in' },
      },
    },
  },
  // ERROR variant - Defeat
  {
    id: 'builtin_defeat',
    name: 'Defeat',
    isBuiltIn: true,
    createdAt: 0,
    updatedAt: 0,
    config: {
      ...DEFAULT_BANNER_CONFIG,
      id: 'defeat',
      name: 'Defeat',
      type: 'error',
      text: {
        ...DEFAULT_BANNER_CONFIG.text,
        content: 'DEFEAT',
        fontSize: 52,
      },
      background: {
        type: 'gradient',
        color: '#7f1d1d',
        gradient: {
          type: 'linear',
          angle: 0,
          stops: [
            { offset: 0, color: '#7f1d1d00' },
            { offset: 0.2, color: '#7f1d1dDD' },
            { offset: 0.8, color: '#7f1d1dDD' },
            { offset: 1, color: '#7f1d1d00' },
          ],
        },
      },
      shadow: {
        ...DEFAULT_BANNER_CONFIG.shadow,
        enabled: true,
        blur: 20,
        offsetY: 4,
        color: 'rgba(0,0,0,0.5)',
      },
      animation: {
        entry: { type: 'fade', duration: 400, easing: 'ease-out', delay: 0 },
        hold: 3000,
        exit: { type: 'slide-down', duration: 300, easing: 'ease-in' },
      },
    },
  },
  // WARNING - Orange/amber
  {
    id: 'builtin_warning',
    name: 'Warning',
    isBuiltIn: true,
    createdAt: 0,
    updatedAt: 0,
    config: {
      ...DEFAULT_BANNER_CONFIG,
      id: 'warning',
      name: 'Warning',
      type: 'warning',
      text: {
        ...DEFAULT_BANNER_CONFIG.text,
        content: 'WARNING',
      },
      background: {
        type: 'gradient',
        color: '#b45309',
        gradient: {
          type: 'linear',
          angle: 0,
          stops: [
            { offset: 0, color: '#b4530900' },
            { offset: 0.2, color: '#b45309CC' },
            { offset: 0.8, color: '#b45309CC' },
            { offset: 1, color: '#b4530900' },
          ],
        },
      },
      animation: {
        entry: { type: 'slide-right', duration: 300, easing: 'ease-out', delay: 0 },
        hold: 2500,
        exit: { type: 'slide-left', duration: 250, easing: 'ease-in' },
      },
    },
  },
  // WARNING variant - Foul
  {
    id: 'builtin_foul',
    name: 'Foul',
    isBuiltIn: true,
    createdAt: 0,
    updatedAt: 0,
    config: {
      ...DEFAULT_BANNER_CONFIG,
      id: 'foul',
      name: 'Foul',
      type: 'warning',
      text: {
        ...DEFAULT_BANNER_CONFIG.text,
        content: 'FOUL!',
        fontSize: 56,
      },
      background: {
        type: 'gradient',
        color: '#c2410c',
        gradient: {
          type: 'linear',
          angle: 0,
          stops: [
            { offset: 0, color: '#c2410c00' },
            { offset: 0.15, color: '#c2410cDD' },
            { offset: 0.85, color: '#c2410cDD' },
            { offset: 1, color: '#c2410c00' },
          ],
        },
      },
      glow: {
        enabled: true,
        type: 'outer',
        blur: 12,
        color: '#fb923c',
      },
      animation: {
        entry: { type: 'bounce', duration: 350, easing: 'ease-out-back', delay: 0 },
        hold: 2000,
        exit: { type: 'fade', duration: 250, easing: 'ease-in' },
      },
    },
  },
  // INFO - Teal/cyan, informational
  {
    id: 'builtin_info',
    name: 'Info',
    isBuiltIn: true,
    createdAt: 0,
    updatedAt: 0,
    config: {
      ...DEFAULT_BANNER_CONFIG,
      id: 'info',
      name: 'Info',
      type: 'info',
      text: {
        ...DEFAULT_BANNER_CONFIG.text,
        content: 'INFO',
        fontSize: 40,
      },
      background: {
        type: 'gradient',
        color: '#0d9488',
        gradient: {
          type: 'linear',
          angle: 0,
          stops: [
            { offset: 0, color: '#0d948800' },
            { offset: 0.2, color: '#0d9488CC' },
            { offset: 0.8, color: '#0d9488CC' },
            { offset: 1, color: '#0d948800' },
          ],
        },
      },
      animation: {
        entry: { type: 'fade', duration: 250, easing: 'ease-out', delay: 0 },
        hold: 2000,
        exit: { type: 'fade', duration: 200, easing: 'ease-in' },
      },
    },
  },
  // INFO variant - Your Turn
  {
    id: 'builtin_your_turn',
    name: 'Your Turn',
    isBuiltIn: true,
    createdAt: 0,
    updatedAt: 0,
    config: {
      ...DEFAULT_BANNER_CONFIG,
      id: 'your_turn',
      name: 'Your Turn',
      type: 'info',
      text: {
        ...DEFAULT_BANNER_CONFIG.text,
        content: 'YOUR TURN',
        fontSize: 44,
      },
      background: {
        type: 'gradient',
        color: '#0369a1',
        gradient: {
          type: 'linear',
          angle: 0,
          stops: [
            { offset: 0, color: '#0369a100' },
            { offset: 0.2, color: '#0369a1CC' },
            { offset: 0.8, color: '#0369a1CC' },
            { offset: 1, color: '#0369a100' },
          ],
        },
      },
      animation: {
        entry: { type: 'slide-right', duration: 300, easing: 'ease-out-back', delay: 0 },
        hold: 1800,
        exit: { type: 'slide-left', duration: 250, easing: 'ease-in' },
      },
    },
  },
  // EPIC - Purple, legendary, with glow and shimmer
  {
    id: 'builtin_epic',
    name: 'Epic',
    isBuiltIn: true,
    createdAt: 0,
    updatedAt: 0,
    config: {
      ...DEFAULT_BANNER_CONFIG,
      id: 'epic',
      name: 'Epic',
      type: 'epic',
      text: {
        ...DEFAULT_BANNER_CONFIG.text,
        content: 'LEGENDARY!',
        fontSize: 56,
      },
      background: {
        type: 'gradient',
        color: '#6b21a8',
        gradient: {
          type: 'linear',
          angle: 0,
          stops: [
            { offset: 0, color: '#6b21a800' },
            { offset: 0.15, color: '#6b21a8DD' },
            { offset: 0.5, color: '#7c3aedEE' },
            { offset: 0.85, color: '#6b21a8DD' },
            { offset: 1, color: '#6b21a800' },
          ],
        },
      },
      glow: {
        enabled: true,
        type: 'outer',
        blur: 25,
        color: '#a855f7',
      },
      effects: {
        ...DEFAULT_BANNER_CONFIG.effects,
        shimmer: true,
        shimmerSpeed: 2,
      },
      animation: {
        entry: { type: 'bounce', duration: 500, easing: 'ease-out-back', delay: 0 },
        hold: 3500,
        exit: { type: 'fade', duration: 400, easing: 'ease-in' },
      },
    },
  },
  // EPIC variant - Perfect Game
  {
    id: 'builtin_perfect',
    name: 'Perfect Game',
    isBuiltIn: true,
    createdAt: 0,
    updatedAt: 0,
    config: {
      ...DEFAULT_BANNER_CONFIG,
      id: 'perfect',
      name: 'Perfect Game',
      type: 'epic',
      text: {
        ...DEFAULT_BANNER_CONFIG.text,
        content: 'PERFECT GAME!',
        fontSize: 52,
      },
      background: {
        type: 'gradient',
        color: '#854d0e',
        gradient: {
          type: 'linear',
          angle: 0,
          stops: [
            { offset: 0, color: '#854d0e00' },
            { offset: 0.1, color: '#854d0eCC' },
            { offset: 0.3, color: '#a16207DD' },
            { offset: 0.5, color: '#ca8a04EE' },
            { offset: 0.7, color: '#a16207DD' },
            { offset: 0.9, color: '#854d0eCC' },
            { offset: 1, color: '#854d0e00' },
          ],
        },
      },
      glow: {
        enabled: true,
        type: 'outer',
        blur: 30,
        color: '#fbbf24',
      },
      effects: {
        ...DEFAULT_BANNER_CONFIG.effects,
        shimmer: true,
        shimmerSpeed: 2.5,
      },
      animation: {
        entry: { type: 'scale', duration: 500, easing: 'ease-out-back', delay: 0 },
        hold: 4000,
        exit: { type: 'fade', duration: 500, easing: 'ease-in' },
      },
    },
  },
];

export const presetStore = new PresetStore();
