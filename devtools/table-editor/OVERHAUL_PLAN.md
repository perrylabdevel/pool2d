# Table Editor Overhaul Plan

## Executive Summary

The table editor is a browser-based geometry editing tool that produces `PhysicsJson` for the game's collision system. While functional for basic use cases, it has **critical data integrity issues** that can produce broken collision geometry and **architectural problems** that make maintenance difficult.

---

## Part 1: Audit Findings

### Critical Issues (Must Fix)

#### 1. Normal Vector Corruption in `scalePhysicsJson`
**File:** `utils/TableGeometryUtils.ts:489-490`
```typescript
r.normal.x *= scaleX;
r.normal.y *= scaleY;
```
**Problem:** This scales unit normal vectors by play area dimensions, destroying their unit length property. A normal of `{x: 1, y: 0}` scaled by `{scaleX: 0.9, scaleY: 1.1}` becomes `{x: 0.9, y: 0}` which is no longer unit length.

**Impact:** Game's jaw rail filtering uses dot products assuming unit normals. Corrupted normals cause:
- Pocket mouth detection failures
- Incorrect ball bounce directions
- Rail segments filtering incorrectly

**Fix:** Normalize vectors after scaling or don't scale normals at all (they're directional, not positional).

#### 2. Silent Data Corruption in `sanitizePhysicsJson`
**File:** `utils/TableGeometryUtils.ts:144-173`
```typescript
const center = sanitizePoint(p?.center, { x: 0, y: 0 });
```
**Problem:** Invalid pocket centers default to `{x: 0, y: 0}` (table center) without warning. Invalid rails get `from: {x: 0, y: 0}, to: {x: 0, y: 0}` creating zero-length rails.

**Impact:**
- Corrupted geometry appears valid but causes invisible gameplay bugs
- No user feedback about data loss
- Makes debugging extremely difficult

**Fix:** Throw errors for critical validation failures, log warnings for repairs, provide repair report to UI.

#### 3. No Normal Vector Validation
**Problem:** Editor never validates that:
- Normal vectors are unit length (length = 1.0)
- Normal vectors point inward (toward table center)
- Normal vectors are perpendicular to rail segments

**Impact:** Game auto-corrects normals but the editor shows incorrect data. What you see is not what game uses.

#### 4. No Collision Preview
**Problem:** Editor shows visual geometry but not what the game's collision system will actually use:
- No visualization of derived `play_area_*` rails
- No visualization of derived jaw rails from outlines
- No visualization of pocket capture zones vs visual radius
- No preview of rail splitting around pockets

**Impact:** Users can't verify their geometry will work correctly in-game.

---

### High Priority Issues

#### 5. Dead Code: `stores/TableStore.ts`
**File:** `stores/TableStore.ts` (121 lines)
**Problem:** Completely unused - replaced by `TableLibraryStore`. Creates confusion about which store to use.
**Fix:** Delete entirely.

#### 6. Memory Leak in TablePreview
**File:** `components/TablePreview.ts`
**Problem:** `animate()` RAF loop runs indefinitely with no cleanup. Creating multiple editor instances leaks animation frames.
**Fix:** Add `dispose()` method that cancels RAF and cleans up Three.js resources.

#### 7. Monolithic App Class
**File:** `TableEditorApp.ts` (1726 lines)
**Problem:** Single file handles:
- UI rendering
- Event handling
- Geometry editing
- WebSocket communication
- IndexedDB persistence
- Undo/redo
- Import/export
- Skin management

**Fix:** Extract into focused modules.

#### 8. Magic Numbers Scattered Throughout
**Locations:**
- `TableEditorApp.ts:1290-1292`: Hardcoded pixel dimensions
- `TableGeometryUtils.ts:152`: Circle outline steps (20)
- `TableGeometryUtils.ts:367`: Default pocket radius (2.9296875)
- `TableGeometryUtils.ts:524`: Pocket tolerance (4 sq inches)
- `TableGeometryUtils.ts:540`: Rail tolerance (25 sq inches)
- Various snap tolerances (8px, 0.25in, etc.)

**Fix:** Create `constants.ts` with documented values.

---

### Medium Priority Issues

#### 9. Race Conditions in Persistence
**File:** `TableEditorApp.ts:57`
**Problem:** Single debounce timer for persistence. Rapid edits can lose intermediate states.
**Fix:** Use IndexedDB transactions properly, consider optimistic locking.

#### 10. Silent Error Handling
**Pattern throughout codebase:**
```typescript
} catch {
  // ignore
}
```
**Problem:** Storage failures, network errors, and parse failures are silently swallowed.
**Fix:** Add proper error reporting to UI.

#### 11. WebSocket Reconnection
**File:** `TableEditorApp.ts:1626`
**Problem:** Fixed 5-second retry without backoff spams logs on persistent failures.
**Fix:** Exponential backoff with max delay.

#### 12. No Input Validation in Edit Handlers
**File:** `TableGeometryUtils.ts:596-649`
**Problem:** `applyGeometryEdit` doesn't validate array bounds before accessing.
**Fix:** Add defensive bounds checking.

---

### Low Priority Issues

#### 13. O(n^2) Mirror Logic
**File:** `TableGeometryUtils.ts:543` - `findMirroredRailPartners`
**Problem:** Iterates all rails for every edit when mirror enabled.
**Fix:** Cache partner relationships, rebuild only on structural changes.

#### 14. TypeScript Type Bypasses
**Pattern:** `(mesh as any).userData`
**Problem:** Loses type safety benefits.
**Fix:** Define proper interfaces for Three.js userData.

#### 15. Snap Assist Non-Determinism
**File:** `TableEditorApp.ts`
**Problem:** When multiple snap candidates within tolerance, selection is arbitrary.
**Fix:** Use stable ordering (e.g., by distance, then by coordinate).

---

## Part 2: Overhaul Plan

### Phase 1: Critical Fixes (Foundation)

#### 1.1 Fix Normal Vector Handling
- [ ] Fix `scalePhysicsJson` to preserve unit normals
- [ ] Add `normalizeNormal()` utility function
- [ ] Add validation: `isUnitVector(v)` checks `|length - 1| < epsilon`
- [ ] Add validation: `isInwardNormal(rail, tableCenter)` checks dot product
- [ ] Add auto-repair option that normalizes corrupted normals

#### 1.2 Fix Sanitization to Report Issues
- [ ] Change `sanitizePhysicsJson` signature to return `{ json, warnings, errors }`
- [ ] Categorize issues: `error` (fatal), `warning` (repaired), `info` (minor)
- [ ] Display validation results in editor UI
- [ ] Block export if critical errors exist

#### 1.3 Add Collision Preview Mode
- [ ] Add toggle to show "game view" vs "editor view"
- [ ] In game view:
  - Show derived `play_area_*` rails in distinct color
  - Show derived jaw rails from outline processing
  - Show pocket capture radius circle (may differ from visual)
  - Show rail segments after pocket splitting

### Phase 2: Architecture Cleanup

#### 2.1 Delete Dead Code
- [ ] Remove `stores/TableStore.ts`
- [ ] Audit for other unused exports

#### 2.2 Extract Modules from TableEditorApp
```
TableEditorApp.ts (1726 lines) →
├── TableEditorApp.ts (~300 lines) - orchestration only
├── ui/
│   ├── Sidebar.ts - left/right sidebar rendering
│   ├── Toolbar.ts - top toolbar
│   ├── JsonEditor.ts - JSON textarea panel
│   └── Dialogs.ts - modals and confirmations
├── editing/
│   ├── EditController.ts - handle preview edits, undo/redo
│   ├── SelectionManager.ts - selection state
│   └── MirrorController.ts - symmetry logic
├── io/
│   ├── WebSocketBridge.ts - game communication
│   ├── FileExporter.ts - .railrush-table export
│   └── SaveServer.ts - node save endpoint
└── constants.ts - all magic numbers
```

#### 2.3 Fix TablePreview Lifecycle
- [ ] Add `dispose()` method
- [ ] Cancel RAF on dispose
- [ ] Dispose Three.js geometries/materials
- [ ] Track animation frame ID for cancellation

### Phase 3: Data Integrity

#### 3.1 Schema Validation
- [ ] Define JSON Schema for PhysicsJson
- [ ] Validate on import (file load, paste)
- [ ] Validate before export
- [ ] Show schema validation errors in UI

#### 3.2 Geometry Validation Rules
Add validation checks for:
- [ ] All rails form closed boundary (no gaps)
- [ ] No overlapping rails
- [ ] No zero-length rails
- [ ] Pockets are within reasonable bounds
- [ ] Pocket radii are reasonable (0.5" - 5")
- [ ] No pockets overlap
- [ ] Outlines are closed (first ≈ last point)
- [ ] Normal vectors are unit length
- [ ] Normal vectors point inward

#### 3.3 Game Simulation Preview
- [ ] Run game's `Physics.ts` processing on editor geometry
- [ ] Show exactly what rails the game will use
- [ ] Highlight discrepancies between editor and game view
- [ ] Show jaw rail derivation results

### Phase 4: UX Improvements

#### 4.1 Error Reporting
- [ ] Toast notifications for transient errors
- [ ] Validation panel showing all issues
- [ ] Color-code geometry by validation status (green=ok, yellow=warning, red=error)

#### 4.2 Constants Configuration
- [ ] Move magic numbers to `constants.ts`
- [ ] Add settings panel to adjust:
  - Snap tolerance
  - Grid spacing
  - Pocket capture defaults
  - Circle outline resolution

#### 4.3 WebSocket Improvements
- [ ] Exponential backoff (1s, 2s, 4s, 8s, max 30s)
- [ ] Connection status indicator
- [ ] Manual reconnect button

### Phase 5: Testing & Documentation

#### 5.1 Unit Tests
- [ ] Test `sanitizePhysicsJson` with various corrupt inputs
- [ ] Test `scalePhysicsJson` preserves normal unit length
- [ ] Test mirror logic correctness
- [ ] Test snap assist determinism

#### 5.2 Integration Tests
- [ ] Round-trip: create geometry → export → import → verify identical
- [ ] Game compatibility: editor output → game load → verify no warnings

#### 5.3 Documentation
- [ ] Add inline JSDoc for all public functions
- [ ] Create user guide for editor workflow
- [ ] Document PhysicsJson format requirements

---

## Part 3: Recommended Implementation Order

### Immediate (Before Next Feature) - COMPLETED
1. ✅ Fix `scalePhysicsJson` normal corruption - Normals now recomputed from endpoints after scaling
2. ✅ Make sanitization report warnings - Returns `SanitizeResult` with `issues[]` array
3. ✅ Delete `TableStore.ts` - Removed dead code and unused import
4. ✅ Add normal vector validation utilities - `computeRailNormal`, `normalizeVector`, `isUnitVector`, `isInwardNormal`
5. ✅ Extract constants to config - Created `utils/constants.ts` with all magic numbers
6. ✅ Fix TablePreview memory leak - Enhanced `dispose()` method cleans up all Three.js resources

### Short Term (Next Sprint) - COMPLETED
7. ✅ Add collision preview mode - Shows play_area rails (green), jaw rails (magenta), normal vectors (cyan), and pocket capture zones (orange). Correctly excludes visual-only cushion rails.
8. ✅ Add basic geometry validation UI - Shows errors/warnings/info in Selection panel with color-coded severity indicators

### Medium Term (Next Month) - IN PROGRESS
9. ✅ Modularize TableEditorApp (partial) - Extracted IO modules:
   - `io/WebSocketBridge.ts` - Game communication with exponential backoff reconnection
   - `io/SaveServer.ts` - Disk persistence via save server
   - `io/FileIO.ts` - Import/export file handling
10. Add JSON Schema validation
11. ✅ Add game simulation preview - Collision overlay now derives jaw rails from cushion outlines using the same logic as the game (`utils/CollisionDerivation.ts`)
12. Improve error reporting

### Long Term (Technical Debt)
13. Add unit tests - **8 hours**
14. Fix O(n²) mirror logic - **2 hours**
15. TypeScript strictness improvements - **4 hours**

---

## Appendix: Game Requirements for Valid PhysicsJson

### Rail Requirements
| Property | Type | Constraints | Used For |
|----------|------|-------------|----------|
| `from` | Vec2 | finite x,y | Collision segment start |
| `to` | Vec2 | finite x,y | Collision segment end |
| `normal` | Vec2 | **unit length**, points inward | Bounce direction, jaw filtering |
| `outline` | Vec2[] | closed loop preferred | Jaw rail derivation |
| `id` | string | unique, pattern: `cushion_*`, `play_area_*` | Processing routing |

### Pocket Requirements
| Property | Type | Constraints | Used For |
|----------|------|-------------|----------|
| `center` | Vec2 | finite x,y | Capture zone center |
| `radius` | number | > 0.05 | Visual radius |
| `captureRadius` | number? | > 0.05 or omit | Actual capture (defaults to radius) |
| `outline` | Vec2[] | closed loop | Jaw proximity checks |
| `id` | string | unique | Corner vs side classification |

### Play Area Requirements
| Property | Type | Constraints |
|----------|------|-------------|
| `width` | number | > 0, finite |
| `height` | number | > 0, finite |

### Normal Vector Computation (Reference)
The game computes rail normals as:
```typescript
// Perpendicular to rail direction
const dx = to.x - from.x;
const dy = to.y - from.y;
const len = Math.hypot(dx, dy);
let nx = -dy / len;  // Unit perpendicular
let ny = dx / len;

// Ensure pointing toward table center
const midX = (from.x + to.x) / 2;
const dotToCenter = nx * (0 - midX) + ny * (0 - midY);
if (dotToCenter < 0) { nx = -nx; ny = -ny; }
```

---

## Questions for Product Review

1. Should editor block export on validation errors, or just warn?
2. Is the collision preview feature high priority enough for Phase 1?
3. Should we preserve backwards compatibility with existing `.railrush-table` files?
4. What level of testing coverage is expected before shipping?
