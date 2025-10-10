// Asset loading manager with progress tracking
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

export interface AssetLoadProgress {
  loaded: number;
  total: number;
  item: string;
}

export class AssetLoader {
  private loadingManager: THREE.LoadingManager;
  private onProgressCallback?: (progress: AssetLoadProgress) => void;

  constructor() {
    this.loadingManager = new THREE.LoadingManager();
    
    this.loadingManager.onStart = (url, _loaded, _total) => {
      console.log(`Started loading: ${url}`);
    };

    this.loadingManager.onLoad = () => {
      console.log('All assets loaded!');
    };

    this.loadingManager.onProgress = (url, loaded, total) => {
      if (this.onProgressCallback) {
        this.onProgressCallback({
          loaded,
          total,
          item: this.getItemName(url)
        });
      }
    };

    this.loadingManager.onError = (url) => {
      console.error(`Error loading: ${url}`);
    };
  }

  private getItemName(url: string): string {
    const parts = url.split('/');
    return parts[parts.length - 1];
  }

  onProgress(callback: (progress: AssetLoadProgress) => void) {
    this.onProgressCallback = callback;
  }

  async loadAllAssets(): Promise<{
    fbx: THREE.Group;
    textures: Map<number, THREE.Texture>;
  }> {
    const textureMap: Record<number, string> = {
      1: '/textures/poolballTx01.jpg',
      2: '/textures/poolballTx02.jpg',
      3: '/textures/poolballTx03.jpg',
      4: '/textures/poolballTx5.jpg',
      5: '/textures/poolballTx7.jpg',
      6: '/textures/poolballTx6.jpg',
      7: '/textures/poolballTx04.jpg',
      8: '/textures/poolballTx9.jpg',
      9: '/textures/poolballTx11.jpg',
      10: '/textures/poolballTx10.jpg',
      11: '/textures/poolballTx8.jpg',
      12: '/textures/poolballTx13.jpg',
      13: '/textures/poolballTx15.jpg',
      14: '/textures/poolballTx14.jpg',
      15: '/textures/poolballTx12.jpg'
    };

    const fbxLoader = new FBXLoader(this.loadingManager);
    const textureLoader = new THREE.TextureLoader(this.loadingManager);

    try {
      // Load FBX model
      const fbxPromise = fbxLoader.loadAsync('/poolballs.fbx');

      // Load all textures
      const texturePromises = Object.entries(textureMap).map(async ([ballId, path]) => {
        try {
          const texture = await textureLoader.loadAsync(path);
          texture.colorSpace = THREE.SRGBColorSpace;
          return { ballId: parseInt(ballId), texture };
        } catch (error) {
          console.error(`❌ Failed to load texture for ball ${ballId} at ${path}:`, error);
          return { ballId: parseInt(ballId), texture: null as any };
        }
      });

      // Wait for all assets
      const [fbx, textureResults] = await Promise.all([
        fbxPromise,
        Promise.all(texturePromises)
      ]);

      // Convert texture results to Map (skip failed loads)
      const textures = new Map<number, THREE.Texture>();
      textureResults.forEach(({ ballId, texture }) => {
        if (texture) {
          textures.set(ballId, texture);
        }
      });
      
      console.log(`📊 Texture loading summary: ${textures.size}/15 textures loaded successfully`);

      return { fbx, textures };
    } catch (error) {
      console.error('Asset loading failed:', error);
      throw error;
    }
  }
}
