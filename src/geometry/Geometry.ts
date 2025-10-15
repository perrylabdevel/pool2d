// Geometry Contract: Authoritative coordinate system and table layout
// Origin (0,0) at play-area center; +X right (East), +Y up (North/head)

export interface Vec2 {
  x: number;
  y: number;
}

export interface RailDef {
  id: string;
  points: Vec2[]; // 4-point polygon for tapered cushion
  playingSurfaceEdge: [number, number]; // Indices of the two points that form the collision edge
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

// 9-ft table geometry (100" x 50" play area)
export const TABLE_GEOMETRY: TableGeometry = {
  playWidthIn: 100.0,
  playHeightIn: 50.0,
  cushionProfileIn: 1.75,
  pocketCaptureRadiusIn: 2.5,

  // 6 polygon cushions with tapered ends at pocket openings
  rails: [
    // North-West rail (tapers at NW corner and middle pocket)
    // NW pocket at (-50, 25), middle pocket at (0, 25)
    {
      id: 'N_west',
      points: [
        { x: -46.0, y: 23.5 },  // [0] Inner corner end - NEAR PLAYING SURFACE
        { x: -50.0, y: 27.5 },  // [1] Outer corner end (toward frame/pocket)
        { x: -1.5, y: 27.5 },   // [2] Outer middle end (toward frame/pocket)
        { x: -3.0, y: 23.5 }    // [3] Inner middle end - NEAR PLAYING SURFACE
      ],
      playingSurfaceEdge: [0, 3] // Inner edge: 46" long collision surface
    },
    // North-East rail (tapers at middle pocket and NE corner)
    // Middle pocket at (0, 25), NE pocket at (50, 25)
    {
      id: 'N_east',
      points: [
        { x: 3.0, y: 23.5 },    // [0] Inner middle end - NEAR PLAYING SURFACE
        { x: 1.5, y: 27.5 },    // [1] Outer middle end (toward frame/pocket)
        { x: 50.0, y: 27.5 },   // [2] Outer corner end (toward frame/pocket)
        { x: 46.0, y: 23.5 }    // [3] Inner corner end - NEAR PLAYING SURFACE
      ],
      playingSurfaceEdge: [0, 3] // Inner edge: 46" long collision surface
    },
    // South-West rail (tapers at SW corner and middle pocket)
    // Middle pocket at (0, -25), SW pocket at (-50, -25)
    {
      id: 'S_west',
      points: [
        { x: -3.5, y: -23.5 },  // [0] Inner middle end - NEAR PLAYING SURFACE
        { x: -2.0, y: -27.5 },  // [1] Outer middle end (toward frame/pocket)
        { x: -48.5, y: -27.5 }, // [2] Outer corner end (toward frame/pocket)
        { x: -46.5, y: -23.5 }  // [3] Inner corner end - NEAR PLAYING SURFACE
      ],
      playingSurfaceEdge: [0, 3] // Inner edge: 46" long collision surface
    },
    // South-East rail (tapers at middle pocket and SE corner)
    // SE pocket at (50, -25), middle pocket at (0, -25)
    {
      id: 'S_east',
      points: [
        { x: 46.5, y: -23.5 },  // [0] Inner corner end - NEAR PLAYING SURFACE
        { x: 48.5, y: -27.5 },  // [1] Outer corner end (toward frame/pocket)
        { x: 2.0, y: -27.5 },   // [2] Outer middle end (toward frame/pocket)
        { x: 3.5, y: -23.5 }    // [3] Inner middle end - NEAR PLAYING SURFACE
      ],
      playingSurfaceEdge: [0, 3] // Inner edge: 46" long collision surface
    },
    // West rail (tapers at both SW and NW corners)
    // SW pocket at (-50, -25), NW pocket at (-50, 25)
    {
      id: 'W',
      points: [
        { x: -48.5, y: -21 }, // [0] Inner south end - NEAR PLAYING SURFACE
        { x: -52.5, y: -25 }, // [1] Outer south end (toward frame/pocket)
        { x: -52.5, y: 25 },  // [2] Outer north end (toward frame/pocket)
        { x: -48.5, y: 21 }   // [3] Inner north end - NEAR PLAYING SURFACE
      ],
      playingSurfaceEdge: [0, 3] // Inner edge: 47" long collision surface
    },
    // East rail (tapers at both SE and NE corners)
    // NE pocket at (50, 25), SE pocket at (50, -25)
    {
      id: 'E',
      points: [
        { x: 48.5, y: 21 },   // [0] Inner north end - NEAR PLAYING SURFACE
        { x: 52.5, y: 25 },   // [1] Outer north end (toward frame/pocket)
        { x: 52.5, y: -25 },  // [2] Outer south end (toward frame/pocket)
        { x: 48.5, y: -21 }   // [3] Inner south end - NEAR PLAYING SURFACE
      ],
      playingSurfaceEdge: [0, 3] // Inner edge: 47" long collision surface
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
