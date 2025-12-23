/**
 * AIController
 * 
 * Handles AI turn orchestration extracted from Game.ts.
 * Manages AI thinking, shot selection, and shot animation.
 */

import { Ball } from '../../physics/Shapes';
import { PhysicsWorld } from '../../physics/Physics';
import { PoolAI } from '../../ai/PoolAI';
import { Player } from '../Player';

export type AIShotAnimPhase = 'warmup' | 'approach' | 'pause' | 'strike';

export interface AIShotAnimation {
  phase: AIShotAnimPhase;
  elapsed: number;
  aimAngle: number;
  targetPower: number;
  seed: number;
  w1: number;
  w2: number;
  aAmpDeg: number;
  pAmp: number;
  warmupDur: number;
  approachDur: number;
  pauseDur: number;
  strikeDur: number;
}

export interface AISelectedShot {
  targetBall: Ball;
  pocket: { id: string; center: { x: number; y: number } };
  aimAngle: number;
  power: number;
  spinSide?: number;
  spinTop?: number;
}

export interface AIState {
  thinkingStartTime: number;
  selectedShot: AISelectedShot | null;
  shotAnimation: AIShotAnimation | null;
}

export interface AIUpdateResult {
  state: AIState;
  lockedAngle?: number;
  currentPower?: number;
  shouldShoot?: boolean;
  shotAngle?: number;
  shotPower?: number;
  calledPocketId?: string;
  shouldSwitchTurn?: boolean;
  clearPredictionCache?: boolean;
}

/**
 * Create initial AI state
 */
export function createInitialAIState(): AIState {
  return {
    thinkingStartTime: 0,
    selectedShot: null,
    shotAnimation: null,
  };
}

/**
 * Start AI thinking phase
 */
export function startAIThinking(state: AIState): AIState {
  return {
    ...state,
    thinkingStartTime: performance.now(),
    selectedShot: null,
    shotAnimation: null,
  };
}

/**
 * Reset AI state
 */
export function resetAIState(): AIState {
  return createInitialAIState();
}

/**
 * Create shot animation parameters based on AI accuracy
 */
export function createShotAnimation(
  selectedShot: AISelectedShot,
  accuracy: number
): AIShotAnimation {
  const r = Math.random;
  
  // Per-shot randomized dynamics
  const baseW1 = 1.0 + r() * 1.5; // cycles/sec
  const baseW2 = 2.0 + r() * 2.0;

  // Angle waggle amplitude in degrees based on accuracy (inverse relationship)
  // High accuracy (1.0) -> low waggle (~0.15 deg)
  // Low accuracy (0.0) -> high waggle (~2.5 deg)
  const aAmpDeg = (2.5 - (accuracy * 2.35)) + r() * (1 - accuracy) * 0.5;
  const pAmp = Math.min(selectedShot.power * (0.10 + r() * 0.08), 3.2);
  const warmupDur = 0.45 + r() * 0.35; // 0.45-0.8s
  const approachDur = 0.35 + r() * 0.25; // 0.35-0.6s
  const pauseDur = 0.12 + r() * 0.15; // 0.12-0.27s
  const strikeDur = 0.16 + r() * 0.10; // 0.16-0.26s

  return {
    phase: 'warmup',
    elapsed: 0,
    aimAngle: selectedShot.aimAngle,
    targetPower: selectedShot.power,
    seed: r(),
    w1: baseW1 * 2 * Math.PI,
    w2: baseW2 * 2 * Math.PI,
    aAmpDeg,
    pAmp,
    warmupDur,
    approachDur,
    pauseDur,
    strikeDur,
  };
}

/**
 * Update warmup phase animation
 */
function updateWarmupPhase(
  anim: AIShotAnimation,
  dt: number
): { anim: AIShotAnimation; lockedAngle: number; currentPower: number } {
  const p = { ...anim, elapsed: anim.elapsed + dt };
  
  // Gentle oscillation in power and slight angle waggle
  const phase1 = p.w1 * p.elapsed + p.seed * Math.PI * 2;
  const phase2 = p.w2 * p.elapsed + (1 - p.seed) * Math.PI * 2;
  const env = 0.85 + 0.15 * Math.cos(Math.min(1, p.elapsed / p.warmupDur) * Math.PI);
  const waggle = (p.aAmpDeg * Math.PI / 180) * env * (Math.sin(phase1) * 0.7 + Math.sin(phase2) * 0.3);
  const base = Math.min(p.targetPower * 0.22, 3.6);
  
  const lockedAngle = p.aimAngle + waggle;
  const currentPower = base + p.pAmp * (0.5 + 0.5 * Math.sin(phase1 * 0.85 + 0.3 * Math.sin(phase2)));
  
  if (p.elapsed >= p.warmupDur) {
    p.phase = 'approach';
    p.elapsed = 0;
  }
  
  return { anim: p, lockedAngle, currentPower };
}

/**
 * Update approach phase animation
 */
function updateApproachPhase(
  anim: AIShotAnimation,
  dt: number
): { anim: AIShotAnimation; lockedAngle: number; currentPower: number } {
  const p = { ...anim, elapsed: anim.elapsed + dt };
  
  const t = Math.min(1, p.elapsed / p.approachDur);
  const eased = t * t * (3 - 2 * t); // smoothstep
  
  const lockedAngle = p.aimAngle;
  const currentPower = p.targetPower * 0.7 * eased;
  
  if (t >= 1) {
    p.phase = 'pause';
    p.elapsed = 0;
  }
  
  return { anim: p, lockedAngle, currentPower };
}

/**
 * Update pause phase animation
 */
function updatePausePhase(
  anim: AIShotAnimation,
  dt: number,
  currentLockedAngle: number,
  currentPower: number
): { anim: AIShotAnimation; lockedAngle: number; currentPower: number } {
  const p = { ...anim, elapsed: anim.elapsed + dt };
  
  if (p.elapsed >= p.pauseDur) {
    p.phase = 'strike';
    p.elapsed = 0;
  }
  
  return { anim: p, lockedAngle: currentLockedAngle, currentPower };
}

/**
 * Update strike phase animation
 */
function updateStrikePhase(
  anim: AIShotAnimation,
  dt: number,
  currentLockedAngle: number,
  accuracy: number
): { 
  anim: AIShotAnimation | null; 
  lockedAngle: number; 
  currentPower: number;
  shouldShoot: boolean;
  shotAngle?: number;
  shotPower?: number;
} {
  const p = { ...anim, elapsed: anim.elapsed + dt };
  
  const t = Math.min(1, p.elapsed / p.strikeDur);
  const eased = t * t; // accelerate in
  
  // Final micro-refinement on high accuracy
  const isHighSkill = accuracy > 0.7;
  const refine = isHighSkill ? (1 - (1 - eased) * 0.5) : eased;
  
  const currentPower = p.targetPower * (0.7 + 0.3 * eased);
  const lockedAngle = p.aimAngle * refine + currentLockedAngle * (1 - refine);
  
  if (t >= 1) {
    // Fire the shot
    return {
      anim: null,
      lockedAngle,
      currentPower,
      shouldShoot: true,
      shotAngle: lockedAngle,
      shotPower: Math.max(p.targetPower, currentPower),
    };
  }
  
  return { anim: p, lockedAngle, currentPower, shouldShoot: false };
}

/**
 * Update AI turn - main entry point
 */
export function updateAITurn(
  state: AIState,
  dt: number,
  ai: PoolAI,
  world: PhysicsWorld,
  currentPlayer: Player,
  currentLockedAngle: number,
  currentPower: number
): AIUpdateResult {
  // If AI hasn't selected a shot yet, wait for thinking time
  if (!state.selectedShot) {
    const elapsed = performance.now() - state.thinkingStartTime;
    
    if (elapsed >= ai.getThinkingTime()) {
      // Select shot
      console.log('[AI] Selecting shot for player', currentPlayer.id, 'group:', currentPlayer.group);
      
      const selectedShot = ai.selectShot(world, currentPlayer) as AISelectedShot | null;
      
      if (!selectedShot) {
        // No valid shot found - switch turn
        console.warn('[AI] Could not find a valid shot, switching turn');
        return {
          state,
          shouldSwitchTurn: true,
        };
      }
      
      console.log('[AI] Selected shot:', selectedShot);
      
      return {
        state: {
          ...state,
          selectedShot,
        },
        calledPocketId: selectedShot.pocket?.id,
      };
    }
    
    // Still thinking
    return { state };
  }
  
  // Shot selected, animate cue
  if (!state.shotAnimation) {
    const stats = ai.getOpponentDef().stats;
    const accuracy = stats?.accuracy ?? 0.5;
    const shotAnimation = createShotAnimation(state.selectedShot, accuracy);
    
    return {
      state: {
        ...state,
        shotAnimation,
      },
      lockedAngle: state.selectedShot.aimAngle,
      currentPower: 0,
      clearPredictionCache: true,
    };
  }
  
  // Update animation
  const anim = state.shotAnimation;
  const stats = ai.getOpponentDef().stats;
  const accuracy = stats?.accuracy ?? 0.5;
  
  let result: { 
    anim: AIShotAnimation | null; 
    lockedAngle: number; 
    currentPower: number;
    shouldShoot?: boolean;
    shotAngle?: number;
    shotPower?: number;
  };
  
  switch (anim.phase) {
    case 'warmup':
      result = updateWarmupPhase(anim, dt);
      break;
    case 'approach':
      result = updateApproachPhase(anim, dt);
      break;
    case 'pause':
      result = updatePausePhase(anim, dt, currentLockedAngle, currentPower);
      break;
    case 'strike':
      result = updateStrikePhase(anim, dt, currentLockedAngle, accuracy);
      break;
    default:
      result = { anim, lockedAngle: currentLockedAngle, currentPower };
  }
  
  if (result.shouldShoot) {
    console.log('[AI] Executing shot');
    return {
      state: {
        ...state,
        selectedShot: null,
        shotAnimation: null,
      },
      lockedAngle: result.lockedAngle,
      currentPower: result.currentPower,
      shouldShoot: true,
      shotAngle: result.shotAngle,
      shotPower: result.shotPower,
      clearPredictionCache: true,
    };
  }
  
  return {
    state: {
      ...state,
      shotAnimation: result.anim,
    },
    lockedAngle: result.lockedAngle,
    currentPower: result.currentPower,
    clearPredictionCache: true,
  };
}
