// Ball-in-hand placement helper: clamps a target point inside the play area
// using rail half-spaces, endpoint caps, and pocket exclusion disks.

import type { Rail, Pocket } from '../physics/Shapes';
import { getTableGeometry } from './Geometry';
import { CONFIG } from '../config';

export interface Vec2 { x: number; y: number }

export type ConstraintHit =
  | { type: 'rail'; index: number }
  | { type: 'endpoint'; railIndex: number; end: 'a' | 'b' }
  | { type: 'pocket'; index: number };

export interface ClampResult {
  x: number;
  y: number;
  hits: ConstraintHit[];
}

type IterationLog = {
  iter: number;
  moved: boolean;
  pos: { x: number; y: number };
  note?: string;
};

export function clampBallInHand(
  target: Vec2,
  radius: number,
  rails: Rail[],
  pockets: Pocket[],
  opts?: { iterations?: number; pocketMargin?: number }
): ClampResult {
  const iterations = opts?.iterations ?? CONFIG.BALL_IN_HAND_ITERATIONS ?? 3;
  const pocketMargin = opts?.pocketMargin ?? CONFIG.BALL_IN_HAND_POCKET_MARGIN_IN ?? 0;
  const epsilon = 1e-6;
  const endpointFudge = Math.max(0.05, pocketMargin);

  let px = target.x;
  let py = target.y;
  const hits: ConstraintHit[] = [];
  const globalLog = (typeof window !== 'undefined') && (window as any).__BIH_LOG__ === true;
  const DO_LOG = CONFIG.DEBUG_BIH_LOG || globalLog;
  const logs: IterationLog[] = DO_LOG ? [] : [];

  // Precompute a heuristic "near edge" check so chord half-spaces can apply even if the
  // projection t is slightly outside the chord segment at extreme corners.
  const geomBounds = getTableGeometry();
  const halfW = geomBounds.playWidthIn * 0.5;
  const halfH = geomBounds.playHeightIn * 0.5;

  // Build virtual "mouth chords" across corner pocket openings to prevent placement
  // from slipping through the jaw gap. These behave like inward-facing rails.
  type Segment = { ax: number; ay: number; bx: number; by: number; nx: number; ny: number };
  const chords: Segment[] = (() => {
    const geom = getTableGeometry();
    const byId = new Map<string, { from: { x: number; y: number }; to: { x: number; y: number } }>();
    for (const r of geom.rails) {
      byId.set(r.id, { from: r.from, to: r.to });
    }

    const makeChord = (aId: string, pickA: 'from' | 'to', bId: string, pickB: 'from' | 'to'): Segment | null => {
      const ra = byId.get(aId);
      const rb = byId.get(bId);
      if (!ra || !rb) return null;
      const ax = ra[pickA].x, ay = ra[pickA].y;
      const bx = rb[pickB].x, by = rb[pickB].y;
      const dx = bx - ax, dy = by - ay;
      const len = Math.hypot(dx, dy);
      if (len < 1e-6) return null;
      // Candidate normal (rotate 90deg CCW)
      let nx = -dy / len, ny = dx / len;
      // Ensure normal points inward by testing midpoint against origin (0,0)
      const sCenter = (0 - ax) * nx + (0 - ay) * ny; // signed distance of origin
      // We want the origin (0,0) to be on the positive side (inward)
      if (sCenter < 0) { nx = -nx; ny = -ny; }
      return { ax, ay, bx, by, nx, ny };
    };

    const result: Segment[] = [];
    // NE corner: from northCornerEast ('N_east_taper'.from) to eastVerticalTop ('E_north_taper'.to)
    const ne = makeChord('N_east_taper', 'from', 'E_north_taper', 'to');
    if (ne) result.push(ne);
    // NW corner: from northCornerWest ('N_west_taper'.to) to westVerticalTop ('W_north_taper'.from)
    const nw = makeChord('N_west_taper', 'to', 'W_north_taper', 'from');
    if (nw) result.push(nw);
    // SW corner: from southCornerWest ('S_west_taper'.from) to westVerticalBottom ('W_south_taper'.to)
    const sw = makeChord('S_west_taper', 'from', 'W_south_taper', 'to');
    if (sw) result.push(sw);
    // SE corner: from southCornerEast ('S_east_taper'.to) to eastVerticalBottom ('E_south_taper'.from)
    const se = makeChord('S_east_taper', 'to', 'E_south_taper', 'from');
    if (se) result.push(se);

    return result;
  })();

  for (let iter = 0; iter < iterations; iter++) {
    let moved = false;

    // Rails as half-spaces, with endpoint caps
    for (let i = 0; i < rails.length; i++) {
      const r = rails[i];
      const ax = r.x1;
      const ay = r.y1;
      const bx = r.x2;
      const by = r.y2;
      const vx = bx - ax;
      const vy = by - ay;
      const len2 = vx * vx + vy * vy;
      if (len2 < epsilon) continue;

      const t = ((px - ax) * vx + (py - ay) * vy) / len2;
      if (t >= 0 && t <= 1) {
        // Perpendicular to segment: push along inward normal if inside
        const s = (px - ax) * r.nx + (py - ay) * r.ny;
        if (s < radius) {
          const push = radius - s;
          px += r.nx * push;
          py += r.ny * push;
          hits.push({ type: 'rail', index: i });
          moved = true;
        }
      } else {
        // Outside segment extents: constrain to nearest endpoint as a circular obstacle
        const ex = t < 0 ? ax : bx;
        const ey = t < 0 ? ay : by;
        const dx = px - ex;
        const dy = py - ey;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const capR = radius + endpointFudge;
        if (dist < capR && dist > epsilon) {
          const nx = dx / dist;
          const ny = dy / dist;
          const push = capR - dist;
          px += nx * push;
          py += ny * push;
          hits.push({ type: 'endpoint', railIndex: i, end: t < 0 ? 'a' : 'b' });
          moved = true;
        }
      }
    }

    // Corner mouth chords as inward half-spaces (prevent slipping into jaws)
    for (const seg of chords) {
      const ax = seg.ax, ay = seg.ay, bx = seg.bx, by = seg.by, nx = seg.nx, ny = seg.ny;
      const vx = bx - ax, vy = by - ay;
      const len2 = vx * vx + vy * vy;
      if (len2 < epsilon) continue;

      // Only apply when projecting within segment extents, allow a small padding
      const t = ((px - ax) * vx + (py - ay) * vy) / len2;
      const nearEdge = (Math.abs(px) > halfW - 8) || (Math.abs(py) > halfH - 8);
      const tPad = 0.3; // allow noticeable overhang to catch near-end cases
      if (nearEdge || (t >= -tPad && t <= 1 + tPad)) {
        const s = (px - ax) * nx + (py - ay) * ny;
        // Give the chord thickness so points very near it still get pushed inward
        const chordThickness = endpointFudge; // same scale as endpoint fudge
        const minS = radius + chordThickness;
        if (s < minS) {
          const push = minS - s;
          px += nx * push;
          py += ny * push;
          moved = true;
        }
      }
      // Endpoint caps for chord to avoid sliding around the ends
      // Treat endpoints as circular obstacles slightly larger than ball radius
      const cap1dx = px - ax, cap1dy = py - ay;
      const cap1d = Math.sqrt(cap1dx * cap1dx + cap1dy * cap1dy);
      const chordCapR = radius + endpointFudge * 1.25;
      if (cap1d < chordCapR && cap1d > epsilon) {
        const cx = cap1dx / cap1d, cy = cap1dy / cap1d;
        const push = chordCapR - cap1d;
        px += cx * push;
        py += cy * push;
        moved = true;
      }
      const cap2dx = px - bx, cap2dy = py - by;
      const cap2d = Math.sqrt(cap2dx * cap2dx + cap2dy * cap2dy);
      if (cap2d < chordCapR && cap2d > epsilon) {
        const cx = cap2dx / cap2d, cy = cap2dy / cap2d;
        const push = chordCapR - cap2d;
        px += cx * push;
        py += cy * push;
        moved = true;
      }
    }

    // Pocket exclusion
    const safety = Math.max(0, pocketMargin);
    for (let p = 0; p < pockets.length; p++) {
      const pocket = pockets[p];
      const dx = px - pocket.x;
      const dy = py - pocket.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // Keep the BALL EDGE outside the pocket capture disk.
      // Use pocket capture radius + ball radius (+ optional safety margin).
      const minDist = (pocket.radius ?? 0) + radius + safety + endpointFudge * 0.5;
      if (dist < minDist) {
        const nx = dist > epsilon ? dx / dist : 1;
        const ny = dist > epsilon ? dy / dist : 0;
        const push = minDist - dist;
        px += nx * push;
        py += ny * push;
        hits.push({ type: 'pocket', index: p });
        moved = true;
      }
    }

    if (!moved) break;
    if (DO_LOG) {
      logs.push({ iter, moved, pos: { x: px, y: py } });
    }
  }

  if (DO_LOG) {
    try {
      // One collapsed group per clamp call
      // Summarize target, result, and how many adjustments were applied
      // Include chord endpoints for context
      // eslint-disable-next-line no-console
      console.groupCollapsed(
        `BIH clamp: raw=(${target.x.toFixed(3)},${target.y.toFixed(3)}) -> clamped=(${px.toFixed(3)},${py.toFixed(3)})  hits=${hits.length}`
      );
      // eslint-disable-next-line no-console
      console.log('radius', radius, 'iterations', iterations, 'margin', pocketMargin);
      if (chords.length) {
        // eslint-disable-next-line no-console
        console.log('corner mouth chords', chords.map(c => ({ a: { x: c.ax, y: c.ay }, b: { x: c.bx, y: c.by } })));
      }
      if (logs.length) {
        // eslint-disable-next-line no-console
        console.table(logs.map(l => ({ iter: l.iter, moved: l.moved, x: l.pos.x.toFixed(3), y: l.pos.y.toFixed(3) })));
      }
      // eslint-disable-next-line no-console
      console.groupEnd();
    } catch {}
  }

  return { x: px, y: py, hits };
}
