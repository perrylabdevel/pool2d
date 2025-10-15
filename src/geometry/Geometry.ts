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
}

export interface TableGeometry {
  playWidthIn: number;
  playHeightIn: number;
  cushionProfileIn: number;
  pocketCaptureRadiusIn: number;
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

// 9-ft table geometry (100" x 50" play area)
// --- Derived jaw geometry helpers (side pockets) ---
const PLAY_HALF_W_IN = 100.0 / 2;
const PLAY_HALF_H_IN = 50.0 / 2;
const X_E_PLAY = PLAY_HALF_W_IN;
const X_W_PLAY = -PLAY_HALF_W_IN;


// Existing felt straight and inner throat Y-levels for north/south
const Y_N_PLAY = PLAY_HALF_H_IN;        // 25.0
const Y_S_PLAY = -PLAY_HALF_H_IN;       // -25.0
const Y_N_STRAIGHT = 23.5;              // existing straight rail y (north)
const Y_S_STRAIGHT = -23.5;             // existing straight rail y (south)
const Y_N_INNER = 24.6;                 // inner throat y (north)
const Y_S_INNER = -24.6;                // inner throat y (south)
const X_E_STRAIGHT = 48.5;              // existing vertical straight x (east)
const X_W_STRAIGHT = -48.5;             // existing vertical straight x (west)

function deriveSideJawXMagnitudes(): { xOuter: number; xInner: number } {
  // Read current geometry params from CONFIG at call time
  const frameOffset = CONFIG.FRAME_OFFSET_IN;
  const jawRadius = CONFIG.JAW_REF_RADIUS_IN;
  const yRectTop = Y_N_PLAY + frameOffset;

  const dTop = yRectTop - Y_N_PLAY; // equals frameOffset
  const r = jawRadius;
  const under = Math.max(0, r * r - dTop * dTop);
  const xi = Math.sqrt(under);

  // Fallback to current geometry if no intersection
  if (!(xi > 1e-6)) {
    return { xOuter: 6.0, xInner: 2.5 };
  }

  // Line from pocket center C to (±xi, Y_RECT_TOP):
  // Param L(s) = C + s * (dx, dy) with dx=±xi, dy=dTop
  const sStraight = (Y_N_STRAIGHT - Y_N_PLAY) / dTop; // negative
  const sInner = (Y_N_INNER - Y_N_PLAY) / dTop;       // negative

  const xOuter = Math.abs(sStraight * xi);
  const xInner = Math.abs(sInner * xi);
  // Guard against degenerate values
  const xOuterClamped = Number.isFinite(xOuter) && xOuter > 0.01 ? xOuter : 6.0;
  const xInnerClamped = Number.isFinite(xInner) && xInner > 0.01 ? xInner : 2.5;
  try {
    console.info(`[Geometry] Apply side jaws: FRAME_OFFSET_IN=${frameOffset}, JAW_REF_RADIUS_IN=${jawRadius}, dTop=${dTop.toFixed(3)}, xi=${xi.toFixed(3)}, xOuter=${xOuterClamped.toFixed(3)}, xInner=${xInnerClamped.toFixed(3)}`);
  } catch {}
  return { xOuter: xOuterClamped, xInner: xInnerClamped };
}

const { xOuter: JAW_X_OUTER, xInner: JAW_X_INNER } = deriveSideJawXMagnitudes();

export function getTableGeometry(): TableGeometry {
  // Recompute on demand from current CONFIG values
  const { xOuter: JAW_X_OUTER, xInner: JAW_X_INNER } = deriveSideJawXMagnitudes();
  // Corner jaw helpers using circle-rectangle intersections
  function cornerTopStraightX(signX: 1 | -1, signY: 1 | -1): number {
    const frameOffset = CONFIG.FRAME_OFFSET_IN;
    const r = CONFIG.JAW_REF_RADIUS_IN;
    const Cx = signX * X_E_PLAY;
    const Cy = signY * Y_N_PLAY;
    const d = frameOffset; // vertical distance from pocket center to rectangle edge
    const disc = r * r - d * d;
    if (!(disc > 0)) return signX > 0 ? 46.0 : -46.0;
    const dx = Math.sqrt(disc); // inward horizontal magnitude at rectangle
    const yStraight = signY > 0 ? Y_N_STRAIGHT : Y_S_STRAIGHT;
    const scale = Math.abs((yStraight - Cy) / d); // always positive
    // Move inward horizontally by scale*dx from the pocket center
    const xStraight = Cx - signX * (scale * dx);
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
    const clamped = signX > 0
      ? clamp(xStraight, JAW_X_OUTER, 46.0)
      : clamp(xStraight, -46.0, -JAW_X_OUTER);
    try { console.info(`[Geometry] Corner topX sX=${signX} sY=${signY} x=${xStraight.toFixed(3)} -> ${clamped.toFixed(3)}`); } catch {}
    return clamped;
  }
  function cornerRectVertex(signX: 1 | -1, signY: 1 | -1): Vec2 {
    const frameOffset = CONFIG.FRAME_OFFSET_IN;
    return { x: signX * (PLAY_HALF_W_IN + frameOffset), y: signY * (PLAY_HALF_H_IN + frameOffset) };
  }
  return {
    playWidthIn: 100.0,
    playHeightIn: 50.0,
    cushionProfileIn: 1.75,
    pocketCaptureRadiusIn: 2.5,
    
    // Rails approximating WPA throat geometry, normals point inward
    // Corner rails stop short of pocket centers to leave openings
    rails: [
    {
      id: 'N_west_taper',
      from: cornerRectVertex(-1, +1),
      to: { x: -cornerTopStraightX(-1, +1), y: Y_N_STRAIGHT },
      normal: { x: 0.447214, y: -0.894427 }
    },
    {
      id: 'N_west_straight',
      from: { x: -cornerTopStraightX(-1, +1), y: Y_N_STRAIGHT },
      to: { x: -JAW_X_OUTER, y: Y_N_STRAIGHT },
      normal: { x: 0, y: -1 }
    },
    {
      id: 'N_left_throat_outer',
      from: { x: -JAW_X_OUTER, y: Y_N_STRAIGHT },
      to: { x: -JAW_X_INNER, y: Y_N_INNER },
      normal: { x: 0, y: -1 }
    },
    {
      id: 'N_left_throat_inner',
      from: { x: -JAW_X_INNER, y: Y_N_INNER },
      to: { x: 0.0, y: Y_N_PLAY },
      normal: { x: 0, y: -1 }
    },
    {
      id: 'N_right_throat_inner',
      from: { x: 0.0, y: Y_N_PLAY },
      to: { x: JAW_X_INNER, y: Y_N_INNER },
      normal: { x: 0, y: -1 }
    },
    {
      id: 'N_right_throat_outer',
      from: { x: JAW_X_INNER, y: Y_N_INNER },
      to: { x: JAW_X_OUTER, y: Y_N_STRAIGHT },
      normal: { x: 0, y: -1 }
    },
    {
      id: 'N_east_straight',
      from: { x: JAW_X_OUTER, y: Y_N_STRAIGHT },
      to: { x: cornerTopStraightX(+1, +1), y: Y_N_STRAIGHT },
      normal: { x: 0, y: -1 }
    },
    {
      id: 'N_east_taper',
      from: { x: cornerTopStraightX(+1, +1), y: Y_N_STRAIGHT },
      to: cornerRectVertex(+1, +1),
      normal: { x: -0.447214, y: -0.894427 }
    },
    {
      id: 'E_north_taper',
      from: cornerRectVertex(+1, +1),
      to: { x: X_E_STRAIGHT, y: 21.0 },
      normal: { x: -0.894427, y: -0.447214 }
    },
    {
      id: 'E_center',
      from: { x: 48.5, y: 21.0 },
      to: { x: 48.5, y: -21.0 },
      normal: { x: -1, y: 0 }
    },
    {
      id: 'E_south_taper',
      from: { x: X_E_STRAIGHT, y: -21.0 },
      to: cornerRectVertex(+1, -1),
      normal: { x: -0.894427, y: 0.447214 }
    },
    {
      id: 'S_east_taper',
      from: cornerRectVertex(+1, -1),
      to: { x: cornerTopStraightX(+1, -1), y: Y_S_STRAIGHT },
      normal: { x: -0.447214, y: 0.894427 }
    },
    {
      id: 'S_east_straight',
      from: { x: cornerTopStraightX(+1, -1), y: Y_S_STRAIGHT },
      to: { x: JAW_X_OUTER, y: Y_S_STRAIGHT },
      normal: { x: 0, y: 1 }
    },
    {
      id: 'S_right_throat_outer',
      from: { x: JAW_X_OUTER, y: Y_S_STRAIGHT },
      to: { x: JAW_X_INNER, y: Y_S_INNER },
      normal: { x: 0, y: 1 }
    },
    {
      id: 'S_right_throat_inner',
      from: { x: JAW_X_INNER, y: Y_S_INNER },
      to: { x: 0.0, y: Y_S_PLAY },
      normal: { x: 0, y: 1 }
    },
    {
      id: 'S_left_throat_inner',
      from: { x: 0.0, y: Y_S_PLAY },
      to: { x: -JAW_X_INNER, y: Y_S_INNER },
      normal: { x: 0, y: 1 }
    },
    {
      id: 'S_left_throat_outer',
      from: { x: -JAW_X_INNER, y: Y_S_INNER },
      to: { x: -JAW_X_OUTER, y: Y_S_STRAIGHT },
      normal: { x: 0, y: 1 }
    },
    {
      id: 'S_west_straight',
      from: { x: -JAW_X_OUTER, y: Y_S_STRAIGHT },
      to: { x: -46.0, y: Y_S_STRAIGHT },
      normal: { x: 0, y: 1 }
    },
    {
      id: 'S_west_taper',
      from: { x: -cornerTopStraightX(-1, -1), y: Y_S_STRAIGHT },
      to: cornerRectVertex(-1, -1),
      normal: { x: 0.447214, y: 0.894427 }
    },
    {
      id: 'W_south_taper',
      from: cornerRectVertex(-1, -1),
      to: { x: X_W_STRAIGHT, y: -21.0 },
      normal: { x: 0.894427, y: 0.447214 }
    },
    {
      id: 'W_center',
      from: { x: -48.5, y: -21.0 },
      to: { x: -48.5, y: 21.0 },
      normal: { x: 1, y: 0 }
    },
    {
      id: 'W_north_taper',
      from: { x: X_W_STRAIGHT, y: 21.0 },
      to: cornerRectVertex(-1, +1),
      normal: { x: 0.894427, y: -0.447214 }
    }
    ],
    
    // Pockets at corners and midpoints
    pockets: [
    { 
      id: 'NW_corner', 
      center: { x: -50.0, y: 25.0 }, 
      cutNormalHint: { x: 1, y: -1 } 
    },
    { 
      id: 'NE_corner', 
      center: { x: 50.0, y: 25.0 }, 
      cutNormalHint: { x: -1, y: -1 } 
    },
    { 
      id: 'SW_corner', 
      center: { x: -50.0, y: -25.0 }, 
      cutNormalHint: { x: 1, y: 1 } 
    },
    { 
      id: 'SE_corner', 
      center: { x: 50.0, y: -25.0 }, 
      cutNormalHint: { x: -1, y: 1 } 
    },
    { 
      id: 'N_middle', 
      center: { x: 0.0, y: 25.0 }, 
      cutNormalHint: { x: 0, y: -1 } 
    },
    { 
      id: 'S_middle', 
      center: { x: 0.0, y: -25.0 }, 
      cutNormalHint: { x: 0, y: 1 } 
    }
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
