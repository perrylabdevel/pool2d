import { BasePattern, PatternConfig } from './BasePattern';
import { PerlinNoise } from '../noise/PerlinNoise';

export interface WoodGrainConfig extends PatternConfig {
    baseColor: string;      // e.g., '#8B4513' (brown)
    grainColor: string;     // e.g., '#654321' (darker brown)
    grainScale: number;     // 10-50 (spacing between grain lines)
    ringSpacing: number;    // 20-100 (spacing between growth rings)
    ringVariation: number;  // 0-1 (how irregular rings are)
    knotDensity: number;    // 0-0.1 (probability of knots)
}

export class WoodGrainPattern extends BasePattern {
    private woodConfig: WoodGrainConfig;

    constructor(config: WoodGrainConfig) {
        super(config);
        this.woodConfig = config;
    }

    generate(): HTMLCanvasElement {
        PerlinNoise.initialize(this.woodConfig.seed || 0);

        const imageData = this.getImageData();
        const data = imageData.data;
        const { width, height } = this.canvas;

        const base = this.hexToRgb(this.woodConfig.baseColor);
        const grain = this.hexToRgb(this.woodConfig.grainColor);

        // Generate knot positions
        const knots = this.generateKnots(width, height);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const i = (y * width + x) * 4;

                // Distance from nearest knot (distorts grain)
                const knotInfluence = this.getKnotInfluence(x, y, knots);

                // Growth rings (circular around knots)
                const angle = Math.atan2(y - height / 2, x - width / 2);
                const distance = Math.sqrt(
                    ((x - width / 2) ** 2) + ((y - height / 2) ** 2)
                );

                const ring = Math.sin(
                    (distance + knotInfluence * 50) / this.woodConfig.ringSpacing
                ) * 0.5 + 0.5;

                // Fine grain (vertical lines with noise)
                const grainNoise = PerlinNoise.octaveNoise2D(
                    x / this.woodConfig.grainScale,
                    y / this.woodConfig.grainScale,
                    4,
                    0.5
                );

                const grainPattern = Math.sin(
                    (x + grainNoise * 20) / this.woodConfig.grainScale
                ) * 0.5 + 0.5;

                // Combine ring + grain
                const t = ring * 0.6 + grainPattern * 0.4;

                // Lerp between base and grain color
                const r = Math.floor(base.r + (grain.r - base.r) * t);
                const g = Math.floor(base.g + (grain.g - base.g) * t);
                const b = Math.floor(base.b + (grain.b - base.b) * t);

                data[i] = r;
                data[i + 1] = g;
                data[i + 2] = b;
                data[i + 3] = 255;
            }
        }

        this.putImageData(imageData);
        return this.canvas;
    }

    private generateKnots(width: number, height: number): Array<{ x: number; y: number }> {
        const knots = [];
        const count = Math.floor(width * height * this.woodConfig.knotDensity / 10000);

        for (let i = 0; i < count; i++) {
            knots.push({
                x: Math.random() * width,
                y: Math.random() * height
            });
        }

        return knots;
    }

    private getKnotInfluence(x: number, y: number, knots: any[]): number {
        let minDist = Infinity;
        for (const knot of knots) {
            const dist = Math.sqrt((x - knot.x) ** 2 + (y - knot.y) ** 2);
            minDist = Math.min(minDist, dist);
        }
        return Math.max(0, 100 - minDist) / 100; // 0-1 based on proximity
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
