/**
 * Generate simple placeholder audio files for testing
 * These are very basic synthesized sounds - replace with real recordings for production
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple WAV file generator
function generateWAV(frequency, duration, intensity) {
  const sampleRate = 44100;
  const numSamples = Math.floor(sampleRate * duration);
  const channels = 1;
  const bitsPerSample = 16;

  // Calculate sizes
  const dataSize = numSamples * channels * (bitsPerSample / 8);
  const fileSize = 44 + dataSize;

  // Create buffer
  const buffer = Buffer.alloc(fileSize);

  // Write WAV header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(fileSize - 8, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // fmt chunk size
  buffer.writeUInt16LE(1, 20); // audio format (PCM)
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * (bitsPerSample / 8), 28); // byte rate
  buffer.writeUInt16LE(channels * (bitsPerSample / 8), 32); // block align
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Generate samples
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;

    // Simple decaying sine wave with some harmonics
    const envelope = Math.exp(-t * 8); // Decay
    const fundamental = Math.sin(2 * Math.PI * frequency * t);
    const harmonic2 = Math.sin(2 * Math.PI * frequency * 2.3 * t) * 0.3;
    const harmonic3 = Math.sin(2 * Math.PI * frequency * 3.7 * t) * 0.15;

    // Add some noise for realism
    const noise = (Math.random() - 0.5) * 0.1;

    let sample = (fundamental + harmonic2 + harmonic3 + noise) * envelope * intensity;

    // Convert to 16-bit integer
    sample = Math.max(-1, Math.min(1, sample));
    const intSample = Math.floor(sample * 32767);

    buffer.writeInt16LE(intSample, offset);
    offset += 2;
  }

  return buffer;
}

// Create audio directory if it doesn't exist
const audioDir = path.join(__dirname, '..', 'src', 'assets', 'audio');
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
}

console.log('Generating placeholder audio files...\n');

// Generate ball collision sounds
console.log('Creating ball collision sounds...');
fs.writeFileSync(
  path.join(audioDir, 'ball-collision-light.wav'),
  generateWAV(180, 0.12, 0.4)
);
console.log('  ✓ ball-collision-light.wav');

fs.writeFileSync(
  path.join(audioDir, 'ball-collision-medium.wav'),
  generateWAV(220, 0.15, 0.6)
);
console.log('  ✓ ball-collision-medium.wav');

fs.writeFileSync(
  path.join(audioDir, 'ball-collision-hard.wav'),
  generateWAV(280, 0.18, 0.8)
);
console.log('  ✓ ball-collision-hard.wav');

// Generate cue hit sounds
console.log('\nCreating cue hit sounds...');
fs.writeFileSync(
  path.join(audioDir, 'cue-hit-1.wav'),
  generateWAV(90, 0.22, 0.7)
);
console.log('  ✓ cue-hit-1.wav');

fs.writeFileSync(
  path.join(audioDir, 'cue-hit-2.wav'),
  generateWAV(95, 0.24, 0.7)
);
console.log('  ✓ cue-hit-2.wav');

// Generate rail hit sounds
console.log('\nCreating rail hit sounds...');
fs.writeFileSync(
  path.join(audioDir, 'rail-hit-1.wav'),
  generateWAV(160, 0.18, 0.5)
);
console.log('  ✓ rail-hit-1.wav');

fs.writeFileSync(
  path.join(audioDir, 'rail-hit-2.wav'),
  generateWAV(170, 0.16, 0.5)
);
console.log('  ✓ rail-hit-2.wav');

// Generate pocket drop sound
console.log('\nCreating pocket drop sound...');
fs.writeFileSync(
  path.join(audioDir, 'pocket-drop.wav'),
  generateWAV(80, 0.35, 0.6)
);
console.log('  ✓ pocket-drop.wav');

console.log('\n✅ All placeholder audio files generated successfully!');
console.log('\n⚠️  IMPORTANT: These are basic synthesized placeholders.');
console.log('   For realistic sounds, download real pool ball recordings from:');
console.log('   - https://directory.audio/collection/77-billiard-sounds');
console.log('   - https://freesound.org (search "pool" or "billiards")');
console.log('   - https://www.videvo.net/royalty-free-sound-effects/billiards/');
console.log('\n   Replace the files in src/assets/audio/ with real recordings.');
