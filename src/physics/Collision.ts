// Collision detection and resolution

import { Ball, Rail } from './Shapes';
import { CONFIG } from '../config';
import { physicsRecorder } from '../debug/PhysicsRecorder';

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
  
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const distSq = dx * dx + dy * dy;
  const minDist = a.radius + b.radius;
  
  if (distSq >= minDist * minDist) return null;
  
  const dist = Math.sqrt(distSq);
  const depth = minDist - dist;
  
  // Normal from A to B
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
