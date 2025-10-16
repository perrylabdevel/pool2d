// Physics shape definitions

export interface Vec2 {
  x: number;
  y: number;
}

export class Ball {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  mass: number;
  invMass: number;
  pocketed: boolean;
  sleeping: boolean;
  
  // Rotation (for visual spinning)
  angle: number; // Rotation angle in radians
  angularVelocity: number; // Radians per second
  
  // For interpolation
  prevX: number;
  prevY: number;
  
  constructor(id: number, x: number, y: number, radius: number, mass: number) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.radius = radius;
    this.mass = mass;
    this.invMass = mass > 0 ? 1 / mass : 0;
    this.pocketed = false;
    this.sleeping = false;
    this.angle = 0;
    this.angularVelocity = 0;
    this.prevX = x;
    this.prevY = y;
  }
  
  saveState() {
    this.prevX = this.x;
    this.prevY = this.y;
  }
  
  getSpeed(): number {
    return Math.sqrt(this.vx * this.vx + this.vy * this.vy);
  }
  
  setVelocity(vx: number, vy: number) {
    this.vx = vx;
    this.vy = vy;
    this.sleeping = false;
  }
  
  clone(): Ball {
    const copy = new Ball(this.id, this.x, this.y, this.radius, this.mass);
    copy.vx = this.vx;
    copy.vy = this.vy;
    copy.invMass = this.invMass;
    copy.pocketed = this.pocketed;
    copy.sleeping = this.sleeping;
    copy.angle = this.angle;
    copy.angularVelocity = this.angularVelocity;
    copy.prevX = this.prevX;
    copy.prevY = this.prevY;
    return copy;
  }
}

export class Rail {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  nx: number; // Normal pointing inward
  ny: number;
  
  constructor(x1: number, y1: number, x2: number, y2: number) {
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
    
    // Calculate normal (perpendicular to rail, pointing inward)
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    
    // Perpendicular vector (rotated 90 degrees)
    this.nx = -dy / len;
    this.ny = dx / len;
  }
  
  // Flip normal if needed (to point inward)
  flipNormal() {
    this.nx = -this.nx;
    this.ny = -this.ny;
  }
  
  clone(): Rail {
    const copy = new Rail(this.x1, this.y1, this.x2, this.y2);
    copy.nx = this.nx;
    copy.ny = this.ny;
    return copy;
  }
}

export class Pocket {
  x: number;
  y: number;
  radius: number;
  
  constructor(x: number, y: number, radius: number) {
    this.x = x;
    this.y = y;
    this.radius = radius;
  }
  
  contains(ball: Ball): boolean {
    const dx = ball.x - this.x;
    const dy = ball.y - this.y;
    const distSq = dx * dx + dy * dy;
    return distSq < this.radius * this.radius;
  }
  
  clone(): Pocket {
    return new Pocket(this.x, this.y, this.radius);
  }
}

export function vec2(x: number, y: number): Vec2 {
  return { x, y };
}

export function vec2Add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function vec2Sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function vec2Scale(v: Vec2, s: number): Vec2 {
  return { x: v.x * s, y: v.y * s };
}

export function vec2Dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

export function vec2Length(v: Vec2): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

export function vec2Normalize(v: Vec2): Vec2 {
  const len = vec2Length(v);
  if (len < 1e-8) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}
