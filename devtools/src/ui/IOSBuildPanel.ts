import { UIPanel } from '../../../src/ui/panels/UIPanel';
import { RemoteSettingsManager } from '../../RemoteSettingsManager';

export class IOSBuildPanel {
  private panel: HTMLElement;
  private panelController: UIPanel;
  private settingsManager: RemoteSettingsManager;
  private logEl: HTMLElement | null = null;
  private buildButton: HTMLButtonElement | null = null;
  private statusEl: HTMLElement | null = null;

  constructor(settingsManager: RemoteSettingsManager) {
    this.settingsManager = settingsManager;
    this.panel = this.createPanel();
    this.panelController = new UIPanel({
      id: 'ios-build-panel',
      element: this.panel,
    });

    this.wireEvents();
  }

  getController() {
    return this.panelController;
  }

  private wireEvents() {
    this.buildButton = this.panel.querySelector<HTMLButtonElement>('#ios-build-btn');
    this.logEl = this.panel.querySelector('#ios-build-log');
    this.statusEl = this.panel.querySelector('#ios-build-status');

    this.buildButton?.addEventListener('click', () => this.requestBuild());

    this.settingsManager.addEventListener('build:ios:status', (e: Event) => {
      const detail = (e as CustomEvent<any>).detail;
      this.appendLog(detail);
      if (detail.status === 'exit') {
        this.setStatus(`Finished (code ${detail.code ?? 'n/a'})`);
        this.setBusy(false);
      } else if (detail.status === 'start') {
        this.setBusy(true);
        this.setStatus('Building...');
      } else if (detail.status === 'error') {
        this.setBusy(false);
        this.setStatus('Error');
      }
    });
  }

  private setBusy(busy: boolean) {
    if (this.buildButton) {
      this.buildButton.disabled = busy;
      this.buildButton.textContent = busy ? 'Building…' : 'Build iOS (Xcode)';
    }
  }

  private setStatus(text: string) {
    if (this.statusEl) {
      this.statusEl.textContent = text;
    }
  }

  private appendLog(entry: any) {
    if (!this.logEl) return;
    const div = document.createElement('div');
    div.className = 'log-entry';
    const ts = new Date().toLocaleTimeString();
    const line = typeof entry === 'string' ? entry : JSON.stringify(entry);
    div.textContent = `[${ts}] ${line}`;
    this.logEl.prepend(div);
  }

  private requestBuild() {
    const state = this.settingsManager.getFullState();
    this.setBusy(true);
    this.setStatus('Queued…');
    this.appendLog({ status: 'request', stateSummary: Object.keys(state) });
    this.settingsManager.sendCommand('build:ios', {
      state,
      requestedAt: Date.now(),
    });
  }

  private createPanel(): HTMLElement {
    let panel = document.getElementById('ios-build-panel') as HTMLElement | null;
    if (panel) return panel;

    const panelDock = document.getElementById('panel-dock');
    panel = document.createElement('div');
    panel.id = 'ios-build-panel';
    panel.className = 'panel-dock-card';
    panel.innerHTML = `
      <div class="panel-header">
        <h3>📱 iOS Build</h3>
      </div>
      <div class="panel-content">
        <p style="margin-top:0;">Build Xcode project using current settings (from local storage sync).</p>
        <div class="panel-actions" style="display:flex; gap:8px; align-items:center;">
          <button id="ios-build-btn" class="panel-btn" style="flex:1;">Build iOS (Xcode)</button>
          <div id="ios-build-status" style="min-width:120px; text-align:right; opacity:0.8;">Idle</div>
        </div>
        <div id="ios-build-log" style="margin-top:12px; padding:10px; background:#111; border:1px solid #333; border-radius:6px; height:200px; overflow:auto; font-family:monospace; font-size:12px;">
          <div class="log-entry">Waiting for build command…</div>
        </div>
      </div>
    `;

    if (panelDock) {
      panelDock.appendChild(panel);
    } else {
      document.body.appendChild(panel);
    }

    return panel;
  }
}
