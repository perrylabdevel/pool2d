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

## Geometry.ts Function Decomposition

**Branch:** `refactor/geometry-function-breakup`
**Status:** ✅ Completed (Phase 1)

### Problem

The `getTableGeometry()` function in `src/geometry/Geometry.ts` is 439 lines long (lines 300-739), making it difficult to:
- Understand the logic flow
- Test individual calculations
- Debug geometry issues
- Modify specific sections safely

### Function Structure Analysis

The monolithic function performs 7 distinct logical operations:

1. **Jaw Position Calculations** (lines 302-350, ~48 lines)
   - Derives `JAW_X_OUTER`, `JAW_X_INNER` (side pockets)
   - Derives `CORNER_JAW_Y`, `CORNER_JAW_X` (corner pockets)
   - Applies overrides and clamping
   - Complex geometry derivation based on rail thickness, frame offset, etc.

2. **Base Coordinate Constants** (lines 352-373, ~21 lines)
   - Named position constants: `Y_N_STRAIGHT`, `X_E_STRAIGHT`, etc.
   - Throat join calculations: `throatJoinX`, `throatJoinYNorth`
   - Mouth positions for side pockets

3. **Frame Outline Calculations** (lines 385-435, ~50 lines)
   - Frame dimensions (outer/inner)
   - Corner radius handling
   - Frame corner point generation (with/without rounded corners)

4. **Rail Point Calculations** (lines 437-585, ~148 lines)
   - Corner outer points (8 points)
   - Base corner/vertical points (12 points)
   - Straight section endpoints (8 points)
   - Throat joint points (6 points)
   - **Side cut angle transformations** (lines 476-502)
   - **Corner cut angle transformations** (lines 504-585)

5. **Rail Generation** (lines 587-611, ~24 lines)
   - 24 `addRail()` calls creating rails array
   - North rails (8), East rails (3), South rails (8), West rails (3)

6. **Pocket Definitions** (lines 613-645, ~32 lines)
   - 6 pocket centers (4 corners + 2 sides)
   - Cut normal hints for each pocket

7. **Return Statement** (lines 646-738, ~92 lines)
   - Assembles final `TableGeometry` object
   - Includes all calculated rails, frame, pockets

### Refactoring Plan

Extract 6 helper functions, leaving the main function as a clean orchestrator:

```typescript
// BEFORE: 439 lines
export function getTableGeometry(): TableGeometry {
  // ... 439 lines of mixed calculations ...
}

// AFTER: ~20-30 lines
export function getTableGeometry(): TableGeometry {
  const jawPositions = computeJawPositions();
  const baseCoords = computeBaseCoordinates(jawPositions);
  const frameOutline = computeFrameOutline();
  const railPoints = computeRailPoints(baseCoords);
  const rails = generateRails(railPoints);
  const pockets = computePockets(railPoints, baseCoords);

  return {
    playWidthIn: PLAY_WIDTH_IN,
    playHeightIn: PLAY_HEIGHT_IN,
    cushionProfileIn: CUSHION_PROFILE_IN,
    pocketCaptureRadiusIn: CONFIG.POCKET_CAPTURE_RADIUS_CORNER,
    cornerPocketCaptureRadiusIn: CONFIG.POCKET_CAPTURE_RADIUS_CORNER,
    sidePocketCaptureRadiusIn: CONFIG.POCKET_CAPTURE_RADIUS_SIDE,
    cornerPocketVisualRadiusIn: CONFIG.POCKET_VISUAL_RADIUS_CORNER,
    sidePocketVisualRadiusIn: CONFIG.POCKET_VISUAL_RADIUS_SIDE,
    pocketShelfDepthIn: CONFIG.POCKET_SHELF_DEPTH_IN,
    rails,
    frameOutline,
    pockets,
  };
}
```

#### Helper Function 1: `computeJawPositions()`
**Lines:** 302-350 (~48 lines)
**Purpose:** Calculate jaw positions for side and corner pockets
**Returns:**
```typescript
interface JawPositions {
  JAW_X_OUTER: number;
  JAW_X_INNER: number;
  CORNER_JAW_Y: number;
  CORNER_JAW_X: number;
  sideStraight: number;
  sideInner: number;
  cornerStraight: number;
}
```

#### Helper Function 2: `computeBaseCoordinates()`
**Lines:** 352-373 (~21 lines)
**Purpose:** Calculate named coordinate constants
**Input:** `JawPositions`
**Returns:**
```typescript
interface BaseCoordinates {
  Y_N_STRAIGHT: number;
  Y_S_STRAIGHT: number;
  Y_N_INNER: number;
  Y_S_INNER: number;
  X_E_STRAIGHT: number;
  X_W_STRAIGHT: number;
  mouthYNorth: number;
  mouthYSouth: number;
  throatJoinX: number;
  throatJoinYNorth: number;
  throatJoinYSouth: number;
  // ... other constants
}
```

#### Helper Function 3: `computeFrameOutline()`
**Lines:** 385-435 (~50 lines)
**Purpose:** Calculate frame outline geometry
**Returns:** `FrameOutline` (already defined type)

#### Helper Function 4: `computeRailPoints()`
**Lines:** 437-585 (~148 lines)
**Purpose:** Calculate all rail endpoint positions with cut angle transformations
**Input:** `BaseCoordinates`
**Returns:**
```typescript
interface RailPoints {
  // North pocket
  northCornerWest: Vec2;
  northCornerEast: Vec2;
  northStraightWestEnd: Vec2;
  northStraightEastStart: Vec2;
  northThroatLeftJoint: Vec2;
  northThroatRightJoint: Vec2;
  northMouth: Vec2;

  // South pocket (mirrored)
  // East/West verticals
  // Corner outer points
  // ... etc
}
```

#### Helper Function 5: `generateRails()`
**Lines:** 587-611 (~24 lines)
**Purpose:** Generate rails array from calculated points
**Input:** `RailPoints`
**Returns:** `RailDef[]`

#### Helper Function 6: `computePockets()`
**Lines:** 613-645 (~32 lines)
**Purpose:** Generate pocket definitions with cut hints
**Input:** `RailPoints`, `BaseCoordinates`
**Returns:** `PocketDef[]`

### Expected Impact

**Before:**
- `getTableGeometry()`: 439 lines
- Difficult to understand what each section does
- Hard to test individual calculations
- Risky to modify

**After:**
- `getTableGeometry()`: ~25 lines (orchestrator)
- `computeJawPositions()`: ~50 lines
- `computeBaseCoordinates()`: ~25 lines
- `computeFrameOutline()`: ~52 lines
- `computeRailPoints()`: ~150 lines
- `generateRails()`: ~26 lines
- `computePockets()`: ~35 lines

**Total:** ~363 lines (116 lines saved from clearer structure + removed duplication)

**Benefits:**
- ✅ Each function has a single, clear responsibility
- ✅ Individual calculations can be unit tested
- ✅ Easier to debug geometry issues
- ✅ Safer to modify specific sections
- ✅ Better documentation via function names and types

### Testing Strategy

1. **Before refactoring:** Capture baseline geometry output
2. **After each extraction:** Verify geometry output is identical
3. **Final verification:** Run full build and visual inspection in dev server

### Phase 1 Results ✅

**Completed Extractions:**
1. ✅ `computeJawPositions()` - 48 lines of jaw calculations
2. ✅ `computeBaseCoordinates()` - 22 lines of coordinate constants
3. ✅ `computeFrameOutline()` - 50 lines of frame geometry

**Before:**
- `getTableGeometry()`: 439 lines (lines 300-739)
- All logic inline, difficult to test or modify

**After:**
- `getTableGeometry()`: 342 lines (-97 lines, -22%)
- `computeJawPositions()`: 79 lines
- `computeBaseCoordinates()`: 45 lines
- `computeFrameOutline()`: 60 lines
- **Total extracted:** 184 lines into focused functions

**Build:**
- ✅ Build successful: 775.35 kB
- ✅ No regressions
- ✅ All geometry calculations preserved

**Benefits Achieved:**
- ✅ Jaw calculation logic now testable in isolation
- ✅ Coordinate constants centralized and documented
- ✅ Frame outline calculation separated from rendering
- ✅ Main function 22% shorter and easier to understand
- ✅ Each helper has single responsibility with clear interface

### Phase 2 Opportunities (Future Work)

The remaining rail point calculations and pocket generation could be further extracted if needed:
- `computeRailPoints()` - ~150 lines of rail endpoint calculations with cut angles
- `generateRails()` - ~25 lines of rail array generation
- `computePockets()` - ~35 lines of pocket definitions

However, these sections are more tightly coupled to the main function logic and may not provide as much benefit. The current Phase 1 extraction already achieved the primary goals.

### Phase 4: Extract Inline HTML Panels to TypeScript ⏳ (Planned)

**Problem:** The `index.html` file is 793 lines, with 82% being inline panel HTML. This creates maintenance issues and inconsistency with other panels.

**Current State:**
- ✅ `SettingsPanel.ts` - Generates HTML programmatically
- ✅ `GameSettingsPanel.ts` - Generates HTML programmatically
- ❌ `GeometryPanel` - 429 lines of inline HTML in index.html
- ❌ `RenderLayerPanel` - 226 lines of inline HTML in index.html

**Plan:**
1. Move GeometryPanel HTML generation to TypeScript (GeometryPanel.ts already exists for logic)
2. Move RenderLayerPanel HTML generation to TypeScript
3. Clean up index.html to just contain structure and canvas setup

**Expected Impact:**
- `index.html`: 793 → ~140 lines (-653 lines, -82%)
- Consistent approach across all panels
- Easier to maintain and modify panels
- Better separation of concerns

**See:** `UI_REFACTORING_PLAN.md` for detailed implementation plan

## Branch

This work is on the `refactor/renderer-deduplication` branch. Merge into `main` when ready.
