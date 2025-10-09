import { describe, it, expect } from 'vitest';
import { Ball } from './Shapes';
import { detectBallBall, detectBallRail } from './Collision';
import { Rail } from './Shapes';
import { CONFIG } from '../config';

describe('Physics - Ball Collision', () => {
  it('should detect collision between two overlapping balls', () => {
    const ball1 = new Ball(1, 10, 10, 1, 1);
    const ball2 = new Ball(2, 11.5, 10, 1, 1);
    
    const contact = detectBallBall(ball1, ball2);
    
    expect(contact).not.toBeNull();
    expect(contact?.depth).toBeGreaterThan(0);
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
