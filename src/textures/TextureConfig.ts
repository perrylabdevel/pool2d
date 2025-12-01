export type TextureType =
    | 'felt'
    | 'rail'
    | 'cue'
    | 'pocket';

export type PatternType =
    | 'weave'
    | 'wood_grain'
    | 'marble'
    | 'metallic'
    | 'geometric'
    | 'noise';

export interface TextureConfig {
    type: TextureType;
    pattern: PatternType;
    width: number;
    height: number;
    seed?: number;
    params: Record<string, any>; // Pattern-specific parameters
}

// Preset configs
export const TEXTURE_PRESETS: Record<string, TextureConfig> = {
    felt_green_classic: {
        type: 'felt',
        pattern: 'weave',
        width: 512,
        height: 512,
        seed: 42,
        params: {
            baseColor: '#228B22',
            threadDensity: 1.5,
            roughness: 0.3,
            brightness: 1.0
        }
    },

    felt_blue_tournament: {
        type: 'felt',
        pattern: 'weave',
        width: 512,
        height: 512,
        seed: 43,
        params: {
            baseColor: '#1E90FF',
            threadDensity: 2.0,
            roughness: 0.2,
            brightness: 1.1
        }
    },

    rail_oak: {
        type: 'rail',
        pattern: 'wood_grain',
        width: 256,
        height: 256,
        seed: 10,
        params: {
            baseColor: '#D2691E',
            grainColor: '#8B4513',
            grainScale: 20,
            ringSpacing: 40,
            knotDensity: 0.05
        }
    },

    rail_marble_white: {
        type: 'rail',
        pattern: 'marble',
        width: 256,
        height: 256,
        seed: 20,
        params: {
            baseColor: '#FFFFFF',
            veinColor: '#888888',
            veinDensity: 0.5,
            veinContrast: 1.5,
            turbulence: 0.7
        }
    },

    rail_metallic_brushed: {
        type: 'rail',
        pattern: 'metallic',
        width: 256,
        height: 256,
        seed: 30,
        params: {
            baseColor: '#A0A0A0',
            roughness: 0.4,
            metalness: 0.9,
            brushDirection: 45,
            noiseScale: 60
        }
    },

    felt_geometric_checker: {
        type: 'felt',
        pattern: 'geometric',
        width: 512,
        height: 512,
        seed: 40,
        params: {
            type: 'checker',
            color1: '#228B22',
            color2: '#1E701E',
            scale: 64,
            rotation: 0
        }
    }
};
