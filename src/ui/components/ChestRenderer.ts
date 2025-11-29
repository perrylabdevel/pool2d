import { AssetLoader } from '../../assets/AssetLoader';
import { AssetRegistry } from '../../assets/AssetRegistry';

export type ChestType = 'bronze' | 'gold' | 'platinum' | 'diamond';

export class ChestRenderer {
    private static images: Record<ChestType, HTMLImageElement | null> = {
        bronze: null,
        gold: null,
        platinum: null,
        diamond: null
    };

    static load() {
        if (!this.images.bronze) {
            this.images.bronze = AssetLoader.loadImageSync(AssetRegistry.chests.bronze());
            this.images.gold = AssetLoader.loadImageSync(AssetRegistry.chests.gold());
            this.images.platinum = AssetLoader.loadImageSync(AssetRegistry.chests.platinum());
            this.images.diamond = AssetLoader.loadImageSync(AssetRegistry.chests.diamond());
        }
    }

    static drawChest(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, type: ChestType) {
        this.load();
        const img = this.images[type];

        if (!img) {
            console.warn(`[ChestRenderer] No image for type ${type}`);
            return;
        }
        if (!img.complete || img.naturalWidth === 0) {
            return;
        }

        ctx.drawImage(img, x, y, width, height);
    }
}
