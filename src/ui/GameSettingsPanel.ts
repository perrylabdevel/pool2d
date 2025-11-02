import { SettingsManager } from './SettingsManager';
import { UIPanel } from './panels/UIPanel';
import { SettingsIO } from './SettingsIO';

interface GameSettingsPanelCallbacks {
  onAimAssistToggle?: (enabled: boolean) => void;
  onStatsVisibilityChange?: (visible: boolean) => void;
}

export class GameSettingsPanel {
  private readonly panel: HTMLElement;
  private readonly controller: UIPanel;
  private readonly settingsManager: SettingsManager;
  private readonly settingsIO: SettingsIO;
  private readonly callbacks: GameSettingsPanelCallbacks;

  constructor(settingsManager: SettingsManager, callbacks: GameSettingsPanelCallbacks = {}) {
    this.settingsManager = settingsManager;
    this.settingsIO = new SettingsIO(settingsManager);
    this.callbacks = callbacks;
    this.panel = this.createPanel();

    const focusTarget = this.panel.querySelector<HTMLElement>('input, button');
    this.controller = new UIPanel({
      id: 'game-settings',
      element: this.panel,
      focusTarget,
    });
    this.controller.addEventListener('panel:open', () => this.syncFromSettings());

    this.bindEvents();
    this.syncFromSettings();
  }

  getController(): UIPanel {
    return this.controller;
  }

  private createPanel(): HTMLElement {
    let panel = document.getElementById('game-settings-panel');
    if (panel) {
      return panel;
    }

    const dock = document.getElementById('panel-dock');
    panel = document.createElement('div');
    panel.id = 'game-settings-panel';
    panel.className = 'panel-dock-card hidden';
    panel.innerHTML = `
      <div class="panel-header">
        <h3>🎮 Game & UI Settings</h3>
      </div>
      <div class="panel-content">
        <div class="settings-group">
          <h4 class="settings-group-title">Gameplay</h4>
          <label class="panel-toggle-row">
            <input type="checkbox" id="aim-assist-toggle" />
            <span>Aim Assist</span>
          </label>
          <label class="panel-toggle-row">
            <input type="checkbox" id="call-8-toggle" />
            <span>Call 8-Ball</span>
          </label>
          <label class="panel-toggle-row">
            <input type="checkbox" id="show-fps-toggle" />
            <span>Show FPS/UPS Overlay</span>
          </label>
        </div>
        <div class="settings-group">
          <h4 class="settings-group-title">UI Colors</h4>
          <div class="color-setting">
            <label for="table-color">Table Cloth</label>
            <input type="color" id="table-color" />
          </div>
          <div class="color-setting">
            <label for="frame-color">Table Frame</label>
            <input type="color" id="frame-color" />
          </div>
          <div class="color-setting">
            <label for="rail-color">Rail Cushion</label>
            <input type="color" id="rail-color" />
          </div>
          <div class="color-setting">
            <label for="rail-fill-color">Corner Fill</label>
            <input type="color" id="rail-fill-color" />
          </div>
          <div class="color-setting">
            <label for="active-player-color">Active Player</label>
            <input type="color" id="active-player-color" />
          </div>
          <div class="color-setting">
            <label for="turn-indicator-color">Turn Indicator</label>
            <input type="color" id="turn-indicator-color" />
          </div>
        </div>
        <div class="settings-group">
          <h4 class="settings-group-title">💾 Settings Management</h4>
          <div class="panel-actions" style="gap: 8px; display: flex; flex-direction: column;">
            <div style="display: flex; gap: 8px;">
              <button id="settings-export-file" class="panel-btn">💾 Save to File</button>
              <button id="settings-export-clipboard" class="panel-btn">📋 Copy JSON</button>
            </div>
            <div style="display: flex; gap: 8px;">
              <button id="settings-import-file" class="panel-btn">📂 Load from File</button>
              <button id="settings-import-clipboard" class="panel-btn">📥 Paste JSON</button>
            </div>
          </div>
        </div>
        <div class="panel-actions">
          <button type="button" id="settings-reset-ui" class="panel-btn">Reset Colors</button>
        </div>
      </div>
    `;

    if (dock) {
      dock.prepend(panel);
    } else {
      document.body.append(panel);
    }

    return panel;
  }

  private bindEvents(): void {
    const aimAssistToggle = this.panel.querySelector<HTMLInputElement>('#aim-assist-toggle');
    const call8Toggle = this.panel.querySelector<HTMLInputElement>('#call-8-toggle');
    const showFpsToggle = this.panel.querySelector<HTMLInputElement>('#show-fps-toggle');

    aimAssistToggle?.addEventListener('change', (event) => {
      const enabled = (event.target as HTMLInputElement).checked;
      this.settingsManager.saveGameSettings({ aimAssist: enabled });
      window.dispatchEvent(new CustomEvent('game:aim-assist-toggle', { detail: { enabled } }));
      this.callbacks.onAimAssistToggle?.(enabled);
    });

    call8Toggle?.addEventListener('change', (event) => {
      const enabled = (event.target as HTMLInputElement).checked;
      this.settingsManager.saveGameSettings({ call8Ball: enabled });
    });

    showFpsToggle?.addEventListener('change', (event) => {
      const visible = (event.target as HTMLInputElement).checked;
      this.settingsManager.saveGameSettings({ showFPS: visible });
      this.callbacks.onStatsVisibilityChange?.(visible);
    });

    const colorInputs = this.panel.querySelectorAll<HTMLInputElement>('.color-setting input[type="color"]');
    colorInputs.forEach((input) => {
      input.addEventListener('input', (event) => {
        const target = event.target as HTMLInputElement;
        const key = target.id;
        const value = target.value;
        switch (key) {
          case 'table-color':
            this.settingsManager.saveUIColors({ tableColor: value });
            break;
          case 'frame-color':
            this.settingsManager.saveUIColors({ frameColor: value });
            break;
          case 'rail-color':
            this.settingsManager.saveUIColors({ railColor: value });
            break;
          case 'rail-fill-color':
            this.settingsManager.saveUIColors({ railFillColor: value });
            break;
          case 'active-player-color':
            this.settingsManager.saveUIColors({ activePlayerColor: value });
            break;
          case 'turn-indicator-color':
            this.settingsManager.saveUIColors({ turnIndicatorColor: value });
            break;
          default:
            break;
        }
      });
    });

    const resetButton = this.panel.querySelector<HTMLButtonElement>('#settings-reset-ui');
    resetButton?.addEventListener('click', () => {
      this.settingsManager.resetUIColors();
      this.syncColorInputs();
    });

    // Export buttons
    const exportFileBtn = this.panel.querySelector('#settings-export-file');
    exportFileBtn?.addEventListener('click', () => this.settingsIO.downloadAsFile());

    const exportClipboardBtn = this.panel.querySelector('#settings-export-clipboard');
    exportClipboardBtn?.addEventListener('click', () => this.settingsIO.copyToClipboard());

    // Import buttons
    const importFileBtn = this.panel.querySelector('#settings-import-file');
    importFileBtn?.addEventListener('click', async () => {
      const success = await this.settingsIO.importFromFile();
      if (success) {
        this.syncFromSettings(); // Refresh UI
      }
    });

    const importClipboardBtn = this.panel.querySelector('#settings-import-clipboard');
    importClipboardBtn?.addEventListener('click', async () => {
      const success = await this.settingsIO.importFromClipboard();
      if (success) {
        this.syncFromSettings(); // Refresh UI
      }
    });
  }

  private syncFromSettings(): void {
    const gameSettings = this.settingsManager.getGameSettings();
    const aimAssistToggle = this.panel.querySelector<HTMLInputElement>('#aim-assist-toggle');
    const call8Toggle = this.panel.querySelector<HTMLInputElement>('#call-8-toggle');
    const showFpsToggle = this.panel.querySelector<HTMLInputElement>('#show-fps-toggle');

    if (aimAssistToggle) aimAssistToggle.checked = gameSettings.aimAssist;
    if (call8Toggle) call8Toggle.checked = gameSettings.call8Ball;
    if (showFpsToggle) {
      showFpsToggle.checked = gameSettings.showFPS;
      this.callbacks.onStatsVisibilityChange?.(gameSettings.showFPS);
    }

    this.syncColorInputs();
  }

  private syncColorInputs(): void {
    const uiColors = this.settingsManager.getUIColors();
    const tableColorInput = this.panel.querySelector<HTMLInputElement>('#table-color');
    const frameColorInput = this.panel.querySelector<HTMLInputElement>('#frame-color');
    const railColorInput = this.panel.querySelector<HTMLInputElement>('#rail-color');
    const railFillColorInput = this.panel.querySelector<HTMLInputElement>('#rail-fill-color');
    const activePlayerColorInput = this.panel.querySelector<HTMLInputElement>('#active-player-color');
    const turnIndicatorColorInput = this.panel.querySelector<HTMLInputElement>('#turn-indicator-color');

    if (tableColorInput) tableColorInput.value = uiColors.tableColor;
    if (frameColorInput) frameColorInput.value = uiColors.frameColor;
    if (railColorInput) railColorInput.value = uiColors.railColor;
    if (railFillColorInput) railFillColorInput.value = uiColors.railFillColor;
    if (activePlayerColorInput) activePlayerColorInput.value = uiColors.activePlayerColor;
    if (turnIndicatorColorInput) turnIndicatorColorInput.value = uiColors.turnIndicatorColor;
  }
}

