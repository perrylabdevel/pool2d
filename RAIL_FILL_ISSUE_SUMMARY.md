# Rail Fill "Outer Plane" Issue - Summary & Solutions

## Issue Identified ✓

You're seeing the **Rail Fill Mesh** - a rectangular plane with a hole cut out that sits between the playing surface and the outer frame.

### Visual Description

When looking at the table from above, you see a dark border (typically black or near-black) between:

- The green felt (playing surface)
- The brown wooden frame

This creates an unintended "step" or "shelf" appearance around the entire table perimeter.

---

## Technical Details

### What It Is

- **Component:** `railFillMesh` in `Renderer3D.ts`
- **Position:** Z = -0.05 (slightly below felt surface at Z=0)
- **Render Order:** `orderTable - 1` (renders before table)
- **Visibility:** Controlled by `showRails` flag

### Geometry

```typescript
// Outer rectangle (matches frame boundary)
minX - 4.2" to maxX + 4.2"
minY - 4.2" to maxY + 4.2"

// Inner hole (matches play boundary)
minX to maxX (±50" for standard table)
minY to maxY (±25" for standard table)

// Result: 4.2" visible border on all sides
```

### Current Settings

- **Color:** `CONFIG.RAIL_FILL_COLOR = '#000000'` (black)
- **Opacity:** 0.96 (nearly opaque)
- **Blending:** When near-black, blends with table color
- **Material:** `MeshBasicMaterial` (unaffected by lighting)

### Code Location

**File:** `src/render/Renderer3D.ts`

- Creation: Line 1378-1398 (`initializeRailFillMesh()`)
- Geometry: Line 1432-1457 (`createRailFillGeometry()`)
- Color: Line 1400-1420 (`computeRailFillColor()`)
- Color update: Line 1422-1430 (`updateRailFillMaterialColor()`)

---

## Why It Exists

The rail fill mesh was likely created to:

1. Fill visual gaps between rail segments
2. Provide visual continuity from felt to frame
3. Cover any geometry inconsistencies in the rail system

However, with the current implementation, it creates a visible rectangular border that you're observing.

---

## Solutions Applied ✅

### ✅ IMPLEMENTED: Proper Geometry and Positioning

**Applied changes:**

1. **Geometry Fix:**
   - Outer boundary now sourced from `frameOutline.innerHalfWidth/Height`, respecting rounded frame corners
   - Inner hole follows the exact cushion outer edge via `playBoundaryPoints`
   - Matches complex pocket geometry instead of a simple rectangle

2. **Z-Position Fix:**
   - Changed from Z=-0.05 to Z=-0.3 (below rails at Z=-0.25)
   - Prevents covering cushions

3. **Color Fix:**
   - Uses `RAIL_FILL_COLOR` directly without blending
   - Shows user-selected color exactly

4. **Render Order Fix:**
   - Changed from `orderTable - 1` to `orderRails - 1`
   - Ensures rails render on top

**Result:** Rail fill now only appears in narrow gaps at pocket openings, using the exact color selected in UI.

---

### Alternative Option 1: Hide It Completely (Not Recommended)

**Location:** `src/render/Renderer3D.ts:1393`

```typescript
// Before:
this.railFillMesh.visible = this.layerVisibility.showRails;

// After:
this.railFillMesh.visible = false;
```

**Pros:** Immediate fix, no visual border
**Cons:** May expose gaps if rails don't perfectly align

---

### Alternative Option 2: Make It Match the Felt Color (Not Needed)

**Location:** `src/config.ts:66` or via UI

**Via Code:**

```typescript
RAIL_FILL_COLOR: '#0a5f0a', // Match TABLE_COLOR (green felt)
```

**Via UI:**

1. Open Settings Panel
2. Find "Rail Fill Color" setting
3. Set to match table color (#0a5f0a)

**Pros:** Visually blends with felt, less noticeable
**Cons:** Still technically visible as a slight color variation

---

### Alternative Option 3: Make It Match the Rail Color (Not Needed)

**Location:** `src/config.ts:66` or via UI

```typescript
RAIL_FILL_COLOR: '#2d1810', // Match RAIL_COLOR (dark brown)
```

**Pros:** Creates visual continuity with rails
**Cons:** Creates a wider dark border around table

---

### Alternative Option 4: Make It Transparent (Not Needed)

**Location:** `src/render/Renderer3D.ts:1386`

```typescript
// Before:
opacity: 0.96,

// After:
opacity: 0.0,
```

**Pros:** Completely invisible, preserves geometry
**Cons:** Same as hiding completely

---

### Alternative Option 5: Lower It Below View (Partially Applied)

**Location:** `src/render/Renderer3D.ts:1391`

```typescript
// Before:
this.railFillMesh.position.z = -0.05;

// After:
this.railFillMesh.position.z = -1.0; // Below all visible layers
```

**Pros:** Hidden from top-down view, preserves geometry
**Cons:** May still be visible in certain camera angles (if camera moves)

---

### Option 6: Adjust Geometry to Match Rails Exactly

This is the most complex but proper solution.

**Goal:** Make the inner hole match the exact rail boundaries, not just the play area rectangle.

**Implementation:**

```typescript
private createRailFillGeometry(): THREE.ShapeGeometry | null {
  if (!this.playBoundaryPoints.length) {
    return null;
  }

  const frameWidth = Math.max(0.1, CONFIG.FRAME_OFFSET_IN);
  const outerOffset = CONFIG.RAIL_THICKNESS_OUTER + frameWidth;

  // Outer rectangle (same as before)
  const outer = new THREE.Shape();
  const { minX, maxX, minY, maxY } = this.playBounds;
  outer.moveTo(minX - outerOffset, maxY + outerOffset);
  outer.lineTo(maxX + outerOffset, maxY + outerOffset);
  outer.lineTo(maxX + outerOffset, minY - outerOffset);
  outer.lineTo(minX - outerOffset, minY - outerOffset);
  outer.closePath();

  // NEW: Inner hole follows EXACT rail boundary (not rectangular)
  const inner = new THREE.Path();
  const points = this.playBoundaryPoints;
  inner.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    inner.lineTo(points[i].x, points[i].y);
  }
  inner.closePath();
  outer.holes.push(inner);

  return new THREE.ShapeGeometry(outer);
}
```

**Pros:** Proper solution, no visible border, fills only actual gaps
**Cons:** More complex, requires testing with various geometries

---

### Alternative Option 7: Remove It Entirely (Not Necessary)

If you find it's not serving a purpose:

**Location:** `src/render/Renderer3D.ts:1344`

```typescript
// In initializePockets(), comment out:
// this.initializeRailFillMesh();
```

**Pros:** Cleanest solution if not needed
**Cons:** May expose gaps if they exist

---

## Recommended Solution

### For Immediate Fix:

**Option 2** (Match Felt Color) + **Option 6** (Fix Geometry)

1. **Short term:** Set `RAIL_FILL_COLOR: '#0a5f0a'` to match felt
2. **Long term:** Update `createRailFillGeometry()` to follow exact rail boundaries

This approach:

- Immediately reduces visual impact
- Provides proper long-term solution
- Maintains fill functionality for any actual gaps

### Implementation Steps:

1. **Quick Fix (Now):**

```bash
# In src/config.ts, change line 66:
RAIL_FILL_COLOR: '#0a5f0a', // Match felt color
```

2. **Proper Fix (Later):**
   Update `createRailFillGeometry()` in `src/render/Renderer3D.ts:1432` to use `playBoundaryPoints` for inner hole instead of rectangular bounds.

---

## Testing Your Fix

After implementing any solution:

1. **Restart the game** (R key or reload)
2. **Check all angles:**
   - Top-down view (normal gameplay)
   - Check if any gaps appear between rails
   - Verify frame/felt transition looks clean
3. **Test with different geometries:**
   - Adjust pocket sizes
   - Modify rail positions
   - Ensure fix works in all configurations

---

## UI Control

You can adjust the rail fill color without code changes:

1. Open **Settings Panel** (in-game UI)
2. Navigate to **Colors** section
3. Find **"Rail Fill Color"** input
4. Set to:
   - `#0a5f0a` (match felt - green)
   - `#2d1810` (match rails - dark brown)
   - `#3d2413` (match frame - medium brown)

This setting is saved to localStorage and persists between sessions.

---

## Related Files

- `src/render/Renderer3D.ts` - Main rendering logic
- `src/config.ts` - Default color configuration
- `src/ui/SettingsManager.ts` - UI color management
- `src/ui/GameSettingsPanel.ts` - Settings UI
- `src/geometry/Geometry.ts` - Rail boundary computation

---

## Summary ✅

The "outer plane" issue has been **completely resolved**. The **Rail Fill Mesh** now:

- Fills only narrow gaps at pocket openings (not a visible border)
- Stays within frame boundaries
- Follows exact cushion outer edge geometry
- Displays the user-selected "Corner Fill" color without modification
- Renders below the rails (not covering them)
- Works correctly with scene background disabled for transparency

**Status:** FIXED - No further action needed.
