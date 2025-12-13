/**
 * ShootingController
 * 
 * Handles aim, power, and shot execution logic extracted from Game.ts.
 * This controller manages the shooting state machine and coordinates
 * between input, physics, and rendering.
 */

import { Ball } from '../../physics/Shapes';
import { PhysicsWorld } from '../../physics/Physics';
import { InputManager } from '../../input/Input';
import { Predictor, PredictionResult } from '../../physics/Prediction';
import { CONFIG } from '../../config';
import { AudioManager } from '../../sound/AudioManager';
import { physicsRecorder } from '../../debug/PhysicsRecorder';
import { shotCapture } from '../../debug/ShotCapture';

export interface ShootingState {
  canShoot: boolean;
  isAimMode: boolean;
  lockedAngle: number;
  currentPower: number;
  isDraggingPower: boolean;
  isSpacePowerMode: boolean;
  wasAimModeBeforeSpace: boolean;
  spaceKeyHeld: boolean;
  latestAimAngle: number;
  currentAimAngle: number;
  microAimDialValue: number;
  isDraggingMicroDial: boolean;
  powerDragStartY: number;
  hasStartedRack: boolean;
}

export interface ShootingDependencies {
  world: PhysicsWorld;
  input: InputManager;
  predictor: Predictor;
  audio: AudioManager;
  getCueBall: () => Ball | null;
  onShotFired?: (angle: number, power: number) => void;
  onShotComplete?: () => void;
}

/**
 * Default initial shooting state
 */
export function createInitialShootingState(): ShootingState {
  return {
    canShoot: true,
    isAimMode: true,
    lockedAngle: 0,
    currentPower: 0,
    isDraggingPower: false,
    isSpacePowerMode: false,
    wasAimModeBeforeSpace: true,
    spaceKeyHeld: false,
    latestAimAngle: 0,
    currentAimAngle: 0,
    microAimDialValue: 0,
    isDraggingMicroDial: false,
    powerDragStartY: 0,
    hasStartedRack: false,
  };
}

/**
 * Calculate aim sensitivity based on distance to nearest object ball
 * Returns a multiplier (1.0 = normal, lower = more sensitive for fine control)
 */
export function calculateAimSensitivity(
  cueBall: Ball | null,
  world: PhysicsWorld
): number {
  if (!CONFIG.DISTANCE_AIM_SCALING_ENABLED || !cueBall) {
    return 1.0;
  }

  // Find minimum distance to any object ball
  let minDistance = Infinity;
  for (const ball of world.balls) {
    if (ball.id === 0 || ball.pocketed) continue;
    const dx = ball.x - cueBall.x;
    const dy = ball.y - cueBall.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < minDistance) {
      minDistance = dist;
    }
  }

  // Apply scaling based on distance thresholds
  if (minDistance <= CONFIG.DISTANCE_AIM_MIN_DISTANCE) {
    return 1.0;
  } else if (minDistance >= CONFIG.DISTANCE_AIM_MAX_DISTANCE) {
    return CONFIG.DISTANCE_AIM_MIN_SENSITIVITY;
  } else {
    // Linear interpolation between min and max distance
    const t = (minDistance - CONFIG.DISTANCE_AIM_MIN_DISTANCE) /
      (CONFIG.DISTANCE_AIM_MAX_DISTANCE - CONFIG.DISTANCE_AIM_MIN_DISTANCE);
    return 1.0 - t * (1.0 - CONFIG.DISTANCE_AIM_MIN_SENSITIVITY);
  }
}

/**
 * Check if touch-aim-only mode is enabled
 */
export function isTouchAimOnly(): boolean {
  return !!CONFIG.TOUCH_AIM_MODE;
}

/**
 * Get micro aim offset in degrees
 */
export function getMicroAimOffsetDegrees(dialValue: number): number {
  const maxDegrees = CONFIG.MICRO_AIM_MAX_DEGREES ?? 0;
  return maxDegrees * dialValue;
}

/**
 * Get micro aim offset in radians
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

/**
 * Set micro aim dial value with clamping and snapping
 */
export function setMicroAimDialValue(
  state: ShootingState,
  value: number
): ShootingState {
  const clamped = Math.max(-1, Math.min(1, value));
  const snapped = Math.abs(clamped) < 0.01 ? 0 : clamped;
  if (Math.abs(snapped - state.microAimDialValue) < 1e-4) {
    return state;
  }
  return {
    ...state,
    microAimDialValue: snapped,
  };
}

/**
 * Execute a shot
 */
export function executeShot(
  state: ShootingState,
  deps: ShootingDependencies,
  angle: number,
  power: number
): ShootingState {
  const cueBall = deps.getCueBall();
  if (!cueBall || cueBall.pocketed) return state;
  if (!state.canShoot) return state;

  // Ensure audio is fully unlocked
  deps.audio.ensureUnlocked().catch(() => {});

  // Record shot for capture system if active
  if (shotCapture.isCapturing()) {
    const sim = deps.predictor.simulateShotPaths(deps.world, cueBall, angle, power);
    let prediction: PredictionResult | null = null;
    if (sim && sim.firstContact) {
      prediction = sim.firstContact;
    } else {
      const direction = { x: Math.cos(angle), y: Math.sin(angle) };
      prediction = deps.predictor.predictFirstContact(
        { x: cueBall.x, y: cueBall.y },
        direction,
        deps.world,
        cueBall
      );
    }
    shotCapture.recordShotStart(cueBall, angle, power, prediction);
  }

  // Apply power multiplier for realistic velocity
  const velocity = power * CONFIG.CUE_POWER_MULTIPLIER;
  const vx = Math.cos(angle) * velocity;
  const vy = Math.sin(angle) * velocity;

  cueBall.setVelocity(vx, vy);
  deps.world.logShotSnapshot(angle, power);
  physicsRecorder.recordShot(angle, power);

  // Play cue hit sound
  const intensity = Math.max(0, Math.min(1, power / CONFIG.CUE_POWER_MAX));
  deps.audio.playCueHit(intensity);

  // Notify callback
  deps.onShotFired?.(angle, power);

  return {
    ...state,
    canShoot: false,
    hasStartedRack: true,
    isAimMode: false,
  };
}

/**
 * Reset shooting state after shot completion
 */
export function resetAfterShotComplete(state: ShootingState): ShootingState {
  return {
    ...state,
    canShoot: true,
    isAimMode: true,
    wasAimModeBeforeSpace: true,
    currentPower: 0,
  };
}

/**
 * Reset all shooting state for new game
 */
export function resetShootingState(): ShootingState {
  return createInitialShootingState();
}

/**
 * Toggle aim/power mode (A key)
 */
export function toggleAimMode(
  state: ShootingState,
  deps: ShootingDependencies
): ShootingState {
  const cueBall = deps.getCueBall();
  
  if (state.isAimMode && cueBall && !cueBall.pocketed) {
    const aimSensitivity = calculateAimSensitivity(cueBall, deps.world);
    const lockedAngle = deps.input.getAimAngle(cueBall, aimSensitivity);
    return {
      ...state,
      isAimMode: false,
      lockedAngle,
    };
  } else {
    deps.input.resetAimAngle();
    return {
      ...state,
      isAimMode: true,
    };
  }
}

/**
 * Enter space power mode
 */
export function enterSpacePowerMode(
  state: ShootingState,
  deps: ShootingDependencies
): ShootingState {
  if (isTouchAimOnly()) return state;
  
  const cueBall = deps.getCueBall();
  if (!state.canShoot || !cueBall || cueBall.pocketed) return state;
  
  let lockedAngle = state.lockedAngle;
  if (state.isAimMode) {
    const aimSensitivity = calculateAimSensitivity(cueBall, deps.world);
    lockedAngle = deps.input.getAimAngle(cueBall, aimSensitivity);
  }
  
  return {
    ...state,
    spaceKeyHeld: true,
    wasAimModeBeforeSpace: state.isAimMode,
    isAimMode: false,
    isSpacePowerMode: true,
    currentPower: 0,
    lockedAngle,
  };
}

/**
 * Exit space power mode
 */
export function exitSpacePowerMode(state: ShootingState): ShootingState {
  if (isTouchAimOnly()) return state;
  if (!state.isSpacePowerMode) {
    return { ...state, spaceKeyHeld: false };
  }
  
  return {
    ...state,
    spaceKeyHeld: false,
    isSpacePowerMode: false,
    isAimMode: state.wasAimModeBeforeSpace,
    currentPower: state.wasAimModeBeforeSpace ? 0 : state.currentPower,
  };
}
