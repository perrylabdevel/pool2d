// Centre-screen feedback layer: toasts, the foul flash, and the ball that flies
// from the pocket up to the potting player's pod.

import { ballColor, isStripe, prefersReducedMotion } from './palette';

export type ToastVariant = 'info' | 'pot' | 'foul' | 'win' | 'neutral';
export type ToastFrom = 'center' | 'left' | 'right';

export interface ToastOptions {
  sub?: string;
  variant?: ToastVariant;
  from?: ToastFrom;
  /** Hold time in ms before the out animation runs. */
  hold?: number;
}

/** Matches --dur-mid, collapsed under prefers-reduced-motion. */
const OUT_DURATION = () => (prefersReducedMotion() ? 0 : 260);
const FLY_DURATION = () => (prefersReducedMotion() ? 0 : 420);

export class FeedbackLayer {
  private layer: HTMLElement;
  private flash: HTMLElement;
  private timers = new Set<number>();

  constructor() {
    this.layer = document.getElementById('toast-layer')!;
    this.flash = document.getElementById('foul-flash')!;
  }

  show(text: string, options: ToastOptions = {}) {
    const { sub, variant = 'neutral', from = 'center', hold = 1400 } = options;

    const toast = document.createElement('div');
    toast.className = 'toast';
    if (variant !== 'neutral') toast.classList.add(variant);
    if (from === 'left') toast.classList.add('from-left');
    if (from === 'right') toast.classList.add('from-right');

    toast.appendChild(document.createTextNode(text));
    if (sub) {
      const subEl = document.createElement('span');
      subEl.className = 'toast-sub';
      subEl.textContent = sub;
      toast.appendChild(subEl);
    }

    this.layer.appendChild(toast);

    this.after(hold, () => {
      toast.classList.remove('from-left', 'from-right');
      toast.classList.add('out');
      this.after(OUT_DURATION() + 40, () => toast.remove());
    });
  }

  /** Red pulse bleeding in from the screen edges. */
  foulFlash() {
    this.flash.classList.remove('flash');
    // Force a reflow so the animation restarts on back-to-back fouls.
    void this.flash.offsetWidth;
    this.flash.classList.add('flash');
  }

  /**
   * Fly a ball icon from a screen point (the pocket) to a pod avatar.
   * Both coordinates are viewport-space.
   */
  flyPottedBall(
    ballId: number,
    from: { x: number; y: number },
    to: { x: number; y: number }
  ) {
    const el = document.createElement('div');
    el.className = isStripe(ballId) ? 'pot-fly stripe' : 'pot-fly';
    el.style.background = ballColor(ballId);
    el.style.left = `${from.x - 11}px`;
    el.style.top = `${from.y - 11}px`;
    document.body.appendChild(el);

    const dx = to.x - from.x;
    const dy = to.y - from.y;

    // Two frames: one to commit the start position, one to start the transition.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.transform = `translate(${dx}px, ${dy}px) scale(0.55)`;
        el.style.opacity = '0';
      });
    });

    this.after(FLY_DURATION() + 80, () => el.remove());
  }

  /** Cancel every pending timer — used on restart so stale toasts don't fire. */
  clear() {
    this.timers.forEach((id) => clearTimeout(id));
    this.timers.clear();
    this.layer.textContent = '';
    this.flash.classList.remove('flash');
    document.querySelectorAll('.pot-fly').forEach((el) => el.remove());
  }

  private after(ms: number, fn: () => void) {
    const id = window.setTimeout(() => {
      this.timers.delete(id);
      fn();
    }, ms);
    this.timers.add(id);
  }
}
