/**
 * TableAppearance - Unified settings for all table visual customization
 * Clean, intuitive interface for felt, frame, cushion, and pocket appearance
 */

export type FeltPattern = 'solid' | 'weave' | 'worn';
export type FrameMaterial = 'oak' | 'mahogany' | 'ebony' | 'walnut' | 'metal' | 'marble';
export type PocketStyle = 'leather' | 'chrome' | 'brass';

export interface FeltAppearance {
  color: string;           // Hex color
  pattern: FeltPattern;
  roughness: number;       // 0-1, affects texture noise
  tileScale: number;       // 1-8, texture repeat count
}

export interface FrameAppearance {
  color: string;           // Hex color
  material: FrameMaterial;
  grainAngle: number;      // 0-90 degrees
  glossiness: number;      // 0-1
}

export interface CushionAppearance {
  color: string;           // Hex color
  glossiness: number;      // 0-1
}

export interface PocketAppearance {
  color: string;           // Pocket interior color
  rimColor: string;        // Pocket rim/edge color
  style: PocketStyle;
}

export interface TableAppearance {
  felt: FeltAppearance;
  frame: FrameAppearance;
  cushion: CushionAppearance;
  pocket: PocketAppearance;
}

// Default appearance - Classic green tournament table
export const DEFAULT_TABLE_APPEARANCE: TableAppearance = {
  felt: {
    color: '#0a5f0a',
    pattern: 'weave',
    roughness: 0.3,
    tileScale: 4,
  },
  frame: {
    color: '#3d2413',
    material: 'mahogany',
    grainAngle: 0,
    glossiness: 0.6,
  },
  cushion: {
    color: '#2d1810',
    glossiness: 0.4,
  },
  pocket: {
    color: '#1a1a1a',
    rimColor: '#8b4513',
    style: 'leather',
  },
};

// Pre-built themes for one-click styling
export interface TableTheme {
  name: string;
  description: string;
  appearance: TableAppearance;
  preview?: string; // Optional preview image URL
}

export const TABLE_THEMES: Record<string, TableTheme> = {
  classic: {
    name: 'Classic Green',
    description: 'Traditional tournament green felt with mahogany frame',
    appearance: { ...DEFAULT_TABLE_APPEARANCE },
  },
  tournament_blue: {
    name: 'Tournament Blue',
    description: 'Professional blue felt used in major championships',
    appearance: {
      felt: { color: '#1e4d7b', pattern: 'weave', roughness: 0.25, tileScale: 4 },
      frame: { color: '#2d1810', material: 'walnut', grainAngle: 0, glossiness: 0.7 },
      cushion: { color: '#1a1208', glossiness: 0.5 },
      pocket: { color: '#0d0d0d', rimColor: '#5c3a21', style: 'leather' },
    },
  },
  burgundy: {
    name: 'Burgundy Elegance',
    description: 'Rich burgundy felt with dark ebony frame',
    appearance: {
      felt: { color: '#722f37', pattern: 'weave', roughness: 0.35, tileScale: 4 },
      frame: { color: '#1a1a1a', material: 'ebony', grainAngle: 15, glossiness: 0.8 },
      cushion: { color: '#0f0808', glossiness: 0.6 },
      pocket: { color: '#0a0a0a', rimColor: '#333333', style: 'chrome' },
    },
  },
  modern_grey: {
    name: 'Modern Grey',
    description: 'Contemporary grey felt with brushed metal frame',
    appearance: {
      felt: { color: '#4a4a4a', pattern: 'solid', roughness: 0.2, tileScale: 3 },
      frame: { color: '#888888', material: 'metal', grainAngle: 45, glossiness: 0.9 },
      cushion: { color: '#333333', glossiness: 0.7 },
      pocket: { color: '#1a1a1a', rimColor: '#666666', style: 'chrome' },
    },
  },
  vintage: {
    name: 'Vintage',
    description: 'Worn green felt with classic oak frame',
    appearance: {
      felt: { color: '#2d5a27', pattern: 'worn', roughness: 0.5, tileScale: 5 },
      frame: { color: '#8b6914', material: 'oak', grainAngle: 0, glossiness: 0.4 },
      cushion: { color: '#3d2b1f', glossiness: 0.3 },
      pocket: { color: '#1a1208', rimColor: '#6b4423', style: 'brass' },
    },
  },
  midnight: {
    name: 'Midnight',
    description: 'Dark navy felt with sleek black frame',
    appearance: {
      felt: { color: '#1a1a2e', pattern: 'solid', roughness: 0.3, tileScale: 4 },
      frame: { color: '#0d0d0d', material: 'ebony', grainAngle: 0, glossiness: 0.85 },
      cushion: { color: '#0a0a0a', glossiness: 0.6 },
      pocket: { color: '#050505', rimColor: '#1a1a1a', style: 'chrome' },
    },
  },
  caramel: {
    name: 'Caramel',
    description: 'Warm caramel felt with light oak accents',
    appearance: {
      felt: { color: '#c68642', pattern: 'weave', roughness: 0.35, tileScale: 4 },
      frame: { color: '#deb887', material: 'oak', grainAngle: 10, glossiness: 0.5 },
      cushion: { color: '#8b4513', glossiness: 0.4 },
      pocket: { color: '#3d2817', rimColor: '#a0522d', style: 'leather' },
    },
  },
  arctic: {
    name: 'Arctic',
    description: 'Cool white felt with marble frame',
    appearance: {
      felt: { color: '#e8e8e8', pattern: 'solid', roughness: 0.15, tileScale: 3 },
      frame: { color: '#f5f5f5', material: 'marble', grainAngle: 30, glossiness: 0.95 },
      cushion: { color: '#cccccc', glossiness: 0.8 },
      pocket: { color: '#999999', rimColor: '#d4d4d4', style: 'chrome' },
    },
  },
};
