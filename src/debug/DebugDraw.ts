// Debug visualization overlay
// Coordinate system: Same as renderer - center origin, Y-up

import { PhysicsWorld } from '../physics/Physics';
import { CONFIG } from '../config';

export class DebugDraw {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  scale: number;
  enabled: boolean = false;
  viewWidth: number = 0;
  viewHeight: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.scale = CONFIG.CANVAS_SCALE;
  }
  
  toggle() {
    this.enabled = !this.enabled;
    this.canvas.classList.toggle('visible', this.enabled);
  }
  
  /** width/height are CSS pixels; the backing store is scaled by the DPR. */
  resize(width: number, height: number, scale: number) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.viewWidth = width;
    this.viewHeight = height;
    this.scale = scale;
  }

  clear() {
    this.ctx.clearRect(0, 0, this.viewWidth, this.viewHeight);
  }
  
  draw(world: PhysicsWorld) {
    if (!this.enabled) return;
    
    this.clear();
    
    this.ctx.save();
    
    // Use same transform as renderer: center origin, Y-up
    const canvasCenterX = this.viewWidth / 2;
    const canvasCenterY = this.viewHeight / 2;
    this.ctx.translate(canvasCenterX, canvasCenterY);
    this.ctx.scale(this.scale, -this.scale); // Y-up for world coords
    
    // Draw rail normals
    if (CONFIG.DEBUG_DRAW_NORMALS) {
      world.rails.forEach((rail) => {
        const midX = (rail.x1 + rail.x2) / 2;
        const midY = (rail.y1 + rail.y2) / 2;
        
        this.ctx.strokeStyle = '#00ff00';
        this.ctx.lineWidth = 0.2;
        this.ctx.beginPath();
        this.ctx.moveTo(midX, midY);
        this.ctx.lineTo(midX + rail.nx * 3, midY + rail.ny * 3);
        this.ctx.stroke();
      });
    }
    
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
    
    // Draw pocket radii
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
