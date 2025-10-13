// Rendering system
// Coordinate system: World uses center-origin Y-up, Canvas uses top-left Y-down
// Transform applied in render() to convert world->canvas

import { Ball, Rail, Pocket } from '../physics/Shapes';
import { PhysicsWorld } from '../physics/Physics';
import { CONFIG, BALL_CUE } from '../config';
import { TABLE_GEOMETRY } from '../geometry/Geometry';
import { PredictionResult } from '../physics/Prediction';

export class Renderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  scale: number;
  
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.scale = CONFIG.CANVAS_SCALE;
  }
  
  resize() {
    const container = this.canvas.parentElement!;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    // External margin around canvas
    const externalMargin = 40;
    
    // Internal padding within canvas (around table)
    const internalPadding = 40;
    
    // Calculate available space for canvas after external margins
    const availableWidth = containerWidth - externalMargin * 2;
    const availableHeight = containerHeight - externalMargin * 2;
    
    // Calculate scale to fit table with internal padding
    const scaleX = (availableWidth - internalPadding * 2) / CONFIG.TABLE_WIDTH;
    const scaleY = (availableHeight - internalPadding * 2) / CONFIG.TABLE_HEIGHT;
    this.scale = Math.min(scaleX, scaleY);
    
    // Set canvas size (table + internal padding only)
    this.canvas.width = CONFIG.TABLE_WIDTH * this.scale + internalPadding * 2;
    this.canvas.height = CONFIG.TABLE_HEIGHT * this.scale + internalPadding * 2;
    
    // Set canvas display size
    this.canvas.style.width = `${this.canvas.width}px`;
    this.canvas.style.height = `${this.canvas.height}px`;
  }
  
  clear() {
    this.ctx.fillStyle = '#0a0a0a';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }
  
  render(world: PhysicsWorld, alpha: number) {
    this.clear();
    
    this.ctx.save();
    
    // Set up world->canvas transform
    // World: origin at table center, +X=right, +Y=up
    // Canvas: origin at top-left, +X=right, +Y=down
    const canvasCenterX = this.canvas.width / 2;
    const canvasCenterY = this.canvas.height / 2;
    
    this.ctx.translate(canvasCenterX, canvasCenterY);
    this.ctx.scale(this.scale, -this.scale); // Negative Y to flip vertical axis
    
    // Draw in correct order: bottom to top
    this.drawFrame();
    this.drawPlayingSurface();
    this.drawRails(world.rails);
    this.drawPockets(world.pockets);
    this.drawBalls(world.balls, alpha);
    
    this.ctx.restore();
  }
  
  drawPlayingSurface() {
    if (!this.tracePlayBoundary()) return;

    this.ctx.fillStyle = CONFIG.TABLE_COLOR;
    this.ctx.fill();

    // Felt texture inside play area
    this.ctx.save();
    this.ctx.clip();
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.02)';
    for (let i = 0; i < 120; i++) {
      const x = (Math.random() - 0.5) * TABLE_GEOMETRY.playWidthIn;
      const y = (Math.random() - 0.5) * TABLE_GEOMETRY.playHeightIn;
      this.ctx.fillRect(x, y, 0.4, 0.4);
    }
    this.ctx.restore();
  }

  drawFrame() {
    const frameWidth = 6;
    const halfW = TABLE_GEOMETRY.playWidthIn / 2;
    const halfH = TABLE_GEOMETRY.playHeightIn / 2;

    // Base wood background encompassing play area
    this.ctx.fillStyle = '#3d2413';
    this.ctx.fillRect(
      -halfW - frameWidth,
      -halfH - frameWidth,
      TABLE_GEOMETRY.playWidthIn + frameWidth * 2,
      TABLE_GEOMETRY.playHeightIn + frameWidth * 2
    );

    // Inner lip following rail outline
    if (this.tracePlayBoundary()) {
      this.ctx.strokeStyle = '#2d1810';
      this.ctx.lineWidth = frameWidth;
      this.ctx.lineJoin = 'round';
      this.ctx.stroke();
    }
  }

  private tracePlayBoundary(): boolean {
    const rails = TABLE_GEOMETRY.rails;
    if (!rails.length) {
      return false;
    }

    this.ctx.beginPath();
    this.ctx.moveTo(rails[0].from.x, rails[0].from.y);
    rails.forEach((rail) => {
      this.ctx.lineTo(rail.to.x, rail.to.y);
    });
    this.ctx.closePath();
    return true;
  }
  
  drawPockets(pockets: Pocket[]) {
    pockets.forEach((pocket) => this.drawPocket(pocket));
  }
  
  drawRails(rails: Rail[]) {
    rails.forEach((rail) => this.drawRail(rail));
  }
  
  drawBalls(balls: Ball[], alpha: number) {
    balls.forEach((ball) => {
      if (!ball.pocketed) {
        this.drawBall(ball, alpha);
      }
    });
  }
  
  drawRail(rail: Rail) {
    // Draw simple cushion with consistent thickness
    this.ctx.strokeStyle = '#0d3d0d';
    this.ctx.lineWidth = CONFIG.RAIL_THICKNESS * 2;
    this.ctx.lineCap = 'butt';
    
    this.ctx.beginPath();
    this.ctx.moveTo(rail.x1, rail.y1);
    this.ctx.lineTo(rail.x2, rail.y2);
    this.ctx.stroke();
    
    // Add inner highlight
    this.ctx.strokeStyle = '#1a5d1a';
    this.ctx.lineWidth = CONFIG.RAIL_THICKNESS * 1;
    
    this.ctx.beginPath();
    this.ctx.moveTo(rail.x1, rail.y1);
    this.ctx.lineTo(rail.x2, rail.y2);
    this.ctx.stroke();
  }
  
  drawPocket(pocket: Pocket) {
    this.ctx.fillStyle = CONFIG.POCKET_COLOR;
    this.ctx.beginPath();
    this.ctx.arc(pocket.x, pocket.y, pocket.radius, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Inner shadow
    const gradient = this.ctx.createRadialGradient(
      pocket.x,
      pocket.y,
      0,
      pocket.x,
      pocket.y,
      pocket.radius
    );
    gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
    gradient.addColorStop(1, 'rgba(50, 50, 50, 0.3)');
    
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(pocket.x, pocket.y, pocket.radius, 0, Math.PI * 2);
    this.ctx.fill();
  }
  
  drawBall(ball: Ball, alpha: number) {
    // Interpolate position for smooth rendering
    const x = ball.prevX + (ball.x - ball.prevX) * alpha;
    const y = ball.prevY + (ball.y - ball.prevY) * alpha;
    
    // Shadow
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    this.ctx.beginPath();
    this.ctx.ellipse(x + 0.2, y + 0.2, ball.radius * 0.9, ball.radius * 0.7, 0, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Ball body
    const gradient = this.ctx.createRadialGradient(
      x - ball.radius * 0.3,
      y - ball.radius * 0.3,
      0,
      x,
      y,
      ball.radius
    );
    
    const color = ball.id === BALL_CUE ? CONFIG.CUE_BALL_COLOR : CONFIG.BALL_COLORS[ball.id - 1];
    
    gradient.addColorStop(0, this.lightenColor(color, 0.4));
    gradient.addColorStop(0.7, color);
    gradient.addColorStop(1, this.darkenColor(color, 0.3));
    
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(x, y, ball.radius, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Save context for rotation
    this.ctx.save();
    this.ctx.translate(x, y);
    
    // Calculate rotation angle based on velocity direction
    // The ball rotates perpendicular to its direction of travel
    const rotationAngle = ball.angle;
    this.ctx.rotate(rotationAngle);
    
    // Stripe for striped balls (9-15) - now rotates with ball
    if (ball.id >= 9 && ball.id <= 15) {
      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.arc(0, 0, ball.radius * 0.6, 0, Math.PI * 2);
      this.ctx.fill();
    }
    
    // Ball number (need to flip Y back for text to be readable)
    if (ball.id !== BALL_CUE) {
      this.ctx.scale(1, -1); // Flip Y back to normal for text
      this.ctx.fillStyle = ball.id >= 9 && ball.id <= 15 ? '#000000' : '#ffffff';
      this.ctx.font = `bold ${ball.radius * 0.8}px Arial`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(ball.id.toString(), 0, 0);
    }
    
    this.ctx.restore();
    
    // Highlight (doesn't rotate - stays at light source position)
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    this.ctx.beginPath();
    this.ctx.arc(x - ball.radius * 0.3, y - ball.radius * 0.3, ball.radius * 0.3, 0, Math.PI * 2);
    this.ctx.fill();
  }
  
  drawCueAndPowerBar(ball: Ball, angle: number, power: number, showGhost: boolean, showPowerBar: boolean, isAimMode: boolean, prediction?: PredictionResult) {
    this.ctx.save();
    
    // Use same transform as main render
    const canvasCenterX = this.canvas.width / 2;
    const canvasCenterY = this.canvas.height / 2;
    this.ctx.translate(canvasCenterX, canvasCenterY);
    this.ctx.scale(this.scale, -this.scale); // Y-up for world coords
    
    const x = ball.x;
    const y = ball.y;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    
    // Cue stick (behind the ball, opposite to shot direction)
    const cueStart = ball.radius + 1;
    const cueLength = 15;
    const cueOffset = (1 - power / CONFIG.CUE_POWER_MAX) * 3;
    
    this.ctx.strokeStyle = '#8b4513';
    this.ctx.lineWidth = 0.4;
    this.ctx.beginPath();
    // Draw cue stick behind the ball (negative direction)
    this.ctx.moveTo(x - dx * (cueStart + cueOffset), y - dy * (cueStart + cueOffset));
    this.ctx.lineTo(x - dx * (cueStart + cueLength + cueOffset), y - dy * (cueStart + cueLength + cueOffset));
    this.ctx.stroke();
    
    // Aim line - always stop at contact point (ball or rail) if prediction exists
    const aimEndX = (prediction && (prediction.type === 'ball' || prediction.type === 'rail')) 
      ? prediction.contactPoint.x 
      : x + dx * CONFIG.AIM_LINE_LENGTH;
    const aimEndY = (prediction && (prediction.type === 'ball' || prediction.type === 'rail')) 
      ? prediction.contactPoint.y 
      : y + dy * CONFIG.AIM_LINE_LENGTH;
    
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    this.ctx.lineWidth = 0.1;
    this.ctx.setLineDash([0.5, 0.5]);
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
    this.ctx.lineTo(aimEndX, aimEndY);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
    
    // Ghost ball at predicted contact point
    if (showGhost && prediction && prediction.type === 'ball') {
      const ghostX = prediction.contactPoint.x;
      const ghostY = prediction.contactPoint.y;
      
      // Draw semi-transparent ghost ball
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      this.ctx.lineWidth = 0.1;
      this.ctx.beginPath();
      this.ctx.arc(ghostX, ghostY, ball.radius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();
      
      // Line to ghost ball removed - trajectory arrows show direction instead
    }
    
    // Power bar (vertical bar to the right of the table)
    if (showPowerBar) {
      this.drawPowerBar(power, isAimMode);
    }
    
    this.ctx.restore();
  }
  
  drawTrajectoryLines(prediction: PredictionResult, cueBallPos: { x: number; y: number }, shotDirection: { x: number; y: number }, predictor: any) {
    if (prediction.type === 'none') return;
    
    this.ctx.save();
    
    // Use same transform as main render
    const canvasCenterX = this.canvas.width / 2;
    const canvasCenterY = this.canvas.height / 2;
    this.ctx.translate(canvasCenterX, canvasCenterY);
    this.ctx.scale(this.scale, -this.scale); // Y-up for world coords
    
    // Get trajectory predictions
    const trajectories = predictor.predictTrajectories(
      prediction,
      cueBallPos,
      shotDirection,
      15 // Line length in inches
    );
    
    // Draw object ball trajectory (yellow dashed line with arrowhead)
    if (trajectories.objectBallPath) {
      const start = trajectories.objectBallPath.start;
      const end = trajectories.objectBallPath.end;
      
      // Draw line
      this.ctx.strokeStyle = 'rgba(255, 255, 0, 0.6)';
      this.ctx.lineWidth = 0.1;
      this.ctx.setLineDash([1, 1]);
      this.ctx.beginPath();
      this.ctx.moveTo(start.x, start.y);
      this.ctx.lineTo(end.x, end.y);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
      
      // Draw arrowhead at end
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0) {
        const arrowSize = 1.5;
        const angle = Math.atan2(dy, dx);
        
        this.ctx.fillStyle = 'rgba(255, 255, 0, 0.8)';
        this.ctx.beginPath();
        this.ctx.moveTo(end.x, end.y);
        this.ctx.lineTo(
          end.x - arrowSize * Math.cos(angle - Math.PI / 6),
          end.y - arrowSize * Math.sin(angle - Math.PI / 6)
        );
        this.ctx.lineTo(
          end.x - arrowSize * Math.cos(angle + Math.PI / 6),
          end.y - arrowSize * Math.sin(angle + Math.PI / 6)
        );
        this.ctx.closePath();
        this.ctx.fill();
      }
    }
    
    // Draw cue ball trajectory (white dashed line with arrowhead)
    if (trajectories.cueBallPath) {
      const start = trajectories.cueBallPath.start;
      const end = trajectories.cueBallPath.end;
      
      // Draw line
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      this.ctx.lineWidth = 0.1;
      this.ctx.setLineDash([1, 1]);
      this.ctx.beginPath();
      this.ctx.moveTo(start.x, start.y);
      this.ctx.lineTo(end.x, end.y);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
      
      // Draw arrowhead at end
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0) {
        const arrowSize = 1.5;
        const angle = Math.atan2(dy, dx);
        
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        this.ctx.beginPath();
        this.ctx.moveTo(end.x, end.y);
        this.ctx.lineTo(
          end.x - arrowSize * Math.cos(angle - Math.PI / 6),
          end.y - arrowSize * Math.sin(angle - Math.PI / 6)
        );
        this.ctx.lineTo(
          end.x - arrowSize * Math.cos(angle + Math.PI / 6),
          end.y - arrowSize * Math.sin(angle + Math.PI / 6)
        );
        this.ctx.closePath();
        this.ctx.fill();
      }
    }
    
    this.ctx.restore();
  }
  
  lightenColor(color: string, amount: number): string {
    const hex = color.replace('#', '');
    const r = Math.min(255, parseInt(hex.slice(0, 2), 16) + amount * 255);
    const g = Math.min(255, parseInt(hex.slice(2, 4), 16) + amount * 255);
    const b = Math.min(255, parseInt(hex.slice(4, 6), 16) + amount * 255);
    return `rgb(${r}, ${g}, ${b})`;
  }
  
  darkenColor(color: string, amount: number): string {
    const hex = color.replace('#', '');
    const r = Math.max(0, parseInt(hex.slice(0, 2), 16) - amount * 255);
    const g = Math.max(0, parseInt(hex.slice(2, 4), 16) - amount * 255);
    const b = Math.max(0, parseInt(hex.slice(4, 6), 16) - amount * 255);
    return `rgb(${r}, ${g}, ${b})`;
  }
  
  drawPowerBar(power: number, isAimMode: boolean) {
    this.ctx.restore(); // Exit game space
    this.ctx.save();
    
    // Draw power bar in screen space (right side of canvas)
    const barWidth = 30;
    const barHeight = 200;
    const barX = this.canvas.width - 60;
    const barY = (this.canvas.height - barHeight) / 2;
    
    // Background
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this.ctx.fillRect(barX, barY, barWidth, barHeight);
    
    // Border - change color based on mode
    this.ctx.strokeStyle = isAimMode ? '#888888' : '#ffffff';
    this.ctx.lineWidth = isAimMode ? 1 : 3;
    this.ctx.strokeRect(barX, barY, barWidth, barHeight);
    
    // Power fill (from top, down = more power)
    const powerPercent = power / CONFIG.CUE_POWER_MAX;
    const fillHeight = barHeight * powerPercent;
    
    // Gradient from green at top to yellow to red at bottom
    const gradient = this.ctx.createLinearGradient(barX, barY, barX, barY + barHeight);
    gradient.addColorStop(0, '#00ff00');
    gradient.addColorStop(0.5, '#ffff00');
    gradient.addColorStop(1, '#ff0000');
    
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(barX, barY, barWidth, fillHeight);
    
    // Label
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '14px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('POWER', barX + barWidth / 2, barY - 10);
    
    // Mode indicator
    this.ctx.font = 'bold 16px Arial';
    this.ctx.fillStyle = isAimMode ? '#ffaa00' : '#00ff00';
    this.ctx.fillText(isAimMode ? 'AIM' : 'POWER', barX + barWidth / 2, barY + barHeight + 30);
    this.ctx.font = '12px Arial';
    this.ctx.fillStyle = '#cccccc';
    this.ctx.fillText('Press A to toggle', barX + barWidth / 2, barY + barHeight + 50);
    
    // Re-enter game space for subsequent drawing
    this.ctx.restore();
    this.ctx.save();
    const padding = 40;
    this.ctx.translate(padding, padding);
    this.ctx.scale(this.scale, this.scale);
  }
  
  getPowerBarBounds() {
    const barWidth = 30;
    const barHeight = 200;
    const barX = this.canvas.width - 60;
    const barY = (this.canvas.height - barHeight) / 2;
    return { x: barX, y: barY, width: barWidth, height: barHeight };
  }
}
