// Debug visualization overlay
// Coordinate system: Same as renderer - center origin, Y-up

import { PhysicsWorld } from '../physics/Physics';
import { CONFIG } from '../config';
import type { Renderer3D } from '../render/Renderer3D';

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
  renderer: Renderer3D | null = null;
  
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.scale = CONFIG.CANVAS_SCALE;
  }
  
  setRenderer(renderer: Renderer3D) {
    this.renderer = renderer;
  }
  
  toggle() {
    this.enabled = !this.enabled;
    this.canvas.classList.toggle('visible', this.enabled);
  }
  
  isEnabled(): boolean {
    return this.enabled;
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
    if (!this.enabled || !this.renderer) return;
    
    this.clear();
    
    this.ctx.save();

    // Draw rails with unique colors
    world.rails.forEach((rail, index) => {
      const color = RAIL_DEBUG_COLORS[index % RAIL_DEBUG_COLORS.length];
      const p1 = this.renderer!.worldToScreen(rail.x1, rail.y1);
      const p2 = this.renderer!.worldToScreen(rail.x2, rail.y2);
      
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.moveTo(p1.x, p1.y);
      this.ctx.lineTo(p2.x, p2.y);
      this.ctx.stroke();

      if (CONFIG.DEBUG_DRAW_NORMALS) {
        const midX = (rail.x1 + rail.x2) / 2;
        const midY = (rail.y1 + rail.y2) / 2;
        const mid = this.renderer!.worldToScreen(midX, midY);
        const normalEnd = this.renderer!.worldToScreen(midX + rail.nx * 3, midY + rail.ny * 3);
        
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(mid.x, mid.y);
        this.ctx.lineTo(normalEnd.x, normalEnd.y);
        this.ctx.stroke();
      }
    });

    // Draw ball velocities
    if (CONFIG.DEBUG_DRAW_VELOCITIES) {
      world.balls.forEach((ball) => {
        if (ball.pocketed || ball.sleeping) return;
        const p1 = this.renderer!.worldToScreen(ball.x, ball.y);
        const p2 = this.renderer!.worldToScreen(ball.x + ball.vx * 2, ball.y + ball.vy * 2);
        
        this.ctx.strokeStyle = '#ff00ff';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(p1.x, p1.y);
        this.ctx.lineTo(p2.x, p2.y);
        this.ctx.stroke();
      });
    }

    // Draw pocket capture radii
    world.pockets.forEach((pocket) => {
      const center = this.renderer!.worldToScreen(pocket.x, pocket.y);
      const radiusPx = pocket.radius * this.renderer!.scale;
      
      this.ctx.strokeStyle = '#ffff00';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(center.x, center.y, radiusPx, 0, Math.PI * 2);
      this.ctx.stroke();
    });

    this.ctx.restore();
  }
}
