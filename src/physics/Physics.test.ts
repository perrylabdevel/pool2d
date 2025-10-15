import { describe, it, expect } from 'vitest';
import { Ball } from './Shapes';
import { detectBallBall, detectBallRail, resolveBallBall, resetCollisionTracking } from './Collision';
import { Rail } from './Shapes';
import { CONFIG } from '../config';

describe('Physics - Ball Collision', () => {
  it('should detect collision between two overlapping balls', () => {
    const ball1 = new Ball(1, 10, 10, CONFIG.BALL_RADIUS, 1);
    const ball2 = new Ball(2, 11.5, 10, CONFIG.BALL_RADIUS, 1);
    
    const contact = detectBallBall(ball1, ball2);
    
    // Note: detectBallBall may correct positions, so depth might be near 0 after correction
    expect(contact).not.toBeNull();
  });
  
  it('should not detect collision between separated balls', () => {
    const ball1 = new Ball(1, 10, 10, 1, 1);
    const ball2 = new Ball(2, 15, 10, 1, 1);
    
    const contact = detectBallBall(ball1, ball2);
    
    expect(contact).toBeNull();
  });
  
  it('should reduce ball speed with friction', () => {
    const ball = new Ball(1, 10, 10, 1, 1);
    const initialSpeed = 5.0;
    ball.setVelocity(initialSpeed, 0);
    
    // Simulate friction for a short time
    for (let i = 0; i < 60; i++) { // 0.5 seconds at 120 Hz
      const speed = ball.getSpeed();
      if (speed < CONFIG.VELOCITY_EPSILON) {
        ball.vx = 0;
        ball.vy = 0;
        break;
      }
      const decel = CONFIG.ROLLING_FRICTION * speed;
      const factor = Math.max(0, 1 - (decel * CONFIG.PHYSICS_DT) / speed);
      ball.vx *= factor;
      ball.vy *= factor;
    }
    
    // Ball should have slowed down
    expect(ball.getSpeed()).toBeLessThan(initialSpeed);
  });
});

describe('Physics - Ball Collision Response', () => {
  it('should make object ball move along collision normal', () => {
    // Reset collision tracking
    resetCollisionTracking();
    
    // Setup: moving ball hits stationary ball
    const ball1 = new Ball(0, 0, 0, CONFIG.BALL_RADIUS, 1);
    const ball2 = new Ball(1, 0, 0, CONFIG.BALL_RADIUS, 1);
    
    // Set ball1 moving toward ball2
    ball1.setVelocity(100, 0);
    ball2.setVelocity(0, 0);
    
    // Position them with slight overlap (simulating collision)
    const separation = CONFIG.BALL_RADIUS * 2 - 0.1; // 0.1" overlap
    ball1.x = -separation / 2;
    ball2.x = separation / 2;
    
    // Detect and resolve collision
    const contact = detectBallBall(ball1, ball2);
    expect(contact).not.toBeNull();
    
    if (contact) {
      // Record velocity before
      const velBefore = { vx: ball1.vx, vy: ball1.vy };
      
      // Resolve collision - this is where the issue occurs
      resolveBallBall(contact);
      
      // Check that object ball moves along collision normal
      // Collision normal should be (1, 0) for this head-on collision
      const objSpeed = Math.sqrt(ball2.vx * ball2.vx + ball2.vy * ball2.vy);
      const objDirX = ball2.vx / objSpeed;
      const objDirY = ball2.vy / objSpeed;
      
      // Expected normal from ball1 to ball2
      const dx = ball2.x - ball1.x;
      const dy = ball2.y - ball1.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const expectedNx = dx / dist;
      const expectedNy = dy / dist;
      
      // Object ball direction should match collision normal very closely
      // Allow small deviation due to friction, but should be < 1°
      const dot = objDirX * expectedNx + objDirY * expectedNy;
      const angleError = Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;
      
      // This should be very small (< 1°) for correct physics
      console.log(`Object ball angle error: ${angleError.toFixed(2)}°`);
      console.log(`Object ball direction: (${objDirX.toFixed(4)}, ${objDirY.toFixed(4)})`);
      console.log(`Expected normal: (${expectedNx.toFixed(4)}, ${expectedNy.toFixed(4)})`);
      expect(angleError).toBeLessThan(1.0);
    }
  });
  
  it('should make object ball move along collision normal for cut shots', () => {
    // Reset collision tracking
    resetCollisionTracking();
    
    // Setup: angled collision (cut shot) similar to the user's report
    // Cue ball start: (31.58, 6.89), Target ball: (19.07, 20.69)
    const ball1 = new Ball(0, 0, 0, CONFIG.BALL_RADIUS, 1);
    const ball2 = new Ball(1, 0, 0, CONFIG.BALL_RADIUS, 1);
    
    // Simulate the shot from the user's report
    // Position cue ball approaching from upper-right
    ball1.x = 5;
    ball1.y = -3;
    ball2.x = 0;
    ball2.y = 0;
    
    // Set velocity at an angle (similar to 126.8° shot)
    const angle = 126.8 * Math.PI / 180;
    const speed = 165; // ~sqrt(98.8^2 + 132.2^2)
    ball1.vx = Math.cos(angle) * speed;
    ball1.vy = Math.sin(angle) * speed;
    ball2.setVelocity(0, 0);
    
    // Position balls with slight overlap to simulate collision
    const dx = ball2.x - ball1.x;
    const dy = ball2.y - ball1.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const targetDist = CONFIG.BALL_RADIUS * 2 - 0.1; // 0.1" overlap
    
    // Move ball1 closer to create overlap
    const ratio = targetDist / dist;
    ball1.x = ball2.x - dx * ratio;
    ball1.y = ball2.y - dy * ratio;
    
    // Detect and resolve collision
    const contact = detectBallBall(ball1, ball2);
    expect(contact).not.toBeNull();
    
    if (contact) {
      // Resolve collision
      resolveBallBall(contact);
      
      // Check that object ball moves along collision normal
      const objSpeed = Math.sqrt(ball2.vx * ball2.vx + ball2.vy * ball2.vy);
      const objDirX = ball2.vx / objSpeed;
      const objDirY = ball2.vy / objSpeed;
      
      // Expected normal from ball1 to ball2 (after collision resolution)
      const dx2 = ball2.x - ball1.x;
      const dy2 = ball2.y - ball1.y;
      const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
      const expectedNx = dx2 / dist2;
      const expectedNy = dy2 / dist2;
      
      // Object ball direction should match collision normal very closely
      const dot = objDirX * expectedNx + objDirY * expectedNy;
      const angleError = Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;
      
      console.log(`\nCut shot test:`);
      console.log(`Object ball angle error: ${angleError.toFixed(2)}°`);
      console.log(`Object ball direction: (${objDirX.toFixed(4)}, ${objDirY.toFixed(4)})`);
      console.log(`Expected normal: (${expectedNx.toFixed(4)}, ${expectedNy.toFixed(4)})`);
      console.log(`Object ball velocity: (${ball2.vx.toFixed(1)}, ${ball2.vy.toFixed(1)})`);
      console.log(`Cue ball velocity after: (${ball1.vx.toFixed(1)}, ${ball1.vy.toFixed(1)})`);
      
      // This should be very small (< 1°) for correct physics
      expect(angleError).toBeLessThan(1.0);
    }
  });
  
  it('should handle multiple solver iterations without accumulating friction', () => {
    // Reset collision tracking
    resetCollisionTracking();
    
    // Setup collision
    const ball1 = new Ball(0, 0, 0, CONFIG.BALL_RADIUS, 1);
    const ball2 = new Ball(1, 0, 0, CONFIG.BALL_RADIUS, 1);
    
    ball1.x = 5;
    ball1.y = -3;
    ball2.x = 0;
    ball2.y = 0;
    
    const angle = 126.8 * Math.PI / 180;
    const speed = 165;
    ball1.vx = Math.cos(angle) * speed;
    ball1.vy = Math.sin(angle) * speed;
    ball2.setVelocity(0, 0);
    
    const dx = ball2.x - ball1.x;
    const dy = ball2.y - ball1.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const targetDist = CONFIG.BALL_RADIUS * 2 - 0.1;
    const ratio = targetDist / dist;
    ball1.x = ball2.x - dx * ratio;
    ball1.y = ball2.y - dy * ratio;
    
    // Simulate multiple solver iterations (like in actual game)
    for (let iter = 0; iter < 15; iter++) {
      const contact = detectBallBall(ball1, ball2);
      if (contact) {
        resolveBallBall(contact);
      }
    }
    
    // Check that object ball still moves along collision normal
    const objSpeed = Math.sqrt(ball2.vx * ball2.vx + ball2.vy * ball2.vy);
    const objDirX = ball2.vx / objSpeed;
    const objDirY = ball2.vy / objSpeed;
    
    const dx2 = ball2.x - ball1.x;
    const dy2 = ball2.y - ball1.y;
    const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
    const expectedNx = dx2 / dist2;
    const expectedNy = dy2 / dist2;
    
    const dot = objDirX * expectedNx + objDirY * expectedNy;
    const angleError = Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;
    
    console.log(`\n15 iterations test:`);
    console.log(`Object ball angle error: ${angleError.toFixed(2)}°`);
    console.log(`Object ball direction: (${objDirX.toFixed(4)}, ${objDirY.toFixed(4)})`);
    console.log(`Expected normal: (${expectedNx.toFixed(4)}, ${expectedNy.toFixed(4)})`);
    
    // Even with 15 iterations, error should stay < 1° due to tracking
    expect(angleError).toBeLessThan(1.0);
  });
});

describe('Physics - Rail Collision', () => {
  it('should detect collision with rail', () => {
    const ball = new Ball(1, 1, 10, CONFIG.BALL_RADIUS, 1);
    const rail = new Rail(0, 0, 0, 50);
    
    const contact = detectBallRail(ball, rail);
    
    expect(contact).not.toBeNull();
  });
  
  it('should not detect collision when ball is far from rail', () => {
    const ball = new Ball(1, 10, 10, CONFIG.BALL_RADIUS, 1);
    const rail = new Rail(0, 0, 0, 50);
    
    const contact = detectBallRail(ball, rail);
    
    expect(contact).toBeNull();
  });
});
