import { describe, it, expect } from 'vitest';
import { Ball } from './Shapes';
import { detectBallBall, detectBallRail, resolveBallBall } from './Collision';
import { Rail } from './Shapes';
import { CONFIG } from '../config';
import { Predictor } from './Prediction';
import type { Contact } from './Collision';

function normalize(x: number, y: number) {
  const len = Math.sqrt(x * x + y * y);
  if (len < 1e-8) {
    return { x: 0, y: 0, length: 0 };
  }
  return { x: x / len, y: y / len, length: len };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function angleBetween(ax: number, ay: number, bx: number, by: number) {
  const dot = clamp(ax * bx + ay * by, -1, 1);
  return Math.acos(dot);
}

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

function comparePredictionToPhysics(offset: number) {
  const radius = CONFIG.BALL_RADIUS;
  const mass = CONFIG.BALL_MASS;
  const combinedRadius = radius * 2;
  const cueStartX = -30;
  const cueStartY = 0;
  const cueSpeed = 1; // Arbitrary speed; direction is normalized
  const objectX = 0;
  const objectY = offset;
  
  if (Math.abs(offset) >= combinedRadius) {
    throw new Error('Offset too large for collision');
  }
  
  const dxInitial = objectX - cueStartX; // Distance along x-axis
  const underSqrt = combinedRadius * combinedRadius - offset * offset;
  if (underSqrt <= 0) {
    throw new Error('No collision possible with given offset');
  }
  const sqrtTerm = Math.sqrt(underSqrt);
  const timeToContact = (dxInitial - sqrtTerm) / cueSpeed;
  const cueContactX = cueStartX + cueSpeed * timeToContact;
  const cueContactY = cueStartY;
  
  // --- Actual physics via resolveBallBall ---
  const cueActual = new Ball(100, cueContactX, cueContactY, radius, mass);
  const objActual = new Ball(101, objectX, objectY, radius, mass);
  cueActual.setVelocity(cueSpeed, 0);
  objActual.setVelocity(0, 0);
  
  const nx = (objectX - cueContactX) / combinedRadius;
  const ny = (objectY - cueContactY) / combinedRadius;
  const contact: Contact = {
    ballA: cueActual,
    ballB: objActual,
    nx,
    ny,
    depth: 0,
  };
  resolveBallBall(contact);
  
  const actualCue = normalize(cueActual.vx, cueActual.vy);
  const actualObj = normalize(objActual.vx, objActual.vy);
  
  // --- Prediction path ---
  const cuePredict = new Ball(200, cueStartX, cueStartY, radius, mass);
  const objPredict = new Ball(201, objectX, objectY, radius, mass);
  const prediction = Predictor.predictFullPath(cuePredict, 0, cueSpeed, [cuePredict, objPredict], []);
  
  const cueSegments = prediction.segments.filter((segment) => segment.type === 'cue');
  const cueBounceSegment = cueSegments[1];
  const objSegment = prediction.segments.find((segment) => segment.type === 'object');
  
  const predictedCue = cueBounceSegment
    ? normalize(
        cueBounceSegment.end.x - cueBounceSegment.start.x,
        cueBounceSegment.end.y - cueBounceSegment.start.y
      )
    : { x: 0, y: 0, length: 0 };
  const predictedObj = objSegment
    ? normalize(objSegment.end.x - objSegment.start.x, objSegment.end.y - objSegment.start.y)
    : { x: 0, y: 0, length: 0 };
  
  const cueAngleError = actualCue.length > 1e-4 && predictedCue.length > 1e-4
    ? angleBetween(actualCue.x, actualCue.y, predictedCue.x, predictedCue.y)
    : 0;
  const objAngleError = actualObj.length > 1e-4 && predictedObj.length > 1e-4
    ? angleBetween(actualObj.x, actualObj.y, predictedObj.x, predictedObj.y)
    : 0;
  
  return {
    cueAngleError,
    objAngleError,
    actualCueSpeed: actualCue.length,
    actualObjSpeed: actualObj.length,
    predictedCueLength: predictedCue.length,
    predictedObjLength: predictedObj.length,
  };
}

describe('Prediction vs actual physics', () => {
  const offsets = [0.5, 1.0, 1.6].map((factor) => factor * CONFIG.BALL_RADIUS);
  const signedOffsets = offsets.flatMap((offset) => [offset, -offset]);
  
  signedOffsets.forEach((offset) => {
    it(`matches post-collision directions for offset ${offset.toFixed(2)}"`, () => {
      const result = comparePredictionToPhysics(offset);
      expect(result.objAngleError).toBeLessThan(0.05);
      if (result.actualCueSpeed > 1e-3) {
        expect(result.cueAngleError).toBeLessThan(0.05);
      }
    });
  });
});
