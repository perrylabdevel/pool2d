// All game configuration and tunables
// Coordinate system: Origin (0,0) at table center, +X=East, +Y=North (up)
// See docs/geometry/geometry.md for authoritative geometry contract

export const CONFIG = {
  // Physics
  PHYSICS_DT: 1 / 120, // Fixed timestep (120 Hz)
  MAX_SUBSTEPS: 10,
  SOLVER_ITERATIONS: 15,

  // Table dimensions (9-ft table: 100" x 50" play area)
  // NOTE: Actual geometry defined in src/geometry/Geometry.ts
  TABLE_WIDTH: 100, // inches (full width, for legacy compat)
  TABLE_HEIGHT: 50,  // inches (full height, for legacy compat)
  RAIL_THICKNESS_INNER: 0, // Ignored by SVG

  // Experimental: SVG/JSON Geometry Override
  USE_SVG_GEOMETRY: true,
  USE_JSON_GEOMETRY: true, // Prefer Figma JSON over SVG (cleaner structured data)
  SVG_PATH: '/assets/tmp/table.svg', // Informational, used by loader if async
  RAIL_THICKNESS_OUTER: 0.2, // outward extension toward frame (inches)

  // Ball properties
  BALL_BASE_RADIUS: 2.25 / 2, // 2.25" diameter baseline
  BALL_RADIUS: 2.25 / 2,
  BALL_MASS: 1.0,
  BALL_RESTITUTION: 0.93, // Ball-ball
  CUSHION_RESTITUTION: 0.88, // Ball-cushion

  // Friction - balanced for 10x velocity multiplier
  ROLLING_FRICTION: 0.62, // Slightly higher for heavier rolling feel (tuned for 10x velocity)
  SLIDING_FRICTION: 0.65, // Ball-table friction
  BALL_BALL_FRICTION: 0.01, // Reduced for more realistic smooth ball surfaces (phenolic resin)
  VELOCITY_EPSILON: 0.2, // Sleep threshold adjusted for 10x velocity scale

  // Pockets (center-origin coordinates: see Geometry.ts for authoritative definitions)
  POCKET_RADIUS: 2.5,
  POCKET_CAPTURE_RADIUS_CORNER: 2.8,
  POCKET_CAPTURE_RADIUS_SIDE: 3.3,
  POCKET_VISUAL_RADIUS_CORNER: 2.55,
  POCKET_VISUAL_RADIUS_SIDE: 2.1,
  POCKET_SHELF_DEPTH_IN: 1.5, // Slider range 0-3, default at 50% depth
  POCKET_SHELF_DEPTH_SIDE_IN: 0.75, // Proportionally adjusted

  // Cue
  CUE_POWER_MIN: 0.5,
  CUE_POWER_MAX: 25.0, // Power bar range
  CUE_POWER_MULTIPLIER: 10.0, // Multiply power to get realistic velocity (25 * 10 = 250 in/s)
  CUE_DRAG_SCALE: 0.08, // Power buildup rate
  AIM_LINE_LENGTH: 20,
  GHOST_LINE_LENGTH: 30,
  FINE_AIM_SENSITIVITY: 0.1,
  MICRO_AIM_MAX_DEGREES: 2.5, // Maximum micro-dial adjustment (total range = ±value degrees)

  // Distance-based aim sensitivity
  DISTANCE_AIM_SCALING_ENABLED: true,
  DISTANCE_AIM_MIN_DISTANCE: 15, // Distance (in) below which no scaling is applied
  DISTANCE_AIM_MAX_DISTANCE: 60, // Distance (in) at which maximum scaling is applied
  DISTANCE_AIM_MIN_SENSITIVITY: 0.6, // Sensitivity multiplier at max distance (0.6 = 60% of normal, more fluid)

  // Control scheme
  TOUCH_AIM_MODE: true, // When true, touch/drag aims only and power is set via the power bar
  // Debug and diagnostics
  DEBUG_BIH_LOG: false, // Verbose console logs for ball-in-hand clamping and drag
  DEBUG_AIM_GUARD_LOG: false, // Logs aim center-guard metrics (can be spammy; throttled)
  DEBUG_MICRO_DIAL_LOG: false, // Logs micro aim dial updates (throttled)
  DEBUG_PREDICTOR_LOG: false, // Logs prediction contact stats (DEV only; can be spammy)

  // Ball-in-hand placement
  BALL_IN_HAND_POCKET_MARGIN_IN: 0.1, // Extra clearance outside pocket capture radius while dragging
  BALL_IN_HAND_ITERATIONS: 7, // Iterations for constraint resolve against rails/endpoints/pockets

  // Aim assist visual settings
  AIM_LINE_OFFSET: 0.2, // Distance from cue ball edge to aim line start
  AIM_LINE_BACKOFF: 0.06, // Pull end of aim line slightly off the contact point to avoid overlap/flicker
  AIM_LINE_LERP: 1.0, // How quickly the rendered aim angle eases toward input (0..1)
  GHOST_BALL_OFFSET: 0.0, // Offset of ghost ball from contact point (negative = toward cue)
  GHOST_BALL_GLOW: 0.75, // Outer glow alpha for ghost ball
  AIM_LINE_ARROW_SIZE: 9, // Base arrowhead size in px (scales with zoom)
  OBJECT_PATH_PERCENTAGE: 1.0, // Multiplier for object ball path length (0.5 = 50% length)
  AIM_ASSIST_PHYSICS_PREVIEW: false, // Run a short physics sim for aim assist even outside debug
  SHOW_AIM_INFO: true, // Display aim angle, distance, speed, and cut angle overlay
  AIM_INFO_SCALE: 1.0, // Scale multiplier for aim info indicators (0.5 = 50% size, 2.0 = 200% size)

  // Free-cursor aiming can become numerically unstable when the cursor is very close to the cue ball.
  // These thresholds (in CSS pixels) dampen angle changes near the center without "sticking".
  AIM_CENTER_GUARD_ENTER_PX: 14,
  AIM_CENTER_GUARD_EXIT_PX: 22,
  AIM_CENTER_GUARD_ENTER_RADII: 6, // also scale guard by ball radius on screen
  AIM_CENTER_GUARD_EXIT_RADII: 10, // also scale guard by ball radius on screen

  // Aim assist physics preview throttling (to prevent frame hitches while aiming)
  AIM_ASSIST_SIM_THROTTLE_MS: 33, // max update rate ~30Hz
  AIM_ASSIST_SIM_ANGLE_THRESHOLD_RAD: 0.004, // ~0.23° change before recompute
  SIDEBAR_DIAL_SIDE: 'right' as 'right' | 'left', // Which side the micro dial lives on (power bar goes opposite)
  // Pocket visual animation tuning
  POCKET_ANIMATION_DROP_DURATION_MS: 180, // duration of drop phase (ball moving to pocket)
  POCKET_ANIMATION_ROLL_DURATION_MS: 250, // duration of fade phase
  POCKET_ANIMATION_DROP_DEPTH: 0.35, // visual drop depth in inches ~ depth perception (legacy)
  POCKET_ANIMATION_SHRINK_FACTOR: 0.0, // optional sink shrink during fade (0 = off)
  POCKET_ANIMATION_FADE_START: 0.9, // (legacy - fade now starts at dropPhaseEnd automatically)
  POCKET_ANIMATION_FADE_DURATION: 0.12, // (legacy - fade duration now spans entire fade phase)
  POCKET_ANIMATION_CLIP_START: 0.2, // (legacy - clip only applied during fade phase now)
  POCKET_ANIMATION_CLIP_RADIUS_SCALE: 1.0, // 0.1-1.0; clips overlay to pocket opening to avoid "rim overlap"
  POCKET_ANIMATION_ICON_SCALE: 1.0, // scale applied when drawing pocket animation balls (1.0 = actual size)
  POCKET_ANIMATION_UNDERFELT_PX: 10, // (legacy - roll movement removed)
  POCKET_CAPTURE_SPEED_THRESHOLD: 45, // in/s speed above which we damp pocket entry
  POCKET_CAPTURE_DAMPING: 0.25, // velocity multiplier applied in pocket throat
  POCKET_CAPTURE_PULL_DISTANCE: 0.8, // additional inches pulled toward pocket center before removal
  POCKET_CAPTURE_GRAVITY: 60, // extra in/s^2 acceleration toward center for fast captures
  HEAVY_SHOT_SHAKE_MAX_OFFSET_PX: 0,
  HEAVY_SHOT_SHAKE_DURATION_MS: 0,

  // Rendering
  CANVAS_SCALE: 8, // Pixels per game unit
  CANVAS_SCALE_MULTIPLIER: 1,
  BALL_SCALE: 1,
  AMBIENT_INTENSITY: 1.1,
  DIRECTIONAL_INTENSITY: 1.6,
  ACCENT_INTENSITY: 0.5,
  HUD_BALL_CHIP_SIZE_PX: 42,

  // Cue visuals
  CUE_LENGTH_IN: 58, // Standard pool cue length (can extend off-screen)
  CUE_VISUAL_PADDING_IN: 20, // Visual padding around table (not full cue length - cue can extend off-screen)
  MIN_WORLD_PADDING_IN: 6, // Minimum world padding around table for camera framing
  RAIL_HIGHLIGHT_INTENSITY: 0.9, // Rail cushion highlight intensity
  RAIL_SHADOW_INTENSITY: 0.25, // Subtle shadow under rails (inner edge)
  POCKET_HIGHLIGHT_INTENSITY: 0.55, // Pocket highlight intensity (separate from rail)
  POCKET_SHADOW_INTENSITY: 0.45,
  TABLE_COLOR: '#0a5f0a',
  FRAME_COLOR: '#3d2413',
  RAIL_COLOR: '#2d1810',
  RAIL_FILL_COLOR: '#db2c2cff', // Fill color for area between corner pockets
  POCKET_COLOR: '#000000',
  CUE_BALL_COLOR: '#ffffff',
  // Cue ball measles: default to standard "Pro Cup" 6-dot pattern
  // Six dots centered on the faces of a cube mapped to the sphere: ±X, ±Y, ±Z
  // Values are treated as direction vectors and normalized.
  CUE_BALL_MEASLES: [
    { x: 1, y: 0, z: 0 },
    { x: -1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 0, y: -1, z: 0 },
    { x: 0, y: 0, z: 1 },
    { x: 0, y: 0, z: -1 },
  ],
  CUE_BALL_MEASLE_RADIUS_RATIO: 0.12,
  CUE_BALL_MEASLE_COLOR: '#c62828',

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
  FRAME_CORNER_RADIUS_IN: 0.0, // Outer frame corner radius (0 = square)
  SIDE_FRAME_OFFSET_IN: 2.0, // Frame offset for side pocket tangent calculation (smaller = steeper jaws)
  SIDE_POCKET_OUTWARD_OFFSET_IN: -1.3, // Side pocket center offset toward frame
  CORNER_POCKET_OUTWARD_OFFSET_IN: -1.0, // Corner pocket center offset toward frame (diagonal)
  CORNER_POCKET_OFFSET_X_IN: 0, // Corner pocket X offset (from table editor)
  CORNER_POCKET_OFFSET_Y_IN: 0, // Corner pocket Y offset (from table editor)
  SIDE_POCKET_OFFSET_X_IN: 0, // Side pocket X offset (from table editor)
  SIDE_POCKET_OFFSET_Y_IN: 0, // Side pocket Y offset (from table editor)
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

// User profile defaults
export const DEFAULT_USER_NAME = 'sosumidude';
export const DEFAULT_OPPONENT_NAME = 'Opponent';
