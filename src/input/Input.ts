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
  prevMouseX: number = 0;
  prevMouseY: number = 0;
  lastMouseY: number = 0; // Screen space Y for power control

  // Power bar state
  isDraggingPowerBar: boolean = false;
  powerBarDragStart: number = 0;

  // Fine aim mode
  isFineAimMode: boolean = false;
  isUltraFineMode: boolean = false; // Shift + Ctrl
  manualAngle: number | null = null; // Set when using arrow keys

  // Callbacks
  onShoot?: (angle: number, power: number) => void;
  onPowerChange?: (power: number) => void;
  
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

    // Fine aim mode toggle (Shift and Ctrl keys)
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Shift') {
        this.isFineAimMode = true;
      }
      if (e.key === 'Control') {
        this.updateUltraFineMode();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.key === 'Shift') {
        this.isFineAimMode = false;
        this.isUltraFineMode = false;
      }
      if (e.key === 'Control') {
        this.updateUltraFineMode();
      }
    });
  }
  
  updateScale(scale: number) {
    this.scale = scale;
  }
  
  screenToGame(screenX: number, screenY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const canvasX = screenX - rect.left;
    const canvasY = screenY - rect.top;
    
    // Convert from canvas coords (top-left origin, Y-down) to world coords (center origin, Y-up)
    const canvasCenterX = this.canvas.width / 2;
    const canvasCenterY = this.canvas.height / 2;
    
    return {
      x: (canvasX - canvasCenterX) / this.scale,
      y: -(canvasY - canvasCenterY) / this.scale, // Flip Y
    };
  }
  
  handleMouseDown(_e: MouseEvent) {
    // Check if clicking on power bar (will be handled by game logic)
  }
  
  handleMouseMove(e: MouseEvent) {
    const pos = this.screenToGame(e.clientX, e.clientY);

    // Store screen-space Y position for power control
    const rect = this.canvas.getBoundingClientRect();
    this.lastMouseY = e.clientY - rect.top;

    // Apply sensitivity based on fine aim mode
    if (this.isFineAimMode) {
      const sensitivity = CONFIG.AIM_MOUSE_SENSITIVITY_FINE;
      const deltaX = (pos.x - this.prevMouseX) * sensitivity;
      const deltaY = (pos.y - this.prevMouseY) * sensitivity;
      this.mouseX += deltaX;
      this.mouseY += deltaY;
    } else {
      this.mouseX = pos.x;
      this.mouseY = pos.y;
    }

    this.prevMouseX = pos.x;
    this.prevMouseY = pos.y;

    // Reset manual angle when mouse moves (switch back to mouse aim)
    // Note: Game will manage this during spacebar mode to keep angle locked
    // Only clear if arrow keys were used for manual aiming
    if (this.manualAngle !== null) {
      // Keep manual angle if it was explicitly set (don't auto-clear)
      // Game logic will clear it when appropriate
    }
  }
  
  handleMouseUp(_e: MouseEvent) {
    if (this.isDraggingPowerBar) {
      this.isDraggingPowerBar = false;
    }
  }
  
  handleTouchStart(e: TouchEvent) {
    e.preventDefault();
    // Touch support for power bar
  }
  
  handleTouchMove(e: TouchEvent) {
    e.preventDefault();
    if (e.touches.length > 0) {
      const touch = e.touches[0];
      const pos = this.screenToGame(touch.clientX, touch.clientY);
      this.mouseX = pos.x;
      this.mouseY = pos.y;
    }
  }
  
  handleTouchEnd(e: TouchEvent) {
    e.preventDefault();
    if (this.isDraggingPowerBar) {
      this.isDraggingPowerBar = false;
    }
  }
  
  getAimAngle(ball: Ball): number {
    // Use manual angle if set (from arrow keys)
    if (this.manualAngle !== null) {
      return this.manualAngle;
    }

    const dx = this.mouseX - ball.x;
    const dy = this.mouseY - ball.y;
    return Math.atan2(dy, dx);
  }

  adjustAngle(delta: number) {
    // Adjust angle by delta (in degrees)
    const deltaRadians = (delta * Math.PI) / 180;

    if (this.manualAngle === null) {
      // Initialize manual angle from current mouse position
      // We need the current angle, but we don't have ball reference here
      // So we'll just set it to 0 and let the game update it properly
      this.manualAngle = 0;
    }

    this.manualAngle += deltaRadians;

    // Normalize to [-PI, PI]
    while (this.manualAngle > Math.PI) this.manualAngle -= 2 * Math.PI;
    while (this.manualAngle < -Math.PI) this.manualAngle += 2 * Math.PI;
  }

  setManualAngle(angle: number) {
    this.manualAngle = angle;
  }

  clearManualAngle() {
    this.manualAngle = null;
  }

  updateUltraFineMode() {
    // Ultra-fine mode requires both Shift and Ctrl
    this.isUltraFineMode = this.isFineAimMode &&
      (document.querySelector(':focus') === null ||
       (window.event as KeyboardEvent)?.ctrlKey === true);
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
}
