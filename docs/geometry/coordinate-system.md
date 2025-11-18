# RailRush Coordinate System Reference

**CRITICAL**: This document defines the coordinate system used throughout the project. **Read this before modifying any geometry code.**

## World Space Coordinate System

All physics calculations and geometry definitions use **center-origin coordinates**:

### Origin and Axes
```
Origin: (0, 0) at the CENTER of the play area

+Y (North)
    ↑
    |
    |
────┼────→ +X (East)
    |
    |
    ↓
-Y (South)
```

- **X-axis**: Horizontal (East-West)
  - Positive X = East (right side of table)
  - Negative X = West (left side of table)
- **Y-axis**: Vertical (North-South)
  - Positive Y = North (head/top of table)
  - Negative Y = South (foot/bottom of table)
- **Z-axis**: Perpendicular to table surface (3D rendering only)
  - Positive Z = Up from table
  - Z=0 = Felt surface

### Units
All measurements are in **inches** (real-world pool table measurements).

### Play Area Dimensions (9-foot table)
```
Width:  100 inches (X: -50 to +50)
Height:  50 inches (Y: -25 to +25)

Table corners:
  NW: (-50, +25)    NE: (+50, +25)
  SW: (-50, -25)    SE: (+50, -25)
```

## Understanding Geometry Parameters

### Corner Pocket Parameters

#### What These Values Mean

**IMPORTANT**: `CORNER_JAW_X` and `CORNER_JAW_Y` are measured **from the table center**, NOT from the corner!

```
Table center (0,0)                    Corner (50,25)
        ├──────────────────────────────┤
        ←──────── straightX ─────────→
                  ←─ jawOffset ─→
        ←──── CORNER_JAW_X ──→
```

**Example with numbers**:
- `CORNER_STRAIGHT_X = 48.25"` (straight rail ends here, 1.75" from corner)
- `CORNER_JAW_X = 46"` (jaw begins here, 4" from corner)
- Therefore: `jawOffset = 48.25 - 46 = 2.25"`

#### Parameter Relationships

```typescript
// Straight rail endpoint (X coordinate from center)
straightX = PLAY_HALF_W_IN - corner.railDepth
// Example: straightX = 50 - 1.75 = 48.25

// Jaw position (X coordinate from center)
CORNER_JAW_X = straightX - jawOffset
// Example: CORNER_JAW_X = 48.25 - 2.25 = 46.0

// Jaw offset (distance from straight rail to jaw)
jawOffset = max(throatWidth/2, jawDepth) + taper
// Example: jawOffset = max(2.06, 1.0) + 0.44 = 2.5
```

### Side Pocket Parameters

Side pockets use similar logic but along the Y-axis:

```
Table center (0,0)                North edge (0,25)
        ├──────────────────────────┤
        ←──────── straightY ──────→
              ←─ jawDepth ──→
        ←── JAW_X_INNER ─→
        ←──── JAW_X_OUTER ───→
```

**Key difference**: Side jaw positions (`JAW_X_OUTER`, `JAW_X_INNER`) are measured as **magnitudes** (half-widths), not absolute X coordinates:

```typescript
// Mouth opening = JAW_X_OUTER on both sides
mouthWidth = 2 × JAW_X_OUTER

// Throat opening = JAW_X_INNER on both sides
throatWidth = 2 × JAW_X_INNER

// Jaw positions along Y-axis
straightY = PLAY_HALF_H_IN - railDepth  // e.g., 25 - 1.5 = 23.5
innerY = straightY + jawDepth            // e.g., 23.5 + 1.1 = 24.6
```

## Modern vs Legacy Geometry Mapping

### Modern → Legacy Conversion

**Side Pockets**:
```typescript
JAW_X_OUTER = side.mouthWidth / 2
JAW_X_INNER = side.throatWidth / 2
SIDE_STRAIGHT_Y_IN = PLAY_HALF_H_IN - side.railDepth
SIDE_INNER_Y_IN = SIDE_STRAIGHT_Y_IN + side.jawDepth
```

**Corner Pockets**:
```typescript
CORNER_STRAIGHT_X_IN = PLAY_HALF_W_IN - corner.railDepth
CORNER_TARGET_Y_IN = PLAY_HALF_H_IN - corner.railDepth

// Calculate jaw offset
throatHalf = corner.throatWidth / 2
taperPerSide = (corner.mouthWidth - corner.throatWidth) / 2
jawOffset = corner.jawDepth + taperPerSide
jawOffset = max(jawOffset, throatHalf)  // Ensure throat fits

// Apply jaw offset
CORNER_JAW_X_OVERRIDE_IN = CORNER_STRAIGHT_X_IN - jawOffset
CORNER_JAW_Y_OVERRIDE_IN = CORNER_TARGET_Y_IN - jawOffset
```

### Legacy → Modern Conversion

**Side Pockets**:
```typescript
side.mouthWidth = JAW_X_OUTER × 2
side.throatWidth = JAW_X_INNER × 2
side.railDepth = PLAY_HALF_H_IN - SIDE_STRAIGHT_Y_IN
side.jawDepth = SIDE_INNER_Y_IN - SIDE_STRAIGHT_Y_IN
```

**Corner Pockets**:
```typescript
corner.railDepth = PLAY_HALF_W_IN - CORNER_STRAIGHT_X_IN
corner.throatWidth = CORNER_THROAT_WIDTH_IN  // Direct preservation

// Derive jaw depth from jaw positions
jawDepthX = CORNER_STRAIGHT_X_IN - CORNER_JAW_X_OVERRIDE_IN
jawDepthY = CORNER_TARGET_Y_IN - CORNER_JAW_Y_OVERRIDE_IN
corner.jawDepth = average(jawDepthX, jawDepthY)

// Estimate mouth width
corner.mouthWidth = corner.throatWidth + (2 × corner.jawDepth × 0.5)
```

## Pocket Mouth vs Throat Visualization

```
Side Pocket (Top View):
═══════════════════════════════════════════════════
║                     NORTH                       ║
║                                                 ║
║    ←── mouthWidth ──→                          ║
║         (wider)                                 ║
║    ╱───────────────╲   ← Cushion nose          ║
║   ╱                 ╲                           ║
║  │    ← throatWidth →│ ← Narrowest point       ║
║   ╲                 ╱  (Throat)                 ║
║    ╲               ╱                            ║
║     ╲─────────────╱                             ║
║      └─ jawDepth ─┘                             ║
║                                                 ║
═══════════════════════════════════════════════════


Corner Pocket (Top View):
    NORTH
      ║
      ║     Corner (50, 25)
      ║           ╱
      ║          ╱
      ║   ╱─────╱  ← Straight rail ends
      ║  ╱     ╱
      ║ ╱     ╱ ← Jaw taper section
      ║╱     ╱
      ╱     ╱
     ╱     │  ← Throat (narrowest)
    ╱      ╲
           ╲
            ╲
```

## Common Pitfalls to Avoid

### ❌ WRONG: Using mouth width as absolute coordinate
```typescript
// This is WRONG - creates tiny rails!
const jawX = corner.mouthWidth / 2;  // Only 2.5" from center!
```

### ✅ CORRECT: Using mouth width to calculate jaw offset
```typescript
// This is CORRECT - jawX is distance from center
const straightX = 50 - corner.railDepth;        // e.g., 48.25"
const jawOffset = calculateJawOffset(corner);   // e.g., 2.25"
const jawX = straightX - jawOffset;             // e.g., 46.0"
```

### ❌ WRONG: Confusing jaw offset with jaw position
```typescript
// This is WRONG - jawOffset is NOT the same as CORNER_JAW_X
CORNER_JAW_X_OVERRIDE_IN = jawOffset;  // Way too small!
```

### ✅ CORRECT: Understanding the relationship
```typescript
// This is CORRECT
const straightX = PLAY_HALF_W_IN - corner.railDepth;
const jawX = straightX - jawOffset;
CORNER_JAW_X_OVERRIDE_IN = jawX;
```

## Rendering Coordinate Systems

### Canvas 2D (Overlay)
- Origin: Top-left corner of canvas
- Y-axis: Increases **downward**
- Requires Y-flip when converting from world space:

```typescript
canvas.x = centerX + scale * world.x
canvas.y = centerY - scale * world.y  // Note the minus!
```

### Three.js (WebGL)
- Matches world space coordinate system
- Orthographic camera positioned at (0, 0, 50) looking down
- No coordinate transformation needed

## Pocket Center Positions

### Corner Pockets (4 total)
```typescript
NW corner: (-50, +25)
NE corner: (+50, +25)
SW corner: (-50, -25)
SE corner: (+50, -25)
```

### Side Pockets (2 total)
```typescript
North side: (0, 25 + SIDE_POCKET_OUTWARD_OFFSET_IN)  // e.g., (0, 25.25)
South side: (0, -25 - SIDE_POCKET_OUTWARD_OFFSET_IN) // e.g., (0, -25.25)
```

**Note**: Side pockets are positioned slightly **outside** the play area edge.

## Quick Reference: Standard Values

### BCA Tournament Medium Template
```typescript
Side Pocket:
  mouthWidth: 5.5"      → JAW_X_OUTER = 2.75"
  throatWidth: 4.625"   → JAW_X_INNER = 2.3125"
  railDepth: 1.5"       → STRAIGHT_Y = 23.5"
  jawDepth: 1.1"        → INNER_Y = 24.6"

Corner Pocket:
  mouthWidth: 5.0"      → Jaw offset ≈ 2.5"
  throatWidth: 4.125"   → CORNER_JAW_X ≈ 45.75"
  railDepth: 1.75"      → STRAIGHT_X = 48.25"
  jawDepth: 1.0"        → CORNER_JAW_Y ≈ 21.25"
```

## Testing Coordinate Conversions

Always verify conversions with these checks:

1. **Round-trip test**: Modern → Legacy → Modern should preserve values
2. **Range check**: All jaw positions should be within play area bounds
3. **Taper check**: Mouth width should be ≥ throat width
4. **Rail check**: Jaw positions should leave room for straight rails

Example test:
```typescript
const modern = { mouthWidth: 5.0, throatWidth: 4.0, railDepth: 1.75, jawDepth: 1.0 };
const legacy = modernToLegacy(modern);
const roundTrip = legacyToModern(legacy);

assert(abs(roundTrip.mouthWidth - modern.mouthWidth) < 0.1);
assert(abs(roundTrip.throatWidth - modern.throatWidth) < 0.1);
assert(legacy.CORNER_JAW_X_OVERRIDE_IN > 0);
assert(legacy.CORNER_JAW_X_OVERRIDE_IN < 50);
```

## Summary

**Remember**:
- All coordinates are **center-origin**, not corner-origin
- Jaw positions are **absolute coordinates from center**, not offsets
- Mouth/throat widths are **full widths** (not half-widths)
- Side jaw X values (JAW_X_OUTER/INNER) are **half-widths** (magnitudes)
- Corner jaw X/Y values are **absolute positions from center**
- Always measure twice, code once!

When in doubt, draw it out on paper using center-origin coordinates.
