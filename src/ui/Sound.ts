// Web Audio sound. Everything is synthesized at runtime — no bundled samples,
// no new dependency, nothing to license.
//
// The AudioContext is created lazily on the first user gesture, because browsers
// refuse to start one before that.

const STORAGE_KEY = 'pool2d_muted';

type Ctx = AudioContext;

export class SoundManager {
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private muted: boolean;

  constructor() {
    this.muted = this.loadMuted();
  }

  private loadMuted(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  }

  private persist() {
    try {
      localStorage.setItem(STORAGE_KEY, this.muted ? '1' : '0');
    } catch {
      /* storage unavailable — mute state just won't persist */
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.01);
    }
    this.persist();
  }

  toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /** Call from a user gesture handler. Safe to call repeatedly. */
  resume() {
    const ctx = this.ensure();
    if (ctx && ctx.state === 'suspended') void ctx.resume();
  }

  private ensure(): Ctx | null {
    if (this.ctx) return this.ctx;

    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;

    try {
      this.ctx = new Ctor();
    } catch {
      return null;
    }

    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(this.ctx.destination);

    // One shared noise buffer, built once, reused by every impact sound.
    const length = Math.floor(this.ctx.sampleRate * 0.4);
    this.noiseBuffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;

    return this.ctx;
  }

  /** A pitched click: two decaying sines plus a noise transient. */
  private impact(
    frequency: number,
    duration: number,
    gain: number,
    noiseAmount: number,
    filterHz: number
  ) {
    const ctx = this.ensure();
    if (!ctx || !this.master || this.muted) return;

    const now = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.setValueAtTime(gain, now);
    out.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    out.connect(this.master);

    for (const [mult, level] of [
      [1, 1],
      [2.41, 0.45],
    ] as const) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency * mult, now);
      osc.frequency.exponentialRampToValueAtTime(frequency * mult * 0.72, now + duration);

      const g = ctx.createGain();
      g.gain.value = level;
      osc.connect(g).connect(out);
      osc.start(now);
      osc.stop(now + duration + 0.02);
    }

    if (noiseAmount > 0 && this.noiseBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;

      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = filterHz;
      bp.Q.value = 0.8;

      const g = ctx.createGain();
      g.gain.setValueAtTime(noiseAmount, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + duration * 0.7);

      src.connect(bp).connect(g).connect(out);
      src.start(now);
      src.stop(now + duration + 0.02);
    }
  }

  /** Cue tip striking the cue ball. `power` is 0..1. */
  cueStrike(power: number) {
    const p = Math.max(0, Math.min(1, power));
    this.impact(180 + p * 120, 0.1, 0.22 + p * 0.24, 0.3 + p * 0.3, 2200);
  }

  /** Ball-on-ball clack. `intensity` is 0..1. */
  clack(intensity: number) {
    const i = Math.max(0.08, Math.min(1, intensity));
    this.impact(760 + i * 520, 0.06 + i * 0.05, 0.1 + i * 0.3, 0.16 + i * 0.24, 4200);
  }

  /** Ball into a cushion: lower, duller, more damped than a clack. */
  cushion(intensity: number) {
    const i = Math.max(0.08, Math.min(1, intensity));
    this.impact(120 + i * 70, 0.13, 0.12 + i * 0.2, 0.2 + i * 0.2, 700);
  }

  /** Ball dropping into a pocket: the clack, then a rattle down the return. */
  pocketDrop() {
    this.impact(300, 0.09, 0.26, 0.3, 1400);
    window.setTimeout(() => this.impact(120, 0.22, 0.2, 0.32, 500), 110);
  }

  /** Descending minor third — something went wrong. */
  foul() {
    this.tone(392, 0.16, 0.18, 0);
    window.setTimeout(() => this.tone(311, 0.3, 0.18, 0), 130);
  }

  /** Rising major arpeggio for the win. */
  fanfare() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      window.setTimeout(() => this.tone(f, 0.34, 0.16, 0.004), i * 95);
    });
  }

  /** Soft blip for turn changes and toasts. */
  blip() {
    this.tone(880, 0.09, 0.09, 0);
  }

  private tone(frequency: number, duration: number, gain: number, detune: number) {
    const ctx = this.ensure();
    if (!ctx || !this.master || this.muted) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = frequency;
    if (detune) osc.detune.value = detune * 1200;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(gain, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(g).connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }
}

export const sound = new SoundManager();
