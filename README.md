# Pool 2D – Tournament Grade Billiards

Pool 2D is a tournament-accurate billiards sandbox built with TypeScript, Vite, and a WebGL/Three.js renderer. It pairs deterministic 120 Hz physics with live-tunable geometry, scenario tooling, and deep debugging instrumentation for validating shots, pockets, and table setup.

## Highlights

- **Tournament Physics**
  - 120 Hz fixed timestep with adaptive sub-stepping for break-speed shots
  - Pair-tracked impulse solver (single normal + friction impulse per contact)
  - Rolling (0.55) and sliding (0.65) friction controls, configurable sleep threshold
  - Corner/side pocket capture radii and jaw geometry adjustable in real time

- **3D Renderer & UI**
  - Three.js top-down table with PBR felt, FBX ball meshes, and layered 2D UI canvases
  - Compact HUD with icon controls, inline player badges, and foul/turn indicators
  - Render-layer manager for toggling table/frame/overlays, reference images, and measurements
  - Table Scale slider (Settings → Table Scale) for high-DPI displays without touching physics

- **Prediction & Debugging**
  - Aim assistant with ghost-ball visualization and axis-aware trajectory highlighting
  - Physics-based shot predictor plus full-path simulation overlay in debug mode
  - Shot Capture reports (📸) with contact, angle, and timing deltas; clipboard export
  - Scenario Manager (`shotScenarios.list()` in console) for curated test shots, including rail riders
  - Physics Recorder for frame snapshots, events, and markdown export

- **Rules & Practice**
  - Practice mode with cue-ball drag (SHIFT + drag)
  - 8-ball mode with fouls, ball-in-hand, and win handling
  - Geometry panel to tweak jaw offsets, capture radii, and throat angles without code changes
  - Frame radius slider shapes a dedicated frame outline so rail physics stay constant while visuals curve

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Run tests
npm run test
```

## Controls

### Aiming & Shooting
- **Aim mode (default)**: Move mouse to aim; press **A** to lock angle and switch to power mode
- **Power mode**: Drag power bar to set power, release to shoot
- **Quick shoot**: Click near cue ball for a low-power tap shot

### Practice & Debug
- **SHIFT + drag**: Reposition cue ball (practice mode)
- **S**: Physics settings (friction, power, aim-line offsets, solver, table scale)
- **D**: Debug overlay (normals, velocities, contacts)
- **G**: Geometry editor (pocket/jaw tuning)
- **M**: Measurement overlay toggle
- **Shift + O**: Reference overlay toggle
- **R**: Restart table

### HUD Buttons
- **⚙️ Physics**: Live physics/display tuning (includes aim-line/ghost-ball offset controls)
- **🎛️ Geometry**: Jaw, pocket, and frame editor
- **🐛 Debug / 📸 Capture / ↻ Restart**: Toggle overlays, capture shots, reset

## Architecture Overview

```
src/
├── config.ts          # Physics, geometry, render defaults
├── main.ts            # Bootstraps canvases, starts Game loop
├── game/Game.ts       # Fixed-timestep loop, input wiring, rule integration
├── physics/
│   ├── Physics.ts     # World step, adaptive sub-stepping, pocket capture
│   ├── Collision.ts   # Detection + impulse solver (normal + friction)
│   ├── Prediction.ts  # Raycast + sim-based aim assistance
│   └── Shapes.ts      # Ball, rail, pocket primitives
├── render/
│   ├── Renderer3D.ts  # Three.js renderer + UI overlay canvases
│   ├── Renderer.ts    # Legacy 2D canvas renderer (debug)
│   └── RenderLayers.ts# Layer toggles/order defaults
├── ui/
│   ├── HUD.ts         # HUD, fouls, FPS/UPS, mode display
│   ├── SettingsPanel.ts   # Physics/display sliders with persistence
│   ├── SettingsManager.ts # Local-storage backed settings store
│   └── GeometryPanel.ts   # Live pocket/rail editor
├── debug/             # Shot capture, physics recorder, debug overlay
└── rules/EightBall.ts # 8-ball rule engine
```

## Configuration Snapshot

All tunables live in `src/config.ts` and can be overridden live via the settings panels.

- **Physics**
  - `PHYSICS_DT`: 1 / 120 s (120 Hz)
  - `SOLVER_ITERATIONS`: 15
  - `BALL_RESTITUTION`: 0.93
  - `BALL_BALL_FRICTION`: 0.01
  - `ROLLING_FRICTION`: 0.55
  - `SLIDING_FRICTION`: 0.65
  - `VELOCITY_EPSILON`: 0.2 in/s
- **Geometry**
  - `BALL_RADIUS`: 1.125"
  - `POCKET_RADIUS_CORNER`: 2.5" (capture radius, user-adjustable)
  - `POCKET_RADIUS_SIDE`: 2.5" (capture radius, user-adjustable)
  - Jaw offsets/angles derived from `GeometryPanel` parameters at runtime
  - `frameOutline` exposes frame inner/outer bounds so rounded corners never move rail endpoints
- **Display**
  - `CANVAS_SCALE_MULTIPLIER`: 1.0 (live slider in Settings → Display)

For coordinate details, pocket derivations, and naming conventions, see `geometry.md`.

Display and scaling internals: see `docs/display-architecture.md` for how canvases, camera framing, and scaling work together.

## Shot Analysis Workflow

1. Configure a scenario (`shotScenarios.load('rail-ride-long', { startCapture: true })`)
2. Fire the shot and let Shot Capture log prediction vs. reality
3. Export recorder/shot reports for comparison or sharing
4. Adjust friction, cushion restitution, or pocket geometry on the fly and repeat

This loop keeps physics tuning reproducible and easy to share across machines.

## License

MIT
