# Miniclip-Style UI Canvas Roadmap (Archived)

> This document is archived. For current status and priorities, see `PROJECT_STATUS.md`.

## Goals
- Replace stacked modals with cinematic full-screen canvases that mimic Miniclip 8 Ball Pool navigation.
- Keep the gameplay renderer persistent underneath while overlaying dedicated lobby/shop/profile "screens."
- Maintain legacy dock tooling (Shift+L) for developers, but hide it from the default user flow.

## Proposed Architecture

### Layering
1. **Base Layer** - Existing Three.js gameplay canvas and debug canvas remain untouched.
2. **UI Scene Canvas** - A fullscreen `<canvas id="ui-stage">` that renders lobby, shop, profile, etc. Scenes swap with cross-fades/slide transitions.
3. **HUD Overlay** - Lightweight DOM layer for turn indicators, fouls, pause button. Remains visible (or fades) while UI canvases swap.
4. **Dev Overlay** - DockBridge + legacy panels, hidden by default but toggleable for tuning.

### Navigation & State
- Introduce a `UIStateMachine` (or extend `GameStateMachine`) with states such as `LOBBY`, `PLAY_MODES`, `SHOP`, `PROFILE`, `IN_GAME`, `IN_GAME_MENU`.
- Listen for `ui:goto:*` events to transition states. Each transition triggers a scene change plus UISoundService cues.
- ESC toggles between `IN_GAME` ↔ `IN_GAME_MENU`. Lobby actions (Play, Shop, Profile) swap the UI scene without relying on modals.

### Scene Rendering
- Each scene module owns its draw/update loop on the `ui-stage` canvas (or its own absolutely positioned canvas if we prefer DOM isolation).
- Build a simple retained-mode scene graph (panels, cards, buttons) with hit-testing mapped to pointer/touch events.
- Reuse design tokens for gradients/glows by pre-rendering textures or using Canvas gradients.

### Input & Accessibility
- Canvas scenes need virtual focus handling: maintain a tree of focusable nodes, provide keyboard navigation (arrows/tab) and an on-canvas focus ring.
- Offer hidden DOM fallbacks (aria-live regions or mirrored menu lists) so assistive tech can navigate the same structure.

## Implementation Phases

### Phase 1 - Infrastructure (Implemented)
1. `UIRoot` stacking order: gameplay canvas → debug → UI stage (`#ui-stage`) → HUD → DockBridge.
2. `UIStateMachine` with states `LOBBY`, `PLAY_MODES`, `SHOP`, `PROFILE`, `IN_GAME`, `IN_GAME_MENU`.
3. `SceneController` that mounts/unmounts scene modules on `#ui-stage` and orchestrates transitions.
4. Existing `#ui-canvas` is reserved strictly for in-game overlays (cue, aim lines, pocket highlights) and is never used for scenes.
5. `InputManager` and `Game` input handlers are gated on `UIState` so gameplay input only runs while in `IN_GAME`.
6. `UIRoot` hides `#ui-canvas` when state != `IN_GAME` so full-screen scenes are never visually mixed with the cue/aim overlay.

### Phase 2 - Scene Ports (In Progress)
1. **Lobby Scene** (implemented) - Canvas-based hero + cards on `#ui-stage`, with `BACK TO TABLE` and `Esc` returning to `IN_GAME`.
2. **Play Modes Scene** (prototype) - Slides in from Lobby and feeds back into `IN_GAME` but still uses placeholder art and options.
3. **Shop Scene** (placeholder) - Currently a temporary slate with a Back button. Needs cue carousel, rarity badges, and equip CTA backed by `SettingsManager`.
4. **Profile Scene** (placeholder) - Same story as Shop; still needs the ported modal layout, player stats, and CTA chips.
5. **Settings Scene** - Not started. Will replace the existing modal stack once Profile/Shop prove out the canvas UI tree.
6. **League Scene** (Implemented) - Full-screen standings list with dynamic headers, sticky section headers, and premium visual styling.

### Phase 3 - Transitions & Effects (Partially implemented)
- **Done**: SceneController supports cross-fade, slide-left, and slide-right transitions plus UISoundService hooks.
- **Pending**: Fancy motion (particles, dynamic hero layers) and contextual transition selection per scene.

### Phase 4 - Pause & HUD Integration
- Replace pause modal with `IN_GAME_MENU` scene (full-screen overlay on `#ui-stage`).
- Ensure HUD indicators can optionally sit on top or hide during full-screen scenes.
- Pause **gameplay input and overlays** by relying on `UIState` guards (input + `UIRoot` visibility), not ad-hoc flags in `Game`.

### Phase 5 - Dock Sunset & Polish
- Once all workflows exist in scenes, keep DockBridge only as a dev toggle.
- Optimize canvas rendering (batched draws, offscreen buffers) and add responsive layouts for tablet/mobile widths.

## Next Steps
1. Replace the placeholder Shop/Profile canvases with real layouts that match the neon/metallic design tokens (carousel, focus management, etc.).
2. Define data contracts for scenes (Play Modes configs, Shop inventory, Profile stats) and how they call into `Game`, `SettingsManager`, and the existing modal APIs.
3. Plan asset pipeline (textures, fonts) for canvas drawing so scenes no longer depend on bare Arial fills.
4. When extending the scene system, confirm:
   - `UIState` transitions are correct.
   - Input is gated by `UIState === IN_GAME` for gameplay behaviors.
   - `#ui-canvas` is only visible during `IN_GAME` and never used by scenes.
