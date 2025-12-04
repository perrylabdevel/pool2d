import { UIPanel } from './panels/UIPanel';
import { makePanelDraggable } from './drag';
import { physicsRecorder } from '../debug/PhysicsRecorder';

export class RecordingPanel {
    private panel: HTMLElement;
    private panelController: UIPanel;
    private recordButton!: HTMLButtonElement;
    private playLastButton!: HTMLButtonElement;
    private statusDisplay!: HTMLSpanElement;
    private timerInterval: number | null = null;
    private startTime: number = 0;

    constructor() {
        this.panel = this.createPanel();
        this.panelController = new UIPanel({
            element: this.panel,
            id: 'recording-panel',
        });

        makePanelDraggable(this.panel, this.panel.querySelector('.drag-handle') as HTMLElement);

        // Update UI on open
        this.panelController.addEventListener('panel:open', () => {
            this.updateUI();
        });

        // Keep UI in sync when recordings end outside this panel
        window.addEventListener('match:recorded', () => {
            this.updateUI();
        });
    }

    private createPanel(): HTMLElement {
        const panel = document.createElement('div');
        panel.className = 'ui-panel recording-panel compact landscape hidden';
        panel.innerHTML = `
            <div class="drag-handle" title="Drag to move">⋮⋮</div>
            <div class="panel-content">
                <div class="status-indicator" id="rec-status-dot" title="Ready"></div>
                <div class="timer-display" id="rec-timer">00:00</div>
                <div class="button-group">
                    <button id="rec-toggle-btn" class="icon-btn" title="Start/Stop Recording">
                        <span class="icon">●</span>
                    </button>
                    <button id="rec-play-last-btn" class="icon-btn" title="Replay Last Match">
                        <span class="icon">▶</span>
                    </button>
                </div>
                <button class="close-btn-compact" id="rec-close-btn" title="Close">×</button>
            </div>
        `;

        // Bind elements
        this.recordButton = panel.querySelector('#rec-toggle-btn') as HTMLButtonElement;
        this.playLastButton = panel.querySelector('#rec-play-last-btn') as HTMLButtonElement;
        this.statusDisplay = panel.querySelector('#rec-timer') as HTMLSpanElement; // Reusing statusDisplay for timer text

        // Bind events
        this.recordButton.addEventListener('click', () => {
            this.toggleRecording();
        });
        this.playLastButton.addEventListener('click', () => {
            this.playLast();
        });

        panel.querySelector('#rec-close-btn')?.addEventListener('click', () => {
            // Ensure focus leaves the panel before hiding it to avoid aria-hidden focus errors
            (document.activeElement as HTMLElement | null)?.blur?.();
            this.panelController.close();
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

    private playLast() {
        window.dispatchEvent(new CustomEvent('recording:play-last'));
    }

    private updateUI() {
        const isRecording = physicsRecorder.isRecording();
        const statusDot = this.panel.querySelector('#rec-status-dot') as HTMLElement;
        const recordIcon = this.recordButton.querySelector('.icon') as HTMLElement;

        if (isRecording) {
            this.recordButton.classList.add('active');
            this.recordButton.title = "Stop Recording";
            if (recordIcon) recordIcon.textContent = '■'; // Stop square

            statusDot.classList.add('recording');
            statusDot.title = "Recording...";

            if (!this.timerInterval) {
                this.startTime = Date.now(); // Approximate if opened mid-recording
                this.timerInterval = window.setInterval(() => {
                    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
                    const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
                    const secs = (elapsed % 60).toString().padStart(2, '0');
                    this.statusDisplay.textContent = `${mins}:${secs}`;
                }, 1000);
            }
        } else {
            this.recordButton.classList.remove('active');
            this.recordButton.title = "Start New Recording";
            if (recordIcon) recordIcon.textContent = '●'; // Record circle

            statusDot.classList.remove('recording');
            statusDot.title = "Ready";
            this.statusDisplay.textContent = '00:00';

            if (this.timerInterval) {
                clearInterval(this.timerInterval);
                this.timerInterval = null;
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
