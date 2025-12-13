/**
 * BaseScene - Common base class for UI scenes
 * 
 * Provides common functionality shared across all canvas-based UI scenes:
 * - Canvas reference management
 * - Mouse event handling (click, move)
 * - Resize handling
 * - Cleanup on unmount
 */

import { UIScene } from '../SceneController';

export interface Button {
  id: string;
  rect: { x: number; y: number; width: number; height: number };
  action: () => void;
  disabled?: boolean;
}

export abstract class BaseScene implements UIScene {
  protected canvas: HTMLCanvasElement | null = null;
  protected buttons: Button[] = [];
  protected hoveredButtonId: string | null = null;
  
  // Bound event handlers for cleanup
  private boundOnMouseMove: ((e: MouseEvent) => void) | null = null;
  private boundOnClick: ((e: MouseEvent) => void) | null = null;
  private boundOnTouchStart: ((e: TouchEvent) => void) | null = null;

  /**
   * Mount the scene - called when scene becomes active
   */
  mount(): void {
    this.canvas = document.getElementById('ui-stage') as HTMLCanvasElement;
    if (!this.canvas) return;

    // Bind event handlers
    this.boundOnMouseMove = this.handleMouseMove.bind(this);
    this.boundOnClick = this.handleClick.bind(this);
    this.boundOnTouchStart = this.handleTouchStart.bind(this);

    this.canvas.addEventListener('mousemove', this.boundOnMouseMove);
    this.canvas.addEventListener('click', this.boundOnClick);
    this.canvas.addEventListener('touchstart', this.boundOnTouchStart, { passive: false });

    // Initial layout
    this.setupLayout(this.canvas.width, this.canvas.height);

    // Fix initial layout after canvas is properly sized
    requestAnimationFrame(() => {
      if (this.canvas) {
        this.setupLayout(this.canvas.width, this.canvas.height);
      }
    });

    // Scene-specific mount logic
    this.onMount();
  }

  /**
   * Unmount the scene - called when scene becomes inactive
   */
  unmount(): void {
    if (this.canvas) {
      if (this.boundOnMouseMove) {
        this.canvas.removeEventListener('mousemove', this.boundOnMouseMove);
      }
      if (this.boundOnClick) {
        this.canvas.removeEventListener('click', this.boundOnClick);
      }
      if (this.boundOnTouchStart) {
        this.canvas.removeEventListener('touchstart', this.boundOnTouchStart);
      }
      this.canvas.style.cursor = 'default';
    }

    this.boundOnMouseMove = null;
    this.boundOnClick = null;
    this.boundOnTouchStart = null;
    this.buttons = [];
    this.hoveredButtonId = null;

    // Scene-specific unmount logic
    this.onUnmount();
  }

  /**
   * Handle resize events
   */
  onResize(width: number, height: number): void {
    if (!this.canvas) return;
    this.setupLayout(width, height);
  }

  /**
   * Update scene logic (called every frame)
   */
  abstract update(dt: number): void;

  /**
   * Render scene to canvas
   */
  abstract render(ctx: CanvasRenderingContext2D): void;

  /**
   * Setup layout based on canvas dimensions
   * Override in subclass to define buttons and layout
   */
  protected abstract setupLayout(width: number, height: number): void;

  /**
   * Scene-specific mount logic (optional override)
   */
  protected onMount(): void {}

  /**
   * Scene-specific unmount logic (optional override)
   */
  protected onUnmount(): void {}

  /**
   * Handle mouse move - update hover state and cursor
   */
  private handleMouseMove(e: MouseEvent): void {
    if (!this.canvas) return;

    const rect = this.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (this.canvas.height / rect.height);

    const hoveredButton = this.findButtonAt(x, y);
    const newHoveredId = hoveredButton?.id ?? null;

    if (newHoveredId !== this.hoveredButtonId) {
      this.hoveredButtonId = newHoveredId;
      this.canvas.style.cursor = hoveredButton && !hoveredButton.disabled ? 'pointer' : 'default';
    }

    // Allow subclass to handle additional mouse move logic
    this.onMouseMove(x, y, e);
  }

  /**
   * Handle click - trigger button action
   */
  private handleClick(e: MouseEvent): void {
    if (!this.canvas) return;

    const rect = this.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (this.canvas.height / rect.height);

    const clickedButton = this.findButtonAt(x, y);
    if (clickedButton && !clickedButton.disabled) {
      clickedButton.action();
      return;
    }

    // Allow subclass to handle additional click logic
    this.onClick(x, y, e);
  }

  /**
   * Handle touch start - convert to click
   */
  private handleTouchStart(e: TouchEvent): void {
    if (!this.canvas || e.touches.length === 0) return;

    const touch = e.touches[0];
    const rect = this.canvas.getBoundingClientRect();
    const x = (touch.clientX - rect.left) * (this.canvas.width / rect.width);
    const y = (touch.clientY - rect.top) * (this.canvas.height / rect.height);

    const touchedButton = this.findButtonAt(x, y);
    if (touchedButton && !touchedButton.disabled) {
      e.preventDefault();
      touchedButton.action();
      return;
    }

    // Allow subclass to handle additional touch logic
    this.onTouchStart(x, y, e);
  }

  /**
   * Find button at given canvas coordinates
   */
  protected findButtonAt(x: number, y: number): Button | null {
    for (const button of this.buttons) {
      const { rect } = button;
      if (
        x >= rect.x &&
        x <= rect.x + rect.width &&
        y >= rect.y &&
        y <= rect.y + rect.height
      ) {
        return button;
      }
    }
    return null;
  }

  /**
   * Check if a button is currently hovered
   */
  protected isButtonHovered(buttonId: string): boolean {
    return this.hoveredButtonId === buttonId;
  }

  /**
   * Register a button for hit testing
   */
  protected registerButton(button: Button): void {
    // Remove existing button with same id
    this.buttons = this.buttons.filter(b => b.id !== button.id);
    this.buttons.push(button);
  }

  /**
   * Clear all registered buttons
   */
  protected clearButtons(): void {
    this.buttons = [];
    this.hoveredButtonId = null;
  }

  /**
   * Override in subclass for custom mouse move handling
   */
  protected onMouseMove(_x: number, _y: number, _e: MouseEvent): void {}

  /**
   * Override in subclass for custom click handling
   */
  protected onClick(_x: number, _y: number, _e: MouseEvent): void {}

  /**
   * Override in subclass for custom touch handling
   */
  protected onTouchStart(_x: number, _y: number, _e: TouchEvent): void {}
}
