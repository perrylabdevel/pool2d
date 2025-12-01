import { BasePattern, PatternConfig } from './BasePattern';
import { PerlinNoise } from '../noise/PerlinNoise';

export interface MarbleConfig extends PatternConfig {
    baseColor: string;      // e.g., '#FFFFFF' (white)
    veinColor: string;      // e.g., '#888888' (gray)
    veinDensity: number;    // 0.1-1.0
    veinContrast: number;   // 0.5-2.0
    turbulence: number;     // 0-1 (how wavy veins are)
}

export class MarblePattern extends BasePattern {
    private marbleConfig: MarbleConfig;

    constructor(config: MarbleConfig) {
        super(config);
        this.marbleConfig = config;
    }

    generate(): HTMLCanvasElement {
        PerlinNoise.initialize(this.marbleConfig.seed || 0);

        const imageData = this.getImageData();
        const data = imageData.data;
        const { width, height } = this.canvas;

        const base = this.hexToRgb(this.marbleConfig.baseColor);
        const vein = this.hexToRgb(this.marbleConfig.veinColor);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const i = (y * width + x) * 4;

                // Turbulent marble veins
                const turbulence = PerlinNoise.octaveNoise2D(
                    x / 100,
                    y / 100,
                    6,
                    0.5
                ) * this.marbleConfig.turbulence * 50;

                const veinPattern = Math.sin(
                    (x + turbulence) / 30 * this.marbleConfig.veinDensity
                ) * 0.5 + 0.5;

                // High contrast for veins
                const t = Math.pow(veinPattern, this.marbleConfig.veinContrast);

                // Lerp between vein and base
                const r = Math.floor(vein.r + (base.r - vein.r) * t);
                const g = Math.floor(vein.g + (base.g - vein.g) * t);
                const b = Math.floor(vein.b + (base.b - vein.b) * t);

                data[i] = r;
                data[i + 1] = g;
                data[i + 2] = b;
                data[i + 3] = 255;
            }
        }

        this.putImageData(imageData);
        return this.canvas;
    }

    private hexToRgb(hex: string): { r: number; g: number; b: number } {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
    }
}
