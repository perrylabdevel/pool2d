// Aim assist prediction system
// Lightweight raycast for first contact prediction

import { Ball, Rail, Vec2 } from './Shapes';
import { PhysicsWorld } from './Physics';
import { CONFIG } from '../config';

export interface Vec2 {
  x: number;
  y: number;
}

export interface PredictionResult {
  type: 'ball' | 'rail' | 'none';
  contactPoint: Vec2;
  contactNormal: Vec2;
  hitBall?: Ball;
  hitRail?: Rail;
  distance: number;
}

export interface ShotPreviewPaths {
  cuePath: Vec2[];
  objectPaths: Map<number, Vec2[]>;
  firstContact?: PredictionResult;
}

export class Predictor {
  /**
   * Cast a ray from origin in direction and find first collision
   * @param origin Starting point (cue ball center)
   * @param direction Unit vector of shot direction
   * @param world Physics world with balls and rails
   * @param excludeBall Ball to exclude from checks (the cue ball itself)
   * @param maxDistance Maximum ray distance to check
   */
  predictFirstContact(
    origin: Vec2,
    direction: Vec2,
    world: PhysicsWorld,
    excludeBall: Ball,
    maxDistance: number = 200
  ): PredictionResult {
    let closestHit: PredictionResult = {
      type: 'none',
      contactPoint: { x: origin.x + direction.x * maxDistance, y: origin.y + direction.y * maxDistance },
      contactNormal: { x: 0, y: 0 },
      distance: maxDistance,
    };

    // Check ball-ball intersections
    for (const ball of world.balls) {
      if (ball === excludeBall || ball.pocketed) continue;

      const hit = this.rayCircleIntersect(origin, direction, ball, maxDistance);
      if (hit && hit.distance < closestHit.distance) {
        closestHit = {
          type: 'ball',
          contactPoint: hit.point,
          contactNormal: hit.normal,
          hitBall: ball,
          distance: hit.distance,
        };
      }
    }

    // Check rail intersections
    for (const rail of world.rails) {
      const hit = this.rayLineIntersect(origin, direction, rail, maxDistance);
      if (hit && hit.distance < closestHit.distance) {
        closestHit = {
          type: 'rail',
          contactPoint: hit.point,
          contactNormal: { x: rail.nx, y: rail.ny },
          hitRail: rail,
          distance: hit.distance,
        };
      }
    }

    return closestHit;
  }

  simulateShotPaths(
    world: PhysicsWorld,
    cueBall: Ball,
    angle: number,
    power?: number,
    duration: number = 1.1
  ): ShotPreviewPaths | null {
    if (cueBall.pocketed) return null;

    const previewWorld = world.clone({ enableRecording: false });
    const previewCue = previewWorld.getBallById(cueBall.id);

    if (!previewCue) return null;

    const effectivePower = Math.max(power ?? CONFIG.CUE_POWER_MAX * 0.6, CONFIG.CUE_POWER_MIN * 1.5);
    const speed = effectivePower * CONFIG.CUE_POWER_MULTIPLIER;

    previewCue.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    previewCue.sleeping = false;
    previewCue.prevX = previewCue.x;
    previewCue.prevY = previewCue.y;

    const cuePath: Vec2[] = [{ x: previewCue.x, y: previewCue.y }];
    const objectPaths = new Map<number, Vec2[]>();
    let firstContact: PredictionResult | null = null;
    let cueDistance = 0;
    let prevCueX = previewCue.x;
    let prevCueY = previewCue.y;

    const maxSteps = Math.min(240, Math.ceil(duration / CONFIG.PHYSICS_DT));
    const activationSpeed = CONFIG.VELOCITY_EPSILON * 2;

    for (let step = 0; step < maxSteps; step++) {
      previewWorld.step(CONFIG.PHYSICS_DT);

      cueDistance += Math.hypot(previewCue.x - prevCueX, previewCue.y - prevCueY);
      cuePath.push({ x: previewCue.x, y: previewCue.y });
      prevCueX = previewCue.x;
      prevCueY = previewCue.y;

      for (const ball of previewWorld.balls) {
        if (ball.id === previewCue.id || ball.pocketed) continue;

        if (ball.getSpeed() > activationSpeed) {
          const path = objectPaths.get(ball.id);
          const point = { x: ball.x, y: ball.y };
          if (path) {
            path.push(point);
          } else {
            objectPaths.set(ball.id, [point]);
          }
        }
      }

      if (!firstContact) {
        const cueRadius = previewCue.radius;
        const tolerance = 0.01;

        for (const ball of previewWorld.balls) {
          if (ball.id === previewCue.id || ball.pocketed) continue;

          const dx = ball.x - previewCue.x;
          const dy = ball.y - previewCue.y;
          const dist = Math.hypot(dx, dy);
          const combinedRadius = ball.radius + cueRadius;

          if (dist <= combinedRadius + tolerance && dist > 1e-5) {
            const nx = dx / dist;
            const ny = dy / dist;
            const contactPoint = {
              x: previewCue.x + nx * cueRadius,
              y: previewCue.y + ny * cueRadius,
            };

            const originalBall = world.getBallById(ball.id) ?? undefined;

            firstContact = {
              type: 'ball',
              contactPoint,
              contactNormal: { x: nx, y: ny },
              hitBall: originalBall,
              distance: cueDistance,
            };
            break;
          }
        }

        if (!firstContact) {
          for (const rail of previewWorld.rails) {
            const segDX = rail.x2 - rail.x1;
            const segDY = rail.y2 - rail.y1;
            const segLenSq = segDX * segDX + segDY * segDY;
            if (segLenSq < 1e-6) continue;

            const toPointX = previewCue.x - rail.x1;
            const toPointY = previewCue.y - rail.y1;
            let t = (toPointX * segDX + toPointY * segDY) / segLenSq;
            t = Math.max(0, Math.min(1, t));

            const closestX = rail.x1 + segDX * t;
            const closestY = rail.y1 + segDY * t;

            const distX = previewCue.x - closestX;
            const distY = previewCue.y - closestY;
            const dist = Math.hypot(distX, distY);

            if (dist <= cueRadius + tolerance) {
              const normalX = dist > 1e-5 ? distX / dist : rail.nx;
              const normalY = dist > 1e-5 ? distY / dist : rail.ny;
              const contactPoint = {
                x: previewCue.x - normalX * cueRadius,
                y: previewCue.y - normalY * cueRadius,
              };

              const originalRail = world.rails.find((r) => r.cushionId === rail.cushionId) ?? rail;

              firstContact = {
                type: 'rail',
                contactPoint,
                contactNormal: { x: normalX, y: normalY },
                hitRail: originalRail,
                distance: cueDistance,
              };
              break;
            }
          }
        }
      }

      const cueSleeping = previewCue.sleeping || previewCue.getSpeed() < CONFIG.VELOCITY_EPSILON;
      const anyActive = Array.from(objectPaths.values()).some((path) => path.length > 0);

      if (cueSleeping && !anyActive) {
        break;
      }
    }

    return { cuePath, objectPaths, firstContact: firstContact ?? undefined };
  }

  /**
   * Sphere-sphere sweep (for ball collisions)
   * Treats cue ball as a moving sphere, not a point
   * Returns the point where cue ball surface first touches object ball surface
   */
  private rayCircleIntersect(
    origin: Vec2,
    direction: Vec2,
    ball: Ball,
    maxDistance: number
  ): { point: Vec2; normal: Vec2; distance: number } | null {
    // For sphere-sphere collision, we need to account for both radii
    // Treat it as a ray hitting a circle with combined radius
    const cueBallRadius = CONFIG.BALL_RADIUS;
    const combinedRadius = ball.radius + cueBallRadius;
    
    // Vector from ray origin to circle center
    const toCenter = {
      x: ball.x - origin.x,
      y: ball.y - origin.y,
    };

    // Project toCenter onto ray direction
    const projection = toCenter.x * direction.x + toCenter.y * direction.y;

    // If projection is negative, circle is behind ray
    if (projection < 0) return null;

    // Find closest point on ray to circle center
    const closestPoint = {
      x: origin.x + direction.x * projection,
      y: origin.y + direction.y * projection,
    };

    // Distance from closest point to circle center
    const dx = ball.x - closestPoint.x;
    const dy = ball.y - closestPoint.y;
    const distToCenter = Math.sqrt(dx * dx + dy * dy);

    // Check if ray misses the circle (using combined radius for sphere-sphere)
    if (distToCenter > combinedRadius) return null;

    // Calculate distance along ray to contact point (sphere-sphere)
    const distToClosest = projection;
    const distInsideCircle = Math.sqrt(combinedRadius * combinedRadius - distToCenter * distToCenter);
    const contactDistance = distToClosest - distInsideCircle;

    // Check if contact is within max distance
    if (contactDistance < 0 || contactDistance > maxDistance) return null;

    // Calculate cue ball center position at contact
    const cueBallCenterAtContact = {
      x: origin.x + direction.x * contactDistance,
      y: origin.y + direction.y * contactDistance,
    };

    // Contact point is on the line between the two ball centers
    // at distance cueBallRadius from cue ball center
    const dx_centers = ball.x - cueBallCenterAtContact.x;
    const dy_centers = ball.y - cueBallCenterAtContact.y;
    const dist_centers = Math.sqrt(dx_centers * dx_centers + dy_centers * dy_centers);
    
    const nx = dx_centers / dist_centers;
    const ny = dy_centers / dist_centers;
    
    const contactPoint = {
      x: cueBallCenterAtContact.x + nx * cueBallRadius,
      y: cueBallCenterAtContact.y + ny * cueBallRadius,
    };

    // Normal points from cue ball center to object ball center
    return {
      point: contactPoint,
      normal: { x: nx, y: ny },
      distance: contactDistance,
    };
  }

  /**
   * Ray-line segment intersection (for rail collisions)
   */
  private rayLineIntersect(
    origin: Vec2,
    direction: Vec2,
    rail: Rail,
    maxDistance: number
  ): { point: Vec2; distance: number } | null {
    // Rail segment vector
    const segX = rail.x2 - rail.x1;
    const segY = rail.y2 - rail.y1;

    // Solve: origin + t * direction = rail.p1 + s * segment
    // Using cross product to find intersection
    const cross = direction.x * segY - direction.y * segX;

    // Parallel lines (no intersection)
    if (Math.abs(cross) < 0.0001) return null;

    const toRail = {
      x: rail.x1 - origin.x,
      y: rail.y1 - origin.y,
    };

    const t = (toRail.x * segY - toRail.y * segX) / cross;
    const s = (toRail.x * direction.y - toRail.y * direction.x) / cross;

    // Check if intersection is valid
    if (t < 0 || t > maxDistance) return null; // Outside ray range
    if (s < 0 || s > 1) return null; // Outside segment range

    const contactPoint = {
      x: origin.x + direction.x * t,
      y: origin.y + direction.y * t,
    };

    return {
      point: contactPoint,
      distance: t,
    };
  }

  /**
   * Calculate simple trajectory predictions after first contact
   * Returns short line segments showing likely ball paths
   */
  predictTrajectories(
    result: PredictionResult,
    _cueBallPos: Vec2, // Not used - kept for API consistency
    shotDirection: Vec2,
    lineLength: number = 10
  ): {
    objectBallPath?: { start: Vec2; end: Vec2 };
    cueBallPath?: { start: Vec2; end: Vec2 };
  } {
    if (result.type === 'none') return {};

    if (result.type === 'ball' && result.hitBall) {
      // Object ball moves in the direction of the collision normal
      // The contactNormal from raycast already points from cue ball center to object ball center
      const nx = result.contactNormal.x;
      const ny = result.contactNormal.y;

      // Use impulse-based physics to predict deflection (matches actual collision)
      // Assume equal mass (invMass = 1 for both balls)
      const ballMass = 1.0;
      const invMass = 1.0 / ballMass;
      const totalInvMass = invMass + invMass;
      
      // Assume object ball is stationary (relative velocity = cue ball velocity)
      // Shot direction is normalized, so we need to use a representative velocity magnitude
      const vMag = 100; // Representative velocity for direction calculation
      const cueBallVx = shotDirection.x * vMag;
      const cueBallVy = shotDirection.y * vMag;
      
      // Relative velocity (cue ball - object ball, where object ball is at rest)
      const dvx = 0 - cueBallVx; // ballB.vx - ballA.vx
      const dvy = 0 - cueBallVy;
      const vRel = dvx * nx + dvy * ny;
      
      // Normal impulse
      const e = 0.93; // CONFIG.BALL_RESTITUTION
      const j = -(1 + e) * vRel / totalInvMass;
      
      // Apply normal impulse first
      const jx = j * nx;
      const jy = j * ny;
      const cueBallVxAfterNormal = cueBallVx - jx * invMass;
      const cueBallVyAfterNormal = cueBallVy - jy * invMass;
      const objBallVxAfterNormal = 0 + jx * invMass;
      const objBallVyAfterNormal = 0 + jy * invMass;
      
      // Friction impulse - calculate from post-normal-impulse velocities
      const tx = -ny;
      const ty = nx;
      const dvx_post = objBallVxAfterNormal - cueBallVxAfterNormal;
      const dvy_post = objBallVyAfterNormal - cueBallVyAfterNormal;
      const vt = dvx_post * tx + dvy_post * ty;
      const jt = -vt / totalInvMass;
      const ballBallFriction = 0.05; // CONFIG.BALL_BALL_FRICTION
      const maxFriction = Math.abs(j) * ballBallFriction;
      const jtClamped = Math.max(-maxFriction, Math.min(maxFriction, jt));
      
      // Apply friction impulse
      const jtx = jtClamped * tx;
      const jty = jtClamped * ty;
      
      const cueBallVxAfter = cueBallVxAfterNormal - jtx * invMass;
      const cueBallVyAfter = cueBallVyAfterNormal - jty * invMass;
      
      const cueBallSpeed = Math.sqrt(cueBallVxAfter * cueBallVxAfter + cueBallVyAfter * cueBallVyAfter);
      
      let cueDirNormX = 0;
      let cueDirNormY = 0;
      if (cueBallSpeed > 0.01) {
        cueDirNormX = cueBallVxAfter / cueBallSpeed;
        cueDirNormY = cueBallVyAfter / cueBallSpeed;
      }

      const objPathStart = { x: result.hitBall.x, y: result.hitBall.y };
      const objPathEnd = {
        x: result.hitBall.x + nx * lineLength,
        y: result.hitBall.y + ny * lineLength,
      };
      
      return {
        objectBallPath: {
          start: objPathStart,
          end: objPathEnd,
        },
        cueBallPath: cueBallSpeed > 0.01 ? {
          start: result.contactPoint,
          end: {
            x: result.contactPoint.x + cueDirNormX * lineLength,
            y: result.contactPoint.y + cueDirNormY * lineLength,
          },
        } : undefined,
      };
    }

    if (result.type === 'rail') {
      // Reflect shot direction around rail normal
      const dot = shotDirection.x * result.contactNormal.x + shotDirection.y * result.contactNormal.y;
      const reflectX = shotDirection.x - 2 * dot * result.contactNormal.x;
      const reflectY = shotDirection.y - 2 * dot * result.contactNormal.y;

      return {
        cueBallPath: {
          start: result.contactPoint,
          end: {
            x: result.contactPoint.x + reflectX * lineLength,
            y: result.contactPoint.y + reflectY * lineLength,
          },
        },
      };
    }

    return {};
  }
}
