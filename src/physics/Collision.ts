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
    
    // Debug: log if correction didn't work
    if (originalDepth > 0.05 && Math.abs(depth) > 0.01) {
      console.warn(`⚠️ Position correction: ${originalDepth.toFixed(3)}" → ${depth.toFixed(3)}" (${a.id} vs ${b.id})`);
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
  
  // Positional correction (Baumgarte stabilization)
  const correction = depth * 1.2; // 120% correction to prevent collision loops
  const totalInvMass = ballA.invMass + ballB.invMass;
  
  if (totalInvMass > 0) {
    const correctionX = (correction * nx) / totalInvMass;
    const correctionY = (correction * ny) / totalInvMass;
    
    ballA.x -= correctionX * ballA.invMass;
    ballA.y -= correctionY * ballA.invMass;
    ballB.x += correctionX * ballB.invMass;
    ballB.y += correctionY * ballB.invMass;
  }
  
  // Record for shot capture BEFORE any impulses (to get pre-collision state)
  if (shotCapture.isCapturing()) {
    const cueBall = ballA.id === 0 ? ballA : ballB;
    const otherBall = ballA.id === 0 ? ballB : ballA;
    
    // Calculate normal from cue ball to other ball (for shot capture)
    const dx_capture = otherBall.x - cueBall.x;
    const dy_capture = otherBall.y - cueBall.y;
    const dist_capture = Math.sqrt(dx_capture * dx_capture + dy_capture * dy_capture);
    const nx_capture = dist_capture > 1e-8 ? dx_capture / dist_capture : 1;
    const ny_capture = dist_capture > 1e-8 ? dy_capture / dist_capture : 0;
    
    shotCapture.recordCollision(cueBall, otherBall, { x: nx_capture, y: ny_capture }, depth);
  }
  
  // Relative velocity
  const dvx = ballB.vx - ballA.vx;
  const dvy = ballB.vy - ballA.vy;
  const vRel = dvx * nx + dvy * ny;
  
  // Separating already?
  if (vRel > 0) return;
  
  // Impulse magnitude
  const e = CONFIG.BALL_RESTITUTION;
  const j = -(1 + e) * vRel / totalInvMass;
  
  // Apply impulse
  const jx = j * nx;
  const jy = j * ny;
  
  ballA.vx -= jx * ballA.invMass;
  ballA.vy -= jy * ballA.invMass;
  ballB.vx += jx * ballB.invMass;
  ballB.vy += jy * ballB.invMass;
  
  // Record collision
  physicsRecorder.recordCollision(ballA, ballB);
  
  // Friction (tangent impulse)
  const tx = -ny;
  const ty = nx;
  const vt = dvx * tx + dvy * ty;
  const jt = -vt / totalInvMass;
  const maxFriction = Math.abs(j) * CONFIG.SLIDING_FRICTION;
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
  
  // Positional correction
  ballA.x += nx * depth;
  ballA.y += ny * depth;
  
  // Velocity reflection
  const vn = ballA.vx * nx + ballA.vy * ny;
  
  // Already separating?
  if (vn > 0) return;
  
  // Reflect with restitution
  const e = CONFIG.CUSHION_RESTITUTION;
  const jn = -(1 + e) * vn;
  
  ballA.vx += jn * nx;
  ballA.vy += jn * ny;
  
  // Tangential friction
  const tx = -ny;
  const ty = nx;
  const vt = ballA.vx * tx + ballA.vy * ty;
  
  const friction = CONFIG.SLIDING_FRICTION;
  const jt = -vt * friction;
  
  ballA.vx += jt * tx;
  ballA.vy += jt * ty;
}
