/**
 * TableTextureManager - Unified texture generation for all table elements
 * Generates procedural textures based on TableAppearance settings
 */

import * as THREE from 'three';
import {
  TableAppearance,
  DEFAULT_TABLE_APPEARANCE,
} from './TableAppearance';

interface GeneratedTextures {
  felt: THREE.CanvasTexture;
  frame: THREE.CanvasTexture;
}

export class TableTextureManager {
  private appearance: TableAppearance;
  private textures: GeneratedTextures | null = null;

  constructor(appearance: TableAppearance = DEFAULT_TABLE_APPEARANCE) {
    this.appearance = { ...appearance };
  }

  /**
   * Update appearance and regenerate textures
   */
  setAppearance(appearance: Partial<TableAppearance>): void {
    this.appearance = {
      ...this.appearance,
      ...appearance,
      felt: { ...this.appearance.felt, ...appearance.felt },
      frame: { ...this.appearance.frame, ...appearance.frame },
      cushion: { ...this.appearance.cushion, ...appearance.cushion },
      pocket: { ...this.appearance.pocket, ...appearance.pocket },
    };
    this.textures = null; // Invalidate cache
  }

  getAppearance(): TableAppearance {
    return { ...this.appearance };
  }

  /**
   * Generate all textures (cached)
   */
  generateTextures(): GeneratedTextures {
    if (this.textures) {
      return this.textures;
    }

    this.textures = {
      felt: this.generateFeltTexture(),
      frame: this.generateFrameTexture(),
    };

    return this.textures;
  }

  /**
   * Generate felt texture based on pattern and settings
   */
  generateFeltTexture(size: number = 512): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const { color, pattern, roughness, tileScale } = this.appearance.felt;
    const baseColor = this.parseColor(color);

    // Fill base color
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, size, size);

    // Get image data for pixel manipulation
    const imageData = ctx.getImageData(0, 0, size, size);
    const data = imageData.data;

    // Apply pattern
    switch (pattern) {
      case 'weave':
        this.applyWeavePattern(data, size, baseColor, roughness);
        break;
      case 'worn':
        this.applyWornPattern(data, size, baseColor, roughness);
        break;
      case 'solid':
      default:
        this.applySolidPattern(data, size, baseColor, roughness);
        break;
    }

    ctx.putImageData(imageData, 0, 0);

    // Create THREE texture
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(tileScale, tileScale / 2); // Account for table aspect ratio
    texture.anisotropy = 8;
    texture.needsUpdate = true;

    return texture;
  }

  /**
   * Generate frame/wood texture
   */
  generateFrameTexture(width: number = 512, height: number = 128): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    const { color, material, grainAngle, glossiness } = this.appearance.frame;
    const baseColor = this.parseColor(color);

    // Fill base
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);

    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // Apply material-specific pattern
    switch (material) {
      case 'metal':
        this.applyMetalPattern(data, width, height, baseColor, glossiness);
        break;
      case 'marble':
        this.applyMarblePattern(data, width, height, baseColor, glossiness);
        break;
      default:
        // Wood grain for oak, mahogany, ebony, walnut
        this.applyWoodGrainPattern(data, width, height, baseColor, grainAngle, glossiness);
        break;
    }

    ctx.putImageData(imageData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 1);
    texture.anisotropy = 4;
    texture.needsUpdate = true;

    return texture;
  }

  // ─────────────────────────────────────────────────────────────
  // Pattern Implementations
  // ─────────────────────────────────────────────────────────────

  private applySolidPattern(
    data: Uint8ClampedArray,
    _size: number,
    _base: { r: number; g: number; b: number },
    roughness: number
  ): void {
    const noiseIntensity = roughness * 20;

    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * noiseIntensity;
      data[i] = this.clamp(data[i] + noise);
      data[i + 1] = this.clamp(data[i + 1] + noise);
      data[i + 2] = this.clamp(data[i + 2] + noise);
    }
  }

  private applyWeavePattern(
    data: Uint8ClampedArray,
    size: number,
    _base: { r: number; g: number; b: number },
    roughness: number
  ): void {
    const noiseIntensity = roughness * 15;
    const weaveScale = 3;
    const weaveIntensity = 0.08;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;

        // Weave cross-hatch pattern
        const warp = Math.sin(x * 0.5 * weaveScale) * 0.5 + 0.5;
        const weft = Math.sin(y * 0.5 * weaveScale) * 0.5 + 0.5;
        const weave = ((warp + weft) / 2 - 0.5) * weaveIntensity * 255;

        // Random noise for felt texture
        const noise = (Math.random() - 0.5) * noiseIntensity;

        data[i] = this.clamp(data[i] + weave + noise);
        data[i + 1] = this.clamp(data[i + 1] + weave + noise);
        data[i + 2] = this.clamp(data[i + 2] + weave + noise);
      }
    }
  }

  private applyWornPattern(
    data: Uint8ClampedArray,
    size: number,
    base: { r: number; g: number; b: number },
    roughness: number
  ): void {
    // First apply weave base
    this.applyWeavePattern(data, size, base, roughness * 0.7);

    // Add wear spots (slightly lighter/darker patches)
    const numSpots = Math.floor(size * size * 0.0001);
    for (let s = 0; s < numSpots; s++) {
      const cx = Math.random() * size;
      const cy = Math.random() * size;
      const radius = 10 + Math.random() * 30;
      const intensity = (Math.random() - 0.5) * 20;

      for (let y = Math.max(0, cy - radius); y < Math.min(size, cy + radius); y++) {
        for (let x = Math.max(0, cx - radius); x < Math.min(size, cx + radius); x++) {
          const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
          if (dist < radius) {
            const falloff = 1 - dist / radius;
            const i = (Math.floor(y) * size + Math.floor(x)) * 4;
            const adj = intensity * falloff * falloff;
            data[i] = this.clamp(data[i] + adj);
            data[i + 1] = this.clamp(data[i + 1] + adj);
            data[i + 2] = this.clamp(data[i + 2] + adj);
          }
        }
      }
    }
  }

  private applyWoodGrainPattern(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    _base: { r: number; g: number; b: number },
    grainAngle: number,
    glossiness: number
  ): void {
    const angleRad = (grainAngle * Math.PI) / 180;
    const grainIntensity = 35 * (1 - glossiness * 0.5);

    // Create 1D noise for grain
    const noiseArr = new Float32Array(width);
    for (let i = 0; i < width; i++) {
      noiseArr[i] = Math.random();
    }

    // Smooth the noise
    const smoothNoise = new Float32Array(width);
    for (let i = 0; i < width; i++) {
      let sum = 0;
      for (let j = -5; j <= 5; j++) {
        sum += noiseArr[(i + j + width) % width];
      }
      smoothNoise[i] = sum / 11;
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;

        // Rotate coordinates for grain angle
        const rx = x * Math.cos(angleRad) - y * Math.sin(angleRad);
        const ry = x * Math.sin(angleRad) + y * Math.cos(angleRad);

        // Sample grain with some turbulence
        const grainY = (ry + Math.sin(rx * 0.02) * 10) % width;
        const noiseVal = smoothNoise[(Math.floor(Math.abs(grainY)) % width)];

        const grainFactor = (noiseVal - 0.5) * grainIntensity;

        data[i] = this.clamp(data[i] + grainFactor);
        data[i + 1] = this.clamp(data[i + 1] + grainFactor * 0.9);
        data[i + 2] = this.clamp(data[i + 2] + grainFactor * 0.8);
      }
    }
  }

  private applyMetalPattern(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    _base: { r: number; g: number; b: number },
    glossiness: number
  ): void {
    const noiseIntensity = 15 * (1 - glossiness * 0.7);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;

        // Brushed metal: horizontal streaks
        const streak = (Math.random() - 0.5) * noiseIntensity;

        // Slight variation per row for brushed effect
        const rowNoise = Math.sin(y * 0.1) * 5;

        data[i] = this.clamp(data[i] + streak + rowNoise);
        data[i + 1] = this.clamp(data[i + 1] + streak + rowNoise);
        data[i + 2] = this.clamp(data[i + 2] + streak + rowNoise);
      }
    }
  }

  private applyMarblePattern(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    _base: { r: number; g: number; b: number },
    glossiness: number
  ): void {
    // Simple marble veins using sine waves
    const veinIntensity = 40 * (1 - glossiness * 0.3);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;

        // Multiple sine waves at different frequencies for veins
        const vein1 = Math.sin(x * 0.02 + y * 0.01 + Math.sin(y * 0.05) * 2);
        const vein2 = Math.sin(x * 0.015 - y * 0.02 + Math.sin(x * 0.03) * 3);
        const vein = (vein1 + vein2) * 0.5;

        const noise = (Math.random() - 0.5) * 5;
        const adj = vein * veinIntensity + noise;

        data[i] = this.clamp(data[i] + adj);
        data[i + 1] = this.clamp(data[i + 1] + adj);
        data[i + 2] = this.clamp(data[i + 2] + adj);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────

  private parseColor(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 0, g: 0, b: 0 };
  }

  private clamp(value: number, min: number = 0, max: number = 255): number {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Dispose all cached textures
   */
  dispose(): void {
    if (this.textures) {
      this.textures.felt.dispose();
      this.textures.frame.dispose();
      this.textures = null;
    }
  }
}
