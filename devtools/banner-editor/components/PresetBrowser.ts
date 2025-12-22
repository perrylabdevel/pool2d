import { BannerStore } from '../stores/BannerStore';
import { presetStore, BannerPreset } from '../stores/PresetStore';

export class PresetBrowser {
  private container: HTMLElement;
  private bannerStore: BannerStore;
  private element: HTMLElement;
  private presets: BannerPreset[] = [];

  constructor(container: HTMLElement, bannerStore: BannerStore) {
    this.container = container;
    this.bannerStore = bannerStore;
    this.element = document.createElement('div');
    this.element.className = 'preset-browser';
    this.container.appendChild(this.element);

    this.init();
  }

  private async init() {
    await presetStore.init();
    await presetStore.ensureBuiltInPresets();
    await this.loadPresets();

    presetStore.subscribe(() => this.loadPresets());
  }

  private async loadPresets() {
    this.presets = await presetStore.getAll();
    this.render();
  }

  private render() {
    const builtIn = this.presets.filter(p => p.isBuiltIn);
    const custom = this.presets.filter(p => !p.isBuiltIn);

    this.element.innerHTML = `
      <div class="preset-section">
        <div class="preset-section-header">
          <span>Built-in Presets</span>
        </div>
        <div class="preset-list">
          ${builtIn.map(p => this.renderPresetItem(p)).join('')}
        </div>
      </div>
      ${custom.length > 0 ? `
        <div class="preset-section">
          <div class="preset-section-header">
            <span>Custom Presets</span>
          </div>
          <div class="preset-list">
            ${custom.map(p => this.renderPresetItem(p)).join('')}
          </div>
        </div>
      ` : ''}
      <div class="preset-actions">
        <button class="btn btn-save" id="btn-save-preset">Save Current</button>
      </div>
    `;

    this.bindEvents();
  }

  private renderPresetItem(preset: BannerPreset): string {
    const typeColor = this.getTypeColor(preset.config.type);
    return `
      <div class="preset-item" data-id="${preset.id}">
        <div class="preset-color" style="background: ${typeColor}"></div>
        <div class="preset-info">
          <div class="preset-name">${this.escapeHtml(preset.name)}</div>
          <div class="preset-type">${preset.config.type}</div>
        </div>
        ${!preset.isBuiltIn ? `<button class="preset-delete" data-id="${preset.id}" title="Delete">×</button>` : ''}
      </div>
    `;
  }

  private getTypeColor(type: string): string {
    switch (type) {
      case 'success': return '#22C55E';
      case 'error': return '#EF4444';
      case 'warning': return '#F59E0B';
      case 'info': return '#0D9488';
      case 'epic': return '#A855F7';
      default: return '#6B7280';
    }
  }

  private escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  private bindEvents() {
    // Click on preset to load
    this.element.querySelectorAll('.preset-item').forEach(item => {
      item.addEventListener('click', async (e) => {
        const target = e.target as HTMLElement;
        if (target.classList.contains('preset-delete')) return;

        const id = (item as HTMLElement).dataset.id;
        if (!id) return;

        const preset = await presetStore.get(id);
        if (preset) {
          this.bannerStore.set(preset.config);
        }
      });
    });

    // Delete preset
    this.element.querySelectorAll('.preset-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = (btn as HTMLElement).dataset.id;
        if (!id) return;

        if (confirm('Delete this preset?')) {
          await presetStore.delete(id);
        }
      });
    });

    // Save current config as new preset
    const saveBtn = this.element.querySelector('#btn-save-preset');
    saveBtn?.addEventListener('click', async () => {
      const name = prompt('Preset name:', 'My Preset');
      if (!name) return;

      const config = this.bannerStore.get();
      await presetStore.createFromConfig(name, config);
    });
  }
}
