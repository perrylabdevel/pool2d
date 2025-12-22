import { openEditorDb, STORE_SKINS } from './EditorDb';

export interface CueSkin {
  id: string;
  name: string;
  imageBase64: string;
  thumbnail?: string;
  
  // Cue configuration
  tipOffsetPx: number;      // Distance from top of image to the tip contact point (in pixels)
  lengthScale: number;      // Scale factor for length (default 1.0)
  thicknessScale: number;   // Scale factor for thickness (default 1.0)
  ppi: number;              // Pixels per inch of the texture

  createdAt: Date;
  updatedAt: Date;
}

export type CueSkinCreateInput = Omit<CueSkin, 'id' | 'createdAt' | 'updatedAt'>;

export class CueStore {
  private db: IDBDatabase | null = null;
  private skins: Map<string, CueSkin> = new Map();
  private listeners: Set<() => void> = new Set();
  private activeSkinId: string | null = null;

  async init(): Promise<void> {
    this.db = await openEditorDb();
    await this.loadAll();
    this.activeSkinId = this.getActiveSkinId();
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
        
        // If no skins exist, maybe we should create a default one? 
        // For now, let's just resolve.
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  setActiveSkinId(id: string | null): void {
    this.activeSkinId = id;
    try {
      if (id) {
        localStorage.setItem('cue-editor-active-skin', id);
      } else {
        localStorage.removeItem('cue-editor-active-skin');
      }
    } catch (e) {
      console.warn('Failed to save active cue skin ID');
    }
  }

  getActiveSkinId(): string | null {
    if (this.activeSkinId) return this.activeSkinId;
    try {
      this.activeSkinId = localStorage.getItem('cue-editor-active-skin');
    } catch (e) {
      // ignore
    }
    return this.activeSkinId;
  }

  getActiveSkin(): CueSkin | undefined {
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
        // Maintain aspect ratio
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

  async create(input: CueSkinCreateInput): Promise<CueSkin> {
    const skin: CueSkin = {
      ...input,
      id: this.generateId(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.save(skin);
    return skin;
  }

  async save(skin: CueSkin): Promise<void> {
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

  get(id: string): CueSkin | undefined {
    return this.skins.get(id);
  }

  getAll(): CueSkin[] {
    return Array.from(this.skins.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach(listener => listener());
  }

  private generateId(): string {
    return `cue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async createFromFile(file: File): Promise<CueSkin> {
    const base64 = await this.blobToBase64(file);
    const thumbnail = await this.generateThumbnail(base64);
    
    const name = file.name.replace(/\.[^/.]+$/, '');
    
    // Initial defaults. User can adjust later.
    return this.create({
      name,
      imageBase64: base64,
      thumbnail,
      tipOffsetPx: 0,
      lengthScale: 1.0,
      thicknessScale: 1.0,
      ppi: 72, // Reasonable default?
    });
  }
}
