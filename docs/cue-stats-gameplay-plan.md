# Cue Stats Gameplay Integration Plan

## Goal
Apply cue stats (power, accuracy, spin, aim) to in-game mechanics in a predictable, tunable way.

## Data & Defaults
- Source cue stats from cue editor (IndexedDB) or fallback `src/data/cues.ts`.
- Clamp stat values to 0–100 at runtime.
- Add a normalized helper: `statPercent = stat / 100`.

## Gameplay Hooks
- Power
  - Affect max shot velocity and/or power bar scaling.
  - Apply as a multiplier to cue impulse strength.
- Accuracy
  - Reduce aiming variance by scaling the random error cone.
  - Lower error for higher accuracy (inverse relationship).
- Spin
  - Scale max spin magnitude or spin transfer efficiency.
  - Higher spin increases cue ball response for the same spin input.
- Aim
  - Adjust guideline length or prediction clarity (visual assist).
  - If using aim assist, increase assist tolerance for higher aim.

## Implementation Steps
1. Add a `CueStats` accessor to retrieve the equipped cue stats at runtime.
2. Apply stats to shot computation in the physics/shot pipeline.
3. Apply stats to aiming/assist visualizations and prediction length.
4. Add dev-only UI toggles to compare baseline vs. stat-modified behavior.
5. Log telemetry during matches (average power, miss rate) for tuning.

## Balancing Notes
- Keep stat effects subtle; avoid stacking into extreme outcomes.
- Consider diminishing returns above ~80 to preserve fairness.
- Ensure low-end cues remain viable for casual play.

## Testing Checklist
- Equip cues with min/max stats and verify behavior changes.
- Ensure stats only affect player cue, not AI.
- Confirm stat values persist across sessions.
