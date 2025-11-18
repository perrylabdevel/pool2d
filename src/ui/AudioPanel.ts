import { SettingsManager, type AudioSettings } from './SettingsManager';
import { UIPanel } from './panels/UIPanel';
import { makePanelDraggable } from './drag';
import { bindSliders, type SliderBindConfig } from './controls/SliderBinder';

export class AudioPanel {
  private panel: HTMLElement;
  private controller: UIPanel;

  constructor(private settingsManager: SettingsManager) {
    this.panel = this.createPanel();
    const header = this.panel.querySelector('.panel-header') as HTMLElement | null;
    if (header && !this.panel.closest('#panel-dock')) {
      makePanelDraggable(this.panel, header);
    }

    const focusTarget = this.panel.querySelector<HTMLElement>('input[type="range"], button');
    this.controller = new UIPanel({ id: 'audio-panel', element: this.panel, focusTarget });
    this.controller.addEventListener('panel:open', () => this.loadSettings());

    this.bindSliders();
    this.setupResetButton();
    this.setupPreviewButtons();
  }

  private createPanel(): HTMLElement {
    let panel = document.getElementById('audio-panel') as HTMLElement | null;
    if (panel) return panel;

    const dock = document.getElementById('panel-dock');
    panel = document.createElement('div');
    panel.id = 'audio-panel';
    panel.className = 'panel-dock-card hidden';

    const audio = this.settingsManager.getAudioSettings();

    panel.innerHTML = `
      <div class="panel-header">
        <h3>🔊 Audio Mixer</h3>
      </div>
      <div class="panel-content">
        <div class="settings-group">
          <h4 class="settings-group-title">Master</h4>
          ${this.sliderRow('AUDIO_MASTER_VOLUME', 'Master Volume', 0, 1, 0.01, audio.master)}
        </div>
        <div class="settings-group">
          <h4 class="settings-group-title">Event Levels</h4>
          ${this.eventRow('Cue Hits', 'CUE', 'AUDIO_CUE_VOL', audio.cueHits)}
          ${this.eventRow('Ball Collisions', 'BALL', 'AUDIO_BALL_VOL', audio.ballCollisions)}
          ${this.eventRow('Rail Impacts', 'RAIL', 'AUDIO_RAIL_VOL', audio.railHits)}
          ${this.eventRow('Pocket Drops', 'POCKET', 'AUDIO_POCKET_VOL', audio.pocketDrops)}
        </div>
        <div class="settings-group">
          <h4 class="settings-group-title">Quiet Room</h4>
          <p class="settings-description">Use these to soften the highs and keep the mix controlled.</p>
          ${this.sliderRow('AUDIO_DAMPENING', 'High-Cut Dampening', 0, 1, 0.01, audio.dampening)}
          ${this.sliderRow('AUDIO_COMPRESSION', 'Soft Compression', 0, 1, 0.01, audio.compression)}
        </div>
        <div class="panel-actions">
          <button id="audio-reset" class="panel-btn">Reset Audio</button>
        </div>
      </div>
    `;

    if (dock) {
      dock.prepend(panel);
    } else {
      document.body.appendChild(panel);
    }

    return panel;
  }

  private eventRow(title: string, key: string, sliderId: string, volume: number): string {
    return `
      <div class="event-control">
        ${this.sliderRow(sliderId, `${title} Volume`, 0, 1, 0.01, volume)}
        <button type="button" class="panel-btn audio-preview" data-audio-event="${key}">▶ Preview</button>
      </div>
    `;
  }

  private sliderRow(id: string, label: string, min: number, max: number, step: number, value: number): string {
    return `
      <div class="slider-group">
        <label class="slider-label" for="${id}">
          <span class="slider-title">${label}</span>
          <span class="slider-value" id="${id}-value">${value}</span>
        </label>
        <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}" />
      </div>
    `;
  }

  private bindSliders() {
    const formatPercent = (v: number) => `${Math.round(v * 100)}%`;
    const formatControl = (v: number) => (v <= 0.01 ? 'Off' : `${Math.round(v * 100)}%`);
    const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

    const configs: SliderBindConfig<AudioSettings>[] = [
      { sliderId: 'AUDIO_MASTER_VOLUME', labelId: 'AUDIO_MASTER_VOLUME-value', onChange: (v) => this.update('master', clamp01(v!)), formatValue: formatPercent },
      { sliderId: 'AUDIO_CUE_VOL', labelId: 'AUDIO_CUE_VOL-value', onChange: (v) => this.update('cueHits', clamp01(v!)), formatValue: formatPercent },
      { sliderId: 'AUDIO_BALL_VOL', labelId: 'AUDIO_BALL_VOL-value', onChange: (v) => this.update('ballCollisions', clamp01(v!)), formatValue: formatPercent },
      { sliderId: 'AUDIO_RAIL_VOL', labelId: 'AUDIO_RAIL_VOL-value', onChange: (v) => this.update('railHits', clamp01(v!)), formatValue: formatPercent },
      { sliderId: 'AUDIO_POCKET_VOL', labelId: 'AUDIO_POCKET_VOL-value', onChange: (v) => this.update('pocketDrops', clamp01(v!)), formatValue: formatPercent },
      { sliderId: 'AUDIO_DAMPENING', labelId: 'AUDIO_DAMPENING-value', onChange: (v) => this.update('dampening', clamp01(v!)), formatValue: formatControl },
      { sliderId: 'AUDIO_COMPRESSION', labelId: 'AUDIO_COMPRESSION-value', onChange: (v) => this.update('compression', clamp01(v!)), formatValue: formatControl },
    ];

    bindSliders(configs);
  }

  private setupResetButton() {
    const resetBtn = this.panel.querySelector('#audio-reset');
    resetBtn?.addEventListener('click', () => {
      this.settingsManager.resetAudioSettings();
      this.loadSettings();
    });
  }

  private setupPreviewButtons() {
    const buttons = this.panel.querySelectorAll<HTMLButtonElement>('.audio-preview');
    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const event = btn.dataset.audioEvent;
        if (!event) return;
        window.dispatchEvent(new CustomEvent('audio:preview', { detail: { event } }));
      });
    });
  }

  private update(key: keyof AudioSettings, value: number) {
    this.settingsManager.saveAudioSettings({ [key]: value } as Partial<AudioSettings>);
  }

  private loadSettings() {
    const audio = this.settingsManager.getAudioSettings();
    const formatPercent = (v: number) => `${Math.round(v * 100)}%`;
    const formatControl = (v: number) => (v <= 0.01 ? 'Off' : `${Math.round(v * 100)}%`);
    const sliderMap: Array<[keyof AudioSettings, string, (v: number) => string]> = [
      ['master', 'AUDIO_MASTER_VOLUME', formatPercent],
      ['cueHits', 'AUDIO_CUE_VOL', formatPercent],
      ['ballCollisions', 'AUDIO_BALL_VOL', formatPercent],
      ['railHits', 'AUDIO_RAIL_VOL', formatPercent],
      ['pocketDrops', 'AUDIO_POCKET_VOL', formatPercent],
      ['dampening', 'AUDIO_DAMPENING', formatControl],
      ['compression', 'AUDIO_COMPRESSION', formatControl],
    ];
    sliderMap.forEach(([key, id, formatter]) => {
      const slider = this.panel.querySelector<HTMLInputElement>(`#${id}`);
      if (slider) slider.value = (audio[key] as number).toString();
      const label = this.panel.querySelector<HTMLElement>(`#${id}-value`);
      if (label) label.textContent = formatter(audio[key] as number);
    });
  }

  getController() {
    return this.controller;
  }
}
