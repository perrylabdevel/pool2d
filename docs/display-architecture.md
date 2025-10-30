# Display & Scaling Architecture

This document explains how the visual display is composed, scaled, and kept aligned across canvases. It also clarifies the separation between table scaling and ball scaling, and how the camera framing is derived.

## Overview

- World units are inches. Table play area is `100 x 50` inches with origin at center and +Y up.
- Rendering uses an orthographic top‑down camera (`Renderer3D`).
- Three layered surfaces are used:
  - WebGL game canvas (table, balls, frame, lights)
  - 2D UI canvas for overlays (aim lines, cue, measurements)
  - Optional debug canvas (rails, pockets, clamp guides, etc.)
- Layout reacts to window/dock changes and dispatches a `renderer:resized` event so input and debug overlay stay aligned.

## Canvases & Alignment

- `Renderer3D.resize()` computes canvas size and on‑screen offsets. It applies those offsets to:
  - WebGL canvas (main)
  - UI canvas (`#ui-canvas`)
  - Reference overlay (if present)
- After every resize, `Renderer3D` dispatches `window.dispatchEvent(new CustomEvent('renderer:resized', { detail }))` with:
  - `width`, `height`, `scale`, `offsetX`, `offsetY`
- `Game` listens for `renderer:resized` and updates:
  - `Input.updateScale(scale)` for proper screen→world conversion
  - `DebugDraw.resize(width, height, scale, offsetX, offsetY)` so the debug canvas matches position/size

## Coordinate Systems

- World: inches, origin at table center, +X right (East), +Y up (North/head).
- Screen: pixels, origin top‑left, +Y down.
- `Renderer3D.worldToScreen(x, y)` projects world to UI/Debug canvases so all overlays align with 3D.

## Sizing & Scaling

Key config:
- `CONFIG.CANVAS_SCALE_MULTIPLIER` — user “Table Scale” (visual size).
- `CONFIG.CUE_LENGTH_IN` — visual cue length in world inches.
- `CONFIG.CUE_VISUAL_PADDING_IN` — extra space around table for cue visibility.
- `CONFIG.MIN_WORLD_PADDING_IN` — lower bound for world padding.

Framing & scale:
1. Compute world padding (in inches), independent of current scale:
   - `padWorldIn = max(MIN_WORLD_PADDING_IN, CUE_LENGTH_IN + baseBallRadius + 5 + CUE_VISUAL_PADDING_IN)`
   - Uses the base/unscaled ball radius so ball visual scale changes do not reframe the camera.
2. Compute base scale to fit table + padding into available pixels:
   - `scaleX = availableWidth / (TABLE_WIDTH + 2*padWorldIn)`
   - `scaleY = availableHeight / (TABLE_HEIGHT + 2*padWorldIn)`
   - `scale = min(scaleX, scaleY) * CANVAS_SCALE_MULTIPLIER`
3. Canvas size (pixels):
   - `widthPx = (TABLE_WIDTH + 2*padWorldIn) * scale`
   - `heightPx = (TABLE_HEIGHT + 2*padWorldIn) * scale`
4. Ortho camera frustum (world inches):
   - `left/right = ±(TABLE_WIDTH/2 + padWorldIn)`
   - `top/bottom = ±(TABLE_HEIGHT/2 + padWorldIn)`

Implications:
- “Table Scale” changes visual size only (no physics changes).
- Ball visual scale does not affect framing; it only rescales meshes and physics ball radius (and triggers a controlled restart).

## Table Scale vs Ball Scale

- Table Scale (`CANVAS_SCALE_MULTIPLIER`)
  - Triggers a `resize()` and changes visual size of everything consistently.
  - Does not affect physics.
- Ball Scale (`BALL_SCALE`)
  - Updates ball mesh scale and physics ball radius.
  - Game restarts when this value changes to keep the world consistent.
  - Camera framing is unaffected (padding uses base radius).

## Layers & Z‑Order

- Layer visibility and ordering are controlled in `Renderer3D`.
- Z‑index is enforced for:
  - Game (WebGL) canvas
  - UI canvas (2D overlays)
  - Reference overlay (optional image)
  - Debug canvas (always top when visible)

## Cue Rendering & Visibility

- Cue stick is drawn on the UI 2D canvas.
- The cue line is no longer clamped to rails; it can extend into the padded world area so it doesn’t clip when the cue ball is near rails.
- World padding is sized to accommodate cue length + a safety margin.

## Debug Overlay

- Toggle with `D` (and `B` for ball‑in‑hand overlay data).
- The overlay uses `worldToScreen()` for all elements and always resizes/moves with the renderer via `renderer:resized`.
- Ball‑in‑hand diagnostics (optional) can draw corner “mouth chords” used by placement clamping.

## Events & Reflow Handling

- `settings:render-changed`
  - Game restarts only if `ballScale` changed.
  - Game resizes only if `canvasScale` changed.
  - Pure color/intensity changes do not trigger resize/restart (prevents flicker).
- `renderer:resized`
  - Consumers update input scaling and debug overlay position/size to remain aligned.
- Resize re‑entrancy is guarded in `Renderer3D` to avoid Observer loops.

## Common Pitfalls (and Current Protections)

- Tiny table after resize: avoided by computing padding in world units and deriving scale from `(table + padding)`.
- Flicker on color changes: avoided by ignoring non‑size updates in resize/restart logic.
- Overlay drift: avoided by broadcasting `renderer:resized` and aligning all canvases with the same offsets.

## Extending the Display

- To add new overlays:
  - Render on the UI canvas if they’re part of normal gameplay visuals.
  - Render on the Debug canvas if they’re tooling/instrumentation.
  - Use `worldToScreen()` for all world‑space drawings.
  - Listen to `renderer:resized` to stay aligned.
- To change framing behavior:
  - Adjust `MIN_WORLD_PADDING_IN` or `CUE_VISUAL_PADDING_IN` for more/less headroom.
  - Keep padding in world units so scale changes remain stable.

## Quick Checklist

- Changing table size visually? Update `CANVAS_SCALE_MULTIPLIER`.
- Changing ball appearance/physics? Update `BALL_SCALE` (Game will restart).
- Need more room for the cue near rails? Increase `CUE_VISUAL_PADDING_IN` (or `CUE_LENGTH_IN`).
- Overlay misaligned? Verify `renderer:resized` is received and `DebugDraw.resize(...)` is called.
