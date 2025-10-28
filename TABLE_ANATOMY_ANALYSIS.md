# Pool Table Anatomy Analysis

## Overview

This document details the anatomy of pool table components in the Pool 2D codebase, focusing on the table, rails, frame, cushions, and the "outer plane" visual issue.

---

## Component Hierarchy (Bottom to Top)

### 1. **Rail Fill Mesh** (Z: -0.3) ✅ FIXED

**File:** `src/render/Renderer3D.ts:1458-1491` (`createRailFillGeometry`)

**Purpose:** Fills the narrow gaps between the cushion outer edges and the frame inner edge (only visible at pocket openings).

**Geometry:**

- **Outer boundary:** Rectangle at frame inner edge `playBounds ± RAIL_THICKNESS_OUTER`
  - For default settings: `±50" ± 0.2" = ±50.2"` (contained within frame)
- **Inner boundary (hole):** Follows exact cushion outer edge (playBoundaryPoints offset outward by 0.2")
  - Matches complex cushion shape including all pocket cutouts

**Material:**

```typescript
color: CONFIG.RAIL_FILL_COLOR; // Used directly, no blending
opacity: 0.96;
renderOrder: orderRails - 1; // Renders before/below rails
```

**Configuration:**

- `CONFIG.RAIL_FILL_COLOR` - User-defined "Corner Fill" color from UI (e.g., red #ff0000)
- Visible only in tiny gaps at pocket geometry transitions

**ISSUE RESOLVED:** No longer shows as visible rectangular border ✅

---

### 2. **Felt Surface / Table Mesh** (Z: 0)

**File:** `src/render/Renderer3D.ts:893-912` (`initializeTable`)

**Purpose:** The green felt playing surface.

**Geometry:**

- **Shape:** Created from `playBoundaryPoints` (computed from rails)
- Follows the exact cushion outline, including all pocket cutouts and jaw geometry

**Material:**

```typescript
color: CONFIG.TABLE_COLOR('#0a5f0a' - green);
roughness: 0.8;
metalness: 0.1;
receiveShadow: true;
```

---

### 2. **Rail Fill Mesh** - See component #1 above (now renders below rails)

### 3. **Rails / Cushions** (Z: -0.25)

**File:** `src/render/Renderer3D.ts:1189-1244` (`initializeRails`)

**Purpose:** The cushions that balls bounce off of.

**Geometry per rail:**

```typescript
length: distance between rail endpoints
width: RAIL_THICKNESS_INNER + RAIL_THICKNESS_OUTER (0.2 + 0.2 = 0.4")
height: 0.5" (Z-depth)
position: rail midpoint - (normal × centerShift)
  where centerShift = (outer - inner) / 2
```

**Material:**

```typescript
color: CONFIG.RAIL_COLOR ('#2d1810' - dark brown)
roughness: 0.5
metalness: 0.3
castShadow: true
receiveShadow: true
```

**Highlight overlay:** (Z: -0.13)

- White gradient plane on top of each rail
- Width: 35% of rail width
- Additive blending for shine effect

**Rail Segments (from Geometry.ts):**

The rails are broken into segments around pockets:

**North (top) rail:**

1. `N_west_taper` - From NW corner pocket to straight section
2. `N_west_straight` - Straight section before side pocket
3. `N_left_throat_outer` - Outer jaw of side pocket
4. `N_left_throat_inner` - Inner jaw to pocket center
5. `N_right_throat_inner` - Pocket center to inner jaw
6. `N_right_throat_outer` - Inner jaw to straight section
7. `N_east_straight` - Straight section before corner
8. `N_east_taper` - To NE corner pocket

**East/West rails:**
Similar pattern with north taper, center vertical, south taper

**South rail:**
Mirrors north rail pattern

---

### 4. **Frame Planks** (Z: 0)

**File:** `src/render/Renderer3D.ts:939-1005` (`initializeFrame`)

**Purpose:** Wooden border around the table (decorative/structural).

**Geometry:**

- **4 rectangular planks** (top, bottom, left, right)
- **Dimensions:**

  ```typescript
  frameWidth = CONFIG.FRAME_OFFSET_IN (4.0")
  innerX = playHalfW + RAIL_THICKNESS_OUTER (50 + 0.2 = 50.2")
  innerY = playHalfH + RAIL_THICKNESS_OUTER (25 + 0.2 = 25.2")
  outerX = innerX + frameWidth (50.2 + 4.0 = 54.2")
  outerY = innerY + frameWidth (25.2 + 4.0 = 29.2")
  depth = 0.75" (Z-height)
  ```

- **Top plank:** width=108.4", height=4", centered at Y=27.2"
- **Bottom plank:** Same dimensions, centered at Y=-27.2"
- **Left plank:** width=4", height=58.4", centered at X=-52.2"
- **Right plank:** width=4", height=58.4", centered at X=52.2"

**Material:**

```typescript
color: CONFIG.FRAME_COLOR ('#3d2413' - medium brown)
roughness: 0.6
metalness: 0.2
```

---

### 5. **Pockets** (Z: 0 to 0.3)

**File:** `src/render/Renderer3D.ts:1246-1346` (`initializePockets`)

**Components per pocket:**

**a) Cylinder (tapered walls):**

- Top radius: `visualRadius` (2.5" default)
- Bottom radius: `visualRadius × 0.85` (2.125")
- Depth: `shelfDepth` (0.5")
- Material: Dark gray (#151515)

**b) Bottom fill:** (Z: 0.15)

- Black circle at pocket bottom
- Radius: `visualRadius × 0.98`

**c) Gradient overlay:** (Z: 0.16)

- Radial gradient from center
- Uses `pocketGradientTexture`

**d) Shadow ring:** (Z: 0.3)

- Inner radius: `visualRadius × 0.92`
- Outer radius: `visualRadius × 1.2`
- Multiply blending for shadow effect

**e) Highlight arc:** (Z: 0.2)

- Inner radius: `visualRadius × 1.02-1.04`
- Outer radius: inner + `visualRadius × 0.26-0.3`
- Arc facing toward table center
- Additive blending

---

### 6. **Pocket Caps** (Z: 0.6)

**File:** `src/render/Renderer3D.ts:1348-1376` (`initializePocketCaps`)

**Purpose:** Optional transparent cap over pockets (debug/visualization).

**Geometry:**

```typescript
radius: visualRadius × 1.02
thickness: 0.2"
```

**Material:**

```typescript
color: '#0a0a0a' (near black)
opacity: 0.75
transparent: true
```

---

## The "Outer Plane" Issue - RESOLVED ✅

### What Was Wrong (Original Issue)

The **Rail Fill Mesh** was creating a visible rectangular border because:

1. **Position:** Z=-0.05 was too high (above rails at Z=-0.25), making it cover the cushions
2. **Color:** Was blending `RAIL_FILL_COLOR` with table color, creating unexpected colors
3. **Geometry:**
   - Outer boundary extended beyond frame (to ±54.2")
   - Inner hole was a simple rectangle at play boundary (±50" × ±25")
   - Did not follow cushion outer edge or complex pocket geometry

### How It Was Fixed

1. **Position:** Changed to Z=-0.3 (below rails at Z=-0.25)
2. **Render Order:** Changed to `orderRails - 1` (renders before rails)
3. **Color:** Now uses `RAIL_FILL_COLOR` directly without blending or modifications
4. **Geometry:**
   - **Outer boundary:** Constrained to frame inner edge at ±50.2" (not beyond frame)
   - **Inner hole:** Follows exact cushion outer edge using `offsetBoundaryOutward()` function
   - Matches complex cushion geometry including all pocket cutouts

### Current Geometry (Fixed)

```typescript
// Outer rectangle (frame inner edge only)
frameInnerOffset = RAIL_THICKNESS_OUTER = 0.2"
Boundary: ±50.2" × ±25.2"

// Inner hole (cushion outer edge - complex shape)
playBoundaryPoints + 0.2" outward offset
Follows exact cushion geometry with pocket openings
```

For a standard table:

- Outer: ±50.2" × ±25.2" (frame inner edge) ✅
- Inner: Complex shape following cushion outer edges ✅
- **Visible fill:** Only in tiny gaps at pocket geometry transitions ✅

---

## Coordinate System Reference

**World Space (Physics & Geometry):**

- Origin: (0, 0) at play area center
- +X: East (right)
- +Y: North (up/head of table)
- +Z: Up from table surface

**Three.js Scene:**

- Matches world space
- Camera: Orthographic, looking down from (0, 0, 50)

**Play Area:**

- Width: 100" (X: -50" to +50")
- Height: 50" (Y: -25" to +25")

**Frame:**

- Extends 4.2" beyond play area on all sides
- Total table size: 108.4" × 58.4"

---

## Configuration Values

```typescript
// From src/config.ts
TABLE_WIDTH: 100; // Play area width
TABLE_HEIGHT: 50; // Play area height
FRAME_OFFSET_IN: 4.0; // Frame width
RAIL_THICKNESS_INNER: 0.2; // Cushion inward extent
RAIL_THICKNESS_OUTER: 0.2; // Cushion outward extent
RAIL_COLOR: '#2d1810'; // Dark brown
FRAME_COLOR: '#3d2413'; // Medium brown
TABLE_COLOR: '#0a5f0a'; // Green felt
RAIL_FILL_COLOR: '#000000'; // Black (for rail fill mesh)
```

---

## Potential Solutions

If you want to hide or modify the "outer plane" (rail fill mesh):

### Option 1: Adjust Visibility

```typescript
// In RenderLayers settings
showRails: false; // This hides both rails AND rail fill
```

### Option 2: Modify Z-Position

Move it further below the surface so it's less visible:

```typescript
// In initializeRailFillMesh()
this.railFillMesh.position.z = -0.5; // Instead of -0.05
```

### Option 3: Adjust Opacity

```typescript
// In initializeRailFillMesh()
opacity: 0.0; // Make it invisible
// or
opacity: 0.3; // Make it more transparent
```

### Option 4: Change Color

```typescript
// In config.ts
RAIL_FILL_COLOR: '#0a5f0a'; // Match felt color
// or
RAIL_FILL_COLOR: '#2d1810'; // Match rail color
```

### Option 5: Remove It Entirely

The rail fill mesh could potentially be removed if it's not serving a visual purpose. It seems to be attempting to fill the space between the felt boundary and the frame, but this might not be necessary with the current rendering setup.

---

## Summary

The pool table consists of these layers (Z-order):

```
Z:  0.6  - Pocket caps (optional)
Z:  0.3  - Pocket shadow rings
Z:  0.2  - Pocket highlights
Z:  0.16 - Pocket gradient overlays
Z:  0.15 - Pocket bottom fills
Z:  0.0  - Frame planks, Felt surface, Pocket cylinders
Z: -0.13 - Rail highlights
Z: -0.25 - Rail/cushion boxes
Z: -0.30 - **Rail Fill Mesh** ✅ (below rails, properly contained)
```

The **Rail Fill Mesh** is now properly positioned below the rails and constrained within the frame, filling only the narrow gaps between cushion outer edges and frame inner edge at pocket openings.
