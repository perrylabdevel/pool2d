// Vertical power slider docked to the right edge.
//
// Gesture: grab anywhere on the slider and pull *down* to charge — the same
// motion as drawing a cue back. Fill and handle rise together as power builds.
// Keyboard: hold Space to charge, release to fire.
//
// Pointer Events only, so touch and mouse take one code path.

const CHARGE_SECONDS = 1.1; // Space held from 0 to full power.

export interface PowerSliderCallbacks {
  /** Fired continuously while charging. `power` is 0..1. */
  onChange(power: number): void;
  /** Fired on release. `power` is 0..1; below the min threshold it is dropped. */
  onRelease(power: number): void;
  /** Gate: the slider refuses to charge while this returns false. */
  canShoot(): boolean;
  /** First interaction of any kind — used to unlock the AudioContext. */
  onFirstGesture?(): void;
}

export class PowerSlider {
  private root: HTMLElement;
  private track: HTMLElement;
  private fill: HTMLElement;
  private handle: HTMLElement;
  private readout: HTMLElement;

  private cb: PowerSliderCallbacks;

  private power = 0;
  private dragPointerId: number | null = null;
  private dragOriginY = 0;
  private dragOriginPower = 0;

  private spaceHeld = false;
  private spaceStart = 0;
  private rafId = 0;

  constructor(root: HTMLElement, callbacks: PowerSliderCallbacks) {
    this.root = root;
    this.cb = callbacks;
    this.track = root.querySelector('.power-track')!;
    this.fill = root.querySelector('.power-fill')!;
    this.handle = root.querySelector('.power-handle')!;
    this.readout = root.querySelector('.power-readout')!;

    root.addEventListener('pointerdown', this.onPointerDown);
    root.addEventListener('pointermove', this.onPointerMove);
    root.addEventListener('pointerup', this.onPointerUp);
    root.addEventListener('pointercancel', this.onPointerUp);

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);

    this.render();
  }

  getPower(): number {
    return this.power;
  }

  /** Grey the slider out while the table is live. */
  setLocked(locked: boolean) {
    this.root.classList.toggle('locked', locked);
    if (locked) this.cancel();
  }

  /** Drop any in-progress charge without firing. */
  cancel() {
    this.dragPointerId = null;
    this.spaceHeld = false;
    this.stopRaf();
    this.root.classList.remove('charging');
    this.setPower(0);
  }

  private setPower(next: number) {
    this.power = Math.max(0, Math.min(1, next));
    this.render();
    this.cb.onChange(this.power);
  }

  private render() {
    const pct = this.power * 100;
    this.fill.style.height = `${pct}%`;
    // Keep the handle inside the track's rounded ends rather than letting it
    // hang off the bottom cap at zero power.
    this.handle.style.bottom = `calc(${3 + pct * 0.94}% - 3px)`;
    this.readout.textContent = String(Math.round(pct));
    this.root.setAttribute('aria-valuenow', String(Math.round(pct)));
  }

  // -- pointer ---------------------------------------------------------------

  private onPointerDown = (e: PointerEvent) => {
    this.cb.onFirstGesture?.();
    if (!this.cb.canShoot()) return;

    e.preventDefault();
    this.dragPointerId = e.pointerId;
    this.dragOriginY = e.clientY;
    this.dragOriginPower = this.power;
    this.root.setPointerCapture(e.pointerId);
    this.root.classList.add('charging');
  };

  private onPointerMove = (e: PointerEvent) => {
    if (this.dragPointerId !== e.pointerId) return;
    e.preventDefault();

    // Pull down to charge: positive delta = more power.
    const travel = this.track.getBoundingClientRect().height || 1;
    const delta = (e.clientY - this.dragOriginY) / travel;
    this.setPower(this.dragOriginPower + delta);
  };

  private onPointerUp = (e: PointerEvent) => {
    if (this.dragPointerId !== e.pointerId) return;
    this.dragPointerId = null;
    this.root.classList.remove('charging');
    if (this.root.hasPointerCapture(e.pointerId)) {
      this.root.releasePointerCapture(e.pointerId);
    }
    this.fire();
  };

  // -- keyboard --------------------------------------------------------------

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.code !== 'Space' || e.repeat) return;
    this.cb.onFirstGesture?.();
    if (!this.cb.canShoot()) return;

    e.preventDefault();
    this.spaceHeld = true;
    this.spaceStart = performance.now();
    this.root.classList.add('charging');
    this.startRaf();
  };

  private onKeyUp = (e: KeyboardEvent) => {
    if (e.code !== 'Space' || !this.spaceHeld) return;
    e.preventDefault();
    this.spaceHeld = false;
    this.stopRaf();
    this.root.classList.remove('charging');
    this.fire();
  };

  private startRaf() {
    this.stopRaf();
    const tick = () => {
      if (!this.spaceHeld) return;
      const held = (performance.now() - this.spaceStart) / 1000;
      // Ping-pong past full so a long hold doesn't just pin at max.
      const cycle = held / CHARGE_SECONDS;
      const t = cycle % 2;
      this.setPower(t <= 1 ? t : 2 - t);
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private stopRaf() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  private fire() {
    const power = this.power;
    this.setPower(0);
    this.cb.onRelease(power);
  }

  destroy() {
    this.stopRaf();
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }
}
