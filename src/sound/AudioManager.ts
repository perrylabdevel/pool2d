import { DEFAULT_AUDIO_SETTINGS, type AudioSettings } from '../ui/SettingsManager';
import { physicsRecorder } from '../debug/PhysicsRecorder';

// Audio file paths - will be loaded dynamically
const AUDIO_PATHS = {
  backgroundLoop: new URL('../assets/audio/background-loop.m4a', import.meta.url).href,
  musicTrack: new URL('../assets/audio/music-track.m4a', import.meta.url).href,
  ballCollisionLight: new URL('../assets/audio/ball-collision-light.m4a', import.meta.url).href,
  ballCollisionMedium: new URL('../assets/audio/ball-collision-medium.m4a', import.meta.url).href,
  ballCollisionHard: new URL('../assets/audio/ball-collision-hard.m4a', import.meta.url).href,
  cueHit1: new URL('../assets/audio/cue-hit-1.m4a', import.meta.url).href,
  cueHit2: new URL('../assets/audio/cue-hit-2.m4a', import.meta.url).href,
  railHit1: new URL('../assets/audio/rail-hit-1.m4a', import.meta.url).href,
  railHit2: new URL('../assets/audio/rail-hit-2.m4a', import.meta.url).href,
  pocketDrop: new URL('../assets/audio/pocket-drop.m4a', import.meta.url).href,
};

type AudioSample = {
  buffer: AudioBuffer | null;
  url: string;
};

type SampleSet = {
  samples: AudioSample[];
  volumeKey: keyof AudioSettings;
};

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private backgroundGain: GainNode | null = null;
  private backgroundSource: AudioBufferSourceNode | null = null;
  private backgroundBuffer: AudioBuffer | null = null;
  private musicGain: GainNode | null = null;
  private musicSource: AudioBufferSourceNode | null = null;
  private musicBuffer: AudioBuffer | null = null;
  private settings: AudioSettings = { ...DEFAULT_AUDIO_SETTINGS };
  private loadingPromises: Promise<void>[] = [];
  private isLoaded = false;
  private lastPlayTime: Record<string, number> = {}; // Prevent sound spam
  private activeSources: AudioBufferSourceNode[] = []; // Track active sounds for limiting

  // Sample banks for each sound type
  private sampleSets: Record<string, SampleSet> = {
    background: {
      samples: [{ buffer: null, url: AUDIO_PATHS.backgroundLoop }],
      volumeKey: 'background',
    },
    music: {
      samples: [{ buffer: null, url: AUDIO_PATHS.musicTrack }],
      volumeKey: 'music',
    },
    ballCollision: {
      samples: [
        { buffer: null, url: AUDIO_PATHS.ballCollisionLight },
        { buffer: null, url: AUDIO_PATHS.ballCollisionMedium },
        { buffer: null, url: AUDIO_PATHS.ballCollisionHard },
      ],
      volumeKey: 'ballCollisions',
    },
    cueHit: {
      samples: [
        { buffer: null, url: AUDIO_PATHS.cueHit1 },
        { buffer: null, url: AUDIO_PATHS.cueHit2 },
      ],
      volumeKey: 'cueHits',
    },
    railHit: {
      samples: [
        { buffer: null, url: AUDIO_PATHS.railHit1 },
        { buffer: null, url: AUDIO_PATHS.railHit2 },
      ],
      volumeKey: 'railHits',
    },
    pocketDrop: {
      samples: [{ buffer: null, url: AUDIO_PATHS.pocketDrop }],
      volumeKey: 'pocketDrops',
    },
  };

  private initializeAudioGraph() {
    if (!this.ctx || this.masterGain) return;

    this.masterGain = this.ctx.createGain();
    this.filterNode = this.ctx.createBiquadFilter();
    this.filterNode.type = 'lowpass';
    this.filterNode.Q.value = 0.9;

    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.25;

    this.filterNode.connect(this.compressor);
    this.compressor.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    this.updateProcessingChain();
  }

  private getEffectiveMasterGain(): number {
    const master = this.settings.master ?? DEFAULT_AUDIO_SETTINGS.master;
    return this.settings.muteMaster ? 0 : master;
  }

  private getEventVolume(volumeKey: keyof AudioSettings): number {
    let baseVolume = (this.settings[volumeKey] as number) ?? (DEFAULT_AUDIO_SETTINGS[volumeKey] as number);
    if (typeof baseVolume !== 'number') {
      baseVolume = 0;
    }

    switch (volumeKey) {
      case 'music':
        return this.settings.muteMusic ? 0 : baseVolume;
      case 'cueHits':
        return this.settings.muteCueHits ? 0 : baseVolume;
      case 'ballCollisions':
        return this.settings.muteBallCollisions ? 0 : baseVolume;
      case 'railHits':
        return this.settings.muteRailHits ? 0 : baseVolume;
      case 'pocketDrops':
        return this.settings.mutePocketDrops ? 0 : baseVolume;
      case 'background':
        return this.settings.muteBackground ? 0 : baseVolume;
      default:
        return baseVolume;
    }
  }

  private updateProcessingChain() {
    if (!this.ctx) return;

    if (this.masterGain) {
      this.masterGain.gain.value = this.getEffectiveMasterGain();
    }

    if (this.filterNode) {
      const dampening = this.settings.dampening ?? DEFAULT_AUDIO_SETTINGS.dampening;
      const minFreq = 900;
      const maxFreq = 5200;
      const freq = maxFreq - (maxFreq - minFreq) * dampening;
      this.filterNode.frequency.value = freq;
      this.filterNode.Q.value = 0.7 + dampening * 0.6;
    }

    if (this.compressor) {
      const softness = this.settings.compression ?? DEFAULT_AUDIO_SETTINGS.compression;
      const threshold = -8 - softness * 28; // -8dB (light) to roughly -36dB (heavy)
      const ratio = 1.5 + softness * 5; // 1.5:1 up to ~6.5:1
      const knee = 18 - softness * 10;
      this.compressor.threshold.value = threshold;
      this.compressor.ratio.value = ratio;
      this.compressor.knee.value = knee;
      this.compressor.attack.value = 0.004 + softness * 0.02;
      this.compressor.release.value = 0.12 + softness * 0.2;
    }

    this.updateBackgroundVolume();
    this.updateMusicVolume();
  }

  private get audioContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.initializeAudioGraph();
    }
    return this.ctx;
  }

  /**
   * Load all audio samples
   */
  async loadSamples(): Promise<void> {
    const ctx = this.audioContext;

    for (const setKey in this.sampleSets) {
      const sampleSet = this.sampleSets[setKey];

      for (const sample of sampleSet.samples) {
        const promise = fetch(sample.url)
          .then((response) => response.arrayBuffer())
          .then((arrayBuffer) => ctx.decodeAudioData(arrayBuffer))
          .then((audioBuffer) => {
            sample.buffer = audioBuffer;
          })
          .catch((error) => {
            console.warn(`Failed to load audio sample: ${sample.url}`, error);
            // Continue even if some samples fail to load
          });

        this.loadingPromises.push(promise);
      }
    }

    await Promise.all(this.loadingPromises);
    this.isLoaded = true;
    console.log('All audio samples loaded successfully');

    const backgroundSet = this.sampleSets.background;
    if (backgroundSet && backgroundSet.samples[0]?.buffer) {
      this.backgroundBuffer = backgroundSet.samples[0].buffer;
    }
    const musicSet = this.sampleSets.music;
    if (musicSet && musicSet.samples[0]?.buffer) {
      this.musicBuffer = musicSet.samples[0].buffer;
    }
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

    // Ensure samples are fully loaded before continuing
    if (!this.isLoaded) {
      if (this.loadingPromises.length === 0) {
        // First load
        await this.loadSamples();
      } else {
        // Load already in progress – wait for it
        await Promise.all(this.loadingPromises);
        this.isLoaded = true;
      }
    }
  }

  setSettings(settings: AudioSettings) {
    this.settings = { ...settings };
    this.updateProcessingChain();
  }

  private updateBackgroundVolume() {
    if (!this.backgroundGain) return;
    const volume = this.getEventVolume('background');
    this.backgroundGain.gain.value = Math.max(0, Math.min(1, volume));
  }

  private updateMusicVolume() {
    if (!this.musicGain) return;
    const volume = this.getEventVolume('music');
    this.musicGain.gain.value = Math.max(0, Math.min(1, volume));
  }

  async startBackgroundLoop() {
    await this.ensureUnlocked();

    const ctx = this.audioContext;

    if (!this.backgroundBuffer) {
      const backgroundSet = this.sampleSets.background;
      if (backgroundSet && backgroundSet.samples[0]?.buffer) {
        this.backgroundBuffer = backgroundSet.samples[0].buffer;
      }
    }

    if (!this.backgroundBuffer) {
      console.warn('Background audio buffer not loaded');
      return;
    }

    this.stopBackgroundLoop();

    const source = ctx.createBufferSource();
    source.buffer = this.backgroundBuffer;
    source.loop = true;

    const gainNode = ctx.createGain();
    this.backgroundGain = gainNode;
    this.updateBackgroundVolume();

    // Background ambience bypasses Quiet Room processing (no filter/compression)
    const destination = this.masterGain ?? ctx.destination;
    source.connect(gainNode);
    gainNode.connect(destination);

    source.start();
    this.backgroundSource = source;

    source.onended = () => {
      gainNode.disconnect();
      source.disconnect();
      if (this.backgroundSource === source) {
        this.backgroundSource = null;
        this.backgroundGain = null;
      }
    };
  }

  stopBackgroundLoop() {
    if (this.backgroundSource) {
      try {
        this.backgroundSource.stop();
      } catch (e) {
      }
      this.backgroundSource.disconnect();
      this.backgroundSource = null;
    }
    if (this.backgroundGain) {
      this.backgroundGain.disconnect();
      this.backgroundGain = null;
    }
  }

  async startMusicLoop() {
    await this.ensureUnlocked();

    const ctx = this.audioContext;

    if (!this.musicBuffer) {
      const musicSet = this.sampleSets.music;
      if (musicSet && musicSet.samples[0]?.buffer) {
        this.musicBuffer = musicSet.samples[0].buffer;
      }
    }

    if (!this.musicBuffer) {
      console.warn('Music audio buffer not loaded');
      return;
    }

    this.stopMusicLoop();

    const source = ctx.createBufferSource();
    source.buffer = this.musicBuffer;
    source.loop = true;

    const gainNode = ctx.createGain();
    this.musicGain = gainNode;
    this.updateMusicVolume();

    // Music track bypasses Quiet Room processing (no filter/compression)
    const destination = this.masterGain ?? ctx.destination;
    source.connect(gainNode);
    gainNode.connect(destination);

    source.start();
    this.musicSource = source;

    source.onended = () => {
      gainNode.disconnect();
      source.disconnect();
      if (this.musicSource === source) {
        this.musicSource = null;
        this.musicGain = null;
      }
    };
  }

  stopMusicLoop() {
    if (this.musicSource) {
      try {
        this.musicSource.stop();
      } catch (e) {
      }
      this.musicSource.disconnect();
      this.musicSource = null;
    }
    if (this.musicGain) {
      this.musicGain.disconnect();
      this.musicGain = null;
    }
  }

  /**
   * Play an audio sample with variations
   */
  /**
   * Play a recorded sound by key
   */
  public playRecordedSound(key: string, intensity: number) {
    // Direct access to private playSample
    this.playSample(key, intensity);
  }

  private playSample(
    sampleSetKey: string,
    intensity: number,
    pitchVariation: number = 0.1,
    volumeVariation: number = 0.1,
    minInterval: number = 0.02, // Minimum time between same sound type (20ms)
    useRandomSelection: boolean = false // For sounds with multiple variations but no intensity levels
  ) {
    const sampleSet = this.sampleSets[sampleSetKey];
    if (!sampleSet) return;

    const volume = this.getEventVolume(sampleSet.volumeKey);
    if (volume <= 0) return;

    // Ensure audio context is unlocked and ready
    const ctx = this.audioContext;

    // If context is suspended, try to resume it synchronously if possible
    // Note: resume() returns a promise, but we can't await here
    // The sound will play once context transitions to 'running'
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {
        // Ignore resume errors
      });
      // If still suspended after resume attempt, skip this sound
      // It will work on the next attempt once context is running
      if (ctx.state === 'suspended') {
        return;
      }
    }

    // Check if samples are loaded
    if (!this.isLoaded) {
      return;
    }

    // Prevent sound spam - throttle rapid repeated sounds
    const now = ctx.currentTime;
    const lastTime = this.lastPlayTime[sampleSetKey] || 0;

    if (now - lastTime < minInterval) {
      return; // Skip this sound, too soon after last one
    }
    this.lastPlayTime[sampleSetKey] = now;

    // Limit simultaneous sounds to prevent buildup
    const maxSimultaneous = 6;
    if (this.activeSources.length >= maxSimultaneous) {
      // Stop oldest sound to make room
      const oldest = this.activeSources.shift();
      if (oldest) {
        try {
          oldest.stop();
        } catch (e) {
          // Already stopped, ignore
        }
      }
    }

    // Select sample based on intensity OR randomly
    let sampleIndex: number;
    if (useRandomSelection) {
      // Random selection for variety (cue hits, rail hits)
      sampleIndex = Math.floor(Math.random() * sampleSet.samples.length);
    } else {
      // Intensity-based selection (ball collisions: light/medium/hard)
      sampleIndex = Math.min(
        Math.floor(intensity * sampleSet.samples.length),
        sampleSet.samples.length - 1
      );
    }

    const sample = sampleSet.samples[sampleIndex];
    if (!sample.buffer) {
      console.warn(`Audio buffer not loaded for ${sampleSetKey}[${sampleIndex}]`);
      return;
    }

    // Create audio source
    const source = ctx.createBufferSource();
    source.buffer = sample.buffer;

    // Add pitch variation (playback rate)
    const pitchJitter = 1.0 + (Math.random() - 0.5) * 2 * pitchVariation;
    source.playbackRate.value = pitchJitter;

    // Create gain node for volume control
    const gainNode = ctx.createGain();

    // Calculate final volume with MUCH better scaling
    // Use square root to compress dynamic range - prevents loud sounds from being too loud
    const intensityScaled = Math.sqrt(intensity); // 0.5 intensity becomes 0.707 instead of 0.5
    const volumeJitter = 1.0 + (Math.random() - 0.5) * 2 * volumeVariation;

    // Sound-specific volume adjustment for ball collisions
    const soundTypeMultiplier = sampleSetKey === 'ballCollision' ? 0.45 : 0.6;

    // Final volume: base volume * compressed intensity * small variation
    // Max volume is capped at 0.7 to prevent distortion
    const finalVolume = Math.min(0.7, volume * intensityScaled * volumeJitter * soundTypeMultiplier);
    gainNode.gain.value = Math.max(0, finalVolume);

    // Connect nodes through the quiet-room processing chain
    source.connect(gainNode);
    const destination = this.filterNode ?? this.masterGain ?? ctx.destination;
    gainNode.connect(destination);

    // Play sound immediately (don't use cached 'now' time as it may be stale)
    source.start();

    // Record sound event for playback
    if (sampleSetKey !== 'background' && sampleSetKey !== 'music') {
      physicsRecorder.recordSound(sampleSetKey, intensity);
    }

    // Track active source
    this.activeSources.push(source);

    // Clean up after playback
    source.onended = () => {
      gainNode.disconnect();
      source.disconnect();
      // Remove from active sources
      const index = this.activeSources.indexOf(source);
      if (index > -1) {
        this.activeSources.splice(index, 1);
      }
    };
  }

  stopAll() {
    // Stop all active sounds
    this.activeSources.forEach((source) => {
      try {
        source.stop();
      } catch (e) {
        // Already stopped, ignore
      }
    });
    this.activeSources = [];
    this.lastPlayTime = {};
    this.stopBackgroundLoop();
    this.stopMusicLoop();
  }

  /**
   * Play ball collision sound
   * Intensity-based sample selection with pitch and volume variation
   */
  playBallCollision(intensity: number) {
    // Throttle rapid ball collisions to 30ms intervals
    this.playSample('ballCollision', intensity, 0.05, 0.08, 0.03);
  }

  /**
   * Play cue hit sound
   * Uses intensity for volume, random file selection for variety
   */
  playCueHit(intensity: number) {
    // Use intensity for volume control (cue power)
    // Random file selection for variety between 2 cue hit samples
    this.playSample('cueHit', intensity, 0.03, 0.06, 0.0, true);
  }

  /**
   * Play rail hit sound
   * Uses intensity for volume, random file selection for variety
   */
  playRailHit(intensity: number) {
    // Use intensity for volume control (ball speed at rail impact)
    // Random file selection for variety between 2 rail hit samples
    this.playSample('railHit', intensity, 0.06, 0.08, 0.025, true);
  }

  /**
   * Play pocket drop sound
   * Single sample with subtle variation
   */
  playPocketDrop(intensity: number) {
    // No throttling needed for pocket drops (infrequent)
    this.playSample('pocketDrop', intensity, 0.04, 0.06, 0.0);
  }
}
