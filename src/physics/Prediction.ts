// Aim assist prediction system
// Lightweight raycast for first contact prediction

import { Ball, Rail, Vec2 } from './Shapes';
import { PhysicsWorld } from './Physics';
import { CONFIG } from '../config';
import { enableCollisionCapture, consumeCollisionSnapshot } from './Collision';
import { getTableGeometry } from '../geometry/Geometry';


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

  /**
   * Simulate full physics for shot preview
   * Returns accurate trajectory paths by running actual physics simulation
   * Much more accurate than ray-casting, especially for extreme angles
   */
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

    // Use a representative default power (80% of max) if not specified or if 0
    // This better matches typical shot power, improving prediction accuracy
    const effectivePower = (power && power > CONFIG.CUE_POWER_MIN) 
      ? power 
      : CONFIG.CUE_POWER_MAX * 0.8;
    const speed = effectivePower * CONFIG.CUE_POWER_MULTIPLIER;

    previewCue.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    previewCue.sleeping = false;
    previewCue.prevX = previewCue.x;
    previewCue.prevY = previewCue.y;

    const cuePath: Vec2[] = [{ x: previewCue.x, y: previewCue.y }];
    const objectPaths = new Map<number, Vec2[]>();
    let firstContact: PredictionResult | null = null;
    let firstContactSource: 'none' | 'solver' | 'analytic' = 'none';
    let solverBallSnapshots = 0;
    let solverRailSnapshots = 0;
    let cueDistance = 0;

    const maxSteps = Math.min(240, Math.ceil(duration / CONFIG.PHYSICS_DT));
    const activationSpeed = CONFIG.VELOCITY_EPSILON * 2;

    enableCollisionCapture(true);

    let terminateEarly = false;

    for (let step = 0; step < maxSteps && !terminateEarly; step++) {
      const baseDt = CONFIG.PHYSICS_DT;
      const cueSpeed = previewCue.getSpeed();
      const maxTravelPerSlice = CONFIG.BALL_RADIUS * 0.4;
      const estimatedTravel = cueSpeed * baseDt;
      const previewSubsteps = Math.max(1, Math.ceil(estimatedTravel / Math.max(maxTravelPerSlice, 1e-4)));
      const subDt = baseDt / previewSubsteps;

      for (let sub = 0; sub < previewSubsteps; sub++) {
        const cuePrevX = previewCue.x;
        const cuePrevY = previewCue.y;
        const preStepBallPositions = new Map<number, Vec2>();
        previewWorld.balls.forEach((ball) => {
          preStepBallPositions.set(ball.id, { x: ball.x, y: ball.y });
        });

        previewWorld.step(subDt);

        const cueStepDX = previewCue.x - cuePrevX;
        const cueStepDY = previewCue.y - cuePrevY;
        const cueStepDistance = Math.hypot(cueStepDX, cueStepDY);
        const cueDistanceBeforeStep = cueDistance;
        cueDistance += cueStepDistance;
        cuePath.push({ x: previewCue.x, y: previewCue.y });

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

        const cueRadius = previewCue.radius;
        const tolerance = 0.01;

        const snapshot = consumeCollisionSnapshot();
        if (snapshot) {
          if (snapshot.cueToRail) {
            solverRailSnapshots += 1;
            const { contactPoint, normal } = snapshot.cueToRail;
            const cueCenterAtContact = {
              x: contactPoint.x + normal.x * cueRadius,
              y: contactPoint.y + normal.y * cueRadius,
            };
            let contactT = cueStepDistance > 1e-6
              ? ((cueCenterAtContact.x - cuePrevX) * cueStepDX + (cueCenterAtContact.y - cuePrevY) * cueStepDY) / (cueStepDistance * cueStepDistance)
              : 0;
            contactT = Math.max(0, Math.min(1, contactT));
            const distance = cueDistanceBeforeStep + cueStepDistance * contactT;
            const shouldReplace = !firstContact || distance <= firstContact.distance + 1e-4;
            if (shouldReplace) {
              firstContact = {
                type: 'rail',
                contactPoint,
                contactNormal: { x: normal.x, y: normal.y },
                hitRail: snapshot.cueToRail.rail,
                distance,
              };
              firstContactSource = 'solver';
            }
          }
          if (snapshot.cueToBall) {
            solverBallSnapshots += 1;
            const { contactPoint, normal, objectId } = snapshot.cueToBall;
            const cueCenterAtContact = {
              x: contactPoint.x + normal.x * cueRadius,
              y: contactPoint.y + normal.y * cueRadius,
            };
            let contactT = cueStepDistance > 1e-6
              ? ((cueCenterAtContact.x - cuePrevX) * cueStepDX + (cueCenterAtContact.y - cuePrevY) * cueStepDY) / (cueStepDistance * cueStepDistance)
              : 0;
            contactT = Math.max(0, Math.min(1, contactT));
            const distance = cueDistanceBeforeStep + cueStepDistance * contactT;
            const originalBall = world.getBallById(objectId) ?? undefined;
            const shouldReplace = !firstContact || distance <= firstContact.distance + 1e-4;
            if (shouldReplace) {
              firstContact = {
                type: 'ball',
                contactPoint,
                contactNormal: { x: normal.x, y: normal.y },
                hitBall: originalBall,
                distance,
              };
              firstContactSource = 'solver';
            }
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

                const originalRail = world.rails.find((r) => r === rail) ?? rail;

                firstContact = {
                  type: 'rail',
                  contactPoint,
                  contactNormal: { x: normalX, y: normalY },
                  hitRail: originalRail,
                  distance: cueDistance,
                };
                firstContactSource = 'analytic';
                break;
              }
            }

            if (!firstContact) {
              for (const ball of previewWorld.balls) {
                if (ball.id === previewCue.id || ball.pocketed) continue;

                const dx = ball.x - previewCue.x;
                const dy = ball.y - previewCue.y;
                const dist = Math.hypot(dx, dy);
                const combinedRadius = ball.radius + cueRadius;

                if (dist <= combinedRadius + tolerance && dist > 1e-5) {
                  let contactT = 1;
                  const ballPrev = preStepBallPositions.get(ball.id);
                  if (ballPrev) {
                    const relPrevX = ballPrev.x - cuePrevX;
                    const relPrevY = ballPrev.y - cuePrevY;
                    const relCurrX = ball.x - previewCue.x;
                    const relCurrY = ball.y - previewCue.y;
                    const dvX = relCurrX - relPrevX;
                    const dvY = relCurrY - relPrevY;
                    const a = dvX * dvX + dvY * dvY;
                    const b = 2 * (relPrevX * dvX + relPrevY * dvY);
                    const c = relPrevX * relPrevX + relPrevY * relPrevY - combinedRadius * combinedRadius;
                    const discriminant = b * b - 4 * a * c;
                    if (a > 1e-8 && discriminant >= 0) {
                      const sqrtDisc = Math.sqrt(discriminant);
                      const t1 = (-b - sqrtDisc) / (2 * a);
                      const t2 = (-b + sqrtDisc) / (2 * a);
                      let bestT = Number.POSITIVE_INFINITY;
                      [t1, t2].forEach((candidate) => {
                        if (candidate >= 0 && candidate <= 1 && candidate < bestT) {
                          bestT = candidate;
                        }
                      });
                      if (Number.isFinite(bestT)) {
                        contactT = bestT;
                      }
                    }
                  }
                  contactT = Math.max(0, Math.min(1, contactT));

                  const cueCenterAtContact = {
                    x: cuePrevX + cueStepDX * contactT,
                    y: cuePrevY + cueStepDY * contactT,
                  };
                  const ballCenterAtContact = (() => {
                    const prev = preStepBallPositions.get(ball.id);
                    if (!prev) {
                      return { x: ball.x, y: ball.y };
                    }
                    return {
                      x: prev.x + (ball.x - prev.x) * contactT,
                      y: prev.y + (ball.y - prev.y) * contactT,
                    };
                  })();

                  let relX = ballCenterAtContact.x - cueCenterAtContact.x;
                  let relY = ballCenterAtContact.y - cueCenterAtContact.y;
                  let relLen = Math.hypot(relX, relY);
                  if (relLen < 1e-6) {
                    relX = dx;
                    relY = dy;
                    relLen = dist;
                  }
                  const nx = relX / relLen;
                  const ny = relY / relLen;

                  const contactPoint = {
                    x: cueCenterAtContact.x + nx * cueRadius,
                    y: cueCenterAtContact.y + ny * cueRadius,
                  };

                  const originalBall = world.getBallById(ball.id) ?? undefined;

                  firstContact = {
                    type: 'ball',
                    contactPoint,
                    contactNormal: { x: nx, y: ny },
                    hitBall: originalBall,
                    distance: cueDistanceBeforeStep + cueStepDistance * contactT,
                  };
                  firstContactSource = 'analytic';
                  break;
                }
              }
            }
          }
        }
      }

      const cueSleeping = previewCue.sleeping || previewCue.getSpeed() < CONFIG.VELOCITY_EPSILON;
      const anyActive = Array.from(objectPaths.values()).some((path) => path.length > 0);

      if (cueSleeping && !anyActive) {
        terminateEarly = true;
      }

    enableCollisionCapture(false);

    if (typeof import.meta !== 'undefined' && (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV) {
      console.debug('[Predictor] simulateShotPaths contact', {
        source: firstContactSource,
        solverBallSnapshots,
        solverRailSnapshots,
        hasContact: !!firstContact,
      });
    }

    if (firstContact?.type === 'ball') {
      const targetId = firstContact.hitBall?.id;
      const ballPath = targetId !== undefined ? objectPaths.get(targetId) : undefined;
      const path = ballPath ?? [];

      if (path.length < 2) {
        const ballRadius = firstContact.hitBall?.radius ?? previewCue.radius;
        const contactCenter = {
          x: firstContact.contactPoint.x + firstContact.contactNormal.x * ballRadius,
          y: firstContact.contactPoint.y + firstContact.contactNormal.y * ballRadius,
        };

        if (path.length === 0) {
          path.push(contactCenter);
        } else {
          path[0] = contactCenter;
        }

        const extension = Math.max(6, speed * 0.05);
        path.push({
          x: contactCenter.x + firstContact.contactNormal.x * extension,
          y: contactCenter.y + firstContact.contactNormal.y * extension,
        });

        if (targetId !== undefined) {
          objectPaths.set(targetId, path);
        }
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
    const cueRadius = CONFIG.BALL_RADIUS;

    // Offset rail segment inward by cue radius so ray (cue center) hits when ball touches rail
    const offsetX = rail.nx * cueRadius;
    const offsetY = rail.ny * cueRadius;
    const x1 = rail.x1 + offsetX;
    const y1 = rail.y1 + offsetY;
    const x2 = rail.x2 + offsetX;
    const y2 = rail.y2 + offsetY;

    // Rail segment vector
    const segX = x2 - x1;
    const segY = y2 - y1;

    // Solve: origin + t * direction = rail.p1 + s * segment
    // Using cross product to find intersection
    const cross = direction.x * segY - direction.y * segX;

    // Parallel lines (no intersection)
    if (Math.abs(cross) < 0.0001) return null;

    const toRail = {
      x: x1 - origin.x,
      y: y1 - origin.y,
    };

    const t = (toRail.x * segY - toRail.y * segX) / cross;
    const s = (toRail.x * direction.y - toRail.y * direction.x) / cross;

    // Check if intersection is valid
    if (t < 0 || t > maxDistance) return null; // Outside ray range
    if (s < 0 || s > 1) return null; // Outside segment range

    const contactCenter = {
      x: origin.x + direction.x * t,
      y: origin.y + direction.y * t,
    };

    const contactPoint = {
      x: contactCenter.x - rail.nx * cueRadius,
      y: contactCenter.y - rail.ny * cueRadius,
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
      let nx = result.contactNormal.x;
      let ny = result.contactNormal.y;

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
      const e = CONFIG.BALL_RESTITUTION;
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
      const ballBallFriction = CONFIG.BALL_BALL_FRICTION;
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

      // If object ball is near a rail and predicted direction points into it, project along tangent
      try {
        const GEOM = getTableGeometry();
        const ballRadius = result.hitBall.radius ?? CONFIG.BALL_RADIUS;
        const ballCenterAtContact = {
          x: result.contactPoint.x + nx * ballRadius,
          y: result.contactPoint.y + ny * ballRadius,
        };
        let nearest: { n: { x: number; y: number }; dist: number } | null = null;
        for (const rail of GEOM.rails) {
          const rx = rail.to.x - rail.from.x;
          const ry = rail.to.y - rail.from.y;
          const rLenSq = rx * rx + ry * ry;
          if (rLenSq < 1e-8) continue;
          const px = ballCenterAtContact.x - rail.from.x;
          const py = ballCenterAtContact.y - rail.from.y;
          let t = (px * rx + py * ry) / rLenSq;
          t = Math.max(0, Math.min(1, t));
          const cx = rail.from.x + t * rx;
          const cy = rail.from.y + t * ry;
          const dx = ballCenterAtContact.x - cx;
          const dy = ballCenterAtContact.y - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (!nearest || dist < nearest.dist) {
            nearest = { n: { x: rail.normal.x, y: rail.normal.y }, dist };
          }
        }
        if (nearest) {
          const threshold = CONFIG.BALL_RADIUS + 0.02;
          const dotInward = nx * nearest.n.x + ny * nearest.n.y;
          if (nearest.dist <= threshold && dotInward < -0.05) {
            // Remove inward component; slide along tangent
            const vx = nx - dotInward * nearest.n.x;
            const vy = ny - dotInward * nearest.n.y;
            const vlen = Math.hypot(vx, vy);
            if (vlen > 1e-6) {
              nx = vx / vlen;
              ny = vy / vlen;
            } else {
              nx = -nearest.n.y;
              ny = nearest.n.x;
            }
          }
        }
      } catch {}

      const objPathStart = { x: result.hitBall.x, y: result.hitBall.y };
      const objPathEnd = {
        x: result.hitBall.x + nx * lineLength,
        y: result.hitBall.y + ny * lineLength,
      };
      
      // If cue ball immediately reaches a rail, apply rail response model to direction (restitution + sliding)
      try {
        if (cueBallSpeed > 0.01) {
          const GEOM = getTableGeometry();
          const cueCenterAtContact = {
            x: result.contactPoint.x - result.contactNormal.x * CONFIG.BALL_RADIUS,
            y: result.contactPoint.y - result.contactNormal.y * CONFIG.BALL_RADIUS,
          };
          let nearest: { n: { x: number; y: number }; dist: number } | null = null;
          for (const rail of GEOM.rails) {
            const rx = rail.to.x - rail.from.x;
            const ry = rail.to.y - rail.from.y;
            const rLenSq = rx * rx + ry * ry;
            if (rLenSq < 1e-8) continue;
            const px = cueCenterAtContact.x - rail.from.x;
            const py = cueCenterAtContact.y - rail.from.y;
            let t = (px * rx + py * ry) / rLenSq;
            t = Math.max(0, Math.min(1, t));
            const cx = rail.from.x + t * rx;
            const cy = rail.from.y + t * ry;
            const dx = cueCenterAtContact.x - cx;
            const dy = cueCenterAtContact.y - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (!nearest || dist < nearest.dist) {
              nearest = { n: { x: rail.normal.x, y: rail.normal.y }, dist };
            }
          }
          if (nearest && nearest.dist <= CONFIG.BALL_RADIUS + 0.02) {
            let vx2 = cueDirNormX;
            let vy2 = cueDirNormY;
            const n2 = nearest.n;
            const vn2 = vx2 * n2.x + vy2 * n2.y;
            if (vn2 > 0) {
              const eRail = CONFIG.CUSHION_RESTITUTION;
              const jn2 = -(1 + eRail) * vn2;
              vx2 += jn2 * n2.x;
              vy2 += jn2 * n2.y;
              const tx2 = -n2.y;
              const ty2 = n2.x;
              const vt2 = vx2 * tx2 + vy2 * ty2;
              const jt2 = -vt2 * CONFIG.SLIDING_FRICTION;
              vx2 += jt2 * tx2;
              vy2 += jt2 * ty2;
              const vlen2 = Math.hypot(vx2, vy2);
              if (vlen2 > 1e-6) {
                cueDirNormX = vx2 / vlen2;
                cueDirNormY = vy2 / vlen2;
              }
            }
          }
        }
      } catch {}

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
