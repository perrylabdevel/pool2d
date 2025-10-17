// Rendering system
// Coordinate system: World uses center-origin Y-up, Canvas uses top-left Y-down
// Transform applied in render() to convert world->canvas

import { Ball, Rail, Pocket } from '../physics/Shapes';
import { PhysicsWorld } from '../physics/Physics';
import { CONFIG, BALL_CUE } from '../config';
import { getTableGeometry, computeBoundaryBounds, computePlayBoundaryPoints, type Vec2, type BoundaryBounds } from '../geometry/Geometry';
import { PredictionResult } from '../physics/Prediction';

export class Renderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  scale: number;
  private playBoundaryPoints: Vec2[] = [];
  private playBounds: BoundaryBounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.scale = CONFIG.CANVAS_SCALE;
    this.refreshDerivedGeometry();
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
    this.refreshDerivedGeometry();
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
    this.drawRailBackground();
    this.drawRails(world.rails);
    this.drawPockets(world.pockets);
    this.drawBalls(world.balls, alpha);
    
    this.ctx.restore();
  }
  
  drawPlayingSurface() {
    const boundary = this.playBoundaryPoints;
    if (boundary.length < 3) return;

    this.beginBoundaryPath(boundary);
    this.ctx.fillStyle = CONFIG.TABLE_COLOR;
    this.ctx.fill();

    // Felt texture inside play area
    this.ctx.save();
    this.beginBoundaryPath(boundary);
    this.ctx.clip();
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.02)';
    const geom = getTableGeometry();
    for (let i = 0; i < 120; i++) {
      const x = (Math.random() - 0.5) * geom.playWidthIn;
      const y = (Math.random() - 0.5) * geom.playHeightIn;
      this.ctx.fillRect(x, y, 0.4, 0.4);
    }
    this.ctx.restore();
  }

  private refreshDerivedGeometry() {
    this.playBoundaryPoints = computePlayBoundaryPoints(getTableGeometry().rails);
    this.playBounds = computeBoundaryBounds(this.playBoundaryPoints);
  }

  drawRailBackground() {
    // Rectangular background for the entire rail system
    // This encompasses all rails including corner pocket extensions
    const { minX, maxX, minY, maxY } = this.playBounds;
    
    // Extend slightly beyond the rail boundaries to ensure full coverage
    const padding = 0.5;
    
    this.ctx.fillStyle = '#2d1810'; // Dark wood color
    this.ctx.fillRect(
      minX - padding,
      minY - padding,
      (maxX - minX) + padding * 2,
      (maxY - minY) + padding * 2
    );
  }

  drawFrame() {
    const frameWidth = 6;
    const boundary = this.playBoundaryPoints;
    if (boundary.length < 3) {
      const geom = getTableGeometry();
      const halfW = geom.playWidthIn / 2;
      const halfH = geom.playHeightIn / 2;
      this.ctx.fillStyle = '#3d2413';
      this.ctx.fillRect(
        -halfW - frameWidth,
        -halfH - frameWidth,
        geom.playWidthIn + frameWidth * 2,
        geom.playHeightIn + frameWidth * 2
      );
      return;
    }

    // Outer frame rectangle with inner play boundary removed
    this.ctx.beginPath();
    const { minX, maxX, minY, maxY } = this.playBounds;
    this.ctx.moveTo(minX - frameWidth, minY - frameWidth);
    this.ctx.lineTo(maxX + frameWidth, minY - frameWidth);
    this.ctx.lineTo(maxX + frameWidth, maxY + frameWidth);
    this.ctx.lineTo(minX - frameWidth, maxY + frameWidth);
    this.ctx.closePath();
    this.beginBoundaryPath(boundary, false);
    this.ctx.fillStyle = '#3d2413';
    this.ctx.fill('evenodd');

    // Inner lip following cushion line
    this.beginBoundaryPath(boundary);
    this.ctx.strokeStyle = '#2d1810';
    this.ctx.lineWidth = frameWidth;
    this.ctx.lineJoin = 'round';
    this.ctx.stroke();
  }

  private beginBoundaryPath(points: Vec2[], close: boolean = true) {
    if (points.length === 0) return;
    this.ctx.beginPath();
    this.ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      this.ctx.lineTo(points[i].x, points[i].y);
    }
    if (close) {
      this.ctx.closePath();
    }
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
    this.ctx.lineWidth = CONFIG.RAIL_THICKNESS * 1;
    this.ctx.lineCap = 'round';
    
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
    // Draw pocket hole (black circle)
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
    // Ghost ball center is the contact point for ball collisions
    let ghostCenter: Vec2 | null = null;
    if (prediction && prediction.type === 'ball') {
      ghostCenter = { x: prediction.contactPoint.x, y: prediction.contactPoint.y };
    }
    
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
    const aimStart = { x, y };
    let aimRawEnd = { x: x + dx * CONFIG.AIM_LINE_LENGTH, y: y + dy * CONFIG.AIM_LINE_LENGTH };
    if (prediction) {
      if (prediction.type === 'ball' && ghostCenter) {
        aimRawEnd = ghostCenter;
      } else if (prediction.type === 'rail') {
        aimRawEnd = { x: prediction.contactPoint.x, y: prediction.contactPoint.y };
      }
    }
    const aimEnd = this.clampSegmentToPlayArea(aimStart, aimRawEnd);
    const aimStrokeWidth = 1 / this.scale;
    const aimDash = 6 / this.scale;
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    this.ctx.lineWidth = aimStrokeWidth;
    this.ctx.lineCap = 'round';
    this.ctx.setLineDash([aimDash, aimDash]);
    this.ctx.beginPath();
    this.ctx.moveTo(aimStart.x, aimStart.y);
    this.ctx.lineTo(aimEnd.x, aimEnd.y);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
    
    // Ghost ball at predicted contact point
    if (showGhost && prediction && prediction.type === 'ball' && ghostCenter) {
      const ghostX = ghostCenter.x;
      const ghostY = ghostCenter.y;
      
      // Draw semi-transparent ghost ball
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      this.ctx.lineWidth = aimStrokeWidth;
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
    
    const strokeWidth = 1 / this.scale;
    const dashLength = 6 / this.scale;
    const arrowLength = 8 / this.scale;
    
    // Ghost center is where the cue ball contacts the object ball
    // For ball collisions, this is the contact point (between the two ball surfaces)
    const ghostCenter = { x: prediction.contactPoint.x, y: prediction.contactPoint.y };

    const drawClampedLine = (start: Vec2, end: Vec2, color: string) => {
      const clampedEnd = this.clampSegmentToPlayArea(start, end);
      if (!clampedEnd) {
        return { drew: false, end, length: 0, dirX: 0, dirY: 0 };
      }
      const dirX = clampedEnd.x - start.x;
      const dirY = clampedEnd.y - start.y;
      const length = Math.sqrt(dirX * dirX + dirY * dirY);
      if (length <= 0.0001) {
        return { drew: false, end: clampedEnd, length: 0, dirX: 0, dirY: 0 };
      }
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = strokeWidth;
      this.ctx.lineCap = 'round';
      this.ctx.setLineDash([dashLength, dashLength]);
      this.ctx.beginPath();
      this.ctx.moveTo(start.x, start.y);
      this.ctx.lineTo(clampedEnd.x, clampedEnd.y);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
      return { drew: true, end: clampedEnd, length, dirX, dirY };
    };

    const drawArrow = (end: Vec2, dirX: number, dirY: number, color: string) => {
      const length = Math.sqrt(dirX * dirX + dirY * dirY);
      if (length <= arrowLength * 1.5) return;
      const normX = dirX / length;
      const normY = dirY / length;
      const baseX = end.x - normX * arrowLength;
      const baseY = end.y - normY * arrowLength;
      const leftX = baseX + (-normY) * (arrowLength * 0.5);
      const leftY = baseY + normX * (arrowLength * 0.5);
      const rightX = baseX - (-normY) * (arrowLength * 0.5);
      const rightY = baseY - normX * (arrowLength * 0.5);
      this.ctx.fillStyle = color;
      this.ctx.beginPath();
      this.ctx.moveTo(end.x, end.y);
      this.ctx.lineTo(leftX, leftY);
      this.ctx.lineTo(rightX, rightY);
      this.ctx.closePath();
      this.ctx.fill();
    };

    // Draw object ball trajectory (yellow dashed line with arrowhead)
    // Direction: from contact point toward where object ball will travel
    if (trajectories.objectBallPath) {
      const dirX = trajectories.objectBallPath.end.x - trajectories.objectBallPath.start.x;
      const dirY = trajectories.objectBallPath.end.y - trajectories.objectBallPath.start.y;
      const length = Math.sqrt(dirX * dirX + dirY * dirY);
      if (length > 0.0001) {
        const normX = dirX / length;
        const normY = dirY / length;
        const lineLength = 15; // Match the length passed to predictTrajectories
        const start = ghostCenter;
        const end = { x: start.x + normX * lineLength, y: start.y + normY * lineLength };
        const result = drawClampedLine(start, end, 'rgba(255, 255, 0, 0.6)');
        if (result.drew && result.length > 0) {
          drawArrow(result.end, result.dirX, result.dirY, 'rgba(255, 255, 0, 0.8)');
        }
      }
    }
    
    // Draw cue ball trajectory (white dashed line with arrowhead)
    // Direction: from contact point toward where cue ball will deflect
    if (trajectories.cueBallPath) {
      const dirX = trajectories.cueBallPath.end.x - trajectories.cueBallPath.start.x;
      const dirY = trajectories.cueBallPath.end.y - trajectories.cueBallPath.start.y;
      const length = Math.sqrt(dirX * dirX + dirY * dirY);
      if (length > 0.0001) {
        const normX = dirX / length;
        const normY = dirY / length;
        const lineLength = 15; // Match the length passed to predictTrajectories
        const start = ghostCenter;
        const end = { x: start.x + normX * lineLength, y: start.y + normY * lineLength };
        const result = drawClampedLine(start, end, 'rgba(255, 255, 255, 0.5)');
        if (result.drew && result.length > 0) {
          drawArrow(result.end, result.dirX, result.dirY, 'rgba(255, 255, 255, 0.7)');
        }
      }
    }
    
    this.ctx.restore();
  }

  /**
   * Draw simple math-based trajectory lines (for non-debug mode)
   * Uses predictTrajectories method for simple collision math
   * Styled with solid white lines + black glow (like ball appearance)
   */
  drawSimpleMathTrajectoryLines(
    prediction: PredictionResult,
    cueBallPos: { x: number; y: number },
    shotDirection: { x: number; y: number },
    predictor: any
  ) {
    if (prediction.type === 'none') return;
    
    this.ctx.save();
    
    // Use same transform as main render
    const canvasCenterX = this.canvas.width / 2;
    const canvasCenterY = this.canvas.height / 2;
    this.ctx.translate(canvasCenterX, canvasCenterY);
    this.ctx.scale(this.scale, -this.scale); // Y-up for world coords
    
    // Get simple trajectory predictions
    const trajectories = predictor.predictTrajectories(
      prediction,
      cueBallPos,
      shotDirection,
      50 // Line length in inches
    );
    
    const strokeWidth = 3 / this.scale;
    const glowWidth = 7 / this.scale;
    const arrowLength = 12 / this.scale;
    
    const ghostCenter = { x: prediction.contactPoint.x, y: prediction.contactPoint.y };
    
    const drawSolidLineWithGlow = (start: Vec2, end: Vec2, glowColor: string, lineColor: string) => {
      const clampedEnd = this.clampSegmentToPlayArea(start, end);
      if (!clampedEnd) return { drew: false, end, dirX: 0, dirY: 0 };
      
      const dirX = clampedEnd.x - start.x;
      const dirY = clampedEnd.y - start.y;
      const length = Math.sqrt(dirX * dirX + dirY * dirY);
      if (length <= 0.0001) return { drew: false, end: clampedEnd, dirX: 0, dirY: 0 };
      
      // Draw black glow (outer)
      this.ctx.strokeStyle = glowColor;
      this.ctx.lineWidth = glowWidth;
      this.ctx.lineCap = 'round';
      this.ctx.beginPath();
      this.ctx.moveTo(start.x, start.y);
      this.ctx.lineTo(clampedEnd.x, clampedEnd.y);
      this.ctx.stroke();
      
      // Draw solid white line (inner)
      this.ctx.strokeStyle = lineColor;
      this.ctx.lineWidth = strokeWidth;
      this.ctx.lineCap = 'round';
      this.ctx.beginPath();
      this.ctx.moveTo(start.x, start.y);
      this.ctx.lineTo(clampedEnd.x, clampedEnd.y);
      this.ctx.stroke();
      
      return { drew: true, end: clampedEnd, dirX, dirY };
    };
    
    const drawArrowWithGlow = (end: Vec2, dirX: number, dirY: number, glowColor: string, fillColor: string) => {
      const length = Math.sqrt(dirX * dirX + dirY * dirY);
      if (length <= arrowLength * 1.5) return;
      
      const normX = dirX / length;
      const normY = dirY / length;
      const baseX = end.x - normX * arrowLength;
      const baseY = end.y - normY * arrowLength;
      const leftX = baseX + (-normY) * (arrowLength * 0.5);
      const leftY = baseY + normX * (arrowLength * 0.5);
      const rightX = baseX - (-normY) * (arrowLength * 0.5);
      const rightY = baseY - normX * (arrowLength * 0.5);
      
      // Draw black glow for arrow
      this.ctx.fillStyle = glowColor;
      this.ctx.beginPath();
      this.ctx.moveTo(end.x, end.y);
      this.ctx.lineTo(leftX - normX * 2 / this.scale, leftY - normY * 2 / this.scale);
      this.ctx.lineTo(rightX - normX * 2 / this.scale, rightY - normY * 2 / this.scale);
      this.ctx.closePath();
      this.ctx.fill();
      
      // Draw white arrow fill
      this.ctx.fillStyle = fillColor;
      this.ctx.beginPath();
      this.ctx.moveTo(end.x, end.y);
      this.ctx.lineTo(leftX, leftY);
      this.ctx.lineTo(rightX, rightY);
      this.ctx.closePath();
      this.ctx.fill();
    };
    
    // Draw object ball trajectory (solid white with black glow)
    if (trajectories.objectBallPath) {
      const dirX = trajectories.objectBallPath.end.x - trajectories.objectBallPath.start.x;
      const dirY = trajectories.objectBallPath.end.y - trajectories.objectBallPath.start.y;
      const length = Math.sqrt(dirX * dirX + dirY * dirY);
      if (length > 0.0001) {
        const normX = dirX / length;
        const normY = dirY / length;
        const lineLength = 50;
        const start = ghostCenter;
        const end = { x: start.x + normX * lineLength, y: start.y + normY * lineLength };
        const result = drawSolidLineWithGlow(start, end, 'rgba(0, 0, 0, 0.8)', 'rgba(255, 255, 255, 0.95)');
        if (result.drew) {
          drawArrowWithGlow(result.end, result.dirX, result.dirY, 'rgba(0, 0, 0, 0.8)', 'rgba(255, 255, 255, 0.95)');
        }
      }
    }
    
    // Draw cue ball trajectory (solid white with black glow)
    if (trajectories.cueBallPath) {
      const dirX = trajectories.cueBallPath.end.x - trajectories.cueBallPath.start.x;
      const dirY = trajectories.cueBallPath.end.y - trajectories.cueBallPath.start.y;
      const length = Math.sqrt(dirX * dirX + dirY * dirY);
      if (length > 0.0001) {
        const normX = dirX / length;
        const normY = dirY / length;
        const lineLength = 50;
        const start = ghostCenter;
        const end = { x: start.x + normX * lineLength, y: start.y + normY * lineLength };
        const result = drawSolidLineWithGlow(start, end, 'rgba(0, 0, 0, 0.8)', 'rgba(255, 255, 255, 0.95)');
        if (result.drew) {
          drawArrowWithGlow(result.end, result.dirX, result.dirY, 'rgba(0, 0, 0, 0.8)', 'rgba(255, 255, 255, 0.95)');
        }
      }
    }
    
    this.ctx.restore();
  }
  
  /**
   * Draw physics-based trajectory lines (for debug mode)
   * Placeholder for compatibility with 3D renderer
   */
  drawPhysicsTrajectoryLines(_shotPaths: any, _cueBallPos: { x: number; y: number }, _debugMode: boolean = false) {
    // Not implemented for 2D renderer - would need to import ShotPreviewPaths type
    // For now, falls back to simple math trajectories
  }

  private clampSegmentToPlayArea(start: Vec2, end: Vec2): Vec2 {
    if (this.isPointInsidePlayArea(end)) {
      return end;
    }
    const intersection = this.intersectSegmentWithBoundary(start, end);
    return intersection ?? end;
  }

  private isPointInsidePlayArea(point: Vec2): boolean {
    const boundary = this.playBoundaryPoints;
    if (boundary.length < 3) return true;
    let inside = false;
    for (let i = 0, j = boundary.length - 1; i < boundary.length; j = i++) {
      const xi = boundary[i].x;
      const yi = boundary[i].y;
      const xj = boundary[j].x;
      const yj = boundary[j].y;
      const intersect = (yi > point.y) !== (yj > point.y) &&
        point.x < ((xj - xi) * (point.y - yi)) / (yj - yi + 1e-9) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  private intersectSegmentWithBoundary(start: Vec2, end: Vec2): Vec2 | null {
    const boundary = this.playBoundaryPoints;
    if (boundary.length < 2) return null;
    let closestT = Infinity;
    let closestPoint: Vec2 | null = null;
    const dirX = end.x - start.x;
    const dirY = end.y - start.y;
    for (let i = 0; i < boundary.length; i++) {
      const a = boundary[i];
      const b = boundary[(i + 1) % boundary.length];
      const edgeX = b.x - a.x;
      const edgeY = b.y - a.y;
      const denom = dirX * (-edgeY) + dirY * edgeX;
      if (Math.abs(denom) < 1e-9) continue;
      const diffX = start.x - a.x;
      const diffY = start.y - a.y;
      const t = (diffX * (-edgeY) + diffY * edgeX) / denom;
      const u = (diffX * dirY - diffY * dirX) / denom;
      if (t > 0 && t <= 1 && u >= 0 && u <= 1) {
        if (t < closestT) {
          closestT = t;
          closestPoint = {
            x: start.x + dirX * t,
            y: start.y + dirY * t,
          };
        }
      }
    }
    return closestPoint;
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
