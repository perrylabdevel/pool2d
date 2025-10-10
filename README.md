# Pool 2D - Tournament Grade Billiards

A production-quality 2D top-down pool game built with vanilla TypeScript and HTML5 Canvas, featuring tournament-grade physics, advanced prediction, and comprehensive debugging tools.

## Features

### Physics Engine
- **120 Hz Fixed Timestep**: Deterministic simulation with interpolated rendering
- **Adaptive Substepping**: Automatically increases physics substeps for high-speed shots (250+ in/s) to prevent tunneling
- **Impulse-Based Collisions**: Accurate ball-ball and ball-rail collision resolution with:
  - Normal impulse with restitution (0.93 ball-ball, 0.88 cushion)
  - Tangential friction impulse (0.05 ball-ball, 0.65 rail sliding)
  - Positional correction (Baumgarte stabilization)
- **Dual Friction Model**: Separate rolling (0.50) and sliding (0.65) friction for realistic ball behavior
- **Sleep Detection**: Configurable velocity threshold to prevent endless micro-movements

### Aim Assist & Prediction
- **Raycasting Prediction**: First-contact prediction for both ball and rail collisions
- **Ghost Ball Visualization**: Shows exact contact point and cut angle
- **Trajectory Lines**: Object ball (yellow) and cue ball (white) post-collision paths with directional arrows
- **High Accuracy**: < 0.2" contact point error on short shots, ~1-3° angle error on cuts
- **Smart Line Clipping**: Aim line automatically stops at rails/balls (no visual overlap)

### Practice Tools
- **Ball Repositioning**: Hold SHIFT + drag cue ball to any position
- **Physics Settings Panel**: Real-time adjustment of friction, power, restitution, solver iterations
- **Shot Capture**: Detailed prediction vs. actual analysis with error metrics
- **Physics Recorder**: Frame-by-frame state tracking for debugging
- **Debug Overlay**: Velocities, normals, contact points, collision geometry

### Game Modes
- **Practice Mode**: Free play with all debugging tools
- **8-Ball Mode**: Full rules implementation with break, fouls, ball-in-hand, win conditions

### Performance
- **60 FPS Rendering**: Smooth visuals with state interpolation
- **120 UPS Physics**: Rock-solid simulation independent of frame rate
- **Responsive Canvas**: Scales to any screen while preserving 2:1 aspect ratio

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
- **Aim Mode (default)**: Move mouse to aim, press **A** to lock angle and switch to power mode
- **Power Mode**: Drag power bar (right side) up/down to set power, release to shoot
- **Quick Shoot**: In aim mode, click near cue ball to shoot at low power

### Practice Mode Tools
- **SHIFT + Drag**: Reposition cue ball (practice mode only)
- **S**: Toggle Physics Settings panel (live parameter tuning)
- **D**: Toggle Debug overlay (velocities, normals, contact points)
- **R**: Restart/Reset table

### UI Buttons
- **📸 Capture Shot**: Record next shot for prediction accuracy analysis
- **⚙️ Physics**: Open settings panel for real-time physics tuning
- **Debug**: Toggle debug visualization overlay
- **Restart**: Reset table to initial rack

## Architecture

```
src/
├── main.ts                    # Entry point
├── config.ts                  # All game configuration (physics, table, rendering)
├── game/
│   └── Game.ts                # Main game loop, fixed timestep accumulator, state management
├── physics/
│   ├── Physics.ts             # Physics world, adaptive substepping, collision pipeline
│   ├── Shapes.ts              # Ball, Rail, Pocket entity definitions
│   ├── Collision.ts           # Detection and impulse-based resolution
│   └── Prediction.ts          # Raycasting aim assist, trajectory calculation
├── render/
│   └── Renderer.ts            # Canvas rendering, ghost ball, trajectory arrows
├── input/
│   └── Input.ts               # Mouse/keyboard handling, ball dragging
├── rules/
│   └── EightBall.ts           # 8-ball rules engine (break, fouls, scoring)
├── ui/
│   ├── HUD.ts                 # Game UI, turn indicator, stats (FPS/UPS)
│   └── SettingsPanel.ts       # Live physics parameter tuning panel
└── debug/
    ├── DebugDraw.ts           # Visual overlay for velocities, normals
    ├── ShotCapture.ts         # Prediction accuracy analysis tool
    └── PhysicsRecorder.ts     # Frame-by-frame state recording
```

## Configuration

All game parameters are centralized in `src/config.ts`:

### Physics Parameters
- `PHYSICS_DT`: 1/120 s (120 Hz simulation)
- `SOLVER_ITERATIONS`: 15 (collision resolution passes per step)
- `BALL_RESTITUTION`: 0.93 (ball-ball bounciness)
- `BALL_BALL_FRICTION`: 0.05 (ball-ball collision friction)
- `CUSHION_RESTITUTION`: 0.88 (cushion bounciness)
- `ROLLING_FRICTION`: 0.50 (table friction while rolling)
- `SLIDING_FRICTION`: 0.65 (table friction while sliding, also rail collisions)
- `VELOCITY_EPSILON`: 0.2 in/s (sleep threshold)

### Table Geometry
- `TABLE_WIDTH`: 100" (standard 9-foot table play area)
- `TABLE_HEIGHT`: 50" (2:1 aspect ratio)
- `BALL_RADIUS`: 1.125" (standard 2.25" diameter)
- `POCKET_RADIUS`: 2.0" (capture zone)

### Shot Parameters
- `CUE_POWER_MAX`: 25.0 (power bar maximum)
- `CUE_POWER_MULTIPLIER`: 10.0 (converts power to velocity, max = 250 in/s)
- `AIM_LINE_LENGTH`: 30" (default aim line when no prediction)

**Live Tuning**: All physics parameters can be adjusted in real-time via the Settings Panel (press **S** or click **⚙️ Physics**)

## Technical Details

### Fixed Timestep Accumulator
The game uses a deterministic fixed timestep pattern for consistent physics across different frame rates:

```typescript
update(dt: number) {
  this.accumulator += dt;
  
  while (this.accumulator >= CONFIG.PHYSICS_DT) {
    this.world.step(CONFIG.PHYSICS_DT);  // Always 1/120 s
    this.accumulator -= CONFIG.PHYSICS_DT;
  }
  
  // Interpolate for smooth rendering
  const alpha = this.accumulator / CONFIG.PHYSICS_DT;
  this.renderer.render(this.world, alpha);
}
```

### Adaptive Substepping
High-speed collisions (250+ in/s) are handled with adaptive substepping to prevent tunneling:

```typescript
// Calculate substeps based on max ball speed
const maxTravelPerSubstep = CONFIG.BALL_RADIUS;  // 1.125"
const substeps = Math.ceil(maxSpeed * dt / maxTravelPerSubstep);

// Prevents balls from traveling more than their radius per step
for (let i = 0; i < substeps; i++) {
  integrateVelocity(dt / substeps);
  resolveCollisions();
}
```

### Impulse-Based Collision Resolution
Ball-ball collisions use a two-phase impulse approach:

1. **Normal Impulse**: Separates balls with restitution
   ```typescript
   j = -(1 + e) * vRel / totalInvMass
   ```

2. **Friction Impulse**: Adds tangential friction (perpendicular to normal)
   ```typescript
   jt = clamp(-vt / totalInvMass, -maxFriction, maxFriction)
   maxFriction = |j| * BALL_BALL_FRICTION
   ```

3. **Positional Correction**: Baumgarte stabilization prevents sinking
   ```typescript
   // Separate balls to exactly touching
   correction = overlap / 2
   ballA.position -= normal * correction
   ballB.position += normal * correction
   ```

### Prediction Accuracy
The raycasting prediction system achieves tournament-grade accuracy:

| Distance | Contact Point Error | Angle Error |
|----------|-------------------|-------------|
| < 20"    | < 0.2"           | < 1°        |
| 20-40"   | 0.2-0.5"         | 1-2°        |
| > 40"    | 0.5-2.0"         | 2-5°        |

Error sources:
- **Friction deceleration**: Ball slows during travel, causing trajectory curve
- **Time integration**: Prediction is instantaneous, physics integrates over time
- **High speeds**: Faster shots accumulate more error over distance

Use **Shot Capture** (📸 button) to analyze prediction vs. actual collision data.

## License

MIT
