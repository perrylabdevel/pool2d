// Rendering system
// Coordinate system: World uses center-origin Y-up, Canvas uses top-left Y-down
// Transform applied in render() to convert world->canvas

import { Ball, Rail } from '../physics/Shapes';
import { PhysicsWorld } from '../physics/Physics';
import { CONFIG, BALL_CUE } from '../config';
import { getTableGeometry, type Vec2, type PocketDef } from '../geometry/Geometry';
import {
  lightenHexColor,
  darkenHexColor,
  classifyAxisAlignmentFromVector,
  getAxisPalette,
  type AxisAlignment,
  type AxisColorPalette,
} from './RenderUtils';
import { BaseRenderer } from './BaseRenderer';
import { ColorTokens } from '../ui/theme/ColorTokens';
import { LayoutConstants } from '../ui/theme/LayoutConstants';
import { TextureCache } from '../textures/TextureCache';
import { TextureConfig, TEXTURE_PRESETS } from '../textures/TextureConfig';

import { PredictionResult } from '../physics/Prediction';
import type { MicroDialRenderState, PocketAnimationEvent } from './ControlTypes';

type FrameClipInfo = {
  outerX: number;
  outerY: number;
  radius: number;
};

type PocketDropAnimation = {
  event: PocketAnimationEvent;
  startTime: number;
  duration: number;
};

type IconCacheEntry = {
  img: HTMLImageElement;
  ready: boolean;
  failed: boolean;
};

export class Renderer extends BaseRenderer {
  ctx: CanvasRenderingContext2D;
  private frameClipInfo: FrameClipInfo | null = null;
  private queuedPocketEvents: PocketAnimationEvent[] = [];
  private pocketAnimations: PocketDropAnimation[] = [];
  private pocketIconCache: Map<string, IconCacheEntry> = new Map();
  private shakeState: { start: number; duration: number; strength: number; seed: number } | null = null;

  private feltTexture: HTMLCanvasElement | null = null;
  private railTexture: HTMLCanvasElement | null = null;

  constructor(canvas: HTMLCanvasElement) {
    super(canvas, CONFIG.CANVAS_SCALE);
    this.ctx = canvas.getContext('2d')!;
    this.loadDefaultTextures();
  }

  private loadDefaultTextures(): void {
    // Load from localStorage or use defaults
    const feltConfig = this.loadTextureConfig('felt') || TEXTURE_PRESETS.felt_green_classic;
    const railConfig = this.loadTextureConfig('rail') || TEXTURE_PRESETS.rail_oak;

    this.feltTexture = TextureCache.get(feltConfig);
    this.railTexture = TextureCache.get(railConfig);
  }

  applyTexture(type: 'felt' | 'rail', config: TextureConfig): void {
    TextureCache.clear(); // Clear cache to force regeneration

    if (type === 'felt') {
      this.feltTexture = TextureCache.get(config);
    } else if (type === 'rail') {
      this.railTexture = TextureCache.get(config);
    }

    // Save to localStorage
    this.saveTextureConfig(type, config);
  }

  private saveTextureConfig(type: string, config: TextureConfig): void {
    localStorage.setItem(`texture_${type}`, JSON.stringify(config));
  }

  private loadTextureConfig(type: string): TextureConfig | null {
    const json = localStorage.getItem(`texture_${type}`);
    return json ? JSON.parse(json) : null;
  }

  resize() {
    const container = this.canvas.parentElement!;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    // External margin around canvas
    const externalMargin = LayoutConstants.Spacing.ExternalMargin;

    // Internal padding within canvas (around table)
    // Ensure cue stick is fully visible when the cue ball is near rails
    const cueReach = (CONFIG.BALL_RADIUS + 25) + (CONFIG.CUE_VISUAL_PADDING_IN ?? 0);
    const internalPadding = Math.max(LayoutConstants.Spacing.InternalPadding, cueReach);

    // Calculate available space for canvas after external margins
    const availableWidth = containerWidth - externalMargin * 2;
    const availableHeight = containerHeight - externalMargin * 2;

    const scaleMultiplier = CONFIG.CANVAS_SCALE_MULTIPLIER ?? 1;
    const adjustedWidth = availableWidth / Math.max(0.01, scaleMultiplier);
    const adjustedHeight = availableHeight / Math.max(0.01, scaleMultiplier);
    const scaleX = (adjustedWidth - internalPadding * 2) / CONFIG.TABLE_WIDTH;
    const scaleY = (adjustedHeight - internalPadding * 2) / CONFIG.TABLE_HEIGHT;
    const baseScale = Math.min(scaleX, scaleY);
    this.scale = baseScale * scaleMultiplier;

    // Set canvas size (table + internal padding only)
    this.canvas.width = CONFIG.TABLE_WIDTH * this.scale + internalPadding * 2;
    this.canvas.height = CONFIG.TABLE_HEIGHT * this.scale + internalPadding * 2;

    // Set canvas display size
    this.canvas.style.width = `${this.canvas.width}px`;
    this.canvas.style.height = `${this.canvas.height}px`;
  }

  clear() {
    this.ctx.fillStyle = ColorTokens.background.canvas;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  render(world: PhysicsWorld, alpha: number) {
    this.refreshDerivedGeometry(); // Update geometry if CONFIG changed
    this.clear();

    this.ctx.save();

    // Set up world->canvas transform
    // World: origin at table center, +X=right, +Y=up
    // Canvas: origin at top-left, +X=right, +Y=down
    const canvasCenterX = this.canvas.width / 2;
    const canvasCenterY = this.canvas.height / 2;

    this.ctx.translate(canvasCenterX, canvasCenterY);
    this.ctx.scale(this.scale, -this.scale); // Negative Y to flip vertical axis

    const shakeOffset = this.computeShakeOffset();
    this.applyShakeTransform(shakeOffset.x, shakeOffset.y);

    // Draw in correct order: bottom to top
    const tableGeom = getTableGeometry();

    // Draw play elements first, then overlay frame to mask any bleed outside
    this.drawPlayingSurface();
    this.drawRailBackground();
    this.drawRails(world.rails);
    this.drawPockets(tableGeom.pockets);
    this.drawFrame();
    this.drawBalls(world.balls, alpha);

    this.ctx.restore();

    this.processPocketAnimationQueue();
    this.drawPocketAnimations();
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

    if (this.feltTexture) {
      const pattern = this.ctx.createPattern(this.feltTexture, 'repeat');
      if (pattern) {
        this.ctx.fillStyle = pattern;
        this.ctx.fill();
      }
    } else {
      // Fallback to simple noise
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.02)';
      const geom = getTableGeometry();
      for (let i = 0; i < 120; i++) {
        const x = (Math.random() - 0.5) * geom.playWidthIn;
        const y = (Math.random() - 0.5) * geom.playHeightIn;
        this.ctx.fillRect(x, y, 0.4, 0.4);
      }
    }
    this.ctx.restore();
  }

  drawRailBackground() {
    // Clip rail background to the outer frame so it never escapes rounded corners
    const geom = getTableGeometry();
    const { frameOutline } = geom;
    const outerX = frameOutline.outerHalfWidth;
    const outerY = frameOutline.outerHalfHeight;
    const innerX = frameOutline.innerHalfWidth;
    const innerY = frameOutline.innerHalfHeight;
    const cornerRadius = Math.max(0, Math.min(frameOutline.cornerRadius, outerX, outerY));

    // Build a donut clip: outer rounded rect minus the inner rectangle (frame hollow)
    this.ctx.save();
    this.ctx.beginPath();
    this.traceRoundedRectPath(this.ctx, outerX, outerY, cornerRadius);
    this.ctx.rect(-innerX, -innerY, innerX * 2, innerY * 2);
    this.ctx.clip('evenodd');

    // Fill a padded rect under rails; clipping keeps it inside frame bounds
    const { minX, maxX, minY, maxY } = this.playBounds;
    const padding = 0.5;
    // Use frame color so any overlap with frame remains visually consistent
    if (this.railTexture) {
      const pattern = this.ctx.createPattern(this.railTexture, 'repeat');
      if (pattern) {
        this.ctx.fillStyle = pattern;
      } else {
        this.ctx.fillStyle = CONFIG.FRAME_COLOR ?? '#3d2413';
      }
    } else {
      this.ctx.fillStyle = CONFIG.FRAME_COLOR ?? '#3d2413';
    }

    this.ctx.fillRect(
      minX - padding,
      minY - padding,
      (maxX - minX) + padding * 2,
      (maxY - minY) + padding * 2
    );

    this.ctx.restore();
  }

  drawFrame() {
    const geom = getTableGeometry();
    const { frameOutline } = geom;
    const outerX = frameOutline.outerHalfWidth;
    const outerY = frameOutline.outerHalfHeight;
    const innerX = frameOutline.innerHalfWidth;
    const innerY = frameOutline.innerHalfHeight;
    const cornerRadius = Math.max(
      0,
      Math.min(frameOutline.cornerRadius, outerX, outerY)
    );

    if (this.railTexture) {
      const pattern = this.ctx.createPattern(this.railTexture, 'repeat');
      if (pattern) {
        this.ctx.fillStyle = pattern;
      } else {
        this.ctx.fillStyle = CONFIG.FRAME_COLOR ?? '#3d2413';
      }
    } else {
      this.ctx.fillStyle = CONFIG.FRAME_COLOR ?? '#3d2413';
    }

    this.ctx.beginPath();
    this.traceRoundedRectPath(this.ctx, outerX, outerY, cornerRadius);
    this.ctx.rect(-innerX, -innerY, innerX * 2, innerY * 2);
    this.ctx.fill('evenodd');
  }

  protected override refreshDerivedGeometry(): void {
    super.refreshDerivedGeometry();
  }

  private traceRoundedRectPath(
    ctx: CanvasRenderingContext2D,
    halfWidth: number,
    halfHeight: number,
    radius: number
  ) {
    const r = Math.max(0, Math.min(radius, halfWidth, halfHeight));
    ctx.moveTo(halfWidth, halfHeight - r);
    ctx.arcTo(halfWidth, halfHeight, halfWidth - r, halfHeight, r);
    ctx.lineTo(-halfWidth + r, halfHeight);
    ctx.arcTo(-halfWidth, halfHeight, -halfWidth, halfHeight - r, r);
    ctx.lineTo(-halfWidth, -halfHeight + r);
    ctx.arcTo(-halfWidth, -halfHeight, -halfWidth + r, -halfHeight, r);
    ctx.lineTo(halfWidth - r, -halfHeight);
    ctx.arcTo(halfWidth, -halfHeight, halfWidth, -halfHeight + r, r);
    ctx.closePath();
  }

  private intersectLineWithCornerArc(
    start: Vec2,
    dir: Vec2,
    signX: number,
    signY: number,
    clip: FrameClipInfo
  ): { t: number; point: Vec2 } | null {
    const a = dir.x * dir.x + dir.y * dir.y;
    if (a < 1e-8) return null;

    const centerX = (signX >= 0 ? 1 : -1) * (clip.outerX - clip.radius);
    const centerY = (signY >= 0 ? 1 : -1) * (clip.outerY - clip.radius);

    const ox = start.x - centerX;
    const oy = start.y - centerY;

    const b = 2 * (dir.x * ox + dir.y * oy);
    const c = ox * ox + oy * oy - clip.radius * clip.radius;
    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return null;
    const sqrt = Math.sqrt(discriminant);

    const tCandidates = [
      (-b - sqrt) / (2 * a),
      (-b + sqrt) / (2 * a),
    ];

    let bestT: number | null = null;
    for (const candidate of tCandidates) {
      if (candidate > 1e-4 && candidate <= 1.5) {
        if (bestT == null || candidate < bestT) {
          bestT = candidate;
        }
      }
    }

    if (bestT === null) return null;

    const point = {
      x: start.x + dir.x * bestT,
      y: start.y + dir.y * bestT,
    };
    return { t: bestT, point };
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

  drawPocket(pocket: PocketDef) {
    const radius = pocket.visualRadius ?? pocket.radius;
    const angleRad = (pocket.cutAngleDeg ?? 0) * (Math.PI / 180);
    const { x, y } = pocket.center;

    // Map shelf depth to a 0..1 visual factor so deeper pockets look darker
    // The slider goes 0-3, we normalize to 0-1 range for visual effects
    // Using the full slider range: 0 = shallow (0%), 3 = deep (100%)
    const shelf = pocket.shelfDepth ?? CONFIG.POCKET_SHELF_DEPTH_IN ?? 0.5;
    const depthFactor = Math.max(0, Math.min(1, shelf / 3.0));

    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(angleRad);

    // Draw pocket hole (base)
    this.ctx.fillStyle = CONFIG.POCKET_COLOR;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, radius, 0, Math.PI * 2);
    this.ctx.fill();

    // Inner shadow scaled by depth (deeper = darker and broader)
    const gradient = this.ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
    const centerAlpha = 0.7 + 0.3 * depthFactor; // 0.7..1.0
    const edgeAlpha = 0.12 + 0.35 * depthFactor; // 0.12..0.47
    gradient.addColorStop(0, `rgba(0, 0, 0, ${centerAlpha.toFixed(3)})`);
    gradient.addColorStop(1, `rgba(20, 20, 20, ${edgeAlpha.toFixed(3)})`);

    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, radius, 0, Math.PI * 2);
    this.ctx.fill();

    // Directional highlight wedge reduced by depth (shallow = more highlight)
    const wedgeAngle = Math.PI / 3;
    const highlightAlpha = 0.12 * (1 - 0.7 * depthFactor); // 0.12..~0.036
    if (highlightAlpha > 0.005) {
      this.ctx.fillStyle = `rgba(255, 255, 255, ${highlightAlpha.toFixed(3)})`;
      this.ctx.beginPath();
      this.ctx.moveTo(0, 0);
      this.ctx.arc(0, 0, radius * 1.05, -wedgeAngle / 2, wedgeAngle / 2);
      this.ctx.closePath();
      this.ctx.fill();
    }

    // Darken opposite wedge for contrast (slightly scaled with depth)
    const oppositeAlpha = 0.14 + 0.08 * depthFactor; // 0.14..0.22
    this.ctx.fillStyle = `rgba(0, 0, 0, ${oppositeAlpha.toFixed(3)})`;
    this.ctx.beginPath();
    this.ctx.moveTo(0, 0);
    this.ctx.arc(0, 0, radius, Math.PI - wedgeAngle / 2, Math.PI + wedgeAngle / 2);
    this.ctx.closePath();
    this.ctx.fill();

    // Subtle bottom groove ring near the deepest area (stronger with depth)
    const grooveThickness = Math.max(1, radius * 0.08);
    const grooveInner = radius * (0.18 + 0.22 * depthFactor);
    const grooveOuter = grooveInner + grooveThickness;
    // Subtle dark groove for depth
    const grooveAlpha = 0.08 + 0.22 * depthFactor; // 0.08..0.30
    this.ctx.fillStyle = `rgba(0, 0, 0, ${grooveAlpha.toFixed(3)})`;
    this.ctx.beginPath();
    // Outer circle
    this.ctx.arc(0, 0, grooveOuter, 0, Math.PI * 2);
    // Inner cutout
    this.ctx.arc(0, 0, grooveInner, 0, Math.PI * 2, true);
    this.ctx.closePath();
    this.ctx.fill('evenodd');

    // Very faint thin white outline on groove edges for readability
    const pixelWidth = 0.75 / Math.max(1e-6, (this as any).scale ?? 1);
    const strokeWidth = Math.max(pixelWidth, radius * 0.01);
    this.ctx.lineWidth = strokeWidth;
    this.ctx.strokeStyle = `rgba(255, 255, 255, ${(0.10 * (1 - 0.3 * depthFactor)).toFixed(3)})`;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, grooveInner, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.beginPath();
    this.ctx.arc(0, 0, grooveOuter, 0, Math.PI * 2);
    this.ctx.stroke();

    this.ctx.restore();
  }

  drawPockets(pockets: PocketDef[]) {
    pockets.forEach((pocket) => this.drawPocket(pocket));
  }

  drawRails(rails: Rail[]) {
    this.frameClipInfo = null;
    this.debugRailSegments = [];

    this.ctx.save();
    rails.forEach((rail) => this.drawRail(rail));
    this.ctx.restore();
    this.frameClipInfo = null;
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
    const width = CONFIG.RAIL_THICKNESS_INNER + CONFIG.RAIL_THICKNESS_OUTER;
    const clip = this.frameClipInfo;
    const hasRoundedFrame = !!clip && clip.radius > 1e-4;
    const isCornerTaper = (rail.id ?? '').endsWith('_taper');

    let x1 = rail.x1;
    let y1 = rail.y1;
    let x2 = rail.x2;
    let y2 = rail.y2;

    let nx = rail.nx;
    let ny = rail.ny;
    const origMidX = (x1 + x2) / 2;
    const origMidY = (y1 + y2) / 2;
    const origDot = nx * -origMidX + ny * -origMidY;
    if (origDot < 0) {
      nx = -nx;
      ny = -ny;
    }

    const centerShift = (CONFIG.RAIL_THICKNESS_OUTER - CONFIG.RAIL_THICKNESS_INNER) / 2;
    const halfWidth = width / 2;

    if (hasRoundedFrame && isCornerTaper && clip) {
      const abs1 = Math.max(Math.abs(x1), Math.abs(y1));
      const abs2 = Math.max(Math.abs(x2), Math.abs(y2));
      const inner = abs1 <= abs2 ? { x: x1, y: y1 } : { x: x2, y: y2 };
      const outer = abs1 <= abs2 ? { x: x2, y: y2 } : { x: x1, y: y1 };
      const dir = { x: outer.x - inner.x, y: outer.y - inner.y };
      const signX = Math.sign(outer.x) || Math.sign(inner.x) || 1;
      const signY = Math.sign(outer.y) || Math.sign(inner.y) || 1;
      const startOuter = {
        x: inner.x - nx * (centerShift + halfWidth),
        y: inner.y - ny * (centerShift + halfWidth),
      };
      const result = this.intersectLineWithCornerArc(startOuter, dir, signX, signY, clip);
      if (result) {
        const trimmed = {
          x: result.point.x,
          y: result.point.y,
        };
        const dirLen = Math.sqrt(dir.x * dir.x + dir.y * dir.y) || 1;
        const ux = dir.x / dirLen;
        const uy = dir.y / dirLen;
        const epsilon = 1e-3;
        trimmed.x -= ux * epsilon;
        trimmed.y -= uy * epsilon;
        if (abs1 > abs2) {
          x1 = trimmed.x;
          y1 = trimmed.y;
        } else {
          x2 = trimmed.x;
          y2 = trimmed.y;
        }
      }
    }

    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const toCenterX = -midX;
    const toCenterY = -midY;
    const dot = nx * toCenterX + ny * toCenterY;
    if (dot < 0) {
      nx = -nx;
      ny = -ny;
    }

    const startX = x1 - nx * centerShift;
    const startY = y1 - ny * centerShift;
    const endX = x2 - nx * centerShift;
    const endY = y2 - ny * centerShift;

    const startInnerX = startX + nx * halfWidth;
    const startInnerY = startY + ny * halfWidth;
    const startOuterX = startX - nx * halfWidth;
    const startOuterY = startY - ny * halfWidth;
    const endInnerX = endX + nx * halfWidth;
    const endInnerY = endY + ny * halfWidth;
    const endOuterX = endX - nx * halfWidth;
    const endOuterY = endY - ny * halfWidth;

    this.ctx.fillStyle = '#0d3d0d';
    this.ctx.beginPath();
    this.ctx.moveTo(startInnerX, startInnerY);
    this.ctx.lineTo(endInnerX, endInnerY);
    this.ctx.lineTo(endOuterX, endOuterY);
    this.ctx.lineTo(startOuterX, startOuterY);
    this.ctx.closePath();
    this.ctx.fill();

    // Inner highlight band
    const highlightWidth = Math.min(width * 0.6, width);
    const highlightHalf = highlightWidth / 2;
    const highlightShift = halfWidth - highlightHalf;
    const highlightStartX = startX + nx * highlightShift;
    const highlightStartY = startY + ny * highlightShift;
    const highlightEndX = endX + nx * highlightShift;
    const highlightEndY = endY + ny * highlightShift;

    const startHighlightInnerX = highlightStartX + nx * highlightHalf;
    const startHighlightInnerY = highlightStartY + ny * highlightHalf;
    const startHighlightOuterX = highlightStartX - nx * highlightHalf;
    const startHighlightOuterY = highlightStartY - ny * highlightHalf;
    const endHighlightInnerX = highlightEndX + nx * highlightHalf;
    const endHighlightInnerY = highlightEndY + ny * highlightHalf;
    const endHighlightOuterX = highlightEndX - nx * highlightHalf;
    const endHighlightOuterY = highlightEndY - ny * highlightHalf;

    this.ctx.fillStyle = '#1a5d1a';
    this.ctx.beginPath();
    this.ctx.moveTo(startHighlightInnerX, startHighlightInnerY);
    this.ctx.lineTo(endHighlightInnerX, endHighlightInnerY);
    this.ctx.lineTo(endHighlightOuterX, endHighlightOuterY);
    this.ctx.lineTo(startHighlightOuterX, startHighlightOuterY);
    this.ctx.closePath();
    this.ctx.fill();

    const trimmedOuterPoint =
      hasRoundedFrame && isCornerTaper
        ? Math.max(Math.abs(x1), Math.abs(y1)) > Math.max(Math.abs(x2), Math.abs(y2))
          ? { x: x1, y: y1 }
          : { x: x2, y: y2 }
        : { x: x2, y: y2 };

    this.debugRailSegments.push({
      id: rail.id ?? 'rail',
      inner: { x: x1, y: y1 },
      trimmed: trimmedOuterPoint,
      startOuter: {
        x: startX - nx * halfWidth,
        y: startY - ny * halfWidth,
      },
    });
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

    const isCueBall = ball.id === BALL_CUE;

    const gradient = this.ctx.createRadialGradient(
      x - ball.radius * 0.3,
      y - ball.radius * 0.3,
      0,
      x,
      y,
      ball.radius
    );

    const color = isCueBall ? CONFIG.CUE_BALL_COLOR : CONFIG.BALL_COLORS[ball.id - 1];

    gradient.addColorStop(0, lightenHexColor(color, 0.4));
    gradient.addColorStop(0.7, color);
    gradient.addColorStop(1, darkenHexColor(color, 0.3));

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

    if (isCueBall) {
      const measles = CONFIG.CUE_BALL_MEASLES ?? [];
      const measleRadius = ball.radius * (CONFIG.CUE_BALL_MEASLE_RADIUS_RATIO ?? 0);
      if (measles.length > 0 && measleRadius > 0) {
        this.ctx.fillStyle = CONFIG.CUE_BALL_MEASLE_COLOR;
        for (const measle of measles) {
          const mx = measle.x * ball.radius;
          const my = measle.y * ball.radius;
          this.ctx.beginPath();
          this.ctx.arc(mx, my, measleRadius, 0, Math.PI * 2);
          this.ctx.fill();
        }
      }
    }

    // Stripe for striped balls (9-15) - now rotates with ball
    if (ball.id >= 9 && ball.id <= 15) {
      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.arc(0, 0, ball.radius * 0.6, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // Ball number (need to flip Y back for text to be readable)
    if (!isCueBall) {
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

  drawCueAndPowerBar(ball: Ball, angle: number, power: number, showGhost: boolean, showPowerBar: boolean, isAimMode: boolean, prediction?: PredictionResult, microDialState?: MicroDialRenderState) {
    this.ctx.save();

    // Draw power/dial first so cue/aim lines sit above
    if (showPowerBar) {
      this.drawPowerBar(power, isAimMode, microDialState);
    }

    // Use same transform as main render
    const canvasCenterX = this.canvas.width / 2;
    const canvasCenterY = this.canvas.height / 2;
    this.ctx.translate(canvasCenterX, canvasCenterY);
    this.ctx.scale(this.scale, -this.scale); // Y-up for world coords

    const x = ball.x;
    const y = ball.y;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    // Ghost ball center calculation:
    // contactPoint is on the cue ball surface
    // objectBallCenter = contactPoint + normal * objectBallRadius
    let ghostCenter: Vec2 | null = null;
    if (prediction && prediction.type === 'ball' && prediction.hitBall) {
      const objectBallRadius = prediction.hitBall.radius;
      ghostCenter = {
        x: prediction.contactPoint.x + prediction.contactNormal.x * objectBallRadius,
        y: prediction.contactPoint.y + prediction.contactNormal.y * objectBallRadius
      };
    }

    // Cue stick (behind the ball, opposite to shot direction)
    const cueStart = ball.radius + 1;
    const cueLength = CONFIG.CUE_LENGTH_IN ?? 58;
    // As power increases, cue pulls back away from ball (not toward it)
    const cueOffset = (power / CONFIG.CUE_POWER_MAX) * 3;

    // Compute raw endpoints and clamp to play area boundary to avoid clipping at canvas edges
    const rawNear = { x: x - dx * (cueStart + cueOffset), y: y - dy * (cueStart + cueOffset) };
    const rawFar = { x: x - dx * (cueStart + cueLength + cueOffset), y: y - dy * (cueStart + cueLength + cueOffset) };
    const clampedNear = this.clampSegmentToPlayArea({ x, y }, rawNear);
    const clampedFar = this.clampSegmentToPlayArea({ x, y }, rawFar);

    this.ctx.strokeStyle = '#8b4513';
    this.ctx.lineWidth = 0.4;
    this.ctx.beginPath();
    this.ctx.moveTo(clampedNear.x, clampedNear.y);
    this.ctx.lineTo(clampedFar.x, clampedFar.y);
    this.ctx.stroke();

    // Aim line - always stop at contact point (where cue ball surface touches)
    const aimStart = { x, y };
    let aimRawEnd = { x: x + dx * CONFIG.AIM_LINE_LENGTH, y: y + dy * CONFIG.AIM_LINE_LENGTH };
    if (prediction) {
      // Always use contactPoint (not ghostCenter) - this is where the cue ball surface touches
      aimRawEnd = { x: prediction.contactPoint.x, y: prediction.contactPoint.y };
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

    this.ctx.restore();

    // Draw aim info overlay in screen space (only if scale > 0)
    if (CONFIG.SHOW_AIM_INFO && CONFIG.AIM_INFO_SCALE > 0) {
      this.drawAimInfo(ball, angle, power, prediction);
    }
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

    // Calculate object ball center from contact point
    // contactPoint is on the cue ball surface, object ball center is offset by object ball radius
    let ghostCenter = { x: prediction.contactPoint.x, y: prediction.contactPoint.y };
    if (prediction.type === 'ball' && prediction.hitBall) {
      const objectBallRadius = prediction.hitBall.radius;
      ghostCenter = {
        x: prediction.contactPoint.x + prediction.contactNormal.x * objectBallRadius,
        y: prediction.contactPoint.y + prediction.contactNormal.y * objectBallRadius
      };
    }

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
        const orientation = classifyAxisAlignmentFromVector(normX, normY);
        const palette = getAxisPalette(orientation);
        const lineLength = 15; // Match the length passed to predictTrajectories
        const start = ghostCenter;
        const end = { x: start.x + normX * lineLength, y: start.y + normY * lineLength };
        const result = drawClampedLine(start, end, palette.debugStroke);
        if (result.drew && result.length > 0) {
          drawArrow(result.end, result.dirX, result.dirY, palette.debugFill);
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

    const canvasCenterX = this.canvas.width / 2;
    const canvasCenterY = this.canvas.height / 2;
    this.ctx.translate(canvasCenterX, canvasCenterY);
    this.ctx.scale(this.scale, -this.scale);

    const trajectories = predictor.predictTrajectories(
      prediction,
      cueBallPos,
      shotDirection,
      50
    );

    const strokeWidth = 3 / this.scale;
    const glowWidth = 7 / this.scale;
    const arrowLength = 12 / this.scale;

    // Calculate object ball center from contact point
    // contactPoint is on the cue ball surface, object ball center is offset by object ball radius
    let ghostCenter = { x: prediction.contactPoint.x, y: prediction.contactPoint.y };
    if (prediction.type === 'ball' && prediction.hitBall) {
      const objectBallRadius = prediction.hitBall.radius;
      ghostCenter = {
        x: prediction.contactPoint.x + prediction.contactNormal.x * objectBallRadius,
        y: prediction.contactPoint.y + prediction.contactNormal.y * objectBallRadius
      };
    }

    const drawSolidLineWithGlow = (start: Vec2, end: Vec2, glowColor: string, lineColor: string) => {
      const clampedEnd = this.clampSegmentToPlayArea(start, end);
      if (!clampedEnd) return { drew: false, end, dirX: 0, dirY: 0 };

      const dirX = clampedEnd.x - start.x;
      const dirY = clampedEnd.y - start.y;
      const length = Math.sqrt(dirX * dirX + dirY * dirY);
      if (length <= 0.0001) return { drew: false, end: clampedEnd, dirX: 0, dirY: 0 };

      this.ctx.strokeStyle = glowColor;
      this.ctx.lineWidth = glowWidth;
      this.ctx.lineCap = 'round';
      this.ctx.beginPath();
      this.ctx.moveTo(start.x, start.y);
      this.ctx.lineTo(clampedEnd.x, clampedEnd.y);
      this.ctx.stroke();

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

      this.ctx.fillStyle = glowColor;
      this.ctx.beginPath();
      this.ctx.moveTo(end.x, end.y);
      this.ctx.lineTo(leftX - normX * 2 / this.scale, leftY - normY * 2 / this.scale);
      this.ctx.lineTo(rightX - normX * 2 / this.scale, rightY - normY * 2 / this.scale);
      this.ctx.closePath();
      this.ctx.fill();

      this.ctx.fillStyle = fillColor;
      this.ctx.beginPath();
      this.ctx.moveTo(end.x, end.y);
      this.ctx.lineTo(leftX, leftY);
      this.ctx.lineTo(rightX, rightY);
      this.ctx.closePath();
      this.ctx.fill();
    };

    if (trajectories.objectBallPath) {
      const dirX = trajectories.objectBallPath.end.x - trajectories.objectBallPath.start.x;
      const dirY = trajectories.objectBallPath.end.y - trajectories.objectBallPath.start.y;
      const length = Math.sqrt(dirX * dirX + dirY * dirY);
      if (length > 0.0001) {
        const normX = dirX / length;
        const normY = dirY / length;
        const orientation = classifyAxisAlignmentFromVector(normX, normY);
        const palette = getAxisPalette(orientation);
        const start = ghostCenter;
        const end = { x: start.x + normX * 50, y: start.y + normY * 50 };
        const result = drawSolidLineWithGlow(start, end, palette.glow, palette.line);
        if (result.drew) {
          drawArrowWithGlow(result.end, result.dirX, result.dirY, palette.glow, palette.line);
        }
      }
    }

    if (trajectories.cueBallPath) {
      const dirX = trajectories.cueBallPath.end.x - trajectories.cueBallPath.start.x;
      const dirY = trajectories.cueBallPath.end.y - trajectories.cueBallPath.start.y;
      const length = Math.sqrt(dirX * dirX + dirY * dirY);
      if (length > 0.0001) {
        const normX = dirX / length;
        const normY = dirY / length;
        const start = ghostCenter;
        const end = { x: start.x + normX * (50 * 0.25), y: start.y + normY * (50 * 0.25) };
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



  drawPowerBar(power: number, isAimMode: boolean, microDialState?: MicroDialRenderState) {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0); // Screen space

    const sides = this.getSidebarSides();

    const drawRoundedRect = (x: number, y: number, w: number, h: number, r: number) => {
      const radius = Math.min(r, w / 2, h / 2);
      this.ctx.beginPath();
      this.ctx.moveTo(x + radius, y);
      this.ctx.lineTo(x + w - radius, y);
      this.ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
      this.ctx.lineTo(x + w, y + h - radius);
      this.ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
      this.ctx.lineTo(x + radius, y + h);
      this.ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
      this.ctx.lineTo(x, y + radius);
      this.ctx.quadraticCurveTo(x, y, x + radius, y);
      this.ctx.closePath();
    };

    // Draw power bar in screen space, positioned relative to table frame
    const barWidth = 45;
    const barHeight = 200;
    const { x: barX, y: barY } = this.getSideBarPosition(sides.powerSide, barWidth, barHeight);

    // Background
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this.ctx.fillRect(barX, barY, barWidth, barHeight);

    // Border - change color based on mode
    this.ctx.strokeStyle = isAimMode ? '#888888' : '#ffffff';
    this.ctx.lineWidth = isAimMode ? 1 : 3;
    this.ctx.strokeRect(barX, barY, barWidth, barHeight);

    // Power fill (from top, down = more power)
    const powerPercent = Math.max(0, Math.min(1, power / CONFIG.CUE_POWER_MAX));
    const fillHeight = barHeight * powerPercent;

    // Gradient from green at top to yellow to red at bottom
    const gradient = this.ctx.createLinearGradient(barX, barY, barX, barY + barHeight);
    gradient.addColorStop(0, '#00ff00');
    gradient.addColorStop(0.5, '#ffff00');
    gradient.addColorStop(1, '#ff0000');

    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(barX, barY, barWidth, fillHeight);

    // Power readout badge under the bar
    const labelHeight = 22;
    const labelPadding = 6;
    const labelWidth = barWidth + labelPadding * 2;
    const labelX = barX - labelPadding;
    const labelY = barY + barHeight + 6;
    this.ctx.fillStyle = 'rgba(8, 10, 14, 0.82)';
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    this.ctx.lineWidth = 1;
    drawRoundedRect(labelX, labelY, labelWidth, labelHeight, 6);
    this.ctx.fill();
    this.ctx.stroke();
    this.ctx.fillStyle = '#f2f2f2';
    this.ctx.font = 'bold 11px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(`${Math.round(powerPercent * 100)}%`, labelX + labelWidth / 2, labelY + labelHeight / 2);

    // Micro aim dial on the opposite side
    this.drawMicroAimDial(microDialState);

    this.ctx.restore();
  }

  drawAimInfo(ball: Ball, angle: number, power: number, prediction?: PredictionResult) {
    // Draw in screen space (no transform)
    this.ctx.save();

    const drawRoundedRect = (x: number, y: number, w: number, h: number, r: number) => {
      const radius = Math.min(r, w / 2, h / 2);
      this.ctx.beginPath();
      this.ctx.moveTo(x + radius, y);
      this.ctx.lineTo(x + w - radius, y);
      this.ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
      this.ctx.lineTo(x + w, y + h - radius);
      this.ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
      this.ctx.lineTo(x + radius, y + h);
      this.ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
      this.ctx.lineTo(x, y + radius);
      this.ctx.quadraticCurveTo(x, y, x + radius, y);
      this.ctx.closePath();
    };

    // Calculate values
    let angleDeg = (angle * 180 / Math.PI) % 360;
    if (angleDeg < 0) angleDeg += 360;

    const distanceText = prediction && prediction.type !== 'none' ? `${prediction.distance.toFixed(1)}"` : '';

    // Derive cut angle if we have a target ball
    let cutAngleText = '';
    if (prediction && prediction.type === 'ball' && prediction.hitBall) {
      const targetBall = prediction.hitBall;
      const toBallAngle = Math.atan2(targetBall.y - ball.y, targetBall.x - ball.x);
      let cutAngle = Math.abs(angle - toBallAngle) * 180 / Math.PI;
      if (cutAngle > 90) cutAngle = 180 - cutAngle;
      cutAngleText = `${cutAngle.toFixed(1)}°`;
    }

    const metrics: Array<{ icon: string; value: string; color: string }> = [
      { icon: '⟲', value: `${angleDeg.toFixed(1)}°`, color: '#4fc3f7' }
    ];
    if (distanceText) {
      metrics.push({
        icon: '↔',
        value: cutAngleText ? `${distanceText} · ${cutAngleText}` : distanceText,
        color: cutAngleText ? '#9c6cff' : '#66bb6a'
      });
    }

    // Position badges on the upper-left frame, laid out in a single row past the pocket
    const geom = getTableGeometry();
    const canvasCenterX = this.canvas.width / 2;
    const canvasCenterY = this.canvas.height / 2;
    const frameTopWorldY = geom.frameOutline.outerHalfHeight;
    const frameLeftWorldX = -geom.frameOutline.outerHalfWidth;
    const frameTopScreenY = canvasCenterY - frameTopWorldY * this.scale;
    const frameLeftScreenX = canvasCenterX + frameLeftWorldX * this.scale;

    // Layout for compact pill badges
    const badgeHeight = 26 * CONFIG.AIM_INFO_SCALE;
    const horizontalPadding = 10 * CONFIG.AIM_INFO_SCALE;
    const iconSpacing = 6 * CONFIG.AIM_INFO_SCALE;
    const inset = 14 * CONFIG.AIM_INFO_SCALE;
    const topOffset = 16 * CONFIG.AIM_INFO_SCALE;
    const pocketClearPx = 100 * CONFIG.AIM_INFO_SCALE;
    const badgeGap = 8 * CONFIG.AIM_INFO_SCALE;

    const measureBadge = (metric: { icon: string; value: string }) => {
      this.ctx.font = `bold ${14 * CONFIG.AIM_INFO_SCALE}px Arial`;
      const iconWidth = this.ctx.measureText(metric.icon).width;
      this.ctx.font = `bold ${12 * CONFIG.AIM_INFO_SCALE}px monospace`;
      const valueWidth = this.ctx.measureText(metric.value).width;
      const width = horizontalPadding * 2 + iconWidth + iconSpacing + valueWidth;
      return { width, iconWidth, valueWidth };
    };

    const measurements = metrics.map(measureBadge);

    let cursorX = frameLeftScreenX + inset + pocketClearPx;
    metrics.forEach((metric, i) => {
      const { width, iconWidth } = measurements[i];
      const center = {
        x: cursorX + width / 2,
        y: frameTopScreenY + topOffset + badgeHeight / 2
      };
      cursorX += width + badgeGap;
      const x = center.x - width / 2;
      const y = center.y - badgeHeight / 2;

      // Glow + background
      const gradient = this.ctx.createLinearGradient(x, y, x, y + badgeHeight);
      gradient.addColorStop(0, 'rgba(18, 20, 28, 0.92)');
      gradient.addColorStop(1, 'rgba(12, 14, 20, 0.96)');
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      drawRoundedRect(x - 2, y - 2, width + 4, badgeHeight + 4, 8 * CONFIG.AIM_INFO_SCALE);
      this.ctx.fill();
      this.ctx.fillStyle = gradient;
      drawRoundedRect(x, y, width, badgeHeight, 8 * CONFIG.AIM_INFO_SCALE);
      this.ctx.fill();
      this.ctx.strokeStyle = metric.color;
      this.ctx.lineWidth = 1.5;
      this.ctx.stroke();

      // Icon
      this.ctx.font = `bold ${14 * CONFIG.AIM_INFO_SCALE}px Arial`;
      this.ctx.fillStyle = metric.color;
      this.ctx.textAlign = 'left';
      this.ctx.textBaseline = 'middle';
      const iconX = x + horizontalPadding;
      const textY = center.y;
      this.ctx.fillText(metric.icon, iconX, textY);

      // Value
      this.ctx.font = `bold ${12 * CONFIG.AIM_INFO_SCALE}px monospace`;
      this.ctx.fillStyle = '#ffffff';
      const valueX = iconX + iconWidth + iconSpacing;
      this.ctx.fillText(metric.value, valueX, textY);
    });

    this.ctx.restore();
  }

  getPowerBarBounds() {
    const barWidth = 45;
    const barHeight = 200;
    const { powerSide } = this.getSidebarSides();
    const { x, y } = this.getSideBarPosition(powerSide, barWidth, barHeight);
    return { x, y, width: barWidth, height: barHeight };
  }

  getMicroDialBounds() {
    const barWidth = 45;
    const barHeight = 200;
    const { dialSide } = this.getSidebarSides();
    const { x, y } = this.getSideBarPosition(dialSide, barWidth, barHeight);
    return { x, y, width: barWidth, height: barHeight };
  }

  private getSideBarPosition(side: 'left' | 'right', width: number, height: number) {
    const geom = getTableGeometry();
    const canvasCenterX = this.canvas.width / 2;
    const frameHalfWidth = geom.frameOutline.outerHalfWidth;
    const frameWorldX = side === 'right' ? frameHalfWidth : -frameHalfWidth;
    const frameScreenX = canvasCenterX + (frameWorldX * this.scale);
    const offsetFromFrame = 20;
    const x = side === 'right' ? frameScreenX + offsetFromFrame : frameScreenX - offsetFromFrame - width;
    const y = (this.canvas.height - height) / 2;
    return { x, y };
  }

  private getSidebarSides() {
    const dialSide = CONFIG.SIDEBAR_DIAL_SIDE === 'right' ? 'right' : 'left';
    const powerSide = dialSide === 'left' ? 'right' : 'left';
    return { dialSide, powerSide };
  }

  private drawMicroAimDial(state?: MicroDialRenderState) {
    const barWidth = 45;
    const barHeight = 200;
    const { dialSide } = this.getSidebarSides();
    const { x: barX, y: barY } = this.getSideBarPosition(dialSide, barWidth, barHeight);
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const value = Math.max(-1, Math.min(1, state?.value ?? 0));
    const degrees = state?.degrees ?? 0;
    const isActive = state?.isActive ?? false;
    const handlePercent = 0.5 - (value * 0.5);
    const handleY = barY + handlePercent * barHeight;
    const centerY = barY + barHeight / 2;
    const handleX = barX + barWidth / 2;

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(barX, barY, barWidth, barHeight);
    ctx.strokeStyle = isActive ? '#ffffff' : '#888888';
    ctx.lineWidth = isActive ? 2 : 1.5;
    ctx.strokeRect(barX, barY, barWidth, barHeight);

    // Zero line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(barX + 4, centerY);
    ctx.lineTo(barX + barWidth - 4, centerY);
    ctx.stroke();

    // Draw tick marks
    ctx.lineWidth = 1;
    for (let i = 1; i <= 2; i++) {
      const offset = i * (barHeight / 6);
      ctx.beginPath();
      ctx.moveTo(barX + 6, centerY - offset);
      ctx.lineTo(barX + barWidth - 6, centerY - offset);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(barX + 6, centerY + offset);
      ctx.lineTo(barX + barWidth - 6, centerY + offset);
      ctx.stroke();
    }

    // Show adjustment magnitude
    if (Math.abs(value) > 0.01) {
      const fromY = value > 0 ? handleY : centerY;
      const toY = value > 0 ? centerY : handleY;
      const gradient = ctx.createLinearGradient(barX, fromY, barX, toY);
      if (value > 0) {
        gradient.addColorStop(0, 'rgba(111, 202, 255, 0.8)');
        gradient.addColorStop(1, 'rgba(111, 202, 255, 0.1)');
      } else {
        gradient.addColorStop(0, 'rgba(255, 138, 101, 0.8)');
        gradient.addColorStop(1, 'rgba(255, 138, 101, 0.1)');
      }
      ctx.fillStyle = gradient;
      ctx.fillRect(barX + 5, Math.min(fromY, toY), barWidth - 10, Math.abs(toY - fromY));
    }

    // Dial handle
    const handleRadius = barWidth / 2 - 6;
    ctx.beginPath();
    ctx.arc(handleX, handleY, handleRadius, 0, Math.PI * 2);
    ctx.fillStyle = isActive ? '#fff59d' : '#ffd54f';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.stroke();

    // Indicator arrow
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(handleX, handleY - handleRadius + 4);
    ctx.lineTo(handleX, handleY + handleRadius - 4);
    ctx.stroke();

    // Labels
    ctx.restore();
  }

  queuePocketAnimation(event: PocketAnimationEvent) {
    this.queuedPocketEvents.push(event);
  }

  private processPocketAnimationQueue() {
    if (!this.queuedPocketEvents.length) return;
    const dropDuration = CONFIG.POCKET_ANIMATION_DROP_DURATION_MS ?? 300;
    const rollDuration = CONFIG.POCKET_ANIMATION_ROLL_DURATION_MS ?? 500;
    const duration = dropDuration + rollDuration;
    const now = performance.now();
    while (this.queuedPocketEvents.length) {
      const event = this.queuedPocketEvents.shift()!;
      this.pocketAnimations.push({ event, startTime: now, duration });
    }
  }

  private drawPocketAnimations() {
    if (!this.pocketAnimations.length) return;
    const now = performance.now();
    const canvasCenterX = this.canvas.width / 2;
    const canvasCenterY = this.canvas.height / 2;

    this.pocketAnimations = this.pocketAnimations.filter((anim) => {
      const elapsed = now - anim.startTime;
      const progress = Math.min(1, elapsed / Math.max(anim.duration, 1));
      this.drawPocketAnimationSprite(anim.event, progress, canvasCenterX, canvasCenterY);
      return progress < 1;
    });
  }

  private drawPocketAnimationSprite(event: PocketAnimationEvent, progress: number, centerX: number, centerY: number) {
    const startScreenX = centerX + event.position.x * this.scale;
    const startScreenY = centerY - event.position.y * this.scale;
    const endScreenX = centerX + event.pocket.x * this.scale;
    const endScreenY = centerY - event.pocket.y * this.scale;

    const smoothstep = (t: number) => t * t * (3 - 2 * t);
    const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
    const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

    const spriteScale = Math.max(0.1, (CONFIG as any).POCKET_ANIMATION_ICON_SCALE ?? 1.45);
    const baseRadius = (event.radius ?? CONFIG.BALL_RADIUS) * this.scale * spriteScale;

    // Get separate durations for drop and roll phases
    const dropDuration = CONFIG.POCKET_ANIMATION_DROP_DURATION_MS ?? 300;
    const rollDuration = CONFIG.POCKET_ANIMATION_ROLL_DURATION_MS ?? 500;
    const totalDuration = dropDuration + rollDuration;
    const dropPhaseEnd = dropDuration / totalDuration;

    // Pocket opening radius for clipping (use pocket-specific visual radius when available)
    const tableGeom = getTableGeometry();
    const pocketDef = event.pocket.id ? tableGeom.pockets.find(p => p.id === event.pocket.id) : undefined;
    const pocketVisualRadiusIn = pocketDef?.visualRadius ?? pocketDef?.radius ?? (CONFIG.POCKET_VISUAL_RADIUS_SIDE ?? 2.1);
    const pocketOpeningRadius = pocketVisualRadiusIn * this.scale;

    let x: number, y: number;

    // Optional sink shrink (kept 0 by default in config)
    const shrinkFactor = Math.max(0, Math.min(0.95, CONFIG.POCKET_ANIMATION_SHRINK_FACTOR ?? 0));

    if (progress < dropPhaseEnd) {
      // Phase 1: Ball drops into pocket (fully visible, no clip)
      const dropT = progress / dropPhaseEnd;
      const eased = smoothstep(dropT);

      x = startScreenX + (endScreenX - startScreenX) * eased;
      y = startScreenY + (endScreenY - startScreenY) * eased;
    } else {
      // Phase 2: Ball at pocket center, fading out
      x = endScreenX;
      y = endScreenY;
    }

    // Fade: fully visible during drop, fade during roll phase
    const fadeT = progress < dropPhaseEnd ? 0 : clamp01((progress - dropPhaseEnd) / (1 - dropPhaseEnd));
    const alpha = 1 - smoothstep(fadeT);

    const radius = baseRadius * (1 - shrinkFactor * smoothstep(fadeT));

    this.ctx.save();
    this.ctx.globalAlpha *= alpha;

    // Clip once the sprite overlaps the pocket opening so the overlay doesn't visually sit on top of the rim.
    const clipRadiusScale = clamp(CONFIG.POCKET_ANIMATION_CLIP_RADIUS_SCALE ?? 1.0, 0.1, 1.0);
    const clipRadius = pocketOpeningRadius * clipRadiusScale;
    const distToPocket = Math.hypot(x - endScreenX, y - endScreenY);
    if (distToPocket < clipRadius + radius) {
      this.ctx.beginPath();
      this.ctx.arc(endScreenX, endScreenY, clipRadius, 0, Math.PI * 2);
      this.ctx.clip();
    }

    const fill = this.getBallColor(event.ballId);
    const gradient = this.ctx.createRadialGradient(
      x - radius * 0.2,
      y - radius * 0.2,
      radius * 0.1,
      x,
      y,
      radius
    );
    gradient.addColorStop(0, fill.light);
    gradient.addColorStop(1, fill.dark);
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.fill();

    const iconImage = this.getPocketIconImage(event.icon);
    if (iconImage) {
      const size = radius * 2;
      this.ctx.drawImage(iconImage, x - size / 2, y - size / 2, size, size);
    }

    this.ctx.lineWidth = 1.2;
    this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
    this.ctx.stroke();
    this.ctx.restore();
  }

  private getBallColor(ballId: number) {
    const hex = CONFIG.BALL_COLORS[ballId - 1] || '#ffffff';
    const base = hex.startsWith('#') ? hex : `#${hex}`;
    const light = lightenHexColor(base, 0.2);
    const dark = darkenHexColor(base, 0.35);
    return { light, dark };
  }

  private getPocketIconImage(iconSrc?: string) {
    if (!iconSrc) return null;
    let entry = this.pocketIconCache.get(iconSrc);
    if (!entry) {
      const img = new Image();
      entry = { img, ready: img.complete, failed: false };
      img.onload = () => {
        entry!.ready = true;
      };
      img.onerror = () => {
        entry!.failed = true;
      };
      img.src = iconSrc;
      this.pocketIconCache.set(iconSrc, entry);
    }
    if (entry.failed || !entry.ready) return null;
    return entry.img;
  }

  override triggerShotShake(intensity: number) {
    const clamped = Math.max(0, Math.min(1, intensity));
    if (clamped <= 0) return;
    const duration = CONFIG.HEAVY_SHOT_SHAKE_DURATION_MS ?? 240;
    const strength = (CONFIG.HEAVY_SHOT_SHAKE_MAX_OFFSET_PX ?? 5) * clamped;
    this.shakeState = {
      start: performance.now(),
      duration,
      strength,
      seed: Math.random() * Math.PI * 2,
    };
  }

  private computeShakeOffset() {
    if (!this.shakeState) return { x: 0, y: 0 };
    const now = performance.now();
    const elapsed = now - this.shakeState.start;
    if (elapsed >= this.shakeState.duration) {
      this.shakeState = null;
      return { x: 0, y: 0 };
    }
    const progress = elapsed / Math.max(1, this.shakeState.duration);
    const decay = 1 - progress;
    const angle = now * 0.04 + this.shakeState.seed;
    const x = Math.cos(angle * 50) * this.shakeState.strength * decay;
    const y = Math.sin(angle * 60) * this.shakeState.strength * decay;
    return { x, y };
  }

  private applyShakeTransform(x: number, y: number) {
    if (!this.canvas) return;
    if (Math.abs(x) < 0.01 && Math.abs(y) < 0.01) {
      this.canvas.style.transform = '';
    } else {
      this.canvas.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)`;
    }
  }
}
