/**
 * InputController - Input handling logic extracted from Game.ts
 * 
 * Handles:
 * - Power bar mouse/touch events
 * - Micro aim dial mouse/touch events
 * - Ball dragging (practice mode)
 */

import { Ball } from '../../physics/Shapes';
import { CONFIG } from '../../config';

export interface PowerBarState {
  isDragging: boolean;
  dragStartY: number;
  currentPower: number;
}

export interface MicroDialState {
  isDragging: boolean;
  value: number; // -1 to 1
}

export interface InputControllerDeps {
  canShoot: boolean;
  cueBall: Ball | null;
  isSpacePowerMode: boolean;
  isAimMode: boolean;
  lockedAngle: number;
  currentAimAngle: number;
  latestAimAngle: number;
  getPowerBarBounds: () => { x: number; y: number; width: number; height: number } | null;
  getMicroDialBounds: () => { x: number; y: number; width: number; height: number } | null;
  getCanvasRect: () => DOMRect;
  calculateAimSensitivity: () => number;
  getAimAngle: (cueBall: Ball, sensitivity: number) => number;
  setAimSuppressed: (suppressed: boolean) => void;
  setAimDragActive: (active: boolean) => void;
  isTouchAimOnly: () => boolean;
}

/**
 * Create initial power bar state
 */
export function createInitialPowerBarState(): PowerBarState {
  return {
    isDragging: false,
    dragStartY: 0,
    currentPower: 0,
  };
}

/**
 * Create initial micro dial state
 */
export function createInitialMicroDialState(): MicroDialState {
  return {
    isDragging: false,
    value: 0,
  };
}

/**
 * Handle power bar mouse down
 * Returns updated state and whether the event was handled
 */
export function handlePowerBarMouseDown(
  e: { clientX: number; clientY: number },
  state: PowerBarState,
  deps: InputControllerDeps
): { state: PowerBarState; handled: boolean; lockedAngle?: number } {
  if (!deps.canShoot || !deps.cueBall || deps.cueBall.pocketed) {
    return { state, handled: false };
  }

  if (deps.isSpacePowerMode) {
    deps.setAimSuppressed(true);
    return {
      state: {
        isDragging: true,
        dragStartY: e.clientY,
        currentPower: CONFIG.CUE_POWER_MIN,
      },
      handled: true,
    };
  }

  const bounds = deps.getPowerBarBounds();
  if (!bounds) return { state, handled: false };

  const rect = deps.getCanvasRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  if (
    mouseX >= bounds.x &&
    mouseX <= bounds.x + bounds.width &&
    mouseY >= bounds.y &&
    mouseY <= bounds.y + bounds.height
  ) {
    // Freeze aim at current direction for the shot
    const liveAim = deps.currentAimAngle || deps.latestAimAngle || deps.getAimAngle(deps.cueBall, deps.calculateAimSensitivity());
    const angleToLock = deps.isAimMode ? liveAim : deps.lockedAngle;

    deps.setAimSuppressed(true);
    if (deps.isTouchAimOnly()) {
      deps.setAimDragActive(false);
    }

    return {
      state: {
        isDragging: true,
        dragStartY: e.clientY,
        currentPower: 0,
      },
      handled: true,
      lockedAngle: angleToLock,
    };
  }

  return { state, handled: false };
}

/**
 * Handle power bar mouse move
 * Returns updated power value
 */
export function handlePowerBarMouseMove(
  e: { clientX: number; clientY: number },
  state: PowerBarState,
  deps: Pick<InputControllerDeps, 'isSpacePowerMode' | 'getPowerBarBounds'>
): number {
  if (!state.isDragging) return state.currentPower;

  if (deps.isSpacePowerMode) {
    const dragDistance = Math.abs(state.dragStartY - e.clientY);
    return Math.max(
      CONFIG.CUE_POWER_MIN,
      Math.min(CONFIG.CUE_POWER_MAX, dragDistance * CONFIG.CUE_DRAG_SCALE)
    );
  }

  // Relative drag logic for UI power bar
  const dragDistance = e.clientY - state.dragStartY;
  const maxDragPixels = deps.getPowerBarBounds()?.height ?? 200;
  const rawPower = (dragDistance / maxDragPixels) * CONFIG.CUE_POWER_MAX;

  return Math.max(0, Math.min(CONFIG.CUE_POWER_MAX, rawPower));
}

/**
 * Handle power bar mouse up
 * Returns whether a shot should be fired, the angle, power, and updated state
 */
export function handlePowerBarMouseUp(
  state: PowerBarState,
  deps: Pick<InputControllerDeps, 'isSpacePowerMode' | 'setAimSuppressed' | 'setAimDragActive' | 'isTouchAimOnly'>,
  lockedAngle: number
): { state: PowerBarState; shouldShoot: boolean; angle: number; power: number } {
  if (!state.isDragging) {
    return { state, shouldShoot: false, angle: 0, power: 0 };
  }

  deps.setAimSuppressed(false);
  if (deps.isTouchAimOnly()) {
    deps.setAimDragActive(false);
  }

  const shouldShoot = state.currentPower >= CONFIG.CUE_POWER_MIN;
  
  return {
    state: {
      isDragging: false,
      dragStartY: 0,
      currentPower: 0,
    },
    shouldShoot,
    angle: lockedAngle,
    power: state.currentPower,
  };
}

/**
 * Handle micro dial mouse down
 * Returns updated state and whether the event was handled
 */
export function handleMicroDialMouseDown(
  e: { clientX: number; clientY: number },
  state: MicroDialState,
  deps: Pick<InputControllerDeps, 'canShoot' | 'cueBall' | 'getMicroDialBounds' | 'getCanvasRect'>
): { state: MicroDialState; handled: boolean } {
  if (!deps.canShoot || !deps.cueBall || deps.cueBall.pocketed) {
    return { state, handled: false };
  }

  const bounds = deps.getMicroDialBounds();
  if (!bounds) return { state, handled: false };

  const rect = deps.getCanvasRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  if (
    mouseX >= bounds.x &&
    mouseX <= bounds.x + bounds.width &&
    mouseY >= bounds.y &&
    mouseY <= bounds.y + bounds.height
  ) {
    const relative = Math.max(0, Math.min(1, (mouseY - bounds.y) / bounds.height));
    const normalized = (0.5 - relative) * 2;

    return {
      state: {
        isDragging: true,
        value: snapMicroDialValue(normalized),
      },
      handled: true,
    };
  }

  return { state, handled: false };
}

/**
 * Handle micro dial mouse move
 * Returns updated dial value
 */
export function handleMicroDialMouseMove(
  e: { clientX: number; clientY: number },
  state: MicroDialState,
  deps: Pick<InputControllerDeps, 'getMicroDialBounds' | 'getCanvasRect'>
): number {
  if (!state.isDragging) return state.value;

  const bounds = deps.getMicroDialBounds();
  if (!bounds) return state.value;

  const rect = deps.getCanvasRect();
  const mouseY = e.clientY - rect.top;
  const relative = Math.max(0, Math.min(1, (mouseY - bounds.y) / bounds.height));
  const normalized = (0.5 - relative) * 2;

  return snapMicroDialValue(normalized);
}

/**
 * Handle micro dial mouse up
 */
export function handleMicroDialMouseUp(state: MicroDialState): MicroDialState {
  if (!state.isDragging) return state;

  return {
    ...state,
    isDragging: false,
  };
}

/**
 * Snap micro dial value to 0 if very close
 */
function snapMicroDialValue(value: number): number {
  const clamped = Math.max(-1, Math.min(1, value));
  return Math.abs(clamped) < 0.01 ? 0 : clamped;
}

/**
 * Calculate micro aim offset in degrees
 */
export function getMicroAimOffsetDegrees(dialValue: number): number {
  const maxDegrees = CONFIG.MICRO_AIM_MAX_DEGREES ?? 0;
  return maxDegrees * dialValue;
}

/**
 * Calculate micro aim offset in radians
 */
export function getMicroAimOffsetRadians(dialValue: number): number {
  return getMicroAimOffsetDegrees(dialValue) * Math.PI / 180;
}

/**
 * Apply micro aim offset to an angle
 */
export function applyMicroAimOffset(angle: number, dialValue: number): number {
  if (!dialValue) return angle;
  let adjusted = angle + getMicroAimOffsetRadians(dialValue);
  const tau = Math.PI * 2;
  while (adjusted <= -Math.PI) adjusted += tau;
  while (adjusted > Math.PI) adjusted -= tau;
  return adjusted;
}
