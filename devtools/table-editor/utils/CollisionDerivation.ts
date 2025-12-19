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
 * Gets all collision rails that the game will actually use.
 * This includes play_area rails and derived jaw rails.
 */
export function getCollisionRails(json: PhysicsJson): DerivedRail[] {
  const collisionRails: DerivedRail[] = [];

  // Add play_area rails
  for (const rail of json.rails || []) {
    if (rail.id?.startsWith('play_area_')) {
      collisionRails.push({
        id: rail.id,
        from: { x: rail.from.x, y: rail.from.y },
        to: { x: rail.to.x, y: rail.to.y },
        normal: { x: rail.normal.x, y: rail.normal.y },
      });
    }
  }

  // Add derived jaw rails
  const jawRails = deriveJawRails(json);
  collisionRails.push(...jawRails);

  return collisionRails;
}
