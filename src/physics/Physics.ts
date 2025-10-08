// Physics world and simulation
// Coordinate system: Origin (0,0) at table center, +X=East, +Y=North (up)

import { Ball, Rail, Pocket } from './Shapes';
import { CONFIG } from '../config';
import { TABLE_GEOMETRY } from '../geometry/Geometry';
import { detectBallBall, detectBallRail, resolveBallBall, resolveBallRail, Contact } from './Collision';
import { physicsRecorder } from '../debug/PhysicsRecorder';

export class PhysicsWorld {
  balls: Ball[] = [];
  rails: Rail[] = [];
  pockets: Pocket[] = [];
  
  constructor() {
    this.initializeRails();
    this.initializePockets();
  }
  
  initializeRails() {
    const pocketGap = 4; // Gap for pockets (inches)
    
    // Create rail segments with gaps for pockets
    // N_rail (North/top): split at center pocket
    this.rails.push(new Rail(-50 + pocketGap, 25, -pocketGap, 25));  // NW corner to N middle
    this.rails.push(new Rail(pocketGap, 25, 50 - pocketGap, 25));     // N middle to NE corner
    
    // S_rail (South/bottom): split at center pocket  
    this.rails.push(new Rail(-50 + pocketGap, -25, -pocketGap, -25)); // SW corner to S middle
    this.rails.push(new Rail(pocketGap, -25, 50 - pocketGap, -25));   // S middle to SE corner
    
    // W_rail (West/left): solid rail between corners (no middle pocket)
    this.rails.push(new Rail(-50, -25 + pocketGap, -50, 25 - pocketGap));
    
    // E_rail (East/right): solid rail between corners (no middle pocket)
    this.rails.push(new Rail(50, -25 + pocketGap, 50, 25 - pocketGap));
    
    // Set normals to point inward (toward center)
    this.rails.forEach((rail) => {
      const midX = (rail.x1 + rail.x2) / 2;
      const midY = (rail.y1 + rail.y2) / 2;
      
      // Vector from midpoint to center (0,0)
      const toCenter = {
        x: -midX,
        y: -midY,
      };
      
      // If normal points away from center, flip it
      const dot = rail.nx * toCenter.x + rail.ny * toCenter.y;
      if (dot < 0) {
        rail.flipNormal();
      }
    });
  }
  
  initializePockets() {
    // Use authoritative geometry definitions
    TABLE_GEOMETRY.pockets.forEach((pocketDef) => {
      this.pockets.push(
        new Pocket(
          pocketDef.center.x,
          pocketDef.center.y,
          TABLE_GEOMETRY.pocketCaptureRadiusIn
        )
      );
    });
  }
  
  addBall(ball: Ball) {
    this.balls.push(ball);
  }
  
  step(dt: number) {
    // Save previous state for interpolation
    this.balls.forEach((ball) => ball.saveState());
    
    // Apply friction
    this.applyFriction(dt);
    
    // Integrate velocity
    this.balls.forEach((ball) => {
      if (ball.pocketed || ball.sleeping) return;
      
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
    });
    
    // Enforce table boundaries (safety net to prevent escapes)
    this.enforceBoundaries();
    
    // Collision detection and resolution (multiple iterations)
    for (let iter = 0; iter < CONFIG.SOLVER_ITERATIONS; iter++) {
      const contacts: Contact[] = [];
      
      // Ball-ball collisions
      for (let i = 0; i < this.balls.length; i++) {
        for (let j = i + 1; j < this.balls.length; j++) {
          const contact = detectBallBall(this.balls[i], this.balls[j]);
          if (contact) contacts.push(contact);
        }
      }
      
      // Ball-rail collisions
      for (const ball of this.balls) {
        for (const rail of this.rails) {
          const contact = detectBallRail(ball, rail);
          if (contact) contacts.push(contact);
        }
      }
      
      // Resolve contacts
      contacts.forEach((contact) => {
        if (contact.ballB) {
          resolveBallBall(contact);
        } else if (contact.rail) {
          resolveBallRail(contact);
        }
      });
    }
    
    // Check pockets
    this.checkPockets();
    
    // Check sleeping
    this.checkSleeping();
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
  
  enforceBoundaries() {
    // Hard boundary enforcement: prevent balls from escaping table
    const maxX = TABLE_GEOMETRY.playWidthIn / 2;
    const maxY = TABLE_GEOMETRY.playHeightIn / 2;
    const margin = CONFIG.BALL_RADIUS;
    
    this.balls.forEach((ball) => {
      if (ball.pocketed) return;
      
      // Clamp position to table bounds
      const minX = -maxX + margin;
      const maxXBound = maxX - margin;
      const minY = -maxY + margin;
      const maxYBound = maxY - margin;
      
      if (ball.x < minX) {
        ball.x = minX;
        ball.vx = Math.abs(ball.vx) * 0.5; // Bounce with energy loss
      } else if (ball.x > maxXBound) {
        ball.x = maxXBound;
        ball.vx = -Math.abs(ball.vx) * 0.5;
      }
      
      if (ball.y < minY) {
        ball.y = minY;
        ball.vy = Math.abs(ball.vy) * 0.5;
      } else if (ball.y > maxYBound) {
        ball.y = maxYBound;
        ball.vy = -Math.abs(ball.vy) * 0.5;
      }
    });
  }
  
  checkPockets() {
    this.balls.forEach((ball) => {
      if (ball.pocketed) return;
      
      for (const pocket of this.pockets) {
        if (pocket.contains(ball)) {
          ball.pocketed = true;
          ball.vx = 0;
          ball.vy = 0;
          physicsRecorder.recordPocket(ball);
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
      } else if (ball.sleeping && speed >= CONFIG.VELOCITY_EPSILON * 2) {
        // Wake up if moving fast enough
        ball.sleeping = false;
      }
    });
  }
  
  isAtRest(): boolean {
    return this.balls.every((ball) => ball.pocketed || ball.sleeping);
  }
  
  getActiveBalls(): Ball[] {
    return this.balls.filter((ball) => !ball.pocketed);
  }
}
