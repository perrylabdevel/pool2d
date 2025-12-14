/**
 * PocketCallController - Pocket calling logic for 8-ball
 * 
 * Handles:
 * - Checking if pocket call is required
 * - Prompting player for pocket selection
 * - AI auto-calling nearest pocket
 * - Pocket label formatting
 */

import { Ball } from '../../physics/Shapes';
import { getTableGeometry } from '../../geometry/Geometry';
import { BALL_8 } from '../../config';

// Pocket labels for display
const POCKET_LABELS: Record<string, string> = {
  NW_corner: 'Head left corner',
  NE_corner: 'Head right corner',
  SW_corner: 'Foot left corner',
  SE_corner: 'Foot right corner',
  N_middle: 'Head side pocket',
  S_middle: 'Foot side pocket',
};

export interface PocketChoice {
  id: string;
  label: string;
  center: { x: number; y: number };
}

export interface PocketCallState {
  currentCalledPocketId: string | null;
  waitingForPocketCall: boolean;
}

export interface RulesConfig {
  requireCalled8Ball: boolean;
  requireCalledShots: boolean;
}

export interface PocketCallDeps {
  isAI: boolean;
  isEightBallMode: boolean;
  rulesConfig: RulesConfig;
  hasPlayerClearedGroup: boolean;
  eightBall: Ball | null;
}

/**
 * Create initial pocket call state
 */
export function createInitialPocketCallState(): PocketCallState {
  return {
    currentCalledPocketId: null,
    waitingForPocketCall: false,
  };
}

/**
 * Get pocket label for display
 */
export function getPocketLabel(pocketId: string): string {
  return POCKET_LABELS[pocketId] ?? pocketId ?? 'Unknown pocket';
}

/**
 * Get available pocket choices
 */
export function getPocketChoices(): PocketChoice[] {
  const geom = getTableGeometry();
  return geom.pockets
    .filter((pocket) => pocket.id && POCKET_LABELS[pocket.id])
    .map((pocket) => ({
      id: pocket.id,
      label: getPocketLabel(pocket.id),
      center: { x: pocket.center.x, y: pocket.center.y },
    }));
}

/**
 * Check if pocket call is required for current shot
 */
export function requiresPocketCall(deps: PocketCallDeps): boolean {
  if (!deps.isEightBallMode) return false;
  
  const requiresCall = deps.rulesConfig.requireCalled8Ball || deps.rulesConfig.requireCalledShots;
  if (!requiresCall) return false;
  
  if (!deps.hasPlayerClearedGroup) return false;
  
  if (!deps.eightBall || deps.eightBall.pocketed) return false;
  
  return true;
}

/**
 * Check if pocket call prompt should be shown
 */
export function shouldPromptPocketCall(
  state: PocketCallState,
  deps: PocketCallDeps
): boolean {
  if (deps.isAI) return false;
  if (state.waitingForPocketCall) return false;
  if (state.currentCalledPocketId) return false;
  
  return requiresPocketCall(deps);
}

/**
 * Check if shot should be blocked due to missing pocket call
 */
export function shouldBlockShot(
  state: PocketCallState,
  deps: PocketCallDeps
): boolean {
  if (!requiresPocketCall(deps)) return false;
  if (state.currentCalledPocketId) return false;
  
  // AI auto-calls, never blocks
  if (deps.isAI) return false;
  
  return true;
}

/**
 * Pick nearest pocket to 8-ball for AI auto-call
 */
export function pickNearestPocketId(eightBall: Ball): string | null {
  const geom = getTableGeometry();
  let nearestId: string | null = null;
  let nearestDist = Infinity;
  
  for (const pocket of geom.pockets) {
    if (!pocket.id || !POCKET_LABELS[pocket.id]) continue;
    const dx = eightBall.x - pocket.center.x;
    const dy = eightBall.y - pocket.center.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestId = pocket.id;
    }
  }
  
  return nearestId;
}

/**
 * Handle pocket click during pocket call mode
 * Returns the pocket ID if valid click, null otherwise
 */
export function handlePocketClick(
  worldX: number,
  worldY: number,
  state: PocketCallState
): string | null {
  if (!state.waitingForPocketCall) return null;
  
  const geom = getTableGeometry();
  const pockets = geom.pockets.filter(p => p.id && POCKET_LABELS[p.id]);
  const clickRadius = 3.0; // Generous click radius in inches
  
  for (const pocket of pockets) {
    const dx = worldX - pocket.center.x;
    const dy = worldY - pocket.center.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= clickRadius) {
      return pocket.id;
    }
  }
  
  return null;
}

/**
 * Set called pocket and return updated state
 */
export function setCalledPocket(
  state: PocketCallState,
  pocketId: string | null
): PocketCallState {
  return {
    ...state,
    currentCalledPocketId: pocketId,
    waitingForPocketCall: pocketId ? false : state.waitingForPocketCall,
  };
}

/**
 * Start waiting for pocket call
 */
export function startWaitingForPocketCall(state: PocketCallState): PocketCallState {
  return {
    ...state,
    waitingForPocketCall: true,
  };
}

/**
 * Clear pocket call after shot
 */
export function clearPocketCallAfterShot(state: PocketCallState): PocketCallState {
  return {
    ...state,
    currentCalledPocketId: null,
  };
}

/**
 * Reset pocket call state
 */
export function resetPocketCallState(): PocketCallState {
  return createInitialPocketCallState();
}
