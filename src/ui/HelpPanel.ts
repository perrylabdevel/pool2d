import { UIPanel } from './panels/UIPanel';

export class HelpPanel {
    private readonly panel: HTMLElement;
    private readonly controller: UIPanel;

    constructor() {
        this.panel = this.createPanel();
        this.controller = new UIPanel({
            id: 'help-panel',
            element: this.panel,
        });
    }

    getController(): UIPanel {
        return this.controller;
    }

    private createPanel(): HTMLElement {
        let panel = document.getElementById('help-panel');
        if (panel) {
            return panel;
        }

        const dock = document.getElementById('panel-dock');
        panel = document.createElement('div');
        panel.id = 'help-panel';
        panel.className = 'panel-dock-card hidden';
        panel.innerHTML = `
      <div class="panel-header">
        <h3>⌨️ Keyboard Shortcuts</h3>
      </div>
      <div class="panel-content">
        ${this.renderSection('General', [
            { key: 'H / ?', desc: 'Toggle this panel' },
            { key: 'ESC', desc: 'Pause Menu / Close Panel' },
            { key: 'SHIFT+S', desc: 'Settings Scene' },
            { key: 'SHIFT+P', desc: 'Profile Scene' },
            { key: 'SHIFT+C', desc: 'Shop Scene' },
        ])}
        ${this.renderSection('Gameplay', [
            { key: 'Click/Drag', desc: 'Aim / Power' },
            { key: 'Space (Hold)', desc: 'Power Mode' },
            { key: 'A', desc: 'Toggle Aim/Power Mode' },
            { key: 'SHIFT', desc: 'Fine Aim / Move Ball' },
            { key: 'R', desc: 'Restart Game' },
        ])}
        ${this.renderSection('Modes', [
            { key: '8', desc: 'Toggle 8-Ball / Practice' },
            { key: 'T', desc: 'Time Attack' },
            { key: 'P', desc: 'Perfect Game' },
            { key: 'V', desc: 'Speed Pool' },
        ])}
        ${this.renderSection('Tools', [
            { key: 'G', desc: 'Modern Geometry Panel' },
            { key: 'J', desc: 'Legacy Geometry Panel' },
            { key: 'S', desc: 'Physics Settings' },
            { key: 'M', desc: 'Measurement Overlay' },
            { key: 'SHIFT+D', desc: 'Debug Overlay' },
        ])}
      </div>
    `;

        if (dock) {
            dock.prepend(panel);
        } else {
            document.body.append(panel);
        }

        return panel;
    }

    private renderSection(title: string, shortcuts: { key: string; desc: string }[]): string {
        return `
      <div class="settings-group">
        <h4 class="settings-group-title">${title}</h4>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${shortcuts.map(s => `
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="color: rgba(255,255,255,0.8); font-size: 13px;">${s.desc}</span>
              <span class="u-key-badge" style="
                background: rgba(255,255,255,0.1);
                border: 1px solid rgba(255,255,255,0.2);
                padding: 2px 6px;
                border-radius: 4px;
                font-size: 11px;
                font-weight: bold;
                font-family: monospace;
                color: #fff;
              ">${s.key}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    }
}
