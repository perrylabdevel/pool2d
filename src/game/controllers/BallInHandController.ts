/**
 * BallInHandController
 * 
 * Handles ball-in-hand placement logic extracted from Game.ts.
 * Manages cue ball dragging, placement validation, and kitchen restrictions.
 */

import { Ball, Rail, Pocket } from '../../physics/Shapes';
import { PhysicsWorld } from '../../physics/Physics';
import { clampBallInHand } from '../../geometry/Placement';
import { getTableGeometry } from '../../geometry/Geometry';
import { CONFIG, CUE_BALL_POSITION } from '../../config';

export type BallInHandPlacement = 'ANYWHERE' | 'KITCHEN';

export interface BallInHandState {
  isDragging: boolean;
  isPendingForAI: boolean;
  placement: BallInHandPlacement;
}

export interface BallInHandDependencies {
  world: PhysicsWorld;
  getCueBall: () => Ball | null;
  getCanvasScale: () => number;
  getCanvasOffset: () => { x: number; y: number };
  getCanvasSize: () => { width: number; height: number };
}

/**
 * Create initial ball-in-hand state
 */
export function createInitialBallInHandState(): BallInHandState {
  return {
    isDragging: false,
    isPendingForAI: false,
    placement: 'ANYWHERE',
  };
}

/**
 * Check if position is within kitchen (behind head string)
 */
export function isInKitchen(x: number): boolean {
  const geom = getTableGeometry();
  const playWidth = geom.playWidthIn ?? CONFIG.TABLE_WIDTH;
  const headStringX = -(playWidth / 4);
  return x <= headStringX;
}

/**
 * Apply kitchen limit to X position if needed
 */
export function applyKitchenLimit(
  x: number,
  radius: number,
  shouldRestrict: boolean
): number {
  if (!shouldRestrict) return x;
  
  const geom = getTableGeometry();
  const playWidth = geom.playWidthIn ?? CONFIG.TABLE_WIDTH;
  const headStringX = -(playWidth / 4);
  const limit = headStringX - radius + 1e-3;
  return Math.min(x, limit);
}

/**
 * Clamp ball position to valid play area
 */
export function clampToPlayArea(
  position: { x: number; y: number },
  radius: number,
  rails: Rail[],
  pockets: Pocket[],
  shouldRestrictToKitchen: boolean
): { x: number; y: number } {
  const geom = getTableGeometry();
  const halfW = (geom.playWidthIn ?? CONFIG.TABLE_WIDTH) / 2;
  const halfH = (geom.playHeightIn ?? CONFIG.TABLE_HEIGHT) / 2;
  
  const clampResult = clampBallInHand(
    position,
    radius,
    rails,
    pockets,
    {
      iterations: CONFIG.BALL_IN_HAND_ITERATIONS,
      pocketMargin: CONFIG.BALL_IN_HAND_POCKET_MARGIN_IN,
    }
  );
  
  // Apply bounds
  const boundedX = Math.max(-halfW + radius, Math.min(halfW - radius, clampResult.x));
  const boundedY = Math.max(-halfH + radius, Math.min(halfH - radius, clampResult.y));
  
  // Apply kitchen restriction if needed
  const kitchenLimitedX = applyKitchenLimit(boundedX, radius, shouldRestrictToKitchen);
  
  return { x: kitchenLimitedX, y: boundedY };
}

/**
 * Check if a position is valid for cue ball placement (no overlaps)
 */
export function isSpotOpen(
  x: number,
  y: number,
  radius: number,
  balls: Ball[],
  cueBall: Ball | null
): boolean {
  const minClearance = radius * 2 + 0.1;
  for (const ball of balls) {
    if (ball === cueBall) continue;
    if (ball.pocketed) continue;
    const dist = Math.hypot(ball.x - x, ball.y - y);
    if (dist < minClearance) {
      return false;
    }
  }
  return true;
}

/**
 * Get AI ball-in-hand placement candidates
 */
export function getAIPlacementCandidates(
  placement: BallInHandPlacement,
  radius: number
): Array<{ x: number; y: number }> {
  const geom = getTableGeometry();
  const headStringX = -(geom.playWidthIn ?? CONFIG.TABLE_WIDTH) / 4;
  const safeKitchenX = headStringX - radius - 0.5;
  const yOffsets = [0, 6, -6, 12, -12, 18, -18, 24, -24];
  const candidates: Array<{ x: number; y: number }> = [];
  
  const kitchenXs = [safeKitchenX, safeKitchenX - 4, safeKitchenX - 8];
  const anywhereXs = [CUE_BALL_POSITION.x, -15, -10, -5, 0, 5, 10, 15];
  const bases = placement === 'KITCHEN' ? kitchenXs : anywhereXs;
  
  for (const baseX of bases) {
    for (const offset of yOffsets) {
      candidates.push({ x: baseX, y: offset });
    }
  }
  
  if (placement === 'ANYWHERE') {
    candidates.push({ x: 0, y: 0 });
  }
  
  return candidates;
}

/**
 * Find best AI placement position
 */
export function findAIPlacement(
  placement: BallInHandPlacement,
  deps: BallInHandDependencies
): { x: number; y: number } | null {
  const cueBall = deps.getCueBall();
  if (!cueBall) return null;
  
  const radius = cueBall.radius;
  const candidates = getAIPlacementCandidates(placement, radius);
  const shouldRestrictToKitchen = placement === 'KITCHEN';
  
  let fallback: { x: number; y: number } | null = null;
  
  for (const candidate of candidates) {
    const spot = clampToPlayArea(
      candidate,
      radius,
      deps.world.rails,
      deps.world.pockets,
      shouldRestrictToKitchen
    );
    
    if (isSpotOpen(spot.x, spot.y, radius, deps.world.balls, cueBall)) {
      return spot;
    }
    
    if (!fallback) {
      fallback = spot;
    }
  }
  
  return fallback;
}

/**
 * Place cue ball at position
 */
export function placeCueBall(
  cueBall: Ball,
  x: number,
  y: number
): void {
  cueBall.x = x;
  cueBall.y = y;
  cueBall.vx = 0;
  cueBall.vy = 0;
  cueBall.angularVelocity = 0;
  cueBall.sleeping = true;
  cueBall.pocketed = false;
  cueBall.lastPocketId = null;
}

/**
 * Start ball drag operation
 */
export function startDrag(state: BallInHandState): BallInHandState {
  return {
    ...state,
    isDragging: true,
  };
}

/**
 * End ball drag operation
 */
export function endDrag(state: BallInHandState): BallInHandState {
  return {
    ...state,
    isDragging: false,
  };
}

/**
 * Set pending ball-in-hand for AI
 */
export function setPendingForAI(
  state: BallInHandState,
  pending: boolean
): BallInHandState {
  return {
    ...state,
    isPendingForAI: pending,
  };
}

/**
 * Set ball-in-hand placement type
 */
export function setPlacement(
  state: BallInHandState,
  placement: BallInHandPlacement
): BallInHandState {
  return {
    ...state,
    placement,
  };
}

/**
 * Reset ball-in-hand state
 */
export function resetBallInHandState(): BallInHandState {
  return createInitialBallInHandState();
}

// ============================================================
// Ball Drag Handling - Screen to World Coordinate Conversion
// ============================================================

export interface ScreenToWorldDeps {
  canvasRect: DOMRect;
  canvasWidth: number;
  canvasHeight: number;
  scale: number;
}

/**
 * Convert screen coordinates to world coordinates
 */
export function screenToWorld(
  screenX: number,
  screenY: number,
  deps: ScreenToWorldDeps
): { x: number; y: number } {
  const canvasCenterX = deps.canvasWidth / 2;
  const canvasCenterY = deps.canvasHeight / 2;
  
  const localX = screenX - deps.canvasRect.left;
  const localY = screenY - deps.canvasRect.top;
  
  const worldX = (localX - canvasCenterX) / deps.scale;
  const worldY = -(localY - canvasCenterY) / deps.scale; // Flip Y
  
  return { x: worldX, y: worldY };
}

/**
 * Check if click is on cue ball
 */
export function isClickOnCueBall(
  worldX: number,
  worldY: number,
  cueBall: Ball
): boolean {
  const dx = worldX - cueBall.x;
  const dy = worldY - cueBall.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return dist <= cueBall.radius;
}

/**
 * Process ball drag position - clamps and applies kitchen limit
 */
export function processDragPosition(
  worldX: number,
  worldY: number,
  radius: number,
  rails: Rail[],
  pockets: Pocket[],
  shouldRestrictToKitchen: boolean
): { x: number; y: number; hits: number } {
  const result = clampBallInHand(
    { x: worldX, y: worldY },
    radius,
    rails,
    pockets,
    {
      iterations: CONFIG.BALL_IN_HAND_ITERATIONS,
      pocketMargin: CONFIG.BALL_IN_HAND_POCKET_MARGIN_IN,
    }
  );
  
  const geom = getTableGeometry();
  const halfW = (geom.playWidthIn ?? CONFIG.TABLE_WIDTH) / 2;
  const halfH = (geom.playHeightIn ?? CONFIG.TABLE_HEIGHT) / 2;
  
  const clampedX = Math.max(-halfW + radius, Math.min(halfW - radius, result.x));
  const clampedY = Math.max(-halfH + radius, Math.min(halfH - radius, result.y));
  const kitchenLimitedX = applyKitchenLimit(clampedX, radius, shouldRestrictToKitchen);
  
  return { x: kitchenLimitedX, y: clampedY, hits: result.hits.length };
}

/**
 * Apply drag position to cue ball
 */
export function applyDragToCueBall(
  cueBall: Ball,
  x: number,
  y: number
): void {
  // Un-pocket if needed
  if (cueBall.pocketed) {
    cueBall.pocketed = false;
    cueBall.vx = 0;
    cueBall.vy = 0;
    cueBall.sleeping = true;
  }
  
  cueBall.x = x;
  cueBall.y = y;
}
