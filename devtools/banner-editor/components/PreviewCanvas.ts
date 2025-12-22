import { BannerConfig } from '../types';
import { BannerRenderer } from '../renderers/BannerRenderer';

type AnimationPhase = 'idle' | 'enter' | 'active' | 'exit';

interface AnimationState {
  phase: AnimationPhase;
  startTime: number;
  progress: number;
}

export class PreviewCanvas {
  private canvas: HTMLCanvasElement;
  private renderer: BannerRenderer;
  private animationFrame: number | null = null;
  private currentConfig: BannerConfig | null = null;
  private animationState: AnimationState = { phase: 'idle', startTime: 0, progress: 0 };

  private onPhaseChange?: (phase: AnimationPhase, elapsed: number, total: number) => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new BannerRenderer(canvas.getContext('2d')!);

    const resizeObserver = new ResizeObserver(() => this.resize());
    resizeObserver.observe(canvas.parentElement!);
    this.resize();
  }

  resize() {
    const parent = this.canvas.parentElement;
    if (parent) {
      this.canvas.width = parent.clientWidth;
      this.canvas.height = parent.clientHeight;
      if (this.currentConfig) {
        this.renderStatic();
      }
    }
  }

  update(config: BannerConfig) {
    this.currentConfig = config;
    if (this.animationState.phase === 'idle') {
      this.renderStatic();
    }
  }

  setPhaseChangeCallback(cb: (phase: AnimationPhase, elapsed: number, total: number) => void) {
    this.onPhaseChange = cb;
  }

  triggerAnimation() {
    if (!this.currentConfig) return;

    this.animationState = {
      phase: 'enter',
      startTime: performance.now(),
      progress: 0,
    };

    this.animate();
  }

  stopAnimation() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    this.animationState = { phase: 'idle', startTime: 0, progress: 0 };
    this.renderStatic();
  }

  private animate = () => {
    if (!this.currentConfig) return;

    const now = performance.now();
    const config = this.currentConfig;
    const state = this.animationState;

    const enterDuration = config.animation.entry.duration;
    const holdDuration = config.animation.hold;
    const exitDuration = config.animation.exit.duration;

    const elapsed = now - state.startTime;

    if (state.phase === 'enter') {
      state.progress = Math.min(1, elapsed / enterDuration);

      if (this.onPhaseChange) {
        this.onPhaseChange('enter', elapsed, enterDuration);
      }

      if (elapsed >= enterDuration) {
        state.phase = 'active';
        state.startTime = now;
        state.progress = 0;
      }
    } else if (state.phase === 'active') {
      state.progress = Math.min(1, elapsed / holdDuration);

      if (this.onPhaseChange) {
        this.onPhaseChange('active', elapsed, holdDuration);
      }

      if (elapsed >= holdDuration) {
        state.phase = 'exit';
        state.startTime = now;
        state.progress = 0;
      }
    } else if (state.phase === 'exit') {
      state.progress = Math.min(1, elapsed / exitDuration);

      if (this.onPhaseChange) {
        this.onPhaseChange('exit', elapsed, exitDuration);
      }

      if (elapsed >= exitDuration) {
        state.phase = 'idle';
        this.animationFrame = null;
        if (this.onPhaseChange) {
          this.onPhaseChange('idle', 0, 0);
        }
        this.renderStatic();
        return;
      }
    }

    this.render();
    this.animationFrame = requestAnimationFrame(this.animate);
  };

  private render() {
    if (!this.currentConfig) return;

    const phase = this.animationState.phase === 'idle' ? 'active' : this.animationState.phase;
    const progress = this.animationState.phase === 'idle' ? 1 : this.animationState.progress;

    this.renderer.render(
      this.currentConfig,
      this.canvas.width,
      this.canvas.height,
      phase as 'enter' | 'active' | 'exit',
      progress
    );
  }

  private renderStatic() {
    if (!this.currentConfig) return;

    this.renderer.render(
      this.currentConfig,
      this.canvas.width,
      this.canvas.height,
      'active',
      1
    );
  }

  getAnimationState(): AnimationState {
    return { ...this.animationState };
  }
}
