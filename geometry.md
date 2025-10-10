# Pool 2D - Geometry & Coordinate System

This document defines the authoritative coordinate system, table geometry, and naming conventions used throughout the Pool 2D codebase.

## Coordinate System

### World Space
- **Units**: Inches (realistic pool table measurements)
- **Origin**: (0, 0) at exact center of play area
- **Axes**: 
  - `+X` = **Right** (East)
  - `+Y` = **Up** (North, toward head cushion)
- **Orientation Names**:
  - **N** (North/Top/Head)
  - **S** (South/Bottom/Foot)
  - **W** (West/Left)
  - **E** (East/Right)

### Canvas Mapping
Canvas Y-axis is inverted (down = positive) compared to world space (up = positive).

**Transform** (from `Renderer.ts`):
```typescript
const canvasCenterX = this.canvas.width / 2;
const canvasCenterY = this.canvas.height / 2;

this.ctx.translate(canvasCenterX, canvasCenterY);
this.ctx.scale(this.scale, -this.scale);  // Negative Y flips vertical axis
```

**Conversion**:
```typescript
// World → Canvas
canvas.x = canvasCenter.x + scale * world.x
canvas.y = canvasCenter.y - scale * world.y  // Note: minus for Y flip

// Canvas → World (for mouse input)
world.x = (canvas.x - canvasCenter.x) / scale
world.y = -(canvas.y - canvasCenter.y) / scale  // Note: negate for Y flip
```

## Table Geometry

### Dimensions (Standard 9-foot table)
- **Play Area**: 100" × 50" (2:1 aspect ratio)
- **Center**: (0, 0)
- **Bounds**: 
  - X ∈ [-50, 50]
  - Y ∈ [-25, 25]
- **Ball Radius**: 1.125" (standard 2.25" diameter)
- **Pocket Radius**: 2.0" (capture zone)
- **Rail Thickness**: 3.5" (visual cushion width)

### Rails (4 line segments)

Rails are defined in `Physics.ts` initialization. Each rail has an **inward-pointing normal** calculated automatically.

```typescript
// North rail (top/head)
new Rail(-50, 25, 50, 25)
// → Endpoints: (-50, 25) to (50, 25)
// → Normal: (0, -1) pointing down into play area

// South rail (bottom/foot)
new Rail(-50, -25, 50, -25)
// → Endpoints: (-50, -25) to (50, -25)
// → Normal: (0, 1) pointing up into play area

// West rail (left)
new Rail(-50, -25, -50, 25)
// → Endpoints: (-50, -25) to (-50, 25)
// → Normal: (1, 0) pointing right into play area

// East rail (right)
new Rail(50, -25, 50, 25)
// → Endpoints: (50, -25) to (50, 25)
// → Normal: (-1, 0) pointing left into play area
```

**Normal Calculation** (from `Shapes.ts`):
```typescript
class Rail {
  constructor(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    
    // Perpendicular vector (rotated 90° CCW)
    this.nx = -dy / len;
    this.ny = dx / len;
  }
}
```

### Pockets (6 circular zones)

Pockets are defined in `Physics.ts` initialization with 2.0" capture radius.

```typescript
// Corner pockets (4)
new Pocket(-50, 25, 2.0)   // NW (top-left)
new Pocket(50, 25, 2.0)    // NE (top-right)
new Pocket(-50, -25, 2.0)  // SW (bottom-left)
new Pocket(50, -25, 2.0)   // SE (bottom-right)

// Middle pockets (2)
new Pocket(-50, 0, 2.0)    // W (left middle)
new Pocket(50, 0, 2.0)     // E (right middle)
```

**Capture Detection** (from `Shapes.ts`):
```typescript
class Pocket {
  contains(ball: Ball): boolean {
    const dx = ball.x - this.x;
    const dy = ball.y - this.y;
    const distSq = dx * dx + dy * dy;
    return distSq < this.radius * this.radius;
  }
}
```

## Naming Conventions

### In Code Comments & Logic
❌ **Avoid**: "left", "right", "top", "bottom"
✅ **Use**: N, E, S, W or "north", "east", "south", "west"

### Examples
```typescript
// ❌ Bad
const topRail = new Rail(-50, 25, 50, 25);  // Ambiguous

// ✅ Good
const northRail = new Rail(-50, 25, 50, 25);  // Clear orientation

// ❌ Bad
ball.x = -25;  // Move ball to left side

// ✅ Good  
ball.x = -25;  // Move ball 25" west of center
```

### Position Descriptions
- **"North of center"**: Positive Y
- **"South of center"**: Negative Y
- **"East of center"**: Positive X
- **"West of center"**: Negative X

## Standard Positions

### Cue Ball (Break Position)
```typescript
const CUE_BALL_POSITION = { x: -25.0, y: 0.0 };
// 25" west of center, on centerline
```

### Rack (Apex at Foot Spot)
```typescript
const FOOT_SPOT = { x: 25.0, y: 0.0 };
// 25" east of center, on centerline
// Rack extends south from this point
```

### Head String & Foot String
```typescript
const HEAD_STRING_X = -18.0;  // West side
const FOOT_STRING_X = 18.0;   // East side
```

## Debug Visualization

The debug overlay (`DebugDraw.ts`) shows:
- **Rail normals**: Green arrows pointing inward from rail midpoints
- **Velocities**: Yellow arrows from ball centers
- **Contact points**: Red circles at collision locations
- **Pocket zones**: Dashed circles showing 2.0" capture radius

Toggle with **D** key or **Debug** button.

## Collision Normals

### Ball-Rail Collisions
Normal always points **from rail into play area** (inward).

Example: Ball hitting North rail
- Rail position: Y = 25
- Rail normal: (0, -1)
- Reflection flips Y velocity while preserving X

### Ball-Ball Collisions  
Normal points **from ball A to ball B**.

```typescript
const dx = ballB.x - ballA.x;
const dy = ballB.y - ballA.y;
const dist = Math.sqrt(dx * dx + dy * dy);
const nx = dx / dist;
const ny = dy / dist;
```

## Validation Checklist

When adding/modifying geometry:

✅ Are world coordinates in inches?
✅ Is origin at (0, 0) center of play area?
✅ Does +Y point north (up)?
✅ Does +X point east (right)?
✅ Do rail normals point inward?
✅ Are N/E/S/W names used instead of left/right/top/bottom?
✅ Does canvas transform flip Y-axis correctly?
✅ Do collisions use the correct normal direction?

## Reference Implementation

See these files for authoritative geometry usage:
- `src/config.ts` - Table dimensions and constants
- `src/physics/Shapes.ts` - Ball, Rail, Pocket classes
- `src/physics/Physics.ts` - World initialization
- `src/render/Renderer.ts` - Canvas transform and rendering
- `src/game/Game.ts` - Ball dragging (canvas ↔ world conversion)
