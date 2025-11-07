/**
 * Modern Geometry Calculator
 *
 * Direct width-based calculation of pocket geometry using physical measurements.
 * Uses mouth width, throat width, and depths instead of derived angles.
 * Much simpler and more intuitive than legacy tangent-derivation approach.
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
 * Calculate side pocket jaw points from physical measurements
 *
 * Direct mapping from mouth width, throat width, and depths to jaw positions.
 * No angle calculations needed - the angle emerges naturally from the geometry.
 *
 * @param config Side pocket configuration
 * @param outwardOffset How far pocket extends beyond play area (default: 0.25")
 * @returns Jaw points for right side pocket (mirror for left)
 */
export function calculateSideJawPoints(
  config: PocketConfig,
  outwardOffset: number = 0.25
): SideJawPoints {
  // Calculate jaw outer (at straight rail) from mouth width
  const jawOuterX = config.mouthWidth / 2;

  // Calculate jaw inner (at throat) from throat width
  const jawInnerX = config.throatWidth / 2;

  // Calculate Y positions from depths
  const straightY = PLAY_HALF_H_IN - config.railDepth;
  const throatY = straightY + config.jawDepth;
  const pocketCenterY = PLAY_HALF_H_IN + outwardOffset;

  return {
    jawOuter: { x: jawOuterX, y: straightY },
    jawInner: { x: jawInnerX, y: throatY },
    mouth: { x: 0, y: pocketCenterY },
  };
}

/**
 * Calculate corner pocket jaw points from physical measurements
 *
 * Corner pockets in legacy system:
 * - jawVertical: (straightX, jawY) where vertical rail meets throat
 * - jawHorizontal: (jawX, straightY) where horizontal rail meets throat
 * - jawX = jawY = throatWidth/2
 * - straightX = 50 - railDepth
 * - straightY = 25 - railDepth
 *
 * @param config Corner pocket configuration
 * @returns Jaw points for northeast corner (mirror for others)
 */
export function calculateCornerJawPoints(
  config: PocketConfig
): CornerJawPoints {
  // Corner pocket is at the play area corner
  const cornerX = PLAY_HALF_W_IN;
  const cornerY = PLAY_HALF_H_IN;

  // Throat positions - where rails transition to angled corner sections
  const throatHalfWidth = config.throatWidth / 2;

  // Straight rail positions (railDepth from corner)
  const straightX = cornerX - config.railDepth;
  const straightY = cornerY - config.railDepth;

  // Jaw points where rails meet throat
  // Vertical rail: (straightX, throatY) where throatY = throatWidth/2
  // Horizontal rail: (throatX, straightY) where throatX = throatWidth/2
  const jawVerticalX = straightX;
  const jawVerticalY = throatHalfWidth;
  const jawHorizontalX = throatHalfWidth;
  const jawHorizontalY = straightY;

  // Throat position (approximate center, along 45° diagonal)
  const throatOffset = throatHalfWidth / Math.sqrt(2);
  const throatX = cornerX - throatOffset;
  const throatY = cornerY - throatOffset;

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
 * Calculate jaw angle from pocket geometry
 *
 * This is INFORMATIONAL ONLY - not used in geometry calculations.
 * The jaw angle emerges naturally from the mouth/throat widths and jaw depth.
 *
 * @param config Pocket configuration
 * @returns Jaw angle in degrees (angle of jaw rail from horizontal)
 */
export function calculateJawAngle(config: PocketConfig): number {
  const horizontalTaper = (config.mouthWidth - config.throatWidth) / 2;
  const angleRad = Math.atan(horizontalTaper / config.jawDepth);
  return (angleRad * 180) / Math.PI;
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

  // Check that mouth (jaw outer) is wider than throat (jaw inner)
  if (jawPoints.jawOuter.x <= jawPoints.jawInner.x) {
    warnings.push('Mouth should be wider than throat');
  }

  // Check that jaw is behind throat
  if (jawPoints.jawOuter.y >= jawPoints.jawInner.y) {
    warnings.push('Jaw should be behind (lower Y) throat');
  }

  // Check reasonable throat width (2-6 inches)
  const throatWidth = jawPoints.jawInner.x * 2;
  if (throatWidth < 2.0) {
    warnings.push(`Throat width ${throatWidth.toFixed(2)}" is very tight (< 2")`);
  } else if (throatWidth > 6.0) {
    warnings.push(`Throat width ${throatWidth.toFixed(2)}" is very loose (> 6")`);
  }

  // Check reasonable jaw depth (0-3 inches for side pockets)
  const jawDepth = jawPoints.jawInner.y - jawPoints.jawOuter.y;
  if (jawDepth < 0) {
    warnings.push('Negative jaw depth - invalid geometry');
  } else if (jawDepth > 3.0) {
    warnings.push(`Jaw depth ${jawDepth.toFixed(2)}" is very deep (> 3")`);
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
