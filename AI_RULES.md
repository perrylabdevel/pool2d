# AI Rules & Context

> [!IMPORTANT]
> **ALL AI AGENTS MUST READ THIS FILE BEFORE STARTING ANY TASK.**
> This file serves as the single source of truth for the project's context, current state, and active goals.
> **Update this file** when you complete a major task or change the project state.
>
> 📋 **For full deliverables & status, see [`PROJECT_STATUS.md`](./PROJECT_STATUS.md)**

## Project Context: RailRush
**RailRush** is a tournament-grade billiards game built with **TypeScript, Vite, and WebGL/Three.js**.
> [!NOTE]
> **Direction**: While built on a physics-based engine, the primary goal is **NOT** pure simulation. The target is a polished, **mobile-style game experience** similar to *Miniclip 8 Ball Pool* or *8 Ball Brawl*.
- **Physics**: Deterministic 120Hz fixed timestep, adaptive sub-stepping, pair-tracked impulse solver.
- **Renderer**: Three.js top-down table, PBR felt, FBX ball meshes, cinematic UI.
- **UI**: "Arcade" aesthetic (neon/glass), custom `ModalService`, `NotificationService`, and canvas-based scenes.

## Current State (Post-Refactor)
The project has undergone a major architectural refactor. See `docs/REFACTOR_PLAN.md` for details.

### Completed Refactoring
- **Event System**: Typed `EventBus` in `src/events/` with legacy bridge
- **Settings**: New `StorageKeys` module with `RailRush_*` keys (migrated from `pool2d_*`)
- **Controllers**: Extracted from `Game.ts` to `src/game/controllers/`:
  - `ShootingController` - aim, power, shot execution
  - `BallInHandController` - ball placement, kitchen restrictions
  - `AIController` - AI turn orchestration, shot animation
  - `MatchManager` - match lifecycle, rewards, trophy system
- **Legacy Removal**: Deleted `src/editor/`, `editor.html`, `HubSettings.ts`, `DockBridge.ts`

### UI System
- Design System (`design-tokens.css`, `.btn-arcade`)
- Core Services (`ModalService`, `NotificationService`, `UISoundService`)
- Canvas Scenes: `LobbyScene`, `PlayModesScene`, `ShopScene`, `ProfileScene`, `SettingsScene`, `LeagueScene`
- Components: `NavigationBar`, `SceneBackground`

## Active Todo List
### High Priority
- [x] **Responsive Design**: Optimized for mobile, tablet, and desktop layouts.
- [ ] **Navigation**: Add focus management + keyboard navigation to all canvas scenes.
- [ ] **Multiplayer**: Implement matchmaking/lobby system.
- [ ] **Visuals**: Implement hero effects and animations for scene transitions.
- [ ] **Gameplay**: Build non-blocking HUD pocket selector + illegal-break choice dialog.

### Medium Priority
- [ ] **Customization**: Implement cue customization (patterns, materials).
- [ ] **Stats**: Add more profile stats and achievement tracking.
- [ ] **Mini-games**: Build out mini-games section.
- [ ] **Audio**: Extend Audio Mixer with per-event sample selection.

### Documentation & Maintenance
- [ ] Keep `docs/rules/eight-ball-rules.md` aligned with enforcement.
- [x] Rename storage keys from `pool2d` to `RailRush` (migration in `src/settings/StorageKeys.ts`).

## Agent Rules
1.  **Context First**: Always check `AI_RULES.md` to understand the big picture before diving into specific files.
2.  **Update State**: If you complete a task listed in "Active Todo List", mark it as done `[x]` in this file.
3.  **Maintain Consistency**: Ensure new UI elements match the "Arcade" aesthetic defined in `design-tokens.css`.
4.  **Verify**: Always verify your changes against the "Current State" and "Project Context".
