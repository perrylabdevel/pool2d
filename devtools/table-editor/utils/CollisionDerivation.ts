/**
 * CollisionDerivation - Derives collision geometry from PhysicsJson
 *
 * This replicates the game's logic for deriving jaw rails from cushion outlines,
 * so the table editor can show the complete collision geometry that the game will use.
 */

import type { PhysicsJson } from './JsonLoader';

export interface Vec2 {
  x: number;
  y: number;
}

export interface DerivedRail {
  id: string;
  from: Vec2;
  to: Vec2;
  normal: Vec2;
}

function isFiniteVec2(v: unknown): v is Vec2 {
  if (!v || typeof v !== 'object') return false;
  const vec = v as Record<string, unknown>;
  return Number.isFinite(vec.x) && Number.isFinite(vec.y);
}

function shouldTreatOutlineClosed(outline: Vec2[]): boolean {
  if (!Array.isArray(outline) || outline.length < 3) return false;
  const first = outline[0];
  const last = outline[outline.length - 1];
  if (!isFiniteVec2(first) || !isFiniteVec2(last)) return false;

  const closingLen = Math.hypot(first.x - last.x, first.y - last.y);
  // Explicitly closed (common case)
  if (closingLen < 1e-6) return true;
  // Implicit close if gap is small relative to perimeter
  let perimeter = 0;
  for (let i = 0; i < outline.length - 1; i++) {
    perimeter += Math.hypot(outline[i + 1].x - outline[i].x, outline[i + 1].y - outline[i].y);
  }
  return closingLen < Math.max(0.5, perimeter * 0.02);
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

/**
 * Derives jaw rails from cushion outlines, matching the game's Physics logic.
 * Jaw rails are the angled collision surfaces at pocket openings.
 */
export function deriveJawRails(json: PhysicsJson): DerivedRail[] {
  const jawRails: DerivedRail[] = [];

  const playArea = json.playArea;
  if (!playArea?.width || !playArea?.height) return jawRails;

  const halfW = playArea.width / 2;
  const halfH = playArea.height / 2;

  const isInsidePlayArea = (p: Vec2): boolean => {
    const eps = 1e-3;
    return Math.abs(p.x) <= halfW + eps && Math.abs(p.y) <= halfH + eps;
  };

  const outsideDistance = (p: Vec2): number => {
    const dxOut = Math.max(0, Math.abs(p.x) - halfW);
    const dyOut = Math.max(0, Math.abs(p.y) - halfH);
    return Math.max(dxOut, dyOut);
  };

  const pockets = json.pockets || [];

  const nearestPocketDistSq = (pt: Vec2): number => {
    let best = Number.POSITIVE_INFINITY;
    for (const p of pockets) {
      if (!isFiniteVec2(p?.center)) continue;
      const dx = pt.x - p.center.x;
      const dy = pt.y - p.center.y;
      best = Math.min(best, dx * dx + dy * dy);
    }
    return best;
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

  // Process cushion rails to find jaw rails
  const cushionRails = (json.rails || []).filter(r =>
    r.id?.includes('cushion') && !r.id?.includes('_jaw_')
  );

  for (const cushion of cushionRails) {
    const outline = Array.isArray(cushion.outline)
      ? (cushion.outline as Vec2[]).filter(isFiniteVec2)
      : [];
    if (outline.length < 2) continue;

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

      // Only process edges that cross the play area boundary
      if ((in1 && !in2) || (!in1 && in2)) {
        // Only accept jaw segments near a pocket opening
        const mid: Vec2 = { x: (p1.x + p2.x) * 0.5, y: (p1.y + p2.y) * 0.5 };
        const dSq = nearestPocketDistSq(mid);
        const maxJawDist = 14; // inches
        if (dSq > maxJawDist * maxJawDist) continue;

        const insidePt = in1 ? p1 : p2;
        const outsidePt = in1 ? p2 : p1;

        // Clamp jaw rails to the play area boundary
        const boundaryPt = intersectSegmentPlayAreaBoundary(insidePt, outsidePt);
        if (!boundaryPt) continue;

        // Ensure jaw points outward (away from play area)
        let dirX = outsidePt.x - insidePt.x;
        let dirY = outsidePt.y - insidePt.y;
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

        // Calculate jaw length based on nearest pocket
        const nearest = (() => {
          let best: { center: Vec2; radius: number } | null = null;
          let bestD = Number.POSITIVE_INFINITY;
          for (const p of pockets) {
            if (!isFiniteVec2(p?.center) || !Number.isFinite(p.radius)) continue;
            const pdx = boundaryPt.x - p.center.x;
            const pdy = boundaryPt.y - p.center.y;
            const d = pdx * pdx + pdy * pdy;
            if (d < bestD) {
              bestD = d;
              best = p;
            }
          }
          return best;
        })();

        const maxJawLen = 10; // inches
        const minJawLen = nearest?.radius ? Math.max(1.5, Math.min(6.0, nearest.radius * 1.75)) : 1.5;
        const rawLen = Math.hypot(outsidePt.x - boundaryPt.x, outsidePt.y - boundaryPt.y);
        const jawLen = Math.min(maxJawLen, Math.max(minJawLen, Number.isFinite(rawLen) ? rawLen : minJawLen));

        const jawTo: Vec2 = { x: boundaryPt.x + ux * jawLen, y: boundaryPt.y + uy * jawLen };
        if (outsideDistance(jawTo) < 0.01) continue;

        jawRails.push({
          id: `${cushion.id}_jaw_${i}`,
          from: boundaryPt,
          to: jawTo,
          normal: computeInwardNormal(boundaryPt, jawTo),
        });
      }
    }
  }

  return jawRails;
}

/**
 * Split a play_area rail around pocket openings.
 * This mimics the game's Geometry.ts splitRailByPockets() logic.
 */
function splitRailByPockets(
  rail: DerivedRail,
  pockets: Array<{ center: Vec2; radius: number }>,
  jawRails: DerivedRail[]
): DerivedRail[] {
  const dx = rail.to.x - rail.from.x;
  const dy = rail.to.y - rail.from.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-4) return [rail];

  const ux = dx / len;
  const uy = dy / len;

  const lerpPoint = (t: number): Vec2 => ({
    x: rail.from.x + dx * t,
    y: rail.from.y + dy * t,
  });

  const gaps: [number, number][] = [];

  // Compute pocket-mouth intersection parameters for axis-aligned rails
  const computePocketMouthTs = (): number[] => {
    const ts: number[] = [];
    const epsAxis = 1e-4;
    const isHorizontal = Math.abs(dy) < epsAxis;
    const isVertical = Math.abs(dx) < epsAxis;
    if (!isHorizontal && !isVertical) return ts;

    const y0 = rail.from.y;
    const x0 = rail.from.x;

    for (const p of pockets) {
      if (!isFiniteVec2(p?.center) || !Number.isFinite(p.radius)) continue;
      const r = p.radius;

      if (isHorizontal) {
        const dyc = p.center.y - y0;
        if (Math.abs(dyc) >= r) continue;
        const span = Math.sqrt(Math.max(0, r * r - dyc * dyc));
        for (const x of [p.center.x - span, p.center.x + span]) {
          const t = (x - x0) / dx;
          if (Number.isFinite(t) && t >= -1e-4 && t <= 1 + 1e-4) {
            ts.push(Math.max(0, Math.min(1, t)));
          }
        }
      } else if (isVertical) {
        const dxc = p.center.x - x0;
        if (Math.abs(dxc) >= r) continue;
        const span = Math.sqrt(Math.max(0, r * r - dxc * dxc));
        for (const y of [p.center.y - span, p.center.y + span]) {
          const t = (y - rail.from.y) / dy;
          if (Number.isFinite(t) && t >= -1e-4 && t <= 1 + 1e-4) {
            ts.push(Math.max(0, Math.min(1, t)));
          }
        }
      }
    }

    ts.sort((a, b) => a - b);
    return ts.filter((t, idx) => idx === 0 || Math.abs(t - ts[idx - 1]) > 2e-3);
  };

  // Use jaw rail intersections to cut openings
  if (jawRails.length) {
    const jawTs: number[] = [];
    const segmentIntersectParam = (a: Vec2, b: Vec2, c: Vec2, d: Vec2): number | null => {
      const den = (a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x);
      if (Math.abs(den) < 1e-8) return null;
      const t = ((a.x - c.x) * (c.y - d.y) - (a.y - c.y) * (c.x - d.x)) / den;
      const u = ((a.x - c.x) * (a.y - b.y) - (a.y - c.y) * (a.x - b.x)) / den;
      if (t < -1e-4 || t > 1 + 1e-4 || u < -1e-4 || u > 1 + 1e-4) return null;
      return t;
    };

    for (const j of jawRails) {
      if (!isFiniteVec2(j?.from) || !isFiniteVec2(j?.to)) continue;
      const t = segmentIntersectParam(rail.from, rail.to, j.from, j.to);
      if (t != null) jawTs.push(Math.max(0, Math.min(1, t)));
    }

    jawTs.sort((a, b) => a - b);

    const pocketMouthTs = computePocketMouthTs();
    const jawTsFiltered = pocketMouthTs.length
      ? jawTs.filter((t) => pocketMouthTs.some((pm) => Math.abs(pm - t) <= 0.04))
      : jawTs;

    const uniqueJawTs = jawTsFiltered.filter(
      (t, idx) => idx === 0 || Math.abs(t - jawTsFiltered[idx - 1]) > 1e-4
    );

    const padIn = 0.05;
    const padT = Math.min(0.02, padIn / len);
    const endZoneT = Math.min(0.25, 12 / len);

    let startT = 0;
    let endT = 1;
    let innerTs = uniqueJawTs;

    // Corner pockets: trim ends
    if (innerTs.length && innerTs[0] <= endZoneT) {
      startT = Math.max(startT, innerTs[0] + padT);
      innerTs = innerTs.slice(1);
    }
    if (innerTs.length && innerTs[innerTs.length - 1] >= 1 - endZoneT) {
      endT = Math.min(endT, innerTs[innerTs.length - 1] - padT);
      innerTs = innerTs.slice(0, -1);
    }

    // Side pockets: pairs bound the opening
    for (let i = 0; i + 1 < innerTs.length; i += 2) {
      const a = innerTs[i];
      const b = innerTs[i + 1];
      const s = Math.max(startT, Math.min(endT, Math.min(a, b) - padT));
      const e = Math.max(startT, Math.min(endT, Math.max(a, b) + padT));
      if (e - s > 1e-4) gaps.push([s, e]);
    }

    if (startT > 1e-4) gaps.push([0, startT]);
    if (endT < 1 - 1e-4) gaps.push([endT, 1]);
  }

  // Also use pocket proximity as fallback
  for (const p of pockets) {
    if (!isFiniteVec2(p?.center) || !Number.isFinite(p.radius)) continue;
    const vx = p.center.x - rail.from.x;
    const vy = p.center.y - rail.from.y;
    const proj = vx * ux + vy * uy;
    const perp = Math.abs(vx * -uy + vy * ux);
    const gapLen = Math.max(p.radius * 1.3, 1.0);
    if (proj < -gapLen || proj > len + gapLen) continue;
    if (perp > p.radius * 1.2) continue;
    const t0 = Math.max(0, (proj - gapLen) / len);
    const t1 = Math.min(1, (proj + gapLen) / len);
    gaps.push([t0, t1]);
  }

  if (!gaps.length) return [rail];

  // Merge overlapping gaps
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

  // Build split segments
  const segments: DerivedRail[] = [];
  let cursor = 0;
  for (const [s, e] of merged) {
    if (s > cursor + 1e-4) {
      segments.push({
        ...rail,
        id: `${rail.id}_split_${segments.length}`,
        from: lerpPoint(cursor),
        to: lerpPoint(s),
      });
    }
    cursor = Math.max(cursor, e);
  }
  if (cursor < 1 - 1e-4) {
    segments.push({
      ...rail,
      id: `${rail.id}_split_${segments.length}`,
      from: lerpPoint(cursor),
      to: lerpPoint(1),
    });
  }

  return segments;
}

/**
 * Gets all collision rails that the game will actually use.
 * This includes play_area rails (split around pockets) and derived jaw rails.
 */
export function getCollisionRails(json: PhysicsJson): DerivedRail[] {
  const pockets = (json.pockets || []).filter(
    (p) => isFiniteVec2(p?.center) && Number.isFinite(p.radius)
  );

  // First derive jaw rails (needed for splitting)
  const jawRails = deriveJawRails(json);

  const collisionRails: DerivedRail[] = [];

  // Add play_area rails, splitting them around pockets
  for (const rail of json.rails || []) {
    if (rail.id?.startsWith('play_area_')) {
      const baseRail: DerivedRail = {
        id: rail.id,
        from: { x: rail.from.x, y: rail.from.y },
        to: { x: rail.to.x, y: rail.to.y },
        normal: { x: rail.normal.x, y: rail.normal.y },
      };
      const splitRails = splitRailByPockets(baseRail, pockets, jawRails);
      collisionRails.push(...splitRails);
    }
  }

  // Add derived jaw rails
  collisionRails.push(...jawRails);

  return collisionRails;
}
