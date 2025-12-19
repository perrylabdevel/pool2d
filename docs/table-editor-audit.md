# Table Editor ↔ Game Geometry Audit

This document audits the current table editor + in-game geometry pipeline, with a focus on reliability: **what you see in the editor should match what the game simulates and renders**, even as table sizes/skins change.

Last updated: 2025-12-19

## Executive Summary

The table editor is already architected around a good core idea: **authoritative JSON geometry** (play area, pockets, rails) stored in IndexedDB and pushed to a running game via a relay. The biggest remaining trust gap is not the editor UI—it's **pipeline drift**:

- The editor previews *authored rails/outlines*, while the game uses **post-processed collision geometry** (derived from `play_area_*` rails + pocket splitting + derived jaws).
- Some authored data (`cushion_*` rail outlines) is treated as “visual” in physics, but is still used indirectly to derive collision (`*_jaw_*`) rails, making small authoring differences produce surprising physics holes or mismatches.

**Highest-leverage fix:** make the editor able to preview (and optionally bake) the *exact collision rails* the game will use, using the same code path.

## Current Architecture (As Implemented)

### Editor components

- Entry: `devtools/table-editor.html`
- App: `devtools/table-editor/TableEditorApp.ts`
- Preview renderer: `devtools/table-editor/components/TablePreview.ts`
- Geometry operations: `devtools/table-editor/utils/TableGeometryUtils.ts`
- Storage:
  - IndexedDB: `devtools/table-editor/stores/EditorDb.ts`, `devtools/table-editor/stores/TableLibraryStore.ts`, `devtools/table-editor/stores/SkinStore.ts`
  - Prefs: `localStorage` keys `table-editor-*`

### Push-to-game integration

- Relay server: `scripts/relay-server.js` (spawned by `scripts/dev-server.js`)
- Push protocol: editor sends `table-editor:push-config` over WS to relay → game receives in `src/debug/RemoteBridge.ts`
- Game override storage:
  - Persisted override: `localStorage["railrush.physicsJsonOverride"]`
  - Session override: in-memory variable in `src/geometry/Geometry.ts`
  - Override setter resets geometry cache: `src/geometry/Geometry.ts:24` (`setPhysicsJsonOverride()` → `resetTableGeometryCache()`)

### Save-to-disk workflow

- Save server: `scripts/table-editor-save-server.js` writes `src/geometry/tables/*.physics.json` (and optionally overwrites `src/geometry/table.physics.json`)

## Current “Source of Truth” Model

### In the editor

- The editor treats `play_area_*` rails as **derived/locked** and regenerates them from `playArea.width/height`:
  - `devtools/table-editor/utils/TableGeometryUtils.ts:9` (`ensureDerivedPlayAreaRails()`)
- User edits primarily affect:
  - pockets (center/radius/outline)
  - cushion rails (`cushion_*`) endpoints/outlines
  - playArea size (which regenerates `play_area_*`)

### In the game (physics)

- When `play_area_*` rails exist, physics **ignores `cushion_*` rails** except jaw rails:
  - `src/physics/Physics.ts:87-92`
- Collisions use:
  - `play_area_*` rails (potentially split around pocket mouths)
  - derived jaw rails (`*_jaw_*`) from cushion outlines (near pockets)
- `src/geometry/Geometry.ts` converts Physics JSON → `TableGeometry`, then `PhysicsWorld` builds `Rail`s and `Pocket`s.

### In the game (render)

- Rendering uses authored rails and outlines more directly (visual fidelity):
  - `src/render/components/TableRenderer.ts` consumes `TableGeometry.rails` and `rail.outline` where present
- Skin scaling uses `meta.pixelsPerInch`:
  - Editor preview: `devtools/table-editor/components/TablePreview.ts`
  - Game render: `src/render/components/TableRenderer.ts:280-320`

## Primary Mismatch Sources (Why Editor != Game)

### 1) Collision rails are post-processed but the editor preview is not

The editor can show “closed” rails/outlines visually, but the game may:
- clamp `play_area_*` rails using cushion outlines
- split `play_area_*` rails around pockets
- introduce/remove jaw rails

Without an editor overlay that shows *the final collision rails*, it’s easy to end up with:
- “looks sealed in editor, leaks in game”
- “outline points that appear inert” (because they affect only visuals or only an indirect derivation)

### 2) Using `cushion_*` outlines as a collision-derivation input is fragile

Even if you conceptually treat cushion outlines as “visual”, the jaw-rail derivation makes them a *physics input* near pockets. Issues observed in practice:
- open vs closed polylines (implicit last→first) causing ghost edges
- inside/outside classification ambiguity near the boundary
- outline points slightly outside the play area producing inverted/short jaw segments
- mismatch between “pocket mouth” as defined by pocket radius vs as implied by cushion outline geometry

### 3) Duplicate types / duplicate logic (drift risk)

There are effectively two copies of the “physics json schema”:
- Editor types: `devtools/table-editor/utils/JsonLoader.ts` + helpers in `TableGeometryUtils.ts`
- Game types: `src/geometry/Geometry.ts` interfaces and logic

Even small differences (e.g., how outlines are interpreted, closure, normals) can cause editor/game divergence over time.

### 4) Derived rails are “locked” in editor but game derives *additional* rails

Editor locks `play_area_*` rails; that’s good. But the game additionally derives jaw rails and may split rails differently than the editor would expect.

## Recommendations (Prioritized)

### P0 — Must-have to “trust the editor”

1) **Editor preview should display “Game Collision Rails”**
   - In the editor, run the same transformation pipeline the game runs (or a shared library version) and render:
     - final `play_area_*` segments after clamping/splitting
     - derived jaw rails
     - final pocket capture radii
   - This immediately reveals holes/mismatches before pushing.

2) **Make collision geometry explicit (stop inferring from decorative outlines)**
   Choose one of:
   - (A) Bake collision rails in editor (“Build collision rails” button) and store them in JSON under a dedicated key or naming convention (e.g. `collisionRails` or `rail.role = "collision"`).
   - (B) Compute collision boundary purely from authoritative primitives: `playArea` + pocket circles (and optionally pocket outlines), without referencing cushion outlines.

   The key goal is: **collision should not depend on visual-only geometry**.

3) **Schema + invariant validation gates**
   Add a “Valid for Game” gate in the editor that fails push/save if invariants aren’t met. Examples:
   - No “open boundary” holes along the play-area boundary excluding the intended pocket openings
   - No rail segments shorter than a minimum
   - All normals are inward (or can be auto-corrected deterministically)
   - Pocket mouths intersect the boundary where expected for the selected pocket model

### P1 — Strongly recommended

4) **Share the geometry code between editor and game**
   - Extract the physics-json → collision-rails pipeline into a shared module (e.g. `src/shared/geometry/*` imported by both game and devtools build).
   - This removes “two implementations” drift.

5) **Version and migrate the JSON**
   - Add a `meta.schemaVersion` and upgrade steps.
   - This helps you evolve data structures (e.g. adding `collisionRails`) safely.

6) **Deterministic serialization**
   - Stable ordering of arrays (by id) and controlled float rounding for save/export.
   - Reduces “mysterious diffs” and makes regressions easier to diagnose.

### P2 — Longer-term / accuracy improvements

7) **Better pocket mouth modeling**
   - Today: a mixture of pocket radius + jaw heuristics.
   - Better: define pocket mouth explicitly via:
     - two boundary intersection points + optional throat curve parameters, or
     - a “mouth chord” segment + jaw segments.
   - This makes both collision and rendering consistent.

8) **Automated regression tests**
   Add a test suite that loads every `src/geometry/tables/*.physics.json` and checks:
   - collision boundary continuity
   - no inverted normals
   - “no-escape” sampling: launch a ball near boundaries at multiple angles and verify it cannot exit except through pockets

## Concrete Technical Suggestions

### A) “Collision Rails” as an explicit concept

Add a field (or convention) so authored vs collision rails are not mixed:

```ts
type RailRole = "render" | "collision";
type PhysicsJsonRail = { id: string; from: Vec2; to: Vec2; normal: Vec2; outline?: Vec2[]; role?: RailRole };
```

Then in-game:
- use `role === "collision"` rails for physics
- use `role !== "collision"` (or all) rails for rendering

This makes editor expectations concrete and debuggable.

### B) “Same pipeline” preview in editor

Add an overlay mode in `TablePreview`:
- `showCollisionRails` toggle
- uses the shared collision derivation code and draws those rails distinctly

### C) Validation tooling

Add a utility (callable from editor and CI) that returns a list of errors/warnings:
- `validatePhysicsJson(json): { errors: string[]; warnings: string[] }`
- Make “Push to Game” fail if `errors.length > 0`.

## Notes / Observations From Recent Bugs

- A recurring source of “holes” is deriving jaw/cut rails from cushion outlines that are:
  - open polylines rendered as if closed
  - slightly outside the play-area boundary
  - long segments that cross the boundary in unexpected places
- The fixes that worked best were those that:
  - anchored trims to **pocket mouth geometry** (not outline coincidences)
  - enforced jaw direction and length deterministically

This reinforces the recommendation to make collision derivation either explicit or purely based on playArea+pocket primitives.

## Reference Files

- Editor:
  - `devtools/table-editor/TableEditorApp.ts`
  - `devtools/table-editor/components/TablePreview.ts`
  - `devtools/table-editor/utils/TableGeometryUtils.ts`
  - `docs/table-editor-plan.md`
  - `docs/table-editor-usage.md`
- Game:
  - `src/debug/RemoteBridge.ts`
  - `src/geometry/Geometry.ts`
  - `src/physics/Physics.ts`
  - `src/render/components/TableRenderer.ts`

