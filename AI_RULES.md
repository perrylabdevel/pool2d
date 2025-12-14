# AI Rules & Context

> [!IMPORTANT]
> **ALL AI AGENTS MUST READ THIS FILE BEFORE STARTING ANY TASK.**
> This file serves as the single source of truth for the project's context, current state, and active goals.
> **Update this file** when you complete a major task or change the project state.
>
> 📋 **For full deliverables & status, see [`PROJECT_STATUS.md`](./PROJECT_STATUS.md)**
> 📋 **For refactor progress, see [`docs/REFACTOR_PLAN.md`](./docs/REFACTOR_PLAN.md)**

## Project Context: RailRush
**RailRush** is a tournament-grade billiards game built with **TypeScript, Vite, and WebGL/Three.js**.
> [!NOTE]
> **Direction**: While built on a physics-based engine, the primary goal is **NOT** pure simulation. The target is a polished, **mobile-style game experience** similar to *Miniclip 8 Ball Pool* or *8 Ball Brawl*.
- **Physics**: Deterministic 120Hz fixed timestep, adaptive sub-stepping, pair-tracked impulse solver.
- **Renderer**: Three.js top-down table, PBR felt, FBX ball meshes, cinematic UI.
- **UI**: "Arcade" aesthetic (neon/glass), custom `ModalService`, `NotificationService`, and canvas-based scenes.
- **Platforms**: Web (Desktop & Mobile), iOS (Capacitor)

## Current State (December 2025)
The project has undergone a major architectural refactor. See `docs/REFACTOR_PLAN.md` for details.

### Architecture Overview
```
src/
├── game/
│   ├── Game.ts              # Main game orchestrator (~2815 lines)
│   └── controllers/         # Extracted game logic
│       ├── ShootingController.ts    # Aim, power, shot execution
│       ├── BallInHandController.ts  # Ball placement, drag, kitchen
│       ├── AIController.ts          # AI turn orchestration, animation
│       ├── MatchManager.ts          # Match lifecycle, rewards
│       ├── PocketCallController.ts  # Pocket calling, labels
│       ├── InputController.ts       # Power bar, micro dial
│       └── TurnController.ts        # Player switching, turn state
├── ui/
│   ├── scenes/              # Canvas-based UI scenes
│   ├── ModalService.ts      # Modal stack management
│   └── SceneController.ts   # Scene lifecycle
├── physics/                 # Physics engine
├── render/                  # Three.js renderer
└── events/                  # Typed EventBus system
```

### Completed Refactoring
- **Event System**: Typed `EventBus` in `src/events/` with legacy bridge
- **Settings**: New `StorageKeys` module with `RailRush_*` keys
- **Controllers**: 7 controllers extracted from `Game.ts`
- **Legacy Removal**: Deleted `src/editor/`, `editor.html`, `HubSettings.ts`, `DockBridge.ts`
- **Asset Cleanup**: Removed duplicate images from `public/textures/`, `src/assets/img/tmp/`, `public/assets/tmp/`

### UI System
- Design System (`design-tokens.css`, `.btn-arcade`)
- Core Services (`ModalService`, `NotificationService`, `UISoundService`)
- Canvas Scenes: `LobbyScene`, `PlayModesScene`, `ShopScene`, `ProfileScene`, `SettingsScene`, `LeagueScene`
- Components: `NavigationBar`, `SceneBackground`, `BaseScene`

## Active Todo List
### High Priority
- [ ] **Navigation**: Add focus management + keyboard navigation to all canvas scenes.
- [ ] **Multiplayer**: Implement matchmaking/lobby system.
- [ ] **Visuals**: Implement hero effects and animations for scene transitions.

### Medium Priority
- [ ] **Customization**: Implement cue customization (patterns, materials).
- [ ] **Stats**: Add more profile stats and achievement tracking.
- [ ] **Mini-games**: Build out mini-games section.
- [ ] **Game.ts Slimming**: Continue extracting to reach <500 lines (see REFACTOR_PLAN.md)

### Low Priority
- [ ] Keep `docs/rules/eight-ball-rules.md` aligned with enforcement.
- [ ] Procedural texture system (see `docs/procedural-textures.md`)

## Agent Rules
1. **Context First**: Always check `AI_RULES.md` to understand the big picture before diving into specific files.
2. **Update State**: If you complete a task listed in "Active Todo List", mark it as done `[x]` in this file.
3. **Maintain Consistency**: Ensure new UI elements match the "Arcade" aesthetic defined in `design-tokens.css`.
4. **Verify**: Always verify your changes against the "Current State" and "Project Context".
5. **Controllers**: When modifying game logic, check if it belongs in an existing controller before adding to `Game.ts`.
