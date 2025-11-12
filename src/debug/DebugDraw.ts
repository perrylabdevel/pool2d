// Debug visualization overlay
// Coordinate system: Same as renderer - center origin, Y-up

import { PhysicsWorld } from '../physics/Physics';
import { CONFIG } from '../config';
import type { Rail } from '../physics/Shapes';
import { getTableGeometry } from '../geometry/Geometry';
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
  // Ball-in-hand overlay
  private bihEnabled: boolean = false;
  private bihData: {
    raw: { x: number; y: number } | null;
    clamped: { x: number; y: number } | null;
    radius: number;
    hits: number;
    rtErrorPx: number;
  } | null = null;
  
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
    this.updateVisibility();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /** Check if the debug canvas should be visible (either full debug or ball-in-hand overlay) */
  private shouldBeVisible(): boolean {
    return this.enabled || this.bihEnabled;
  }

  /** Update canvas visibility based on both debug mode and ball-in-hand overlay */
  private updateVisibility() {
    this.canvas.classList.toggle('visible', this.shouldBeVisible());
  }

  resize(width: number, height: number, scale: number, offsetX?: number, offsetY?: number) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.scale = scale;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    // Apply position offsets if provided
    if (offsetX !== undefined && offsetY !== undefined) {
      this.canvas.style.left = `${offsetX}px`;
      this.canvas.style.top = `${offsetY}px`;
    }
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  setBallInHandOverlayEnabled(enabled: boolean) {
    this.bihEnabled = enabled;
    this.updateVisibility();
  }

  isBallInHandOverlayEnabled(): boolean {
    return this.bihEnabled;
  }

  setBallInHandData(data: {
    raw: { x: number; y: number } | null;
    clamped: { x: number; y: number } | null;
    radius: number;
    hits: number;
    rtErrorPx: number;
  }) {
    this.bihData = data;
  }
  
  draw(world: PhysicsWorld) {
    // Draw if either full debug mode OR ball-in-hand overlay is enabled
    if (!this.shouldBeVisible() || !this.renderer) return;

    this.clear();

    this.ctx.save();

    // Only draw full debug visualizations when debug mode is explicitly enabled
    if (this.enabled) {
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

      // Also draw safety margin ring for ball-in-hand
      const margin = CONFIG.BALL_IN_HAND_POCKET_MARGIN_IN ?? 0;
      if (margin > 0) {
        this.ctx.setLineDash([5, 5]);
        this.ctx.strokeStyle = '#ffaa00';
        this.ctx.lineWidth = 1.5;
        this.ctx.beginPath();
        this.ctx.arc(center.x, center.y, (pocket.radius + margin) * this.renderer!.scale, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
      }
    });
    } // end if (this.enabled) - full debug mode visualizations

    // When BIH overlay is on, draw corner mouth chords used for placement clamp
    if (this.bihEnabled) {
      const geom = getTableGeometry();
      const byId = new Map<string, { from: { x: number; y: number }; to: { x: number; y: number } }>();
      geom.rails.forEach((r) => byId.set(r.id, { from: r.from, to: r.to }));

      const getPt = (id: string, which: 'from' | 'to') => byId.get(id)?.[which];
      const chords: Array<{ a: { x: number; y: number }; b: { x: number; y: number } }> = [];
      const addChord = (aId: string, aPick: 'from' | 'to', bId: string, bPick: 'from' | 'to') => {
        const a = getPt(aId, aPick);
        const b = getPt(bId, bPick);
        if (a && b) chords.push({ a, b });
      };
      addChord('N_east_taper', 'from', 'E_north_taper', 'to');
      addChord('N_west_taper', 'to', 'W_north_taper', 'from');
      addChord('S_west_taper', 'from', 'W_south_taper', 'to');
      addChord('S_east_taper', 'to', 'E_south_taper', 'from');

      this.ctx.setLineDash([6, 6]);
      this.ctx.lineWidth = 2;
      this.ctx.strokeStyle = '#33C3F0';
      chords.forEach(({ a, b }) => {
        const p1 = this.renderer!.worldToScreen(a.x, a.y);
        const p2 = this.renderer!.worldToScreen(b.x, b.y);
        this.ctx.beginPath();
        this.ctx.moveTo(p1.x, p1.y);
        this.ctx.lineTo(p2.x, p2.y);
        this.ctx.stroke();
      });
      this.ctx.setLineDash([]);
    }

    // Ball-in-hand overlay: endpoint caps, mouse markers, telemetry
    if (this.bihEnabled) {
      const r = (this.bihData?.radius ?? CONFIG.BALL_RADIUS) * this.renderer!.scale;
      // Endpoint caps (use ball radius)
      world.rails.forEach((rail) => {
        const a = this.renderer!.worldToScreen(rail.x1, rail.y1);
        const b = this.renderer!.worldToScreen(rail.x2, rail.y2);
        this.ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.arc(a.x, a.y, r, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
        this.ctx.stroke();
      });

      // Raw and clamped points
      if (this.bihData?.raw) {
        const p = this.renderer!.worldToScreen(this.bihData.raw.x, this.bihData.raw.y);
        this.ctx.fillStyle = '#ff3333';
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        this.ctx.fill();
      }
      if (this.bihData?.clamped) {
        const p = this.renderer!.worldToScreen(this.bihData.clamped.x, this.bihData.clamped.y);
        this.ctx.fillStyle = '#33ff33';
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        this.ctx.fill();
      }
      if (this.bihData?.raw && this.bihData?.clamped) {
        const a = this.renderer!.worldToScreen(this.bihData.raw.x, this.bihData.raw.y);
        const b = this.renderer!.worldToScreen(this.bihData.clamped.x, this.bihData.clamped.y);
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.setLineDash([4, 4]);
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(a.x, a.y);
        this.ctx.lineTo(b.x, b.y);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
      }

      // Canvas border (to visualize padding / clipping)
      this.ctx.strokeStyle = 'rgba(255,255,0,0.6)';
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(0.5, 0.5, this.canvas.width - 1, this.canvas.height - 1);

      // Telemetry
      this.ctx.fillStyle = '#00ffff';
      this.ctx.font = '12px monospace';
      const raw = this.bihData?.raw;
      const cl = this.bihData?.clamped;
      const rt = this.bihData?.rtErrorPx ?? 0;
      const hits = this.bihData?.hits ?? 0;
      const lines: string[] = [];
      if (raw) lines.push(`raw: (${raw.x.toFixed(2)}, ${raw.y.toFixed(2)})`);
      if (cl) lines.push(`clamped: (${cl.x.toFixed(2)}, ${cl.y.toFixed(2)})`);
      lines.push(`rtErrorPx: ${rt.toFixed(2)}  hits: ${hits}`);
      let y = 16;
      lines.forEach((t) => {
        this.ctx.fillText(t, 8, y);
        y += 14;
      });
    }

    this.ctx.restore();
  }
}
