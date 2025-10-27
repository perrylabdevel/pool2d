// HUD and UI management
import { SettingsManager } from './SettingsManager';
import { panelManager } from './panels/panelRegistry';
import type { PanelRegistrationOptions } from './panels/PanelManager';
import { UIPanel } from './panels/UIPanel';
import { GameSettingsPanel } from './GameSettingsPanel';

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
  panelManager = panelManager;
  private gameSettingsPanel: GameSettingsPanel;
  
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
    this.gameSettingsPanel = new GameSettingsPanel(this.settingsManager, {
      onStatsVisibilityChange: (visible) => {
        this.showStats = visible;
        this.statsElement.style.display = visible ? 'flex' : 'none';
      },
    });
    this.registerPanel('game-settings', this.gameSettingsPanel.getController(), {
      persistState: true,
      hotkeys: ['o', 'O'],
    });
    this.setupControls();
    this.loadSettings();
  }
  
  setupControls() {
    const pauseBtn = document.getElementById('pause-btn')!;
    const restartBtn = document.getElementById('restart-btn')!;
    const settingsBtn = document.getElementById('settings-btn')!;
    const debugToggle = document.getElementById('debug-toggle')!;
    
    pauseBtn.addEventListener('click', () => {
      // Will be handled by Game class
      window.dispatchEvent(new CustomEvent('game:pause'));
    });
    
    restartBtn.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('game:restart'));
    });
    
    settingsBtn.addEventListener('click', () => {
      const toggled = this.panelManager.togglePanel('game-settings');
      if (!toggled) {
        this.panelManager.openPanel('game-settings');
      }
    });
    
    debugToggle.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('game:debug-toggle'));
    });
    
    this.wirePanelLauncher();
  }

  loadSettings() {
    const gameSettings = this.settingsManager.getGameSettings();
    this.showStats = gameSettings.showFPS;
    this.statsElement.style.display = this.showStats ? 'flex' : 'none';
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

  registerPanel(id: string, panel: UIPanel, options?: PanelRegistrationOptions) {
    const launcherButtonSelector = `#panel-launcher [data-panel-id="${id}"]`;
    const button = document.querySelector<HTMLElement>(launcherButtonSelector);

    const registration: PanelRegistrationOptions = {
      ...options,
    };

    if (!registration.toggleButton && button) {
      registration.toggleButton = button;
    }

    if (!registration.group) {
      registration.group = 'sidebar';
    }

    if (!button) {
      console.warn(`Panel launcher button not found for id "${id}"`);
    }

    this.panelManager.registerPanel(panel, registration);
  }

  private wirePanelLauncher() {
    const launcher = document.getElementById('panel-launcher');
    if (!launcher) return;

    const toggleButton = document.getElementById('panel-launcher-toggle');
    if (!toggleButton) return;

    toggleButton.setAttribute('type', 'button');
    toggleButton.setAttribute('aria-expanded', 'true');

    toggleButton.addEventListener('click', (event) => {
      event.preventDefault();
      const collapsed = launcher.classList.toggle('collapsed');
      toggleButton.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      const rightDock = document.getElementById('dock-right');
      if (rightDock) {
        rightDock.classList.toggle('collapsed', collapsed);
      }
      const leftDock = document.getElementById('dock-left');
      if (leftDock) {
        leftDock.classList.toggle('collapsed', collapsed);
      }
      const workspace = document.getElementById('workspace');
      if (workspace) {
        workspace.classList.toggle('docks-collapsed', collapsed);
      }
      console.log('[HUD] Dock toggle state changed', {
        collapsed,
        leftDockWidth: leftDock?.offsetWidth ?? null,
        rightDockWidth: rightDock?.offsetWidth ?? null,
      });
      const emitResize = () => window.dispatchEvent(new Event('resize'));
      emitResize();
      requestAnimationFrame(() => {
        emitResize();
      });
    });
  }
}
