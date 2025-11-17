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
    this.setupWaveformSelects();
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
        ${this.eventSection('Cue Hits', 'CUE', {
          volume: audio.cueHits,
          freq: audio.cueBaseFreq,
          attack: audio.cueAttack,
          sustain: audio.cueSustain,
          release: audio.cueRelease,
          waveform: audio.cueWaveform,
        })}
        ${this.eventSection('Ball Collisions', 'BALL', {
          volume: audio.ballCollisions,
          freq: audio.ballBaseFreq,
          attack: audio.ballAttack,
          sustain: audio.ballSustain,
          release: audio.ballRelease,
          waveform: audio.ballWaveform,
        })}
        ${this.eventSection('Rail Impacts', 'RAIL', {
          volume: audio.railHits,
          freq: audio.railBaseFreq,
          attack: audio.railAttack,
          sustain: audio.railSustain,
          release: audio.railRelease,
          waveform: audio.railWaveform,
        })}
        ${this.eventSection('Pocket Drops', 'POCKET', {
          volume: audio.pocketDrops,
          freq: audio.pocketBaseFreq,
          attack: audio.pocketAttack,
          sustain: audio.pocketSustain,
          release: audio.pocketRelease,
          waveform: audio.pocketWaveform,
        })}
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

  private eventSection(title: string, key: string, params: { volume: number; freq: number; attack: number; sustain: number; release: number; waveform: OscillatorType }): string {
    return `
      <div class="settings-group">
        <h4 class="settings-group-title">${title}</h4>
        ${this.sliderRow(`AUDIO_${key}_VOL`, 'Volume', 0, 1, 0.01, params.volume)}
        ${this.sliderRow(`AUDIO_${key}_FREQ`, 'Base Frequency (Hz)', 40, 500, 1, params.freq)}
        ${this.sliderRow(`AUDIO_${key}_ATTACK`, 'Attack (s)', 0.001, 0.2, 0.005, params.attack)}
        ${this.sliderRow(`AUDIO_${key}_SUSTAIN`, 'Sustain Level', 0, 1, 0.01, params.sustain)}
        ${this.sliderRow(`AUDIO_${key}_RELEASE`, 'Release (s)', 0.05, 0.7, 0.01, params.release)}
        ${this.waveformRow(`AUDIO_${key}_WAVE`, params.waveform)}
        <button type="button" class="panel-btn audio-preview" data-audio-event="${key}">▶ Preview</button>
      </div>
    `;
  }

  private waveformRow(id: string, value: OscillatorType): string {
    return `
      <div class="slider-group">
        <label class="slider-label" for="${id}">
          <span class="slider-title">Waveform</span>
        </label>
        <select id="${id}">
          ${this.waveformOptions(value)}
        </select>
      </div>
    `;
  }

  private waveformOptions(selected: OscillatorType): string {
    return (['sine', 'triangle', 'square', 'sawtooth'] as OscillatorType[])
      .map((wave) => `<option value="${wave}" ${wave === selected ? 'selected' : ''}>${wave}</option>`)
      .join('');
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
    const formatHz = (v: number) => `${Math.round(v)} Hz`;
    const formatSeconds = (v: number) => `${v.toFixed(3)} s`;
    const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

    const configs: SliderBindConfig<AudioSettings>[] = [
      { sliderId: 'AUDIO_MASTER_VOLUME', labelId: 'AUDIO_MASTER_VOLUME-value', onChange: (v) => this.update('master', clamp01(v!)), formatValue: formatPercent },

      { sliderId: 'AUDIO_CUE_VOL', labelId: 'AUDIO_CUE_VOL-value', onChange: (v) => this.update('cueHits', clamp01(v!)), formatValue: formatPercent },
      { sliderId: 'AUDIO_CUE_FREQ', labelId: 'AUDIO_CUE_FREQ-value', onChange: (v) => this.update('cueBaseFreq', v!), formatValue: formatHz },
      { sliderId: 'AUDIO_CUE_ATTACK', labelId: 'AUDIO_CUE_ATTACK-value', onChange: (v) => this.update('cueAttack', v!), formatValue: formatSeconds },
      { sliderId: 'AUDIO_CUE_SUSTAIN', labelId: 'AUDIO_CUE_SUSTAIN-value', onChange: (v) => this.update('cueSustain', clamp01(v!)), formatValue: formatPercent },
      { sliderId: 'AUDIO_CUE_RELEASE', labelId: 'AUDIO_CUE_RELEASE-value', onChange: (v) => this.update('cueRelease', v!), formatValue: formatSeconds },

      { sliderId: 'AUDIO_BALL_VOL', labelId: 'AUDIO_BALL_VOL-value', onChange: (v) => this.update('ballCollisions', clamp01(v!)), formatValue: formatPercent },
      { sliderId: 'AUDIO_BALL_FREQ', labelId: 'AUDIO_BALL_FREQ-value', onChange: (v) => this.update('ballBaseFreq', v!), formatValue: formatHz },
      { sliderId: 'AUDIO_BALL_ATTACK', labelId: 'AUDIO_BALL_ATTACK-value', onChange: (v) => this.update('ballAttack', v!), formatValue: formatSeconds },
      { sliderId: 'AUDIO_BALL_SUSTAIN', labelId: 'AUDIO_BALL_SUSTAIN-value', onChange: (v) => this.update('ballSustain', clamp01(v!)), formatValue: formatPercent },
      { sliderId: 'AUDIO_BALL_RELEASE', labelId: 'AUDIO_BALL_RELEASE-value', onChange: (v) => this.update('ballRelease', v!), formatValue: formatSeconds },

      { sliderId: 'AUDIO_RAIL_VOL', labelId: 'AUDIO_RAIL_VOL-value', onChange: (v) => this.update('railHits', clamp01(v!)), formatValue: formatPercent },
      { sliderId: 'AUDIO_RAIL_FREQ', labelId: 'AUDIO_RAIL_FREQ-value', onChange: (v) => this.update('railBaseFreq', v!), formatValue: formatHz },
      { sliderId: 'AUDIO_RAIL_ATTACK', labelId: 'AUDIO_RAIL_ATTACK-value', onChange: (v) => this.update('railAttack', v!), formatValue: formatSeconds },
      { sliderId: 'AUDIO_RAIL_SUSTAIN', labelId: 'AUDIO_RAIL_SUSTAIN-value', onChange: (v) => this.update('railSustain', clamp01(v!)), formatValue: formatPercent },
      { sliderId: 'AUDIO_RAIL_RELEASE', labelId: 'AUDIO_RAIL_RELEASE-value', onChange: (v) => this.update('railRelease', v!), formatValue: formatSeconds },

      { sliderId: 'AUDIO_POCKET_VOL', labelId: 'AUDIO_POCKET_VOL-value', onChange: (v) => this.update('pocketDrops', clamp01(v!)), formatValue: formatPercent },
      { sliderId: 'AUDIO_POCKET_FREQ', labelId: 'AUDIO_POCKET_FREQ-value', onChange: (v) => this.update('pocketBaseFreq', v!), formatValue: formatHz },
      { sliderId: 'AUDIO_POCKET_ATTACK', labelId: 'AUDIO_POCKET_ATTACK-value', onChange: (v) => this.update('pocketAttack', v!), formatValue: formatSeconds },
      { sliderId: 'AUDIO_POCKET_SUSTAIN', labelId: 'AUDIO_POCKET_SUSTAIN-value', onChange: (v) => this.update('pocketSustain', clamp01(v!)), formatValue: formatPercent },
      { sliderId: 'AUDIO_POCKET_RELEASE', labelId: 'AUDIO_POCKET_RELEASE-value', onChange: (v) => this.update('pocketRelease', v!), formatValue: formatSeconds },
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

  private setupWaveformSelects() {
    const map: Array<[string, keyof AudioSettings]> = [
      ['AUDIO_CUE_WAVE', 'cueWaveform'],
      ['AUDIO_BALL_WAVE', 'ballWaveform'],
      ['AUDIO_RAIL_WAVE', 'railWaveform'],
      ['AUDIO_POCKET_WAVE', 'pocketWaveform'],
    ];
    map.forEach(([id, key]) => {
      const select = this.panel.querySelector<HTMLSelectElement>(`#${id}`);
      if (!select) return;
      select.addEventListener('change', () => {
        const value = select.value as OscillatorType;
        this.update(key, value);
      });
    });
  }

  private update(key: keyof AudioSettings, value: number | OscillatorType) {
    this.settingsManager.saveAudioSettings({ [key]: value } as Partial<AudioSettings>);
  }

  private loadSettings() {
    const audio = this.settingsManager.getAudioSettings();
    const formatPercent = (v: number) => `${Math.round(v * 100)}%`;
    const formatHz = (v: number) => `${Math.round(v)} Hz`;
    const formatSeconds = (v: number) => `${v.toFixed(3)} s`;
    const sliderMap: Array<[keyof AudioSettings, string, (v: number) => string]> = [
      ['master', 'AUDIO_MASTER_VOLUME', formatPercent],
      ['cueHits', 'AUDIO_CUE_VOL', formatPercent],
      ['cueBaseFreq', 'AUDIO_CUE_FREQ', formatHz],
      ['cueAttack', 'AUDIO_CUE_ATTACK', formatSeconds],
      ['cueSustain', 'AUDIO_CUE_SUSTAIN', formatPercent],
      ['cueRelease', 'AUDIO_CUE_RELEASE', formatSeconds],
      ['ballCollisions', 'AUDIO_BALL_VOL', formatPercent],
      ['ballBaseFreq', 'AUDIO_BALL_FREQ', formatHz],
      ['ballAttack', 'AUDIO_BALL_ATTACK', formatSeconds],
      ['ballSustain', 'AUDIO_BALL_SUSTAIN', formatPercent],
      ['ballRelease', 'AUDIO_BALL_RELEASE', formatSeconds],
      ['railHits', 'AUDIO_RAIL_VOL', formatPercent],
      ['railBaseFreq', 'AUDIO_RAIL_FREQ', formatHz],
      ['railAttack', 'AUDIO_RAIL_ATTACK', formatSeconds],
      ['railSustain', 'AUDIO_RAIL_SUSTAIN', formatPercent],
      ['railRelease', 'AUDIO_RAIL_RELEASE', formatSeconds],
      ['pocketDrops', 'AUDIO_POCKET_VOL', formatPercent],
      ['pocketBaseFreq', 'AUDIO_POCKET_FREQ', formatHz],
      ['pocketAttack', 'AUDIO_POCKET_ATTACK', formatSeconds],
      ['pocketSustain', 'AUDIO_POCKET_SUSTAIN', formatPercent],
      ['pocketRelease', 'AUDIO_POCKET_RELEASE', formatSeconds],
    ];
    sliderMap.forEach(([key, id, formatter]) => {
      const slider = this.panel.querySelector<HTMLInputElement>(`#${id}`);
      if (slider) slider.value = (audio[key] as number).toString();
      const label = this.panel.querySelector<HTMLElement>(`#${id}-value`);
      if (label) label.textContent = formatter(audio[key] as number);
    });

    const selectMap: Array<[keyof AudioSettings, string]> = [
      ['cueWaveform', 'AUDIO_CUE_WAVE'],
      ['ballWaveform', 'AUDIO_BALL_WAVE'],
      ['railWaveform', 'AUDIO_RAIL_WAVE'],
      ['pocketWaveform', 'AUDIO_POCKET_WAVE'],
    ];
    selectMap.forEach(([key, id]) => {
      const select = this.panel.querySelector<HTMLSelectElement>(`#${id}`);
      if (select) select.value = audio[key] as string;
    });
  }

  getController() {
    return this.controller;
  }
}
