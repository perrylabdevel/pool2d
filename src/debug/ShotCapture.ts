// Shot capture system for diagnosing aim assist accuracy
// Records prediction vs actual results

import { Ball } from '../physics/Shapes';
import { PredictionResult } from '../physics/Prediction';

interface ShotData {
  // Pre-shot data
  cueBallStart: { x: number; y: number };
  targetBallStart: { x: number; y: number };
  aimAngle: number;
  shotPower: number;
  shotVelocity: { x: number; y: number };
  
  // Prediction data
  prediction: {
    contactPoint: { x: number; y: number };
    predictedObjectDir: { x: number; y: number };
    predictedCueDir: { x: number; y: number } | null;
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
      x: Math.cos(angle) * power * 10, // Apply multiplier
      y: Math.sin(angle) * power * 10,
    };
    
    // Extract prediction data
    let predictedObjectDir = { x: 0, y: 0 };
    let predictedCueDir = null;
    let targetBallStart = { x: 0, y: 0 };
    
    if (prediction.type === 'ball' && prediction.hitBall) {
      this.targetBallId = prediction.hitBall.id;
      targetBallStart = { x: prediction.hitBall.x, y: prediction.hitBall.y };
      
      // Calculate predicted directions
      const objDirX = prediction.hitBall.x - prediction.contactPoint.x;
      const objDirY = prediction.hitBall.y - prediction.contactPoint.y;
      const objLen = Math.sqrt(objDirX * objDirX + objDirY * objDirY);
      predictedObjectDir = {
        x: objDirX / objLen,
        y: objDirY / objLen,
      };
      
      // Calculate predicted cue ball deflection
      const shotDir = { x: Math.cos(angle), y: Math.sin(angle) };
      const dot = shotDir.x * predictedObjectDir.x + shotDir.y * predictedObjectDir.y;
      const perpX = shotDir.x - dot * predictedObjectDir.x;
      const perpY = shotDir.y - dot * predictedObjectDir.y;
      const perpLen = Math.sqrt(perpX * perpX + perpY * perpY);
      
      if (perpLen > 0.01) {
        predictedCueDir = {
          x: perpX / perpLen,
          y: perpY / perpLen,
        };
      }
    }
    
    this.shotData = {
      cueBallStart: { x: cueBall.x, y: cueBall.y },
      targetBallStart,
      aimAngle: angle,
      shotPower: power,
      shotVelocity: velocity,
      prediction: {
        contactPoint: { ...prediction.contactPoint },
        predictedObjectDir,
        predictedCueDir,
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
    if (this.targetBallId !== null && targetBall.id !== this.targetBallId) {
      console.warn(`⚠️ Cue ball hit ball ${targetBall.id} instead of predicted ball ${this.targetBallId}`);
      return;
    }
    
    // Calculate contact point (midpoint between ball centers)
    const contactPoint = {
      x: (cueBall.x + targetBall.x) / 2,
      y: (cueBall.y + targetBall.y) / 2,
    };
    
    // Debug: log velocities BEFORE collision resolution
    console.log(`📊 Pre-collision velocities (cue=${cueBall.id}, target=${targetBall.id}):`);
    console.log(`  Cue ball: (${cueBall.vx.toFixed(1)}, ${cueBall.vy.toFixed(1)})`);
    console.log(`  Target ball: (${targetBall.vx.toFixed(1)}, ${targetBall.vy.toFixed(1)})`);
    
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
    
    this.shotData.actualCollision.cueBallVelAfter = { x: cueBall.vx, y: cueBall.vy };
    this.shotData.actualCollision.targetBallVelAfter = { x: targetBall.vx, y: targetBall.vy };
    
    // Debug: log velocities AFTER collision resolution
    console.log(`📊 Post-collision velocities:`);
    console.log(`  Cue ball: (${cueBall.vx.toFixed(1)}, ${cueBall.vy.toFixed(1)})`);
    console.log(`  Target ball: (${targetBall.vx.toFixed(1)}, ${targetBall.vy.toFixed(1)})`);
  }
  
  checkForRest(cueBall: Ball, targetBall: Ball | null) {
    if (!this.capturing || !this.shotData) return;
    
    // Check if balls are at rest
    const cueBallSpeed = Math.sqrt(cueBall.vx * cueBall.vx + cueBall.vy * cueBall.vy);
    const targetBallSpeed = targetBall 
      ? Math.sqrt(targetBall.vx * targetBall.vx + targetBall.vy * targetBall.vy)
      : 0;
    
    if (cueBallSpeed < 0.5 && targetBallSpeed < 0.5) {
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
    report += `  Contact point: (${pred.contactPoint.x.toFixed(2)}, ${pred.contactPoint.y.toFixed(2)})\n`;
    report += `  Object ball direction: (${pred.predictedObjectDir.x.toFixed(3)}, ${pred.predictedObjectDir.y.toFixed(3)})\n`;
    if (pred.predictedCueDir) {
      report += `  Cue ball direction: (${pred.predictedCueDir.x.toFixed(3)}, ${pred.predictedCueDir.y.toFixed(3)})\n`;
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
      
      if (actualObjLen > 0.1) {
        const objDot = pred.predictedObjectDir.x * actualObjDir.x + pred.predictedObjectDir.y * actualObjDir.y;
        const objAngleError = Math.acos(Math.max(-1, Math.min(1, objDot))) * 180 / Math.PI;
        report += `  Object ball angle error: ${objAngleError.toFixed(1)}°\n`;
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
