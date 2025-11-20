
export class UIRoot {
  private gameCanvas: HTMLCanvasElement;
  private uiCanvas: HTMLCanvasElement;
  private debugCanvas: HTMLCanvasElement;
  private hud: HTMLElement;
  private dockRight: HTMLElement | null;
  private dockLeft: HTMLElement | null;

  constructor() {
    this.gameCanvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    this.uiCanvas = document.getElementById('ui-canvas') as HTMLCanvasElement;
    this.debugCanvas = document.getElementById('debug-canvas') as HTMLCanvasElement;
    this.hud = document.getElementById('hud') as HTMLElement;
    this.dockRight = document.getElementById('dock-right');
    this.dockLeft = document.getElementById('dock-left');

    this.setupLayering();
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
    if (this.uiCanvas) {
      this.uiCanvas.style.zIndex = '2';
      this.uiCanvas.style.position = 'absolute';
      this.uiCanvas.style.top = '0';
      this.uiCanvas.style.left = '0';
      // UI needs pointer events
    }

    // HUD Overlay
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

  public setHUDVisibility(visible: boolean) {
    if (this.hud) {
      this.hud.style.display = visible ? 'block' : 'none';
    }
  }
}

export const uiRoot = new UIRoot();
