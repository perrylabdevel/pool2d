/**
 * Table Editor Constants
 *
 * Centralized configuration values for the table editor.
 * Extracted from various files to eliminate magic numbers and improve maintainability.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Geometry Defaults
// ─────────────────────────────────────────────────────────────────────────────

/** Default play area width in inches */
export const DEFAULT_PLAY_WIDTH_IN = 100;

/** Default play area height in inches */
export const DEFAULT_PLAY_HEIGHT_IN = 50;

/** Default pocket radius in inches */
export const DEFAULT_POCKET_RADIUS_IN = 2.5;

/** Minimum pocket radius threshold in inches (anything smaller is invalid) */
export const MIN_POCKET_RADIUS_IN = 0.05;

/** Default pocket capture radius for corner pockets (inches) */
export const DEFAULT_CORNER_CAPTURE_RADIUS_IN = 2.8;

/** Default pocket capture radius for side pockets (inches) */
export const DEFAULT_SIDE_CAPTURE_RADIUS_IN = 3.3;

/** Number of segments to generate for circular pocket outlines */
export const POCKET_OUTLINE_SEGMENTS = 20;

/** Default pixels per inch when no PPI is available */
export const DEFAULT_PIXELS_PER_INCH = 7.68;

// ─────────────────────────────────────────────────────────────────────────────
// Validation Thresholds
// ─────────────────────────────────────────────────────────────────────────────

/** Epsilon for floating point comparisons */
export const EPSILON = 1e-9;

/** Tolerance for unit vector validation (max deviation from length 1.0) */
export const UNIT_VECTOR_TOLERANCE = 0.01;

/** Minimum rail length in inches (shorter is considered degenerate) */
export const MIN_RAIL_LENGTH_IN = 0.01;

/** Tolerance for pocket matching during mirror operations (squared inches) */
export const POCKET_MATCH_TOLERANCE_SQ = 4; // ~2 inches

/** Tolerance for rail matching during mirror operations (squared inches) */
export const RAIL_MATCH_TOLERANCE_SQ = 25; // ~5 inches

/** Tolerance for rail midpoint matching during symmetry operations (inches) */
export const RAIL_SYMMETRY_TOLERANCE_IN = 0.25;

// ─────────────────────────────────────────────────────────────────────────────
// Editor Assist Settings
// ─────────────────────────────────────────────────────────────────────────────

/** Default snap tolerance in pixels */
export const DEFAULT_SNAP_TOLERANCE_PX = 8;

/** Default grid spacing in inches */
export const DEFAULT_GRID_SPACING_IN = 0.125;

/** Default grid major tick interval (every N grid lines gets a major tick) */
export const DEFAULT_GRID_MAJOR_INTERVAL = 8;

// ─────────────────────────────────────────────────────────────────────────────
// UI and Rendering
// ─────────────────────────────────────────────────────────────────────────────

/** Maximum undo/redo stack size */
export const MAX_UNDO_STACK_SIZE = 100;

/** Debounce delay for persisting table changes to IndexedDB (ms) */
export const PERSIST_DEBOUNCE_MS = 500;

/** WebSocket reconnection delay (ms) */
export const WS_RECONNECT_DELAY_MS = 5000;

/** WebSocket max reconnection delay with backoff (ms) */
export const WS_MAX_RECONNECT_DELAY_MS = 30000;

// ─────────────────────────────────────────────────────────────────────────────
// Default Pixel Dimensions (for blank table generation)
// ─────────────────────────────────────────────────────────────────────────────

/** Default inner pixel rectangle (play area) */
export const DEFAULT_INNER_PX = { width: 750, height: 376 };

/** Default outer pixel rectangle (includes cushions) */
export const DEFAULT_OUTER_PX = { width: 780, height: 406 };

/** Default full pixel rectangle (includes frame) */
export const DEFAULT_FULL_PX = { width: 836, height: 464 };

// ─────────────────────────────────────────────────────────────────────────────
// Validation Messages
// ─────────────────────────────────────────────────────────────────────────────

/** Maximum number of validation warnings to show */
export const MAX_VALIDATION_WARNINGS = 20;
