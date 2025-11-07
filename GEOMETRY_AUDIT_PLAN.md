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

### 1.2 Understand Legacy Geometry System

**Questions to Answer**:

1. **Side Pockets**:
   - What does `SIDE_JAW_OUTER_OVERRIDE_IN` control? (Answer: Half of mouth width)
   - What does `SIDE_JAW_INNER_OVERRIDE_IN` control? (Answer: Half of throat width)
   - How do `SIDE_STRAIGHT_Y_IN` and `SIDE_INNER_Y_IN` relate to depths?
   - When are overrides used vs. derivation?

2. **Corner Pockets**:
   - What does `CORNER_JAW_X_OVERRIDE_IN` control?
   - What does `CORNER_JAW_Y_OVERRIDE_IN` control?
   - How do corner pockets differ from side pockets?
   - What role do mouth and throat width play in corners?

3. **Derivation System**:
   - When does `deriveSideJawXMagnitudes()` run?
   - What do frame offset and reference radius control?
   - What's the relationship between jaw X/Y and throat width?

**Method**:
- Read `Geometry.ts` line by line
- Test each parameter in isolation via Legacy Geometry Panel
- Document visual effect of each parameter
- Create reference screenshots for each configuration

### 1.3 Test Current Behavior

**Test Matrix**:

| Parameter | Panel | Expected Effect | Actual Effect | Status |
|-----------|-------|----------------|---------------|--------|
| Side Mouth Width | Modern | Widens pocket opening | ??? | ❌ |
| Side Throat Width | Modern | Narrows throat | ??? | ❌ |
| Side Rail Depth | Modern | Moves pocket inward | Works | ✅ |
| Side Jaw Depth | Modern | Extends jaw section | Works | ✅ |
| Corner Mouth Width | Modern | Widens corner opening | ??? | ❌ |
| Corner Throat Width | Modern | Narrows corner throat | ??? | ❌ |
| Corner Rail Depth | Modern | Moves corner inward | Works | ✅ |
| Side Pocket Offset | Modern | Moves pocket from edge | Works | ✅ |

**Process**:
1. Load each template
2. Change each parameter individually
3. Click "Apply to Table"
4. Document visual change (or lack thereof)
5. Check console logs for applied values

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

---

## Phase 3: Fix Corner Pockets (2-3 hours)

### 3.1 Understand Corner Geometry Model

**Key Questions**:
1. What physical measurement does `CORNER_JAW_X_OVERRIDE_IN` represent?
2. What physical measurement does `CORNER_JAW_Y_OVERRIDE_IN` represent?
3. How do these relate to mouth and throat width?

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
1. Test each option
2. Measure resulting corner pocket opening
3. Compare to expected dimensions
4. Check against BCA specifications

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
