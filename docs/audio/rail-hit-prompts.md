# Improved Rail/Cushion Hit Prompts for ElevenLabs

The rail/cushion hit is one of the trickiest pool sounds to get right. Here are multiple approaches to try:

---

## Approach 1: Focus on "Thud" Character

### rail-hit-1.wav
```
Dull rubber thud sound, billiard ball bouncing off soft cushion, muted impact with no ring or resonance, quick dampened bounce, very short 120 millisecond duration, low frequency around 180 Hz, sounds like hitting a rubber gym mat, no echo or reverb, close dry recording
```

### rail-hit-2.wav
```
Pool table cushion bounce, soft percussive thump on rubber padding, dampened ball rebound with dead sound, brief muffled impact around 100 milliseconds, bass-heavy around 160-200 Hz with quick decay, similar to tapping a car tire, dry studio quality, no sustain
```

---

## Approach 2: Describe the Material Physics

### rail-hit-1.wav
```
Hard phenolic ball hitting soft rubber rail cushion, energy-absorbing bounce with minimal rebound sound, cushioned impact that kills resonance immediately, duration 130 milliseconds, frequencies mostly below 250 Hz, think dense foam or thick rubber absorbing shock, completely dry recording with fast decay
```

### rail-hit-2.wav
```
Billiard ball impacting vulcanized rubber bumper, soft plop sound with immediate damping, no bell tone or ring just dead bounce, very brief around 110 milliseconds, dominated by low-mid frequencies 150-220 Hz, comparable to dropping ball on thick rubber mat, close mic perspective without reverb
```

---

## Approach 3: Use Comparison Sounds

### rail-hit-1.wav
```
Sound like a heavy marble hitting a thick rubber yoga mat, quick dull bounce with no sustain, muted percussive thud around 140 milliseconds long, mostly low frequency content below 200 Hz, completely dead with zero resonance, dry close recording
```

### rail-hit-2.wav
```
Similar to tapping knuckles on a car tire, soft rubber absorbing billiard ball impact, brief dampened knock lasting 120 milliseconds, low-mid frequencies 170-240 Hz, no ringing or echo just quick thud and stop, studio quality dry sound
```

---

## Approach 4: Simplify and Focus on "Dead Bounce"

### rail-hit-1.wav
```
Dead rubber bounce, pool ball on cushion, brief dull thud, no resonance, very short
```

### rail-hit-2.wav
```
Muffled cushion impact, dampened bounce, soft rubber absorbing energy, quick thump
```

---

## Approach 5: Emphasize What It's NOT

### rail-hit-1.wav
```
Pool cushion impact - NOT a bright clack sound, NOT tonal, NOT ringing - instead a quick soft thud on rubber, very dampened and dead, brief duration around 130 milliseconds, low pitch around 180 Hz, sounds muffled and percussive like hitting dense foam, dry recording
```

### rail-hit-2.wav
```
Billiard ball on rubber rail - avoid any bell-like tone or sustain, should sound dead and thumpy, brief muted bounce lasting 120 milliseconds, mostly low frequencies below 250 Hz, think heavy object on soft rubber gym flooring, no reverb completely dry
```

---

## Approach 6: Use Negative Space Description

### rail-hit-1.wav
```
A sound that immediately stops after impact, billiard ball cushion bounce where the rubber absorbs all the ring and resonance, extremely short decay time under 140 milliseconds, dull thudding quality around 170-190 Hz, similar to sound-dampening material being hit, close dry recording with zero sustain
```

### rail-hit-2.wav
```
Pool table rail hit where all the high frequencies are absorbed by rubber, only low thump remains, brief dead bounce around 110 milliseconds, frequency centered on 160-200 Hz with rolled-off highs, like hitting acoustic foam or dense rubber padding, dry studio recording with immediate cutoff
```

---

## Approach 7: Reference Real-World Sounds

### rail-hit-1.wav
```
Wooden ball hitting bicycle inner tube stretched tight, soft rubber bounce with immediate damping, brief thud around 125 milliseconds, low-mid frequency 175-210 Hz, dead sound with zero ring, dry close microphone
```

### rail-hit-2.wav
```
Heavy marble dropped on thick rubber mouse pad, muted impact with quick energy absorption, duration 115 milliseconds, mostly frequencies below 230 Hz, completely non-resonant like sound-proofing material, studio dry recording
```

---

## Approach 8: Onomatopoeia-Based

### rail-hit-1.wav
```
"Pok" sound - not "clack" or "ping", soft "pok" of ball on rubber cushion, very brief around 130 milliseconds, low pitched thud-like quality, heavily dampened with no sustain, dry recording
```

### rail-hit-2.wav
```
"Puhf" or soft "bonk" sound, muffled rubber bounce, brief dead impact 120 milliseconds, low frequency percussive thump, zero resonance or ring, close dry microphone
```

---

## Tips for Getting It Right

### Listen For These Qualities:
- ✅ **Soft/muffled** - not bright or sharp
- ✅ **Dead/dampened** - stops immediately, no sustain
- ✅ **Thuddy** - low frequency, not tonal
- ✅ **Brief** - 100-150 milliseconds max
- ✅ **Non-resonant** - no bell tone or ring

### Red Flags (Regenerate if you hear):
- ❌ Bright "clack" or "click" sound
- ❌ Ringing or sustained tone
- ❌ High frequency content
- ❌ Sounds like ball-to-ball collision
- ❌ Long decay or echo

### Alternative Strategy:
If ElevenLabs keeps producing bright sounds, try:

1. **Generate a ball collision sound**
2. **Then ask for:** "Make this sound much duller, remove all high frequencies, make it sound muffled and dampened"
3. **Or:** Use audio editing software to apply heavy low-pass filter (cut everything above 300 Hz)

### Manual Editing Approach:
If you can't get good results from ElevenLabs:

1. Take any rail hit sound you generated
2. Open in Audacity (free) or similar
3. Apply these effects:
   - **Low-pass filter** at 250-300 Hz (removes brightness)
   - **Truncate silence** to shorten duration
   - **Fade out** very quickly (40-60ms)
   - **Reduce volume** by 3-6 dB

---

## Reference Sounds to Find Elsewhere

If ElevenLabs struggles, search these on freesound.org:

- "rubber bounce"
- "foam impact"
- "deadened thud"
- "muted drum"
- "rubber ball soft"
- "cushion impact"

Then filter/edit to shorten duration and remove highs.

---

## My Recommendation: Start Here

Try **Approach 3 (Comparison Sounds)** first - it gives ElevenLabs concrete real-world references:

### Best First Attempts:

**rail-hit-1.wav:**
```
Sound like a heavy marble hitting a thick rubber yoga mat, quick dull bounce with no sustain, muted percussive thud around 140 milliseconds long, mostly low frequency content below 200 Hz, completely dead with zero resonance, dry close recording
```

**rail-hit-2.wav:**
```
Similar to tapping knuckles on a car tire, soft rubber absorbing billiard ball impact, brief dampened knock lasting 120 milliseconds, low-mid frequencies 170-240 Hz, no ringing or echo just quick thud and stop, studio quality dry sound
```

---

## Quick Comparison Test

Once you generate a rail hit, ask yourself:

**Does it sound more like:**
- ✅ Tapping on a car tire → Good!
- ✅ Dropping a marble on a rubber mat → Good!
- ✅ A "pok" or "bonk" → Good!
- ❌ Billiard balls colliding → Too bright, try again
- ❌ A "clack" or "click" → Too sharp, try again
- ❌ A drum or woodblock → Too tonal, try again

---

Good luck! Rail hits are definitely the hardest pool sound to nail. Don't be afraid to generate 5-10 variations and pick the best ones.
