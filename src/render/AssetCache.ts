// Browser-based asset caching using IndexedDB for FBX models and textures
// This eliminates the 1.8s reload time by storing parsed assets locally

const DB_NAME = 'pool2d-assets';
const DB_VERSION = 2; // bump to invalidate stale cached assets
const STORE_NAME = 'cached-assets';

interface CachedAsset {
  url: string;
  data: ArrayBuffer;
  timestamp: number;
  type: 'fbx' | 'glb' | 'texture';
}

class AssetCacheManager {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        // Drop and recreate to clear old entries when we bump DB_VERSION
        if (db.objectStoreNames.contains(STORE_NAME)) {
          db.deleteObjectStore(STORE_NAME);
        }
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'url' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      };
    });

    return this.initPromise;
  }

  async get(url: string): Promise<ArrayBuffer | null> {
    await this.init();
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(url);

      request.onsuccess = () => {
        const result = request.result as CachedAsset | undefined;
        resolve(result?.data ?? null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async set(url: string, data: ArrayBuffer, type: 'fbx' | 'glb' | 'texture'): Promise<void> {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const asset: CachedAsset = {
        url,
        data,
        timestamp: Date.now(),
        type,
      };
      const request = store.put(asset);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async has(url: string): Promise<boolean> {
    const data = await this.get(url);
    return data !== null;
  }

  async clear(): Promise<void> {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

export const assetCache = new AssetCacheManager();

import { Capacitor } from '@capacitor/core';

// Helper to fetch with caching
export async function fetchWithCache(url: string, type: 'fbx' | 'glb' | 'texture'): Promise<ArrayBuffer> {
  const isIOS = Capacitor.getPlatform() === 'ios';

  // Check cache first (skip on iOS to prevent memory/quota crashes with large assets)
  if (!isIOS) {
    const cached = await assetCache.get(url);
    if (cached) {
      console.log(`  ✓ Cache hit: ${url}`);
      return cached;
    }
  }

  // Cache miss - fetch from network
  console.log(`  ⬇️ Downloading: ${url}`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
  }

  const data = await response.arrayBuffer();

  // Store in cache for next time (skip on iOS)
  if (!isIOS) {
    try {
      await assetCache.set(url, data, type);
    } catch (e) {
      console.warn('Failed to cache asset:', e);
    }
  }

  return data;
}

// Expose cache management to console
(window as any).assetCache = {
  clear: () => assetCache.clear(),
  has: (url: string) => assetCache.has(url),
};
