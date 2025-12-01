import { TextureConfig, TEXTURE_PRESETS } from '../TextureConfig';
import { TextureGenerator } from '../TextureGenerator';

export class TextureEditor {
    private container: HTMLDivElement;
    private preview: HTMLCanvasElement;
    private currentConfig: TextureConfig;
    private onApply: (config: TextureConfig) => void;

    constructor(onApply: (config: TextureConfig) => void) {
        this.onApply = onApply;
        this.currentConfig = JSON.parse(JSON.stringify(TEXTURE_PRESETS.felt_green_classic));
        this.createUI();
    }

    show(): void {
        this.container.style.display = 'block';
        this.updatePreview();
    }

    hide(): void {
        this.container.style.display = 'none';
    }

    private createUI(): void {
        // Main container
        this.container = document.createElement('div');
        this.container.id = 'texture-editor';
        this.container.className = 'modal';

        this.container.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>Texture Editor</h2>
          <button class="close-btn">&times;</button>
        </div>

        <div class="modal-body">
          <!-- Left panel: Controls -->
          <div class="controls-panel">
            <h3>Presets</h3>
            <select id="preset-selector">
              ${Object.keys(TEXTURE_PRESETS).map(key =>
            `<option value="${key}">${this.formatName(key)}</option>`
        ).join('')}
            </select>

            <h3>Pattern Type</h3>
            <select id="pattern-selector">
              <option value="weave">Weave</option>
              <option value="wood_grain">Wood Grain</option>
              <option value="marble">Marble</option>
              <option value="metallic">Metallic</option>
              <option value="geometric">Geometric</option>
            </select>

            <h3>Parameters</h3>
            <div id="param-controls">
              <!-- Dynamically populated based on pattern -->
            </div>

            <div class="button-group">
              <button id="export-btn">Export JSON</button>
              <button id="import-btn">Import JSON</button>
              <button id="reset-btn">Reset</button>
            </div>
          </div>

          <!-- Right panel: Preview -->
          <div class="preview-panel">
            <h3>Preview</h3>
            <canvas id="texture-preview" width="512" height="512"></canvas>
            <div class="preview-info">
              <span id="preview-size">512x512</span>
              <span id="preview-time">0ms</span>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button id="apply-btn" class="btn-primary">Apply to Game</button>
          <button id="cancel-btn">Cancel</button>
        </div>
      </div>
    `;

        document.body.appendChild(this.container);

        // Cache elements
        this.preview = document.getElementById('texture-preview') as HTMLCanvasElement;

        // Attach event listeners
        this.attachEventListeners();

        // Initial population
        this.updateParameterControls();
    }

    private attachEventListeners(): void {
        // Close button
        this.container.querySelector('.close-btn')!.addEventListener('click', () => {
            this.hide();
        });

        // Preset selector
        document.getElementById('preset-selector')!.addEventListener('change', (e) => {
            const presetKey = (e.target as HTMLSelectElement).value;
            // Clone to avoid modifying preset directly
            this.currentConfig = JSON.parse(JSON.stringify(TEXTURE_PRESETS[presetKey]));

            // Update pattern selector to match preset
            const patternSelector = document.getElementById('pattern-selector') as HTMLSelectElement;
            patternSelector.value = this.currentConfig.pattern;

            this.updateParameterControls();
            this.updatePreview();
        });

        // Pattern selector
        document.getElementById('pattern-selector')!.addEventListener('change', (e) => {
            this.currentConfig.pattern = (e.target as HTMLSelectElement).value as any;
            // Reset params for new pattern (could be smarter here)
            this.updateParameterControls();
            this.updatePreview();
        });

        // Apply button
        document.getElementById('apply-btn')!.addEventListener('click', () => {
            this.onApply(this.currentConfig);
            this.hide();
        });

        // Cancel button
        document.getElementById('cancel-btn')!.addEventListener('click', () => {
            this.hide();
        });

        // Export button
        document.getElementById('export-btn')!.addEventListener('click', () => {
            this.exportConfig();
        });

        // Import button
        document.getElementById('import-btn')!.addEventListener('click', () => {
            this.importConfig();
        });

        // Reset button
        document.getElementById('reset-btn')!.addEventListener('click', () => {
            const presetSelector = document.getElementById('preset-selector') as HTMLSelectElement;
            const presetKey = presetSelector.value;
            this.currentConfig = JSON.parse(JSON.stringify(TEXTURE_PRESETS[presetKey]));
            this.updateParameterControls();
            this.updatePreview();
        });
    }

    private updateParameterControls(): void {
        const container = document.getElementById('param-controls')!;
        container.innerHTML = '';

        // Generate sliders for each parameter
        for (const [key, value] of Object.entries(this.currentConfig.params)) {
            const control = this.createParameterControl(key, value);
            container.appendChild(control);
        }
    }

    private createParameterControl(key: string, value: any): HTMLDivElement {
        const div = document.createElement('div');
        div.className = 'param-control';

        if (typeof value === 'number') {
            // Determine range based on value magnitude or key name
            let min = 0;
            let max = 2;
            let step = 0.1;

            if (key.includes('Scale') || key.includes('Spacing')) {
                min = 1;
                max = 100;
                step = 1;
            } else if (key.includes('Density')) {
                min = 0;
                max = 5; // Allow higher density
                step = 0.1;
            } else if (key.includes('Rotation') || key.includes('Direction') || key.includes('Angle')) {
                min = 0;
                max = 360;
                step = 1;
            }

            // Number slider
            div.innerHTML = `
        <label>${this.formatName(key)}</label>
        <input
          type="range"
          id="param-${key}"
          min="${min}"
          max="${max}"
          step="${step}"
          value="${value}"
        />
        <span class="param-value">${value.toFixed(2)}</span>
      `;

            const slider = div.querySelector('input') as HTMLInputElement;
            const valueSpan = div.querySelector('.param-value') as HTMLSpanElement;

            slider.addEventListener('input', (e) => {
                const newValue = parseFloat((e.target as HTMLInputElement).value);
                valueSpan.textContent = newValue.toFixed(2);
                this.currentConfig.params[key] = newValue;
                this.updatePreview();
            });

        } else if (typeof value === 'string' && value.startsWith('#')) {
            // Color picker
            div.innerHTML = `
        <label>${this.formatName(key)}</label>
        <input
          type="color"
          id="param-${key}"
          value="${value}"
        />
      `;

            const colorPicker = div.querySelector('input') as HTMLInputElement;
            colorPicker.addEventListener('input', (e) => {
                this.currentConfig.params[key] = (e.target as HTMLInputElement).value;
                this.updatePreview();
            });
        } else if (typeof value === 'string') {
            // Text input (or dropdown for specific keys)
            if (key === 'type') {
                // Dropdown for pattern type
                const options = ['checker', 'stripe', 'dot', 'hex'];
                div.innerHTML = `
                    <label>${this.formatName(key)}</label>
                    <select id="param-${key}">
                        ${options.map(opt => `<option value="${opt}" ${value === opt ? 'selected' : ''}>${this.formatName(opt)}</option>`).join('')}
                    </select>
                 `;
                const select = div.querySelector('select') as HTMLSelectElement;
                select.addEventListener('change', (e) => {
                    this.currentConfig.params[key] = (e.target as HTMLSelectElement).value;
                    this.updatePreview();
                });
            } else {
                // Generic text
                div.innerHTML = `
                    <label>${this.formatName(key)}</label>
                    <input type="text" id="param-${key}" value="${value}" />
                `;
                const input = div.querySelector('input') as HTMLInputElement;
                input.addEventListener('change', (e) => {
                    this.currentConfig.params[key] = (e.target as HTMLInputElement).value;
                    this.updatePreview();
                });
            }
        }

        return div;
    }

    private updatePreview(): void {
        const start = performance.now();

        // Generate texture
        const texture = TextureGenerator.generate(this.currentConfig);

        // Draw to preview canvas
        const ctx = this.preview.getContext('2d')!;
        ctx.clearRect(0, 0, this.preview.width, this.preview.height);
        ctx.drawImage(texture, 0, 0);

        const time = performance.now() - start;
        document.getElementById('preview-time')!.textContent = `${time.toFixed(0)}ms`;
    }

    private formatName(key: string): string {
        return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    private exportConfig(): void {
        const json = TextureGenerator.exportConfig(this.currentConfig);

        // Copy to clipboard
        navigator.clipboard.writeText(json);

        // Also download as file
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'texture_config.json';
        a.click();

        alert('Config exported to clipboard and downloaded!');
    }

    private importConfig(): void {
        const json = prompt('Paste texture config JSON:');
        if (!json) return;

        try {
            this.currentConfig = TextureGenerator.importConfig(json);
            this.updateParameterControls();
            this.updatePreview();
            alert('Config imported successfully!');
        } catch (e) {
            alert('Invalid JSON: ' + e);
        }
    }
}
