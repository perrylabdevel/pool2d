# Table Editor Devtool (Current Design)

> **Status:** Implemented (iterating)
> **Entry:** `devtools/table-editor.html`

## Goals

- Manage a library of pool table physics JSON variants
- Visual edit of pockets + rails with mirror editing
- Safe recovery from bad edits
- Push edited geometry/skins to a running game (live or persisted)
- Save table JSONs into the repo (`src/geometry/tables/*.physics.json`)

## Architecture

- **UI**: `devtools/table-editor.html`
- **App**: `devtools/table-editor/TableEditorApp.ts`
- **Preview/handles**: `devtools/table-editor/components/TablePreview.ts`
- **Geometry ops**: `devtools/table-editor/utils/TableGeometryUtils.ts`
  - sanitize, scale, apply edits, resymmetrize
  - treats `play_area_*` rails as derived/locked
- **Storage (IndexedDB)**:
  - `devtools/table-editor/stores/EditorDb.ts`
  - `devtools/table-editor/stores/TableLibraryStore.ts`
  - `devtools/table-editor/stores/SkinStore.ts`
- **Template source JSON**: `src/geometry/table.physics.json`

## Persistence model

- **Editor tables/skins**: IndexedDB database `RailRush_TableEditor`
- **Editor prefs**: `localStorage` keys prefixed with `table-editor-`
- **Game persisted override**: `localStorage` key `railrush.physicsJsonOverride` (set by Push Persist, cleared by Clear Game Override)

## Game integration

- Devtool sends `table-editor:push-config` over relay WebSocket (`:8080`).
- Game receives in `src/debug/RemoteBridge.ts` and calls `setPhysicsJsonOverride(...)` in `src/geometry/Geometry.ts`.
- `Push Live` sets a session-only override (wins over any stored override for that session).
- `Push (Persist)` stores the override and triggers a rebuild.

## Collision model (important)

- `cushion_*` rails are treated as **visual outlines** (used by renderer and to derive jaw rails).
- Physics collisions use `play_area_*` rails (split around pockets) plus derived `_jaw_` rails.
- To avoid “sprouting” collision lines, physics ignores `cushion_*` rails when `play_area_*` rails exist.

## Save-to-disk workflow

- Save server: `scripts/table-editor-save-server.js` (default `:8090`)
- Writes:
  - `src/geometry/tables/<name>.physics.json`
  - optionally overwrites `src/geometry/table.physics.json` (“Set Active”)

