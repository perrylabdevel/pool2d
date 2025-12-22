import { BannerStore } from './stores/BannerStore';
import { PreviewCanvas } from './components/PreviewCanvas';
import { PresetBrowser } from './components/PresetBrowser';
import { StylePanel } from './panels/StylePanel';
import { TextPanel } from './panels/TextPanel';
import { AnimationPanel } from './panels/AnimationPanel';
import { BannerConfig } from './types';

export class BannerEditorApp {
  private store: BannerStore;
  private preview: PreviewCanvas | null = null;
  private presetBrowser: PresetBrowser | null = null;
  private stylePanel: StylePanel | null = null;
  private textPanel: TextPanel | null = null;
  private animationPanel: AnimationPanel | null = null;
  private timelineEl: HTMLElement | null = null;
  private wsConnection: WebSocket | null = null;
  private isPlaying: boolean = false;

  constructor() {
    this.store = new BannerStore();
  }

  init() {
    // Init Preview
    const canvas = document.getElementById('preview-canvas') as HTMLCanvasElement;
    if (canvas) {
      this.preview = new PreviewCanvas(canvas);
      this.store.subscribe((config) => {
        this.preview?.update(config);
      });

      // Hook up timeline updates
      this.preview.setPhaseChangeCallback((phase, elapsed, total) => {
        this.updateTimeline(phase, elapsed, total);
      });
    }

    // Init Preset Browser (left sidebar)
    const presetsContainer = document.getElementById('presets-container');
    if (presetsContainer) {
      this.presetBrowser = new PresetBrowser(presetsContainer, this.store);
    }

    // Init Panels (right sidebar)
    const panelsContainer = document.getElementById('panels-container');
    if (panelsContainer) {
      this.stylePanel = new StylePanel(panelsContainer, this.store);
      this.textPanel = new TextPanel(panelsContainer, this.store);
      this.animationPanel = new AnimationPanel(panelsContainer, this.store);
    }

    // Init Timeline
    this.timelineEl = document.getElementById('timeline-status');

    // Init Header Actions
    const btnShow = document.getElementById('btn-show');
    btnShow?.addEventListener('click', () => {
      if (this.isPlaying) {
        this.preview?.stopAnimation();
        this.isPlaying = false;
        btnShow.textContent = '▶ Play Animation';
      } else {
        this.preview?.triggerAnimation();
        this.isPlaying = true;
        btnShow.textContent = '⏹ Stop';
      }
    });

    document.getElementById('btn-reset')?.addEventListener('click', () => {
      this.store.reset();
    });

    document.getElementById('btn-export')?.addEventListener('click', () => {
      this.exportConfig();
    });

    document.getElementById('btn-push')?.addEventListener('click', () => {
      this.pushToGame();
    });

    // Render initial state
    const config = this.store.get();
    this.stylePanel?.render(config);
    this.textPanel?.render(config);
    this.animationPanel?.render(config);
  }

  private updateTimeline(phase: string, elapsed: number, total: number) {
    if (!this.timelineEl) return;

    if (phase === 'idle') {
      this.timelineEl.textContent = 'Ready';
      this.timelineEl.className = 'timeline-idle';
      this.isPlaying = false;
      const btnShow = document.getElementById('btn-show');
      if (btnShow) btnShow.textContent = '▶ Play Animation';
      return;
    }

    const phaseLabels: Record<string, string> = {
      enter: 'ENTER',
      active: 'HOLD',
      exit: 'EXIT',
    };

    const percent = total > 0 ? Math.round((elapsed / total) * 100) : 0;
    this.timelineEl.textContent = `${phaseLabels[phase] || phase} ${percent}%`;
    this.timelineEl.className = `timeline-${phase}`;
  }

  private exportConfig() {
    const config = this.store.get();
    const json = JSON.stringify(config, null, 2);

    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `banner-${config.type}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private pushToGame() {
    const config = this.store.get();

    // Try WebSocket first
    if (this.wsConnection && this.wsConnection.readyState === WebSocket.OPEN) {
      this.wsConnection.send(
        JSON.stringify({
          type: 'banner-editor:update',
          payload: config,
        })
      );
      this.showStatus('Pushed to game via WebSocket');
      return;
    }

    // Save to localStorage for game to pick up (same key as NotificationService expects)
    try {
      localStorage.setItem('RailRush_banner_editor_config', JSON.stringify(config));

      // Dispatch event that NotificationService listens to
      window.dispatchEvent(
        new CustomEvent('banner-editor:push', {
          detail: { config },
        })
      );

      this.showStatus('Config saved! Refresh game to apply.');
    } catch (e) {
      this.showStatus('Failed to push config');
    }
  }

  private showStatus(message: string) {
    const statusEl = document.getElementById('status-message');
    if (statusEl) {
      statusEl.textContent = message;
      statusEl.classList.add('visible');
      setTimeout(() => statusEl.classList.remove('visible'), 2000);
    }
  }

  connectWebSocket(url: string = 'ws://localhost:9001') {
    try {
      this.wsConnection = new WebSocket(url);
      this.wsConnection.onopen = () => {
        this.showStatus('Connected to game');
        const indicator = document.getElementById('ws-indicator');
        if (indicator) indicator.classList.add('connected');
      };
      this.wsConnection.onclose = () => {
        const indicator = document.getElementById('ws-indicator');
        if (indicator) indicator.classList.remove('connected');
      };
      this.wsConnection.onerror = () => {
        console.warn('WebSocket connection failed');
      };
    } catch (e) {
      console.warn('Could not connect WebSocket');
    }
  }
}
