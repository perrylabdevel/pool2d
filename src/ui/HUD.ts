// HUD and UI management - Updated for Texture System
import { SettingsManager } from './SettingsManager';
import { panelManager } from './panels/panelRegistry';
import type { PanelRegistrationOptions } from './panels/PanelManager';
import { UIPanel } from './panels/UIPanel';
import { GameSettingsPanel } from './GameSettingsPanel';
import { notificationService } from './NotificationService';
import { uiStateMachine, UIState } from './UIStateMachine';
import { sceneController } from './SceneController';
import { AssetRegistry } from '../assets/AssetRegistry';
import { TextureEditor } from '../textures/ui/TextureEditor';

export class HUD {
  fpsElement: HTMLElement | null;
  upsElement: HTMLElement | null;
  modeElement: HTMLElement | null;
  turnElement: HTMLElement | null;
  player1Panel: HTMLElement | null;
  player2Panel: HTMLElement | null;
  statsElement: HTMLElement | null;
  settingsManager: SettingsManager;
  panelManager = panelManager;
  private gameSettingsPanel: GameSettingsPanel;
  playbackOverlay: HTMLElement | null;
  playbackTimestamp: HTMLElement | null;
  showStats: boolean = true;

  constructor() {
    this.fpsElement = document.getElementById('fps');
    this.upsElement = document.getElementById('ups');
    this.modeElement = document.getElementById('mode-indicator');
    this.turnElement = document.getElementById('turn-indicator');
    this.player1Panel = document.getElementById('player1-info');
    this.player2Panel = document.getElementById('player2-info');
    this.statsElement = document.getElementById('stats');

    this.statsElement = document.getElementById('stats');

    // Overlay removed in favor of panel indicators
    this.playbackOverlay = null;
    this.playbackTimestamp = null;

    this.settingsManager = new SettingsManager();

    // Initialize SettingsScene with the settingsManager
    sceneController.initializeSettingsScene(this.settingsManager);

    this.gameSettingsPanel = new GameSettingsPanel(this.settingsManager, {
      onStatsVisibilityChange: (visible) => {
        this.showStats = visible;
        if (this.statsElement) {
          this.statsElement.style.display = visible ? 'flex' : 'none';
        }
      },
    });
    this.registerPanel('game-settings', this.gameSettingsPanel.getController(), {
      persistState: true,
      hotkeys: ['o', 'O'],
    });

    this.setupControls();
    this.loadSettings();

    // Listen for settings changes
    window.addEventListener('settings:game-changed', (event) => {
      const detail = (event as CustomEvent<{ settings: any }>).detail;
      if (detail?.settings) {
        this.showStats = detail.settings.showFPS;
        if (this.statsElement) {
          this.statsElement.style.display = this.showStats ? 'flex' : 'none';
        }
      }
    });
  }

  setupControls() {
    const pauseBtn = document.getElementById('pause-btn');
    const hudMenuBtn = document.getElementById('hud-menu-btn');
    const restartBtn = document.getElementById('restart-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const debugToggle = document.getElementById('debug-toggle');

    if (hudMenuBtn) {
      const goMenu = (e: Event) => {
        // Don't preventDefault on touch - browsers won't allow it anyway
        if (e.type !== 'touchstart') {
          e.preventDefault();
        }
        uiStateMachine.transitionTo(UIState.IN_GAME_MENU);
      };
      hudMenuBtn.addEventListener('click', goMenu);
      hudMenuBtn.addEventListener('touchstart', goMenu);
    }

    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => {
        uiStateMachine.transitionTo(UIState.LOBBY);
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

    // Initialize Texture Editor
    const textureEditor = new TextureEditor((config) => {
      const game = (window as any).poolGame;
      if (game && game.renderer) {
        game.renderer.applyTexture(config.type as any, config);
      }
    });

    // Wire up Texture Studio button (hijack existing one or add new one)
    // The existing button has data-panel-id="texture-panel"
    // We can intercept the click or just add a listener to it
    const textureBtn = document.querySelector('button[data-panel-id="texture-panel"]');
    if (textureBtn) {
      // Clone and replace to remove existing listeners (hacky but effective to detach panel logic)
      const newBtn = textureBtn.cloneNode(true);
      textureBtn.parentNode?.replaceChild(newBtn, textureBtn);

      newBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        textureEditor.show();
      });
    }
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

  setPlaybackMode(_active: boolean) {
    // Overlay removed. Status is now handled by the panels themselves.
  }

  updatePlaybackTime(_currentTime: number, _totalDuration: number, _timestamp?: number) {
    // Moved to PlaybackPanel
  }

  setMode(mode: string) {
    if (this.modeElement) this.modeElement.textContent = mode;
  }

  setTurn(player: number, isAI: boolean = false, suppressNotification: boolean = false) {
    if (this.turnElement) {
      if (isAI) {
        this.turnElement.textContent = `AI's Turn`;
        this.turnElement.classList.remove('ai-thinking');
      } else {
        this.turnElement.textContent = player === 1 ? `Your Turn` : `Opponent's Turn`;
        this.turnElement.classList.remove('ai-thinking');
      }
    }

    if (player === 1) {
      this.player1Panel?.classList.add('active');
      this.player2Panel?.classList.remove('active');

      // Show "Your Turn" notification only if we are actually in the game
      if (!isAI && !suppressNotification && uiStateMachine.state === UIState.IN_GAME) {
        notificationService.show('YOUR TURN', 'info', 2000);
      }
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

  showFoul(message: string, type?: 'info' | 'success' | 'warning' | 'error' | 'epic') {
    // Auto-detect message type based on content if not specified
    if (!type) {
      const msg = message.toLowerCase();
      if (msg.includes('victory') || msg.includes('wins') || msg.includes('cleared') || msg.includes('are yours') || msg.includes('ready to dominate')) {
        type = 'success';
      } else if (msg.includes('foul') || msg.includes('scratch') || msg.includes('wrong') || msg.includes('better luck')) {
        type = 'error';
      } else if (msg.includes('call your pocket')) {
        type = 'info';
      } else {
        type = 'info';
      }
    }
    notificationService.show(message, type, 4000);
  }

  setPlayerName(player: number, name: string) {
    const panel = (player === 1 ? this.player1Panel : this.player2Panel) as HTMLElement | null;
    if (!panel) return;
    const nameEl = panel.querySelector('.name') as HTMLElement | null;
    if (nameEl) nameEl.textContent = name;
  }

  /**
   * Set avatar + frame imagery for a player panel.
   * Accepts absolute URLs (already resolved via AssetRegistry).
   */
  setPlayerVisuals(player: number, avatarUrl: string, frameUrl: string) {
    const panel = (player === 1 ? this.player1Panel : this.player2Panel) as HTMLElement | null;
    if (!panel) return;
    const avatar = panel.querySelector('.avatar') as HTMLElement | null;
    if (!avatar) return;

    // Clear previous children and rebuild layers
    avatar.innerHTML = '';
    avatar.classList.add('has-frame');

    const photo = document.createElement('img');
    photo.className = 'avatar-photo';
    photo.src = avatarUrl || AssetRegistry.avatars.player();
    photo.alt = player === 1 ? 'Player avatar' : 'Opponent avatar';

    const frame = document.createElement('img');
    frame.className = 'avatar-frame-img';
    frame.src = frameUrl || AssetRegistry.frames.bronze();
    frame.alt = player === 1 ? 'Player frame' : 'Opponent frame';
    frame.loading = 'eager';

    avatar.appendChild(photo);
    avatar.appendChild(frame);
  }

  /**
   * Show or hide the Player 2 panel (for single-player vs multiplayer modes)
   */
  setPlayer2Visible(visible: boolean) {
    if (!this.player2Panel) return;
    this.player2Panel.style.display = visible ? 'flex' : 'none';
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
      // Unknown group yet – show 7 empty chips (same style as pocketed balls)
      for (let i = 0; i < 7; i++) {
        const chip = document.createElement('span');
        chip.className = 'ball-chip empty placeholder';
        ballsContainer.appendChild(chip);
      }
      return;
    }
    const remainingSet = new Set(remainingIds);
    // Infer group from remaining ids
    const isSolidsGroup = remainingIds.some(id => id >= 1 && id <= 7);
    const groupIds = isSolidsGroup ? [1, 2, 3, 4, 5, 6, 7] : [9, 10, 11, 12, 13, 14, 15];

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

    // Show 8-ball if player has cleared their group
    if (remainingSet.has(8)) {
      const chip = document.createElement('span');
      chip.className = 'ball-chip';
      if (icons && icons.get && icons.has(8)) {
        const img = document.createElement('img');
        img.src = icons.get(8)!;
        img.alt = 'Ball 8';
        chip.classList.add('has-image');
        chip.appendChild(img);
      }
      ballsContainer.appendChild(chip);
    }
  }

  /**
   * Render all remaining balls (for practice mode and arcade modes).
   * Shows all numbered balls 1-15 that are still on the table.
   */
  updateAllBalls(player: number, allRemainingIds: number[]) {
    const panel = (player === 1 ? this.player1Panel : this.player2Panel) as HTMLElement | null;
    if (!panel) return;
    const ballsContainer = panel.querySelector('.balls-remaining') as HTMLElement | null;
    if (!ballsContainer) return;
    ballsContainer.innerHTML = '';

    const remainingSet = new Set(allRemainingIds);
    const allBallIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

    const icons: Map<number, string> | undefined = (window as any).__BALL_ICONS__;
    for (const id of allBallIds) {
      const chip = document.createElement('span');
      const isRemaining = remainingSet.has(id);
      const isSolid = id >= 1 && id <= 7;
      const isStripe = id >= 9 && id <= 15;
      // const is8Ball = id === 8; // Unused

      let className = 'ball-chip';
      if (isSolid) className += ' solids';
      else if (isStripe) className += ' stripes';
      if (!isRemaining) className += ' empty';

      chip.className = className;

      if (isRemaining) {
        if (icons && icons.get && icons.has(id)) {
          const img = document.createElement('img');
          img.src = icons.get(id)!;
          img.alt = `Ball ${id}`;
          chip.classList.add('has-image');
          chip.appendChild(img);
        }
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

    // Load saved collapsed state from localStorage
    const savedState = localStorage.getItem('dock-collapsed');
    const initiallyCollapsed = savedState === 'true';

    // Apply initial state
    if (initiallyCollapsed) {
      launcher.classList.add('collapsed');
      const rightDock = document.getElementById('dock-right');
      const leftDock = document.getElementById('dock-left');
      const workspace = document.getElementById('workspace');
      if (rightDock) rightDock.classList.add('collapsed');
      if (leftDock) leftDock.classList.add('collapsed');
      if (workspace) workspace.classList.add('docks-collapsed');
    }

    toggleButton.setAttribute('aria-expanded', initiallyCollapsed ? 'false' : 'true');

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

      // Save state to localStorage
      localStorage.setItem('dock-collapsed', collapsed.toString());

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
        button.className = 'btn-arcade btn-arcade-glass';
        // Custom layout styles for the grid
        button.style.padding = '20px 40px';
        button.style.fontSize = '18px';
        button.style.height = '100%';

        button.onclick = () => {
          overlay.remove();
          resolve(pocket.id);
        };

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
