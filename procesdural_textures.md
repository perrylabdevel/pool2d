# Procedural Texture System Implementation Guide

**Version**: 1.0
**Target**: Add procedural texture generation for all pool elements
**Estimated effort**: 12-16 hours (solo dev)
**Dependencies**: None (uses Canvas 2D API)

---

## Overview

Build a **procedural texture system** that generates realistic, customizable textures for:
- **Table felt** (noise, weave patterns, grain)
- **Rails** (wood grain, marble, metal, custom patterns)
- **Cues** (wood grain, wraps, inlays)
- **Pockets** (leather, metal, fabric)

**Key features**:
- Real-time texture editor with live preview
- Noise-based algorithms (Perlin, Simplex, Voronoi)
- Layered compositing (blend modes, opacity)
- Export/import texture configs (JSON)
- No external image files required (fully procedural)
- Performance: Pre-render to offscreen canvas, cache aggressively

**Why procedural?**
- ✅ Infinite variety (customize every element)
- ✅ Small bundle size (no image assets)
- ✅ Consistent art style (algorithmic generation)
- ✅ User-generated content (share texture configs)
- ✅ Responsive (generate textures at any resolution)

---

## Architecture

### High-Level Flow

```
User opens Texture Editor
  ↓
Select element (felt, rail, etc.)
  ↓
Choose base pattern (noise, weave, wood grain, etc.)
  ↓
Adjust parameters (color, scale, roughness, etc.)
  ↓
Live preview updates in real-time
  ↓
Save texture config to localStorage
  ↓
Apply to game (re-render elements with new textures)
```

### Component Structure

```
src/textures/
├── TextureGenerator.ts       # Main API for generating textures
├── patterns/
│   ├── NoisePattern.ts       # Perlin/Simplex noise
│   ├── WeavePattern.ts       # Fabric/felt weave
│   ├── WoodGrainPattern.ts   # Realistic wood
│   ├── MarblePattern.ts      # Marble/stone
│   ├── MetallicPattern.ts    # Brushed metal, anodized
│   └── GeometricPattern.ts   # Stripes, checkers, dots
├── effects/
│   ├── NormalMap.ts          # Pseudo 3D lighting
│   ├── SpecularMap.ts        # Shine/reflection
│   └── Distortion.ts         # Warp, ripple effects
├── compositing/
│   └── LayerBlender.ts       # Blend multiple patterns
├── noise/
│   ├── PerlinNoise.ts        # Classic Perlin noise
│   ├── SimplexNoise.ts       # Faster, no artifacts
│   └── VoronoiNoise.ts       # Cellular patterns
└── ui/
    └── TextureEditor.ts       # UI for editing textures
```

---

## File Structure

### New Files

```
src/textures/
├── TextureGenerator.ts        # Main texture API
├── TextureConfig.ts           # Type definitions
├── TextureCache.ts            # Cache for performance
├── patterns/
│   ├── BasePattern.ts         # Abstract base class
│   ├── NoisePattern.ts
│   ├── WeavePattern.ts
│   ├── WoodGrainPattern.ts
│   ├── MarblePattern.ts
│   ├── MetallicPattern.ts
│   └── GeometricPattern.ts
├── noise/
│   ├── PerlinNoise.ts
│   ├── SimplexNoise.ts
│   └── VoronoiNoise.ts
├── effects/
│   ├── NormalMap.ts
│   ├── SpecularMap.ts
│   └── Distortion.ts
├── compositing/
│   └── LayerBlender.ts
└── ui/
    └── TextureEditor.ts
```

### Modified Files

```
src/render/Renderer.ts         # Use procedural textures instead of solid colors
src/config.ts                  # Add texture config section
src/ui/HUD.ts                  # Add "Edit Textures" button
```

### Asset Files (Optional)

```
public/textures/
├── presets/
│   ├── felt_green_classic.json
│   ├── felt_blue_tournament.json
│   ├── rail_oak.json
│   ├── rail_mahogany.json
└── user/
    └── my_custom_table.json    # User-saved textures
```

---

## Implementation Order

### **Step 1: Noise Algorithms** (Foundation)
**Why first**: All procedural patterns need noise as building block

**What to build**:
- Perlin noise (classic, smooth)
- Simplex noise (faster, better for animation)
- Voronoi noise (cellular, organic)

**Where**: `src/textures/noise/`

---

#### **1.1 Perlin Noise**

**File**: `src/textures/noise/PerlinNoise.ts`

**Interface**:
```typescript
export class PerlinNoise {
  /**
   * Generate 2D Perlin noise
   * @param x - X coordinate
   * @param y - Y coordinate
   * @returns Value in range [-1, 1]
   */
  static noise2D(x: number, y: number): number;

  /**
   * Octave noise (multiple frequencies layered)
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param octaves - Number of layers (1-8, more = more detail)
   * @param persistence - How much each octave contributes (0.5 = halve each layer)
   * @returns Value in range [-1, 1]
   */
  static octaveNoise2D(
    x: number,
    y: number,
    octaves: number,
    persistence: number
  ): number;
}
```

**Implementation**:
```typescript
// src/textures/noise/PerlinNoise.ts

export class PerlinNoise {
  private static permutation: number[] = [];
  private static initialized = false;

  static initialize(seed: number = 0): void {
    // Generate permutation table (for repeatability)
    const p = [];
    for (let i = 0; i < 256; i++) p[i] = i;

    // Shuffle based on seed
    const random = this.seededRandom(seed);
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }

    // Duplicate to avoid overflow
    this.permutation = [...p, ...p];
    this.initialized = true;
  }

  static noise2D(x: number, y: number): number {
    if (!this.initialized) this.initialize();

    // Find unit grid cell
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;

    // Relative position within cell
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);

    // Fade curves (6t^5 - 15t^4 + 10t^3)
    const u = this.fade(xf);
    const v = this.fade(yf);

    // Hash coordinates of 4 corners
    const aa = this.permutation[this.permutation[xi] + yi];
    const ab = this.permutation[this.permutation[xi] + yi + 1];
    const ba = this.permutation[this.permutation[xi + 1] + yi];
    const bb = this.permutation[this.permutation[xi + 1] + yi + 1];

    // Blend results from 4 corners
    const x1 = this.lerp(
      this.grad2D(aa, xf, yf),
      this.grad2D(ba, xf - 1, yf),
      u
    );
    const x2 = this.lerp(
      this.grad2D(ab, xf, yf - 1),
      this.grad2D(bb, xf - 1, yf - 1),
      u
    );

    return this.lerp(x1, x2, v);
  }

  static octaveNoise2D(
    x: number,
    y: number,
    octaves: number = 4,
    persistence: number = 0.5
  ): number {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      total += this.noise2D(x * frequency, y * frequency) * amplitude;

      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= 2;
    }

    return total / maxValue; // Normalize to [-1, 1]
  }

  private static fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private static lerp(a: number, b: number, t: number): number {
    return a + t * (b - a);
  }

  private static grad2D(hash: number, x: number, y: number): number {
    // Convert low 2 bits of hash into gradient vector
    const h = hash & 3;
    const u = h < 2 ? x : y;
    const v = h < 2 ? y : x;
    return ((h & 1) ? -u : u) + ((h & 2) ? -2 * v : 2 * v);
  }

  private static seededRandom(seed: number): () => number {
    let s = seed;
    return () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
  }
}
```

**Testing**:
```typescript
// Quick visual test
const canvas = document.createElement('canvas');
canvas.width = 256;
canvas.height = 256;
const ctx = canvas.getContext('2d')!;

PerlinNoise.initialize(42);

for (let y = 0; y < 256; y++) {
  for (let x = 0; x < 256; x++) {
    const noise = PerlinNoise.octaveNoise2D(x / 32, y / 32, 4, 0.5);
    const gray = Math.floor((noise + 1) * 127.5); // Map [-1,1] to [0,255]
    ctx.fillStyle = `rgb(${gray}, ${gray}, ${gray})`;
    ctx.fillRect(x, y, 1, 1);
  }
}

document.body.appendChild(canvas); // Should show cloudy noise
```

---

#### **1.2 Simplex Noise** (Optional, faster alternative)

**File**: `src/textures/noise/SimplexNoise.ts`

```typescript
// Implementation available at:
// https://github.com/jwagner/simplex-noise.js
// Can copy or install as dependency

import { createNoise2D } from 'simplex-noise';

export class SimplexNoise {
  private static noise2D = createNoise2D();

  static noise(x: number, y: number): number {
    return this.noise2D(x, y); // Already returns [-1, 1]
  }

  static octaveNoise(
    x: number,
    y: number,
    octaves: number = 4,
    persistence: number = 0.5
  ): number {
    // Same octave logic as Perlin
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      total += this.noise(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= 2;
    }

    return total / maxValue;
  }
}
```

---

#### **1.3 Voronoi Noise** (Cellular patterns)

**File**: `src/textures/noise/VoronoiNoise.ts`

```typescript
export class VoronoiNoise {
  /**
   * Generate Voronoi (cellular) noise
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param cellSize - Size of each cell (larger = bigger cells)
   * @returns Distance to nearest cell center [0, 1]
   */
  static noise2D(x: number, y: number, cellSize: number = 1): number {
    const cellX = Math.floor(x / cellSize);
    const cellY = Math.floor(y / cellSize);

    let minDist = Infinity;

    // Check 3x3 neighborhood of cells
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = cellX + dx;
        const ny = cellY + dy;

        // Get point in this cell (seeded by cell coords)
        const point = this.cellPoint(nx, ny, cellSize);

        // Distance to this point
        const dist = Math.sqrt(
          (x - point.x) ** 2 + (y - point.y) ** 2
        );

        minDist = Math.min(minDist, dist);
      }
    }

    // Normalize (cellSize is max possible distance)
    return minDist / cellSize;
  }

  private static cellPoint(cx: number, cy: number, cellSize: number) {
    // Pseudo-random point in cell
    const hash = this.hash2D(cx, cy);
    const px = (cx + hash % 1000 / 1000) * cellSize;
    const py = (cy + (hash / 1000) % 1000 / 1000) * cellSize;
    return { x: px, y: py };
  }

  private static hash2D(x: number, y: number): number {
    // Simple hash function
    return ((x * 73856093) ^ (y * 19349663)) >>> 0;
  }
}
```

---

### **Step 2: Pattern Generators** (Building Blocks)

**Why second**: Use noise to create recognizable patterns

**What to build**:
- Weave pattern (felt texture)
- Wood grain (rails, cues)
- Marble (decorative rails)
- Metallic (modern rails)
- Geometric (stripes, dots)

**Where**: `src/textures/patterns/`

---

#### **2.1 Base Pattern Class**

**File**: `src/textures/patterns/BasePattern.ts`

```typescript
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
```

---

#### **2.2 Weave Pattern** (Felt texture)

**File**: `src/textures/patterns/WeavePattern.ts`

```typescript
import { BasePattern, PatternConfig } from './BasePattern';
import { PerlinNoise } from '../noise/PerlinNoise';

export interface WeaveConfig extends PatternConfig {
  baseColor: string;      // e.g., '#228B22' (green)
  threadDensity: number;  // 0.5 = loose, 2.0 = tight
  roughness: number;      // 0-1 (noise intensity)
  brightness: number;     // 0.8-1.2 (lighting variation)
}

export class WeavePattern extends BasePattern {
  private config: WeaveConfig;

  constructor(config: WeaveConfig) {
    super(config);
    this.config = config;
  }

  generate(): HTMLCanvasElement {
    PerlinNoise.initialize(this.config.seed || 0);

    const imageData = this.getImageData();
    const data = imageData.data;
    const { width, height } = this.canvas;

    // Parse base color
    const base = this.hexToRgb(this.config.baseColor);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;

        // Weave pattern (cross-hatching)
        const warpThread = Math.sin(x * this.config.threadDensity * 0.1) * 0.5 + 0.5;
        const weftThread = Math.sin(y * this.config.threadDensity * 0.1) * 0.5 + 0.5;
        const weave = (warpThread + weftThread) / 2;

        // Add noise for texture
        const noise = PerlinNoise.octaveNoise2D(
          x / 50,
          y / 50,
          4,
          0.5
        ) * this.config.roughness;

        // Brightness variation
        const brightness = this.config.brightness + noise * 0.2;

        // Combine weave + noise
        const luminance = weave * 0.5 + 0.5 + noise;

        // Apply to base color
        data[i]     = Math.floor(base.r * luminance * brightness); // R
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
```

**Usage**:
```typescript
const felt = new WeavePattern({
  width: 512,
  height: 512,
  baseColor: '#228B22',
  threadDensity: 1.5,
  roughness: 0.3,
  brightness: 1.0,
  seed: 42
});

const canvas = felt.generate();
document.body.appendChild(canvas); // Green felt texture
```

---

#### **2.3 Wood Grain Pattern** (Rails, cues)

**File**: `src/textures/patterns/WoodGrainPattern.ts`

```typescript
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
  private config: WoodGrainConfig;

  constructor(config: WoodGrainConfig) {
    super(config);
    this.config = config;
  }

  generate(): HTMLCanvasElement {
    PerlinNoise.initialize(this.config.seed || 0);

    const imageData = this.getImageData();
    const data = imageData.data;
    const { width, height } = this.canvas;

    const base = this.hexToRgb(this.config.baseColor);
    const grain = this.hexToRgb(this.config.grainColor);

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
          (distance + knotInfluence * 50) / this.config.ringSpacing
        ) * 0.5 + 0.5;

        // Fine grain (vertical lines with noise)
        const grainNoise = PerlinNoise.octaveNoise2D(
          x / this.config.grainScale,
          y / this.config.grainScale,
          4,
          0.5
        );

        const grainPattern = Math.sin(
          (x + grainNoise * 20) / this.config.grainScale
        ) * 0.5 + 0.5;

        // Combine ring + grain
        const t = ring * 0.6 + grainPattern * 0.4;

        // Lerp between base and grain color
        const r = Math.floor(base.r + (grain.r - base.r) * t);
        const g = Math.floor(base.g + (grain.g - base.g) * t);
        const b = Math.floor(base.b + (grain.b - base.b) * t);

        data[i]     = r;
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
    const count = Math.floor(width * height * this.config.knotDensity / 10000);

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
```

---

#### **2.4 Marble Pattern**

**File**: `src/textures/patterns/MarblePattern.ts`

```typescript
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
  private config: MarbleConfig;

  constructor(config: MarbleConfig) {
    super(config);
    this.config = config;
  }

  generate(): HTMLCanvasElement {
    PerlinNoise.initialize(this.config.seed || 0);

    const imageData = this.getImageData();
    const data = imageData.data;
    const { width, height } = this.canvas;

    const base = this.hexToRgb(this.config.baseColor);
    const vein = this.hexToRgb(this.config.veinColor);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;

        // Turbulent marble veins
        const turbulence = PerlinNoise.octaveNoise2D(
          x / 100,
          y / 100,
          6,
          0.5
        ) * this.config.turbulence * 50;

        const veinPattern = Math.sin(
          (x + turbulence) / 30 * this.config.veinDensity
        ) * 0.5 + 0.5;

        // High contrast for veins
        const t = Math.pow(veinPattern, this.config.veinContrast);

        // Lerp between vein and base
        const r = Math.floor(vein.r + (base.r - vein.r) * t);
        const g = Math.floor(vein.g + (base.g - vein.g) * t);
        const b = Math.floor(vein.b + (base.b - vein.b) * t);

        data[i]     = r;
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
```

---


**File**: `src/textures/patterns/GeometricPattern.ts`

```typescript
import { BasePattern, PatternConfig } from './BasePattern';

export interface GeometricConfig extends PatternConfig {
  type: 'stripes' | 'dots' | 'checkerboard';
  color1: string;
  color2: string;
  scale: number; // Size of elements
}

export class GeometricPattern extends BasePattern {
  private config: GeometricConfig;

  constructor(config: GeometricConfig) {
    super(config);
    this.config = config;
  }

  generate(): HTMLCanvasElement {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    switch (this.config.type) {
      case 'stripes':
        this.generateStripes();
        break;
      case 'dots':
        this.generateDots();
        break;
      case 'checkerboard':
        this.generateCheckerboard();
        break;
    }

    return this.canvas;
  }

  private generateStripes(): void {
    const { width, height } = this.canvas;
    const stripeWidth = this.config.scale;

    for (let x = 0; x < width; x += stripeWidth * 2) {
      this.ctx.fillStyle = this.config.color1;
      this.ctx.fillRect(x, 0, stripeWidth, height);

      this.ctx.fillStyle = this.config.color2;
      this.ctx.fillRect(x + stripeWidth, 0, stripeWidth, height);
    }
  }

  private generateDots(): void {
    // ... implement dot pattern ...
  }

  private generateCheckerboard(): void {
    // ... implement checkerboard ...
  }
}
```

---

### **Step 3: Texture Generator** (Main API)

**Why third**: Unified interface for generating all textures

**What to build**:
- High-level API for requesting textures
- Texture cache (avoid regenerating)
- Export/import configs

**Where**: `src/textures/TextureGenerator.ts`

---

#### **3.1 Type Definitions**

**File**: `src/textures/TextureConfig.ts`

```typescript
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
  }
};
```

---

#### **3.2 Texture Generator**

**File**: `src/textures/TextureGenerator.ts`

```typescript
import { TextureConfig, PatternType } from './TextureConfig';
import { WeavePattern } from './patterns/WeavePattern';
import { WoodGrainPattern } from './patterns/WoodGrainPattern';
import { MarblePattern } from './patterns/MarblePattern';
import { BasePattern } from './patterns/BasePattern';

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
        return new WeavePattern(baseConfig);

      case 'wood_grain':
        return new WoodGrainPattern(baseConfig);

      case 'marble':
        return new MarblePattern(baseConfig);

      // case 'metallic':
      //   return new MetallicPattern(baseConfig);

      // case 'geometric':
      //   return new GeometricPattern(baseConfig);

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
```

---

#### **3.3 Texture Cache** (Performance optimization)

**File**: `src/textures/TextureCache.ts`

```typescript
import { TextureConfig } from './TextureConfig';
import { TextureGenerator } from './TextureGenerator';

export class TextureCache {
  private static cache = new Map<string, HTMLCanvasElement>();

  /**
   * Get texture (from cache if available, generate if not)
   */
  static get(config: TextureConfig): HTMLCanvasElement {
    const key = this.generateKey(config);

    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    // Generate and cache
    const texture = TextureGenerator.generate(config);
    this.cache.set(key, texture);

    return texture;
  }

  /**
   * Clear cache (call when user changes textures)
   */
  static clear(): void {
    this.cache.clear();
  }

  /**
   * Generate cache key from config
   */
  private static generateKey(config: TextureConfig): string {
    return JSON.stringify(config);
  }

  /**
   * Get cache statistics (for debugging)
   */
  static getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}
```

---

### **Step 4: Texture Editor UI** (User Interface)

**Why fourth**: Allow users to customize textures

**What to build**:
- Modal dialog with live preview
- Sliders for all parameters
- Preset selector
- Export/import buttons
- Apply to game

**Where**: `src/textures/ui/TextureEditor.ts`

---

#### **4.1 Texture Editor**

**File**: `src/textures/ui/TextureEditor.ts`

```typescript
import { TextureConfig, TEXTURE_PRESETS } from '../TextureConfig';
import { TextureGenerator } from '../TextureGenerator';

export class TextureEditor {
  private container: HTMLDivElement;
  private preview: HTMLCanvasElement;
  private currentConfig: TextureConfig;
  private onApply: (config: TextureConfig) => void;

  constructor(onApply: (config: TextureConfig) => void) {
    this.onApply = onApply;
    this.currentConfig = TEXTURE_PRESETS.felt_green_classic;
    this.createUI();
  }

  show(): void {
    this.container.style.display = 'block';
    this.updatePreview();
  }

  hide(): void {
    this.container.style.display = 'none';
  }

  private createUI(): void {
    // Main container
    this.container = document.createElement('div');
    this.container.id = 'texture-editor';
    this.container.className = 'modal';

    this.container.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>Texture Editor</h2>
          <button class="close-btn">&times;</button>
        </div>

        <div class="modal-body">
          <!-- Left panel: Controls -->
          <div class="controls-panel">
            <h3>Presets</h3>
            <select id="preset-selector">
              ${Object.keys(TEXTURE_PRESETS).map(key =>
                `<option value="${key}">${this.formatName(key)}</option>`
              ).join('')}
            </select>

            <h3>Pattern Type</h3>
            <select id="pattern-selector">
              <option value="weave">Weave</option>
              <option value="wood_grain">Wood Grain</option>
              <option value="marble">Marble</option>
              <option value="metallic">Metallic</option>
            </select>

            <h3>Parameters</h3>
            <div id="param-controls">
              <!-- Dynamically populated based on pattern -->
            </div>

            <div class="button-group">
              <button id="export-btn">Export JSON</button>
              <button id="import-btn">Import JSON</button>
              <button id="reset-btn">Reset</button>
            </div>
          </div>

          <!-- Right panel: Preview -->
          <div class="preview-panel">
            <h3>Preview</h3>
            <canvas id="texture-preview" width="512" height="512"></canvas>
            <div class="preview-info">
              <span id="preview-size">512x512</span>
              <span id="preview-time">0ms</span>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button id="apply-btn" class="btn-primary">Apply to Game</button>
          <button id="cancel-btn">Cancel</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.container);

    // Cache elements
    this.preview = document.getElementById('texture-preview') as HTMLCanvasElement;

    // Attach event listeners
    this.attachEventListeners();
  }

  private attachEventListeners(): void {
    // Close button
    this.container.querySelector('.close-btn')!.addEventListener('click', () => {
      this.hide();
    });

    // Preset selector
    document.getElementById('preset-selector')!.addEventListener('change', (e) => {
      const presetKey = (e.target as HTMLSelectElement).value;
      this.currentConfig = TEXTURE_PRESETS[presetKey];
      this.updateParameterControls();
      this.updatePreview();
    });

    // Pattern selector
    document.getElementById('pattern-selector')!.addEventListener('change', (e) => {
      this.currentConfig.pattern = (e.target as HTMLSelectElement).value as any;
      this.updateParameterControls();
      this.updatePreview();
    });

    // Apply button
    document.getElementById('apply-btn')!.addEventListener('click', () => {
      this.onApply(this.currentConfig);
      this.hide();
    });

    // Cancel button
    document.getElementById('cancel-btn')!.addEventListener('click', () => {
      this.hide();
    });

    // Export button
    document.getElementById('export-btn')!.addEventListener('click', () => {
      this.exportConfig();
    });

    // Import button
    document.getElementById('import-btn')!.addEventListener('click', () => {
      this.importConfig();
    });
  }

  private updateParameterControls(): void {
    const container = document.getElementById('param-controls')!;
    container.innerHTML = '';

    // Generate sliders for each parameter
    for (const [key, value] of Object.entries(this.currentConfig.params)) {
      const control = this.createParameterControl(key, value);
      container.appendChild(control);
    }
  }

  private createParameterControl(key: string, value: any): HTMLDivElement {
    const div = document.createElement('div');
    div.className = 'param-control';

    if (typeof value === 'number') {
      // Number slider
      div.innerHTML = `
        <label>${this.formatName(key)}</label>
        <input
          type="range"
          id="param-${key}"
          min="0"
          max="2"
          step="0.1"
          value="${value}"
        />
        <span class="param-value">${value.toFixed(2)}</span>
      `;

      const slider = div.querySelector('input') as HTMLInputElement;
      const valueSpan = div.querySelector('.param-value') as HTMLSpanElement;

      slider.addEventListener('input', (e) => {
        const newValue = parseFloat((e.target as HTMLInputElement).value);
        valueSpan.textContent = newValue.toFixed(2);
        this.currentConfig.params[key] = newValue;
        this.updatePreview();
      });

    } else if (typeof value === 'string' && value.startsWith('#')) {
      // Color picker
      div.innerHTML = `
        <label>${this.formatName(key)}</label>
        <input
          type="color"
          id="param-${key}"
          value="${value}"
        />
      `;

      const colorPicker = div.querySelector('input') as HTMLInputElement;
      colorPicker.addEventListener('input', (e) => {
        this.currentConfig.params[key] = (e.target as HTMLInputElement).value;
        this.updatePreview();
      });
    }

    return div;
  }

  private updatePreview(): void {
    const start = performance.now();

    // Generate texture
    const texture = TextureGenerator.generate(this.currentConfig);

    // Draw to preview canvas
    const ctx = this.preview.getContext('2d')!;
    ctx.clearRect(0, 0, this.preview.width, this.preview.height);
    ctx.drawImage(texture, 0, 0);

    const time = performance.now() - start;
    document.getElementById('preview-time')!.textContent = `${time.toFixed(0)}ms`;
  }

  private formatName(key: string): string {
    return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  private exportConfig(): void {
    const json = TextureGenerator.exportConfig(this.currentConfig);

    // Copy to clipboard
    navigator.clipboard.writeText(json);

    // Also download as file
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'texture_config.json';
    a.click();

    alert('Config exported to clipboard and downloaded!');
  }

  private importConfig(): void {
    const json = prompt('Paste texture config JSON:');
    if (!json) return;

    try {
      this.currentConfig = TextureGenerator.importConfig(json);
      this.updateParameterControls();
      this.updatePreview();
      alert('Config imported successfully!');
    } catch (e) {
      alert('Invalid JSON: ' + e);
    }
  }
}
```

---

#### **4.2 CSS for Texture Editor**

**File**: `styles/texture-editor.css`

```css
#texture-editor.modal {
  display: none;
  position: fixed;
  z-index: 1000;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.7);
}

.modal-content {
  background-color: #1a1a1a;
  color: #fff;
  margin: 5% auto;
  width: 90%;
  max-width: 1200px;
  border-radius: 10px;
  box-shadow: 0 10px 50px rgba(0, 0, 0, 0.5);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #333;
}

.modal-header h2 {
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  color: #fff;
  font-size: 32px;
  cursor: pointer;
}

.modal-body {
  display: flex;
  gap: 20px;
  padding: 20px;
}

.controls-panel {
  flex: 1;
  max-width: 400px;
}

.preview-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

#texture-preview {
  border: 2px solid #333;
  border-radius: 5px;
  max-width: 100%;
  height: auto;
}

.preview-info {
  margin-top: 10px;
  display: flex;
  gap: 20px;
  color: #888;
  font-size: 14px;
}

.param-control {
  margin-bottom: 20px;
}

.param-control label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
}

.param-control input[type="range"] {
  width: 100%;
}

.param-control input[type="color"] {
  width: 100%;
  height: 40px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
}

.param-value {
  display: inline-block;
  min-width: 50px;
  text-align: right;
  color: #888;
}

.button-group {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.button-group button {
  flex: 1;
  padding: 10px;
  background-color: #333;
  color: #fff;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.button-group button:hover {
  background-color: #444;
}

.modal-footer {
  padding: 20px;
  border-top: 1px solid #333;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.btn-primary {
  padding: 12px 24px;
  background-color: #228B22;
  color: #fff;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 16px;
  font-weight: bold;
}

.btn-primary:hover {
  background-color: #1a6b1a;
}

select {
  width: 100%;
  padding: 10px;
  background-color: #2a2a2a;
  color: #fff;
  border: 1px solid #444;
  border-radius: 5px;
  margin-bottom: 20px;
}
```

---

### **Step 5: Integration with Game** (Apply textures)

**Why last**: Plug procedural textures into existing renderer

**What to change**:
- Use procedural textures instead of solid colors
- Add "Edit Textures" button to HUD
- Save texture configs to localStorage

**Where**: `src/render/Renderer.ts`, `src/ui/HUD.ts`

---

#### **5.1 Modify Renderer**

**File**: `src/render/Renderer.ts`

```typescript
// Add imports
import { TextureCache } from '../textures/TextureCache';
import { TextureConfig, TEXTURE_PRESETS } from '../textures/TextureConfig';

export class Renderer {
  private feltTexture: HTMLCanvasElement | null = null;
  private railTexture: HTMLCanvasElement | null = null;

  constructor() {
    // Load default textures
    this.loadDefaultTextures();
  }

  private loadDefaultTextures(): void {
    // Load from localStorage or use defaults
    const feltConfig = this.loadTextureConfig('felt') || TEXTURE_PRESETS.felt_green_classic;
    const railConfig = this.loadTextureConfig('rail') || TEXTURE_PRESETS.rail_oak;

    this.feltTexture = TextureCache.get(feltConfig);
    this.railTexture = TextureCache.get(railConfig);
  }

  /**
   * Apply new texture (called from texture editor)
   */
  applyTexture(type: 'felt' | 'rail', config: TextureConfig): void {
    TextureCache.clear(); // Clear cache to force regeneration

    if (type === 'felt') {
      this.feltTexture = TextureCache.get(config);
    } else if (type === 'rail') {
      this.railTexture = TextureCache.get(config);
    }

    // Save to localStorage
    this.saveTextureConfig(type, config);
  }

  private drawTable(): void {
    const ctx = this.ctx;

    // Draw felt (textured instead of solid color)
    if (this.feltTexture) {
      const pattern = ctx.createPattern(this.feltTexture, 'repeat')!;
      ctx.fillStyle = pattern;
    } else {
      ctx.fillStyle = CONFIG.TABLE_COLOR; // Fallback
    }
    ctx.fillRect(-50, -25, 100, 50);

    // Draw rails (textured)
    if (this.railTexture) {
      const pattern = ctx.createPattern(this.railTexture, 'repeat')!;
      ctx.fillStyle = pattern;
    } else {
      ctx.fillStyle = CONFIG.RAIL_COLOR; // Fallback
    }
    // ... draw rails ...
  }

  private saveTextureConfig(type: string, config: TextureConfig): void {
    localStorage.setItem(`texture_${type}`, JSON.stringify(config));
  }

  private loadTextureConfig(type: string): TextureConfig | null {
    const json = localStorage.getItem(`texture_${type}`);
    return json ? JSON.parse(json) : null;
  }
}
```

---

#### **5.2 Add Button to HUD**

**File**: `src/ui/HUD.ts`

```typescript
import { TextureEditor } from '../textures/ui/TextureEditor';

export class HUD {
  private textureEditor: TextureEditor;

  constructor(private renderer: Renderer) {
    this.createTextureButton();

    this.textureEditor = new TextureEditor((config) => {
      this.renderer.applyTexture(config.type as any, config);
    });
  }

  private createTextureButton(): void {
    const btn = document.createElement('button');
    btn.id = 'edit-textures-btn';
    btn.textContent = '🎨 Edit Textures';
    btn.addEventListener('click', () => {
      this.textureEditor.show();
    });

    document.getElementById('controls')?.appendChild(btn);
  }
}
```

---

## Summary Checklist

**Before implementing**:
- [ ] Understand noise algorithms (Perlin, Simplex, Voronoi)
- [ ] Study procedural pattern techniques
- [ ] Review Canvas 2D API (ImageData, patterns, blend modes)

**Implementation order**:
1. ✅ Noise algorithms (Perlin, Simplex, Voronoi)
2. ✅ Pattern generators (Weave, WoodGrain, Marble, Geometric)
3. ✅ TextureGenerator + TextureCache
4. ✅ TextureEditor UI
5. ✅ Integration with Renderer + HUD

**Estimated time**:
- Noise algorithms: 2-3 hours
- Pattern generators: 4-6 hours (1-2 hours each)
- TextureGenerator + Cache: 1-2 hours
- TextureEditor UI: 3-4 hours
- Integration: 1-2 hours
- **Total**: 12-16 hours

---

## Performance Tips

1. **Pre-generate textures at startup** (don't generate every frame)
2. **Use offscreen canvas** for generation (doesn't block main thread)
3. **Cache aggressively** (TextureCache is your friend)
4. **Tile small textures** (256x256, repeat with `createPattern()`)
5. **Use Web Workers** for large textures (512x512+)

---

## Future Enhancements

1. **Animated textures** (time parameter for noise)
2. **Normal maps** (pseudo-3D lighting on felt)
4. **Community sharing** (upload/download texture packs)
5. **AI-generated textures** (style transfer, GANs)

---

**Ready to make pool2d fully customizable!** 🎨

---

**Document version**: 1.0
**Last updated**: 2024-11-30
**Author**: Claude Code
**Codebase**: pool2d (commit 44d3ff1)