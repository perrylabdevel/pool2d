// Geometry Contract: Authoritative coordinate system and table layout
// Origin (0,0) at play-area center; +X right (East), +Y up (North/head)

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
export const TABLE_GEOMETRY: TableGeometry = {
  playWidthIn: 100.0,
  playHeightIn: 50.0,
  cushionProfileIn: 1.75,
  pocketCaptureRadiusIn: 2.5,
  
  // Rails approximating WPA throat geometry, normals point inward
  // Corner rails stop short of pocket centers to leave openings
  rails: [
    {
      id: 'N_west_taper',
      from: { x: -51.77, y: 26.77 },
      to: { x: -46.0, y: 23.5 },
      normal: { x: 0.447214, y: -0.894427 }
    },
    {
      id: 'N_west_straight',
      from: { x: -46.0, y: 23.5 },
      to: { x: -6.0, y: 23.5 },
      normal: { x: 0, y: -1 }
    },
    {
      id: 'N_left_throat_outer',
      from: { x: -6.0, y: 23.5 },
      to: { x: -2.5, y: 24.6 },
      normal: { x: 0, y: -1 }
    },
    {
      id: 'N_left_throat_inner',
      from: { x: -2.5, y: 24.6 },
      to: { x: 0.0, y: 25.0 },
      normal: { x: 0, y: -1 }
    },
    {
      id: 'N_right_throat_inner',
      from: { x: 0.0, y: 25.0 },
      to: { x: 2.5, y: 24.6 },
      normal: { x: 0, y: -1 }
    },
    {
      id: 'N_right_throat_outer',
      from: { x: 2.5, y: 24.6 },
      to: { x: 6.0, y: 23.5 },
      normal: { x: 0, y: -1 }
    },
    {
      id: 'N_east_straight',
      from: { x: 6.0, y: 23.5 },
      to: { x: 46.0, y: 23.5 },
      normal: { x: 0, y: -1 }
    },
    {
      id: 'N_east_taper',
      from: { x: 46.0, y: 23.5 },
      to: { x: 51.77, y: 26.77 },
      normal: { x: -0.447214, y: -0.894427 }
    },
    {
      id: 'E_north_taper',
      from: { x: 51.77, y: 26.77 },
      to: { x: 48.5, y: 21.0 },
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
      from: { x: 48.5, y: -21.0 },
      to: { x: 51.77, y: -26.77 },
      normal: { x: -0.894427, y: 0.447214 }
    },
    {
      id: 'S_east_taper',
      from: { x: 51.77, y: -26.77 },
      to: { x: 46.0, y: -23.5 },
      normal: { x: -0.447214, y: 0.894427 }
    },
    {
      id: 'S_east_straight',
      from: { x: 46.0, y: -23.5 },
      to: { x: 6.0, y: -23.5 },
      normal: { x: 0, y: 1 }
    },
    {
      id: 'S_right_throat_outer',
      from: { x: 6.0, y: -23.5 },
      to: { x: 2.5, y: -24.6 },
      normal: { x: 0, y: 1 }
    },
    {
      id: 'S_right_throat_inner',
      from: { x: 2.5, y: -24.6 },
      to: { x: 0.0, y: -25.0 },
      normal: { x: 0, y: 1 }
    },
    {
      id: 'S_left_throat_inner',
      from: { x: 0.0, y: -25.0 },
      to: { x: -2.5, y: -24.6 },
      normal: { x: 0, y: 1 }
    },
    {
      id: 'S_left_throat_outer',
      from: { x: -2.5, y: -24.6 },
      to: { x: -6.0, y: -23.5 },
      normal: { x: 0, y: 1 }
    },
    {
      id: 'S_west_straight',
      from: { x: -6.0, y: -23.5 },
      to: { x: -46.0, y: -23.5 },
      normal: { x: 0, y: 1 }
    },
    {
      id: 'S_west_taper',
      from: { x: -46.0, y: -23.5 },
      to: { x: -51.77, y: -26.77 },
      normal: { x: 0.447214, y: 0.894427 }
    },
    {
      id: 'W_south_taper',
      from: { x: -51.77, y: -26.77 },
      to: { x: -48.5, y: -21.0 },
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
      from: { x: -48.5, y: 21.0 },
      to: { x: -51.77, y: 26.77 },
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
