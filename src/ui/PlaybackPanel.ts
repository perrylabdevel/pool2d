import { SettingsManager } from './SettingsManager';
import { PlaybackController } from '../game/PlaybackController';
import { UIPanel } from './panels/UIPanel';

export class PlaybackPanel {
  private readonly panel: HTMLElement;
  private readonly controller: UIPanel;
  private controllerRef: PlaybackController;

  private timelineSlider!: HTMLInputElement;
  private timeDisplay!: HTMLElement;
  private playPauseBtn!: HTMLElement;
  private speedSelect!: HTMLSelectElement;
  private shotInfo!: HTMLElement;
  private totalTimeDisplay!: HTMLElement;

  private onExitCallback: () => void;

  constructor(settingsManager: SettingsManager, controller: PlaybackController, onExit: () => void) {
    this.controllerRef = controller;
    this.onExitCallback = onExit;

    this.panel = this.createPanel();

    this.controller = new UIPanel({
      id: 'playback-panel',
      element: this.panel,
      focusTarget: this.playPauseBtn,
    });

    // Hook into panel close event to trigger exit callback
    // this.controller.addEventListener('panel:close', () => {
    //   console.log('📼 PlaybackPanel closed event fired');
    //   this.onExitCallback();
    // });

    this.bindEvents();
    this.setupControllerListeners();
  }

  getController(): UIPanel {
    return this.controller;
  }

  private createPanel(): HTMLElement {
    let panel = document.getElementById('playback-panel-ui');
    if (panel) return panel;

    const dock = document.getElementById('panel-dock');
    panel = document.createElement('div');
    panel.id = 'playback-panel-ui';
    panel.className = 'panel-dock-card hidden';

    panel.innerHTML = `
      <div class="panel-header">
        <h3>📼 Replay Control</h3>
      </div>
      <div class="panel-content playback-controls" style="display: flex; flex-direction: column; gap: 12px; padding: 8px;">
        <div class="timeline-row" style="display: flex; align-items: center; gap: 8px;">
          <span id="time-current" style="font-family: monospace; min-width: 45px;">0:00</span>
          <input type="range" id="playback-timeline" min="0" max="100" step="0.1" style="flex: 1;">
          <span id="time-total" style="font-family: monospace; min-width: 45px;">0:00</span>
        </div>
        
        <div class="controls-row" style="display: flex; justify-content: center; align-items: center; gap: 16px;">
          <button id="btn-prev-shot" class="icon-btn" title="Previous Shot">⏮️</button>
          <button id="btn-play-pause" class="icon-btn large" title="Play/Pause">▶️</button>
          <button id="btn-next-shot" class="icon-btn" title="Next Shot">⏭️</button>
        </div>
        
        <div class="settings-row" style="display: flex; justify-content: space-between; align-items: center;">
          <div class="speed-control">
            <label>Speed:</label>
            <select id="playback-speed">
              <option value="0.25">0.25x</option>
              <option value="0.5">0.5x</option>
              <option value="1" selected>1.0x</option>
              <option value="2">2.0x</option>
              <option value="4">4.0x</option>
            </select>
          </div>
          <div id="shot-info" style="font-size: 12px; color: #aaa;">Shot: -/-</div>
        </div>
        
        <button id="btn-exit-playback" class="danger-btn" style="margin-top: 8px;">Exit Replay</button>
      </div>
      <style>
      .playback-controls .icon-btn {
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: white;
        border-radius: 4px;
        cursor: pointer;
        padding: 6px 12px;
        font-size: 16px;
      }
      .playback-controls .icon-btn:hover {
        background: rgba(255, 255, 255, 0.2);
      }
      .playback-controls .icon-btn.large {
        font-size: 20px;
        padding: 8px 20px;
        background: rgba(76, 175, 80, 0.3);
        border-color: rgba(76, 175, 80, 0.5);
      }
      .playback-controls .danger-btn {
        background: rgba(244, 67, 54, 0.2);
        border: 1px solid rgba(244, 67, 54, 0.4);
        color: #ffcdd2;
        padding: 8px;
        border-radius: 4px;
        cursor: pointer;
        width: 100%;
      }
      .playback-controls .danger-btn:hover {
        background: rgba(244, 67, 54, 0.3);
      }
      .playback-controls select {
        background: rgba(0, 0, 0, 0.3);
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 4px;
        padding: 2px 4px;
      }
      </style>
    `;

    if (dock) {
      dock.prepend(panel);
    } else {
      document.body.append(panel);
    }

    // Cache elements
    this.timelineSlider = panel.querySelector('#playback-timeline') as HTMLInputElement;
    this.timeDisplay = panel.querySelector('#time-current') as HTMLElement;
    this.playPauseBtn = panel.querySelector('#btn-play-pause') as HTMLElement;
    this.speedSelect = panel.querySelector('#playback-speed') as HTMLSelectElement;
    this.shotInfo = panel.querySelector('#shot-info') as HTMLElement;
    this.totalTimeDisplay = panel.querySelector('#time-total') as HTMLElement;

    return panel;
  }

  private bindEvents() {
    this.timelineSlider.addEventListener('input', (e) => {
      const val = parseFloat((e.target as HTMLInputElement).value);
      this.controllerRef.seek(val);
    });

    this.playPauseBtn.addEventListener('click', () => {
      this.controllerRef.togglePlay();
    });

    this.panel.querySelector('#btn-prev-shot')?.addEventListener('click', () => {
      this.controllerRef.prevShot();
    });

    this.panel.querySelector('#btn-next-shot')?.addEventListener('click', () => {
      this.controllerRef.nextShot();
    });

    this.speedSelect.addEventListener('change', (e) => {
      const speed = parseFloat((e.target as HTMLSelectElement).value);
      this.controllerRef.setSpeed(speed);
    });

    this.panel.querySelector('#btn-exit-playback')?.addEventListener('click', () => {
      this.onExitCallback();
    });
  }

  private setupControllerListeners() {
    this.controllerRef.onTimeUpdate = (time) => {
      if (document.activeElement !== this.timelineSlider) {
        this.timelineSlider.value = time.toFixed(1);
      }
      this.timeDisplay.textContent = this.formatTime(time);
    };

    this.controllerRef.onStateChange = (isPlaying) => {
      this.playPauseBtn.textContent = isPlaying ? '⏸️' : '▶️';
    };

    this.controllerRef.onShotChange = (index) => {
      this.shotInfo.textContent = `Shot: ${index + 1}`;
    };
  }

  updateDuration(duration: number) {
    this.timelineSlider.max = duration.toFixed(1);
    if (this.totalTimeDisplay) {
      this.totalTimeDisplay.textContent = this.formatTime(duration);
    }
  }

  private formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
}
