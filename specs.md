You are an expert game-engine and front-end engineer. Build a production-quality **2D top-down pool (billiards) game** in **vanilla JavaScript + HTML5 Canvas** with tournament-grade physics and a clean UI. Deliver a small, maintainable codebase with strong structure, debug tooling, and automated checks.

# High-level goals
- Smooth, realistic ball motion and collisions (rigid body impulses, restitution, rolling+sliding friction, cushion bounces, pocket capture).
- Polished look: crisp table graphics, shadows, tweened UI, responsive canvas.
- Low input latency, deterministic simulation (fixed timestep), stable on 60–144 Hz displays.
- Modular architecture that’s easy to extend (8-ball now, 9-ball later).

# Tech & constraints
- **Vanilla JS (ES Modules)** + single HTML page + CSS; no heavy frameworks.
- Use **Vite** for dev server & bundling. Provide npm scripts.
- Canvas only (no WebGL). One canvas for playfield; optional overlay for debug HUD.
- Screen-size responsive: scale game to fit while preserving table aspect ratio.
- Deterministic physics with a **fixed update step (e.g., 1/120 s)** and accumulator.

# Game spec (defaults; put in `src/config.ts` or `config.js`)
- Table: 9-ft (100" x 50" play area) scaled; 6 pockets with cut angles and capture radii.
- Balls: 2.25" diameter, uniform mass; **restitution ~ 0.93** (ball-ball), **0.88** (ball-cushion).
- Friction: kinetic/rolling modeled with velocity-proportional deceleration; include slow-down curve to avoid infinite micro-velocities; clamp to stop threshold.
- Spin/swerve: optional v1.0 skip; stub API for future English.
- Break power and aim assist toggle (very light ghost line; can disable in settings).
- Modes: **Practice** (no rules) and **8-Ball** (basic rules: break, groups, fouls, ball-in-hand, call-8 optional toggle).

# Must-have features
1. **Physics engine (2D)**
   - Circle–circle collision detection and resolution with positional correction (Baumgarte or split impulse) to prevent sinking/overlap.
   - Cushion collisions from polygonal rails with inward normals; use swept tests to avoid tunneling at high speeds.
   - Pocket regions: circular capture zones; once center crosses lip, mark as pocketed; animate sink.
   - Energy handling: small global damping to stabilize; cap velocities; sleep when speed < epsilon.
2. **Cue & shot system**
   - Mouse/touch to aim; power via drag distance; tap/space to shoot.
   - Pre-shot line + short “ghost” prediction using light-weight raycast for first contact (configurable).
3. **Rules (8-Ball minimal)**
   - Legal break; track stripes/solids after first legal pot; scratch rules; ball-in-hand; win/loss conditions; turn switching.
4. **UI/UX**
   - Sidebar or top bar HUD with: turn indicator, balls remaining per player, foul banner, FPS/UPS (toggle), settings menu.
   - Pause/restart, Practice/8-Ball mode switch.
   - Accessible colors and readable typography.
5. **Debug tools**
   - Toggle overlay: normals, contact points, AABBs, velocities, pocket radii.
   - Step-through mode (advance one physics tick).
   - Determinism check: seedable RNG; record/replay last N shots.
6. **Performance**
   - Target 120 physics UPS with interpolation render; stable 60 FPS on mid hardware.
   - No per-frame heap thrash; reuse objects where possible.

# Project structure
- `index.html` – canvas + UI root.
- `src/main.ts` (or .js) – bootstraps game loop.
- `src/game/Game.ts` – high-level state machine (menus, practice, 8-ball).
- `src/render/Renderer.ts` – draws table, balls, shadows, UI overlay.
- `src/physics/Physics.ts` – world step, broadphase (simple spatial grid), narrowphase, solver.
- `src/physics/Shapes.ts` – Ball, Rail segments, Pocket definitions.
- `src/physics/Collision.ts` – detection, manifold, impulse resolution.
- `src/input/Input.ts` – mouse/touch handling, cue aim/power.
- `src/rules/EightBall.ts` – turn logic, fouls, scoring.
- `src/ui/HUD.ts` – info panels, settings, FPS/UPS.
- `src/debug/DebugDraw.ts` – overlays & stepper.
- `src/config.ts` – all tunables (sizes, friction, restitution, speeds, colors).
- `styles/` – minimal CSS.

# Implementation details (do this)
- **Loop**: Use `requestAnimationFrame` for rendering, run physics with fixed dt inside an accumulator; interpolate render positions between last & current state.
- **Broadphase**: Uniform grid hashing of balls; rails checked per sector to keep it simple but fast.
- **Ball–ball**: Compute time of impact or conservative advancement inside fixed dt; resolve with impulse `j = -(1+e) v_rel·n / (invMassSum)` + frictional tangent impulse clamp (Coulomb).
- **Ball–rail**: Treat rails as line segments with thickness; reflect velocity around normal with restitution and slide along tangent; positional correction to avoid sticking.
- **Friction**: Apply rolling deceleration proportional to speed; when speed < threshold, zero it.
- **Pockets**: If ball center enters pocket area and velocity vector points inward, mark pocketed; remove from simulation, play sink animation, notify rules engine.
- **Numerics**: Use EPS constants; clamp impulses; iterative solver 10–20 iterations for stability.
- **Assets**: Draw everything with Canvas paths/gradients; no images required.

# UX polish
- Subtle table felt texture via Canvas noise (optional).
- Ball numbers drawn with Canvas text; cached to offscreen canvases for performance.
- Launch animation & gentle camera “breathing” (very subtle scale/translate).

# Testing & quality gates
- Add a simple unit test suite with **Vitest** for collision math and rules edge cases.
- Include a deterministic “break test” and “rail shot test” harness; compare final ball positions against golden snapshots (within tolerance).
- ESLint + Prettier config; GitHub Actions workflow (lint + test).

# Commands & scripts
- `npm create vite@latest pool2d --template vanilla-ts` (or vanilla if JS only)
- `npm i && npm i -D vite vitest eslint prettier`
- Scripts:
  - `"dev": "vite"`
  - `"build": "vite build"`
  - `"preview": "vite preview"`
  - `"test": "vitest run"`

# Milestones (execute in order)
1) **Scaffold** repo, configs, and canvas resize logic. Draw static table & balls.
2) **Physics core v1**: ball–ball, ball–rail, friction, sleep, fixed timestep.
3) **Cue & shot**: aim, power meter, shoot; simple prediction line.
4) **Pockets**: capture + remove; sink animation.
5) **Rules (8-ball)**: turns, fouls, ball-in-hand; win/lose banner.
6) **Debug overlay** + replay buffer.
7) **Polish pass**: shadows, UI, settings; performance tune; tests.

# Acceptance criteria (must pass)
- Balls never tunnel through rails at max break power.
- No visible jitter after resting; overlapping balls auto-resolve.
- Deterministic replays on same seed across runs.
- 120 UPS physics on a mid laptop; <2 ms avg step with 16 balls.
- Clean code: modules match structure above; config exposes all tunables.

# Stretch goals (if time permits)
- Basic AI opponent (search over aim angle + power with rollout depth 1).
- English/top-spin model with simplified spin–velocity coupling.
- 9-Ball rules mode toggle.

Start now. When scaffolding is done, run `npm run dev` and confirm the table renders and the physics step is ticking; then continue milestone by milestone. At each milestone, provide a short status note and commit.
