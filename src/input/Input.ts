// Input handling for mouse and touch
// Coordinate system: Converts from canvas (Y-down) to world (Y-up, center-origin)

import { Ball } from '../physics/Shapes';
import { CONFIG } from '../config';

export class InputManager {
  canvas: HTMLCanvasElement;
  scale: number;
  
  // Mouse state
  mouseX: number = 0;
  mouseY: number = 0;
  mouseTargetX: number = 0;
  mouseTargetY: number = 0;
  fineAimActive: boolean = false;
  
  // Power bar state
  isDraggingPowerBar: boolean = false;
  powerBarDragStart: number = 0;
  
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
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    
    // Touch support
    this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e));
    this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e));
    this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e));
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
    const pos = this.screenToGame(e.clientX, e.clientY);
    this.mouseTargetX = pos.x;
    this.mouseTargetY = pos.y;
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
  
  getAimAngle(ball: Ball): number {
    const dx = this.mouseX - ball.x;
    const dy = this.mouseY - ball.y;
    return Math.atan2(dy, dx);
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
}
