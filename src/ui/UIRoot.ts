
import { uiStateMachine, UIState } from './UIStateMachine';

export class UIRoot {
  private gameCanvas: HTMLCanvasElement;
  private uiCanvas: HTMLCanvasElement;
  private uiStageCanvas: HTMLCanvasElement;
  private debugCanvas: HTMLCanvasElement;
  private hud: HTMLElement;
  private dockRight: HTMLElement | null;
  private dockLeft: HTMLElement | null;

  constructor() {
    this.gameCanvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    this.uiCanvas = document.getElementById('ui-canvas') as HTMLCanvasElement;
    this.uiStageCanvas = document.getElementById('ui-stage') as HTMLCanvasElement;
    this.debugCanvas = document.getElementById('debug-canvas') as HTMLCanvasElement;
    this.hud = document.getElementById('hud') as HTMLElement;
    this.dockRight = document.getElementById('dock-right');
    this.dockLeft = document.getElementById('dock-left');

    this.setupLayering();

    // Sync initial visibility with current UI state and subscribe to changes
    this.updateForState(uiStateMachine.state);
    uiStateMachine.onStateChange((newState) => this.updateForState(newState));
  }

  private setupLayering() {
    // Roadmap: Gameplay -> Debug -> UI Stage -> HUD -> DockBridge
    
    // Base Layer: Gameplay
    if (this.gameCanvas) {
      this.gameCanvas.style.zIndex = '0';
      this.gameCanvas.style.position = 'absolute';
      this.gameCanvas.style.top = '0';
      this.gameCanvas.style.left = '0';
    }

    // Debug Layer
    if (this.debugCanvas) {
      this.debugCanvas.style.zIndex = '1';
      this.debugCanvas.style.position = 'absolute';
      this.debugCanvas.style.top = '0';
      this.debugCanvas.style.left = '0';
      this.debugCanvas.style.pointerEvents = 'none'; // Let clicks pass through debug
    }

    // UI Stage (The new full screen canvas)
    if (this.uiStageCanvas) {
      this.uiStageCanvas.style.zIndex = '2';
      this.uiStageCanvas.style.position = 'absolute';
      this.uiStageCanvas.style.top = '0';
      this.uiStageCanvas.style.left = '0';
      // UI scenes need pointer events
      this.uiStageCanvas.style.pointerEvents = 'auto';
    }

    // UI overlay canvas for gameplay HUD elements (cue, aim lines, etc.)
    if (this.uiCanvas) {
      this.uiCanvas.style.zIndex = '3';
      this.uiCanvas.style.position = 'absolute';
      this.uiCanvas.style.top = '0';
      this.uiCanvas.style.left = '0';
      this.uiCanvas.style.pointerEvents = 'none';
    }

    // HUD Overlay (DOM)
    if (this.hud) {
      this.hud.style.zIndex = '3';
      this.hud.style.position = 'absolute';
      this.hud.style.top = '0';
      this.hud.style.left = '0';
      this.hud.style.width = '100%';
      this.hud.style.height = '100%';
      this.hud.style.pointerEvents = 'none'; // HUD container shouldn't block, but its children will have pointer-events: auto
    }

    // Dev Overlay (Dock)
    // We want this on top of everything for debugging
    if (this.dockRight) {
      this.dockRight.style.zIndex = '100'; // High value to ensure it's on top
    }
    if (this.dockLeft) {
      this.dockLeft.style.zIndex = '100';
    }
  }

  public getUICanvas(): HTMLCanvasElement {
    return this.uiCanvas;
  }

  public getUIStageCanvas(): HTMLCanvasElement {
    return this.uiStageCanvas;
  }

  public setHUDVisibility(visible: boolean) {
    if (this.hud) {
      this.hud.style.display = visible ? 'block' : 'none';
    }
  }

  private updateForState(state: UIState) {
    // Only show the gameplay UI overlay canvas (cue, aim lines, etc.)
    // while actually in the IN_GAME state. For lobby/menus, hide it so
    // scene canvases are not visually mixed with the overlay.
    if (this.uiCanvas) {
      this.uiCanvas.style.display = state === UIState.IN_GAME ? 'block' : 'none';
    }
  }
}

export const uiRoot = new UIRoot();
