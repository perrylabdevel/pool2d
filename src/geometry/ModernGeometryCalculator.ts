/**
 * Modern Geometry Calculator
 *
 * Direct angle-based calculation of pocket geometry.
 * Much simpler than legacy tangent-derivation approach.
 */

import { PocketConfig } from './ModernGeometry';

export interface Vec2 {
  x: number;
  y: number;
}

/**
 * Jaw points for a side pocket (one side, mirrored for other side)
 */
export interface SideJawPoints {
  /** Where the straight rail ends and jaw begins */
  jawOuter: Vec2;

  /** Where the jaw meets the throat (narrowest point) */
  jawInner: Vec2;

  /** Center of pocket mouth */
  mouth: Vec2;
}

/**
 * Jaw points for a corner pocket
 */
export interface CornerJawPoints {
  /** Where vertical straight rail transitions to jaw */
  jawVertical: Vec2;

  /** Where horizontal straight rail transitions to jaw */
  jawHorizontal: Vec2;

  /** Throat point (narrowest opening) */
  throat: Vec2;

  /** Corner pocket center */
  corner: Vec2;
}

// Play area constants
const PLAY_HALF_W_IN = 50.0;
const PLAY_HALF_H_IN = 25.0;

/**
 * Calculate side pocket jaw points from angle-based parameters
 *
 * This is the core of the new system - simple trigonometry replaces
 * complex tangent derivations.
 *
 * @param config Side pocket configuration
 * @param outwardOffset How far pocket extends beyond play area (default: 0.25")
 * @returns Jaw points for right side pocket (mirror for left)
 */
export function calculateSideJawPoints(
  config: PocketConfig,
  outwardOffset: number = 0.25
): SideJawPoints {
  // Convert jaw angle to radians
  const jawAngleRad = (config.jawAngle * Math.PI) / 180;

  // Throat half-width
  const throatHalfWidth = config.opening / 2;

  // Side pocket center Y position (extends beyond play area)
  const pocketCenterY = PLAY_HALF_H_IN + outwardOffset;

  // Throat position (at pocket center)
  const throatY = pocketCenterY;
  const throatX = throatHalfWidth;

  // Straight rail ends 'depth' distance back from throat
  const straightY = throatY - config.depth;

  // Calculate horizontal spread from throat to jaw based on angle
  // tan(angle) = horizontal / vertical
  // horizontal = vertical * tan(angle)
  const horizontalSpread = config.depth * Math.tan(jawAngleRad);

  // Jaw outer position (where straight rail meets jaw)
  const jawOuterX = throatX + horizontalSpread;
  const jawOuterY = straightY;

  return {
    jawOuter: { x: jawOuterX, y: jawOuterY },
    jawInner: { x: throatX, y: throatY },
    mouth: { x: 0, y: pocketCenterY },
  };
}

/**
 * Calculate corner pocket jaw points from angle-based parameters
 *
 * Corner pockets are oriented at 45° and have more complex geometry,
 * but the angle-based approach still simplifies the calculation.
 *
 * @param config Corner pocket configuration
 * @returns Jaw points for northeast corner (mirror for others)
 */
export function calculateCornerJawPoints(
  config: PocketConfig
): CornerJawPoints {
  // Convert jaw angle to radians
  const jawAngleRad = (config.jawAngle * Math.PI) / 180;

  // Corner pocket is at the play area corner
  const cornerX = PLAY_HALF_W_IN;
  const cornerY = PLAY_HALF_H_IN;

  // Throat half-width (diagonal opening)
  const throatHalfWidth = config.opening / 2;

  // For a 45° oriented pocket, the throat point is at:
  // - Distance throatHalfWidth/√2 inward from corner in both X and Y
  const throatOffset = throatHalfWidth / Math.sqrt(2);
  const throatX = cornerX - throatOffset;
  const throatY = cornerY - throatOffset;

  // Depth extends inward from throat at 45°
  const depthOffset = config.depth / Math.sqrt(2);

  // Jaw points are where straight rails meet the angled pocket transition
  // For corner pockets, we need to account for the 45° orientation

  // Horizontal spread due to jaw angle
  const horizontalSpread = config.depth * Math.tan(jawAngleRad);
  const spreadOffset = horizontalSpread / Math.sqrt(2);

  // Vertical straight rail jaw point (on east side)
  const jawVerticalX = throatX - depthOffset - spreadOffset;
  const jawVerticalY = throatY - depthOffset + spreadOffset;

  // Horizontal straight rail jaw point (on north side)
  const jawHorizontalX = throatX - depthOffset + spreadOffset;
  const jawHorizontalY = throatY - depthOffset - spreadOffset;

  return {
    jawVertical: { x: jawVerticalX, y: jawVerticalY },
    jawHorizontal: { x: jawHorizontalX, y: jawHorizontalY },
    throat: { x: throatX, y: throatY },
    corner: { x: cornerX, y: cornerY },
  };
}

/**
 * Create a curved jaw transition using Bezier curve
 *
 * Blends between straight line (curveBlend=0) and smooth curve (curveBlend=1)
 *
 * @param pointA Start point (jaw meets straight rail)
 * @param pointB End point (jaw meets throat)
 * @param curveBlend Blend factor (0=straight, 1=fully curved)
 * @param segments Number of points in curve
 * @returns Array of points forming the jaw curve
 */
export function createJawCurve(
  pointA: Vec2,
  pointB: Vec2,
  curveBlend: number,
  segments: number = 10
): Vec2[] {
  // Clamp blend to [0, 1]
  const blend = Math.max(0, Math.min(1, curveBlend));

  if (blend === 0) {
    // Straight line - just return endpoints
    return [pointA, pointB];
  }

  // Create a quadratic Bezier curve
  // Control point is offset perpendicular to the line A-B
  const dx = pointB.x - pointA.x;
  const dy = pointB.y - pointA.y;
  const length = Math.sqrt(dx * dx + dy * dy);

  if (length < 1e-6) {
    return [pointA, pointB];
  }

  // Perpendicular direction (rotate 90°)
  const perpX = -dy / length;
  const perpY = dx / length;

  // Control point offset (blend controls how far from midpoint)
  const midX = (pointA.x + pointB.x) / 2;
  const midY = (pointA.y + pointB.y) / 2;
  const offsetDistance = (length / 4) * blend;

  const controlX = midX + perpX * offsetDistance;
  const controlY = midY + perpY * offsetDistance;

  // Generate Bezier curve points
  const points: Vec2[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const t1 = 1 - t;

    // Quadratic Bezier formula: (1-t)²*P0 + 2(1-t)t*P1 + t²*P2
    const x = t1 * t1 * pointA.x + 2 * t1 * t * controlX + t * t * pointB.x;
    const y = t1 * t1 * pointA.y + 2 * t1 * t * controlY + t * t * pointB.y;

    points.push({ x, y });
  }

  return points;
}

/**
 * Calculate effective pocket opening angle at the cushion nose
 *
 * This is different from jaw angle - it's the total opening angle
 * measured at the pocket entrance (what BCA specs call "entrance angle")
 *
 * @param jawPoints Calculated jaw points
 * @returns Entrance angle in degrees
 */
export function calculateEntranceAngle(jawPoints: SideJawPoints): number {
  const dx = jawPoints.jawOuter.x - jawPoints.jawInner.x;
  const dy = jawPoints.jawOuter.y - jawPoints.jawInner.y;

  // Angle of the jaw relative to horizontal
  const jawAngleRad = Math.atan2(dy, dx);

  // Entrance angle is the angle between the two jaws
  // For a symmetric pocket, this is 180° minus 2x jaw angle
  const entranceAngleRad = Math.PI - 2 * Math.abs(jawAngleRad);

  return (entranceAngleRad * 180) / Math.PI;
}

/**
 * Validate that jaw points produce a valid, playable pocket
 *
 * @param jawPoints Calculated jaw points
 * @returns Validation result with any issues
 */
export interface JawValidationResult {
  valid: boolean;
  warnings: string[];
}

export function validateJawPoints(jawPoints: SideJawPoints): JawValidationResult {
  const warnings: string[] = [];

  // Check that jaw outer is farther from center than jaw inner
  if (jawPoints.jawOuter.x <= jawPoints.jawInner.x) {
    warnings.push('Jaw outer should be farther from center than jaw inner');
  }

  // Check that jaw is behind throat
  if (jawPoints.jawOuter.y >= jawPoints.jawInner.y) {
    warnings.push('Jaw should be behind (lower Y) throat');
  }

  // Check reasonable opening width (2-6 inches)
  const openingWidth = jawPoints.jawInner.x * 2;
  if (openingWidth < 2.0) {
    warnings.push(`Opening width ${openingWidth.toFixed(2)}" is very tight (< 2")`);
  } else if (openingWidth > 6.0) {
    warnings.push(`Opening width ${openingWidth.toFixed(2)}" is very loose (> 6")`);
  }

  // Check reasonable depth (0-3 inches for side pockets)
  const depth = jawPoints.jawInner.y - jawPoints.jawOuter.y;
  if (depth < 0) {
    warnings.push('Negative pocket depth - invalid geometry');
  } else if (depth > 3.0) {
    warnings.push(`Pocket depth ${depth.toFixed(2)}" is very deep (> 3")`);
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}

/**
 * Calculate all 6 pocket centers for the table
 *
 * @returns Array of pocket center positions [NE, E, SE, SW, W, NW]
 */
export function calculatePocketCenters(outwardOffset: number = 0.25): Vec2[] {
  return [
    // Corner pockets
    { x: PLAY_HALF_W_IN, y: PLAY_HALF_H_IN },              // NE
    { x: PLAY_HALF_W_IN, y: -PLAY_HALF_H_IN },             // SE
    { x: -PLAY_HALF_W_IN, y: -PLAY_HALF_H_IN },            // SW
    { x: -PLAY_HALF_W_IN, y: PLAY_HALF_H_IN },             // NW

    // Side pockets
    { x: 0, y: PLAY_HALF_H_IN + outwardOffset },           // N
    { x: 0, y: -(PLAY_HALF_H_IN + outwardOffset) },        // S
  ];
}

/**
 * Mirror jaw points for opposite side of table
 *
 * @param points Jaw points for one side
 * @param axis Axis to mirror across ('x' or 'y')
 * @returns Mirrored jaw points
 */
export function mirrorJawPoints(
  points: SideJawPoints,
  axis: 'x' | 'y'
): SideJawPoints {
  if (axis === 'x') {
    return {
      jawOuter: { x: -points.jawOuter.x, y: points.jawOuter.y },
      jawInner: { x: -points.jawInner.x, y: points.jawInner.y },
      mouth: { x: -points.mouth.x, y: points.mouth.y },
    };
  } else {
    return {
      jawOuter: { x: points.jawOuter.x, y: -points.jawOuter.y },
      jawInner: { x: points.jawInner.x, y: -points.jawInner.y },
      mouth: { x: points.mouth.x, y: -points.mouth.y },
    };
  }
}

/**
 * Mirror corner jaw points for other corners
 */
export function mirrorCornerJawPoints(
  points: CornerJawPoints,
  mirrorX: boolean,
  mirrorY: boolean
): CornerJawPoints {
  const xMult = mirrorX ? -1 : 1;
  const yMult = mirrorY ? -1 : 1;

  return {
    jawVertical: {
      x: points.jawVertical.x * xMult,
      y: points.jawVertical.y * yMult,
    },
    jawHorizontal: {
      x: points.jawHorizontal.x * xMult,
      y: points.jawHorizontal.y * yMult,
    },
    throat: {
      x: points.throat.x * xMult,
      y: points.throat.y * yMult,
    },
    corner: {
      x: points.corner.x * xMult,
      y: points.corner.y * yMult,
    },
  };
}
