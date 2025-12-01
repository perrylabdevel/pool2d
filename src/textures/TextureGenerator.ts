import { TextureConfig, PatternType } from './TextureConfig';
import { WeavePattern } from './patterns/WeavePattern';
import { WoodGrainPattern } from './patterns/WoodGrainPattern';
import { MarblePattern } from './patterns/MarblePattern';
import { BasePattern } from './patterns/BasePattern';
import { MetallicPattern } from './patterns/MetallicPattern';
import { GeometricPattern } from './patterns/GeometricPattern';

export class TextureGenerator {
    /**
     * Generate a texture from config
     * @param config - Texture configuration
     * @returns Canvas with generated texture
     */
    static generate(config: TextureConfig): HTMLCanvasElement {
        const pattern = this.createPattern(config);
        return pattern.generate();
    }

    /**
     * Create pattern instance based on config
     */
    private static createPattern(config: TextureConfig): BasePattern {
        const baseConfig = {
            width: config.width,
            height: config.height,
            seed: config.seed,
            ...config.params
        };

        switch (config.pattern) {
            case 'weave':
                return new WeavePattern(baseConfig as any);

            case 'wood_grain':
                return new WoodGrainPattern(baseConfig as any);

            case 'marble':
                return new MarblePattern(baseConfig as any);

            case 'metallic':
                return new MetallicPattern(baseConfig as any);

            case 'geometric':
                return new GeometricPattern(baseConfig as any);

            default:
                throw new Error(`Unknown pattern type: ${config.pattern}`);
        }
    }

    /**
     * Export texture config as JSON
     */
    static exportConfig(config: TextureConfig): string {
        return JSON.stringify(config, null, 2);
    }

    /**
     * Import texture config from JSON
     */
    static importConfig(json: string): TextureConfig {
        return JSON.parse(json);
    }
}
