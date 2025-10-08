# Pool 2D - Tournament Grade Billiards

A production-quality 2D top-down pool game built with vanilla TypeScript and HTML5 Canvas, featuring tournament-grade physics and clean architecture.

## Features

- **Realistic Physics**: 120 Hz fixed timestep simulation with proper ball-ball and ball-cushion collisions
- **Tournament-Grade Mechanics**: Accurate restitution, rolling friction, and pocket capture
- **8-Ball Rules**: Full implementation with break rules, fouls, ball-in-hand, and win conditions
- **Practice Mode**: Free play without rules
- **Debug Tools**: Visual overlays for normals, velocities, and contact points
- **Responsive**: Scales to fit any screen while preserving aspect ratio
- **Performance**: Targets 120 UPS physics with 60 FPS rendering

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

- **Aim**: Move mouse around cue ball
- **Shoot**: Click and drag away from cue ball, then release
- **Power**: Drag distance determines shot power

## Architecture

```
src/
├── main.ts              # Entry point
├── config.ts            # All game configuration
├── game/
│   └── Game.ts          # Main game loop and state machine
├── physics/
│   ├── Physics.ts       # Physics world and simulation
│   ├── Shapes.ts        # Ball, Rail, Pocket definitions
│   └── Collision.ts     # Detection and resolution
├── render/
│   └── Renderer.ts      # Canvas rendering
├── input/
│   └── Input.ts         # Mouse/touch handling
├── rules/
│   └── EightBall.ts     # 8-ball rules engine
├── ui/
│   └── HUD.ts           # UI and stats
└── debug/
    └── DebugDraw.ts     # Debug visualization
```

## Configuration

All game parameters are in `src/config.ts`:
- Physics timestep and solver iterations
- Table dimensions and ball properties
- Restitution and friction coefficients
- Rendering colors and scale
- Debug toggles

## Development

The game uses a fixed timestep accumulator for deterministic physics:
- Physics runs at 120 Hz regardless of frame rate
- Rendering interpolates between physics states for smooth visuals
- All collisions use impulse-based resolution with positional correction

## License

MIT
