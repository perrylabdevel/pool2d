/**
 * SkinStore - Manage table skins with IndexedDB persistence
 * Skins are actual images (not procedural colors)
 */

import { openEditorDb, STORE_SKINS } from './EditorDb';

export interface TableSkin {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;

  // Actual image data (base64 or blob URLs)
  images: {
    full?: string;        // Full table skin image (primary)
    felt?: string;        // Separate felt texture
    frame?: string;       // Separate frame texture
    rails?: string;       // Separate rails texture
  };

  // Thumbnail for skin library grid
  thumbnail?: string;

  // Source file info
  sourceFile?: {
    name: string;
    size: number;
    lastModified: number;
  };

  // Geometry offsets stored per skin
  geometry?: {
    cornerOffsetX?: number;
    cornerOffsetY?: number;
    sideOffsetX?: number;
    sideOffsetY?: number;
  };

  // Modular rail/pocket asset set (optional)
  railPocketSet?: RailPocketSet;

  // Cached composite overlay for modular sets
  composedOverlay?: string;
}

export type SkinCreateInput = Omit<TableSkin, 'id' | 'createdAt' | 'updatedAt'>;

export interface RailPocketSet {
  assets: {
    // Tiled straight rail
    railMiddleTile?: string;
    // Pocket hole overlays
    pocketCornerHole?: string;
    pocketSideHole?: string;

    // Cushion & Felt
    railCushion?: string;
    playAreaFelt?: string;

    // Pocket Rims (Liners) - separate from holes
    pocketCornerRim?: string;
    pocketSideRim?: string;
  };
  railThicknessPx: number;
  cushionWidthPx?: number; // Width of the rubber cushion
  seamOverlapPx?: number;
  ppi?: number;


  // NEW: Reference radius (inches) for pocket hole assets
  // Hole assets are designed at this radius; actual holes scale by pocket.radius / pocketHoleRefRadius
  pocketHoleRefRadius?: number;

  metadata?: {
    version?: number;
    notes?: string;
  };
}

export class SkinStore {
  private db: IDBDatabase | null = null;
  private skins: Map<string, TableSkin> = new Map();
  private listeners: Set<() => void> = new Set();

  async init(): Promise<void> {
    this.db = await openEditorDb();
    await this.loadAll();
  }

  private async loadAll(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_SKINS, 'readonly');
      const store = tx.objectStore(STORE_SKINS);
      const request = store.getAll();

      request.onsuccess = async () => {
        this.skins.clear();
        for (const skin of request.result) {
          this.skins.set(skin.id, skin);
        }

        // Clean up old boilerplate skins (those without real images)
        const boilerplateSkins = Array.from(this.skins.values()).filter((s) => {
          const hasFull = !!s.images?.full;
          const hasModular = !!s.railPocketSet?.assets?.railMiddleTile;
          return !hasFull && !hasModular;
        });
        for (const skin of boilerplateSkins) {
          await this.delete(skin.id);
        }

        // If no valid skins remain, add the default
        if (Array.from(this.skins.values()).filter(s => s.images?.full).length === 0) {
          await this.addDefaultSkins();
        }

        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  private async addDefaultSkins(): Promise<void> {
    // Load the current active skin image as the only default
    try {
      const response = await fetch('/src/assets/tmp/skin.png');
      if (response.ok) {
        const blob = await response.blob();
        const base64 = await this.blobToBase64(blob);
        const thumbnail = await this.generateThumbnail(base64);

        const skin = await this.create({
          name: 'Active Skin',
          images: { full: base64 },
          thumbnail,
          sourceFile: { name: 'skin.png', size: blob.size, lastModified: Date.now() },
          geometry: {
            cornerOffsetX: 0,
            cornerOffsetY: 0,
            sideOffsetX: 0,
            sideOffsetY: 0,
          },
        });

        // Set as active skin
        this.setActiveSkinId(skin.id);
      }
    } catch (err) {
      console.log('Could not load default skin image');
    }
  }

  private activeSkinId: string | null = null;

  setActiveSkinId(id: string | null): void {
    this.activeSkinId = id;
    try {
      if (id) {
        localStorage.setItem('table-editor-active-skin', id);
      } else {
        localStorage.removeItem('table-editor-active-skin');
      }
    } catch (e) {
      console.warn('Failed to save active skin ID');
    }
  }

  getActiveSkinId(): string | null {
    if (this.activeSkinId) return this.activeSkinId;
    try {
      this.activeSkinId = localStorage.getItem('table-editor-active-skin');
    } catch (e) {
      // ignore
    }
    return this.activeSkinId;
  }

  getActiveSkin(): TableSkin | undefined {
    const id = this.getActiveSkinId();
    return id ? this.get(id) : undefined;
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  private async generateThumbnail(base64: string, maxSize = 150): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = Math.min(maxSize / img.width, maxSize / img.height);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;

        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = base64;
    });
  }

  async create(input: SkinCreateInput): Promise<TableSkin> {
    const skin: TableSkin = {
      ...input,
      id: this.generateId(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.save(skin);
    return skin;
  }

  async save(skin: TableSkin): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    skin.updatedAt = new Date();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_SKINS, 'readwrite');
      const store = tx.objectStore(STORE_SKINS);
      const request = store.put(skin);

      request.onsuccess = () => {
        this.skins.set(skin.id, skin);
        this.notify();
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  async delete(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_SKINS, 'readwrite');
      const store = tx.objectStore(STORE_SKINS);
      const request = store.delete(id);

      request.onsuccess = () => {
        this.skins.delete(id);
        this.notify();
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  get(id: string): TableSkin | undefined {
    return this.skins.get(id);
  }

  getAll(): TableSkin[] {
    return Array.from(this.skins.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  async duplicate(id: string): Promise<TableSkin | null> {
    const original = this.get(id);
    if (!original) return null;

    const copy: SkinCreateInput = {
      name: `${original.name} (Copy)`,
      images: { ...original.images },
      thumbnail: original.thumbnail,
      sourceFile: original.sourceFile ? { ...original.sourceFile } : undefined,
      geometry: { ...original.geometry },
      railPocketSet: original.railPocketSet ? structuredClone(original.railPocketSet) : undefined,
      composedOverlay: original.composedOverlay,
    };

    return this.create(copy);
  }

  async clearAll(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await new Promise<void>((resolve, reject) => {
      const tx = this.db!.transaction(STORE_SKINS, 'readwrite');
      const store = tx.objectStore(STORE_SKINS);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    this.skins.clear();
    this.setActiveSkinId(null);
    this.notify();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach(listener => listener());
  }

  private generateId(): string {
    return `skin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async exportSkin(id: string): Promise<string | null> {
    const skin = this.get(id);
    if (!skin) return null;

    return JSON.stringify({
      version: '1.0',
      type: 'skin',
      ...skin,
    }, null, 2);
  }

  async importSkin(json: string): Promise<TableSkin | null> {
    try {
      const data = JSON.parse(json);
      const skin = await this.create({
        name: data.name || 'Imported Skin',
        images: data.images || {},
        thumbnail: data.thumbnail,
        geometry: data.geometry,
        railPocketSet: data.railPocketSet,
        composedOverlay: data.composedOverlay,
      });
      return skin;
    } catch (err) {
      console.error('Failed to import skin:', err);
      return null;
    }
  }

  /**
   * Create skin from uploaded image file
   */
  async createFromFile(file: File): Promise<TableSkin> {
    const base64 = await this.blobToBase64(file);
    const thumbnail = await this.generateThumbnail(base64);

    const name = file.name.replace(/\.[^/.]+$/, ''); // Remove extension

    return this.create({
      name,
      images: { full: base64 },
      thumbnail,
      sourceFile: {
        name: file.name,
        size: file.size,
        lastModified: file.lastModified,
      },
    });
  }

  /**
   * Update skin image
   */
  async updateImage(id: string, imageType: 'full' | 'felt' | 'frame' | 'rails', file: File): Promise<void> {
    const skin = this.get(id);
    if (!skin) return;

    const base64 = await this.blobToBase64(file);

    skin.images[imageType] = base64;

    // Regenerate thumbnail if updating full image
    if (imageType === 'full') {
      skin.thumbnail = await this.generateThumbnail(base64);
    }

    await this.save(skin);
  }
}
