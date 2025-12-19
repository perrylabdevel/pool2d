
import { uiStateMachine, UIState } from './UIStateMachine';

export class UIRoot {
  private gameCanvas: HTMLCanvasElement;
  private uiCanvas: HTMLCanvasElement;
  private uiStageCanvas: HTMLCanvasElement;
  private debugCanvas: HTMLCanvasElement;
  private hud: HTMLElement;
  private dockRight: HTMLElement | null;
  private dockLeft: HTMLElement | null;
  private workspaceMain: HTMLElement | null;

  constructor() {
    this.gameCanvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    this.uiCanvas = document.getElementById('ui-canvas') as HTMLCanvasElement;
    this.uiStageCanvas = document.getElementById('ui-stage') as HTMLCanvasElement;
    this.debugCanvas = document.getElementById('debug-canvas') as HTMLCanvasElement;
    this.hud = document.getElementById('hud') as HTMLElement;
    this.dockRight = document.getElementById('dock-right');
    this.dockLeft = document.getElementById('dock-left');
    this.workspaceMain = document.getElementById('workspace-main');
    this.setupLayering();

    // Sync initial visibility with current UI state and subscribe to changes
    this.updateForState(uiStateMachine.state);
    uiStateMachine.onStateChange((newState, previousState) => this.updateForState(newState, previousState));
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

    // UI Stage (Full-screen canvas at workspace level for lobby/menu scenes)
    // Now positioned as direct child of workspace-main to avoid canvas-container constraints
    if (this.uiStageCanvas) {
      this.uiStageCanvas.style.zIndex = '15';
      this.uiStageCanvas.style.position = 'absolute';
      this.uiStageCanvas.style.top = '0';
      this.uiStageCanvas.style.left = '0';
      this.uiStageCanvas.style.width = '100%';
      this.uiStageCanvas.style.height = '100%';
      // UI scenes need pointer events
      this.uiStageCanvas.style.pointerEvents = 'auto';
    }

    // UI overlay canvas for gameplay HUD elements (cue, aim lines, etc.)
    if (this.uiCanvas) {
      this.uiCanvas.style.zIndex = '5';
      this.uiCanvas.style.position = 'absolute';
      this.uiCanvas.style.top = '0';
      this.uiCanvas.style.left = '0';
      this.uiCanvas.style.pointerEvents = 'none';
    }

    // HUD Overlay (DOM)
    if (this.hud) {
      this.hud.style.zIndex = '20';
      this.hud.style.position = 'absolute';
      this.hud.style.top = '0';
      this.hud.style.left = '0';
      this.hud.style.width = '100%';
      this.hud.style.height = '100%';
      // Don't set pointer-events - let CSS handle it (container: none, children: auto)
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

  private updateForState(state: UIState, previousState?: UIState) {
    const inGame = state === UIState.IN_GAME;
    const enteringInGame = inGame && previousState !== UIState.IN_GAME;
    // Only show the gameplay UI overlay canvas (cue, aim lines, etc.)
    // while actually in the IN_GAME state. For lobby/menus, hide it so
    // scene canvases are not visually mixed with the overlay.
    if (this.uiCanvas) {
      this.uiCanvas.style.pointerEvents = 'none';
      this.uiCanvas.style.display = inGame ? 'block' : 'none';
    }

    if (this.uiStageCanvas) {
      if (enteringInGame) {
        const ctx = this.uiStageCanvas.getContext('2d');
        if (ctx) {
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, this.uiStageCanvas.width, this.uiStageCanvas.height);
        }
      }
      this.uiStageCanvas.style.display = inGame ? 'none' : 'block';
      this.uiStageCanvas.style.pointerEvents = inGame ? 'none' : 'auto';
      this.uiStageCanvas.style.visibility = inGame ? 'hidden' : 'visible';
      this.uiStageCanvas.style.opacity = inGame ? '0' : '1';
    }

    // Hide the game canvas (3D table) when in lobby/menu scenes to prevent bleed-through
    if (this.gameCanvas) {
      this.gameCanvas.style.pointerEvents = inGame ? 'auto' : 'none';
      this.gameCanvas.style.display = inGame ? 'block' : 'none';
      this.gameCanvas.style.zIndex = '0';
    }

    if (this.debugCanvas) {
      this.debugCanvas.style.pointerEvents = 'none'; // Always let clicks pass through
      this.debugCanvas.style.display = inGame ? 'block' : 'none';
      this.debugCanvas.style.zIndex = '1';
    }

    // Only show HUD (player info, stats, etc.) during actual gameplay
    // Hide it during lobby/menu scenes to prevent visual overlap and blocking interactions
    if (this.hud) {
      this.hud.style.display = inGame ? 'block' : 'none';
      // Don't set pointer-events here - let CSS handle it (#hud has pointer-events: none,
      // with specific children like #hud-menu-btn having pointer-events: auto)
    }

    // Only add top padding offset when HUD is visible during gameplay
    // Remove it during lobby/menu scenes to allow full-screen canvas
    if (this.workspaceMain) {
      if (inGame) {
        this.workspaceMain.classList.add('workspace-hud-offset');
        this.workspaceMain.classList.add('workspace-in-game');
      } else {
        this.workspaceMain.classList.remove('workspace-hud-offset');
        this.workspaceMain.classList.remove('workspace-in-game');
      }
    }
  }
}

export const uiRoot = new UIRoot();
