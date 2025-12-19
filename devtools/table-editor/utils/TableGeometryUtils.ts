import type { PhysicsJson, PhysicsJsonPocket, PhysicsJsonRail } from './JsonLoader';
import {
  DEFAULT_PLAY_WIDTH_IN,
  DEFAULT_PLAY_HEIGHT_IN,
  DEFAULT_POCKET_RADIUS_IN,
  MIN_POCKET_RADIUS_IN,
  POCKET_OUTLINE_SEGMENTS,
  EPSILON,
  UNIT_VECTOR_TOLERANCE,
  MIN_RAIL_LENGTH_IN,
  POCKET_MATCH_TOLERANCE_SQ,
  RAIL_MATCH_TOLERANCE_SQ,
  RAIL_SYMMETRY_TOLERANCE_IN,
} from './constants';

export type RadiusScaleRule = 'min' | 'avg' | 'constant';

export function isDerivedPlayAreaRailId(id: string | undefined | null): boolean {
  return typeof id === 'string' && id.startsWith('play_area_');
}

export function ensureDerivedPlayAreaRails(input: PhysicsJson): PhysicsJson {
  const next = structuredClone(input);
  const halfW = next.playArea.width / 2;
  const halfH = next.playArea.height / 2;

  const derived: PhysicsJsonRail[] = [
    {
      id: 'play_area_north',
      from: { x: -halfW, y: halfH },
      to: { x: halfW, y: halfH },
      normal: { x: 0, y: -1 },
    },
    {
      id: 'play_area_east',
      from: { x: halfW, y: halfH },
      to: { x: halfW, y: -halfH },
      normal: { x: -1, y: 0 },
    },
    {
      id: 'play_area_south',
      from: { x: halfW, y: -halfH },
      to: { x: -halfW, y: -halfH },
      normal: { x: 0, y: 1 },
    },
    {
      id: 'play_area_west',
      from: { x: -halfW, y: -halfH },
      to: { x: -halfW, y: halfH },
      normal: { x: 1, y: 0 },
    },
  ];

  next.rails = [...next.rails.filter((r) => !isDerivedPlayAreaRailId(r.id)), ...derived];
  return next;
}

export function getSemanticGeometryWarnings(json: PhysicsJson): string[] {
  const warnings: string[] = [];
  const maxWarnings = 20;

  const halfW = json.playArea.width / 2;
  const halfH = json.playArea.height / 2;
  // Cushions/frames can extend beyond the play area; allow a generous margin.
  const marginX = Math.max(halfW * 0.6, 25);
  const marginY = Math.max(halfH * 0.6, 25);
  const maxX = halfW + marginX;
  const maxY = halfH + marginY;

  const push = (msg: string) => {
    if (warnings.length < maxWarnings) warnings.push(msg);
  };

  const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  const isFinitePoint = (p: any): p is { x: number; y: number } => !!p && isFiniteNumber(p.x) && isFiniteNumber(p.y);

  for (const p of json.pockets) {
    if (!isFinitePoint(p.center)) continue;
    if (Math.abs(p.center.x) > maxX || Math.abs(p.center.y) > maxY) {
      push(`Pocket ${p.id} center is far outside expected bounds.`);
    }
    if (Array.isArray(p.outline)) {
      const bad = p.outline.find((pt) => isFinitePoint(pt) && (Math.abs(pt.x) > maxX || Math.abs(pt.y) > maxY));
      if (bad) push(`Pocket ${p.id} has outline points far outside expected bounds.`);
    }
  }

  const editableRails = json.rails.filter((r) => !isDerivedPlayAreaRailId(r.id));
  if (editableRails.length < 6) push(`Only ${editableRails.length} non-play-area rails found (expected segmented cushion rails).`);

  for (const r of editableRails) {
    if (!isFinitePoint(r.from) || !isFinitePoint(r.to)) continue;
    const dx = r.to.x - r.from.x;
    const dy = r.to.y - r.from.y;
    if (Math.hypot(dx, dy) < 0.25) push(`Rail ${r.id} is extremely short.`);

    const pts = Array.isArray(r.outline) ? r.outline : [];
    if (pts.length > 0 && pts.length < 2) push(`Rail ${r.id} outline is too short.`);
    const bad = pts.find((pt) => isFinitePoint(pt) && (Math.abs(pt.x) > maxX || Math.abs(pt.y) > maxY));
    if (bad) push(`Rail ${r.id} has outline points far outside expected bounds.`);
  }

  if (warnings.length === maxWarnings) warnings.push('…more issues not shown');
  return warnings;
}

export type GeometrySelection =
  | { kind: 'pocket'; pocketIndex: number }
  | { kind: 'pocket-outline'; pocketIndex: number; pointIndex: number }
  | { kind: 'pocket-radius'; pocketIndex: number }
  | { kind: 'rail'; railIndex: number }
  | { kind: 'rail-end'; railIndex: number; endpoint: 'from' | 'to' }
  | { kind: 'rail-outline'; railIndex: number; pointIndex: number };

export type GeometryEdit =
  | { type: 'move-pocket-center'; pocketIndex: number; x: number; y: number }
  | { type: 'move-pocket-outline'; pocketIndex: number; pointIndex: number; x: number; y: number }
  | { type: 'set-pocket-radius'; pocketIndex: number; radius: number; scaleOutline: boolean }
  | { type: 'move-rail'; railIndex: number; dx: number; dy: number }
  | { type: 'move-rail-end'; railIndex: number; endpoint: 'from' | 'to'; x: number; y: number }
  | { type: 'move-rail-outline'; railIndex: number; pointIndex: number; x: number; y: number };

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

// ─────────────────────────────────────────────────────────────────────────────
// Normal Vector Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute the unit perpendicular normal for a rail segment.
 * Returns the normal pointing toward a reference point (typically table center).
 */
export function computeRailNormal(
  from: { x: number; y: number },
  to: { x: number; y: number },
  referencePoint: { x: number; y: number } = { x: 0, y: 0 }
): { x: number; y: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);

  if (len < EPSILON) {
    // Degenerate rail - return default upward normal
    return { x: 0, y: 1 };
  }

  // Perpendicular (two possible directions)
  let nx = -dy / len;
  let ny = dx / len;

  // Ensure normal points toward reference (table center)
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  const toRefX = referencePoint.x - midX;
  const toRefY = referencePoint.y - midY;
  const dot = nx * toRefX + ny * toRefY;

  if (dot < 0) {
    nx = -nx;
    ny = -ny;
  }

  return { x: nx, y: ny };
}

/**
 * Normalize a vector to unit length. Returns {x: 0, y: 1} for zero/degenerate vectors.
 */
export function normalizeVector(v: { x: number; y: number }): { x: number; y: number } {
  const len = Math.hypot(v.x, v.y);
  if (len < EPSILON) return { x: 0, y: 1 };
  return { x: v.x / len, y: v.y / len };
}

/**
 * Check if a vector is approximately unit length.
 */
export function isUnitVector(v: { x: number; y: number }, epsilon = UNIT_VECTOR_TOLERANCE): boolean {
  const len = Math.hypot(v.x, v.y);
  return Math.abs(len - 1) < epsilon;
}

/**
 * Check if a rail normal points inward (toward table center).
 */
export function isInwardNormal(
  rail: { from: { x: number; y: number }; to: { x: number; y: number }; normal: { x: number; y: number } },
  tableCenter: { x: number; y: number } = { x: 0, y: 0 }
): boolean {
  const midX = (rail.from.x + rail.to.x) / 2;
  const midY = (rail.from.y + rail.to.y) / 2;
  const toRefX = tableCenter.x - midX;
  const toRefY = tableCenter.y - midY;
  const dot = rail.normal.x * toRefX + rail.normal.y * toRefY;
  return dot >= 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation Types
// ─────────────────────────────────────────────────────────────────────────────

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  severity: ValidationSeverity;
  message: string;
  field?: string; // e.g., "pockets[0].center", "rails[2].normal"
  repaired?: boolean; // true if the issue was auto-repaired
}

export interface SanitizeResult {
  json: PhysicsJson;
  issues: ValidationIssue[];
  /** @deprecated Use issues.length instead */
  repairs: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sanitization Helpers
// ─────────────────────────────────────────────────────────────────────────────

function sanitizePoint(pt: any, fallback: { x: number; y: number }): { x: number; y: number } {
  const x = isFiniteNumber(pt?.x) ? pt.x : fallback.x;
  const y = isFiniteNumber(pt?.y) ? pt.y : fallback.y;
  return { x, y };
}

function sanitizeOutline(outline: any): { x: number; y: number }[] | undefined {
  if (!Array.isArray(outline)) return undefined;
  const pts = outline
    .map((p) => (p && typeof p === 'object' ? { x: (p as any).x, y: (p as any).y } : null))
    .filter((p): p is { x: number; y: number } => !!p && isFiniteNumber(p.x) && isFiniteNumber(p.y));
  if (pts.length < 2) return undefined;
  return pts;
}

function generateCircleOutline(
  center: { x: number; y: number },
  radius: number,
  steps = POCKET_OUTLINE_SEGMENTS
): { x: number; y: number }[] {
  const outline: { x: number; y: number }[] = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    outline.push({ x: center.x + Math.cos(t) * radius, y: center.y + Math.sin(t) * radius });
  }
  outline.push({ ...outline[0] }); // Close the loop
  return outline;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Sanitize Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sanitize and validate PhysicsJson input, returning structured validation results.
 *
 * Unlike previous versions that silently repaired data, this function:
 * - Returns detailed issues with severity levels (error/warning/info)
 * - Specifies which field caused each issue
 * - Indicates whether issues were auto-repaired
 *
 * Errors indicate critical issues that may cause gameplay problems.
 * Warnings indicate issues that were repaired with default values.
 * Info messages are for minor issues or suggestions.
 */
export function sanitizePhysicsJson(input: any): SanitizeResult {
  const issues: ValidationIssue[] = [];

  const metaIn = input?.meta && typeof input.meta === 'object' ? input.meta : undefined;
  const playAreaIn = input?.playArea && typeof input.playArea === 'object' ? input.playArea : {};

  // Play area validation
  let playWidth = playAreaIn.width;
  let playHeight = playAreaIn.height;

  if (!isFiniteNumber(playWidth) || playWidth <= 0) {
    issues.push({
      severity: 'error',
      message: `Invalid playArea.width (${playWidth}), defaulted to ${DEFAULT_PLAY_WIDTH_IN}`,
      field: 'playArea.width',
      repaired: true,
    });
    playWidth = DEFAULT_PLAY_WIDTH_IN;
  }
  if (!isFiniteNumber(playHeight) || playHeight <= 0) {
    issues.push({
      severity: 'error',
      message: `Invalid playArea.height (${playHeight}), defaulted to ${DEFAULT_PLAY_HEIGHT_IN}`,
      field: 'playArea.height',
      repaired: true,
    });
    playHeight = DEFAULT_PLAY_HEIGHT_IN;
  }

  const pocketsIn = Array.isArray(input?.pockets) ? input.pockets : [];
  const railsIn = Array.isArray(input?.rails) ? input.rails : [];

  if (pocketsIn.length === 0) {
    issues.push({
      severity: 'warning',
      message: 'No pockets defined in physics JSON',
      field: 'pockets',
    });
  }

  if (railsIn.length === 0) {
    issues.push({
      severity: 'warning',
      message: 'No rails defined in physics JSON',
      field: 'rails',
    });
  }

  // Pocket validation
  const pockets: PhysicsJsonPocket[] = pocketsIn.map((p: any, idx: number) => {
    const pocketField = `pockets[${idx}]`;
    const id = typeof p?.id === 'string' ? p.id : `pocket_${idx}`;

    // Center validation
    let center: { x: number; y: number };
    if (!isFiniteNumber(p?.center?.x) || !isFiniteNumber(p?.center?.y)) {
      issues.push({
        severity: 'error',
        message: `Pocket "${id}" has invalid center (${JSON.stringify(p?.center)}), defaulted to (0, 0)`,
        field: `${pocketField}.center`,
        repaired: true,
      });
      center = { x: 0, y: 0 };
    } else {
      center = { x: p.center.x, y: p.center.y };
    }

    // Radius validation
    let radius: number;
    if (!isFiniteNumber(p?.radius) || p.radius <= MIN_POCKET_RADIUS_IN) {
      issues.push({
        severity: 'warning',
        message: `Pocket "${id}" has invalid radius (${p?.radius}), defaulted to ${DEFAULT_POCKET_RADIUS_IN}"`,
        field: `${pocketField}.radius`,
        repaired: true,
      });
      radius = DEFAULT_POCKET_RADIUS_IN;
    } else {
      radius = p.radius;
    }

    // Outline validation
    let outline = sanitizeOutline(p?.outline);
    if (p?.outline && !outline) {
      issues.push({
        severity: 'warning',
        message: `Pocket "${id}" has invalid outline, regenerated from center/radius`,
        field: `${pocketField}.outline`,
        repaired: true,
      });
    }
    if (!outline) {
      outline = generateCircleOutline(center, radius, POCKET_OUTLINE_SEGMENTS);
    }

    return { id, center, radius, outline };
  });

  // Rail validation
  const rails: PhysicsJsonRail[] = railsIn.map((r: any, idx: number) => {
    const railField = `rails[${idx}]`;
    const id = typeof r?.id === 'string' ? r.id : `rail_${idx}`;

    // From/To validation
    let from: { x: number; y: number };
    let to: { x: number; y: number };

    if (!isFiniteNumber(r?.from?.x) || !isFiniteNumber(r?.from?.y)) {
      issues.push({
        severity: 'error',
        message: `Rail "${id}" has invalid 'from' point (${JSON.stringify(r?.from)}), defaulted to (0, 0)`,
        field: `${railField}.from`,
        repaired: true,
      });
      from = { x: 0, y: 0 };
    } else {
      from = { x: r.from.x, y: r.from.y };
    }

    if (!isFiniteNumber(r?.to?.x) || !isFiniteNumber(r?.to?.y)) {
      issues.push({
        severity: 'error',
        message: `Rail "${id}" has invalid 'to' point (${JSON.stringify(r?.to)}), defaulted to (0, 0)`,
        field: `${railField}.to`,
        repaired: true,
      });
      to = { x: 0, y: 0 };
    } else {
      to = { x: r.to.x, y: r.to.y };
    }

    // Check for degenerate (zero-length) rails
    const railLength = Math.hypot(to.x - from.x, to.y - from.y);
    if (railLength < MIN_RAIL_LENGTH_IN) {
      issues.push({
        severity: 'error',
        message: `Rail "${id}" is degenerate (zero or near-zero length: ${railLength.toFixed(4)}")`,
        field: railField,
      });
    }

    // Normal validation
    let normal: { x: number; y: number };
    if (!isFiniteNumber(r?.normal?.x) || !isFiniteNumber(r?.normal?.y)) {
      issues.push({
        severity: 'warning',
        message: `Rail "${id}" has invalid normal, recomputed from endpoints`,
        field: `${railField}.normal`,
        repaired: true,
      });
      normal = computeRailNormal(from, to, { x: 0, y: 0 });
    } else {
      normal = { x: r.normal.x, y: r.normal.y };

      // Check if normal is unit length
      if (!isUnitVector(normal, UNIT_VECTOR_TOLERANCE)) {
        const originalLen = Math.hypot(normal.x, normal.y);
        issues.push({
          severity: 'warning',
          message: `Rail "${id}" normal is not unit length (${originalLen.toFixed(4)}), normalized`,
          field: `${railField}.normal`,
          repaired: true,
        });
        normal = normalizeVector(normal);
      }

      // Check if normal points inward
      if (!isInwardNormal({ from, to, normal }, { x: 0, y: 0 })) {
        issues.push({
          severity: 'info',
          message: `Rail "${id}" normal points outward (will be flipped by game)`,
          field: `${railField}.normal`,
        });
      }
    }

    // Outline validation
    let outline = sanitizeOutline(r?.outline);
    if (r?.outline && !outline) {
      issues.push({
        severity: 'warning',
        message: `Rail "${id}" has invalid outline, using from/to as fallback`,
        field: `${railField}.outline`,
        repaired: true,
      });
      outline = [{ ...from }, { ...to }];
    }

    return { id, from, to, normal, outline };
  });

  // Meta validation (less critical)
  const meta: PhysicsJson['meta'] | undefined = metaIn
    ? {
        pixelsPerInch: isFiniteNumber(metaIn.pixelsPerInch) ? metaIn.pixelsPerInch : undefined,
        source: typeof metaIn.source === 'string' ? metaIn.source : undefined,
        lastModified: isFiniteNumber(metaIn.lastModified) ? metaIn.lastModified : Date.now(),
        offset:
          metaIn.offset && typeof metaIn.offset === 'object'
            ? sanitizePoint(metaIn.offset, { x: 0, y: 0 })
            : undefined,
        pixelRects: metaIn.pixelRects,
      }
    : undefined;

  const json: PhysicsJson = {
    meta,
    playArea: { width: playWidth, height: playHeight },
    pockets,
    rails,
  };

  // Count repairs for backwards compatibility
  const repairs = issues.filter((i) => i.repaired).length;

  return { json, issues, repairs };
}

function roundKey(x: number, decimals = 2): string {
  const f = Math.pow(10, decimals);
  return String(Math.round(x * f) / f);
}

function signWithEps(v: number, eps = 1e-6): -1 | 0 | 1 {
  if (!Number.isFinite(v)) return 0;
  if (Math.abs(v) <= eps) return 0;
  return v < 0 ? -1 : 1;
}

function mirrorAxesForTarget(source: { x: number; y: number }, target: { x: number; y: number }): { x: boolean; y: boolean } {
  // axes.x => mirror across X axis (flip y), axes.y => mirror across Y axis (flip x)
  return {
    x: signWithEps(source.y) !== signWithEps(target.y),
    y: signWithEps(source.x) !== signWithEps(target.x),
  };
}

export function resymmetrizePhysicsJson(input: PhysicsJson): PhysicsJson {
  const next = structuredClone(input);
  const halfW = next.playArea.width / 2;

  const isCornerPocket = (p: PhysicsJsonPocket) => Math.abs(p.center.x) > halfW * 0.25;
  const corners = next.pockets.map((p, i) => ({ p, i })).filter(({ p }) => isCornerPocket(p));
  const sides = next.pockets.map((p, i) => ({ p, i })).filter(({ p }) => !isCornerPocket(p));

  const nearestPocketIndex = (target: { x: number; y: number }, candidates: { p: PhysicsJsonPocket; i: number }[]) => {
    let best: { i: number; d: number } | null = null;
    for (const c of candidates) {
      const dx = c.p.center.x - target.x;
      const dy = c.p.center.y - target.y;
      const d = dx * dx + dy * dy;
      if (!best || d < best.d) best = { i: c.i, d };
    }
    return best?.i ?? null;
  };

  // Corner pockets: pick NE as canonical, mirror to other 3.
  if (corners.length >= 4) {
    const canonical = corners
      .map(({ p, i }) => ({ p, i, score: p.center.x + p.center.y }))
      .sort((a, b) => b.score - a.score)[0];
    const c = canonical.p;
    const absX = Math.abs(c.center.x);
    const absY = Math.abs(c.center.y);
    const targets = [
      { x: absX, y: absY },
      { x: -absX, y: absY },
      { x: absX, y: -absY },
      { x: -absX, y: -absY },
    ];

    for (const t of targets) {
      const idx = nearestPocketIndex(t, corners);
      if (idx === null) continue;
      const axes = mirrorAxesForTarget(c.center, t);
      const center = mirrorPoint({ x: absX, y: absY }, axes);
      next.pockets[idx].center = center;
      next.pockets[idx].radius = c.radius;
      if (c.outline) next.pockets[idx].outline = c.outline.map((pt) => mirrorPoint(pt, axes));
    }
  }

  // Side pockets: pick North as canonical, mirror across X axis to South.
  if (sides.length >= 2) {
    const canonical = sides
      .map(({ p, i }) => ({ p, i, score: p.center.y }))
      .sort((a, b) => b.score - a.score)[0];
    const north = canonical.p;
    const northCenter = { x: north.center.x, y: Math.abs(north.center.y) };
    const southCenter = { x: northCenter.x, y: -northCenter.y };
    const northIdx = nearestPocketIndex(northCenter, sides);
    const southIdx = nearestPocketIndex(southCenter, sides);
    if (northIdx !== null) {
      next.pockets[northIdx].center = northCenter;
      next.pockets[northIdx].radius = north.radius;
      if (north.outline) next.pockets[northIdx].outline = north.outline.map((pt) => ({ x: pt.x, y: Math.abs(pt.y) }));
    }
    if (southIdx !== null) {
      next.pockets[southIdx].center = southCenter;
      next.pockets[southIdx].radius = north.radius;
      if (north.outline) next.pockets[southIdx].outline = north.outline.map((pt) => ({ x: pt.x, y: -Math.abs(pt.y) }));
    }
  }

  // Rails: group by abs(midpoint) and mirror within each group.
  const railMid = (r: PhysicsJsonRail) => ({ x: (r.from.x + r.to.x) / 2, y: (r.from.y + r.to.y) / 2 });
  const groups = new Map<string, number[]>();
  next.rails.forEach((r, idx) => {
    if (isDerivedPlayAreaRailId(r.id)) return;
    const m = railMid(r);
    const key = `${roundKey(Math.abs(m.x))},${roundKey(Math.abs(m.y))}`;
    const arr = groups.get(key) ?? [];
    arr.push(idx);
    groups.set(key, arr);
  });

  for (const indices of groups.values()) {
    if (indices.length < 2) continue;
    const repIndex =
      indices
        .map((idx) => ({ idx, mid: railMid(next.rails[idx]) }))
        .sort((a, b) => (b.mid.x + b.mid.y) - (a.mid.x + a.mid.y))[0]?.idx ?? indices[0];

    const rep = next.rails[repIndex];
    const repMid = railMid(rep);

    for (const idx of indices) {
      if (idx === repIndex) continue;
      const r = next.rails[idx];
      const targetMid = railMid(r);
      const axes = mirrorAxesForTarget(repMid, targetMid);

      r.from = mirrorPoint(rep.from, axes);
      r.to = mirrorPoint(rep.to, axes);
      r.normal = mirrorPoint(rep.normal, axes);
      if (rep.outline) r.outline = rep.outline.map((pt) => mirrorPoint(pt, axes));
    }
  }

  next.meta = next.meta ?? {};
  next.meta.lastModified = Date.now();
  return ensureDerivedPlayAreaRails(next);
}

export function createBlankPhysicsJsonFromPixels(options: {
  innerPx: { width: number; height: number };
  outerPx: { width: number; height: number };
  fullPx: { width: number; height: number };
  playWidthIn?: number;
  pixelsPerInch?: number;
}): PhysicsJson {
  const playWidthIn = options.playWidthIn ?? DEFAULT_PLAY_WIDTH_IN;
  const pixelsPerInch = options.pixelsPerInch ?? options.innerPx.width / playWidthIn;
  const playHeightIn = options.innerPx.height / pixelsPerInch;

  const halfW = playWidthIn / 2;
  const halfH = playHeightIn / 2;

  const makeCircleOutline = (center: { x: number; y: number }, radius: number, steps = 24) => {
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      pts.push({ x: center.x + Math.cos(t) * radius, y: center.y + Math.sin(t) * radius });
    }
    pts.push({ ...pts[0] });
    return pts;
  };

  const pocketRadius = 2.9296875;
  const pockets: PhysicsJsonPocket[] = [
    { id: 'pocket_NW', center: { x: -halfW, y: halfH }, radius: pocketRadius },
    { id: 'pocket_NE', center: { x: halfW, y: halfH }, radius: pocketRadius },
    { id: 'pocket_SE', center: { x: halfW, y: -halfH }, radius: pocketRadius },
    { id: 'pocket_SW', center: { x: -halfW, y: -halfH }, radius: pocketRadius },
    { id: 'pocket_N', center: { x: 0, y: halfH }, radius: pocketRadius },
    { id: 'pocket_S', center: { x: 0, y: -halfH }, radius: pocketRadius },
  ].map((p) => ({ ...p, outline: makeCircleOutline(p.center, p.radius, 20) }));

  const cushionThicknessIn = (options.outerPx.width - options.innerPx.width) / 2 / pixelsPerInch;
  const railInset = cushionThicknessIn;
  const rails: PhysicsJsonRail[] = [
    {
      id: 'rail_W',
      from: { x: -halfW - railInset, y: halfH + railInset },
      to: { x: -halfW - railInset, y: -halfH - railInset },
      normal: { x: 1, y: 0 },
      outline: [
        { x: -halfW, y: halfH },
        { x: -halfW - railInset, y: halfH + railInset },
        { x: -halfW - railInset, y: -halfH - railInset },
        { x: -halfW, y: -halfH },
        { x: -halfW, y: halfH },
      ],
    },
    {
      id: 'rail_E',
      from: { x: halfW + railInset, y: -halfH - railInset },
      to: { x: halfW + railInset, y: halfH + railInset },
      normal: { x: -1, y: 0 },
      outline: [
        { x: halfW, y: -halfH },
        { x: halfW + railInset, y: -halfH - railInset },
        { x: halfW + railInset, y: halfH + railInset },
        { x: halfW, y: halfH },
        { x: halfW, y: -halfH },
      ],
    },
    {
      id: 'rail_N',
      from: { x: -halfW - railInset, y: halfH + railInset },
      to: { x: halfW + railInset, y: halfH + railInset },
      normal: { x: 0, y: -1 },
      outline: [
        { x: -halfW, y: halfH },
        { x: -halfW - railInset, y: halfH + railInset },
        { x: halfW + railInset, y: halfH + railInset },
        { x: halfW, y: halfH },
        { x: -halfW, y: halfH },
      ],
    },
    {
      id: 'rail_S',
      from: { x: halfW + railInset, y: -halfH - railInset },
      to: { x: -halfW - railInset, y: -halfH - railInset },
      normal: { x: 0, y: 1 },
      outline: [
        { x: halfW, y: -halfH },
        { x: halfW + railInset, y: -halfH - railInset },
        { x: -halfW - railInset, y: -halfH - railInset },
        { x: -halfW, y: -halfH },
        { x: halfW, y: -halfH },
      ],
    },
  ];

  return {
    meta: {
      source: 'table-editor:blank-generator',
      pixelsPerInch,
      pixelRects: {
        inner: options.innerPx,
        outer: options.outerPx,
        full: options.fullPx,
      },
      lastModified: Date.now(),
    } as any,
    playArea: {
      width: playWidthIn,
      height: playHeightIn,
    },
    pockets,
    rails,
  };
}

export function scalePhysicsJson(options: {
  json: PhysicsJson;
  newPlayWidth: number;
  newPlayHeight: number;
  radiusRule: RadiusScaleRule;
}): PhysicsJson {
  const next = structuredClone(options.json);
  const oldW = next.playArea.width;
  const oldH = next.playArea.height;
  const scaleX = options.newPlayWidth / oldW;
  const scaleY = options.newPlayHeight / oldH;

  const scaleRadius = (r: number) => {
    if (options.radiusRule === 'constant') return r;
    if (options.radiusRule === 'avg') return r * (scaleX + scaleY) / 2;
    return r * Math.min(scaleX, scaleY);
  };

  next.playArea.width = options.newPlayWidth;
  next.playArea.height = options.newPlayHeight;

  next.pockets.forEach((p) => {
    p.center.x *= scaleX;
    p.center.y *= scaleY;
    p.radius = scaleRadius(p.radius);
    if (p.outline) {
      p.outline = p.outline.map((pt) => ({ x: pt.x * scaleX, y: pt.y * scaleY }));
    }
  });

  next.rails.forEach((r) => {
    r.from.x *= scaleX;
    r.from.y *= scaleY;
    r.to.x *= scaleX;
    r.to.y *= scaleY;
    // Recompute normal from scaled endpoints to preserve unit length and correct direction.
    // Simply scaling normals corrupts their unit length (e.g., {1,0} * {0.9, 1.1} = {0.9, 0}).
    r.normal = computeRailNormal(r.from, r.to, { x: 0, y: 0 });
    if (r.outline) {
      r.outline = r.outline.map((pt) => ({ x: pt.x * scaleX, y: pt.y * scaleY }));
    }
  });

  if (next.meta) {
    (next.meta as any).lastModified = Date.now();
  }

  return ensureDerivedPlayAreaRails(next);
}

function mirrorPoint(pt: { x: number; y: number }, axes: { x: boolean; y: boolean }) {
  return {
    x: axes.y ? -pt.x : pt.x,
    y: axes.x ? -pt.y : pt.y,
  };
}

function distanceSq(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function findNearestPocketIndex(json: PhysicsJson, target: { x: number; y: number }, exclude?: number): number | null {
  let best: { idx: number; d: number } | null = null;
  for (let i = 0; i < json.pockets.length; i++) {
    if (exclude === i) continue;
    const d = distanceSq(json.pockets[i].center, target);
    if (!best || d < best.d) best = { idx: i, d };
  }
  if (!best) return null;
  return best.d <= POCKET_MATCH_TOLERANCE_SQ ? best.idx : null;
}

function railMidpoint(rail: PhysicsJsonRail) {
  return { x: (rail.from.x + rail.to.x) / 2, y: (rail.from.y + rail.to.y) / 2 };
}

function findNearestRailIndex(json: PhysicsJson, targetMid: { x: number; y: number }, exclude?: number): number | null {
  let best: { idx: number; d: number } | null = null;
  for (let i = 0; i < json.rails.length; i++) {
    if (exclude === i) continue;
    if (isDerivedPlayAreaRailId(json.rails[i]?.id)) continue;
    const d = distanceSq(railMidpoint(json.rails[i]), targetMid);
    if (!best || d < best.d) best = { idx: i, d };
  }
  if (!best) return null;
  return best.d <= RAIL_MATCH_TOLERANCE_SQ ? best.idx : null;
}

function findMirroredRailPartners(json: PhysicsJson, sourceRailIndex: number): Array<{ otherIndex: number; axes: { x: boolean; y: boolean } }> {
  const source = json.rails[sourceRailIndex];
  if (!source || isDerivedPlayAreaRailId(source.id)) return [];

  const sourceMid = railMidpoint(source);

  const sameAbsMid = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const tol = RAIL_SYMMETRY_TOLERANCE_IN; // keep tight so we don't "jump" to neighboring cushion segments
    return Math.abs(Math.abs(a.x) - Math.abs(b.x)) <= tol && Math.abs(Math.abs(a.y) - Math.abs(b.y)) <= tol;
  };

  const byAxesKey = new Map<string, { otherIndex: number; axes: { x: boolean; y: boolean }; d: number }>();

  for (let i = 0; i < json.rails.length; i++) {
    if (i === sourceRailIndex) continue;
    const r = json.rails[i];
    if (!r || isDerivedPlayAreaRailId(r.id)) continue;
    const mid = railMidpoint(r);
    if (!sameAbsMid(sourceMid, mid)) continue;

    const axes = mirrorAxesForTarget(sourceMid, mid);
    if (!axes.x && !axes.y) continue;

    const targetMid = mirrorPoint(sourceMid, axes);
    const d = distanceSq(mid, targetMid);
    const key = `${axes.x ? 1 : 0}${axes.y ? 1 : 0}`;
    const best = byAxesKey.get(key);
    if (!best || d < best.d) byAxesKey.set(key, { otherIndex: i, axes, d });
  }

  return [...byAxesKey.values()].map(({ otherIndex, axes }) => ({ otherIndex, axes }));
}

function pickPointIndexForMirroredOutline(options: {
  outline: { x: number; y: number }[];
  originalPointIndex: number;
  target: { x: number; y: number };
}) {
  const forward = options.originalPointIndex;
  const reversed = options.outline.length - 1 - options.originalPointIndex;
  const dF = options.outline[forward] ? distanceSq(options.outline[forward], options.target) : Number.POSITIVE_INFINITY;
  const dR = options.outline[reversed] ? distanceSq(options.outline[reversed], options.target) : Number.POSITIVE_INFINITY;
  return dR < dF ? reversed : forward;
}

export function applyGeometryEdit(options: {
  json: PhysicsJson;
  edit: GeometryEdit;
  mirrorEnabled: boolean;
}): PhysicsJson {
  const next = structuredClone(options.json);

  const applySingle = (edit: GeometryEdit) => {
    if (edit.type === 'move-pocket-center') {
      const pocket = next.pockets[edit.pocketIndex];
      if (!pocket) return;
      const dx = edit.x - pocket.center.x;
      const dy = edit.y - pocket.center.y;
      pocket.center.x = edit.x;
      pocket.center.y = edit.y;
      if (pocket.outline) pocket.outline = pocket.outline.map((pt) => ({ x: pt.x + dx, y: pt.y + dy }));
    }

    if (edit.type === 'move-pocket-outline') {
      const pocket = next.pockets[edit.pocketIndex];
      if (!pocket?.outline?.[edit.pointIndex]) return;
      pocket.outline[edit.pointIndex] = { x: edit.x, y: edit.y };
    }

    if (edit.type === 'set-pocket-radius') {
      const pocket = next.pockets[edit.pocketIndex];
      if (!pocket) return;
      const oldRadius = pocket.radius;
      pocket.radius = edit.radius;
      if (edit.scaleOutline && pocket.outline && oldRadius > 1e-6) {
        const scale = edit.radius / oldRadius;
        pocket.outline = pocket.outline.map((pt) => ({
          x: pocket.center.x + (pt.x - pocket.center.x) * scale,
          y: pocket.center.y + (pt.y - pocket.center.y) * scale,
        }));
      }
    }

    if (edit.type === 'move-rail') {
      const rail = next.rails[edit.railIndex];
      if (!rail) return;
      if (isDerivedPlayAreaRailId(rail.id)) return;
      rail.from = { x: rail.from.x + edit.dx, y: rail.from.y + edit.dy };
      rail.to = { x: rail.to.x + edit.dx, y: rail.to.y + edit.dy };
      if (rail.outline) {
        rail.outline = rail.outline.map((pt) => ({ x: pt.x + edit.dx, y: pt.y + edit.dy }));
      }
    }

    if (edit.type === 'move-rail-end') {
      const rail = next.rails[edit.railIndex];
      if (!rail) return;
      if (isDerivedPlayAreaRailId(rail.id)) return;
      rail[edit.endpoint] = { x: edit.x, y: edit.y };
    }

    if (edit.type === 'move-rail-outline') {
      const rail = next.rails[edit.railIndex];
      if (!rail?.outline?.[edit.pointIndex]) return;
      if (isDerivedPlayAreaRailId(rail.id)) return;
      rail.outline[edit.pointIndex] = { x: edit.x, y: edit.y };
    }
  };

  applySingle(options.edit);

  if (options.mirrorEnabled) {
    const axesList = [
      { x: true, y: false },
      { x: false, y: true },
      { x: true, y: true },
    ];

    for (const axes of axesList) {
      if (options.edit.type === 'move-pocket-center') {
        const sourcePocket = next.pockets[options.edit.pocketIndex];
        if (!sourcePocket) continue;
        const mirroredCenter = mirrorPoint(sourcePocket.center, axes);
        const otherIndex = findNearestPocketIndex(next, mirroredCenter, options.edit.pocketIndex);
        if (otherIndex === null) continue;

        const otherPocket = next.pockets[otherIndex];
        const dx = mirroredCenter.x - otherPocket.center.x;
        const dy = mirroredCenter.y - otherPocket.center.y;
        otherPocket.center = mirroredCenter;
        if (otherPocket.outline) otherPocket.outline = otherPocket.outline.map((pt) => ({ x: pt.x + dx, y: pt.y + dy }));
      }

      if (options.edit.type === 'move-pocket-outline') {
        const sourcePocket = next.pockets[options.edit.pocketIndex];
        if (!sourcePocket?.outline?.[options.edit.pointIndex]) continue;
        const mirroredPoint = mirrorPoint(sourcePocket.outline[options.edit.pointIndex], axes);

        const mirroredPocketCenter = mirrorPoint(sourcePocket.center, axes);
        const otherIndex = findNearestPocketIndex(next, mirroredPocketCenter, options.edit.pocketIndex);
        if (otherIndex === null) continue;

        const otherPocket = next.pockets[otherIndex];
        if (!otherPocket.outline) continue;
        const targetIndex = pickPointIndexForMirroredOutline({
          outline: otherPocket.outline,
          originalPointIndex: options.edit.pointIndex,
          target: mirroredPoint,
        });
        if (!otherPocket.outline[targetIndex]) continue;
        otherPocket.outline[targetIndex] = mirroredPoint;
      }

      if (options.edit.type === 'set-pocket-radius') {
        const sourcePocket = next.pockets[options.edit.pocketIndex];
        if (!sourcePocket) continue;
        const mirroredCenter = mirrorPoint(sourcePocket.center, axes);
        const otherIndex = findNearestPocketIndex(next, mirroredCenter, options.edit.pocketIndex);
        if (otherIndex === null) continue;
        const otherPocket = next.pockets[otherIndex];
        const oldRadius = otherPocket.radius;
        otherPocket.radius = sourcePocket.radius;
        if (options.edit.scaleOutline && otherPocket.outline && oldRadius > 1e-6) {
          const scale = otherPocket.radius / oldRadius;
          otherPocket.outline = otherPocket.outline.map((pt) => ({
            x: otherPocket.center.x + (pt.x - otherPocket.center.x) * scale,
            y: otherPocket.center.y + (pt.y - otherPocket.center.y) * scale,
          }));
        }
      }

    }

    // Rails: do NOT brute-force all axes against "nearest rail" (it can latch to neighboring cushion segments).
    // Instead, mirror only to rails that share the same absolute midpoint (i.e., true symmetric counterpart).
    if (options.edit.type === 'move-rail-end' || options.edit.type === 'move-rail' || options.edit.type === 'move-rail-outline') {
      const partners = findMirroredRailPartners(options.json, options.edit.railIndex);
      for (const { otherIndex, axes } of partners) {
        if (options.edit.type === 'move-rail-end') {
          const sourceRail = next.rails[options.edit.railIndex];
          if (!sourceRail) continue;
          if (isDerivedPlayAreaRailId(sourceRail.id)) continue;
          const otherRail = next.rails[otherIndex];
          if (!otherRail) continue;

          const sourceEndpoint = sourceRail[options.edit.endpoint];
          const targetEndpoint = mirrorPoint(sourceEndpoint, axes);

          const currentFrom = mirrorPoint(sourceRail.from, axes);
          const currentTo = mirrorPoint(sourceRail.to, axes);
          const dSame = distanceSq(otherRail.from, currentFrom) + distanceSq(otherRail.to, currentTo);
          const dSwap = distanceSq(otherRail.from, currentTo) + distanceSq(otherRail.to, currentFrom);

          const endpointOnOther = dSwap < dSame ? (options.edit.endpoint === 'from' ? 'to' : 'from') : options.edit.endpoint;
          (otherRail as any)[endpointOnOther] = targetEndpoint;
          otherRail.normal = mirrorPoint(sourceRail.normal, axes);
        }

        if (options.edit.type === 'move-rail') {
          const otherRail = next.rails[otherIndex];
          if (!otherRail) continue;
          const dx = axes.y ? -options.edit.dx : options.edit.dx;
          const dy = axes.x ? -options.edit.dy : options.edit.dy;

          otherRail.from = { x: otherRail.from.x + dx, y: otherRail.from.y + dy };
          otherRail.to = { x: otherRail.to.x + dx, y: otherRail.to.y + dy };
          if (otherRail.outline) otherRail.outline = otherRail.outline.map((pt) => ({ x: pt.x + dx, y: pt.y + dy }));
        }

        if (options.edit.type === 'move-rail-outline') {
          const sourceRail = next.rails[options.edit.railIndex];
          if (!sourceRail?.outline?.[options.edit.pointIndex]) continue;
          if (isDerivedPlayAreaRailId(sourceRail.id)) continue;
          const otherRail = next.rails[otherIndex];
          if (!otherRail?.outline) continue;

          const sourcePoint = sourceRail.outline[options.edit.pointIndex];
          const targetPoint = mirrorPoint(sourcePoint, axes);
          const targetIndex = pickPointIndexForMirroredOutline({
            outline: otherRail.outline,
            originalPointIndex: options.edit.pointIndex,
            target: targetPoint,
          });
          if (!otherRail.outline[targetIndex]) continue;
          otherRail.outline[targetIndex] = targetPoint;
        }
      }
    }
  }

  if (next.meta) (next.meta as any).lastModified = Date.now();
  return ensureDerivedPlayAreaRails(next);
}
