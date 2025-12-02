import { UIPanel } from '../../../src/ui/panels/UIPanel';
import { makePanelDraggable } from '../../../src/ui/drag';

export class PlaybackPanel {
  private panel: HTMLElement;
  private panelController: UIPanel;
  private scrubSlider!: HTMLInputElement;
  private playButton!: HTMLButtonElement;
  private timeDisplay!: HTMLSpanElement;
  private speedSlider!: HTMLInputElement;
  private speedDisplay!: HTMLSpanElement;
  private shotDisplay!: HTMLSpanElement;

  // State mirroring
  private duration: number = 0;
  private isPlaying: boolean = false;
  private onClose: () => void;

  constructor(onClose: () => void) {
    this.onClose = onClose;
    this.panel = document.getElementById('playback-panel-remote') as HTMLElement;
    if (!this.panel) {
      throw new Error('Playback panel element not found!');
    }

    this.panelController = new UIPanel({
      element: this.panel,
      id: 'playback-panel-remote',
    });

    // Inject content into .panel-content
    const contentArea = this.panel.querySelector('.panel-content');
    if (contentArea) {
      contentArea.innerHTML = `
        <div class="recordings-section" style="margin-bottom: 10px; border-bottom: 1px solid #444; padding-bottom: 10px;">
          <h3 style="margin: 0 0 5px 0; font-size: 12px; color: #aaa;">RECORDED MATCHES</h3>
          <div id="pb-recordings-list" style="max-height: 150px; overflow-y: auto; background: #111; border: 1px solid #333; border-radius: 4px;">
            <div style="padding: 10px; color: #666; text-align: center; font-size: 11px;">No recordings yet</div>
          </div>
        </div>

        <div class="control-row">
          <button id="pb-prev-shot">⏮ Shot</button>
          <button id="pb-play-pause">▶</button>
          <button id="pb-next-shot">Shot ⏭</button>
        </div>
        
        <div class="control-row">
          <input type="range" id="pb-scrub" min="0" max="100" step="0.1" value="0" style="width: 100%">
        </div>
        
        <div class="control-row info-row">
          <span id="pb-time">-- / --</span>
          <span id="pb-shot-idx">Shot: -</span>
        </div>

        <div class="control-row">
          <label>Speed: <span id="pb-speed-val">1.0x</span></label>
          <input type="range" id="pb-speed" min="0.1" max="3.0" step="0.1" value="1.0">
        </div>
      `;
    }

    // Bind elements
    this.playButton = this.panel.querySelector('#pb-play-pause') as HTMLButtonElement;
    this.scrubSlider = this.panel.querySelector('#pb-scrub') as HTMLInputElement;
    this.timeDisplay = this.panel.querySelector('#pb-time') as HTMLSpanElement;
    this.speedSlider = this.panel.querySelector('#pb-speed') as HTMLInputElement;
    this.speedDisplay = this.panel.querySelector('#pb-speed-val') as HTMLSpanElement;
    this.shotDisplay = this.panel.querySelector('#pb-shot-idx') as HTMLSpanElement;

    // Bind events - Dispatch to window for RemoteBridge to pick up
    this.playButton?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('playback:toggle'));
    });

    // Close button is handled by main.ts or not needed in dock mode?
    // In dock mode, we usually don't close panels via X, but toggle them via menu.
    // But if we want to support it:
    this.panel.querySelector('.close-btn')?.addEventListener('click', () => {
      if (this.onClose) this.onClose();
      this.panelController.close();
    });

    this.panel.querySelector('#pb-prev-shot')?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('playback:prevShot'));
    });

    this.panel.querySelector('#pb-next-shot')?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('playback:nextShot'));
    });

    this.scrubSlider?.addEventListener('input', (e) => {
      const val = parseFloat((e.target as HTMLInputElement).value);
      window.dispatchEvent(new CustomEvent('playback:seek', { detail: val }));
    });

    this.speedSlider?.addEventListener('input', (e) => {
      const val = parseFloat((e.target as HTMLInputElement).value);
      this.speedDisplay.textContent = val.toFixed(1) + 'x';
      window.dispatchEvent(new CustomEvent('playback:speed', { detail: val }));
    });

    // Listen for playback state updates from the game (via RemoteBridge/WebSocket)
    window.addEventListener('playback:timeUpdate', (e: any) => this.updateTime(e.detail));
    window.addEventListener('playback:durationUpdate', (e: any) => this.updateDuration(e.detail));
    window.addEventListener('playback:stateUpdate', (e: any) => this.updateState(e.detail));
    window.addEventListener('playback:shotUpdate', (e: any) => this.updateShot(e.detail));

    // Listen for recording updates
    window.addEventListener('recording:added', () => this.renderRecordingsList());
    window.addEventListener('recording:deleted', () => this.renderRecordingsList());

    // Initial render
    this.renderRecordingsList();
  }

  private renderRecordingsList() {
    const list = this.panel.querySelector('#pb-recordings-list');
    if (!list) return;

    // Get recordings from settings manager (exposed globally or via window event?)
    // Actually RemoteSettingsManager is on window.settingsManager in main.ts
    const recordings = (window as any).settingsManager?.getMatchRecordings() || [];

    if (recordings.length === 0) {
      list.innerHTML = '<div style="padding: 10px; color: #666; text-align: center; font-size: 11px;">No recordings yet</div>';
      return;
    }

    list.innerHTML = '';
    recordings.forEach((rec: any, index: number) => {
      const date = new Date(rec.timestamp);
      const timeStr = date.toLocaleTimeString();
      const duration = rec.data.duration.toFixed(1);

      const item = document.createElement('div');
      item.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 5px; border-bottom: 1px solid #222; font-size: 11px;';
      item.innerHTML = `
        <span style="color: #ddd;">${timeStr} <span style="color: #666;">(${duration}s)</span></span>
        <div>
          <button class="play-rec-btn" style="padding: 2px 6px; margin-right: 4px; background: #2a6; border: none; border-radius: 2px; color: white; cursor: pointer;">▶</button>
          <button class="del-rec-btn" style="padding: 2px 6px; background: #c33; border: none; border-radius: 2px; color: white; cursor: pointer;">×</button>
        </div>
      `;

      item.querySelector('.play-rec-btn')?.addEventListener('click', () => {
        // Send command to load this recording
        // We need to send the full match data
        // RemoteSettingsManager will handle sending 'playback:load' command
        (window as any).settingsManager?.sendCommand('playback:load', rec.data);
      });

      item.querySelector('.del-rec-btn')?.addEventListener('click', () => {
        (window as any).settingsManager?.deleteMatchRecording(rec.timestamp);
      });

      list.appendChild(item);
    });
  }


  private updatePlayButton(isPlaying: boolean) {
    this.isPlaying = isPlaying;
    this.playButton.textContent = isPlaying ? '⏸' : '▶';
  }

  private updateTime(time: number) {
    this.timeDisplay.textContent = `${time.toFixed(2)}s / ${this.duration.toFixed(2)}s`;
    if (document.activeElement !== this.scrubSlider) {
      this.scrubSlider.value = time.toString();
    }
  }

  private updateDuration(duration: number) {
    this.duration = duration;
    this.scrubSlider.max = duration.toString();
    this.timeDisplay.textContent = `0.00s / ${duration.toFixed(2)}s`;
  }

  private updateState(state: { isPlaying: boolean }) {
    this.updatePlayButton(state.isPlaying);
  }

  private updateShot(index: number) {
    this.shotDisplay.textContent = `Shot: ${index + 1}`;
  }

  getController(): UIPanel {
    return this.panelController;
  }
}
