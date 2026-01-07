# Modular Rail & Pocket Asset Specifications

This document describes the asset requirements for creating custom modular table skins.

---

## Overview

The modular skin system uses 3 asset types:

| Asset | Purpose | Count |
|-------|---------|-------|
| Rail Middle Tile | Tiled along straight rail sections | 1 |
| Pocket Corner Hole | Overlay at each corner pocket | 4 (rotated) |
| Pocket Side Hole | Overlay at each side pocket | 2 (rotated) |

---

## 1. Rail Middle Tile

The main rail texture, tiled horizontally along the top/bottom rails and vertically along the left/right rails.

### Specifications

| Property | Value |
|----------|-------|
| **Format** | PNG (no transparency needed) |
| **Dimensions** | **Wide Banner Recommended**: e.g., 2048×256 or 4096×512 px (8:1 or 16:1 ratio) |
| **Orientation** | Texture grain runs **horizontally** (left → right) |
| **Seamless** | **Required** - left edge must match right edge perfectly |

### Scaling Behavior

- The tile is scaled so its **height matches `railThicknessPx`** (typically 50-100px)
- **Pro Tip:** Use a very wide image (e.g. 4096px wide). Since it scales by height, a 4096×512 image will span a huge distance before repeating, making seams effectively invisible.
- A 4096×512 tile at 73px rail thickness → ~584px long per tile
- Fewer repeats = fewer visible seams

### How to Create Seamless Tiles

**In Photoshop:**
1. Filter → Other → Offset (set to 50% width, 50% height, Wrap Around)
2. Fix any visible seams in the center
3. Repeat until seams are invisible

**In GIMP:**
1. Filters → Distorts
### 4. Pocket Hole Overlays (Corner & Side)
These are now **Split into two layers** for better depth control:

#### A. Pocket Hole (Shadow/Void)
- **Role:** The dark void or deep interior of the pocket.
- **Placement:** Rendered **BELOW** the Rim, and potentially masked by the rail clipping.
- **Filenames:** `Pocket_Corner_Hole.png`, `Pocket_Side_Hole.png`
- **Resolution:** ~512x512px
- **Alpha:** Should be transparent outside the hole shadow.

#### B. Pocket Rim (Liner)
- **Role:** The physical rubber/leather liner or metal trim that sits on top of the rail/cushion.
- **Placement:** Rendered **ON TOP** of the Rail and Cushion.
- **Filenames:** `Pocket_Corner_Rim.png`, `Pocket_Side_Rim.png`
- **Resolution:** ~512x512px
- **Alpha:** Transparent outside the rim ring.

**Scaling Note:**
Both Hole and Rim assets should be centered and share the same coordinate scaling logic (based on `pockethHoleRefRadius`). Ideally, they should be designed to match perfectly when superimposed.ons

| Property | Value |
|----------|-------|
| **Format** | PNG with transparency |
| **Dimensions** | Square: 512×512 or 1024×1024 px recommended |
→ Offset (wrap around)
2. Use Clone/Heal tools to fix seams

**Testing:**
- Tile the image 5× horizontally in your editor to check for visible seams

---

## 2. Pocket Corner Hole

An overlay drawn at each of the 4 corner pockets. Creates the visual "hole" cutout.

### Specifications

| Property | Value |
|----------|-------|
| **Format** | PNG with transparency |
| **Dimensions** | Square: 512×512 or 1024×1024 px recommended |
| **Orientation** | Design for **top-left corner** position |
| **Transparent Area** | The pocket hole itself (where balls fall in) |
| **Opaque Area** | Optional rim, shadow, or decorative elements |

### Design Layout (Top-Left Orientation)

```
┌─────────────────┐
│ ████████████████│  ← Opaque rim/edge (optional)
│ ██            ██│
│ ██   HOLE     ██│  ← Transparent center
│ ██  (trans)   ██│
│ ██            ██│
│ ████████████████│
└─────────────────┘
```

### Rotation Behavior

The code automatically rotates this asset for each corner:
- Top-Left: 0° (as designed)
- Top-Right: 90° clockwise
- Bottom-Right: 180°
- Bottom-Left: 270° (90° counter-clockwise)

### Scaling Behavior

- Scaled based on `pocket.radius` from physics JSON
- Reference radius defined by `pocketHoleRefRadius` setting
- Typical corner pocket radius: ~2 inches

---

## 3. Pocket Side Hole

An overlay drawn at each of the 2 side pockets (center of long edges).

### Specifications

| Property | Value |
|----------|-------|
| **Format** | PNG with transparency |
| **Dimensions** | Rectangular, wider than tall: e.g., 1024×512 px |
| **Orientation** | Design for **top edge** (hole opens downward) |
| **Transparent Area** | The U-shaped or semicircular pocket opening |
| **Opaque Area** | Optional rim, shadow, or decorative edges |

### Design Layout (Top Edge Orientation)

```
┌──────────────────────────┐
│ ████████████████████████ │  ← Rail continues on sides
│ ████            ████████ │
│ ████    HOLE    ████████ │  ← Transparent center
│ ████  (trans)   ████████ │
│ ████            ████████ │
│ ██████████████████████── │  ← Bottom edge at cushion line
└──────────────────────────┘
```

### Rotation Behavior

- Top side pocket: 0° (as designed)
- Bottom side pocket: 180°

### Scaling Behavior

- Scaled based on `pocket.radius` from physics JSON
- Side pockets are typically larger than corner pockets (~2.5 inches)

---

## Testing Your Assets

### Quick Checklist

- [ ] Rail tile: Check 5× horizontal tiling for seam visibility
- [ ] Rail tile: Test at different `railThicknessPx` values (50, 73, 100)
- [ ] Pocket holes: Verify transparency is correct (not white/opaque)
- [ ] Pocket holes: Check alignment with physics wireframe overlay
- [ ] All assets: Test in Table Editor with "Modular" source selected

### Recommended Workflow

1. Create assets at high resolution (1024px)
2. Load into Table Editor via the Modular panel
3. Adjust `Rail Thickness (px)` to test scaling
4. Export and verify in-game appearance

---

## File Naming Convention

For organized asset management:

```
skins/
  my_custom_skin/
    Rail_Middle_Tile.png
    Pocket_Corner_Hole.png
    Pocket_Side_Hole.png
```
