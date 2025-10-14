// Debug visualization overlay
// Coordinate system: Same as renderer - center origin, Y-up

import { PhysicsWorld } from '../physics/Physics';
import { CONFIG } from '../config';
import type { Renderer3D } from '../render/Renderer3D';

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
  
  toggle(force?: boolean): boolean {
    if (typeof force === 'boolean') {
      this.enabled = force;
    } else {
      this.enabled = !this.enabled;
    }
    this.canvas.classList.toggle('visible', this.enabled);
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
  
  draw(world: PhysicsWorld, renderer: Renderer3D) {
    if (!this.enabled) return;

    this.clear();

    const ctx = this.ctx;
    const project = (x: number, y: number) => renderer.worldToScreen(x, y);

    const origin = project(0, 0);
    const unitX = project(1, 0);
    const pixelsPerUnit = Math.hypot(unitX.x - origin.x, unitX.y - origin.y);

    const toPixels = (worldValue: number) => Math.max(1, pixelsPerUnit * worldValue);

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (CONFIG.DEBUG_DRAW_NORMALS) {
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = toPixels(0.2);
      world.rails.forEach((rail) => {
        const midX = (rail.x1 + rail.x2) / 2;
        const midY = (rail.y1 + rail.y2) / 2;

        const start = project(midX, midY);
        const end = project(midX + rail.nx * 3, midY + rail.ny * 3);

        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
      });
    }

    if (CONFIG.DEBUG_DRAW_VELOCITIES) {
      ctx.strokeStyle = '#ff00ff';
      ctx.lineWidth = toPixels(0.2);
      world.balls.forEach((ball) => {
        if (ball.pocketed || ball.sleeping) return;

        const start = project(ball.x, ball.y);
        const end = project(ball.x + ball.vx * 2, ball.y + ball.vy * 2);

        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
      });
    }

    world.pockets.forEach((pocket) => {
      const center = project(pocket.x, pocket.y);
      const edge = project(pocket.x + pocket.radius, pocket.y);
      const radius = Math.max(1, Math.hypot(edge.x - center.x, edge.y - center.y));

      ctx.strokeStyle = '#ffff00';
      ctx.lineWidth = toPixels(0.1);
      ctx.beginPath();
      ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    });

    ctx.restore();
  }
}
