// All game configuration and tunables
// Coordinate system: Origin (0,0) at table center, +X=East, +Y=North (up)
// See geometry.md for authoritative geometry contract

export const CONFIG = {
  // Physics
  PHYSICS_DT: 1 / 120, // Fixed timestep (120 Hz)
  MAX_SUBSTEPS: 10,
  SOLVER_ITERATIONS: 15,
  
  // Table dimensions (9-ft table: 100" x 50" play area)
  // NOTE: Actual geometry defined in src/geometry/Geometry.ts
  TABLE_WIDTH: 100, // inches (full width, for legacy compat)
  TABLE_HEIGHT: 50,  // inches (full height, for legacy compat)
  RAIL_THICKNESS_INNER: 0.2, // inward extension toward play area (inches)
  RAIL_THICKNESS_OUTER: 0.2, // outward extension toward frame (inches)
  
  // Ball properties
  BALL_RADIUS: 2.25 / 2, // 2.25" diameter
  BALL_MASS: 1.0,
  BALL_RESTITUTION: 0.93, // Ball-ball
  CUSHION_RESTITUTION: 0.88, // Ball-cushion
  
  // Friction - balanced for 10x velocity multiplier
  ROLLING_FRICTION: 0.55, // Slightly higher for faster settles (tuned for 10x velocity)
  SLIDING_FRICTION: 0.65, // Ball-table friction
  BALL_BALL_FRICTION: 0.01, // Reduced for more realistic smooth ball surfaces (phenolic resin)
  VELOCITY_EPSILON: 0.2, // Sleep threshold adjusted for 10x velocity scale
  
  // Pockets (center-origin coordinates: see Geometry.ts for authoritative definitions)
  POCKET_RADIUS: 2.5,
  POCKET_CAPTURE_RADIUS_CORNER: 2.5,
  POCKET_CAPTURE_RADIUS_SIDE: 2.5,
  POCKET_VISUAL_RADIUS_CORNER: 2.5,
  POCKET_VISUAL_RADIUS_SIDE: 2.5,
  POCKET_SHELF_DEPTH_IN: 0.5,
  
  // Cue
  CUE_POWER_MIN: 0.5,
  CUE_POWER_MAX: 25.0, // Power bar range
  CUE_POWER_MULTIPLIER: 10.0, // Multiply power to get realistic velocity (25 * 10 = 250 in/s)
  CUE_DRAG_SCALE: 0.08, // Power buildup rate
  AIM_LINE_LENGTH: 20,
  GHOST_LINE_LENGTH: 30,
  FINE_AIM_SENSITIVITY: 0.1,
  
  // Aim assist visual settings
  AIM_LINE_OFFSET: 0.2, // Distance from cue ball edge to aim line start
  GHOST_BALL_OFFSET: 0.0, // Offset of ghost ball from contact point (negative = toward cue)
  OBJECT_PATH_PERCENTAGE: 1.0, // Multiplier for object ball path length (0.5 = 50% length)
  
  // Rendering
  CANVAS_SCALE: 8, // Pixels per game unit
  CANVAS_SCALE_MULTIPLIER: 1,
  BALL_VISUAL_SCALE: 1,
  TABLE_COLOR: '#0a5f0a',
  FRAME_COLOR: '#3d2413',
  RAIL_COLOR: '#2d1810',
  RAIL_FILL_COLOR: '#000000', // Fill color for area between corner pockets
  POCKET_COLOR: '#000000',
  CUE_BALL_COLOR: '#ffffff',
  BALL_COLORS: [
    '#ffff00', // 1 - yellow (solid)
    '#0000ff', // 2 - blue (solid)
    '#ff0000', // 3 - red (solid)
    '#800080', // 4 - purple (solid)
    '#ff8800', // 5 - orange (solid)
    '#008000', // 6 - green (solid)
    '#8b0000', // 7 - maroon (solid)
    '#000000', // 8 - black
    '#ffff00', // 9 - yellow (stripe)
    '#0000ff', // 10 - blue (stripe)
    '#ff0000', // 11 - red (stripe)
    '#800080', // 12 - purple (stripe)
    '#ff8800', // 13 - orange (stripe)
    '#008000', // 14 - green (stripe)
    '#8b0000', // 15 - maroon (stripe)
  ],
  
  // Debug
  DEBUG_DRAW_NORMALS: true,
  DEBUG_DRAW_VELOCITIES: true,
  DEBUG_DRAW_AABB: true,
  DEBUG_DRAW_CONTACTS: true,
  
  // Performance
  TARGET_FPS: 60,
  
  // Game rules
  BREAK_SPEED_THRESHOLD: 5.0, // Minimum speed for legal break
  BALL_IN_HAND_ANYWHERE: false, // 8-ball: behind head string only on break
  
  // Geometry tuning
  FRAME_OFFSET_IN: 4.0, // Outer frame offset from play area (in)
  SIDE_FRAME_OFFSET_IN: 2.0, // Frame offset for side pocket tangent calculation (smaller = steeper jaws)
  SIDE_POCKET_OUTWARD_OFFSET_IN: 0.25, // Side pocket center offset toward frame
  CORNER_FRAME_OFFSET_IN: 4.0, // Frame offset used for corner jaw derivation (decoupled from FRAME_OFFSET_IN)
  SIDE_STRAIGHT_Y_IN: 23.5, // Y position of straight rail segment before side pocket (|Y|)
  SIDE_INNER_Y_IN: 24.6, // Inner throat Y position for side pockets (|Y|)
  CORNER_STRAIGHT_X_IN: 48.5, // X position of vertical straight rail segment before corner pocket (|X|)
  CORNER_TARGET_Y_IN: 21.0, // Target Y where corner jaw meets vertical straight segment
  SIDE_JAW_OUTER_OVERRIDE_IN: null as number | null, // Override for side jaw outer X magnitude (null = derive)
  SIDE_JAW_INNER_OVERRIDE_IN: null as number | null, // Override for side jaw inner X magnitude (null = derive)
  CORNER_JAW_X_OVERRIDE_IN: null as number | null, // Override for corner jaw X transition (null = derive)
  CORNER_JAW_Y_OVERRIDE_IN: null as number | null, // Override for corner jaw Y transition (null = derive)
  SIDE_THROAT_WIDTH_IN: null as number | null, // Override for side throat width (null = derive)
  CORNER_THROAT_WIDTH_IN: null as number | null, // Override for corner throat width (null = derive)
  JAW_REF_RADIUS_IN: 4.0, // Reference radius for side pocket jaw angle derivation (in)
  CORNER_JAW_REF_RADIUS_IN: 4.0, // Reference radius for corner pocket jaw angle derivation (in)
  SIDE_CUT_ANGLE_DEG: 0.0, // Angle adjustment for side pocket cut (degrees)
  CORNER_CUT_ANGLE_DEG: 0.0, // Angle adjustment for corner pocket cut (degrees)
  SIDE_CUT_ROTATION_PIVOT_IN: 23.5, // Distance from center for side cut rotation
  JAW_CURVE_BLEND: 0.0,
};

// Ball IDs
export const BALL_CUE = 0;
export const BALL_8 = 8;
export const BALLS_SOLID = [1, 2, 3, 4, 5, 6, 7];
export const BALLS_STRIPE = [9, 10, 11, 12, 13, 14, 15];

// Initial rack positions (triangle at foot spot = East side, center-origin coords)
// Tight rack: ball diameter = 2.25", arranged in equilateral triangle
// Row spacing (X): 2.25 * cos(30°) = 1.9486"
// Ball spacing (Y): 2.25"
export const RACK_POSITIONS = [
  // Row 1 (apex)
  { id: 1, x: 25, y: 0 },
  // Row 2
  { id: 9, x: 26.95, y: 1.125 },
  { id: 2, x: 26.95, y: -1.125 },
  // Row 3
  { id: 10, x: 28.90, y: 2.25 },
  { id: 8, x: 28.90, y: 0 },          // 8-ball in center
  { id: 3, x: 28.90, y: -2.25 },
  // Row 4
  { id: 11, x: 30.85, y: 3.375 },
  { id: 4, x: 30.85, y: 1.125 },
  { id: 5, x: 30.85, y: -1.125 },
  { id: 12, x: 30.85, y: -3.375 },
  // Row 5
  { id: 13, x: 32.80, y: 4.5 },
  { id: 6, x: 32.80, y: 2.25 },
  { id: 14, x: 32.80, y: 0 },
  { id: 7, x: 32.80, y: -2.25 },
  { id: 15, x: 32.80, y: -4.5 },
];

// Cue ball starting position (head spot = West side, center-origin coords)
export const CUE_BALL_POSITION = { x: -25, y: 0 };
