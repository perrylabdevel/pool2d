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

// Built-in presets
const BUILT_IN_PRESETS: BannerPreset[] = [
  {
    id: 'builtin_victory',
    name: 'Victory (Blue)',
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
      },
    },
  },
  {
    id: 'builtin_defeat',
    name: 'Defeat (Red)',
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
      },
      background: {
        type: 'gradient',
        color: '#880000',
        gradient: {
          type: 'linear',
          angle: 0,
          stops: [
            { offset: 0, color: '#88000000' },
            { offset: 0.2, color: '#880000CC' },
            { offset: 0.8, color: '#880000CC' },
            { offset: 1, color: '#88000000' },
          ],
        },
      },
    },
  },
  {
    id: 'builtin_epic',
    name: 'Epic (Purple)',
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
        color: '#6B21A8',
        gradient: {
          type: 'linear',
          angle: 0,
          stops: [
            { offset: 0, color: '#6B21A800' },
            { offset: 0.2, color: '#6B21A8CC' },
            { offset: 0.8, color: '#6B21A8CC' },
            { offset: 1, color: '#6B21A800' },
          ],
        },
      },
      glow: {
        enabled: true,
        type: 'outer',
        blur: 20,
        color: '#A855F7',
      },
      animation: {
        entry: { type: 'bounce', duration: 500, easing: 'ease-out-back', delay: 0 },
        hold: 3500,
        exit: { type: 'fade', duration: 400, easing: 'ease-in' },
      },
    },
  },
  {
    id: 'builtin_warning',
    name: 'Warning (Orange)',
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
        content: 'WARNING!',
      },
      background: {
        type: 'gradient',
        color: '#B45309',
        gradient: {
          type: 'linear',
          angle: 0,
          stops: [
            { offset: 0, color: '#B4530900' },
            { offset: 0.2, color: '#B45309CC' },
            { offset: 0.8, color: '#B45309CC' },
            { offset: 1, color: '#B4530900' },
          ],
        },
      },
    },
  },
  {
    id: 'builtin_info',
    name: 'Info (Teal)',
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
        content: 'YOUR TURN',
        fontSize: 42,
      },
      background: {
        type: 'gradient',
        color: '#0D9488',
        gradient: {
          type: 'linear',
          angle: 0,
          stops: [
            { offset: 0, color: '#0D948800' },
            { offset: 0.2, color: '#0D9488CC' },
            { offset: 0.8, color: '#0D9488CC' },
            { offset: 1, color: '#0D948800' },
          ],
        },
      },
      animation: {
        entry: { type: 'fade', duration: 300, easing: 'ease-out', delay: 0 },
        hold: 2000,
        exit: { type: 'fade', duration: 200, easing: 'ease-in' },
      },
    },
  },
];

export const presetStore = new PresetStore();
