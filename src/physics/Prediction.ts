// Ghost line prediction for aim assist
// Raycast to predict first ball contact

import { Ball, Rail } from './Shapes';
import { CONFIG } from '../config';

export interface PredictionResult {
  hitBall: Ball | null;
  hitPoint: { x: number; y: number } | null;
  hitRail: Rail | null;
  surfacePoint: { x: number; y: number } | null;
  distance: number;
}

export interface PredictionPath {
  segments: Array<{
    start: { x: number; y: number };
    end: { x: number; y: number };
    type: 'cue' | 'object'; // Which ball's path
  }>;
  firstContact: PredictionResult;
}

export class Predictor {
  /**
   * Calculate stopping distance for a ball with given speed and velocity-proportional friction
   * Physics uses: decel = friction * speed, giving exponential decay
   * For exponential decay: v(t) = v0 * e^(-friction * t)
   * Distance = integral of v(t) = v0 / friction * (1 - e^(-friction * t))
   * As t -> infinity, distance approaches v0 / friction
   * @param speed - Initial speed in inches/second
   * @param friction - Friction coefficient (e.g., ROLLING_FRICTION)
   * @returns Distance in inches until ball stops
   */
  private static calculateStoppingDistance(speed: number, friction: number): number {
    if (speed < CONFIG.VELOCITY_EPSILON) return 0;
    // For velocity-proportional friction, stopping distance = v0 / friction
    const distance = speed / friction;
    return Math.min(distance, CONFIG.GHOST_LINE_LENGTH);
  }

  /**
   * Predict full path including bounces after first contact
   * @param cueBall - The cue ball
   * @param angle - Shot angle in radians
   * @param power - Shot power (affects distance prediction)
   * @param balls - All balls on table
   * @param rails - All rail segments
   * @param maxBounces - Maximum number of bounces to predict
   * @returns Full prediction path with segments
   */
  static predictFullPath(
    cueBall: Ball,
    angle: number,
    power: number,
    balls: Ball[],
    rails: Rail[],
    _maxBounces: number = 2 // Reserved for multi-bounce prediction
  ): PredictionPath {
    const segments: PredictionPath['segments'] = [];
    const actualSpeed = Math.sqrt(cueBall.vx * cueBall.vx + cueBall.vy * cueBall.vy);
    const useActualVelocity = actualSpeed > CONFIG.VELOCITY_EPSILON;
    const dirX = useActualVelocity ? cueBall.vx / actualSpeed : Math.cos(angle);
    const dirY = useActualVelocity ? cueBall.vy / actualSpeed : Math.sin(angle);
    const cueSpeed = useActualVelocity ? actualSpeed : Math.max(1e-4, power * CONFIG.CUE_POWER_MULTIPLIER);
    const cuePreVx = dirX * cueSpeed;
    const cuePreVy = dirY * cueSpeed;
    const firstContact = this.predictFirstContact(cueBall, Math.atan2(dirY, dirX), balls, rails);
    
    if (!firstContact.hitPoint) {
      // No contact - just draw straight line
      const endX = cueBall.x + dirX * CONFIG.GHOST_LINE_LENGTH;
      const endY = cueBall.y + dirY * CONFIG.GHOST_LINE_LENGTH;
      segments.push({
        start: { x: cueBall.x, y: cueBall.y },
        end: { x: endX, y: endY },
        type: 'cue'
      });
      return { segments, firstContact };
    }
    
    const contactPoint = firstContact.surfacePoint ?? firstContact.hitPoint;
    if (!contactPoint) {
      return {
        segments,
        firstContact,
      };
    }
    
    // First segment: cue ball to contact
    segments.push({
      start: { x: cueBall.x, y: cueBall.y },
      end: { x: contactPoint.x, y: contactPoint.y },
      type: 'cue'
    });
    
    // Predict cue ball bounce if hit ball
    if (firstContact.hitBall) {
      const hitBall = firstContact.hitBall;
      const hitPoint = contactPoint;
      
      const dx = hitBall.x - hitPoint.x;
      const dy = hitBall.y - hitPoint.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = dx / dist;
      const ny = dy / dist;
      
      // Initial velocities: cue ball moving along aim direction, object ball stationary
      const objPreVx = 0;
      const objPreVy = 0;
      
      const invMassCue = cueBall.invMass ?? 1;
      const invMassObj = hitBall.invMass ?? 1;
      const totalInvMass = invMassCue + invMassObj;
      
      // Relative velocity along the collision normal
      const dvx = objPreVx - cuePreVx;
      const dvy = objPreVy - cuePreVy;
      const vRel = dvx * nx + dvy * ny;
      
      // If vRel >= 0, balls are separating (should not happen, but guard)
      if (vRel < 0) {
        const restitution = CONFIG.BALL_RESTITUTION;
        const j = -(1 + restitution) * vRel / totalInvMass;
        const jx = j * nx;
        const jy = j * ny;
        
        let cuePostVx = cuePreVx - jx * invMassCue;
        let cuePostVy = cuePreVy - jy * invMassCue;
        let objPostVx = objPreVx + jx * invMassObj;
        let objPostVy = objPreVy + jy * invMassObj;
        
        // Tangential friction impulse (matches resolveBallBall)
        const tx = -ny;
        const ty = nx;
        const vt = dvx * tx + dvy * ty;
        const jt = -vt / totalInvMass;
        const maxFriction = Math.abs(j) * CONFIG.SLIDING_FRICTION;
        const jtClamped = Math.max(-maxFriction, Math.min(maxFriction, jt));
        const jtx = jtClamped * tx;
        const jty = jtClamped * ty;
        
        cuePostVx -= jtx * invMassCue;
        cuePostVy -= jty * invMassCue;
        objPostVx += jtx * invMassObj;
        objPostVy += jty * invMassObj;
        
        const cuePostSpeed = Math.sqrt(cuePostVx * cuePostVx + cuePostVy * cuePostVy);
        const objPostSpeed = Math.sqrt(objPostVx * objPostVx + objPostVy * objPostVy);
        // Always use physics-based stopping distance
        const cueScale = this.calculateStoppingDistance(cuePostSpeed, CONFIG.ROLLING_FRICTION);
        const objScale = this.calculateStoppingDistance(objPostSpeed, CONFIG.ROLLING_FRICTION);
        
        segments.push({
          start: { x: hitPoint.x, y: hitPoint.y },
          end: { x: hitPoint.x + cuePostVx * cueScale, y: hitPoint.y + cuePostVy * cueScale },
          type: 'cue'
        });
        segments.push({
          start: { x: hitBall.x, y: hitBall.y },
          end: { x: hitBall.x + objPostVx * objScale, y: hitBall.y + objPostVy * objScale },
          type: 'object'
        });
      }
    } else if (firstContact.hitRail) {
      // Predict rail bounce
      const rail = firstContact.hitRail;
      const hitPoint = contactPoint;
      
      const vn = cuePreVx * rail.nx + cuePreVy * rail.ny;
      if (vn < 0) {
        const restitution = CONFIG.CUSHION_RESTITUTION;
        const jn = -(1 + restitution) * vn;
        let cuePostVx = cuePreVx + jn * rail.nx;
        let cuePostVy = cuePreVy + jn * rail.ny;
        
        const tx = -rail.ny;
        const ty = rail.nx;
        const vt = cuePostVx * tx + cuePostVy * ty;
        const jt = -vt * CONFIG.SLIDING_FRICTION;
        cuePostVx += jt * tx;
        cuePostVy += jt * ty;
        
        const cuePostSpeed = Math.sqrt(cuePostVx * cuePostVx + cuePostVy * cuePostVy);
        // Always use physics-based stopping distance
        const cueScale = this.calculateStoppingDistance(cuePostSpeed, CONFIG.ROLLING_FRICTION);
        
        segments.push({
          start: { x: hitPoint.x, y: hitPoint.y },
          end: { x: hitPoint.x + cuePostVx * cueScale, y: hitPoint.y + cuePostVy * cueScale },
          type: 'cue'
        });
      } else {
        // Fallback: simple reflection to avoid missing segment if not approaching
        const dot = dirX * rail.nx + dirY * rail.ny;
        const reflectX = dirX - 2 * dot * rail.nx;
        const reflectY = dirY - 2 * dot * rail.ny;
        segments.push({
          start: { x: hitPoint.x, y: hitPoint.y },
          end: { x: hitPoint.x + reflectX * CONFIG.GHOST_LINE_LENGTH, y: hitPoint.y + reflectY * CONFIG.GHOST_LINE_LENGTH },
          type: 'cue'
        });
      }
    }
    
    return { segments, firstContact };
  }
  
  /**
   * Predict first contact from cue ball along shot direction
   * @param cueBall - The cue ball
   * @param angle - Shot angle in radians
   * @param balls - All balls on table
   * @param rails - All rail segments
   * @param maxDistance - Maximum prediction distance
   * @returns Prediction result with first contact
   */
  static predictFirstContact(
    cueBall: Ball,
    angle: number,
    balls: Ball[],
    rails: Rail[],
    maxDistance: number = CONFIG.GHOST_LINE_LENGTH
  ): PredictionResult {
    const startX = cueBall.x;
    const startY = cueBall.y;
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    
    let closestBall: Ball | null = null;
    let closestBallDist = Infinity;
    let closestBallPoint: { x: number; y: number } | null = null;
    let closestBallSurface: { x: number; y: number } | null = null;
    
    let closestRail: Rail | null = null;
    let closestRailDist = Infinity;
    let closestRailPoint: { x: number; y: number } | null = null;
    let closestRailSurface: { x: number; y: number } | null = null;
    
    // Check ball-ball intersections (treat as ray-circle)
    for (const ball of balls) {
      if (ball === cueBall || ball.pocketed) continue;
      
      // Ray-circle intersection
      const toX = ball.x - startX;
      const toY = ball.y - startY;
      
      // Project ball center onto ray
      const projection = toX * dirX + toY * dirY;
      if (projection < 0) continue; // Ball behind ray
      
      // Closest point on ray to ball center
      const closestX = startX + dirX * projection;
      const closestY = startY + dirY * projection;
      
      // Distance from ball center to ray
      const dx = ball.x - closestX;
      const dy = ball.y - closestY;
      const distToRay = Math.sqrt(dx * dx + dy * dy);
      
      // Check if ray intersects ball (considering both radii)
      const combinedRadius = cueBall.radius + ball.radius;
      if (distToRay <= combinedRadius) {
        // Calculate actual contact distance (not just projection)
        const halfChord = Math.sqrt(combinedRadius * combinedRadius - distToRay * distToRay);
        const contactDist = projection - halfChord;
        
        if (contactDist > 1e-6 && contactDist < closestBallDist && contactDist <= maxDistance) {
          closestBallDist = contactDist;
          closestBall = ball;
          
          // Contact point is where cue ball surface touches
          const centerX = startX + dirX * contactDist;
          const centerY = startY + dirY * contactDist;
          closestBallPoint = {
            x: startX + dirX * contactDist,
            y: startY + dirY * contactDist
          };
          const surfaceDirX = ball.x - centerX;
          const surfaceDirY = ball.y - centerY;
          const surfaceLen = Math.sqrt(surfaceDirX * surfaceDirX + surfaceDirY * surfaceDirY) || 1;
          closestBallSurface = {
            x: centerX + (surfaceDirX / surfaceLen) * cueBall.radius,
            y: centerY + (surfaceDirY / surfaceLen) * cueBall.radius
          };
        }
      }
    }
    
    // Check rail intersections (solve analytically using rail normal)
    for (const rail of rails) {
      const tangentX = rail.x2 - rail.x1;
      const tangentY = rail.y2 - rail.y1;
      const segmentLength = Math.sqrt(tangentX * tangentX + tangentY * tangentY);
      if (segmentLength < 1e-6) continue;
      const tangentUnitX = tangentX / segmentLength;
      const tangentUnitY = tangentY / segmentLength;
      const normalX = rail.nx;
      const normalY = rail.ny;
      const denom = dirX * normalX + dirY * normalY;
      if (Math.abs(denom) < 1e-6) continue; // Ray parallel to rail
      const startOffset = (startX - rail.x1) * normalX + (startY - rail.y1) * normalY;
      const targetOffset = cueBall.radius;
      const t = (targetOffset - startOffset) / denom;
      if (t <= 1e-6 || t > maxDistance) continue;
      const centerX = startX + dirX * t;
      const centerY = startY + dirY * t;
      const toCenterX = centerX - rail.x1;
      const toCenterY = centerY - rail.y1;
      const along = toCenterX * tangentUnitX + toCenterY * tangentUnitY;
      if (along < 0 || along > segmentLength) continue;
      if (t < closestRailDist) {
        closestRailDist = t;
        closestRail = rail;
        closestRailPoint = { x: centerX, y: centerY };
        closestRailSurface = {
          x: centerX - normalX * cueBall.radius,
          y: centerY - normalY * cueBall.radius,
        };
      }
    }
    
    // Return whichever is closer
    if (closestBallDist < closestRailDist) {
      return {
        hitBall: closestBall,
        hitPoint: closestBallPoint,
        hitRail: null,
        surfacePoint: closestBallSurface ?? closestBallPoint,
        distance: closestBallDist
      };
    } else if (closestRail) {
      return {
        hitBall: null,
        hitPoint: closestRailPoint,
        hitRail: closestRail,
        surfacePoint: closestRailSurface ?? closestRailPoint,
        distance: closestRailDist
      };
    } else {
      // No hit within max distance
      return {
        hitBall: null,
        hitPoint: null,
        hitRail: null,
        surfacePoint: null,
        distance: maxDistance
      };
    }
  }
  
}
