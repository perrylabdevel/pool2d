// Debug visualization overlay
// Coordinate system: Same as renderer - center origin, Y-up

import { PhysicsWorld } from '../physics/Physics';
import { CONFIG } from '../config';

const RAIL_DEBUG_COLORS = [
  '#ff4444',
  '#ff8844',
  '#ffcc44',
  '#44ff44',
  '#44ffcc',
  '#44ccff',
  '#4444ff',
  '#8844ff',
  '#cc44ff',
  '#ff44cc',
  '#ff4499',
  '#ff4477',
];

export class DebugDraw {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  scale: number;
  enabled: boolean = false;
  
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.scale = CONFIG.CANVAS_SCALE;
  }
  
  toggle() {
    this.enabled = !this.enabled;
    this.canvas.classList.toggle('visible', this.enabled);
  }
  
  resize(width: number, height: number, scale: number) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.scale = scale;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
  }
  
  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
  
  draw(world: PhysicsWorld) {
    if (!this.enabled) return;
    
    this.clear();
    
    this.ctx.save();
    
    // Use same transform as renderer: center origin, Y-up
    const canvasCenterX = this.canvas.width / 2;
    const canvasCenterY = this.canvas.height / 2;
    this.ctx.translate(canvasCenterX, canvasCenterY);
    this.ctx.scale(this.scale, -this.scale); // Y-up for world coords

    // Draw rails with unique colors
    world.rails.forEach((rail, index) => {
      const color = RAIL_DEBUG_COLORS[index % RAIL_DEBUG_COLORS.length];
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 0.4;
      this.ctx.beginPath();
      this.ctx.moveTo(rail.x1, rail.y1);
      this.ctx.lineTo(rail.x2, rail.y2);
      this.ctx.stroke();

      if (CONFIG.DEBUG_DRAW_NORMALS) {
        const midX = (rail.x1 + rail.x2) / 2;
        const midY = (rail.y1 + rail.y2) / 2;
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 0.2;
        this.ctx.beginPath();
        this.ctx.moveTo(midX, midY);
        this.ctx.lineTo(midX + rail.nx * 3, midY + rail.ny * 3);
        this.ctx.stroke();
      }
    });

    // Draw ball velocities
    if (CONFIG.DEBUG_DRAW_VELOCITIES) {
      world.balls.forEach((ball) => {
        if (ball.pocketed || ball.sleeping) return;
        this.ctx.strokeStyle = '#ff00ff';
        this.ctx.lineWidth = 0.2;
        this.ctx.beginPath();
        this.ctx.moveTo(ball.x, ball.y);
        this.ctx.lineTo(ball.x + ball.vx * 2, ball.y + ball.vy * 2);
        this.ctx.stroke();
      });
    }

    // Draw pocket capture radii
    world.pockets.forEach((pocket) => {
      this.ctx.strokeStyle = '#ffff00';
      this.ctx.lineWidth = 0.1;
      this.ctx.beginPath();
      this.ctx.arc(pocket.x, pocket.y, pocket.radius, 0, Math.PI * 2);
      this.ctx.stroke();
    });

    this.ctx.restore();
  }
}
