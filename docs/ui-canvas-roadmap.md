# Miniclip-Style UI Canvas Roadmap

## Goals
- Replace stacked modals with cinematic full-screen canvases that mimic Miniclip 8 Ball Pool navigation.
- Keep the gameplay renderer persistent underneath while overlaying dedicated lobby/shop/profile “screens.”
- Maintain legacy dock tooling (Shift+L) for developers, but hide it from the default user flow.

## Proposed Architecture

### Layering
1. **Base Layer** – Existing Three.js gameplay canvas and debug canvas remain untouched.
2. **UI Scene Canvas** – A fullscreen `<canvas id="ui-stage">` that renders lobby, shop, profile, etc. Scenes swap with cross-fades/slide transitions.
3. **HUD Overlay** – Lightweight DOM layer for turn indicators, fouls, pause button. Remains visible (or fades) while UI canvases swap.
4. **Dev Overlay** – DockBridge + legacy panels, hidden by default but toggleable for tuning.

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

### Phase 1 – Infrastructure
1. Add `UIRoot` stacking order: gameplay canvas → debug → UI stage → HUD → DockBridge.
2. Implement `UIStateMachine` and event bus for `ui:goto:*` transitions.
3. Create SceneController that mounts/unmounts scene modules and orchestrates transitions.

### Phase 2 – Scene Ports
1. **Lobby Scene** – Recreate Home Hub hero, mode cards, footer actions entirely in the UI canvas.
2. **Play Modes Scene** – Mode briefing cards, CTA buttons, rules summary.
3. **Shop Scene** – Cue carousel with rarity badges and equip CTA, rendered in canvas.
4. **Profile & Settings Scenes** – Port existing modal content.

### Phase 3 – Transitions & Effects
- Add cross-fade / slide animations between scenes.
- Hook UISoundService events for scene enter/exit.
- Integrate background particles/shimmers for lobby hero.

### Phase 4 – Pause & HUD Integration
- Replace pause modal with `IN_GAME_MENU` scene (full-screen overlay on UI canvas).
- Ensure HUD indicators can optionally sit on top or hide during full-screen scenes.

### Phase 5 – Dock Sunset & Polish
- Once all workflows exist in scenes, keep DockBridge only as a dev toggle.
- Optimize canvas rendering (batched draws, offscreen buffers) and add responsive layouts for tablet/mobile widths.

## Next Steps
1. Prototype SceneController + simple lobby canvas to validate layering/perf.
2. Decide between single shared canvas vs. per-scene canvases swapped via CSS (`display: none`).
3. Define data contracts for scenes (Play Modes, Shop inventory, Profile stats).
4. Plan asset pipeline (textures, fonts) for canvas drawing.

Delivering this roadmap ensures the UI feels closer to Miniclip’s screen-to-screen flow while keeping the underlying game systems intact.
