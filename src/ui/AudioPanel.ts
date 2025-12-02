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
    this.setupMuteButtons();

    // Listen for external audio settings changes (from remote devtools or other sources)
    window.addEventListener('settings:audio-changed', () => {
      this.loadSettings();
    });

    // Also listen for state-updated if using RemoteSettingsManager
    if (this.settingsManager instanceof EventTarget) {
      this.settingsManager.addEventListener('state-updated', () => {
        this.loadSettings();
      });
    }
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
        <h3>Audio Mixer</h3>
      </div>
      <div class="panel-content">
        <div class="settings-group">
          <h4 class="settings-group-title">Master</h4>
          ${this.masterRow(audio.master, !!audio.muteMaster)}
        </div>
        <div class="settings-group">
          <h4 class="settings-group-title">Music & Ambience</h4>
          ${this.eventRow('Music Track', 'MUSIC', 'AUDIO_MUSIC_VOL', audio.music, !!audio.muteMusic)}
          ${this.eventRow('Background Loop', 'BACKGROUND', 'AUDIO_BACKGROUND_VOL', audio.background, !!audio.muteBackground, true)}
        </div>
        <div class="settings-group">
          <h4 class="settings-group-title">Event Levels</h4>
          ${this.eventRow('UI Sounds', 'UI', 'AUDIO_UI_VOL', audio.uiSounds, !!audio.muteUISounds, false, true)}
          ${this.eventRow('Cue Hits', 'CUE', 'AUDIO_CUE_VOL', audio.cueHits, !!audio.muteCueHits)}
          ${this.eventRow('Ball Collisions', 'BALL', 'AUDIO_BALL_VOL', audio.ballCollisions, !!audio.muteBallCollisions)}
          ${this.eventRow('Rail Impacts', 'RAIL', 'AUDIO_RAIL_VOL', audio.railHits, !!audio.muteRailHits)}
          ${this.eventRow('Pocket Drops', 'POCKET', 'AUDIO_POCKET_VOL', audio.pocketDrops, !!audio.mutePocketDrops)}
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

  private masterRow(volume: number, muted: boolean): string {
    return `
      <div class="event-control">
        ${this.sliderRow('AUDIO_MASTER_VOLUME', 'Master Volume', 0, 1, 0.01, volume)}
        <div class="event-actions">
          <button
            type="button"
            class="panel-btn panel-icon-btn audio-mute ${muted ? 'is-muted' : ''}"
            data-audio-mute-key="MASTER"
            aria-label="${muted ? 'Unmute master' : 'Mute master'}"
            title="${muted ? 'Unmute master' : 'Mute master'}"
          >
            ${muted ? '🔇' : '🔊'}
          </button>
        </div>
      </div>
    `;
  }

  private eventRow(
    title: string,
    key: string,
    sliderId: string,
    volume: number,
    muted: boolean,
    isBackground: boolean = false,
    isUIPreview: boolean = false
  ): string {
    const muteKey = isBackground ? 'BACKGROUND' : key;
    const label = `${title} Volume`;
    return `
      <div class="event-control">
        ${this.sliderRow(sliderId, label, 0, 1, 0.01, volume)}
        <div class="event-actions">
          <button
            type="button"
            class="panel-btn panel-icon-btn audio-preview"
            data-audio-event="${key}"
            ${isUIPreview ? 'data-ui-preview="true"' : ''}
            aria-label="Preview ${title}"
            title="Preview ${title}"
          >
            ▶
          </button>
          <button
            type="button"
            class="panel-btn panel-icon-btn audio-mute ${muted ? 'is-muted' : ''}"
            data-audio-mute-key="${muteKey}"
            aria-label="${muted ? `Unmute ${title}` : `Mute ${title}`}"
            title="${muted ? `Unmute ${title}` : `Mute ${title}`}"
          >
            ${muted ? '🔇' : '🔊'}
          </button>
        </div>
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
      { sliderId: 'AUDIO_MUSIC_VOL', labelId: 'AUDIO_MUSIC_VOL-value', onChange: (v) => this.update('music', clamp01(v!)), formatValue: formatPercent },
      { sliderId: 'AUDIO_BACKGROUND_VOL', labelId: 'AUDIO_BACKGROUND_VOL-value', onChange: (v) => this.update('background', clamp01(v!)), formatValue: formatPercent },
      { sliderId: 'AUDIO_UI_VOL', labelId: 'AUDIO_UI_VOL-value', onChange: (v) => this.update('uiSounds', clamp01(v!)), formatValue: formatPercent },
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
        if (btn.dataset.uiPreview === 'true') {
          window.dispatchEvent(new CustomEvent('ui-sound:preview'));
          return;
        }
        const event = btn.dataset.audioEvent;
        if (!event) return;
        window.dispatchEvent(new CustomEvent('audio:preview', { detail: { event } }));
      });
    });
  }

  private setupMuteButtons() {
    const buttons = this.panel.querySelectorAll<HTMLButtonElement>('.audio-mute');
    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.audioMuteKey;
        if (!key) return;

        const current = this.settingsManager.getAudioSettings();
        let update: Partial<AudioSettings> | null = null;

        switch (key) {
          case 'MASTER':
            update = { muteMaster: !current.muteMaster };
            break;
          case 'MUSIC':
            update = { muteMusic: !current.muteMusic };
            break;
          case 'BACKGROUND':
            update = { muteBackground: !current.muteBackground };
            break;
          case 'UI':
            update = { muteUISounds: !current.muteUISounds };
            break;
          case 'CUE':
            update = { muteCueHits: !current.muteCueHits };
            break;
          case 'BALL':
            update = { muteBallCollisions: !current.muteBallCollisions };
            break;
          case 'RAIL':
            update = { muteRailHits: !current.muteRailHits };
            break;
          case 'POCKET':
            update = { mutePocketDrops: !current.mutePocketDrops };
            break;
        }

        if (!update) return;

        this.settingsManager.saveAudioSettings(update);
        this.loadSettings();
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
      ['music', 'AUDIO_MUSIC_VOL', formatPercent],
      ['background', 'AUDIO_BACKGROUND_VOL', formatPercent],
      ['uiSounds', 'AUDIO_UI_VOL', formatPercent],
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

    const muteButtons = this.panel.querySelectorAll<HTMLButtonElement>('.audio-mute');
    muteButtons.forEach((btn) => {
      const key = btn.dataset.audioMuteKey;
      if (!key) return;

      let isMuted = false;
      switch (key) {
        case 'MASTER':
          isMuted = !!audio.muteMaster;
          break;
        case 'MUSIC':
          isMuted = !!audio.muteMusic;
          break;
        case 'BACKGROUND':
          isMuted = !!audio.muteBackground;
          break;
        case 'UI':
          isMuted = !!audio.muteUISounds;
          break;
        case 'CUE':
          isMuted = !!audio.muteCueHits;
          break;
        case 'BALL':
          isMuted = !!audio.muteBallCollisions;
          break;
        case 'RAIL':
          isMuted = !!audio.muteRailHits;
          break;
        case 'POCKET':
          isMuted = !!audio.mutePocketDrops;
          break;
      }

      btn.classList.toggle('is-muted', isMuted);
      const labelEl = btn.closest('.event-control')?.querySelector('.slider-title');
      const labelText = labelEl?.textContent ?? 'Audio';
      const title =
        key === 'MASTER'
          ? isMuted
            ? 'Unmute master'
            : 'Mute master'
          : isMuted
          ? `Unmute ${labelText}`
          : `Mute ${labelText}`;
      btn.title = title;
      btn.setAttribute('aria-label', title);
      btn.textContent = isMuted ? '🔇' : '🔊';
    });
  }

  getController() {
    return this.controller;
  }
}

