# Table Geometry & Coordinate Reference

This document captures the authoritative coordinate system, derived jaw geometry, and pocket conventions used throughout Pool 2D. All units are **inches** unless noted otherwise.

## Coordinate System

| Space        | Origin           | Axes                         | Notes                                |
|--------------|------------------|------------------------------|--------------------------------------|
| **World**    | Play-field centre| +X East (right), +Y North (head) | Used by physics, prediction, UI math |
| **Canvas**   | Varies per renderer | Y increases downward            | `Renderer.ts` / `Renderer3D.ts` apply their own transforms |
| **Three.js** | (0, 0, 0) table centre, +Z up | X/Y align with world space | Camera is orthographic top-down      |

### Conversions

```ts
// Renderer.ts / 2D overlay
ctx.translate(canvas.width / 2, canvas.height / 2);
ctx.scale(scale, -scale); // flip Y

// Input.ts (screen → world)
world.x = (screenX - rect.width / 2) / scale;
world.y = -(screenY - rect.height / 2) / scale;
```

## Table Dimensions

- **Play area**: 100" × 50" (standard 9‑foot table)
- **Rails**: Derived from configuration values in `SettingsManager` / geometry panel
- **Ball radius**: 1.125" (2.25" diameter)
- **Capture radii**:
  - `POCKET_RADIUS_CORNER` – default 2.5" (adjustable live)
  - `POCKET_RADIUS_SIDE`   – default 2.5" (adjustable live)

## Derived Jaw Geometry

Geometry derivation lives in `src/geometry/Geometry.ts`. The panel sliders map directly to the following tunables:

| Setting                     | Effect                                                                    |
|-----------------------------|---------------------------------------------------------------------------|
| `FRAME_OFFSET_IN`           | Frame distance from play area (visual reference)                          |
| `SIDE_FRAME_OFFSET_IN`      | Side-pocket jaw origin offset                                             |
| `JAW_REF_RADIUS_IN`         | Control radius for tangent-based side jaw computation                     |
| `SIDE_STRAIGHT_Y_IN`        | Y of straight section before side pocket                                  |
| `SIDE_INNER_Y_IN`           | Inner throat Y (auto-clamped ≥ `SIDE_STRAIGHT_Y_IN + 0.05`)               |
| `CORNER_JAW_REF_RADIUS_IN`  | Tangent reference for corner jaw                                          |
| `CORNER_STRAIGHT_X_IN`      | Start of corner straight along X                                          |
| `CORNER_TARGET_Y_IN`        | Corner throat target Y                                                     |
| `CORNER/ SIDE_POCKET_RADIUS_IN` | Capture radius for the associated pockets                          |

The derivation pipeline:

1. **Side jaws** use the reference radius + frame offset to compute tangent contact (`xi`), then solve for outer/inner X magnitudes that hit the requested straight and inner Y values.
2. **Corner jaws** mirror the same tangent approach, projecting back from the frame offset toward `CORNER_TARGET_Y_IN` to produce a continuous straight → taper.
3. **Rails array** is rebuilt every time geometry settings change (settings panel emits `settings:geometry-apply` → `Game.restart()` → `PhysicsWorld.initializeRails()`).
4. **Pockets** store both centre and capture radius so physics can differentiate corner vs. side sizing.

### Pocket Definitions

```ts
{
  id: 'NW_corner',
  center: { x: -50, y: 25 },
  radius: CONFIG.POCKET_RADIUS_CORNER,
  cutNormalHint: { x: 1, y: -1 } // for visual jaw alignment
}

{
  id: 'N_middle',
  center: { x: 0, y: playHalfHeight + sideOffset },
  radius: CONFIG.POCKET_RADIUS_SIDE,
  cutNormalHint: { x: 0, y: -1 }
}
```

Physics uses the radius for capture detection, while the renderer extrudes a cylinder matching the current pocket size.

## Naming Conventions

To avoid ambiguity across the project:

- Use **N / E / S / W** (or “north/east/…”) instead of “top/bottom/left/right”.
- Rails, jaws, and pockets are named using compass directions (e.g., `N_west_taper`).
- Logging follows `[Geometry]` tags with signed orientation to aid debugging.

## Useful Events

- `settings:geometry-changed` – emitted when the geometry panel persists new values (restarts the world).
- `settings:geometry-apply` – dispatched when “Apply Geometry” is clicked; `Game` restarts immediately.
- `settings:render-changed` – emitted after render settings (including table scale) update.

## Troubleshooting Pointers

- **Corner shots rattling**: Increase `CORNER_TARGET_Y_IN` slightly or raise corner capture radius.
- **Rail cling**: Lower `SLIDING_FRICTION` in the physics settings panel.
- **Ball overlaps after geometry change**: Hit **R** to rebuild the world; rails/pockets are regenerated on restart.

Keep geometry experiments reproducible by exporting settings (`SettingsPanel` → Copy Config) alongside shot capture reports.
