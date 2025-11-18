# Audio Setup Guide

## Overview

The audio system has been converted from **synthesized sounds** to **sample-based audio** for realistic pool ball sounds.

## Current Status

✅ **Implemented:** Sample-based AudioManager
✅ **Build:** Project compiles successfully
⚠️ **Audio Files:** Need to be downloaded and added

## How the New System Works

### Architecture
- **Sample-based playback** using Web Audio API `AudioBufferSourceNode`
- **Intensity-based sample selection** - automatically picks light/medium/hard samples
- **Randomization** - pitch variation (±5-10%) and volume variation (±8-10%)
- **Multiple sample variations** to avoid repetition
- **Graceful degradation** - continues to work if some samples are missing

### Sound Types
1. **Ball Collisions** - 3 samples (light, medium, hard) selected by intensity
2. **Cue Hits** - 2 samples (random selection)
3. **Rail Hits** - 2 samples (random selection)
4. **Pocket Drops** - 1 sample
5. **Background Ambience** - 1 looping "room tone" track
6. **Music Track** - 1 looping music bed

### Mixer Controls
Open the **Audio Mixer** panel from the HUD to tailor the mix:
- **Master** and **per-event sliders** (Cue, Ball, Rail, Pocket) still control gain
- New **Music & Ambience** section
  - **Music Track** controls the looping music bed level (with preview + mute)
  - **Background Loop** controls the room tone / ambience level (with preview + mute)
- New **per-row mute icons** for each mixer row (Master, Music, Background, Cue, Ball, Rail, Pocket)
- New **Quiet Room** section
  - **High-Cut Dampening** sweeps a low-pass filter to tame harsh highs
  - **Soft Compression** adds gentle limiting so big shots do not overpower quieter sounds

All sliders persist via the settings manager, so your preferred mix loads automatically.

## Setup Instructions

### Step 1: Download Audio Files

Visit: **https://directory.audio/collection/77-billiard-sounds**

Download these **8 audio files** (WAV format preferred):

#### Ball Collisions (3 files)
1. Find "Pool balls hitting" or similar **light** impact → save as `ball-collision-light.wav`
2. Find "Pool ball contact" **medium** impact → save as `ball-collision-medium.wav`
3. Find "Pool break" or **hard** impact → save as `ball-collision-hard.wav`

#### Cue Hits (2 files)
4. Find "Pool cue hitting ball" variation 1 → save as `cue-hit-1.wav`
5. Find "Cue strike" variation 2 → save as `cue-hit-2.wav`

#### Rail Hits (2 files)
6. Find "Ball hitting cushion" variation 1 → save as `rail-hit-1.wav`
7. Find "Cushion impact" variation 2 → save as `rail-hit-2.wav`

#### Pocket Drops (1 file)
8. Find "Ball falling into pocket" → save as `pocket-drop.wav`

**💡 Tips:**
- Download **WAV format** for best quality
- Look for **44.1kHz or 48kHz** sample rate
- Rename files to match the exact names above

### Step 2: Add Files to Project

Place all 8 audio files in:
```
src/assets/audio/
```

Your directory should look like:
```
src/assets/audio/
├── ball-collision-light.wav
├── ball-collision-medium.wav
├── ball-collision-hard.wav
├── cue-hit-1.wav
├── cue-hit-2.wav
├── rail-hit-1.wav
├── rail-hit-2.wav
└── pocket-drop.wav
```

### Step 3: Rebuild

```bash
npm run build
```

### Step 4: Test

1. Start the dev server: `npm run dev`
2. Open the game
3. Test sounds:
   - **Cue hit** - Take a shot
   - **Ball collision** - Watch balls collide
   - **Rail hit** - Hit cushions
   - **Pocket drop** - Sink a ball

## Sound Characteristics

### Ball Collisions
- **Light** (intensity 0.0-0.33): Gentle taps, slow-moving collisions
- **Medium** (intensity 0.33-0.66): Normal gameplay collisions
- **Hard** (intensity 0.66-1.0): Break shots, high-speed impacts

Each playback has:
- **±5% pitch variation** (prevents repetition)
- **±10% volume variation** (natural dynamics)

### Cue Hits
- **Random sample selection** from 2 variations
- **±3% pitch variation** (subtle)
- **±8% volume variation**

### Rail Hits
- **Random sample selection** from 2 variations
- **±6% pitch variation** (moderate)
- **±10% volume variation**

### Pocket Drops
- **Single sample** with variation
- **±4% pitch variation**
- **±8% volume variation**

## License Information

All sounds from **directory.audio** are licensed under:
- **Creative Commons Zero (CC0)**
- No attribution required
- Free for commercial and non-commercial use

## Troubleshooting

### "Failed to load audio sample" warnings in console

**Problem:** Audio files are missing or paths are incorrect

**Solution:**
1. Check that all 8 WAV files are in `src/assets/audio/`
2. Verify filenames match exactly (case-sensitive)
3. Ensure files are valid WAV or MP3 format

### No sound during gameplay

**Problem:** Audio context not unlocked or samples not loaded

**Solution:**
1. Click anywhere on the page to unlock audio (browser requirement)
2. Check browser console for loading errors
3. Verify audio files loaded successfully (should see "All audio samples loaded successfully")

### Sounds play but are distorted

**Problem:** Sample rate mismatch or file corruption

**Solution:**
1. Re-download audio files in WAV format
2. Use 44.1kHz or 48kHz sample rate
3. Check files play correctly in a media player

## Technical Details

### File Loading
- Audio files are loaded via `fetch()` on first user interaction
- Files are decoded into `AudioBuffer` objects
- Buffers are cached for the session (no reload needed)

### Playback
- Each sound creates a new `AudioBufferSourceNode`
- Pitch variation via `playbackRate` property
- Volume control via `GainNode`
- Automatic cleanup after playback finishes
- Signals route through a shared low-pass filter and soft compressor before reaching the master gain, matching the Quiet Room controls

### Performance
- ~8 files × ~50KB each = **~400KB total** (estimate)
- All samples loaded into memory (efficient)
- No disk I/O during gameplay
- Minimal CPU usage (native Web Audio API)
- Optional dampening/compression nodes add negligible overhead but dramatically improve the “quiet room” feel

## Future Enhancements (Optional)

### Potential Improvements:
1. **More variations** - Add 5-10 samples per type for even more variety
2. **Stereo panning** - Position sounds based on ball location (left/right)
3. **Room reverb** - Add subtle reverb for pool hall ambience
4. **Rolling sounds** - Continuous quiet sound when balls are moving
5. **Different ball materials** - Aramith vs. phenolic resin options
6. **Impulse responses** - Swap the Quiet Room low-pass/compressor for convolution reverb presets when a fuller hall ambience is desired

## Code Reference

- **AudioManager**: `src/sound/AudioManager.ts`
- **Settings integration**: Volume controls work automatically
- **Game triggers**: `src/game/Game.ts` lines 1206-1223

---

**Questions?** Check the README.md in `src/assets/audio/` for quick reference.
