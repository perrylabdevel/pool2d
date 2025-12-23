# RailRush — Project Status & Deliverables

> **Last Updated:** December 23, 2025  
> **Version:** Pre-Alpha  
> **Platform:** Web (Desktop & Mobile), iOS (Capacitor)

---

**Canonical Status Note**

- This document is the single source of truth for current project status and known issues. Older plans/roadmaps are now in `docs/archived/`; refer here for current info.

## Project Overview

**RailRush** is a tournament-grade billiards game targeting a polished, mobile-style experience similar to *Miniclip 8 Ball Pool*. Built with TypeScript, Vite, and WebGL/Three.js.

## Known Issues (High Priority)

- **Touch Aim Mode aim offset:** In the new touch/drag aim-only mode, clicks/drags outside the rendered table can still hijack aim and lock the shot direction (captured angle can be 0°). Needs a screen-space play-area clamp that accounts for renderer scale, padding, and current canvas sizing (not just world play bounds). Workaround: only click/drag within the felt area until fixed.
- **Cue english consistency:** Backspin/side-spin can feel inconsistent across shot setups; debug logging is now available via `CONFIG.DEBUG_SPIN_LOG` while we verify control persistence and contact application.

---

## Core Systems Status

### ✅ Physics Engine
| Feature | Status | Notes |
|---------|--------|-------|
| Deterministic simulation | ✅ Complete | 120Hz fixed timestep |
| Ball-ball collisions | ✅ Complete | Impulse-based solver |
| Ball-cushion collisions | ✅ Complete | Segmented cushion geometry |
| Pocket detection & capture | ✅ Complete | Gravity-based capture zones |
| Spin (english) | 🚧 In Progress | Implemented, tuning + debug underway |
| Prediction/ghost ball | ✅ Complete | Real-time aim assist |

### ✅ Renderer
| Feature | Status | Notes |
|---------|--------|-------|
| Three.js scene | ✅ Complete | Top-down orthographic view |
| PBR felt material | ✅ Complete | Customizable color |
| FBX ball meshes | ✅ Complete | Realistic textures |
| Rail & frame rendering | ✅ Complete | Dynamic shadows |
| Ball icons for HUD | ✅ Complete | Pre-rendered 3D icons |

### ✅ Game Rules (8-Ball)
| Feature | Status | Notes |
|---------|--------|-------|
| Break rules | ✅ Complete | Configurable presets |
| Ball-in-hand | ✅ Complete | Kitchen & anywhere modes |
| Group assignment | ✅ Complete | Solids/stripes on first pocket |
| Foul detection | ✅ Complete | All standard fouls |
| Win/loss conditions | ✅ Complete | 8-ball rules enforced |
| Called pocket (8-ball) | ✅ Complete | Optional rule |

---

## UI/UX Status

### ✅ Design System
| Feature | Status | Notes |
|---------|--------|-------|
| Design tokens (CSS) | ✅ Complete | `design-tokens.css` |
| Arcade button kit | ✅ Complete | `.btn-arcade` classes |
| Color palette | ✅ Complete | Neon/glass aesthetic |
| Typography | ✅ Complete | Orbitron + system fonts |
| Responsive breakpoints | ✅ Complete | Mobile/tablet/desktop |

### ✅ Core Services
| Service | Status | Notes |
|---------|--------|-------|
| ModalService | ✅ Complete | Stacking, swapping, callbacks |
| NotificationService | ✅ Complete | Toast notifications |
| UISoundService | ✅ Complete | Synth UI sounds |
| SceneController | ✅ Complete | Canvas scene management |
| UIStateMachine | ✅ Complete | Navigation state machine |
| Navigation Guard | ✅ Complete | Prevent accidental exit |
| Banner Notifications | ✅ Complete | Full-width canvas overlay |

### ✅ Canvas UI Scenes
| Scene | Status | Notes |
|-------|--------|-------|
| LobbyScene | ✅ Complete | Main menu with card grid |
| PlayModesScene | ✅ Complete | Mode selection, touch scrolling, portrait/landscape |
| ShopScene | ✅ Complete | Cue equipment browser, touch scrolling, responsive cards |
| ProfileScene | ✅ Complete | Stats & achievements |
| SettingsScene | ✅ Complete | Gameplay, colors, audio tabs |
| EventsScene | ✅ Complete | Events browser, touch scrolling, responsive cards |
| LeagueScene | ✅ Complete | Standings with rankings, landscape support |
| ConfirmScene | ✅ Complete | Confirmation dialogs |
| InGameMenuScene | ✅ Complete | Pause menu |
| GoldenSpinScene | ✅ Complete | Reward spin wheel |
| MatchResultScene | ✅ Complete | Post-match summary |

### ✅ UI Components
| Component | Status | Notes |
|-----------|--------|-------|
| NavigationBar | ✅ Complete | Responsive, currencies, settings |
| SceneBackground | ✅ Complete | Themed grid backgrounds |
| Currency Pills | ✅ Complete | Coins, cash, trophies |
| Card layouts | ✅ Complete | Weighted grid system |

### ✅ In-Game HUD
| Feature | Status | Notes |
|---------|--------|-------|
| Player panels | ✅ Complete | Avatar, name, balls |
| Turn indicator | ✅ Complete | Visual + text |
| Ball chips | ✅ Complete | Potted ball tracking |
| Menu button | ✅ Complete | Hamburger icon |
| Creator tool panel | ✅ Complete | Draggable overlay, stays on top |

### ✅ Responsive Design
| Breakpoint | Status | Notes |
|------------|--------|-------|
| Desktop (1024px+) | ✅ Complete | Full layout |
| Tablet (768-1024px) | ✅ Complete | Condensed nav |
| Mobile (<768px) | ✅ Complete | Stacked layouts, hidden currencies |
| Touch scrolling | ✅ Complete | Swipe gestures on Shop, Events, Arcade |
| Mobile landscape | ✅ Complete | Compact nav bars, optimized layouts |
| Responsive cards | ✅ Complete | Consistent widths across all scenes |

---

## Game Modes Status

| Mode | Status | Notes |
|------|--------|-------|
| Practice | ✅ Complete | Solo play, no opponent |
| 8-Ball vs AI | ✅ Complete | Multiple AI opponents |
| Time Attack | ✅ Complete | Clear table before time runs out |
| Perfect Game | ✅ Complete | Clear without missing |
| Speed Pool | ✅ Complete | Race against clock |
| Multiplayer | 🔲 Not Started | Requires backend |

---

## Data & Persistence

| Feature | Status | Notes |
|---------|--------|-------|
| IndexedDB (Dexie) | ✅ Complete | Local data storage |
| User profile | ✅ Complete | Name, avatar, stats |
| Match history | ✅ Complete | Win/loss records |
| Inventory system | ✅ Complete | Cues, items |
| Chest system | ✅ Complete | 4-slot unlock mechanic |
| League standings | ✅ Complete | Cached standings |
| Settings persistence | ✅ Complete | LocalStorage |

---

## Audio System

| Feature | Status | Notes |
|---------|--------|-------|
| AudioManager | ✅ Complete | Web Audio API |
| Ball collision sounds | ✅ Complete | Velocity-scaled |
| Pocket drop sounds | ✅ Complete | Per-pocket |
| UI sounds | ✅ Complete | Hover, click, modal |
| Background music | ✅ Complete | Looping ambient |
| Volume controls | ✅ Complete | Per-category sliders |

---

## AI Opponents

| Feature | Status | Notes |
|---------|--------|-------|
| Opponent registry | ✅ Complete | 12+ AI personalities |
| Difficulty scaling | ✅ Complete | Bronze → Champion tiers |
| Shot selection | ✅ Complete | Best-shot algorithm |
| Aiming variance | ✅ Complete | Skill-based accuracy |
| Dynamic selection | ✅ Complete | Randomized based on club tier |

---

## 🚧 In Progress

| Item | Priority | Notes |
|------|----------|-------|
| Cue english tuning | High | Spin control persistence + contact response validation |
| Focus/keyboard navigation | High | Accessibility for canvas UI (Partially Complete) |

---

## 📋 Backlog (Not Started)

### High Priority
| Item | Notes |
|------|-------|
| Multiplayer matchmaking | Requires backend infrastructure |
| Hero animations | Scene transition effects |
| Pocket selector HUD | Non-blocking in-game pocket selection |

### Medium Priority
| Item | Notes |
|------|-------|
| Cue customization | Patterns, materials, effects |
| Extended achievements | More tracking & rewards |
| Mini-games section | Additional game modes |
| Audio sample selection | Per-event sound variants |
| Progressive Texture Loading | Load high-res textures in background after initial load (Low-res textures look poor on low-end monitors) |

### Low Priority
| Item | Notes |
|------|-------|
| Rename storage keys | `pool2d` → `RailRush` |
| Tournament mode | Bracket-style competition |
| Friends/social | Friend lists, invites |

---

## 🎨 Procedural Texture Generation (Planned)

> **Objective:** Replace flat colors with dynamic, high-fidelity procedural textures for the table felt and frame.

### 1. Texture Generation System
- **Architecture:** `TextureGenerator` service using OffscreenCanvas API (or hidden canvas).
- **Benefits:** Zero asset download size, infinite resolution scaling, dynamic recoloring.
- **Optimization:** Generate once on startup/theme change; cache results in `TextureManager`.

### 2. Felt Texture (Cloth Simulation)
- **Visual Goal:** Realistic billiard cloth (Simonis 860 style) with visible weave and nap.
- **Technique:**
  - **Micro-detail:** High-frequency noise for thread weave.
  - **Macro-detail:** Low-frequency Perlin noise for surface variation/wear.
- **Maps:** Albedo (Color), Roughness (Surface matte/shiny spots), Normal (Weave depth).

### 3. Frame Texture (Material Synthesis)
- **Visual Goal:** High-end furniture finish (Mahogany, Oak, or Brushed Steel).
- **Technique:**
  - **Wood:** Domain-warped Perlin noise stretched along rail axis + turbulence for grain.
  - **Metal:** Directional anisotropic noise for brushed look.
- **Integration:** UV mapping adjustments in `TableRenderer` to align grain with rail direction.

---

## Configuration Constants

| Constant | Location | Value |
|----------|----------|-------|
| `DEFAULT_USER_NAME` | `src/config.ts` | `sosumidude` |
| `DEFAULT_OPPONENT_NAME` | `src/config.ts` | `Opponent` |
| Physics timestep | `src/config.ts` | 120Hz |
| Table dimensions | `src/config.ts` | 100" × 50" |

---

## Key Files & Directories

| Path | Purpose |
|------|---------|
| `src/config.ts` | Game configuration constants |
| `src/data/db.ts` | Database initialization & migrations |
| `src/game/Game.ts` | Main game controller |
| `src/ui/SceneController.ts` | Canvas scene management |
| `src/ui/scenes/` | All UI scenes |
| `src/ui/components/` | Reusable UI components |
| `src/ui/theme/` | Design tokens & layout constants |
| `styles/design-tokens.css` | CSS custom properties |
| `styles/main.css` | Global styles |

---

## Development Commands

```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run preview  # Preview production build
```

---

## Legacy Access

- Press **Shift+L** to toggle legacy debug dock
- Physics tuning panels preserved for development
