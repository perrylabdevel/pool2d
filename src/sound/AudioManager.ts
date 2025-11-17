import { DEFAULT_AUDIO_SETTINGS, type AudioSettings } from '../ui/SettingsManager';

type EventKey = 'cue' | 'ball' | 'rail' | 'pocket';

type EventConfig = {
  volume: keyof AudioSettings;
  baseFreq: keyof AudioSettings;
  attack: keyof AudioSettings;
  sustain: keyof AudioSettings;
  release: keyof AudioSettings;
  waveform: keyof AudioSettings;
  freqIntensityScale: number;
  freqEndRatio: number;
  sustainBase: number;
  sustainRange: number;
};

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sources: OscillatorNode[] = [];
  private settings: AudioSettings = { ...DEFAULT_AUDIO_SETTINGS };

  private eventConfig: Record<EventKey, EventConfig> = {
    cue: {
      volume: 'cueHits',
      baseFreq: 'cueBaseFreq',
      attack: 'cueAttack',
      sustain: 'cueSustain',
      release: 'cueRelease',
      waveform: 'cueWaveform',
      freqIntensityScale: 40,
      freqEndRatio: 0.65,
      sustainBase: 0.15,
      sustainRange: 0.45,
    },
    ball: {
      volume: 'ballCollisions',
      baseFreq: 'ballBaseFreq',
      attack: 'ballAttack',
      sustain: 'ballSustain',
      release: 'ballRelease',
      waveform: 'ballWaveform',
      freqIntensityScale: 25,
      freqEndRatio: 0.6,
      sustainBase: 0.12,
      sustainRange: 0.35,
    },
    rail: {
      volume: 'railHits',
      baseFreq: 'railBaseFreq',
      attack: 'railAttack',
      sustain: 'railSustain',
      release: 'railRelease',
      waveform: 'railWaveform',
      freqIntensityScale: 35,
      freqEndRatio: 0.55,
      sustainBase: 0.08,
      sustainRange: 0.25,
    },
    pocket: {
      volume: 'pocketDrops',
      baseFreq: 'pocketBaseFreq',
      attack: 'pocketAttack',
      sustain: 'pocketSustain',
      release: 'pocketRelease',
      waveform: 'pocketWaveform',
      freqIntensityScale: 20,
      freqEndRatio: 0.4,
      sustainBase: 0.18,
      sustainRange: 0.4,
    },
  };

  private get audioContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.settings.master;
      this.masterGain.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  async ensureUnlocked() {
    const ctx = this.audioContext;
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch (err) {
        console.warn('Audio resume failed', err);
      }
    }
  }

  setSettings(settings: AudioSettings) {
    this.settings = { ...settings };
    if (this.masterGain) {
      this.masterGain.gain.value = this.settings.master;
    }
  }

  private playEvent(event: EventKey, intensity: number) {
    const cfg = this.eventConfig[event];
    const level = this.settings[cfg.volume] as number;
    if (level <= 0) return;

    const ctx = this.audioContext;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const baseFreq = this.settings[cfg.baseFreq] as number;
    const attack = this.settings[cfg.attack] as number;
    const sustainSetting = this.settings[cfg.sustain] as number;
    const release = this.settings[cfg.release] as number;
    const waveform = this.settings[cfg.waveform] as OscillatorType;

    osc.type = waveform;
    osc.frequency.setValueAtTime(baseFreq + cfg.freqIntensityScale * intensity, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * cfg.freqEndRatio, now + Math.max(0.01, attack + 0.05));

    const sustainLevel = Math.max(
      0.0001,
      level * sustainSetting * (cfg.sustainBase + cfg.sustainRange * intensity)
    );

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(sustainLevel, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + attack + release);

    osc.connect(gain);
    gain.connect(this.masterGain ?? ctx.destination);
    osc.start(now);
    osc.stop(now + attack + release + 0.05);

    this.sources.push(osc);
    osc.onended = () => {
      this.sources = this.sources.filter((s) => s !== osc);
    };
  }

  stopAll() {
    this.sources.forEach((osc) => {
      try {
        osc.stop();
      } catch {}
    });
    this.sources = [];
  }

  playCueHit(intensity: number) {
    this.playEvent('cue', intensity);
  }

  playBallCollision(intensity: number) {
    this.playEvent('ball', intensity);
  }

  playRailHit(intensity: number) {
    this.playEvent('rail', intensity);
  }

  playPocketDrop(intensity: number) {
    this.playEvent('pocket', intensity);
  }
}
