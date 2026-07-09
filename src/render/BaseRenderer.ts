// Base renderer class with shared functionality between 2D and 3D renderers

import type { Vec2, BoundaryBounds } from '../geometry/Geometry';
import { getTableGeometry, computePlayBoundaryPoints, computeBoundaryBounds } from '../geometry/Geometry';

/**
 * Abstract base class for renderers
 * Contains shared properties and methods used by both 2D canvas and 3D WebGL renderers
 */
export abstract class BaseRenderer {
  /** Main canvas element */
  canvas: HTMLCanvasElement;

  /** Rendering scale (pixels per inch) */
  scale: number;

  /** Cached play boundary polygon points */
  protected playBoundaryPoints: Vec2[] = [];

  /** Cached axis-aligned bounding box of play area */
  protected playBounds: BoundaryBounds = { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };

  /** Debug visualization of rail segments */
  debugRailSegments: Array<{ id: string; inner: Vec2; trimmed: Vec2; startOuter: Vec2 }> = [];

  constructor(canvas: HTMLCanvasElement, initialScale: number) {
    this.canvas = canvas;
    this.scale = initialScale;
    this.refreshDerivedGeometry();
  }

  /**
   * Refresh cached geometry data from current table configuration
   * Called when CONFIG changes or during initialization
   */
  protected refreshDerivedGeometry(): void {
    this.playBoundaryPoints = computePlayBoundaryPoints(getTableGeometry().rails);
    this.playBounds = computeBoundaryBounds(this.playBoundaryPoints);
  }

  // Abstract methods that must be implemented by subclasses

  /**
   * Render the current game state
   * @param world Physics world containing balls and rails
   * @param alpha Interpolation factor for smooth rendering between physics steps
   */
  abstract render(world: any, alpha: number): void;

  /**
   * Handle canvas resize
   */
  abstract resize(): void;

  /**
   * Clear the canvas/screen
   */
  abstract clear(): void;

  /**
   * Optional hook for camera/screen shake when shots fire
   */
  triggerShotShake(_intensity: number): void {
    // Default no-op
  }
}
