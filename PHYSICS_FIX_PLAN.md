# Physics Notes & Fix History

This file captures the key corrections and tuning decisions that shaped the current physics pipeline. Use it as a reference when adjusting friction, solver settings, or reviewing regressions.

## 2024-04 – Collision Impulse Fix

- **Issue**: Object balls deviated ~2.9 ° from the contact normal on cut shots. Root cause was applying friction impulses on every solver iteration (15× per step).
- **Fix**: Added collision-pair tracking (`resolveBallBall`) so normal + friction impulses are applied once per pair per timestep, while positional correction still executes each iteration.
- **Side effects**: Enabled accurate Shot Capture comparisons (angle error < 0.6 °), eliminated “throw” amplification, and reduced energy loss on glancing blows.

## Current Physics Configuration (config.ts)

| Parameter              | Value | Notes                                                           |
|------------------------|-------|-----------------------------------------------------------------|
| `PHYSICS_DT`           | 1/120 | Fixed update step (120 Hz)                                      |
| `SOLVER_ITERATIONS`    | 15    | Iterative solver passes (Baumgarte correction each pass)        |
| `BALL_RESTITUTION`     | 0.93  | Phenolic resin cue/object balls                                 |
| `CUSHION_RESTITUTION`  | 0.88  | K-55 style cushions                                             |
| `BALL_BALL_FRICTION`   | 0.01  | Minimal throw; keep low unless modelling dirty cloth            |
| `ROLLING_FRICTION`     | 0.55  | Tuned for ~10× power multiplier                                 |
| `SLIDING_FRICTION`     | 0.65  | Governs rail cling; lower for livelier rails                    |
| `VELOCITY_EPSILON`     | 0.2   | Sleep threshold (in/s)                                          |

## Live Tuning Tips

- **Rail cling**: Lower `SLIDING_FRICTION` (Physics panel). Values < 0.5 yield quicker rebound.
- **Slow cloth**: Increase `ROLLING_FRICTION` or reduce cue power multiplier.
- **Runaway overlaps**: Increase `SOLVER_ITERATIONS` or tweak Baumgarte coefficient (currently hard-coded in `resolveBallBall`).
- **High-speed tunnelling**: Adaptive sub-stepping scales with `CONFIG.MAX_SUBSTEPS` and `BALL_RADIUS * 0.4` travel per substep.
- **Aim visuals**: Adjust `AIM_LINE_OFFSET`, `GHOST_BALL_OFFSET`, and `OBJECT_PATH_PERCENTAGE` in the Physics panel; settings persist via `SettingsManager`.

## Debugging Workflow

1. Enable **Shot Capture** (📸) to log prediction vs. outcome.
2. Use the **Scenario Manager** to reproduce rail riders, thin cuts, or break shots.
3. Record with **Physics Recorder** if frame-by-frame state is needed.
4. Export settings (`SettingsPanel` → Copy Config) alongside reports for reproducibility.

Keep this document updated whenever physics constants or algorithms change so future tuning sessions start with reliable context.
