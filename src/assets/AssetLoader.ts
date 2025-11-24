/**
 * Asset Loader Service
 *
 * Handles loading and caching of images and other assets.
 * Benefits:
 * - Automatic caching to prevent redundant loads
 * - Async loading with promises
 * - Batch loading support
 * - Memory management
 *
 * Usage:
 * ```typescript
 * import { AssetLoader } from '@/assets/AssetLoader';
 * import { AssetRegistry } from '@/assets/AssetRegistry';
 *
 * // Load single image
 * const img = await AssetLoader.loadImage(AssetRegistry.lobbyCards.practice());
 *
 * // Preload multiple images
 * const images = await AssetLoader.preloadImages([
 *   AssetRegistry.lobbyCards.practice(),
 *   AssetRegistry.lobbyCards.shop(),
 * ]);
 * ```
 */

export class AssetLoader {
  private static imageCache = new Map<string, HTMLImageElement>();
  private static loadingPromises = new Map<string, Promise<HTMLImageElement>>();

  /**
   * Load an image with caching
   * Returns cached image if already loaded, otherwise loads and caches it
   */
  static async loadImage(url: string): Promise<HTMLImageElement> {
    // Return cached image if available
    if (this.imageCache.has(url)) {
      return this.imageCache.get(url)!;
    }

    // Return existing loading promise if already loading
    if (this.loadingPromises.has(url)) {
      return this.loadingPromises.get(url)!;
    }

    // Create new loading promise
    const loadPromise = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        this.imageCache.set(url, img);
        this.loadingPromises.delete(url);
        resolve(img);
      };

      img.onerror = (error) => {
        this.loadingPromises.delete(url);
        console.error(`Failed to load image: ${url}`, error);
        reject(new Error(`Failed to load image: ${url}`));
      };

      img.src = url;
    });

    this.loadingPromises.set(url, loadPromise);
    return loadPromise;
  }

  /**
   * Load an image synchronously (returns immediately, image loads in background)
   * Useful when you need an Image object right away and don't need to wait
   */
  static loadImageSync(url: string): HTMLImageElement {
    // Return cached image if available
    if (this.imageCache.has(url)) {
      return this.imageCache.get(url)!;
    }

    // Create new image and start loading
    const img = new Image();
    img.onload = () => {
      this.imageCache.set(url, img);
    };
    img.onerror = (error) => {
      console.error(`Failed to load image: ${url}`, error);
    };
    img.src = url;

    return img;
  }

  /**
   * Preload multiple images in parallel
   * Returns when all images are loaded
   */
  static async preloadImages(urls: string[]): Promise<HTMLImageElement[]> {
    return Promise.all(urls.map(url => this.loadImage(url)));
  }

  /**
   * Check if an image is cached
   */
  static isCached(url: string): boolean {
    return this.imageCache.has(url);
  }

  /**
   * Check if an image is currently loading
   */
  static isLoading(url: string): boolean {
    return this.loadingPromises.has(url);
  }

  /**
   * Get a cached image without loading
   * Returns undefined if not cached
   */
  static getCached(url: string): HTMLImageElement | undefined {
    return this.imageCache.get(url);
  }

  /**
   * Clear the entire cache
   * Useful for memory management or scene transitions
   */
  static clearCache(): void {
    this.imageCache.clear();
    this.loadingPromises.clear();
  }

  /**
   * Clear specific images from cache
   */
  static clearImages(urls: string[]): void {
    urls.forEach(url => {
      this.imageCache.delete(url);
      this.loadingPromises.delete(url);
    });
  }

  /**
   * Get cache statistics for debugging
   */
  static getCacheStats(): {
    cachedCount: number;
    loadingCount: number;
    cachedUrls: string[];
  } {
    return {
      cachedCount: this.imageCache.size,
      loadingCount: this.loadingPromises.size,
      cachedUrls: Array.from(this.imageCache.keys()),
    };
  }
}
