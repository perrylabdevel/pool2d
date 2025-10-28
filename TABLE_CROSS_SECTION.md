# Pool Table Cross-Section Diagram

## Top-Down View (Not to Scale)

```
┌────────────────────────────────────────────────────────────────────┐
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  FRAME PLANK (Top)                                           │ │ ← Frame: Z=0, FRAME_COLOR (#3d2413)
│  │  Width: 108.4", Height: 4.0"                                 │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│F │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│ │F
│R │░  RAIL FILL MESH (The "Outer Plane" Issue) ░░░░░░░░░░░░░░░░│ │R  ← Rail Fill: Z=-0.05, RAIL_FILL_COLOR
│A │░  Z=-0.05, 4.2" wide border                 ░░░░░░░░░░░░░░░░│ │A
│M │░░░░░░░░┌────────────────────────────────────────────────┐░░░│ │M
│E │░░░░░░░░│  FELT SURFACE (Table Mesh)                     │░░░│ │E
│  │░░░░░░░░│  Z=0, TABLE_COLOR (#0a5f0a - green)            │░░░│ │
│P │░░░RAIL░│                                                 │░░░│ │P
│L │░░░ ╔═══╪═════════════════════════════════════════════════╪══╗│ │L
│A │░░░ ║   │                                                 │  ║│ │A
│N │░░░ ║   │         PLAYING AREA                            │  ║│ │N
│K │░░░ ║   │         100" x 50"                              │  ║│ │K
│  │░░░ ║   │                                                 │  ║│ │
│  │░░░ ║   │         Origin (0,0) at center                  │  ║│ │
│  │░░░ ║   │                                                 │  ║│ │
│  │░░░ ║   │                                                 │  ║│ │
│  │░░░ ╚═══╪═════════════════════════════════════════════════╪══╝│ │
│  │░░░RAIL░│                                                 │░░░│ │
│  │░░░░░░░░└────────────────────────────────────────────────┘░░░│ │
│  │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  FRAME PLANK (Bottom)                                        │ │
│  └──────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘

Legend:
  ░░░ = Rail Fill Mesh (the visible "outer plane")
  ╔═╗ = Rails/Cushions (Z=-0.25)
  │ │ = Felt Surface (Z=0)

```

## Side Cross-Section View (Vertical Z-axis)

```
                   ↑ Z-axis (up)
                   │
           +0.6    │   ┌─┐  Pocket Caps (optional overlay)
                   │   └─┘
           +0.3    │   ╱─╲  Pocket Shadow Rings
                   │  ╱   ╲
           +0.2    │ ◠     ◡ Pocket Highlights (arcs)
                   │
           +0.16   │  (O)   Pocket Gradient Overlay
           +0.15   │  (●)   Pocket Bottom Fill
                   │  ║ ║   Pocket Cylinder Walls
            0.0 ───┼──███── FRAME PLANKS
                   │  ███   FELT SURFACE (table mesh)
                   │  ███
           -0.05   │░░░░░░░ RAIL FILL MESH ⭐ ("outer plane")
                   │░░░░░░░
           -0.13   │  ─┬─   Rail Highlight (plane on top)
                   │  ▓▓▓
           -0.25   │  ▓▓▓   RAILS/CUSHIONS (box geometry)
                   │  ▓▓▓
                   │
                   └────────→ (table extends horizontally)

Key Z-Positions:
  Z =  0.60  Pocket caps
  Z =  0.30  Pocket shadows
  Z =  0.20  Pocket highlights
  Z =  0.16  Pocket gradient
  Z =  0.15  Pocket bottom
  Z =  0.00  Frame, Felt, Pocket walls
  Z = -0.05  Rail Fill Mesh ⭐ THE ISSUE
  Z = -0.13  Rail highlights
  Z = -0.25  Rails/cushions
```

## Detailed Dimensions

### Horizontal Extents (from center)

```
                    ┌─ Frame outer edge: ±54.2"
                    │
         ┌──────────┼──────────┐
         │  Frame   │  Frame   │
         │  ┌───────┼───────┐  │
         │  │ Rail  │ Rail  │  │  ┌─ Play boundary: ±50"
         │  │ ┌─────┼─────┐ │  │  │
         │  │ │ Felt│Felt │ │  │  │
         │  │ │     │     │ │  │  │
    ─────┼──┼─┼─────0─────┼─┼──┼──┼──── X-axis
         │  │ │  Play│    │ │  │  │
         │  │ │  Area│    │ │  │  │
         │  │ └─────┼─────┘ │  │  │
         │  │  Rail │ Rail  │  │  │
         │  └───────┼───────┘  │  │
         │   Frame  │  Frame   │  │
         └──────────┼──────────┘  │
                    │              │
    Rail Fill ──────┘              └─── Felt edge
    outer edge

Breakdown:
- Play area: -50" to +50" (100" wide)
- Felt surface: follows rail boundary (-50" to +50")
- Rails: 0.4" thick (0.2" inner + 0.2" outer)
- Rail Fill inner edge: -50" to +50" (matches play boundary)
- Frame inner edge: -50.2" to +50.2" (play + rail outer thickness)
- Frame outer edge: -54.2" to +54.2" (frame inner + 4" frame width)
- Rail Fill outer edge: -54.2" to +54.2" (matches frame outer)

VISIBLE BORDER WIDTH: 4.2" (from -50" to -54.2" and +50" to +54.2")
```

## The Problem: Rail Fill Mesh

The **Rail Fill Mesh** creates a visible rectangular border because:

1. **Geometry:**
   - Outer rectangle: ±54.2" × ±29.2" (frame boundary)
   - Inner hole: ±50" × ±25" (play boundary)
   - Creates 4.2" visible border on all sides

2. **Position:**
   - Z = -0.05 (slightly below felt at Z=0)
   - When camera looks straight down, this creates a visible "step" or "shelf"

3. **Visual Appearance:**
   - Color: Near-black (RAIL_FILL_COLOR #000000) or blended with felt color
   - Opacity: 0.96 (nearly opaque)
   - Sits between the felt green and the frame brown
   - Creates an unintended visual "plane" around the table

4. **Original Intent:**
   - Fill gaps between irregularly-shaped rail segments
   - Provide visual continuity between play area and frame
   - BUT: With the current geometry, it's always visible as a border

## Why You See It

When looking at the table from above (normal gameplay view):

```
Your View:
┌────────────────┐ ← Frame (brown)
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│ ← RAIL FILL (black/dark) ⭐ YOU SEE THIS
│▓┌────────────┐▓│
│▓│ Felt       │▓│ ← Felt (green)
│▓│ (green)    │▓│
│▓└────────────┘▓│
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│ ← RAIL FILL (black/dark) ⭐ YOU SEE THIS
└────────────────┘

The ▓▓▓ area is the Rail Fill Mesh showing as a dark border
between the green felt and brown frame.
```

## Solutions Summary

1. **Hide it:** Set `opacity: 0` or remove the mesh entirely
2. **Blend it:** Change `RAIL_FILL_COLOR` to match felt or frame
3. **Lower it:** Move to Z=-0.5 so it's hidden below rails
4. **Remove visibility:** Set `this.railFillMesh.visible = false`

The most likely intended behavior would be for this fill to NOT be visible from the top-down view, or to seamlessly blend with either the felt or the frame color.
