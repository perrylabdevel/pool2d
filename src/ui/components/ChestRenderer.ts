import { AssetLoader } from '../../assets/AssetLoader';
import { AssetRegistry } from '../../assets/AssetRegistry';

export type ChestType = 'bronze' | 'gold' | 'platinum' | 'diamond';

export class ChestRenderer {
    private static spriteSheet: HTMLImageElement | null = null;

    static load() {
        if (!this.spriteSheet) {
            const url = AssetRegistry.chests.spriteSheet();
            console.log(`[ChestRenderer] Loading sprite sheet from: ${url}`);
            this.spriteSheet = AssetLoader.loadImageSync(url);
            this.spriteSheet.onload = () => console.log('[ChestRenderer] Sprite sheet loaded successfully');
            this.spriteSheet.onerror = (e) => console.error('[ChestRenderer] Failed to load sprite sheet', e);
        }
    }

    static drawChest(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, type: ChestType) {
        this.load();
        const img = this.spriteSheet;
        if (!img) {
            console.warn('[ChestRenderer] No image object');
            return;
        }
        if (!img.complete || img.naturalWidth === 0) {
            // console.debug('[ChestRenderer] Image not ready yet');
            return;
        }

        // Sprite sheet is 2x2
        // Top-Left: Bronze
        // Top-Right: Gold
        // Bottom-Left: Platinum
        // Bottom-Right: Diamond

        const w = img.naturalWidth / 2;
        const h = img.naturalHeight / 2;

        let sx = 0;
        let sy = 0;

        switch (type) {
            case 'bronze':
                sx = 0;
                sy = 0;
                break;
            case 'gold':
                sx = w;
                sy = 0;
                break;
            case 'platinum':
                sx = 0;
                sy = h;
                break;
            case 'diamond':
                sx = w;
                sy = h;
                break;
        }

        ctx.drawImage(img, sx, sy, w, h, x, y, size, size);
    }
}
