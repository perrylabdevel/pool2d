# Modular Rail/Pocket Skin Plan

## Goal
Add an optional modular rail/pocket asset set that auto-stitches into a single overlay texture compatible with the current full-size `skin.png` pipeline. Keep existing full-skin workflow intact.

## Default decisions (can revise)
- Modular set is **rails + pockets only** (hardware overlay), layered on top of felt/frame.
- Composition happens **in the table editor preview** so seams can be validated before push/export.
- Composition output is a **single texture** used the same way as `skin.png` (PPI scaling preserved).

## Non-goals (initial)
- Replacing all table rendering with 2D Canvas.
- Forcing users to abandon the full-skin workflow.

## Current pipeline summary
- Full overlay is a single texture applied to `TableRenderer` via `skin.png` or a base64 upload.
- Geometry/PPI alignment is managed by the editor + `meta.pixelsPerInch`.

## Proposed data model
New manifest type for modular rail/pocket sets:

- `railPocketSet`
  - `railMiddleTile` (required)
  - `railEndcapLeft` (optional)
  - `railEndcapRight` (optional)
  - `cornerPocket` (required)
  - `sidePocket` (required)
  - `railThicknessPx` (required; canonical thickness)
  - `seamOverlapPx` (default 1-3)
  - `ppi` (optional override; defaults to table PPI)
  - `metadata` (version, author, notes)

Suggested JSON shape (stored alongside existing skin data):

```json
{
  "id": "skin_123",
  "name": "Chrome Rails v1",
  "images": {
    "full": null
  },
  "railPocketSet": {
    "assets": {
      "railMiddleTile": "data:image/png;base64,...",
      "railEndcapLeft": "data:image/png;base64,...",
      "railEndcapRight": "data:image/png;base64,...",
      "cornerPocket": "data:image/png;base64,...",
      "sidePocket": "data:image/png;base64,..."
    },
    "railThicknessPx": 140,
    "seamOverlapPx": 2,
    "ppi": 7.68,
    "metadata": {
      "version": 1,
      "notes": "Seam-cut chrome rails + pockets"
    }
  }
}
```

Storage location:
- Table editor `SkinStore` stores `railPocketSet` alongside the existing `full` skin image.

## Composition pipeline (editor)
- Input: active table geometry + modular assets + PPI.
- Output: a single composite overlay texture (base64 PNG) sized using the same PPI rules as full skins.

Composition steps:
1. Compute rail segment paths from geometry (straight segments between pockets).
2. For each straight segment, tile `railMiddleTile` to match segment length.
3. Place seam-cut pockets at pocket centers with orientation based on rail directions.
4. Optional end caps only for outer boundaries where rails terminate without pockets.
5. Render order: rails first, pockets on top to mask seams.

Suggested placement algorithm (high level):
- Derive play-area polygon and pocket centers from geometry.
- For each rail side (top, bottom, left, right), compute the straight spans between pocket centers.
- Convert span length in inches to pixels via PPI.
- Determine tile count = ceil(spanPx / tilePxWidth), then draw tiles clipped to span.
- For corner pockets: rotate the canonical asset to match the corner (0/90/180/270).
- For side pockets: rotate 0/180 for horizontal, 90/270 for vertical.
- Apply seam overlap: shrink span by `seamOverlapPx * 2` and let pocket assets cover the remainder.

## Placement rules (seams)
- Rail tiles must be axis-aligned and butt on flat seam edges only.
- Pockets must be seam-cut: no extra rail length beyond seam plane.
- Allow a small overlap (1-3 px) from pocket trim over rail tile to hide joints.

## Renderer integration
- Add a new overlay source option: `composed` (rail/pocket set) vs `full` (existing skin).
- Both map to the same `TableRenderer.applySkinFromBase64` API.

Implementation sketch:
- In table editor preview, add a `composeRailPocketOverlay()` step that outputs a base64 PNG.
- Store the composed overlay image in `SkinStore` (cache) to avoid recompute on every frame.
- Push the composed overlay through existing `table-editor:push-config` as `skin.image`.

## Editor UX changes
- Add a "Modular Set" section in the Skins tab:
  - Upload slots for each asset.
  - Set `railThicknessPx`, `seamOverlapPx`, and optional `ppi`.
  - Preview toggle: Full skin vs Modular composite vs Both.
  - One-click "Bake Composite" to generate and store the overlay texture.

Storage changes (SkinStore):
- Extend `TableSkin` to include `railPocketSet` payload and optional `composedOverlay` cache.
- When assets or settings change, invalidate `composedOverlay`.
- When pushing to game, prefer `composedOverlay` if present and user selected modular mode.

## Validation checklist
- Seam check: no bulges or overlaps at joins on all 6 pockets.
- PPI check: composite dimensions match geometry-derived outer frame size.
- Visual check: consistent rail thickness across all pieces.

## Migration
- No changes required for existing full-skin users.
- Modular sets are optional and can be used alongside full skins.

## Rollout/testing
- Visual seam test on 3 table sizes (bar, 7ft, 9ft) with different PPI values.
- Verify composite size matches `frameOutline.outerHalfWidth/Height` at given PPI.
- Check pocket rotation/orientation matches geometry and cut angles.
- Performance: compose once on change, not every frame; cache in `SkinStore`.
