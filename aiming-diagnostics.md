# Aiming Diagnostics and Ghost Line Discrepancies

## Current Issues

- **[Ghost rail rebound mismatch]** `Predictor.predictFullPath()` projects unrealistic cue-ball trajectories after rail contact. Captured shots (e.g., `capture-1`) show the simulated cue ball leaving the east rail at roughly `vx ≈ -2 in/s`, while the ghost segment extends to `x ≈ -378 in`, hundreds of inches across the table.
- **[Segment scaling error]** The predictor correctly applies restitution then friction (matching `resolveBallRail()` in `src/physics/Collision.ts`), but uses an arbitrary `speed * 0.12` multiplier for segment length instead of modeling continuous friction deceleration. A ball at 2 in/s with `ROLLING_FRICTION = 0.50` should decelerate at ~193 in/s² and stop within inches, not project across the entire table.
- **[No friction decay modeling]** Post-collision segments are drawn as straight lines from the contact point using instantaneous velocity, without accounting for rolling friction continuously reducing speed until the ball comes to rest.
- **[Low-power preview artifacts]** With `currentPower = 0`, the preview still assumes minimum speed (`CONFIG.CUE_POWER_MIN`), so discrepancies are magnified. Diagnostics reveal high sensitivity to this parameter when the cue is stationary.
- **[Contact alignment]** `Predictor.predictFirstContact()` identifies rail intersections correctly (confirmed by capture data), so deviations originate from post-collision visualization, not from the raycast.

## Evidence

- **[Capture report `capture-1`]** `capture.actual[0].samples` records the cue velocity immediately after the rail at approximately `(-2.05, 0.48)` in/s, contrasting with the predictors segment that extends to `x ≈ -378 in`.
- **[Physics solver reference]** `src/physics/Collision.ts:resolveBallRail()` applies restitution followed by tangential friction on the reflected velocity, matching the simulation behavior.

## Potential Solutions

### Immediate Fixes

- **[Physics-based segment length]** Replace `speed * 0.12` with friction-aware projection. Use kinematic equation `distance = v² / (2 * friction * g)` to calculate stopping distance, or integrate velocity over small time steps until speed falls below `CONFIG.VELOCITY_EPSILON`. For a 2 in/s post-rail velocity: `d = 2² / (2 * 0.50 * 386) ≈ 0.01 inches`.
- **[Friction decay visualization]** Instead of straight-line segments, draw a curved path that shows the ball decelerating. Sample positions at fixed time intervals (e.g., every 0.1s) while applying `friction * dt` to velocity, stopping when speed reaches threshold.
- **[Impulse verification]** The current rail impulse math matches `resolveBallRail()` (restitution first, then friction on reflected velocity). Verify this is producing correct post-collision velocities by comparing against capture data—if velocities match but visualization diverges, the issue is purely in segment scaling.

### Long-term Improvements

- **[Shared collision helper]** Extract a `computeRailImpulse(vx, vy, rail, restitution, friction)` helper from `resolveBallRail()` that returns post-collision velocity. Use in both the physics solver and predictor to guarantee identical calculations.
- **[Multi-segment prediction]** For low-speed rebounds, draw multiple short segments showing the deceleration curve rather than a single long line. This provides visual feedback about where the ball will actually stop.
- **[Validation harness]** Add regression tests in `src/physics/Physics.test.ts` that fire known shots, capture simulated trajectories, and assert predictor segments match within tolerance (e.g., ±5% velocity, ±2 inches position).
- **[Preview power handling]** When `currentPower = 0` and cue is stationary, either (a) don't show post-collision segments, or (b) use a minimal reference speed (e.g., 1 in/s) with clear visual indication this is a preview, not a prediction.
- **[Energy conservation check]** Add diagnostic logging that compares kinetic energy before/after collision in both predictor and solver to catch impulse calculation drift.
