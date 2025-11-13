// Collision detection and resolution

import { Ball, Rail } from './Shapes';
import { CONFIG } from '../config';
import { physicsRecorder } from '../debug/PhysicsRecorder';
import { shotCapture } from '../debug/ShotCapture';

export interface Contact {
  ballA: Ball;
  ballB?: Ball;
  rail?: Rail;
  nx: number; // Normal
  ny: number;
  depth: number;
}

// Track which collision pairs have had impulses applied this timestep
const resolvedPairsThisStep = new Set<string>();
const resolvedRailContactsThisStep = new Set<string>();

// Suppress collision warnings during prediction simulations
let suppressCollisionWarnings = false;

export interface CollisionSnapshot {
  cueToBall?: {
    cueId: number;
    objectId: number;
    contactPoint: { x: number; y: number };
    normal: { x: number; y: number };
    penetration: number;
  };
  cueToRail?: {
    cueId: number;
    rail: Rail;
    contactPoint: { x: number; y: number };
    normal: { x: number; y: number };
  };
}

let collisionCaptureEnabled = false;
let collisionSnapshots: CollisionSnapshot[] = [];

export function enableCollisionCapture(enable: boolean) {
  collisionCaptureEnabled = enable;
  if (!enable) {
    collisionSnapshots = [];
  }
}

export function consumeCollisionSnapshot(): CollisionSnapshot | null {
  if (collisionSnapshots.length === 0) return null;
  return collisionSnapshots.shift() ?? null;
}

export function resetCollisionTracking() {
  resolvedPairsThisStep.clear();
  resolvedRailContactsThisStep.clear();
  if (collisionCaptureEnabled) {
    collisionSnapshots = [];
  }
}

export function setSuppressWarnings(suppress: boolean) {
  suppressCollisionWarnings = suppress;
}

function getCollisionPairId(ballA: Ball, ballB: Ball): string {
  // Use sorted IDs to ensure consistent pair identification
  const id1 = Math.min(ballA.id, ballB.id);
  const id2 = Math.max(ballA.id, ballB.id);
  return `${id1}-${id2}`;
}

function getBallRailPairId(ball: Ball, rail: Rail): string {
  const railId = rail.id ?? `${rail.x1.toFixed(3)}_${rail.y1.toFixed(3)}_${rail.x2.toFixed(3)}_${rail.y2.toFixed(3)}`;
  return `${ball.id}:${railId}`;
}

// Ball-ball collision detection
export function detectBallBall(a: Ball, b: Ball): Contact | null {
  if (a.pocketed || b.pocketed) return null;
  
  let dx = b.x - a.x;
  let dy = b.y - a.y;
  let distSq = dx * dx + dy * dy;
  const minDist = a.radius + b.radius;
  
  if (distSq >= minDist * minDist) return null;
  
  let dist = Math.sqrt(distSq);
  let depth = minDist - dist;
  
  // Fix discrete collision detection: separate balls to true contact point
  // This prevents collision normal errors on sharp angle cuts
  // NOTE: At very high speeds (>200 in/s), balls can deeply overlap (>0.5")
  // causing collision normal errors. This is a limitation of discrete timesteps.
  const originalDepth = depth;
  if (depth > 0.001) {
    // Simple approach: just push balls apart along the collision normal
    // This is more reliable than trying to back up in time
    const nx_temp = dist > 1e-8 ? dx / dist : 1;
    const ny_temp = dist > 1e-8 ? dy / dist : 0;
    
    // Push balls apart by the overlap amount
    // Split the correction between both balls based on their masses (equal for pool balls)
    const correction = depth * 0.5;
    
    a.x -= nx_temp * correction;
    a.y -= ny_temp * correction;
    b.x += nx_temp * correction;
    b.y += ny_temp * correction;
    
    // Recalculate collision geometry with corrected positions
    dx = b.x - a.x;
    dy = b.y - a.y;
    distSq = dx * dx + dy * dy;
    dist = Math.sqrt(distSq);
    depth = minDist - dist;
    
    // Log severe overlaps that may indicate physics instability
    // With adaptive substepping, overlaps should be < 0.5" even at high speeds
    // Suppress warnings during prediction simulations
    if (!suppressCollisionWarnings && (originalDepth > 0.5 || (originalDepth > 0.2 && Math.abs(depth) > 0.02))) {
      console.warn(`⚠️ Collision overlap: ${originalDepth.toFixed(3)}" → ${depth.toFixed(3)}" (ball ${a.id} vs ${b.id})`);
    }
  }
  
  // Normal from A to B (now calculated at true contact point)
  const nx = dist > 1e-8 ? dx / dist : 1;
  const ny = dist > 1e-8 ? dy / dist : 0;
  
  return {
    ballA: a,
    ballB: b,
    nx,
    ny,
    depth,
  };
}

// Ball-rail collision detection
export function detectBallRail(ball: Ball, rail: Rail): Contact | null {
  if (ball.pocketed) return null;
  
  // Vector from rail start to ball
  const dx = ball.x - rail.x1;
  const dy = ball.y - rail.y1;
  
  // Rail direction vector
  const rx = rail.x2 - rail.x1;
  const ry = rail.y2 - rail.y1;
  const rLenSq = rx * rx + ry * ry;
  
  // Project ball onto rail
  const t = Math.max(0, Math.min(1, (dx * rx + dy * ry) / rLenSq));
  
  // Closest point on rail
  const closestX = rail.x1 + t * rx;
  const closestY = rail.y1 + t * ry;
  
  // Distance to rail
  const distX = ball.x - closestX;
  const distY = ball.y - closestY;
  const dist = Math.sqrt(distX * distX + distY * distY);
  
  if (dist >= ball.radius) return null;
  
  const depth = ball.radius - dist;
  
  // Normal (should point away from rail, into play area)
  const nx = dist > 1e-8 ? distX / dist : rail.nx;
  const ny = dist > 1e-8 ? distY / dist : rail.ny;
  
  return {
    ballA: ball,
    rail,
    nx,
    ny,
    depth,
  };
}

// Resolve ball-ball collision with impulse
export function resolveBallBall(contact: Contact) {
  const { ballA, ballB, nx, ny, depth } = contact;
  if (!ballB) return;
  
  const totalInvMass = ballA.invMass + ballB.invMass;
  const pairId = getCollisionPairId(ballA, ballB);
  const isFirstResolution = !resolvedPairsThisStep.has(pairId);
  
  // Positional correction (Baumgarte stabilization) - always apply
  const correction = depth * 1.2; // 120% correction to prevent collision loops
  
  if (totalInvMass > 0) {
    const correctionX = (correction * nx) / totalInvMass;
    const correctionY = (correction * ny) / totalInvMass;
    
    ballA.x -= correctionX * ballA.invMass;
    ballA.y -= correctionY * ballA.invMass;
    ballB.x += correctionX * ballB.invMass;
    ballB.y += correctionY * ballB.invMass;
  }
  
  // Recalculate normal after positional correction
  // This ensures we use the correct geometry for impulse calculation
  const dx_corrected = ballB.x - ballA.x;
  const dy_corrected = ballB.y - ballA.y;
  const dist_corrected = Math.sqrt(dx_corrected * dx_corrected + dy_corrected * dy_corrected);
  const nx_corrected = dist_corrected > 1e-8 ? dx_corrected / dist_corrected : nx;
  const ny_corrected = dist_corrected > 1e-8 ? dy_corrected / dist_corrected : ny;
  
  // Only apply velocity impulses on first resolution
  if (!isFirstResolution) {
    return; // Position correction only on subsequent iterations
  }
  
  // Mark this pair as resolved for this timestep
  resolvedPairsThisStep.add(pairId);
  
  // Relative velocity
  const dvx = ballB.vx - ballA.vx;
  const dvy = ballB.vy - ballA.vy;
  const vRel = dvx * nx_corrected + dvy * ny_corrected;
  
  // Separating already? Don't apply impulses but also don't record for shot capture
  if (vRel > 0) return;
  
  // Record for shot capture BEFORE any impulses (to get pre-collision state)
  // Only record if we're actually going to apply impulses
  if (shotCapture.isCapturing()) {
    const cueBall = ballA.id === 0 ? ballA : ballB;
    const otherBall = ballA.id === 0 ? ballB : ballA;
    
    // Use corrected normal (points from A to B)
    const normalSign = ballA.id === 0 ? 1 : -1;
    shotCapture.recordCollision(cueBall, otherBall, { x: nx_corrected * normalSign, y: ny_corrected * normalSign }, depth);
  }
  
  if (collisionCaptureEnabled && (ballA.id === 0 || ballB.id === 0)) {
    let snapshot = collisionSnapshots[collisionSnapshots.length - 1];
    if (!snapshot) {
      snapshot = {};
      collisionSnapshots.push(snapshot);
    }
    if (!snapshot.cueToBall) {
      const cueIsA = ballA.id === 0;
      const cue = cueIsA ? ballA : ballB;
      const object = cueIsA ? ballB : ballA;
      let normalX = nx_corrected;
      let normalY = ny_corrected;
      if (!cueIsA) {
        normalX = -normalX;
        normalY = -normalY;
      }
      snapshot.cueToBall = {
        cueId: cue.id,
        objectId: object.id,
        contactPoint: {
          x: cue.x + normalX * cue.radius,
          y: cue.y + normalY * cue.radius,
        },
        normal: { x: normalX, y: normalY },
        penetration: depth,
      };
    }
  }

  // Impulse magnitude
  const e = CONFIG.BALL_RESTITUTION;
  const j = -(1 + e) * vRel / totalInvMass;
  
  // Apply impulse (using corrected normal)
  const jx = j * nx_corrected;
  const jy = j * ny_corrected;
  
  ballA.vx -= jx * ballA.invMass;
  ballA.vy -= jy * ballA.invMass;
  ballB.vx += jx * ballB.invMass;
  ballB.vy += jy * ballB.invMass;
  
  // Record collision
  physicsRecorder.recordCollision(ballA, ballB);
  
  // Friction (tangent impulse) - use corrected normal
  // IMPORTANT: Calculate friction based on relative velocity AFTER normal impulse
  const tx = -ny_corrected;
  const ty = nx_corrected;
  const dvx_post = ballB.vx - ballA.vx;
  const dvy_post = ballB.vy - ballA.vy;
  const vt = dvx_post * tx + dvy_post * ty;
  const jt = -vt / totalInvMass;
  const maxFriction = Math.abs(j) * CONFIG.BALL_BALL_FRICTION; // Use ball-ball friction, not table friction
  const jtClamped = Math.max(-maxFriction, Math.min(maxFriction, jt));
  
  const jtx = jtClamped * tx;
  const jty = jtClamped * ty;
  
  ballA.vx -= jtx * ballA.invMass;
  ballA.vy -= jty * ballA.invMass;
  ballB.vx += jtx * ballB.invMass;
  ballB.vy += jty * ballB.invMass;
  
  // Record velocities AFTER all impulses are applied
  if (shotCapture.isCapturing()) {
    const cueBall = ballA.id === 0 ? ballA : ballB;
    const otherBall = ballA.id === 0 ? ballB : ballA;
    shotCapture.recordCollisionAfter(cueBall, otherBall);
  }
}

// Resolve ball-rail collision
export function resolveBallRail(contact: Contact) {
  const { ballA, rail, nx, ny, depth } = contact;
  if (!rail) return;
  
  const pairId = getBallRailPairId(ballA, rail);
  const isFirstResolution = !resolvedRailContactsThisStep.has(pairId);
  
  // Positional correction
  ballA.x += nx * depth;
  ballA.y += ny * depth;

  if (!isFirstResolution) {
    return;
  }
  resolvedRailContactsThisStep.add(pairId);
  
  // Calculate contact point
  const contactPoint = {
    x: ballA.x - nx * ballA.radius,
    y: ballA.y - ny * ballA.radius,
  };
  
  // Velocity reflection
  const vn = ballA.vx * nx + ballA.vy * ny;
  
  // Already separating?
  if (vn > 0) return;
  
  // Record pre-collision velocity for shot capture
  const velBefore = { x: ballA.vx, y: ballA.vy };
  
  // Reflect with restitution (reduce bounce only for very shallow grazing)
  const speedMag = Math.hypot(ballA.vx, ballA.vy);
  const approachRatio = Math.abs(vn) / Math.max(1e-6, speedMag);
  const eBase = CONFIG.CUSHION_RESTITUTION;
  const grazeZero = 0.015; // <~0.9°
  const grazeFull = 0.12; // ~6.9°
  let restitutionScale: number;
  if (approachRatio <= grazeZero) {
    restitutionScale = 0;
  } else if (approachRatio >= grazeFull) {
    restitutionScale = 1;
  } else {
    const t = (approachRatio - grazeZero) / (grazeFull - grazeZero);
    restitutionScale = t * t * (3 - 2 * t); // smoothstep blend
  }
  const eEffective = eBase * restitutionScale;
  const jn = -(1 + eEffective) * vn;
  
  ballA.vx += jn * nx * ballA.invMass;
  ballA.vy += jn * ny * ballA.invMass;
  
  // Tangential friction (cushions are rubber/synthetic - much less friction than table cloth)
  const tx = -ny;
  const ty = nx;
  const vt = ballA.vx * tx + ballA.vy * ty;

  // Use cushion-specific friction (0.15) with Coulomb clamp against the normal impulse
  const cushionFriction = 0.15;
  const totalInvMass = ballA.invMass;
  let jt = 0;
  if (totalInvMass > 0) {
    jt = -vt / totalInvMass;
  }
  const maxFriction = Math.abs(jn) * cushionFriction;
  const jtClamped = Math.max(-maxFriction, Math.min(maxFriction, jt));

  ballA.vx += jtClamped * tx * ballA.invMass;
  ballA.vy += jtClamped * ty * ballA.invMass;
  
  // Clamp tiny separating normal velocity when still against rail to extend brief glide realistically
  const vnAfter = ballA.vx * nx + ballA.vy * ny;
  if (vnAfter > 0 && vnAfter < 0.5) {
    ballA.vx -= vnAfter * nx;
    ballA.vy -= vnAfter * ny;
  }
  
  // Record rail collision for shot capture (only for cue ball)
  if (shotCapture.isCapturing() && ballA.id === 0) {
    const velAfter = { x: ballA.vx, y: ballA.vy };
    shotCapture.recordRailCollision(contactPoint, { x: nx, y: ny }, velBefore, velAfter);
  }

  if (collisionCaptureEnabled && ballA.id === 0) {
    let snapshot = collisionSnapshots[collisionSnapshots.length - 1];
    if (!snapshot) {
      snapshot = {};
      collisionSnapshots.push(snapshot);
    }
    if (!snapshot.cueToRail) {
      snapshot.cueToRail = {
        cueId: ballA.id,
        rail,
        contactPoint,
        normal: { x: nx, y: ny },
      };
    }
  }
}
