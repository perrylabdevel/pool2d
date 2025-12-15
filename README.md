# RailRush – Tournament Grade Billiards

RailRush is a tournament-grade billiards sandbox built with TypeScript, Vite, and a WebGL/Three.js renderer. It pairs deterministic 120 Hz physics with live-tunable geometry, cinematic UI, and deep debugging instrumentation for validating shots, pockets, and table setup.

## Highlights

- **Tournament Physics**
  - 120 Hz fixed timestep with adaptive sub-stepping for break-speed shots
  - Pair-tracked impulse solver (single normal + friction impulse per contact)
  - Rolling (0.55) and sliding (0.65) friction controls, configurable sleep threshold
  - Corner/side pocket capture radii and jaw geometry adjustable in real time

- **Cinematic UI & Renderer**
  - Three.js top-down table with PBR felt, FBX ball meshes, layered 2D overlays, and HUD ball chips rendered from in-engine thumbnails
  - Home Hub modal (Miniclip-inspired) for launching modes, settings, profile, and shop flows
  - ModalService stack with pause/in-game menus, NotificationService toasts, and DockBridge (Shift+L) for legacy panel access
  - Render-layer manager plus HUD controls tuned by design tokens; table scale slider (Settings → Display) keeps physics untouched

- **Prediction & Debugging**
  - Aim assistant with ghost-ball visualization and axis-aware trajectory highlighting
  - Distance-based aim sensitivity for finer control on long shots
  - Physics-based shot predictor plus full-path simulation overlay in debug mode
  - Shot Capture reports (📸) with contact, angle, and timing deltas; clipboard export
  - Scenario Manager (`shotScenarios.list()` in console) for curated test shots, including rail riders
  - Physics Recorder for frame snapshots, events, and markdown export

- **Rules & Practice**
  - Practice sandbox with drag-to-place cue ball, restart, and geometry/physics live edits
  - 8-ball mode with AI opponent, fouls, called-pocket workflow, and BIH enforcement
  - Time Attack, Perfect Game, Speed Pool, and Shot Playback modes for alternative pacing
  - Geometry panel to tweak jaws/capture radii without code changes
  - Frame radius slider shapes decorative frame independently of rail physics
- **Audio & Accessibility**
  - Sample-driven AudioManager with background ambience, music bed, and Quiet Room filter/compressor chain
  - Audio Mixer panel (master/music/background/UI/cue/ball/rail/pocket sliders, per-row mute, previews)
  - UISoundService for hover/click/modal tones respecting mixer settings

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
  - Distance-based sensitivity automatically provides finer control for long shots
  - Hold **Shift** for ultra-fine aim mode
- **Power mode**: Drag power bar to set power, release to shoot
  - Press **Space** to enter power mode quickly
- **Micro aim dial**: Left-side dial applies ±2.5° offsets for ultra-fine cuts
  - Works best after locking aim with **A**; double-click dial to reset to 0°
- **Quick shoot**: Click near cue ball for a low-power tap shot

### Practice & Debug
- **Ball-in-hand**: Click and drag cue ball (physics pauses, cue hidden)
- **S**: Physics settings (friction, solver, aim offsets, scale)
- **Shift + D**: Toggle Debug overlay; **B** shows ball-in-hand diagnostics
- **G**: Geometry editor (legacy panel) or **J** for Modern Geometry controls
- **M**: Measurement overlay toggle
- **Shift + O**: Reference overlay image toggle
- **R**: Restart table

### UI & Modes
- **ESC**: Pause menu (resume/settings/quit to Lobby)
- **Shift + L**: Toggle legacy dock panels via DockBridge
- **H / ?**: Open Help modal (also linked from Lobby)
- **HUD Menu button**: Opens In-Game Menu while pausing play
- **1 / 2 / 3 / 4**: Switch rules presets (Casual / Tournament / APA / Practice)
- **8 / T / P / V**: Jump to 8-ball, Time Attack, Perfect Game, or Speed Pool modes (Practice returns with same key)

## Modes

- **Practice** – sandbox with BIH, quick restarts, instant panel access
- **8-Ball vs AI** – configurable ruleset, called-pocket flow before 8-ball, foul handling, AI scratch recovery
- **Time Attack / Speed Pool** – arcade scoring variants with HUD stat strings
- **Perfect Game** – miss ends the run; great for aim drills
- **Playback** – inspect recorded shots via PhysicsRecorder exports

## Architecture Overview

```
src/
├── config.ts          # Physics, geometry, render defaults
├── main.ts            # Bootstraps canvases, starts Game loop
├── game/Game.ts       # Fixed-timestep loop, input wiring, rule integration
├── ui/SceneController.ts # Canvas scene manager (Lobby, Shop, Profile, etc.)
├── ui/ModalService.ts # Modal stack, animations, confirm dialogs
├── ui/scenes/InGameMenuScene.ts # ESC menu tied into SceneController
├── ui/HubSettings.ts  # Settings surfaced inside modal chrome
├── ui/UIPanels/*.ts   # Legacy dock panels (physics, geometry, render layers)
├── physics/
│   ├── Physics.ts     # World step, adaptive sub-stepping, pocket capture
│   ├── Collision.ts   # Detection + impulse solver (normal + friction)
│   ├── Prediction.ts  # Raycast + sim-based aim assistance
│   └── Shapes.ts      # Ball, rail, pocket primitives
├── render/
│   ├── Renderer3D.ts  # Three.js renderer + HUD chips + pocket animations
│   ├── Renderer.ts    # Legacy 2D canvas renderer (debug tooling)
│   └── RenderLayers.ts# Layer toggles/order defaults
├── sound/AudioManager.ts # Sample playback, mixer integration, Quiet Room chain
├── ui/
│   ├── HUD.ts         # HUD, fouls, FPS/UPS, mode display, pocket selector
│   ├── UISoundService.ts # UI synth cues (hover/click/modal/toast)
│   ├── AudioPanel.ts  # Mixer UI w/ previews + mute
│   ├── SettingsManager.ts # Local-storage backed settings store
│   └── Geometry panels, Shop/Profile modals, Notification service, etc.
├── ai/PoolAI.ts       # AI opponent with difficulty levels
├── debug/             # Shot capture, physics recorder, debug overlay
└── rules/EightBall.ts # 8-ball rule engine
```

## Rules & Pocket Calls

- Default preset: `HOUSE_8BALL` (rail contact, legal break, slop on, kitchen BIH after break scratch).
- Hotkeys 1–4 swap presets instantly; HUD logs active rules.
- Called-pocket workflow:
  1. Game detects when a call is required (8-ball or presets).
  2. HUD overlays a pocket selector; click a pocket to commit.
  3. Renderer highlights called pocket during the shot.
- Fouls trigger NotificationService banners, BIH drag guidance, and AI safeguards (AI auto-breaks after your scratch).
- Upcoming work (see `docs/rules/eight-ball-rules.md` and `docs/todo.md`): illegal-break choice dialogs, non-blocking pocket selector, full called-shot UX.


## Configuration Snapshot

All tunables live in `src/config.ts` and can be overridden live via the settings panels.

- **Physics**
  - `PHYSICS_DT`: 1 / 120 s (120 Hz)
  - `SOLVER_ITERATIONS`: 15
  - `BALL_RESTITUTION`: 0.93
  - `BALL_BALL_FRICTION`: 0.01
  - `ROLLING_FRICTION`: 0.55
  - `SLIDING_FRICTION`: 0.65
  - `VELOCITY_EPSILON`: 0.2 in/s
- **Geometry**
  - `BALL_RADIUS`: 1.125"
  - `POCKET_RADIUS_CORNER`: 2.5" (capture radius, user-adjustable)
  - `POCKET_RADIUS_SIDE`: 2.5" (capture radius, user-adjustable)
  - Jaw offsets/angles derived from `GeometryPanel` parameters at runtime
  - `frameOutline` exposes frame inner/outer bounds so rounded corners never move rail endpoints
- **Display**
  - `CANVAS_SCALE_MULTIPLIER`: 1.0 (live slider in Settings → Display)
- **Aiming**
  - `DISTANCE_AIM_SCALING_ENABLED`: true (automatic sensitivity adjustment for long shots)
  - `DISTANCE_AIM_MIN_DISTANCE`: 15" (distance below which no scaling is applied)
  - `DISTANCE_AIM_MAX_DISTANCE`: 60" (distance at which maximum scaling is applied)
  - `DISTANCE_AIM_MIN_SENSITIVITY`: 0.35 (sensitivity multiplier at max distance)

For coordinate details, pocket derivations, and naming conventions, see `docs/geometry/geometry.md`.

Display and scaling internals: see `docs/display-architecture.md` for how canvases, camera framing, and scaling work together.

## Shot Analysis Workflow

1. Configure a scenario (`shotScenarios.load('rail-ride-long', { startCapture: true })`)
2. Fire the shot and let Shot Capture log prediction vs. reality
3. Export recorder/shot reports for comparison or sharing
4. Adjust friction, cushion restitution, or pocket geometry on the fly and repeat

This loop keeps physics tuning reproducible and easy to share across machines.

## Documentation

- `docs/display-architecture.md` - canvas framing, hub overlays, scaling strategy
- `docs/audio/*` - setup/status plus prompt banks for replacing placeholder sounds
- `docs/geometry/*.md` - coordinate conventions and derived jaw math
- `docs/table-editor-usage.md` - how to use the Table Editor devtool
- `docs/table-editor-plan.md` - current Table Editor design notes
- `docs/rules/eight-ball-rules.md` - rule coverage and remaining gaps
- `docs/ui-overhaul-plan.md` - Home Hub / modal architecture and roadmap
- `docs/ui-overhaul-status.md` - live UI checklist & follow-ups
- `docs/specs.md` - high-level component specs/backlog
- `docs/pocket-animation-plan.md` - pocket animation system + tuning
- `docs/todo.md` - active engineering checklist

## License

MIT
