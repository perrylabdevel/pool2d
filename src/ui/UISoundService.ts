import { DEFAULT_AUDIO_SETTINGS, type AudioSettings } from './SettingsManager';

type UISoundEvent =
  | 'button-hover'
  | 'button-click'
  | 'modal-open'
  | 'modal-close'
  | 'toast'
  | 'preview';

interface SoundProfile {
  attack?: number;
  decay?: number;
  duration?: number;
  startFreq?: number;
  endFreq?: number;
  type?: OscillatorType;
  volume?: number;
}

class UISoundService {
  private ctx: AudioContext | null = null;
  private settings: AudioSettings = { ...DEFAULT_AUDIO_SETTINGS };
  private lastEventTime: Partial<Record<UISoundEvent, number>> = {};
  private hoverTarget: Element | null = null;
  private isUnlocked = false;

  constructor() {
    this.tryPullInitialSettings();
    this.bindUnlockHandlers();
    this.bindSettingsListener();
    this.bindUIListeners();
    window.addEventListener('ui-sound:preview', () => this.play('preview'));
  }

  private get audioContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    return this.ctx;
  }

  private tryPullInitialSettings() {
    try {
      const game = (window as any).poolGame;
      if (game?.hud?.settingsManager?.getAudioSettings) {
        this.settings = game.hud.settingsManager.getAudioSettings();
      }
    } catch (err) {
      console.warn('[UISound] Unable to read initial settings', err);
    }
  }

  private bindUnlockHandlers() {
    const unlock = async () => {
      if (this.isUnlocked) return;
      try {
        await this.audioContext.resume();
        this.isUnlocked = true;
      } catch (err) {
        console.warn('[UISound] resume failed', err);
      }
    };

    const pointerUnlock = () => {
      document.removeEventListener('pointerdown', pointerUnlock, true);
      document.removeEventListener('keydown', keyUnlock, true);
      unlock();
    };
    const keyUnlock = () => {
      document.removeEventListener('pointerdown', pointerUnlock, true);
      document.removeEventListener('keydown', keyUnlock, true);
      unlock();
    };

    document.addEventListener('pointerdown', pointerUnlock, { once: true, capture: true });
    document.addEventListener('keydown', keyUnlock, { once: true, capture: true });
  }

  private bindSettingsListener() {
    window.addEventListener('settings:audio-changed', (event) => {
      const detail = (event as CustomEvent<{ settings: AudioSettings }>).detail;
      if (detail?.settings) {
        this.settings = detail.settings;
      }
    });
  }

  private bindUIListeners() {
    document.addEventListener(
      'pointerover',
      (event) => {
        const target = (event.target as HTMLElement)?.closest?.('.btn-arcade');
        if (!target || target === this.hoverTarget) return;
        this.hoverTarget = target;
        this.play('button-hover');
      },
      true
    );

    document.addEventListener(
      'pointerout',
      (event) => {
        const target = event.target as HTMLElement;
        if (target && this.hoverTarget && target === this.hoverTarget) {
          this.hoverTarget = null;
        }
      },
      true
    );

    document.addEventListener(
      'pointerdown',
      (event) => {
        const target = (event.target as HTMLElement)?.closest?.('.btn-arcade');
        if (!target) return;
        this.play('button-click');
      },
      true
    );
  }

  play(event: UISoundEvent) {
    if (!this.isEnabled()) return;

    const now = performance.now();
    const last = this.lastEventTime[event] ?? 0;
    if (now - last < 30) {
      return;
    }
    this.lastEventTime[event] = now;

    const profile = this.getProfile(event);
    this.scheduleTone(profile);
  }

  private isEnabled(): boolean {
    if (this.settings.muteMaster || this.settings.muteUISounds) return false;
    const master = this.settings.master ?? DEFAULT_AUDIO_SETTINGS.master;
    const ui = this.settings.uiSounds ?? DEFAULT_AUDIO_SETTINGS.uiSounds;
    return master > 0.01 && ui > 0.01;
  }

  getVolumeState() {
    return {
      master: this.settings.master ?? DEFAULT_AUDIO_SETTINGS.master,
      ui: this.settings.uiSounds ?? DEFAULT_AUDIO_SETTINGS.uiSounds,
      muted: !!(this.settings.muteMaster || this.settings.muteUISounds),
    };
  }

  private getProfile(event: UISoundEvent): SoundProfile {
    switch (event) {
      case 'button-hover':
        // Disable hover sounds for buttons as they can be annoying in modals
        return { startFreq: 640, endFreq: 720, duration: 0.08, type: 'triangle', volume: 0.0 };
      case 'button-click':
        return { startFreq: 420, endFreq: 360, duration: 0.12, type: 'square', volume: 0.55 };
      case 'modal-open':
        return { startFreq: 280, endFreq: 520, duration: 0.2, type: 'sine', volume: 0.6 };
      case 'modal-close':
        return { startFreq: 520, endFreq: 260, duration: 0.18, type: 'triangle', volume: 0.5 };
      case 'toast':
        return { startFreq: 780, endFreq: 600, duration: 0.16, type: 'square', volume: 0.5 };
      case 'preview':
        return { startFreq: 560, endFreq: 430, duration: 0.25, type: 'square', volume: 0.65 };
      default:
        return { startFreq: 480, endFreq: 480, duration: 0.12, type: 'sine', volume: 0.4 };
    }
  }

  private scheduleTone(profile: SoundProfile) {
    const ctx = this.audioContext;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const master = this.settings.master ?? DEFAULT_AUDIO_SETTINGS.master;
    const ui = this.settings.uiSounds ?? DEFAULT_AUDIO_SETTINGS.uiSounds;
    const masterVolume = Math.min(1, Math.max(0, master));
    const uiVolume = Math.min(1, Math.max(0, ui));
    const baseVolume = (profile.volume ?? 0.5) * masterVolume * uiVolume;

    const duration = profile.duration ?? 0.12;
    const attack = profile.attack ?? 0.005;
    const decay = profile.decay ?? duration * 0.9;
    const startFreq = profile.startFreq ?? 440;
    const endFreq = profile.endFreq ?? startFreq;

    osc.type = profile.type ?? 'triangle';

    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(startFreq, now);
    if (startFreq !== endFreq) {
      osc.frequency.linearRampToValueAtTime(endFreq, now + duration);
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(baseVolume, now + attack);
    gain.gain.linearRampToValueAtTime(0.0001, now + Math.max(attack + 0.01, decay));

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.05);

    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }
}

export const uiSoundService = new UISoundService();
