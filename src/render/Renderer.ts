// Rendering system
// Coordinate system: World uses center-origin Y-up, Canvas uses top-left Y-down
// Transform applied in render() to convert world->canvas

import { Ball, Rail, Pocket } from '../physics/Shapes';
import { PhysicsWorld } from '../physics/Physics';
import { CONFIG, BALL_CUE } from '../config';
import { TABLE_GEOMETRY } from '../geometry/Geometry';
import { PredictionResult, ShotPreviewPaths } from '../physics/Prediction';

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
    this.drawPlayingSurface();
    this.drawFrame();
    this.drawRails(world.rails);
    this.drawPockets(world.pockets);
    this.drawBalls(world.balls, alpha);
    
    this.ctx.restore();
  }
  
  drawPlayingSurface() {
    // Draw felt surface (center-origin coordinates)
    const halfW = TABLE_GEOMETRY.playWidthIn / 2;
    const halfH = TABLE_GEOMETRY.playHeightIn / 2;
    
    this.ctx.fillStyle = CONFIG.TABLE_COLOR;
    this.ctx.fillRect(-halfW, -halfH, TABLE_GEOMETRY.playWidthIn, TABLE_GEOMETRY.playHeightIn);
    
    // Add subtle felt texture
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.02)';
    for (let i = 0; i < 100; i++) {
      const x = (Math.random() - 0.5) * TABLE_GEOMETRY.playWidthIn;
      const y = (Math.random() - 0.5) * TABLE_GEOMETRY.playHeightIn;
      this.ctx.fillRect(x, y, 0.5, 0.5);
    }
  }
  
  drawFrame() {
    const frameWidth = 6;
    const halfW = TABLE_GEOMETRY.playWidthIn / 2;
    const halfH = TABLE_GEOMETRY.playHeightIn / 2;
    
    // Draw wood frame around the outside (center-origin)
    this.ctx.strokeStyle = '#3d2413';
    this.ctx.lineWidth = frameWidth;
    this.ctx.lineJoin = 'miter';
    
    // Outer edge of frame
    this.ctx.strokeRect(
      -halfW - frameWidth/2, 
      -halfH - frameWidth/2, 
      TABLE_GEOMETRY.playWidthIn + frameWidth, 
      TABLE_GEOMETRY.playHeightIn + frameWidth
    );
    
    // Inner edge highlight
    this.ctx.strokeStyle = '#2d1810';
    this.ctx.lineWidth = frameWidth - 1;
    this.ctx.strokeRect(
      -halfW - frameWidth/2, 
      -halfH - frameWidth/2, 
      TABLE_GEOMETRY.playWidthIn + frameWidth, 
      TABLE_GEOMETRY.playHeightIn + frameWidth
    );
  }
  
  drawPockets(pockets: Pocket[]) {
    pockets.forEach((pocket) => this.drawPocket(pocket));
  }
  
  drawRails(rails: Rail[]) {
    // Group rails by cushion ID to draw complete polygons
    const cushionMap = new Map<string, Rail[]>();

    rails.forEach((rail) => {
      if (!cushionMap.has(rail.cushionId)) {
        cushionMap.set(rail.cushionId, []);
      }
      cushionMap.get(rail.cushionId)!.push(rail);
    });

    // Draw each cushion as a filled polygon
    cushionMap.forEach((railSegments, cushionId) => {
      this.drawCushionPolygon(railSegments, cushionId);
    });
  }
  
  drawBalls(balls: Ball[], alpha: number) {
    balls.forEach((ball) => {
      if (!ball.pocketed) {
        this.drawBall(ball, alpha);
      }
    });
  }
  
  drawCushionPolygon(railSegments: Rail[], cushionId: string) {
    if (railSegments.length === 0) return;

    // Extract polygon vertices from rail segments
    // Each rail segment contributes its first point; the last point closes the loop
    const vertices: { x: number; y: number }[] = [];

    // Sort segments to form a continuous polygon (they should already be in order)
    railSegments.forEach((rail) => {
      vertices.push({ x: rail.x1, y: rail.y1 });
    });

    if (vertices.length < 3) return; // Need at least 3 points for a polygon

    // Draw filled cushion polygon
    this.ctx.fillStyle = '#0d3d0d'; // Dark green cushion color
    this.ctx.beginPath();
    this.ctx.moveTo(vertices[0].x, vertices[0].y);
    for (let i = 1; i < vertices.length; i++) {
      this.ctx.lineTo(vertices[i].x, vertices[i].y);
    }
    this.ctx.closePath();
    this.ctx.fill();

    // Draw lighter inner highlight for 3D effect
    this.ctx.strokeStyle = '#1a5d1a';
    this.ctx.lineWidth = 0.5;
    this.ctx.beginPath();
    this.ctx.moveTo(vertices[0].x, vertices[0].y);
    for (let i = 1; i < vertices.length; i++) {
      this.ctx.lineTo(vertices[i].x, vertices[i].y);
    }
    this.ctx.closePath();
    this.ctx.stroke();

    // ALWAYS draw physics collision edges prominently (bright yellow)
    railSegments.forEach((rail) => {
      this.ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)'; // Bright yellow
      this.ctx.lineWidth = 0.3;
      this.ctx.beginPath();
      this.ctx.moveTo(rail.x1, rail.y1);
      this.ctx.lineTo(rail.x2, rail.y2);
      this.ctx.stroke();

      // Draw endpoint markers
      this.ctx.fillStyle = 'rgba(255, 0, 0, 0.9)'; // Red dots
      this.ctx.beginPath();
      this.ctx.arc(rail.x1, rail.y1, 0.3, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.beginPath();
      this.ctx.arc(rail.x2, rail.y2, 0.3, 0, Math.PI * 2);
      this.ctx.fill();
    });

    // Optional normal debug visualization for geometry validation
    if (CONFIG.DEBUG_DRAW_NORMALS) {
      railSegments.forEach((rail) => {
        const midX = (rail.x1 + rail.x2) / 2;
        const midY = (rail.y1 + rail.y2) / 2;
        this.ctx.strokeStyle = 'rgba(0, 255, 0, 0.6)';
        this.ctx.lineWidth = 0.15;
        this.ctx.beginPath();
        this.ctx.moveTo(midX, midY);
        this.ctx.lineTo(midX + rail.nx * 3, midY + rail.ny * 3);
        this.ctx.stroke();
      });
    }
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
    
    // Calculate rotation angle: rolling rotation + initial random orientation
    // When ball is moving, use accumulated angle; when at rest, use rotationZ for variety
    const rotationAngle = ball.angularVelocity > 0.001 ? ball.angle : ball.rotationZ;
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
  
  drawCueAndPowerBar(ball: Ball, angle: number, power: number, showGhost: boolean, showPowerBar: boolean, isAimMode: boolean, prediction?: PredictionResult, isFineAimMode?: boolean, isUltraFineMode?: boolean, isSpacebarMode?: boolean) {
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
      this.drawPowerBar(power, isAimMode, isFineAimMode, isUltraFineMode, isSpacebarMode);
    }

    this.ctx.restore();
  }
  
  drawTrajectoryLines(
    prediction: PredictionResult,
    cueBallPos: { x: number; y: number },
    shotDirection: { x: number; y: number },
    preview?: ShotPreviewPaths
  ) {
    if (prediction.type === 'none' || !preview) return;

    this.ctx.save();

    const canvasCenterX = this.canvas.width / 2;
    const canvasCenterY = this.canvas.height / 2;
    this.ctx.translate(canvasCenterX, canvasCenterY);
    this.ctx.scale(this.scale, -this.scale);

    const drawPath = (points: { x: number; y: number }[], strokeStyle: string, arrowStyle: string) => {
      if (!points || points.length < 2) return;

      const sampled: { x: number; y: number }[] = [];
      for (let i = 0; i < points.length; i++) {
        if (i === 0 || i === points.length - 1 || i % 2 === 0) {
          sampled.push(points[i]);
        }
      }

      if (sampled.length === 1 && points.length >= 2) {
        sampled.push(points[points.length - 1]);
      }

      if (sampled.length < 2) return;

      this.ctx.strokeStyle = strokeStyle;
      this.ctx.lineWidth = 0.1;
      this.ctx.setLineDash([1, 1]);
      this.ctx.beginPath();
      this.ctx.moveTo(sampled[0].x, sampled[0].y);
      for (let i = 1; i < sampled.length; i++) {
        this.ctx.lineTo(sampled[i].x, sampled[i].y);
      }
      this.ctx.stroke();
      this.ctx.setLineDash([]);

      const last = sampled[sampled.length - 1];
      const prev = sampled[sampled.length - 2];
      const dx = last.x - prev.x;
      const dy = last.y - prev.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0.01) {
        const arrowSize = 1.5;
        const angle = Math.atan2(dy, dx);
        this.ctx.fillStyle = arrowStyle;
        this.ctx.beginPath();
        this.ctx.moveTo(last.x, last.y);
        this.ctx.lineTo(
          last.x - arrowSize * Math.cos(angle - Math.PI / 6),
          last.y - arrowSize * Math.sin(angle - Math.PI / 6)
        );
        this.ctx.lineTo(
          last.x - arrowSize * Math.cos(angle + Math.PI / 6),
          last.y - arrowSize * Math.sin(angle + Math.PI / 6)
        );
        this.ctx.closePath();
        this.ctx.fill();
      }
    };

    const trimPathFromContact = (points: { x: number; y: number }[], contact: { x: number; y: number }) => {
      if (!points || points.length === 0) return points;
      let closestIndex = 0;
      let closestDist = Number.MAX_VALUE;
      for (let i = 0; i < points.length; i++) {
        const dx = points[i].x - contact.x;
        const dy = points[i].y - contact.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < closestDist) {
          closestDist = distSq;
          closestIndex = i;
        }
      }

      const trimmed = points.slice(closestIndex);
      if (trimmed.length === 0 || closestDist > 0.25) {
        trimmed.unshift({ x: contact.x, y: contact.y });
      }
      return trimmed;
    };

    let cuePath = trimPathFromContact(preview.cuePath, prediction.contactPoint);
    if (cuePath.length < 2) {
      const fallbackDistance = 6;
      cuePath = [
        { x: prediction.contactPoint.x, y: prediction.contactPoint.y },
        {
          x: prediction.contactPoint.x + shotDirection.x * fallbackDistance,
          y: prediction.contactPoint.y + shotDirection.y * fallbackDistance,
        },
      ];
    }
    drawPath(cuePath, 'rgba(255, 255, 255, 0.5)', 'rgba(255, 255, 255, 0.7)');

    if (prediction.type === 'ball' && prediction.hitBall) {
      let objectPath = preview.objectPaths.get(prediction.hitBall.id);
      if (!objectPath || objectPath.length < 2) {
        const fallbackDistance = 12;
        objectPath = [
          { x: prediction.hitBall.x, y: prediction.hitBall.y },
          {
            x: prediction.hitBall.x + prediction.contactNormal.x * fallbackDistance,
            y: prediction.hitBall.y + prediction.contactNormal.y * fallbackDistance,
          },
        ];
      }

      drawPath(objectPath, 'rgba(255, 255, 0, 0.6)', 'rgba(255, 255, 0, 0.8)');
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
  
  drawPowerBar(power: number, isAimMode: boolean, isFineAimMode?: boolean, isUltraFineMode?: boolean, isSpacebarMode?: boolean) {
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
    if (isSpacebarMode) {
      this.ctx.fillStyle = '#00ff00'; // Green for instant shoot mode
      this.ctx.fillText('SHOOT', barX + barWidth / 2, barY + barHeight + 30);
      this.ctx.font = '12px Arial';
      this.ctx.fillStyle = '#cccccc';
      this.ctx.fillText('Release Space', barX + barWidth / 2, barY + barHeight + 50);
    } else {
      this.ctx.fillStyle = isAimMode ? '#ffaa00' : '#00ff00';
      this.ctx.fillText(isAimMode ? 'AIM' : 'POWER', barX + barWidth / 2, barY + barHeight + 30);
      this.ctx.font = '12px Arial';
      this.ctx.fillStyle = '#cccccc';
      this.ctx.fillText('Press A to toggle', barX + barWidth / 2, barY + barHeight + 50);
    }

    // Precision mode indicators or spacebar mode instructions
    if (isSpacebarMode) {
      // Spacebar mode: show power adjustment instructions
      this.ctx.font = 'bold 14px Arial';
      this.ctx.fillStyle = '#ffff00'; // Yellow for spacebar mode
      this.ctx.fillText('LOCKED AIM', barX + barWidth / 2, barY + barHeight + 70);
      this.ctx.font = '11px Arial';
      this.ctx.fillStyle = '#888888';
      this.ctx.fillText('Move mouse ↑↓', barX + barWidth / 2, barY + barHeight + 88);
      this.ctx.font = '10px Arial';
      this.ctx.fillStyle = '#777777';
      this.ctx.fillText('or ↑ ↓ keys', barX + barWidth / 2, barY + barHeight + 103);
    } else if (isAimMode) {
      if (isUltraFineMode) {
        // Ultra-fine mode (Shift + Ctrl)
        this.ctx.font = 'bold 14px Arial';
        this.ctx.fillStyle = '#ff00ff'; // Magenta for ultra-fine
        this.ctx.fillText('ULTRA FINE', barX + barWidth / 2, barY + barHeight + 70);
        this.ctx.font = '10px Arial';
        this.ctx.fillStyle = '#aaaaaa';
        this.ctx.fillText('0.02°/press', barX + barWidth / 2, barY + barHeight + 88);
      } else if (isFineAimMode) {
        // Fine mode (Shift only)
        this.ctx.font = 'bold 14px Arial';
        this.ctx.fillStyle = '#00ffff'; // Cyan for fine
        this.ctx.fillText('FINE AIM', barX + barWidth / 2, barY + barHeight + 70);
        this.ctx.font = '10px Arial';
        this.ctx.fillStyle = '#aaaaaa';
        this.ctx.fillText('0.1°/press', barX + barWidth / 2, barY + barHeight + 88);
      } else {
        // Normal mode
        this.ctx.font = '11px Arial';
        this.ctx.fillStyle = '#888888';
        this.ctx.fillText('← → arrows (0.5°)', barX + barWidth / 2, barY + barHeight + 70);
        this.ctx.font = '10px Arial';
        this.ctx.fillStyle = '#777777';
        this.ctx.fillText('+ Shift (0.1°)', barX + barWidth / 2, barY + barHeight + 86);
        this.ctx.fillText('+ Shift+Ctrl (0.02°)', barX + barWidth / 2, barY + barHeight + 100);
        this.ctx.font = '11px Arial';
        this.ctx.fillStyle = '#666666';
        this.ctx.fillText('Hold Space = shoot', barX + barWidth / 2, barY + barHeight + 116);
      }
    }
    
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
