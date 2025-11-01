# Refactor & Cleanup Plan

This checklist captures follow-up work uncovered while decoupling the frame outline from the rail geometry. It groups tasks by area so we can schedule focused cleanup passes instead of ad‑hoc tweaks.

## 1. Geometry & Physics
- **Derive tests for `frameOutline`:** add unit coverage that asserts rail endpoints remain fixed when `FRAME_CORNER_RADIUS_IN` changes, and that frame inner/outer dimensions track the config.
- **Cull dead clipping flags:** remove the `allowFrameClipping`/`shouldClipRails` scaffolding in `Renderer3D.initializeRails` now that rails never trim against the frame.
- **Centralise frame math:** expose helpers (e.g. `computeFrameOutline()`), so both renderers and any future exporters consume a single source instead of duplicating inline math.
- **Document contracts:** expand `geometry.md` with explicit diagrams / coordinate callouts for `frameOutline` and how `rails` should be consumed by physics integrations.

## 2. Rendering (2D & 3D)
- **Texture caching:** reuse `CanvasTexture` instances for frame highlights and shadows instead of recreating them per renderer instance.
- **Renderer parity:** align the 2D highlight/clip behaviour with the 3D renderer so debug visuals match production rendering, or explicitly document the divergence.
- **Layer/ordering audit:** consolidate duplicated `renderOrder` assignments sprinkled through `initializeRails`, `applyFrameRenderOrder`, and the layer manager.
- **Prune unused helpers:** remove legacy helpers like `intersectLineWithCornerArc` in the 2D renderer now that we no longer clip rails against rounded frames.

## 3. UI & Settings
- **Typed settings keys:** replace stringly-typed slider ids with a shared enum or literal union reused by `SettingsPanel`, `SettingsManager`, and `CONFIG`.
- **Import/export parity:** ensure `Copy Config` includes the new aim-assist fields and verify round-trip loading produces identical state.
- **Panel cohesion:** extract repeated slider wiring logic (`sliderRow`, `setSimpleSlider`, etc.) into a shared utility to reduce divergence between panels.

## 4. Testing & Tooling
- **Scenario regression:** add automated geometry sweeps (e.g. frame radius, jaw offsets) that render to images or capture rails to catch future couplings.
- **Visual regression hooks:** integrate a lightweight screenshot diff for the frame highlight so shader/texture tweaks stay intentional.
- **CI coverage:** wire Vitest (or alternative) into CI and widen coverage to geometry derivations and settings persistence.

## 5. Build & Distribution
- **Chunk splitting:** follow Vite’s warning by introducing manual chunks or lazy-loading heavy panels to push bundles back under 500 kB.
- **Asset pipeline:** cache-bust or compress large textures (pocket highlight/shadow) if they grow with future tweaks.

## 6. Documentation & DX
- **Developer guide:** extend `docs/` with a “rendering architecture” note describing frame/rail layering, highlight textures, and z-order expectations.
- **Issue templates:** create GitHub templates for geometry/visual/physics regressions so bug reports capture the required configuration.
- **Contribution checklist:** add a CONTRIBUTING.md outlining test/build/doc expectations before commits.

Track progress by converting these bullets into GitHub issues or a project board. The goal is to tackle them in themed sprints (geometry, rendering, UI) rather than scattershot fixes.
