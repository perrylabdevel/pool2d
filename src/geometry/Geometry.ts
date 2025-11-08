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
  pocketJawGapIn: number;
  rails: RailDef[];
  pockets: PocketDef[];
}

// 9-ft table geometry (100" x 50" play area)
export const TABLE_GEOMETRY: TableGeometry = {
  playWidthIn: 100.0,
  playHeightIn: 50.0,
  cushionProfileIn: 1.75,
  pocketCaptureRadiusIn: 2.5,
  pocketJawGapIn: 7.0,
  
  // Rails on inner cushion line, normals point inward
  rails: [
    { 
      id: 'N_rail', 
      from: { x: -50.0, y: 25.0 }, 
      to: { x: 50.0, y: 25.0 }, 
      normal: { x: 0, y: -1 } 
    },
    { 
      id: 'S_rail', 
      from: { x: -50.0, y: -25.0 }, 
      to: { x: 50.0, y: -25.0 }, 
      normal: { x: 0, y: 1 } 
    },
    { 
      id: 'W_rail', 
      from: { x: -50.0, y: -25.0 }, 
      to: { x: -50.0, y: 25.0 }, 
      normal: { x: 1, y: 0 } 
    },
    { 
      id: 'E_rail', 
      from: { x: 50.0, y: -25.0 }, 
      to: { x: 50.0, y: 25.0 }, 
      normal: { x: -1, y: 0 } 
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
