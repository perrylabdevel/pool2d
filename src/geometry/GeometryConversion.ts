/**
 * Geometry Conversion Utilities
 *
 * Converts between modern mouth/throat-width geometry and legacy tangent-derivation geometry.
 * This allows gradual migration while maintaining backwards compatibility.
 *
 * Modern geometry uses direct physical measurements (mouth width, throat width, depths),
 * while legacy geometry uses derived jaw positions from mathematical parameters.
 */

import { CONFIG } from '../config';
import { ModernPocketGeometry, PocketConfig } from './ModernGeometry';

/**
 * Legacy geometry configuration (current CONFIG structure)
 */
export interface LegacyGeometry {
  // Side pockets
  SIDE_FRAME_OFFSET_IN: number;
  SIDE_STRAIGHT_Y_IN: number;
  SIDE_INNER_Y_IN: number;
  SIDE_JAW_OUTER_OVERRIDE_IN: number | null;
  SIDE_JAW_INNER_OVERRIDE_IN: number | null;
  SIDE_THROAT_WIDTH_IN: number | null;
  JAW_REF_RADIUS_IN: number;
  SIDE_POCKET_OUTWARD_OFFSET_IN: number;
  JAW_CURVE_BLEND: number;

  // Corner pockets
  CORNER_FRAME_OFFSET_IN: number;
  CORNER_STRAIGHT_X_IN: number;
  CORNER_TARGET_Y_IN: number;
  CORNER_JAW_X_OVERRIDE_IN: number | null;
  CORNER_JAW_Y_OVERRIDE_IN: number | null;
  CORNER_THROAT_WIDTH_IN: number | null;
  CORNER_JAW_REF_RADIUS_IN: number;

  // Global
  POCKET_SHELF_DEPTH_IN: number;
  FRAME_OFFSET_IN: number;
}

// Play area constants (from Geometry.ts)
const PLAY_HALF_W_IN = 50.0;  // Half width of play area
const PLAY_HALF_H_IN = 25.0;  // Half height of play area

/**
 * Convert modern mouth/throat-width geometry to legacy tangent-derivation parameters
 *
 * Strategy:
 * 1. Directly map mouth width to jaw outer position
 * 2. Directly map throat width to jaw inner position
 * 3. Map rail depth and jaw depth to Y positions
 * 4. Use reasonable defaults for frame offset and reference radius
 * 5. Use overrides to ensure exact geometry (bypassing derivation)
 */
export function modernToLegacy(modern: ModernPocketGeometry): LegacyGeometry {
  const side = modernPocketToLegacySide(modern.side);
  const corner = modernPocketToLegacyCorner(modern.corner);

  return {
    // Side pocket parameters
    SIDE_FRAME_OFFSET_IN: side.frameOffset,
    SIDE_STRAIGHT_Y_IN: side.straightY,
    SIDE_INNER_Y_IN: side.innerY,
    SIDE_JAW_OUTER_OVERRIDE_IN: side.jawOuterX,
    SIDE_JAW_INNER_OVERRIDE_IN: side.jawInnerX,
    SIDE_THROAT_WIDTH_IN: modern.side.throatWidth,
    JAW_REF_RADIUS_IN: side.refRadius,
    SIDE_POCKET_OUTWARD_OFFSET_IN: 0.25, // Standard offset
    JAW_CURVE_BLEND: modern.side.railCurve ?? 0.0,

    // Corner pocket parameters
    CORNER_FRAME_OFFSET_IN: corner.frameOffset,
    CORNER_STRAIGHT_X_IN: corner.straightX,
    CORNER_TARGET_Y_IN: corner.targetY,
    CORNER_JAW_X_OVERRIDE_IN: corner.jawX,
    CORNER_JAW_Y_OVERRIDE_IN: corner.jawY,
    CORNER_THROAT_WIDTH_IN: modern.corner.throatWidth,
    CORNER_JAW_REF_RADIUS_IN: corner.refRadius,

    // Global parameters
    POCKET_SHELF_DEPTH_IN: modern.corner.shelfDepth,
    FRAME_OFFSET_IN: CONFIG.FRAME_OFFSET_IN,
  };
}

/**
 * Convert modern side pocket config to legacy parameters
 *
 * Direct mapping from physical measurements:
 * - mouthWidth → JAW_X_OUTER (width at straight rail end)
 * - throatWidth → JAW_X_INNER (width at narrowest point)
 * - railDepth → distance from play edge to straight rail
 * - jawDepth → distance from straight rail to throat
 */
function modernPocketToLegacySide(side: PocketConfig): {
  frameOffset: number;
  refRadius: number;
  straightY: number;
  innerY: number;
  jawOuterX: number;
  jawInnerX: number;
} {
  // Direct mapping from physical measurements
  const jawOuterX = side.mouthWidth / 2;
  const jawInnerX = side.throatWidth / 2;

  // Y positions calculated from depths
  const straightY = PLAY_HALF_H_IN - side.railDepth;
  const innerY = straightY + side.jawDepth;

  // Use reasonable defaults for derivation parameters
  // (won't be used since we're setting overrides)
  const frameOffset = 2.0;
  const refRadius = 4.0;

  return {
    frameOffset,
    refRadius,
    straightY,
    innerY,
    jawOuterX,
    jawInnerX,
  };
}

/**
 * Convert modern corner pocket config to legacy parameters
 *
 * Direct mapping from physical measurements for corner pockets.
 * Corner pockets are oriented at 45° from the table corner.
 */
function modernPocketToLegacyCorner(corner: PocketConfig): {
  frameOffset: number;
  refRadius: number;
  straightX: number;
  targetY: number;
  jawX: number;
  jawY: number;
} {
  // Corner pocket center is at the corner
  const pocketCenterX = PLAY_HALF_W_IN;
  const pocketCenterY = PLAY_HALF_H_IN;

  // For corner pockets at 45°, the throat width is measured perpendicular to the 45° line
  // Throat position: distance from corner along 45° line
  const throatHalfWidth = corner.throatWidth / 2;
  const throatDistFromCorner = throatHalfWidth / Math.sqrt(2);

  const throatX = pocketCenterX - throatDistFromCorner;
  const throatY = pocketCenterY - throatDistFromCorner;

  // Mouth position: further from corner by jawDepth along 45° line
  const mouthHalfWidth = corner.mouthWidth / 2;
  const mouthDistFromCorner = mouthHalfWidth / Math.sqrt(2);

  const jawX = pocketCenterX - mouthDistFromCorner - (corner.jawDepth / Math.sqrt(2));
  const jawY = pocketCenterY - mouthDistFromCorner - (corner.jawDepth / Math.sqrt(2));

  // Straight rail positions (where the straight rail ends before entering pocket)
  const straightX = jawX - (corner.railDepth / Math.sqrt(2));
  const targetY = jawY - (corner.railDepth / Math.sqrt(2));

  // Use reasonable defaults for derivation parameters
  const frameOffset = 4.0;
  const refRadius = 4.0;

  return {
    frameOffset,
    refRadius,
    straightX,
    targetY,
    jawX,
    jawY,
  };
}

/**
 * Convert legacy tangent-derivation geometry to modern mouth/throat-width parameters
 *
 * Strategy:
 * 1. Use existing jaw positions (derived or overridden) to extract widths
 * 2. Calculate mouth width from jaw outer positions
 * 3. Calculate throat width from jaw inner positions
 * 4. Extract depths from Y positions
 */
export function legacyToModern(legacy: LegacyGeometry): ModernPocketGeometry {
  // Recreate the derivation to get actual jaw positions
  // (This mimics computeJawPositions from Geometry.ts)

  const sideStraight = Math.max(0, legacy.SIDE_STRAIGHT_Y_IN);
  const sideInner = Math.max(sideStraight + 0.05, legacy.SIDE_INNER_Y_IN);
  const cornerStraight = Math.max(0, legacy.CORNER_STRAIGHT_X_IN);

  // Derive or use overrides for side pocket
  const sideJawOuterX = legacy.SIDE_JAW_OUTER_OVERRIDE_IN ?? estimateSideJawOuter(legacy);
  const sideJawInnerX = legacy.SIDE_JAW_INNER_OVERRIDE_IN ??
                        (legacy.SIDE_THROAT_WIDTH_IN ? legacy.SIDE_THROAT_WIDTH_IN * 0.5 : estimateSideJawInner(legacy));

  // Derive or use overrides for corner pocket
  const cornerJawX = legacy.CORNER_JAW_X_OVERRIDE_IN ?? estimateCornerJawX(legacy);
  const cornerJawY = legacy.CORNER_JAW_Y_OVERRIDE_IN ??
                     (legacy.CORNER_THROAT_WIDTH_IN ? legacy.CORNER_THROAT_WIDTH_IN * 0.5 : estimateCornerJawY(legacy));

  // Convert to modern parameters
  const side = legacySideToModernPocket(
    sideJawOuterX,
    sideJawInnerX,
    sideStraight,
    sideInner,
    legacy.JAW_CURVE_BLEND
  );

  const corner = legacyCornerToModernPocket(
    cornerJawX,
    cornerJawY,
    cornerStraight,
    sideStraight,
    legacy.POCKET_SHELF_DEPTH_IN
  );

  return {
    side,
    corner,
    global: {
      cutAngleAdjust: 0,
      verticalAngle: 13.5,
    },
  };
}

/**
 * Convert legacy side jaw positions to modern pocket config
 *
 * Reverse mapping from legacy jaw positions to physical measurements:
 * - JAW_X_OUTER → mouthWidth
 * - JAW_X_INNER → throatWidth
 * - Y positions → railDepth and jawDepth
 */
function legacySideToModernPocket(
  jawOuterX: number,
  jawInnerX: number,
  straightY: number,
  innerY: number,
  curveBlend: number
): PocketConfig {
  // Direct mapping from jaw positions to widths
  const mouthWidth = jawOuterX * 2;
  const throatWidth = jawInnerX * 2;

  // Calculate depths from Y positions
  const railDepth = PLAY_HALF_H_IN - straightY;
  const jawDepth = innerY - straightY;

  // Shelf depth (use a reasonable default)
  const shelfDepth = 0.25;

  return {
    mouthWidth,
    throatWidth,
    railDepth,
    jawDepth,
    shelfDepth,
    railCurve: curveBlend,
  };
}

/**
 * Convert legacy corner jaw positions to modern pocket config
 *
 * Reverse mapping for corner pockets (oriented at 45°).
 */
function legacyCornerToModernPocket(
  jawX: number,
  jawY: number,
  straightX: number,
  straightY: number,
  shelfDepth: number
): PocketConfig {
  // Corner pocket center
  const pocketCenterX = PLAY_HALF_W_IN;
  const pocketCenterY = PLAY_HALF_H_IN;

  // Calculate throat width from jaw inner position
  // For 45° pockets, the distance from corner to throat along the diagonal
  const throatDistFromCorner = Math.sqrt(
    Math.pow(pocketCenterX - jawX, 2) + Math.pow(pocketCenterY - jawY, 2)
  );
  const throatHalfWidth = throatDistFromCorner * Math.sqrt(2);
  const throatWidth = throatHalfWidth * 2;

  // Estimate mouth width from straight rail position
  // This is an approximation; perfect round-trip requires stored values
  const straightDistFromCorner = Math.sqrt(
    Math.pow(pocketCenterX - straightX, 2) + Math.pow(pocketCenterY - straightY, 2)
  );

  // Calculate rail depth and jaw depth from positions
  const railDepth = (straightDistFromCorner - throatDistFromCorner) * Math.sqrt(2);
  const jawDepth = 1.0; // Default value

  // Approximate mouth width
  const mouthWidth = throatWidth + (2 * jawDepth * 0.5); // Rough estimate

  return {
    mouthWidth,
    throatWidth,
    railDepth,
    jawDepth,
    shelfDepth,
    railCurve: 0.0,
  };
}

/**
 * Estimate side jaw outer X using derivation (for legacy conversion)
 */
function estimateSideJawOuter(legacy: LegacyGeometry): number {
  const f = legacy.SIDE_FRAME_OFFSET_IN;
  const r = legacy.JAW_REF_RADIUS_IN;
  const straightY = legacy.SIDE_STRAIGHT_Y_IN;

  const yTop = PLAY_HALF_H_IN + f;
  const under = r * r - f * f;

  if (under <= 0) {
    return 6.0; // Fallback
  }

  const xi = Math.sqrt(under);
  const tOuter = (yTop - straightY) / xi;
  const xOuter = xi + f * tOuter;

  return xOuter;
}

/**
 * Estimate side jaw inner X using derivation (for legacy conversion)
 */
function estimateSideJawInner(legacy: LegacyGeometry): number {
  const f = legacy.SIDE_FRAME_OFFSET_IN;
  const r = legacy.JAW_REF_RADIUS_IN;
  const innerY = legacy.SIDE_INNER_Y_IN;

  const yTop = PLAY_HALF_H_IN + f;
  const under = r * r - f * f;

  if (under <= 0) {
    return 2.5; // Fallback
  }

  const xi = Math.sqrt(under);
  const tInner = (yTop - innerY) / xi;
  const xInner = xi + f * tInner;

  return xInner;
}

/**
 * Estimate corner jaw X using derivation (for legacy conversion)
 */
function estimateCornerJawX(legacy: LegacyGeometry): number {
  const f = legacy.CORNER_FRAME_OFFSET_IN;
  const r = legacy.CORNER_JAW_REF_RADIUS_IN;
  const straightY = legacy.SIDE_STRAIGHT_Y_IN; // Uses side straight Y

  const under = Math.max(0, r * r - f * f);
  const xi = Math.sqrt(under);

  if (xi <= 1e-6) {
    return 46.0; // Fallback
  }

  const yFrame = PLAY_HALF_H_IN + f;
  const s = (yFrame - straightY) / xi;
  const xCorner = PLAY_HALF_W_IN - xi + f * s;

  return xCorner;
}

/**
 * Estimate corner jaw Y using derivation (for legacy conversion)
 */
function estimateCornerJawY(legacy: LegacyGeometry): number {
  const f = legacy.CORNER_FRAME_OFFSET_IN;
  const r = legacy.CORNER_JAW_REF_RADIUS_IN;
  const straightX = legacy.CORNER_STRAIGHT_X_IN;
  const fallbackY = legacy.CORNER_TARGET_Y_IN;

  const under = Math.max(0, r * r - f * f);
  const xi = Math.sqrt(under);

  if (xi <= 1e-6) {
    return fallbackY;
  }

  const xFrame = PLAY_HALF_W_IN + f;
  const s = (xFrame - straightX) / xi;
  const yCorner = PLAY_HALF_H_IN - xi + f * s;

  return Number.isFinite(yCorner) && yCorner > 0.01 ? yCorner : fallbackY;
}

/**
 * Get current legacy geometry from CONFIG
 */
export function getCurrentLegacyGeometry(): LegacyGeometry {
  return {
    SIDE_FRAME_OFFSET_IN: CONFIG.SIDE_FRAME_OFFSET_IN,
    SIDE_STRAIGHT_Y_IN: CONFIG.SIDE_STRAIGHT_Y_IN,
    SIDE_INNER_Y_IN: CONFIG.SIDE_INNER_Y_IN,
    SIDE_JAW_OUTER_OVERRIDE_IN: CONFIG.SIDE_JAW_OUTER_OVERRIDE_IN,
    SIDE_JAW_INNER_OVERRIDE_IN: CONFIG.SIDE_JAW_INNER_OVERRIDE_IN,
    SIDE_THROAT_WIDTH_IN: CONFIG.SIDE_THROAT_WIDTH_IN,
    JAW_REF_RADIUS_IN: CONFIG.JAW_REF_RADIUS_IN,
    SIDE_POCKET_OUTWARD_OFFSET_IN: CONFIG.SIDE_POCKET_OUTWARD_OFFSET_IN,
    JAW_CURVE_BLEND: CONFIG.JAW_CURVE_BLEND,

    CORNER_FRAME_OFFSET_IN: CONFIG.CORNER_FRAME_OFFSET_IN,
    CORNER_STRAIGHT_X_IN: CONFIG.CORNER_STRAIGHT_X_IN,
    CORNER_TARGET_Y_IN: CONFIG.CORNER_TARGET_Y_IN,
    CORNER_JAW_X_OVERRIDE_IN: CONFIG.CORNER_JAW_X_OVERRIDE_IN,
    CORNER_JAW_Y_OVERRIDE_IN: CONFIG.CORNER_JAW_Y_OVERRIDE_IN,
    CORNER_THROAT_WIDTH_IN: CONFIG.CORNER_THROAT_WIDTH_IN,
    CORNER_JAW_REF_RADIUS_IN: CONFIG.CORNER_JAW_REF_RADIUS_IN,

    POCKET_SHELF_DEPTH_IN: CONFIG.POCKET_SHELF_DEPTH_IN,
    FRAME_OFFSET_IN: CONFIG.FRAME_OFFSET_IN,
  };
}

/**
 * Apply legacy geometry to CONFIG
 */
export function applyLegacyGeometry(legacy: LegacyGeometry): void {
  Object.assign(CONFIG, legacy);
}
