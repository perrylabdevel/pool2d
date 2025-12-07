# Project Specification

> Reviewed: December 6, 2025. For live status/known issues, see `PROJECT_STATUS.md`.

This is the living spec for Pool 2D. It captures the intended scope, technology stack, and milestone checklist as the project evolves beyond the original brief.

## Vision

Deliver a tournament-grade billiards sandbox that can double as a physics laboratory. High-level goals:

- Shot outcomes should align with real-world expectations (no tunnelling, correct throw, accurate rails).
- Geometry, pocket sizing, and render options must be adjustable without code edits.
- Tooling should make it easy to diagnose prediction error, reproduce shots, and share findings.

## Current Stack

- **Language**: TypeScript
- **Build**: Vite + ESBuild
- **Rendering**: Three.js (WebGL) + layered HTML5 Canvas overlays
- **UI**: Vanilla DOM/CSS with floating panels and icon HUD
- **Testing**: Vitest (unit), manual scenario regression for physics

## Core Systems

| Area        | Requirements                                                                              | Status |
|-------------|--------------------------------------------------------------------------------------------|--------|
| Physics     | 120 Hz fixed timestep, adaptive sub-stepping, pair-tracked impulse solver, sleep detection | ✅     |
| Prediction  | Raycast + impulse previews, physics simulation overlay, shot capture reporting             | ✅     |
| Gameplay    | Practice sandbox, 8-ball rules (break, fouls, win states)                                  | ✅     |
| Geometry    | Live jaw/rail/pocket tuning, independent corner/side capture radii                         | ✅     |
| Renderer    | Three.js table + balls, 2D HUD overlay, render-layer toggles, DPI scaling slider           | ✅     |
| Tooling     | Scenario manager, physics recorder, debug overlay, local-storage persistence               | ✅     |
| Leagues     | 9-tier league system (Bronze to Crystal), dynamic standings, weekly prize pools            | ✅     |
| Automation  | Vitest unit tests for key math utilities                                                   | ⚙️ planned |

> Note: Rounded frame corners are now handled via `frameOutline`, keeping rail endpoints fixed so physics stay deterministic regardless of frame styling.

## Control Surfaces

- **Settings Panel (S)**: friction, restitution, solver iterations, aim-line offsets, table scale, physics reset/export.
- **Geometry Panel (G)**: frame offsets, jaw radii, capture radii, throat positions; emits restarts.
- **Render Layer Panel**: toggle table/frame/pockets/overlays and adjust render order.
- **Scenario Manager** (`shotScenarios.*`): scripted shot setups for regression testing.

## Milestones & Backlog

- [x] Deterministic physics core with pair tracking and friction fix
- [x] Live geometry editing + immediate world rebuild
- [x] Three.js renderer with FBX ball assets and axis-aware trajectories
- [x] Shot Capture & Recorder UX polish
- [x] Settings persistence (physics, colors, render, geometry)
- [x] League Scene Implementation (Standings, Dynamic Headers, Progression)
- [ ] Automated regression scenes (headless) using scenario manager
- [ ] Optional AI shot suggestion / solver
- [ ] Additional rule sets (9-ball, straight pool)

## Acceptance Criteria

- Balls never tunnel through rails at max configured cue velocity.
- Corner/side capture radii and jaw adjustments apply immediately across physics & render.
- Prediction error for straight/cut/rail scenarios stays within the tolerances logged by Shot Capture.
- Render scale slider adapts cleanly to high-DPI displays without altering physics.
- All settings persist across reloads (local storage) and can be exported/imported.

## Useful Commands

```bash
npm run dev      # Vite dev server with hot reload
npm run build    # Production build
npm run test     # Vitest suite (math/physics utilities)
```

As new systems land, update this spec instead of creating parallel documents to keep guidance in one place.
