// End-of-match overlay: result headline plus stats that count up on reveal.

import { prefersReducedMotion } from './palette';

export interface MatchSummary {
  headline: string;
  eyebrow: string;
  won: boolean;
  ballsCleared: number;
  shotsTaken: number;
  bestRun: number;
}

const COUNT_DURATION = 900;

export class EndOverlay {
  private root: HTMLElement;
  private eyebrow: HTMLElement;
  private headline: HTMLElement;
  private cleared: HTMLElement;
  private shots: HTMLElement;
  private run: HTMLElement;
  private rematchBtn: HTMLButtonElement;

  private counters: number[] = [];

  onRematch?: () => void;

  constructor() {
    this.root = document.getElementById('end-overlay')!;
    this.eyebrow = document.getElementById('end-eyebrow')!;
    this.headline = document.getElementById('end-headline')!;
    this.cleared = document.getElementById('end-cleared')!;
    this.shots = document.getElementById('end-shots')!;
    this.run = document.getElementById('end-run')!;
    this.rematchBtn = document.getElementById('end-rematch') as HTMLButtonElement;

    this.rematchBtn.addEventListener('click', () => {
      this.hide();
      this.onRematch?.();
    });
  }

  get isOpen(): boolean {
    return !this.root.classList.contains('hidden');
  }

  show(summary: MatchSummary) {
    this.eyebrow.textContent = summary.eyebrow;
    this.headline.textContent = summary.headline;
    this.headline.classList.toggle('lose', !summary.won);

    this.root.classList.remove('hidden');

    this.countTo(this.cleared, summary.ballsCleared);
    this.countTo(this.shots, summary.shotsTaken);
    this.countTo(this.run, summary.bestRun);

    this.rematchBtn.focus();
  }

  hide() {
    this.root.classList.add('hidden');
    this.clearCounters();
  }

  /** Tick a number up to its target so the card lands with some weight. */
  private countTo(el: HTMLElement, target: number) {
    if (prefersReducedMotion() || target <= 0) {
      el.textContent = String(target);
      return;
    }

    const start = performance.now();
    const id = window.setInterval(() => {
      const t = Math.min(1, (performance.now() - start) / COUNT_DURATION);
      // Same curve family as --ease-out.
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = String(Math.round(target * eased));
      if (t >= 1) window.clearInterval(id);
    }, 32);

    this.counters.push(id);
  }

  private clearCounters() {
    this.counters.forEach((id) => window.clearInterval(id));
    this.counters = [];
  }
}
