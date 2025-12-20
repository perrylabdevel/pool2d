// Physics world and simulation
// Coordinate system: Origin (0,0) at table center, +X=East, +Y=North (up)

import { Ball, Rail, Pocket } from './Shapes';
import { CONFIG } from '../config';
import { getTableGeometry } from '../geometry/Geometry';
import { detectBallBall, detectBallRail, resolveBallBall, resolveBallRail, Contact, resetCollisionTracking, setSuppressWarnings, shouldNotifyRailCollision, shouldNotifyBallCollision, getCollisionPairId, getBallRailPairId } from './Collision';
import { physicsRecorder } from '../debug/PhysicsRecorder';

const ROTATION_EPSILON = 1e-7;

export type PocketCaptureDetails = {
  ball: Ball;
  pocket: Pocket;
  position: { x: number; y: number };
  velocity: { x: number; y: number };
};

function applyIncrementalRotation(ball: Ball, axisX: number, axisY: number, axisZ: number, angle: number) {
  if (Math.abs(angle) < ROTATION_EPSILON) {
    return;
  }

  // Axis should already be normalized, but guard against drift
  const axisLength = Math.sqrt(axisX * axisX + axisY * axisY + axisZ * axisZ);
  if (axisLength < 1e-6) {
    return;
  }
  const invAxisLen = 1 / axisLength;
  const nx = axisX * invAxisLen;
  const ny = axisY * invAxisLen;
  const nz = axisZ * invAxisLen;

  const halfAngle = angle * 0.5;
  const sinHalf = Math.sin(halfAngle);
  const cosHalf = Math.cos(halfAngle);

  const dqX = nx * sinHalf;
  const dqY = ny * sinHalf;
  const dqZ = nz * sinHalf;
  const dqW = cosHalf;

  const { rotX, rotY, rotZ, rotW } = ball;

  // Quaternion multiply: dq * current
  const newX = dqX * rotW + dqW * rotX + dqY * rotZ - dqZ * rotY;
  const newY = dqY * rotW + dqW * rotY + dqZ * rotX - dqX * rotZ;
  const newZ = dqZ * rotW + dqW * rotZ + dqX * rotY - dqY * rotX;
  const newW = dqW * rotW - dqX * rotX - dqY * rotY - dqZ * rotZ;

  const norm = Math.sqrt(newX * newX + newY * newY + newZ * newZ + newW * newW);
  if (norm > 1e-8) {
    const invNorm = 1 / norm;
    ball.rotX = newX * invNorm;
    ball.rotY = newY * invNorm;
    ball.rotZ = newZ * invNorm;
    ball.rotW = newW * invNorm;
  } else {
    // Fallback to identity if numerical issues arise
    ball.rotX = 0;
    ball.rotY = 0;
    ball.rotZ = 0;
    ball.rotW = 1;
  }
}

export class PhysicsWorld {
  balls: Ball[] = [];
  rails: Rail[] = [];
  pockets: Pocket[] = [];
  // Skip cue ball pocket checks during ball-in-hand dragging
  skipCuePocketCheck: boolean = false;
  // Callback for ball collisions (for rule tracking)
  onBallCollision?: (ballA: Ball, ballB: Ball) => void;
  // Callback for ball-rail collisions (for rule tracking)
  onRailCollision?: (ball: Ball, rail: Rail) => void;
  // Callback for ball pocket captures (for visuals/analytics)
  onBallPocketed?: (details: PocketCaptureDetails) => void;
  private activeBallPairs: Set<string> = new Set();
  private activeRailPairs: Set<string> = new Set();
  
  constructor() {
    this.initializeRails();
    this.initializePockets();
  }
  
  initializeRails() {
    const GEOM = getTableGeometry();
    const hasPlayAreaRails = GEOM.rails.some((r) => typeof r.id === 'string' && r.id.includes('play_area'));
    GEOM.rails.forEach((railDef) => {
      // When SVG/JSON geometry is enabled, cushion_* rails are primarily visual outlines.
      // Collisions should use play_area_* rails (split around pockets) plus derived jaw rails.
      if (hasPlayAreaRails && railDef.id.includes('cushion') && !railDef.id.includes('_jaw_')) return;

      const rail = new Rail(railDef.from.x, railDef.from.y, railDef.to.x, railDef.to.y, railDef.id);
      const dot = rail.nx * railDef.normal.x + rail.ny * railDef.normal.y;
      if (dot < 0) {
        rail.flipNormal();
      }
      // Final safety: ensure normals point inward toward table center (protects against inconsistent authored normals).
      const midX = (rail.x1 + rail.x2) * 0.5;
      const midY = (rail.y1 + rail.y2) * 0.5;
      const toCenterX = -midX;
      const toCenterY = -midY;
      const dotToCenter = rail.nx * toCenterX + rail.ny * toCenterY;
      if (dotToCenter < 0) {
        rail.flipNormal();
      }
      this.rails.push(rail);
    });
  }
  
  initializePockets() {
    // Use authoritative geometry definitions
    const GEOM = getTableGeometry();
    GEOM.pockets.forEach((pocketDef) => {
      const fallbackCapture = pocketDef.id.includes('corner')
        ? GEOM.cornerPocketCaptureRadiusIn
        : GEOM.sidePocketCaptureRadiusIn;
      const captureRadius = pocketDef.captureRadius ?? fallbackCapture ?? GEOM.pocketCaptureRadiusIn;
      this.pockets.push(
        new Pocket(
          pocketDef.center.x,
          pocketDef.center.y,
          captureRadius,
          pocketDef.id
        )
      );
    });
  }
  
  addBall(ball: Ball) {
    this.balls.push(ball);
  }
  
  step(dt: number) {
    // Reset collision tracking at the start of each timestep
    resetCollisionTracking();
    
    // Suppress collision warnings for prediction simulations
    setSuppressWarnings(!this.recordingEnabled);
    
    // Adaptive substepping for high-speed collisions
    // Calculate max ball speed to determine substeps needed
    let maxSpeed = 0;
    for (const ball of this.balls) {
      if (!ball.pocketed && !ball.sleeping) {
        const speed = ball.getSpeed();
        if (speed > maxSpeed) maxSpeed = speed;
      }
    }
    
    // Calculate substeps: keep travel distance per substep well below ball radius
    // Tighter slicing reduces overlap on extreme, high-speed/glancing impacts
    const maxTravelPerSubstep = CONFIG.BALL_RADIUS * 0.4;
    const maxTravelThisStep = maxSpeed * dt;
    const substeps = Math.min(
      CONFIG.MAX_SUBSTEPS,
      Math.max(1, Math.ceil(maxTravelThisStep / Math.max(1e-6, maxTravelPerSubstep)))
    );
    const subDt = dt / substeps;
    const ballPairsThisStep = new Set<string>();
    const railPairsThisStep = new Set<string>();
    
    // Run physics in substeps
    for (let substep = 0; substep < substeps; substep++) {
      // Save previous state for interpolation (only on first substep)
      if (substep === 0) {
        this.balls.forEach((ball) => ball.saveState());
      }
      
      // Apply friction
      this.applyFriction(subDt);
      
      // Integrate velocity and rotation
      this.balls.forEach((ball) => {
        if (ball.pocketed || ball.sleeping) return;
        
        ball.x += ball.vx * subDt;
        ball.y += ball.vy * subDt;
        
        // Update rotation based on rolling (v = ω × r, so ω = v / r)
        const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
        const spinStart = 0.05;
        const spinFull = 0.35;
        if (speed >= spinStart) {
          // Update angular axis perpendicular to velocity (rolling direction)
          const axisX = -ball.vy;
          const axisY = ball.vx;
          const axisLength = Math.sqrt(axisX * axisX + axisY * axisY);
          if (axisLength > 1e-6) {
            const invAxis = 1 / axisLength;
            ball.angularAxisX = axisX * invAxis;
            ball.angularAxisY = axisY * invAxis;
            ball.angularAxisZ = 0;
          }
          const blend = Math.min(1, (speed - spinStart) / Math.max(0.0001, spinFull - spinStart));
          const targetOmega = (speed / ball.radius) * blend;
          const smoothing = 0.2; // Damp abrupt changes when transitioning between speeds
          ball.angularVelocity += (targetOmega - ball.angularVelocity) * smoothing;
          const deltaAngle = ball.angularVelocity * subDt;
          applyIncrementalRotation(ball, ball.angularAxisX, ball.angularAxisY, ball.angularAxisZ, deltaAngle);
          ball.angle += deltaAngle;
        } else {
          // Ball nearly stopped - gently decay any residual spin using last known axis
          if (ball.angularVelocity > 0.01) {
            ball.angularVelocity *= 0.85;
            const deltaAngle = ball.angularVelocity * subDt;
            applyIncrementalRotation(ball, ball.angularAxisX, ball.angularAxisY, ball.angularAxisZ, deltaAngle);
            ball.angle += deltaAngle;
          } else {
            ball.angularVelocity = 0;
          }
        }
      });
      
      // Collision detection and resolution (multiple iterations)
      for (let iter = 0; iter < CONFIG.SOLVER_ITERATIONS; iter++) {
        const contacts: Contact[] = [];
        
        // Ball-ball collisions
        for (let i = 0; i < this.balls.length; i++) {
          for (let j = i + 1; j < this.balls.length; j++) {
            const contact = detectBallBall(this.balls[i], this.balls[j]);
            if (contact) {
              ballPairsThisStep.add(getCollisionPairId(contact.ballA, contact.ballB!));
              contacts.push(contact);
            }
          }
        }
        
        // Ball-rail collisions
        for (const ball of this.balls) {
          for (const rail of this.rails) {
            const contact = detectBallRail(ball, rail);
            if (contact) {
              railPairsThisStep.add(getBallRailPairId(contact.ballA, contact.rail!));
              contacts.push(contact);
            }
          }
        }
        
        // Resolve contacts
        contacts.forEach((contact) => {
          if (contact.ballB) {
            resolveBallBall(contact);
            // Only notify about new ball collisions (once per ball pair per timestep)
            const pairId = getCollisionPairId(contact.ballA, contact.ballB);
            const isNewContact = !this.activeBallPairs.has(pairId);
            if (this.onBallCollision && isNewContact && shouldNotifyBallCollision(contact.ballA, contact.ballB)) {
              this.onBallCollision(contact.ballA, contact.ballB);
            }
          } else if (contact.rail) {
            resolveBallRail(contact);
            // Only notify about new rail collisions (once per ball-rail pair per timestep)
            const pairId = getBallRailPairId(contact.ballA, contact.rail);
            const isNewContact = !this.activeRailPairs.has(pairId);
            if (this.onRailCollision && isNewContact && shouldNotifyRailCollision(contact.ballA, contact.rail)) {
              this.onRailCollision(contact.ballA, contact.rail);
            }
          }
        });
      }
      
      // Check pockets (only on last substep)
      if (substep === substeps - 1) {
        this.checkPockets();
      }
    }
    
    // Check sleeping
    this.checkSleeping();
    this.activeBallPairs = ballPairsThisStep;
    this.activeRailPairs = railPairsThisStep;
  }
  
  applyFriction(dt: number) {
    this.balls.forEach((ball) => {
      if (ball.pocketed || ball.sleeping) return;
      
      const speed = ball.getSpeed();
      if (speed < CONFIG.VELOCITY_EPSILON) {
        ball.vx = 0;
        ball.vy = 0;
        ball.sleeping = true;
        return;
      }
      
      // Rolling friction (velocity-proportional deceleration)
      const decel = CONFIG.ROLLING_FRICTION * speed;
      const factor = Math.max(0, 1 - (decel * dt) / speed);
      
      ball.vx *= factor;
      ball.vy *= factor;
    });
  }
  
  checkPockets() {
    this.balls.forEach((ball) => {
      if (ball.pocketed) return;
      // Skip cue ball pocketing while dragging for stable placement UX
      if (this.skipCuePocketCheck && ball.id === 0) return;

      for (const pocket of this.pockets) {
        if (pocket.contains(ball)) {
          let capturePos = { x: ball.x, y: ball.y };
          let impactVelocity = { x: ball.vx, y: ball.vy };
          const speed = ball.getSpeed();
          const speedThreshold = CONFIG.POCKET_CAPTURE_SPEED_THRESHOLD ?? Infinity;
          if (speed > speedThreshold) {
            const toCenterX = pocket.x - ball.x;
            const toCenterY = pocket.y - ball.y;
            const distToCenter = Math.sqrt(toCenterX * toCenterX + toCenterY * toCenterY) || 1;
            const dirX = toCenterX / distToCenter;
            const dirY = toCenterY / distToCenter;
            const pullDist = Math.min(CONFIG.POCKET_CAPTURE_PULL_DISTANCE ?? 0, distToCenter);
            if (pullDist > 0) {
              capturePos = {
                x: ball.x + dirX * pullDist,
                y: ball.y + dirY * pullDist,
              };
              ball.x = capturePos.x;
              ball.y = capturePos.y;
            }
            const damping = CONFIG.POCKET_CAPTURE_DAMPING ?? 0;
            const gravity = CONFIG.POCKET_CAPTURE_GRAVITY ?? 0;
            const dampedSpeed = speed * damping;
            impactVelocity = {
              x: dirX * (dampedSpeed + gravity * 0.016),
              y: dirY * (dampedSpeed + gravity * 0.016),
            };
          }
          ball.pocketed = true;
          ball.lastPocketId = pocket.id ?? null;
          ball.vx = 0;
          ball.vy = 0;
          if (this.onBallPocketed) {
            this.onBallPocketed({
              ball,
              pocket,
              position: capturePos,
              velocity: impactVelocity,
            });
          }
          if (this.recordingEnabled) {
            physicsRecorder.recordPocket(ball);
          }
          // Notify game logic (will be handled by Game class)
          break;
        }
      }
    });
  }
  
  checkSleeping() {
    this.balls.forEach((ball) => {
      if (ball.pocketed) return;
      
      const speed = ball.getSpeed();
      if (speed < CONFIG.VELOCITY_EPSILON) {
        ball.sleeping = true;
        ball.vx = 0;
        ball.vy = 0;
        ball.angularVelocity = 0; // Stop rotation when ball sleeps
      } else if (ball.sleeping && speed >= CONFIG.VELOCITY_EPSILON * 2) {
        // Wake up if moving fast enough
        ball.sleeping = false;
        // Angular velocity will be recalculated in next physics step based on new velocity
      }
    });
  }
  
  isAtRest(): boolean {
    return this.balls.every((ball) => ball.pocketed || ball.sleeping);
  }
  
  getActiveBalls(): Ball[] {
    return this.balls.filter((ball) => !ball.pocketed);
  }
 
  getBallById(id: number): Ball | null {
    return this.balls.find((ball) => ball.id === id) ?? null;
  }

  logShotSnapshot(angle: number, power: number) {
    const cue = this.getBallById(0);
    const snapshot = this.balls.map((ball) => ({
      id: ball.id,
      sleeping: ball.sleeping,
      pocketed: ball.pocketed,
      position: {
        x: Number(ball.x.toFixed(4)),
        y: Number(ball.y.toFixed(4)),
      },
      velocity: {
        vx: Number(ball.vx.toFixed(4)),
        vy: Number(ball.vy.toFixed(4)),
        speed: Number(ball.getSpeed().toFixed(4)),
      },
      rotation: {
        angle: Number(ball.angle.toFixed(4)),
        angularVelocity: Number(ball.angularVelocity.toFixed(4)),
        axis: [
          Number(ball.angularAxisX.toFixed(3)),
          Number(ball.angularAxisY.toFixed(3)),
          Number(ball.angularAxisZ.toFixed(3)),
        ],
        quaternion: [
          Number(ball.rotX.toFixed(4)),
          Number(ball.rotY.toFixed(4)),
          Number(ball.rotZ.toFixed(4)),
          Number(ball.rotW.toFixed(4)),
        ],
      },
    }));

    console.groupCollapsed(
      `🎯 Shot Debug | angle: ${angle.toFixed(3)} rad (${(angle * 180 / Math.PI).toFixed(1)}°), power: ${power.toFixed(2)}, cue speed: ${cue ? cue.getSpeed().toFixed(3) : 'n/a'}`
    );
    console.log('Shot snapshot', snapshot);
    console.groupEnd();
  }

  recordingEnabled: boolean = true;
  
  clone(options?: { enableRecording?: boolean }): PhysicsWorld {
    const copy = new PhysicsWorld();
    copy.recordingEnabled = options?.enableRecording ?? false;
    
    // Clone balls
    copy.balls = this.balls.map((ball) => ball.clone());
    
    // Clone rails
    copy.rails = this.rails.map((rail) => rail.clone());
    
    // Clone pockets
    copy.pockets = this.pockets.map((pocket) => pocket.clone());
    
    return copy;
  }
}
