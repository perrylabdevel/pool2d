import { BasePattern, PatternConfig } from './BasePattern';
import { PerlinNoise } from '../noise/PerlinNoise';

export class MetallicPattern extends BasePattern {
    constructor(config: PatternConfig) {
        super(config);
    }

    generate(): HTMLCanvasElement {
        const { ctx } = this;
        const { width, height } = this.config;
        const {
            baseColor = '#888888',
            roughness = 0.5,
            metalness = 0.8,
            brushDirection = 0, // Angle in degrees
            noiseScale = 50
        } = this.config;

        // Fill background
        ctx.fillStyle = baseColor;
        ctx.fillRect(0, 0, width, height);

        const imageData = this.getImageData();
        const data = imageData.data;

        PerlinNoise.initialize(this.config.seed || 123);

        const angleRad = (brushDirection * Math.PI) / 180;
        const cos = Math.cos(angleRad);
        const sin = Math.sin(angleRad);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                // Rotate coordinates to align with brush direction
                const nx = x * cos + y * sin;
                const ny = -x * sin + y * cos;

                // Stretch noise in one direction (along ny) to create streaks
                // High frequency in nx, low frequency in ny
                const noiseVal = PerlinNoise.noise2D(nx / (noiseScale / 5), ny / (noiseScale * 10));

                const index = (y * width + x) * 4;

                // Apply noise to brightness
                // Metal has high contrast highlights
                const brightness = 1 + noiseVal * roughness;

                data[index] = Math.min(255, Math.max(0, data[index] * brightness));
                data[index + 1] = Math.min(255, Math.max(0, data[index + 1] * brightness));
                data[index + 2] = Math.min(255, Math.max(0, data[index + 2] * brightness));
                // Alpha remains unchanged
            }
        }

        this.putImageData(imageData);
        return this.canvas;
    }
}
