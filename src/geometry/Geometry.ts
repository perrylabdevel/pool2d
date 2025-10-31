// Geometry Contract: Authoritative coordinate system and table layout
// Origin (0,0) at play-area center; +X right (East), +Y up (North/head)

import { CONFIG } from '../config';

export interface Vec2 {
  x: number;
  y: number;
}

export interface RailDef {
  id: string;
  from: Vec2;
  to: Vec2;
  normal: Vec2; // Points inward to play area
}

export interface PocketDef {
  id: string;
  center: Vec2;
  cutNormalHint: Vec2; // Direction hint for pocket lip angle
  cutAngleDeg: number;
  captureRadius: number;
  visualRadius: number;
  shelfDepth: number;
  radius: number; // Legacy alias for visualRadius (renderers still reference this)
}

export interface TableGeometry {
  playWidthIn: number;
  playHeightIn: number;
  cushionProfileIn: number;
  pocketCaptureRadiusIn: number; // Legacy aggregate value (corner capture radius)
  cornerPocketCaptureRadiusIn: number;
  sidePocketCaptureRadiusIn: number;
  cornerPocketVisualRadiusIn: number;
  sidePocketVisualRadiusIn: number;
  pocketShelfDepthIn: number;
  rails: RailDef[];
  pockets: PocketDef[];
}

export function computePlayBoundaryPoints(rails: RailDef[]): Vec2[] {
  if (!rails.length) {
    return [];
  }

  const points: Vec2[] = [];
  points.push({ x: rails[0].from.x, y: rails[0].from.y });
  rails.forEach((rail, index) => {
    const point = { x: rail.to.x, y: rail.to.y };
    const first = points[0];
    const isClosing =
      index === rails.length - 1 && Math.abs(point.x - first.x) < 1e-6 && Math.abs(point.y - first.y) < 1e-6;
    if (!isClosing) {
      points.push(point);
    }
  });
  return points;
}

export interface BoundaryBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export function computeBoundaryBounds(points: Vec2[]): BoundaryBounds {
  if (!points.length) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  }

  let minX = points[0].x;
  let maxX = points[0].x;
  let minY = points[0].y;
  let maxY = points[0].y;

  for (let i = 1; i < points.length; i++) {
    const { x, y } = points[i];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  return { minX, maxX, minY, maxY };
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
const clamp01 = (value: number): number => clamp(value, 0, 1);
const degToRad = (deg: number): number => (deg * Math.PI) / 180;
const EPSILON = 1e-6;

function intersectWithArc(inner: Vec2, outer: Vec2, center: Vec2, radius: number): Vec2 | null {
  const dx = outer.x - inner.x;
  const dy = outer.y - inner.y;
  const a = dx * dx + dy * dy;
  if (a < EPSILON) {
    return null;
  }

  const ox = inner.x - center.x;
  const oy = inner.y - center.y;
  const b = 2 * (dx * ox + dy * oy);
  const c = ox * ox + oy * oy - radius * radius;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) {
    return null;
  }

  const sqrt = Math.sqrt(discriminant);
  const t1 = (-b - sqrt) / (2 * a);
  const t2 = (-b + sqrt) / (2 * a);
  let t: number | null = null;
  if (t1 > EPSILON && t1 <= 1) t = t1;
  if (t2 > EPSILON && t2 <= 1) {
    t = t == null ? t2 : Math.min(t, t2);
  }
  if (t == null) return null;

  return {
    x: inner.x + dx * t,
    y: inner.y + dy * t,
  };
}

function rotatePoint(point: Vec2, pivot: Vec2, angleRad: number): Vec2 {
  if (angleRad === 0) return { x: point.x, y: point.y };
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const dx = point.x - pivot.x;
  const dy = point.y - pivot.y;
  return {
    x: pivot.x + dx * cos - dy * sin,
    y: pivot.y + dx * sin + dy * cos,
  };
}

function rotateVector(vec: Vec2, angleRad: number): Vec2 {
  if (angleRad === 0) return { x: vec.x, y: vec.y };
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  return {
    x: vec.x * cos - vec.y * sin,
    y: vec.x * sin + vec.y * cos,
  };
}

type AxisBounds = {
  minX?: number;
  maxX?: number;
  minY?: number;
  maxY?: number;
};

function rotateTowardAxis(
  pivot: Vec2,
  point: Vec2,
  angle: number,
  axis: 'x' | 'y',
  axisValue: number,
  clampBounds?: AxisBounds
): Vec2 {
  if (Math.abs(angle) < 1e-6) {
    return { x: point.x, y: point.y };
  }

  const vector = { x: point.x - pivot.x, y: point.y - pivot.y };
  const rotated = rotateVector(vector, angle);
  const denom = axis === 'y' ? rotated.y : rotated.x;
  if (Math.abs(denom) < 1e-6) {
    return { x: point.x, y: point.y };
  }

  const t = axis === 'y' ? (axisValue - pivot.y) / denom : (axisValue - pivot.x) / denom;
  if (!Number.isFinite(t) || t <= 0) {
    return { x: point.x, y: point.y };
  }

  let x = pivot.x + rotated.x * t;
  let y = pivot.y + rotated.y * t;
  if (axis === 'y') {
    y = axisValue;
  } else {
    x = axisValue;
  }

  if (clampBounds) {
    if (clampBounds.minX !== undefined) x = Math.max(clampBounds.minX, x);
    if (clampBounds.maxX !== undefined) x = Math.min(clampBounds.maxX, x);
    if (clampBounds.minY !== undefined) y = Math.max(clampBounds.minY, y);
    if (clampBounds.maxY !== undefined) y = Math.min(clampBounds.maxY, y);
  }

  return { x, y };
}

function normalizeVec(vec: Vec2): Vec2 {
  const length = Math.sqrt(vec.x * vec.x + vec.y * vec.y) || 1;
  return { x: vec.x / length, y: vec.y / length };
}

function computeInwardNormal(from: Vec2, to: Vec2): Vec2 {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.sqrt(dx * dx + dy * dy) || 1;
  let nx = -dy / length;
  let ny = dx / length;
  const midX = (from.x + to.x) * 0.5;
  const midY = (from.y + to.y) * 0.5;
  const dotToCenter = nx * -midX + ny * -midY;
  if (dotToCenter < 0) {
    nx = -nx;
    ny = -ny;
  }
  return { x: nx, y: ny };
}

// 9-ft table geometry (100" x 50" play area)
// --- Derived jaw geometry helpers (side pockets) ---
const PLAY_HALF_W_IN = 100.0 / 2;
const PLAY_HALF_H_IN = 50.0 / 2;
// Existing felt straight and inner throat Y-levels for north/south (configurable)
const Y_N_PLAY = PLAY_HALF_H_IN;        // 25.0
const Y_S_PLAY = -PLAY_HALF_H_IN;       // -25.0

function deriveSideJawXMagnitudes(
  frameOffset: number,
  referenceRadius: number,
  straightY: number,
  innerY: number,
  maxOuter: number
): { xOuter: number; xInner: number } {
  const f = frameOffset;
  const r = referenceRadius;
  const yTop = Y_N_PLAY + f;
  const under = r * r - f * f;
  if (!(under > 0)) {
    return { xOuter: 6.0, xInner: 2.5 };
  }
  const xi = Math.sqrt(under); // horizontal from center to circle-rect intersection on top

  // Use the tangent line at the circle-rectangle contact point to define jaw direction.
  // Tangent direction at top contact: T = (f, -xi) (points downward and inward)
  // Parameter t to reach target Y: y(t) = yTop + t * (-xi) -> t = (yTop - yTarget) / xi
  const tOuter = (yTop - straightY) / xi;
  const tInner = (yTop - innerY) / xi;
  const xOuter = xi + f * tOuter;
  const xInner = xi + f * tInner;

  // Clamp to sane ranges (must be positive magnitudes and not exceed straight extent near corners)
  const clampPos = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const maxOuterSafe = Math.max(1, Math.min(maxOuter, PLAY_HALF_W_IN - 1));
  const xOuterClamped = clampPos(isFinite(xOuter) ? xOuter : 6.0, 0.5, maxOuterSafe);
  const xInnerClamped = clampPos(isFinite(xInner) ? xInner : 2.5, 0.25, xOuterClamped - 0.25);
  
  return { xOuter: xOuterClamped, xInner: xInnerClamped };
}

// Derive corner jaw geometry using the same tangent approach as side pockets
// Returns the x-coordinate where the horizontal straight section meets the corner
function deriveCornerJawX(
  frameOffset: number,
  referenceRadius: number,
  straightY: number
): number {
  const f = frameOffset;
  const r = referenceRadius;
  const under = Math.max(0, r * r - f * f);
  const xi = Math.sqrt(under);
  
  if (!(xi > 1e-6)) {
    return 46.0; // Fallback to current geometry
  }
  
  // Tangent line from frame edge inward toward straight section
  // Pocket at (50, 25), tangent contact on frame, line goes to (x, 23.5)
  const yFrame = PLAY_HALF_H_IN + f; // 29.0
  
  // Parameter along tangent line to reach Y_N_STRAIGHT
  const s = (yFrame - straightY) / xi;
  const xCorner = PLAY_HALF_W_IN - xi + f * s;
  
  const xClamped = Number.isFinite(xCorner) && xCorner > 0.01 ? xCorner : 46.0;
  return xClamped;
}

// Derive the y-coordinate where vertical straight section meets the corner
function deriveCornerJawY(
  frameOffset: number,
  referenceRadius: number,
  straightX: number,
  fallbackY: number
): number {
  const f = frameOffset;
  const r = referenceRadius;
  const under = Math.max(0, r * r - f * f);
  const xi = Math.sqrt(under);
  
  if (!(xi > 1e-6)) {
    return fallbackY; // Fallback to current geometry
  }
  
  // Parameter along tangent line to reach X_E_STRAIGHT (48.5)
  const xFrame = PLAY_HALF_W_IN + f; // 54.0
  const s = (xFrame - straightX) / xi;
  const yCorner = PLAY_HALF_H_IN - xi + f * s;
  
  const yClamped = Number.isFinite(yCorner) && yCorner > 0.01 ? yCorner : fallbackY;
  return yClamped;
}

export function getTableGeometry(): TableGeometry {
  // Recompute on demand from current CONFIG values
  const sideStraight = Math.max(0, CONFIG.SIDE_STRAIGHT_Y_IN);
  const sideInner = Math.max(sideStraight + 0.05, CONFIG.SIDE_INNER_Y_IN);
  const cornerStraight = Math.max(0, CONFIG.CORNER_STRAIGHT_X_IN);
  const cornerFrameOffset = CONFIG.CORNER_FRAME_OFFSET_IN ?? CONFIG.FRAME_OFFSET_IN;
  const maxSideJawOuter = Math.max(1, cornerStraight - 0.25);

  const sideJawDerived = deriveSideJawXMagnitudes(
    CONFIG.SIDE_FRAME_OFFSET_IN,
    CONFIG.JAW_REF_RADIUS_IN,
    sideStraight,
    sideInner,
    maxSideJawOuter
  );

  const derivedOuter = clamp(sideJawDerived.xOuter, 1, maxSideJawOuter);
  const outerOverride = CONFIG.SIDE_JAW_OUTER_OVERRIDE_IN;
  const JAW_X_OUTER = clamp(outerOverride ?? derivedOuter, 1, maxSideJawOuter);

  const derivedInner = clamp(sideJawDerived.xInner, 0.5, JAW_X_OUTER - 0.25);
  const throatWidthOverride = CONFIG.SIDE_THROAT_WIDTH_IN != null
    ? clamp(CONFIG.SIDE_THROAT_WIDTH_IN * 0.5, 0.5, JAW_X_OUTER - 0.25)
    : null;
  const innerOverride = CONFIG.SIDE_JAW_INNER_OVERRIDE_IN;
  const JAW_X_INNER = clamp(innerOverride ?? throatWidthOverride ?? derivedInner, 0.5, JAW_X_OUTER - 0.25);

  const cornerJawYRaw = deriveCornerJawY(
    cornerFrameOffset,
    CONFIG.CORNER_JAW_REF_RADIUS_IN,
    cornerStraight,
    CONFIG.CORNER_TARGET_Y_IN
  );
  const cornerJawYOverride = CONFIG.CORNER_JAW_Y_OVERRIDE_IN;
  const cornerThroatOverride = CONFIG.CORNER_THROAT_WIDTH_IN != null
    ? clamp(CONFIG.CORNER_THROAT_WIDTH_IN * 0.5, 1, sideStraight - 0.25)
    : null;
  const cornerJawYDerived = clamp(cornerJawYRaw, 1, sideStraight - 0.25);
  const CORNER_JAW_Y = clamp(
    cornerJawYOverride ?? cornerThroatOverride ?? cornerJawYDerived,
    1,
    sideStraight - 0.25
  );
  const cornerJawXRaw = deriveCornerJawX(
    cornerFrameOffset,
    CONFIG.CORNER_JAW_REF_RADIUS_IN,
    sideStraight
  );
  const cornerJawXDerived = clamp(cornerJawXRaw, 1, cornerStraight - 0.25);
  const cornerJawXOverride = CONFIG.CORNER_JAW_X_OVERRIDE_IN;
  const CORNER_JAW_X = clamp(cornerJawXOverride ?? cornerJawXDerived, 1, cornerStraight - 0.25);

  const Y_N_STRAIGHT = sideStraight;
  const Y_S_STRAIGHT = -sideStraight;
  const Y_N_INNER = sideInner;
  const Y_S_INNER = -sideInner;
  const X_E_STRAIGHT = cornerStraight;
  const X_W_STRAIGHT = -cornerStraight;
  const SIDE_POCKET_OFFSET = CONFIG.SIDE_POCKET_OUTWARD_OFFSET_IN;
  const curveBlend = clamp01(CONFIG.JAW_CURVE_BLEND ?? 0);
  const mouthYNorth = PLAY_HALF_H_IN;
  const mouthYSouth = -PLAY_HALF_H_IN;
  const throatJoinX = clamp(
    JAW_X_INNER * (1 - 0.35 * curveBlend),
    0.5,
    Math.max(0.5, JAW_X_OUTER - 0.1)
  );
  const throatMaxYNorth = Math.max(Y_N_INNER, mouthYNorth - 0.05);
  const throatJoinYNorth = clamp(
    Y_N_INNER + (mouthYNorth - Y_N_INNER) * (0.5 * curveBlend),
    Y_N_INNER,
    throatMaxYNorth
  );
  const throatJoinYSouth = -throatJoinYNorth;

  const rails: RailDef[] = [];
  const addRail = (id: string, from: Vec2, to: Vec2) => {
    rails.push({
      id,
      from,
      to,
      normal: computeInwardNormal(from, to),
    });
  };

  const outerX = PLAY_HALF_W_IN + cornerFrameOffset;
  const outerY = PLAY_HALF_H_IN + cornerFrameOffset;
  const frameCornerRadius = Math.max(
    0,
    Math.min(CONFIG.FRAME_CORNER_RADIUS_IN ?? 0, CONFIG.FRAME_OFFSET_IN, cornerFrameOffset)
  );
  const cornerPoint = (signX: 1 | -1, signY: 1 | -1, axis: 'horizontal' | 'vertical'): Vec2 => {
    const baseX = signX * outerX;
    const baseY = signY * outerY;
    if (frameCornerRadius <= 0) {
      return { x: baseX, y: baseY };
    }
    if (axis === 'horizontal') {
      return { x: baseX - signX * frameCornerRadius, y: baseY };
    }
    return { x: baseX, y: baseY - signY * frameCornerRadius };
  };

  let northWestOuterTop = cornerPoint(-1, 1, 'horizontal');
  let northWestOuterWest = cornerPoint(-1, 1, 'vertical');
  let northEastOuterTop = cornerPoint(1, 1, 'horizontal');
  let northEastOuterEast = cornerPoint(1, 1, 'vertical');
  let southEastOuterBottom = cornerPoint(1, -1, 'horizontal');
  let southEastOuterEast = cornerPoint(1, -1, 'vertical');
  let southWestOuterBottom = cornerPoint(-1, -1, 'horizontal');
  let southWestOuterWest = cornerPoint(-1, -1, 'vertical');

  const baseNorthCornerWest: Vec2 = { x: -CORNER_JAW_X, y: Y_N_STRAIGHT };
  const baseNorthCornerEast: Vec2 = { x: CORNER_JAW_X, y: Y_N_STRAIGHT };
  const baseSouthCornerEast: Vec2 = { x: CORNER_JAW_X, y: Y_S_STRAIGHT };
  const baseSouthCornerWest: Vec2 = { x: -CORNER_JAW_X, y: Y_S_STRAIGHT };
  let northCornerWest: Vec2 = { ...baseNorthCornerWest };
  let northCornerEast: Vec2 = { ...baseNorthCornerEast };
  let southCornerEast: Vec2 = { ...baseSouthCornerEast };
  let southCornerWest: Vec2 = { ...baseSouthCornerWest };

  const northStraightWestEnd: Vec2 = { x: -JAW_X_OUTER, y: Y_N_STRAIGHT };
  const northStraightEastStart: Vec2 = { x: JAW_X_OUTER, y: Y_N_STRAIGHT };
  const southStraightEastStart: Vec2 = { x: JAW_X_OUTER, y: Y_S_STRAIGHT };
  const southStraightWestEnd: Vec2 = { x: -JAW_X_OUTER, y: Y_S_STRAIGHT };

  let northThroatLeftJoint: Vec2 = { x: -throatJoinX, y: throatJoinYNorth };
  let northThroatRightJoint: Vec2 = { x: throatJoinX, y: throatJoinYNorth };
  const northMouth: Vec2 = { x: 0, y: mouthYNorth };
  let southThroatRightJoint: Vec2 = { x: throatJoinX, y: throatJoinYSouth };
  let southThroatLeftJoint: Vec2 = { x: -throatJoinX, y: throatJoinYSouth };
  const southMouth: Vec2 = { x: 0, y: mouthYSouth };

  const baseEastVerticalTop: Vec2 = { x: X_E_STRAIGHT, y: CORNER_JAW_Y };
  const baseEastVerticalBottom: Vec2 = { x: X_E_STRAIGHT, y: -CORNER_JAW_Y };
  const baseWestVerticalTop: Vec2 = { x: X_W_STRAIGHT, y: CORNER_JAW_Y };
  const baseWestVerticalBottom: Vec2 = { x: X_W_STRAIGHT, y: -CORNER_JAW_Y };
  let eastVerticalTop: Vec2 = { ...baseEastVerticalTop };
  let eastVerticalBottom: Vec2 = { ...baseEastVerticalBottom };
  let westVerticalTop: Vec2 = { ...baseWestVerticalTop };
  let westVerticalBottom: Vec2 = { ...baseWestVerticalBottom };

  const sideCutDeg = clamp(CONFIG.SIDE_CUT_ANGLE_DEG ?? 0, -45, 45);
  const sideCutRad = degToRad(sideCutDeg);
  const sidePivotMagnitude = clamp(
    CONFIG.SIDE_CUT_ROTATION_PIVOT_IN ?? sideStraight,
    sideStraight,
    mouthYNorth
  );

  if (sideCutRad !== 0) {
    const pivotNorth: Vec2 = { x: 0, y: sidePivotMagnitude };
    const rotatedNorthRight = rotatePoint(northThroatRightJoint, pivotNorth, sideCutRad);
    const clampedNorthRight: Vec2 = {
      x: clamp(rotatedNorthRight.x, 0.5, JAW_X_OUTER - 0.05),
      y: clamp(rotatedNorthRight.y, Y_N_STRAIGHT, mouthYNorth - 0.01),
    };
    northThroatRightJoint = clampedNorthRight;
    northThroatLeftJoint = { x: -clampedNorthRight.x, y: clampedNorthRight.y };

    const pivotSouth: Vec2 = { x: 0, y: -sidePivotMagnitude };
    const rotatedSouthRight = rotatePoint(southThroatRightJoint, pivotSouth, -sideCutRad);
    const clampedSouthRight: Vec2 = {
      x: clamp(rotatedSouthRight.x, 0.5, JAW_X_OUTER - 0.05),
      y: clamp(rotatedSouthRight.y, mouthYSouth + 0.01, Y_S_STRAIGHT),
    };
    southThroatRightJoint = clampedSouthRight;
    southThroatLeftJoint = { x: -clampedSouthRight.x, y: clampedSouthRight.y };
  }

  const cornerCutDeg = clamp(CONFIG.CORNER_CUT_ANGLE_DEG ?? 0, -45, 45);
  const cornerCutRad = degToRad(cornerCutDeg);
  if (Math.abs(cornerCutRad) > 1e-6) {
    const pivotNE: Vec2 = { x: PLAY_HALF_W_IN, y: PLAY_HALF_H_IN };
    const pivotNW: Vec2 = { x: -PLAY_HALF_W_IN, y: PLAY_HALF_H_IN };
    const pivotSE: Vec2 = { x: PLAY_HALF_W_IN, y: -PLAY_HALF_H_IN };
    const pivotSW: Vec2 = { x: -PLAY_HALF_W_IN, y: -PLAY_HALF_H_IN };

    const rotateCorner = (
      pivot: Vec2,
      baseHorizontal: Vec2,
      axisY: number,
      horizontalClamp: AxisBounds,
      baseVertical: Vec2,
      axisX: number,
      verticalClamp: AxisBounds
    ): { horizontal: Vec2; vertical: Vec2 } => {
      const sign = Math.sign(pivot.x) * Math.sign(pivot.y) || 1;
      const angle = cornerCutRad * sign;
      return {
        horizontal: rotateTowardAxis(pivot, baseHorizontal, angle, 'y', axisY, horizontalClamp),
        vertical: rotateTowardAxis(pivot, baseVertical, angle, 'x', axisX, verticalClamp),
      };
    };

    const ne = rotateCorner(
      pivotNE,
      baseNorthCornerEast,
      Y_N_STRAIGHT,
      { minX: JAW_X_OUTER, maxX: pivotNE.x - 0.05 },
      baseEastVerticalTop,
      X_E_STRAIGHT,
      { minY: CORNER_JAW_Y, maxY: pivotNE.y - 0.05 }
    );
    northCornerEast = ne.horizontal;
    eastVerticalTop = ne.vertical;

    const nw = rotateCorner(
      pivotNW,
      baseNorthCornerWest,
      Y_N_STRAIGHT,
      { minX: pivotNW.x + 0.05, maxX: -JAW_X_OUTER },
      baseWestVerticalTop,
      X_W_STRAIGHT,
      { minY: CORNER_JAW_Y, maxY: pivotNW.y - 0.05 }
    );
    northCornerWest = nw.horizontal;
    westVerticalTop = nw.vertical;

    const se = rotateCorner(
      pivotSE,
      baseSouthCornerEast,
      Y_S_STRAIGHT,
      { minX: JAW_X_OUTER, maxX: pivotSE.x - 0.05 },
      baseEastVerticalBottom,
      X_E_STRAIGHT,
      { minY: pivotSE.y + 0.05, maxY: -CORNER_JAW_Y }
    );
    southCornerEast = se.horizontal;
    eastVerticalBottom = se.vertical;

    const sw = rotateCorner(
      pivotSW,
      baseSouthCornerWest,
      Y_S_STRAIGHT,
      { minX: pivotSW.x + 0.05, maxX: -JAW_X_OUTER },
      baseWestVerticalBottom,
      X_W_STRAIGHT,
      { minY: pivotSW.y + 0.05, maxY: -CORNER_JAW_Y }
    );
    southCornerWest = sw.horizontal;
    westVerticalBottom = sw.vertical;
  } else {
    northCornerEast = { ...baseNorthCornerEast };
    eastVerticalTop = { ...baseEastVerticalTop };
    northCornerWest = { ...baseNorthCornerWest };
    westVerticalTop = { ...baseWestVerticalTop };
    southCornerEast = { ...baseSouthCornerEast };
    eastVerticalBottom = { ...baseEastVerticalBottom };
    southCornerWest = { ...baseSouthCornerWest };
    westVerticalBottom = { ...baseWestVerticalBottom };
  }

  const effectiveFrameCornerRadius = Math.max(0, Math.min(CONFIG.FRAME_CORNER_RADIUS_IN ?? 0, CONFIG.FRAME_OFFSET_IN));
  if (effectiveFrameCornerRadius > EPSILON) {
    const cornerCenters = {
      NW: {
        x: -(PLAY_HALF_W_IN + cornerFrameOffset) + effectiveFrameCornerRadius,
        y: PLAY_HALF_H_IN + cornerFrameOffset - effectiveFrameCornerRadius,
      },
      NE: {
        x: PLAY_HALF_W_IN + cornerFrameOffset - effectiveFrameCornerRadius,
        y: PLAY_HALF_H_IN + cornerFrameOffset - effectiveFrameCornerRadius,
      },
      SE: {
        x: PLAY_HALF_W_IN + cornerFrameOffset - effectiveFrameCornerRadius,
        y: -(PLAY_HALF_H_IN + cornerFrameOffset) + effectiveFrameCornerRadius,
      },
      SW: {
        x: -(PLAY_HALF_W_IN + cornerFrameOffset) + effectiveFrameCornerRadius,
        y: -(PLAY_HALF_H_IN + cornerFrameOffset) + effectiveFrameCornerRadius,
      },
    };
    const trim = (inner: Vec2, outer: Vec2, center: Vec2): Vec2 => {
      const hit = intersectWithArc(inner, outer, center, effectiveFrameCornerRadius);
      return hit ?? outer;
    };

    northWestOuterTop = trim(northCornerWest, northWestOuterTop, cornerCenters.NW);
    northWestOuterWest = trim(westVerticalTop, northWestOuterWest, cornerCenters.NW);
    northEastOuterTop = trim(northCornerEast, northEastOuterTop, cornerCenters.NE);
    northEastOuterEast = trim(eastVerticalTop, northEastOuterEast, cornerCenters.NE);
    southEastOuterBottom = trim(southCornerEast, southEastOuterBottom, cornerCenters.SE);
    southEastOuterEast = trim(eastVerticalBottom, southEastOuterEast, cornerCenters.SE);
    southWestOuterBottom = trim(southCornerWest, southWestOuterBottom, cornerCenters.SW);
    southWestOuterWest = trim(westVerticalBottom, southWestOuterWest, cornerCenters.SW);
  }

  addRail('N_west_taper', northWestOuterTop, northCornerWest);
  addRail('N_west_straight', northCornerWest, northStraightWestEnd);
  addRail('N_left_throat_outer', northStraightWestEnd, northThroatLeftJoint);
  addRail('N_left_throat_inner', northThroatLeftJoint, northMouth);
  addRail('N_right_throat_inner', northMouth, northThroatRightJoint);
  addRail('N_right_throat_outer', northThroatRightJoint, northStraightEastStart);
  addRail('N_east_straight', northStraightEastStart, northCornerEast);
  addRail('N_east_taper', northCornerEast, northEastOuterTop);

  addRail('E_north_taper', northEastOuterEast, eastVerticalTop);
  addRail('E_center', eastVerticalTop, eastVerticalBottom);
  addRail('E_south_taper', eastVerticalBottom, southEastOuterEast);

  addRail('S_east_taper', southEastOuterBottom, southCornerEast);
  addRail('S_east_straight', southCornerEast, southStraightEastStart);
  addRail('S_right_throat_outer', southStraightEastStart, southThroatRightJoint);
  addRail('S_right_throat_inner', southThroatRightJoint, southMouth);
  addRail('S_left_throat_inner', southMouth, southThroatLeftJoint);
  addRail('S_left_throat_outer', southThroatLeftJoint, southStraightWestEnd);
  addRail('S_west_straight', southStraightWestEnd, southCornerWest);
  addRail('S_west_taper', southCornerWest, southWestOuterBottom);

  addRail('W_south_taper', southWestOuterWest, westVerticalBottom);
  addRail('W_center', westVerticalBottom, westVerticalTop);
  addRail('W_north_taper', westVerticalTop, northWestOuterWest);

  const pocketCenterNW: Vec2 = { x: -PLAY_HALF_W_IN, y: PLAY_HALF_H_IN };
  const pocketCenterNE: Vec2 = { x: PLAY_HALF_W_IN, y: PLAY_HALF_H_IN };
  const pocketCenterSW: Vec2 = { x: -PLAY_HALF_W_IN, y: -PLAY_HALF_H_IN };
  const pocketCenterSE: Vec2 = { x: PLAY_HALF_W_IN, y: -PLAY_HALF_H_IN };
  const pocketCenterNorth: Vec2 = { x: 0, y: Y_N_PLAY + SIDE_POCKET_OFFSET };
  const pocketCenterSouth: Vec2 = { x: 0, y: Y_S_PLAY - SIDE_POCKET_OFFSET };

  const cornerHintNW = normalizeVec({
    x: pocketCenterNW.x - northCornerWest.x,
    y: pocketCenterNW.y - northCornerWest.y,
  });
  const cornerHintNE = normalizeVec({
    x: pocketCenterNE.x - northCornerEast.x,
    y: pocketCenterNE.y - northCornerEast.y,
  });
  const cornerHintSW = normalizeVec({
    x: pocketCenterSW.x - southCornerWest.x,
    y: pocketCenterSW.y - southCornerWest.y,
  });
  const cornerHintSE = normalizeVec({
    x: pocketCenterSE.x - southCornerEast.x,
    y: pocketCenterSE.y - southCornerEast.y,
  });

  const sideHintNorth = normalizeVec({
    x: pocketCenterNorth.x - northThroatRightJoint.x,
    y: pocketCenterNorth.y - northThroatRightJoint.y,
  });
  const sideHintSouth = normalizeVec({
    x: pocketCenterSouth.x - southThroatRightJoint.x,
    y: pocketCenterSouth.y - southThroatRightJoint.y,
  });

  return {
    playWidthIn: 100.0,
    playHeightIn: 50.0,
    cushionProfileIn: 1.75,
    pocketCaptureRadiusIn: CONFIG.POCKET_CAPTURE_RADIUS_CORNER,
    cornerPocketCaptureRadiusIn: CONFIG.POCKET_CAPTURE_RADIUS_CORNER,
    sidePocketCaptureRadiusIn: CONFIG.POCKET_CAPTURE_RADIUS_SIDE,
    cornerPocketVisualRadiusIn: CONFIG.POCKET_VISUAL_RADIUS_CORNER,
    sidePocketVisualRadiusIn: CONFIG.POCKET_VISUAL_RADIUS_SIDE,
    pocketShelfDepthIn: CONFIG.POCKET_SHELF_DEPTH_IN,

    // Rails approximating WPA throat geometry, normals point inward
    // Corner rails stop short of pocket centers to leave openings
    rails,
    
    // Pockets at corners and midpoints
    pockets: [
      {
        id: 'NW_corner',
        center: { x: -50.0, y: 25.0 },
        cutNormalHint: cornerHintNW,
        cutAngleDeg: CONFIG.CORNER_CUT_ANGLE_DEG,
        captureRadius: CONFIG.POCKET_CAPTURE_RADIUS_CORNER,
        visualRadius: CONFIG.POCKET_VISUAL_RADIUS_CORNER,
        shelfDepth: CONFIG.POCKET_SHELF_DEPTH_IN,
        radius: CONFIG.POCKET_VISUAL_RADIUS_CORNER,
      },
      {
        id: 'NE_corner',
        center: { x: 50.0, y: 25.0 },
        cutNormalHint: cornerHintNE,
        cutAngleDeg: CONFIG.CORNER_CUT_ANGLE_DEG,
        captureRadius: CONFIG.POCKET_CAPTURE_RADIUS_CORNER,
        visualRadius: CONFIG.POCKET_VISUAL_RADIUS_CORNER,
        shelfDepth: CONFIG.POCKET_SHELF_DEPTH_IN,
        radius: CONFIG.POCKET_VISUAL_RADIUS_CORNER,
      },
      {
        id: 'SW_corner',
        center: { x: -50.0, y: -25.0 },
        cutNormalHint: cornerHintSW,
        cutAngleDeg: CONFIG.CORNER_CUT_ANGLE_DEG,
        captureRadius: CONFIG.POCKET_CAPTURE_RADIUS_CORNER,
        visualRadius: CONFIG.POCKET_VISUAL_RADIUS_CORNER,
        shelfDepth: CONFIG.POCKET_SHELF_DEPTH_IN,
        radius: CONFIG.POCKET_VISUAL_RADIUS_CORNER,
      },
      {
        id: 'SE_corner',
        center: { x: 50.0, y: -25.0 },
        cutNormalHint: cornerHintSE,
        cutAngleDeg: CONFIG.CORNER_CUT_ANGLE_DEG,
        captureRadius: CONFIG.POCKET_CAPTURE_RADIUS_CORNER,
        visualRadius: CONFIG.POCKET_VISUAL_RADIUS_CORNER,
        shelfDepth: CONFIG.POCKET_SHELF_DEPTH_IN,
        radius: CONFIG.POCKET_VISUAL_RADIUS_CORNER,
      },
      {
        id: 'N_middle',
        center: { x: 0.0, y: Y_N_PLAY + SIDE_POCKET_OFFSET },
        cutNormalHint: sideHintNorth,
        cutAngleDeg: CONFIG.SIDE_CUT_ANGLE_DEG,
        captureRadius: CONFIG.POCKET_CAPTURE_RADIUS_SIDE,
        visualRadius: CONFIG.POCKET_VISUAL_RADIUS_SIDE,
        shelfDepth: CONFIG.POCKET_SHELF_DEPTH_IN,
        radius: CONFIG.POCKET_VISUAL_RADIUS_SIDE,
      },
      {
        id: 'S_middle',
        center: { x: 0.0, y: Y_S_PLAY - SIDE_POCKET_OFFSET },
        cutNormalHint: sideHintSouth,
        cutAngleDeg: CONFIG.SIDE_CUT_ANGLE_DEG,
        captureRadius: CONFIG.POCKET_CAPTURE_RADIUS_SIDE,
        visualRadius: CONFIG.POCKET_VISUAL_RADIUS_SIDE,
        shelfDepth: CONFIG.POCKET_SHELF_DEPTH_IN,
        radius: CONFIG.POCKET_VISUAL_RADIUS_SIDE,
      },
    ]
  };
}

// Coordinate transforms
export interface CanvasPoint {
  x: number;
  y: number;
}

export class CoordinateTransform {
  private scale: number;
  private canvasCenterX: number;
  private canvasCenterY: number;
  
  constructor(scale: number, canvasCenterX: number, canvasCenterY: number) {
    this.scale = scale;
    this.canvasCenterX = canvasCenterX;
    this.canvasCenterY = canvasCenterY;
  }
  
  updateScale(scale: number, canvasCenterX: number, canvasCenterY: number) {
    this.scale = scale;
    this.canvasCenterX = canvasCenterX;
    this.canvasCenterY = canvasCenterY;
  }
  
  // World (Y-up, center origin) to Canvas (Y-down, top-left origin)
  worldToCanvas(world: Vec2): CanvasPoint {
    return {
      x: this.canvasCenterX + this.scale * world.x,
      y: this.canvasCenterY - this.scale * world.y // Flip Y
    };
  }
  
  // Canvas to World
  canvasToWorld(canvas: CanvasPoint): Vec2 {
    return {
      x: (canvas.x - this.canvasCenterX) / this.scale,
      y: -(canvas.y - this.canvasCenterY) / this.scale // Flip Y
    };
  }
  
  // Transform a distance (no translation, just scale)
  worldDistanceToCanvas(worldDist: number): number {
    return this.scale * worldDist;
  }
  
  canvasDistanceToWorld(canvasDist: number): number {
    return canvasDist / this.scale;
  }
}
