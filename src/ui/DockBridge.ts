export class DockBridge {
  private dockLeft: HTMLElement | null;
  private dockRight: HTMLElement | null;
  private isVisible: boolean = false;

  constructor() {
    this.dockLeft = document.getElementById('dock-left');
    this.dockRight = document.getElementById('dock-right');

    // Initially hide dock as per plan (Hub is default)
    // but only if the new UI system is active.
    // For now, let's default to hidden as the plan suggests "treat the dock purely as a temporary dev tool"
    this.hide();

    window.addEventListener('keydown', (e) => {
      // Shift+L for Legacy Dock (Shift+D is reserved for Debug Overlay)
      if ((e.key === 'l' || e.key === 'L') && e.shiftKey) {
        this.toggle();
      }
    });
  }

  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  show() {
    this.isVisible = true;
    if (this.dockLeft) this.dockLeft.style.display = '';
    if (this.dockRight) this.dockRight.style.display = '';
    document.getElementById('workspace')?.classList.remove('docks-collapsed');
    
    // Also show the panel launcher toggle if it exists
    const launcherToggle = document.querySelector('.panel-launcher-toggle') as HTMLElement;
    if (launcherToggle) launcherToggle.style.display = '';
  }

  hide() {
    this.isVisible = false;
    if (this.dockLeft) this.dockLeft.style.display = 'none';
    if (this.dockRight) this.dockRight.style.display = 'none';
    document.getElementById('workspace')?.classList.add('docks-collapsed');

    // Hide launcher toggle too to be clean
    const launcherToggle = document.querySelector('.panel-launcher-toggle') as HTMLElement;
    if (launcherToggle) launcherToggle.style.display = 'none';
  }
}

export const dockBridge = new DockBridge();
