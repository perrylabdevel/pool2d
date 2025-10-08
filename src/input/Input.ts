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
  
  // Power bar state
  isDraggingPowerBar: boolean = false;
  powerBarDragStart: number = 0;
  
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
    this.mouseX = pos.x;
    this.mouseY = pos.y;
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
}
