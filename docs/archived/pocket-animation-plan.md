# Pocket Capture Animation – Tuning Guide

Pocket animations now ship in both the 3D renderer and legacy 2D fallback. This guide documents the data flow, config hooks, and troubleshooting steps so you can tweak the drop/roll behavior without digging through the entire codebase.

## Data Flow

1. **Physics → Game**
   - `PhysicsWorld.onBallPocketed` (in `src/physics/Physics.ts`) fires whenever a ball crosses the capture radius.
   - `Game.handleBallPocketed` assembles a `PocketAnimationEvent` containing ball id, world-space position, pocket center, and exit velocity.
   - Events are pushed onto `this.pocketAnimationEvents` (bounded queue).
2. **Game → Renderer**
   - Each frame, `Game` forwards events to the active renderer via `renderer.queuePocketAnimation(event)`.
3. **Renderer queue**
   - `Renderer3D.queuePocketAnimation` stores events in `queuedPocketEvents`, processed in `processPocketAnimationQueue()`.
   - Each event spawns a `PocketDropAnimation` struct with `startTime` and total duration = drop + roll.
   - `drawPocketAnimations()` runs every frame, lerping ball sprites between `event.position` (capture) and `event.pocket` (center) while simulating the roll under felt.
4. **Legacy Renderer**
   - `src/render/Renderer.ts` implements the same queue to keep debug/2D mode consistent.

## Config Knobs (`src/config.ts`)

| Config Key | Default | Description |
| --- | --- | --- |
| `POCKET_ANIMATION_DROP_DURATION_MS` | `300` | Time spent descending from capture position to pocket throat |
| `POCKET_ANIMATION_ROLL_DURATION_MS` | `500` | Time rolling under felt toward table center |
| `POCKET_ANIMATION_DROP_DEPTH` | `0.8` | World inches used when computing the visual vertical offset (affects shading only) |
| `POCKET_ANIMATION_UNDERFELT_PX` | `10` | Screen-space distance used to offset the under-felt roll |

Changing these values triggers the animation math immediately—no restart required. Use the Settings panel (Render → Pocket Animations) if exposed, otherwise edit `config.ts` and reload.

## How to Tune

1. **Slow-mo Validation**
   - Enable the debug overlay (`Shift + D`) and reduce `CONFIG.PHYSICS_DT` multiplier (Settings panel → Slow Motion) to watch drop curves frame by frame.
2. **Match Real Tables**
   - Increase `POCKET_ANIMATION_DROP_DURATION_MS` for deep buckets; reduce for “snap” pockets.
   - Adjust `POCKET_ANIMATION_UNDERFELT_PX` to control how far balls appear to roll underneath before disappearing.
3. **Sync With Audio**
   - Pocket SFX fire when the physics event happens. If you lengthen the drop dramatically, consider offsetting the Audio Mixer cue by a few ms (future enhancement: add `CONFIG.POCKET_AUDIO_DELAY_MS`).
4. **Performance Watch-outs**
   - The renderer caps `pocketAnimationEvents` at 48 entries. If you see warnings about dropped events, reduce durations or clear the queue after large multi-ball shots.

## Troubleshooting

- **Animation never plays** – ensure `Game` is calling `renderer.queuePocketAnimation`. Custom renderers must expose that method.
- **Sprites misaligned with pockets** – verify `Renderer3D.worldToScreen()` uses the current scale/offset (check `renderer:resized` event wiring).
- **Animation lingers indefinitely** – `POCKET_ANIMATION_DROP_DURATION_MS + POCKET_ANIMATION_ROLL_DURATION_MS` should be > 0; renderer clamps progress to `[0,1]`. Confirm `performance.now()` monotonicity (dev tools paused timelines can stretch animations).
- **Too many overlapping sprites** – reduce durations or clip `pocketAnimationEvents` (Game already keeps the last 48 entries). For high-speed capture tests, temporarily disable the queue via renderer flag.

## Future Ideas (optional)

- **Velocity-aware easing** – Map entry speed to drop depth or roll distance.
- **Pocket-type themes** – Use different easing/lighting for corner vs. side pockets.
- **Audio hooks** – Delay or layer pocket thuds based on drop duration (requires AudioManager API addition).
- **Capture damping** – Expose `POCKET_CAPTURE_DAMPING` in `config.ts` so physics can slow fast movers before the animation starts.

For the related rules UX and shot-weight cues, see `docs/rules/eight-ball-rules.md` and `docs/audio/audio-status.md`.
