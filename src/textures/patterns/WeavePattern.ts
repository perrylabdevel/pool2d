import { BasePattern, PatternConfig } from './BasePattern';
import { PerlinNoise } from '../noise/PerlinNoise';

export interface WeaveConfig extends PatternConfig {
    baseColor: string;      // e.g., '#228B22' (green)
    threadDensity: number;  // 0.5 = loose, 2.0 = tight
    roughness: number;      // 0-1 (noise intensity)
    brightness: number;     // 0.8-1.2 (lighting variation)
}

export class WeavePattern extends BasePattern {
    private weaveConfig: WeaveConfig;

    constructor(config: WeaveConfig) {
        super(config);
        this.weaveConfig = config;
    }

    generate(): HTMLCanvasElement {
        PerlinNoise.initialize(this.weaveConfig.seed || 0);

        const imageData = this.getImageData();
        const data = imageData.data;
        const { width, height } = this.canvas;

        // Parse base color
        const base = this.hexToRgb(this.weaveConfig.baseColor);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const i = (y * width + x) * 4;

                // Weave pattern (cross-hatching)
                const warpThread = Math.sin(x * this.weaveConfig.threadDensity * 0.1) * 0.5 + 0.5;
                const weftThread = Math.sin(y * this.weaveConfig.threadDensity * 0.1) * 0.5 + 0.5;
                const weave = (warpThread + weftThread) / 2;

                // Add noise for texture
                const noise = PerlinNoise.octaveNoise2D(
                    x / 50,
                    y / 50,
                    4,
                    0.5
                ) * this.weaveConfig.roughness;

                // Brightness variation
                const brightness = this.weaveConfig.brightness + noise * 0.2;

                // Combine weave + noise
                const luminance = weave * 0.5 + 0.5 + noise;

                // Apply to base color
                data[i] = Math.floor(base.r * luminance * brightness); // R
                data[i + 1] = Math.floor(base.g * luminance * brightness); // G
                data[i + 2] = Math.floor(base.b * luminance * brightness); // B
                data[i + 3] = 255; // A
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
