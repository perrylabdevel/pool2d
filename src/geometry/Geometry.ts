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

// Existing felt straight and inner throat Y-levels for north/south
const Y_N_PLAY = PLAY_HALF_H_IN;        // 25.0
const Y_S_PLAY = -PLAY_HALF_H_IN;       // -25.0
const Y_N_STRAIGHT = 23.5;              // existing straight rail y (north)
const Y_S_STRAIGHT = -23.5;             // existing straight rail y (south)
const Y_N_INNER = 24.6;                 // inner throat y (north)
const Y_S_INNER = -24.6;                // inner throat y (south)

function deriveSideJawXMagnitudes(): { xOuter: number; xInner: number } {
  // Read from CONFIG at runtime to pick up dynamic changes
  const f = CONFIG.SIDE_FRAME_OFFSET_IN; // Use separate offset for steeper side pocket jaws
  const r = CONFIG.JAW_REF_RADIUS_IN;
  const dTop = f;
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
  return { xOuter: xOuterClamped, xInner: xInnerClamped };
}

// Derive corner jaw geometry using the same tangent approach as side pockets
// Returns the x-coordinate where the horizontal straight section meets the corner
function deriveCornerJawX(): number {
  const f = CONFIG.FRAME_OFFSET_IN;
  const r = CONFIG.CORNER_JAW_REF_RADIUS_IN;
  const under = Math.max(0, r * r - f * f);
  const xi = Math.sqrt(under);
  
  if (!(xi > 1e-6)) {
    return 46.0; // Fallback to current geometry
  }
  
  // Tangent line from frame edge inward toward straight section
  // Pocket at (50, 25), tangent contact on frame, line goes to (x, 23.5)
  const yFrame = PLAY_HALF_H_IN + f; // 29.0
  
  // Parameter along tangent line to reach Y_N_STRAIGHT
  const s = (yFrame - Y_N_STRAIGHT) / xi;
  const xCorner = PLAY_HALF_W_IN - xi + f * s;
  
  const xClamped = Number.isFinite(xCorner) && xCorner > 0.01 ? xCorner : 46.0;
  return xClamped;
}

// Derive the y-coordinate where vertical straight section meets the corner
function deriveCornerJawY(): number {
  const f = CONFIG.FRAME_OFFSET_IN;
  const r = CONFIG.CORNER_JAW_REF_RADIUS_IN;
  const under = Math.max(0, r * r - f * f);
  const xi = Math.sqrt(under);
  
  if (!(xi > 1e-6)) {
    return 21.0; // Fallback to current geometry
  }
  
  // Parameter along tangent line to reach X_E_STRAIGHT (48.5)
  const xFrame = PLAY_HALF_W_IN + f; // 54.0
  const X_E_STRAIGHT = 48.5;
  const s = (xFrame - X_E_STRAIGHT) / xi;
  const yCorner = PLAY_HALF_H_IN - xi + f * s;
  
  const yClamped = Number.isFinite(yCorner) && yCorner > 0.01 ? yCorner : 21.0;
  return yClamped;
}

export function getTableGeometry(): TableGeometry {
  // Recompute on demand from current CONFIG values
  const { xOuter: JAW_X_OUTER, xInner: JAW_X_INNER } = deriveSideJawXMagnitudes();
  const CORNER_JAW_X = deriveCornerJawX();
  const CORNER_JAW_Y = deriveCornerJawY();
  
  // Compute corner taper endpoints (diagonal segments connecting horizontal and vertical straights)
  const CORNER_NE_X = PLAY_HALF_W_IN + CONFIG.FRAME_OFFSET_IN;
  const CORNER_NE_Y = PLAY_HALF_H_IN + CONFIG.FRAME_OFFSET_IN;
  const CORNER_NW_X = -(PLAY_HALF_W_IN + CONFIG.FRAME_OFFSET_IN);
  const CORNER_NW_Y = PLAY_HALF_H_IN + CONFIG.FRAME_OFFSET_IN;
  const CORNER_SE_X = PLAY_HALF_W_IN + CONFIG.FRAME_OFFSET_IN;
  const CORNER_SE_Y = -(PLAY_HALF_H_IN + CONFIG.FRAME_OFFSET_IN);
  const CORNER_SW_X = -(PLAY_HALF_W_IN + CONFIG.FRAME_OFFSET_IN);
  const CORNER_SW_Y = -(PLAY_HALF_H_IN + CONFIG.FRAME_OFFSET_IN);
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
      from: { x: CORNER_NW_X, y: CORNER_NW_Y },
      to: { x: -CORNER_JAW_X, y: Y_N_STRAIGHT },
      normal: { x: 0.447214, y: -0.894427 }
    },
    {
      id: 'N_west_straight',
      from: { x: -CORNER_JAW_X, y: Y_N_STRAIGHT },
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
      to: { x: CORNER_JAW_X, y: Y_N_STRAIGHT },
      normal: { x: 0, y: -1 }
    },
    {
      id: 'N_east_taper',
      from: { x: CORNER_JAW_X, y: Y_N_STRAIGHT },
      to: { x: CORNER_NE_X, y: CORNER_NE_Y },
      normal: { x: -0.447214, y: -0.894427 }
    },
    {
      id: 'E_north_taper',
      from: { x: CORNER_NE_X, y: CORNER_NE_Y },
      to: { x: 48.5, y: CORNER_JAW_Y },
      normal: { x: -0.894427, y: -0.447214 }
    },
    {
      id: 'E_center',
      from: { x: 48.5, y: CORNER_JAW_Y },
      to: { x: 48.5, y: -CORNER_JAW_Y },
      normal: { x: -1, y: 0 }
    },
    {
      id: 'E_south_taper',
      from: { x: 48.5, y: -CORNER_JAW_Y },
      to: { x: CORNER_SE_X, y: CORNER_SE_Y },
      normal: { x: -0.894427, y: 0.447214 }
    },
    {
      id: 'S_east_taper',
      from: { x: CORNER_SE_X, y: CORNER_SE_Y },
      to: { x: CORNER_JAW_X, y: Y_S_STRAIGHT },
      normal: { x: -0.447214, y: 0.894427 }
    },
    {
      id: 'S_east_straight',
      from: { x: CORNER_JAW_X, y: Y_S_STRAIGHT },
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
      to: { x: -CORNER_JAW_X, y: Y_S_STRAIGHT },
      normal: { x: 0, y: 1 }
    },
    {
      id: 'S_west_taper',
      from: { x: -CORNER_JAW_X, y: Y_S_STRAIGHT },
      to: { x: CORNER_SW_X, y: CORNER_SW_Y },
      normal: { x: 0.447214, y: 0.894427 }
    },
    {
      id: 'W_south_taper',
      from: { x: CORNER_SW_X, y: CORNER_SW_Y },
      to: { x: -48.5, y: -CORNER_JAW_Y },
      normal: { x: 0.894427, y: 0.447214 }
    },
    {
      id: 'W_center',
      from: { x: -48.5, y: -CORNER_JAW_Y },
      to: { x: -48.5, y: CORNER_JAW_Y },
      normal: { x: 1, y: 0 }
    },
    {
      id: 'W_north_taper',
      from: { x: -48.5, y: CORNER_JAW_Y },
      to: { x: CORNER_NW_X, y: CORNER_NW_Y },
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
