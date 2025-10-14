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
  recordingEnabled: boolean;
  
  constructor(options: { initializeGeometry?: boolean; enableRecording?: boolean } = {}) {
    const { initializeGeometry = true, enableRecording = true } = options;
    this.recordingEnabled = enableRecording;

    if (initializeGeometry) {
      this.initializeRails();
      this.initializePockets();
    }
  }
  
  initializeRails() {
    // Create ONLY the playing surface edge for each cushion (not all 4 edges)
    TABLE_GEOMETRY.rails.forEach((cushionDef) => {
      const points = cushionDef.points;
      const [idx1, idx2] = cushionDef.playingSurfaceEdge;

      const p1 = points[idx1];
      const p2 = points[idx2];

      const rail = new Rail(p1.x, p1.y, p2.x, p2.y, cushionDef.id);

      // Ensure normals point inward (toward center of table)
      const midX = (rail.x1 + rail.x2) / 2;
      const midY = (rail.y1 + rail.y2) / 2;
      const toCenter = { x: -midX, y: -midY };
      const dot = rail.nx * toCenter.x + rail.ny * toCenter.y;

      if (dot < 0) {
        rail.flipNormal();
      }

      this.rails.push(rail);
    });

    if (this.recordingEnabled) {
      console.log(`🎱 Initialized ${this.rails.length} rail collision edges`);
      this.rails.forEach((rail, i) => {
        console.log(`  Rail ${i} (${rail.cushionId}): (${rail.x1.toFixed(1)}, ${rail.y1.toFixed(1)}) → (${rail.x2.toFixed(1)}, ${rail.y2.toFixed(1)}), normal: (${rail.nx.toFixed(2)}, ${rail.ny.toFixed(2)})`);
      });
    }
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

  getBallById(id: number): Ball | undefined {
    return this.balls.find((ball) => ball.id === id);
  }

  clone(options: { enableRecording?: boolean } = {}): PhysicsWorld {
    const clone = new PhysicsWorld({ initializeGeometry: false, enableRecording: options.enableRecording ?? false });
    clone.rails = this.rails.map((rail) => rail.clone());
    clone.pockets = this.pockets.map((pocket) => pocket.clone());
    clone.balls = this.balls.map((ball) => ball.clone());
    return clone;
  }
  
  step(dt: number) {
    // Adaptive substepping for high-speed collisions
    // Calculate max ball speed to determine substeps needed
    let maxSpeed = 0;
    for (const ball of this.balls) {
      if (!ball.pocketed && !ball.sleeping) {
        const speed = ball.getSpeed();
        if (speed > maxSpeed) maxSpeed = speed;
      }
    }
    
    // Calculate substeps: keep travel distance per substep < ball radius (1.125")
    // This prevents balls from tunneling through each other
    const maxTravelPerSubstep = CONFIG.BALL_RADIUS; // 1.125"
    const maxTravelThisStep = maxSpeed * dt;
    const substeps = Math.max(1, Math.ceil(maxTravelThisStep / maxTravelPerSubstep));
    const subDt = dt / substeps;
    
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
        // Multiplier reduces visual rotation speed for better appearance
        const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
        if (speed > 0.01) {
          ball.angularVelocity = (speed / ball.radius) * CONFIG.BALL_ROTATION_MULTIPLIER;
          ball.angle += ball.angularVelocity * subDt;
        } else {
          ball.angularVelocity = 0;
        }
      });
      
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
      
      // Check pockets (only on last substep)
      if (substep === substeps - 1) {
        this.checkPockets();
      }
    }
    
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
  
  checkPockets() {
    this.balls.forEach((ball) => {
      if (ball.pocketed) return;
      
      for (const pocket of this.pockets) {
        if (pocket.contains(ball)) {
          ball.pocketed = true;
          ball.vx = 0;
          ball.vy = 0;
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
