
// Geometry Contract: Authoritative coordinate system and table layout
// Origin (0,0) at play-area center; +X right (East), +Y up (North/head)

import { CONFIG } from '../config';
import basePhysicsJson from './table.physics.json'; // Import Pre-processed Physics JSON

const PHYSICS_JSON_OVERRIDE_KEY = 'railrush.physicsJsonOverride';
let storedPhysicsJsonOverride: any | null = null;
let sessionPhysicsJsonOverride: any | null = null;
let overrideLoaded = false;

function loadPhysicsJsonOverrideFromStorage(): void {
  if (overrideLoaded) return;
  overrideLoaded = true;
  try {
    const raw = localStorage.getItem(PHYSICS_JSON_OVERRIDE_KEY);
    if (raw) storedPhysicsJsonOverride = JSON.parse(raw);
  } catch {
    // ignore
  }
}

export function setPhysicsJsonOverride(override: any | null, options?: { persist?: boolean }): void {
  sessionPhysicsJsonOverride = override;

  try {
    if (options?.persist) {
      storedPhysicsJsonOverride = override;
      if (override) localStorage.setItem(PHYSICS_JSON_OVERRIDE_KEY, JSON.stringify(override));
      else localStorage.removeItem(PHYSICS_JSON_OVERRIDE_KEY);
    }
  } catch {
    // ignore
  }

  resetTableGeometryCache();
}

export function getPhysicsJsonOverride(): any | null {
  loadPhysicsJsonOverrideFromStorage();
  return sessionPhysicsJsonOverride ?? storedPhysicsJsonOverride;
}


export interface Vec2 {
  x: number;
  y: number;
}

export interface RailDef {
  id: string;
  from: Vec2;
  to: Vec2;
  normal: Vec2; // Points inward to play area
  outline?: Vec2[];
}

export interface FrameCorner {
  horizontal: Vec2;
  vertical: Vec2;
}

export interface FrameOutline {
  outerHalfWidth: number;
  outerHalfHeight: number;
  innerHalfWidth: number;
  innerHalfHeight: number;
  cornerRadius: number;
  corners: {
    northWest: FrameCorner;
    northEast: FrameCorner;
    southEast: FrameCorner;
    southWest: FrameCorner;
  };
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
  frameOutline: FrameOutline;
  pockets: PocketDef[];
  // New properties for SVG-based geometry, or procedural fallbacks
  cornerPocketWidthIn: number;
  cornerPocketDepthIn: number;
  cornerPocketRadiusIn: number;
  sidePocketWidthIn: number;
  sidePocketDepthIn: number;
  sidePocketRadiusIn: number;
  cornerJawRadiusIn: number;
  sideJawRadiusIn: number;
  pixelsPerInch?: number; // Optional, from source JSON
}

const isFiniteVec2 = (p: Vec2): boolean => Number.isFinite(p.x) && Number.isFinite(p.y);

const rectangleFromBounds = (minX: number, maxX: number, minY: number, maxY: number): Vec2[] => ([
  { x: minX, y: minY },
  { x: maxX, y: minY },
  { x: maxX, y: maxY },
  { x: minX, y: maxY },
]);

const defaultPlayRectangle = (): Vec2[] => {
  const halfW = (CONFIG.TABLE_WIDTH ?? 100) * 0.5;
  const halfH = (CONFIG.TABLE_HEIGHT ?? 50) * 0.5;
  return rectangleFromBounds(-halfW, halfW, -halfH, halfH);
};

export function computePlayBoundaryPoints(rails: RailDef[]): Vec2[] {
  // Prefer rails originating from play_area if present (added by SVG parser), otherwise use all rails
  // Prefer detailed cushion rails if present
  const cushionRails = rails.filter(r => r.id.includes('cushion'));
  const playAreaRails = rails.filter(r => r.id.includes('play_area'));

  // Priority: Cushions (detailed) -> Play Area (simple rect) -> All (fallback)
  const sourceRails = cushionRails.length >= 3 ? cushionRails : (playAreaRails.length >= 3 ? playAreaRails : rails);

  // Extract valid points (both ends of each rail segment)
  const rawPoints = sourceRails.flatMap(r => [r.from, r.to]).filter(isFiniteVec2);

  // Deduplicate to avoid extremely dense shapes or repeated NaNs
  const seen = new Set<string>();
  const points: Vec2[] = [];
  rawPoints.forEach((p) => {
    const key = `${p.x.toFixed(6)},${p.y.toFixed(6)}`;
    if (!seen.has(key)) {
      seen.add(key);
      points.push(p);
    }
  });

  // Fallback to a simple rectangle if we don't have enough points to form a polygon
  if (points.length < 3) {
    if (points.length > 0) {
      const minX = Math.min(...points.map(p => p.x));
      const maxX = Math.max(...points.map(p => p.x));
      const minY = Math.min(...points.map(p => p.y));
      const maxY = Math.max(...points.map(p => p.y));
      // Guard against degenerate bounds
      if (Number.isFinite(minX) && Number.isFinite(maxX) && Number.isFinite(minY) && Number.isFinite(maxY)) {
        return rectangleFromBounds(minX, maxX, minY, maxY);
      }
    }
    return defaultPlayRectangle();
  }

  // Robustly sort points to form a valid polygon for the play area (felt).
  // Handles both ordered procedural rails and potentially disordered SVG rail segments.
  const centerX = points.reduce((s, p) => s + p.x, 0) / points.length;
  const centerY = points.reduce((s, p) => s + p.y, 0) / points.length;

  points.sort((a, b) => {
    return Math.atan2(a.y - centerY, a.x - centerX) - Math.atan2(b.y - centerY, b.x - centerX);
  });

  return points;
}

export interface BoundaryBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
}

export function computeBoundaryBounds(points: Vec2[]): BoundaryBounds {
  const valid = points.filter(isFiniteVec2);
  if (!valid.length) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
  }

  let minX = valid[0].x;
  let maxX = valid[0].x;
  let minY = valid[0].y;
  let maxY = valid[0].y;

  for (let i = 1; i < valid.length; i++) {
    const { x, y } = valid[i];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  return {
    minX, maxX, minY, maxY,
    width: maxX - minX,
    height: maxY - minY
  };
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
const clamp01 = (value: number): number => clamp(value, 0, 1);
const degToRad = (deg: number): number => (deg * Math.PI) / 180;

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

function shouldTreatOutlineClosed(outline: Vec2[]): boolean {
  if (!Array.isArray(outline) || outline.length < 3) return false;
  const first = outline[0];
  const last = outline[outline.length - 1];
  if (!isFiniteVec2(first) || !isFiniteVec2(last)) return false;

  const closingLen = Math.hypot(first.x - last.x, first.y - last.y);
  // Explicitly closed (common case).
  if (closingLen < 1e-6) return true;

  // Table-editor safety: only infer closure when the endpoints are physically close.
  // Avoids creating a long "ghost edge" that can clamp/split rails in the wrong direction.
  return closingLen <= 2.0;
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

/** Clamp a rail to cushion outlines (used before splitting rails near pockets). */
function clampRailToCushions(rail: RailDef, cushions: RailDef[]): RailDef {
  const dx = rail.to.x - rail.from.x;
  const dy = rail.to.y - rail.from.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-4) return rail;

  const intersections: number[] = [];
  const segmentIntersect = (a: Vec2, b: Vec2, c: Vec2, d: Vec2): number | null => {
    const den = (a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x);
    if (Math.abs(den) < 1e-8) return null; // parallel or colinear
    const t = ((a.x - c.x) * (c.y - d.y) - (a.y - c.y) * (c.x - d.x)) / den;
    const u = ((a.x - c.x) * (a.y - b.y) - (a.y - c.y) * (a.x - b.x)) / den;
    if (t < -1e-4 || t > 1 + 1e-4 || u < -1e-4 || u > 1 + 1e-4) return null;
    return t;
  };

  (cushions || []).forEach((c) => {
    const outlineRaw = Array.isArray(c.outline) && c.outline.length > 1 ? c.outline : [c.from, c.to];
    const outline = outlineRaw.filter(isFiniteVec2);
    if (outline.length < 2) return;

    const treatClosed = shouldTreatOutlineClosed(outline);
    const edgeCount = treatClosed ? outline.length : outline.length - 1;
    for (let i = 0; i < edgeCount; i++) {
      const p1 = outline[i];
      const p2 = treatClosed ? outline[(i + 1) % outline.length] : outline[i + 1];
      if (!isFiniteVec2(p1) || !isFiniteVec2(p2)) continue;
      const t = segmentIntersect(rail.from, rail.to, p1, p2);
      if (t != null) intersections.push(t);
    }
  });

  if (intersections.length < 2) return rail;
  const minT = Math.max(0, Math.min(...intersections));
  const maxT = Math.min(1, Math.max(...intersections));
  if (maxT - minT < 1e-4) return rail;
  const lerpPoint = (t: number) => ({
    x: rail.from.x + dx * t,
    y: rail.from.y + dy * t,
  });
  return { ...rail, from: lerpPoint(minT), to: lerpPoint(maxT) };
}

/** Split a rail so it leaves gaps around pockets (prevents blocked pocket openings). */
function splitRailByPockets(rail: RailDef, pockets: PocketDef[], cushions: RailDef[], jawRails: RailDef[] = []): RailDef[] {
  const clamped = clampRailToCushions(rail, cushions);
  const dx = clamped.to.x - clamped.from.x;
  const dy = clamped.to.y - clamped.from.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-4) return [clamped];
  const ux = dx / len;
  const uy = dy / len;

  const lerpPoint = (t: number) => ({
    x: clamped.from.x + dx * t,
    y: clamped.from.y + dy * t,
  });

  const gaps: [number, number][] = [];

  // For axis-aligned play-area rails, compute the expected pocket-mouth intersection parameters.
  // This lets us ignore jaw-derived intersections that don't match the actual pocket circle geometry,
  // which can happen with table-editor cushion outlines (they're often decorative / not authoritative).
  const computePocketMouthTs = (): number[] => {
    const ts: number[] = [];
    const epsAxis = 1e-4;
    const isHorizontal = Math.abs(dy) < epsAxis;
    const isVertical = Math.abs(dx) < epsAxis;
    if (!isHorizontal && !isVertical) return ts;

    const y0 = clamped.from.y;
    const x0 = clamped.from.x;

    for (const p of pockets || []) {
      if (!isFiniteVec2(p?.center) || !Number.isFinite(p.radius)) continue;
      const r = p.radius;

      if (isHorizontal) {
        const dyc = p.center.y - y0;
        if (Math.abs(dyc) >= r) continue;
        const span = Math.sqrt(Math.max(0, r * r - dyc * dyc));
        for (const x of [p.center.x - span, p.center.x + span]) {
          const t = (x - x0) / dx;
          if (Number.isFinite(t) && t >= -1e-4 && t <= 1 + 1e-4) ts.push(Math.max(0, Math.min(1, t)));
        }
      } else if (isVertical) {
        const dxc = p.center.x - x0;
        if (Math.abs(dxc) >= r) continue;
        const span = Math.sqrt(Math.max(0, r * r - dxc * dxc));
        for (const y of [p.center.y - span, p.center.y + span]) {
          const t = (y - clamped.from.y) / dy;
          if (Number.isFinite(t) && t >= -1e-4 && t <= 1 + 1e-4) ts.push(Math.max(0, Math.min(1, t)));
        }
      }
    }

    ts.sort((a, b) => a - b);
    // De-dupe
    return ts.filter((t, idx) => idx === 0 || Math.abs(t - ts[idx - 1]) > 2e-3);
  };

  // Prefer cutting openings using derived jaw segments (from cushion outlines).
  // This keeps the straight play-area rails from leaking into the pocket mouth.
  if (jawRails && jawRails.length) {
    const jawTs: number[] = [];
    const segmentIntersectParam = (a: Vec2, b: Vec2, c: Vec2, d: Vec2): number | null => {
      const den = (a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x);
      if (Math.abs(den) < 1e-8) return null; // parallel or colinear
      const t = ((a.x - c.x) * (c.y - d.y) - (a.y - c.y) * (c.x - d.x)) / den;
      const u = ((a.x - c.x) * (a.y - b.y) - (a.y - c.y) * (a.x - b.x)) / den;
      if (t < -1e-4 || t > 1 + 1e-4 || u < -1e-4 || u > 1 + 1e-4) return null;
      return t;
    };

    for (const j of jawRails) {
      if (!isFiniteVec2(j?.from) || !isFiniteVec2(j?.to)) continue;
      const t = segmentIntersectParam(clamped.from, clamped.to, j.from, j.to);
      if (t != null) jawTs.push(Math.max(0, Math.min(1, t)));
    }

    jawTs.sort((a, b) => a - b);

    // Filter jaw intersections to those consistent with pocket-mouth locations for this rail.
    // This avoids "wrong-direction" trims caused by outline edges near corners that are not part of the true mouth.
    const pocketMouthTs = computePocketMouthTs();
    const jawTsFiltered = pocketMouthTs.length
      ? jawTs.filter((t) => pocketMouthTs.some((pm) => Math.abs(pm - t) <= 0.04))
      : jawTs;

    const uniqueJawTs = jawTsFiltered.filter((t, idx) => idx === 0 || Math.abs(t - jawTsFiltered[idx - 1]) > 1e-4);

    const padIn = 0.05;
    const padT = Math.min(0.02, padIn / len);
    const endZoneT = Math.min(0.25, 12 / len);

    let startT = 0;
    let endT = 1;
    let innerTs = uniqueJawTs;

    // Corner pockets: trim the ends back to the first jaw intersection near each end.
    if (innerTs.length && innerTs[0] <= endZoneT) {
      startT = Math.max(startT, innerTs[0] + padT);
      innerTs = innerTs.slice(1);
    }
    if (innerTs.length && innerTs[innerTs.length - 1] >= 1 - endZoneT) {
      endT = Math.min(endT, innerTs[innerTs.length - 1] - padT);
      innerTs = innerTs.slice(0, -1);
    }

    // Side pockets: remaining intersections should come in pairs that bound the opening.
    for (let i = 0; i + 1 < innerTs.length; i += 2) {
      const a = innerTs[i];
      const b = innerTs[i + 1];
      const s = Math.max(startT, Math.min(endT, Math.min(a, b) - padT));
      const e = Math.max(startT, Math.min(endT, Math.max(a, b) + padT));
      if (e - s > 1e-4) gaps.push([s, e]);
    }

    // Apply trims as implicit gaps (simplifies merge logic).
    if (startT > 1e-4) gaps.push([0, startT]);
    if (endT < 1 - 1e-4) gaps.push([endT, 1]);
  }

  (pockets || []).forEach((p: PocketDef) => {
    if (!isFiniteVec2(p?.center) || !Number.isFinite(p.radius)) return;
    const vx = p.center.x - clamped.from.x;
    const vy = p.center.y - clamped.from.y;
    const proj = vx * ux + vy * uy; // distance along rail to pocket center
    const perp = Math.abs(vx * (-uy) + vy * ux); // perpendicular distance
    const gapLen = Math.max(p.radius * 1.3, 1.0); // slightly larger gap
    if (proj < -gapLen || proj > len + gapLen) return;
    if (perp > p.radius * 1.2) return; // pocket not near this rail
    const t0 = Math.max(0, (proj - gapLen) / len);
    const t1 = Math.min(1, (proj + gapLen) / len);
    gaps.push([t0, t1]);
  });

  if (!gaps.length) return [clamped];
  gaps.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  let cur = gaps[0];
  for (let i = 1; i < gaps.length; i++) {
    const g = gaps[i];
    if (g[0] <= cur[1] + 1e-4) {
      cur[1] = Math.max(cur[1], g[1]);
    } else {
      merged.push(cur);
      cur = g;
    }
  }
  merged.push(cur);

  const segments: RailDef[] = [];
  let cursor = 0;
  merged.forEach(([s, e]) => {
    if (s > cursor + 1e-4) {
      segments.push({
        ...clamped,
        id: `${rail.id}_split_${segments.length}`,
        from: lerpPoint(cursor),
        to: lerpPoint(s),
      });
    }
    cursor = Math.max(cursor, e);
  });
  if (cursor < 1 - 1e-4) {
    segments.push({
      ...clamped,
      id: `${rail.id}_split_${segments.length}`,
      from: lerpPoint(cursor),
      to: lerpPoint(1),
    });
  }
  return segments;
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

/**
 * Jaw position calculations for side and corner pockets
 */
interface JawPositions {
  JAW_X_OUTER: number;
  JAW_X_INNER: number;
  CORNER_JAW_Y: number;
  CORNER_JAW_X: number;
  sideStraight: number;
  sideInner: number;
  cornerStraight: number;
  cornerFrameOffset: number;
}

/**
 * Base coordinate constants derived from jaw positions
 */
interface BaseCoordinates {
  Y_N_STRAIGHT: number;
  Y_S_STRAIGHT: number;
  Y_N_INNER: number;
  Y_S_INNER: number;
  X_E_STRAIGHT: number;
  X_W_STRAIGHT: number;
  SIDE_POCKET_OFFSET: number;
  curveBlend: number;
  mouthYNorth: number;
  mouthYSouth: number;
  throatJoinX: number;
  throatJoinYNorth: number;
  throatJoinYSouth: number;
}

/**
 * Compute jaw positions for side and corner pockets.
 * Applies derivation functions, overrides, and clamping constraints.
 */
function computeJawPositions(): JawPositions {
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

  return {
    JAW_X_OUTER,
    JAW_X_INNER,
    CORNER_JAW_Y,
    CORNER_JAW_X,
    sideStraight,
    sideInner,
    cornerStraight,
    cornerFrameOffset,
  };
}

/**
 * Compute frame outline geometry.
 * Calculates frame dimensions and corner points with optional rounding.
 */
function computeFrameOutline(): FrameOutline {
  const frameWidth = Math.max(0.1, CONFIG.FRAME_OFFSET_IN);
  const frameOuterOffset = frameWidth + CONFIG.RAIL_THICKNESS_OUTER;
  const frameInnerOffset = CONFIG.RAIL_THICKNESS_OUTER;
  const frameOuterX = PLAY_HALF_W_IN + frameOuterOffset;
  const frameOuterY = PLAY_HALF_H_IN + frameOuterOffset;
  const frameInnerX = PLAY_HALF_W_IN + frameInnerOffset;
  const frameInnerY = PLAY_HALF_H_IN + frameInnerOffset;
  const frameCornerRadius = Math.max(
    0,
    Math.min(CONFIG.FRAME_CORNER_RADIUS_IN ?? 0, frameWidth, frameOuterX, frameOuterY)
  );
  const frameCornerPoint = (
    signX: 1 | -1,
    signY: 1 | -1,
    axis: 'horizontal' | 'vertical'
  ): Vec2 => {
    const baseX = signX * frameOuterX;
    const baseY = signY * frameOuterY;
    if (frameCornerRadius <= 0) {
      return { x: baseX, y: baseY };
    }
    if (axis === 'horizontal') {
      return { x: baseX - signX * frameCornerRadius, y: baseY };
    }
    return { x: baseX, y: baseY - signY * frameCornerRadius };
  };

  const frameCorners = {
    northWest: {
      horizontal: frameCornerPoint(-1, 1, 'horizontal'),
      vertical: frameCornerPoint(-1, 1, 'vertical'),
    },
    northEast: {
      horizontal: frameCornerPoint(1, 1, 'horizontal'),
      vertical: frameCornerPoint(1, 1, 'vertical'),
    },
    southEast: {
      horizontal: frameCornerPoint(1, -1, 'horizontal'),
      vertical: frameCornerPoint(1, -1, 'vertical'),
    },
    southWest: {
      horizontal: frameCornerPoint(-1, -1, 'horizontal'),
      vertical: frameCornerPoint(-1, -1, 'vertical'),
    },
  };

  return {
    outerHalfWidth: frameOuterX,
    outerHalfHeight: frameOuterY,
    innerHalfWidth: frameInnerX,
    innerHalfHeight: frameInnerY,
    cornerRadius: frameCornerRadius,
    corners: frameCorners,
  };
}

/**
 * Compute base coordinate constants from jaw positions.
 * These named constants are used throughout rail and pocket calculations.
 */
function computeBaseCoordinates(jawPositions: JawPositions): BaseCoordinates {
  const { sideStraight, sideInner, JAW_X_INNER, JAW_X_OUTER } = jawPositions;

  const Y_N_STRAIGHT = sideStraight;
  const Y_S_STRAIGHT = -sideStraight;
  const Y_N_INNER = sideInner;
  const Y_S_INNER = -sideInner;
  const X_E_STRAIGHT = jawPositions.cornerStraight;
  const X_W_STRAIGHT = -jawPositions.cornerStraight;
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

  return {
    Y_N_STRAIGHT,
    Y_S_STRAIGHT,
    Y_N_INNER,
    Y_S_INNER,
    X_E_STRAIGHT,
    X_W_STRAIGHT,
    SIDE_POCKET_OFFSET,
    curveBlend,
    mouthYNorth,
    mouthYSouth,
    throatJoinX,
    throatJoinYNorth,
    throatJoinYSouth,
  };
}




let cachedGeometry: TableGeometry | null = null;

export function resetTableGeometryCache(): void {
  cachedGeometry = null;
}

export function getTableGeometry(): TableGeometry {
  if (cachedGeometry) return cachedGeometry;

  // 1. Check if SVG/JSON Geometry is enabled
  if (CONFIG.USE_SVG_GEOMETRY) {
    try {
      console.log('[Geometry] Loading physics geometry from table.physics.json');

      loadPhysicsJsonOverrideFromStorage();
      const physicsJson = (sessionPhysicsJsonOverride ?? storedPhysicsJsonOverride ?? basePhysicsJson) as any;
      const hasActivePhysicsOverride = sessionPhysicsJsonOverride != null || storedPhysicsJsonOverride != null;

      const pocketTypeHalfW = Number.isFinite(physicsJson.playArea?.width) ? physicsJson.playArea.width / 2 : null;
      const isCornerPocketJson = (center: Vec2): boolean => {
        if (pocketTypeHalfW == null) return true;
        return Math.abs(center.x) > pocketTypeHalfW * 0.25;
      };

      let pockets: PocketDef[] = (physicsJson.pockets || []).map(
        (p: { id: string; center: Vec2; radius: number; captureRadius?: number; outline?: Vec2[]; sourceTag?: string; source?: string }) => {
          const isCorner = isCornerPocketJson(p.center);
          const shelfDepth = isCorner
            ? CONFIG.POCKET_SHELF_DEPTH_IN
            : ((CONFIG as any).POCKET_SHELF_DEPTH_SIDE_IN ?? CONFIG.POCKET_SHELF_DEPTH_IN);
          const fallbackCapture = isCorner ? CONFIG.POCKET_CAPTURE_RADIUS_CORNER : CONFIG.POCKET_CAPTURE_RADIUS_SIDE;
          const captureRadius =
            typeof p.captureRadius === 'number' && Number.isFinite(p.captureRadius) && p.captureRadius > 0.05
              ? p.captureRadius
              : fallbackCapture;
          const cutAngleDeg = isCorner ? CONFIG.CORNER_CUT_ANGLE_DEG : CONFIG.SIDE_CUT_ANGLE_DEG;

          return {
            id: p.id,
            center: p.center,
            visualRadius: p.radius,
            captureRadius,
            cutNormalHint: { x: 0, y: 0 },
            cutAngleDeg,
            shelfDepth,
            radius: p.radius,
            outline: p.outline, // Keep outline for bounds calculation
          };
        }
      );

      // If a physicsJson override is active, treat JSON as authoritative and do not apply legacy pocket offsets.
      if (!hasActivePhysicsOverride) {
        const sidePocketOffsetDelta = CONFIG.SIDE_POCKET_OUTWARD_OFFSET_IN - 0.25;
        if (Math.abs(sidePocketOffsetDelta) > 1e-6 && physicsJson.playArea) {
          const halfW = physicsJson.playArea.width / 2;
          const sideCandidates = pockets.filter((p) => Math.abs(p.center.x) <= halfW * 0.25);
          if (sideCandidates.length >= 2) {
            const north = sideCandidates.reduce((best, p) => (p.center.y > best.center.y ? p : best), sideCandidates[0]);
            const south = sideCandidates.reduce((best, p) => (p.center.y < best.center.y ? p : best), sideCandidates[0]);
            const shiftPocket = (p: PocketDef, dy: number): PocketDef => ({
              ...p,
              center: { x: p.center.x, y: p.center.y + dy },
              outline: Array.isArray(p.outline) ? p.outline.map((pt) => ({ x: pt.x, y: pt.y + dy })) : p.outline,
            });
            pockets = pockets.map((p) => {
              if (p.id === north.id) return shiftPocket(p, sidePocketOffsetDelta);
              if (p.id === south.id) return shiftPocket(p, -sidePocketOffsetDelta);
              return p;
            });
          }
        }
      }

      // Apply legacy pocket offsets only when no physicsJson override is active.
      const cornerPocketOffset = !hasActivePhysicsOverride ? (CONFIG.CORNER_POCKET_OUTWARD_OFFSET_IN ?? 0) : 0;
      const cornerOffsetX = !hasActivePhysicsOverride ? (CONFIG.CORNER_POCKET_OFFSET_X_IN ?? 0) : 0;
      const cornerOffsetY = !hasActivePhysicsOverride ? (CONFIG.CORNER_POCKET_OFFSET_Y_IN ?? 0) : 0;
      const sideOffsetX = !hasActivePhysicsOverride ? (CONFIG.SIDE_POCKET_OFFSET_X_IN ?? 0) : 0;
      const sideOffsetY = !hasActivePhysicsOverride ? (CONFIG.SIDE_POCKET_OFFSET_Y_IN ?? 0) : 0;

      if (physicsJson.playArea) {
        const halfW = physicsJson.playArea.width / 2;
        
        const shiftPocket = (p: PocketDef, dx: number, dy: number): PocketDef => ({
          ...p,
          center: { x: p.center.x + dx, y: p.center.y + dy },
          outline: Array.isArray(p.outline) ? p.outline.map((pt) => ({ x: pt.x + dx, y: pt.y + dy })) : p.outline,
        });

        pockets = pockets.map((p) => {
          const isCorner = Math.abs(p.center.x) > halfW * 0.25;
          
          if (isCorner) {
            // Corner pockets: apply diagonal offset + X/Y offsets
            const signX = p.center.x > 0 ? 1 : -1;
            const signY = p.center.y > 0 ? 1 : -1;
            const totalDx = signX * cornerPocketOffset + signX * cornerOffsetX;
            const totalDy = signY * cornerPocketOffset + signY * cornerOffsetY;
            return shiftPocket(p, totalDx, totalDy);
          } else {
            // Side pockets: apply side offset + X/Y offsets
            const signX = p.center.x > 0 ? 1 : (p.center.x < 0 ? -1 : 0);
            const signY = p.center.y > 0 ? 1 : -1;
            const totalDx = signX * sideOffsetX;
            const totalDy = signY * (!hasActivePhysicsOverride ? (CONFIG.SIDE_POCKET_OUTWARD_OFFSET_IN ?? 0) : 0) + signY * sideOffsetY;
            return shiftPocket(p, totalDx, totalDy);
          }
        });
      }

      const rawRails: RailDef[] = (physicsJson.rails || []).map((r: { id: string; from: Vec2; to: Vec2; normal: Vec2; outline?: Vec2[] }) => ({
        id: r.id,
        from: r.from,
        to: r.to,
        normal: r.normal,
        outline: r.outline
      }));

      const cushionRails = rawRails.filter(r => r.id.includes('cushion'));

      const playArea = physicsJson.playArea || { width: 100, height: 50 };
      const halfW = playArea.width / 2;
      const halfH = playArea.height / 2;

      const isInsidePlayArea = (p: Vec2): boolean => {
        const eps = 1e-3;
        return Math.abs(p.x) <= halfW + eps && Math.abs(p.y) <= halfH + eps;
      };

      const distSq = (a: Vec2, b: Vec2) => {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        return dx * dx + dy * dy;
      };

      const nearestPocketDistSq = (p: Vec2): number => {
        let best = Number.POSITIVE_INFINITY;
        for (const pocket of pockets) {
          if (!isFiniteVec2(pocket?.center) || !Number.isFinite(pocket.radius)) continue;
          const d = distSq(p, pocket.center);
          if (d < best) best = d;
        }
        return best;
      };

      const jawRails: RailDef[] = [];
      cushionRails.forEach((c) => {
        const outline = Array.isArray(c.outline) ? c.outline.filter(isFiniteVec2) : [];
        if (outline.length < 2) return;

        const outsideDistance = (p: Vec2): number => {
          const dxOut = Math.max(0, Math.abs(p.x) - halfW);
          const dyOut = Math.max(0, Math.abs(p.y) - halfH);
          return Math.max(dxOut, dyOut);
        };

        const intersectSegmentPlayAreaBoundary = (insidePt: Vec2, outsidePt: Vec2): Vec2 | null => {
          const dx = outsidePt.x - insidePt.x;
          const dy = outsidePt.y - insidePt.y;
          const candidates: { t: number; pt: Vec2 }[] = [];

          if (Math.abs(dx) > 1e-8) {
            for (const xEdge of [-halfW, halfW]) {
              const t = (xEdge - insidePt.x) / dx;
              if (t < -1e-6 || t > 1 + 1e-6) continue;
              const y = insidePt.y + dy * t;
              if (y < -halfH - 1e-3 || y > halfH + 1e-3) continue;
              candidates.push({ t, pt: { x: xEdge, y } });
            }
          }

          if (Math.abs(dy) > 1e-8) {
            for (const yEdge of [-halfH, halfH]) {
              const t = (yEdge - insidePt.y) / dy;
              if (t < -1e-6 || t > 1 + 1e-6) continue;
              const x = insidePt.x + dx * t;
              if (x < -halfW - 1e-3 || x > halfW + 1e-3) continue;
              candidates.push({ t, pt: { x, y: yEdge } });
            }
          }

          if (!candidates.length) return null;
          candidates.sort((a, b) => a.t - b.t);
          return candidates[0].pt;
        };

        const treatClosed = shouldTreatOutlineClosed(outline);
        const edgeCount = treatClosed ? outline.length : outline.length - 1;
        for (let i = 0; i < edgeCount; i++) {
          const p1 = outline[i];
          const p2 = treatClosed ? outline[(i + 1) % outline.length] : outline[i + 1];
          if (!isFiniteVec2(p1) || !isFiniteVec2(p2)) continue;
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          if (Math.hypot(dx, dy) < 1e-4) continue;

          const in1 = isInsidePlayArea(p1);
          const in2 = isInsidePlayArea(p2);
          if ((in1 && !in2) || (!in1 && in2)) {
            // Only accept jaw segments near a pocket opening. If the cushion outline accidentally
            // crosses into the play area elsewhere, this prevents long "jet" rails through the felt.
            const mid: Vec2 = { x: (p1.x + p2.x) * 0.5, y: (p1.y + p2.y) * 0.5 };
            const dSq = nearestPocketDistSq(mid);
            const maxJawDist = 14; // inches; generous to keep true pocket-jaw segments
            if (dSq > maxJawDist * maxJawDist) continue;

            const insidePt = in1 ? p1 : p2;
            const outsidePt = in1 ? p2 : p1;

            // Clamp jaw rails to the *outside* of the play area so they don't intrude into the play field.
            // The play-area rails are the authoritative collision boundary; jaw rails should live in the pocket gaps.
            const boundaryPt = intersectSegmentPlayAreaBoundary(insidePt, outsidePt);
            if (!boundaryPt) continue;

            // Enforce that the jaw segment points outward (away from the play area).
            // Some table-editor outlines can create ambiguous inside/outside classification near the boundary,
            // which otherwise yields a jaw pointing 180° the wrong way.
            const dirX = outsidePt.x - insidePt.x;
            const dirY = outsidePt.y - insidePt.y;
            const dirLen = Math.hypot(dirX, dirY);
            if (!(dirLen > 1e-4)) continue;
            let ux = dirX / dirLen;
            let uy = dirY / dirLen;
            const probe = 0.5;
            const outForward = outsideDistance({ x: boundaryPt.x + ux * probe, y: boundaryPt.y + uy * probe });
            const outBackward = outsideDistance({ x: boundaryPt.x - ux * probe, y: boundaryPt.y - uy * probe });
            if (outBackward > outForward) {
              ux = -ux;
              uy = -uy;
            }

            // Clamp length to a reasonable amount while ensuring we extend into the pocket gap.
            const maxJawLen = 10; // inches
            // Use pocket size to pick a reasonable minimum so the jaw reliably covers the mouth area.
            const nearest = (() => {
              let best: PocketDef | null = null;
              let bestD = Number.POSITIVE_INFINITY;
              for (const p of pockets) {
                if (!isFiniteVec2(p?.center) || !Number.isFinite(p.radius)) continue;
                const dx = boundaryPt.x - p.center.x;
                const dy = boundaryPt.y - p.center.y;
                const d = dx * dx + dy * dy;
                if (d < bestD) {
                  bestD = d;
                  best = p;
                }
              }
              return best;
            })();
            const minJawLen = nearest?.radius ? Math.max(1.5, Math.min(6.0, nearest.radius * 1.75)) : 1.5;
            const rawLen = Math.hypot(outsidePt.x - boundaryPt.x, outsidePt.y - boundaryPt.y);
            const jawLen = Math.min(maxJawLen, Math.max(minJawLen, Number.isFinite(rawLen) ? rawLen : minJawLen));
            const jawTo: Vec2 = { x: boundaryPt.x + ux * jawLen, y: boundaryPt.y + uy * jawLen };
            if (outsideDistance(jawTo) < 0.01) continue;

            jawRails.push({
              id: `${c.id}_jaw_${i}`,
              from: boundaryPt,
              to: jawTo,
              normal: computeInwardNormal(boundaryPt, jawTo),
            });
          }
        }
      });

      // Process rails: split 'play_area' rails around pockets to avoid blocking pocket openings
      const rails: RailDef[] = rawRails.flatMap((r) => {
        if (r.id.includes('play_area')) {
          return splitRailByPockets(r, pockets, cushionRails, jawRails);
        }
        return [r];
      });

      const pixelsPerInch = physicsJson.meta?.pixelsPerInch || 7.68; // Default to 7.68 if missing

      // Calculate the actual physical extent of the table based on all available geometry
      let maxExtentX = 0;
      let maxExtentY = 0;

      const updateExtents = (points: { x: number, y: number }[]) => {
        if (!points) return;
        for (const p of points) {
          maxExtentX = Math.max(maxExtentX, Math.abs(p.x));
          maxExtentY = Math.max(maxExtentY, Math.abs(p.y));
        }
      };

      rawRails.forEach(r => updateExtents(r.outline as any));
      pockets.forEach(p => updateExtents((p as any).outline));

      // Fallback if no geometry found
      if (maxExtentX === 0) maxExtentX = 55; // Default estimate
      if (maxExtentY === 0) maxExtentY = 28; // Default estimate

      console.log(`[Geometry] Calculated Frame Extents from Physics: +/- ${maxExtentX.toFixed(3)} x ${maxExtentY.toFixed(3)}`);

      // Derived frame outline matching the physics objects
      const defaultFrameOutline: FrameOutline = {
        outerHalfWidth: maxExtentX,
        outerHalfHeight: maxExtentY,
        innerHalfWidth: halfW,
        innerHalfHeight: halfH,
        cornerRadius: 0,
        corners: {
          northWest: { horizontal: { x: -maxExtentX, y: maxExtentY }, vertical: { x: -maxExtentX, y: maxExtentY } },
          northEast: { horizontal: { x: maxExtentX, y: maxExtentY }, vertical: { x: maxExtentX, y: maxExtentY } },
          southEast: { horizontal: { x: maxExtentX, y: -maxExtentY }, vertical: { x: maxExtentX, y: -maxExtentY } },
          southWest: { horizontal: { x: -maxExtentX, y: -maxExtentY }, vertical: { x: -maxExtentX, y: -maxExtentY } },
        }
      };

      const railsWithJaws: RailDef[] = [...rails, ...jawRails];

      cachedGeometry = {
        playWidthIn: playArea.width,
        playHeightIn: playArea.height,
        cushionProfileIn: 0,
        rails: railsWithJaws,
        pockets: pockets,
        frameOutline: defaultFrameOutline,
        pixelsPerInch,

        // Default/fallback values
        pocketCaptureRadiusIn: 2.25,
        cornerPocketCaptureRadiusIn: 2.25,
        sidePocketCaptureRadiusIn: 2.5,
        cornerPocketVisualRadiusIn: 2.25,
        sidePocketVisualRadiusIn: 2.5,
        pocketShelfDepthIn: 0,
        cornerPocketWidthIn: 4.5,
        cornerPocketDepthIn: 0,
        cornerPocketRadiusIn: 2.25,
        sidePocketWidthIn: 5,
        sidePocketDepthIn: 0,
        sidePocketRadiusIn: 2.25,
        cornerJawRadiusIn: 0,
        sideJawRadiusIn: 0,
      };

      console.log(`[Geometry] Loaded ${railsWithJaws.length} rails and ${pockets.length} pockets from table.physics.json`);
      return cachedGeometry;

    } catch (e) {
      console.error("Failed to load physics geometry, falling back to procedural:", e);
    }
  }

  // 2. Procedural Fallback (Original Code)

  const jawPositions = computeJawPositions();

  const {
    JAW_X_OUTER,
    JAW_X_INNER,
    CORNER_JAW_Y,
    CORNER_JAW_X,
    sideStraight,
    sideInner,
    cornerStraight,
    cornerFrameOffset,
  } = jawPositions;

  // Compute base coordinate constants
  const {
    Y_N_STRAIGHT,
    Y_S_STRAIGHT,
    Y_N_INNER,
    Y_S_INNER,
    X_E_STRAIGHT,
    X_W_STRAIGHT,
    SIDE_POCKET_OFFSET,
    curveBlend,
    mouthYNorth,
    mouthYSouth,
    throatJoinX,
    throatJoinYNorth,
    throatJoinYSouth,
  } = computeBaseCoordinates(jawPositions);

  const rails: RailDef[] = [];
  const addRail = (id: string, from: Vec2, to: Vec2) => {
    rails.push({
      id,
      from,
      to,
      normal: computeInwardNormal(from, to),
    });
  };

  // Compute frame outline geometry
  const frameOutline = computeFrameOutline();

  // Rail outer corners for rail generation
  const railOuterX = PLAY_HALF_W_IN + cornerFrameOffset;
  const railOuterY = PLAY_HALF_H_IN + cornerFrameOffset;
  const railOuterCorner = (signX: 1 | -1, signY: 1 | -1): Vec2 => ({
    x: signX * railOuterX,
    y: signY * railOuterY,
  });

  const northWestOuterTop = railOuterCorner(-1, 1);
  const northWestOuterWest = railOuterCorner(-1, 1);
  const northEastOuterTop = railOuterCorner(1, 1);
  const northEastOuterEast = railOuterCorner(1, 1);
  const southEastOuterBottom = railOuterCorner(1, -1);
  const southEastOuterEast = railOuterCorner(1, -1);
  const southWestOuterBottom = railOuterCorner(-1, -1);
  const southWestOuterWest = railOuterCorner(-1, -1);

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

  const cornerOffset = CONFIG.CORNER_POCKET_OUTWARD_OFFSET_IN ?? 0;
  const pocketCenterNW: Vec2 = { x: -(PLAY_HALF_W_IN + cornerOffset), y: (PLAY_HALF_H_IN + cornerOffset) };
  const pocketCenterNE: Vec2 = { x: (PLAY_HALF_W_IN + cornerOffset), y: (PLAY_HALF_H_IN + cornerOffset) };
  const pocketCenterSW: Vec2 = { x: -(PLAY_HALF_W_IN + cornerOffset), y: -(PLAY_HALF_H_IN + cornerOffset) };
  const pocketCenterSE: Vec2 = { x: (PLAY_HALF_W_IN + cornerOffset), y: -(PLAY_HALF_H_IN + cornerOffset) };
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
    cornerPocketWidthIn: 4.5,
    cornerPocketDepthIn: 0,
    cornerPocketRadiusIn: CONFIG.POCKET_VISUAL_RADIUS_CORNER,
    sidePocketWidthIn: 5,
    sidePocketDepthIn: 0,
    sidePocketRadiusIn: CONFIG.POCKET_VISUAL_RADIUS_SIDE,
    cornerJawRadiusIn: CONFIG.CORNER_JAW_REF_RADIUS_IN,
    sideJawRadiusIn: CONFIG.JAW_REF_RADIUS_IN,

    // Rails approximating WPA throat geometry, normals point inward
    // Corner rails stop short of pocket centers to leave openings
    rails,
    frameOutline,

    // Pockets at corners and midpoints
    pockets: [
      {
        id: 'NW_corner',
        center: pocketCenterNW,
        cutNormalHint: cornerHintNW,
        cutAngleDeg: CONFIG.CORNER_CUT_ANGLE_DEG,
        captureRadius: CONFIG.POCKET_CAPTURE_RADIUS_CORNER,
        visualRadius: CONFIG.POCKET_VISUAL_RADIUS_CORNER,
        shelfDepth: CONFIG.POCKET_SHELF_DEPTH_IN,
        radius: CONFIG.POCKET_VISUAL_RADIUS_CORNER,
      },
      {
        id: 'NE_corner',
        center: pocketCenterNE,
        cutNormalHint: cornerHintNE,
        cutAngleDeg: CONFIG.CORNER_CUT_ANGLE_DEG,
        captureRadius: CONFIG.POCKET_CAPTURE_RADIUS_CORNER,
        visualRadius: CONFIG.POCKET_VISUAL_RADIUS_CORNER,
        shelfDepth: CONFIG.POCKET_SHELF_DEPTH_IN,
        radius: CONFIG.POCKET_VISUAL_RADIUS_CORNER,
      },
      {
        id: 'SW_corner',
        center: pocketCenterSW,
        cutNormalHint: cornerHintSW,
        cutAngleDeg: CONFIG.CORNER_CUT_ANGLE_DEG,
        captureRadius: CONFIG.POCKET_CAPTURE_RADIUS_CORNER,
        visualRadius: CONFIG.POCKET_VISUAL_RADIUS_CORNER,
        shelfDepth: CONFIG.POCKET_SHELF_DEPTH_IN,
        radius: CONFIG.POCKET_VISUAL_RADIUS_CORNER,
      },
      {
        id: 'SE_corner',
        center: pocketCenterSE,
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
        shelfDepth: (CONFIG as any).POCKET_SHELF_DEPTH_SIDE_IN ?? CONFIG.POCKET_SHELF_DEPTH_IN,
        radius: CONFIG.POCKET_VISUAL_RADIUS_SIDE,
      },
      {
        id: 'S_middle',
        center: { x: 0.0, y: Y_S_PLAY - SIDE_POCKET_OFFSET },
        cutNormalHint: sideHintSouth,
        cutAngleDeg: CONFIG.SIDE_CUT_ANGLE_DEG,
        captureRadius: CONFIG.POCKET_CAPTURE_RADIUS_SIDE,
        visualRadius: CONFIG.POCKET_VISUAL_RADIUS_SIDE,
        shelfDepth: (CONFIG as any).POCKET_SHELF_DEPTH_SIDE_IN ?? CONFIG.POCKET_SHELF_DEPTH_IN,
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
