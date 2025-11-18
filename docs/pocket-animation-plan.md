# Pocket Capture Enhancements Plan

## Goals
- Animate object balls as they drop into pockets instead of disappearing instantly.
- Investigate whether fast-moving balls require additional physics adjustments at the moment of pocket capture.
- Explore approaches that make shots *feel* heavier/more physical.

## Current Behavior Snapshot
- Pocket capture happens inside `PhysicsWorld.onPocketCapture` / `PocketDetector` (see `src/physics/Physics.ts`).
  - When a ball intersects a pocket capture radius it is flagged `pocketed`, velocity is zeroed, and the ball mesh disappears on the next render.
- Renderers (`Renderer3D.drawBalls` / `Renderer.drawBalls`) simply skip pocketed balls, so there is no exit animation.
- CONFIG already exposes pocket radii, shelf depths, and restitution but nothing for post-capture animation.

## Plan: Pocket Drop Animation
1. **Capture trajectory snapshot**
   - When `PhysicsWorld` decides a ball is pocketed, emit an event that includes the contact position, velocity vector, and timestamp.
   - Create a lightweight queue (e.g., `recentPocketCaptures: Array<{ ballId, pos, vel, time }>` in `Game` or renderer).

2. **Spawn animation instance**
   - Renderer (2D + 3D variants) watches for new captures and instantiates a short-lived animation object per ball.
   - For 3D: create a separate Three.js mesh (or reuse the ball mesh but detach physics updates) and run a keyframed animation:
     - Translate along pocket centerline downwards.
     - Add a small rotation + fade to simulate rolling out of view.
   - For 2D fallback: render an overlay sprite that lerps position toward pocket center while scaling down and fading.

3. **Timing & easing**
   - Uses separate durations for drop and roll phases (configurable via `POCKET_ANIMATION_DROP_DURATION_MS` and `POCKET_ANIMATION_ROLL_DURATION_MS`).
   - **Drop phase**: Ball drops from capture position to pocket center with smoothstep easing.
   - **Roll phase**: Ball rolls from pocket center inward toward table center underneath the felt, only visible through circular pocket opening (clipped).
   - No fade or shrink - ball remains full size and opaque, clipped by pocket geometry for realistic depth perception.

4. **Audio & haptics hooks**
   - Trigger existing pocket SFX (if any) slightly earlier.
   - Layer a low-frequency “thud” (currently synthesized) whose tonality can be tuned via the Audio Mixer panel.
   - Longer term: allow per-pocket samples or randomized pitch offsets.

5. **Cleanup**
   - After animation completes, remove the temporary mesh/sprite and release references to avoid leaks.
   - Config toggles now exist:
     - `POCKET_ANIMATION_DROP_DURATION_MS` (default: 300ms) - duration of drop phase
     - `POCKET_ANIMATION_ROLL_DURATION_MS` (default: 500ms) - duration of roll phase
     - `POCKET_ANIMATION_DROP_DEPTH` - visual drop depth (unused in current implementation)
     - `POCKET_ANIMATION_UNDERFELT_PX` (default: 10px) - distance ball rolls under felt during roll phase

### Implementation Touchpoints
- `src/physics/Physics.ts`: emit pocket events (maybe via `Game` callback `onBallPocketed`).
- `src/game/Game.ts`: store animation queue and pass to renderers every frame.
- `src/render/Renderer3D.ts` & `src/render/Renderer.ts`: manage visual effect instances.

## Fast Ball Pocket Tuning
- Today, once a ball crosses the capture radius it is simply flagged and removed. For very fast shots, we may need:
  1. **Velocity clamping in pocket funnels**: apply extra damping once the ball is inside the pocket throat to avoid jitter before removal.
  2. **Extended shelf collision**: optionally simulate one extra integration step where gravity-like acceleration pulls the ball downward. This would soak energy and keeps behavior consistent at high speeds.
- Activation idea:
  - Check `speed > threshold` when pocketing. If true, run a short “pocket settle” routine that scales velocity by, e.g., 0.2 and aligns direction toward pocket center before final removal.
  - Config gate: add `CONFIG.POCKET_CAPTURE_DAMPING` and `CONFIG.POCKET_CAPTURE_GRAVITY` toggles for experimentation.

## Making Balls Feel Heavier
Ideas spanning visuals and physics:
1. **Sound design**
   - Lower-pitched cue/pocket sounds, short reverb tails, and layered low-frequency thuds instantly imply weight.

2. **Camera & controller feedback**
   - Slight screen shake or HUD vibration when the cue strikes hard shots.

3. **Motion cues in physics**
   - Increase rolling friction a little so balls decelerate more noticeably after impact (`CONFIG.ROLLING_FRICTION`).
   - Introduce micro “settle” wobble when balls stop: a tiny oscillation + quick fade indicates inertia.

4. **Visual shading**
   - In `Renderer3D`, deepen shadow intensity directly beneath balls (contact shadow plane) so they appear grounded.
   - Add subtle motion blur streaks for high-velocity shots; heavy objects usually blur less but show streaks when fast.

5. **Cue animation**
   - Amplify cue recoil proportional to shot power so the strike reads as kinetic and weighty.
    - Audio panel now controls cue-hit tone/decay; consider linking recoil magnitude to those mixer settings.

## Next Steps / Open Questions
1. Prototype the pocket animation event pipeline and validate in both renderers.
2. Expose pocket capture damping constants to CONFIG for experimentation with high-speed shots.
3. Prioritize the "weight" cues (audio vs. physics vs. visuals) and test them incrementally to measure perceived realism gains.
4. Expand Audio Mixer to support sample selection / EQ for each event for finer control.

These enhancements can be staged independently; start with the pocket animation since that immediately solves the “poof” issue, then iterate on physics/audio cues for weight.
