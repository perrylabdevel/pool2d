import { TextureConfig } from './TextureConfig';
import { TextureGenerator } from './TextureGenerator';

export class TextureCache {
    private static cache = new Map<string, HTMLCanvasElement>();

    /**
     * Get texture (from cache if available, generate if not)
     */
    static get(config: TextureConfig): HTMLCanvasElement {
        const key = this.generateKey(config);

        if (this.cache.has(key)) {
            return this.cache.get(key)!;
        }

        // Generate and cache
        const texture = TextureGenerator.generate(config);
        this.cache.set(key, texture);

        return texture;
    }

    /**
     * Clear cache (call when user changes textures)
     */
    static clear(): void {
        this.cache.clear();
    }

    /**
     * Generate cache key from config
     */
    private static generateKey(config: TextureConfig): string {
        return JSON.stringify(config);
    }

    /**
     * Get cache statistics (for debugging)
     */
    static getStats(): { size: number; keys: string[] } {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }
}
