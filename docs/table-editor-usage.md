# Table Editor (Devtool) Usage

## Run

- Start everything: `npm run dev`
- Open: `http://localhost:3000/devtools/table-editor.html`

This starts:
- Vite dev server (default `:3000`)
- Relay server for Push-to-game (default `:8080`)
- Table editor save server (default `:8090`)

## Core workflow

- **Tables tab**: create/duplicate/delete tables (stored in IndexedDB)
- **Edit**: click `Edit` then drag handles
  - Handles are intentionally minimal until you select something:
    - Always visible: pocket centers (sphere), rail move midpoints (pink box)
    - Visible after selecting a pocket: pocket outline points + radius handle
    - Visible after selecting a rail: rail endpoints + outline points
- **Mirror**: enabled by default (toggle via `Mirror`)
- **Resize**: use the `Resize` tab (non-uniform supported)
- **JSON**: open bottom panel, edit JSON, `Apply`

## Derived play-area rails

- The editor treats `play_area_*` rails as **derived/locked**.
- They are regenerated from `playArea.width/height` and used by the game as the primary collision rails (split around pockets).
- The editor does not render them by default; use `Measure` to show a derived play-area outline.

## Save to disk

- `Save to Disk` writes to `src/geometry/tables/<name>.physics.json`
- `Set Active` also overwrites `src/geometry/table.physics.json`

## Push to game

- `Push Live` sends a runtime-only geometry override (wins for the current session even if a persisted override exists)
- `Push (Persist)` persists the override in the game's localStorage key `railrush.physicsJsonOverride` and triggers a rebuild
- `Clear Game Override (Persisted)` clears `railrush.physicsJsonOverride` and rebuilds

## Recovery / safety

- `Repair Geometry`: fixes invalid points/NaNs so handles keep working
- `Check Geometry`: warns if geometry looks “valid but wrong” and offers `Reset From Template`
- `Reset From Template`: restores rails/pockets from the built-in template while keeping your play-area size/PPI
- `Restore Factory Table (Editor)`: reloads `src/geometry/table.physics.json` into the active editor table (undoable)
- `Factory Reset Editor`: clears editor storage (IndexedDB tables/skins + `table-editor-*` prefs)
