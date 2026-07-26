// Input handling. Pointer Events only — mouse, pen and touch take one path.
//
// World coordinates are obtained by unprojecting through the camera, so this
// stays correct under any canvas size, letterbox or devicePixelRatio.

import { Ball } from '../physics/Shapes';
import { CONFIG } from '../config';

export type ScreenToWorld = (clientX: number, clientY: number) => { x: number; y: number };

/** Fine aim divides pointer-to-angle sensitivity by this factor. */
export const FINE_AIM_DIVISOR = 5;

function normalizeAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

export class InputManager {
  canvas: HTMLCanvasElement;
  scale: number;

  /** Pointer position in table world coordinates. */
  mouseX = 0;
  mouseY = 0;

  /** True while a pointer is down on the table (drag-to-aim). */
  isPointerDown = false;

  private screenToWorld: ScreenToWorld;

  // Fine-aim anchoring
  private fineAim = false;
  private fineAnchorAim = 0;
  private fineAnchorRaw = 0;

  /** Fired on the first interaction of any kind — unlocks the AudioContext. */
  onFirstGesture?: () => void;

  constructor(canvas: HTMLCanvasElement, screenToWorld: ScreenToWorld) {
    this.canvas = canvas;
    this.scale = CONFIG.CANVAS_SCALE;
    this.screenToWorld = screenToWorld;

    this.setupListeners();
  }

  setupListeners() {
    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    this.canvas.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);
    window.addEventListener('pointercancel', this.handlePointerUp);

    // Fine aim: hold Shift to cut angular sensitivity by 5x.
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Shift') this.fineAim = true;
    });
    window.addEventListener('keyup', (e) => {
      if (e.key === 'Shift') this.endFineAim();
    });
    window.addEventListener('blur', () => this.endFineAim());
  }

  private handlePointerDown = (e: PointerEvent) => {
    this.onFirstGesture?.();
    this.isPointerDown = true;
    this.updatePosition(e);
  };

  private handlePointerMove = (e: PointerEvent) => {
    this.updatePosition(e);
  };

  private handlePointerUp = () => {
    this.isPointerDown = false;
  };

  private updatePosition(e: PointerEvent) {
    const pos = this.screenToWorld(e.clientX, e.clientY);
    this.mouseX = pos.x;
    this.mouseY = pos.y;
  }

  private endFineAim() {
    this.fineAim = false;
    this.fineAnchorAim = 0;
    this.fineAnchorRaw = 0;
  }

  updateScale(scale: number) {
    this.scale = scale;
  }

  isFineAiming(): boolean {
    return this.fineAim;
  }

  /** Raw pointer-to-ball angle, before any fine-aim damping. */
  getRawAimAngle(ball: Ball): number {
    return Math.atan2(this.mouseY - ball.y, this.mouseX - ball.x);
  }

  /**
   * Aim angle for the shot. While Shift is held the angle tracks the pointer at
   * a fifth of the usual rate, anchored to wherever aim was when Shift went
   * down — this is what makes thin cuts actually dialable.
   */
  getAimAngle(ball: Ball, previousAngle?: number): number {
    const raw = this.getRawAimAngle(ball);

    if (!this.fineAim) return raw;

    // Anchor on the first fine-aim frame.
    if (this.fineAnchorAim === 0 && this.fineAnchorRaw === 0) {
      this.fineAnchorAim = previousAngle ?? raw;
      this.fineAnchorRaw = raw;
      return this.fineAnchorAim;
    }

    const delta = normalizeAngle(raw - this.fineAnchorRaw);
    return normalizeAngle(this.fineAnchorAim + delta / FINE_AIM_DIVISOR);
  }

  /** World-space pointer position, for cue-ball placement. */
  getPointerWorld(): { x: number; y: number } {
    return { x: this.mouseX, y: this.mouseY };
  }
}
