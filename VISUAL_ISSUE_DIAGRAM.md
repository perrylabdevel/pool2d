# Visual Issue: The "Outer Plane" - RESOLVED ✅

## What You See Now vs What You Saw Before

### AFTER FIX (Current View) ✅

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  GRAY FRAME (#custom)                         ┃
┃  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  ┃
┃  ┃ BLUE/TEAL RAILS (#custom)              ┃  ┃  ← Rails visible ✅
┃  ┃ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  ┃  ┃
┃  ┃ ┃ BLUE/TEAL FELT (#custom)           ┃  ┃  ┃
┃  ┃ ┃                                      ┃  ┃  ┃
┃  ┃ ┃  ● ● ●  Pool balls on felt          ┃  ┃  ┃
┃  ┃ ┃   ● ●                                ┃  ┃  ┃
┃  ┃ ┃                                      ┃  ┃  ┃
┃  ┃ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  ┃  ┃
┃  ┃ BLUE/TEAL RAILS (#custom)              ┃  ┃  ← Rails visible ✅
┃  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  ┃
┃  GRAY FRAME (#custom)                         ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

Smooth transition: Frame → Rails → Felt
Corner Fill (red) only visible in tiny gaps at pockets
```

### BEFORE FIX (Old View with Issue)

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  BROWN FRAME (#3d2413)                        ┃
┃  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  ┃
┃  ┃ BLACK BORDER (RAIL FILL) ← PROBLEM     ┃  ┃  ⚠️ THE ISSUE
┃  ┃ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  ┃  ┃
┃  ┃ ┃ GREEN FELT (#0a5f0a)                ┃  ┃  ┃
┃  ┃ ┃                                      ┃  ┃  ┃
┃  ┃ ┃  ● ● ●  Pool balls on felt          ┃  ┃  ┃
┃  ┃ ┃   ● ●                                ┃  ┃  ┃
┃  ┃ ┃                                      ┃  ┃  ┃
┃  ┃ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  ┃  ┃
┃  ┃ BLACK BORDER (RAIL FILL) ← PROBLEM     ┃  ┃  ⚠️ THE ISSUE
┃  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  ┃
┃  BROWN FRAME (#3d2413)                        ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

The black border was the Rail Fill Mesh (Z=-0.05)
showing as a rectangular border and covering the cushions.
```

## Close-Up: The Transition Area

### AFTER FIX ✅

```
    │◄──── 4" ────►│◄ 0.2" ►│◄──── Felt ────►│
    │              │        │                 │
    │              │  Rail  │                 │
────┤ FRAME        ├────────┼─────────────────┤  ← Frame inner edge
    │ Gray         │ Blue/  │ Felt            │
    │ #custom      │ Teal   │ Blue/Teal       │
    │              │ #custom│ #custom         │
    │              │        │                 │
    └──────────────┴────────┴─────────────────┘

    Smooth transition, no visible "outer plane"
    Corner fill (red) hidden below rails at Z=-0.3
```

### BEFORE FIX (Old)

```
    │◄──── 4" ────►│◄ 0.2" ►│◄──── Felt ────►│
    │              │        │                 │
    │              │        │                 │
────┤ FRAME        ├────────┼─────────────────┤  ← Frame edge
    │ Brown        │▓▓▓▓▓▓▓▓│ Felt            │
    │ #3d2413      │▓▓▓▓▓▓▓▓│ Green           │
    │              │▓▓▓▓▓▓▓▓│ #0a5f0a         │
    │              │▓▓▓▓▓▓▓▓│                 │
    └──────────────┴────────┴─────────────────┘
                   ▲
                   │
              Rail Fill Mesh
              (Black #000000)
              Z = -0.05
              Extended past frame
              Covered cushions

    ▓▓▓ = The visible "outer plane" that was the problem
```

## The Geometry Problem - SOLVED ✅

### NEW: Rail Fill Mesh Structure (Fixed) ✅

```
Outer Rectangle (constrained to frame INNER edge):
┌─────────────────────────────────────┐
│  Corners: (±50.2", ±25.2")          │  ← Rail Fill Mesh
│                                     │     Opacity: 0.96
│  ┌─────────────────────────────┐   │     Color: User-selected
│  │ HOLE (Complex Shape)        │   │     Z: -0.3 (below rails)
│  │                             │   │
│  │  Follows cushion outer edge │   │
│  │  Includes all pocket cuts   │   │
│  │                             │   │
│  └─────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘

✅ Stays within frame boundaries
✅ Doesn't cover cushions
✅ Follows complex pocket geometry
```

### OLD: Why It Showed As A Rectangle (Fixed)

The felt surface followed this complex boundary:

```
         ╔═══════════════════════╗
         ║                       ║
    ╔════╝                       ╚════╗  ← Pocket cutouts
    ║                                 ║
    ╚════╗                       ╔════╝
         ║                       ║
         ╚═══════════════════════╝
```

But the Rail Fill hole was just a simple rectangle:

```
    ┌───────────────────────────────┐
    │                               │  ← Simple rectangle (BEFORE)
    │                               │     (didn't follow pockets)
    │                               │
    └───────────────────────────────┘
```

**OLD Result:** Rail Fill showed in gaps between rectangular hole and actual felt boundary.
**NEW Result:** ✅ Rail Fill hole now follows exact cushion outer edge, eliminating visible border.

## Measurements - FIXED ✅

For a standard 9-foot table (100" × 50" play area):

| Component                | X Range          | Y Range          | Width/Height    | Z Position | Status  |
| ------------------------ | ---------------- | ---------------- | --------------- | ---------- | ------- |
| Play Area                | -50" to +50"     | -25" to +25"     | 100" × 50"      | -          | -       |
| Felt Surface             | Follows rails    | Follows rails    | ~100" × 50"     | 0.0        | ✅      |
| Cushion Outer Edge       | ~±50.2"          | ~±25.2"          | ~100.4" × 50.4" | -          | ✅      |
| Rail Fill (outer) NEW    | -50.2" to +50.2" | -25.2" to +25.2" | 100.4" × 50.4"  | -0.3       | ✅      |
| Rail Fill (hole) NEW     | Cushion shape    | Cushion shape    | Complex         | -          | ✅      |
| Frame (inner)            | -50.2" to +50.2" | -25.2" to +25.2" | 100.4" × 50.4"  | 0.0        | ✅      |
| Frame (outer)            | -54.2" to +54.2" | -29.2" to +29.2" | 108.4" × 58.4"  | 0.0        | ✅      |
| **Visible Border (OLD)** | **±4.2"**        | **±4.2"**        | **All sides**   | **-0.05**  | ⚠️FIXED |
| **Visible Border (NEW)** | **None**         | **None**         | **Tiny gaps**   | **-0.3**   | ✅      |

## Z-Ordering (Side View) - CORRECTED ✅

```
  Z
  │
  │  ┌─┐  Balls (0.0 + radius)
  │  └─┘
  │
0.0├──█──  Frame planks
  │  █    Felt surface
  │  █
  │
  │  ═══  Rail highlights
  │
-0.25   ▓▓▓  Rails/cushions ✅ (visible on top)
  │  ▓▓▓
  │
-0.3    ░░░  Rail Fill ✅ (below rails, contained)
  │  ░░░
  │
  └────────→
```

The Rail Fill at Z=-0.3 now renders BELOW the rails (Z=-0.25), so it doesn't cover them.

## Why It Was Always Visible (OLD - FIXED) ✅

**BEFORE:**

1. ⚠️ **Z-Position:** At -0.05, too close to surface, visible above rails
2. ⚠️ **Color:** Blended/modified, not user's selected color
3. ⚠️ **Opacity:** 0.96 nearly opaque
4. ⚠️ **Geometry:** Rectangular hole didn't match complex felt boundary
5. ⚠️ **Extent:** Extended beyond frame boundaries
6. ⚠️ **Lighting:** MeshBasicMaterial showed at full intensity
7. ⚠️ **Render Order:** Rendered after table, before proper layering

**AFTER:**

1. ✅ **Z-Position:** At -0.3, below rails at -0.25
2. ✅ **Color:** Uses exact user-selected color (no blending)
3. ✅ **Opacity:** 0.96 (same, but now below rails)
4. ✅ **Geometry:** Complex hole follows cushion outer edge exactly
5. ✅ **Extent:** Constrained to frame inner edge (±50.2")
6. ✅ **Lighting:** MeshBasicMaterial (same, but now hidden)
7. ✅ **Render Order:** orderRails - 1 (renders before rails)

## The Fixes Applied ✅

### 1. Geometry Fix - Inner Hole

**BEFORE (Simple Rectangle):**

```typescript
const inner = new THREE.Path();
inner.moveTo(minX, minY); // (-50, -25)
inner.lineTo(maxX, minY); // (+50, -25)
inner.lineTo(maxX, maxY); // (+50, +25)
inner.lineTo(minX, maxY); // (-50, +25)
inner.closePath();
```

**AFTER (Follows Cushion Outer Edge):**

```typescript
// Helper function to offset boundary outward
private offsetBoundaryOutward(points: Vec2[], offset: number): Vec2[] {
  // Calculates outward normals for each point
  // Offsets points by rail thickness
  // Returns cushion outer edge coordinates
}

// Inner hole follows cushion outer edge
const railOuterThickness = CONFIG.RAIL_THICKNESS_OUTER;
const offsetPoints = this.offsetBoundaryOutward(
  this.playBoundaryPoints,
  railOuterThickness
);

const inner = new THREE.Path();
inner.moveTo(offsetPoints[0].x, offsetPoints[0].y);
for (let i = 1; i < offsetPoints.length; i++) {
  inner.lineTo(offsetPoints[i].x, offsetPoints[i].y);
}
inner.closePath();
```

### 2. Geometry Fix - Outer Boundary

**BEFORE (Extended Past Frame):**

```typescript
const outerOffset = CONFIG.RAIL_THICKNESS_OUTER + frameWidth; // 0.2 + 4.0 = 4.2"
// Extended to ±54.2" (beyond frame at ±54.2")
```

**AFTER (Constrained to Frame):**

```typescript
const frameInnerOffset = CONFIG.RAIL_THICKNESS_OUTER; // 0.2"
// Only extends to ±50.2" (frame inner edge)
```

### 3. Color Fix

**BEFORE (Blended):**

```typescript
private computeRailFillColor(): THREE.Color {
  const feltColor = new THREE.Color(CONFIG.TABLE_COLOR);
  const baseFill = new THREE.Color(CONFIG.RAIL_FILL_COLOR);
  const fillColor = baseFill.clone();

  // Multiple blending and adjustments...
  fillColor.lerp(feltColor, 0.65);
  // HSL adjustments...
  fillColor.lerp(new THREE.Color('#ffffff'), 0.12);

  return fillColor;
}
```

**AFTER (Direct):**

```typescript
private computeRailFillColor(): THREE.Color {
  // Use the Corner Fill color directly from CONFIG
  return new THREE.Color(CONFIG.RAIL_FILL_COLOR ?? '#000000');
}
```

### 4. Z-Position and Render Order Fix

**BEFORE:**

```typescript
this.railFillMesh.position.z = -0.05; // Above rails at -0.25
this.railFillMesh.renderOrder = this.layerOrder.orderTable - 1; // Wrong layer
```

**AFTER:**

```typescript
this.railFillMesh.position.z = -0.3; // Below rails at -0.25 ✅
this.railFillMesh.renderOrder = this.layerOrder.orderRails - 1; // Correct layer ✅
```

### 5. Scene Background Fix

**ADDED:**

```typescript
// In constructor
this.scene.background = null; // Disabled - no background color
this.renderer.setClearColor(0x000000, 0); // Transparent background
```

## Summary ✅

**What You Saw (BEFORE):**

- A dark rectangular border between felt and frame
- Width: ~4.2 inches on all sides
- Extended past frame boundaries
- Covered the rail cushions
- Used blended/modified colors

**What's Fixed (AFTER):**

- Rail Fill uses exact user-selected "Corner Fill" color
- Positioned below rails (Z=-0.3 vs rails at Z=-0.25)
- Constrained within frame boundaries (±50.2" vs ±54.2")
- Inner hole follows cushion outer edge (not simple rectangle)
- Only visible in tiny gaps at pocket geometry transitions
- Scene background disabled for transparency

**Status:** ✅ COMPLETELY RESOLVED

All components now render correctly with proper colors, positioning, and geometry!
