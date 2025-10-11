# Pool2D Rotation & Rules Review

## Findings

### High

- **8-ball win logic unreachable** – `hasPlayerClearedGroup` always returns `false`, so a legal 8-ball pot is treated as a foul loss (`src/rules/EightBall.ts:222`).
- **Rules engine never sees events** – pocketing and first-contact notifications are never forwarded to `EightBallRules`; `PhysicsWorld.checkPockets` only flips state (`src/physics/Physics.ts:181`) and `Game` never calls `rules.recordBallPocketed`/`recordFirstContact`, so fouls, group assignment, and wins cannot trigger.

### Medium

- **Scene objects duplicated on restart** – `Game.restart` calls `initializeGame`, which re-adds table/rail/pocket meshes without removing prior instances (`src/game/Game.ts:190-204`), inflating draw calls.
- **Power-bar drag fires with stale aim** – Dragging from aim mode shoots using `lockedAngle`, which remains at 0 rad unless the player toggled power mode with `A` (`src/game/Game.ts:341-385`).
- **Settings panel controls wrong rotation constant** – UI sliders persist `CONFIG.BALL_ROTATION_MULTIPLIER`, but 3D rendering now uses `CONFIG.BALL_ROTATION_MULTIPLIER_3D`, so adjustments no longer influence visible spin (`src/render/Renderer3D.ts:576`, `src/ui/SettingsPanel.ts:36-47`, `src/ui/SettingsManager.ts:18-32`).

### Low

- **2D felt noise flickers** – The 2D renderer regenerates random speckle each frame, making the cloth shimmer (`src/render/Renderer.ts:70-81`).

## Open Questions / Assumptions

- Should the rules engine be wired directly into physics (e.g., via callbacks) or is a separate event bus planned?
- Is the expectation that players press `A` to lock aim before every shot, or should power-bar dragging automatically capture the current aim direction?
