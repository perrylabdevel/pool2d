export interface PatternConfig {
    width: number;    // Canvas width
    height: number;   // Canvas height
    seed?: number;    // Random seed for repeatability
    [key: string]: any; // Pattern-specific params
}

export abstract class BasePattern {
    protected canvas: HTMLCanvasElement;
    protected ctx: CanvasRenderingContext2D;
    protected config: PatternConfig;

    constructor(config: PatternConfig) {
        this.config = config;
        this.canvas = document.createElement('canvas');
        this.canvas.width = config.width;
        this.canvas.height = config.height;
        this.ctx = this.canvas.getContext('2d')!;
    }

    /**
     * Generate the pattern (must be implemented by subclasses)
     * Returns a canvas with the pattern drawn
     */
    abstract generate(): HTMLCanvasElement;

    /**
     * Get ImageData for pixel manipulation
     */
    protected getImageData(): ImageData {
        return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    }

    /**
     * Put ImageData back to canvas
     */
    protected putImageData(imageData: ImageData): void {
        this.ctx.putImageData(imageData, 0, 0);
    }
}
