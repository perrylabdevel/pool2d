// Input handling for mouse and touch
// Coordinate system: Converts from canvas (Y-down) to world (Y-up, center-origin)

import { Ball } from '../physics/Shapes';
import { CONFIG } from '../config';
import { uiStateMachine, UIState } from '../ui/UIStateMachine';

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

  // Power bar state
  isDraggingPowerBar: boolean = false;
  powerBarDragStart: number = 0;
  private aimSuppressed: boolean = false;

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
    const pos = this.screenToGame(e.clientX, e.clientY);
    this.mouseTargetX = pos.x;
    this.mouseTargetY = pos.y;
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
  }
  
  handleTouchStart(e: TouchEvent) {
    if (uiStateMachine.state !== UIState.IN_GAME) return;
    e.preventDefault();
    if (this.onClick && e.touches.length > 0) {
      const touch = e.touches[0];
      const pos = this.screenToGame(touch.clientX, touch.clientY);
      const handled = this.onClick(pos.x, pos.y, e as any);
      if (handled) {
        e.stopPropagation();
      }
    }
  }
  
  handleTouchMove(e: TouchEvent) {
    if (uiStateMachine.state !== UIState.IN_GAME) return;
    e.preventDefault();
    if (e.touches.length > 0) {
      const touch = e.touches[0];
      const pos = this.screenToGame(touch.clientX, touch.clientY);
      this.mouseTargetX = pos.x;
      this.mouseTargetY = pos.y;
      this.mouseX = this.mouseTargetX;
      this.mouseY = this.mouseTargetY;
    }
  }
  
  handleTouchEnd(e: TouchEvent) {
    e.preventDefault();
    if (this.isDraggingPowerBar) {
      this.isDraggingPowerBar = false;
    }
  }
  
  getAimAngle(ball: Ball, sensitivityMultiplier: number = 1.0): number {
    // Calculate the raw angle from ball to mouse
    const dx = this.mouseX - ball.x;
    const dy = this.mouseY - ball.y;
    const targetAngle = Math.atan2(dy, dx);

    // For long shots, reduce angular sensitivity by interpolating with previous angle
    // Lower sensitivity = slower angular changes = finer control
    if (sensitivityMultiplier < 1.0 && this.lastAimAngle !== null) {
      // Handle angle wrapping (shortest path from lastAngle to targetAngle)
      let delta = targetAngle - this.lastAimAngle;

      // Normalize delta to [-PI, PI]
      while (delta > Math.PI) delta -= 2 * Math.PI;
      while (delta < -Math.PI) delta += 2 * Math.PI;

      // Interpolate: move toward target angle at rate determined by sensitivity
      // Lower sensitivity = smaller steps = smoother, finer control
      const smoothedAngle = this.lastAimAngle + delta * sensitivityMultiplier;
      this.lastAimAngle = smoothedAngle;
      return smoothedAngle;
    }

    // First frame or no smoothing needed
    this.lastAimAngle = targetAngle;
    return targetAngle;
  }

  resetAimAngle(): void {
    this.lastAimAngle = null;
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
}
