// HUD and UI management
import { SettingsManager } from './SettingsManager';
import { makePanelDraggable } from './drag';

export class HUD {
  fpsElement: HTMLElement;
  upsElement: HTMLElement;
  modeElement: HTMLElement;
  turnElement: HTMLElement;
  foulBanner: HTMLElement;
  player1Panel: HTMLElement;
  player2Panel: HTMLElement;
  statsElement: HTMLElement;
  settingsManager: SettingsManager;
  
  showStats: boolean = true;
  
  constructor() {
    this.fpsElement = document.getElementById('fps')!;
    this.upsElement = document.getElementById('ups')!;
    this.modeElement = document.getElementById('mode-indicator')!;
    this.turnElement = document.getElementById('turn-indicator')!;
    this.foulBanner = document.getElementById('foul-banner')!;
    this.player1Panel = document.getElementById('player1-info')!;
    this.player2Panel = document.getElementById('player2-info')!;
    this.statsElement = document.getElementById('stats')!;
    
    this.settingsManager = new SettingsManager();
    this.setupControls();
    this.loadSettings();
  }
  
  setupControls() {
    const pauseBtn = document.getElementById('pause-btn')!;
    const restartBtn = document.getElementById('restart-btn')!;
    const settingsBtn = document.getElementById('settings-btn')!;
    const debugToggle = document.getElementById('debug-toggle')!;
    const settingsModal = document.getElementById('settings-modal')!;
    const settingsClose = document.getElementById('settings-close')!;
    const settingsModalContent = settingsModal.querySelector('.modal-content') as HTMLElement | null;
    const settingsModalHeader = settingsModalContent?.querySelector('h2') as HTMLElement | null;
    if (settingsModalContent) {
      makePanelDraggable(settingsModalContent, settingsModalHeader ?? settingsModalContent);
    }
    
    pauseBtn.addEventListener('click', () => {
      // Will be handled by Game class
      window.dispatchEvent(new CustomEvent('game:pause'));
    });
    
    restartBtn.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('game:restart'));
    });
    
    settingsBtn.addEventListener('click', () => {
      settingsModal.classList.remove('hidden');
    });

    settingsClose.addEventListener('click', () => {
      settingsModal.classList.add('hidden');
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !settingsModal.classList.contains('hidden')) {
        settingsModal.classList.add('hidden');
      }
    });
    
    debugToggle.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('game:debug-toggle'));
    });
    
    // Game settings toggles
    const aimAssistToggle = document.getElementById('aim-assist-toggle') as HTMLInputElement;
    aimAssistToggle.addEventListener('change', (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      this.settingsManager.saveGameSettings({ aimAssist: checked });
      window.dispatchEvent(new CustomEvent('game:aim-assist-toggle', { detail: { enabled: checked } }));
    });

    const call8Toggle = document.getElementById('call-8-toggle') as HTMLInputElement;
    call8Toggle.addEventListener('change', (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      this.settingsManager.saveGameSettings({ call8Ball: checked });
    });

    const showFpsToggle = document.getElementById('show-fps-toggle') as HTMLInputElement;
    showFpsToggle.addEventListener('change', (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      this.showStats = checked;
      this.statsElement.style.display = this.showStats ? 'flex' : 'none';
      this.settingsManager.saveGameSettings({ showFPS: checked });
    });

    // UI Color inputs
    const tableColorInput = document.getElementById('table-color') as HTMLInputElement;
    tableColorInput.addEventListener('input', (e) => {
      const color = (e.target as HTMLInputElement).value;
      this.settingsManager.saveUIColors({ tableColor: color });
    });

    const railColorInput = document.getElementById('rail-color') as HTMLInputElement;
    railColorInput.addEventListener('input', (e) => {
      const color = (e.target as HTMLInputElement).value;
      this.settingsManager.saveUIColors({ railColor: color });
    });

    const railFillColorInput = document.getElementById('rail-fill-color') as HTMLInputElement;
    railFillColorInput.addEventListener('input', (e) => {
      const color = (e.target as HTMLInputElement).value;
      this.settingsManager.saveUIColors({ railFillColor: color });
    });

    const frameColorInput = document.getElementById('frame-color') as HTMLInputElement;
    if (frameColorInput) {
      frameColorInput.addEventListener('input', (e) => {
        const color = (e.target as HTMLInputElement).value;
        this.settingsManager.saveUIColors({ frameColor: color });
      });
    }

    const activePlayerColorInput = document.getElementById('active-player-color') as HTMLInputElement;
    activePlayerColorInput.addEventListener('input', (e) => {
      const color = (e.target as HTMLInputElement).value;
      this.settingsManager.saveUIColors({ activePlayerColor: color });
    });

    const turnIndicatorColorInput = document.getElementById('turn-indicator-color') as HTMLInputElement;
    turnIndicatorColorInput.addEventListener('input', (e) => {
      const color = (e.target as HTMLInputElement).value;
      this.settingsManager.saveUIColors({ turnIndicatorColor: color });
    });

    // Reset UI colors button
    const resetUIBtn = document.getElementById('settings-reset-ui')!;
    resetUIBtn.addEventListener('click', () => {
      this.settingsManager.resetUIColors();
      this.loadSettings(); // Reload UI to reflect reset
    });
  }

  loadSettings() {
    const gameSettings = this.settingsManager.getGameSettings();
    const uiColors = this.settingsManager.getUIColors();

    // Apply game settings to UI
    const aimAssistToggle = document.getElementById('aim-assist-toggle') as HTMLInputElement;
    if (aimAssistToggle) aimAssistToggle.checked = gameSettings.aimAssist;

    const call8Toggle = document.getElementById('call-8-toggle') as HTMLInputElement;
    if (call8Toggle) call8Toggle.checked = gameSettings.call8Ball;

    const showFpsToggle = document.getElementById('show-fps-toggle') as HTMLInputElement;
    if (showFpsToggle) {
      showFpsToggle.checked = gameSettings.showFPS;
      this.showStats = gameSettings.showFPS;
      this.statsElement.style.display = this.showStats ? 'flex' : 'none';
    }

    // Apply UI colors to inputs
    const tableColorInput = document.getElementById('table-color') as HTMLInputElement;
    if (tableColorInput) tableColorInput.value = uiColors.tableColor;

    const railColorInput = document.getElementById('rail-color') as HTMLInputElement;
    if (railColorInput) railColorInput.value = uiColors.railColor;

    const railFillColorInput = document.getElementById('rail-fill-color') as HTMLInputElement;
    if (railFillColorInput) railFillColorInput.value = uiColors.railFillColor;

    const frameColorInput = document.getElementById('frame-color') as HTMLInputElement;
    if (frameColorInput) frameColorInput.value = uiColors.frameColor;

    const activePlayerColorInput = document.getElementById('active-player-color') as HTMLInputElement;
    if (activePlayerColorInput) activePlayerColorInput.value = uiColors.activePlayerColor;

    const turnIndicatorColorInput = document.getElementById('turn-indicator-color') as HTMLInputElement;
    if (turnIndicatorColorInput) turnIndicatorColorInput.value = uiColors.turnIndicatorColor;
    
    // Note: Geometry settings are now in the dedicated Geometry Panel (press G)
  }
  
  updateFPS(fps: number) {
    this.fpsElement.textContent = `FPS: ${Math.round(fps)}`;
  }
  
  updateUPS(ups: number) {
    this.upsElement.textContent = `UPS: ${Math.round(ups)}`;
  }
  
  setMode(mode: string) {
    this.modeElement.textContent = mode;
  }
  
  setTurn(player: number) {
    this.turnElement.textContent = `Player ${player}'s Turn`;
    
    if (player === 1) {
      this.player1Panel.classList.add('active');
      this.player2Panel.classList.remove('active');
    } else {
      this.player1Panel.classList.remove('active');
      this.player2Panel.classList.add('active');
    }
  }
  
  showFoul(message: string) {
    this.foulBanner.textContent = message;
    this.foulBanner.classList.remove('hidden');
    
    setTimeout(() => {
      this.foulBanner.classList.add('hidden');
    }, 3000);
  }
  
  updatePlayerBalls(player: number, balls: number[]) {
    const panel = player === 1 ? this.player1Panel : this.player2Panel;
    const ballsContainer = panel.querySelector('.balls-remaining')!;
    
    if (balls.length === 0) {
      ballsContainer.textContent = 'No balls assigned';
    } else {
      ballsContainer.textContent = `Balls: ${balls.join(', ')}`;
    }
  }
}
