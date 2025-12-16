// Shared rendering utilities for both 2D and 3D renderers

export type RGBColor = { r: number; g: number; b: number };

/**
 * Clamp a color channel value to [0, 255]
 */
function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

/**
 * Parse a hex color string into RGB components
 * Supports both #RGB and #RRGGBB formats
 */
export function parseHexColor(hex: string): RGBColor {
  const normalized = hex.replace('#', '').trim();
  const expanded =
    normalized.length === 3
      ? normalized
          .split('')
          .map((ch) => ch + ch)
          .join('')
      : normalized.padEnd(6, '0');
  const value = parseInt(expanded.slice(0, 6), 16);
  return {
    r: (value >> 16) & 0xff,
    g: (value >> 8) & 0xff,
    b: value & 0xff,
  };
}

/**
 * Lighten a color by mixing it with white
 * @param color RGB color to lighten
 * @param amount Amount to lighten (0-1)
 */
export function lightenColor(color: RGBColor, amount: number): RGBColor {
  return {
    r: clampChannel(color.r + (255 - color.r) * amount),
    g: clampChannel(color.g + (255 - color.g) * amount),
    b: clampChannel(color.b + (255 - color.b) * amount),
  };
}

/**
 * Darken a color by reducing its brightness
 * @param color RGB color to darken
 * @param amount Amount to darken (0-1)
 */
export function darkenColor(color: RGBColor, amount: number): RGBColor {
  return {
    r: clampChannel(color.r * (1 - amount)),
    g: clampChannel(color.g * (1 - amount)),
    b: clampChannel(color.b * (1 - amount)),
  };
}

/**
 * Mix two colors together
 * @param colorA First color
 * @param colorB Second color
 * @param factor Mix factor (0 = all colorA, 1 = all colorB)
 */
export function mixColors(colorA: RGBColor, colorB: RGBColor, factor: number): RGBColor {
  const clamped = Math.max(0, Math.min(1, factor));
  return {
    r: clampChannel(colorA.r + (colorB.r - colorA.r) * clamped),
    g: clampChannel(colorA.g + (colorB.g - colorA.g) * clamped),
    b: clampChannel(colorA.b + (colorB.b) * clamped),
  };
}

/**
 * Convert RGB color to rgba() CSS string
 */
export function toRgba(color: RGBColor, alpha: number): string {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
}

/**
 * Lighten a hex color string and return as rgb() CSS string
 * Convenience wrapper for 2D renderer compatibility
 */
export function lightenHexColor(hex: string, amount: number): string {
  const rgb = parseHexColor(hex);
  const lightened = lightenColor(rgb, amount);
  return `rgb(${lightened.r}, ${lightened.g}, ${lightened.b})`;
}

/**
 * Darken a hex color string and return as rgb() CSS string
 * Convenience wrapper for 2D renderer compatibility
 */
export function darkenHexColor(hex: string, amount: number): string {
  const rgb = parseHexColor(hex);
  const darkened = darkenColor(rgb, amount);
  return `rgb(${darkened.r}, ${darkened.g}, ${darkened.b})`;
}

// Trajectory rendering utilities

export type AxisAlignment = 'horizontal' | 'vertical' | 'rail-riding' | null;

export interface AxisColorPalette {
  line: string;
  glow: string;
  debugStroke: string;
  debugFill: string;
}

/**
 * Classify a vector as horizontal, vertical, or neither
 * Used for trajectory line coloring
 */
export function classifyAxisAlignmentFromVector(
  dx: number,
  dy: number,
  tolerance: number = 0.02
): AxisAlignment {
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1e-4) return null;
  const nx = dx / len;
  const ny = dy / len;
  if (Math.abs(ny) <= tolerance && Math.abs(nx) > tolerance) {
    return 'horizontal';
  }
  if (Math.abs(nx) <= tolerance && Math.abs(ny) > tolerance) {
    return 'vertical';
  }
  return null;
}

/**
 * Get color palette for trajectory lines based on axis alignment
 * Rail-riding: magenta/pink, All others: white/black
 */
export function getAxisPalette(alignment: AxisAlignment): AxisColorPalette {
  switch (alignment) {
    case 'rail-riding':
      return {
        line: 'rgba(255, 100, 220, 0.95)',
        glow: 'rgba(150, 0, 100, 0.85)',
        debugStroke: 'rgba(255, 100, 220, 0.7)',
        debugFill: 'rgba(255, 100, 220, 0.9)',
      };
    default:
      return {
        line: 'rgba(255, 255, 255, 0.95)',
        glow: 'rgba(0, 0, 0, 0.8)',
        debugStroke: 'rgba(255, 230, 120, 0.7)',
        debugFill: 'rgba(255, 230, 120, 0.9)',
      };
  }
}

/**
 * Check if an object ball path will ride the rail based on approach angle
 * Uses same thresholds as physics (shallowAngle = 0.14 = ~8°)
 */
export function willRideRail(pathDirX: number, pathDirY: number, railNormalX: number, railNormalY: number): boolean {
  const len = Math.hypot(pathDirX, pathDirY);
  if (len < 1e-6) return false;
  const nx = pathDirX / len;
  const ny = pathDirY / len;
  // Approach ratio = |dot(velocity, rail_normal)|
  const approachRatio = Math.abs(nx * railNormalX + ny * railNormalY);
  // Match physics threshold: shallowAngle = 0.14 (~8°)
  return approachRatio <= 0.14;
}
