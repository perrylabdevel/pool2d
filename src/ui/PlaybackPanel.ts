import { PlaybackController } from '../game/PlaybackController';
import { UIPanel } from './panels/UIPanel';
import { makePanelDraggable } from './drag';
import { physicsRecorder } from '../debug/PhysicsRecorder';

export class PlaybackPanel {
  private panel: HTMLElement;
  private panelController: UIPanel;
  private controller: PlaybackController;
  private scrubSlider!: HTMLInputElement;
  private playButton!: HTMLButtonElement;
  private timeDisplay!: HTMLSpanElement;
  private speedSlider!: HTMLInputElement;
  private speedDisplay!: HTMLSpanElement;
  private shotDisplay!: HTMLSpanElement;
  private onClose: () => void;

  constructor(controller: PlaybackController, onClose: () => void) {
    this.controller = controller;
    this.onClose = onClose;
    this.panel = this.createPanel();
    this.panelController = new UIPanel({
      element: this.panel,
      id: 'playback-panel',
      // headerTitle is not in options, handled by HTML structure
    });

    makePanelDraggable(this.panel.querySelector('.panel-header') as HTMLElement, this.panel);

    // Subscribe to controller events
    this.controller.onTimeUpdate = (time) => this.updateUI(time);
    this.controller.onStateChange = (isPlaying) => this.updatePlayButton(isPlaying);
    this.controller.onShotChange = (index) => this.updateShotDisplay(index);
  }

  private createPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'ui-panel playback-panel landscape';
    panel.innerHTML = `
      <div class="panel-header">
        <span>Playback Control</span>
        <button class="close-btn" id="pb-close-btn">×</button>
      </div>
      <div class="panel-content playback-landscape">
        <div class="control-row primary-controls">
          <button id="pb-prev-shot">⏮ Shot</button>
          <button id="pb-play-pause">▶</button>
          <button id="pb-next-shot">Shot ⏭</button>
        </div>
        
        <div class="scrub-row">
          <input type="range" id="pb-scrub" min="0" max="100" step="0.1" value="0">
          <div class="time-meta">
            <span id="pb-time">0.00s / 0.00s</span>
            <span id="pb-shot-idx">Shot: -</span>
          </div>
        </div>

        <div class="speed-row">
          <label>Speed <span id="pb-speed-val">1.0x</span></label>
          <input type="range" id="pb-speed" min="0.1" max="3.0" step="0.1" value="1.0">
          <button id="pb-export">Export</button>
        </div>
      </div>
    `;

    // Bind elements
    this.playButton = panel.querySelector('#pb-play-pause') as HTMLButtonElement;
    this.scrubSlider = panel.querySelector('#pb-scrub') as HTMLInputElement;
    this.timeDisplay = panel.querySelector('#pb-time') as HTMLSpanElement;
    this.speedSlider = panel.querySelector('#pb-speed') as HTMLInputElement;
    this.speedDisplay = panel.querySelector('#pb-speed-val') as HTMLSpanElement;
    this.shotDisplay = panel.querySelector('#pb-shot-idx') as HTMLSpanElement;

    // Bind events
    this.playButton.addEventListener('click', () => this.controller.togglePlay());

    panel.querySelector('#pb-close-btn')?.addEventListener('click', () => {
      this.onClose();
      this.panelController.close();
    });

    panel.querySelector('#pb-prev-shot')?.addEventListener('click', () => {
      this.controller.pause();
      this.controller.prevShot();
    });

    panel.querySelector('#pb-next-shot')?.addEventListener('click', () => {
      this.controller.pause();
      this.controller.nextShot();
    });

    this.scrubSlider.addEventListener('input', (e) => {
      const val = parseFloat((e.target as HTMLInputElement).value);
      this.controller.pause();
      this.controller.seek(val);
    });

    this.speedSlider.addEventListener('input', (e) => {
      const val = parseFloat((e.target as HTMLInputElement).value);
      this.controller.setSpeed(val);
      this.speedDisplay.textContent = val.toFixed(1) + 'x';
    });

    panel.querySelector('#pb-export')?.addEventListener('click', () => {
      physicsRecorder.copyToClipboard();
      alert('Recording summary copied to clipboard!');
    });

    return panel;
  }

  private updateUI(time: number) {
    this.timeDisplay.textContent = `${time.toFixed(2)}s / ${this.controller.duration.toFixed(2)}s`;

    // Update slider max if duration changed (e.g. new match loaded)
    const currentMax = parseFloat(this.scrubSlider.max);
    if (Math.abs(currentMax - this.controller.duration) > 0.1) {
      this.scrubSlider.max = this.controller.duration.toString();
    }

    if (document.activeElement !== this.scrubSlider) {
      this.scrubSlider.value = time.toString();
    }
    window.dispatchEvent(new CustomEvent('playback:timeUpdate', { detail: time }));
  }
  updateDuration(duration: number) {
    this.scrubSlider.max = duration.toString();
    this.timeDisplay.textContent = `0.00s / ${duration.toFixed(2)}s`;
    window.dispatchEvent(new CustomEvent('playback:durationUpdate', { detail: duration }));
  }

  private updatePlayButton(isPlaying: boolean) {
    this.playButton.textContent = isPlaying ? '⏸' : '▶';
    window.dispatchEvent(new CustomEvent('playback:stateUpdate', { detail: { isPlaying } }));
  }

  private updateShotDisplay(index: number) {
    this.shotDisplay.textContent = `Shot: ${index + 1}`;
    window.dispatchEvent(new CustomEvent('playback:shotUpdate', { detail: index }));
  }

  getController(): UIPanel {
    return this.panelController;
  }
}
