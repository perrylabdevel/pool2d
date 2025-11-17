# ElevenLabs Sound Effect Prompts for Pool Game

## Instructions

1. Go to: https://elevenlabs.io/sound-effects
2. Copy each prompt below
3. Generate the sound effect
4. Download the audio file
5. Rename to the specified filename
6. Save to `src/assets/audio/`

---

## Ball Collision Sounds (3 files)

### 1. ball-collision-light.wav

**Prompt:**
```
A gentle tap between two billiard balls made of hard phenolic resin, light contact with a soft clack sound, very short duration around 100 milliseconds, clean and dry with no reverb, medium pitch around 200-300 Hz, realistic pool table sound, close microphone perspective
```

**Settings:**
- Duration: Very short (0.1-0.15 seconds)
- Keep it dry and clean

---

### 2. ball-collision-medium.wav

**Prompt:**
```
Two solid billiard balls colliding with moderate force on a pool table, sharp clack sound with clear attack transient, phenolic resin balls making contact, crisp and punchy impact around 150 milliseconds long, medium-high pitch 250-400 Hz, professional pool hall quality, close mic'd with no room ambience, realistic hard sphere collision
```

**Settings:**
- Duration: Short (0.15-0.20 seconds)
- Should sound sharper and louder than light version

---

### 3. ball-collision-hard.wav

**Prompt:**
```
Powerful collision of two billiard balls at high speed, loud sharp crack sound with aggressive attack, hard phenolic resin impact with bright high-frequency content, intense and punchy break shot quality, duration around 200 milliseconds, pitch range 300-500 Hz with harmonic overtones, professional tournament pool table sound, close perspective with crystal clear detail, maximum impact without distortion
```

**Settings:**
- Duration: Short (0.18-0.25 seconds)
- This should be the loudest and most aggressive

---

## Cue Hit Sounds (2 files)

### 4. cue-hit-1.wav

**Prompt:**
```
Pool cue tip striking the white cue ball with leather tip contact, medium power stroke with clean strike, combination of the leather slap on phenolic resin and the ball's resonant response, short percussive sound around 200 milliseconds, low-mid frequency 80-150 Hz with subtle high-frequency click at impact moment, dry studio quality recording from close range, realistic billiard shot sound
```

**Settings:**
- Duration: Short (0.20-0.25 seconds)
- Should have both the "thwack" of contact and brief ball ring

---

### 5. cue-hit-2.wav

**Prompt:**
```
Billiard cue stick hitting cue ball with firm contact, leather tip making solid impact on hard resin ball, clean striking sound with slight variation from first version, percussive attack with tonal decay around 220 milliseconds, fundamental frequency 85-160 Hz with subtle harmonic content, close microphone placement with no reverb, professional pool shot from different angle, dry and punchy
```

**Settings:**
- Duration: Short (0.22-0.28 seconds)
- Similar to cue-hit-1 but slightly different character

---

## Rail Hit Sounds (2 files)

### 6. rail-hit-1.wav

**Prompt:**
```
Pool ball bouncing off rubber cushion rail with moderate speed, dull thud sound with quick damping, rubber absorbing impact energy, less tonal and more percussive than ball-to-ball collision, duration around 150 milliseconds, low-mid frequency 150-250 Hz with muted high end, realistic dampened bounce on pool table rail, close dry recording without echo
```

**Settings:**
- Duration: Short (0.15-0.20 seconds)
- Should sound "thuddy" and dampened, not ringing

---

### 7. rail-hit-2.wav

**Prompt:**
```
Billiard ball impacting pool table cushion at medium velocity, rubber rail absorbing the hit with soft bounce back, muffled percussive sound with minimal resonance, brief duration about 140 milliseconds, frequency range 160-280 Hz, less bright than ball collisions due to rubber damping, realistic cushion bounce with natural texture, studio quality dry recording, slight variation from first rail hit
```

**Settings:**
- Duration: Short (0.14-0.18 seconds)
- Similar to rail-hit-1 but slightly different impact

---

## Pocket Drop Sound (1 file)

### 8. pocket-drop.wav

**Prompt:**
```
Pool ball dropping into leather pocket with rolling settle, ball falling and making contact with pocket leather lining then coming to rest, multi-stage sound with initial drop impact followed by brief settling movement, total duration around 400 milliseconds, low frequency thud 60-120 Hz for main impact with subtle high frequency details, muffled and dampened by leather material, realistic pool table pocket sound with natural decay, close perspective dry recording
```

**Settings:**
- Duration: Medium (0.35-0.45 seconds)
- Should have the "drop" and "settle" phases
- Softer/muffled quality due to leather pocket

---

## General Tips for ElevenLabs Generation

### Best Practices:

1. **Generate Multiple Variations**
   - Create 2-3 versions of each sound
   - Pick the most realistic one
   - Keep alternatives as backups

2. **Quality Settings**
   - Use highest quality available
   - Download in WAV format if offered
   - If only MP3, use highest bitrate

3. **Duration Adjustments**
   - If sounds are too long, you can trim them
   - Don't make them shorter than suggested
   - Ball collisions: Keep under 0.3 seconds
   - Cue hits: Keep under 0.3 seconds
   - Rail hits: Keep under 0.25 seconds
   - Pocket drop: Can be up to 0.5 seconds

4. **Volume Normalization**
   - All sounds should be roughly similar peak volume
   - Don't worry about exact matching - the game normalizes
   - Avoid clipping/distortion

5. **Dry vs. Wet**
   - Request "dry" or "no reverb" for all sounds
   - We want close mic'd, clean sounds
   - Room ambience will be added by game if needed later

6. **Iteration**
   - If a sound doesn't feel right, try again
   - Adjust the prompt slightly:
     - Add "more percussive" or "less tonal"
     - Specify "brighter" or "darker"
     - Mention "shorter attack" or "longer decay"

---

## Alternative Prompt Styles (If Above Don't Work Well)

### Simpler Versions:

If the detailed prompts produce inconsistent results, try these simpler versions:

**Ball Collision Light:**
```
Soft billiard ball collision, gentle tap, short clean sound
```

**Ball Collision Medium:**
```
Two pool balls hitting each other with moderate force, crisp clack
```

**Ball Collision Hard:**
```
Loud pool ball break shot, powerful impact, sharp crack sound
```

**Cue Hit:**
```
Pool cue striking cue ball, leather tip on hard ball, clean hit
```

**Rail Hit:**
```
Pool ball bouncing off cushion rail, dampened thud on rubber
```

**Pocket Drop:**
```
Billiard ball falling into leather pocket and settling
```

---

## After Generation Checklist

For each sound file, verify:

- ✅ **Duration appropriate** (ball hits: 0.1-0.25s, pocket: 0.3-0.5s)
- ✅ **No reverb/echo** (should be dry)
- ✅ **Clean recording** (no background noise)
- ✅ **Realistic timbre** (sounds like actual pool balls/materials)
- ✅ **Good peak volume** (loud but not clipping)
- ✅ **Natural decay** (fades naturally, not cut off)

---

## Filename Mapping

Save generated files as:

| ElevenLabs Generation | Save As |
|----------------------|---------|
| Ball Collision Light | `ball-collision-light.wav` |
| Ball Collision Medium | `ball-collision-medium.wav` |
| Ball Collision Hard | `ball-collision-hard.wav` |
| Cue Hit 1 | `cue-hit-1.wav` |
| Cue Hit 2 | `cue-hit-2.wav` |
| Rail Hit 1 | `rail-hit-1.wav` |
| Rail Hit 2 | `rail-hit-2.wav` |
| Pocket Drop | `pocket-drop.wav` |

All files go in: `src/assets/audio/`

---

## After Adding Files

1. **Rebuild the project:**
   ```bash
   npm run build
   ```

2. **Test in browser:**
   ```bash
   npm run dev
   ```

3. **Listen and adjust:**
   - If any sound doesn't feel right, regenerate it
   - Try slight prompt variations
   - Can mix and match from multiple generations

---

## Estimated Time

- Generating all 8 sounds: **10-15 minutes**
- Testing and adjusting: **5-10 minutes**
- **Total: 15-25 minutes** for professional quality pool sounds

Good luck! These prompts should produce excellent realistic pool sounds with ElevenLabs.
