// Input handling for mouse and touch
// Coordinate system: Converts from canvas (Y-down) to world (Y-up, center-origin)

import { Ball } from '../physics/Shapes';
import { CONFIG } from '../config';
import { uiStateMachine, UIState } from '../ui/UIStateMachine';
import { getTableGeometry } from '../geometry/Geometry';

export class InputManager {
  canvas: HTMLCanvasElement;
  scale: number;

  // Mouse state
  mouseX: number = 0;
  mouseY: number = 0;
  mouseTargetX: number = 0;
  mouseTargetY: number = 0;
  fineAimActive: boolean = false;

  // Aim smoothing state
  private lastAimAngle: number | null = null;
  private centerGuardActive: boolean = false;
  private lastAimGuardLogMs: number = 0;

  // Power bar state
  isDraggingPowerBar: boolean = false;
  powerBarDragStart: number = 0;
  private aimSuppressed: boolean = false;
  private touchAimMode: boolean = false;
  private aimDragActive: boolean = true;
  private pointerDown: boolean = false;

  // Callbacks
  onShoot?: (angle: number, power: number) => void;
  onPowerChange?: (power: number) => void;
  onClick?: (worldX: number, worldY: number, event: MouseEvent) => boolean;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.scale = CONFIG.CANVAS_SCALE;

    this.setupListeners();
  }

  setupListeners() {
    this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    window.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    window.addEventListener('mouseup', (e) => this.handleMouseUp(e));

    // Touch support
    this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e));
    window.addEventListener('touchmove', (e) => this.handleTouchMove(e));
    window.addEventListener('touchend', (e) => this.handleTouchEnd(e));
  }

  updateScale(scale: number) {
    this.scale = scale;
  }

  screenToGame(screenX: number, screenY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const canvasX = screenX - rect.left;
    const canvasY = screenY - rect.top;

    // Convert from canvas coords (top-left origin, Y-down) to world coords (center origin, Y-up)
    // Use rect dimensions (displayed size) not canvas.width/height (internal resolution)
    const canvasCenterX = rect.width / 2;
    const canvasCenterY = rect.height / 2;

    return {
      x: (canvasX - canvasCenterX) / this.scale,
      y: -(canvasY - canvasCenterY) / this.scale, // Flip Y
    };
  }

  handleMouseDown(e: MouseEvent) {
    if (uiStateMachine.state !== UIState.IN_GAME) return;
    this.pointerDown = true;
    if (this.touchAimMode) {
      this.setAimDragActive(true);
    }
    this.updateAimFromScreen(e.clientX, e.clientY, true);
    // Fire click callback with world coordinates
    if (this.onClick) {
      const pos = this.screenToGame(e.clientX, e.clientY);
      const handled = this.onClick(pos.x, pos.y, e);
      // If the click was handled, prevent default behavior and stop propagation
      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
  }

  handleMouseMove(e: MouseEvent) {
    if (uiStateMachine.state !== UIState.IN_GAME) return;
    if (this.touchAimMode && (!this.aimDragActive || !this.pointerDown)) return;
    // Use updateAimFromScreen to enforce table bounds and prevent aim hijacking
    this.updateAimFromScreen(e.clientX, e.clientY, false);

    if (this.aimSuppressed) {
      return;
    }
    if (this.fineAimActive) {
      const factor = CONFIG.FINE_AIM_SENSITIVITY;
      this.mouseX += (this.mouseTargetX - this.mouseX) * factor;
      this.mouseY += (this.mouseTargetY - this.mouseY) * factor;
    } else {
      this.mouseX = this.mouseTargetX;
      this.mouseY = this.mouseTargetY;
    }
  }

  handleMouseUp(_e: MouseEvent) {
    if (this.isDraggingPowerBar) {
      this.isDraggingPowerBar = false;
    }
    this.pointerDown = false;
    if (this.touchAimMode) {
      this.setAimDragActive(false);
    }
  }

  handleTouchStart(e: TouchEvent) {
    if (uiStateMachine.state !== UIState.IN_GAME) return;
    e.preventDefault();
    if (this.touchAimMode) {
      this.pointerDown = true;
      this.setAimDragActive(true);
    }
    if (this.onClick && e.touches.length > 0) {
      const touch = e.touches[0];
      const pos = this.screenToGame(touch.clientX, touch.clientY);
      // For initial touch, apply immediately (force=true)
      this.updateAimFromScreen(touch.clientX, touch.clientY, true);
      const handled = this.onClick(pos.x, pos.y, e as any);
      if (handled) {
        e.stopPropagation();
      }
    }
  }

  handleTouchMove(e: TouchEvent) {
    if (uiStateMachine.state !== UIState.IN_GAME) return;
    e.preventDefault();
    if (this.touchAimMode && !this.aimDragActive) return;
    if (e.touches.length > 0) {
      const touch = e.touches[0];
      // Use updateAimFromScreen to enforce table bounds
      this.updateAimFromScreen(touch.clientX, touch.clientY, false);
    }
  }

  handleTouchEnd(e: TouchEvent) {
    if (uiStateMachine.state !== UIState.IN_GAME) return;
    e.preventDefault();
    if (this.isDraggingPowerBar) {
      this.isDraggingPowerBar = false;
    }
    if (this.touchAimMode) {
      this.pointerDown = false;
      this.setAimDragActive(false);
    }
  }

  getAimAngle(ball: Ball, sensitivityMultiplier: number = 1.0): number {
    // Calculate the raw angle from ball to mouse
    const dxRaw = this.mouseX - ball.x;
    const dyRaw = this.mouseY - ball.y;
    const rWorldRaw = Math.hypot(dxRaw, dyRaw);
    const rPxRaw = rWorldRaw * this.scale;

    const ballRadiusPx = (ball.radius ?? CONFIG.BALL_RADIUS) * this.scale;
    const enterPx = Math.max(
      CONFIG.AIM_CENTER_GUARD_ENTER_PX ?? 14,
      ballRadiusPx * (CONFIG.AIM_CENTER_GUARD_ENTER_RADII ?? 6)
    );
    const exitPx = Math.max(
      CONFIG.AIM_CENTER_GUARD_EXIT_PX ?? 22,
      ballRadiusPx * (CONFIG.AIM_CENTER_GUARD_EXIT_RADII ?? 10)
    );

    // Center guard hysteresis state (tracks whether we're in the "near center" region).
    const prevGuard = this.centerGuardActive;
    if (!this.centerGuardActive) {
      if (rPxRaw < enterPx) this.centerGuardActive = true;
    } else if (rPxRaw > exitPx) {
      this.centerGuardActive = false;
    }

    // Project the cursor vector onto a minimum radius (continuous control, avoids atan2 singularity).
    // Use the enter threshold as the minimum effective radius.
    let dx = dxRaw;
    let dy = dyRaw;
    let rWorld = rWorldRaw;
    let rPx = rPxRaw;
    if (rPxRaw < enterPx) {
      const eps = 1e-6;
      const scaleUp = enterPx / Math.max(rPxRaw, eps);
      dx = dxRaw * scaleUp;
      dy = dyRaw * scaleUp;
      rWorld = rWorldRaw * scaleUp;
      rPx = enterPx;
    }

    const targetAngle = Math.atan2(dy, dx);

    if (this.lastAimAngle === null) {
      this.lastAimAngle = targetAngle;
      if (CONFIG.DEBUG_AIM_GUARD_LOG) {
        console.log('[AimGuard] init', {
          rWorldRaw: Number(rWorldRaw.toFixed(3)),
          rPxRaw: Number(rPxRaw.toFixed(2)),
          rWorld: Number(rWorld.toFixed(3)),
          rPx: Number(rPx.toFixed(2)),
          enterPx: Number(enterPx.toFixed(2)),
          exitPx: Number(exitPx.toFixed(2)),
          ballRadiusPx: Number(ballRadiusPx.toFixed(2)),
          guard: this.centerGuardActive,
          targetDeg: Number((targetAngle * 180 / Math.PI).toFixed(2)),
        });
      }
      return targetAngle;
    }

    if (CONFIG.DEBUG_AIM_GUARD_LOG && prevGuard !== this.centerGuardActive) {
      const state = this.centerGuardActive ? 'ENTER' : 'EXIT';
      console.log(`[AimGuard] ${state}`, {
        rPxRaw: Number(rPxRaw.toFixed(2)),
        rPx: Number(rPx.toFixed(2)),
        enterPx: Number(enterPx.toFixed(2)),
        exitPx: Number(exitPx.toFixed(2)),
        ballRadiusPx: Number(ballRadiusPx.toFixed(2)),
        dxRaw: Number(dxRaw.toFixed(3)),
        dyRaw: Number(dyRaw.toFixed(3)),
        cue: { x: Number(ball.x.toFixed(3)), y: Number(ball.y.toFixed(3)) },
        mouse: { x: Number(this.mouseX.toFixed(3)), y: Number(this.mouseY.toFixed(3)) },
      });
    }

    const effectiveSensitivity = Math.min(1.0, Math.max(0.0, sensitivityMultiplier));

    // Handle angle wrapping (shortest path from lastAngle to targetAngle)
    let delta = targetAngle - this.lastAimAngle;
    while (delta > Math.PI) delta -= 2 * Math.PI;
    while (delta < -Math.PI) delta += 2 * Math.PI;

    // Interpolate: lower sensitivity => smaller steps => finer control
    const smoothedAngle = this.lastAimAngle + delta * effectiveSensitivity;

    if (CONFIG.DEBUG_AIM_GUARD_LOG) {
      const now = Date.now();
      const shouldLog =
        this.centerGuardActive ||
        rPxRaw < enterPx * 1.2 ||
        Math.abs(delta) > Math.PI / 36; // ~5° spike

      if (shouldLog && now - this.lastAimGuardLogMs > 180) {
        this.lastAimGuardLogMs = now;
        console.log('[AimGuard] tick', {
          rWorldRaw: Number(rWorldRaw.toFixed(3)),
          rPxRaw: Number(rPxRaw.toFixed(2)),
          rWorld: Number(rWorld.toFixed(3)),
          rPx: Number(rPx.toFixed(2)),
          guard: this.centerGuardActive,
          enterPx: Number(enterPx.toFixed(2)),
          exitPx: Number(exitPx.toFixed(2)),
          ballRadiusPx: Number(ballRadiusPx.toFixed(2)),
          sensitivityMultiplier: Number(sensitivityMultiplier.toFixed(3)),
          effectiveSensitivity: Number(effectiveSensitivity.toFixed(3)),
          deltaDeg: Number((delta * 180 / Math.PI).toFixed(2)),
          appliedDeltaDeg: Number((delta * effectiveSensitivity * 180 / Math.PI).toFixed(2)),
          targetDeg: Number((targetAngle * 180 / Math.PI).toFixed(2)),
          aimDeg: Number((smoothedAngle * 180 / Math.PI).toFixed(2)),
        });
      }
    }

    this.lastAimAngle = smoothedAngle;
    return smoothedAngle;
  }

  resetAimAngle(): void {
    this.lastAimAngle = null;
    this.centerGuardActive = false;
  }

  startPowerBarDrag(screenY: number) {
    this.isDraggingPowerBar = true;
    this.powerBarDragStart = screenY;
  }

  getPowerBarValue(currentScreenY: number): number {
    if (!this.isDraggingPowerBar) return 0;

    const distance = Math.abs(this.powerBarDragStart - currentScreenY);
    return Math.min(CONFIG.CUE_POWER_MAX, distance * 0.1);
  }

  setFineAimActive(active: boolean) {
    this.fineAimActive = active;
    if (!active) {
      this.mouseX = this.mouseTargetX;
      this.mouseY = this.mouseTargetY;
    }
  }

  setAimSuppressed(suppressed: boolean) {
    this.aimSuppressed = suppressed;
    if (!suppressed) {
      this.mouseX = this.mouseTargetX;
      this.mouseY = this.mouseTargetY;
    }
  }

  setTouchAimMode(enabled: boolean) {
    this.touchAimMode = enabled;
    this.pointerDown = false;
    this.setAimDragActive(!enabled ? true : false);
  }

  setAimDragActive(active: boolean) {
    this.aimDragActive = active;
    if (this.touchAimMode) {
      this.setAimSuppressed(!active);
    }
    // Reset smoothing when re-enabling aim drag to avoid stale angle
    if (active) {
      this.resetAimAngle();
    }
  }

  private updateAimFromScreen(screenX: number, screenY: number, applyNow: boolean) {
    const pos = this.screenToGame(screenX, screenY);
    const geom = getTableGeometry();
    const halfW = (geom.playWidthIn ?? CONFIG.TABLE_WIDTH) / 2;
    const halfH = (geom.playHeightIn ?? CONFIG.TABLE_HEIGHT) / 2;
    const frameHalfW = geom.frameOutline.outerHalfWidth;
    const frameHalfH = geom.frameOutline.outerHalfHeight;
    const margin = 0.25; // small tolerance near the frame
    // Ignore inputs outside the table/frame to prevent sidebar/power-bar clicks from hijacking aim
    if (Math.abs(pos.x) > frameHalfW + margin || Math.abs(pos.y) > frameHalfH + margin) {
      return;
    }
    const clampedX = Math.max(-halfW, Math.min(halfW, pos.x));
    const clampedY = Math.max(-halfH, Math.min(halfH, pos.y));
    this.mouseTargetX = clampedX;
    this.mouseTargetY = clampedY;
    if (!this.aimSuppressed || applyNow) {
      this.mouseX = clampedX;
      this.mouseY = clampedY;
    }
  }
}
