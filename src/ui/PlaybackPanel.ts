import { PlaybackController } from '../game/PlaybackController';
import { UIPanel } from './panels/UIPanel';
import { makePanelDraggable } from './drag';
import { physicsRecorder } from '../debug/PhysicsRecorder';

// State machine for Media Panel
export enum MediaPanelState {
  IDLE = 'IDLE',               // Ready - no recording or playback active
  RECORDING = 'RECORDING',      // Recording in progress
  PLAYING = 'PLAYING',          // Playback active
  PAUSED = 'PAUSED'             // Playback paused
}

export class PlaybackPanel {
  private panel: HTMLElement;
  private panelController: UIPanel;
  private controller: PlaybackController;
  private timeline!: HTMLElement;
  private timelineProgress!: HTMLElement;
  private playButton!: HTMLButtonElement;
  private timeDisplay!: HTMLSpanElement;
  private durationDisplay!: HTMLSpanElement;
  private speedButton!: HTMLButtonElement;
  private onClose: () => void;

  // State machine
  private state: MediaPanelState = MediaPanelState.IDLE;
  private isDraggingTimeline: boolean = false;
  private recordingStartTime: number = 0;
  private recordingTimerInterval: number | null = null;

  constructor(controller: PlaybackController, onClose: () => void) {
    this.controller = controller;
    this.onClose = onClose;
    this.panel = this.createPanel();
    this.panelController = new UIPanel({
      element: this.panel,
      id: 'playback-panel',
    });

    // Make the entire panel draggable since it's a small bar
    makePanelDraggable(this.panel, this.panel);

    // Subscribe to controller events
    this.controller.onTimeUpdate = (time) => this.updateUI(time, this.controller.duration, this.controller.isPlaying);
    this.controller.onStateChange = (isPlaying) => {
      // Sync panel state with controller state
      if (this.state !== MediaPanelState.RECORDING) {
        if (isPlaying) {
          this.setState(MediaPanelState.PLAYING);
        } else {
          this.setState(MediaPanelState.PAUSED);
        }
      }
    };
    this.controller.onShotChange = (index) => {
      const display = this.panel.querySelector('#pb-shot-idx');
      if (display) {
        display.textContent = `Shot: ${index + 1}`;
      }
    };

    // Listen for recording completion to auto-load data
    window.addEventListener('match:recorded', (e: any) => {
      if (e.detail?.data) {
        console.log('📼 PlaybackPanel: Recording finished, data ready for playback');
        // Data is now available for playback when user presses play
      }
    });
  }

  private createPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'media-panel hidden';
    panel.innerHTML = `
      <div class="media-row main-controls">
        <div class="media-left">
          <div class="status-badge playback" id="pb-status">READY</div>
          <button class="btn-record" id="pb-record-btn" title="Record/Resume">
            <div class="record-icon"></div>
          </button>
          <button class="btn icon-btn" id="pb-restart" title="Restart Playback">↺</button>
          <button class="btn icon-btn" id="pb-prev-shot" title="Previous Shot">⏮</button>
          <button class="btn icon-btn primary" id="pb-play-pause" title="Play/Pause">▶</button>
          <button class="btn icon-btn" id="pb-next-shot" title="Next Shot">⏭</button>
        </div>
        
        <div class="media-center">
          <div class="timeline" id="pb-timeline">
            <div class="timeline-progress" id="pb-progress"></div>
          </div>
          <div class="timecode">
            <span id="pb-time">0:00</span>
            <span class="time-separator">/</span>
            <span id="pb-duration">0:00</span>
          </div>
        </div>
        
        <div class="media-right">
          <button class="btn" id="pb-speed" title="Playback Speed">1.0x</button>
          <button class="btn icon-btn" id="pb-export" title="Export Recording">💾</button>
          <button class="btn icon-btn" id="pb-new-match" title="New Match (clear recording)">🆕</button>
        </div>
      </div>

      <div class="media-row exit-row">
        <div class="vcr-info">
            <span id="pb-vcr-date">--/--/----</span>
            <span id="pb-vcr-time">00:00:00:00</span>
        </div>
        <button class="btn exit-btn" id="pb-exit-btn">EXIT</button>
      </div>
    `;

    // Bind elements
    this.playButton = panel.querySelector('#pb-play-pause') as HTMLButtonElement;
    this.timeline = panel.querySelector('#pb-timeline') as HTMLElement;
    this.timelineProgress = panel.querySelector('#pb-progress') as HTMLElement;
    this.timeDisplay = panel.querySelector('#pb-time') as HTMLSpanElement;
    this.durationDisplay = panel.querySelector('#pb-duration') as HTMLSpanElement;
    this.speedButton = panel.querySelector('#pb-speed') as HTMLButtonElement;

    const prevShotBtn = panel.querySelector('#pb-prev-shot') as HTMLButtonElement;
    const nextShotBtn = panel.querySelector('#pb-next-shot') as HTMLButtonElement;
    const exitBtn = panel.querySelector('#pb-exit-btn') as HTMLButtonElement;
    const exportButton = panel.querySelector('#pb-export') as HTMLButtonElement;
    const restartBtn = panel.querySelector('#pb-restart') as HTMLButtonElement;
    const recordBtn = panel.querySelector('#pb-record-btn') as HTMLButtonElement;
    const newMatchBtn = panel.querySelector('#pb-new-match') as HTMLButtonElement;

    // New Match button - clears recording and starts fresh
    newMatchBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      console.log('🆕 NEW MATCH CLICKED');

      // Stop any active recording
      if (this.state === MediaPanelState.RECORDING) {
        physicsRecorder.stop();
      }

      // Clear all recording data
      physicsRecorder.clear();

      // Reset panel to IDLE
      this.setState(MediaPanelState.IDLE);

      // Reset UI displays
      this.timeDisplay.textContent = '0:00';
      this.durationDisplay.textContent = '0:00';
      this.timelineProgress.style.width = '0%';

      // Restart the game to fresh state
      window.dispatchEvent(new CustomEvent('game:restart'));
    });

    // Bind events
    this.playButton.addEventListener('click', (e) => {
      e.stopPropagation();
      console.log('🎮 PLAY BUTTON CLICKED', {
        hasMatchData: !!this.controller.getMatchData(),
        isPlaying: this.controller.isPlaying,
        state: this.state
      });

      // Can't play while recording
      if (this.state === MediaPanelState.RECORDING) {
        console.log('🎮 Cannot play while recording');
        return;
      }

      // If no data loaded yet, try to load from recorder history
      if (!this.controller.getMatchData()) {
        const history = physicsRecorder.getHistory();
        console.log('🎮 No match data, checking history:', { historyLength: history.length });
        if (history.length > 0) {
          const latestRecording = history[history.length - 1];
          console.log('🎮 Loading latest recording for playback', { duration: latestRecording.duration });
          window.dispatchEvent(new CustomEvent('playback:load', { detail: latestRecording }));
          return;
        } else {
          console.warn('🎮 No recordings available');
          return;
        }
      }

      console.log('🎮 Calling togglePlay, current state:', this.controller.isPlaying);
      this.controller.togglePlay();

      // Update panel state to match controller
      if (this.controller.isPlaying) {
        this.setState(MediaPanelState.PLAYING);
      } else {
        this.setState(MediaPanelState.PAUSED);
      }
      console.log('🎮 After togglePlay, new state:', this.state);
    });

    recordBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      console.log('🔴 RECORD BUTTON CLICKED', { state: this.state });

      if (this.state === MediaPanelState.RECORDING) {
        // Stop recording
        console.log('🔴 Stopping recording');
        physicsRecorder.stop();
        this.setState(MediaPanelState.IDLE);
      } else if (this.state === MediaPanelState.IDLE) {
        // Start or resume recording
        console.log('🔴 Starting/resuming recording');
        // Use resume() to continue within same match, or start() if no data
        if (physicsRecorder.hasData()) {
          physicsRecorder.resume();
        } else {
          physicsRecorder.start();
        }
        this.setState(MediaPanelState.RECORDING);
      } else {
        // Switching from playback to recording - just pause, don't exit
        console.log('🔴 Pausing playback to start recording');
        this.controller.pause();
        // Don't dispatch playback:stop - that would close the panel!

        this.setState(MediaPanelState.IDLE);

        // Resume recording (keep existing recorder data if any)
        if (physicsRecorder.hasData()) {
          physicsRecorder.resume();
        } else {
          physicsRecorder.start();
        }
        this.setState(MediaPanelState.RECORDING);
      }
    });

    restartBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.state === MediaPanelState.RECORDING) return;
      console.log('⏮️ RESTART BUTTON CLICKED');
      this.controller.seek(0);
      this.controller.play();
      this.setState(MediaPanelState.PLAYING);
    });

    prevShotBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.state === MediaPanelState.RECORDING) return;
      console.log('⏪ PREV SHOT BUTTON CLICKED');
      this.controller.pause();
      this.controller.prevShot();
      this.setState(MediaPanelState.PAUSED);
    });

    nextShotBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.state === MediaPanelState.RECORDING) return;
      console.log('⏩ NEXT SHOT BUTTON CLICKED');
      this.controller.pause();
      this.controller.nextShot();
      this.setState(MediaPanelState.PAUSED);
    });

    exitBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      console.log('🚪 EXIT BUTTON CLICKED', { state: this.state });
      this.onClose();
      if (this.state === MediaPanelState.RECORDING) {
        physicsRecorder.stop();
      }
      this.setState(MediaPanelState.IDLE);
      window.dispatchEvent(new CustomEvent('playback:stop'));
      this.panelController.close();
    });

    // Timeline scrubbing - click to seek
    this.timeline.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      this.isDraggingTimeline = true;
      this.controller.pause();
      this.handleTimelineClick(e);

      const onMouseMove = (moveEvent: MouseEvent) => {
        this.handleTimelineClick(moveEvent);
      };

      const onMouseUp = () => {
        this.isDraggingTimeline = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });

    // Speed toggle
    this.speedButton.addEventListener('click', (e) => {
      e.stopPropagation();
      const speeds = [0.5, 1.0, 2.0];
      const currentSpeed = this.controller.playbackSpeed;
      const nextSpeed = speeds[(speeds.indexOf(currentSpeed) + 1) % speeds.length] || 1.0;
      this.controller.setSpeed(nextSpeed);
      this.speedButton.textContent = nextSpeed.toFixed(1) + 'x';
    });

    exportButton?.addEventListener('click', (e) => {
      e.stopPropagation();
      physicsRecorder.copyToClipboard();
      alert('Recording summary copied to clipboard!');
    });

    // Stop propagation on buttons to prevent dragging when clicking controls
    panel.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('mousedown', (e) => e.stopPropagation());
    });

    // Center the panel initially via JS to avoid transform conflicts with drag
    const width = 420;
    const left = (window.innerWidth - width) / 2;
    panel.style.left = `${Math.max(0, left)}px`;
    panel.style.transform = 'none';

    return panel;
  }

  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  private handleTimelineClick(e: MouseEvent) {
    const rect = this.timeline.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const percentage = x / rect.width;
    const time = percentage * this.controller.duration;

    this.controller.seek(time);

    // Update progress bar immediately for responsive feel
    if (this.timelineProgress) {
      this.timelineProgress.style.width = `${percentage * 100}%`;
    }
  }

  private startRecordingTimer() {
    this.stopRecordingTimer();
    this.recordingTimerInterval = window.setInterval(() => {
      const elapsed = Date.now() - this.recordingStartTime;
      const timeDisplay = this.panel.querySelector('#pb-time');
      if (timeDisplay) {
        const secs = Math.floor(elapsed / 1000);
        const mins = Math.floor(secs / 60);
        const s = secs % 60;
        timeDisplay.textContent = `${mins}:${s.toString().padStart(2, '0')}`;
      }
    }, 100);
  }

  private stopRecordingTimer() {
    if (this.recordingTimerInterval) {
      clearInterval(this.recordingTimerInterval);
      this.recordingTimerInterval = null;
    }
  }

  updateUI(currentTime: number, duration: number, isPlaying: boolean) {
    // Don't update playback UI while recording
    if (this.state === MediaPanelState.RECORDING) return;

    const playPauseBtn = this.panel.querySelector('#pb-play-pause');
    const timeDisplay = this.panel.querySelector('#pb-time');
    const durationDisplay = this.panel.querySelector('#pb-duration');
    const statusBadge = this.panel.querySelector('#pb-status');

    if (playPauseBtn) {
      playPauseBtn.textContent = isPlaying ? '⏸' : '▶';
    }

    if (statusBadge) {
      statusBadge.textContent = isPlaying ? 'PLAY' : 'PAUSE';
      statusBadge.className = isPlaying ? 'status-badge playback playing' : 'status-badge playback';
    }

    // Update timeline progress bar
    if (this.timelineProgress && !this.isDraggingTimeline) {
      const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
      this.timelineProgress.style.width = `${Math.min(100, Math.max(0, progress))}%`;
    }

    if (timeDisplay) {
      timeDisplay.textContent = this.formatTime(currentTime);
    }
    if (durationDisplay) {
      durationDisplay.textContent = this.formatTime(duration);
    }

    window.dispatchEvent(new CustomEvent('playback:timeUpdate', { detail: currentTime }));
    window.dispatchEvent(new CustomEvent('playback:durationUpdate', { detail: duration }));
    window.dispatchEvent(new CustomEvent('playback:stateUpdate', { detail: { isPlaying } }));

    // Update VCR info in panel
    const timeEl = this.panel.querySelector('#pb-vcr-time');
    const dateEl = this.panel.querySelector('#pb-vcr-date');

    if (timeEl) {
      const hours = Math.floor(currentTime / 3600);
      const mins = Math.floor((currentTime % 3600) / 60);
      const secs = Math.floor(currentTime % 60);
      const frames = Math.floor((currentTime % 1) * 60);

      timeEl.textContent = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
    }

    const matchData = this.controller.getMatchData();
    if (dateEl && matchData?.timestamp) {
      const date = new Date(matchData.timestamp);
      dateEl.textContent = date.toLocaleDateString();
    }
  }

  updateDuration(duration: number) {
    this.durationDisplay.textContent = this.formatTime(duration);
    this.timeDisplay.textContent = this.formatTime(0);
    this.timelineProgress.style.width = '0%';
    window.dispatchEvent(new CustomEvent('playback:durationUpdate', { detail: duration }));
  }

  // State machine transition
  private setState(newState: MediaPanelState) {
    const prevState = this.state;
    this.state = newState;
    console.log('📺 STATE CHANGE:', prevState, '->', newState);

    // Update UI based on new state
    const recordBtn = this.panel.querySelector('#pb-record-btn');
    const statusBadge = this.panel.querySelector('#pb-status');

    // Get all playback controls to enable/disable
    const playbackControls = [
      this.panel.querySelector('#pb-restart'),
      this.panel.querySelector('#pb-prev-shot'),
      this.panel.querySelector('#pb-play-pause'),
      this.panel.querySelector('#pb-next-shot'),
      this.panel.querySelector('#pb-speed'),
      this.panel.querySelector('#pb-export'),
      this.panel.querySelector('#pb-timeline')
    ].filter(Boolean) as HTMLElement[];

    console.log('📺 Found controls:', playbackControls.length);

    switch (newState) {
      case MediaPanelState.IDLE:
        // Ready state - enable all controls
        this.panel.classList.remove('is-recording', 'is-playing', 'is-paused');
        recordBtn?.classList.remove('recording');
        if (statusBadge) {
          statusBadge.textContent = 'READY';
          statusBadge.className = 'status-badge playback';
        }
        playbackControls.forEach(el => {
          el.style.opacity = '1';
          el.style.pointerEvents = 'auto';
          (el as HTMLButtonElement).disabled = false;
        });
        this.stopRecordingTimer();
        this.playButton.textContent = '▶';
        break;

      case MediaPanelState.RECORDING:
        // Recording - dim and disable playback controls
        this.panel.classList.add('is-recording');
        this.panel.classList.remove('is-playing', 'is-paused');
        recordBtn?.classList.add('recording');
        if (statusBadge) {
          statusBadge.textContent = 'REC';
          statusBadge.className = 'status-badge recording';
        }
        console.log('📺 Disabling', playbackControls.length, 'controls');
        playbackControls.forEach(el => {
          el.style.opacity = '0.5';
          el.style.pointerEvents = 'none';
          if (el.tagName === 'BUTTON') {
            (el as HTMLButtonElement).disabled = true;
          }
        });
        this.recordingStartTime = Date.now();
        this.startRecordingTimer();
        break;

      case MediaPanelState.PLAYING:
        // Playing - enable controls, update button
        this.panel.classList.add('is-playing');
        this.panel.classList.remove('is-recording', 'is-paused');
        recordBtn?.classList.remove('recording');
        if (statusBadge) {
          statusBadge.textContent = 'PLAY';
          statusBadge.className = 'status-badge playback playing';
        }
        playbackControls.forEach(el => {
          el.style.opacity = '1';
          el.style.pointerEvents = 'auto';
          if (el.tagName === 'BUTTON') {
            (el as HTMLButtonElement).disabled = false;
          }
        });
        this.playButton.textContent = '⏸';
        this.stopRecordingTimer();
        break;

      case MediaPanelState.PAUSED:
        // Paused - enable controls, update button
        this.panel.classList.add('is-paused');
        this.panel.classList.remove('is-recording', 'is-playing');
        recordBtn?.classList.remove('recording');
        if (statusBadge) {
          statusBadge.textContent = 'PAUSE';
          statusBadge.className = 'status-badge playback';
        }
        playbackControls.forEach(el => {
          el.style.opacity = '1';
          el.style.pointerEvents = 'auto';
          if (el.tagName === 'BUTTON') {
            (el as HTMLButtonElement).disabled = false;
          }
        });
        this.playButton.textContent = '▶';
        this.stopRecordingTimer();
        break;
    }
  }

  getController(): UIPanel {
    return this.panelController;
  }

  getElement(): HTMLElement {
    return this.panel;
  }
}
