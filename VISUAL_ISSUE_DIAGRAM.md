# Visual Issue: The "Outer Plane" You're Seeing

## What You See vs What Should Be There

### Current View (With Rail Fill Mesh)

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  BROWN FRAME (#3d2413)                        ┃
┃  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  ┃
┃  ┃ BLACK BORDER (RAIL FILL) ← YOU SEE THIS ┃  ┃  ⭐ THE ISSUE
┃  ┃ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  ┃  ┃
┃  ┃ ┃ GREEN FELT (#0a5f0a)                ┃  ┃  ┃
┃  ┃ ┃                                      ┃  ┃  ┃
┃  ┃ ┃  ● ● ●  Pool balls on felt          ┃  ┃  ┃
┃  ┃ ┃   ● ●                                ┃  ┃  ┃
┃  ┃ ┃                                      ┃  ┃  ┃
┃  ┃ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  ┃  ┃
┃  ┃ BLACK BORDER (RAIL FILL) ← YOU SEE THIS ┃  ┃  ⭐ THE ISSUE
┃  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  ┃
┃  BROWN FRAME (#3d2413)                        ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

The black border is the Rail Fill Mesh (Z=-0.05)
showing between the felt and the frame.
```

### Expected View (Without Rail Fill Issue)

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  BROWN FRAME (#3d2413)                        ┃
┃  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  ┃
┃  ┃ DARK BROWN RAILS (#2d1810)              ┃  ┃  ← Rails visible
┃  ┃ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  ┃  ┃
┃  ┃ ┃ GREEN FELT (#0a5f0a)                ┃  ┃  ┃
┃  ┃ ┃                                      ┃  ┃  ┃
┃  ┃ ┃  ● ● ●  Pool balls on felt          ┃  ┃  ┃
┃  ┃ ┃   ● ●                                ┃  ┃  ┃
┃  ┃ ┃                                      ┃  ┃  ┃
┃  ┃ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  ┃  ┃
┃  ┃ DARK BROWN RAILS (#2d1810)              ┃  ┃  ← Rails visible
┃  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  ┃
┃  BROWN FRAME (#3d2413)                        ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

Smooth transition: Frame → Rails → Felt
No visible "step" or "plane"
```

## Close-Up: The Transition Area

### Current (With Issue)

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

    ▓▓▓ = The visible "outer plane" you see
```

### Expected (Fixed)

```
    │◄──── 4" ────►│◄ 0.4" ►│◄──── Felt ────►│
    │              │        │                 │
    │              │  Rail  │                 │
────┤ FRAME        ├────────┼─────────────────┤  ← Frame edge
    │ Brown        │ Dark   │ Felt            │
    │ #3d2413      │ Brown  │ Green           │
    │              │ #2d1810│ #0a5f0a         │
    │              │        │                 │
    └──────────────┴────────┴─────────────────┘

    Smooth transition, no visible plane
```

## The Geometry Problem

### Rail Fill Mesh Structure

```
Outer Rectangle:
┌─────────────────────────────────────┐
│  Top-Left: (-54.2", +29.2")         │
│                                     │  ← Rail Fill Mesh
│  ┌─────────────────────────────┐   │     Opacity: 0.96
│  │ HOLE (Transparent)          │   │     Color: #000000
│  │                             │   │
│  │  Inner: (-50", +25")        │   │
│  │  to     (+50", -25")        │   │
│  │                             │   │
│  └─────────────────────────────┘   │
│                                     │
│  Bottom-Right: (+54.2", -29.2")    │
└─────────────────────────────────────┘

The mesh itself is correct, but the rectangular hole
doesn't match the complex rail boundary shape!
```

### Why You See A Rectangle

The felt surface follows this complex boundary:

```
         ╔═══════════════════════╗
         ║                       ║
    ╔════╝                       ╚════╗  ← Pocket cutouts
    ║                                 ║
    ╚════╗                       ╔════╝
         ║                       ║
         ╚═══════════════════════╝
```

But the Rail Fill hole is just a simple rectangle:

```
    ┌───────────────────────────────┐
    │                               │  ← Simple rectangle
    │                               │     (doesn't follow pockets)
    │                               │
    └───────────────────────────────┘
```

**Result:** The Rail Fill mesh shows in the gaps between the rectangular hole and the actual felt boundary.

## Measurements

For a standard 9-foot table (100" × 50" play area):

| Component          | X Range          | Y Range          | Width/Height   | Z Position |
| ------------------ | ---------------- | ---------------- | -------------- | ---------- |
| Play Area          | -50" to +50"     | -25" to +25"     | 100" × 50"     | -          |
| Felt Surface       | Follows rails    | Follows rails    | ~100" × 50"    | 0.0        |
| Rail Fill (outer)  | -54.2" to +54.2" | -29.2" to +29.2" | 108.4" × 58.4" | -0.05      |
| Rail Fill (hole)   | -50" to +50"     | -25" to +25"     | 100" × 50"     | -          |
| Frame (outer)      | -54.2" to +54.2" | -29.2" to +29.2" | 108.4" × 58.4" | 0.0        |
| **Visible Border** | **4.2"**         | **4.2"**         | **All sides**  | **-0.05**  |

## Z-Ordering (Side View)

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
  │  ▓▓▓  Rail Fill ⭐ (slightly below surface)
-0.05     Creates visible "step"
  │
  │  ═══  Rail highlights
  │
-0.25   ▓▓▓  Rails/cushions
  │  ▓▓▓
  │
  └────────→
```

The Rail Fill at Z=-0.05 creates a visible "ledge" or "step" that shows as a dark border when viewed from above.

## Why It's Always Visible

1. **Z-Position:** At -0.05, it's close enough to surface to be visible in top-down view
2. **Color:** Black (#000000) contrasts strongly with green felt and brown frame
3. **Opacity:** 0.96 makes it nearly opaque
4. **Geometry:** Rectangular hole doesn't match complex felt boundary
5. **Lighting:** Uses `MeshBasicMaterial` (not affected by scene lighting), so it always shows at full intensity

## The Fix

Change the inner hole from a simple rectangle to follow the exact rail boundary:

**Before (Simple Rectangle):**

```typescript
const inner = new THREE.Path();
inner.moveTo(minX, minY); // (-50, -25)
inner.lineTo(maxX, minY); // (+50, -25)
inner.lineTo(maxX, maxY); // (+50, +25)
inner.lineTo(minX, maxY); // (-50, +25)
inner.closePath();
```

**After (Follows Rails):**

```typescript
const inner = new THREE.Path();
const points = this.playBoundaryPoints; // From actual rail endpoints
inner.moveTo(points[0].x, points[0].y);
for (let i = 1; i < points.length; i++) {
  inner.lineTo(points[i].x, points[i].y);
}
inner.closePath();
```

This makes the hole follow the actual felt boundary, eliminating the visible border.

## Summary

**What You See:**

- A dark (typically black) rectangular border between felt and frame
- Width: ~4.2 inches on all sides
- Appears as an unwanted "outer plane" or "step"

**What's Causing It:**

- Rail Fill Mesh with rectangular hole
- Position: Z=-0.05 (slightly below felt surface)
- Color: #000000 (black, high contrast)
- Geometry mismatch between hole and felt boundary

**Quick Fix:**

- Set `RAIL_FILL_COLOR: '#0a5f0a'` (match felt)

**Proper Fix:**

- Update inner hole to follow `playBoundaryPoints` instead of rectangular bounds
