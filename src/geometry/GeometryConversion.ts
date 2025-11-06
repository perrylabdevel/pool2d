/**
 * Geometry Conversion Utilities
 *
 * Converts between modern angle-based geometry and legacy tangent-derivation geometry.
 * This allows gradual migration while maintaining backwards compatibility.
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
 * Convert modern angle-based geometry to legacy tangent-derivation parameters
 *
 * Strategy:
 * 1. Calculate where straight rail should end based on jaw angle and depth
 * 2. Set throat positions from opening width
 * 3. Use reasonable defaults for frame offset and reference radius
 * 4. Use overrides to ensure exact geometry (bypassing derivation)
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
    SIDE_THROAT_WIDTH_IN: modern.side.opening,
    JAW_REF_RADIUS_IN: side.refRadius,
    SIDE_POCKET_OUTWARD_OFFSET_IN: 0.25, // Standard offset
    JAW_CURVE_BLEND: modern.side.railCurve ?? 0.0,

    // Corner pocket parameters
    CORNER_FRAME_OFFSET_IN: corner.frameOffset,
    CORNER_STRAIGHT_X_IN: corner.straightX,
    CORNER_TARGET_Y_IN: corner.targetY,
    CORNER_JAW_X_OVERRIDE_IN: corner.jawX,
    CORNER_JAW_Y_OVERRIDE_IN: corner.jawY,
    CORNER_THROAT_WIDTH_IN: modern.corner.opening,
    CORNER_JAW_REF_RADIUS_IN: corner.refRadius,

    // Global parameters
    POCKET_SHELF_DEPTH_IN: modern.corner.shelfDepth,
    FRAME_OFFSET_IN: CONFIG.FRAME_OFFSET_IN,
  };
}

/**
 * Convert modern side pocket config to legacy parameters
 */
function modernPocketToLegacySide(side: PocketConfig): {
  frameOffset: number;
  refRadius: number;
  straightY: number;
  innerY: number;
  jawOuterX: number;
  jawInnerX: number;
} {
  // Convert jaw angle to radians
  const jawAngleRad = (side.jawAngle * Math.PI) / 180;

  // Calculate throat half-width
  const throatHalfWidth = side.opening / 2;

  // Side pocket center is at Y = PLAY_HALF_H_IN + outward offset
  const sideOutwardOffset = 0.25; // Standard
  const pocketCenterY = PLAY_HALF_H_IN + sideOutwardOffset;

  // Straight Y is where the jaw meets the straight rail
  // Depth is measured from play area edge (PLAY_HALF_H_IN), not from throat
  const straightY = PLAY_HALF_H_IN - side.depth;

  // Inner Y (throat) position - between straight and mouth
  const innerY = pocketCenterY;

  // Calculate jaw X positions based on angle
  // The jaw angle is measured along the rail from straightY to innerY
  // tan(angle) = horizontal_distance / vertical_distance
  const verticalDistance = innerY - straightY;
  const horizontalSpread = verticalDistance * Math.tan(jawAngleRad);

  // Jaw positions
  const jawInnerX = throatHalfWidth;
  const jawOuterX = throatHalfWidth + horizontalSpread;

  // Use reasonable defaults for derivation parameters
  // (These won't be used since we're setting overrides, but they need to be valid)
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
 */
function modernPocketToLegacyCorner(corner: PocketConfig): {
  frameOffset: number;
  refRadius: number;
  straightX: number;
  targetY: number;
  jawX: number;
  jawY: number;
} {
  // Convert jaw angle to radians
  const jawAngleRad = (corner.jawAngle * Math.PI) / 180;

  // Calculate throat half-width
  const throatHalfWidth = corner.opening / 2;

  // Corner pocket center is at the corner
  const pocketCenterX = PLAY_HALF_W_IN;
  const pocketCenterY = PLAY_HALF_H_IN;

  // Calculate jaw positions based on angle and depth
  // For corner pockets, the geometry is more complex due to the 45° orientation
  // We'll use a simplified approach

  // The jaw transition points are depth distance from the corner
  // At 45° from the corner, so depth / √2 in each direction
  const depthDiagonal = corner.depth / Math.sqrt(2);

  // Throat positions (where pocket narrows)
  const throatX = pocketCenterX - throatHalfWidth / Math.sqrt(2);
  const throatY = pocketCenterY - throatHalfWidth / Math.sqrt(2);

  // Jaw positions (where angled rail meets straight rail)
  const horizontalSpread = corner.depth * Math.tan(jawAngleRad);

  const jawX = throatX - horizontalSpread / Math.sqrt(2);
  const jawY = throatY - horizontalSpread / Math.sqrt(2);

  // Straight rail positions (where the straight rail ends before curving into pocket)
  const straightX = jawX;
  const targetY = jawY;

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
 * Convert legacy tangent-derivation geometry to modern angle-based parameters
 *
 * Strategy:
 * 1. Use existing jaw positions (derived or overridden) to calculate angles
 * 2. Extract opening widths from throat positions
 * 3. Calculate depth from straight rail to throat positions
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
 */
function legacySideToModernPocket(
  jawOuterX: number,
  jawInnerX: number,
  straightY: number,
  innerY: number,
  curveBlend: number
): PocketConfig {
  // Opening width is 2x throat half-width
  const opening = jawInnerX * 2;

  // Depth is distance from straight rail to throat
  const depth = innerY - straightY;

  // Calculate jaw angle from horizontal spread and depth
  const horizontalSpread = jawOuterX - jawInnerX;
  const jawAngleRad = Math.atan2(horizontalSpread, depth);
  const jawAngle = (jawAngleRad * 180) / Math.PI;

  // Shelf depth (use a reasonable default)
  const shelfDepth = 0.25;

  return {
    opening,
    jawAngle,
    depth,
    shelfDepth,
    railCurve: curveBlend,
  };
}

/**
 * Convert legacy corner jaw positions to modern pocket config
 */
function legacyCornerToModernPocket(
  jawX: number,
  jawY: number,
  straightX: number,
  straightY: number,
  shelfDepth: number
): PocketConfig {
  // Corner pocket opening (throat width)
  // Distance from jaw to corner along 45° line
  const throatHalfWidth = (PLAY_HALF_W_IN - jawX) * Math.sqrt(2);
  const opening = throatHalfWidth * 2;

  // Depth from straight rail to throat
  const depthX = straightX - jawX;
  const depthY = straightY - jawY;
  const depth = Math.sqrt(depthX * depthX + depthY * depthY);

  // Calculate jaw angle
  // For corner pockets, this is more complex due to 45° orientation
  // Approximate using the same logic as side pockets
  const horizontalSpread = straightX - jawX;
  const verticalDist = Math.abs(straightY - jawY);
  const jawAngleRad = Math.atan2(horizontalSpread, verticalDist);
  const jawAngle = (jawAngleRad * 180) / Math.PI;

  return {
    opening,
    jawAngle,
    depth,
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
