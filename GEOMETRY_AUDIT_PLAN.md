# Geometry System Audit and Fix Plan

## Executive Summary

**Problem**: Corner pocket mouth/throat width changes in Modern Geometry Panel don't affect the rendered geometry.

**Root Cause**: The geometry conversion pipeline is incomplete and the relationship between modern parameters and legacy CONFIG values is not fully understood.

**Goal**: Establish a working, validated geometry system where all modern parameters correctly affect rendered geometry.

---

## Phase 1: Discovery & Documentation (2-3 hours)

### 1.1 Map the Current Pipeline

**Task**: Document the complete flow from user input to rendered geometry.

```
User Changes Slider (Modern Geometry Panel)
    ↓
currentGeometry.side/corner updated
    ↓
modernToLegacy() converts to CONFIG values
    ↓
applyLegacyGeometry() updates CONFIG
    ↓
onGeometryChange() → restart() → getTableGeometry()
    ↓
computeJawPositions() derives actual jaw positions
    ↓
Rails and pockets created
    ↓
Renderer draws geometry
```

**Deliverables**:
- Document each function in the pipeline
- Identify all CONFIG parameters and what they control
- Map modern parameters → legacy parameters → visual results

#### Findings (Nov 7, 2025)

- **Modern UI updates**
  - Slider changes update `currentGeometry` via bound callbacks before validation. (`ModernGeometryPanel` `setupControls` @src/ui/ModernGeometryPanel.ts#262-399)
  - `validateAndUpdateUI` computes jaw angles and displays warnings without mutating CONFIG (@src/ui/ModernGeometryPanel.ts#460-497).
- **Apply flow**
  - `applyGeometry()` validates, converts to legacy via `modernToLegacy`, and invokes `applyLegacyGeometry`. (@src/ui/ModernGeometryPanel.ts#499-546)
  - `modernToLegacy` maps modern side/corner configs to CONFIG overrides while leaving throat widths null when overrides are present. (@src/geometry/GeometryConversion.ts#48-166)
  - Side conversion sets `SIDE_JAW_*_OVERRIDE_IN`, `SIDE_STRAIGHT_Y_IN`, and `SIDE_INNER_Y_IN` directly from modern measurements (@src/geometry/GeometryConversion.ts#88-126).
  - Corner conversion currently derives jaw X/Y from rail depth with fixed offsets, not directly from throat width. (@src/geometry/GeometryConversion.ts#128-166)
- **CONFIG application and restart**
  - `applyLegacyGeometry` writes legacy values into CONFIG. (@src/geometry/GeometryConversion.ts#383-416)
  - `ModernGeometryPanel` notifies `onGeometryChange`, which triggers `Game.restart()` to rebuild physics/rendering. (@src/game/Game.ts#86-120, @src/game/Game.ts#327-399)
- **Geometry recompute**
  - Restart calls `initializeGame()`, which rebuilds rails/pockets from `getTableGeometry()`. (@src/game/Game.ts#327-399)
  - `getTableGeometry` calls `computeJawPositions()`; overrides in CONFIG take precedence over derivations during jaw computation. (@src/geometry/Geometry.ts#333-399, @src/geometry/Geometry.ts#491-599)

#### CONFIG Parameter Roles (initial pass)

| CONFIG Key | Set By | Purpose |
|------------|--------|---------|
| `SIDE_JAW_OUTER_OVERRIDE_IN` | `modernPocketToLegacySide` | Half of side mouth width; overrides derivation when present. |
| `SIDE_JAW_INNER_OVERRIDE_IN` | `modernPocketToLegacySide` | Half of side throat width; overrides derivation. |
| `SIDE_STRAIGHT_Y_IN` | `modernPocketToLegacySide` | Straight rail Y from rail depth. |
| `SIDE_INNER_Y_IN` | `modernPocketToLegacySide` | Throat Y from jaw depth. |
| `SIDE_THROAT_WIDTH_IN` | (Legacy panel) | Fallback throat width when overrides absent; unused by modern flow. |
| `SIDE_FRAME_OFFSET_IN` | Legacy/Settings | Controls circle frame offset for derivation; affects side jaw slope when overrides absent. |
| `SIDE_POCKET_OUTWARD_OFFSET_IN` | Modern global offset | Lateral offset applied post-derivation. |
| `CORNER_JAW_X_OVERRIDE_IN` | `modernPocketToLegacyCorner` | Horizontal extent of corner straight rail before taper; currently heuristic. |
| `CORNER_JAW_Y_OVERRIDE_IN` | `modernPocketToLegacyCorner` | Vertical extent of corner straight rail before taper; currently heuristic. |
| `CORNER_THROAT_WIDTH_IN` | (Legacy panel) | Optional throat override; unused when modern overrides set. |
| `POCKET_SHELF_DEPTH_IN` | `modernToLegacy` | Shelf depth passed through from modern corner config. |
| `JAW_REF_RADIUS_IN` | `modernToLegacy` default | Reference radius for side derivation when overrides absent. |
| `CORNER_JAW_REF_RADIUS_IN` | `modernToLegacy` default | Reference radius for corner derivation when overrides absent. |

### 1.2 Understand Legacy Geometry System

**Questions to Answer**:

1. **Side Pockets**:
   - What does `SIDE_JAW_OUTER_OVERRIDE_IN` control? (Answer: Half of mouth width)
   - What does `SIDE_JAW_INNER_OVERRIDE_IN` control? (Answer: Half of throat width)
   - How do `SIDE_STRAIGHT_Y_IN` and `SIDE_INNER_Y_IN` relate to depths? *(Answer: straightY = 25 − railDepth; innerY = straightY + jawDepth.)*
   - When are overrides used vs. derivation? *(Answer: overrides take precedence; derivation only used when overrides are null.)*

2. **Corner Pockets**:
   - What does `CORNER_JAW_X_OVERRIDE_IN` control? *(Answer: horizontal length of straight rail segment before the corner cut. Controls x-position of corner rail endpoints.)*
   - What does `CORNER_JAW_Y_OVERRIDE_IN` control? *(Answer: vertical extent of straight rail segment before corner cut; clamps corner throat height.)*
   - How do corner pockets differ from side pockets? *(Answer: corner derivation uses frame offset & ref radius to compute tangent intersections; overrides default to heuristic values rather than throat widths.)*
   - What role do mouth and throat width play in corners? *(Answer: modern throat width not yet mapped; only shelf depth passes through. Mouth/throat influence must be derived or new overrides added.)*

3. **Derivation System**:
   - When does `deriveSideJawXMagnitudes()` run? *(Answer: inside `computeJawPositions()` before applying overrides, to supply default side jaw widths.)*
   - What do frame offset and reference radius control? *(Answer: they determine the tangent circle used for jaw slope; higher values change derived jaw spread.)*
   - What's the relationship between jaw X/Y and throat width? *(Answer: derived jaw inner X feeds throat width (×2) when no overrides; corner jaw X/Y approximate throat half-width but clamp independently.)*

**Method**:
- Read `Geometry.ts` line by line
- Test each parameter in isolation via Legacy Geometry Panel
- Document visual effect of each parameter
- Create reference screenshots for each configuration

### 1.3 Test Current Behavior

**Test Matrix**:

| Parameter | Panel | Expected Effect | Actual Effect (code review) | Status |
|-----------|-------|----------------|-----------------------------|--------|
| Side Mouth Width | Modern | Widens pocket opening | Overrides `SIDE_JAW_OUTER_OVERRIDE_IN`; renderer should widen. Needs runtime validation. | ❌ |
| Side Throat Width | Modern | Narrows throat | Overrides `SIDE_JAW_INNER_OVERRIDE_IN`; should narrow throat geometry. Needs runtime validation. | ❌ |
| Side Rail Depth | Modern | Moves pocket inward | Works | ✅ |
| Side Jaw Depth | Modern | Extends jaw section | Works | ✅ |
| Corner Mouth Width | Modern | Widens corner opening | No effect: conversion ignores width, sets heuristic jawX/jawY. | ❌ |
| Corner Throat Width | Modern | Narrows corner throat | No effect: conversion ignores width, jaw overrides not derived. | ❌ |
| Corner Rail Depth | Modern | Moves corner inward | Works | ✅ |
| Side Pocket Offset | Modern | Moves pocket from edge | Works | ✅ |

**Process**:
1. Load each template
2. Change each parameter individually
3. Click "Apply to Table"
4. Document visual change (or lack thereof)
5. Check console logs for applied values

**Follow-ups**:
- Add instrumentation (screenshots or measurement utility) to confirm side overrides affect rendered mesh.
- Investigate corner parameter mapping; consider logging `computeJawPositions()` outputs when modern throat width changes.
- Flag that modern corner mouth/throat sliders currently act as no-ops pending Phase 3 conversion fix.

---

## Phase 2: Fix Side Pockets (1-2 hours)

### 2.1 Verify Side Pocket Conversion

**Current Logic** (in `modernPocketToLegacySide`):
```typescript
const jawOuterX = side.mouthWidth / 2;
const jawInnerX = side.throatWidth / 2;
const straightY = PLAY_HALF_H_IN - side.railDepth;
const innerY = straightY + side.jawDepth;
```

**Observations (Nov 7, 2025)**
- `applyGeometry()` logs converted overrides but lacks explicit confirmation that renderer consumed them. @src/ui/ModernGeometryPanel.ts#499-546
- `computeJawPositions()` clamps overrides but otherwise uses them directly for side pockets. @src/geometry/Geometry.ts#333-362
- No runtime check ensures overrides survive restart; need instrumentation or measurement utility (Phase 4).

**Validation Targets**
1. Confirm CONFIG reflects new overrides after applying modern slider changes (already logged; add assertion/screenshot).
2. Capture geometry from `getTableGeometry()` before/after adjustments to ensure `JAW_X_OUTER`/`JAW_X_INNER` track inputs.
3. Visually verify side pocket width change in renderer (screenshot comparison or overlay measurement).

**Tests**:
1. Set mouth width to 6.0 → Expect `SIDE_JAW_OUTER_OVERRIDE_IN = 3.0`
2. Set throat width to 5.0 → Expect `SIDE_JAW_INNER_OVERRIDE_IN = 2.5`
3. Log actual CONFIG values after apply
4. Check if `computeJawPositions()` respects overrides

**Expected Fix**:
- Verify overrides are being set correctly ✓
- Ensure overrides take precedence over derivation ✓
- Check for any clamping that might limit values

### 2.2 Validate Side Pocket Rendering

**Test Cases**:
- Mouth width 4.0" → Tight opening
- Mouth width 8.0" → Wide opening
- Throat width 3.0" → Very narrow
- Throat width 6.0" → Very wide
- Verify jaw angle updates correctly

**Runtime Validation Plan**
1. Add temporary debug logs in `ModernGeometryPanel.applyGeometry` to capture jaw overrides and `getTableGeometry()` outputs after restart.
2. Implement Phase 4 measurement utility to read pocket jaw points directly for automated assertions.
3. Capture before/after screenshots for template + slider adjustments; compare jaw width visually.
4. Consider adding a Jest unit test around `computeJawPositions()` with mocked CONFIG to ensure overrides propagate.

**Potential Implementation Tasks**
- Introduce `measurePocketDimensions()` helper (Phase 4) and call from dev console to validate side pockets.
- Add UI validation message if `SIDE_JAW_OUTER/INNER` exit clamping bounds to highlight issues early.
- Create regression test cases verifying modern → legacy → modern roundtrip for side pockets.

---

## Phase 3: Fix Corner Pockets (2-3 hours)

### 3.1 Understand Corner Geometry Model

**Key Questions**:
1. What physical measurement does `CORNER_JAW_X_OVERRIDE_IN` represent?
2. What physical measurement does `CORNER_JAW_Y_OVERRIDE_IN` represent?
3. How do these relate to mouth and throat width?

**Observations (Nov 7, 2025)**
- `modernPocketToLegacyCorner` ignores modern mouth/throat widths; returns heuristics based on rail depth minus fixed 2.5". @src/geometry/GeometryConversion.ts#128-166
- `computeJawPositions()` clamps overrides but allows null to fall back to derivation (`deriveCornerJawX/Y`). @src/geometry/Geometry.ts#363-387
- Derivation formulas depend on `CORNER_FRAME_OFFSET_IN` and `CORNER_JAW_REF_RADIUS_IN`; modern flow currently leaves these at defaults, limiting control. @src/geometry/Geometry.ts#247-298
- Corner mouth/throat sliders therefore do not affect geometry, matching Phase 1 findings.

**Investigation Steps**:
1. Open Legacy Geometry Panel
2. Set `CORNER_JAW_X_OVERRIDE_IN` to different values (2.0, 3.0, 4.0, 5.0)
3. Observe visual changes to corner pocket shape
4. Repeat for `CORNER_JAW_Y_OVERRIDE_IN`
5. Document the relationship

**Hypothesis**:
- Corner pockets may use a different parametrization than side pockets
- Jaw X/Y might be rail extension points, not throat positions
- Mouth and throat width might need a different conversion formula

**Investigation Plan**
1. Instrument `ModernGeometryPanel.applyGeometry` to log modern corner inputs and resulting CONFIG overrides.
2. Add temporary logging in `computeJawPositions()` for `CORNER_JAW_X/Y` post-clamp to verify behaviour with/without overrides.
3. Use Legacy panel to vary frame offset/ref radius and document effect on derived corner geometry.
4. Evaluate potential formulas translating mouth/throat width into jaw offsets (options A–D) using measurement utility once available.

**Required Experiments / Follow-ups**
- Capture screenshots for varying `CORNER_JAW_X/Y_OVERRIDE_IN` to understand geometry sensitivity.
- Prototype mapping where throat width adjusts both jaw overrides symmetrically; validate against BCA spec angles.
- Determine whether distinct mouth vs throat widths are physically meaningful for corners or if single width suffices.

### 3.2 Determine Correct Conversion

**Options to Test**:

A. **Throat Width Directly** (tested, broke geometry):
```typescript
const jawX = corner.throatWidth / 2;
const jawY = corner.throatWidth / 2;
```

B. **Offset from Straight Rail**:
```typescript
const jawX = straightX - (corner.mouthWidth - corner.throatWidth) / 2;
const jawY = targetY - (corner.mouthWidth - corner.throatWidth) / 2;
```

C. **Based on Jaw Depth**:
```typescript
const jawX = straightX - corner.jawDepth;
const jawY = targetY - corner.jawDepth;
```

D. **Custom Corner Formula**:
```typescript
// Calculate based on corner pocket geometry
// (needs investigation of how corners actually work)
```

**Method**:
- Test each option
- Measure resulting corner pocket opening
- Compare to expected dimensions
- Check against BCA specifications

### 3.3 Add Corner Mouth Width Support

**Question**: Does corner mouth width have meaning in the legacy system?

**Investigation**:
- Check if corner pockets have a "mouth" distinct from "throat"
- In side pockets: mouth is at cushion edge, throat is deeper
- In corners: is there a similar distinction?
- Or do corners only have one opening size?

**Possible Solutions**:
1. Map mouth width to corner opening if it's a single dimension
2. Use mouth and throat to create a tapered corner jaw
3. Document if mouth width is unused for corners

---

## Phase 4: Create Validation System (1-2 hours)

### 4.1 Direct Measurement Tests

**Create Test Utility**:
```typescript
// src/geometry/GeometryValidator.ts
export function measurePocketDimensions(pocketId: string): {
  mouthWidth: number;
  throatWidth: number;
  railDepth: number;
  jawDepth: number;
} {
  const geometry = getTableGeometry();
  const pocket = geometry.pockets.find(p => p.id === pocketId);
  const rails = geometry.rails;

  // Measure actual distances from rail positions
  // Compare to expected values

  return measurements;
}
```

**Design Notes (Nov 7, 2025)**
- Utility should operate on existing `TableGeometry` output; avoid mutating CONFIG. @src/geometry/Geometry.ts#508-848
- Need helpers to identify corresponding rail segments for each pocket (e.g., north throat inner/outer). Consider tagging rails when generated.
- Measurements require transforming pairs of jaw points into widths/depths; ensure consistent axis orientation (Y-up coordinate system).
- Provide optional tolerance parameter to ease validation of floating-point comparisons.

**Implementation Plan**
1. Add `measurePocketDimensions` in new `GeometryValidator` module leveraging `getTableGeometry()`.
2. Expose helpers for side vs corner pockets; return null or warnings if rails missing.
3. Integrate with Phase 2/3 runtime validation (console commands or dev shortcut).
4. Create Jest tests verifying measurement accuracy against known CONFIG setups.

**Test Strategy**
- Unit tests: seed CONFIG with simple overrides, assert measured widths equal inputs within tolerance.
- Integration tests (future): load templates, call validator, compare to template spec values.
- Visual regression: coordinate with screenshot plan in Phase 4.2 once measurement utility confirms geometry.

**Test Cases**:
```typescript
test('Side pocket mouth width matches template', () => {
  const template = GEOMETRY_TEMPLATES.BCA_TOURNAMENT_MEDIUM;
  applyModernGeometry(template);

  const measured = measurePocketDimensions('N_middle');
  expect(measured.mouthWidth).toBeCloseTo(template.side.mouthWidth, 0.1);
});

test('Corner pocket throat width matches template', () => {
  const template = GEOMETRY_TEMPLATES.BCA_TOURNAMENT_TIGHT;
  applyModernGeometry(template);

  const measured = measurePocketDimensions('NE_corner');
  expect(measured.throatWidth).toBeCloseTo(template.corner.throatWidth, 0.1);
});
```

**Integration Notes**
- Provide CLI/dev console hook (e.g., `window.__measurePocket('N_middle')`) for quick checks during manual testing.
- Consider logging discrepancies after `applyGeometry()` when validation fails, guiding user actions.
- Store measurement results alongside screenshots for documentation in Phase 7.

### 4.2 Visual Regression Tests

**Capture Reference Screenshots**:
- BCA Tournament Tight
- BCA Tournament Medium
- BCA Tournament Loose
- Brunswick Gold Crown
- Diamond Pro-Am

**Compare Against**:
- Apply template
- Capture current render
- Compare pixel difference
- Flag if > 5% different

---

## Phase 5: Fix Conversion Logic (2-3 hours)

### 5.1 Implement Correct Corner Conversion

Based on Phase 3 findings, implement the correct formula:

```typescript
function modernPocketToLegacyCorner(corner: PocketConfig): {
  frameOffset: number;
  refRadius: number;
  straightX: number;
  targetY: number;
  jawX: number;
  jawY: number;
} {
  const straightX = PLAY_HALF_W_IN - corner.railDepth;
  const targetY = PLAY_HALF_H_IN - corner.railDepth;

  // TODO: Determine correct formula from Phase 3 investigation
  const jawX = ???;
  const jawY = ???;

  return { ... };
}
```

**Current Gaps**
- `modernPocketToLegacyCorner` subtracts fixed 2.5" from straight rail offsets, producing heuristic jaw overrides unrelated to mouth/throat widths. @src/geometry/GeometryConversion.ts#148-165
- No pathway maps modern jawDepth or throatWidth to corner jaw positions; resulting CONFIG overrides stay constant regardless of sliders.
- Derivation fallback relies on `CORNER_FRAME_OFFSET_IN`/`CORNER_JAW_REF_RADIUS_IN`, which modern flow leaves untouched, limiting responsiveness.

**Dependencies**
- Requires measurement utility from Phase 4 to validate resulting jaw openings.
- Needs Phase 3 experiments to determine physical interpretation of jaw overrides vs. throat width.
- Potential adjustments to renderer expectations (ensure corner rail geometry supports new overrides).

**Action Plan**
1. Replace heuristic offsets with formula derived from throat width + jaw depth (candidate from Phase 3 tests).
2. Ensure mouth width influences either jaw X or introduce additional override (see 5.2).
3. Add clamps consistent with `computeJawPositions()` to avoid invalid geometry.
4. Log before/after jaw overrides during development for verification.

### 5.2 Add Overrides for Corner Mouth Width

If corner mouth width should be supported:

```typescript
// In modernToLegacy()
CORNER_MOUTH_WIDTH_OVERRIDE_IN: modern.corner.mouthWidth,  // New parameter?

// In computeJawPositions()
if (CONFIG.CORNER_MOUTH_WIDTH_OVERRIDE_IN) {
  // Apply mouth width to corner geometry
}
```

**Considerations**
- Legacy system lacks explicit `CORNER_MOUTH_WIDTH_OVERRIDE_IN`; may require adding new CONFIG field and integrating into `computeJawPositions()` and render pipeline.
- Introducing new override demands persistence support in `SettingsManager` and Legacy panel UI.
- Must confirm renderer/jaw calculations can differentiate mouth vs throat in corner context; otherwise document constraint and disable slider.

### 5.3 Update Modern Geometry Calculator

Ensure `calculateCornerJawPoints()` matches the conversion:

```typescript
export function calculateCornerJawPoints(
  config: PocketConfig
): CornerJawPoints {
  // Should match the legacy conversion logic
  // So that modern → legacy → rendered matches modern calculation
}
```

**Next Steps**
- Align calculator's corner math with new conversion formula to keep displayed angles accurate.
- Add unit tests comparing calculator output with `modernToLegacy` + `legacyToModern` roundtrip.
- Update UI validation to flag inconsistent corner parameters (e.g., throat wider than mouth).

---

## Phase 6: Documentation & Cleanup (1 hour)

### 6.1 Document Parameter Relationships

**Create Reference Guide**:
```markdown
# Geometry Parameter Guide

## Side Pockets

| Modern Parameter | Legacy Parameter | Visual Effect | Valid Range |
|-----------------|------------------|---------------|-------------|
| mouthWidth | SIDE_JAW_OUTER_OVERRIDE_IN = width/2 | Opening at cushion edge | 4.0-12.0" |
| throatWidth | SIDE_JAW_INNER_OVERRIDE_IN = width/2 | Narrowest point | 3.0-11.0" |
| railDepth | SIDE_STRAIGHT_Y_IN = 25 - depth | Distance from edge to straight rail | 0.5-2.5" |
| jawDepth | SIDE_INNER_Y_IN = straightY + depth | Length of angled jaw section | 0.5-2.0" |

## Corner Pockets

| Modern Parameter | Legacy Parameter | Visual Effect | Valid Range |
|-----------------|------------------|---------------|-------------|
| mouthWidth | ??? | ??? | 4.0-6.0" |
| throatWidth | ??? | ??? | 3.0-5.0" |
| railDepth | CORNER_STRAIGHT_X_IN = 50 - depth | Distance from corner to straight rail | 1.0-2.5" |
| jawDepth | ??? | ??? | 0.5-1.5" |
```

### 6.2 Remove Debug Logging

Clean up all console.log statements added during debugging:
- `ModernGeometryPanel.ts`
- `GeometryConversion.ts`
- Any other files

### 6.3 Update Comments

Add clear comments explaining:
- Why certain conversions are used
- What each CONFIG parameter controls
- Known limitations or quirks
- References to pool table specifications

---

## Phase 7: Testing & Validation (1-2 hours)

### 7.1 Template Validation

**Process**:
1. Load each template in Modern Geometry Panel
2. Click "Apply to Table"
3. Verify geometry matches template specifications
4. Take screenshot
5. Document any discrepancies

**Templates to Test**:
- Custom
- Current Default
- BCA Tournament Tight
- BCA Tournament Medium
- BCA Tournament Loose
- Brunswick Gold Crown
- Valley Bar Table
- Diamond Pro-Am

### 7.2 Interactive Testing

**User Tests**:
1. Open Modern Geometry Panel (press 'P')
2. Start with BCA Tournament Medium
3. Adjust each slider:
   - Side mouth width: 4.0 → 8.0
   - Side throat width: 3.0 → 6.0
   - Corner mouth width: 4.0 → 6.0
   - Corner throat width: 3.0 → 5.0
4. Verify each change affects rendered geometry
5. Verify jaw angles update correctly
6. Verify validation messages are accurate

### 7.3 Cross-Panel Consistency

**Test**:
1. Set geometry via Modern Panel
2. Open Legacy Panel
3. Verify CONFIG values match expected conversion
4. Make change in Legacy Panel
5. Verify it persists (modern doesn't override)

---

## Success Criteria

### Must Have ✅
- [ ] All Modern Geometry Panel sliders affect rendered geometry
- [ ] Side pocket mouth and throat width work correctly
- [ ] Corner pocket throat width works correctly
- [ ] Jaw angle displays update in real-time
- [ ] All 8 templates render with correct specifications
- [ ] Changes persist across panel switches

### Should Have 🎯
- [ ] Corner pocket mouth width implemented (if applicable)
- [ ] Validation messages accurate for all configurations
- [ ] Reference guide documents all parameters
- [ ] Visual regression tests pass

### Nice to Have ⭐
- [ ] Automated measurement validation
- [ ] Screenshot comparison tests
- [ ] Performance optimizations

---

## Timeline Estimate

| Phase | Estimated Time | Priority |
|-------|---------------|----------|
| Phase 1: Discovery | 2-3 hours | Critical |
| Phase 2: Fix Side Pockets | 1-2 hours | Critical |
| Phase 3: Fix Corner Pockets | 2-3 hours | Critical |
| Phase 4: Validation System | 1-2 hours | High |
| Phase 5: Fix Conversion | 2-3 hours | Critical |
| Phase 6: Documentation | 1 hour | Medium |
| Phase 7: Testing | 1-2 hours | High |

**Total**: 10-16 hours

---

## Risk Mitigation

### Risk 1: Corner Geometry Model Unknown
**Impact**: Can't implement correct conversion without understanding model
**Mitigation**: Phase 3 investigation is thorough and systematic
**Fallback**: Document that corner mouth width is not supported

### Risk 2: Legacy System Has Constraints
**Impact**: Modern parameters might not be fully representable in legacy
**Mitigation**: Phase 1 maps all constraints
**Fallback**: Add validation warnings for unsupported configurations

### Risk 3: Breaking Existing Functionality
**Impact**: Fixes might break working geometry
**Mitigation**: Test each change incrementally, use git commits
**Fallback**: Revert to last working commit

---

## Notes

- Keep all changes in version control with clear commit messages
- Test each change before moving to next phase
- Document unexpected findings immediately
- Take screenshots for before/after comparisons
- Don't rush - understanding the system is critical
