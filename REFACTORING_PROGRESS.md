# Renderer Refactoring Progress

This document tracks the renderer deduplication refactoring work to address the massive code duplication between `Renderer.ts` (2D) and `Renderer3D.ts` (3D).

## Completed Work

### Phase 1: Extract Shared Utilities ✅

**Commits:**
- `95afca1` - Extract color manipulation utilities
- `1239ab7` - Extract trajectory rendering utilities

**Created:**
- `src/render/RenderUtils.ts` - Shared rendering utilities module

**Eliminated Duplication:**

1. **Color Utilities** (~30 lines per renderer, ~60 lines total)
   - `parseHexColor()` - Parse hex color strings to RGB
   - `lightenColor()` - Lighten colors by mixing with white
   - `darkenColor()` - Darken colors by reducing brightness
   - `mixColors()` - Blend two colors together
   - `toRgba()` - Convert RGB to rgba() CSS string
   - `lightenHexColor()` - Convenience wrapper for 2D renderer
   - `darkenHexColor()` - Convenience wrapper for 2D renderer

2. **Trajectory Utilities** (~40 lines per renderer, ~80 lines total)
   - `classifyAxisAlignmentFromVector()` - Classify vectors as horizontal/vertical/diagonal
   - `getAxisPalette()` - Get color palette for trajectory lines based on alignment
   - `AxisAlignment` and `AxisColorPalette` types

**Impact:**
- ✅ **~140 lines of duplication eliminated**
- ✅ Build verified successful
- ✅ Dev server tested working
- ✅ Color manipulation now centralized
- ✅ Trajectory coloring guaranteed consistent between renderers

## Remaining Refactoring Opportunities

### High Priority

#### 1. Large Trajectory Drawing Methods (NOT DUPLICATED)
**Location:** `drawSimpleMathTrajectoryLines`, `drawPhysicsTrajectoryLines`
**Status:** ❌ NOT extractable - renderer-specific implementations

**Why not duplicated:**
- `Renderer.ts` uses 2D canvas context (`this.ctx`), draws in world coordinates
- `Renderer3D.ts` uses UI canvas overlay (`this.uiCtx`), converts world→screen coordinates
- Different boundary clipping logic (2D uses `clampSegmentToPlayArea`, 3D uses `clipLineAtRails`)
- Different rendering APIs (Canvas 2D vs UI overlay)
- Adaptive path length in 3D (based on cut angle), fixed in 2D

**Conclusion:** These are fundamentally different implementations of the same feature, not duplicated code.

#### 2. Boundary/Geometry Utilities (PARTIALLY UNIQUE)
**Location:** Various geometry-related methods

**Potentially extractable:**
- `refreshDerivedGeometry()` - **IDENTICAL** in both renderers (lines 133-136 in Renderer.ts, lines 935-938 in Renderer3D.ts)
  ```typescript
  private refreshDerivedGeometry() {
    this.playBoundaryPoints = computePlayBoundaryPoints(getTableGeometry().rails);
    this.playBounds = computeBoundaryBounds(this.playBoundaryPoints);
  }
  ```

**Unique to Renderer.ts (2D only):**
- `clampSegmentToPlayArea()` - Clamp line segments to play area boundary
- `isPointInsidePlayArea()` - Check if point is inside play boundary polygon
- `intersectSegmentWithBoundary()` - Find intersection of segment with boundary
- `intersectLineWithCornerArc()` - Intersect line with rounded frame corners (legacy, may be unused)

**Recommendation:** Extract `refreshDerivedGeometry()` since it's identical. The boundary clipping functions are 2D-specific and used for cue stick/aim line clamping.

#### 3. Ball Model Loading (3D ONLY)
**Location:** `Renderer3D.ts:448-580+`
**Status:** ❌ 3D-specific, not duplicated
- Complex FBX loading logic
- Texture mapping
- Three.js specific

#### 4. Frame/Rail Rendering Complexity
**Status:** ⚠️ Different rendering paradigms, but conceptually similar

Both renderers create frame outlines and rail geometry, but:
- 2D draws directly to canvas
- 3D creates Three.js meshes

**Potential shared abstraction:** Frame/rail geometry calculation logic (if extracted from rendering)

### Medium Priority

#### 5. Shared Instance Variables
Both renderers have identical properties that could be moved to a base class:
- `scale: number`
- `playBoundaryPoints: Vec2[]`
- `playBounds: BoundaryBounds`
- `frameClipInfo: FrameClipInfo | null`
- `debugRailSegments: Array<...>`

#### 6. Coordinate Transformation
- `Renderer.ts` lines 88-95: World → Canvas transform (manual)
- `Renderer3D.ts` has `worldToScreen()` method

Could extract shared coordinate transformation utilities.

### Low Priority

#### 7. Power Bar Rendering
Both renderers have `drawPowerBar()` and `getPowerBarBounds()` methods, but:
- 2D draws in transformed canvas space
- 3D draws in screen space
- Different enough that extraction may not be worthwhile

## Recommended Next Steps

### Phase 2: Extract Base Renderer Class (Estimated effort: Medium)

Create an abstract `BaseRenderer` class with:

```typescript
abstract class BaseRenderer {
  // Shared properties
  protected scale: number;
  protected playBoundaryPoints: Vec2[] = [];
  protected playBounds: BoundaryBounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  protected frameClipInfo: FrameClipInfo | null = null;
  protected debugRailSegments: Array<{ id: string; inner: Vec2; trimmed: Vec2; startOuter: Vec2 }> = [];

  // Shared methods
  protected refreshDerivedGeometry(): void {
    this.playBoundaryPoints = computePlayBoundaryPoints(getTableGeometry().rails);
    this.playBounds = computeBoundaryBounds(this.playBoundaryPoints);
  }

  // Abstract methods for renderers to implement
  abstract render(world: PhysicsWorld, alpha: number): void;
  abstract resize(): void;
  abstract clear(): void;
}

class Renderer extends BaseRenderer { /* 2D-specific */ }
class Renderer3D extends BaseRenderer { /* 3D-specific */ }
```

**Estimated impact:**
- Reduce boilerplate by ~50 lines per renderer
- Make renderer contracts explicit
- Easier to add new renderer types (e.g., SVG, WebGPU)

### Phase 3: Extract Geometry Calculation from Rendering ✅ (Already Complete!)

**Status:** Upon analysis, this phase is essentially **already done**.

**Why:** The geometry calculations are already extracted to `Geometry.ts`:
- ✅ Frame outline calculation → `frameOutline` in `getTableGeometry()`
- ✅ Rail path calculation → `rails` array in `getTableGeometry()`
- ✅ Pocket placement → `pockets` array in `getTableGeometry()`

Both renderers already consume this pre-calculated geometry via `getTableGeometry()` and just render it. The separation of "what to draw" from "how to draw" already exists.

**Remaining renderer-specific code (intentionally not extracted):**
- **2D Renderer:** Canvas-specific path tracing (`traceRoundedRectPath`), polygon clipping (`clampSegmentToPlayArea`)
- **3D Renderer:** Three.js mesh creation, materials, render orders, depth control

These renderer-specific utilities serve different rendering paradigms and should remain separate.

## Metrics

**Before Refactoring:**
- Renderer.ts: 1,070 lines
- Renderer3D.ts: 3,591 lines
- **Total:** 4,661 lines
- **Duplication:** ~1,500 lines (estimated)

**After Phase 1:**
- Renderer.ts: ~1,014 lines (-56)
- Renderer3D.ts: ~3,535 lines (-56)
- RenderUtils.ts: 163 lines (new)
- **Total:** 4,712 lines (+51 due to documentation/types)
- **Effective code duplication removed:** ~140 lines
- **Duplication remaining:** ~1,360 lines

**Phase 2 Estimate:**
- Additional ~100 lines of duplication could be removed via base class

## Key Learnings

1. **Not all similar code is duplicated code** - The trajectory drawing methods look similar but serve fundamentally different rendering paradigms (2D canvas vs UI overlay)

2. **Shared utilities > base classes (for now)** - Extracting standalone utility functions was safer and easier than creating inheritance hierarchies

3. **Test early, commit often** - Making small, incremental commits with build verification prevented breaking changes

4. **Documentation is critical** - Clear JSDoc comments on shared utilities make it obvious how to use them correctly

## Branch

This work is on the `refactor/renderer-deduplication` branch. Merge into `main` when ready.
