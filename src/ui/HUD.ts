// HUD and UI management
import { SettingsManager } from './SettingsManager';
import { panelManager } from './panels/panelRegistry';
import type { PanelRegistrationOptions } from './panels/PanelManager';
import { UIPanel } from './panels/UIPanel';
import { GameSettingsPanel } from './GameSettingsPanel';

export class HUD {
  fpsElement: HTMLElement | null;
  upsElement: HTMLElement | null;
  modeElement: HTMLElement | null;
  turnElement: HTMLElement | null;
  foulBanner: HTMLElement | null;
  player1Panel: HTMLElement | null;
  player2Panel: HTMLElement | null;
  statsElement: HTMLElement | null;
  settingsManager: SettingsManager;
  panelManager = panelManager;
  private gameSettingsPanel: GameSettingsPanel;
  
  showStats: boolean = true;
  
  constructor() {
    this.fpsElement = document.getElementById('fps');
    this.upsElement = document.getElementById('ups');
    this.modeElement = document.getElementById('mode-indicator');
    this.turnElement = document.getElementById('turn-indicator');
    this.foulBanner = document.getElementById('foul-banner');
    this.player1Panel = document.getElementById('player1-info');
    this.player2Panel = document.getElementById('player2-info');
    this.statsElement = document.getElementById('stats');
    
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
    const pauseBtn = document.getElementById('pause-btn');
    const restartBtn = document.getElementById('restart-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const debugToggle = document.getElementById('debug-toggle');

    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => {
        window.dispatchEvent(new CustomEvent('game:pause'));
      });
    }

    if (restartBtn) {
      restartBtn.addEventListener('click', () => {
        window.dispatchEvent(new CustomEvent('game:restart'));
      });
    }

    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        const toggled = this.panelManager.togglePanel('game-settings');
        if (!toggled) {
          this.panelManager.openPanel('game-settings');
        }
      });
    }

    if (debugToggle) {
      debugToggle.addEventListener('click', () => {
        window.dispatchEvent(new CustomEvent('game:debug-toggle'));
      });
    }

    this.wirePanelLauncher();
  }

  loadSettings() {
    const gameSettings = this.settingsManager.getGameSettings();
    this.showStats = gameSettings.showFPS;
    if (this.statsElement) {
      this.statsElement.style.display = this.showStats ? 'flex' : 'none';
    }
  }
  
  updateFPS(fps: number) {
    if (this.fpsElement) this.fpsElement.textContent = `FPS: ${Math.round(fps)}`;
  }
  
  updateUPS(ups: number) {
    if (this.upsElement) this.upsElement.textContent = `UPS: ${Math.round(ups)}`;
  }
  
  setMode(mode: string) {
    if (this.modeElement) this.modeElement.textContent = mode;
  }
  
  setTurn(player: number, isAI: boolean = false) {
    if (this.turnElement) {
      if (isAI) {
        this.turnElement.textContent = `AI's Turn`;
        this.turnElement.classList.remove('ai-thinking');
      } else {
        this.turnElement.textContent = player === 1 ? `Your Turn` : `Player ${player}'s Turn`;
        this.turnElement.classList.remove('ai-thinking');
      }
    }

    if (player === 1) {
      this.player1Panel?.classList.add('active');
      this.player2Panel?.classList.remove('active');
    } else {
      this.player1Panel?.classList.remove('active');
      this.player2Panel?.classList.add('active');
    }
  }

  showAIThinking() {
    if (!this.turnElement) return;
    this.turnElement.textContent = 'AI Thinking...';
    this.turnElement.classList.add('ai-thinking');
  }

  hideTurnIndicator() {
    if (!this.turnElement) return;
    this.turnElement.textContent = '';
    this.turnElement.classList.remove('ai-thinking');
  }

  showArcadeStats(stats: { [key: string]: string | number }) {
    // Display arcade mode stats in the turn indicator area
    const entries = Object.entries(stats);
    if (entries.length === 0) {
      if (this.turnElement) this.turnElement.textContent = '';
      return;
    }

    const statsText = entries.map(([key, value]) => `${key}: ${value}`).join(' | ');
    if (this.turnElement) {
      this.turnElement.textContent = statsText;
      this.turnElement.classList.remove('ai-thinking');
    }
  }
  
  showFoul(message: string) {
    if (!this.foulBanner) return;
    this.foulBanner.textContent = message;
    this.foulBanner.classList.remove('hidden');
    setTimeout(() => {
      this.foulBanner?.classList.add('hidden');
    }, 3000);
  }

  setPlayerName(player: number, name: string) {
    const panel = (player === 1 ? this.player1Panel : this.player2Panel) as HTMLElement | null;
    if (!panel) return;
    const nameEl = panel.querySelector('.name') as HTMLElement | null;
    if (nameEl) nameEl.textContent = name;
  }

  /**
   * Render player's remaining balls.
   * If remainingIds is null, show 7 placeholder dots (group not yet assigned).
   * Otherwise, show numbered chips for each remaining group ball id.
   */
  updatePlayerBalls(player: number, remainingIds: number[] | null) {
    const panel = (player === 1 ? this.player1Panel : this.player2Panel) as HTMLElement | null;
    if (!panel) return;
    const ballsContainer = panel.querySelector('.balls-remaining') as HTMLElement | null;
    if (!ballsContainer) return;
    ballsContainer.innerHTML = '';

    if (!remainingIds) {
      // Unknown group yet – show 7 neutral placeholders
      for (let i = 0; i < 7; i++) {
        const dot = document.createElement('span');
        dot.className = 'ball-dot';
        ballsContainer.appendChild(dot);
      }
      return;
    }
    const remainingSet = new Set(remainingIds);
    // Infer group from remaining ids
    const isSolidsGroup = remainingIds.some(id => id >= 1 && id <= 7);
    const groupIds = isSolidsGroup ? [1,2,3,4,5,6,7] : [9,10,11,12,13,14,15];

    const icons: Map<number, string> | undefined = (window as any).__BALL_ICONS__;
    for (const id of groupIds) {
      const chip = document.createElement('span');
      const isRemaining = remainingSet.has(id);
      chip.className = `ball-chip ${isSolidsGroup ? 'solids' : 'stripes'}${isRemaining ? '' : ' empty'}`;
      if (isRemaining) {
        if (icons && icons.get && icons.has(id)) {
          const img = document.createElement('img');
          img.src = icons.get(id)!;
          img.alt = `Ball ${id}`;
          chip.classList.add('has-image');
          chip.appendChild(img);
        }
        // No fallback overlays (avoid mixed visuals)
      }
      ballsContainer.appendChild(chip);
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

  /**
   * Show a clickable pocket selector overlay for calling the 8-ball
   * Returns a promise that resolves with the selected pocket ID or null if cancelled
   */
  showPocketSelector(pockets: Array<{ id: string; label: string }>): Promise<string | null> {
    return new Promise((resolve) => {
      // Create overlay
      const overlay = document.createElement('div');
      overlay.className = 'pocket-selector-overlay';
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        animation: fadeIn 0.2s ease-out;
      `;

      // Create title
      const title = document.createElement('div');
      title.textContent = 'Call Your Pocket';
      title.style.cssText = `
        font-size: 32px;
        font-weight: bold;
        color: #fff;
        margin-bottom: 30px;
        text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
      `;

      // Create button container
      const buttonContainer = document.createElement('div');
      buttonContainer.style.cssText = `
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 15px;
        max-width: 500px;
      `;

      // Create pocket buttons
      pockets.forEach((pocket) => {
        const button = document.createElement('button');
        button.textContent = pocket.label;
        button.style.cssText = `
          padding: 20px 40px;
          font-size: 18px;
          font-weight: 600;
          color: #fff;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        `;

        button.addEventListener('mouseenter', () => {
          button.style.transform = 'translateY(-2px) scale(1.05)';
          button.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.5)';
          button.style.borderColor = 'rgba(255, 255, 255, 0.6)';
        });

        button.addEventListener('mouseleave', () => {
          button.style.transform = '';
          button.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.4)';
          button.style.borderColor = 'rgba(255, 255, 255, 0.3)';
        });

        button.addEventListener('click', () => {
          overlay.remove();
          resolve(pocket.id);
        });

        buttonContainer.appendChild(button);
      });

      // Add cancel option (ESC key)
      const cancelHint = document.createElement('div');
      cancelHint.textContent = 'Press ESC to cancel';
      cancelHint.style.cssText = `
        margin-top: 30px;
        font-size: 14px;
        color: rgba(255, 255, 255, 0.6);
      `;

      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          overlay.remove();
          document.removeEventListener('keydown', handleEscape);
          resolve(null);
        }
      };
      document.addEventListener('keydown', handleEscape);

      overlay.appendChild(title);
      overlay.appendChild(buttonContainer);
      overlay.appendChild(cancelHint);
      document.body.appendChild(overlay);
    });
  }
}
