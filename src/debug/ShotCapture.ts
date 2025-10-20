// Shot capture system for diagnosing aim assist accuracy
// Records prediction vs actual results

import { Ball } from '../physics/Shapes';
import { PredictionResult } from '../physics/Prediction';
import { CONFIG } from '../config';
import { getTableGeometry } from '../geometry/Geometry';

interface ShotData {
  // Pre-shot data
  cueBallStart: { x: number; y: number };
  targetBallStart: { x: number; y: number };
  aimAngle: number;
  shotPower: number;
  shotVelocity: { x: number; y: number };
  
  // Prediction data
  prediction: {
    type: 'ball' | 'rail' | 'none';
    contactPoint: { x: number; y: number };
    predictedObjectDir: { x: number; y: number };
    predictedCueDir: { x: number; y: number } | null;
    predictedNormal?: { x: number; y: number };
  };
  
  // Actual collision data
  actualCollision?: {
    contactPoint: { x: number; y: number };
    collisionNormal: { x: number; y: number };
    overlap: number;
    cueBallVelBefore: { x: number; y: number };
    targetBallVelBefore: { x: number; y: number };
    cueBallVelAfter: { x: number; y: number };
    targetBallVelAfter: { x: number; y: number };
  };
  
  // Final positions
  cueBallEnd?: { x: number; y: number };
  targetBallEnd?: { x: number; y: number };
  
  // Timing
  shotTime: number;
  collisionTime?: number;
  restTime?: number;
}

class ShotCaptureSystem {
  private capturing: boolean = false;
  private shotData: ShotData | null = null;
  private targetBallId: number | null = null;
  private expectingRailHit: boolean = false;
  
  startCapture() {
    this.capturing = true;
    this.shotData = null;
    this.targetBallId = null;
    console.log('🎯 Shot capture started - take your shot!');
  }
  
  isCapturing(): boolean {
    return this.capturing;
  }
  
  recordShotStart(
    cueBall: Ball,
    angle: number,
    power: number,
    prediction: PredictionResult
  ) {
    if (!this.capturing) return;
    
    const velocity = {
      x: Math.cos(angle) * power * CONFIG.CUE_POWER_MULTIPLIER,
      y: Math.sin(angle) * power * CONFIG.CUE_POWER_MULTIPLIER,
    };
    
    // Extract prediction data
    let predictedObjectDir = { x: 0, y: 0 };
    let predictedCueDir = null;
    let targetBallStart = { x: 0, y: 0 };
    let predictedNormal = { x: 0, y: 0 };
    
    if (prediction.type === 'ball' && prediction.hitBall) {
      this.targetBallId = prediction.hitBall.id;
      this.expectingRailHit = false;
      targetBallStart = { x: prediction.hitBall.x, y: prediction.hitBall.y };
      
      // Use the collision normal directly from prediction (already correctly calculated)
      const nx = prediction.contactNormal.x;
      const ny = prediction.contactNormal.y;
      
      predictedNormal = {
        x: nx,
        y: ny,
      };
      
      // Calculate predicted ball velocities using impulse physics (matches actual collision)
      
      // Estimate cue ball speed at the instant of contact (accounts for rolling friction before impact)
      // For dv/dt = -k*v, distance d = (v0 - v_hit)/k => v_hit = v0 - k*d
      const v0 = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
      const d = prediction.distance;
      const k = CONFIG.ROLLING_FRICTION;
      const v_hit = Math.max(0, v0 - k * d);
      const dirX = v0 > 1e-6 ? velocity.x / v0 : Math.cos(angle);
      const dirY = v0 > 1e-6 ? velocity.y / v0 : Math.sin(angle);
      const cueBallVx = dirX * v_hit;
      const cueBallVy = dirY * v_hit;
      
      // Assume equal mass and object ball at rest
      const invMass = 1.0;
      const totalInvMass = 2.0;
      
      // Relative velocity
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
      const maxFriction = Math.abs(j) * CONFIG.BALL_BALL_FRICTION;
      const jtClamped = Math.max(-maxFriction, Math.min(maxFriction, jt));
      
      // Apply friction impulse to BOTH balls
      const jtx = jtClamped * tx;
      const jty = jtClamped * ty;
      
      const cueBallVxAfter = cueBallVxAfterNormal - jtx * invMass;
      const cueBallVyAfter = cueBallVyAfterNormal - jty * invMass;
      const objBallVxAfter = objBallVxAfterNormal + jtx * invMass;
      const objBallVyAfter = objBallVyAfterNormal + jty * invMass;
      
      // Calculate predicted directions from post-collision velocities
      const objBallSpeed = Math.sqrt(objBallVxAfter * objBallVxAfter + objBallVyAfter * objBallVyAfter);
      if (objBallSpeed > 0.01) {
        predictedObjectDir = {
          x: objBallVxAfter / objBallSpeed,
          y: objBallVyAfter / objBallSpeed,
        };
      } else {
        // Fallback to normal if object ball has no velocity
        predictedObjectDir = { x: nx, y: ny };
      }

      // If the predicted target ball is hugging a rail, clamp its direction
      // to not point into the rail (simultaneous ball-rail resolution effect).
      try {
        const GEOM = getTableGeometry();
        const ballPos = targetBallStart; // position at shot start (adequate for proximity test)
        let nearest: { n: { x: number; y: number }; dist: number } | null = null;
        for (const rail of GEOM.rails) {
          const rx = rail.to.x - rail.from.x;
          const ry = rail.to.y - rail.from.y;
          const rLenSq = rx * rx + ry * ry;
          if (rLenSq < 1e-8) continue;
          const px = ballPos.x - rail.from.x;
          const py = ballPos.y - rail.from.y;
          let t = (px * rx + py * ry) / rLenSq;
          t = Math.max(0, Math.min(1, t));
          const cx = rail.from.x + t * rx;
          const cy = rail.from.y + t * ry;
          const dx = ballPos.x - cx;
          const dy = ballPos.y - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (!nearest || dist < nearest.dist) {
            nearest = { n: { x: rail.normal.x, y: rail.normal.y }, dist };
          }
        }
        if (nearest) {
          const threshold = CONFIG.BALL_RADIUS + 0.02; // tighter tolerance (in)
          const dot = predictedObjectDir.x * nearest.n.x + predictedObjectDir.y * nearest.n.y;
          if (nearest.dist <= threshold && dot < -0.05) {
              // Remove inward component; slide along the tangent
              const vx = predictedObjectDir.x - dot * nearest.n.x;
              const vy = predictedObjectDir.y - dot * nearest.n.y;
              const vlen = Math.hypot(vx, vy);
              if (vlen > 1e-6) {
                predictedObjectDir = { x: vx / vlen, y: vy / vlen };
              } else {
                // Fallback to tangent direction if projection vanished
                predictedObjectDir = { x: -nearest.n.y, y: nearest.n.x };
              }
          }
        }
      } catch {}
      
      const cueBallSpeed = Math.sqrt(cueBallVxAfter * cueBallVxAfter + cueBallVyAfter * cueBallVyAfter);
      if (cueBallSpeed > 0.01) {
        predictedCueDir = {
          x: cueBallVxAfter / cueBallSpeed,
          y: cueBallVyAfter / cueBallSpeed,
        };
      }

      // If cue ball will immediately contact a nearby rail after the collision,
      // apply the same rail resolution model as the solver (restitution + sliding friction)
      try {
        if (predictedCueDir) {
          const GEOM = getTableGeometry();
          const cueCenterAtContact = {
            x: prediction.contactPoint.x + nx * CONFIG.BALL_RADIUS,
            y: prediction.contactPoint.y + ny * CONFIG.BALL_RADIUS,
          };
          let best: { rail: any; dist: number } | null = null;
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
            if (!best || dist < best.dist) {
              best = { rail, dist };
            }
          }
          if (best) {
            const threshold = CONFIG.BALL_RADIUS + 0.02; // small tolerance
            if (best.dist <= threshold) {
              // Use post-ball-collision cue velocity (before rail)
              let vx = cueBallVxAfter;
              let vy = cueBallVyAfter;

              // Rail normal
              const n = { x: best.rail.normal.x, y: best.rail.normal.y };
              const vn = vx * n.x + vy * n.y;

              // If approaching the rail, resolve like resolveBallRail()
              if (vn > 0) {
                // Normal impulse (restitution)
                const eRail = CONFIG.CUSHION_RESTITUTION;
                const jn = -(1 + eRail) * vn;
                vx += jn * n.x;
                vy += jn * n.y;

                // Tangential friction along rail
                const tx = -n.y;
                const ty = n.x;
                const vt = vx * tx + vy * ty;
                const jt = -vt * CONFIG.SLIDING_FRICTION;
                vx += jt * tx;
                vy += jt * ty;

                const sp = Math.hypot(vx, vy);
                if (sp > 1e-6) {
                  predictedCueDir = { x: vx / sp, y: vy / sp };
                }
              }
            }
          }
        }
      } catch {}
    } else if (prediction.type === 'rail') {
      // Rail hit prediction
      this.expectingRailHit = true;
      predictedNormal = {
        x: prediction.contactNormal.x,
        y: prediction.contactNormal.y,
      };
    }
    
    this.shotData = {
      cueBallStart: { x: cueBall.x, y: cueBall.y },
      targetBallStart,
      aimAngle: angle,
      shotPower: power,
      shotVelocity: velocity,
      prediction: {
        type: prediction.type,
        contactPoint: { ...prediction.contactPoint },
        predictedObjectDir,
        predictedCueDir,
        predictedNormal,
      },
      shotTime: performance.now(),
    };
    
    console.log('📸 Shot recorded - waiting for collision...');
  }
  
  recordCollision(
    cueBall: Ball,
    targetBall: Ball,
    normal: { x: number; y: number },
    overlap: number
  ) {
    if (!this.capturing || !this.shotData) return;
    
    // Only record the FIRST collision
    if (this.shotData.actualCollision) return;
    
    // CRITICAL: Only record collisions involving the actual cue ball (ID 0)
    if (cueBall.id !== 0) {
      return; // This is a secondary collision between other balls
    }
    
    // If we predicted a specific target, only record collision with that ball
    // (but always record if no specific ball was predicted, e.g., rail shots)
    if (this.targetBallId !== null && targetBall.id !== this.targetBallId) {
      console.warn(`⚠️ Cue ball hit ball ${targetBall.id} instead of predicted ball ${this.targetBallId}`);
      // Still record it for analysis (don't return)
      console.log(`📸 Recording unexpected collision for comparison`);
    }
    
    // Calculate contact point (midpoint between ball centers)
    const contactPoint = {
      x: (cueBall.x + targetBall.x) / 2,
      y: (cueBall.y + targetBall.y) / 2,
    };
    
    // Only record collisions with stationary or slow-moving balls
    // This ensures we capture the FIRST contact, not secondary collisions
    const targetSpeed = Math.sqrt(targetBall.vx * targetBall.vx + targetBall.vy * targetBall.vy);
    if (targetSpeed > 5.0) {
      console.warn(`⚠️ Skipping secondary collision - target ball moving at ${targetSpeed.toFixed(1)} in/s`);
      return;
    }
    
    this.shotData.actualCollision = {
      contactPoint,
      collisionNormal: { ...normal },
      overlap,
      cueBallVelBefore: { x: cueBall.vx, y: cueBall.vy },
      targetBallVelBefore: { x: targetBall.vx, y: targetBall.vy },
      cueBallVelAfter: { x: 0, y: 0 }, // Will be updated after resolution
      targetBallVelAfter: { x: 0, y: 0 },
    };
    
    this.shotData.collisionTime = performance.now();
    console.log(`💥 Collision recorded with ball ${targetBall.id} - waiting for balls to rest...`);
  }
  
  recordCollisionAfter(cueBall: Ball, targetBall: Ball) {
    if (!this.capturing || !this.shotData || !this.shotData.actualCollision) return;
    
    // Only update if velocities have increased (to capture the peak, not a later iteration)
    const newCueSpeed = Math.sqrt(cueBall.vx * cueBall.vx + cueBall.vy * cueBall.vy);
    const oldCueSpeed = Math.sqrt(
      this.shotData.actualCollision.cueBallVelAfter.x ** 2 +
      this.shotData.actualCollision.cueBallVelAfter.y ** 2
    );
    
    if (newCueSpeed > oldCueSpeed || oldCueSpeed === 0) {
      this.shotData.actualCollision.cueBallVelAfter = { x: cueBall.vx, y: cueBall.vy };
      this.shotData.actualCollision.targetBallVelAfter = { x: targetBall.vx, y: targetBall.vy };
    }
  }
  
  recordRailCollision(
    contactPoint: { x: number; y: number },
    normal: { x: number; y: number },
    velBefore: { x: number; y: number },
    velAfter: { x: number; y: number }
  ) {
    if (!this.capturing || !this.shotData) return;
    if (!this.expectingRailHit) return; // Only record if we predicted a rail hit
    
    // Only record the FIRST rail collision
    if (this.shotData.actualCollision) return;
    
    this.shotData.actualCollision = {
      contactPoint,
      collisionNormal: { ...normal },
      overlap: 0, // Rails don't have overlap
      cueBallVelBefore: { ...velBefore },
      targetBallVelBefore: { x: 0, y: 0 }, // No target ball for rails
      cueBallVelAfter: { ...velAfter },
      targetBallVelAfter: { x: 0, y: 0 },
    };
    
    this.shotData.collisionTime = performance.now();
    console.log(`💥 Rail collision recorded - waiting for ball to rest...`);
  }
  
  checkForRest(cueBall: Ball, targetBall: Ball | null) {
    if (!this.capturing || !this.shotData) return;
    
    // Check if balls are at rest
    const cueBallSpeed = Math.sqrt(cueBall.vx * cueBall.vx + cueBall.vy * cueBall.vy);
    const targetBallSpeed = targetBall 
      ? Math.sqrt(targetBall.vx * targetBall.vx + targetBall.vy * targetBall.vy)
      : 0;
    
    // For rail shots, only check cue ball
    const checkSpeed = this.expectingRailHit ? cueBallSpeed : Math.max(cueBallSpeed, targetBallSpeed);
    
    if (checkSpeed < 0.5) {
      this.shotData.cueBallEnd = { x: cueBall.x, y: cueBall.y };
      if (targetBall) {
        this.shotData.targetBallEnd = { x: targetBall.x, y: targetBall.y };
      }
      this.shotData.restTime = performance.now();
      
      this.generateReport();
      this.capturing = false;
    }
  }
  
  generateReport() {
    if (!this.shotData) return;
    
    const data = this.shotData;
    const pred = data.prediction;
    const actual = data.actualCollision;
    
    let report = '\n' + '='.repeat(80) + '\n';
    report += '🎯 SHOT CAPTURE REPORT\n';
    report += '='.repeat(80) + '\n\n';
    
    // Shot info
    report += '📊 SHOT PARAMETERS\n';
    report += `  Angle: ${(data.aimAngle * 180 / Math.PI).toFixed(1)}°\n`;
    report += `  Power: ${data.shotPower.toFixed(1)}\n`;
    report += `  Velocity: (${data.shotVelocity.x.toFixed(1)}, ${data.shotVelocity.y.toFixed(1)}) in/s\n`;
    report += `  Cue ball start: (${data.cueBallStart.x.toFixed(2)}, ${data.cueBallStart.y.toFixed(2)})\n`;
    report += `  Target ball start: (${data.targetBallStart.x.toFixed(2)}, ${data.targetBallStart.y.toFixed(2)})\n\n`;
    
    // Prediction
    report += '🔮 PREDICTION\n';
    report += `  Type: ${pred.type}\n`;
    report += `  Contact point: (${pred.contactPoint.x.toFixed(2)}, ${pred.contactPoint.y.toFixed(2)})\n`;
    if (pred.type === 'ball') {
      report += `  Object ball direction: (${pred.predictedObjectDir.x.toFixed(3)}, ${pred.predictedObjectDir.y.toFixed(3)})\n`;
      if (pred.predictedCueDir) {
        report += `  Cue ball direction: (${pred.predictedCueDir.x.toFixed(3)}, ${pred.predictedCueDir.y.toFixed(3)})\n`;
      }
    } else if (pred.type === 'rail' && pred.predictedNormal) {
      report += `  Rail normal: (${pred.predictedNormal.x.toFixed(3)}, ${pred.predictedNormal.y.toFixed(3)})\n`;
    }
    report += '\n';
    
    // Actual collision
    if (actual) {
      report += '💥 ACTUAL COLLISION\n';
      report += `  Contact point: (${actual.contactPoint.x.toFixed(2)}, ${actual.contactPoint.y.toFixed(2)})\n`;
      report += `  Collision normal: (${actual.collisionNormal.x.toFixed(3)}, ${actual.collisionNormal.y.toFixed(3)})\n`;
      report += `  Overlap: ${actual.overlap.toFixed(3)}"\n`;
      report += `  Cue ball vel after: (${actual.cueBallVelAfter.x.toFixed(1)}, ${actual.cueBallVelAfter.y.toFixed(1)})\n`;
      report += `  Target ball vel after: (${actual.targetBallVelAfter.x.toFixed(1)}, ${actual.targetBallVelAfter.y.toFixed(1)})\n`;
      
      // Calculate actual directions
      const actualObjDir = {
        x: actual.targetBallVelAfter.x,
        y: actual.targetBallVelAfter.y,
      };
      const actualObjLen = Math.sqrt(actualObjDir.x * actualObjDir.x + actualObjDir.y * actualObjDir.y);
      if (actualObjLen > 0.1) {
        actualObjDir.x /= actualObjLen;
        actualObjDir.y /= actualObjLen;
        report += `  Object ball actual direction: (${actualObjDir.x.toFixed(3)}, ${actualObjDir.y.toFixed(3)})\n`;
      }
      
      const actualCueDir = {
        x: actual.cueBallVelAfter.x,
        y: actual.cueBallVelAfter.y,
      };
      const actualCueLen = Math.sqrt(actualCueDir.x * actualCueDir.x + actualCueDir.y * actualCueDir.y);
      if (actualCueLen > 0.1) {
        actualCueDir.x /= actualCueLen;
        actualCueDir.y /= actualCueLen;
        report += `  Cue ball actual direction: (${actualCueDir.x.toFixed(3)}, ${actualCueDir.y.toFixed(3)})\n`;
      }
      report += '\n';
      
      // Error analysis
      report += '📐 ERROR ANALYSIS\n';
      const contactError = Math.sqrt(
        Math.pow(actual.contactPoint.x - pred.contactPoint.x, 2) +
        Math.pow(actual.contactPoint.y - pred.contactPoint.y, 2)
      );
      report += `  Contact point error: ${contactError.toFixed(3)}"\n`;
      
      if (pred.type === 'ball' && actualObjLen > 0.1) {
        // Ball collision error analysis
        const objDot = pred.predictedObjectDir.x * actualObjDir.x + pred.predictedObjectDir.y * actualObjDir.y;
        const objAngleError = Math.acos(Math.max(-1, Math.min(1, objDot))) * 180 / Math.PI;
        report += `  Object ball angle error: ${objAngleError.toFixed(1)}°\n`;
        
        // Sanity check: collision normal should match actual object ball direction
        const normalDot = actual.collisionNormal.x * actualObjDir.x + actual.collisionNormal.y * actualObjDir.y;
        const normalAngleError = Math.acos(Math.max(-1, Math.min(1, normalDot))) * 180 / Math.PI;
        report += `  Normal vs actual object angle: ${normalAngleError.toFixed(1)}° (should be ~0° for correct physics)\n`;
      } else if (pred.type === 'rail' && pred.predictedNormal) {
        // Rail collision error analysis
        const normalDot = pred.predictedNormal.x * actual.collisionNormal.x + pred.predictedNormal.y * actual.collisionNormal.y;
        const normalAngleError = Math.acos(Math.max(-1, Math.min(1, normalDot))) * 180 / Math.PI;
        report += `  Rail normal error: ${normalAngleError.toFixed(1)}°\n`;
      }
      
      if (pred.predictedCueDir && actualCueLen > 0.1) {
        const cueDot = pred.predictedCueDir.x * actualCueDir.x + pred.predictedCueDir.y * actualCueDir.y;
        const cueAngleError = Math.acos(Math.max(-1, Math.min(1, cueDot))) * 180 / Math.PI;
        report += `  Cue ball angle error: ${cueAngleError.toFixed(1)}°\n`;
      }
      report += '\n';
    }
    
    // Final positions
    if (data.cueBallEnd && data.targetBallEnd) {
      report += '🏁 FINAL POSITIONS\n';
      report += `  Cue ball: (${data.cueBallEnd.x.toFixed(2)}, ${data.cueBallEnd.y.toFixed(2)})\n`;
      report += `  Target ball: (${data.targetBallEnd.x.toFixed(2)}, ${data.targetBallEnd.y.toFixed(2)})\n\n`;
    }
    
    // Timing
    if (data.collisionTime && data.restTime) {
      const timeToCollision = (data.collisionTime - data.shotTime) / 1000;
      const timeToRest = (data.restTime - data.shotTime) / 1000;
      report += '⏱️  TIMING\n';
      report += `  Time to collision: ${timeToCollision.toFixed(3)}s\n`;
      report += `  Time to rest: ${timeToRest.toFixed(3)}s\n\n`;
    }
    
    report += '='.repeat(80) + '\n';
    
    console.log(report);
    
    // Try to copy to clipboard
    if (navigator.clipboard && document.hasFocus()) {
      navigator.clipboard.writeText(report).then(() => {
        console.log('✅ Report copied to clipboard!');
      }).catch(() => {
        console.log('ℹ️  Select and copy the report above');
      });
    }
  }
  
  cancelCapture() {
    this.capturing = false;
    this.shotData = null;
    console.log('❌ Shot capture cancelled');
  }
}

export const shotCapture = new ShotCaptureSystem();

// Global helpers
(window as any).captureShot = () => shotCapture.startCapture();
(window as any).cancelCapture = () => shotCapture.cancelCapture();
