# RailRush Refactor Plan

> **Last Updated:** December 13, 2025  
> **Status:** Planning Phase  
> **Scope:** Full codebase architectural refactor

---

## Executive Summary

This document outlines a comprehensive refactoring strategy for the RailRush codebase. The project has grown organically with a functional physics engine, rendering system, and UI layer, but several architectural issues have accumulated that impede maintainability, testability, and feature development.

**Key Metrics (Current State):**
| File | Lines | Size | Concern |
|------|-------|------|---------|
| `src/game/Game.ts` | ~3,044 | 110KB | God class - orchestrates everything |
| `src/ui/SettingsManager.ts` | ~1,220 | 46KB | Monolithic settings blob |
| `src/render/Renderer.ts` | ~1,800 | 58KB | Legacy 2D renderer (mostly debug) |
| `src/geometry/Geometry.ts` | ~1,200 | 43KB | Complex derived geometry |
| `src/ui/scenes/ShopScene.ts` | ~1,400 | 48KB | Large UI scene |
| `src/ui/scenes/SettingsScene.ts` | ~1,800 | 63KB | Large UI scene |

---

## 🔴 Critical Questions for You

Before proceeding with detailed implementation, I need your input on several architectural decisions:

### 1. **Scope & Timeline**
- [ ] **Is this a "big bang" refactor or incremental?** Should we refactor in isolated phases that can be merged independently, or do you prefer a comprehensive branch?
- [ ] **What's your tolerance for breaking changes?** Can we rename storage keys (`pool2d_*` → `RailRush_*`) and break save compatibility?
- [ ] **What's your timeline priority?** Multiplayer backend, mobile polish, or code quality first?

### 2. **Architecture Direction**
- [ ] **Event System**: Currently using `window.dispatchEvent` for cross-module communication. Should we:
  - (A) Formalize with a typed `EventBus` singleton?
  - (B) Move to a pub/sub library like `mitt`?
  - (C) Keep `window` events but document them better?
  
- [ ] **State Management**: Settings/game state is scattered. Should we:
  - (A) Keep separate managers but standardize interfaces?
  - (B) Introduce a unified store (Redux-like pattern)?
  - (C) Keep current approach with better organization?

- [ ] **Dependency Injection**: The `Game` class creates all its dependencies internally. Should we:
  - (A) Keep constructor creation but extract factory methods?
  - (B) Introduce a service locator/container?
  - (C) Pass dependencies via constructor (pure DI)?

### 3. **Legacy Code**
- [ ] **Legacy 2D Renderer** (`Renderer.ts`, 58KB): This appears to be mostly for debug visualization. Should we:
  - (A) Keep it as-is for debugging?
  - (B) Merge useful parts into `Renderer3D` and delete?
  - (C) Extract to a separate debug-only module?

- [ ] **Legacy DOM Panels** (`DockBridge`, `GeometryPanel`, `SettingsPanel`, etc.): These are accessible via `Shift+L`. Should we:
  - (A) Keep them for development but exclude from production builds?
  - (B) Migrate functionality to canvas scenes and delete?
  - (C) Keep indefinitely as power-user tools?

- [ ] **HubSettings.ts vs SettingsScene.ts**: There appear to be two settings UIs. Which is canonical?

### 4. **Code Style**
- [ ] **Prefer classes or functions?** The codebase mixes both. Should new code favor:
  - (A) Classes with methods (current style)?
  - (B) Functional composition with pure functions?
  - (C) Mix based on context?

- [ ] **Test coverage expectations?** Currently minimal tests (`Physics.test.ts`). Target coverage?
  - (A) Critical paths only (physics, rules)?
  - (B) Comprehensive unit tests?
  - (C) Integration/E2E tests priority?

### 5. **Specific Modules**
- [ ] **Editor** (`src/editor/`): This is a separate React app for table editing. Should it:
  - (A) Remain separate?
  - (B) Be integrated into the main app?
  - (C) Be deprecated/removed?

- [ ] **Texture System** (`src/textures/`): Procedural texture generation is partially implemented. Should we:
  - (A) Complete it as planned?
  - (B) Defer until after refactor?
  - (C) Remove and use static textures?

---

## 📋 Identified Issues

### 1. God Class: `Game.ts` (CRITICAL)

**Current State:** `Game.ts` is 3,044 lines and handles:
- Game loop (update/render)
- Input processing (mouse, touch, keyboard)
- Shooting mechanics (aim, power, execution)
- Ball-in-hand logic
- Pocket selection UI
- AI orchestration
- Mode switching (Practice, 8-Ball, Time Attack, etc.)
- Match lifecycle (start, end, rewards)
- Panel registration
- Audio preview handling
- Playback control
- ... and more

**Proposed Decomposition:**

```
src/game/
├── Game.ts              # Slim orchestrator (~300 lines)
├── GameLoop.ts          # RAF loop, timing, pause/resume
├── GameController.ts    # High-level game flow
├── input/
│   ├── ShootingController.ts  # Aim, power, shot execution
│   ├── BallInHandController.ts # BIH drag, placement
│   └── PocketSelectionController.ts # Called pocket UI
├── modes/
│   ├── ModeManager.ts   # Mode switching logic
│   ├── PracticeMode.ts  # (existing)
│   ├── EightBallMode.ts # 8-ball specific logic (extracted from Game.ts)
│   └── ... 
├── ai/
│   └── AIController.ts  # AI turn orchestration (extracted from Game.ts)
└── match/
    ├── MatchManager.ts  # Match lifecycle, rewards
    └── MatchResult.ts   # End-of-match processing
```

### 2. Settings Sprawl (HIGH)

**Current State:**
- `CONFIG` object in `src/config.ts` - static defaults
- `SettingsManager` - runtime settings with localStorage persistence
- Multiple settings interfaces (`GameSettings`, `PhysicsSettings`, `RenderSettings`, etc.)
- Settings applied via `Object.assign(CONFIG, ...)` mutations
- Events: `settings:game-changed`, `settings:audio-changed`, `settings:render-changed`

**Issues:**
- CONFIG is mutated at runtime, making it hard to know "default" vs "current"
- Large interfaces with many optional fields
- Duplication between interface definitions and CONFIG keys
- No validation or schema

**Proposed Solution:**

```typescript
// src/settings/
├── SettingsSchema.ts    # Zod or io-ts schemas with defaults
├── SettingsStore.ts     # Unified store with typed get/set/subscribe
├── SettingsMigration.ts # Version migrations for localStorage
└── presets/
    ├── DefaultPreset.ts
    ├── TournamentPreset.ts
    └── CasualPreset.ts
```

### 3. UI Architecture Complexity (HIGH)

**Current State:** Multiple UI systems coexist:
1. **Canvas Scenes** (`src/ui/scenes/`) - New Miniclip-style UI
2. **DOM Modals** (`ModalService`) - Legacy modal system
3. **DOM Panels** (`src/ui/panels/`, `DockBridge`) - Debug/dev panels
4. **HUD DOM** (`index.html` elements, `HUD.ts`)
5. **Legacy Hubs** (`HubSettings.ts`, `HomeHub.ts` - if exists)

**Issues:**
- Unclear which system to use for new features
- `SceneController` and `UIStateMachine` partially overlap
- Some scenes are 1000+ lines (ShopScene, SettingsScene)
- Touch handling duplicated across systems

**Proposed Solution:**
1. **Consolidate to Canvas Scenes** as the primary UI system
2. **Extract reusable components** from large scenes
3. **Deprecate DOM modals** except for HUD elements
4. **Keep dev panels** but gate behind dev mode

```
src/ui/
├── scenes/           # Primary UI (canvas-based)
│   ├── base/
│   │   └── BaseScene.ts  # Common scene functionality
│   └── ...
├── components/       # Reusable canvas components
│   ├── Card.ts
│   ├── Button.ts
│   ├── Slider.ts
│   ├── TabBar.ts
│   └── ...
├── hud/              # In-game HUD (DOM-based, minimal)
│   └── HUD.ts
└── dev/              # Development-only panels
    └── ...
```

### 4. Event System Chaos (MEDIUM)

**Current State:** Communication via window events:
```typescript
// Examples found in codebase:
'settings:game-changed'
'settings:audio-changed'
'settings:render-changed'
'audio:preview'
'game:restart'
'game:pause'
'game:resume'
'game:debug-toggle'
'ui:state:changed'
'ui:request-confirm-exit'
'geometry:updated'
// ... and more
```

**Issues:**
- No type safety for event payloads
- No central documentation
- Easy to misspell event names
- Hard to trace event flow

**Proposed Solution:**
```typescript
// src/events/EventBus.ts
export const GameEvents = {
  RESTART: 'game:restart',
  PAUSE: 'game:pause',
  RESUME: 'game:resume',
  // ...
} as const;

export interface GameEventPayloads {
  [GameEvents.RESTART]: void;
  [GameEvents.PAUSE]: void;
  [GameEvents.RESUME]: void;
  // ...
}

class TypedEventBus {
  emit<K extends keyof GameEventPayloads>(event: K, payload: GameEventPayloads[K]): void;
  on<K extends keyof GameEventPayloads>(event: K, handler: (payload: GameEventPayloads[K]) => void): () => void;
}

export const eventBus = new TypedEventBus();
```

### 5. Geometry System Complexity (MEDIUM)

**Current State:**
- `Geometry.ts` (43KB) - Complex pocket/rail derivation
- `ModernGeometry.ts` - Alternative geometry system
- `GeometryConversion.ts` - Conversion utilities
- `table.physics.json` - Figma-exported geometry
- Multiple "override" fields in CONFIG

**Issues:**
- Two geometry systems (legacy vs modern)
- Complex derivation logic for jaw angles, throat widths
- Unclear which is authoritative

**Proposed Solution:**
1. **Pick one geometry system** as canonical
2. **Simplify to data-driven approach** - load from JSON, minimal derivation
3. **Extract visualization** to debug-only module

### 6. Renderer Organization (MEDIUM)

**Current State:**
- `Renderer3D.ts` (35KB) - Main Three.js renderer
- `Renderer.ts` (58KB) - Legacy 2D canvas renderer
- `components/` - TableRenderer, BallRenderer, CueRenderer, FXRenderer

**Issues:**
- Legacy renderer is larger than the active one
- Some debug drawing in Renderer3D that could be extracted

**Proposed Solution:**
1. **Keep component split** (Table/Ball/Cue/FX)
2. **Extract debug visualization** to separate module
3. **Deprecate or minimize** legacy 2D renderer

### 7. Code Duplication (LOW)

**Examples Found:**
- `HUD.ts` line 56-64: `registerPanel('game-settings', ...)` called twice
- Similar button handling patterns across scenes
- Repeated localStorage key strings

**Proposed Solution:**
- Extract constants for storage keys
- Create scene base class with common patterns
- Lint rules to prevent duplicate registrations

---

## 🗓 Proposed Phases

### Phase 1: Foundation (Est. 2-3 days)
1. **Event System** - Create typed EventBus, migrate critical events
2. **Settings Store** - Unified settings with schema validation
3. **Storage Keys** - Centralize and optionally rename (`pool2d_*` → `RailRush_*`)

### Phase 2: Game.ts Decomposition (Est. 3-5 days)
1. Extract `ShootingController`
2. Extract `BallInHandController`
3. Extract `AIController`
4. Extract `MatchManager`
5. Slim `Game.ts` to orchestrator role

### Phase 3: UI Consolidation (Est. 2-4 days)
1. Create `BaseScene` with common functionality
2. Extract reusable components from large scenes
3. Deprecate unused DOM modal code
4. Document UI architecture

### Phase 4: Cleanup (Est. 1-2 days)
1. Remove dead code
2. Fix duplicate registrations
3. Update documentation
4. Add tests for critical paths

---

## 📁 Proposed Directory Structure

```
src/
├── ai/                    # AI opponents
├── assets/                # Asset loading and registry
├── audio/                 # Audio system (renamed from sound/)
│   ├── AudioManager.ts
│   └── samples/
├── config/                # Configuration
│   ├── defaults.ts        # Default values (immutable)
│   ├── schema.ts          # Settings schema/validation
│   └── presets/
├── data/                  # Database (Dexie)
├── debug/                 # Debug-only tools
│   ├── DebugDraw.ts
│   ├── DevPanels/         # Legacy panels, dev-only
│   └── ...
├── events/                # Event system
│   └── EventBus.ts
├── game/                  # Core game logic
│   ├── Game.ts            # Slim orchestrator
│   ├── GameLoop.ts
│   ├── controllers/       # Input controllers
│   ├── match/             # Match lifecycle
│   └── modes/             # Game modes
├── geometry/              # Table geometry
├── input/                 # Low-level input handling
├── physics/               # Physics engine
├── render/                # Three.js rendering
│   ├── Renderer3D.ts
│   └── components/
├── rules/                 # Game rules
├── settings/              # Settings management
│   ├── SettingsStore.ts
│   └── migrations/
├── textures/              # Procedural textures
└── ui/                    # User interface
    ├── components/        # Reusable UI components
    ├── hud/               # In-game HUD
    ├── scenes/            # Canvas UI scenes
    └── theme/             # Design tokens
```

---

## ✅ Success Criteria

1. **`Game.ts` < 500 lines** - Orchestrator only
2. **No direct CONFIG mutation** - Settings store manages runtime values
3. **Typed events** - All cross-module communication via EventBus
4. **Single UI system** - Canvas scenes for menus, DOM for HUD only
5. **Test coverage** - Physics, rules, and settings have unit tests
6. **Documentation** - Architecture diagram, event catalog, component library

---

## 🚫 Out of Scope (For Now)

- Multiplayer backend implementation
- New game modes
- Major visual redesign
- iOS-specific optimizations
- Performance profiling (defer until after refactor)

---

## Next Steps

1. **Answer the questions above** so I can tailor the approach
2. **Prioritize phases** based on your immediate needs
3. **Create a feature branch** for the refactor work
4. **Establish testing baseline** before major changes

---

*This document will be updated as we progress through the refactor.*
