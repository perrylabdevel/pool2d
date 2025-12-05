import { UIPanel } from './panels/UIPanel';
import { makePanelDraggable } from './drag';
import { physicsRecorder } from '../debug/PhysicsRecorder';

export class RecordingPanel {
    private panel: HTMLElement;
    private panelController: UIPanel;
    private recordButton!: HTMLButtonElement;
    private playLastButton!: HTMLButtonElement;
    private prevButton!: HTMLButtonElement;
    private nextButton!: HTMLButtonElement;
    private statusDisplay!: HTMLSpanElement;
    private timerInterval: number | null = null;
    private startTime: number = 0;

    private currentHistoryIndex: number = -1;

    private isPlayingPlayback: boolean = false;

    constructor() {
        this.panel = this.createPanel();
        this.panelController = new UIPanel({
            element: this.panel,
            id: 'recording-panel',
        });

        // Make the entire panel draggable
        makePanelDraggable(this.panel, this.panel);

        // Update UI on open
        this.panelController.addEventListener('panel:open', () => {
            this.updateUI();
        });

        // Keep UI in sync when recordings end outside this panel
        window.addEventListener('match:recorded', () => {
            // New recording added, jump to end
            const history = physicsRecorder.getHistory();
            this.currentHistoryIndex = history.length - 1;
            this.updateUI();
        });

        // Track playback state
        window.addEventListener('playback:load', () => {
            this.isPlayingPlayback = true;
            this.updateUI();
        });

        window.addEventListener('game:restarted', () => {
            this.isPlayingPlayback = false;
            this.updateUI();
        });
    }

    private createPanel(): HTMLElement {
        const panel = document.createElement('div');
        panel.className = 'media-panel hidden';
        panel.innerHTML = `
            <div class="media-left">
                <div class="status-badge recording" id="rec-badge">REC</div>
                <button class="btn icon-btn record" id="rec-toggle-btn" title="Start/Stop Recording">●</button>
            </div>
            
            <div class="media-center">
                <div class="timecode" style="justify-content: center;">
                    <span id="rec-timer" style="font-size: 14px; font-weight: 600; font-variant-numeric: tabular-nums;">00:00</span>
                </div>
            </div>
            
            <div class="media-right">
                <button class="btn icon-btn" id="rec-prev-btn" title="Previous Recording">⏮</button>
                <button class="btn icon-btn" id="rec-play-last-btn" title="Play Selected">▶</button>
                <button class="btn icon-btn" id="rec-next-btn" title="Next Recording">⏭</button>
                <button class="btn icon-btn" id="rec-close-btn" title="Close">×</button>
            </div>
        `;

        // Bind elements
        this.recordButton = panel.querySelector('#rec-toggle-btn') as HTMLButtonElement;
        this.playLastButton = panel.querySelector('#rec-play-last-btn') as HTMLButtonElement;
        this.prevButton = panel.querySelector('#rec-prev-btn') as HTMLButtonElement;
        this.nextButton = panel.querySelector('#rec-next-btn') as HTMLButtonElement;
        this.statusDisplay = panel.querySelector('#rec-timer') as HTMLSpanElement;

        // Bind events
        this.recordButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleRecording();
        });

        this.playLastButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.togglePlayback();
        });

        this.prevButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.navigateHistory(-1);
        });

        this.nextButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.navigateHistory(1);
        });

        panel.querySelector('#rec-close-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            // Ensure focus leaves the panel before hiding it
            (document.activeElement as HTMLElement | null)?.blur?.();
            this.panelController.close();
        });

        // Stop propagation on buttons to prevent dragging
        panel.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('mousedown', (e) => e.stopPropagation());
        });

        return panel;
    }

    private toggleRecording() {
        if (physicsRecorder.isRecording()) {
            physicsRecorder.stop();
            this.updateUI();
        } else {
            physicsRecorder.start();
            this.startTime = Date.now();
            this.updateUI();
        }
    }

    private togglePlayback() {
        if (this.isPlayingPlayback) {
            window.dispatchEvent(new CustomEvent('playback:stop'));
        } else {
            this.playSelected();
        }
    }

    private navigateHistory(direction: number) {
        const history = physicsRecorder.getHistory();
        if (history.length === 0) return;

        let newIndex = this.currentHistoryIndex + direction;
        // Clamp index
        newIndex = Math.max(0, Math.min(newIndex, history.length - 1));

        if (newIndex !== this.currentHistoryIndex) {
            this.currentHistoryIndex = newIndex;
            this.updateUI();

            // Optional: Auto-play when navigating?
            // For now, just update UI to show which one is selected (via timer/index if we had one)
            // Since we don't have a visual list, maybe flash the time?
            const data = history[this.currentHistoryIndex];
            if (data) {
                const mins = Math.floor(data.duration / 60).toString().padStart(2, '0');
                const secs = Math.floor(data.duration % 60).toString().padStart(2, '0');
                this.statusDisplay.textContent = `REC ${this.currentHistoryIndex + 1}/${history.length} (${mins}:${secs})`;
            }
        }
    }

    private playSelected() {
        const history = physicsRecorder.getHistory();
        // If no history, try to play whatever is in localStorage (legacy behavior) or just fail
        if (history.length === 0) {
            window.dispatchEvent(new CustomEvent('recording:play-last'));
            return;
        }

        // Default to last if index invalid
        if (this.currentHistoryIndex === -1) {
            this.currentHistoryIndex = history.length - 1;
        }

        const data = history[this.currentHistoryIndex];
        if (data) {
            window.dispatchEvent(new CustomEvent('playback:load', { detail: data }));
        }
    }

    private updateUI() {
        const isRecording = physicsRecorder.isRecording();
        const history = physicsRecorder.getHistory();

        // Update navigation buttons
        this.prevButton.disabled = this.currentHistoryIndex <= 0;
        this.nextButton.disabled = this.currentHistoryIndex >= history.length - 1 || this.currentHistoryIndex === -1;

        // Update opacity for disabled state
        this.prevButton.style.opacity = this.prevButton.disabled ? '0.3' : '1';
        this.nextButton.style.opacity = this.nextButton.disabled ? '0.3' : '1';

        // Update Play button state
        if (this.isPlayingPlayback) {
            this.playLastButton.textContent = '■';
            this.playLastButton.title = "Stop Playback";
            this.playLastButton.classList.add('active');
        } else {
            this.playLastButton.textContent = '▶';
            this.playLastButton.title = "Play Selected";
            this.playLastButton.classList.remove('active');
        }

        if (isRecording) {
            this.recordButton.classList.add('active');
            this.recordButton.textContent = '■'; // Stop square
            this.recordButton.title = "Stop Recording";

            this.panel.querySelector('#rec-badge')?.classList.add('active');

            // Pulse effect for recording state
            this.recordButton.style.animation = 'pulse-red-dot 2s infinite';

            if (!this.timerInterval) {
                this.startTime = Date.now(); // Approximate if opened mid-recording
                this.timerInterval = window.setInterval(() => {
                    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
                    const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
                    const secs = (elapsed % 60).toString().padStart(2, '0');
                    this.statusDisplay.textContent = `${mins}:${secs}`;
                    this.statusDisplay.style.color = '#ff3b30';
                }, 1000);
            }
        } else {
            this.recordButton.classList.remove('active');
            this.recordButton.textContent = '●'; // Record circle
            this.recordButton.title = "Start New Recording";
            this.recordButton.style.animation = '';

            this.panel.querySelector('#rec-badge')?.classList.remove('active');

            if (this.timerInterval) {
                clearInterval(this.timerInterval);
                this.timerInterval = null;
            }

            // Show selected recording info if not recording
            if (history.length > 0 && this.currentHistoryIndex !== -1) {
                const data = history[this.currentHistoryIndex];
                const mins = Math.floor(data.duration / 60).toString().padStart(2, '0');
                const secs = Math.floor(data.duration % 60).toString().padStart(2, '0');
                this.statusDisplay.textContent = `REC ${this.currentHistoryIndex + 1}/${history.length} (${mins}:${secs})`;
                this.statusDisplay.style.color = '#aaa';
            } else {
                this.statusDisplay.textContent = '00:00';
                this.statusDisplay.style.color = '';
            }
        }
    }

    getController(): UIPanel {
        return this.panelController;
    }

    getElement(): HTMLElement {
        return this.panel;
    }
}
