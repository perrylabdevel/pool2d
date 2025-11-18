import { DEFAULT_AUDIO_SETTINGS, type AudioSettings } from '../ui/SettingsManager';

// Audio file paths - will be loaded dynamically
const AUDIO_PATHS = {
  ballCollisionLight: new URL('../assets/audio/ball-collision-light.wav', import.meta.url).href,
  ballCollisionMedium: new URL('../assets/audio/ball-collision-medium.wav', import.meta.url).href,
  ballCollisionHard: new URL('../assets/audio/ball-collision-hard.wav', import.meta.url).href,
  cueHit1: new URL('../assets/audio/cue-hit-1.wav', import.meta.url).href,
  cueHit2: new URL('../assets/audio/cue-hit-2.wav', import.meta.url).href,
  railHit1: new URL('../assets/audio/rail-hit-1.wav', import.meta.url).href,
  railHit2: new URL('../assets/audio/rail-hit-2.wav', import.meta.url).href,
  pocketDrop: new URL('../assets/audio/pocket-drop.wav', import.meta.url).href,
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
  private settings: AudioSettings = { ...DEFAULT_AUDIO_SETTINGS };
  private loadingPromises: Promise<void>[] = [];
  private isLoaded = false;
  private lastPlayTime: Record<string, number> = {}; // Prevent sound spam
  private activeSources: AudioBufferSourceNode[] = []; // Track active sounds for limiting

  // Sample banks for each sound type
  private sampleSets: Record<string, SampleSet> = {
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

  private updateProcessingChain() {
    if (!this.ctx) return;

    if (this.masterGain) {
      this.masterGain.gain.value = this.settings.master;
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

    // Load samples if not already loaded
    if (!this.isLoaded && this.loadingPromises.length === 0) {
      await this.loadSamples();
    }
  }

  setSettings(settings: AudioSettings) {
    this.settings = { ...settings };
    this.updateProcessingChain();
  }

  /**
   * Play an audio sample with variations
   */
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

    const volume = this.settings[sampleSet.volumeKey] as number;
    if (volume <= 0) return;

    // Prevent sound spam - throttle rapid repeated sounds
    const ctx = this.audioContext;
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

    // Play sound
    source.start(now);

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
